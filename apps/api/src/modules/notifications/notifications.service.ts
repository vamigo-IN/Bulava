import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@bulava/database';
import { AnnouncementAudienceSchema } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AudienceService } from '../audience/audience.service';

export type NotificationType =
  | 'INVITATION'
  | 'INVITATION_REMINDER'
  | 'RSVP_REMINDER'
  | 'EVENT_UPDATE'
  | 'FUNCTION_REMINDER'
  | 'MEDIA_AVAILABLE'
  | 'PHOTO_UPLOAD'
  | 'PAYMENT'
  | 'RENDER_COMPLETE'
  | 'RSVP_RECEIVED'
  | 'REGISTRATION_RECEIVED'
  | 'REGISTRATION_UPDATE'
  | 'MEMBER_ADDED'
  // ADR-073: follow-ups on email and WhatsApp.
  | 'REGISTRATION_CONFIRMED'
  | 'GALLERY_SHARED'
  | 'PLAN_PURCHASED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PENDING'
  /** A guest answered a WhatsApp message: shown to the host (in-app and email). */
  | 'GUEST_REPLY';

export type Channel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

/**
 * Unified notification service. Every notification is a DB row (auditable,
 * retryable); delivery for external channels happens asynchronously in the
 * worker through provider adapters (email/SMS/WhatsApp/push).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly audience: AudienceService,
  ) {}

  async notify(input: {
    type: NotificationType;
    channel: Channel;
    eventId?: string | null;
    userId?: string | null;
    guestId?: string | null;
    payload: Prisma.InputJsonValue;
  }): Promise<string> {
    const inApp = input.channel === 'IN_APP';
    const row = await this.prisma.notification.create({
      data: {
        type: input.type,
        channel: input.channel,
        eventId: input.eventId ?? null,
        userId: input.userId ?? null,
        guestId: input.guestId ?? null,
        payload: input.payload,
        status: inApp ? 'DELIVERED' : 'QUEUED',
        sentAt: inApp ? new Date() : null,
      },
    });
    if (!inApp) await this.enqueue(row.id);
    return row.id;
  }

  /** Hand a QUEUED notification to the worker, e.g. after the transaction that created it commits. Idempotent. */
  async enqueue(notificationId: string): Promise<void> {
    await this.queues.add('notifications', { notificationId }, { jobId: `notification-${notificationId}` });
  }

  /**
   * The guests in a published announcement's audience (the same access rules
   * as invitations), each with an in-app row for their invitation page. The
   * email and WhatsApp messages are the caller's (MessagesService).
   */
  async fanOutAnnouncement(announcementId: string): Promise<string[]> {
    const announcement = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement?.publishedAt) return [];
    const audience = AnnouncementAudienceSchema.safeParse(announcement.audience);
    if (!audience.success) return [];
    const [eventFacts, guests] = await Promise.all([
      this.audience.loadEventFacts(announcement.eventId),
      this.audience.loadGuestFacts(announcement.eventId),
    ]);
    const reached: string[] = [];
    for (const guest of guests) {
      if (!AudienceService.announcementIncludes(audience.data, guest, eventFacts)) continue;
      reached.push(guest.guestId);
      await this.notify({ type: 'EVENT_UPDATE', channel: 'IN_APP', eventId: announcement.eventId, guestId: guest.guestId, payload: { announcementId, title: announcement.title } });
    }
    return reached;
  }

  /** In-app inbox for a signed-in user. */
  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }
}

@Global()
@Module({ providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
