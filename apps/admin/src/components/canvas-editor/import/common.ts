import { FONT_FAMILIES, PALETTE_KEYS, type ColorRef, type FontFamily } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import type { DraftLayer, ImportOptions, Palette, Raster } from './types';

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const r1 = (n: number) => Math.round(n * 10) / 10;

const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

let probe: CanvasRenderingContext2D | null = null;

/** Any CSS colour (rgb(), #abc, a name…) as #rrggbb and its alpha, read by the browser; null for none or a paint server. */
export function cssColor(value: string | null | undefined): { hex: string; alpha: number } | null {
  const v = value?.trim();
  if (!v || v === 'none' || v === 'transparent' || v.startsWith('url(')) return null;
  probe ??= document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.fillStyle = '#000001';
  probe.fillStyle = v;
  const out = String(probe.fillStyle);
  if (out === '#000001' && v !== '#000001') return null;
  if (out.startsWith('#')) return { hex: out.toLowerCase(), alpha: 1 };
  const m = out.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { hex: toHex(Number(m[1]), Number(m[2]), Number(m[3])), alpha: m[4] === undefined ? 1 : Number(m[4]) } : null;
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** How far two colours are apart (0–441). */
export function colorDistance(a: string, b: string): number {
  const [r1_, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return Math.hypot(r1_ - r2, g1 - g2, b1 - b2);
}

/** Closer than this to a palette colour, an imported colour takes the palette's name. */
const PALETTE_MATCH = 20;

/** The palette's name for a colour close to one of its colours (so it follows the host's choices), else the colour. */
export function colorRef(hex: string, palette: Palette | null): ColorRef {
  if (!palette) return hex;
  let best: (typeof PALETTE_KEYS)[number] | null = null;
  let bestD = PALETTE_MATCH;
  for (const key of PALETTE_KEYS) {
    const d = colorDistance(hex, palette[key]);
    if (d < bestD) {
      best = key;
      bestD = d;
    }
  }
  return best ?? hex;
}

export const isPaletteRef = (ref: ColorRef) => (PALETTE_KEYS as readonly string[]).includes(ref);

// ─────────────────────────── Fonts ───────────────────────────

export type TextFont = 'heading' | 'body' | 'script' | FontFamily;

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const SCRIPT_FONTS = /script|vibes|allura|parisienne|pinyon|brush|tangerine|sacramento|dancing|satisfy|italianno|rouge|calligraph|handwrit|signature|monsieur|petitformal|cursive|kaushan|lobster|pacifico|yellowtail|cookie|marck|qwigley|ballet|corinthia|birthstone|windsong|imperialscript|meddon|arizonia|mrdafoe|mrssaintdelafield|herrvon|lavishly|ephesis|luxurious|clicker|ruthie|grandhotel|norican|alexbrush|monteCarlo/i;
const SERIF_FONTS = /serif|playfair|bodoni|didot|garamond|cormorant|cinzel|lora|merriweather|baskerville|caslon|times|georgia|prata|marcellus|yeseva|abril|tenor|cardo|crimson|spectral|gilda|italiana|forum|bellefair|rozha|tiro|cambria|antiqua|palatino|minion|trajan|optima|bona|fraunces|gloock|ptserif|literata|newsreader|ebgaramond|sorts|bembo|perpetua|goudy|rockwell|didone|canela|ogg|domaine|tiempos|libre|vidaloka|ovo|rufina|cinzeldecorative|sangbleu/i;

/** Weight and slant from a font's name ("PlayfairDisplay-BoldItalic"). */
function nameWeight(name: string): number | null {
  const n = compact(name);
  if (/black|heavy/.test(n)) return 900;
  if (/extrabold|ultrabold/.test(n)) return 800;
  if (/semibold|demibold/.test(n)) return 600;
  if (/bold/.test(n)) return 700;
  if (/medium/.test(n)) return 500;
  if (/extralight|ultralight/.test(n)) return 200;
  if (/thin|hairline/.test(n)) return 100;
  if (/light/.test(n)) return 300;
  return null;
}

/**
 * The font a text layer takes for a font a file named: the template's own
 * role when it is that family, the same family when the engine has it, else
 * the role of its kind (script, serif headings, sans body text).
 */
export function fontFor(name: string, fonts: ImportOptions['fonts'], hints: { weight?: number; italic?: boolean } = {}): { font: TextFont; weight: number; italic: boolean } {
  const clean = name.replace(/^[A-Z]{6}\+/, '').replace(/^["']|["']$/g, '');
  const c = compact(clean);
  const weight = hints.weight ?? nameWeight(clean) ?? 400;
  const italic = hints.italic ?? /italic|oblique/i.test(clean);
  const base = (family: string) => c.startsWith(compact(family));
  for (const role of ['script', 'heading', 'body'] as const) if (fonts[role] && base(fonts[role])) return { font: role, weight, italic };
  // Longest first, so "Noto Serif Devanagari" wins over "Noto Serif".
  const family = [...FONT_FAMILIES].sort((a, b) => b.length - a.length).find(base);
  if (family) return { font: family, weight, italic };
  if (SCRIPT_FONTS.test(c)) return { font: 'script', weight: 400, italic: false };
  if (SERIF_FONTS.test(c) && !/sans/.test(c)) return { font: 'heading', weight, italic };
  return { font: 'body', weight, italic };
}

/** A font's full name from its OpenType `name` table (the fonts embedded in PDFs), or null. */
export function openTypeName(bytes: Uint8Array): string | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = view.getUint16(4);
    for (let i = 0; i < tables; i++) {
      const rec = 12 + i * 16;
      const tag = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3));
      if (tag !== 'name') continue;
      const at = view.getUint32(rec + 8);
      const count = view.getUint16(at + 2);
      const strings = at + view.getUint16(at + 4);
      const found = new Map<number, string>();
      for (let j = 0; j < count; j++) {
        const r = at + 6 + j * 12;
        const platform = view.getUint16(r);
        const nameId = view.getUint16(r + 6);
        const length = view.getUint16(r + 8);
        const offset = strings + view.getUint16(r + 10);
        if (![1, 4, 6].includes(nameId) || found.has(nameId)) continue;
        let s = '';
        if (platform === 0 || platform === 3) for (let k = 0; k + 1 < length; k += 2) s += String.fromCharCode(view.getUint16(offset + k));
        else for (let k = 0; k < length; k++) s += String.fromCharCode(view.getUint8(offset + k));
        if (s.trim()) found.set(nameId, s.trim());
      }
      return found.get(4) ?? found.get(1) ?? found.get(6) ?? null;
    }
  } catch {
    /* not a font we can read */
  }
  return null;
}

// ─────────────────────────── Words ───────────────────────────

/** One line of words as a file placed it (unrotated), in page units. */
export interface TextLine {
  text: string;
  /** The line's box: left, top (of the letters), width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
  size: number;
  /** Lines in the same font, size and colour can join into one block. */
  key: string;
  font: TextFont;
  weight: number;
  italic: boolean;
  color: string;
  alpha: number;
  /** In em. */
  letterSpacing: number;
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
}

export interface TextBlock {
  lines: TextLine[];
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

/** Lines set one under another in the same style, as paragraphs (Canva and Illustrator write a line at a time). */
export function blocksOf(lines: TextLine[], pageWidth: number): TextBlock[] {
  const sorted = [...lines].sort((a, b) => a.baseline - b.baseline || a.x - b.x);
  const blocks: TextLine[][] = [];
  /** Another line set between two lines (an ampersand between names) keeps them apart. */
  const between = (a: TextLine, b: TextLine) => sorted.some((o) => o !== a && o !== b && o.baseline > a.baseline + a.size * 0.2 && o.baseline < b.baseline - b.size * 0.2 && o.x < b.x + b.w && o.x + o.w > b.x);
  for (const line of sorted) {
    const tol = line.size * 0.6;
    const home = blocks.find((block) => {
      const last = block[block.length - 1]!;
      const gap = line.baseline - last.baseline;
      // The same font and size and (as sampled, nearly) the same colour.
      if (last.key !== line.key || Math.abs(last.size - line.size) > line.size * 0.08 || colorDistance(last.color, line.color) > 40 || gap < line.size * 0.8 || gap > line.size * 2.1) return false;
      if (block.length > 1 && Math.abs(gap - (last.baseline - block[block.length - 2]!.baseline)) > line.size * 0.25) return false;
      if (between(last, line)) return false;
      return Math.abs(line.x - last.x) <= tol || Math.abs(line.x + line.w / 2 - (last.x + last.w / 2)) <= tol || Math.abs(line.x + line.w - (last.x + last.w)) <= tol;
    });
    if (home) home.push(line);
    else blocks.push([line]);
  }
  return blocks.map((block) => {
    const first = block[0]!;
    const near = (vals: number[]) => Math.max(...vals) - Math.min(...vals) <= first.size * 0.6;
    const lefts = near(block.map((l) => l.x));
    const centres = near(block.map((l) => l.x + l.w / 2));
    const rights = near(block.map((l) => l.x + l.w));
    let align: TextBlock['align'];
    if (first.align && (block.length === 1 || (first.align === 'left' ? lefts : first.align === 'right' ? rights : centres))) align = first.align;
    else if (block.length > 1) align = centres && !(lefts && !rights) ? 'center' : lefts ? 'left' : rights ? 'right' : 'center';
    // One line: centred when it sits on the page's middle (most invitations), else as it reads.
    else align = Math.abs(first.x + first.w / 2 - pageWidth / 2) <= pageWidth * 0.04 ? 'center' : 'left';
    const gaps = block.slice(1).map((l, i) => l.baseline - block[i]!.baseline);
    const lineHeight = gaps.length ? clamp(gaps.reduce((a, b) => a + b, 0) / gaps.length / first.size, 0.7, 3) : 1.2;
    return { lines: block, align, lineHeight: r1(lineHeight * 100) / 100 };
  });
}

/** A block of words as a text layer: its box a little wider than the letters, as the web's font can be a little wider. */
export function textLayer(block: TextBlock, options: ImportOptions, extra: { rotate?: number; opacity?: number } = {}): DraftLayer {
  const first = block.lines[0]!;
  const left = Math.min(...block.lines.map((l) => l.x));
  const right = Math.max(...block.lines.map((l) => l.x + l.w));
  const top = first.y;
  const bottom = Math.max(...block.lines.map((l) => l.y + l.h));
  const width = right - left;
  const spare = Math.max(first.size * 0.3, width * 0.04);
  const x = block.align === 'center' ? left - spare / 2 : block.align === 'right' ? left - spare : left;
  const h = Math.max(bottom - top, block.lines.length * block.lineHeight * first.size);
  const cy = (top + bottom) / 2;
  const color = colorRef(first.color, options.palette);
  const text = block.lines.map((l) => l.text).join('\n');
  return {
    type: 'layer',
    layer: {
      id: 'text',
      name: text.replace(/\s+/g, ' ').slice(0, 60),
      kind: 'text',
      frame: { x: r1(x), y: r1(cy - h / 2), w: r1(width + spare), h: r1(h), rotate: r1(extra.rotate ?? 0) },
      opacity: clamp(first.alpha * (extra.opacity ?? 1), 0, 1),
      content: { literal: text },
      style: {
        font: first.font,
        // In page units: placing the import scales it (and keeps it within the engine's sizes).
        size: r1(first.size),
        weight: first.weight,
        italic: first.italic,
        color,
        align: block.align,
        valign: 'middle',
        letterSpacing: clamp(r1(first.letterSpacing * 100) / 100, -0.2, 1),
        lineHeight: block.lineHeight,
        transform: first.upper ? 'upper' : 'none',
        // The designer's colours stay as drawn; palette colours keep the engine's readability nudge.
        contrast: isPaletteRef(color),
      },
      overflow: 'shrink',
    },
  };
}

// ─────────────────────────── Pictures ───────────────────────────

export function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** A canvas as an upload: WebP for large pictures, PNG for small ones (crisp edges). */
export async function canvasRaster(canvas: HTMLCanvasElement): Promise<Raster> {
  const type = canvas.width * canvas.height > 640 * 640 ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error(t('design.import.error.draw'));
  return { blob, width: canvas.width, height: canvas.height };
}

/** The part of a canvas that is drawn on (null when nothing is). */
export function inkBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const { width, height } = canvas;
  const data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A canvas cut to a box. */
export function cropCanvas(canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const out = canvasOf(box.w, box.h);
  out.getContext('2d')!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out;
}

/** The one colour a canvas is painted in, when it is (a plain page); 'empty' when nothing is drawn. */
export function plainColor(canvas: HTMLCanvasElement): string | 'empty' | null {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, width, height).data;
  let first: [number, number, number, number] | null = null;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const px: [number, number, number, number] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      if (!first) first = px;
      else if (px.some((v, k) => Math.abs(v - first![k]!) > 3)) return null;
    }
  }
  if (!first || first[3] < 3) return 'empty';
  return first[3] > 250 ? toHex(first[0], first[1], first[2]) : null;
}

/** A data: URL's bytes (fetch would need the CSP to allow data: connections). */
export function dataUrlBlob(url: string): Blob | null {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  try {
    const raw = m[2] ? atob(m[3]!.replace(/\s+/g, '')) : decodeURIComponent(m[3]!);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

/** A picture's pixels, decoded by the browser. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new Error(t('design.import.error.picture'));
  }
}

/** A picture the browser can show in a template (others are drawn again as PNG). */
export async function webRaster(blob: Blob, crop?: { l: number; t: number; r: number; b: number }): Promise<Raster> {
  const bitmap = await decodeImage(blob);
  const plain = ['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) && !crop && blob.size <= 20 * 1024 * 1024;
  if (plain) {
    const raster = { blob, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return raster;
  }
  const c = crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const sx = bitmap.width * c.l;
  const sy = bitmap.height * c.t;
  const sw = Math.max(1, bitmap.width * (1 - c.l - c.r));
  const sh = Math.max(1, bitmap.height * (1 - c.t - c.b));
  const scale = Math.min(1, 4096 / Math.max(sw, sh));
  const canvas = canvasOf(sw * scale, sh * scale);
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasRaster(canvas);
}

export const fileBase = (name: string) => name.replace(/\.[^.]+$/, '').slice(0, 60) || 'design';
