import sharp, { type Metadata } from 'sharp';
import { StorageKeys } from '@bulava/storage';
import type { MediaDeps } from './processor';

const MAX_PIXELS = 100_000_000; // decompression-bomb guard
/** Posters and thumbnails use 1200; heroes and films 2400 (a phone sees the middle ~38% of the width). */
export const ASSET_WIDTHS = [1200, 2400] as const;
const LARGEST = 2400;
const THUMB_WIDTH = 480;

/**
 * Web renditions of a template design asset (painted artwork layers): WebP at
 * 1200 and 2400 px wide with transparency kept, plus a console thumbnail. The
 * stored original is the licensed master and stays untouched. Records the
 * image's real size. Idempotent: re-running rewrites the same keys.
 */
export async function processTemplateAsset(deps: MediaDeps, assetId: string): Promise<'PROCESSED' | 'SKIPPED' | 'UNREADABLE'> {
  const { prisma, storage, log } = deps;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.type !== 'IMAGE') return 'SKIPPED';

  const original = await storage.getBuffer(asset.storageKey);
  let meta: Metadata;
  try {
    meta = await sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch {
    log.warn({ assetId }, 'Design asset unreadable');
    return 'UNREADABLE';
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format) || !meta.width || !meta.height) {
    log.warn({ assetId, format: meta.format }, 'Design asset is not a supported image');
    return 'UNREADABLE';
  }
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  // Never upscale: a small source gets one rendition at its own width.
  const widths = [...new Set([...ASSET_WIDTHS.filter((w) => w < width), Math.min(width, LARGEST)])].sort((a, b) => a - b);
  const source = () => sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
  const renditions = await Promise.all(
    widths.map(async (w) => ({ w, data: await source().resize({ width: w, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toBuffer() })),
  );
  const thumb = await source().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  const thumbnailKey = StorageKeys.templateAssetRendition(asset.id, THUMB_WIDTH);
  await Promise.all([
    ...renditions.map((r) => storage.put(StorageKeys.templateAssetRendition(asset.id, r.w), r.data, 'image/webp')),
    storage.put(thumbnailKey, thumb, 'image/webp'),
  ]);
  await prisma.asset.update({ where: { id: asset.id }, data: { width, height, renditions: widths, thumbnailKey } });
  log.info({ assetId, width, height, renditions: widths, bytes: renditions.map((r) => r.data.length) }, 'Design asset processed');
  return 'PROCESSED';
}
