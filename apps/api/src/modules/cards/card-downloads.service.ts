import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type CardExport, type CardSession } from '@bulava/database';
import { ObjectStorage } from '@bulava/storage';
import { cardPixelSize, type CardFormat } from '@bulava/template-schema';
import type { CardFileType, CardFreeDownloadInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { CARD_EXPORT_DAYS, cardFileName, cardPdfKey, cardPngKey } from './card-designs';
import { jpegPdf } from './card-pdf';
import { CardsService, LIVE_EXPORT, type CardAllowance } from './cards.service';

const DAY = 86_400_000;

/**
 * Downloads of a card (docs/cards.md#downloads): free ones with the watermark
 * after a mobile number, and watermark-free ones through the customer's plan,
 * as many designs as it includes. Each is rendered once per design; asking
 * again (a double click, a refresh, a retry) returns the same image. Paid
 * cards are in CardOrdersService. Every card saves as a PNG or a JPEG, and a
 * watermark-free one also as a one-page PDF (docs/cards.md#files).
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

  /**
   * The watermarked card: the number is saved as a contact (one per number),
   * then the image is made. For anyone while free downloads are on; otherwise
   * for a signed-in customer with a paid plan (ADR-062).
   */
  async free(token: string, input: CardFreeDownloadInput, user: AuthUser | null = null) {
    const options = await this.cards.requireEnabled();
    if (!options.freeDownloads && !(user && (await this.cards.hasPaidPlan(user.id)))) {
      throw new AppError('CARD_PLAN_REQUIRED', 'Downloading a card comes with a plan. Choose a plan, or buy this card on its own.');
    }
    const session = await this.cards.session(token);
    await this.cards.assertNotHeld(session.id);
    const lead = await this.prisma.$transaction(async (tx) => {
      const contact = await this.cards.upsertLead(tx, input.phone, { choice: 'FREE', marketingConsent: input.marketingConsent, source: `card-free:${session.id}` });
      await tx.cardSession.update({ where: { id: session.id }, data: { leadId: contact.id, lastSeenAt: new Date() } });
      const refs = { sessionId: session.id, leadId: contact.id, userId: session.userId, templateKey: session.templateKey };
      await this.cards.event('PHONE_SUBMITTED', { ...refs, meta: { option: 'FREE', offers: input.marketingConsent } }, tx);
      await this.cards.event('FREE_DOWNLOAD_REQUESTED', { ...refs, meta: { format: session.format } }, tx);
      return contact;
    });
    return this.view(await this.freeExport(session, lead.id));
  }

  /**
   * A watermark-free card through the customer's plan (ADR-071): nothing is
   * asked of them, and each design counts once against the cards the plan
   * includes. Asking again, or downloading the design again later, takes
   * nothing more. The count is taken under a lock per account, so two tabs
   * cannot both have the last card.
   */
  async plan(token: string, user: AuthUser) {
    const options = await this.cards.requireEnabled();
    if (!options.planDownloads) throw new AppError('CARD_PLAN_REQUIRED', 'Watermark-free cards are bought one by one at the moment.', { included: 0 });
    const session = await this.cards.session(token);
    await this.cards.assertNotHeld(session.id);
    const allowance = await this.cards.allowance(user.id);
    if (allowance.included === 0) throw new AppError('CARD_PLAN_REQUIRED', 'Your plan does not include watermark-free cards. Buy this card on its own, or unlock a plan that includes them.', { included: 0 });
    let result: { card: CardExport; created: boolean; used: number };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await this.cards.lockAllowance(tx, user.id);
        const counted = await this.cards.countedDesigns(user.id, tx);
        // This design's clean image is already made or on its way: the same one, nothing more counted.
        const live = await tx.cardExport.findFirst({ where: { sessionId: session.id, kind: 'PLAN', designHash: session.designHash, status: { in: [...LIVE_EXPORT] } } });
        if (live) return { card: live, created: false, used: counted.size };
        const again = counted.has(session.designHash);
        if (!again && allowance.included !== null && counted.size >= allowance.included) {
          throw new AppError('CARD_PLAN_REQUIRED', `The ${allowance.included} watermark-free cards with your plan are used. Buy this card on its own, or unlock a bigger plan.`, { included: allowance.included, used: counted.size });
        }
        const card = await tx.cardExport.create({ data: this.exportData(session, 'PLAN', { userId: user.id }) });
        return { card, created: true, used: counted.size + (again ? 0 : 1) };
      });
    } catch (error) {
      // Two clicks at once from two accounts on one card (card_exports_live_per_design): the other request made it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const other = await this.prisma.cardExport.findFirst({ where: { sessionId: session.id, kind: 'PLAN', designHash: session.designHash, status: { in: [...LIVE_EXPORT] } } });
        if (other) return { ...this.view(other), allowance };
      }
      throw error;
    }
    if (!session.userId) await this.prisma.cardSession.update({ where: { id: session.id }, data: { userId: user.id } });
    await this.cards.event('PLAN_DOWNLOAD_REQUESTED', { sessionId: session.id, userId: user.id, templateKey: session.templateKey, meta: { format: session.format } });
    if (result.created) await this.queue(result.card.id);
    const after: CardAllowance = { ...allowance, used: result.used, left: allowance.included === null ? null : Math.max(0, allowance.included - result.used) };
    return { ...this.view(result.card), allowance: after };
  }

  /** The watermarked image of the card's current design, or a new one queued for rendering. */
  private async freeExport(session: CardSession, leadId: string): Promise<CardExport> {
    const where = { sessionId: session.id, kind: 'FREE' as const, designHash: session.designHash, status: { in: [...LIVE_EXPORT] } };
    const live = await this.prisma.cardExport.findFirst({ where });
    if (live) return live;
    try {
      const created = await this.prisma.cardExport.create({ data: this.exportData(session, 'FREE', { leadId }) });
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

  private exportData(session: CardSession, kind: 'FREE' | 'PLAN', refs: { leadId?: string; userId?: string }): Prisma.CardExportUncheckedCreateInput {
    return {
      kind,
      sessionId: session.id,
      leadId: refs.leadId ?? null,
      userId: refs.userId ?? null,
      templateKey: session.templateKey,
      format: session.format,
      design: session.design as Prisma.InputJsonValue,
      designHash: session.designHash,
      expiresAt: new Date(Date.now() + CARD_EXPORT_DAYS[kind] * DAY),
    };
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

  /** A signed link that downloads the card as a PNG, a JPEG or (watermark-free) a PDF. The first download of each card counts as the completed download. */
  async download(token: string, exportId: string, as: CardFileType = 'jpeg') {
    const session = await this.cards.session(token);
    const card = await this.prisma.cardExport.findFirst({ where: { id: exportId, sessionId: session.id, kind: { in: ['FREE', 'PLAN'] } } });
    if (!card) throw AppError.notFound('Card image');
    return this.signedDownload(card, { sessionId: session.id, leadId: card.leadId, userId: card.userId, templateKey: session.templateKey }, as);
  }

  /** Shared with paid orders: the link, the download counted, and the completed step recorded once (whichever file it is). */
  async signedDownload(card: CardExport, refs: { sessionId?: string | null; leadId?: string | null; orderId?: string | null; userId?: string | null; templateKey: string }, as: CardFileType = 'jpeg') {
    if (card.status !== 'READY' || !card.storageKey) throw new AppError('CARD_NOT_READY', 'Your card is not ready yet.');
    // A PDF comes with a watermark-free card (through a plan, or bought on its own), never with the free one.
    if (as === 'pdf' && card.kind === 'FREE') {
      throw new AppError('CARD_PDF_LOCKED', 'A PDF comes with a watermark-free card: through a plan that includes cards, or bought on its own.');
    }
    const key = as === 'pdf' ? await this.pdf(card.storageKey) : as === 'png' ? await this.png(card, card.storageKey) : card.storageKey;
    const fileName = cardFileName(card.templateKey, card.format, as);
    const url = await this.storage.presignDownload(key, { expiresInSeconds: 600, downloadName: fileName });
    const now = new Date();
    const first = !card.firstDownloadedAt;
    await this.prisma.cardExport.update({ where: { id: card.id }, data: { downloads: { increment: 1 }, lastDownloadedAt: now, ...(first ? { firstDownloadedAt: now } : {}) } });
    if (first) {
      const type = card.kind === 'FREE' ? 'FREE_DOWNLOAD_COMPLETED' : card.kind === 'PLAN' ? 'PLAN_DOWNLOAD_COMPLETED' : 'PAID_DOWNLOAD_COMPLETED';
      await this.cards.event(type, { ...refs, meta: { format: card.format, file: as } });
    }
    return { url, fileName };
  }

  /**
   * The card's PNG, saved by the media worker beside its JPEG. A card made
   * before PNGs were saved is made again (the same design, so the same card,
   * at no charge) and the customer is asked to wait a moment.
   */
  private async png(card: CardExport, imageKey: string): Promise<string> {
    const key = cardPngKey(imageKey);
    if (await this.storage.head(key)) return key;
    await this.prisma.cardExport.update({ where: { id: card.id }, data: { status: 'QUEUED' } });
    await this.queue(card.id);
    throw new AppError('CARD_NOT_READY', 'Your card is being made as a PNG. Please wait a moment and try again.', { exportId: card.id });
  }

  /**
   * The card's PDF: its image on one page at the card's print size, made the
   * first time it is asked for and kept beside the image in private storage
   * (the worker deletes both when the image expires).
   */
  private async pdf(imageKey: string): Promise<string> {
    const key = cardPdfKey(imageKey);
    if (await this.storage.head(key)) return key;
    await this.storage.put(key, jpegPdf(await this.storage.getBuffer(imageKey)), 'application/pdf');
    return key;
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
