import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp, { type Metadata } from 'sharp';
import { cardRenderToken } from '@bulava/auth';
import type { CardExportKind, Prisma, PrismaClient } from '@bulava/database';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { CARD_FORMATS, type CardFormat } from '@bulava/template-schema';

export interface CardDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  log: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
  /** The web app as this worker reaches it (http://web:3000 in Docker): it draws the card. */
  webUrl: string;
  tokenKey: string;
  /** Queues a paid card's first email once its image is ready. */
  enqueueEmail: (cardOrderId: string) => Promise<void>;
}

const MAX_PIXELS = 100_000_000; // decompression-bomb guard
/** Photos are kept at most this large: sharp on a 3x export of the largest format. */
const PHOTO_MAX = 2400;

/**
 * A photo placed in a card: fully decoded and re-encoded (no EXIF or GPS,
 * turned upright, at most 2400 px), so what the card shows is a clean image
 * the customer chose. The original is deleted.
 */
export async function processCardUpload(deps: Pick<CardDeps, 'prisma' | 'storage' | 'log'>, uploadId: string): Promise<'READY' | 'REJECTED' | 'SKIPPED'> {
  const { prisma, storage, log } = deps;
  const upload = await prisma.cardUpload.findUnique({ where: { id: uploadId } });
  if (!upload || upload.status !== 'PROCESSING') return 'SKIPPED';
  const reject = async (reason: string) => {
    log.warn({ uploadId, reason }, 'Card photo rejected');
    await storage.delete(upload.originalKey).catch(() => undefined);
    await prisma.cardUpload.update({ where: { id: upload.id }, data: { status: 'REJECTED', error: reason } });
    return 'REJECTED' as const;
  };
  const original = await storage.getBuffer(upload.originalKey);
  let meta: Metadata;
  try {
    meta = await sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch {
    return reject('This file is not a photo we can read.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return reject('Use a JPEG, PNG or WebP photo.');
  const out = await sharp(original, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: PHOTO_MAX, height: PHOTO_MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  const key = StorageKeys.cardUpload(upload.sessionId, upload.id);
  await storage.put(key, out.data, 'image/webp');
  await storage.delete(upload.originalKey).catch(() => undefined);
  await prisma.cardUpload.update({ where: { id: upload.id }, data: { status: 'READY', storageKey: key, width: out.info.width, height: out.info.height, bytes: out.data.length, error: null } });
  log.info({ uploadId, width: out.info.width, height: out.info.height }, 'Card photo ready');
  return 'READY';
}

/** Chrome for rendering: CHROMIUM_PATH, the system's Chromium (the Docker image), or the video worker's headless shell (development). */
export function chromiumPath(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const p of ['/usr/bin/chromium-browser', '/usr/bin/chromium']) if (existsSync(p)) return p;
  const root = path.resolve(process.cwd(), '../video-worker/node_modules/.remotion/chrome-headless-shell');
  if (existsSync(root)) {
    const dirs = (p: string) => readdirSync(p).filter((d) => statSync(path.join(p, d)).isDirectory());
    for (const platform of dirs(root)) {
      for (const dir of dirs(path.join(root, platform))) {
        for (const exe of ['chrome-headless-shell.exe', 'chrome-headless-shell']) {
          const p = path.join(root, platform, dir, exe);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  throw new Error('No Chromium found for rendering cards: set CHROMIUM_PATH');
}

const GENERATED: Record<CardExportKind, 'FREE_CARD_GENERATED' | 'PAID_CARD_GENERATED' | 'PLAN_CARD_GENERATED'> = {
  FREE: 'FREE_CARD_GENERATED',
  PAID: 'PAID_CARD_GENERATED',
  PLAN: 'PLAN_CARD_GENERATED',
};

/**
 * Renders one card image: Chromium opens the web app's /cards/render page
 * (the same CardView the editor draws, with the watermark for free cards) at
 * the format's size and pixel ratio, waits for fonts and photos, and the
 * screenshot becomes a high-quality JPEG in private storage. A paid card's
 * first email is queued as soon as its image exists.
 */
export async function renderCard(deps: CardDeps, exportId: string): Promise<'READY' | 'SKIPPED'> {
  const { prisma, storage, log } = deps;
  const card = await prisma.cardExport.findUnique({ where: { id: exportId } });
  if (!card || card.status === 'READY' || card.status === 'EXPIRED') return 'SKIPPED';
  await prisma.cardExport.update({ where: { id: card.id }, data: { status: 'RENDERING', attempts: { increment: 1 } } });
  const format = (card.design as { format?: string }).format as CardFormat;
  const spec = CARD_FORMATS[format];
  if (!spec) throw new Error(`Unknown card format ${String(format)}`);

  let browser: Browser | null = null;
  let png: Uint8Array;
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath(),
      headless: true,
      // No sandbox inside the container (no user namespaces); /dev/shm is small there.
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--font-render-hinting=none', '--mute-audio', '--no-first-run'],
      protocolTimeout: 60_000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: spec.scale });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const token = cardRenderToken(card.id, deps.tokenKey, 600);
    const res = await page.goto(`${deps.webUrl.replace(/\/$/, '')}/cards/render/${token}`, { waitUntil: 'networkidle0', timeout: 45_000 });
    if (!res?.ok()) throw new Error(`The card page answered ${res?.status() ?? 'nothing'}`);
    await page.waitForSelector('[data-card-ready], [data-card-error]', { timeout: 30_000 });
    if (await page.$('[data-card-error]')) throw new Error('The card page could not draw this card');
    png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: spec.width, height: spec.height } });
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const image = await sharp(Buffer.from(png))
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });
  const key = StorageKeys.cardExport(card.id);
  await storage.put(key, image.data, 'image/jpeg');
  await prisma.cardExport.update({
    where: { id: card.id },
    data: { status: 'READY', storageKey: key, width: image.info.width, height: image.info.height, bytes: image.data.length, readyAt: new Date(), error: null },
  });
  await prisma.cardEvent.create({
    data: { type: GENERATED[card.kind], sessionId: card.sessionId, leadId: card.leadId, orderId: card.orderId, userId: card.userId, templateKey: card.templateKey, meta: { format } as Prisma.InputJsonValue },
  });
  log.info({ exportId, kind: card.kind, width: image.info.width, height: image.info.height, bytes: image.data.length }, 'Card rendered');

  if (card.kind === 'PAID' && card.orderId) {
    const queued = await prisma.cardOrder.updateMany({ where: { id: card.orderId, status: 'PAID', emailStatus: 'NONE' }, data: { emailStatus: 'QUEUED' } });
    if (queued.count) await deps.enqueueEmail(card.orderId);
  }
  return 'READY';
}

/** The last attempt failed: the editor and the order page offer to try again (a paid card is never charged again). */
export async function cardRenderFailed(prisma: PrismaClient, exportId: string, error: Error): Promise<void> {
  const card = await prisma.cardExport.findUnique({ where: { id: exportId } });
  if (!card || card.status === 'READY' || card.status === 'EXPIRED') return;
  await prisma.cardExport.update({ where: { id: card.id }, data: { status: 'FAILED', error: error.message.slice(0, 500) } });
  await prisma.cardEvent.create({
    data: { type: 'EXPORT_FAILED', sessionId: card.sessionId, leadId: card.leadId, orderId: card.orderId, userId: card.userId, templateKey: card.templateKey, meta: { kind: card.kind, reason: error.message.slice(0, 120) } as Prisma.InputJsonValue },
  });
}
