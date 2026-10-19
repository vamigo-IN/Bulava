import { t } from '@/lib/i18n';
import { blocksOf, canvasOf, canvasRaster, clamp, colorRef, cropCanvas, cssColor, dataUrlBlob, fileBase, fontFor, inkBounds, r1, textLayer, webRaster, type TextBlock, type TextLine } from './common';
import type { DraftLayer, Importer, ImportOptions } from './types';

/**
 * SVG from Figma, Illustrator, Inkscape, CorelDRAW or Canva. The file is
 * cleaned first (drawing only: no scripts, handlers, outside links or foreign
 * content), measured in a hidden copy, then read in paint order: words become
 * text layers, plain rectangles, circles and lines shape layers, embedded
 * photos pictures, and the art between them pictures drawn from the file.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAINTED = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use']);
const UNPAINTED = new Set(['defs', 'symbol', 'clipPath', 'mask', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'filter', 'style', 'title', 'desc']);
const ALLOWED = new Set([
  ...PAINTED,
  ...UNPAINTED,
  'svg',
  'g',
  'a',
  'switch',
  'tspan',
  'textPath',
  'stop',
  ...['Blend', 'ColorMatrix', 'ComponentTransfer', 'Composite', 'ConvolveMatrix', 'DiffuseLighting', 'DisplacementMap', 'DistantLight', 'DropShadow', 'Flood', 'FuncA', 'FuncB', 'FuncG', 'FuncR', 'GaussianBlur', 'Merge', 'MergeNode', 'Morphology', 'Offset', 'PointLight', 'SpecularLighting', 'SpotLight', 'Tile', 'Turbulence'].map((f) => `fe${f}`),
]);
const SAFE_HREF = /^(#|data:image\/(png|jpe?g|webp|gif);)/i;
const OUTSIDE_URL = /url\(\s*['"]?(?!#|data:)[^)]*\)/gi;
const hasOutsideUrl = (v: string) => /url\(\s*['"]?(?!#|data:)/i.test(v);

/** Drawing only: no scripts, event handlers, links out, foreign content or animation. */
function clean(root: Element) {
  for (const el of [...root.querySelectorAll('*')]) {
    if (el.namespaceURI !== SVG_NS || !ALLOWED.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (name.endsWith('href') && !SAFE_HREF.test(attr.value.trim()))) el.removeAttribute(attr.name);
      else if (hasOutsideUrl(attr.value)) el.setAttribute(attr.name, attr.value.replace(OUTSIDE_URL, 'none'));
    }
    if (el.localName === 'style') el.textContent = (el.textContent ?? '').replace(/@import[^;]*;?/gi, '').replace(OUTSIDE_URL, 'none');
  }
  for (const attr of [...root.attributes]) if (attr.name.toLowerCase().startsWith('on')) root.removeAttribute(attr.name);
}

const UNIT: Record<string, number> = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
function length(value: string | null): number | null {
  const m = value?.trim().match(/^([\d.]+)\s*(px|pt|pc|mm|cm|in)?$/);
  return m ? Number(m[1]) * UNIT[m[2] ?? 'px']! : null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const union = (a: Box | null, b: Box): Box => {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** The element's drawing in page units relative to the root: offset, scale, rotation (degrees), and whether it is skewed or stretched. */
function placement(el: SVGGraphicsElement, root: SVGSVGElement) {
  const m = root.getScreenCTM()!.inverse().multiply(el.getScreenCTM()!);
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  const skew = Math.abs(m.a * m.c + m.b * m.d) / Math.max(1e-6, sx * sy);
  return { m, scale: Math.sqrt(sx * sy), rotate: (Math.atan2(m.b, m.a) * 180) / Math.PI, distorted: skew > 0.02 || Math.abs(sx - sy) / Math.max(sx, sy) > 0.15 };
}

/** An element's own box (its geometry, unrotated) as a frame on the page, turned as it is drawn. */
function frameOf(el: SVGGraphicsElement, root: SVGSVGElement) {
  const { m, scale, rotate } = placement(el, root);
  const b = el.getBBox();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const px = m.a * cx + m.c * cy + m.e;
  const py = m.b * cx + m.d * cy + m.f;
  const w = Math.max(1, b.width * scale);
  const h = Math.max(1, b.height * scale);
  return { x: r1(px - w / 2), y: r1(py - h / 2), w: r1(w), h: r1(h), rotate: r1(rotate), scale };
}

/** What an element and the groups around it do that only a picture can keep (clips, masks, filters). */
function effects(el: Element, root: Element): boolean {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const s = getComputedStyle(node);
    if ((s.clipPath && s.clipPath !== 'none') || (s.mask && s.mask !== 'none') || (s.maskImage && s.maskImage !== 'none') || (s.filter && s.filter !== 'none')) return true;
  }
  return false;
}

function opacityOf(el: Element, root: Element): number {
  let o = 1;
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) o *= Number(getComputedStyle(node).opacity || 1);
  return o;
}

/** The lines of a text element: tspans placed on a new line (y, dy) start one. */
function textLines(el: Element): string[] {
  const out = [''];
  let y = el.getAttribute('y');
  const visit = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out[out.length - 1] += child.textContent ?? '';
      else if (child instanceof Element && child.localName === 'tspan') {
        const ty = child.getAttribute('y');
        const dy = parseFloat(child.getAttribute('dy') ?? '0');
        if (out[out.length - 1]!.trim() && ((ty !== null && ty !== y) || dy !== 0)) out.push('');
        if (ty !== null) y = ty;
        visit(child);
      }
    }
  };
  visit(el);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

type Piece = { el: SVGGraphicsElement; kind: 'raster' } | { el: SVGGraphicsElement; kind: 'line'; line: TextLine } | { el: SVGGraphicsElement; kind: 'block'; block: TextBlock; rotate: number; opacity: number } | { el: SVGGraphicsElement; kind: 'layer'; layer: DraftLayer } | { el: SVGImageElement; kind: 'image' };

function classify(el: SVGGraphicsElement, root: SVGSVGElement, options: ImportOptions): Piece | null {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  const tag = el.localName;
  if (effects(el, root)) return { el, kind: 'raster' };
  const { distorted, rotate, scale } = placement(el, root);
  const opacity = opacityOf(el, root);

  if (tag === 'text') {
    const fill = cssColor(style.fill);
    const stroked = style.stroke !== 'none' && parseFloat(style.strokeWidth) * scale > 0.5;
    if (!options.editableText || distorted || stroked || !fill || el.querySelector('textPath')) return { el, kind: 'raster' };
    const lines = textLines(el);
    if (!lines.length) return null;
    const family = style.fontFamily.split(',')[0]!.trim();
    const weight = style.fontWeight === 'bold' ? 700 : Number(style.fontWeight) || 400;
    const font = fontFor(family, options.fonts, { weight, italic: style.fontStyle !== 'normal' });
    const size = parseFloat(style.fontSize) * scale;
    const spacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) / Math.max(1, parseFloat(style.fontSize));
    const anchor = style.textAnchor === 'middle' ? 'center' : style.textAnchor === 'end' ? 'right' : 'left';
    const f = frameOf(el, root);
    const base = { key: `${family}|${weight}|${style.fontStyle}`, size, font: font.font, weight: font.weight, italic: font.italic, color: fill.hex, alpha: fill.alpha * Number(style.fillOpacity || 1), letterSpacing: spacing, align: anchor as TextLine['align'], upper: style.textTransform === 'uppercase' };
    if (lines.length === 1 && Math.abs(rotate) < 0.5) {
      // The first letter's baseline, on the page.
      const start = (el as SVGTextElement).getNumberOfChars() ? (el as SVGTextElement).getStartPositionOfChar(0) : null;
      const m = placement(el, root).m;
      const baseline = start ? m.b * start.x + m.d * start.y + m.f : f.y + f.h * 0.8;
      return { el, kind: 'line', line: { ...base, text: lines[0]!, x: f.x, y: f.y, w: f.w, h: f.h, baseline } };
    }
    const n = lines.length;
    const block: TextBlock = {
      align: anchor,
      lineHeight: clamp(r1((f.h / n / Math.max(1, size)) * 100) / 100, 0.7, 3),
      lines: lines.map((text, i) => ({ ...base, text, x: f.x, y: f.y + (i * f.h) / n, w: f.w, h: f.h / n, baseline: f.y + ((i + 0.8) * f.h) / n })),
    };
    return { el, kind: 'block', block, rotate, opacity };
  }

  if (tag === 'image') {
    const href = el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
    return href.startsWith('data:') ? { el: el as SVGImageElement, kind: 'image' } : null;
  }

  if ((tag === 'rect' || tag === 'circle' || tag === 'ellipse' || tag === 'line') && !distorted) {
    const fill = cssColor(style.fill);
    const stroke = cssColor(style.stroke);
    const strokeWidth = stroke ? parseFloat(style.strokeWidth) * scale : 0;
    // Gradients and patterns are paint servers: only a picture keeps them.
    if ((style.fill !== 'none' && !fill) || (style.stroke !== 'none' && !stroke)) return { el, kind: 'raster' };
    const fillOpacity = Number(style.fillOpacity || 1);
    const strokeOpacity = Number(style.strokeOpacity || 1);
    if (tag === 'line') {
      if (!stroke) return null;
      const l = el as SVGLineElement;
      const m = placement(el, root).m;
      const pt = (x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
      const a = pt(l.x1.baseVal.value, l.y1.baseVal.value);
      const b = pt(l.x2.baseVal.value, l.y2.baseVal.value);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const h = Math.max(2, strokeWidth);
      const frame = { x: r1((a.x + b.x) / 2 - len / 2), y: r1((a.y + b.y) / 2 - h / 2), w: r1(Math.max(1, len)), h: r1(h), rotate: r1((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) };
      const color = colorRef(stroke.hex, options.palette);
      return { el, kind: 'layer', layer: { type: 'layer', layer: { id: 'line', kind: 'shape', shape: 'line', frame, opacity: opacity * stroke.alpha * strokeOpacity, fill: { type: 'color', color }, stroke: { width: r1(Math.max(0.5, strokeWidth)), color } } } };
    }
    const frame = frameOf(el, root);
    const rx = tag === 'rect' ? (el as SVGRectElement).rx.baseVal.value * scale : 0;
    return {
      el,
      kind: 'layer',
      layer: {
        type: 'layer',
        layer: {
          id: tag === 'rect' ? 'rect' : 'ellipse',
          kind: 'shape',
          shape: tag === 'rect' ? 'rect' : 'ellipse',
          frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h, rotate: frame.rotate },
          opacity: opacity * (fill ? fill.alpha * fillOpacity : stroke ? stroke.alpha * strokeOpacity : 1),
          fill: fill ? { type: 'color', color: colorRef(fill.hex, options.palette) } : { type: 'none' },
          ...(stroke && strokeWidth > 0 ? { stroke: { width: r1(strokeWidth), color: colorRef(stroke.hex, options.palette) } } : {}),
          radius: r1(rx),
        },
      },
    };
  }
  return { el, kind: 'raster' };
}

/** How much wider than its geometry an element draws (its stroke, a shadow or blur). */
function bleed(el: Element, scale: number): number {
  const s = getComputedStyle(el);
  const stroke = s.stroke !== 'none' ? (parseFloat(s.strokeWidth) || 0) * scale : 0;
  return stroke / 2 + 2;
}

export const importSvg: Importer = async (file, options) => {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const source = doc.documentElement;
  if (doc.querySelector('parsererror') || source.namespaceURI !== SVG_NS || source.localName !== 'svg') throw new Error(t('design.import.error.unreadable'));
  clean(source);

  const vb = source.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const hasViewBox = vb?.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0;
  const width = hasViewBox ? vb![2]! : (length(source.getAttribute('width')) ?? 1000);
  const height = hasViewBox ? vb![3]! : (length(source.getAttribute('height')) ?? 1000);
  const origin = hasViewBox ? { x: vb![0]!, y: vb![1]! } : { x: 0, y: 0 };

  // Number what paints, in paint order (not what is only referenced: defs, symbols, clips, masks, patterns).
  let n = 0;
  const walk = (el: Element) => {
    for (const child of el.children) {
      if (UNPAINTED.has(child.localName)) continue;
      if (PAINTED.has(child.localName)) child.setAttribute('data-bv', String(n++));
      else walk(child);
    }
  };
  walk(source);
  // Elements a <use> draws again keep their place in the drawing even when they are not drawn themselves.
  const reused = new Set([...source.querySelectorAll('use')].map((u) => (u.getAttribute('href') ?? u.getAttribute('xlink:href') ?? '').replace(/^#/, '')).filter(Boolean));

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;';
  const root = document.importNode(source, true) as unknown as SVGSVGElement;
  root.setAttribute('viewBox', `${origin.x} ${origin.y} ${width} ${height}`);
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  root.setAttribute('preserveAspectRatio', 'none');
  host.append(root);
  document.body.append(host);

  const warnings: string[] = [];
  try {
    const rootBox = root.getBoundingClientRect();
    const pieces = [...root.querySelectorAll<SVGGraphicsElement>('[data-bv]')].map((el) => classify(el, root, options)).filter((p): p is Piece => !!p);
    // Pictures stay few: past this, all the art is one picture under the words.
    const runs = pieces.filter((p, i) => p.kind === 'raster' && pieces[i - 1]?.kind !== 'raster').length;
    const merged = runs > 40;
    if (merged) warnings.push(t('design.import.warn.merged'));
    const ordered = merged ? [...pieces.filter((p) => p.kind === 'raster'), ...pieces.filter((p) => p.kind !== 'raster')] : pieces;
    const res = clamp(2400 / Math.max(width, height), 0.5, 8);

    const draw = async (els: SVGGraphicsElement[]): Promise<DraftLayer | null> => {
      let box: Box | null = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const pad = bleed(el, placement(el, root).scale) + (getComputedStyle(el).filter !== 'none' ? Math.max(r.width, r.height) * 0.15 : 0);
        box = union(box, { x: r.left - rootBox.left - pad, y: r.top - rootBox.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
      }
      if (!box) return null;
      // Only what is on the page.
      const x = Math.max(0, box.x);
      const y = Math.max(0, box.y);
      const page: Box = { x, y, w: Math.min(width, box.x + box.w) - x, h: Math.min(height, box.y + box.h) - y };
      if (page.w <= 0 || page.h <= 0) return null;
      const k = Math.min(res, 4096 / Math.max(page.w, page.h));
      const keep = new Set(els.map((el) => el.getAttribute('data-bv')));
      const clone = source.cloneNode(true) as Element;
      const shelf = doc.createElementNS(SVG_NS, 'defs');
      clone.prepend(shelf);
      for (const el of [...clone.querySelectorAll('[data-bv]')]) {
        if (keep.has(el.getAttribute('data-bv'))) continue;
        if (el.id && reused.has(el.id)) shelf.append(el);
        else el.remove();
      }
      clone.setAttribute('viewBox', `${origin.x + page.x} ${origin.y + page.y} ${page.w} ${page.h}`);
      clone.setAttribute('width', String(Math.round(page.w * k)));
      clone.setAttribute('height', String(Math.round(page.h * k)));
      clone.setAttribute('preserveAspectRatio', 'none');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = canvasOf(page.w * k, page.h * k);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const ink = inkBounds(canvas);
        if (!ink) return null;
        const raster = await canvasRaster(cropCanvas(canvas, ink));
        return { type: 'raster', name: t('design.import.art'), raster, frame: { x: r1(page.x + ink.x / k), y: r1(page.y + ink.y / k), w: r1(ink.w / k), h: r1(ink.h / k), rotate: 0 } };
      } catch {
        warnings.push(t('design.import.warn.art'));
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    const layers: DraftLayer[] = [];
    let run: SVGGraphicsElement[] = [];
    let lines: TextLine[] = [];
    const flushRun = async () => {
      if (!run.length) return;
      const art = await draw(run);
      if (art) layers.push(art);
      run = [];
    };
    const flushText = () => {
      for (const block of blocksOf(lines, width)) layers.push(textLayer(block, options));
      lines = [];
    };
    for (const piece of ordered) {
      if (piece.kind === 'raster') {
        flushText();
        run.push(piece.el);
        continue;
      }
      await flushRun();
      if (piece.kind === 'line') {
        lines.push(piece.line);
        continue;
      }
      flushText();
      if (piece.kind === 'block') layers.push(textLayer(piece.block, options, { rotate: piece.rotate, opacity: piece.opacity }));
      else if (piece.kind === 'layer') layers.push(piece.layer);
      else {
        const href = piece.el.getAttribute('href') ?? piece.el.getAttribute('xlink:href') ?? '';
        const blob = dataUrlBlob(href);
        if (!blob) continue;
        try {
          const raster = await webRaster(blob);
          const f = frameOf(piece.el, root);
          const fit = /slice/.test(piece.el.getAttribute('preserveAspectRatio') ?? '') ? 'cover' : 'contain';
          layers.push({ type: 'raster', name: t('design.import.photo'), raster, frame: { x: f.x, y: f.y, w: f.w, h: f.h, rotate: f.rotate }, opacity: opacityOf(piece.el, root), ...(fit === 'cover' ? { fit } : {}) });
        } catch {
          warnings.push(t('design.import.warn.picture'));
        }
      }
    }
    flushText();
    await flushRun();
    return { format: 'svg', pages: [{ name: fileBase(file.name), width, height, layers }], warnings };
  } finally {
    host.remove();
  }
};
