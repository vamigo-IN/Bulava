import { Injectable } from '@nestjs/common';
import type { ReminderSettingsInput } from '@bulava/validation';
import { whatsappMessagesLeft } from '@bulava/database';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { PlatformSettingsService } from '../settings/settings.service';

/** Guests are not nudged more often than this, whatever the host clicks. */
const MIN_RSVP_REMINDER_GAP_MS = 12 * 3_600_000;

/**
 * Host settings for automatic reminders (spec §49). The API only stores the
 * schedule; the worker's reminder job sends them and records what it sent.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: PlatformSettingsService,
  ) {}

  async get(access: EventAccessContext) {
    const now = new Date();
    const messaging = await this.settings.messaging();
    // The worker reminds guests with a phone number on WhatsApp while the event's plan has messages left.
    const whatsapp = messaging.whatsappReminders && (await whatsappMessagesLeft(this.prisma, access.eventId, now)) > 0;
    const [settings, pendingGuests, functions] = await Promise.all([
      this.prisma.eventReminderSettings.findUnique({ where: { eventId: access.eventId } }),
      // Guests a reminder can reach who have not replied at all.
      this.prisma.guest.count({
        where: {
          eventId: access.eventId,
          deletedAt: null,
          ...(whatsapp ? { OR: [{ email: { not: null } }, { phone: { not: null } }] } : { email: { not: null } }),
          rsvps: { none: {} },
          invitations: { some: { status: { not: 'REVOKED' }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } },
        },
      }),
      this.prisma.eventFunction.findMany({
        where: { eventId: access.eventId, deletedAt: null, status: 'SCHEDULED', startsAt: { gt: now } },
        select: { id: true, name: true, startsAt: true, reminderSentFor: true },
        orderBy: { startsAt: 'asc' },
      }),
    ]);
    const hours = settings?.functionReminderHours ?? null;
    return {
      rsvpReminderAt: settings?.rsvpReminderAt ?? null,
      rsvpReminderSentAt: settings?.rsvpReminderSentAt ?? null,
      rsvpReminderRecipients: settings?.rsvpReminderRecipients ?? null,
      functionReminderHours: hours,
      pendingGuests,
      channels: { email: messaging.email, whatsapp },
      upcoming: functions.map((f) => ({
        functionId: f.id,
        name: f.name,
        startsAt: f.startsAt,
        remindAt: hours ? new Date(f.startsAt!.getTime() - hours * 3_600_000) : null,
        sent: f.reminderSentFor?.getTime() === f.startsAt!.getTime(),
      })),
    };
  }

  async update(access: EventAccessContext, input: ReminderSettingsInput, meta: RequestMeta) {
    const current = await this.prisma.eventReminderSettings.findUnique({ where: { eventId: access.eventId } });
    const at = input.rsvpReminderAt ? new Date(input.rsvpReminderAt) : null;
    const changed = (at?.getTime() ?? null) !== (current?.rsvpReminderAt?.getTime() ?? null);
    // A minute of grace for clocks and slow forms; the past is otherwise refused.
    if (at && changed && at.getTime() < Date.now() - 60_000) throw new AppError('REMINDER_INVALID', 'Choose a reminder time in the future.');
    const data = {
      rsvpReminderAt: at,
      functionReminderHours: input.functionReminderHours,
      // A new time is a new reminder.
      ...(changed ? { rsvpReminderSentAt: null, rsvpReminderRecipients: null } : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.eventReminderSettings.upsert({ where: { eventId: access.eventId }, create: { eventId: access.eventId, ...data }, update: data });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'reminders.updated', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, metadata: input, meta },
        tx,
      );
    });
    return this.get(access);
  }

  /** "Remind them now": scheduled for immediate delivery by the worker, at most every 12 hours. */
  async sendRsvpNow(access: EventAccessContext, meta: RequestMeta) {
    const current = await this.prisma.eventReminderSettings.findUnique({ where: { eventId: access.eventId } });
    if (current?.rsvpReminderSentAt && Date.now() - current.rsvpReminderSentAt.getTime() < MIN_RSVP_REMINDER_GAP_MS) {
      throw new AppError('REMINDER_TOO_SOON', 'A reminder went out recently. Please wait a few hours before sending another.');
    }
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, select: { status: true } });
    if (event.status !== 'ACTIVE') throw new AppError('EVENT_NOT_PUBLISHED', 'Publish the event before sending reminders.');
    const now = new Date();
    const data = { rsvpReminderAt: now, rsvpReminderSentAt: null, rsvpReminderRecipients: null };
    await this.prisma.$transaction(async (tx) => {
      await tx.eventReminderSettings.upsert({ where: { eventId: access.eventId }, create: { eventId: access.eventId, ...data }, update: data });
      await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'reminders.rsvp_send_now', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, meta }, tx);
    });
    return this.get(access);
  }
}
