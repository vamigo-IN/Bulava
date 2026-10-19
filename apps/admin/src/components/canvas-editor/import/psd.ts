import { getCompositeCanvas, getLayerCanvas, getLayerMaskCanvas, readPsd, type Color, type Layer as PsdLayer } from 'ag-psd';
import { t } from '@/lib/i18n';
import { canvasOf, canvasRaster, clamp, fileBase, fontFor, inkBounds, cropCanvas, r1, textLayer, toHex, type TextLine } from './common';
import type { BlendMode, DraftLayer, Importer } from './types';

/**
 * Photoshop documents (and Affinity, Photopea or Procreate files saved as
 * PSD), read with ag-psd: every visible layer in its place, groups kept as
 * groups, layer masks and clipping masks applied, and type layers as text
 * layers in their font, size, colour and alignment. Layer styles (shadows,
 * strokes) and adjustment layers have no pixels of their own to bring.
 */

const MAX_SIDE = 12_000;
const MAX_LAYERS = 400;
/** Past this many pictures, neighbouring ones are joined (the editor's boards hold 120 layers). */
const MAX_PICTURES = 80;

const BLENDS: Partial<Record<string, BlendMode>> = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', 'soft light': 'soft-light' };
const CANVAS_BLENDS: Partial<Record<string, GlobalCompositeOperation>> = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', 'soft light': 'soft-light', darken: 'darken', lighten: 'lighten', 'color burn': 'color-burn', 'color dodge': 'color-dodge', 'hard light': 'hard-light', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity' };

function psdColor(c: Color | undefined): string {
  if (!c) return '#000000';
  if ('r' in c) return toHex(c.r, c.g, c.b);
  if ('fr' in c) return toHex(c.fr * 255, c.fg * 255, c.fb * 255);
  if ('c' in c) {
    const n = Math.max(c.c, c.m, c.y, c.k) > 100 ? 255 : 100;
    const k = c.k / n;
    return toHex(255 * (1 - c.c / n) * (1 - k), 255 * (1 - c.m / n) * (1 - k), 255 * (1 - c.y / n) * (1 - k));
  }
  if ('k' in c) return toHex(255 - c.k, 255 - c.k, 255 - c.k);
  return '#000000';
}

interface Entry {
  layer: PsdLayer;
  group?: string;
  opacity: number;
}

/** A layer style that is switched on (shadows, strokes, glows…). */
const enabled = (v: unknown) => !!v && typeof v === 'object' && (v as { enabled?: boolean }).enabled !== false;

const bounds = (l: PsdLayer) => ({ x: l.left ?? 0, y: l.top ?? 0, w: (l.right ?? 0) - (l.left ?? 0), h: (l.bottom ?? 0) - (l.top ?? 0) });

/** A layer's pixels with its layer mask applied. */
function pixels(layer: PsdLayer): HTMLCanvasElement | null {
  const canvas = getLayerCanvas(layer);
  if (!canvas || !canvas.width || !canvas.height) return null;
  const mask = layer.mask;
  if (!mask || mask.disabled) return canvas;
  const maskCanvas = getLayerMaskCanvas(layer);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const m = maskCanvas?.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const outside = mask.defaultColor ?? 255;
  const dx = (layer.left ?? 0) - (mask.left ?? 0);
  const dy = (layer.top ?? 0) - (mask.top ?? 0);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const mx = x + dx;
      const my = y + dy;
      const v = m && mx >= 0 && my >= 0 && mx < m.width && my < m.height ? m.data[(my * m.width + mx) * 4]! : outside;
      const i = (y * canvas.width + x) * 4 + 3;
      img.data[i] = (img.data[i]! * v) / 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Several layers drawn into one picture: a layer and those clipped to it, or neighbours joined to stay within the board's layers. */
async function composite(entries: Entry[], clip: boolean): Promise<DraftLayer | null> {
  const drawn = entries.map((e) => ({ e, canvas: pixels(e.layer), box: bounds(e.layer) })).filter((d) => d.canvas);
  if (!drawn.length) return null;
  const base = drawn[0]!;
  const area = clip ? base.box : drawn.reduce((a, d) => ({ x: Math.min(a.x, d.box.x), y: Math.min(a.y, d.box.y), r: Math.max(a.r, d.box.x + d.box.w), b: Math.max(a.b, d.box.y + d.box.h) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
  const box = 'r' in area ? { x: area.x, y: area.y, w: area.r - area.x, h: area.b - area.y } : area;
  const out = canvasOf(box.w, box.h);
  const ctx = out.getContext('2d')!;
  // One layer, or a clipped stack: its base is drawn as it is (the layer keeps its opacity and blend); joined neighbours are mixed here.
  const own = clip || drawn.length === 1;
  for (const [i, d] of drawn.entries()) {
    ctx.globalAlpha = own && i === 0 ? 1 : d.e.opacity;
    ctx.globalCompositeOperation = clip ? (i > 0 ? 'source-atop' : 'source-over') : own ? 'source-over' : (CANVAS_BLENDS[d.e.layer.blendMode ?? 'normal'] ?? 'source-over');
    ctx.drawImage(d.canvas!, d.box.x - box.x, d.box.y - box.y);
  }
  const ink = inkBounds(out);
  if (!ink) return null;
  return {
    type: 'raster',
    name: (base.e.layer.name ?? t('design.import.art')).slice(0, 60),
    raster: await canvasRaster(cropCanvas(out, ink)),
    frame: { x: box.x + ink.x, y: box.y + ink.y, w: ink.w, h: ink.h, rotate: 0 },
    ...(own && base.e.opacity < 1 ? { opacity: base.e.opacity } : {}),
    ...(base.e.group ? { group: base.e.group } : {}),
  };
}

export const importPsd: Importer = async (file, options) => {
  const buffer = await file.arrayBuffer();
  let psd: ReturnType<typeof readPsd>;
  try {
    // Structure first; pixels are decoded a layer at a time below.
    psd = readPsd(buffer, { useRawData: true, useRawThumbnail: true, skipThumbnail: true, skipLinkedFilesData: true });
  } catch {
    throw new Error(t('design.import.error.unreadable'));
  }
  if (psd.width > MAX_SIDE || psd.height > MAX_SIDE || (psd.bitsPerChannel ?? 8) > 16) throw new Error(t('design.import.error.tooLarge'));
  const warnings = new Set<string>();

  // Visible layers, bottom to top, with the group they were in and the groups' opacity.
  const entries: Entry[] = [];
  const groups = new Map<PsdLayer, string>();
  const walk = (children: PsdLayer[] | undefined, group: string | undefined, opacity: number) => {
    for (const layer of children ?? []) {
      if (layer.hidden) continue;
      if (entries.length > MAX_LAYERS) throw new Error(t('design.import.error.tooLarge'));
      const o = opacity * (layer.opacity ?? 1);
      if (layer.children) {
        if (!groups.has(layer)) groups.set(layer, `psd${groups.size + 1}`);
        walk(layer.children, groups.get(layer), o);
        continue;
      }
      const b = bounds(layer);
      if (b.w > MAX_SIDE || b.h > MAX_SIDE) throw new Error(t('design.import.error.tooLarge'));
      if (layer.effects && !layer.effects.disabled && Object.values(layer.effects).some((v) => (Array.isArray(v) ? v.some(enabled) : enabled(v)))) warnings.add(t('design.import.warn.effects'));
      if (layer.adjustment) {
        warnings.add(t('design.import.warn.adjustments'));
        continue;
      }
      if (layer.blendMode && layer.blendMode !== 'normal' && layer.blendMode !== 'pass through' && !BLENDS[layer.blendMode]) warnings.add(t('design.import.warn.blend'));
      entries.push({ layer, group, opacity: o });
    }
  };
  walk(psd.children, undefined, 1);

  const name = fileBase(file.name);
  if (!options.editableText || !entries.length) {
    // The document as Photoshop saved it (with its layer styles), as one picture.
    const canvas = getCompositeCanvas(psd);
    if (!canvas) throw new Error(t('design.import.error.unreadable'));
    return { format: 'psd', pages: [{ name, width: psd.width, height: psd.height, layers: [{ type: 'raster', name, raster: await canvasRaster(canvas), frame: { x: 0, y: 0, w: psd.width, h: psd.height, rotate: 0 }, locked: true }] }], warnings: [...warnings] };
  }

  // Stacks: a layer with the layers clipped to it; type layers on their own.
  const stacks: Entry[][] = [];
  for (const entry of entries) {
    const last = stacks[stacks.length - 1];
    if (entry.layer.clipping && last && !last[0]!.layer.text) last.push(entry);
    else stacks.push([entry]);
  }
  const pictures = stacks.filter((s) => !s[0]!.layer.text).length;
  const join = pictures > MAX_PICTURES;
  if (join) warnings.add(t('design.import.warn.merged'));

  const layers: DraftLayer[] = [];
  let pending: Entry[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const art = await composite(pending, false);
    if (art) layers.push(art);
    pending = [];
  };
  for (const stack of stacks) {
    const { layer, group, opacity } = stack[0]!;
    const text = layer.text;
    const b = bounds(layer);
    if (text && text.text.trim()) {
      const m = text.transform ?? [1, 0, 0, 1, 0, 0];
      const rotate = (Math.atan2(m[1]!, m[0]!) * 180) / Math.PI;
      if (Math.abs(rotate) <= 1 && b.w > 0 && b.h > 0) {
        await flush();
        const run = text.styleRuns?.[0]?.style ?? {};
        const style = { ...text.style, ...run };
        const lines = text.text.split(/\r\n?|\n/).map((l) => l.trim());
        const count = Math.max(1, lines.length);
        let size = (style.fontSize ?? 24) * Math.sqrt(Math.abs(m[0]! * m[3]! - m[1]! * m[2]!));
        // Sizes are kept in points at the document's resolution; the letters' own height settles which.
        if (size * count * 1.25 > b.h * 2.2 || size * count * 1.25 < b.h * 0.45) size = b.h / count / 1.15;
        const f = fontFor(style.font?.name ?? '', options.fonts, style.fauxBold ? { weight: 700 } : {});
        const justify = text.paragraphStyle?.justification ?? 'left';
        const align = justify.includes('center') ? 'center' : justify.includes('right') ? 'right' : 'left';
        const lineHeight = !style.autoLeading && style.leading ? clamp(r1((style.leading / Math.max(1, style.fontSize ?? 24)) * 100) / 100, 0.7, 3) : 1.2;
        const color = psdColor(style.fillColor);
        const lineH = b.h / count;
        const textLines: TextLine[] = lines.map((l, i) => ({ text: l, x: b.x, y: b.y + i * lineH, w: b.w, h: lineH, baseline: b.y + (i + 0.8) * lineH, size, key: '', font: f.font, weight: f.weight, italic: f.italic || !!style.fauxItalic, color, alpha: 1, letterSpacing: (style.tracking ?? 0) / 1000, upper: style.fontCaps === 2 }));
        const draft = textLayer({ lines: textLines.filter((l) => l.text), align, lineHeight }, options, { opacity });
        if (draft.type === 'layer') {
          draft.layer.name = (layer.name ?? draft.layer.name ?? '').slice(0, 60);
          if (group) draft.layer.group = group;
          const blend = BLENDS[layer.blendMode ?? ''];
          if (blend) draft.layer.blend = blend;
        }
        layers.push(draft);
        continue;
      }
    }
    if (join) {
      pending.push(...stack);
      continue;
    }
    const art = await composite(stack, stack.length > 1);
    if (!art) continue;
    if (art.type === 'raster') {
      const blend = BLENDS[layer.blendMode ?? ''];
      if (blend) art.blend = blend;
      // Photoshop's bottom "Background" layer stays put while the rest is moved.
      if (layer === entries[0]!.layer && b.w >= psd.width && b.h >= psd.height) art.locked = true;
    }
    layers.push(art);
  }
  await flush();
  return { format: 'psd', pages: [{ name, width: psd.width, height: psd.height, layers }], warnings: [...warnings] };
};
