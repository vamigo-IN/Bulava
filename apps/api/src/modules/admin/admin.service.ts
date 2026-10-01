import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@bulava/database';
import { ALLOWED_UPLOAD_TYPES, ObjectStorage, StorageKeys } from '@bulava/storage';
import { z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { TemplatesService } from '../templates/templates.service';

export const LicenseSchema = z.object({
  licenseType: z.string().trim().min(1).max(60),
  provider: z.string().trim().min(1).max(120),
  source: z.string().trim().max(500).optional(),
  purchaseReference: z.string().trim().max(200).optional(),
  licenseDocumentKey: z.string().max(300).optional(),
  commercialUse: z.boolean(),
  onDemandUse: z.boolean(),
  socialMediaUse: z.boolean().default(false),
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().max(300).optional(),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const UploadUrlSchema = z.object({ contentType: z.string().max(100), fileName: z.string().max(200) });
export const CreateAssetSchema = z.object({
  storageKey: z.string().regex(/^(templates\/assets|music)\/[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(1).max(120),
  type: z.enum(['IMAGE', 'VIDEO', 'SVG', 'AUDIO', 'FONT', 'LOTTIE']),
  category: z.string().trim().min(1).max(60),
  tags: z.array(z.string().max(40)).max(20).default([]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  license: LicenseSchema,
});
export const CreateMusicSchema = z.object({
  storageKey: z.string().regex(/^music\/[A-Za-z0-9._-]+$/),
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().max(120).optional(),
  durationSeconds: z.number().int().min(1).max(1200),
  collection: z.enum(['ORIGINAL', 'LICENSED']).default('LICENSED'),
  license: LicenseSchema,
});
export const ReviewSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'ARCHIVED']) });
export const AssetUrlsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });
export const UpdatePlanSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  priceMinor: z.number().int().min(0).max(100_000_000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export const PlanFeatureSchema = z.object({ enabled: z.boolean(), limit: z.number().int().min(0).nullable() });
export const CouponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffMinor: z.number().int().min(1).nullable().optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  validFrom: z.iso.datetime({ offset: true }).nullable().optional(),
  validUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  active: z.boolean().default(true),
});
export const TestimonialSchema = z.object({
  quote: z.string().trim().min(10).max(600),
  authorName: z.string().trim().min(1).max(80),
  location: z.string().trim().max(80).optional(),
  eventLabel: z.string().trim().max(80).optional(),
  rating: z.number().int().min(1).max(5).default(5),
  /** When the customer agreed to be quoted. Required: only real, consented reviews. */
  consentAt: z.iso.datetime({ offset: true }),
  published: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly audit: AuditService,
    private readonly catalog: TemplatesService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  // ───────── Dashboard (spec §79) ─────────
  async stats() {
    const [users, activeEvents, events, invitations, rsvps, videos, renderFailures, uploads, storage, revenue, orders, paidEvents, popularTemplates, languages, queues] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.event.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        this.prisma.event.count({ where: { deletedAt: null } }),
        this.prisma.invitation.count({ where: { status: { not: 'REVOKED' } } }),
        this.prisma.rSVP.count({ where: { status: { not: 'PENDING' } } }),
        this.prisma.videoJob.count({ where: { status: 'COMPLETED' } }),
        this.prisma.videoJob.count({ where: { status: 'FAILED' } }),
        this.prisma.mediaItem.count({ where: { status: { notIn: ['UPLOADING', 'DELETED'] } } }),
        this.prisma.mediaItem.aggregate({ where: { status: { not: 'DELETED' } }, _sum: { sizeBytes: true } }),
        this.prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amountMinor: true } }),
        this.prisma.order.count({ where: { status: 'PAID' } }),
        this.prisma.order.findMany({ where: { status: 'PAID', eventId: { not: null } }, select: { eventId: true }, distinct: ['eventId'] }),
        this.prisma.eventTemplateSelection.groupBy({ by: ['templateVersionId'], _count: { _all: true } }),
        this.prisma.event.groupBy({ by: ['language'], where: { deletedAt: null }, _count: { _all: true }, orderBy: { _count: { language: 'desc' } } }),
        this.queues.counts().catch(() => ({})),
      ]);
    const versions = await this.prisma.templateVersion.findMany({
      where: { id: { in: popularTemplates.map((p) => p.templateVersionId) } },
      select: { id: true, template: { select: { name: true, key: true } } },
    });
    // Selections are per version; a template republished by the catalog has several, so count per template.
    const byVersion = new Map(versions.map((v) => [v.id, v.template]));
    const byTemplate = new Map<string, { name: string; key: string; count: number }>();
    for (const p of popularTemplates) {
      const template = byVersion.get(p.templateVersionId);
      if (!template) continue;
      const row = byTemplate.get(template.key) ?? { ...template, count: 0 };
      row.count += p._count._all;
      byTemplate.set(template.key, row);
    }
    const topTemplates = [...byTemplate.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    return {
      users,
      events,
      activeEvents,
      invitations,
      rsvps,
      videosGenerated: videos,
      renderFailures,
      mediaUploads: uploads,
      storageBytes: Number(storage._sum.sizeBytes ?? 0),
      revenueMinor: revenue._sum.amountMinor ?? 0,
      orders,
      conversion: events ? paidEvents.length / events : 0,
      popularTemplates: topTemplates,
      popularLanguages: languages.map((l) => ({ language: l.language, count: l._count._all })),
      queues,
    };
  }

  // ───────── Users ─────────
  // ───────── Assets & music (licensing, spec §31–33, §82) ─────────
  async assetUploadUrl(kind: 'asset' | 'music', contentType: string) {
    const type = ALLOWED_UPLOAD_TYPES[contentType];
    if (!type) throw new AppError('UPLOAD_REJECTED', 'Unsupported file type.');
    if (kind === 'music' && type.kind !== 'audio') throw new AppError('UPLOAD_REJECTED', 'Music must be an MP3 or M4A file.');
    const id = randomUUID();
    const key = kind === 'music' ? StorageKeys.music(id, type.ext) : StorageKeys.templateAsset(id, type.ext);
    return { storageKey: key, uploadUrl: await this.storage.presignUpload(key, contentType, 900), headers: { 'Content-Type': contentType } };
  }

  /**
   * The stored object is the source of truth: a presigned PUT cannot cap the
   * size, so read it back and derive the type from the server-chosen key.
   */
  private async verifyStoredUpload(storageKey: string, expectedKind?: 'audio') {
    const head = await this.storage.head(storageKey);
    if (!head) throw new AppError('UPLOAD_REJECTED', 'Upload the file first.');
    const ext = storageKey.split('.').pop();
    const entry = Object.entries(ALLOWED_UPLOAD_TYPES).find(([, t]) => t.ext === ext);
    const size = Number(head.ContentLength ?? 0);
    if (!entry || (expectedKind && entry[1].kind !== expectedKind)) throw new AppError('UPLOAD_REJECTED', 'Unsupported file type.');
    if (!size || size > entry[1].maxBytes) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw new AppError('UPLOAD_REJECTED', 'The file is empty or too large.');
    }
    return { mimeType: entry[0], sizeBytes: size };
  }

  async createAsset(adminId: string, input: z.infer<typeof CreateAssetSchema>, meta: RequestMeta) {
    const stored = await this.verifyStoredUpload(input.storageKey);
    const asset = await this.prisma.$transaction(async (tx) => {
      const license = await tx.assetLicense.create({ data: { ...input.license, expiresAt: input.license.expiresAt ? new Date(input.license.expiresAt) : null } });
      return tx.asset.create({
        data: {
          name: input.name,
          type: input.type,
          category: input.category,
          tags: input.tags,
          storageKey: input.storageKey,
          mimeType: stored.mimeType,
          sizeBytes: BigInt(stored.sizeBytes),
          width: input.width ?? null,
          height: input.height ?? null,
          licenseId: license.id,
          status: 'PENDING_REVIEW',
        },
      });
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'asset.created', targetType: 'Asset', targetId: asset.id, meta });
    // Images (painted artwork layers) get web-sized WebP renditions from the media worker.
    if (asset.type === 'IMAGE') await this.queues.add('media-processing', { assetId: asset.id }, { jobId: `asset-${asset.id}-${Date.now()}` });
    return { ...asset, sizeBytes: Number(asset.sizeBytes) };
  }

  /** Re-make an image asset's renditions (assets registered before renditions existed, or after a failure). */
  async reprocessAsset(adminId: string, id: string, meta: RequestMeta) {
    const asset = await this.prisma.asset.findUnique({ where: { id }, select: { id: true, type: true } });
    if (!asset) throw AppError.notFound('Asset');
    if (asset.type !== 'IMAGE') throw new AppError('VALIDATION_FAILED', 'Only images have web renditions.');
    await this.queues.add('media-processing', { assetId: asset.id }, { jobId: `asset-${asset.id}-${Date.now()}` });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'asset.reprocess', targetType: 'Asset', targetId: id, meta });
    return { queued: true };
  }

  /**
   * Signed URLs for design assets in any state, so Template Studio can preview
   * artwork that is not approved or published yet (staff only). The largest
   * rendition when there is one, else the original.
   */
  async assetUrls(ids: string[]) {
    const assets = await this.prisma.asset.findMany({ where: { id: { in: ids } }, select: { id: true, storageKey: true, renditions: true } });
    const entries = await Promise.all(
      assets.map(async (a) => {
        const best = a.renditions.length ? StorageKeys.templateAssetRendition(a.id, Math.max(...a.renditions)) : a.storageKey;
        return [a.id, await this.storage.presignDownload(best, { expiresInSeconds: 3600 })] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async assets(filter: { category?: string; status?: string }) {
    const rows = await this.prisma.asset.findMany({
      where: { ...(filter.category ? { category: filter.category } : {}), ...(filter.status ? { status: filter.status as never } : {}) },
      include: { license: true, _count: { select: { templates: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(
      rows.map(async (a) => ({
        ...a,
        sizeBytes: Number(a.sizeBytes),
        previewUrl: await this.storage.presignDownload(a.thumbnailKey ?? a.storageKey, { expiresInSeconds: 3600 }),
        usage: a._count.templates,
      })),
    );
  }

  async reviewAsset(adminId: string, id: string, status: 'APPROVED' | 'REJECTED' | 'ARCHIVED', meta: RequestMeta) {
    const asset = await this.prisma.asset.findUnique({ where: { id }, include: { license: true } });
    if (!asset) throw AppError.notFound('Asset');
    if (status === 'APPROVED' && (!asset.license || !asset.license.commercialUse)) {
      throw new AppError('VALIDATION_FAILED', 'Assets need license metadata allowing commercial use before approval.');
    }
    if (status === 'APPROVED' && asset.license?.expiresAt && asset.license.expiresAt <= new Date()) {
      throw new AppError('VALIDATION_FAILED', 'The license has expired.');
    }
    await this.prisma.asset.update({ where: { id }, data: { status } });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: `asset.${status.toLowerCase()}`, targetType: 'Asset', targetId: id, meta });
    return { status };
  }

  async createMusic(adminId: string, input: z.infer<typeof CreateMusicSchema>, meta: RequestMeta) {
    await this.verifyStoredUpload(input.storageKey, 'audio');
    const music = await this.prisma.$transaction(async (tx) => {
      const license = await tx.assetLicense.create({ data: { ...input.license, expiresAt: input.license.expiresAt ? new Date(input.license.expiresAt) : null } });
      return tx.music.create({
        data: { title: input.title, artist: input.artist ?? null, durationSeconds: input.durationSeconds, storageKey: input.storageKey, collection: input.collection, licenseId: license.id, status: 'PENDING_REVIEW' },
      });
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'music.created', targetType: 'Music', targetId: music.id, meta });
    return music;
  }

  async music() {
    const rows = await this.prisma.music.findMany({ include: { license: true }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map(async (m) => ({ ...m, previewUrl: await this.storage.presignDownload(m.storageKey, { expiresInSeconds: 3600 }) })));
  }

  async reviewMusic(adminId: string, id: string, status: 'APPROVED' | 'REJECTED' | 'ARCHIVED', meta: RequestMeta) {
    const music = await this.prisma.music.findUnique({ where: { id }, include: { license: true } });
    if (!music) throw AppError.notFound('Music');
    if (status === 'APPROVED' && !(music.license.commercialUse && music.license.onDemandUse)) {
      throw new AppError('VALIDATION_FAILED', 'Music must be licensed for commercial, on-demand use (spec §33).');
    }
    if (status === 'APPROVED' && music.license.expiresAt && music.license.expiresAt <= new Date()) {
      throw new AppError('VALIDATION_FAILED', 'The license has expired.');
    }
    await this.prisma.music.update({ where: { id }, data: { status } });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: `music.${status.toLowerCase()}`, targetType: 'Music', targetId: id, meta });
    return { status };
  }

  /**
   * Correct a licence record. Approval depends on the licence, so anything it
   * no longer covers goes back to review instead of staying approved.
   */
  async updateLicense(adminId: string, id: string, input: z.infer<typeof LicenseSchema>, meta: RequestMeta) {
    const existing = await this.prisma.assetLicense.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('License');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const expired = !!expiresAt && expiresAt <= new Date();
    const license = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.assetLicense.update({
        where: { id },
        data: {
          ...input,
          source: input.source ?? null,
          purchaseReference: input.purchaseReference ?? null,
          licenseDocumentKey: input.licenseDocumentKey ?? existing.licenseDocumentKey,
          attributionText: input.attributionText ?? null,
          expiresAt,
        },
      });
      if (!input.commercialUse || expired) {
        await tx.asset.updateMany({ where: { licenseId: id, status: 'APPROVED' }, data: { status: 'PENDING_REVIEW' } });
      }
      if (!(input.commercialUse && input.onDemandUse) || expired) {
        await tx.music.updateMany({ where: { licenseId: id, status: 'APPROVED' }, data: { status: 'PENDING_REVIEW' } });
      }
      return updated;
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'license.updated', targetType: 'AssetLicense', targetId: id, metadata: input as Prisma.InputJsonValue, meta });
    return license;
  }

  /** Assets/music whose license expires within `days` (or already expired), with affected templates. */
  async licenseAlerts(days = 30) {
    const horizon = new Date(Date.now() + days * 86_400_000);
    const licenses = await this.prisma.assetLicense.findMany({
      where: { expiresAt: { not: null, lte: horizon } },
      include: {
        assets: { include: { templates: { include: { templateVersion: { include: { template: { select: { id: true, key: true, name: true, status: true } } } } } } } },
        music: { select: { id: true, title: true } },
      },
    });
    return licenses.map((l) => ({
      licenseId: l.id,
      provider: l.provider,
      expiresAt: l.expiresAt,
      expired: (l.expiresAt as Date) <= new Date(),
      assets: l.assets.map((a) => ({ id: a.id, name: a.name, templates: a.templates.map((t) => t.templateVersion.template) })),
      music: l.music,
    }));
  }

  // ───────── Pricing (spec §57: editable without deployment) ─────────
  plans() {
    return this.prisma.pricingPlan.findMany({ include: { features: true }, orderBy: { sortOrder: 'asc' } });
  }

  async updatePlan(adminId: string, key: string, input: z.infer<typeof UpdatePlanSchema>, meta: RequestMeta) {
    const plan = await this.prisma.pricingPlan.update({ where: { key }, data: input });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'admin.pricing_changed', targetType: 'PricingPlan', targetId: plan.id, metadata: input as Prisma.InputJsonValue, meta });
    return plan;
  }

  async setPlanFeature(adminId: string, key: string, featureKey: string, input: z.infer<typeof PlanFeatureSchema>, meta: RequestMeta) {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key } });
    if (!plan) throw AppError.notFound('Plan');
    const feature = await this.prisma.planFeature.upsert({
      where: { planId_featureKey: { planId: plan.id, featureKey } },
      create: { planId: plan.id, featureKey, ...input },
      update: input,
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'admin.plan_feature_changed', targetType: 'PricingPlan', targetId: plan.id, metadata: { featureKey, ...input }, meta });
    return feature;
  }

  coupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async upsertCoupon(adminId: string, input: z.infer<typeof CouponSchema>, meta: RequestMeta) {
    if (!input.percentOff && !input.amountOffMinor) throw new AppError('VALIDATION_FAILED', 'Set a percentage or an amount off.');
    const data = {
      percentOff: input.percentOff ?? null,
      amountOffMinor: input.amountOffMinor ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      active: input.active,
    };
    const coupon = await this.prisma.coupon.upsert({ where: { code: input.code }, create: { code: input.code, ...data }, update: data });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'admin.coupon_saved', targetType: 'Coupon', targetId: coupon.id, meta });
    return coupon;
  }

  // ───────── Testimonials (real, consented only) ─────────
  testimonials() {
    return this.prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async saveTestimonial(adminId: string, id: string | null, input: z.infer<typeof TestimonialSchema>, meta: RequestMeta) {
    const data = { ...input, consentAt: new Date(input.consentAt) };
    const row = id ? await this.prisma.testimonial.update({ where: { id }, data }) : await this.prisma.testimonial.create({ data });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'admin.testimonial_saved', targetType: 'Testimonial', targetId: row.id, meta });
    return row;
  }

  async deleteTestimonial(id: string) {
    await this.prisma.testimonial.delete({ where: { id } });
  }

  // ───────── Operations ─────────
  auditLog(filter: { eventId?: string; action?: string }) {
    return this.prisma.auditLog.findMany({
      where: { ...(filter.eventId ? { eventId: filter.eventId } : {}), ...(filter.action ? { action: { startsWith: filter.action } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  queuesOverview() {
    return this.queues.counts();
  }

  /** Platform-wide moderation queue (spec §81). */
  async moderationQueue() {
    const items = await this.prisma.mediaItem.findMany({
      where: { status: 'PENDING_MODERATION' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { room: { select: { name: true, event: { select: { title: true } } } } },
    });
    return Promise.all(
      items.map(async (i) => ({
        id: i.id,
        eventTitle: i.room.event.title,
        roomName: i.room.name,
        uploaderName: i.uploaderName,
        createdAt: i.createdAt,
        thumbUrl: i.thumbnailKey ? await this.storage.presignDownload(i.thumbnailKey, { expiresInSeconds: 900 }) : null,
      })),
    );
  }

  async moderate(adminId: string, itemId: string, decision: 'APPROVE' | 'REJECT', meta: RequestMeta) {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: itemId } });
    if (!item || item.status !== 'PENDING_MODERATION') throw AppError.notFound('Photo');
    await this.prisma.mediaItem.update({ where: { id: itemId }, data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' } });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: `admin.media_${decision.toLowerCase()}d`, targetType: 'MediaItem', targetId: itemId, eventId: item.eventId, meta });
    return { ok: true };
  }

  failedRenders() {
    return this.prisma.videoJob.findMany({
      where: { status: 'FAILED' },
      select: { id: true, eventId: true, error: true, attempts: true, createdAt: true, templateVersion: { select: { template: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async retryRender(adminId: string, jobId: string, meta: RequestMeta) {
    const job = await this.prisma.videoJob.updateMany({ where: { id: jobId, status: 'FAILED' }, data: { status: 'QUEUED', error: null, progress: 0 } });
    if (!job.count) throw AppError.notFound('Render');
    await this.queues.add('video-render', { videoJobId: jobId }, { jobId: `video-${jobId}-retry-${Date.now()}` });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'admin.render_retried', targetType: 'VideoJob', targetId: jobId, meta });
    return { queued: true };
  }

  invalidateCatalog() {
    return this.catalog.invalidate();
  }
}
