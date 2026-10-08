import { recordWhatsAppDelivery, type PrismaClient } from '@bulava/database';
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

/** At most this many messages per sweep, checked a few at a time. */
const BATCH = 1000;
const PARALLEL = 5;

/** The `sentAt` ranges due for a check at `now`. */
export function dueWindows(now: number): Array<{ sentAt: { gt: Date; lte: Date } }> {
  return STATUS_CHECK_AGES.map((age) => ({ sentAt: { gt: new Date(now - (age + STATUS_SWEEP_MINUTES) * MINUTE), lte: new Date(now - age * MINUTE) } }));
}

/**
 * Reads back the delivery of WhatsApp invitations sent through a provider that
 * reports it on request (GetGabs): sent or delivered messages at one of the
 * check ages move to delivered, read or failed. Meta pushes the same reports
 * to the webhook, so its channel has nothing to do here.
 */
export async function refreshWhatsAppStatuses(
  deps: { prisma: Pick<PrismaClient, 'invitationDelivery'>; provider: WhatsAppProvider; log: { warn: (obj: object, msg: string) => void } },
  now = Date.now(),
): Promise<{ checked: number; updated: number }> {
  const { provider } = deps;
  if (!provider.deliveryState || !provider.tag) return { checked: 0, updated: 0 };
  const rows = await deps.prisma.invitationDelivery.findMany({
    where: { channel: 'WHATSAPP_API', provider: provider.tag, status: { in: ['SENT', 'DELIVERED'] }, providerMessageId: { not: null }, OR: dueWindows(now) },
    select: { id: true, providerMessageId: true },
    orderBy: { sentAt: 'asc' },
    take: BATCH,
  });
  let updated = 0;
  for (let i = 0; i < rows.length; i += PARALLEL) {
    await Promise.all(
      rows.slice(i, i + PARALLEL).map(async (row) => {
        try {
          const state = await provider.deliveryState!(row.providerMessageId!);
          // Await first: `updated += await …` would read the count before the await and lose parallel updates.
          const changed = await recordWhatsAppDelivery(deps.prisma, { id: row.id }, state.status, state.error);
          updated += changed;
        } catch (err) {
          deps.log.warn({ err, deliveryId: row.id }, 'Could not read a WhatsApp delivery status; a later check tries again');
        }
      }),
    );
  }
  return { checked: rows.length, updated };
}
