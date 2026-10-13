import { Injectable } from '@nestjs/common';
import { lockWhatsAppAllowance, whatsappMessagesLeft, whatsappNumbersToSkip, whatsappPhone, whatsappReachable, type Prisma } from '@bulava/database';
import type { WhatsAppTemplateKind } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { NotificationsService, type NotificationType } from './notifications.service';

/** Messages to guests that go on every channel the guest can get. */
export type GuestMessageType = 'EVENT_UPDATE' | 'REGISTRATION_CONFIRMED' | 'GALLERY_SHARED';
/** Messages to the person who bought something: never charged to an event's WhatsApp allowance. */
export type BuyerMessageType = 'PLAN_PURCHASED' | 'PAYMENT_FAILED' | 'PAYMENT_PENDING';

/** The approved WhatsApp template each message goes out with. */
const TEMPLATE_KIND: Record<GuestMessageType | BuyerMessageType, WhatsAppTemplateKind> = {
  EVENT_UPDATE: 'eventUpdate',
  REGISTRATION_CONFIRMED: 'registrationConfirmed',
  GALLERY_SHARED: 'galleryShared',
  PLAN_PURCHASED: 'planPurchased',
  PAYMENT_FAILED: 'paymentFailed',
  PAYMENT_PENDING: 'paymentPending',
};

export interface GuestMessageResult {
  /** Guests the message reached at all. */
  guests: number;
  email: number;
  whatsapp: number;
  /** Guests with a number who did not get it on WhatsApp: the allowance was used up, or the number is not on WhatsApp or opted out. */
  whatsappSkipped: number;
}

/**
 * One message on every channel its person can get (ADR-073). Guests: an email
 * to each with an address, and the same message on WhatsApp to each whose
 * number reaches WhatsApp (not marked unreachable or opted out), while the
 * kind's template is set and the event's plan has WhatsApp messages left,
 * counted under the allowance lock that invitations and reminders share.
 * Buyers: email and WhatsApp to their own address and confirmed number,
 * outside any event's allowance. Rows are written first, then queued, so
 * every message is auditable and retried by the worker.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: PlatformSettingsService,
  ) {}

  /** Whether this kind of guest message can go on WhatsApp at all now (its template set, WhatsApp connected). */
  async whatsappAvailable(type: GuestMessageType | BuyerMessageType): Promise<boolean> {
    return (await this.settings.messaging()).whatsapp[TEMPLATE_KIND[type]];
  }

  async toGuests(input: {
    eventId: string;
    guestIds: string[];
    type: GuestMessageType;
    payload: Prisma.InputJsonValue;
    email?: boolean;
    whatsapp?: boolean;
  }): Promise<GuestMessageResult> {
    const ids = [...new Set(input.guestIds)];
    const empty = { guests: 0, email: 0, whatsapp: 0, whatsappSkipped: 0 };
    if (!ids.length) return empty;
    const whatsappOn = input.whatsapp !== false && (await this.whatsappAvailable(input.type));
    const guests = await this.prisma.guest.findMany({ where: { eventId: input.eventId, deletedAt: null, id: { in: ids } }, select: { id: true, email: true, phone: true } });
    if (!guests.length) return empty;

    const queued = await this.prisma.$transaction(async (tx) => {
      const row = (guestId: string, channel: 'EMAIL' | 'WHATSAPP') => ({ type: input.type, channel, eventId: input.eventId, guestId, payload: input.payload, status: 'QUEUED' });
      const byEmail = input.email === false ? [] : guests.filter((g) => g.email);
      let byWhatsApp: typeof guests = [];
      let whatsappSkipped = 0;
      if (whatsappOn) {
        const withPhone = guests.filter((g) => g.phone);
        // The same lock as invitations and reminders, so two sends cannot spend the last messages twice.
        await lockWhatsAppAllowance(tx, input.eventId);
        const left = await whatsappMessagesLeft(tx, input.eventId);
        const skip = await whatsappNumbersToSkip(tx, withPhone.map((g) => g.phone));
        const reachable = withPhone.filter((g) => !skip.has(whatsappPhone(g.phone!)));
        byWhatsApp = reachable.slice(0, Number.isFinite(left) ? Math.max(0, left) : reachable.length);
        whatsappSkipped = withPhone.length - byWhatsApp.length;
      }
      const rows = await tx.notification.createManyAndReturn({
        data: [...byEmail.map((g) => row(g.id, 'EMAIL')), ...byWhatsApp.map((g) => row(g.id, 'WHATSAPP'))],
        select: { id: true },
      });
      const reached = new Set([...byEmail, ...byWhatsApp].map((g) => g.id));
      return { ids: rows.map((r) => r.id), guests: reached.size, email: byEmail.length, whatsapp: byWhatsApp.length, whatsappSkipped };
    });
    for (const id of queued.ids) await this.notifications.enqueue(id);
    return { guests: queued.guests, email: queued.email, whatsapp: queued.whatsapp, whatsappSkipped: queued.whatsappSkipped };
  }

  /**
   * A message to an account holder about their own purchase: email to their
   * address, WhatsApp to their confirmed number (when it reaches WhatsApp and
   * the kind's template is set). No event: it never counts against an event's
   * WhatsApp allowance.
   */
  async toBuyer(input: { userId: string; type: BuyerMessageType; payload: Prisma.InputJsonValue }): Promise<{ email: boolean; whatsapp: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, phone: true, phoneVerifiedAt: true, deletedAt: true } });
    if (!user || user.deletedAt) return { email: false, whatsapp: false };
    const email = !!user.email;
    const whatsapp = !!user.phone && !!user.phoneVerifiedAt && (await this.whatsappAvailable(input.type)) && (await whatsappReachable(this.prisma, user.phone));
    const type: NotificationType = input.type;
    if (email) await this.notifications.notify({ type, channel: 'EMAIL', userId: input.userId, payload: input.payload });
    if (whatsapp) await this.notifications.notify({ type, channel: 'WHATSAPP', userId: input.userId, payload: input.payload });
    return { email, whatsapp };
  }
}
