import { t } from '@/lib/i18n';
import { blocksOf, canvasOf, canvasRaster, colorRef, cropCanvas, fileBase, fontFor, inkBounds, openTypeName, plainColor, r1, textLayer, toHex, type TextLine } from './common';
import type { DraftLayer, ImportedPage, Importer } from './types';

/**
 * PDF from Canva, Illustrator (an .ai saved with PDF content), InDesign,
 * Affinity or CorelDRAW, read with pdf.js. Each page's art is drawn without
 * its words (one picture), and the words come back as text layers in their
 * fonts, sizes and colours (read from the page where the words were drawn).
 */

const MAX_PAGES = 30;
/** Pages are drawn about this many pixels on their long side: sharp on phones, light to upload. */
const PAGE_PIXELS = 2400;

type PdfJs = typeof import('pdfjs-dist');
let worker: Worker | null = null;

async function pdfjs(): Promise<PdfJs> {
  const lib = await import('pdfjs-dist');
  if (!lib.GlobalWorkerOptions.workerPort) {
    worker ??= new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
    lib.GlobalWorkerOptions.workerPort = worker;
  }
  return lib;
}

interface Item {
  str: string;
  x: number;
  baseline: number;
  w: number;
  size: number;
  angle: number;
  fontName: string;
}

/**
 * Pieces of words on one baseline, joined into lines. A space goes where a gap
 * is a space wider than the letters' own spacing: letter-spaced words (set a
 * letter at a time) keep their spacing (`spacing`, in em) and their word gaps.
 */
function linesOf(items: Item[]): Array<Item & { spacing: number }> {
  const groups: Item[][] = [];
  for (const item of [...items].sort((a, b) => a.baseline - b.baseline || a.x - b.x)) {
    const home = groups.find((g) => {
      const first = g[0]!;
      const right = Math.max(...g.map((p) => p.x + p.w));
      return Math.abs(first.size - item.size) <= item.size * 0.12 && Math.abs(first.baseline - item.baseline) <= item.size * 0.3 && item.x - right <= item.size * 1.2 && item.x + item.w >= first.x - item.size * 0.5;
    });
    if (home) home.push(item);
    else groups.push([item]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const size = g[0]!.size;
    // pdf.js spells letter-spaced words a letter at a time ("T O G E T H E R"): the letters, and the spacing they were set with.
    const spaced = g.filter((p) => SPACED.test(p.str.trim()));
    const tracking = spaced.length ? spaced.reduce((sum, p) => sum + letterSpacing(p.str.replace(/\s+/g, ''), p.w, size), 0) / spaced.length : 0;
    const pieces = g.map((p) => (SPACED.test(p.str.trim()) ? p.str.replace(/(\S) (?=\S)/g, '$1') : p.str));
    const gaps = g.slice(1).map((p, i) => p.x - (g[i]!.x + g[i]!.w));
    const median = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]! : 0;
    // Or one piece per letter, the letters an even gap apart.
    const perLetter = !spaced.length && g.length >= 4 && g.filter((p) => p.str.trim().length <= 2).length >= g.length * 0.6 && median > size * 0.04;
    const letter = perLetter ? median : tracking * size;
    let str = pieces[0]!;
    for (let i = 1; i < g.length; i++) {
      const space = gaps[i - 1]! - (perLetter ? letter : 0) > size * 0.15 && !str.endsWith(' ') && !pieces[i]!.startsWith(' ');
      str += (space ? ' ' : '') + pieces[i]!;
    }
    const right = Math.max(...g.map((p) => p.x + p.w));
    return { ...g[0]!, str, w: right - g[0]!.x, spacing: letter / size };
  });
}

/** Four or more single letters with a space between each: a letter-spaced word as pdf.js spells it. */
const SPACED = /^(?:\S ){3,}\S$/;
let measurer: CanvasRenderingContext2D | null = null;

/** The spacing (em) a run of letters was set with: its width beyond the letters' own, shared between them. */
function letterSpacing(letters: string, width: number, size: number): number {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer || !letters.length) return 0;
  measurer.font = `${size}px sans-serif`;
  return Math.max(0, Math.min(0.6, (width - measurer.measureText(letters).width) / letters.length / size));
}

/** The colour words were drawn in: where the page with words differs from the page without, weighted by how much. */
function inkColor(full: ImageData, bare: ImageData, box: { x: number; y: number; w: number; h: number }): { hex: string; alpha: number } | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(full.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(full.height, Math.ceil(box.y + box.h));
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let weight = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * full.width + x) * 4;
      const d = Math.abs(full.data[i]! - bare.data[i]!) + Math.abs(full.data[i + 1]! - bare.data[i + 1]!) + Math.abs(full.data[i + 2]! - bare.data[i + 2]!) + Math.abs(full.data[i + 3]! - bare.data[i + 3]!);
      if (d < 60) continue;
      const w = d * d;
      r += full.data[i]! * w;
      g += full.data[i + 1]! * w;
      b += full.data[i + 2]! * w;
      a += full.data[i + 3]! * w;
      weight += w;
    }
  }
  return weight ? { hex: toHex(r / weight, g / weight, b / weight), alpha: Math.min(1, a / weight / 255 + 0.15) } : null;
}

export const importPdf: Importer = async (file, options) => {
  const lib = await pdfjs();
  const warnings: string[] = [];
  // The fonts' bytes are kept, to read their names.
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), fontExtraProperties: true, enableXfa: false, stopAtErrors: false });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    await task.destroy();
    throw new Error((e as { name?: string }).name === 'PasswordException' ? t('design.import.error.locked') : t('design.import.error.unreadable'));
  }
  const TEXT_OPS = new Set([lib.OPS.showText, lib.OPS.showSpacedText, lib.OPS.nextLineShowText, lib.OPS.nextLineSetSpacingShowText]);
  const pages: ImportedPage[] = [];
  if (doc.numPages > MAX_PAGES) warnings.push(t('design.import.warn.pages', { count: MAX_PAGES }));
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const unit = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(6, PAGE_PIXELS / Math.max(unit.width, unit.height)) });
      const W = Math.round(viewport.width);
      const H = Math.round(viewport.height);
      const common = { viewport, annotationMode: lib.AnnotationMode.DISABLE, background: 'rgba(0,0,0,0)' };
      const bare = canvasOf(W, H);
      await page.render({ ...common, canvas: bare, ...(options.editableText ? { operationsFilter: (i: number, list: { fnArray: number[] }) => !TEXT_OPS.has(list.fnArray[i]!) } : {}) }).promise;
      const layers: DraftLayer[] = [];
      let background: ImportedPage['background'];

      const plain = plainColor(bare);
      if (plain && plain !== 'empty') background = colorRef(plain, options.palette);
      else if (!plain) {
        const ink = inkBounds(bare);
        if (ink) layers.push({ type: 'raster', name: t('design.import.pageArt'), raster: await canvasRaster(cropCanvas(bare, ink)), frame: { x: ink.x, y: ink.y, w: ink.w, h: ink.h, rotate: 0 }, locked: true });
      }

      if (options.editableText) {
        const full = canvasOf(W, H);
        await page.render({ ...common, canvas: full }).promise;
        const fullData = full.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H);
        const bareData = bare.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H);
        const content = await page.getTextContent();
        const fonts = new Map<string, ReturnType<typeof fontFor>>();
        const fontOf = (fontName: string) => {
          let f = fonts.get(fontName);
          if (f) return f;
          let name = '';
          let bold = false;
          let italic = false;
          let black = false;
          try {
            if (page.commonObjs.has(fontName)) {
              const obj = page.commonObjs.get(fontName) as { data?: Uint8Array; bold?: boolean; italic?: boolean; black?: boolean };
              name = (obj.data && openTypeName(obj.data)) || '';
              ({ bold = false, italic = false, black = false } = obj);
            }
          } catch {
            /* the font is not loaded: its kind from the text styles */
          }
          f = fontFor(name || content.styles[fontName]?.fontFamily || 'sans-serif', options.fonts);
          if (f.weight === 400 && (bold || black)) f = { ...f, weight: black ? 900 : 700 };
          if (italic) f = { ...f, italic: true };
          fonts.set(fontName, f);
          return f;
        };
        const ascent = (fontName: string) => {
          const s = content.styles[fontName];
          return { up: s?.ascent && s.ascent > 0.3 ? s.ascent : 0.85, down: s?.descent && s.descent < 0 ? -s.descent : 0.22 };
        };

        const items: Item[] = [];
        for (const raw of content.items) {
          if (!('str' in raw) || !raw.str.trim()) continue;
          const m = lib.Util.transform(viewport.transform, raw.transform) as number[];
          const size = Math.hypot(m[2]!, m[3]!);
          if (size < 1) continue;
          items.push({ str: raw.str, x: m[4]!, baseline: m[5]!, w: raw.width * viewport.scale, size, angle: (Math.atan2(m[1]!, m[0]!) * 180) / Math.PI, fontName: raw.fontName });
        }

        const toLine = (item: Item & { spacing?: number }): TextLine | null => {
          const { up, down } = ascent(item.fontName);
          const box = { x: item.x, y: item.baseline - up * item.size, w: item.w, h: (up + down) * item.size };
          const ink = inkColor(fullData, bareData, box);
          if (!ink) return null;
          const f = fontOf(item.fontName);
          return { text: item.str.trim(), ...box, baseline: item.baseline, size: item.size, key: item.fontName, font: f.font, weight: f.weight, italic: f.italic, color: ink.hex, alpha: ink.alpha, letterSpacing: item.spacing ?? 0 };
        };

        const lines = linesOf(items.filter((i) => Math.abs(i.angle) < 0.5))
          .map(toLine)
          .filter((l): l is TextLine => !!l);
        for (const block of blocksOf(lines, W)) layers.push(textLayer(block, options));

        // Turned words: each piece on its own, turned about its middle.
        for (const item of items.filter((i) => Math.abs(i.angle) >= 0.5)) {
          const { up, down } = ascent(item.fontName);
          const rad = (item.angle * Math.PI) / 180;
          const v = ((down - up) / 2) * item.size;
          const cx = item.x + Math.cos(rad) * (item.w / 2) - Math.sin(rad) * v;
          const cy = item.baseline + Math.sin(rad) * (item.w / 2) + Math.cos(rad) * v;
          const h = (up + down) * item.size;
          const box = { x: cx - item.w / 2, y: cy - h / 2, w: item.w, h };
          const reach = Math.max(item.w, h);
          const ink = inkColor(fullData, bareData, { x: cx - reach / 2, y: cy - reach / 2, w: reach, h: reach });
          if (!ink) continue;
          const f = fontOf(item.fontName);
          const line: TextLine = { text: item.str.trim(), ...box, baseline: box.y + up * item.size, size: item.size, key: item.fontName, font: f.font, weight: f.weight, italic: f.italic, color: ink.hex, alpha: ink.alpha, letterSpacing: 0, align: 'center' };
          layers.push(textLayer({ lines: [line], align: 'center', lineHeight: 1.2 }, options, { rotate: r1(item.angle) }));
        }
      }
      pages.push({ name: doc.numPages > 1 ? `${fileBase(file.name)} · ${n}` : fileBase(file.name), width: W, height: H, ...(background ? { background } : {}), layers });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { format: 'pdf', pages, warnings };
};
