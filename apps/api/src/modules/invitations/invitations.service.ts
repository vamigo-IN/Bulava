import { Injectable } from '@nestjs/common';
import { lockWhatsAppAllowance, whatsappMessagesLeft, whatsappMessagesUsed, type Prisma } from '@bulava/database';
import { FEATURE_KEYS, type BulkCreateInvitationsInput, type CreateInvitationInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { EventLinksService } from '../domains/event-links.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { assertVerifiedAccount } from '../users/account-gate';
import { InvitationTokenService } from './invitation-token.service';

const invitationInclude = {
  guest: { select: { id: true, name: true, phone: true, preferredLanguage: true } },
  function: { select: { id: true, name: true } },
  tokens: {
    where: { revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { tokenCiphertext: true, expiresAt: true, maxUses: true, useCount: true, lastUsedAt: true },
  },
} satisfies Prisma.InvitationInclude;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

export interface InvitationDto {
  id: string;
  status: string;
  guest: { id: string; name: string; phone: string | null; preferredLanguage: string | null };
  function: { id: string; name: string } | null;
  /** Shareable link; null once revoked. */
  url: string | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  openedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  useCount: number;
  createdAt: Date;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: InvitationTokenService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly links: EventLinksService,
    private readonly settings: PlatformSettingsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Email invitations to guests who have an email address. Each send is a
   * Notification (delivered by the worker, which rebuilds the link from the
   * encrypted token) plus an InvitationDelivery record. Re-sending the same
   * invitation within 10 minutes is skipped so a double click cannot spam guests.
   */
  async sendByEmail(access: EventAccessContext, invitationIds: string[] | undefined, meta: RequestMeta) {
    await assertVerifiedAccount(this.prisma, access.userId);
    const r = await this.deliver(access, 'EMAIL', invitationIds, meta);
    return { queued: r.queued, skippedNoEmail: r.missing, skippedRecent: r.recent };
  }

  /**
   * Send invitations from the platform's WhatsApp Business number (the approved
   * invitation template) to guests who have a phone number. Same rules as
   * email, and each message counts against the event plan's WhatsApp allowance.
   */
  async sendByWhatsApp(access: EventAccessContext, invitationIds: string[] | undefined, meta: RequestMeta) {
    await assertVerifiedAccount(this.prisma, access.userId);
    if (!(await this.settings.messaging()).whatsappInvitations) {
      throw new AppError('WHATSAPP_UNAVAILABLE', 'Sending on WhatsApp is not available right now.');
    }
    // A quick answer for an empty allowance; the count that decides is taken again under the lock.
    if ((await whatsappMessagesLeft(this.prisma, access.eventId)) <= 0) {
      const limit = EntitlementsService.limit(await this.entitlements.forEvent(access.eventId), FEATURE_KEYS.WHATSAPP_MESSAGES);
      if (!limit) throw new AppError('PLAN_UPGRADE_REQUIRED', 'WhatsApp messages are part of paid plans.', { feature: FEATURE_KEYS.WHATSAPP_MESSAGES });
      throw new AppError('PLAN_LIMIT_REACHED', `Your plan allows up to ${limit} WhatsApp messages for this event.`, { feature: FEATURE_KEYS.WHATSAPP_MESSAGES, limit });
    }
    const r = await this.deliver(access, 'WHATSAPP', invitationIds, meta);
    return {
      queued: r.queued,
      skippedNoPhone: r.missing,
      skippedRecent: r.recent,
      skippedLimit: r.overLimit,
      remaining: Number.isFinite(r.quota) ? Math.max(0, r.quota - r.queued) : null,
    };
  }

  /** What the Invitations page can offer: email, WhatsApp Business, and the plan's WhatsApp allowance. */
  async channels(access: EventAccessContext) {
    const [messaging, features, used] = await Promise.all([
      this.settings.messaging(),
      this.entitlements.forEvent(access.eventId),
      whatsappMessagesUsed(this.prisma, access.eventId),
    ]);
    return {
      email: messaging.email,
      whatsapp: messaging.whatsappInvitations,
      whatsappReminders: messaging.whatsappReminders,
      /** 0 = not in this plan, null = unlimited. */
      whatsappLimit: EntitlementsService.limit(features, FEATURE_KEYS.WHATSAPP_MESSAGES),
      whatsappUsed: used,
    };
  }

  /**
   * Queue one invitation per reachable guest, in one transaction. A WhatsApp
   * send first takes the event's allowance lock (shared with the worker's
   * scheduled reminders), then counts what is left and who was messaged in the
   * last 10 minutes, so two sends at once can neither overspend the plan nor
   * message a guest twice. Jobs are queued after the commit; rows a failure
   * leaves QUEUED are re-queued by the worker.
   */
  private async deliver(access: EventAccessContext, channel: 'EMAIL' | 'WHATSAPP', invitationIds: string[] | undefined, meta: RequestMeta) {
    const delivery = channel === 'EMAIL' ? ({ channel: 'EMAIL', provider: 'smtp' } as const) : ({ channel: 'WHATSAPP_API', provider: 'meta' } as const);
    const r = await this.prisma.$transaction(
      async (tx) => {
        let quota = Number.POSITIVE_INFINITY;
        if (channel === 'WHATSAPP') {
          await lockWhatsAppAllowance(tx, access.eventId);
          quota = await whatsappMessagesLeft(tx, access.eventId);
        }
        const invitations = await tx.invitation.findMany({
          where: { eventId: access.eventId, status: { not: 'REVOKED' }, guest: { deletedAt: null }, ...(invitationIds ? { id: { in: invitationIds } } : {}) },
          select: {
            id: true,
            guestId: true,
            functionId: true,
            guest: { select: { email: true, phone: true } },
            deliveries: { where: { channel: delivery.channel, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } }, select: { id: true } },
          },
          // Event-wide invitations first: they are the ones the worker links.
          orderBy: [{ functionId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
        });
        const chosen: typeof invitations = [];
        let missing = 0;
        let recent = 0;
        let overLimit = 0;
        const seenGuests = new Set<string>();
        for (const inv of invitations) {
          if (!(channel === 'EMAIL' ? inv.guest.email : inv.guest.phone)) {
            missing++;
            continue;
          }
          // One message per guest: the worker links their event-wide invitation first.
          if (inv.deliveries.length || seenGuests.has(inv.guestId)) {
            recent++;
            continue;
          }
          seenGuests.add(inv.guestId);
          if (chosen.length >= quota) {
            overLimit++;
            continue;
          }
          chosen.push(inv);
        }
        if (!chosen.length) return { ids: [] as string[], quota, missing, recent, overLimit };

        const now = new Date();
        const ids = chosen.map((inv) => inv.id);
        await tx.invitationDelivery.createMany({
          data: chosen.map((inv) => ({ invitationId: inv.id, channel: delivery.channel, status: 'QUEUED' as const, provider: delivery.provider, sentAt: now })),
        });
        await tx.invitation.updateMany({ where: { id: { in: ids }, sentAt: null }, data: { sentAt: now } });
        await tx.invitation.updateMany({ where: { id: { in: ids }, status: 'ACTIVE' }, data: { status: 'SENT' } });
        // An event-wide invitation covers every function the guest is on; a function invitation only its own.
        const eventWide = chosen.filter((inv) => !inv.functionId).map((inv) => inv.guestId);
        if (eventWide.length) {
          await tx.functionGuest.updateMany({ where: { guestId: { in: eventWide }, invitationStatus: 'NOT_SENT' }, data: { invitationStatus: 'SENT' } });
        }
        const byFunction = new Map<string, string[]>();
        for (const inv of chosen) if (inv.functionId) byFunction.set(inv.functionId, [...(byFunction.get(inv.functionId) ?? []), inv.guestId]);
        for (const [functionId, guestIds] of byFunction) {
          await tx.functionGuest.updateMany({ where: { functionId, guestId: { in: guestIds }, invitationStatus: 'NOT_SENT' }, data: { invitationStatus: 'SENT' } });
        }
        const rows = await tx.notification.createManyAndReturn({
          data: chosen.map((inv) => ({ type: 'INVITATION', channel, eventId: access.eventId, guestId: inv.guestId, payload: { invitationId: inv.id }, status: 'QUEUED' })),
          select: { id: true },
        });
        return { ids: rows.map((row) => row.id), quota, missing, recent, overLimit };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
    for (const id of r.ids) await this.notifications.enqueue(id);
    await this.audit.record({
      actorType: 'USER',
      actorId: access.userId,
      action: channel === 'EMAIL' ? 'invitation.emailed' : 'invitation.whatsapp_sent',
      targetType: 'Event',
      targetId: access.eventId,
      eventId: access.eventId,
      metadata: { queued: r.ids.length, missingContact: r.missing, recent: r.recent, overLimit: r.overLimit },
      meta,
    });
    return { queued: r.ids.length, missing: r.missing, recent: r.recent, overLimit: r.overLimit, quota: r.quota };
  }

  async list(access: EventAccessContext): Promise<InvitationDto[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { eventId: access.eventId, guest: { deletedAt: null } },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
    const origin = await this.links.guestOrigin(access.eventId);
    return rows.map((r) => this.toDto(r, origin));
  }

  /** Idempotent: returns the existing live invitation for the same guest + scope. */
  async create(
    access: EventAccessContext,
    input: CreateInvitationInput,
    meta: RequestMeta,
  ): Promise<{ invitation: InvitationDto; created: boolean }> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: input.guestId, eventId: access.eventId, deletedAt: null },
      select: { id: true },
    });
    if (!guest) throw AppError.notFound('Guest');
    const functionId = input.functionId ?? null;
    if (functionId) {
      const fn = await this.prisma.eventFunction.findFirst({
        where: { id: functionId, eventId: access.eventId, deletedAt: null },
        select: { id: true },
      });
      if (!fn) throw AppError.notFound('Function');
    }

    const existing = await this.prisma.invitation.findFirst({
      where: { eventId: access.eventId, guestId: guest.id, functionId, status: { not: 'REVOKED' } },
      include: invitationInclude,
    });
    if (existing) return { invitation: this.toDto(existing, await this.links.guestOrigin(access.eventId)), created: false };

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const invitation = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invitation.create({
        data: { eventId: access.eventId, guestId: guest.id, functionId, expiresAt, createdById: access.userId },
      });
      await this.tokens.issue(tx, {
        invitationId: inv.id,
        eventId: access.eventId,
        expiresAt,
        maxUses: input.maxUses ?? null,
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'invitation.created',
          targetType: 'Invitation',
          targetId: inv.id,
          eventId: access.eventId,
          metadata: { guestId: guest.id, functionId },
          meta,
        },
        tx,
      );
      return tx.invitation.findUniqueOrThrow({ where: { id: inv.id }, include: invitationInclude });
    });
    return { invitation: this.toDto(invitation, await this.links.guestOrigin(access.eventId)), created: true };
  }

  async bulkCreate(
    access: EventAccessContext,
    input: BulkCreateInvitationsInput,
    meta: RequestMeta,
  ): Promise<{ created: number; existing: number; invitations: InvitationDto[] }> {
    const guestIds = [...new Set(input.guestIds)];
    const results: InvitationDto[] = [];
    let created = 0;
    for (const guestId of guestIds) {
      const r = await this.create(access, { guestId, functionId: null, expiresAt: input.expiresAt }, meta);
      results.push(r.invitation);
      if (r.created) created++;
    }
    return { created, existing: guestIds.length - created, invitations: results };
  }

  async regenerate(access: EventAccessContext, invitationId: string, meta: RequestMeta): Promise<InvitationDto> {
    const inv = await this.findLive(access.eventId, invitationId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.tokens.revokeAll(tx, inv.id);
      await this.tokens.issue(tx, { invitationId: inv.id, eventId: access.eventId, expiresAt: inv.expiresAt, maxUses: null });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'invitation.token_regenerated',
          targetType: 'Invitation',
          targetId: inv.id,
          eventId: access.eventId,
          meta,
        },
        tx,
      );
      return tx.invitation.findUniqueOrThrow({ where: { id: inv.id }, include: invitationInclude });
    });
    return this.toDto(updated, await this.links.guestOrigin(access.eventId));
  }

  async revoke(access: EventAccessContext, invitationId: string, meta: RequestMeta): Promise<InvitationDto> {
    const inv = await this.findLive(access.eventId, invitationId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.tokens.revokeAll(tx, inv.id);
      await tx.invitation.update({ where: { id: inv.id }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'invitation.revoked',
          targetType: 'Invitation',
          targetId: inv.id,
          eventId: access.eventId,
          metadata: { guestId: inv.guestId },
          meta,
        },
        tx,
      );
      return tx.invitation.findUniqueOrThrow({ where: { id: inv.id }, include: invitationInclude });
    });
    return this.toDto(updated, await this.links.guestOrigin(access.eventId));
  }

  /** Records that the host shared the link (e.g. via a WhatsApp deep link). */
  async markShared(
    access: EventAccessContext,
    invitationId: string,
    channel: 'WHATSAPP_LINK' | 'MANUAL',
  ): Promise<InvitationDto> {
    const inv = await this.findLive(access.eventId, invitationId);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invitationDelivery.create({
        data: { invitationId: inv.id, channel, status: 'SENT', provider: 'host', sentAt: now },
      });
      await tx.invitation.update({
        where: { id: inv.id },
        data: { sentAt: inv.sentAt ?? now, ...(inv.status === 'ACTIVE' ? { status: 'SENT' } : {}) },
      });
      await tx.functionGuest.updateMany({
        where: {
          guestId: inv.guestId,
          invitationStatus: 'NOT_SENT',
          ...(inv.functionId ? { functionId: inv.functionId } : {}),
        },
        data: { invitationStatus: 'SENT' },
      });
      return tx.invitation.findUniqueOrThrow({ where: { id: inv.id }, include: invitationInclude });
    });
    return this.toDto(updated, await this.links.guestOrigin(access.eventId));
  }

  private async findLive(eventId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findFirst({ where: { id: invitationId, eventId } });
    if (!inv) throw AppError.notFound('Invitation');
    if (inv.status === 'REVOKED') throw new AppError('INVITATION_REVOKED', 'This invitation has been revoked.');
    return inv;
  }

  private toDto(r: InvitationRow, origin: string): InvitationDto {
    const token = r.tokens[0];
    return {
      id: r.id,
      status: r.status,
      guest: r.guest,
      function: r.function,
      url: r.status !== 'REVOKED' && token ? this.tokens.revealUrl(token.tokenCiphertext, origin) : null,
      expiresAt: token?.expiresAt ?? r.expiresAt,
      sentAt: r.sentAt,
      openedAt: r.openedAt,
      acceptedAt: r.acceptedAt,
      declinedAt: r.declinedAt,
      useCount: token?.useCount ?? 0,
      createdAt: r.createdAt,
    };
  }
}
