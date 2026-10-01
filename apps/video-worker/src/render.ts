import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeCancelSignal, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { PrismaClient } from '@bulava/database';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import {
  artworkAssetIds,
  buildRenderContext,
  validateTemplateDefinition,
  type Customization,
  type GalleryImage,
  type PhotoSlot,
  type RenderContext,
  type TemplateDefinition,
} from '@bulava/template-schema';

/** Must match COMPOSITION_ID / TemplateVideoProps in @bulava/video-engine (bundled separately by Remotion). */
const COMPOSITION_ID = 'TemplateVideo';
interface TemplateVideoProps extends Record<string, unknown> {
  definition: TemplateDefinition;
  context: RenderContext;
  customization: Customization | null;
  language: string;
  watermark: boolean;
  musicUrl: string | null;
}

export interface RenderDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  serveUrl: string;
  concurrency: number;
  log: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void; error: (o: object, msg: string) => void };
}

interface VideoJobInput {
  templateKey: string;
  output: 'VIDEO' | 'DIGITAL_CARD';
  customization: Customization | null;
  musicId: string | null;
  hd: boolean;
  watermark: boolean;
}

/**
 * Renders one VideoJob. The job input is a snapshot taken when the host
 * requested it; the template version is pinned by templateVersionId.
 * Shareable videos include only listed functions that are not restricted
 * to specific guest groups.
 */
export async function renderVideoJob(deps: RenderDeps, videoJobId: string, attempt: { made: number; max: number }): Promise<string> {
  const { prisma, storage, log } = deps;
  const claimed = await prisma.videoJob.updateMany({
    where: { id: videoJobId, status: { in: ['QUEUED', 'PROCESSING'] } },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 }, progress: 0 },
  });
  if (!claimed.count) return 'skipped';

  const job = await prisma.videoJob.findUniqueOrThrow({
    where: { id: videoJobId },
    include: { templateVersion: true, event: { include: { accessPolicy: true } } },
  });
  const input = job.input as unknown as VideoJobInput;
  const workdir = await mkdtemp(path.join(tmpdir(), 'bulava-render-'));
  try {
    const parsed = validateTemplateDefinition(job.templateVersion.definition);
    if (!parsed.ok) throw new Error(`Template version ${job.templateVersionId} is invalid`);
    const definition = parsed.definition;

    const functions = await prisma.eventFunction.findMany({
      where: {
        eventId: job.eventId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        visibility: 'LISTED',
        OR: [{ accessPolicyId: null }, { accessPolicy: { mode: { not: 'GROUP_RESTRICTED' } } }],
      },
      include: { venue: true },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
    const sign = (key: string) => storage.presignDownload(key, { expiresInSeconds: 3600 });
    const photoIds = input.customization?.photoIds ?? [];
    // Photos placed in named spots (the film's cover arch) come from the same event, approved images only.
    const slotEntries = Object.entries(input.customization?.photoSlots ?? {}).filter((e): e is [PhotoSlot, string] => typeof e[1] === 'string');
    const wanted = [...new Set([...photoIds, ...slotEntries.map(([, id]) => id)])];
    const photoItems = wanted.length
      ? await prisma.mediaItem.findMany({ where: { eventId: job.eventId, id: { in: wanted }, status: 'APPROVED', kind: 'image' } })
      : [];
    const image = async (p: (typeof photoItems)[number]): Promise<GalleryImage> => ({
      url: await sign(p.optimizedKey ?? p.originalKey),
      thumbUrl: await sign(p.thumbnailKey ?? p.originalKey),
      width: p.width,
      height: p.height,
    });
    const photos: GalleryImage[] = await Promise.all(
      photoIds
        .map((id) => photoItems.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(image),
    );
    const photoSlots: Partial<Record<PhotoSlot, GalleryImage>> = {};
    for (const [slot, id] of slotEntries) {
      const item = photoItems.find((p) => p.id === id);
      if (item) photoSlots[slot] = await image(item);
    }
    // Painted artwork: the largest web rendition, signed for this render. Only
    // approved art with a current commercial, on-demand licence is used.
    const artworkIds = artworkAssetIds(definition);
    const artwork = artworkIds.length
      ? await prisma.asset.findMany({
          where: {
            id: { in: artworkIds },
            status: 'APPROVED',
            license: { commercialUse: true, onDemandUse: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          },
          select: { id: true, storageKey: true, renditions: true },
        })
      : [];
    const assets: Record<string, string> = {};
    for (const a of artwork) {
      assets[a.id] = await sign(a.renditions.length ? StorageKeys.templateAssetRendition(a.id, Math.max(...a.renditions)) : a.storageKey);
    }
    if (artwork.length < artworkIds.length) log.warn({ videoJobId, missing: artworkIds.length - artwork.length }, 'Some painted layers are not approved or licensed; rendering without them');
    const music = input.musicId ? await prisma.music.findUnique({ where: { id: input.musicId } }) : null;
    const starts = functions.map((f) => f.startsAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());

    const context = buildRenderContext({
      event: {
        title: job.event.title,
        description: job.event.description,
        typeKey: job.event.typeKey,
        startDate: starts[0]?.toISOString() ?? null,
        endDate: starts[starts.length - 1]?.toISOString() ?? null,
        language: job.event.language,
        timezone: job.event.timezone,
      },
      details: (job.event.details ?? {}) as Record<string, unknown>,
      functions: functions.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        startsAt: f.startsAt?.toISOString() ?? null,
        endsAt: f.endsAt?.toISOString() ?? null,
        status: f.status,
        venue: f.venue ? { name: f.venue.name, address: f.venue.address, city: f.venue.city, mapUrl: f.venue.mapUrl } : null,
      })),
      photos,
      photoSlots,
      assets,
      custom: input.customization?.custom ?? {},
    });

    const inputProps: TemplateVideoProps = {
      definition,
      context,
      customization: input.customization,
      language: job.event.language,
      watermark: input.watermark,
      musicUrl: music && music.status === 'APPROVED' ? await sign(music.storageKey) : null,
    };
    const composition = await selectComposition({ serveUrl: deps.serveUrl, id: COMPOSITION_ID, inputProps });
    const scale = input.hd ? 1 : 0.5;

    // Cancellation: poll the job row while rendering.
    const { cancelSignal, cancel } = makeCancelSignal();
    let lastProgress = 0;
    const poll = setInterval(() => {
      void prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { status: true } }).then((r) => {
        if (r?.status === 'CANCELLED') cancel();
      });
    }, 3000);

    let outFile: string;
    let key: string;
    let contentType: string;
    try {
      if (input.output === 'DIGITAL_CARD') {
        outFile = path.join(workdir, 'card.png');
        key = StorageKeys.generatedVideo(job.eventId, job.id).replace(/\.mp4$/, '.png');
        contentType = 'image/png';
        await renderStill({ composition, serveUrl: deps.serveUrl, output: outFile, inputProps, scale, frame: 0 });
      } else {
        outFile = path.join(workdir, 'video.mp4');
        key = StorageKeys.generatedVideo(job.eventId, job.id);
        contentType = 'video/mp4';
        await renderMedia({
          composition,
          serveUrl: deps.serveUrl,
          codec: 'h264',
          audioCodec: 'aac',
          crf: 20,
          scale,
          outputLocation: outFile,
          inputProps,
          concurrency: deps.concurrency,
          cancelSignal,
          onProgress: ({ progress }) => {
            const pct = Math.floor(progress * 100);
            if (pct >= lastProgress + 5) {
              lastProgress = pct;
              void prisma.videoJob.updateMany({ where: { id: videoJobId, status: 'PROCESSING' }, data: { progress: Math.min(99, pct) } });
            }
          },
        });
      }
    } finally {
      clearInterval(poll);
    }

    const current = await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { status: true } });
    if (current?.status === 'CANCELLED') return 'cancelled';

    const buffer = await readFile(outFile);
    await storage.put(key, buffer, contentType);
    await prisma.$transaction(async (tx) => {
      await tx.generatedVideo.create({
        data: {
          videoJobId: job.id,
          storageKey: key,
          width: Math.round(composition.width * scale),
          height: Math.round(composition.height * scale),
          durationSeconds: input.output === 'DIGITAL_CARD' ? 0 : composition.durationInFrames / composition.fps,
          sizeBytes: BigInt(buffer.length),
          watermarked: input.watermark,
        },
      });
      await tx.videoJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', progress: 100, finishedAt: new Date(), error: null } });
      if (job.requestedById) {
        await tx.notification.create({
          data: { type: 'RENDER_COMPLETE', channel: 'IN_APP', eventId: job.eventId, userId: job.requestedById, status: 'DELIVERED', sentAt: new Date(), payload: { videoJobId: job.id } },
        });
      }
      await tx.analyticsEvent.create({ data: { name: 'video_generated', eventId: job.eventId, userId: job.requestedById, properties: { output: input.output, hd: input.hd } } });
    });
    log.info({ videoJobId, bytes: buffer.length, key }, 'Render completed');
    return 'completed';
  } catch (error) {
    const cancelled = (await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { status: true } }))?.status === 'CANCELLED';
    if (cancelled) return 'cancelled';
    const final = attempt.made + 1 >= attempt.max;
    await prisma.videoJob.update({
      where: { id: videoJobId },
      data: final ? { status: 'FAILED', error: String((error as Error).message ?? error).slice(0, 1000), finishedAt: new Date() } : { status: 'QUEUED' },
    });
    throw error;
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}
