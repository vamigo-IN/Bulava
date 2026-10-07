#!/usr/bin/env node
/**
 * Pre-render the template previews galleries show (apps/web/public/template-previews).
 *
 *   node infrastructure/scripts/template-previews.mjs [--base http://localhost:3000] [--only key,key] [--full marigold-mahal]
 *
 * Needs the web app (with TEMPLATE_PREVIEW_FRAMES=1, which turns on /preview-frame/<key>)
 * and the API running. With reduced motion, it photographs:
 * - every website template at phone width: the top 390 × 780 CSS px as gallery cards
 *   draw it (<key>.webp), and for the home page's hero template the first 2600 px of
 *   the full preview (<key>-full.webp);
 * - every film and card template that opens on a scene: the poster gallery cards draw
 *   at 220 × 400 CSS px (<key>-poster.webp).
 * Then it rewrites apps/web/src/lib/template-previews.json with content hashes, so
 * changed images get new URLs.
 *
 * Run it after adding or changing a template, then rebuild the web app; a template
 * without an image is still shown, drawn live. Uses Remotion's downloaded Chrome
 * Headless Shell unless CHROME_PATH is set.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const BASE = args.base ?? 'http://localhost:3000';
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const FULL = new Set((args.full ?? 'marigold-mahal').split(',').filter(Boolean));
const OUT = path.resolve('apps/web/public/template-previews');
const MANIFEST = path.resolve('apps/web/src/lib/template-previews.json');
// Sizes in CSS px; they match apps/web/src/lib/template-previews.ts.
const CARD = { width: 390, height: 780, imageWidth: 560 }; // 780 covers every phone frame's aspect ratio (narrowest is 1:2); 560 is sharp at 2× for the largest phone (280 px)
const FULL_HEIGHT = 2600; // about four sections for the hero phone's slow scroll
const POSTER = { width: 220, height: 400, imageWidth: 440 }; // the gallery card's phone screen, at 2×

const sharp = createRequire(path.resolve('apps/media-worker/package.json'))('sharp');

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.resolve('apps/video-worker/node_modules/.remotion/chrome-headless-shell');
  if (!existsSync(root)) throw new Error('Chrome not found. Run the video worker once (ensureBrowser) or set CHROME_PATH.');
  const dirs = (p) => readdirSync(p).filter((d) => statSync(path.join(p, d)).isDirectory());
  for (const platform of dirs(root)) {
    for (const dir of dirs(path.join(root, platform))) {
      for (const exe of ['chrome-headless-shell.exe', 'chrome-headless-shell']) {
        const p = path.join(root, platform, dir, exe);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('Chrome binary not found');
}

const listing = await fetch(`${BASE}/api/v1/public/templates`).then((r) => r.json());
if (!listing.success) throw new Error(`Could not list templates from ${BASE}: ${listing.error?.code ?? 'unknown error'}`);
const templates = listing.data.filter((t) => !ONLY || ONLY.has(t.key));
const websites = templates.filter((t) => t.outputs.includes('WEBSITE')).map((t) => t.key).sort();
const others = templates.filter((t) => !t.outputs.includes('WEBSITE')).map((t) => t.key).sort();

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
// A full run starts clean, so templates that no longer exist drop out.
for (const kind of ['card', 'full', 'poster']) if (!ONLY || !manifest[kind]) manifest[kind] = {};
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

/**
 * Photographs /preview-frame/<key>?view=<view> at `size`; returns the WebP and the CSS height
 * it covers, or null for a 404 (a film or card without a scene).
 */
async function shoot(key, view, size, maxHeight = size.height) {
  await page.setViewport({ width: size.width, height: maxHeight, deviceScaleFactor: size.imageWidth / size.width });
  const res = await page.goto(`${BASE}/preview-frame/${key}?view=${view}`, { waitUntil: 'networkidle0', timeout: 120_000 });
  if (res?.status() === 404 && view === 'poster') return null;
  if (!res || res.status() !== 200) throw new Error(`HTTP ${res?.status()} for ${key}: is TEMPLATE_PREVIEW_FRAMES=1 set on the web app?`);
  // The dev server's indicator and error overlay live in <nextjs-portal>; keep them out of the picture.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  const content = await page.evaluate(() => Math.ceil(document.getElementById('preview-frame')?.getBoundingClientRect().height ?? 0));
  const height = view === 'full' ? Math.min(maxHeight, content || maxHeight) : maxHeight;
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size.width, height }, type: 'png' });
  const webp = await sharp(png).resize({ width: size.imageWidth }).webp({ quality: 72, effort: 6 }).toBuffer();
  return { webp, height };
}

let bytes = 0;
let count = 0;
function save(file, webp) {
  writeFileSync(path.join(OUT, file), webp);
  bytes += webp.length;
  count++;
  return `${Math.round(webp.length / 1024)} KB`;
}

try {
  for (const key of websites) {
    const card = await shoot(key, 'card', CARD);
    manifest.card[key] = hash(card.webp);
    let line = `✓ ${key.padEnd(24)} ${save(`${key}.webp`, card.webp)}`;
    if (FULL.has(key)) {
      const full = await shoot(key, 'full', CARD, FULL_HEIGHT);
      manifest.full[key] = { v: hash(full.webp), height: full.height };
      line += `  + full ${full.height}px ${save(`${key}-full.webp`, full.webp)}`;
    }
    console.log(line);
  }
  for (const key of others) {
    const poster = await shoot(key, 'poster', POSTER);
    if (!poster) {
      delete manifest.poster[key];
      console.log(`- ${key.padEnd(24)} no scene: drawn live`);
      continue;
    }
    manifest.poster[key] = hash(poster.webp);
    console.log(`✓ ${key.padEnd(24)} poster ${save(`${key}-poster.webp`, poster.webp)}`);
  }
} finally {
  await browser.close().catch(() => undefined);
}

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `${JSON.stringify({ card: sorted(manifest.card), full: sorted(manifest.full), poster: sorted(manifest.poster) }, null, 2)}\n`);

// After a full run, images of templates that are gone are deleted.
if (!ONLY) {
  const kept = new Set([
    ...Object.keys(manifest.card).map((k) => `${k}.webp`),
    ...Object.keys(manifest.full).map((k) => `${k}-full.webp`),
    ...Object.keys(manifest.poster).map((k) => `${k}-poster.webp`),
  ]);
  for (const file of readdirSync(OUT)) if (file.endsWith('.webp') && !kept.has(file)) unlinkSync(path.join(OUT, file));
}
console.log(`\n${count} images, ${Math.round(bytes / 1024)} KB. Rebuild the web app to use them.`);
