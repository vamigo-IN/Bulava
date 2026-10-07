import { Injectable } from '@nestjs/common';
import { permissionsForEventRole } from '@bulava/auth';
import type { Prisma } from '@bulava/database';
import { validateEventDetails, type QuickStartInput, type QuickStartVerifyInput } from '@bulava/validation';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { toPublicUser, type PublicUser } from '../auth/public-user';
import { SessionService, type IssuedSession } from '../auth/session.service';
import { EventLinksService } from '../domains/event-links.service';
import { EventsService } from '../events/events.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { DesignService } from '../templates/design.service';
import { ConsentService } from '../users/consent.service';
import { PhoneOtpService } from './phone-otp.service';

export interface QuickStartResult {
  user: PublicUser;
  session: IssuedSession;
  event: { id: string; previewToken: string; previewUrl: string };
  /** The preview link was queued to the host's WhatsApp (needs the integration and its template). */
  whatsappSent: boolean;
}

export type QuickStartOutcome = QuickStartResult | { requiresOtp: true; target: string };

type Template = NonNullable<Awaited<ReturnType<PrismaService['template']['findUnique']>>>;
type EventType = NonNullable<Awaited<ReturnType<PrismaService['eventType']['findFirst']>>>;

/** 10:00 in India on the chosen day: a sensible first time for the main function. */
function dayAtTen(date: string): Date {
  return new Date(`${date}T10:00:00+05:30`);
}

/**
 * The template page's quick start: names, a date and a WhatsApp number become a
 * draft event with the chosen design, a signed-in (provisional) account and a
 * shareable preview link, in one request and before any password or payment.
 * A number that already has an account must prove it with a code first.
 */
@Injectable()
export class QuickStartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly design: DesignService,
    private readonly sessions: SessionService,
    private readonly consents: ConsentService,
    private readonly audit: AuditService,
    private readonly queues: QueueService,
    private readonly links: EventLinksService,
    private readonly settings: PlatformSettingsService,
    private readonly otp: PhoneOtpService,
  ) {}

  private async resolve(input: QuickStartInput): Promise<{ template: Template; type: EventType; details: Record<string, unknown> }> {
    const template = await this.prisma.template.findUnique({ where: { key: input.templateKey } });
    if (!template || template.status !== 'PUBLISHED' || !template.currentVersionId || !template.outputs.includes('WEBSITE')) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not available.');
    }
    const typeKey = input.typeKey ?? template.eventTypes[0] ?? 'WEDDING';
    if (template.eventTypes.length > 0 && !template.eventTypes.includes(typeKey)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not designed for this type of event.');
    }
    const type = await this.prisma.eventType.findFirst({ where: { key: typeKey, enabled: true } });
    if (!type) throw new AppError('INVALID_EVENT_TYPE', 'Unknown event type.');
    const details = validateEventDetails(type.detailsSchemaKey, input.details);
    if (!details.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Please check the names.',
        details.error.issues.map((i) => ({ path: ['details', ...i.path].join('.'), message: i.message })),
      );
    }
    return { template, type, details: details.data as Record<string, unknown> };
  }

  /** The event's title from what the host typed. */
  private titleFor(type: EventType, details: Record<string, unknown>, input: QuickStartInput): string {
    const p1 = typeof details.partnerOne === 'string' ? details.partnerOne : '';
    const p2 = typeof details.partnerTwo === 'string' ? details.partnerTwo : '';
    const name = typeof details.name === 'string' ? details.name : '';
    if (p1 && p2) return `${p1} & ${p2}`;
    if (name) return input.language === 'en' ? `${name}'s ${type.name}` : `${name} - ${type.name}`;
    return (input.title || type.name).slice(0, 160);
  }

  /** A host's first name for messages. */
  private hostName(details: Record<string, unknown>, title: string): string {
    const first = [details.partnerOne, details.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
    return (first ?? title).trim().split(/\s+/)[0]!.slice(0, 60);
  }

  async start(input: QuickStartInput, meta: RequestMeta): Promise<QuickStartOutcome> {
    const resolved = await this.resolve(input);
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      if (existing.status !== 'ACTIVE' || existing.deletedAt) {
        throw new AppError('PHONE_TAKEN', 'This number belongs to an account that cannot be used right now. Please sign in.');
      }
      // No point in a code when the account cannot take another free event (PLAN_LIMIT_REACHED says so).
      await this.events.assertEventAllowance(existing.id);
      // Someone else's number must not open their account: the owner proves it with a code.
      const { target } = await this.otp.send(input.phone, 'quick-start');
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.quick_start_otp', targetType: 'User', targetId: existing.id, meta });
      return { requiresOtp: true, target };
    }

    const title = this.titleFor(resolved.type, resolved.details, input);
    const versions = await this.consents.versions(['terms', 'privacy']);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: this.hostName(resolved.details, title),
          phone: input.phone,
          locale: input.language,
          provisional: true,
          whatsappOptInAt: input.whatsappUpdates ? new Date() : null,
        },
      });
      await this.recordConsents(tx, created.id, versions, input.whatsappUpdates);
      await this.audit.record(
        { actorType: 'USER', actorId: created.id, action: 'user.signup', targetType: 'User', targetId: created.id, metadata: { method: 'quick_start' }, meta },
        tx,
      );
      return created;
    });
    return this.createForUser(user, input, resolved, title, meta);
  }

  /** The code step for a number that already has an account. */
  async verify(input: QuickStartVerifyInput, meta: RequestMeta): Promise<QuickStartResult> {
    const resolved = await this.resolve(input);
    const found = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!found || found.status !== 'ACTIVE' || found.deletedAt) throw new AppError('PHONE_TAKEN', 'This number belongs to an account that cannot be used right now.');
    // Checked before the code is spent, so a refusal costs nothing.
    await this.events.assertEventAllowance(found.id);
    await this.otp.verify(input.phone, input.code, 'quick-start');
    // A verified number secures the account.
    const user = await this.prisma.user.update({ where: { id: found.id }, data: { phoneVerifiedAt: found.phoneVerifiedAt ?? new Date(), provisional: false } });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login', targetType: 'User', targetId: user.id, metadata: { method: 'whatsapp_otp', via: 'quick_start' }, meta });
    return this.createForUser(user, input, resolved, this.titleFor(resolved.type, resolved.details, input), meta);
  }

  /** The ticked boxes: the Terms and Privacy Policy (required), and updates on WhatsApp (optional). */
  private async recordConsents(tx: Tx, userId: string, versions: Record<string, string>, whatsappUpdates: boolean): Promise<void> {
    await this.consents.recordSignup(tx, userId, versions, 'quick_start');
    if (whatsappUpdates) await this.consents.recordWhatsAppUpdates(tx, userId, true, 'quick_start');
  }

  private async createForUser(
    user: NonNullable<Awaited<ReturnType<PrismaService['user']['findUnique']>>>,
    input: QuickStartInput,
    resolved: Awaited<ReturnType<QuickStartService['resolve']>>,
    title: string,
    meta: RequestMeta,
  ): Promise<QuickStartResult> {
    const created = await this.events.create(
      user.id,
      {
        typeKey: resolved.type.key,
        title,
        language: input.language,
        timezone: 'Asia/Kolkata',
        // One link for everyone, with registration: what a shared invitation needs.
        accessMode: 'PRIVATE_LINK',
        visibility: 'UNLISTED',
        details: resolved.details,
        applyDefaults: true,
      },
      meta,
      { source: 'quick_start' },
    );
    const access: EventAccessContext = { eventId: created.id, userId: user.id, role: 'OWNER', permissions: permissionsForEventRole('OWNER'), functionIds: [] };

    if (input.date) await this.setMainDate(created.id, resolved.type, input.date);
    // The chosen design, whatever its tier: drafts carry a watermark until the plan allows it.
    await this.design.select(access, 'WEBSITE', { templateKey: resolved.template.key }, meta);

    const previewUrl = `${await this.links.guestOrigin(created.id)}/preview/${created.previewToken}`;
    let whatsappSent = false;
    if ((await this.settings.whatsappHost()).preview) {
      await this.queues.add('whatsapp', { to: user.phone!, template: 'preview', params: [this.hostName(resolved.details, title), resolved.template.name, previewUrl] });
      whatsappSent = true;
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'event.preview_link_sent', targetType: 'Event', targetId: created.id, eventId: created.id, metadata: { channel: 'whatsapp' }, meta });
    }

    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session, event: { id: created.id, previewToken: created.previewToken, previewUrl }, whatsappSent };
  }

  /** The chosen day goes on the main function (the one named after the event type, else the first). */
  private async setMainDate(eventId: string, type: EventType, date: string): Promise<void> {
    const functions = await this.prisma.eventFunction.findMany({ where: { eventId, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
    if (!functions.length) return;
    const main = functions.find((f) => f.slug === type.key.toLowerCase() || f.name.toLowerCase() === type.name.toLowerCase()) ?? functions[0]!;
    const startsAt = dayAtTen(date);
    await this.prisma.$transaction(async (tx) => {
      await tx.eventFunction.update({ where: { id: main.id }, data: { startsAt } });
      const agg = await tx.eventFunction.aggregate({ where: { eventId, deletedAt: null, status: { not: 'CANCELLED' } }, _min: { startsAt: true }, _max: { endsAt: true, startsAt: true } });
      const data: Prisma.EventUpdateInput = { startDate: agg._min.startsAt, endDate: agg._max.endsAt ?? agg._max.startsAt };
      await tx.event.update({ where: { id: eventId }, data });
    });
  }
}
