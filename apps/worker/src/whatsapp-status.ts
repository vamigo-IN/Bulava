import { recordWhatsAppDelivery, whatsappMessageFailed, type PrismaClient } from '@bulava/database';
import type { WhatsAppProvider } from './providers';

const MINUTE = 60_000;

/** How often the sweep runs (the worker schedules it with this cron step). */
export const STATUS_SWEEP_MINUTES = 10;

/**
 * Minutes after sending at which a message's delivery is read back: soon after
 * for "delivered", then less and less often for three days to catch "read".
 * Each window is as wide as the sweep's interval, so a message is checked once
 * per window, five times at most, and nothing has to be stored to know when.
 */
export const STATUS_CHECK_AGES = [5, 60, 6 * 60, 24 * 60, 72 * 60] as const;

/**
 * Other WhatsApp messages (updates, confirmations, receipts) are read back only
 * to learn that they failed, which WhatsApp says within minutes: twice.
 */
export const FAILURE_CHECK_AGES = [5, 60] as const;

/** At most this many messages per sweep, checked a few at a time. */
const BATCH = 1000;
const PARALLEL = 5;

/** The `sentAt` ranges due for a check at `now`. */
export function dueWindows(now: number, ages: readonly number[] = STATUS_CHECK_AGES): Array<{ sentAt: { gt: Date; lte: Date } }> {
  return ages.map((age) => ({ sentAt: { gt: new Date(now - (age + STATUS_SWEEP_MINUTES) * MINUTE), lte: new Date(now - age * MINUTE) } }));
}

type Db = Pick<PrismaClient, 'invitationDelivery' | 'notification' | 'guest' | 'user' | 'whatsAppNumber'>;

/**
 * Reads back the delivery of WhatsApp messages sent through a provider that
 * reports it on request (GetGabs). Invitations move to delivered, read or
 * failed at each check age. Any message that failed fails its notification
 * (its allowance is given back), a number that is not on WhatsApp is marked so
 * and skipped from then on, and an invitation or a reminder goes by email
 * instead (ADR-073). Meta pushes the same reports to the webhook, so its
 * channel has nothing to do here.
 */
export async function refreshWhatsAppStatuses(
  deps: {
    prisma: Db;
    provider: WhatsAppProvider;
    log: { warn: (obj: object, msg: string) => void };
    /** Queues the email that stands in for a message WhatsApp could not deliver. */
    enqueue?: (notificationId: string) => Promise<void>;
  },
  now = Date.now(),
): Promise<{ checked: number; updated: number }> {
  const { provider } = deps;
  if (!provider.deliveryState || !provider.tag) return { checked: 0, updated: 0 };
  const failed = async (providerMessageId: string, error: string | undefined) => {
    const result = await whatsappMessageFailed(deps.prisma, { providerMessageId }, { reason: error || 'WhatsApp could not deliver the message' });
    if (result.fallbackId) await deps.enqueue?.(result.fallbackId);
  };

  const [deliveries, messages] = await Promise.all([
    deps.prisma.invitationDelivery.findMany({
      where: { channel: 'WHATSAPP_API', provider: provider.tag, status: { in: ['SENT', 'DELIVERED'] }, providerMessageId: { not: null }, OR: dueWindows(now) },
      select: { id: true, providerMessageId: true },
      orderBy: { sentAt: 'asc' },
      take: BATCH,
    }),
    // Invitations are followed through their deliveries above.
    deps.prisma.notification.findMany({
      where: { channel: 'WHATSAPP', status: 'SENT', type: { not: 'INVITATION' }, providerMessageId: { not: null }, OR: dueWindows(now, FAILURE_CHECK_AGES) },
      select: { id: true, providerMessageId: true },
      orderBy: { sentAt: 'asc' },
      take: BATCH,
    }),
  ]);
  const checks = [
    ...deliveries.map((row) => async () => {
      const state = await provider.deliveryState!(row.providerMessageId!);
      // Await first: `updated += await …` would read the count before the await and lose parallel updates.
      const changed = await recordWhatsAppDelivery(deps.prisma, { id: row.id }, state.status, state.error);
      if (state.status === 'failed' && changed) await failed(row.providerMessageId!, state.error);
      return changed;
    }),
    ...messages.map((row) => async () => {
      const state = await provider.deliveryState!(row.providerMessageId!);
      if (state.status !== 'failed') return 0;
      await failed(row.providerMessageId!, state.error);
      return 1;
    }),
  ];
  let updated = 0;
  for (let i = 0; i < checks.length; i += PARALLEL) {
    await Promise.all(
      checks.slice(i, i + PARALLEL).map(async (check) => {
        try {
          const changed = await check();
          updated += changed;
        } catch (err) {
          deps.log.warn({ err }, 'Could not read a WhatsApp delivery status; a later check tries again');
        }
      }),
    );
  }
  return { checked: checks.length, updated };
}
