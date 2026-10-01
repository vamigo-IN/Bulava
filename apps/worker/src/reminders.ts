import { authorizedFunctions } from '@bulava/auth';
import { loadEventAudienceFacts, loadGuestAudienceFacts, lockWhatsAppAllowance, whatsappMessagesLeft, type PrismaClient } from '@bulava/database';

export interface ReminderDeps {
  prisma: PrismaClient;
  /** Queue one notification for delivery (idempotent by notification id). */
  enqueue: (notificationId: string) => Promise<void>;
  log: { info: (o: object, msg: string) => void };
  /** True while the Super Admin has WhatsApp reminders set up: guests with a phone number are reminded there instead of by email. */
  whatsappReminders?: () => Promise<boolean>;
}

/** A scheduled RSVP reminder older than this is skipped (for example after an outage). */
const RSVP_STALE_MS = 24 * 3_600_000;
/** QUEUED notifications older than this are handed to the queue again (crash between commit and enqueue). */
const REQUEUE_AFTER_MS = 10 * 60_000;
const REQUEUE_WINDOW_MS = 2 * 86_400_000;

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Sends due reminders (spec §49), run every minute by the worker:
 *  - RSVP reminders to invited guests who have not replied, at the time the host chose;
 *  - function reminders, N hours before each function, to guests who can attend it and have not declined.
 * Each reminder is claimed with a conditional update before notifications are created, in one
 * transaction, so parallel workers or retries never send it twice.
 */
export async function dispatchReminders(deps: ReminderDeps, now: Date = new Date()) {
  const whatsapp = (await deps.whatsappReminders?.()) ?? false;
  const rsvp = await dispatchRsvpReminders(deps, now, whatsapp);
  const functions = await dispatchFunctionReminders(deps, now, whatsapp);
  const requeued = await requeueStuckNotifications(deps, now);
  return { rsvpEvents: rsvp.events, functionReminders: functions.functions, notifications: rsvp.notifications + functions.notifications, requeued };
}

/** Guests who can be reminded: not removed, with an email (or a phone number for WhatsApp) and a live invitation link. */
function reachableGuestWhere(eventId: string, now: Date, whatsapp: boolean) {
  return {
    eventId,
    deletedAt: null,
    ...(whatsapp ? { OR: [{ email: { not: null } }, { phone: { not: null } }] } : { email: { not: null } }),
    invitations: {
      some: {
        status: { not: 'REVOKED' as const },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        tokens: { some: { revokedAt: null } },
      },
    },
  };
}

/**
 * One reminder per guest: on WhatsApp when it is set up, the guest has a phone
 * number and the event's plan has WhatsApp messages left; otherwise by email.
 */
async function createNotifications(
  tx: Tx,
  eventId: string,
  guests: Array<{ id: string; phone: string | null; email: string | null }>,
  type: string,
  payload: object,
  whatsapp: boolean,
): Promise<string[]> {
  if (!guests.length) return [];
  // Host sends take the same lock, so the two cannot overspend the plan's allowance together.
  if (whatsapp) await lockWhatsAppAllowance(tx, eventId);
  let left = whatsapp ? await whatsappMessagesLeft(tx, eventId) : 0;
  const data: Array<{ eventId: string; guestId: string; type: string; channel: string; payload: object; status: string }> = [];
  for (const g of guests) {
    if (g.phone && left > 0) {
      data.push({ eventId, guestId: g.id, type, channel: 'WHATSAPP', payload, status: 'QUEUED' });
      left--;
    } else if (g.email) {
      data.push({ eventId, guestId: g.id, type, channel: 'EMAIL', payload, status: 'QUEUED' });
    }
  }
  if (!data.length) return [];
  const rows = await tx.notification.createManyAndReturn({ data, select: { id: true } });
  return rows.map((r) => r.id);
}

async function dispatchRsvpReminders(deps: ReminderDeps, now: Date, whatsapp: boolean) {
  const due = await deps.prisma.eventReminderSettings.findMany({
    where: { rsvpReminderAt: { lte: now }, rsvpReminderSentAt: null, event: { status: 'ACTIVE', deletedAt: null } },
    select: { eventId: true, rsvpReminderAt: true },
    take: 50,
  });
  let notifications = 0;
  for (const s of due) {
    const ids = await deps.prisma.$transaction(async (tx) => {
      const claimed = await tx.eventReminderSettings.updateMany({ where: { eventId: s.eventId, rsvpReminderSentAt: null }, data: { rsvpReminderSentAt: now } });
      if (claimed.count !== 1) return [];
      if (now.getTime() - s.rsvpReminderAt!.getTime() > RSVP_STALE_MS) {
        await tx.eventReminderSettings.update({ where: { eventId: s.eventId }, data: { rsvpReminderRecipients: 0 } });
        return [];
      }
      // Not replied at all: no event-level and no function RSVP.
      const guests = await tx.guest.findMany({ where: { ...reachableGuestWhere(s.eventId, now, whatsapp), rsvps: { none: {} } }, select: { id: true, phone: true, email: true } });
      const created = await createNotifications(tx, s.eventId, guests, 'RSVP_REMINDER', {}, whatsapp);
      await tx.eventReminderSettings.update({ where: { eventId: s.eventId }, data: { rsvpReminderRecipients: created.length } });
      return created;
    });
    for (const id of ids) await deps.enqueue(id);
    notifications += ids.length;
    deps.log.info({ eventId: s.eventId, recipients: ids.length }, 'RSVP reminder sent');
  }
  return { events: due.length, notifications };
}

async function dispatchFunctionReminders(deps: ReminderDeps, now: Date, whatsapp: boolean) {
  const settings = await deps.prisma.eventReminderSettings.findMany({
    where: { functionReminderHours: { not: null }, event: { status: 'ACTIVE', deletedAt: null } },
    select: { eventId: true, functionReminderHours: true },
  });
  let functions = 0;
  let notifications = 0;
  for (const s of settings) {
    const horizon = new Date(now.getTime() + s.functionReminderHours! * 3_600_000);
    const candidates = await deps.prisma.eventFunction.findMany({
      where: { eventId: s.eventId, deletedAt: null, status: 'SCHEDULED', startsAt: { gt: now, lte: horizon } },
      select: { id: true, startsAt: true, reminderSentFor: true },
    });
    // Due unless already reminded for this exact start time (a moved function is reminded again).
    const due = candidates.filter((f) => f.reminderSentFor?.getTime() !== f.startsAt!.getTime());
    if (!due.length) continue;

    const [eventFacts, guestFacts, reachable] = await Promise.all([
      loadEventAudienceFacts(deps.prisma, s.eventId),
      loadGuestAudienceFacts(deps.prisma, s.eventId),
      deps.prisma.guest.findMany({
        where: reachableGuestWhere(s.eventId, now, whatsapp),
        select: {
          id: true,
          phone: true,
          email: true,
          invitations: { where: { status: { not: 'REVOKED' }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { functionId: true } },
          rsvps: { where: { status: 'DECLINED' }, select: { functionId: true } },
        },
      }),
    ]);
    const contacts = new Map(reachable.map((g) => [g.id, g]));

    for (const fn of due) {
      const recipients = guestFacts
        .filter((g) => {
          const contact = contacts.get(g.guestId);
          if (!contact) return false;
          // Declined this function, or the whole event.
          if (contact.rsvps.some((r) => r.functionId === fn.id || r.functionId === null)) return false;
          // Visible through at least one of the guest's invitations (event-wide or for this function).
          return contact.invitations.some((inv) =>
            authorizedFunctions(eventFacts.functions, eventFacts.eventPolicy, {
              kind: 'guest',
              guestId: g.guestId,
              groupIds: g.groupIds,
              assignments: g.assignments,
              invitationFunctionId: inv.functionId,
            }).some((f) => f.id === fn.id),
          );
        })
        .map((g) => ({ id: g.guestId, phone: contacts.get(g.guestId)?.phone ?? null, email: contacts.get(g.guestId)?.email ?? null }));

      const ids = await deps.prisma.$transaction(async (tx) => {
        const claimed = await tx.eventFunction.updateMany({ where: { id: fn.id, reminderSentFor: fn.reminderSentFor }, data: { reminderSentFor: fn.startsAt } });
        if (claimed.count !== 1) return [];
        return createNotifications(tx, s.eventId, recipients, 'FUNCTION_REMINDER', { functionId: fn.id }, whatsapp);
      });
      for (const id of ids) await deps.enqueue(id);
      functions++;
      notifications += ids.length;
      deps.log.info({ eventId: s.eventId, functionId: fn.id, recipients: ids.length }, 'Function reminder sent');
    }
  }
  return { functions, notifications };
}

async function requeueStuckNotifications(deps: ReminderDeps, now: Date) {
  const stuck = await deps.prisma.notification.findMany({
    where: {
      status: 'QUEUED',
      channel: { not: 'IN_APP' },
      createdAt: { lt: new Date(now.getTime() - REQUEUE_AFTER_MS), gt: new Date(now.getTime() - REQUEUE_WINDOW_MS) },
    },
    select: { id: true },
    take: 500,
  });
  for (const n of stuck) await deps.enqueue(n.id);
  return stuck.length;
}
