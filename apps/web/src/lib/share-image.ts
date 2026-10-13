import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** The part of sharp the share images use. */
interface SharpImage {
  resize(width: number): SharpImage;
  jpeg(options: { quality: number; mozjpeg?: boolean }): SharpImage;
  toBuffer(): Promise<Buffer>;
}
type Sharp = (input: Buffer) => SharpImage;

let loading: Promise<Sharp | null> | null = null;

/**
 * sharp, as Next.js ships it for its image optimiser (an optional dependency of `next`, which
 * the standalone build includes). Loaded at run time from next's own folder, so the web app
 * needs no dependency of its own; null when it is missing (the image is then drawn without it).
 */
function loadSharp(): Promise<Sharp | null> {
  loading ??= (async () => {
    try {
      // Node's own module loader: webpack rewrites `import('node:module')` and its require.
      const { createRequire } = process.getBuiltinModule('node:module');
      const fromApp = createRequire(path.join(process.cwd(), 'package.json'));
      const fromNext = createRequire(fromApp.resolve('next/package.json'));
      const mod = fromNext('sharp') as Sharp | { default: Sharp };
      return typeof mod === 'function' ? mod : mod.default;
    } catch (error) {
      console.warn('share image: sharp unavailable', (error as Error).message);
      return null;
    }
  })();
  return loading;
}

/**
 * A pre-rendered template preview (`/template-previews/…webp`, lib/template-previews) as a
 * JPEG data URI at `width`: the share image's renderer (satori) draws PNG and JPEG, not WebP.
 */
export async function previewAsJpeg(publicUrl: string, width: number): Promise<string | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const file = path.join(process.cwd(), 'public', publicUrl.split('?')[0]!.replace(/^\/+/, ''));
    const jpeg = await sharp(await readFile(file)).resize(width).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * The finished share image as a JPEG: a tenth of the PNG's size, and WhatsApp drops link
 * previews whose image is too heavy. The PNG when sharp is missing.
 */
export async function asJpeg(png: ArrayBuffer): Promise<{ body: Buffer; type: string }> {
  const sharp = await loadSharp();
  const buffer = Buffer.from(png);
  if (!sharp) return { body: buffer, type: 'image/png' };
  try {
    return { body: await sharp(buffer).jpeg({ quality: 84, mozjpeg: true }).toBuffer(), type: 'image/jpeg' };
  } catch {
    return { body: buffer, type: 'image/png' };
  }
}
