import { STAGE_META } from '@bulava/template-schema';
import { posesOf, poseTransform } from './camera';
import { propTransform } from './planes';
import type { CameraPose, LightPiece, Piece, StageName, StageSet, Vec3 } from './types';
import { clamp, HORIZON_Y, NEAR_FADE, perspectiveOf, u } from './units';

/**
 * The CSS pipeline mirrored in numbers (final.md §2.7): the same transform
 * strings the browser receives are parsed into 4×4 matrices (column-major,
 * like matrix3d), so tests can project every piece exactly as Chrome draws it,
 * on every screen, at any pose and at the rig's extremes.
 */

export type M4 = Float64Array;
export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const O = { x: 600, y: HORIZON_Y, z: 0 } as const;

// ─────────────────────────── Matrices ───────────────────────────

export function identity(): M4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a·b (apply b first, as CSS composes transform functions left to right). */
export function multiply(a: M4, b: M4): M4 {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = s;
    }
  }
  return out;
}

const chain = (...ms: M4[]): M4 => ms.reduce((acc, m) => multiply(acc, m), identity());

export function translate(x: number, y: number, z: number): M4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
const rad = (deg: number) => (deg * Math.PI) / 180;
/** CSS rotateX(a): (x, y·cos a − z·sin a, y·sin a + z·cos a). */
export function rotateX(deg: number): M4 {
  const m = identity();
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  m[5] = c;
  m[9] = -s;
  m[6] = s;
  m[10] = c;
  return m;
}
/** CSS rotateY(a): (x·cos a + z·sin a, y, −x·sin a + z·cos a). */
export function rotateY(deg: number): M4 {
  const m = identity();
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  m[0] = c;
  m[8] = s;
  m[2] = -s;
  m[10] = c;
  return m;
}
/** CSS rotateZ(a): (x·cos a − y·sin a, x·sin a + y·cos a, z). */
export function rotateZ(deg: number): M4 {
  const m = identity();
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  m[0] = c;
  m[4] = -s;
  m[1] = s;
  m[5] = c;
  return m;
}
export function scale(sx: number, sy = sx, sz = 1): M4 {
  const m = identity();
  m[0] = sx;
  m[5] = sy;
  m[10] = sz;
  return m;
}
/** CSS perspective(p): w' = 1 − z/p. */
export function perspective(p: number): M4 {
  const m = identity();
  m[11] = -1 / p;
  return m;
}

/** A stage length or angle argument as a number of units (calc(n * var(--u))), degrees (n deg) or a plain number. */
function argOf(text: string): number {
  const t = text.trim();
  const calc = /^calc\(\s*(-?[\d.]+)\s*\*\s*var\(--u\)\s*\)$/.exec(t);
  if (calc) return Number(calc[1]);
  const n = /^(-?[\d.]+)(deg|px)?$/.exec(t);
  if (n) return Number(n[1]);
  throw new Error(`stage transform: cannot read "${t}"`);
}

/** Splits "a, calc(b, c), d" at its top-level commas. */
function args(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** The matrix of a transform string as the engine writes them (translate3d/translateX/Y/Z, rotateX/Y/Z, scale, scaleX, perspective, none). */
export function matrixOf(transform: string): M4 {
  let m = identity();
  const t = transform.trim();
  if (!t || t === 'none') return m;
  let i = 0;
  while (i < t.length) {
    while (t[i] === ' ') i++;
    if (i >= t.length) break;
    const open = t.indexOf('(', i);
    if (open < 0) throw new Error(`stage transform: cannot read "${t.slice(i)}"`);
    const name = t.slice(i, open).trim();
    let depth = 0;
    let j = open;
    for (; j < t.length; j++) {
      if (t[j] === '(') depth++;
      else if (t[j] === ')' && --depth === 0) break;
    }
    const a = args(t.slice(open + 1, j)).map(argOf);
    switch (name) {
      case 'translate3d':
        m = multiply(m, translate(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0));
        break;
      case 'translate':
        m = multiply(m, translate(a[0] ?? 0, a[1] ?? 0, 0));
        break;
      case 'translateX':
        m = multiply(m, translate(a[0] ?? 0, 0, 0));
        break;
      case 'translateY':
        m = multiply(m, translate(0, a[0] ?? 0, 0));
        break;
      case 'translateZ':
        m = multiply(m, translate(0, 0, a[0] ?? 0));
        break;
      case 'rotateX':
        m = multiply(m, rotateX(a[0] ?? 0));
        break;
      case 'rotateY':
        m = multiply(m, rotateY(a[0] ?? 0));
        break;
      case 'rotateZ':
      case 'rotate':
        m = multiply(m, rotateZ(a[0] ?? 0));
        break;
      case 'scale':
        m = multiply(m, scale(a[0] ?? 1, a[1] ?? a[0] ?? 1));
        break;
      case 'scaleX':
        m = multiply(m, scale(a[0] ?? 1, 1));
        break;
      case 'perspective':
        m = multiply(m, perspective(a[0] ?? 1));
        break;
      default:
        throw new Error(`stage transform: unknown function ${name}`);
    }
    i = j + 1;
  }
  return m;
}

/** The lens: T(600,H,0)·Persp(p)·T(−600,−H,0). */
export function lensMatrix(fov: number): M4 {
  return chain(translate(O.x, O.y, 0), perspective(perspectiveOf(fov)), translate(-O.x, -O.y, 0));
}

/** The world element for a pose, its transform-origin (600, H, 0) included. */
export function worldMatrix(pose: CameraPose): M4 {
  return chain(translate(O.x, O.y, O.z), matrixOf(poseTransform(pose)), translate(-O.x, -O.y, -O.z));
}

/** The rig and look elements together (breath, scroll dolly, pointer), about the same origin: T(O)·Tz(dolly)·Ry(yaw)·Rx(pitch)·T(−O). */
export function rigMatrix(rig: { yaw?: number; pitch?: number; dolly?: number } = {}): M4 {
  return chain(translate(O.x, O.y, O.z), translate(0, 0, rig.dolly ?? 0), rotateY(rig.yaw ?? 0), rotateX(rig.pitch ?? 0), translate(-O.x, -O.y, -O.z));
}

/** A light's element box: its largest disc (3r with a bloom), centred on the light. */
export function lightBox(piece: Pick<LightPiece, 'r' | 'bloom'>): { R: number; size: number } {
  const R = piece.bloom ? piece.r * 3 : piece.r;
  return { R, size: 2 * R };
}

/** A piece's placement transform, exactly as StageView writes it on the piece element (transform-origin 0 0). */
export function placementOf(piece: Piece): string {
  if (piece.kind === 'plane') return piece.plane.transform;
  if (piece.kind === 'prop') return propTransform(piece);
  const { R } = lightBox(piece);
  return `translate3d(${u(piece.at.x - R)}, ${u(piece.at.y - R)}, ${u(piece.at.z)})`;
}

/** A piece's own matrix: its placement transform (transform-origin 0 0), exactly as StageView writes it. */
export function pieceMatrix(piece: Piece): M4 {
  return matrixOf(placementOf(piece));
}

/** The piece's content box (units), in its own coordinates. */
export function pieceBox(piece: Piece): { w: number; h: number } {
  if (piece.kind === 'plane') return { w: piece.plane.w, h: piece.plane.h };
  if (piece.kind === 'light') {
    const b = lightBox(piece);
    return { w: b.size, h: b.size };
  }
  return { w: piece.w, h: piece.h };
}

/** A point through a matrix: screen (frame units) and w (≤ 0: at or behind the eye). */
export function projectPoint(m: M4, v: Vec3): { x: number; y: number; w: number } {
  const X = m[0]! * v.x + m[4]! * v.y + m[8]! * v.z + m[12]!;
  const Y = m[1]! * v.x + m[5]! * v.y + m[9]! * v.z + m[13]!;
  const W = m[3]! * v.x + m[7]! * v.y + m[11]! * v.z + m[15]!;
  return { x: X / W, y: Y / W, w: W };
}

/** A point's world position through a matrix (no projection). */
export function transformPoint(m: M4, v: Vec3): Vec3 {
  return {
    x: m[0]! * v.x + m[4]! * v.y + m[8]! * v.z + m[12]!,
    y: m[1]! * v.x + m[5]! * v.y + m[9]! * v.z + m[13]!,
    z: m[2]! * v.x + m[6]! * v.y + m[10]! * v.z + m[14]!,
  };
}

const NEAR_W = 1e-3;

/** Clips a homogeneous polygon to w ≥ NEAR_W (the eye's plane), then divides. */
function clipNear(points: Array<{ X: number; Y: number; W: number }>): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const ain = a.W >= NEAR_W;
    const bin = b.W >= NEAR_W;
    if (ain) out.push({ x: a.X / a.W, y: a.Y / a.W });
    if (ain !== bin) {
      const t = (NEAR_W - a.W) / (b.W - a.W);
      const X = a.X + (b.X - a.X) * t;
      const Y = a.Y + (b.Y - a.Y) * t;
      out.push({ x: X / NEAR_W, y: Y / NEAR_W });
    }
  }
  return out;
}

/** Sutherland–Hodgman: a polygon clipped to a rectangle. */
export function clipToRect(poly: Pt[], r: Rect): Pt[] {
  const edges: Array<[(p: Pt) => boolean, (a: Pt, b: Pt) => Pt]> = [
    [(p) => p.x >= r.x, (a, b) => ({ x: r.x, y: a.y + ((b.y - a.y) * (r.x - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= r.x + r.w, (a, b) => ({ x: r.x + r.w, y: a.y + ((b.y - a.y) * (r.x + r.w - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= r.y, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y - a.y)) / (b.y - a.y), y: r.y })],
    [(p) => p.y <= r.y + r.h, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y + r.h - a.y)) / (b.y - a.y), y: r.y + r.h })],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    if (!out.length) break;
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i]!;
      const b = src[(i + 1) % src.length]!;
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(cut(a, b));
    }
  }
  return out;
}

/** A polygon's area (shoelace). */
export function polygonArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function boundsOf(poly: Pt[]): Rect {
  if (!poly.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface Projection {
  /** Bounding box of what is in front of the eye (frame units). */
  rect: Rect;
  /** The content box's corners (TL, TR, BR, BL), projected (meaningless where `behind`). */
  quad: [Pt, Pt, Pt, Pt];
  /** Some corner is at or behind the eye's plane. */
  behind: boolean;
  /** The projected area in front of the eye (frame units², not clipped to a screen). */
  area: number;
  /** The projected outline, clipped at the eye's plane. */
  poly: Pt[];
}

/** A piece's content box projected at a pose (and optionally under the rig's breath, dolly and pointer). */
export function projectPiece(piece: Piece, pose: CameraPose, rig?: { yaw?: number; pitch?: number; dolly?: number }): Projection {
  const m = chain(lensMatrix(pose.fov), rig ? rigMatrix(rig) : identity(), worldMatrix(pose), pieceMatrix(piece));
  const { w, h } = pieceBox(piece);
  const local: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: w, y: 0, z: 0 },
    { x: w, y: h, z: 0 },
    { x: 0, y: h, z: 0 },
  ];
  const hom = local.map((v) => {
    const X = m[0]! * v.x + m[4]! * v.y + m[8]! * v.z + m[12]!;
    const Y = m[1]! * v.x + m[5]! * v.y + m[9]! * v.z + m[13]!;
    const W = m[3]! * v.x + m[7]! * v.y + m[11]! * v.z + m[15]!;
    return { X, Y, W };
  });
  const quad = hom.map((p) => ({ x: p.X / p.W, y: p.Y / p.W })) as [Pt, Pt, Pt, Pt];
  const poly = clipNear(hom);
  return { rect: boundsOf(poly), quad, behind: hom.some((p) => p.W < NEAR_W), area: polygonArea(poly), poly };
}

// ─────────────────────────── Screens and zones ───────────────────────────

export type ScreenName = 'phone' | 'film' | 'desktop' | 'wide';
/** The screens composition is checked on (final.md §2.2). */
export const SCREENS: Readonly<Record<ScreenName, { w: number; h: number }>> = {
  phone: { w: 390, h: 844 },
  film: { w: 432, h: 768 },
  desktop: { w: 1440, h: 900 },
  wide: { w: 1920, h: 980 },
};

/** px per stage unit for a box: max(h/800, w/1200). */
export const unitFor = (screen: { w: number; h: number }): number => Math.max(screen.h / 800, screen.w / 1200);

/** What a box shows of the frame (frame units): x ∈ 600 ± W/(2u), y ∈ [440 − 0.55·H/u, 440 + 0.45·H/u]. */
export function visibleWindow(screen: { w: number; h: number }): Rect {
  const k = unitFor(screen);
  const w = screen.w / k;
  const h = screen.h / k;
  return { x: 600 - w / 2, y: HORIZON_Y - 0.55 * h, w, h };
}

/** Half-widths of the names box (frame units). */
const NAMES_HALF: Record<ScreenName, number> = { phone: 170, film: 190, desktop: 320, wide: 330 };

/** The words zones of a stage on a screen (final.md §2.4 rule 6), in frame units. */
export function zonesFor(name: StageName, screen: ScreenName): { crown: Rect; emblem: Rect; names: Rect; details: Rect } {
  const T = STAGE_META[name].textTop;
  const v = visibleWindow(SCREENS[screen]);
  const y = (f: number) => v.y + f * v.h;
  return {
    crown: { x: v.x, y: v.y, w: v.w, h: T * v.h },
    emblem: { x: 560, y: y(T), w: 80, h: 0.09 * v.h },
    names: { x: 600 - NAMES_HALF[screen], y: y(T), w: 2 * NAMES_HALF[screen], h: 0.3 * v.h },
    details: { x: v.x, y: y(T + 0.3), w: v.w, h: Math.max(0, y(0.75) - y(T + 0.3)) },
  };
}

/** Σ projected areas (clipped to the screen) ÷ the screen's area, at a pose (default: rest). Lights count each disc. */
export function pixelBudget(set: StageSet, screen: ScreenName, pose: CameraPose = posesOf(set).rest): number {
  const v = visibleWindow(SCREENS[screen]);
  let total = 0;
  for (const piece of set.pieces) {
    if (piece.kind === 'light') {
      for (const disc of lightDiscBoxes(piece)) {
        const proj = projectPiece(disc, pose);
        total += polygonArea(clipToRect(proj.poly, v));
      }
    } else total += polygonArea(clipToRect(projectPiece(piece, pose).poly, v));
  }
  return total / (v.w * v.h);
}

/** A light's discs as light pieces of their own (the bloom disc and the glow), for areas. */
function lightDiscBoxes(piece: LightPiece): LightPiece[] {
  return piece.bloom ? [{ ...piece, r: piece.r * 3, bloom: false }, { ...piece, bloom: false }] : [piece];
}

/** The near fade (final.md §2.5): opacity 0 within 150 units of the eye, 1 from 300. */
export const nearFadeAt = (dist: number): number => clamp((dist - NEAR_FADE) / NEAR_FADE);

/** The camera-to-anchor distance of a prop or light. */
export const anchorDistance = (piece: Exclude<Piece, { kind: 'plane' }>, pose: Pick<CameraPose, 'x' | 'y' | 'z'>): number => Math.hypot(piece.at.x - pose.x, piece.at.y - pose.y, piece.at.z - pose.z);

/** How far ahead of the eye a point is at a pose, along the view (negative: behind the eye's plane). */
export function cameraDepth(point: Vec3, pose: CameraPose): number {
  return perspectiveOf(pose.fov) - transformPoint(worldMatrix(pose), point).z;
}

/**
 * The near-plane opacity of an anchor at a pose (§2.5), from numbers alone (the client reads `data-at` from the
 * DOM, never set art): 0 at or behind the eye's plane, else the near fade by distance (1 when `fades` is false).
 */
export function fadeAt(at: Vec3, pose: CameraPose, fades = true): number {
  if (cameraDepth(at, pose) <= 0) return 0;
  return fades ? nearFadeAt(Math.hypot(at.x - pose.x, at.y - pose.y, at.z - pose.z)) : 1;
}

/**
 * A piece's opacity at a pose for the near plane (§2.5), for openings and films to write each frame: props, lights
 * and covers fade out within 150–300 units of the eye, and anything the camera has passed (its anchor at or behind
 * the eye's plane) is 0, never 1 again however far behind it is: what is behind is hidden, not left to clipping.
 * Planes never fade; one wholly behind the eye is 0.
 */
export function pieceFade(piece: Piece, pose: CameraPose): number {
  if (piece.kind === 'plane') {
    const m = pieceMatrix(piece);
    const { w, h } = pieceBox(piece);
    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: w, y: 0, z: 0 },
      { x: w, y: h, z: 0 },
      { x: 0, y: h, z: 0 },
    ].map((v) => cameraDepth(transformPoint(m, v), pose));
    if (corners.every((d) => d <= 0)) return 0;
    return piece.role === 'cover' && piece.nearFade !== false ? nearFadeAt(Math.max(...corners)) : 1;
  }
  return fadeAt(piece.at, pose, piece.nearFade !== false);
}

/** The nearest prop or light (camera to anchor) at a pose; Infinity when there is none. */
export function nearestPropDistance(set: Pick<StageSet, 'pieces'>, pose: CameraPose): number {
  let best = Infinity;
  for (const p of set.pieces) if (p.kind !== 'plane') best = Math.min(best, anchorDistance(p, pose));
  return best;
}

// ─────────────────────────── Composition checks ───────────────────────────

/** The rig's extremes (final.md §8.1 item 3): breath + pointer yaw ±5.5°, pitch ±2.5°, dolly ±10, combined. */
export const RIG_EXTREMES: ReadonlyArray<{ yaw: number; pitch: number; dolly: number }> = [-5.5, 0, 5.5].flatMap((yaw) => [-2.5, 0, 2.5].flatMap((pitch) => [-10, 0, 10].map((dolly) => ({ yaw, pitch, dolly }))));

/** What may sit in each words zone (final.md §2.4 rule 6). */
function allowedIn(zone: 'crown' | 'emblem' | 'names', piece: Piece): boolean {
  const quietPlane = piece.kind === 'plane' && piece.quiet !== false;
  const quiet = piece.role === 'sky' || quietPlane || piece.quiet === true;
  // Light sprites are judged by their glow (lightIssues); a prop in the light role (a shaft of light) is drawn faint.
  switch (zone) {
    case 'crown':
      return quiet || piece.role === 'hanging' || piece.role === 'light';
    case 'emblem':
      return piece.role === 'sky' || quietPlane;
    case 'names':
      return quiet || piece.role === 'light';
  }
}

export interface ZoneIssue {
  piece: string;
  zone: 'crown' | 'emblem' | 'names';
  screen: ScreenName;
  /** Overlap as a share of the zone's area. */
  share: number;
  /** Lights: the glow's strength where it reaches the zone. */
  strength?: number;
  rig?: { yaw: number; pitch: number; dolly: number };
}

/** Overlaps below this share of a zone are edge contact (antialiasing, a sliver of a box), not a piece in the zone. */
export const ZONE_TOLERANCE = 0.005;

/**
 * A light's glow (StageView): [where along the gradient's ray, which for a disc of radius r is r·√2, the share of
 * the light's strength there]. The core is the light's colour toward white.
 */
export const GLOW_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.16, 0.72],
  [0.38, 0.34],
  [0.56, 0.1],
  [0.7, 0],
];

/** The share of a light's strength at ρ disc radii from its centre. */
export function glowAt(rho: number): number {
  const f = Math.abs(rho) / Math.SQRT2;
  for (let i = 1; i < GLOW_STOPS.length; i++) {
    const [f1, a1] = GLOW_STOPS[i]!;
    if (f <= f1) {
      const [f0, a0] = GLOW_STOPS[i - 1]!;
      return a0 + ((a1 - a0) * (f - f0)) / (f1 - f0);
    }
  }
  return 0;
}

/** How strong a light may glow where it reaches the emblem box (a haze, never a halo behind the emblem) and the names box (§2.4 rule 5). */
export const ZONE_GLOW = { emblem: 0.12, names: 0.35 } as const;

/** Distance from a point to a rectangle (0 inside). */
const toRect = (p: Pt, r: Rect) => Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)));

/** Where a light's discs reach the words zones: each disc's strength at the zone's nearest point (lights are welcome in the crown band). */
function lightIssues(piece: LightPiece, pose: CameraPose, rig: { yaw: number; pitch: number; dolly: number } | undefined, zones: ReturnType<typeof zonesFor>, screen: ScreenName): ZoneIssue[] {
  const m = chain(lensMatrix(pose.fov), rig ? rigMatrix(rig) : identity(), worldMatrix(pose));
  const out: ZoneIssue[] = [];
  const discs = piece.bloom ? [{ r: piece.r * 3, s: piece.strength * 0.3 }, { r: piece.r, s: piece.strength }] : [{ r: piece.r, s: piece.strength }];
  for (const zone of ['emblem', 'names'] as const) {
    const box = zones[zone];
    let worst = 0;
    let share = 0;
    for (const disc of discs) {
      const c = projectPoint(m, piece.at);
      const e = projectPoint(m, { x: piece.at.x + disc.r, y: piece.at.y, z: piece.at.z });
      if (c.w <= 0) continue;
      const rs = Math.hypot(e.x - c.x, e.y - c.y);
      const alpha = disc.s * glowAt(toRect(c, box) / Math.max(rs, 1e-6));
      if (alpha > worst) worst = alpha;
      share += polygonArea(clipToRect(projectPiece({ ...piece, r: disc.r, bloom: false }, pose, rig).poly, box)) / (box.w * box.h);
    }
    if (worst > ZONE_GLOW[zone]) out.push({ piece: piece.id, zone, screen, share: Math.round(share * 1000) / 1000, strength: Math.round(worst * 100) / 100, ...(rig ? { rig } : {}) });
  }
  return out;
}

/** Pieces that sit where the words go, on a screen at rest (and at the rig's extremes with `rig: true`). */
export function zoneIssues(set: StageSet, screen: ScreenName, opts: { rig?: boolean; pose?: CameraPose } = {}): ZoneIssue[] {
  const pose = opts.pose ?? posesOf(set).rest;
  const zones = zonesFor(set.name, screen);
  const rigs = opts.rig ? RIG_EXTREMES : [undefined];
  const issues = new Map<string, ZoneIssue>();
  for (const rig of rigs) {
    for (const piece of set.pieces) {
      if (piece.kind === 'light') {
        for (const issue of lightIssues(piece, pose, rig, zones, screen)) {
          const key = `${piece.id}|${issue.zone}`;
          const prev = issues.get(key);
          if (!prev || (issue.strength ?? 0) > (prev.strength ?? 0)) issues.set(key, issue);
        }
        continue;
      }
      const polys = [projectPiece(piece, pose, rig).poly];
      for (const zone of ['crown', 'emblem', 'names'] as const) {
        if (allowedIn(zone, piece)) continue;
        const r = zones[zone];
        const share = polys.reduce((sum, poly) => sum + polygonArea(clipToRect(poly, r)), 0) / (r.w * r.h);
        if (share <= ZONE_TOLERANCE) continue;
        const key = `${piece.id}|${zone}`;
        const prev = issues.get(key);
        if (!prev || share > prev.share) issues.set(key, { piece: piece.id, zone, screen, share: Math.round(share * 1000) / 1000, ...(rig ? { rig } : {}) });
      }
    }
  }
  return [...issues.values()];
}
