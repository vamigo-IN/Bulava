import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, TemplateType } from '@bulava/database';
import { ObjectStorage } from '@bulava/storage';
import { validateCustomization, validateTemplateDefinition } from '@bulava/template-schema';
import { FEATURE_KEYS, slugify, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export const CreateVideoSchema = z.object({
  templateKey: z.string().trim().min(1).max(80),
  customization: z.unknown().optional(),
  musicId: z.uuid().nullable().optional(),
});
export type CreateVideoInput = z.infer<typeof CreateVideoSchema>;

/** Input snapshot stored on the job: the worker renders exactly this. */
export interface VideoJobInput {
  templateKey: string;
  output: 'VIDEO' | 'DIGITAL_CARD';
  customization: unknown;
  musicId: string | null;
  hd: boolean;
  watermark: boolean;
}

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async create(access: EventAccessContext, input: CreateVideoInput, meta: RequestMeta) {
    const event = await this.prisma.event.findFirstOrThrow({ where: { id: access.eventId, deletedAt: null } });
    const template = await this.prisma.template.findUnique({ where: { key: input.templateKey }, include: { currentVersion: true } });
    const output = template?.outputs.find((o): o is 'VIDEO' | 'DIGITAL_CARD' => o === 'VIDEO' || o === 'DIGITAL_CARD');
    if (!template || template.status !== 'PUBLISHED' || !template.currentVersion || !output) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This video template is not available.');
    }
    if (template.eventTypes.length && !template.eventTypes.includes(event.typeKey)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not designed for this type of event.');
    }
    const parsed = validateTemplateDefinition(template.currentVersion.definition);
    if (!parsed.ok) throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This video template is not available.');
    const custom = validateCustomization(parsed.definition, { ...((input.customization as object) ?? {}), ...(input.musicId ? { musicId: input.musicId } : {}) });
    if (!custom.ok) throw new AppError('CUSTOMIZATION_INVALID', 'Some changes are not allowed for this template.', custom.issues);
    // Placed photos must be approved images of this event.
    const photoIds = new Set([...(custom.value.photoIds ?? []), ...Object.values(custom.value.photoSlots ?? {})]);
    if (photoIds.size) {
      const found = await this.prisma.mediaItem.count({ where: { eventId: event.id, id: { in: [...photoIds] }, status: 'APPROVED', kind: 'image', deletedAt: null } });
      if (found < photoIds.size) throw new AppError('CUSTOMIZATION_INVALID', 'Choose photos from this event.');
    }
    if (input.musicId) await this.assertLicensedMusic(input.musicId);

    const features = await this.entitlements.forEvent(event.id);
    EntitlementsService.assertTemplateTier(features, template.tier);
    const used = await this.prisma.videoJob.count({ where: { eventId: event.id, status: { in: ['QUEUED', 'PROCESSING', 'COMPLETED'] } } });
    EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.VIDEO_RENDERS_MAX, used);

    const jobInput: VideoJobInput = {
      templateKey: template.key,
      output,
      customization: custom.value,
      musicId: input.musicId ?? null,
      hd: EntitlementsService.enabled(features, FEATURE_KEYS.VIDEO_HD),
      watermark: EntitlementsService.enabled(features, FEATURE_KEYS.WATERMARK),
    };
    const job = await this.prisma.videoJob.create({
      data: {
        eventId: event.id,
        templateVersionId: template.currentVersion.id,
        status: 'QUEUED',
        input: jobInput as unknown as Prisma.InputJsonValue,
        requestedById: access.userId,
      },
    });
    await this.queues.add('video-render', { videoJobId: job.id }, { jobId: `video-${job.id}` });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'video.requested', targetType: 'VideoJob', targetId: job.id, eventId: event.id, metadata: { templateKey: template.key }, meta });
    this.analytics.track('video_generation_started', { eventId: event.id, userId: access.userId }, { templateKey: template.key, output });
    return this.toDto(job, template.name, null);
  }

  private async assertLicensedMusic(musicId: string) {
    const music = await this.prisma.music.findUnique({ where: { id: musicId }, include: { license: true } });
    const ok =
      music?.status === 'APPROVED' &&
      music.license.commercialUse &&
      music.license.onDemandUse &&
      (!music.license.expiresAt || music.license.expiresAt > new Date());
    if (!ok) throw new AppError('CUSTOMIZATION_INVALID', 'This music is not licensed for video invitations.');
  }

  async list(access: EventAccessContext) {
    const jobs = await this.prisma.videoJob.findMany({
      where: { eventId: access.eventId },
      include: { templateVersion: { include: { template: { select: { name: true } } } }, outputs: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return jobs.map((j) => this.toDto(j, j.templateVersion.template.name, j.outputs[0] ?? null));
  }

  private toDto(
    j: { id: string; status: string; progress: number; error: string | null; createdAt: Date; finishedAt: Date | null; input: Prisma.JsonValue },
    templateName: string,
    output: { width: number; height: number; durationSeconds: number; sizeBytes: bigint; watermarked: boolean } | null,
  ) {
    const input = j.input as unknown as VideoJobInput;
    return {
      id: j.id,
      status: j.status,
      progress: j.progress,
      error: j.status === 'FAILED' ? 'Rendering failed. Please try again.' : null,
      templateName,
      output: input.output,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
      result: output
        ? { width: output.width, height: output.height, durationSeconds: output.durationSeconds, sizeBytes: Number(output.sizeBytes), watermarked: output.watermarked }
        : null,
    };
  }

  async cancel(access: EventAccessContext, jobId: string, meta: RequestMeta) {
    const result = await this.prisma.videoJob.updateMany({
      where: { id: jobId, eventId: access.eventId, status: { in: ['QUEUED', 'PROCESSING'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
    if (!result.count) throw AppError.notFound('Render');
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'video.cancelled', targetType: 'VideoJob', targetId: jobId, eventId: access.eventId, meta });
    return { cancelled: true };
  }

  async download(access: EventAccessContext, jobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, eventId: access.eventId, status: 'COMPLETED' },
      include: { outputs: true, event: { select: { title: true } } },
    });
    const out = job?.outputs[0];
    if (!job || !out) throw AppError.notFound('Video');
    const ext = out.storageKey.split('.').pop() ?? 'mp4';
    this.analytics.track('video_downloaded', { eventId: access.eventId, userId: access.userId });
    return { url: await this.storage.presignDownload(out.storageKey, { expiresInSeconds: 900, downloadName: `${slugify(job.event.title) || 'invitation'}.${ext}` }) };
  }

  /** Licensed music customers may choose (commercial + on-demand use, not expired). */
  async licensedMusic() {
    const rows = await this.prisma.music.findMany({
      where: {
        status: 'APPROVED',
        license: { commercialUse: true, onDemandUse: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      },
      select: { id: true, title: true, artist: true, durationSeconds: true, collection: true, storageKey: true, license: { select: { attributionRequired: true, attributionText: true } } },
      orderBy: { title: 'asc' },
    });
    return Promise.all(
      rows.map(async ({ storageKey, ...m }) => ({ ...m, previewUrl: await this.storage.presignDownload(storageKey, { expiresInSeconds: 3600 }) })),
    );
  }

  static outputsFor(type: TemplateType) {
    return type === 'VIDEO' || type === 'DIGITAL_CARD';
  }
}
