import type { ThemeColors } from '@bulava/template-schema';
import { hex, NATURE } from '../art/kit';
import { mix } from '../theme';
import type { Fog, Piece, PlaneRecipe } from './types';
import { clamp } from './units';

/**
 * Atmospheric perspective (final.md §1.3): colours mix toward the set's fog by
 * distance from the rest eye, never through `filter`. A piece's palette is
 * mixed once for its rest distance (static, so the server, the browser and
 * films agree); floors and ceilings, which run thousands of units into the
 * set, also get the same mix as an in-plane gradient from their near edge to
 * their far one (fogGradient).
 */

const PALETTE_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'] as const;
const NATURE_KEYS = Object.keys(NATURE) as Array<keyof typeof NATURE>;

/** How much of the fog colour a colour takes at distance d: max·clamp((d − near)/(far − near)). */
export function hazeAt(fog: Fog, d: number): number {
  if (!(fog.max > 0) || d <= fog.near) return 0;
  const span = fog.far - fog.near;
  return span > 0 ? fog.max * clamp((d - fog.near) / span) : fog.max;
}

/** A colour mixed toward the fog for distance d (#rrggbb in and out). */
export function hazedColor(color: string, fog: Fog, d: number): string {
  const a = hazeAt(fog, d);
  return a > 0 ? mix(hex(color), hex(fog.color), a) : color;
}

const paletteMemo = new WeakMap<ThemeColors, Map<string, ThemeColors>>();

/** The palette mixed toward the fog for a piece at distance d: the same object (a no-op) at d ≤ fog.near. */
export function hazedPalette(colors: ThemeColors, fog: Fog, d: number): ThemeColors {
  return hazedPaletteBy(colors, fog, hazeAt(fog, d));
}

/** The palette mixed toward the fog by `a` (0–1, as hazeAt gives it): the same object at a ≤ 0. Memoised per palette. */
export function hazedPaletteBy(colors: ThemeColors, fog: Fog, a: number): ThemeColors {
  if (!(a > 0)) return colors;
  const key = `${fog.color}|${Math.round(a * 1000)}`;
  let byKey = paletteMemo.get(colors);
  if (!byKey) {
    byKey = new Map();
    paletteMemo.set(colors, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const fogHex = hex(fog.color);
  const out = { ...colors };
  for (const k of PALETTE_KEYS) out[k] = mix(hex(colors[k]), fogHex, a);
  byKey.set(key, out);
  return out;
}

const NATURE_PLAIN: Record<keyof typeof NATURE, string> = { ...NATURE };
const natureMemo = new Map<string, Record<keyof typeof NATURE, string>>();

/** NATURE (leaves, flames, real flowers) mixed toward the fog the same way. */
export function hazedNature(fog: Fog, d: number): Record<keyof typeof NATURE, string> {
  const a = hazeAt(fog, d);
  if (a <= 0) return NATURE_PLAIN;
  const key = `${fog.color}|${Math.round(a * 1000)}`;
  const hit = natureMemo.get(key);
  if (hit) return hit;
  const fogHex = hex(fog.color);
  const out = {} as Record<keyof typeof NATURE, string>;
  for (const k of NATURE_KEYS) out[k] = mix(NATURE[k], fogHex, a);
  if (natureMemo.size > 512) natureMemo.clear();
  natureMemo.set(key, out);
  return out;
}

/** rgba() of a #rrggbb colour. */
export function rgba(color: string, alpha: number): string {
  const n = Number.parseInt(hex(color).slice(1), 16);
  const a = Math.round(clamp(alpha) * 1000) / 1000;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The distance a piece's palette is hazed for: its rest distance (planes: their near edge). */
export function hazeDistance(piece: Piece): number {
  if (piece.kind === 'plane') return piece.plane.geometry.dNear;
  return -piece.at.z;
}

/** Planes that run into the set and are opaque by nature: their far parts are hazed in-plane. */
const DEEP_SURFACES: ReadonlySet<PlaneRecipe['kind']> = new Set(['floor', 'ceiling']);

/**
 * An in-plane haze for a floor or ceiling that runs from dNear to dFar: a CSS
 * gradient in the fog colour whose alpha is the haze at each depth, laid over
 * the drawing in the plane's own content box (content top = far end on floors,
 * near end on ceilings). Null when the plane stays inside the clear distance
 * or is not a deep surface (walls and rails may be cut through, so they take
 * their palette hazed for their near edge only).
 */
export function fogGradient(plane: PlaneRecipe, fog: Fog): string | null {
  if (!DEEP_SURFACES.has(plane.kind)) return null;
  const { dNear, dFar } = plane.geometry;
  if (dFar <= dNear || hazeAt(fog, dFar) <= 0) return null;
  // Content position (0 at the top edge, 1 at the bottom) of a depth.
  const farAtTop = plane.kind === 'floor';
  const pos = (d: number) => (farAtTop ? (dFar - d) / (dFar - dNear) : (d - dNear) / (dFar - dNear));
  const stops = new Map<number, number>();
  const stop = (d: number) => {
    const t = clamp(pos(d));
    stops.set(Math.round(t * 1000) / 10, hazeAt(fog, Math.min(Math.max(d, dNear), dFar)));
  };
  stop(dNear);
  stop(dFar);
  if (fog.near > dNear && fog.near < dFar) stop(fog.near);
  if (fog.far > dNear && fog.far < dFar) stop(fog.far);
  const list = [...stops.entries()].sort((a, b) => a[0] - b[0]).map(([at, a]) => `${rgba(fog.color, a)} ${at}%`);
  return `linear-gradient(180deg, ${list.join(', ')})`;
}
