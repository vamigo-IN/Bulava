import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type CardExport, type CardSession } from '@bulava/database';
import { ObjectStorage } from '@bulava/storage';
import { cardPixelSize, type CardFormat } from '@bulava/template-schema';
import type { CardFreeDownloadInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { CARD_EXPORT_DAYS, cardFileName } from './card-designs';
import { CardsService } from './cards.service';

const LIVE = ['QUEUED', 'RENDERING', 'READY'] as const;
const DAY = 86_400_000;

/**
 * Downloads of a card (docs/cards.md#downloads): free ones with the watermark
 * after a mobile number, and watermark-free ones for customers whose plan
 * covers them. Each is rendered once per design; asking again (a double click,
 * a refresh, a retry) returns the same image. Paid cards are in CardOrdersService.
 */
@Injectable()
export class CardDownloadsService {
  private readonly logger = new Logger(CardDownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly queues: QueueService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /** The free card: the number is saved as a contact (one per number), then the watermarked image is made. */
  async free(token: string, input: CardFreeDownloadInput) {
    await this.cards.requireEnabled();
    const session = await this.cards.session(token);
    const lead = await this.prisma.$transaction(async (tx) => {
      const contact = await this.cards.upsertLead(tx, input.phone, { choice: 'FREE', marketingConsent: input.marketingConsent, source: `card-free:${session.id}` });
      await tx.cardSession.update({ where: { id: session.id }, data: { leadId: contact.id, lastSeenAt: new Date() } });
      const refs = { sessionId: session.id, leadId: contact.id, userId: session.userId, templateKey: session.templateKey };
      await this.cards.event('PHONE_SUBMITTED', { ...refs, meta: { option: 'FREE', offers: input.marketingConsent } }, tx);
      await this.cards.event('FREE_DOWNLOAD_REQUESTED', { ...refs, meta: { format: session.format } }, tx);
      return contact;
    });
    return this.view(await this.exportFor(session, 'FREE', { leadId: lead.id }));
  }

  /** A watermark-free card for a signed-in customer whose plan covers it: nothing is asked of them. */
  async plan(token: string, user: AuthUser) {
    const options = await this.cards.requireEnabled();
    const session = await this.cards.session(token);
    const coverage = await this.cards.planCoverage(user.id, options.planDownloads);
    if (!coverage.eligible) throw new AppError('CARD_PLAN_REQUIRED', 'Your plan does not include watermark-free cards.');
    if (!session.userId) await this.prisma.cardSession.update({ where: { id: session.id }, data: { userId: user.id } });
    await this.cards.event('PLAN_DOWNLOAD_REQUESTED', { sessionId: session.id, userId: user.id, templateKey: session.templateKey, meta: { format: session.format } });
    return this.view(await this.exportFor(session, 'PLAN', { userId: user.id }));
  }

  /** The image of the card's current design (one per kind), or a new one queued for rendering. */
  private async exportFor(session: CardSession, kind: 'FREE' | 'PLAN', refs: { leadId?: string; userId?: string }): Promise<CardExport> {
    const where = { sessionId: session.id, kind, designHash: session.designHash, status: { in: [...LIVE] } };
    const live = await this.prisma.cardExport.findFirst({ where });
    if (live) return live;
    try {
      const created = await this.prisma.cardExport.create({
        data: {
          kind,
          sessionId: session.id,
          leadId: refs.leadId ?? null,
          userId: refs.userId ?? null,
          templateKey: session.templateKey,
          format: session.format,
          design: session.design as Prisma.InputJsonValue,
          designHash: session.designHash,
          expiresAt: new Date(Date.now() + CARD_EXPORT_DAYS[kind] * DAY),
        },
      });
      await this.queue(created.id);
      return created;
    } catch (error) {
      // Two clicks at once: the other request made it (card_exports_live_per_design).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const other = await this.prisma.cardExport.findFirst({ where });
        if (other) return other;
      }
      throw error;
    }
  }

  async queue(exportId: string): Promise<void> {
    await this.queues.add('card-render', { exportId }, { jobId: `card-export-${exportId}` });
  }

  /** Progress of one of the card's images. One queued for long (the queue was briefly down) is queued again. */
  async status(token: string, exportId: string) {
    const session = await this.cards.session(token);
    const card = await this.prisma.cardExport.findFirst({ where: { id: exportId, sessionId: session.id } });
    if (!card) throw AppError.notFound('Card image');
    if (card.status === 'QUEUED' && card.updatedAt.getTime() < Date.now() - 90_000) {
      await this.prisma.cardExport.update({ where: { id: card.id }, data: { updatedAt: new Date() } });
      await this.queue(card.id).catch((err: unknown) => this.logger.warn({ err, exportId }, 'Could not queue a card again'));
    }
    return this.view(card);
  }

  /** A signed link that downloads the image. The first download of each image counts as the completed download. */
  async download(token: string, exportId: string) {
    const session = await this.cards.session(token);
    const card = await this.prisma.cardExport.findFirst({ where: { id: exportId, sessionId: session.id, kind: { in: ['FREE', 'PLAN'] } } });
    if (!card) throw AppError.notFound('Card image');
    return this.signedDownload(card, { sessionId: session.id, leadId: card.leadId, userId: card.userId, templateKey: session.templateKey });
  }

  /** Shared with paid orders: the link, the download counted, and the completed step recorded once. */
  async signedDownload(card: CardExport, refs: { sessionId?: string | null; leadId?: string | null; orderId?: string | null; userId?: string | null; templateKey: string }) {
    if (card.status !== 'READY' || !card.storageKey) throw new AppError('CARD_NOT_READY', 'Your card is not ready yet.');
    const fileName = cardFileName(card.templateKey, card.format);
    const url = await this.storage.presignDownload(card.storageKey, { expiresInSeconds: 600, downloadName: fileName });
    const now = new Date();
    const first = !card.firstDownloadedAt;
    await this.prisma.cardExport.update({ where: { id: card.id }, data: { downloads: { increment: 1 }, lastDownloadedAt: now, ...(first ? { firstDownloadedAt: now } : {}) } });
    if (first) {
      const type = card.kind === 'FREE' ? 'FREE_DOWNLOAD_COMPLETED' : card.kind === 'PLAN' ? 'PLAN_DOWNLOAD_COMPLETED' : 'PAID_DOWNLOAD_COMPLETED';
      await this.cards.event(type, { ...refs, meta: { format: card.format } });
    }
    return { url, fileName };
  }

  view(card: CardExport) {
    const pixels = cardPixelSize(card.format as CardFormat);
    return {
      id: card.id,
      kind: card.kind,
      status: card.status,
      width: card.width ?? pixels.width,
      height: card.height ?? pixels.height,
      readyAt: card.readyAt,
      error: card.status === 'FAILED' ? 'We could not make the image of your card.' : null,
    };
  }
}
