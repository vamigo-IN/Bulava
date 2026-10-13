import type { PrismaClient } from '../generated/client';

/**
 * Phone numbers' standing with WhatsApp (ADR-073). A number WhatsApp cannot
 * deliver to (not on WhatsApp, an app too old, terms not accepted) is
 * UNREACHABLE: messages to it are skipped and its person is reached by email,
 * so no queue waits on it. Someone who sends STOP is OPTED_OUT until they send
 * START. Any message from a number (a reply, a tapped button) makes it
 * REACHABLE again: it is on WhatsApp after all. Shared by the API (webhooks,
 * choosing channels) and the worker (sending, delivery reports).
 */
export type WhatsAppNumberStatus = 'REACHABLE' | 'UNREACHABLE' | 'OPTED_OUT';

/** How long an unreachable number is left alone before it is tried once more (people join WhatsApp). */
export const UNREACHABLE_RETRY_DAYS = 60;

const STOP_WORDS = new Set(['stop', 'stop all', 'unsubscribe', 'opt out', 'optout']);
const START_WORDS = new Set(['start', 'unstop', 'subscribe', 'opt in', 'optin']);

/** The keyword a message is, when it is one: STOP or START, in any case, with punctuation and spaces around it ignored. */
export function whatsappKeyword(text: string | null | undefined): 'STOP' | 'START' | null {
  const words = (text ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
  if (STOP_WORDS.has(words)) return 'STOP';
  if (START_WORDS.has(words)) return 'START';
  return null;
}

/**
 * Whether a provider's refusal or failure means the number cannot get WhatsApp
 * messages, rather than a wrong template or a busy server: Meta's 131026
 * ("message undeliverable": not on WhatsApp, an old app, terms not accepted)
 * and the wording GetGabs passes on.
 */
export function isUnreachableError(code: number | null | undefined, message: string | null | undefined): boolean {
  if (code === 131026) return true;
  return /131026|undeliverable|incapable of receiving|not (?:a )?(?:valid )?whatsapp (?:user|number|account)|not (?:on|registered (?:on|with)) whatsapp|does(?:n't| not) (?:have|use) whatsapp/i.test(message ?? '');
}

/** A phone number as WhatsApp numbers are kept: E.164 with its "+" (providers report digits only). */
export function whatsappPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

type Numbers = Pick<PrismaClient, 'whatsAppNumber'>;

/** The numbers among `phones` not to message now: opted out, or unreachable within the last UNREACHABLE_RETRY_DAYS. */
export async function whatsappNumbersToSkip(prisma: Numbers, phones: Array<string | null | undefined>, now: Date = new Date()): Promise<Set<string>> {
  const unique = [...new Set(phones.filter((p): p is string => !!p).map(whatsappPhone).filter(Boolean))];
  if (!unique.length) return new Set();
  const rows = await prisma.whatsAppNumber.findMany({
    where: { phone: { in: unique }, status: { in: ['UNREACHABLE', 'OPTED_OUT'] } },
    select: { phone: true, status: true, lastFailureAt: true },
  });
  const since = now.getTime() - UNREACHABLE_RETRY_DAYS * 86_400_000;
  return new Set(rows.filter((r) => r.status === 'OPTED_OUT' || (r.lastFailureAt?.getTime() ?? 0) > since).map((r) => r.phone));
}

/** Whether one number may be messaged now (see whatsappNumbersToSkip). */
export async function whatsappReachable(prisma: Numbers, phone: string, now: Date = new Date()): Promise<boolean> {
  return !(await whatsappNumbersToSkip(prisma, [phone], now)).has(whatsappPhone(phone));
}

/** WhatsApp said this number cannot get messages: it is skipped from now on. An opted-out number stays opted out. */
export async function markWhatsAppUnreachable(prisma: Numbers, phone: string, reason: string, now: Date = new Date()): Promise<void> {
  const number = whatsappPhone(phone);
  if (!number) return;
  await prisma.whatsAppNumber.upsert({
    where: { phone: number },
    create: { phone: number, status: 'UNREACHABLE', reason: reason.slice(0, 300), failures: 1, lastFailureAt: now },
    update: { failures: { increment: 1 }, lastFailureAt: now, reason: reason.slice(0, 300) },
  });
  await prisma.whatsAppNumber.updateMany({ where: { phone: number, status: 'REACHABLE' }, data: { status: 'UNREACHABLE' } });
}

/** Guest messages that go on WhatsApp instead of email (not as well): when WhatsApp cannot deliver one, it goes by email. */
const EMAIL_FALLBACK_TYPES = new Set(['INVITATION', 'INVITATION_REMINDER', 'RSVP_REMINDER', 'FUNCTION_REMINDER']);

/**
 * A WhatsApp message that could not be delivered (a refusal when sending, or a
 * delivery report later): its notification fails, which gives its event's
 * allowance back; the number is marked unreachable when WhatsApp says it is
 * not on WhatsApp; and a guest message that went by WhatsApp alone (an
 * invitation, a reminder) is written again for email when the guest has an
 * address. Returns that email notification's id, for the caller to queue.
 */
export async function whatsappMessageFailed(
  prisma: Pick<PrismaClient, 'notification' | 'guest' | 'user' | 'whatsAppNumber'>,
  which: { notificationId: string } | { providerMessageId: string },
  failure: { code?: number | null; reason: string; phone?: string | null },
): Promise<{ unreachable: boolean; fallbackId: string | null }> {
  const n = await prisma.notification.findFirst({
    where: { channel: 'WHATSAPP', ...('notificationId' in which ? { id: which.notificationId } : { providerMessageId: which.providerMessageId }) },
  });
  if (n && (n.status === 'QUEUED' || n.status === 'SENT')) {
    await prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED', error: failure.reason.slice(0, 500) } });
  }
  const unreachable = isUnreachableError(failure.code, failure.reason);
  if (!unreachable) return { unreachable, fallbackId: null };
  const guest = n?.guestId ? await prisma.guest.findUnique({ where: { id: n.guestId }, select: { phone: true } }) : null;
  const user = !guest && n?.userId ? await prisma.user.findUnique({ where: { id: n.userId }, select: { phone: true } }) : null;
  const phone = failure.phone ?? guest?.phone ?? user?.phone ?? null;
  if (phone) await markWhatsAppUnreachable(prisma, phone, failure.reason);
  return { unreachable, fallbackId: n ? await whatsappEmailFallback(prisma, n.id) : null };
}

/**
 * A guest message that went by WhatsApp alone (an invitation, a reminder) and
 * could not: the same message by email, when the guest has an address. Once
 * per message (a second report about it writes nothing). Returns the email
 * notification's id, for the caller to queue.
 */
export async function whatsappEmailFallback(prisma: Pick<PrismaClient, 'notification' | 'guest'>, notificationId: string): Promise<string | null> {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!n?.guestId || n.channel !== 'WHATSAPP' || !EMAIL_FALLBACK_TYPES.has(n.type)) return null;
  const guest = await prisma.guest.findUnique({ where: { id: n.guestId }, select: { id: true, email: true, deletedAt: true } });
  if (!guest?.email || guest.deletedAt) return null;
  const already = await prisma.notification.count({ where: { guestId: guest.id, type: n.type, channel: 'EMAIL', createdAt: { gte: n.createdAt } } });
  if (already) return null;
  const email = await prisma.notification.create({
    data: { type: n.type, channel: 'EMAIL', eventId: n.eventId, guestId: guest.id, payload: n.payload ?? {}, status: 'QUEUED' },
    select: { id: true },
  });
  return email.id;
}

/**
 * A message from this number: it is on WhatsApp (and WhatsApp's 24-hour
 * service window opens), STOP opts it out and START back in. A number that
 * opted out stays out until START, whatever else it sends.
 */
export async function recordWhatsAppInbound(
  prisma: Numbers,
  phone: string,
  text: string | null | undefined,
  now: Date = new Date(),
): Promise<{ phone: string; status: WhatsAppNumberStatus; keyword: 'STOP' | 'START' | null }> {
  const number = whatsappPhone(phone);
  const keyword = whatsappKeyword(text);
  const existing = number ? await prisma.whatsAppNumber.findUnique({ where: { phone: number }, select: { status: true } }) : null;
  const status: WhatsAppNumberStatus = keyword === 'STOP' ? 'OPTED_OUT' : keyword === 'START' ? 'REACHABLE' : existing?.status === 'OPTED_OUT' ? 'OPTED_OUT' : 'REACHABLE';
  if (number) {
    await prisma.whatsAppNumber.upsert({
      where: { phone: number },
      create: { phone: number, status, lastInboundAt: now, reason: keyword },
      update: { status, lastInboundAt: now, ...(keyword ? { reason: keyword } : status === 'REACHABLE' ? { reason: null } : {}) },
    });
  }
  return { phone: number, status, keyword };
}
