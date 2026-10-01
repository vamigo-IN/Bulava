import { Injectable } from '@nestjs/common';
import type { Prisma } from '@bulava/database';
import { AnnouncementAudienceSchema, type AnnouncementAudience, type CreateAnnouncementInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { AudienceService, type EventAudienceFacts, type GuestAudienceFacts } from '../audience/audience.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Host announcements ("Venue changed", "Shuttle timings"). Targeting reuses the
 * same audience rules as invitations: all guests, a function's audience, groups,
 * or specific guests.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list(access: EventAccessContext) {
    return this.prisma.announcement.findMany({ where: { eventId: access.eventId }, orderBy: { createdAt: 'desc' } });
  }

  async create(access: EventAccessContext, input: CreateAnnouncementInput, meta: RequestMeta) {
    await this.assertAudienceInEvent(access.eventId, input.audience);
    const announcement = await this.prisma.$transaction(async (tx) => {
      const row = await tx.announcement.create({
        data: {
          eventId: access.eventId,
          title: input.title,
          body: input.body,
          audience: input.audience as Prisma.InputJsonValue,
          createdById: access.userId,
          publishedAt: input.publish ? new Date() : null,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: input.publish ? 'announcement.published' : 'announcement.created',
          targetType: 'Announcement',
          targetId: row.id,
          eventId: access.eventId,
          metadata: { audience: input.audience as Prisma.InputJsonValue },
          meta,
        },
        tx,
      );
      return row;
    });
    const recipients = input.publish ? await this.notifications.fanOutAnnouncement(announcement.id, { email: input.notifyByEmail }) : 0;
    return { announcement, recipients };
  }

  async publish(access: EventAccessContext, id: string, meta: RequestMeta) {
    const row = await this.prisma.announcement.findFirst({ where: { id, eventId: access.eventId } });
    if (!row) throw AppError.notFound('Announcement');
    if (row.publishedAt) return { announcement: row, recipients: 0 };
    const updated = await this.prisma.announcement.update({ where: { id }, data: { publishedAt: new Date() } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'announcement.published', targetType: 'Announcement', targetId: id, eventId: access.eventId, meta });
    const recipients = await this.notifications.fanOutAnnouncement(id, { email: true });
    return { announcement: updated, recipients };
  }

  async remove(access: EventAccessContext, id: string) {
    const result = await this.prisma.announcement.deleteMany({ where: { id, eventId: access.eventId } });
    if (!result.count) throw AppError.notFound('Announcement');
  }

  /** Published announcements visible to one guest (for the invitation page). */
  async forGuest(eventId: string, guest: GuestAudienceFacts, event: EventAudienceFacts) {
    const rows = await this.prisma.announcement.findMany({
      where: { eventId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    return rows.filter((r) => {
      const parsed = AnnouncementAudienceSchema.safeParse(r.audience);
      return parsed.success && AudienceService.announcementIncludes(parsed.data, guest, event);
    });
  }

  private async assertAudienceInEvent(eventId: string, audience: AnnouncementAudience) {
    if ('functionIds' in audience) {
      const n = await this.prisma.eventFunction.count({ where: { eventId, id: { in: audience.functionIds }, deletedAt: null } });
      if (n !== new Set(audience.functionIds).size) throw new AppError('INVALID_REFERENCE', 'Unknown function.');
    } else if ('groupIds' in audience) {
      const n = await this.prisma.guestGroup.count({ where: { eventId, id: { in: audience.groupIds } } });
      if (n !== new Set(audience.groupIds).size) throw new AppError('INVALID_REFERENCE', 'Unknown group.');
    } else if ('guestIds' in audience) {
      const n = await this.prisma.guest.count({ where: { eventId, id: { in: audience.guestIds }, deletedAt: null } });
      if (n !== new Set(audience.guestIds).size) throw new AppError('INVALID_REFERENCE', 'Unknown guest.');
    }
  }
}
