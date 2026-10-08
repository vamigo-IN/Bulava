import type { DeliveryStatus, PrismaClient } from '../generated/client';

/** What a provider can report about a sent WhatsApp message. */
export type WhatsAppDeliveryReport = 'sent' | 'delivered' | 'read' | 'failed';

/** The state a report moves a delivery to, and the states it may move it from. */
const TRANSITIONS: Partial<Record<string, { to: DeliveryStatus; from: DeliveryStatus[] }>> = {
  delivered: { to: 'DELIVERED', from: ['SENT'] },
  read: { to: 'READ', from: ['SENT', 'DELIVERED'] },
  failed: { to: 'FAILED', from: ['SENT', 'DELIVERED'] },
};

/**
 * Applies a provider's report to the WhatsApp invitation deliveries it is
 * about, only ever forward: reports can arrive out of order, so a late
 * "delivered" never undoes "read", and "sent" changes nothing (the worker
 * records it). Shared by the API's webhooks and the worker's status checks.
 * Returns how many rows changed.
 */
export async function recordWhatsAppDelivery(
  prisma: Pick<PrismaClient, 'invitationDelivery'>,
  which: { id: string } | { providerMessageId: string },
  report: string | null | undefined,
  error?: string | null,
): Promise<number> {
  const step = report ? TRANSITIONS[report.toLowerCase()] : undefined;
  if (!step) return 0;
  const r = await prisma.invitationDelivery.updateMany({
    where: { ...which, channel: 'WHATSAPP_API', status: { in: step.from } },
    data: { status: step.to, ...(step.to === 'FAILED' && error ? { error: error.slice(0, 500) } : {}) },
  });
  return r.count;
}
