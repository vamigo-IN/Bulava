import { decryptSecret } from '@bulava/auth';
import type { PrismaClient } from '@bulava/database';
import type { JobPayloads } from '@bulava/queue';
import { advanceEventLifecycle, lifecycleOptionsFromEnv, purgeDeletedAccounts, purgeDeletedEvents } from './lifecycle';
import { accountDeletedEmail, announcementEmail, functionReminderEmail, invitationEmail, registrationUpdateEmail, rsvpReceivedEmail, rsvpReminderEmail } from './emails';
import { dispatchReminders } from './reminders';
import { checkDueDomains, type DnsResolver, type HostnameProvider, type RoutingTarget } from '@bulava/domains';
import { WhatsAppSendError, type EmailMessage, type EmailProvider, type WhatsAppChannel } from './providers';

export interface WorkerDeps {
  prisma: PrismaClient;
  /** The current email provider (the Super Admin's settings); null while email is not set up. */
  email: () => Promise<EmailProvider | null>;
  /** The site name from the admin console (Branding & contact), shown in every email. */
  siteName: () => Promise<string>;
  /** WhatsApp Business (Meta Cloud API); absent or null while it is not set up. */
  whatsapp?: () => Promise<WhatsAppChannel | null>;
  /** Queue a notification row for delivery (used by scheduled reminders). */
  enqueueNotification?: (notificationId: string) => Promise<void>;
  /** Custom domain checks (DNS, TLS provider, where domains must point); null while custom domains are off. */
  domains?: () => Promise<{ resolver: DnsResolver; provider: HostnameProvider; target: RoutingTarget } | null>;
  env: { WEB_ORIGIN: string; TOKEN_ENCRYPTION_KEY: string; POSTHOG_KEY?: string; POSTHOG_HOST?: string };
  log: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
}

/** The event's live custom domain (same scheme and port as the main site), or the main site. */
async function guestOrigin(deps: WorkerDeps, eventId: string): Promise<string> {
  const main = deps.env.WEB_ORIGIN.replace(/\/$/, '');
  const domain = await deps.prisma.eventDomain.findFirst({ where: { eventId, status: 'ACTIVE' }, select: { hostname: true } });
  if (!domain) return main;
  const url = new URL(main);
  return `${url.protocol}//${domain.hostname}${url.port ? `:${url.port}` : ''}`;
}

/** Current shareable invitation link for a guest (event-wide first), decrypted in memory only. */
async function inviteUrlFor(deps: WorkerDeps, guestId: string): Promise<string | null> {
  const invitation = await deps.prisma.invitation.findFirst({
    where: { guestId, status: { not: 'REVOKED' } },
    orderBy: [{ functionId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    include: { tokens: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const token = invitation?.tokens[0];
  if (!token || !invitation) return null;
  try {
    return `${await guestOrigin(deps, invitation.eventId)}/invite/${decryptSecret(token.tokenCiphertext, deps.env.TOKEN_ENCRYPTION_KEY)}`;
  } catch {
    return null;
  }
}

/** A WhatsApp template message: which approved template, and its body variables. */
interface WhatsAppMessage {
  template: 'invitation' | 'reminder';
  params: string[];
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
    const outcome = await compose(deps, n, payload, 'WHATSAPP');
    if ('skip' in outcome) return skip(outcome.skip);
    if (!('whatsapp' in outcome)) return skip(`No WhatsApp message for ${n.type}`);
    const template = whatsapp.templates[outcome.whatsapp.template];
    if (!template) return skip(`No approved WhatsApp template for ${outcome.whatsapp.template} messages`);
    const guest = await deps.prisma.guest.findUnique({ where: { id: n.guestId! }, select: { phone: true } });
    let messageId: string;
    try {
      ({ messageId } = await whatsapp.provider.sendTemplate({ to: guest!.phone!, template, language: whatsapp.language, params: outcome.whatsapp.params }));
    } catch (error) {
      // A wrong number or template will not fix itself: record it instead of retrying.
      if (error instanceof WhatsAppSendError && error.permanent) {
        await finish('FAILED', error.message.slice(0, 500));
        if (typeof payload.invitationId === 'string') {
          await deps.prisma.invitationDelivery.updateMany({
            where: { invitationId: payload.invitationId, channel: 'WHATSAPP_API', status: 'QUEUED' },
            data: { status: 'FAILED', error: error.message.slice(0, 500) },
          });
        }
        return 'failed';
      }
      throw error;
    }
    await finish('SENT');
    if (typeof payload.invitationId === 'string') {
      await deps.prisma.invitationDelivery.updateMany({
        where: { invitationId: payload.invitationId, channel: 'WHATSAPP_API', status: 'QUEUED' },
        data: { status: 'SENT', providerMessageId: messageId || null, sentAt: new Date() },
      });
    }
    deps.log.info({ notificationId: n.id, type: n.type }, 'WhatsApp message sent');
    return 'sent';
  }

  return skip(`${n.channel} provider not configured`);
}

/**
 * A platform message to a host's WhatsApp number (the preview link after the
 * quick start, a sign-in code). Nothing is stored: the payload carries what to
 * send, and a wrong number or template is logged rather than retried.
 */
export async function processWhatsApp(deps: WorkerDeps, job: JobPayloads['whatsapp']): Promise<string> {
  const whatsapp = (await deps.whatsapp?.()) ?? null;
  if (!whatsapp) {
    deps.log.warn({ template: job.template }, 'WhatsApp message skipped: not configured');
    return 'skipped';
  }
  const template = whatsapp.templates[job.template];
  if (!template) {
    deps.log.warn({ template: job.template }, 'WhatsApp message skipped: no approved template');
    return 'skipped';
  }
  try {
    await whatsapp.provider.sendTemplate({ to: job.to, template, language: whatsapp.language, params: job.params, copyCode: job.copyCode });
  } catch (error) {
    if (error instanceof WhatsAppSendError && error.permanent) {
      deps.log.warn({ template: job.template, code: error.code, message: error.message }, 'WhatsApp message failed');
      return 'failed';
    }
    throw error;
  }
  deps.log.info({ template: job.template }, 'WhatsApp message sent');
  return 'sent';
}

type NotificationRow = NonNullable<Awaited<ReturnType<PrismaClient['notification']['findUnique']>>>;

/** Works out what to send (and re-checks that it is still wanted); the same rules for every channel. */
async function compose(deps: WorkerDeps, n: NotificationRow, payload: Record<string, unknown>, channel: 'EMAIL' | 'WHATSAPP'): Promise<Outcome> {
  if (n.guestId) {
    const guest = await deps.prisma.guest.findUnique({ where: { id: n.guestId }, include: { event: { select: { title: true, language: true, timezone: true, status: true, deletedAt: true } } } });
    if (!guest || guest.deletedAt) return { skip: 'Guest removed' };
    if (channel === 'EMAIL' && !guest.email) return { skip: 'Guest has no email' };
    if (channel === 'WHATSAPP' && !guest.phone) return { skip: 'Guest has no phone number' };
    const to = guest.email ?? '';
    const language = guest.preferredLanguage ?? guest.event.language;
    const inviteUrl = await inviteUrlFor(deps, guest.id);
    const site = channel === 'EMAIL' ? await deps.siteName() : '';

    if (n.type === 'EVENT_UPDATE') {
      if (channel !== 'EMAIL') return { skip: 'Announcements are sent by email' };
      const announcement = await deps.prisma.announcement.findUnique({ where: { id: String(payload.announcementId) } });
      if (!announcement) return { skip: 'Announcement deleted' };
      return { email: { to, ...announcementEmail({ site, language, guestName: guest.name, eventTitle: guest.event.title, title: announcement.title, body: announcement.body, inviteUrl }) } };
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

  if (n.userId && channel === 'EMAIL') {
    const user = await deps.prisma.user.findUnique({ where: { id: n.userId }, select: { email: true, deletedAt: true } });
    if (!user?.email || user.deletedAt) return { skip: 'User has no email' };
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
  return 'noop';
}
