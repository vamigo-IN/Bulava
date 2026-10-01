import sharp, { type Metadata } from 'sharp';
import type { PrismaClient } from '@bulava/database';
import { ObjectStorage, StorageKeys } from '@bulava/storage';

export interface MediaDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  log: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
}

const MAX_PIXELS = 100_000_000; // decompression-bomb guard
const OPTIMIZED_MAX = 2048;
const THUMB_MAX = 480;

function looksLikeVideo(buf: Buffer): boolean {
  // ISO base media (mp4/mov): "ftyp" at offset 4.
  return buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp';
}

/**
 * Media pipeline for one uploaded item (spec §41):
 *  validate → auto-rotate → strip EXIF (including GPS) → optimized WebP → thumbnail → moderation routing.
 * Images are fully decoded and re-encoded, which also neutralizes polyglot
 * files. Idempotent: re-running on a processed item is a no-op.
 */
export async function processMediaItem(deps: MediaDeps, mediaItemId: string): Promise<'APPROVED' | 'PENDING_MODERATION' | 'REJECTED' | 'SKIPPED'> {
  const { prisma, storage, log } = deps;
  const item = await prisma.mediaItem.findUnique({ where: { id: mediaItemId }, include: { room: { select: { moderationMode: true } } } });
  if (!item || item.status !== 'PROCESSING') return 'SKIPPED';
  // The event team's own uploads (photographers, design photos) need no approval; guests' follow the album's mode.
  const nextStatus = item.uploaderUserId || item.room.moderationMode === 'AUTO_APPROVE' ? 'APPROVED' : 'PENDING_MODERATION';

  const reject = async (reason: string) => {
    log.warn({ mediaItemId, reason }, 'Media rejected');
    await storage.delete(item.originalKey).catch(() => undefined);
    await prisma.mediaItem.update({ where: { id: item.id }, data: { status: 'REJECTED', moderationNotes: reason } });
    return 'REJECTED' as const;
  };

  const original = await storage.getBuffer(item.originalKey);

  if (item.kind === 'video') {
    if (!looksLikeVideo(original)) return reject('Not a valid MP4/MOV video');
    await prisma.mediaItem.update({ where: { id: item.id }, data: { status: nextStatus } });
    log.info({ mediaItemId, status: nextStatus }, 'Video accepted');
    return nextStatus;
  }

  let meta: Metadata;
  try {
    meta = await sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch {
    return reject('Unreadable or unsupported image');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return reject(`Unsupported image format: ${meta.format ?? 'unknown'}`);

  const base = () => sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();

  // Re-encode the original without metadata so "original quality" downloads carry no EXIF/GPS.
  const cleaned =
    meta.format === 'png'
      ? await base().png({ compressionLevel: 9 }).toBuffer()
      : meta.format === 'webp'
        ? await base().webp({ quality: 95 }).toBuffer()
        : await base().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  const optimized = await base().resize({ width: OPTIMIZED_MAX, height: OPTIMIZED_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const thumb = await base().resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();

  const optimizedKey = StorageKeys.mediaOptimized(item.eventId, item.id);
  const thumbnailKey = StorageKeys.mediaThumbnail(item.eventId, item.id);
  await Promise.all([
    storage.put(item.originalKey, cleaned, item.mimeType),
    storage.put(optimizedKey, optimized.data, 'image/webp'),
    storage.put(thumbnailKey, thumb, 'image/webp'),
  ]);
  await prisma.mediaItem.update({
    where: { id: item.id },
    data: {
      status: nextStatus,
      optimizedKey,
      thumbnailKey,
      width: optimized.info.width,
      height: optimized.info.height,
      sizeBytes: BigInt(cleaned.length),
    },
  });
  log.info({ mediaItemId, status: nextStatus, width: optimized.info.width, height: optimized.info.height }, 'Image processed');
  return nextStatus;
}
