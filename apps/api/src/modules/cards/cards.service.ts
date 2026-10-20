import { Inject, Injectable } from '@nestjs/common';
import { cardOrderToken, decryptSecret, encryptSecret, generateSecureToken, hashToken, verifyCardRenderToken } from '@bulava/auth';
import { featureLimit, loadEventFeatures, loadUserFeatures, type CardSession, type Prisma } from '@bulava/database';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { CARD_FORMATS, CardDesignSchema, CardDetailsSchema, cardFromTemplate, cardPixelSize, templateAssetIds, type CardDesign, type CardDetails, type TemplateDefinition } from '@bulava/template-schema';
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

/**
 * Watermark-free cards a customer's plan includes (ADR-071): the most any plan
 * in force for them allows, how many designs they have downloaded through a
 * plan, and what is left.
 */
export interface CardAllowance {
  /** 0: none (each card is bought on its own); null: unlimited. */
  included: number | null;
  /** Card designs downloaded (or being made) through a plan, each counted once. */
  used: number;
  /** null: unlimited. */
  left: number | null;
  /** The plan they come with, by its name; null when given another way (the team's grant). */
  planName: string | null;
}

/** Exports that exist or are on their way (a failed or expired one does not hold its design). */
export const LIVE_EXPORT = ['QUEUED', 'RENDERING', 'READY'] as const;

/** a is more than b (null: unlimited). */
const moreCards = (a: number | null, b: number | null) => (a === null ? b !== null : b !== null && a > b);

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
   * payments work, the watermark, the plan that unlocks (more) watermark-free
   * cards, and for a signed-in customer how many their plan includes and has
   * left (then nothing is asked of them).
   */
  async publicConfig(user: AuthUser | null) {
    const options = await this.options();
    const [watermark, paymentsReady, account, cheapest] = await Promise.all([
      this.watermarkText(),
      this.payments.checkoutReady(),
      user ? this.account(user, options.planDownloads) : Promise.resolve(null),
      this.prisma.pricingPlan.findFirst({ where: { active: true, kind: 'PLAN', visibility: 'PUBLIC', priceMinor: { gt: 0 } }, orderBy: { priceMinor: 'asc' }, select: { priceMinor: true } }),
    ]);
    const unlock = options.planDownloads ? await this.unlockOffer(account?.cards?.included ?? 0, user?.id ?? null) : null;
    return {
      enabled: options.enabled,
      priceMinor: options.priceMinor,
      currency: 'INR',
      paymentsReady,
      /** The watermarked card for a mobile number, for anyone (else for plan holders only). */
      freeDownloads: options.freeDownloads,
      planFromMinor: cheapest?.priceMinor ?? null,
      /** Plans include watermark-free cards (`cards.included`); off: every watermark-free card is bought on its own. */
      planCards: options.planDownloads,
      /** The plan that unlocks (more) watermark-free cards, at what it costs this visitor. */
      unlock,
      watermark,
      formats: Object.fromEntries(Object.entries(CARD_FORMATS).map(([key, f]) => [key, { width: f.width, height: f.height, pixels: cardPixelSize(key as keyof typeof CARD_FORMATS) }])),
      account,
    };
  }

  private async account(user: AuthUser, planCards: boolean) {
    const [profile, allowance, paidPlan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true, phoneVerifiedAt: true } }),
      planCards ? this.allowance(user.id) : Promise.resolve(null),
      this.hasPaidPlan(user.id),
    ]);
    if (!profile) return null;
    const cards = allowance && allowance.included !== 0 ? allowance : null;
    return {
      // Prefill only what the account has confirmed.
      name: profile.name,
      email: profile.email,
      phone: profile.phoneVerifiedAt ? profile.phone : null,
      paidPlan,
      /** Watermark-free cards with their plan (null: none). */
      cards,
      /** A watermark-free card can be downloaded through the plan now. */
      planDownload: Boolean(cards && (cards.left === null || cards.left > 0)),
      planName: cards?.planName ?? null,
    };
  }

  /**
   * The cheapest plan on sale that includes more watermark-free cards than the
   * customer has (any, for a visitor or a plan without them), at what it costs
   * them: a plan holder pays the difference from their account's plan (ADR-062).
   * Plans and their `cards.included` are rows, so the offer follows the console.
   */
  private async unlockOffer(included: number | null, userId: string | null) {
    if (included === null) return null;
    const plan = await this.prisma.pricingPlan.findFirst({
      where: {
        active: true,
        kind: 'PLAN',
        visibility: 'PUBLIC',
        interval: 'ONE_TIME',
        priceMinor: { gt: 0 },
        features: { some: { featureKey: FEATURE_KEYS.CARDS_INCLUDED, enabled: true, OR: [{ limit: null }, { limit: { gt: included } }] } },
      },
      orderBy: { priceMinor: 'asc' },
      select: { key: true, name: true, priceMinor: true, features: { where: { featureKey: FEATURE_KEYS.CARDS_INCLUDED }, select: { limit: true } } },
    });
    if (!plan) return null;
    const owned = userId ? (await this.payments.accountPlans(userId)).filter((p) => p.interval === 'ONE_TIME').map((p) => p.priceMinor) : [];
    const credit = Math.max(0, ...owned);
    // A plan the account already has, or a bigger one by price, is not sold again (PLAN_ALREADY_ACTIVE).
    if (plan.priceMinor <= credit) return null;
    return { key: plan.key, name: plan.name, cards: plan.features[0]?.limit ?? null, priceMinor: plan.priceMinor - credit, fullPriceMinor: plan.priceMinor };
  }

  /** Whether the customer has a paid plan in force (any: one with the watermark still downloads cards with it). */
  async hasPaidPlan(userId: string): Promise<boolean> {
    const now = new Date();
    const grant = await this.prisma.entitlement.findFirst({
      where: { userId, sourceType: 'ORDER', validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      select: { id: true },
    });
    return Boolean(grant);
  }

  /**
   * Watermark-free cards with a customer's plan (ADR-071): the most that any
   * plan in force for them includes (`cards.included`: their account's plan,
   * or one bought or given for an event of theirs, ADR-066, with add-ons), the
   * designs they have downloaded through a plan, and what is left.
   */
  async allowance(userId: string, tx?: Tx): Promise<CardAllowance> {
    const [plan, counted] = await Promise.all([this.includedCards(userId), this.countedDesigns(userId, tx)]);
    const used = counted.size;
    return { included: plan.included, used, left: plan.included === null ? null : Math.max(0, plan.included - used), planName: plan.planName };
  }

  /**
   * The designs a customer has had through a plan, each once: downloaded at
   * least once, or being made now (so two tabs cannot both take the last card).
   * Downloading one again, or making it again after it expired, is free.
   */
  async countedDesigns(userId: string, tx?: Tx): Promise<Set<string>> {
    const rows = await (tx ?? this.prisma).cardExport.findMany({
      where: { userId, kind: 'PLAN', OR: [{ firstDownloadedAt: { not: null } }, { status: { in: [...LIVE_EXPORT] } }] },
      select: { designHash: true },
      distinct: ['designHash'],
    });
    return new Set(rows.map((r) => r.designHash));
  }

  /**
   * The biggest `cards.included` among the plans in force for a customer, read
   * as every feature is (the Free plan's baseline, grants, add-ons on top), and
   * the name of the plan it comes with.
   */
  private async includedCards(userId: string): Promise<{ included: number | null; planName: string | null }> {
    const now = new Date();
    const inForce = { validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] };
    const key = FEATURE_KEYS.CARDS_INCLUDED;
    let best: { included: number | null; eventId: string | null } = { included: featureLimit(await loadUserFeatures(this.prisma, userId, now), key), eventId: null };
    // A plan bought or given for one of their events alone can be bigger than the account's.
    const events = await this.prisma.event.findMany({ where: { ownerId: userId, deletedAt: null }, select: { id: true } });
    if (events.length && best.included !== null) {
      const own = await this.prisma.entitlement.findMany({ where: { ...inForce, featureKey: key, eventId: { in: events.map((e) => e.id) } }, select: { eventId: true }, distinct: ['eventId'] });
      for (const { eventId } of own) {
        const features = eventId ? await loadEventFeatures(this.prisma, eventId, now) : null;
        const included = features ? featureLimit(features, key) : 0;
        if (moreCards(included, best.included)) best = { included, eventId };
      }
    }
    if (best.included === 0) return { included: 0, planName: null };
    // Named after the plan bringing the most cards (an add-on adds to it; the team's grants have no plan name).
    const grants = await this.prisma.entitlement.findMany({
      where: { AND: [inForce, { featureKey: key, sourceType: 'ORDER', enabled: true }, { OR: [{ userId, eventId: null }, ...(best.eventId ? [{ eventId: best.eventId }] : [])] }] },
      select: { limit: true, sourceId: true },
    });
    const top = grants.reduce<(typeof grants)[number] | null>((a, g) => (!a || moreCards(g.limit, a.limit) ? g : a), null);
    const order = top?.sourceId ? await this.prisma.order.findUnique({ where: { id: top.sourceId }, select: { plan: { select: { name: true } } } }) : null;
    return { included: best.included, planName: order?.plan.name ?? null };
  }

  /** Serialises a customer's plan downloads until the transaction ends, so the last card is taken once. */
  async lockAllowance(tx: Tx, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`card-allowance:${userId}`}::text, 0))`;
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
        // So the account it is saved in can open it on any device (ADR-077).
        tokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY),
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

  /**
   * A saved card: its design, photos and orders (a refreshed editor picks up
   * where it was), and for a signed-in customer whether this design was had
   * through their plan before (then downloading it again takes nothing more).
   */
  async openSession(token: string, user: AuthUser | null = null) {
    const session = await this.session(token);
    const [uploads, orders, counted] = await Promise.all([
      this.prisma.cardUpload.findMany({ where: { sessionId: session.id, status: { not: 'REJECTED' } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.cardOrder.findMany({ where: { sessionId: session.id, status: { in: ['PENDING', 'PAID'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      user
        ? this.prisma.cardExport.findFirst({
            where: { userId: user.id, kind: 'PLAN', designHash: session.designHash, OR: [{ firstDownloadedAt: { not: null } }, { status: { in: [...LIVE_EXPORT] } }] },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    await this.prisma.cardSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    const preview = await this.heldPreview(session.id);
    return {
      ...this.sessionView(session),
      design: session.design,
      // A preview a provider is making for a customer (ADR-076): designed here, never downloaded from here.
      preview,
      uploads: await Promise.all(uploads.map((u) => this.uploadView(u))),
      orders: orders.map((o) => ({
        reference: o.reference,
        status: o.status,
        designHash: o.designHash,
        orderToken: cardOrderToken(o.id, this.config.TOKEN_ENCRYPTION_KEY),
        paidAt: o.paidAt,
      })),
      planCounted: Boolean(counted),
    };
  }

  /** The preview request a card is being made for, while its customer does not own it yet (ADR-076). */
  async heldPreview(sessionId: string): Promise<{ requestId: string; reference: string } | null> {
    const item = await this.prisma.previewItem.findFirst({ where: { cardSessionId: sessionId, request: { status: { not: 'OWNED' } } }, select: { request: { select: { id: true, reference: true } } } });
    return item ? { requestId: item.request.id, reference: item.request.reference } : null;
  }

  /** Cards a provider makes for a customer are seen on the customer's preview page, never downloaded from the editor. */
  async assertNotHeld(sessionId: string): Promise<void> {
    if (await this.heldPreview(sessionId)) throw new AppError('PREVIEW_HELD', 'This card is a preview for a customer: they see it on their preview page.');
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

  /**
   * A stock image the server brought in for this card (ADR-064): stored like an
   * upload that arrived, then cleaned by the media worker; the editor waits for
   * it as for an upload.
   */
  async importUpload(token: string, image: { data: Buffer; contentType: CardUploadInput['contentType'] }) {
    const session = await this.session(token);
    const count = await this.prisma.cardUpload.count({ where: { sessionId: session.id } });
    if (count >= MAX_UPLOADS_PER_CARD) throw new AppError('UPLOAD_REJECTED', 'This card has had a lot of photos. Remove some and use the ones already added.');
    const upload = await this.prisma.cardUpload.create({ data: { sessionId: session.id, contentType: image.contentType, originalKey: 'pending' } });
    const key = StorageKeys.cardUploadOriginal(session.id, upload.id, UPLOAD_EXT[image.contentType]);
    await this.storage.put(key, image.data, image.contentType);
    const processing = await this.prisma.cardUpload.update({ where: { id: upload.id }, data: { originalKey: key, status: 'PROCESSING', bytes: image.data.length } });
    await this.queues.add('media-processing', { cardUploadId: upload.id }, { jobId: `card-upload-${upload.id}` });
    return this.uploadView(processing);
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

  /** Signed links to a design's photos (the uploads it places), for drawing it in a browser. */
  private async photoLinks(design: CardDesign, expiresInSeconds = 3600): Promise<Record<string, string>> {
    const ids = [...new Set(Object.values(design.photos))];
    if (!ids.length) return {};
    const uploads = await this.prisma.cardUpload.findMany({ where: { id: { in: ids }, status: 'READY' }, select: { id: true, storageKey: true } });
    const urls = new Map(await Promise.all(uploads.flatMap((u) => (u.storageKey ? [this.storage.presignDownload(u.storageKey, { expiresInSeconds, signingDate: hourStart() }).then((url) => [u.id, url] as const)] : []))));
    return Object.fromEntries(Object.entries(design.photos).flatMap(([binding, id]) => (urls.has(id) ? [[binding, urls.get(id)!]] : [])));
  }

  // ─────────────────────────── Previews (ADR-076) ───────────────────────────

  /**
   * A card a preview provider starts for a customer: the design's card in the
   * phone format, its details filled in from the request, saved for the
   * provider (who opens it in the card editor from the desk).
   */
  async createForPreview(templateKey: string, input: { eventType: string; language: string; userId: string; details: Partial<CardDetails> }): Promise<{ id: string; token: string }> {
    const template = await this.template(templateKey);
    const language = template.definition.languages.includes(input.language) ? input.language : (template.definition.languages[0] ?? 'en');
    const eventType = !template.eventTypes.length || template.eventTypes.includes(input.eventType) ? input.eventType : template.eventTypes[0]!;
    const blank = cardFromTemplate(template.definition, { format: 'phone', eventType, language, tags: template.tags });
    // Only what the customer told us replaces the sample: empty details keep the design's own words.
    const given = Object.fromEntries(Object.entries(input.details).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean(v))));
    const details = CardDetailsSchema.parse({ ...blank.details, ...given });
    const design = checkDesign({ ...blank, details }, template);
    const token = generateSecureToken();
    const session = await this.prisma.cardSession.create({
      data: {
        tokenHash: hashToken(token),
        tokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY),
        templateKey: template.key,
        templateVersionId: template.versionId,
        eventType: design.eventType,
        format: design.format,
        design: design as unknown as Prisma.InputJsonValue,
        designHash: designHash(design),
        userId: input.userId,
        customizedAt: new Date(),
      },
    });
    return { id: session.id, token };
  }

  /** A preview card as its customer sees it: the design with the watermark, and its photos. */
  async previewRenderData(sessionId: string) {
    const session = await this.prisma.cardSession.findUnique({ where: { id: sessionId } });
    if (!session) throw AppError.notFound('Card');
    const design = CardDesignSchema.parse(session.design);
    const template = await this.template(session.templateKey).catch(() => null);
    return { design, photos: await this.photoLinks(design), watermark: await this.watermarkText(), scale: CARD_FORMATS[design.format].scale, templateName: template?.name ?? session.templateKey };
  }

  // ─────────────────────────── The account's cards (ADR-077) ───────────────────────────

  /**
   * Cards saved in the account: those made or opened while signed in, cards
   * from the preview desk once owned, and cards bought while signed in. Drafts
   * nobody changed (a template opened) are left out.
   */
  async mine(userId: string) {
    const sessions = await this.prisma.cardSession.findMany({
      where: {
        userId,
        OR: [{ customizedAt: { not: null } }, { orders: { some: {} } }, { exports: { some: {} } }],
        // A provider's previews for customers live on the preview desk until their customer owns them (ADR-076).
        previewItems: { none: { request: { status: { not: 'OWNED' } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 48,
      include: {
        orders: { where: { status: 'PAID' }, orderBy: { paidAt: 'desc' }, select: { id: true, reference: true, paidAt: true, designHash: true } },
        exports: { select: { kind: true, status: true, downloads: true, firstDownloadedAt: true, designHash: true } },
        previewItems: { select: { request: { select: { reference: true, status: true } } }, take: 1 },
      },
    });
    const keys = [...new Set(sessions.map((s) => s.templateKey))];
    const templates = keys.length ? await this.prisma.template.findMany({ where: { key: { in: keys } }, select: { key: true, name: true } }) : [];
    const names = new Map(templates.map((t) => [t.key, t.name]));
    // Bought cards whose saved design was cleaned up long ago are still theirs, through their order.
    const orphans = await this.prisma.cardOrder.findMany({ where: { userId, status: 'PAID', sessionId: null }, orderBy: { paidAt: 'desc' }, take: 24, select: { id: true, reference: true, paidAt: true, templateKey: true, design: true } });
    const cards = await Promise.all(
      sessions.map(async (s) => {
        const design = CardDesignSchema.safeParse(s.design);
        const preview = s.previewItems[0]?.request;
        const downloads = s.exports.reduce((n, e) => n + e.downloads, 0);
        return {
          id: s.id,
          templateKey: s.templateKey,
          templateName: names.get(s.templateKey) ?? s.templateKey,
          format: s.format,
          eventType: s.eventType,
          design: design.success ? design.data : null,
          photos: design.success ? await this.photoLinks(design.data) : {},
          status: s.orders.length ? ('BOUGHT' as const) : downloads ? ('DOWNLOADED' as const) : ('DRAFT' as const),
          fromDesigner: preview ? { reference: preview.reference } : null,
          bought: s.orders.map((o) => ({ reference: o.reference, paidAt: o.paidAt, orderToken: cardOrderToken(o.id, this.config.TOKEN_ENCRYPTION_KEY), current: o.designHash === s.designHash })),
          downloads,
          planCards: s.exports.some((e) => e.kind === 'PLAN' && e.status !== 'FAILED'),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }),
    );
    return {
      cards,
      orders: orphans.map((o) => {
        const design = CardDesignSchema.safeParse(o.design);
        return { reference: o.reference, paidAt: o.paidAt, templateKey: o.templateKey, templateName: names.get(o.templateKey) ?? o.templateKey, design: design.success ? design.data : null, orderToken: cardOrderToken(o.id, this.config.TOKEN_ENCRYPTION_KEY) };
      }),
    };
  }

  private async ownSession(userId: string, id: string): Promise<CardSession> {
    const session = await this.prisma.cardSession.findFirst({ where: { id, userId } });
    if (!session) throw AppError.notFound('Card');
    return session;
  }

  /** One saved card's story: made, changed, downloaded, bought, emailed (the funnel's facts, newest first). */
  async history(userId: string, id: string) {
    const session = await this.ownSession(userId, id);
    const events = await this.prisma.cardEvent.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { type: true, createdAt: true, meta: true } });
    return { id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, events: events.filter((e) => ACCOUNT_HISTORY.has(e.type)).map((e) => ({ type: e.type, at: e.createdAt, meta: e.meta })) };
  }

  /**
   * Opening a saved card on any device: its token, for the editor. A card
   * saved before its token was kept gets a new one (the old one, on the device
   * it was made on, stops working; that editor saves its copy again).
   */
  async openMine(userId: string, id: string): Promise<{ token: string; templateKey: string }> {
    const session = await this.ownSession(userId, id);
    if (session.tokenCiphertext) {
      try {
        return { token: decryptSecret(session.tokenCiphertext, this.config.TOKEN_ENCRYPTION_KEY), templateKey: session.templateKey };
      } catch {
        /* a key rotated since: a new token below */
      }
    }
    const token = generateSecureToken();
    await this.prisma.cardSession.update({ where: { id: session.id }, data: { tokenHash: hashToken(token), tokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY), lastSeenAt: new Date() } });
    return { token, templateKey: session.templateKey };
  }

  /** A saved card the customer does not want: drafts go; a bought card stays (its order is their receipt). */
  async removeMine(userId: string, id: string): Promise<{ ok: true }> {
    const session = await this.ownSession(userId, id);
    const paid = await this.prisma.cardOrder.count({ where: { sessionId: session.id, status: 'PAID' } });
    if (paid) throw new AppError('BAD_REQUEST', 'A card you bought stays in your account.');
    if (await this.heldPreview(session.id)) throw new AppError('PREVIEW_HELD', 'This card is a preview for a customer.');
    await this.prisma.cardSession.delete({ where: { id: session.id } });
    return { ok: true };
  }
}

/** What a saved card's history shows the customer (not the browser-only funnel steps). */
const ACCOUNT_HISTORY: ReadonlySet<string> = new Set([
  'CARD_CUSTOMIZED',
  'FREE_DOWNLOAD_COMPLETED',
  'PLAN_DOWNLOAD_COMPLETED',
  'PAID_DOWNLOAD_COMPLETED',
  'PAYMENT_SUCCEEDED',
  'EMAIL_SENT',
  'FREE_CARD_GENERATED',
  'PLAN_CARD_GENERATED',
  'PAID_CARD_GENERATED',
]);

/** The start of the hour: links signed from it stay the same for an hour (and work for one more), so browsers reuse their copy. */
function hourStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}
