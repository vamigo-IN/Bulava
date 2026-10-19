import type { ColorRef, SHAPES } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { canvasOf, canvasRaster, clamp, colorRef, cssColor, fileBase, fontFor, isPaletteRef, r1, toHex, webRaster } from './common';
import { unzip } from './unzip';
import type { DraftLayer, ImportedPage, Importer, ImportOptions, Raster } from './types';

/**
 * PowerPoint decks (also what Canva, Keynote and Google Slides export as
 * PPTX): each slide is a page, with the art its layout and master put on
 * every slide beneath it. Text boxes become text layers (font, size, colour,
 * alignment, spacing), plain shapes shape layers, pictures pictures (cropped
 * and masked as placed). Tables, charts and SmartArt are left out.
 */

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PT = 12_700;
const MAX_SLIDES = 30;

const kids = (el: Element | null | undefined, ns: string, name: string) => (el ? [...el.children].filter((c) => c.namespaceURI === ns && c.localName === name) : []);
const kid = (el: Element | null | undefined, ns: string, name: string) => kids(el, ns, name)[0] ?? null;
const attr = (el: Element | null | undefined, name: string, fallback: number) => {
  const v = el?.getAttribute(name);
  return v === null || v === undefined || v === '' ? fallback : Number(v);
};
const on = (el: Element | null | undefined, name: string) => ['1', 'true'].includes(el?.getAttribute(name) ?? '');

function resolve(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/');
  parts.pop();
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

class Deck {
  private parsed = new Map<string, Document | null>();
  constructor(private files: Map<string, Uint8Array>) {}
  xml(path: string): Document | null {
    if (!this.parsed.has(path)) {
      const bytes = this.files.get(path);
      this.parsed.set(path, bytes ? new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml') : null);
    }
    return this.parsed.get(path)!;
  }
  /** A part's relationships: id → the part it points to. */
  rels(path: string): Map<string, { target: string; type: string }> {
    const dir = path.split('/');
    const file = dir.pop();
    const doc = this.xml(`${dir.join('/')}/_rels/${file}.rels`);
    const out = new Map<string, { target: string; type: string }>();
    for (const rel of doc ? [...doc.getElementsByTagName('Relationship')] : []) {
      if (rel.getAttribute('TargetMode') === 'External') continue;
      out.set(rel.getAttribute('Id') ?? '', { target: resolve(path, rel.getAttribute('Target') ?? ''), type: rel.getAttribute('Type') ?? '' });
    }
    return out;
  }
  related(path: string, kind: string): string | null {
    for (const rel of this.rels(path).values()) if (rel.type.endsWith(`/${kind}`)) return rel.target;
    return null;
  }
  bytes(path: string) {
    return this.files.get(path);
  }
}

// ─────────────────────────── Colours ───────────────────────────

interface Theme {
  colors: Record<string, string>;
  map: Record<string, string>;
  major: string;
  minor: string;
}

function hsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  if (s === 0) return toHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t0: number) => {
    let t1 = t0;
    if (t1 < 0) t1 += 1;
    if (t1 > 1) t1 -= 1;
    if (t1 < 1 / 6) return p + (q - p) * 6 * t1;
    if (t1 < 1 / 2) return q;
    if (t1 < 2 / 3) return p + (q - p) * (2 / 3 - t1) * 6;
    return p;
  };
  return toHex(ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255);
}

/** A DrawingML colour (sRGB, a theme colour, a system or preset colour) with its tints, shades and alpha. */
function colorOf(holder: Element | null, theme: Theme): { hex: string; alpha: number } | null {
  const el = holder ? [...holder.children].find((c) => c.namespaceURI === A) : null;
  if (!el) return null;
  let hex: string | null = null;
  switch (el.localName) {
    case 'srgbClr':
      hex = `#${(el.getAttribute('val') ?? '000000').toLowerCase()}`;
      break;
    case 'schemeClr': {
      const name = el.getAttribute('val') ?? 'tx1';
      hex = theme.colors[theme.map[name] ?? name] ?? null;
      break;
    }
    case 'sysClr':
      hex = `#${(el.getAttribute('lastClr') ?? '000000').toLowerCase()}`;
      break;
    case 'prstClr':
      hex = cssColor(el.getAttribute('val'))?.hex ?? null;
      break;
    case 'scrgbClr':
      hex = toHex((attr(el, 'r', 0) / 100000) * 255, (attr(el, 'g', 0) / 100000) * 255, (attr(el, 'b', 0) / 100000) * 255);
      break;
  }
  if (!hex || !/^#[0-9a-f]{6}$/.test(hex)) return null;
  let alpha = 1;
  for (const mod of el.children) {
    const v = attr(mod, 'val', 100000) / 100000;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex!.slice(i, i + 2), 16)) as [number, number, number];
    if (mod.localName === 'alpha') alpha = v;
    else if (mod.localName === 'tint') hex = toHex(r * v + 255 * (1 - v), g * v + 255 * (1 - v), b * v + 255 * (1 - v));
    else if (mod.localName === 'shade') hex = toHex(r * v, g * v, b * v);
    else if (mod.localName === 'lumMod' || mod.localName === 'lumOff' || mod.localName === 'satMod') {
      const [h, s, l] = hsl(hex);
      hex = mod.localName === 'lumMod' ? fromHsl(h, s, clamp(l * v, 0, 1)) : mod.localName === 'lumOff' ? fromHsl(h, s, clamp(l + v, 0, 1)) : fromHsl(h, clamp(s * v, 0, 1), l);
    }
  }
  return { hex, alpha };
}

function themeOf(deck: Deck, master: string | null): Theme {
  const theme: Theme = { colors: {}, map: {}, major: '', minor: '' };
  const themePath = master ? deck.related(master, 'theme') : null;
  const doc = deck.xml(themePath ?? 'ppt/theme/theme1.xml');
  const scheme = doc?.getElementsByTagNameNS(A, 'clrScheme')[0];
  for (const c of scheme ? [...scheme.children] : []) {
    const value = c.children[0];
    const hex = value?.localName === 'sysClr' ? value.getAttribute('lastClr') : value?.getAttribute('val');
    if (hex) theme.colors[c.localName] = `#${hex.toLowerCase()}`;
  }
  const fonts = doc?.getElementsByTagNameNS(A, 'fontScheme')[0];
  theme.major = kid(kid(fonts, A, 'majorFont'), A, 'latin')?.getAttribute('typeface') ?? '';
  theme.minor = kid(kid(fonts, A, 'minorFont'), A, 'latin')?.getAttribute('typeface') ?? '';
  const clrMap = master ? deck.xml(master)?.getElementsByTagNameNS(P, 'clrMap')[0] : null;
  theme.map = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
  for (const a of clrMap ? [...clrMap.attributes] : []) theme.map[a.name] = a.value;
  return theme;
}

// ─────────────────────────── Shapes ───────────────────────────

type Fill = { type: 'none' } | { type: 'solid'; hex: string; alpha: number } | { type: 'gradient'; stops: string[]; angle: number; radial: boolean } | { type: 'image'; embed: string; crop: Crop };
type Crop = { l: number; t: number; r: number; b: number };

const cropOf = (blipFill: Element | null): Crop => {
  const src = kid(blipFill, A, 'srcRect');
  return { l: attr(src, 'l', 0) / 100000, t: attr(src, 't', 0) / 100000, r: attr(src, 'r', 0) / 100000, b: attr(src, 'b', 0) / 100000 };
};

/** A shape's fill as stated (null: not stated, so the shape's style decides). */
function fillOf(props: Element | null, theme: Theme): Fill | null {
  for (const c of props ? [...props.children] : []) {
    if (c.namespaceURI !== A) continue;
    if (c.localName === 'noFill') return { type: 'none' };
    if (c.localName === 'solidFill') {
      const color = colorOf(c, theme);
      return color ? { type: 'solid', ...color } : null;
    }
    if (c.localName === 'gradFill') {
      const stops = kids(kid(c, A, 'gsLst'), A, 'gs')
        .sort((a, b) => attr(a, 'pos', 0) - attr(b, 'pos', 0))
        .map((gs) => colorOf(gs, theme)?.hex)
        .filter((h): h is string => !!h);
      if (!stops.length) return null;
      return { type: 'gradient', stops, angle: attr(kid(c, A, 'lin'), 'ang', 5_400_000) / 60000, radial: !!kid(c, A, 'path') };
    }
    if (c.localName === 'blipFill') {
      const embed = kid(c, A, 'blip')?.getAttributeNS(R, 'embed');
      return embed ? { type: 'image', embed, crop: cropOf(c) } : null;
    }
  }
  return null;
}

const GEOMETRY: Record<string, (typeof SHAPES)[number]> = { rect: 'rect', roundRect: 'rect', snip1Rect: 'rect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', star5: 'star', heart: 'heart', line: 'line', straightConnector1: 'line' };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Mapper = (b: Box) => Box;

interface Xfrm extends Box {
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

function xfrmOf(props: Element | null, map: Mapper): Xfrm | null {
  const xfrm = kid(props, A, 'xfrm');
  const off = kid(xfrm, A, 'off');
  const ext = kid(xfrm, A, 'ext');
  if (!off || !ext) return null;
  const box = map({ x: attr(off, 'x', 0), y: attr(off, 'y', 0), w: attr(ext, 'cx', 0), h: attr(ext, 'cy', 0) });
  return { ...box, rot: attr(xfrm, 'rot', 0) / 60000, flipH: on(xfrm, 'flipH'), flipV: on(xfrm, 'flipV') };
}

// ─────────────────────────── Slides ───────────────────────────

interface Ctx {
  deck: Deck;
  part: string;
  theme: Theme;
  options: ImportOptions;
  warnings: Set<string>;
  layers: DraftLayer[];
  /** Pictures already read, by part (a logo on every slide is one upload). */
  pictures: Map<string, Promise<Raster | null>>;
}

const fontOfFace = (face: string, theme: Theme) => (face === '+mj-lt' ? theme.major : face === '+mn-lt' ? theme.minor : face);

async function pictureOf(ctx: Ctx, embed: string, crop: Crop): Promise<Raster | null> {
  const target = ctx.deck.rels(ctx.part).get(embed)?.target;
  if (!target) return null;
  const key = `${target}|${crop.l}|${crop.t}|${crop.r}|${crop.b}`;
  if (!ctx.pictures.has(key)) {
    ctx.pictures.set(
      key,
      (async () => {
        const bytes = ctx.deck.bytes(target);
        const ext = target.split('.').pop()?.toLowerCase() ?? '';
        const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext];
        if (!bytes || !type) {
          ctx.warnings.add(t('design.import.warn.picture'));
          return null;
        }
        try {
          const cropped = crop.l || crop.t || crop.r || crop.b;
          return await webRaster(new Blob([bytes as BlobPart], { type }), cropped ? crop : undefined);
        } catch {
          ctx.warnings.add(t('design.import.warn.picture'));
          return null;
        }
      })(),
    );
  }
  return ctx.pictures.get(key)!;
}

/** A gradient as a picture the size of its box (canvas layers have two- and three-stop gradients; decks have more). */
async function gradientRaster(fill: Extract<Fill, { type: 'gradient' }>, box: Box): Promise<Raster> {
  const k = Math.min(1, 1600 / Math.max(box.w, box.h));
  const canvas = canvasOf(box.w * k, box.h * k);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const rad = (fill.angle * Math.PI) / 180;
  const half = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  const g = fill.radial ? ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2) : ctx.createLinearGradient(w / 2 - Math.cos(rad) * half, h / 2 - Math.sin(rad) * half, w / 2 + Math.cos(rad) * half, h / 2 + Math.sin(rad) * half);
  fill.stops.forEach((c, i) => g.addColorStop(fill.stops.length === 1 ? 0 : i / (fill.stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvasRaster(canvas);
}

interface Para {
  text: string;
  size: number;
  bold: boolean;
  italic: boolean;
  face: string;
  color: { hex: string; alpha: number } | null;
  spacing: number;
  caps: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

/** A text box's paragraphs, each in the style most of its letters have. */
function paragraphsOf(body: Element, ctx: Ctx, fallbackColor: { hex: string; alpha: number } | null): Para[] {
  const bodyPr = kid(body, A, 'bodyPr');
  const autofit = kid(bodyPr, A, 'normAutofit');
  const scale = attr(autofit, 'fontScale', 100000) / 100000;
  const lineCut = attr(autofit, 'lnSpcReduction', 0) / 100000;
  const listDefault = kid(kid(kid(body, A, 'lstStyle'), A, 'lvl1pPr'), A, 'defRPr');
  const paras: Para[] = [];
  for (const p of kids(body, A, 'p')) {
    const pPr = kid(p, A, 'pPr');
    const defaults = kid(pPr, A, 'defRPr') ?? listDefault;
    let text = '';
    const runs: Array<{ len: number; rPr: Element | null }> = [];
    for (const c of p.children) {
      if (c.localName === 'r' || c.localName === 'fld') {
        const s = kid(c, A, 't')?.textContent ?? '';
        text += s;
        runs.push({ len: s.length, rPr: kid(c, A, 'rPr') });
      } else if (c.localName === 'br') text += '\n';
    }
    const main = runs.sort((a, b) => b.len - a.len)[0]?.rPr ?? kid(p, A, 'endParaRPr');
    const pick = (name: string, fallback: number) => attr(main, name, attr(defaults, name, fallback));
    const size = (pick('sz', 1800) / 100) * scale * PT;
    const algn = pPr?.getAttribute('algn') ?? 'l';
    const pct = kid(kid(pPr, A, 'lnSpc'), A, 'spcPct');
    const pts = kid(kid(pPr, A, 'lnSpc'), A, 'spcPts');
    const lineHeight = pts ? (attr(pts, 'val', 0) / 100) * PT / Math.max(1, size) : 1.2 * (attr(pct, 'val', 100000) / 100000) * (1 - lineCut);
    const face = fontOfFace(kid(main, A, 'latin')?.getAttribute('typeface') ?? kid(defaults, A, 'latin')?.getAttribute('typeface') ?? '+mn-lt', ctx.theme);
    const color = colorOf(kid(main, A, 'solidFill'), ctx.theme) ?? colorOf(kid(defaults, A, 'solidFill'), ctx.theme) ?? fallbackColor;
    paras.push({
      text,
      size,
      bold: on(main, 'b') || (!main?.hasAttribute('b') && on(defaults, 'b')),
      italic: on(main, 'i') || (!main?.hasAttribute('i') && on(defaults, 'i')),
      face,
      color,
      spacing: (pick('spc', 0) / 100) * PT / Math.max(1, size),
      caps: (main?.getAttribute('cap') ?? defaults?.getAttribute('cap')) === 'all',
      align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
      lineHeight: clamp(lineHeight, 0.7, 3),
    });
  }
  // Empty paragraphs are spacing: they stay inside the paragraph before them.
  return paras.reduce<Para[]>((out, p) => {
    const last = out[out.length - 1];
    if (last && !p.text.trim()) last.text += '\n';
    else if (p.text.trim()) out.push(p);
    return out;
  }, []);
}

function textLayers(body: Element, box: Box, rotate: number, ctx: Ctx, fallbackColor: { hex: string; alpha: number } | null, name: string) {
  const bodyPr = kid(body, A, 'bodyPr');
  if (bodyPr?.getAttribute('vert') && bodyPr.getAttribute('vert') !== 'horz') {
    ctx.warnings.add(t('design.import.warn.vertical'));
    return;
  }
  const inner = { x: box.x + attr(bodyPr, 'lIns', 91440), y: box.y + attr(bodyPr, 'tIns', 45720), w: box.w - attr(bodyPr, 'lIns', 91440) - attr(bodyPr, 'rIns', 91440), h: box.h - attr(bodyPr, 'tIns', 45720) - attr(bodyPr, 'bIns', 45720) };
  if (inner.w <= 0) return;
  const paras = paragraphsOf(body, ctx, fallbackColor);
  if (!paras.length) return;
  // Paragraphs in one style are one layer; a change of style (a title over its line) starts another.
  const same = (a: Para, b: Para) => Math.abs(a.size - b.size) <= a.size * 0.1 && a.face === b.face && a.bold === b.bold && a.color?.hex === b.color?.hex && a.align === b.align;
  const groups = paras.reduce<Para[][]>((out, p) => {
    const last = out[out.length - 1];
    if (last && same(last[0]!, p)) last.push(p);
    else out.push([p]);
    return out;
  }, []);
  // Heights, estimating wrapped lines from the box's width.
  const heights = groups.map((g) => g.reduce((sum, p) => sum + p.text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil((line.length * p.size * 0.5) / inner.w)), 0) * p.size * p.lineHeight, 0));
  const total = heights.reduce((a, b) => a + b, 0);
  const anchor = bodyPr?.getAttribute('anchor') ?? 't';
  const single = groups.length === 1;
  let y = anchor === 'ctr' ? inner.y + (inner.h - total) / 2 : anchor === 'b' ? inner.y + inner.h - total : inner.y;
  groups.forEach((g, i) => {
    const p = g[0]!;
    const f = fontFor(p.face, ctx.options.fonts, { weight: p.bold ? 700 : undefined, italic: p.italic || undefined });
    const color: ColorRef = p.color ? colorRef(p.color.hex, ctx.options.palette) : 'text';
    const frame = single ? { ...inner, h: Math.max(inner.h, total) } : { x: inner.x, y, w: inner.w, h: heights[i]! };
    if (!single && anchor !== 't' && inner.h < total) frame.y = inner.y + (y - inner.y) * (inner.h / total);
    y += heights[i]!;
    ctx.layers.push({
      type: 'layer',
      layer: {
        id: 'text',
        name: (g.map((q) => q.text).join(' ').replace(/\s+/g, ' ').trim() || name).slice(0, 60),
        kind: 'text',
        frame: { x: r1(frame.x), y: r1(frame.y), w: r1(frame.w), h: r1(frame.h), rotate: r1(rotate) },
        opacity: p.color?.alpha ?? 1,
        content: { literal: g.map((q) => q.text).join('\n') },
        style: {
          font: f.font,
          size: r1(p.size),
          weight: f.weight,
          italic: f.italic,
          color,
          align: p.align,
          valign: single ? (anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top') : 'top',
          letterSpacing: clamp(r1(p.spacing * 100) / 100, -0.2, 1),
          lineHeight: r1(p.lineHeight * 100) / 100,
          transform: p.caps ? 'upper' : 'none',
          contrast: isPaletteRef(color),
        },
        overflow: 'shrink',
      },
    });
  });
}

/** The shapes of a slide, layout or master, bottom to top. */
async function readTree(tree: Element, ctx: Ctx, map: Mapper, skipPlaceholders: boolean): Promise<void> {
  for (const el of tree.children) {
    if (el.namespaceURI !== P) continue;
    const nv = el.firstElementChild;
    if (skipPlaceholders && nv?.getElementsByTagNameNS(P, 'ph').length) continue;
    const name = nv?.getElementsByTagNameNS(P, 'cNvPr')[0]?.getAttribute('name') ?? '';
    if (el.localName === 'grpSp') {
      const xfrm = kid(kid(el, P, 'grpSpPr'), A, 'xfrm');
      const off = kid(xfrm, A, 'off');
      const ext = kid(xfrm, A, 'ext');
      const chOff = kid(xfrm, A, 'chOff');
      const chExt = kid(xfrm, A, 'chExt');
      if (!off || !ext || !chOff || !chExt) {
        await readTree(el, ctx, map, skipPlaceholders);
        continue;
      }
      if (attr(xfrm, 'rot', 0)) ctx.warnings.add(t('design.import.warn.turnedGroup'));
      const sx = attr(chExt, 'cx', 1) ? attr(ext, 'cx', 0) / attr(chExt, 'cx', 1) : 1;
      const sy = attr(chExt, 'cy', 1) ? attr(ext, 'cy', 0) / attr(chExt, 'cy', 1) : 1;
      const inner: Mapper = (b) => map({ x: attr(off, 'x', 0) + (b.x - attr(chOff, 'x', 0)) * sx, y: attr(off, 'y', 0) + (b.y - attr(chOff, 'y', 0)) * sy, w: b.w * sx, h: b.h * sy });
      await readTree(el, ctx, inner, skipPlaceholders);
      continue;
    }
    if (el.localName === 'graphicFrame') {
      ctx.warnings.add(t('design.import.warn.tables'));
      continue;
    }
    if (el.localName === 'pic') {
      const props = kid(el, P, 'spPr');
      const x = xfrmOf(props, map);
      const blipFill = kid(el, P, 'blipFill');
      const blip = kid(blipFill, A, 'blip');
      const embed = blip?.getAttributeNS(R, 'embed');
      if (!x || !embed) continue;
      const raster = await pictureOf(ctx, embed, cropOf(blipFill));
      if (!raster) continue;
      const geom = kid(props, A, 'prstGeom')?.getAttribute('prst');
      const alphaMod = kid(blip, A, 'alphaModFix');
      ctx.layers.push({
        type: 'raster',
        name: name || t('design.import.photo'),
        raster,
        frame: { x: r1(x.x), y: r1(x.y), w: r1(x.w), h: r1(x.h), rotate: r1(x.rot) },
        fit: 'cover',
        ...(alphaMod ? { opacity: attr(alphaMod, 'amt', 100000) / 100000 } : {}),
        ...(x.flipH ? { flipX: true } : {}),
        ...(x.flipV ? { flipY: true } : {}),
        ...(geom === 'ellipse' ? { mask: Math.abs(x.w - x.h) < x.w * 0.02 ? 'circle' : 'ellipse' } : geom === 'roundRect' ? { mask: 'rounded', radius: r1(Math.min(x.w, x.h) * 0.16667) } : {}),
      });
      continue;
    }
    if (el.localName !== 'sp' && el.localName !== 'cxnSp') continue;
    const props = kid(el, P, 'spPr');
    const x = xfrmOf(props, map);
    if (!x) continue;
    const style = kid(el, P, 'style');
    const geom = kid(props, A, 'prstGeom');
    const prst = el.localName === 'cxnSp' ? 'line' : (geom?.getAttribute('prst') ?? (kid(props, A, 'custGeom') ? 'custom' : 'rect'));
    const shape = GEOMETRY[prst];
    let fill = fillOf(props, ctx.theme);
    if (!fill && attr(kid(style, A, 'fillRef'), 'idx', 0) > 0) {
      const c = colorOf(kid(style, A, 'fillRef'), ctx.theme);
      if (c) fill = { type: 'solid', ...c };
    }
    const ln = kid(props, A, 'ln');
    const lnFill = ln ? fillOf(ln, ctx.theme) : null;
    const lnStyle = !ln || !lnFill ? colorOf(kid(style, A, 'lnRef'), ctx.theme) : null;
    const stroke = lnFill?.type === 'solid' ? lnFill : lnFill?.type === 'none' ? null : lnStyle && attr(kid(style, A, 'lnRef'), 'idx', 0) > 0 ? { type: 'solid' as const, ...lnStyle } : null;
    const strokeWidth = stroke ? attr(ln, 'w', 12700) : 0;
    const frame = { x: r1(x.x), y: r1(x.y), w: r1(Math.max(1, x.w)), h: r1(Math.max(1, x.h)), rotate: r1(x.rot) };

    if (shape === 'line') {
      if (stroke) {
        // From one corner of its box to the other (flips choose which).
        const x1 = x.flipH ? x.x + x.w : x.x;
        const y1 = x.flipV ? x.y + x.h : x.y;
        const x2 = x.flipH ? x.x : x.x + x.w;
        const y2 = x.flipV ? x.y : x.y + x.h;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const h = Math.max(strokeWidth, 2 * PT * 0.1);
        const color = colorRef(stroke.hex, ctx.options.palette);
        ctx.layers.push({ type: 'layer', layer: { id: 'line', name: name.slice(0, 60) || undefined, kind: 'shape', shape: 'line', frame: { x: r1((x1 + x2) / 2 - len / 2), y: r1((y1 + y2) / 2 - h / 2), w: r1(Math.max(1, len)), h: r1(h), rotate: r1(x.rot + (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI) }, opacity: stroke.alpha, fill: { type: 'color', color }, stroke: { width: r1(strokeWidth), color } } });
      }
    } else if (fill && fill.type !== 'none') {
      if (!shape) ctx.warnings.add(t('design.import.warn.shapes'));
      else if (fill.type === 'solid') {
        const adj = kid(geom ? kid(geom, A, 'avLst') : null, A, 'gd')?.getAttribute('fmla')?.match(/val (\d+)/);
        const radius = prst === 'roundRect' ? (Math.min(x.w, x.h) * (adj ? Number(adj[1]) : 16667)) / 100000 : 0;
        ctx.layers.push({ type: 'layer', layer: { id: shape, name: name.slice(0, 60) || undefined, kind: 'shape', shape, frame, opacity: fill.alpha, fill: { type: 'color', color: colorRef(fill.hex, ctx.options.palette) }, ...(stroke ? { stroke: { width: r1(strokeWidth), color: colorRef(stroke.hex, ctx.options.palette) } } : {}), radius: r1(radius) } });
      } else {
        // Gradients and picture fills: drawn as a picture in the shape (rectangles and ovals).
        const raster = fill.type === 'gradient' ? await gradientRaster(fill, x) : await pictureOf(ctx, fill.embed, fill.crop);
        if (raster) ctx.layers.push({ type: 'raster', name: name || t('design.import.art'), raster, frame, fit: 'cover', ...(shape === 'ellipse' ? { mask: 'ellipse' as const } : prst === 'roundRect' ? { mask: 'rounded' as const, radius: r1(Math.min(x.w, x.h) * 0.16667) } : {}) });
      }
    } else if (stroke && shape) {
      ctx.layers.push({ type: 'layer', layer: { id: shape, name: name.slice(0, 60) || undefined, kind: 'shape', shape, frame, opacity: stroke.alpha, fill: { type: 'none' }, stroke: { width: r1(strokeWidth), color: colorRef(stroke.hex, ctx.options.palette) } } });
    }

    const body = kid(el, P, 'txBody');
    if (body && ctx.options.editableText) {
      const fontRef = kid(style, A, 'fontRef');
      textLayers(body, x, x.rot, ctx, fontRef ? colorOf(fontRef, ctx.theme) : null, name);
    } else if (body && body.textContent?.trim()) ctx.warnings.add(t('design.import.warn.flatText'));
  }
}

/** A slide's background: its own, else its layout's, else its master's. */
async function backgroundOf(parts: string[], ctx: Ctx, size: Box): Promise<{ color?: string; layer?: DraftLayer }> {
  for (const part of parts) {
    const bg = ctx.deck.xml(part)?.getElementsByTagNameNS(P, 'bg')[0];
    if (!bg) continue;
    const local = { ...ctx, part };
    const props = kid(bg, P, 'bgPr');
    const fill = props ? fillOf(props, ctx.theme) : null;
    const ref = kid(bg, P, 'bgRef');
    if (fill?.type === 'solid') return { color: fill.hex };
    if (fill?.type === 'gradient') return { layer: { type: 'raster', name: t('design.import.background'), raster: await gradientRaster(fill, size), frame: { ...size, rotate: 0 }, locked: true, fit: 'cover' } };
    if (fill?.type === 'image') {
      const raster = await pictureOf(local, fill.embed, fill.crop);
      if (raster) return { layer: { type: 'raster', name: t('design.import.background'), raster, frame: { ...size, rotate: 0 }, locked: true, fit: 'cover' } };
    }
    if (ref) {
      const c = colorOf(ref, ctx.theme);
      if (c) return { color: c.hex };
    }
  }
  return {};
}

export const importPptx: Importer = async (file, options) => {
  const files = await unzip(await file.arrayBuffer(), (n) => n.startsWith('ppt/'));
  const deck = new Deck(files);
  const pres = deck.xml('ppt/presentation.xml');
  if (!pres) throw new Error(t('design.import.error.unreadable'));
  const sz = pres.getElementsByTagNameNS(P, 'sldSz')[0];
  const W = attr(sz, 'cx', 12_192_000);
  const H = attr(sz, 'cy', 6_858_000);
  const rels = deck.rels('ppt/presentation.xml');
  const slides = [...pres.getElementsByTagNameNS(P, 'sldId')].map((s) => rels.get(s.getAttributeNS(R, 'id') ?? '')?.target).filter((p): p is string => !!p);
  if (!slides.length) throw new Error(t('design.import.error.empty'));
  const warnings = new Set<string>();
  if (slides.length > MAX_SLIDES) warnings.add(t('design.import.warn.pages', { count: MAX_SLIDES }));
  const pictures = new Map<string, Promise<Raster | null>>();
  const pages: ImportedPage[] = [];
  const identity: Mapper = (b) => b;
  for (const [i, slide] of slides.slice(0, MAX_SLIDES).entries()) {
    const layout = deck.related(slide, 'slideLayout');
    const master = layout ? deck.related(layout, 'slideMaster') : null;
    const theme = themeOf(deck, master);
    const layers: DraftLayer[] = [];
    const ctx: Ctx = { deck, part: slide, theme, options, warnings, layers, pictures };
    const size = { x: 0, y: 0, w: W, h: H };
    const bg = await backgroundOf([slide, layout, master].filter((p): p is string => !!p), ctx, size);
    if (bg.layer) layers.push(bg.layer);
    // What the master and the layout draw on every slide (not their placeholders), unless the slide hides it.
    const slideDoc = deck.xml(slide);
    const showMaster = slideDoc?.documentElement.getAttribute('showMasterSp') !== '0';
    for (const part of showMaster ? [master, layout] : []) {
      const tree = part ? deck.xml(part)?.getElementsByTagNameNS(P, 'spTree')[0] : null;
      if (tree) await readTree(tree, { ...ctx, part: part! }, identity, true);
    }
    const tree = slideDoc?.getElementsByTagNameNS(P, 'spTree')[0];
    if (tree) await readTree(tree, ctx, identity, false);
    pages.push({ name: slides.length > 1 ? `${fileBase(file.name)} · ${i + 1}` : fileBase(file.name), width: W, height: H, ...(bg.color ? { background: colorRef(bg.color, options.palette) } : {}), layers });
  }
  return { format: 'pptx', pages, warnings: [...warnings] };
};
