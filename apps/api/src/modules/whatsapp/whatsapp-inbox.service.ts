import { Injectable, Logger } from '@nestjs/common';
import { previewTitle, recordWhatsAppInbound, whatsappMessageFailed, whatsappPhone, type Prisma, type WhatsAppNumberStatus } from '@bulava/database';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** How far back a reply is matched to the last message its number got. */
const REPLY_WINDOW_DAYS = 30;
/** A host gets at most one email per guest in this time, however many messages the guest sends. */
const HOST_EMAIL_MINUTES = 60;
/** Messages to someone who asked for a preview (ADR-076): their rows carry the request's id. */
const PREVIEW_TYPES = ['PREVIEW_REQUESTED', 'PREVIEW_READY'];

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
 * - Someone who asked for a preview reaches whoever is making it (the admins
 *   while nobody has it): on the request's history, in the dashboard, and by
 *   email at most once an hour per request (ADR-076). It is a preview message
 *   when it answers one, or when the last message this number got was one.
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
    const preview = await this.previewFor(phone, replyTo);
    if (preview) return this.previewReply(preview, phone, text, status, keyword);
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

  /** The open preview request a message from `phone` is about, when it is about one. */
  private async previewFor(phone: string, replyTo: string[]) {
    const select = { id: true, reference: true, phone: true, status: true, assigneeId: true, details: true, title: true } as const;
    const open = (r: { phone: string; status: string } | null) => !!r && r.phone === phone && r.status !== 'CLOSED' && r.status !== 'CANCELLED';
    if (replyTo.length) {
      const sent = await this.prisma.notification.findFirst({ where: { providerMessageId: { in: replyTo } }, select: { guestId: true, userId: true, payload: true } });
      const id = sent && !sent.guestId && !sent.userId ? (sent.payload as { previewRequestId?: unknown } | null)?.previewRequestId : null;
      if (typeof id === 'string') {
        const request = await this.prisma.previewRequest.findUnique({ where: { id }, select });
        return open(request) ? request : null;
      }
      // It answers another message (a guest's): that decides.
      if (sent || (await this.prisma.invitationDelivery.count({ where: { providerMessageId: { in: replyTo } } }))) return null;
    }
    const since = new Date(Date.now() - REPLY_WINDOW_DAYS * 86_400_000);
    const requests = await this.prisma.previewRequest.findMany({ where: { phone, status: { notIn: ['CLOSED', 'CANCELLED'] }, updatedAt: { gt: since } }, select, orderBy: { updatedAt: 'desc' }, take: 5 });
    if (!requests.length) return null;
    const last = await this.prisma.notification.findFirst({
      where: { channel: 'WHATSAPP', type: { in: PREVIEW_TYPES }, guestId: null, userId: null, createdAt: { gt: since }, OR: requests.map((r) => ({ payload: { path: ['previewRequestId'], equals: r.id } })) },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, payload: true },
    });
    if (!last) return null;
    // A guest's message since then: the reply is the guest's.
    const guests = await this.prisma.guest.findMany({ where: { phone, deletedAt: null }, select: { id: true }, take: 20 });
    if (guests.length && (await this.prisma.notification.count({ where: { channel: 'WHATSAPP', guestId: { in: guests.map((g) => g.id) }, createdAt: { gt: last.createdAt } } }))) return null;
    const id = (last.payload as { previewRequestId?: unknown } | null)?.previewRequestId;
    return requests.find((r) => r.id === id) ?? null;
  }

  /** A preview customer's message: on the request's history, and to whoever is making it. */
  private async previewReply(
    request: { id: string; reference: string; assigneeId: string | null; details: Prisma.JsonValue; title: string | null },
    phone: string,
    text: string | null,
    status: WhatsAppNumberStatus,
    keyword: 'STOP' | 'START' | null,
  ): Promise<void> {
    const body = (text ?? '').trim().slice(0, 1000);
    const optedOut = status === 'OPTED_OUT';
    await this.prisma.previewActivity.create({ data: { requestId: request.id, kind: 'REPLIED', text: body || null, meta: { ...(keyword ? { keyword } : {}), optedOut } } });
    const to = request.assigneeId
      ? [request.assigneeId]
      : (await this.prisma.user.findMany({ where: { platformRole: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] }, deletedAt: null, status: 'ACTIVE' }, select: { id: true } })).map((u) => u.id);
    const payload = { requestId: request.id, reference: request.reference, title: previewTitle(request), text: body, phone, optedOut, ...(keyword ? { keyword } : {}) };
    const recent = await this.prisma.notification.count({
      where: { type: 'PREVIEW_REPLY', channel: 'EMAIL', createdAt: { gt: new Date(Date.now() - HOST_EMAIL_MINUTES * 60_000) }, payload: { path: ['requestId'], equals: request.id } },
    });
    for (const userId of to) {
      await this.notifications.notify({ type: 'PREVIEW_REPLY', channel: 'IN_APP', userId, payload });
      if (!recent) await this.notifications.notify({ type: 'PREVIEW_REPLY', channel: 'EMAIL', userId, payload });
    }
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
