import { Injectable, Logger } from '@nestjs/common';
import { recordWhatsAppInbound, whatsappMessageFailed, whatsappPhone } from '@bulava/database';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** How far back a reply is matched to the last message its number got. */
const REPLY_WINDOW_DAYS = 30;
/** A host gets at most one email per guest in this time, however many messages the guest sends. */
const HOST_EMAIL_MINUTES = 60;

/**
 * The platform's WhatsApp number, from the other side (ADR-073): what people
 * send to it, and what WhatsApp says about the messages it sent.
 *
 * - A message from a number shows it is on WhatsApp (it is reachable again)
 *   and opens WhatsApp's 24-hour service window; STOP opts it out of messages
 *   and START back in.
 * - A guest's message reaches their host: in the dashboard, and by email at
 *   most once an hour per guest, with a link to answer from the host's own
 *   WhatsApp. The guest is the one the message replies to, else the guest this
 *   number last got a message as.
 * - A message WhatsApp could not deliver fails (its allowance comes back), and
 *   a number that is not on WhatsApp is not messaged again; an invitation or a
 *   reminder then goes by email.
 */
@Injectable()
export class WhatsAppInboxService {
  private readonly logger = new Logger(WhatsAppInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** One message from a number (`replyTo`: the ids of the messages it answers, when WhatsApp says). */
  async inbound(from: string, text: string | null, replyTo: string[] = []): Promise<void> {
    const { phone, status, keyword } = await recordWhatsAppInbound(this.prisma, from, text);
    if (!phone) return;
    const guest = await this.guestFor(phone, replyTo);
    if (!guest) return;
    const payload = {
      guestId: guest.id,
      guestName: guest.name,
      eventTitle: guest.event.title,
      text: (text ?? '').trim().slice(0, 1000),
      phone,
      ...(keyword ? { keyword } : {}),
      optedOut: status === 'OPTED_OUT',
    };
    await this.notifications.notify({ type: 'GUEST_REPLY', channel: 'IN_APP', eventId: guest.eventId, userId: guest.event.ownerId, payload });
    const recent = await this.prisma.notification.count({
      where: {
        type: 'GUEST_REPLY',
        channel: 'EMAIL',
        eventId: guest.eventId,
        createdAt: { gt: new Date(Date.now() - HOST_EMAIL_MINUTES * 60_000) },
        payload: { path: ['guestId'], equals: guest.id },
      },
    });
    // The host's address, never the guest's: no guestId on the row (the worker would write to the guest).
    if (!recent) await this.notifications.notify({ type: 'GUEST_REPLY', channel: 'EMAIL', eventId: guest.eventId, userId: guest.event.ownerId, payload });
  }

  /** A message WhatsApp could not deliver (a webhook's report). */
  async failed(providerMessageId: string, failure: { code?: number | null; reason: string; phone?: string | null }): Promise<void> {
    const result = await whatsappMessageFailed(this.prisma, { providerMessageId }, failure);
    if (result.fallbackId) await this.notifications.enqueue(result.fallbackId);
    if (result.unreachable) this.logger.log({ providerMessageId }, 'A WhatsApp number is not on WhatsApp; it gets email from now on');
  }

  /** The guest a message from `phone` is about, in a live event. */
  private async guestFor(phone: string, replyTo: string[]) {
    const include = { event: { select: { title: true, ownerId: true, status: true, deletedAt: true } } } as const;
    const live = (g: { deletedAt: Date | null; event: { status: string; deletedAt: Date | null } } | null) => !!g && !g.deletedAt && !g.event.deletedAt && g.event.status !== 'DRAFT';
    // The message it answers, when WhatsApp says which.
    if (replyTo.length) {
      const sent = await this.prisma.notification.findFirst({ where: { providerMessageId: { in: replyTo }, guestId: { not: null } }, select: { guestId: true } });
      const delivery = sent ? null : await this.prisma.invitationDelivery.findFirst({ where: { providerMessageId: { in: replyTo } }, select: { invitation: { select: { guestId: true } } } });
      const guestId = sent?.guestId ?? delivery?.invitation.guestId;
      if (guestId) {
        const guest = await this.prisma.guest.findUnique({ where: { id: guestId }, include });
        if (live(guest) && whatsappPhone(guest!.phone ?? '') === phone) return guest!;
      }
    }
    // Else the guest this number last got a message as.
    const guests = await this.prisma.guest.findMany({ where: { phone, deletedAt: null }, include, orderBy: { createdAt: 'desc' }, take: 20 });
    const candidates = guests.filter(live);
    if (!candidates.length) return null;
    const last = await this.prisma.notification.findFirst({
      where: { channel: 'WHATSAPP', guestId: { in: candidates.map((g) => g.id) }, createdAt: { gt: new Date(Date.now() - REPLY_WINDOW_DAYS * 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      select: { guestId: true },
    });
    return candidates.find((g) => g.id === last?.guestId) ?? candidates[0]!;
  }
}
