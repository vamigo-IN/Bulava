import { ArtboardSchema, LayerSchema, type Artboard, type Layer, type LayerInput } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { layerId } from '../presets';
import { readClipboard } from '../selection';
import { clamp, fileBase, r1, webRaster } from './common';
import type { DraftLayer, ImportedPage, Importer, ImportResult, Raster } from './types';

export type { ImportedPage, ImportOptions, ImportResult, Raster } from './types';

/** What the file picker offers. */
export const IMPORT_ACCEPT = '.pdf,.ai,.svg,.psd,.pptx,.png,.jpg,.jpeg,.webp,.gif,.json';
const MAX_FILE = 200 * 1024 * 1024;

const importImage: Importer = async (file) => {
  const raster = await webRaster(file);
  const name = fileBase(file.name);
  return { format: 'image', pages: [{ name, width: raster.width, height: raster.height, layers: [{ type: 'raster', name, raster, frame: { x: 0, y: 0, w: raster.width, h: raster.height, rotate: 0 } }] }], warnings: [] };
};

/** Bulava's own JSON: layers copied from a board (the clipboard's), or a whole board. */
const importBoard: Importer = async (file) => {
  const text = await file.text();
  const clip = readClipboard(text);
  if (clip) {
    const right = Math.max(...clip.layers.map((l) => l.frame.x + l.frame.w));
    const bottom = Math.max(...clip.layers.map((l) => l.frame.y + l.frame.h));
    return { format: 'board', pages: [{ name: fileBase(file.name), width: Math.max(clip.width, right), height: Math.max(bottom, 1), layers: clip.layers.map((layer) => ({ type: 'layer', layer })) }], warnings: [] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('design.import.error.unreadable'));
  }
  const board = ArtboardSchema.safeParse((data as { board?: unknown })?.board ?? data);
  if (!board.success) throw new Error(t('design.import.error.format'));
  return { format: 'board', pages: [{ name: fileBase(file.name), width: board.data.width, height: board.data.height, ...(board.data.background.type === 'color' ? { background: board.data.background.color } : {}), layers: board.data.layers.map((layer) => ({ type: 'layer', layer })) }], warnings: [] };
};

/**
 * Reads a design file by what it is (its first bytes), whatever it is called:
 * PDF (and Illustrator files saved with PDF content), PSD, PPTX, SVG, a
 * picture, or Bulava's own board JSON. Each reader (and pdf.js, ag-psd) loads
 * only when a file of its kind is imported.
 */
export async function readDesign(file: File, options: Parameters<Importer>[1]): Promise<ImportResult> {
  if (file.size > MAX_FILE) throw new Error(t('design.import.error.tooLarge'));
  const head = String.fromCharCode(...new Uint8Array(await file.slice(0, 5).arrayBuffer()));
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (head.startsWith('%PDF')) return (await import('./pdf')).importPdf(file, options);
  if (head.startsWith('8BPS')) return (await import('./psd')).importPsd(file, options);
  if (head.startsWith('PK') && ext === 'pptx') return (await import('./pptx')).importPptx(file, options);
  if (ext === 'svg' || file.type === 'image/svg+xml') return (await import('./svg')).importSvg(file, options);
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return importImage(file, options);
  if (ext === 'json') return importBoard(file, options);
  // Formats only their own software reads: what to export instead.
  if (ext === 'ai' || ext === 'eps') throw new Error(t('design.import.error.ai'));
  if (ext === 'cdr') throw new Error(t('design.import.error.cdr'));
  if (ext === 'fig' || ext === 'sketch' || ext === 'xd') throw new Error(t('design.import.error.fig'));
  if (ext === 'key' || ext === 'ppt' || ext === 'odp') throw new Error(t('design.import.error.deck'));
  throw new Error(t('design.import.error.format'));
}

/** The pictures an import will upload (a picture used on several pages is uploaded once). */
export function importRasters(pages: ImportedPage[]): Raster[] {
  return [...new Set(pages.flatMap((p) => p.layers.flatMap((l) => (l.type === 'raster' ? [l.raster] : []))))];
}

/** How a page goes onto a board: scaled to the board's width (its height follows), or fitted inside the board. */
export interface Fit {
  width: number;
  height: number;
  mode: 'width' | 'contain';
}

const MAX_LAYERS = 120;

/** A layer scaled onto a board (sizes, strokes and corners with it). */
function scaled(layer: LayerInput & { frame: Layer['frame'] }, k: number, dx: number, dy: number): LayerInput {
  const f = layer.frame;
  const frame = { x: r1(clamp(dx + f.x * k, -4000, 8000)), y: r1(clamp(dy + f.y * k, -4000, 8000)), w: r1(clamp(f.w * k, 1, 8000)), h: r1(clamp(f.h * k, 1, 8000)), rotate: f.rotate ?? 0 };
  const line = (width: number) => r1(clamp(width * k, 0, 100));
  switch (layer.kind) {
    case 'text':
      return { ...layer, frame, style: { ...layer.style, size: clamp(r1((layer.style?.size ?? 24) * k), 6, 600) } };
    case 'shape':
      return { ...layer, frame, radius: r1(clamp((layer.radius ?? 0) * k, 0, 1000)), ...(layer.stroke ? { stroke: { ...layer.stroke, width: line(layer.stroke.width) } } : {}) };
    case 'image':
      return { ...layer, frame, radius: r1(clamp((layer.radius ?? 0) * k, 0, 1000)), ...(layer.border ? { border: { ...layer.border, width: line(layer.border.width) } } : {}) };
    default:
      return { ...layer, frame };
  }
}

/**
 * An imported page as layers on a board: scaled and centred as `fit` says,
 * each picture an image layer of its uploaded asset (`assets`), with ids
 * free on the board (`taken`). Returns the layers and how many did not fit
 * in the `room` the board has (it holds 120).
 */
export function placeLayers(page: ImportedPage, fit: Fit, assets: Map<Raster, string>, taken: Set<string>, room = MAX_LAYERS): { layers: Layer[]; height: number; dropped: number } {
  const k = fit.mode === 'width' ? fit.width / page.width : Math.min(fit.width / page.width, fit.height / page.height);
  const height = fit.mode === 'width' ? clamp(Math.round(page.height * k), 100, 8000) : fit.height;
  const dx = (fit.width - page.width * k) / 2;
  const dy = fit.mode === 'width' ? 0 : (height - page.height * k) / 2;
  const layers: Layer[] = [];
  let dropped = 0;
  const slug = (s: string, fallback: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || fallback;
  for (const draft of page.layers) {
    const input = toInput(draft, assets);
    if (!input) continue;
    const parsed = LayerSchema.safeParse({ ...scaled(input, k, dx, dy), id: layerId(slug(input.name ?? '', input.kind), taken) });
    if (!parsed.success) continue;
    if (layers.length >= room) {
      dropped += 1;
      continue;
    }
    taken.add(parsed.data.id);
    layers.push(parsed.data);
  }
  return { layers, height, dropped };
}

function toInput(draft: DraftLayer, assets: Map<Raster, string>): (LayerInput & { frame: Layer['frame'] }) | null {
  if (draft.type === 'layer') return draft.layer;
  const assetId = assets.get(draft.raster);
  if (!assetId) return null;
  return {
    id: 'image',
    name: draft.name.slice(0, 60),
    kind: 'image',
    frame: draft.frame,
    source: { type: 'asset', assetId },
    fit: draft.fit ?? 'contain',
    mask: draft.mask ?? 'none',
    radius: draft.radius ?? 0,
    opacity: clamp(draft.opacity ?? 1, 0, 1),
    blend: draft.blend ?? 'normal',
    locked: draft.locked ?? false,
    flipX: draft.flipX ?? false,
    flipY: draft.flipY ?? false,
    ...(draft.group ? { group: draft.group } : {}),
    alt: '',
  };
}

/** A whole board from an imported page (its colour, or the template's background). */
export function boardOf(page: ImportedPage, fit: Fit, assets: Map<Raster, string>): { board: Artboard; dropped: number } {
  const { layers, height, dropped } = placeLayers(page, fit, assets, new Set());
  const board = ArtboardSchema.parse({ width: fit.width, height, background: { type: 'color', color: page.background ?? 'background' }, layers });
  return { board, dropped };
}
