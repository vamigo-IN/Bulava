import { Injectable } from '@nestjs/common';
import { isLinkMode, type AccessMode } from '@bulava/auth';
import type { Prisma, RegistrationStatus } from '@bulava/database';
import {
  checkFormAnswers,
  FEATURE_KEYS,
  RegistrationFieldsSchema,
  type RegisterInput,
  type RegistrationDecision,
  type RegistrationSettingsInput,
} from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ALL_GUESTS_SLUG } from '../events/events.service';
import { InvitationTokenService } from '../invitations/invitation-token.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PublicEventsService } from '../templates/public-events.service';
import { ensureRegisteredGroup, openRegistrationByDefault } from './registration-defaults';
export { summarizeForPublic, type PublicRegistrationInfo } from './registration-public';
export { REGISTERED_GROUP_SLUG } from './registration-defaults';

type Tx = Prisma.TransactionClient;
/** Consent text version stored with each registration (bump when the wording changes). */
export const REGISTRATION_CONSENT_VERSION = 'registration-2026-09';

const registrationInclude = {
  guest: { select: { id: true, name: true, email: true, phone: true, preferredLanguage: true, deletedAt: true } },
} satisfies Prisma.RegistrationInclude;

/**
 * Public event registration (spec §89):
 * Public event → register → guest record → registration → confirmation.
 * Confirmed registrants get a personal invitation link, so everything after
 * registration (RSVP, photos, check-in) reuses the invitation system.
 */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly tokens: InvitationTokenService,
    private readonly notifications: NotificationsService,
    private readonly publicEvents: PublicEventsService,
  ) {}

  // ───────────────────────── Host ─────────────────────────

  async getSettings(access: EventAccessContext) {
    const mode = await this.prisma.accessPolicy.findFirst({ where: { event: { id: access.eventId } }, select: { mode: true } });
    // Events made before registration opened by default: open it the first time the host looks.
    if (mode && isLinkMode(mode.mode)) await this.prisma.$transaction((tx) => openRegistrationByDefault(tx, access.eventId));
    const [settings, counts, event] = await Promise.all([
      this.prisma.eventRegistrationSettings.findUnique({ where: { eventId: access.eventId } }),
      this.prisma.registration.groupBy({ by: ['status'], where: { eventId: access.eventId }, _count: { _all: true } }),
      this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, select: { slug: true, accessPolicy: { select: { mode: true } } } }),
    ]);
    return {
      settings: {
        enabled: settings?.enabled ?? false,
        fields: RegistrationFieldsSchema.safeParse(settings?.fields ?? []).data ?? [],
        maxRegistrations: settings?.maxRegistrations ?? null,
        approvalRequired: settings?.approvalRequired ?? false,
        waitlistEnabled: settings?.waitlistEnabled ?? false,
        closesAt: settings?.closesAt ?? null,
      },
      available: RegistrationsService.modeAllowsRegistration(event.accessPolicy.mode),
      accessMode: event.accessPolicy.mode,
      slug: event.slug,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<RegistrationStatus, number>>,
    };
  }

  /** Registration needs a link-shared event: public, private link or secret link. */
  static modeAllowsRegistration(mode: string): boolean {
    return isLinkMode(mode as AccessMode);
  }

  async updateSettings(access: EventAccessContext, input: RegistrationSettingsInput, meta: RequestMeta) {
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, include: { accessPolicy: true } });
    if (input.enabled && !RegistrationsService.modeAllowsRegistration(event.accessPolicy.mode)) {
      throw new AppError('REGISTRATION_NOT_AVAILABLE', 'Registration needs an event shared by link (public, private link or secret link). Change who can open the invitation first.');
    }
    await this.prisma.$transaction(async (tx) => {
      const groupId = input.enabled ? await ensureRegisteredGroup(tx, access.eventId) : undefined;
      const data = {
        enabled: input.enabled,
        fields: input.fields as unknown as Prisma.InputJsonValue,
        maxRegistrations: input.maxRegistrations,
        approvalRequired: input.approvalRequired,
        waitlistEnabled: input.waitlistEnabled,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        ...(groupId ? { groupId } : {}),
      };
      await tx.eventRegistrationSettings.upsert({ where: { eventId: access.eventId }, create: { eventId: access.eventId, ...data }, update: data });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'registration.settings_updated',
          targetType: 'Event',
          targetId: access.eventId,
          eventId: access.eventId,
          metadata: { enabled: input.enabled, maxRegistrations: input.maxRegistrations, approvalRequired: input.approvalRequired, waitlistEnabled: input.waitlistEnabled },
          meta,
        },
        tx,
      );
    });
    // Raising the cap (or removing approval) may free places for the waitlist.
    if (input.enabled && !input.approvalRequired) await this.promoteWaitlist(access.eventId);
    return this.getSettings(access);
  }

  async list(access: EventAccessContext, status?: RegistrationStatus) {
    const rows = await this.prisma.registration.findMany({
      where: { eventId: access.eventId, ...(status ? { status } : {}), guest: { deletedAt: null } },
      include: registrationInclude,
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      answers: r.answers,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      guest: { id: r.guest.id, name: r.guest.name, email: r.guest.email, phone: r.guest.phone },
    }));
  }

  async decide(access: EventAccessContext, registrationId: string, decision: RegistrationDecision, meta: RequestMeta) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockSettings(tx, access.eventId);
      const reg = await tx.registration.findFirst({ where: { id: registrationId, eventId: access.eventId }, include: registrationInclude });
      if (!reg || reg.guest.deletedAt) throw AppError.notFound('Registration');
      const settings = await tx.eventRegistrationSettings.findUnique({ where: { eventId: access.eventId } });

      const allowed: Record<RegistrationDecision, RegistrationStatus[]> = {
        CONFIRM: ['PENDING', 'WAITLISTED'],
        WAITLIST: ['PENDING'],
        REJECT: ['PENDING', 'WAITLISTED'],
        CANCEL: ['CONFIRMED'],
      };
      if (!allowed[decision].includes(reg.status)) {
        throw new AppError('CONFLICT', `A ${reg.status.toLowerCase()} registration cannot be changed that way.`);
      }
      if (decision === 'CONFIRM' && settings?.maxRegistrations != null) {
        const confirmed = await tx.registration.count({ where: { eventId: access.eventId, status: 'CONFIRMED' } });
        if (confirmed >= settings.maxRegistrations) throw new AppError('REGISTRATION_FULL', 'All places are taken. Raise the limit or cancel another registration first.');
      }
      const status: RegistrationStatus = { CONFIRM: 'CONFIRMED', WAITLIST: 'WAITLISTED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' }[decision] as RegistrationStatus;
      await tx.registration.update({ where: { id: reg.id }, data: { status, decidedById: access.userId, decidedAt: new Date() } });
      if (status === 'CONFIRMED') await this.issueInvitation(tx, access.eventId, reg.guestId, access.userId);
      if (status === 'CANCELLED' || status === 'REJECTED') await this.revokeInvitations(tx, access.eventId, reg.guestId);
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: `registration.${decision.toLowerCase()}`, targetType: 'Registration', targetId: reg.id, eventId: access.eventId, meta },
        tx,
      );
      return { status, guestId: reg.guestId, approvalRequired: settings?.approvalRequired ?? false };
    });
    await this.notifyRegistrant(access.eventId, outcome.guestId, outcome.status);
    if (outcome.status === 'CANCELLED' && !outcome.approvalRequired) await this.promoteWaitlist(access.eventId);
    return { status: outcome.status };
  }

  // ───────────────────────── Public ─────────────────────────

  async register(slug: string, pinPass: string | undefined, linkKey: string | undefined, input: RegisterInput, meta: RequestMeta) {
    // Same gate as viewing the page: public, private link with the PIN, or the current secret link.
    const event = await this.publicEvents.assertViewable(slug, pinPass, linkKey);
    if (event.status !== 'ACTIVE') throw new AppError('REGISTRATION_CLOSED', 'Registration is closed for this event.');

    const settings = await this.prisma.eventRegistrationSettings.findUnique({ where: { eventId: event.id } });
    if (!settings?.enabled || !RegistrationsService.modeAllowsRegistration(event.accessPolicy.mode)) throw AppError.notFound('Registration');
    if (settings.closesAt && settings.closesAt <= new Date()) throw new AppError('REGISTRATION_CLOSED', 'Registration is closed for this event.');

    const fields = RegistrationFieldsSchema.safeParse(settings.fields);
    const answers = checkFormAnswers(fields.success ? fields.data : [], input.answers);
    if (!answers.ok) {
      const what = answers.reason === 'required' ? 'Please answer' : answers.reason === 'unknown' ? 'Unknown field' : 'Invalid answer for';
      throw new AppError('REGISTRATION_INVALID', `${what}: ${answers.key}`, { key: answers.key, reason: answers.reason });
    }
    const features = await this.entitlements.forEvent(event.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockSettings(tx, event.id);
      if (!locked) throw AppError.notFound('Registration');

      // One registration per email / phone. People already on the guest list use their own link.
      const contact: Prisma.GuestWhereInput[] = [
        ...(input.email ? [{ email: input.email }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
      ];
      const existing = await tx.guest.findFirst({ where: { eventId: event.id, deletedAt: null, OR: contact }, include: { registration: true } });
      if (existing) {
        throw existing.registration
          ? new AppError('ALREADY_REGISTERED', 'This email or phone number is already registered for this event.')
          : new AppError('ALREADY_REGISTERED', 'You are already on the guest list. Please use the invitation link your host sent you.');
      }

      const guestCount = await tx.guest.count({ where: { eventId: event.id, deletedAt: null } });
      if (EntitlementsService.limit(features, FEATURE_KEYS.GUESTS_MAX) !== null) {
        try {
          EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.GUESTS_MAX, guestCount);
        } catch {
          throw new AppError('REGISTRATION_FULL', 'Registration is full.');
        }
      }

      let status: RegistrationStatus = 'CONFIRMED';
      if (settings.approvalRequired) {
        status = 'PENDING';
      } else if (settings.maxRegistrations !== null) {
        const confirmed = await tx.registration.count({ where: { eventId: event.id, status: 'CONFIRMED' } });
        if (confirmed >= settings.maxRegistrations) {
          if (!settings.waitlistEnabled) throw new AppError('REGISTRATION_FULL', 'Registration is full.');
          status = 'WAITLISTED';
        }
      }

      const allGuests = await tx.guestGroup.findUnique({ where: { eventId_slug: { eventId: event.id, slug: ALL_GUESTS_SLUG } }, select: { id: true } });
      const groupIds = [allGuests?.id, settings.groupId].filter((id): id is string => !!id);
      const guest = await tx.guest.create({
        data: {
          eventId: event.id,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          preferredLanguage: input.preferredLanguage ?? null,
          metadata: { source: 'registration' },
          groups: { create: groupIds.map((groupId) => ({ groupId, eventId: event.id })) },
          consents: { create: { kind: 'event_registration', granted: true, version: REGISTRATION_CONSENT_VERSION, source: 'public_event_page' } },
        },
      });
      const registration = await tx.registration.create({
        data: { eventId: event.id, guestId: guest.id, status, answers: answers.value as Prisma.InputJsonValue },
      });
      const invitationUrl = status === 'CONFIRMED' ? await this.issueInvitation(tx, event.id, guest.id, null) : null;
      await this.audit.record(
        { actorType: 'ANONYMOUS', action: 'registration.created', targetType: 'Registration', targetId: registration.id, eventId: event.id, metadata: { status }, meta },
        tx,
      );
      return { registrationId: registration.id, guestId: guest.id, status, invitationUrl };
    });

    await this.notifyRegistrant(event.id, result.guestId, result.status);
    await this.notifications.notify({
      type: 'REGISTRATION_RECEIVED',
      channel: 'IN_APP',
      eventId: event.id,
      userId: event.ownerId,
      payload: { guestName: input.name, status: result.status, eventTitle: event.title },
    });
    // The registrant's own link: shown once on the confirmation screen (and emailed when possible).
    return { status: result.status, invitationUrl: result.invitationUrl };
  }

  // ───────────────────────── Internals ─────────────────────────

  /** Serialize registrations per event so capacity checks cannot race. */
  private async lockSettings(tx: Tx, eventId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ eventId: string }>>`SELECT "eventId" FROM "event_registration_settings" WHERE "eventId" = ${eventId}::uuid FOR UPDATE`;
    return rows.length > 0;
  }

  /** Event-wide invitation for a registrant; idempotent. Returns the link when a new token is issued. */
  private async issueInvitation(tx: Tx, eventId: string, guestId: string, createdById: string | null): Promise<string | null> {
    const live = await tx.invitation.findFirst({ where: { eventId, guestId, functionId: null, status: { not: 'REVOKED' } }, select: { id: true } });
    if (live) return null;
    const invitation = await tx.invitation.create({ data: { eventId, guestId, functionId: null, createdById } });
    const { url } = await this.tokens.issue(tx, { invitationId: invitation.id, eventId, expiresAt: null, maxUses: null });
    return url;
  }

  private async revokeInvitations(tx: Tx, eventId: string, guestId: string): Promise<void> {
    const invitations = await tx.invitation.findMany({ where: { eventId, guestId, status: { not: 'REVOKED' } }, select: { id: true } });
    for (const inv of invitations) {
      await tx.invitation.update({ where: { id: inv.id }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await this.tokens.revokeAll(tx, inv.id);
    }
  }

  /** Confirm waitlisted registrants, oldest first, while places are free. */
  private async promoteWaitlist(eventId: string): Promise<void> {
    const promoted = await this.prisma.$transaction(async (tx) => {
      await this.lockSettings(tx, eventId);
      const settings = await tx.eventRegistrationSettings.findUnique({ where: { eventId } });
      if (!settings?.enabled || settings.approvalRequired) return [];
      const confirmed = await tx.registration.count({ where: { eventId, status: 'CONFIRMED' } });
      const free = settings.maxRegistrations === null ? Number.MAX_SAFE_INTEGER : settings.maxRegistrations - confirmed;
      if (free <= 0) return [];
      const waiting = await tx.registration.findMany({
        where: { eventId, status: 'WAITLISTED', guest: { deletedAt: null } },
        orderBy: { createdAt: 'asc' },
        take: Math.min(free, 200),
      });
      for (const reg of waiting) {
        await tx.registration.update({ where: { id: reg.id }, data: { status: 'CONFIRMED', decidedAt: new Date() } });
        await this.issueInvitation(tx, eventId, reg.guestId, null);
        await this.audit.record({ actorType: 'SYSTEM', action: 'registration.promoted', targetType: 'Registration', targetId: reg.id, eventId }, tx);
      }
      return waiting.map((r) => r.guestId);
    });
    for (const guestId of promoted) await this.notifyRegistrant(eventId, guestId, 'CONFIRMED');
  }

  /** Email the registrant: their invitation link once confirmed, otherwise a status update. */
  private async notifyRegistrant(eventId: string, guestId: string, status: RegistrationStatus): Promise<void> {
    if (status === 'CONFIRMED') {
      await this.notifications.notify({ type: 'INVITATION', channel: 'EMAIL', eventId, guestId, payload: { reason: 'registration_confirmed' } });
    } else {
      await this.notifications.notify({ type: 'REGISTRATION_UPDATE', channel: 'EMAIL', eventId, guestId, payload: { status } });
    }
  }
}
