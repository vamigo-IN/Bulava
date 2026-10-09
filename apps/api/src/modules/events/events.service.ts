import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashPassword, isLinkMode, permissionsForEventRole, type EventPermission, type EventRole } from '@bulava/auth';
import { isSupportedLanguage, zonedWallTimeToUtcIso } from '@bulava/localization';
import {
  slugify,
  validateEventDetails,
  type CreateEventInput,
  type UpdateEventInput,
} from '@bulava/validation';
import type { Prisma } from '@bulava/database';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { openRegistrationByDefault } from '../registrations/registration-defaults';
import { assertVerifiedAccount } from '../users/account-gate';
import { ShareLinkService } from './share-link.service';
import { FEATURE_KEYS } from '@bulava/validation';

/** An unguessable preview link (/preview/<token>): 144 bits, URL-safe. */
export const newPreviewToken = () => randomBytes(18).toString('base64url');

const eventInclude = {
  accessPolicy: { select: { mode: true, pinHash: true, requireOtp: true } },
  _count: { select: { guests: { where: { deletedAt: null } } } },
  // Each function's date and venue: the counts tell set-up functions (date, time and venue) from placeholders.
  functions: { where: { deletedAt: null }, select: { startsAt: true, venueId: true } },
  // The chosen website design, for the dashboard's event cards (none until the host picks one).
  templateSelections: { where: { output: 'WEBSITE' }, take: 1, select: { templateVersion: { select: { template: { select: { key: true, name: true, tier: true } } } } } },
} satisfies Prisma.EventInclude;

type EventWithPolicy = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export interface EventDto {
  id: string;
  typeKey: string;
  title: string;
  slug: string;
  description: string | null;
  language: string;
  timezone: string;
  status: string;
  visibility: string;
  accessMode: string;
  hasPin: boolean;
  requireOtp: boolean;
  startDate: Date | null;
  endDate: Date | null;
  details: unknown;
  /** readyFunctions: functions with a date, time and venue (the others are placeholders guests do not see yet). */
  counts: { functions: number; readyFunctions: number; guests: number };
  /** The website design the host chose; null while the type's default stands in. */
  design: { templateKey: string; templateName: string; tier: string } | null;
  /** The host's shareable, watermarked preview link token (members only see this DTO). */
  previewToken: string;
  /** "quick_start" when it began on the template page. */
  source: string | null;
  role?: string;
  /** What the caller may do in this event; the dashboard shows only what they can use. */
  permissions?: EventPermission[];
  createdAt: Date;
  updatedAt: Date;
}

function toDto(event: EventWithPolicy, role?: string): EventDto {
  return {
    id: event.id,
    typeKey: event.typeKey,
    title: event.title,
    slug: event.slug,
    description: event.description,
    language: event.language,
    timezone: event.timezone,
    status: event.status,
    visibility: event.visibility,
    accessMode: event.accessPolicy.mode,
    hasPin: event.accessPolicy.pinHash !== null,
    requireOtp: event.accessPolicy.requireOtp,
    startDate: event.startDate,
    endDate: event.endDate,
    details: event.details,
    counts: { functions: event.functions.length, readyFunctions: event.functions.filter((f) => f.startsAt && f.venueId).length, guests: event._count.guests },
    design: designOf(event),
    previewToken: event.previewToken,
    source: event.source,
    ...(role ? { role, permissions: permissionsForEventRole(role as EventRole) } : {}),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function designOf(event: EventWithPolicy): EventDto['design'] {
  const template = event.templateSelections[0]?.templateVersion.template;
  return template ? { templateKey: template.key, templateName: template.name, tier: template.tier } : null;
}

interface DefaultItem {
  name: string;
  slug: string;
}

function asDefaultItems(value: Prisma.JsonValue): DefaultItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return [];
    const { name, slug } = v as Record<string, unknown>;
    return typeof name === 'string' && typeof slug === 'string' ? [{ name, slug }] : [];
  });
}

/** The system group every new guest joins automatically. */
export const ALL_GUESTS_SLUG = 'all-guests';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly shareLinks: ShareLinkService,
  ) {}

  async listForUser(userId: string): Promise<EventDto[]> {
    const memberships = await this.prisma.eventMember.findMany({
      where: { userId, event: { deletedAt: null } },
      include: { event: { include: eventInclude } },
      orderBy: { event: { createdAt: 'desc' } },
    });
    return memberships.map((m) => toDto(m.event, m.role));
  }

  async get(access: EventAccessContext): Promise<EventDto> {
    const event = await this.prisma.event.findFirst({
      where: { id: access.eventId, deletedAt: null },
      include: eventInclude,
    });
    if (!event) throw AppError.notFound('Event');
    return toDto(event, access.role);
  }

  /** Free events count against events.max; events with a purchase do not. Throws PLAN_LIMIT_REACHED; returns the person's features. */
  async assertEventAllowance(userId: string) {
    const features = await this.entitlements.forUser(userId);
    const freeEvents = await this.prisma.event.count({
      where: { ownerId: userId, deletedAt: null, status: { notIn: ['ARCHIVED', 'CANCELLED'] } },
    });
    const paidEvents = await this.prisma.entitlement.findMany({
      where: { userId, eventId: { not: null } },
      select: { eventId: true },
      distinct: ['eventId'],
    });
    EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.EVENTS_MAX, Math.max(0, freeEvents - paidEvents.length));
    return features;
  }

  async create(userId: string, input: CreateEventInput, meta: RequestMeta, options: { source?: 'quick_start' } = {}): Promise<EventDto> {
    const type = await this.prisma.eventType.findFirst({ where: { key: input.typeKey, enabled: true } });
    if (!type) throw new AppError('INVALID_EVENT_TYPE', 'Unknown event type.');
    if (!isSupportedLanguage(input.language)) throw new AppError('UNSUPPORTED_LANGUAGE', 'Unsupported language.');

    const details = validateEventDetails(type.detailsSchemaKey, input.details);
    if (!details.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Event details are invalid.',
        details.error.issues.map((i) => ({ path: ['details', ...i.path].join('.'), message: i.message })),
      );
    }

    const features = await this.assertEventAllowance(userId);

    const slug = `${slugify(input.title) || 'event'}-${randomBytes(4).toString('hex').slice(0, 6)}`;

    const event = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.accessPolicy.create({ data: { mode: input.accessMode } });
      const created = await tx.event.create({
        data: {
          ownerId: userId,
          typeKey: type.key,
          title: input.title,
          slug,
          description: input.description ?? null,
          language: input.language,
          timezone: input.timezone,
          visibility: input.visibility,
          accessPolicyId: policy.id,
          details: details.data as Prisma.InputJsonValue,
          previewToken: newPreviewToken(),
          source: options.source ?? null,
          members: { create: { userId, role: 'OWNER' } },
        },
      });

      // Every event gets an "All Guests" system group.
      const groups = asDefaultItems(type.defaultGroups);
      const groupSeeds = input.applyDefaults ? groups : groups.filter((g) => g.slug === ALL_GUESTS_SLUG);
      if (!groupSeeds.some((g) => g.slug === ALL_GUESTS_SLUG)) {
        groupSeeds.unshift({ name: 'All Guests', slug: ALL_GUESTS_SLUG });
      }
      await tx.guestGroup.createMany({
        data: groupSeeds.map((g, index) => ({
          eventId: created.id,
          name: g.name,
          slug: g.slug,
          kind: g.slug === ALL_GUESTS_SLUG ? 'SYSTEM' : 'CUSTOM',
          sortOrder: index,
        })),
      });

      if (input.applyDefaults) {
        const maxFunctions = EntitlementsService.limit(features, FEATURE_KEYS.FUNCTIONS_MAX);
        // The host may keep only some of the suggestions (no Mehendi, say); unknown slugs are ignored.
        const chosen = input.functionSlugs ? new Set(input.functionSlugs) : null;
        const defaults = asDefaultItems(type.defaultFunctions).filter((f) => !chosen || chosen.has(f.slug));
        await tx.eventFunction.createMany({
          data: (maxFunctions === null ? defaults : defaults.slice(0, maxFunctions)).map((f, index) => ({
            eventId: created.id,
            name: f.name,
            slug: f.slug,
            sortOrder: index,
          })),
        });
      }

      // Shared by one link: registration starts open, and a secret link is made at once.
      if (isLinkMode(input.accessMode)) await openRegistrationByDefault(tx, created.id, { always: true });
      if (input.accessMode === 'SECRET_TOKEN') await this.shareLinks.ensureSecretLink(tx, created.id);

      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'event.created',
          targetType: 'Event',
          targetId: created.id,
          eventId: created.id,
          metadata: { typeKey: type.key, accessMode: input.accessMode },
          meta,
        },
        tx,
      );
      return tx.event.findUniqueOrThrow({ where: { id: created.id }, include: eventInclude });
    });

    if (input.date) {
      await this.setMainDate(event.id, type, input.date, input.timezone);
      return toDto(await this.prisma.event.findUniqueOrThrow({ where: { id: event.id }, include: eventInclude }), 'OWNER');
    }
    return toDto(event, 'OWNER');
  }

  /**
   * A day chosen before the functions have their own dates (event creation, the
   * quick start): it goes on the main function, the one named after the event
   * type or else the first, at 10 am in the event's time zone. Without
   * functions it becomes the event's start date.
   */
  async setMainDate(eventId: string, type: { key: string; name: string }, date: string, timezone: string): Promise<void> {
    const startsAt = new Date(zonedWallTimeToUtcIso(`${date}T10:00`, timezone));
    const functions = await this.prisma.eventFunction.findMany({ where: { eventId, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
    if (!functions.length) {
      await this.prisma.event.update({ where: { id: eventId }, data: { startDate: startsAt, endDate: startsAt } });
      return;
    }
    const main = functions.find((f) => f.slug === type.key.toLowerCase() || f.name.toLowerCase() === type.name.toLowerCase()) ?? functions[0]!;
    await this.prisma.$transaction(async (tx) => {
      await tx.eventFunction.update({ where: { id: main.id }, data: { startsAt } });
      const agg = await tx.eventFunction.aggregate({ where: { eventId, deletedAt: null, status: { not: 'CANCELLED' } }, _min: { startsAt: true }, _max: { endsAt: true, startsAt: true } });
      await tx.event.update({ where: { id: eventId }, data: { startDate: agg._min.startsAt, endDate: agg._max.endsAt ?? agg._max.startsAt } });
    });
  }

  /**
   * Publishing needs a secured account and a plan that covers the chosen design:
   * drafts may preview any design with a watermark, but guests only see what the
   * plan allows.
   */
  private async assertPublishable(userId: string, eventId: string): Promise<void> {
    await assertVerifiedAccount(this.prisma, userId);
    const selection = await this.prisma.eventTemplateSelection.findUnique({
      where: { eventId_output: { eventId, output: 'WEBSITE' } },
      include: { templateVersion: { include: { template: { select: { tier: true } } } } },
    });
    if (selection) EntitlementsService.assertTemplateTier(await this.entitlements.forEvent(eventId), selection.templateVersion.template.tier);
  }

  /** A new preview link; the old one stops working at once. */
  async rotatePreviewToken(access: EventAccessContext, meta: RequestMeta): Promise<{ previewToken: string }> {
    const previewToken = newPreviewToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: access.eventId }, data: { previewToken } });
      await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'event.preview_link_replaced', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, meta }, tx);
    });
    return { previewToken };
  }

  async update(access: EventAccessContext, input: UpdateEventInput, meta: RequestMeta): Promise<EventDto> {
    const event = await this.prisma.event.findFirst({
      where: { id: access.eventId, deletedAt: null },
      include: { type: true, accessPolicy: true },
    });
    if (!event) throw AppError.notFound('Event');

    if (input.status && input.status !== event.status && !access.permissions.includes('event.publish')) {
      throw AppError.forbidden('You cannot change the event status.');
    }
    if (input.status === 'ACTIVE' && event.status !== 'ACTIVE') await this.assertPublishable(access.userId, event.id);
    if (input.language && !isSupportedLanguage(input.language)) {
      throw new AppError('UNSUPPORTED_LANGUAGE', 'Unsupported language.');
    }
    let details: Prisma.InputJsonValue | undefined;
    if (input.details) {
      const parsed = validateEventDetails(event.type.detailsSchemaKey, input.details);
      if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'Event details are invalid.');
      details = parsed.data as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.requireOtp !== undefined && input.requireOtp !== event.accessPolicy.requireOtp) {
        await tx.accessPolicy.update({ where: { id: event.accessPolicyId }, data: { requireOtp: input.requireOtp } });
        await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'event.otp_policy_changed', targetType: 'Event', targetId: event.id, eventId: event.id, metadata: { requireOtp: input.requireOtp }, meta }, tx);
      }
      if (input.pin !== undefined) {
        await tx.accessPolicy.update({
          where: { id: event.accessPolicyId },
          data: { pinHash: input.pin === null ? null : await hashPassword(input.pin) },
        });
        await this.audit.record(
          { actorType: 'USER', actorId: access.userId, action: input.pin === null ? 'event.pin_removed' : 'event.pin_set', targetType: 'Event', targetId: event.id, eventId: event.id, meta },
          tx,
        );
      }
      if (input.accessMode && input.accessMode !== event.accessPolicy.mode) {
        await tx.accessPolicy.update({ where: { id: event.accessPolicyId }, data: { mode: input.accessMode } });
        if (input.accessMode === 'SECRET_TOKEN') await this.shareLinks.ensureSecretLink(tx, event.id);
        // From personal invitations to one shared link: people can register from it.
        if (isLinkMode(input.accessMode) && !isLinkMode(event.accessPolicy.mode)) await openRegistrationByDefault(tx, event.id, { always: true });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: access.userId,
            action: 'event.access_changed',
            targetType: 'Event',
            targetId: event.id,
            eventId: event.id,
            metadata: { from: event.accessPolicy.mode, to: input.accessMode },
            meta,
          },
          tx,
        );
      }
      if (input.status && input.status !== event.status) {
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: access.userId,
            action: 'event.status_changed',
            targetType: 'Event',
            targetId: event.id,
            eventId: event.id,
            metadata: { from: event.status, to: input.status },
            meta,
          },
          tx,
        );
      }
      return tx.event.update({
        where: { id: event.id },
        data: {
          title: input.title,
          description: input.description,
          language: input.language,
          timezone: input.timezone,
          visibility: input.visibility,
          status: input.status,
          details,
        },
        include: eventInclude,
      });
    });
    return toDto(updated, access.role);
  }

  async softDelete(access: EventAccessContext, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.event.updateMany({
        where: { id: access.eventId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) throw AppError.notFound('Event');
      // Deleting an event immediately kills every invitation link.
      await tx.invitation.updateMany({
        where: { eventId: access.eventId, status: { not: 'REVOKED' } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await tx.invitationToken.updateMany({
        where: { eventId: access.eventId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'event.deleted',
          targetType: 'Event',
          targetId: access.eventId,
          eventId: access.eventId,
          meta,
        },
        tx,
      );
    });
  }
}
