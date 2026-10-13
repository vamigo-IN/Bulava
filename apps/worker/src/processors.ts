import { authorizedFunctions, decryptSecret } from '@bulava/auth';
import { loadEventAudienceFacts, loadGuestAudienceFacts, whatsappEmailFallback, whatsappMessageFailed, whatsappReachable, type PrismaClient } from '@bulava/database';
import { formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';
import type { JobPayloads } from '@bulava/queue';
import { advanceEventLifecycle, lifecycleOptionsFromEnv, purgeDeletedAccounts, purgeDeletedEvents } from './lifecycle';
import {
  accountDeletedEmail,
  announcementEmail,
  formatRupees,
  functionReminderEmail,
  galleryEmail,
  guestReplyEmail,
  invitationEmail,
  paymentIncompleteEmail,
  planPurchasedEmail,
  registrationConfirmedEmail,
  registrationUpdateEmail,
  rsvpReceivedEmail,
  rsvpReminderEmail,
} from './emails';
import { dispatchGalleryFollowUps, dispatchPaymentFollowUps } from './follow-ups';
import { dispatchReminders } from './reminders';
import { checkDueDomains, type DnsResolver, type HostnameProvider, type RoutingTarget } from '@bulava/domains';
import { WhatsAppSendError, type EmailMessage, type EmailProvider, type WhatsAppChannel } from './providers';
import { refreshWhatsAppStatuses } from './whatsapp-status';
import { cardRetention, sendCardOrderEmail } from './cards';

export interface WorkerDeps {
  prisma: PrismaClient;
  /** The current email provider (the Super Admin's settings); null while email is not set up. */
  email: () => Promise<EmailProvider | null>;
  /** The site name from the admin console (Branding & contact), shown in every email. */
  siteName: () => Promise<string>;
  /** WhatsApp Business (GetGabs or Meta's Cloud API, as the settings choose); absent or null while it is not set up. */
  whatsapp?: () => Promise<WhatsAppChannel | null>;
  /** Queue a notification row for delivery (used by scheduled reminders). */
  enqueueNotification?: (notificationId: string) => Promise<void>;
  /** Custom domain checks (DNS, TLS provider, where domains must point); null while custom domains are off. */
  domains?: () => Promise<{ resolver: DnsResolver; provider: HostnameProvider; target: RoutingTarget } | null>;
  env: { WEB_ORIGIN: string; TOKEN_ENCRYPTION_KEY: string; POSTHOG_KEY?: string; POSTHOG_HOST?: string };
  log: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
  /** Reads a stored file (a paid card's image, attached to its email). */
  readObject?: (key: string) => Promise<Buffer>;
}

/** The event's live custom domain (same scheme and port as the main site), or the main site. */
async function guestOrigin(deps: WorkerDeps, eventId: string): Promise<string> {
  const main = deps.env.WEB_ORIGIN.replace(/\/$/, '');
  const domain = await deps.prisma.eventDomain.findFirst({ where: { eventId, status: 'ACTIVE' }, select: { hostname: true } });
  if (!domain) return main;
  const url = new URL(main);
  return `${url.protocol}//${domain.hostname}${url.port ? `:${url.port}` : ''}`;
}

/** A guest's current invitation (event-wide first): its link, and its key for links that carry it after a # (the album). Decrypted in memory only. */
async function inviteFor(deps: WorkerDeps, guestId: string): Promise<{ url: string; token: string } | null> {
  const invitation = await deps.prisma.invitation.findFirst({
    where: { guestId, status: { not: 'REVOKED' } },
    orderBy: [{ functionId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    include: { tokens: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const stored = invitation?.tokens[0];
  if (!stored || !invitation) return null;
  try {
    const token = decryptSecret(stored.tokenCiphertext, deps.env.TOKEN_ENCRYPTION_KEY);
    return { url: `${await guestOrigin(deps, invitation.eventId)}/invite/${token}`, token };
  } catch {
    return null;
  }
}

/** A WhatsApp template message: which approved template (its kind), and its body variables. */
interface WhatsAppMessage {
  template: JobPayloads['whatsapp']['template'];
  params: string[];
}

/** A template variable: WhatsApp refuses empty ones and line breaks in them, and long ones read badly. */
function oneLine(text: string, max = 300): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat || '-';
}

/** Who a WhatsApp notification goes to: its guest's number, or an account holder's confirmed number. */
async function whatsappRecipient(deps: WorkerDeps, n: NotificationRow): Promise<string | null> {
  if (n.guestId) return (await deps.prisma.guest.findUnique({ where: { id: n.guestId }, select: { phone: true } }))?.phone ?? null;
  if (n.userId) {
    const user = await deps.prisma.user.findUnique({ where: { id: n.userId }, select: { phone: true, phoneVerifiedAt: true, deletedAt: true } });
    return user?.phone && user.phoneVerifiedAt && !user.deletedAt ? user.phone : null;
  }
  return null;
}

type Outcome = { skip: string } | { email: EmailMessage } | { whatsapp: WhatsAppMessage };

/**
 * Delivers one Notification row on its channel (EMAIL, or WHATSAPP through the
 * Business API). Idempotent: SENT rows are skipped.
 */
export async function processNotification(deps: WorkerDeps, job: JobPayloads['notifications']): Promise<string> {
  const n = await deps.prisma.notification.findUnique({ where: { id: job.notificationId } });
  if (!n || n.status === 'SENT' || n.status === 'SKIPPED' || n.status === 'FAILED') return 'noop';
  const payload = (n.payload ?? {}) as Record<string, unknown>;
  const finish = (status: 'SENT' | 'SKIPPED' | 'FAILED', error?: string) =>
    deps.prisma.notification.update({ where: { id: n.id }, data: { status, error: error ?? null, sentAt: status === 'SENT' ? new Date() : null } });

  const skip = async (reason: string) => {
    await finish('SKIPPED', reason);
    return 'skipped';
  };

  if (n.channel === 'EMAIL') {
    const email = await deps.email();
    if (!email) return skip('Email provider not configured');
    const outcome = await compose(deps, n, payload, 'EMAIL');
    if ('skip' in outcome) return skip(outcome.skip);
    if (!('email' in outcome)) return skip(`No email template for ${n.type}`);
    await email.send(outcome.email);
    await finish('SENT');
    deps.log.info({ notificationId: n.id, type: n.type }, 'Email sent');
    return 'sent';
  }

  if (n.channel === 'WHATSAPP') {
    const whatsapp = (await deps.whatsapp?.()) ?? null;
    if (!whatsapp) return skip('WhatsApp is not configured');
    const to = await whatsappRecipient(deps, n);
    if (!to) return skip(n.guestId ? 'Guest has no phone number' : 'No confirmed WhatsApp number');
    // Not on WhatsApp, or asked not to get WhatsApp messages (ADR-073): an invitation or a reminder goes by email instead.
    if (!(await whatsappReachable(deps.prisma, to))) {
      const reason = 'Not on WhatsApp, or asked not to get WhatsApp messages';
      await finish('SKIPPED', reason);
      if (typeof payload.invitationId === 'string') {
        await deps.prisma.invitationDelivery.updateMany({ where: { invitationId: payload.invitationId, channel: 'WHATSAPP_API', status: 'QUEUED' }, data: { status: 'FAILED', error: reason } });
      }
      const fallback = await whatsappEmailFallback(deps.prisma, n.id);
      if (fallback) await deps.enqueueNotification?.(fallback);
      return 'skipped';
    }
    const outcome = await compose(deps, n, payload, 'WHATSAPP');
    if ('skip' in outcome) return skip(outcome.skip);
    if (!('whatsapp' in outcome)) return skip(`No WhatsApp message for ${n.type}`);
    const template = whatsapp.templates[outcome.whatsapp.template];
    if (!template) return skip(`No approved WhatsApp template for ${outcome.whatsapp.template} messages`);
    let messageId: string;
    try {
      ({ messageId } = await whatsapp.provider.sendTemplate({ to, template, language: whatsapp.language, params: outcome.whatsapp.params }));
    } catch (error) {
      // A wrong number or template will not fix itself: record it instead of retrying. A number that is not
      // on WhatsApp is not messaged again, and an invitation or a reminder then goes by email (ADR-073).
      if (error instanceof WhatsAppSendError && error.permanent) {
        const failed = await whatsappMessageFailed(deps.prisma, { notificationId: n.id }, { code: error.code ?? null, reason: error.message, phone: to });
        if (failed.fallbackId) await deps.enqueueNotification?.(failed.fallbackId);
        if (typeof payload.invitationId === 'string') {
          await deps.prisma.invitationDelivery.updateMany({
            where: { invitationId: payload.invitationId, channel: 'WHATSAPP_API', status: 'QUEUED' },
            data: { status: 'FAILED', error: error.message.slice(0, 500), ...(whatsapp.provider.tag ? { provider: whatsapp.provider.tag } : {}) },
          });
        }
        return 'failed';
      }
      throw error;
    }
    // The provider's id: delivery reports and replies find the message by it.
    await deps.prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', error: null, sentAt: new Date(), providerMessageId: messageId || null } });
    if (typeof payload.invitationId === 'string') {
      // The provider that actually sent it: delivery reports are read back from it (GetGabs) or pushed by it (Meta).
      await deps.prisma.invitationDelivery.updateMany({
        where: { invitationId: payload.invitationId, channel: 'WHATSAPP_API', status: 'QUEUED' },
        data: { status: 'SENT', providerMessageId: messageId || null, sentAt: new Date(), ...(whatsapp.provider.tag ? { provider: whatsapp.provider.tag } : {}) },
      });
    }
    deps.log.info({ notificationId: n.id, type: n.type }, 'WhatsApp message sent');
    return 'sent';
  }

  return skip(`${n.channel} provider not configured`);
}

/** What became of a platform WhatsApp message (the job's return value, which the console's connection test shows). */
export interface WhatsAppJobResult {
  outcome: 'sent' | 'skipped' | 'failed';
  /** The provider and template used, or why it was skipped or refused. */
  detail: string;
  messageId?: string;
}

/**
 * A platform message to a WhatsApp number (a sign-in code, the console's test
 * message). Nothing is stored:
 * the payload carries what to send, and a wrong number or template is logged
 * rather than retried.
 */
export async function processWhatsApp(deps: WorkerDeps, job: JobPayloads['whatsapp']): Promise<WhatsAppJobResult> {
  const whatsapp = (await deps.whatsapp?.()) ?? null;
  if (!whatsapp) {
    deps.log.warn({ template: job.template }, 'WhatsApp message skipped: not configured');
    return { outcome: 'skipped', detail: 'WhatsApp is off or incomplete in the worker’s settings' };
  }
  const template = whatsapp.templates[job.template];
  if (!template) {
    deps.log.warn({ template: job.template }, 'WhatsApp message skipped: no approved template');
    return { outcome: 'skipped', detail: `No ${job.template} template is set` };
  }
  let messageId: string;
  try {
    ({ messageId } = await whatsapp.provider.sendTemplate({ to: job.to, template, language: whatsapp.language, params: job.params, copyCode: job.copyCode }));
  } catch (error) {
    if (error instanceof WhatsAppSendError && error.permanent) {
      deps.log.warn({ template: job.template, code: error.code, message: error.message }, 'WhatsApp message failed');
      return { outcome: 'failed', detail: `${whatsapp.provider.name} refused ${template}: ${error.message}` };
    }
    throw error;
  }
  deps.log.info({ template: job.template }, 'WhatsApp message sent');
  return { outcome: 'sent', detail: `${template} (${whatsapp.language}) through ${whatsapp.provider.name}`, ...(messageId ? { messageId } : {}) };
}

type NotificationRow = NonNullable<Awaited<ReturnType<PrismaClient['notification']['findUnique']>>>;

/**
 * When and where a registrant is expected: the first upcoming function they
 * may attend (the same access rules as invitations), else their first one.
 */
async function firstFunctionFor(deps: WorkerDeps, eventId: string, guestId: string, language: string, timeZone: string) {
  const [eventFacts, [guestFacts]] = await Promise.all([loadEventAudienceFacts(deps.prisma, eventId), loadGuestAudienceFacts(deps.prisma, eventId, [guestId])]);
  if (!guestFacts) return null;
  const visible = authorizedFunctions(eventFacts.functions, eventFacts.eventPolicy, { kind: 'guest', guestId, groupIds: guestFacts.groupIds, assignments: guestFacts.assignments, invitationFunctionId: null });
  const functions = await deps.prisma.eventFunction.findMany({
    where: { id: { in: visible.map((f) => f.id) }, eventId, deletedAt: null, status: 'SCHEDULED', startsAt: { not: null } },
    include: { venue: { select: { name: true, address: true, city: true, mapUrl: true } } },
    orderBy: { startsAt: 'asc' },
  });
  const soon = Date.now() - 6 * 3_600_000;
  const fn = functions.find((f) => f.startsAt!.getTime() >= soon) ?? functions[0];
  if (!fn?.startsAt) return null;
  const fmt = { language, timeZone };
  return { name: fn.name, when: `${formatEventDateWithWeekday(fn.startsAt, fmt)}, ${formatEventTime(fn.startsAt, fmt)}`, venue: fn.venue };
}

/** The album's gallery for one guest (their invitation's key after the #, so an invite-only gallery knows them), or null while guests may not see it. */
async function galleryUrlFor(deps: WorkerDeps, eventId: string, token: string | null): Promise<string | null> {
  const room = await deps.prisma.mediaRoom.findFirst({ where: { eventId, isMain: true }, select: { id: true, galleryVisibility: true } });
  if (!room || room.galleryVisibility === 'PRIVATE') return null;
  const qr = await deps.prisma.qRCode.findFirst({ where: { eventId, targetId: room.id, type: 'PHOTO_UPLOAD', active: true }, orderBy: { createdAt: 'asc' }, select: { code: true } });
  if (!qr) return null;
  if (!token && room.galleryVisibility !== 'PUBLIC') return null;
  return `${await guestOrigin(deps, eventId)}/p/${qr.code}/gallery${token ? `#t=${token}` : ''}`;
}

/** Works out what to send (and re-checks that it is still wanted); the same rules for every channel. */
async function compose(deps: WorkerDeps, n: NotificationRow, payload: Record<string, unknown>, channel: 'EMAIL' | 'WHATSAPP'): Promise<Outcome> {
  if (n.guestId) {
    const guest = await deps.prisma.guest.findUnique({ where: { id: n.guestId }, include: { event: { select: { title: true, language: true, timezone: true, status: true, deletedAt: true } } } });
    if (!guest || guest.deletedAt) return { skip: 'Guest removed' };
    if (channel === 'EMAIL' && !guest.email) return { skip: 'Guest has no email' };
    if (channel === 'WHATSAPP' && !guest.phone) return { skip: 'Guest has no phone number' };
    const to = guest.email ?? '';
    const language = guest.preferredLanguage ?? guest.event.language;
    const invite = await inviteFor(deps, guest.id);
    const inviteUrl = invite?.url ?? null;
    const site = channel === 'EMAIL' ? await deps.siteName() : '';

    if (n.type === 'EVENT_UPDATE') {
      const announcement = await deps.prisma.announcement.findUnique({ where: { id: String(payload.announcementId) } });
      if (!announcement?.publishedAt) return { skip: 'Announcement deleted' };
      if (channel === 'WHATSAPP') {
        if (!inviteUrl) return { skip: 'No active invitation' };
        return { whatsapp: { template: 'eventUpdate', params: [guest.name, guest.event.title, oneLine(`${announcement.title}: ${announcement.body}`), inviteUrl] } };
      }
      return { email: { to, ...announcementEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, title: announcement.title, body: announcement.body, inviteUrl }) } };
    }
    if (n.type === 'REGISTRATION_CONFIRMED') {
      if (!inviteUrl) return { skip: 'No active invitation' };
      // WhatsApp templates are in one language (the settings'); the email is in the guest's.
      const wording = channel === 'WHATSAPP' ? ((await deps.whatsapp?.())?.language ?? 'en').split(/[_-]/)[0]! : language;
      const first = await firstFunctionFor(deps, guest.eventId, guest.id, wording, guest.event.timezone);
      if (channel === 'WHATSAPP') {
        const where = first?.venue ? [first.venue.name, first.venue.city].filter(Boolean).join(', ') : '';
        return { whatsapp: { template: 'registrationConfirmed', params: [guest.name, guest.event.title, oneLine(first?.when ?? 'See your invitation'), oneLine(where || 'See your invitation'), inviteUrl] } };
      }
      return { email: { to, ...registrationConfirmedEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, when: first?.when ?? null, venue: first?.venue ?? null, inviteUrl }) } };
    }
    if (n.type === 'GALLERY_SHARED') {
      if (guest.event.status === 'DRAFT' || guest.event.deletedAt) return { skip: 'Event closed' };
      const galleryUrl = await galleryUrlFor(deps, guest.eventId, invite?.token ?? null);
      if (!galleryUrl) return { skip: 'The gallery is private, or the guest has no invitation' };
      if (channel === 'WHATSAPP') return { whatsapp: { template: 'galleryShared', params: [guest.name, guest.event.title, galleryUrl] } };
      return { email: { to, ...galleryEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, galleryUrl }) } };
    }
    if (n.type === 'RSVP_REMINDER' || n.type === 'FUNCTION_REMINDER') {
      if (!inviteUrl || guest.event.status !== 'ACTIVE' || guest.event.deletedAt) return { skip: 'Event closed or no active invitation' };
      if (n.type === 'RSVP_REMINDER') {
        // Replied since the reminder was scheduled: nothing to remind about.
        if (await deps.prisma.rSVP.count({ where: { guestId: guest.id } })) return { skip: 'Guest has replied' };
        if (channel === 'WHATSAPP') return { whatsapp: { template: 'reminder', params: [guest.name, guest.event.title, inviteUrl] } };
        return { email: { to, ...rsvpReminderEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, inviteUrl }) } };
      }
      const fn = await deps.prisma.eventFunction.findFirst({
        where: { id: String(payload.functionId), eventId: guest.eventId, deletedAt: null, status: 'SCHEDULED' },
        include: { venue: { select: { name: true, address: true, city: true, mapUrl: true } } },
      });
      if (!fn?.startsAt || fn.startsAt.getTime() < Date.now()) return { skip: 'Function changed or already started' };
      if (channel === 'WHATSAPP') return { whatsapp: { template: 'reminder', params: [guest.name, `${fn.name} · ${guest.event.title}`, inviteUrl] } };
      return {
        email: {
          to,
          ...functionReminderEmail({ site, language, timeZone: guest.event.timezone, guestName: guest.name, eventTitle: guest.event.title, functionName: fn.name, startsAt: fn.startsAt, venue: fn.venue, inviteUrl }),
        },
      };
    }
    if (n.type === 'INVITATION' || n.type === 'INVITATION_REMINDER') {
      if (!inviteUrl) return { skip: 'No active invitation' };
      if (channel === 'WHATSAPP') return { whatsapp: { template: 'invitation', params: [guest.name, guest.event.title, inviteUrl] } };
      return { email: { to, ...invitationEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, inviteUrl }) } };
    }
    if (n.type === 'REGISTRATION_UPDATE') {
      if (channel !== 'EMAIL') return { skip: 'Registration updates are sent by email' };
      const status = String(payload.status ?? '');
      if (!['PENDING', 'WAITLISTED', 'REJECTED', 'CANCELLED'].includes(status)) return { skip: 'Unknown registration status' };
      return { email: { to, ...registrationUpdateEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, status }) } };
    }
    return { skip: `No ${channel === 'EMAIL' ? 'email' : 'WhatsApp'} template for ${n.type}` };
  }

  if (n.userId) {
    const user = await deps.prisma.user.findUnique({ where: { id: n.userId }, select: { email: true, name: true, deletedAt: true } });
    if (!user || user.deletedAt) return { skip: 'Account deleted' };
    const web = deps.env.WEB_ORIGIN.replace(/\/$/, '');
    const firstName = (user.name ?? '').trim().split(/\s+/)[0] || 'there';
    // Purchases (ADR-073): the receipt, a failed payment, a checkout left waiting. Each links the order's own page.
    if (n.type === 'PLAN_PURCHASED' || n.type === 'PAYMENT_FAILED' || n.type === 'PAYMENT_PENDING') {
      const orderId = String(payload.orderId ?? '');
      const order = orderId ? await deps.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }) : null;
      if (!order) return { skip: 'Order not found' };
      if (n.type !== 'PLAN_PURCHASED' && order.status === 'PAID') return { skip: 'Paid since' };
      const plan = String(payload.plan ?? 'your');
      const amountMinor = Number(payload.amountMinor ?? 0);
      const orderUrl = `${web}/dashboard/payments/${orderId}`;
      if (channel === 'WHATSAPP') {
        if (n.type === 'PLAN_PURCHASED') return { whatsapp: { template: 'planPurchased', params: [firstName, plan, formatRupees(amountMinor), orderUrl] } };
        return { whatsapp: { template: n.type === 'PAYMENT_FAILED' ? 'paymentFailed' : 'paymentPending', params: [firstName, plan, orderUrl] } };
      }
      if (!user.email) return { skip: 'User has no email' };
      const site = await deps.siteName();
      if (n.type === 'PLAN_PURCHASED') return { email: { to: user.email, ...planPurchasedEmail({ site, name: firstName, plan, amountMinor, orderUrl }) } };
      return { email: { to: user.email, ...paymentIncompleteEmail({ site, name: firstName, plan, amountMinor, orderUrl, state: n.type === 'PAYMENT_FAILED' ? 'failed' : 'pending' }) } };
    }
    if (channel !== 'EMAIL') return { skip: `No WhatsApp message for ${n.type}` };
    if (!user.email) return { skip: 'User has no email' };
    if (n.type === 'GUEST_REPLY') {
      const phone = String(payload.phone ?? '').replace(/[^\d]/g, '');
      return {
        email: {
          to: user.email,
          ...guestReplyEmail({
            site: await deps.siteName(),
            guestName: String(payload.guestName ?? 'A guest'),
            eventTitle: String(payload.eventTitle ?? 'your event'),
            text: String(payload.text ?? ''),
            optedOut: payload.optedOut === true,
            replyUrl: `https://wa.me/${phone}`,
            dashboardUrl: `${web}/dashboard/events/${n.eventId}/guests`,
          }),
        },
      };
    }
    if (n.type === 'RSVP_RECEIVED') {
      return {
        email: {
          to: user.email,
          ...rsvpReceivedEmail({
            site: await deps.siteName(),
            guestName: String(payload.guestName ?? 'A guest'),
            eventTitle: String(payload.eventTitle ?? 'your event'),
            responses: (payload.responses as Array<{ functionName: string | null; status: string; attendeeCount: number }>) ?? [],
            dashboardUrl: `${deps.env.WEB_ORIGIN.replace(/\/$/, '')}/dashboard/events/${n.eventId}/rsvps`,
          }),
        },
      };
    }
  }
  return { skip: `No ${channel === 'EMAIL' ? 'email' : 'WhatsApp'} template for ${n.type}` };
}

/** Direct emails (e.g. OTP codes, the console's test email) that are not stored as Notification rows. */
export async function processEmail(deps: WorkerDeps, job: JobPayloads['email']): Promise<string> {
  if ('cardOrderId' in job) return sendCardOrderEmail(deps, job.cardOrderId);
  const email = await deps.email();
  if (!email) {
    deps.log.warn({ to: '[redacted]' }, 'Email provider not configured; dropping email');
    return 'skipped';
  }
  await email.send({ to: job.to, subject: job.subject, html: job.html, text: job.text, ...(job.replyTo ? { replyTo: job.replyTo } : {}) });
  return 'sent';
}

/** Store the analytics event, then forward to PostHog when configured. */
export async function processAnalytics(deps: WorkerDeps, job: JobPayloads['analytics']): Promise<string> {
  await deps.prisma.analyticsEvent.create({
    data: {
      name: job.name,
      eventId: job.eventId ?? null,
      userId: job.userId ?? null,
      guestId: job.guestId ?? null,
      properties: (job.properties ?? {}) as object,
      occurredAt: new Date(job.occurredAt),
    },
  });
  if (deps.env.POSTHOG_KEY) {
    const host = (deps.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
    const res = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: deps.env.POSTHOG_KEY,
        event: job.name,
        distinct_id: job.distinctId ?? job.eventId ?? 'anonymous',
        timestamp: job.occurredAt,
        properties: { ...job.properties, eventId: job.eventId ?? undefined, $lib: 'bulava-worker' },
      }),
    });
    if (!res.ok) throw new Error(`PostHog capture failed: ${res.status}`);
  }
  return 'stored';
}

/** Periodic housekeeping. */
export async function processCleanup(deps: WorkerDeps & { deleteObject: (key: string) => Promise<void> }, job: JobPayloads['cleanup']): Promise<string> {
  const now = Date.now();
  if (job.task === 'expired-sessions') {
    const r = await deps.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { revokedAt: { lt: new Date(now - 30 * 86_400_000) } }] } });
    await deps.prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now - 86_400_000) } } });
    // Contact-form messages (the privacy policy's promise): spam after 30 days, every other
    // conversation two years after it was last touched.
    const contact = await deps.prisma.contactMessage.deleteMany({
      where: { OR: [{ status: 'SPAM', updatedAt: { lt: new Date(now - 30 * 86_400_000) } }, { updatedAt: { lt: new Date(now - 730 * 86_400_000) } }] },
    });
    return `sessions:${r.count} contact:${contact.count}`;
  }
  if (job.task === 'stale-uploads') {
    const stale = await deps.prisma.mediaItem.findMany({ where: { status: 'UPLOADING', createdAt: { lt: new Date(now - 24 * 3_600_000) } }, take: 500 });
    for (const item of stale) {
      try {
        await deps.deleteObject(item.originalKey).catch(() => undefined);
        await deps.prisma.mediaItem.update({ where: { id: item.id }, data: { status: 'DELETED', deletedAt: new Date() } });
      } catch (err) {
        deps.log.warn({ err, mediaItemId: item.id }, 'Could not clear a stale upload; trying again next hour');
      }
    }
    return `uploads:${stale.length}`;
  }
  if (job.task === 'event-lifecycle') {
    const r = await advanceEventLifecycle(deps.prisma, lifecycleOptionsFromEnv(), Date.now(), undefined, (eventId, err) =>
      deps.log.warn({ err, eventId }, 'Could not advance an event; the others carried on'),
    );
    return `completed:${r.completed} archived:${r.archived}`;
  }
  if (job.task === 'reminders') {
    if (!deps.enqueueNotification) return 'no-queue';
    const whatsapp = deps.whatsapp;
    const r = await dispatchReminders({
      prisma: deps.prisma,
      enqueue: deps.enqueueNotification,
      log: deps.log,
      whatsappReminders: whatsapp ? async () => Boolean((await whatsapp())?.templates.reminder) : undefined,
    });
    return `rsvp:${r.rsvpEvents} functions:${r.functionReminders} notifications:${r.notifications} requeued:${r.requeued}`;
  }
  if (job.task === 'deleted-events') {
    // Accounts past their restore window first, so their events are purged in the same run.
    const sendFinalEmail = async (to: string, name: string) => {
      const email = await deps.email();
      if (email) await email.send({ to, ...accountDeletedEmail({ site: await deps.siteName(), name }) });
    };
    const accounts = await purgeDeletedAccounts(deps.prisma, sendFinalEmail, Date.now(), (userId, err) =>
      deps.log.warn({ err, userId }, 'Could not erase a deleted account; trying again tomorrow'),
    );
    const removeHostname = async (id: string) => {
      const routing = await deps.domains?.();
      await routing?.provider.remove(id);
    };
    const events = await purgeDeletedEvents(deps.prisma, deps.deleteObject, lifecycleOptionsFromEnv(), Date.now(), removeHostname, (eventId, err) =>
      deps.log.warn({ err, eventId }, 'Could not purge a deleted event; trying again tomorrow'),
    );
    return `accounts:${accounts} purged:${events}`;
  }
  if (job.task === 'domains') {
    const routing = await deps.domains?.();
    if (!routing) return 'no-domains';
    const r = await checkDueDomains({ prisma: deps.prisma, ...routing });
    return `checked:${r.checked} active:${r.active}`;
  }
  if (job.task === 'card-retention') {
    const r = await cardRetention({ prisma: deps.prisma, deleteObject: deps.deleteObject, log: deps.log }, now);
    return `images:${r.images} uploads:${r.uploads} checkouts:${r.checkouts} cards:${r.cards} contacts:${r.contacts} steps:${r.steps}`;
  }
  if (job.task === 'payment-follow-ups') {
    if (!deps.enqueueNotification) return 'no-queue';
    const channel = (await deps.whatsapp?.()) ?? null;
    const r = await dispatchPaymentFollowUps({ prisma: deps.prisma, enqueue: deps.enqueueNotification, whatsapp: Boolean(channel?.templates.paymentPending), log: deps.log }, new Date(now));
    return `pending:${r.orders} notifications:${r.notifications}`;
  }
  if (job.task === 'gallery-follow-ups') {
    if (!deps.enqueueNotification) return 'no-queue';
    const channel = (await deps.whatsapp?.()) ?? null;
    const r = await dispatchGalleryFollowUps({ prisma: deps.prisma, enqueue: deps.enqueueNotification, whatsapp: Boolean(channel?.templates.galleryShared), log: deps.log }, new Date(now));
    return `events:${r.events} notifications:${r.notifications}`;
  }
  if (job.task === 'whatsapp-status') {
    const channel = (await deps.whatsapp?.()) ?? null;
    if (!channel?.provider.deliveryState) return 'no-status-api';
    const r = await refreshWhatsAppStatuses({ prisma: deps.prisma, provider: channel.provider, log: deps.log, enqueue: deps.enqueueNotification }, now);
    return `checked:${r.checked} updated:${r.updated}`;
  }
  return 'noop';
}
