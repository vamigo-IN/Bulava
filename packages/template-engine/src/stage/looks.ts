import { STAGE_META } from '@bulava/template-schema';
import { posesOf } from './camera';
import { clipToRect, polygonArea, projectPiece, SCREENS, visibleWindow } from './project';
import type { Piece, StageSet } from './types';

/**
 * Stage lookalikes (final.md §5.1): what a stage hero shows, as a customer
 * would see it on a phone, and how alike two stages are. As heroSimilarity
 * does for canvas boards (template-schema looks.ts): each piece once by its art
 * and once by where it sits on the phone at rest (a sixth of the width, a tenth
 * of the height), weighted by how much of the screen it fills, compared by a
 * weighted Jaccard overlap, a little less when one stage is dark and the other
 * light. Palettes are left out on purpose. Every pair of the 19 stages must
 * stay under HERO_LOOKALIKE (0.72), across all occasions.
 */

/** Placeholder art (the day-0 stubs) is no design: it never makes two stages alike. */
const PLACEHOLDER = new Set(['stub']);

/** The art key of a piece: its kit or illustration name ('pillar:granite'), lights by role. */
const artKey = (piece: Piece): string => (piece.kind === 'light' ? `light:${piece.role}` : piece.art);

/** What a stage shows: weighted features (art, art@where) of its pieces on a phone at rest. */
export function stageLook(set: StageSet): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  const add = (k: string, w: number) => out.set(k, (out.get(k) ?? 0) + w);
  const pose = posesOf(set).rest;
  const v = visibleWindow(SCREENS.phone);
  const screenArea = v.w * v.h;
  for (const piece of set.pieces) {
    if (PLACEHOLDER.has(piece.art) || piece.role === 'cover') continue;
    const proj = projectPiece(piece, pose);
    const visible = clipToRect(proj.poly, v);
    const area = Math.min(1, polygonArea(visible) / screenArea);
    if (area <= 0) continue;
    const w = 0.3 + Math.sqrt(area) * 3;
    const key = artKey(piece);
    add(key, w);
    let cx = 0;
    let cy = 0;
    for (const p of visible) {
      cx += p.x;
      cy += p.y;
    }
    cx /= visible.length;
    cy /= visible.length;
    add(`${key}@${Math.round((cx - v.x) / (v.w / 6))},${Math.round((cy - v.y) / (v.h / 10))}`, w);
  }
  return out;
}

/** How alike two stages look, 0 to 1 (the weighted overlap of their looks; ×0.85 across dark and light). */
export function stageSimilarity(a: StageSet, b: StageSet): number {
  const x = stageLook(a);
  const y = stageLook(b);
  let inter = 0;
  let union = 0;
  for (const k of new Set([...x.keys(), ...y.keys()])) {
    const p = x.get(k) ?? 0;
    const q = y.get(k) ?? 0;
    inter += Math.min(p, q);
    union += Math.max(p, q);
  }
  const overlap = union ? inter / union : 0;
  return STAGE_META[a.name].dark === STAGE_META[b.name].dark ? overlap : overlap * 0.85;
}
