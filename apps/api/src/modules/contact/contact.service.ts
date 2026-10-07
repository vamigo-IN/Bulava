import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type ContactStatus } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import { CONTACT_STATUSES, type ContactMessageInput, type ContactMessageUpdateInput, type ContactReplyInput } from '@bulava/validation';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { contactReceivedEmail, contactReplyEmail } from './contact-email';

/** No 0/O, 1/I/L: references are read out on the phone. */
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const newReference = () => `BLV-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')}`;

const PAGE_SIZE = 50;

export interface ContactListFilter {
  status?: string;
  q?: string;
  cursor?: string;
}

/**
 * The public contact form and the console's inbox (contact.manage). New
 * messages are emailed to the support address with the sender as reply-to;
 * replies written in the console are emailed from the platform and kept with
 * the message.
 */
@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly audit: AuditService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
  ) {}

  async submit(input: ContactMessageInput): Promise<{ reference: string }> {
    // The hidden "website" field: people never fill it in. Answer like a success so bots learn nothing.
    if (input.website?.trim()) return { reference: newReference() };

    let row: { id: string; reference: string } | null = null;
    for (let attempt = 0; !row; attempt++) {
      try {
        row = await this.prisma.contactMessage.create({
          data: { reference: newReference(), name: input.name, email: input.email, phone: input.phone ?? null, topic: input.topic, message: input.message },
          select: { id: true, reference: true },
        });
      } catch (error) {
        const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!clash || attempt >= 4) throw error;
      }
    }

    const site = (await this.store.get('site')).value;
    const mail = contactReceivedEmail({ site: site.name, reference: row.reference, name: input.name, email: input.email, phone: input.phone ?? null, topic: input.topic, message: input.message });
    // The job carries the message itself, so it leaves Redis as soon as it is sent. The message is
    // already saved, so a queue hiccup must not fail the visitor's request.
    await this.queues.addQuietly('email', { to: site.supportEmail, replyTo: input.email, ...mail }, { removeOnComplete: true, removeOnFail: true });
    return { reference: row.reference };
  }

  // ───────── Console ─────────

  async list(filter: ContactListFilter) {
    const status = (CONTACT_STATUSES as readonly string[]).includes(filter.status ?? '') ? (filter.status as ContactStatus) : undefined;
    const q = filter.q?.trim().slice(0, 120);
    const where: Prisma.ContactMessageWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { reference: { equals: q.toUpperCase() } },
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q } },
              { message: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filter.cursor && /^[0-9a-f-]{36}$/i.test(filter.cursor) ? { id: { lt: filter.cursor } } : {}),
    };
    const rows = await this.prisma.contactMessage.findMany({
      where,
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      select: { id: true, reference: true, name: true, email: true, topic: true, status: true, message: true, repliedAt: true, createdAt: true, _count: { select: { replies: true } } },
    });
    const items = rows.slice(0, PAGE_SIZE).map(({ message, _count, ...r }) => ({ ...r, preview: message.slice(0, 160), replies: _count.replies }));
    return { items, nextCursor: rows.length > PAGE_SIZE ? (items[items.length - 1]?.id ?? null) : null };
  }

  async counts(): Promise<Record<ContactStatus, number>> {
    const groups = await this.prisma.contactMessage.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(CONTACT_STATUSES.map((s) => [s, 0])) as Record<ContactStatus, number>;
    for (const g of groups) counts[g.status] = g._count._all;
    return counts;
  }

  async get(id: string) {
    const row = await this.prisma.contactMessage.findUnique({ where: { id }, include: { replies: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw AppError.notFound('Message');
    const staffIds = [...new Set([row.handledById, ...row.replies.map((r) => r.sentById)].filter((v): v is string => !!v))];
    const staff = staffIds.length ? await this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [];
    const nameOf = (userId: string | null) => staff.find((s) => s.id === userId)?.name ?? null;
    return {
      ...row,
      handledByName: nameOf(row.handledById),
      replies: row.replies.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, sentByName: nameOf(r.sentById) })),
    };
  }

  async update(userId: string, id: string, input: ContactMessageUpdateInput, meta: RequestMeta) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw AppError.notFound('Message');
    await this.prisma.$transaction(async (tx) => {
      await tx.contactMessage.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status, resolvedAt: input.status === 'RESOLVED' ? new Date() : null } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
          handledById: userId,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'admin.contact_updated',
          targetType: 'ContactMessage',
          targetId: id,
          // The note itself stays out of the audit log.
          metadata: { ...(input.status ? { from: existing.status, to: input.status } : {}), noteChanged: input.note !== undefined },
          meta,
        },
        tx,
      );
    });
    return this.get(id);
  }

  async reply(userId: string, id: string, input: ContactReplyInput, meta: RequestMeta) {
    const [message, email, site] = await Promise.all([
      this.prisma.contactMessage.findUnique({ where: { id }, select: { reference: true, name: true, email: true, message: true, status: true } }),
      this.store.get('email'),
      this.store.get('site'),
    ]);
    if (!message) throw AppError.notFound('Message');
    if (!email.value.enabled || !email.value.host) throw new AppError('EMAIL_UNAVAILABLE', 'Email is not set up yet, so the reply cannot be sent.');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const reply = await tx.contactReply.create({ data: { messageId: id, body: input.body, sentById: userId } });
      await tx.contactMessage.update({
        where: { id },
        data: { status: input.resolve ? 'RESOLVED' : 'OPEN', repliedAt: now, resolvedAt: input.resolve ? now : null, handledById: userId },
      });
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'admin.contact_replied', targetType: 'ContactMessage', targetId: id, metadata: { replyId: reply.id, resolved: input.resolve }, meta }, tx);
    });

    const mail = contactReplyEmail({ site: site.value.name, reference: message.reference, name: message.name, reply: input.body, original: message.message, supportEmail: site.value.supportEmail });
    await this.queues.add('email', { to: message.email, replyTo: site.value.supportEmail, ...mail }, { removeOnComplete: true, removeOnFail: true });
    return this.get(id);
  }

  /** Spam, or a sender asking for their message to be erased. Replies go with it. */
  async remove(userId: string, id: string, meta: RequestMeta): Promise<void> {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id }, select: { reference: true, status: true } });
    if (!existing) throw AppError.notFound('Message');
    await this.prisma.$transaction(async (tx) => {
      await tx.contactMessage.delete({ where: { id } });
      await this.audit.record(
        { actorType: 'USER', actorId: userId, action: 'admin.contact_deleted', targetType: 'ContactMessage', targetId: id, metadata: { reference: existing.reference, status: existing.status }, meta },
        tx,
      );
    });
  }
}
