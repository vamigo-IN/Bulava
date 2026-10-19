import { alignFrames, boundsOf, distributeFrames, type AlignMode } from '@bulava/template-engine';
import { LayerSchema, type Artboard, type Layer } from '@bulava/template-schema';
import { layerId } from './presets';

/**
 * What the Design Studio does to several layers at once: copy and paste
 * (across pages, tabs and templates: the clipboard carries JSON), duplicate,
 * group, align, distribute, order, nudge and delete. Pure functions over a
 * board: the editor commits the board they return.
 */

const CLIP_KIND = 'bulava-layers';

/** The layers picked, in the order they are drawn. */
export const pickedLayers = (board: Artboard, ids: readonly string[]) => board.layers.filter((l) => ids.includes(l.id));

/** The clipboard text for some layers. */
export function copyLayers(board: Artboard, ids: readonly string[]): string {
  return JSON.stringify({ kind: CLIP_KIND, v: 1, width: board.width, layers: pickedLayers(board, ids) });
}

/** Layers read back from clipboard text, or null when it holds something else. */
export function readClipboard(text: string): { width: number; layers: Layer[] } | null {
  try {
    const data = JSON.parse(text) as { kind?: unknown; width?: unknown; layers?: unknown };
    if (data?.kind !== CLIP_KIND || !Array.isArray(data.layers)) return null;
    const layers = data.layers.map((l) => LayerSchema.safeParse(l)).filter((r) => r.success).map((r) => r.data!);
    return layers.length ? { width: typeof data.width === 'number' ? data.width : 390, layers } : null;
  } catch {
    return null;
  }
}

const freshGroup = () => `g${Math.random().toString(36).slice(2, 9)}`;

/**
 * Layers added to a board with fresh ids (and fresh groups, so a pasted group
 * stays a group of its own), scaled when they come from a board of another
 * width, and offset when their copies are already in place.
 */
export function pasteLayers(board: Artboard, clip: { width: number; layers: Layer[] }): { board: Artboard; ids: string[] } {
  const taken = new Set(board.layers.map((l) => l.id));
  const k = clip.width && clip.width !== board.width ? board.width / clip.width : 1;
  const sameSpot = clip.layers.some((l) => board.layers.some((b) => b.frame.x === l.frame.x && b.frame.y === l.frame.y && b.kind === l.kind));
  const shift = sameSpot ? Math.round(16 * Math.max(1, board.width / 390)) : 0;
  const groups = new Map<string, string>();
  const added = clip.layers.map((layer) => {
    const copy = structuredClone(layer);
    copy.id = layerId(layer.id.replace(/-\d+$/, ''), taken);
    taken.add(copy.id);
    copy.locked = false;
    if (copy.group) {
      if (!groups.has(copy.group)) groups.set(copy.group, freshGroup());
      copy.group = groups.get(copy.group);
    }
    const f = copy.frame;
    copy.frame = { ...f, x: Math.round(f.x * k + shift), y: Math.round(f.y * k + shift), w: Math.round(f.w * k), h: Math.round(f.h * k) };
    if (k !== 1 && copy.kind === 'text') copy.style = { ...copy.style, size: Math.max(6, Math.round(copy.style.size * k * 10) / 10) };
    return copy;
  });
  // On the page: layers copied from a taller page are moved up (or in) as one, keeping their places among themselves.
  const box = boundsOf(added.map((l) => l.frame));
  const dx = box.w > board.width ? -box.x : Math.min(0, board.width - (box.x + box.w)) - Math.min(0, box.x);
  const dy = box.h > board.height ? -box.y : Math.min(0, board.height - (box.y + box.h)) - Math.min(0, box.y);
  const placed = dx || dy ? added.map((l) => ({ ...l, frame: { ...l.frame, x: l.frame.x + dx, y: l.frame.y + dy } })) : added;
  return { board: { ...board, layers: [...board.layers, ...placed] }, ids: placed.map((l) => l.id) };
}

/** Copies of the layers, each right above its original. */
export function duplicateLayers(board: Artboard, ids: readonly string[]): { board: Artboard; ids: string[] } {
  const taken = new Set(board.layers.map((l) => l.id));
  const step = Math.round(12 * Math.max(1, board.width / 390));
  const groups = new Map<string, string>();
  const layers: Layer[] = [];
  const out: string[] = [];
  for (const layer of board.layers) {
    layers.push(layer);
    if (!ids.includes(layer.id)) continue;
    const copy = structuredClone(layer);
    copy.id = layerId(layer.id.replace(/-\d+$/, ''), taken);
    taken.add(copy.id);
    copy.locked = false;
    copy.frame = { ...copy.frame, x: copy.frame.x + step, y: copy.frame.y + step };
    if (copy.group) {
      if (!groups.has(copy.group)) groups.set(copy.group, freshGroup());
      copy.group = groups.get(copy.group);
    }
    layers.push(copy);
    out.push(copy.id);
  }
  return { board: { ...board, layers }, ids: out };
}

export function deleteLayers(board: Artboard, ids: readonly string[]): Artboard {
  return { ...board, layers: board.layers.filter((l) => !ids.includes(l.id) || l.locked) };
}

/** One group of the layers (picked, moved and resized together from now on). */
export function groupLayers(board: Artboard, ids: readonly string[]): Artboard {
  const group = freshGroup();
  return { ...board, layers: board.layers.map((l) => (ids.includes(l.id) ? { ...l, group } : l)) };
}

/** The layers' groups broken up. */
export function ungroupLayers(board: Artboard, ids: readonly string[]): Artboard {
  const groups = new Set(pickedLayers(board, ids).map((l) => l.group).filter(Boolean));
  return {
    ...board,
    layers: board.layers.map((l) => {
      if (!l.group || !groups.has(l.group)) return l;
      const { group: _group, ...rest } = l;
      return rest as Layer;
    }),
  };
}

const withFrames = (board: Artboard, ids: readonly string[], frames: Layer['frame'][]) => {
  const byId = new Map(pickedLayers(board, ids).map((l, i) => [l.id, frames[i]!]));
  return { ...board, layers: board.layers.map((l) => (byId.has(l.id) && !l.locked ? { ...l, frame: byId.get(l.id)! } : l)) };
};

/** Lines layers up: with each other when there are several, with the board when there is one. */
export function alignLayers(board: Artboard, ids: readonly string[], mode: AlignMode): Artboard {
  const layers = pickedLayers(board, ids);
  if (!layers.length) return board;
  const to = layers.length > 1 ? boundsOf(layers.map((l) => l.frame)) : { x: 0, y: 0, w: board.width, h: board.height, rotate: 0 };
  return withFrames(board, ids, alignFrames(layers.map((l) => l.frame), mode, to));
}

/** Spaces three or more layers evenly along an axis. */
export function distributeLayers(board: Artboard, ids: readonly string[], axis: 'x' | 'y'): Artboard {
  const layers = pickedLayers(board, ids);
  if (layers.length < 3) return board;
  return withFrames(board, ids, distributeFrames(layers.map((l) => l.frame), axis));
}

export function nudgeLayers(board: Artboard, ids: readonly string[], dx: number, dy: number): Artboard {
  return { ...board, layers: board.layers.map((l) => (ids.includes(l.id) && !l.locked ? { ...l, frame: { ...l.frame, x: l.frame.x + dx, y: l.frame.y + dy } } : l)) };
}

/** Brings the layers forward or back, keeping their order among themselves. */
export function reorderLayers(board: Artboard, ids: readonly string[], where: 'forward' | 'backward' | 'front' | 'back'): Artboard {
  const picked = pickedLayers(board, ids);
  if (!picked.length) return board;
  const rest = board.layers.filter((l) => !ids.includes(l.id));
  if (where === 'front') return { ...board, layers: [...rest, ...picked] };
  if (where === 'back') return { ...board, layers: [...picked, ...rest] };
  const layers = [...board.layers];
  const order = where === 'forward' ? [...picked].reverse() : picked;
  for (const layer of order) {
    const from = layers.indexOf(layer);
    const to = where === 'forward' ? Math.min(layers.length - 1, from + 1) : Math.max(0, from - 1);
    if (ids.includes(layers[to]!.id)) continue;
    layers.splice(from, 1);
    layers.splice(to, 0, layer);
  }
  return { ...board, layers };
}

export function setLocked(board: Artboard, ids: readonly string[], locked: boolean): Artboard {
  return { ...board, layers: board.layers.map((l) => (ids.includes(l.id) ? { ...l, locked } : l)) };
}

/** Whether any of the layers is in a group. */
export const anyGrouped = (board: Artboard, ids: readonly string[]) => pickedLayers(board, ids).some((l) => !!l.group);
