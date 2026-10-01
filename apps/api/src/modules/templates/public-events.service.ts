import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authorizedFunctions, evaluateEventAccess, hashToken, isLinkMode, verifyPassword, type Viewer } from '@bulava/auth';
import { FEATURE_KEYS } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { AudienceService } from '../audience/audience.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { openRegistrationByDefault } from '../registrations/registration-defaults';
import { summarizeForPublic } from '../registrations/registration-public';
import { MediaService } from '../media/media.service';
import { RenderContextService } from './render-context.service';

const PIN_PASS_TTL_SECONDS = 12 * 3600;

/** Is this the event's current secret link, and is it still valid? */
export function secretLinkStatus(
  policy: { linkTokenHash: string | null; linkExpiresAt: Date | null },
  key: string | undefined,
  now = new Date(),
): 'valid' | 'expired' | 'invalid' {
  if (!key || !policy.linkTokenHash || !/^[A-Za-z0-9_-]{43}$/.test(key)) return 'invalid';
  const given = Buffer.from(hashToken(key));
  const expected = Buffer.from(policy.linkTokenHash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'invalid';
  return policy.linkExpiresAt && policy.linkExpiresAt <= now ? 'expired' : 'valid';
}

/**
 * Public event pages (/e/:slug). Viewable without a personal invitation:
 * PUBLIC events, PRIVATE_LINK events (after an optional PIN) and SECRET_TOKEN
 * events through their current, unexpired secret link. Invite-only and
 * group-only events reveal nothing here.
 */
@Injectable()
export class PublicEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
    private readonly renderContext: RenderContextService,
    private readonly entitlements: EntitlementsService,
    private readonly media: MediaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private signPass(eventId: string, exp: number): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`pin-pass:${eventId}:${exp}`).digest('base64url');
  }

  issuePinPass(eventId: string): { pass: string; expiresAt: string } {
    const exp = Math.floor(Date.now() / 1000) + PIN_PASS_TTL_SECONDS;
    return { pass: `${exp}.${this.signPass(eventId, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  verifyPinPass(eventId: string, pass: string | undefined): boolean {
    if (!pass) return false;
    const [expStr, sig] = pass.split('.');
    const exp = Number(expStr);
    if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.signPass(eventId, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private async findEvent(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] } },
      include: { accessPolicy: true },
    });
    if (!event) throw AppError.notFound('Event');
    return event;
  }

  async verifyPin(slug: string, pin: string) {
    const event = await this.findEvent(slug);
    if (event.accessPolicy.mode !== 'PRIVATE_LINK' || !event.accessPolicy.pinHash) throw AppError.notFound('Event');
    if (!(await verifyPassword(pin, event.accessPolicy.pinHash))) throw new AppError('PIN_INVALID', 'That PIN is not correct.');
    return this.issuePinPass(event.id);
  }

  private viewerFor(event: Awaited<ReturnType<PublicEventsService['findEvent']>>, pinPass: string | undefined, linkKey: string | undefined): Viewer {
    return {
      kind: 'anonymous',
      pinVerified: this.verifyPinPass(event.id, pinPass),
      linkVerified: secretLinkStatus(event.accessPolicy, linkKey) === 'valid',
    };
  }

  /**
   * The public gate: PUBLIC events, PRIVATE_LINK events after the PIN, and
   * SECRET_TOKEN events through the current secret link before it expires.
   * Used by the page view and by public registration.
   */
  async assertViewable(slug: string, pinPass: string | undefined, linkKey?: string) {
    const event = await this.findEvent(slug);
    const policy = { mode: event.accessPolicy.mode, hasPin: event.accessPolicy.pinHash !== null };
    const decision = evaluateEventAccess(policy, this.viewerFor(event, pinPass, linkKey));
    if (!decision.allowed) {
      if (decision.reason === 'PIN_REQUIRED') throw new AppError('PIN_REQUIRED', 'Enter the PIN shared by your host.');
      if (decision.reason === 'LINK_REQUIRED' && secretLinkStatus(event.accessPolicy, linkKey) === 'expired') {
        throw new AppError('EVENT_LINK_EXPIRED', 'This invitation link has expired. Ask your host for a new one.');
      }
      throw new AppError('INVITATION_REQUIRED', 'This event is private. Please use your personal invitation link.');
    }
    return event;
  }

  async view(slug: string, pinPass: string | undefined, linkKey?: string) {
    const event = await this.assertViewable(slug, pinPass, linkKey);
    const policy = { mode: event.accessPolicy.mode, hasPin: event.accessPolicy.pinHash !== null };
    const viewer = this.viewerFor(event, pinPass, linkKey);
    // Link-shared events made before registration opened by default.
    if (isLinkMode(policy.mode) && !(await this.prisma.eventRegistrationSettings.count({ where: { eventId: event.id } }))) {
      await this.prisma.$transaction((tx) => openRegistrationByDefault(tx, event.id));
    }

    const facts = await this.audience.loadEventFacts(event.id);
    const allowedIds = new Set(authorizedFunctions(facts.functions, facts.eventPolicy, viewer).map((f) => f.id));
    const [functions, template, features, announcements, registrationSettings, confirmedRegistrations] = await Promise.all([
      this.prisma.eventFunction.findMany({
        where: { eventId: event.id, id: { in: [...allowedIds] }, deletedAt: null },
        include: { venue: true },
        orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
      }),
      this.renderContext.resolveTemplate(event.id, event.typeKey, 'WEBSITE'),
      this.entitlements.forEvent(event.id),
      this.prisma.announcement.findMany({
        where: { eventId: event.id, publishedAt: { not: null }, audience: { path: ['all'], equals: true } },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      this.prisma.eventRegistrationSettings.findUnique({ where: { eventId: event.id } }),
      this.prisma.registration.count({ where: { eventId: event.id, status: 'CONFIRMED' } }),
    ]);
    if (!template) throw new AppError('SERVICE_UNAVAILABLE', 'No template is available.');

    return {
      event: {
        title: event.title,
        slug: event.slug,
        description: event.description,
        typeKey: event.typeKey,
        language: event.language,
        timezone: event.timezone,
        status: event.status,
        accessMode: policy.mode,
        // Only public, listed events may be indexed or get rich previews.
        indexable: policy.mode === 'PUBLIC' && event.visibility === 'LISTED',
      },
      template: { key: template.templateKey, definition: template.definition, customization: template.customization },
      // Photos the host placed in the design appear wherever the design is shown.
      context: await this.renderContext.build({
        event,
        functions,
        customization: template.customization,
        announcements,
        ...(await this.media.templatePhotos(event.id, template.customization)),
        music: await this.renderContext.resolveMusic(template),
      }),
      watermark: EntitlementsService.enabled(features, FEATURE_KEYS.WATERMARK),
      registration: summarizeForPublic(registrationSettings, confirmedRegistrations, event.status === 'ACTIVE'),
    };
  }

  /** Sitemap entries: public + listed + active events only. */
  async sitemap() {
    const events = await this.prisma.event.findMany({
      where: { deletedAt: null, status: 'ACTIVE', visibility: 'LISTED', accessPolicy: { mode: 'PUBLIC' } },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });
    return events.map((e) => ({ slug: e.slug, updatedAt: e.updatedAt.toISOString() }));
  }
}
