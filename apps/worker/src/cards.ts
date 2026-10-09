import { cardOrderToken } from '@bulava/auth';
import type { Prisma, PrismaClient } from '@bulava/database';
import { cardOrderEmail } from './emails';
import type { WorkerDeps } from './processors';

const DAY = 86_400_000;

/** The order page of a paid card (the token after #, so it is never sent to a server or logged). */
export function cardOrderUrl(webOrigin: string, orderId: string, tokenKey: string): string {
  return `${webOrigin.replace(/\/$/, '')}/cards/order#${cardOrderToken(orderId, tokenKey)}`;
}

async function cardEvent(prisma: PrismaClient, type: 'EMAIL_SENT' | 'EMAIL_FAILED', order: { id: string; sessionId: string | null; leadId: string; userId: string | null; templateKey: string }, meta: Record<string, string>) {
  await prisma.cardEvent.create({
    data: { type, orderId: order.id, sessionId: order.sessionId, leadId: order.leadId, userId: order.userId, templateKey: order.templateKey, meta: meta as Prisma.InputJsonValue },
  });
}

/**
 * Emails a paid card with its image attached and a link to its order page.
 * Throws on a sending error so the queue retries; the last failure is recorded
 * by cardEmailFailed. Without email set up, it is recorded as failed at once
 * (the order page says so, and the card stays downloadable there).
 */
export async function sendCardOrderEmail(deps: WorkerDeps, cardOrderId: string): Promise<string> {
  const { prisma } = deps;
  const order = await prisma.cardOrder.findUnique({ where: { id: cardOrderId } });
  if (!order || order.status !== 'PAID') return 'skipped';
  const card = await prisma.cardExport.findFirst({ where: { orderId: order.id, status: 'READY' }, orderBy: { createdAt: 'desc' } });
  if (!card?.storageKey) return 'not-ready';
  await prisma.cardOrder.update({ where: { id: order.id }, data: { emailAttempts: { increment: 1 } } });
  const email = await deps.email();
  if (!email) {
    await prisma.cardOrder.update({ where: { id: order.id }, data: { emailStatus: 'FAILED', emailError: 'Email is not set up on the site.' } });
    await cardEvent(prisma, 'EMAIL_FAILED', order, { reason: 'not-configured' });
    deps.log.warn({ cardOrderId }, 'Email is not configured; a paid card was not emailed');
    return 'skipped';
  }
  if (!deps.readObject) throw new Error('The worker cannot read stored files');
  const image = await deps.readObject(card.storageKey);
  const fileName = `${card.templateKey}-${card.format}.jpg`;
  const mail = cardOrderEmail({
    site: await deps.siteName(),
    name: order.name,
    reference: order.reference,
    amountMinor: order.amountMinor,
    paidAt: order.paidAt ?? order.createdAt,
    paymentId: order.providerPaymentId,
    orderUrl: cardOrderUrl(deps.env.WEB_ORIGIN, order.id, deps.env.TOKEN_ENCRYPTION_KEY),
    fileName,
  });
  await email.send({ to: order.email, ...mail, attachments: [{ filename: fileName, content: image, contentType: 'image/jpeg' }] });
  await prisma.cardOrder.update({ where: { id: order.id }, data: { emailStatus: 'SENT', emailedAt: new Date(), emailError: null } });
  await cardEvent(prisma, 'EMAIL_SENT', order, {});
  return 'sent';
}

/** The last attempt failed: the order page offers "Email it again" and the console lists it. */
export async function cardEmailFailed(prisma: PrismaClient, cardOrderId: string, error: Error): Promise<void> {
  const order = await prisma.cardOrder.findUnique({ where: { id: cardOrderId } });
  if (!order || order.emailStatus === 'SENT') return;
  await prisma.cardOrder.update({ where: { id: order.id }, data: { emailStatus: 'FAILED', emailError: error.message.slice(0, 300) } });
  await cardEvent(prisma, 'EMAIL_FAILED', order, { reason: error.message.slice(0, 120) });
}

/**
 * Retention for digital cards (docs/cards.md#retention), run daily in batches:
 * images past their keep date (free 7 days, plan 30, paid a year after
 * payment), unfinished and rejected photos, checkouts never paid, cards left
 * for a month (a year when bought), contacts with nothing left to keep, and
 * funnel steps after two years. Rows that count (exports, orders) stay.
 */
export async function cardRetention(deps: Pick<WorkerDeps, 'prisma' | 'log'> & { deleteObject: (key: string) => Promise<void> }, now = Date.now()) {
  const { prisma, log } = deps;
  const remove = async (key: string | null | undefined) => {
    if (key && !key.startsWith('pending')) await deps.deleteObject(key);
  };

  const images = await prisma.cardExport.findMany({ where: { status: 'READY', expiresAt: { lt: new Date(now) } }, take: 500, select: { id: true, storageKey: true } });
  for (const image of images) {
    try {
      await remove(image.storageKey);
      await prisma.cardExport.update({ where: { id: image.id }, data: { status: 'EXPIRED', storageKey: null } });
    } catch (err) {
      log.warn({ err, exportId: image.id }, 'Could not delete an expired card image; trying again tomorrow');
    }
  }

  const uploads = await prisma.cardUpload.findMany({
    where: { OR: [{ status: 'UPLOADING', createdAt: { lt: new Date(now - DAY) } }, { status: 'REJECTED', updatedAt: { lt: new Date(now - DAY) } }] },
    take: 500,
    select: { id: true, originalKey: true, storageKey: true },
  });
  for (const upload of uploads) {
    try {
      await remove(upload.originalKey);
      await remove(upload.storageKey);
      await prisma.cardUpload.delete({ where: { id: upload.id } });
    } catch (err) {
      log.warn({ err, uploadId: upload.id }, 'Could not delete a stale card photo; trying again tomorrow');
    }
  }

  // A payment that still arrives for one of these is honoured (the webhook settles it).
  const checkouts = await prisma.cardOrder.updateMany({ where: { status: 'PENDING', createdAt: { lt: new Date(now - 2 * DAY) } }, data: { status: 'EXPIRED' } });

  const sessions = await prisma.cardSession.findMany({
    where: { lastSeenAt: { lt: new Date(now - 30 * DAY) }, orders: { none: { status: 'PAID', paidAt: { gt: new Date(now - 365 * DAY) } } } },
    take: 200,
    select: { id: true, uploads: { select: { originalKey: true, storageKey: true } } },
  });
  let cards = 0;
  for (const session of sessions) {
    try {
      for (const u of session.uploads) {
        await remove(u.originalKey);
        await remove(u.storageKey);
      }
      await prisma.cardSession.delete({ where: { id: session.id } });
      cards++;
    } catch (err) {
      log.warn({ err, sessionId: session.id }, 'Could not delete an abandoned card; trying again tomorrow');
    }
  }

  const contacts = await prisma.cardLead.deleteMany({
    where: { lastSeenAt: { lt: new Date(now - 365 * DAY) }, orders: { none: {} }, OR: [{ marketingConsentAt: null }, { marketingWithdrawnAt: { not: null } }] },
  });
  const steps = await prisma.cardEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 730 * DAY) } } });
  return { images: images.length, uploads: uploads.length, checkouts: checkouts.count, cards, contacts: contacts.count, steps: steps.count };
}
