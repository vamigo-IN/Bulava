import {
  galleryIncluded,
  lockWhatsAppAllowance,
  whatsappMessagesLeft,
  whatsappNumbersToSkip,
  whatsappPhone,
  whatsappReachable,
  type PrismaClient,
} from '@bulava/database';
import { utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';

/**
 * Follow-ups nobody clicks for (ADR-073), run by the worker's cleanup queue:
 *  - a checkout left unpaid for 30 minutes gets one reminder, by email and WhatsApp;
 *  - the morning after an event's last function, its guests get the album's link,
 *    when the album has photos and the host has not switched the message off.
 * Each is claimed with a conditional update before its notifications are written,
 * in one transaction, so parallel workers or retries never send it twice.
 */
export interface FollowUpDeps {
  prisma: PrismaClient;
  /** Queue one notification for delivery (idempotent by notification id). */
  enqueue: (notificationId: string) => Promise<void>;
  /** Whether the message's WhatsApp template is set (and WhatsApp connected): without it, email only. */
  whatsapp: boolean;
  log: { info: (o: object, msg: string) => void };
}

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const MINUTE = 60_000;
const DAY = 86_400_000;

/** An unfinished checkout is followed up this long after it began. */
export const PAYMENT_PENDING_AFTER_MS = 30 * MINUTE;
/** Older checkouts are left alone: the order page still offers the retry. */
const PAYMENT_PENDING_UNTIL_MS = DAY;

/** The plan as the buyer chose it ("Premium", "Guests × 2"); the API's receipts word it the same way. */
function planLabel(name: string, quantity: number): string {
  return quantity > 1 ? `${name} × ${quantity}` : name;
}

/**
 * One reminder for each purchase checkout opened at the payment gateway 30
 * minutes ago and still unpaid, unless the buyer paid for another order since
 * (they finished elsewhere) or already heard that a payment failed.
 */
export async function dispatchPaymentFollowUps(deps: FollowUpDeps, now: Date = new Date()) {
  const orders = await deps.prisma.order.findMany({
    where: {
      status: 'CREATED',
      kind: 'PURCHASE',
      providerOrderId: { not: null },
      pendingNoticeAt: null,
      failedNoticeAt: null,
      createdAt: { lte: new Date(now.getTime() - PAYMENT_PENDING_AFTER_MS), gt: new Date(now.getTime() - PAYMENT_PENDING_UNTIL_MS) },
    },
    include: { plan: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  let notifications = 0;
  for (const order of orders) {
    const ids = await deps.prisma.$transaction(async (tx) => {
      // Claimed even when nothing is sent, so the order is looked at once.
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'CREATED', pendingNoticeAt: null, failedNoticeAt: null }, data: { pendingNoticeAt: now } });
      if (claimed.count !== 1) return [];
      if (await tx.order.count({ where: { userId: order.userId, status: 'PAID', createdAt: { gte: order.createdAt } } })) return [];
      const user = await tx.user.findUnique({ where: { id: order.userId }, select: { email: true, phone: true, phoneVerifiedAt: true, deletedAt: true } });
      if (!user || user.deletedAt) return [];
      const payload = { orderId: order.id, plan: planLabel(order.plan.name, order.quantity), amountMinor: order.amountMinor };
      const row = (channel: 'EMAIL' | 'WHATSAPP') => ({ type: 'PAYMENT_PENDING', channel, userId: order.userId, payload, status: 'QUEUED' });
      const data = [
        ...(user.email ? [row('EMAIL')] : []),
        ...(deps.whatsapp && user.phone && user.phoneVerifiedAt && (await whatsappReachable(tx, user.phone)) ? [row('WHATSAPP')] : []),
      ];
      if (!data.length) return [];
      return (await tx.notification.createManyAndReturn({ data, select: { id: true } })).map((r) => r.id);
    });
    for (const id of ids) await deps.enqueue(id);
    notifications += ids.length;
  }
  if (orders.length) deps.log.info({ orders: orders.length, notifications }, 'Unfinished checkouts followed up');
  return { orders: orders.length, notifications };
}

/** The album's message goes from this local hour the morning after the last function, never at night. */
const GALLERY_FROM_HOUR = 9;
const GALLERY_UNTIL_HOUR = 20;
/** Days after that morning in which an album that gets its first photos late is still sent. */
const GALLERY_WINDOW_DAYS = 7;

/** 09:00 local time on the day after `last`, in `timeZone`. */
export function morningAfter(last: Date, timeZone: string): Date {
  const [y, m, d] = utcToZonedWallTime(last, timeZone).slice(0, 10).split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const day = next.toISOString().slice(0, 10);
  return new Date(zonedWallTimeToUtcIso(`${day}T${String(GALLERY_FROM_HOUR).padStart(2, '0')}:00`, timeZone));
}

/** Whether the album's message is due at `now`: the morning after `last` or later in the window, in the daytime. */
export function galleryDue(last: Date, timeZone: string, now: Date): boolean {
  const from = morningAfter(last, timeZone);
  if (now < from || now.getTime() >= from.getTime() + GALLERY_WINDOW_DAYS * DAY) return false;
  const hour = Number(utcToZonedWallTime(now, timeZone).slice(11, 13));
  return hour >= GALLERY_FROM_HOUR && hour < GALLERY_UNTIL_HOUR;
}

/**
 * The album's link to every guest with a live invitation, the morning after
 * the event's last function: by email to those with an address, and on
 * WhatsApp to those whose number reaches it, within the plan's WhatsApp
 * allowance (the lock invitations and reminders take). Once per event; not
 * when the host switched it off, sent the album themselves after the event,
 * keeps the gallery private, or the plan has no gallery.
 */
export async function dispatchGalleryFollowUps(deps: FollowUpDeps, now: Date = new Date()) {
  const rooms = await deps.prisma.mediaRoom.findMany({
    where: {
      isMain: true,
      autoShareGallery: true,
      galleryAutoSharedAt: null,
      galleryVisibility: { not: 'PRIVATE' },
      event: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
        deletedAt: null,
        functions: { some: { deletedAt: null, status: { in: ['SCHEDULED', 'COMPLETED'] }, startsAt: { gte: new Date(now.getTime() - (GALLERY_WINDOW_DAYS + 2) * DAY), lte: now } } },
      },
    },
    select: {
      id: true,
      eventId: true,
      gallerySharedAt: true,
      event: { select: { timezone: true, functions: { where: { deletedAt: null, status: { in: ['SCHEDULED', 'COMPLETED'] }, startsAt: { not: null } }, select: { startsAt: true, endsAt: true } } } },
    },
    take: 200,
  });
  let events = 0;
  let notifications = 0;
  for (const room of rooms) {
    const starts = room.event.functions.map((f) => f.startsAt!.getTime());
    // A function still to come: the event is not over.
    if (!starts.length || Math.max(...starts) > now.getTime()) continue;
    const last = new Date(Math.max(...room.event.functions.map((f) => (f.endsAt ?? f.startsAt!).getTime())));
    if (!galleryDue(last, room.event.timezone, now)) continue;
    // Nothing to see yet: looked at again next hour, within the window.
    if (!(await deps.prisma.mediaItem.count({ where: { roomId: room.id, albumId: { not: null }, status: 'APPROVED', deletedAt: null } }))) continue;
    if (!(await galleryIncluded(deps.prisma, room.eventId, now))) continue;
    const sentByHost = !!room.gallerySharedAt && room.gallerySharedAt.getTime() >= Math.max(...starts);

    const ids = await deps.prisma.$transaction(async (tx) => {
      const claimed = await tx.mediaRoom.updateMany({ where: { id: room.id, galleryAutoSharedAt: null, autoShareGallery: true }, data: { galleryAutoSharedAt: now } });
      if (claimed.count !== 1 || sentByHost) return [];
      const guests = await tx.guest.findMany({
        where: { eventId: room.eventId, deletedAt: null, invitations: { some: { status: { not: 'REVOKED' }, tokens: { some: { revokedAt: null } } } } },
        select: { id: true, email: true, phone: true },
      });
      return guestRows(tx, room.eventId, guests, 'GALLERY_SHARED', { roomId: room.id, automatic: true }, deps.whatsapp);
    });
    for (const id of ids) await deps.enqueue(id);
    events++;
    notifications += ids.length;
    deps.log.info({ eventId: room.eventId, recipients: ids.length, sentByHost }, 'Album sent to guests after the event');
  }
  return { events, notifications };
}

/**
 * The worker's side of the API's MessagesService.toGuests: an email to each
 * guest with an address, and WhatsApp to each whose number reaches it, while
 * the event's plan has messages left.
 */
async function guestRows(
  tx: Tx,
  eventId: string,
  guests: Array<{ id: string; email: string | null; phone: string | null }>,
  type: string,
  payload: object,
  whatsapp: boolean,
): Promise<string[]> {
  if (!guests.length) return [];
  const row = (guestId: string, channel: 'EMAIL' | 'WHATSAPP') => ({ eventId, guestId, type, channel, payload, status: 'QUEUED' });
  const data = guests.filter((g) => g.email).map((g) => row(g.id, 'EMAIL'));
  if (whatsapp) {
    const withPhone = guests.filter((g) => g.phone);
    await lockWhatsAppAllowance(tx, eventId);
    const left = await whatsappMessagesLeft(tx, eventId);
    const skip = await whatsappNumbersToSkip(tx, withPhone.map((g) => g.phone));
    const reachable = withPhone.filter((g) => !skip.has(whatsappPhone(g.phone!)));
    for (const g of reachable.slice(0, Number.isFinite(left) ? Math.max(0, left) : reachable.length)) data.push(row(g.id, 'WHATSAPP'));
  }
  if (!data.length) return [];
  return (await tx.notification.createManyAndReturn({ data, select: { id: true } })).map((r) => r.id);
}
