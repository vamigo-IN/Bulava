import { Inject, Injectable } from '@nestjs/common';
import { cardOrderToken, generateSecureToken, hashToken, verifyCardRenderToken } from '@bulava/auth';
import type { CardSession, Prisma } from '@bulava/database';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { CARD_FORMATS, CardDesignSchema, cardPixelSize, templateAssetIds, type CardDesign, type TemplateDefinition } from '@bulava/template-schema';
import { FEATURE_KEYS, type CardDesignBody, type CardEventInput, type CardEventType, type CardUploadInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { PaymentsService } from '../payments/payments.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { TemplatesService } from '../templates/templates.service';
import { checkDesign, designHash, freshDesignHash, type CardTemplate } from './card-designs';

/** References a funnel step may carry. */
export interface CardEventRefs {
  sessionId?: string | null;
  leadId?: string | null;
  orderId?: string | null;
  userId?: string | null;
  templateKey?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}

/** Photos a card may hold (replaced ones included): enough for any design, not a free photo host. */
const MAX_UPLOADS_PER_CARD = 40;
const UPLOAD_EXT: Record<CardUploadInput['contentType'], string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Digital cards (docs/cards.md): the public editor's saved cards, photos and
 * funnel. A card session is the anonymous designer's: the browser keeps its
 * token and the database only the token's hash. Downloads and orders live in
 * CardDownloadsService and CardOrdersService.
 */
@Injectable()
export class CardsService {
  /** Published versions as cards use them (a version never changes). */
  private readonly templates = new Map<string, CardTemplate>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: TemplatesService,
    private readonly settings: PlatformSettingsService,
    private readonly payments: PaymentsService,
    private readonly queues: QueueService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ─────────────────────────── Settings ───────────────────────────

  async options() {
    return (await this.settings.get('cards')).value;
  }

  /** The cards settings, or CARDS_UNAVAILABLE while the Super Admin has switched cards off. */
  async requireEnabled() {
    const options = await this.options();
    if (!options.enabled) throw new AppError('CARDS_UNAVAILABLE', 'Digital cards are not available right now.');
    return options;
  }

  /** The free card's mark: the site's name and address, exactly as the export shows it. */
  async watermarkText(): Promise<string> {
    const site = (await this.settings.get('site')).value;
    const host = new URL(this.config.WEB_ORIGIN).hostname.replace(/^www\./, '');
    return `Made with ${site.name} · ${host}`;
  }

  /**
   * What the editor needs before the download dialog: the price, whether
   * payments work, the watermark, and for a signed-in customer whether their
   * plan covers a watermark-free card (then nothing is asked of them).
   */
  async publicConfig(user: AuthUser | null) {
    const options = await this.options();
    const [watermark, paymentsReady, account] = await Promise.all([
      this.watermarkText(),
      this.payments.checkoutReady(),
      user ? this.account(user, options.planDownloads) : Promise.resolve(null),
    ]);
    return {
      enabled: options.enabled,
      priceMinor: options.priceMinor,
      currency: 'INR',
      paymentsReady,
      watermark,
      formats: Object.fromEntries(Object.entries(CARD_FORMATS).map(([key, f]) => [key, { width: f.width, height: f.height, pixels: cardPixelSize(key as keyof typeof CARD_FORMATS) }])),
      account,
    };
  }

  private async account(user: AuthUser, mode: 'any' | 'subscription' | 'off') {
    const [profile, coverage] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true, phoneVerifiedAt: true } }),
      this.planCoverage(user.id, mode),
    ]);
    if (!profile) return null;
    // Prefill only what the account has confirmed.
    return { name: profile.name, email: profile.email, phone: profile.phoneVerifiedAt ? profile.phone : null, planDownload: coverage.eligible, planName: coverage.planName };
  }

  /**
   * Whether a customer's plan covers watermark-free cards: a plan in force
   * that removes the watermark (branding.watermark off). `subscription` counts
   * account-wide (yearly) plans only; `any` also an event's plan while the
   * event exists; `off` none.
   */
  async planCoverage(userId: string, mode: 'any' | 'subscription' | 'off'): Promise<{ eligible: boolean; planName: string | null }> {
    if (mode === 'off') return { eligible: false, planName: null };
    const now = new Date();
    const grants = await this.prisma.entitlement.findMany({
      where: {
        userId,
        featureKey: FEATURE_KEYS.WATERMARK,
        enabled: false,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        ...(mode === 'subscription' ? { eventId: null } : {}),
      },
      select: { eventId: true, sourceType: true, sourceId: true },
    });
    const eventIds = grants.flatMap((g) => (g.eventId ? [g.eventId] : []));
    const liveEvents = eventIds.length ? new Set((await this.prisma.event.findMany({ where: { id: { in: eventIds }, deletedAt: null }, select: { id: true } })).map((e) => e.id)) : new Set<string>();
    const grant = grants.find((g) => !g.eventId) ?? grants.find((g) => g.eventId && liveEvents.has(g.eventId));
    if (!grant) return { eligible: false, planName: null };
    const order = grant.sourceType === 'ORDER' && grant.sourceId ? await this.prisma.order.findUnique({ where: { id: grant.sourceId }, select: { plan: { select: { name: true } } } }) : null;
    return { eligible: true, planName: order?.plan.name ?? null };
  }

  // ─────────────────────────── Templates ───────────────────────────

  async template(key: string): Promise<CardTemplate> {
    const summary = await this.catalog.getByKey(key.slice(0, 80));
    const cached = this.templates.get(summary.templateVersionId);
    if (cached) return cached;
    const definition = summary.definition as TemplateDefinition;
    const template: CardTemplate = {
      key: summary.key,
      versionId: summary.templateVersionId,
      name: summary.name,
      definition,
      tags: summary.tags,
      eventTypes: summary.eventTypes,
      assets: new Set(templateAssetIds(definition)),
    };
    if (this.templates.size >= 200) this.templates.delete(this.templates.keys().next().value!);
    this.templates.set(template.versionId, template);
    return template;
  }

  // ─────────────────────────── Sessions ───────────────────────────

  /** The session a token opens, or CARD_SESSION_EXPIRED (cleaned up, or never existed). */
  async session(token: string): Promise<CardSession> {
    const session = await this.prisma.cardSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session) throw new AppError('CARD_SESSION_EXPIRED', 'This card is no longer saved here. Start again from the template.');
    return session;
  }

  design(session: Pick<CardSession, 'design'>): CardDesign {
    return CardDesignSchema.parse(session.design);
  }

  /** A card is saved for the first time (its first change, a photo, or the download dialog). */
  async createSession(input: CardDesignBody, user: AuthUser | null) {
    await this.requireEnabled();
    const template = await this.template(String(input.design.templateKey ?? ''));
    const design = checkDesign(input.design, template);
    if (Object.keys(design.photos).length) throw new AppError('CUSTOMIZATION_INVALID', 'Photos are added once the card is saved.');
    const token = generateSecureToken();
    const hash = designHash(design);
    const customized = hash !== freshDesignHash(template, design);
    const session = await this.prisma.cardSession.create({
      data: {
        tokenHash: hashToken(token),
        templateKey: template.key,
        templateVersionId: template.versionId,
        eventType: design.eventType,
        format: design.format,
        design: design as unknown as Prisma.InputJsonValue,
        designHash: hash,
        userId: user?.id ?? null,
        customizedAt: customized ? new Date() : null,
      },
    });
    if (customized) await this.event('CARD_CUSTOMIZED', { sessionId: session.id, userId: user?.id, templateKey: template.key });
    return { token, ...this.sessionView(session) };
  }

  /** A saved card: its design, photos and orders (a refreshed editor picks up where it was). */
  async openSession(token: string) {
    const session = await this.session(token);
    const [uploads, orders] = await Promise.all([
      this.prisma.cardUpload.findMany({ where: { sessionId: session.id, status: { not: 'REJECTED' } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.cardOrder.findMany({ where: { sessionId: session.id, status: { in: ['PENDING', 'PAID'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    await this.prisma.cardSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return {
      ...this.sessionView(session),
      design: session.design,
      uploads: await Promise.all(uploads.map((u) => this.uploadView(u))),
      orders: orders.map((o) => ({
        reference: o.reference,
        status: o.status,
        designHash: o.designHash,
        orderToken: cardOrderToken(o.id, this.config.TOKEN_ENCRYPTION_KEY),
        paidAt: o.paidAt,
      })),
    };
  }

  private sessionView(session: CardSession) {
    return { templateKey: session.templateKey, designHash: session.designHash, customized: Boolean(session.customizedAt), updatedAt: session.updatedAt };
  }

  /** Autosave. The first change from the template marks the card as made (CARD_CUSTOMIZED). */
  async saveDesign(token: string, input: CardDesignBody, user: AuthUser | null) {
    const session = await this.session(token);
    const template = await this.template(session.templateKey);
    const design = checkDesign(input.design, template);
    await this.checkPhotos(session.id, design);
    const hash = designHash(design);
    const now = new Date();
    if (hash === session.designHash) {
      await this.prisma.cardSession.update({ where: { id: session.id }, data: { lastSeenAt: now, ...(user && !session.userId ? { userId: user.id } : {}) } });
      return { ...this.sessionView(session), designHash: hash };
    }
    const customized = !session.customizedAt && hash !== freshDesignHash(template, design);
    const updated = await this.prisma.cardSession.update({
      where: { id: session.id },
      data: {
        design: design as unknown as Prisma.InputJsonValue,
        designHash: hash,
        format: design.format,
        eventType: design.eventType,
        lastSeenAt: now,
        ...(customized ? { customizedAt: now } : {}),
        ...(user && !session.userId ? { userId: user.id } : {}),
      },
    });
    if (customized) await this.event('CARD_CUSTOMIZED', { sessionId: session.id, userId: user?.id ?? session.userId, templateKey: session.templateKey, meta: { format: design.format } });
    return this.sessionView(updated);
  }

  /** Every photo a design places must be one of this card's uploads. */
  private async checkPhotos(sessionId: string, design: CardDesign): Promise<void> {
    const ids = [...new Set(Object.values(design.photos))];
    if (!ids.length) return;
    const found = await this.prisma.cardUpload.count({ where: { id: { in: ids }, sessionId, status: { not: 'REJECTED' } } });
    if (found !== ids.length) throw new AppError('CUSTOMIZATION_INVALID', 'A photo in this card is no longer available. Add it again.');
  }

  // ─────────────────────────── Funnel ───────────────────────────

  async event(type: CardEventType, refs: CardEventRefs, tx?: Tx): Promise<void> {
    await (tx ?? this.prisma).cardEvent.create({
      data: {
        type,
        sessionId: refs.sessionId ?? null,
        leadId: refs.leadId ?? null,
        orderId: refs.orderId ?? null,
        userId: refs.userId ?? null,
        templateKey: refs.templateKey ?? null,
        meta: (refs.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /** Steps only the browser sees (a template picked, the editor or the download dialog opened, the paid option chosen). */
  async clientEvent(input: CardEventInput, user: AuthUser | null): Promise<{ ok: true }> {
    const session = input.session ? await this.prisma.cardSession.findUnique({ where: { tokenHash: hashToken(input.session) }, select: { id: true, templateKey: true, leadId: true, downloadOpenedAt: true } }) : null;
    if (input.type === 'DOWNLOAD_MODAL_OPENED' && session && !session.downloadOpenedAt) {
      await this.prisma.cardSession.update({ where: { id: session.id }, data: { downloadOpenedAt: new Date() } });
    }
    await this.event(input.type, { sessionId: session?.id, leadId: session?.leadId, userId: user?.id, templateKey: session?.templateKey ?? input.templateKey, meta: input.meta });
    return { ok: true };
  }

  // ─────────────────────────── Leads ───────────────────────────

  /**
   * The contact for a number: one row per number, updated on every download
   * or purchase. Offers on WhatsApp are recorded only when ticked; leaving the
   * box unticked later never withdraws an earlier yes (that is its own action).
   */
  async upsertLead(
    tx: Tx,
    phone: { e164: string; countryCode: string; national: string },
    input: { choice: 'FREE' | 'PAID'; marketingConsent: boolean; name?: string; email?: string; source: string },
  ) {
    const now = new Date();
    const lead = await tx.cardLead.upsert({
      where: { phoneE164: phone.e164 },
      create: { phoneE164: phone.e164, countryCode: phone.countryCode, nationalNumber: phone.national, lastChoice: input.choice, name: input.name ?? null, email: input.email ?? null },
      update: { lastSeenAt: now, lastChoice: input.choice, ...(input.name ? { name: input.name } : {}), ...(input.email ? { email: input.email } : {}) },
    });
    if (input.marketingConsent && (!lead.marketingConsentAt || lead.marketingWithdrawnAt)) {
      await tx.cardLead.update({ where: { id: lead.id }, data: { marketingConsentAt: now, marketingWithdrawnAt: null } });
      await tx.consent.create({ data: { cardLeadId: lead.id, kind: 'whatsapp_offers', granted: true, version: 'whatsapp_offers@1', source: input.source } });
    }
    return lead;
  }

  // ─────────────────────────── Photos ───────────────────────────

  /** A signed upload for one photo, straight to private storage (checked and re-encoded afterwards). */
  async createUpload(token: string, input: CardUploadInput) {
    const session = await this.session(token);
    const count = await this.prisma.cardUpload.count({ where: { sessionId: session.id } });
    if (count >= MAX_UPLOADS_PER_CARD) throw new AppError('UPLOAD_REJECTED', 'This card has had a lot of photos. Remove some and use the ones already added.');
    const upload = await this.prisma.cardUpload.create({ data: { sessionId: session.id, contentType: input.contentType, originalKey: 'pending' } });
    const key = StorageKeys.cardUploadOriginal(session.id, upload.id, UPLOAD_EXT[input.contentType]);
    await this.prisma.cardUpload.update({ where: { id: upload.id }, data: { originalKey: key } });
    return { uploadId: upload.id, uploadUrl: await this.storage.presignUpload(key, input.contentType, 900), headers: { 'Content-Type': input.contentType }, expiresInSeconds: 900 };
  }

  /** The browser finished its upload: check what arrived, then have the media worker clean it. */
  async completeUpload(token: string, uploadId: string) {
    const session = await this.session(token);
    const upload = await this.prisma.cardUpload.findFirst({ where: { id: uploadId, sessionId: session.id } });
    if (!upload) throw AppError.notFound('Photo');
    if (upload.status !== 'UPLOADING') return this.uploadView(upload);
    const head = await this.storage.head(upload.originalKey);
    if (!head) throw new AppError('UPLOAD_REJECTED', 'The photo was not received. Please try again.');
    if ((head.ContentLength ?? 0) > 15 * 1024 * 1024 || (head.ContentType && head.ContentType !== upload.contentType)) {
      await this.storage.delete(upload.originalKey).catch(() => undefined);
      await this.prisma.cardUpload.update({ where: { id: upload.id }, data: { status: 'REJECTED', error: 'Failed upload checks' } });
      throw new AppError('UPLOAD_REJECTED', 'This photo could not be used. Try a JPEG, PNG or WebP under 15 MB.');
    }
    const processing = await this.prisma.cardUpload.update({ where: { id: upload.id }, data: { status: 'PROCESSING', bytes: head.ContentLength ?? null } });
    await this.queues.add('media-processing', { cardUploadId: upload.id }, { jobId: `card-upload-${upload.id}` });
    return this.uploadView(processing);
  }

  async uploadStatus(token: string, uploadId: string) {
    const session = await this.session(token);
    const upload = await this.prisma.cardUpload.findFirst({ where: { id: uploadId, sessionId: session.id } });
    if (!upload) throw AppError.notFound('Photo');
    return this.uploadView(upload);
  }

  private async uploadView(u: { id: string; status: string; storageKey: string | null; width: number | null; height: number | null; error: string | null }) {
    return {
      id: u.id,
      status: u.status,
      width: u.width,
      height: u.height,
      error: u.status === 'REJECTED' ? (u.error ?? 'This photo could not be used.') : null,
      // A short-lived link for the editor; the card itself stores only the upload's id.
      url: u.status === 'READY' && u.storageKey ? await this.storage.presignDownload(u.storageKey, { expiresInSeconds: 7200, signingDate: hourStart() }) : null,
    };
  }

  // ─────────────────────────── Export renderer ───────────────────────────

  /**
   * What the export renderer draws (the web app's /cards/render page, opened
   * by the media worker with a short-lived token): the design, the watermark
   * for free cards, and signed links to its photos.
   */
  async renderData(token: string) {
    const exportId = verifyCardRenderToken(token, this.config.TOKEN_ENCRYPTION_KEY);
    if (!exportId) throw AppError.notFound('Card');
    const card = await this.prisma.cardExport.findUnique({ where: { id: exportId } });
    if (!card || card.status === 'EXPIRED') throw AppError.notFound('Card');
    const design = CardDesignSchema.parse(card.design);
    const ids = [...new Set(Object.values(design.photos))];
    const uploads = ids.length ? await this.prisma.cardUpload.findMany({ where: { id: { in: ids }, status: 'READY' }, select: { id: true, storageKey: true } }) : [];
    const urls = new Map(await Promise.all(uploads.flatMap((u) => (u.storageKey ? [this.storage.presignDownload(u.storageKey, { expiresInSeconds: 900 }).then((url) => [u.id, url] as const)] : []))));
    const photos = Object.fromEntries(Object.entries(design.photos).flatMap(([binding, id]) => (urls.has(id) ? [[binding, urls.get(id)!]] : [])));
    return { design, photos, watermark: card.kind === 'FREE' ? await this.watermarkText() : null, scale: CARD_FORMATS[design.format].scale };
  }
}

/** The start of the hour: links signed from it stay the same for an hour (and work for one more), so browsers reuse their copy. */
function hourStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}
