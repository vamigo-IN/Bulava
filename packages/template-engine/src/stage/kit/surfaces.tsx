import type { ReactNode } from 'react';
import { blend, hex, Metal, metalStops, onCubic, shade, taper, tint, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import type { DrawProps, KeyLight } from '../types';
import { BOUGAINVILLEA } from './nature';
import type { KitEntry } from './place';

/**
 * Surfaces (final.md §6.1): the planes a set is built from. Floors, water and
 * ceilings are drawn flat in plan, walls and screens as orthographic
 * elevations, the sky in frame coordinates: perspective comes from the 3D
 * placement. Each repeats a <pattern> (so a 3000-unit wall stays a few KB),
 * bakes its light (key side lit, the far side 25% darker, a rim on the edges
 * facing away, light pools at world (x, d)) and draws quiet (tone-on-tone)
 * above the eye line, where the invitation's words sit. Rules (§1.5): inline
 * attributes only, rand()/r2(), colours from p.colors / p.nature (and the key
 * light), curves through onCubic/taper, no filters, masks or clips, nothing
 * built at module load. Ids come from the seed and everything drawn, so two
 * pieces never share a gradient unless they would draw it identically.
 */

export type FloorVariant = 'chequer' | 'flags' | 'terracotta' | 'terrace' | 'templeStone' | 'cobbles' | 'earth' | 'redOxide' | 'granite' | 'parquet' | 'carpet' | 'sawdust' | 'lawn' | 'teak';
export interface FloorOptions {
  variant: FloorVariant;
  /** A primary carpet 160 wide down x 600. */
  runner?: boolean;
  kolam?: 'center' | 'path';
  rangoli?: boolean;
  /** A circus ring curb around the focal. */
  ring?: boolean;
  /** An 80-wide water strip down the middle with shimmer lines. */
  channel?: boolean;
  path?: boolean;
  petals?: boolean;
  /** Baked light pools at world (x, d), radius r. */
  pools?: Array<{ x: number; d: number; r: number; color: string }>;
}
export type WaterVariant = 'still' | 'pool' | 'river';
export interface WaterOptions {
  variant: WaterVariant;
  /** Reflection streaks under these world x. */
  streaks?: Array<{ x: number; color: string }>;
}
export type CeilingVariant = 'mirrorCoffer' | 'plasterCoffer' | 'graniteBeams' | 'timberVault' | 'lightGrid' | 'tentStripes' | 'boards';
export interface CeilingOptions {
  variant: CeilingVariant;
}
export type WallVariant = 'cusped' | 'lancet' | 'scalloped' | 'ballroom' | 'veranda' | 'tentStripes' | 'acoustic' | 'colonnade' | 'shopfronts' | 'jaaliRail' | 'glassRail' | 'marbleRail';
export interface WallOptions {
  variant: WallVariant;
}
export type SkyVariant = 'night' | 'blueHour' | 'preDawn' | 'dawn' | 'dawnPastel' | 'sunrise' | 'morning' | 'golden' | 'dusk';
export type Skyline = 'domes' | 'city' | 'rooftops' | 'hills' | 'shikhara' | 'minarets' | 'none';
export interface SkyOptions {
  variant: SkyVariant;
  skyline?: Skyline;
  moon?: 'full' | 'crescent';
  stars?: boolean;
}
export type ArchScreenVariant = 'cusped' | 'round' | 'lancet';
export interface ArchScreenOptions {
  variant: ArchScreenVariant;
  /** The opening: its width and the apex's world y (the opening runs down to the screen's foot). */
  opening: { w: number; apexY: number };
}
export type MistBandVariant = 'river' | 'dawn' | 'incense';
export interface MistBandOptions {
  variant: MistBandVariant;
  /**
   * The mist's or smoke's colour. Default: river mist a breath of the accent in the background; dawn mist and incense
   * a tint of the background, except incense on a dark background, which rises as warm smoke (from the background
   * toward the secondary) instead of white ghosts.
   */
  tone?: string;
}

// ─────────────────────────── shared drawing helpers ───────────────────────────

type C = DrawProps['colors'];
type Stop = readonly [number, string, number?];

const url = (id: string) => `url(#${id})`;
const stopsOf = (list: readonly Stop[]) => list.map(([o, c, a], i) => <stop key={i} offset={r2(o)} stopColor={c} stopOpacity={a ?? 1} />);
/** A gradient across the shape's own box (x2/y2 as fractions). */
const Lin = ({ id, s, x2 = 0, y2 = 1 }: { id: string; s: readonly Stop[]; x2?: number; y2?: number }) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    {stopsOf(s)}
  </linearGradient>
);
/** A gradient in the drawing's own units. */
const LinU = ({ id, s, x1 = 0, y1 = 0, x2 = 0, y2 }: { id: string; s: readonly Stop[]; x1?: number; y1?: number; x2?: number; y2: number }) => (
  <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)}>
    {stopsOf(s)}
  </linearGradient>
);
/** Metal across a shape's own box (vertical sheen, or across it). */
const MetalBox = ({ id, base, across }: { id: string; base: string; across?: boolean }) => <Lin id={id} x2={across ? 1 : 0} y2={across ? 0 : 1} s={metalStops(base)} />;
const Rad = ({ id, s }: { id: string; s: readonly Stop[] }) => <radialGradient id={id}>{stopsOf(s)}</radialGradient>;

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      {children}
    </svg>
  );
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Ids for one drawing: the seed plus a hash of everything it draws with. */
function idsFor(p: DrawProps, tag: string, opts: unknown): (k: string) => string {
  const c = p.colors;
  const g = p.plane;
  const key = [p.seed, p.w, p.h, c.primary, c.secondary, c.accent, c.background, c.surface, c.text, c.muted, p.nature.leaf, p.nature.flame, p.light.from, p.light.color, p.light.rim, p.eyeLine, p.detail, g ? [g.x0, g.x1, g.y0, g.y1, g.dNear, g.dFar].join(',') : '', JSON.stringify(opts)].join('|');
  const base = `bs${tag}${(Math.abs(Math.round(p.seed)) % 46656).toString(36)}${fnv(key)}`;
  return (k) => `${base}${k}`;
}

/** Many circles as one path. */
/** One decimal: path geometry is in world units, where a tenth is far below a pixel. */
const r1 = (n: number) => Math.round(n * 10) / 10;
const circles = (pts: ReadonlyArray<readonly [number, number, number]>) =>
  pts.map(([x, y, r]) => `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`).join('');
const diamond = (x: number, y: number, r: number, ry = r) => `M${r1(x)} ${r1(y - ry)}L${r1(x + r)} ${r1(y)}L${r1(x)} ${r1(y + ry)}L${r1(x - r)} ${r1(y)}Z`;
const rect = (x: number, y: number, w: number, h: number) => `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
/** A five-point star of radius 10 (precomputed points), moved and scaled. */
const STAR5 = [
  [0, -10],
  [2.94, -4.05],
  [9.51, -3.09],
  [4.76, 1.55],
  [5.88, 8.09],
  [0, 5],
  [-5.88, 8.09],
  [-4.76, 1.55],
  [-9.51, -3.09],
  [-2.94, -4.05],
] as const;
const star5 = (x: number, y: number, s: number) => `M${STAR5.map(([a, b]) => `${r2(x + a * s)} ${r2(y + b * s)}`).join('L')}Z`;
/** An eight-point star of radius 8 (precomputed). */
const STAR8 = [
  [0, -8],
  [1.61, -3.88],
  [5.66, -5.66],
  [3.88, -1.61],
  [8, 0],
  [3.88, 1.61],
  [5.66, 5.66],
  [1.61, 3.88],
  [0, 8],
  [-1.61, 3.88],
  [-5.66, 5.66],
  [-3.88, 1.61],
  [-8, 0],
  [-3.88, -1.61],
  [-5.66, -5.66],
  [-1.61, -3.88],
] as const;
const star8 = (x: number, y: number, s: number) => `M${STAR8.map(([a, b]) => `${r2(x + a * s)} ${r2(y + b * s)}`).join('L')}Z`;

/** Specks scattered over a tile (seeded). */
function specks(n: number, tw: number, th: number, salt: number, rMin: number, rMax: number): Array<[number, number, number]> {
  return Array.from({ length: n }, (_, i) => [r1(rand(i, salt) * tw), r1(rand(i, salt + 1) * th), r1(rMin + rand(i, salt + 2) * (rMax - rMin))]);
}

/** Warm wood from the palette's metal and ink, deepened like oiled teak. */
const woodOf = (c: C, n: DrawProps['nature']) => blend(blend(c.secondary, c.text, 0.5), n.clayDark, 0.3);

type ArchKind = 'pointed' | 'round' | 'lancet';
/** An arch's two halves (springing → apex → springing) as cubic segments. */
function halves(cx: number, hw: number, spring: number, apex: number, kind: ArchKind): [Segment, Segment] {
  const rise = spring - apex;
  const L: Segment =
    kind === 'round'
      ? [
          [cx - hw, spring],
          [cx - hw, spring - rise * 0.5523],
          [cx - hw * 0.5523, apex],
          [cx, apex],
        ]
      : kind === 'lancet'
        ? [
            [cx - hw, spring],
            [cx - hw, spring - rise * 0.55],
            [cx - hw * 0.5, apex + rise * 0.14],
            [cx, apex],
          ]
        : [
            [cx - hw, spring],
            [cx - hw, spring - rise * 0.55],
            [cx - hw * 0.45, apex + rise * 0.16],
            [cx, apex],
          ];
  const R: Segment = [[cx, apex], [2 * cx - L[2][0], L[2][1]], [2 * cx - L[1][0], L[1][1]], [cx + hw, spring]];
  return [L, R];
}
const pt = (q: Pt) => `${r1(q[0])} ${r1(q[1])}`;
/**
 * An arch opening from the foot (base) up the jambs and over the top; with
 * lobes, each half is cusped into that many small arcs bulging outward (the
 * Mughal multifoil). Only arithmetic and square roots.
 */
function arch(cx: number, hw: number, spring: number, apex: number, base: number, kind: ArchKind, lobes = 0): string {
  const [L, R] = halves(cx, hw, spring, apex, kind);
  let d = `M${r2(cx - hw)} ${r2(base)}L${pt(L[0])}`;
  for (const seg of [L, R]) {
    if (!lobes) {
      d += `C${pt(seg[1])} ${pt(seg[2])} ${pt(seg[3])}`;
      continue;
    }
    let px = seg[0][0];
    let py = seg[0][1];
    for (let i = 1; i <= lobes; i++) {
      const q = onCubic(seg, i / lobes);
      const r = Math.sqrt((q.x - px) * (q.x - px) + (q.y - py) * (q.y - py)) * 0.56;
      d += `A${r1(r)} ${r1(r)} 0 0 1 ${r1(q.x)} ${r1(q.y)}`;
      px = q.x;
      py = q.y;
    }
  }
  return `${d}L${r2(cx + hw)} ${r2(base)}Z`;
}

/** Just the arch's curve, springing to springing (an open path: for strokes such as voussoir joints). */
function archCurve(cx: number, hw: number, spring: number, apex: number, kind: ArchKind): string {
  const [L, R] = halves(cx, hw, spring, apex, kind);
  return `M${pt(L[0])}C${pt(L[1])} ${pt(L[2])} ${pt(L[3])}C${pt(R[1])} ${pt(R[2])} ${pt(R[3])}`;
}

type Side = 'left' | 'right';
/** Whether a wall on this side faces the key light. */
const facing = (light: KeyLight, side: Side): 'lit' | 'away' | 'none' =>
  light.from === 'left' ? (side === 'right' ? 'lit' : 'away') : light.from === 'right' ? (side === 'left' ? 'lit' : 'away') : 'none';

/**
 * The key light on an upright plane: the side away 25% darker, the lit side
 * washed warm, a far key glowing toward the far end (content right = far on
 * walls), light from above or below as a vertical falloff, and contact shade
 * at the foot. `hole` is an even-odd cut (an opening the light must not cover)
 * and `gap` its width at the foot, where the contact shade stops.
 */
function UprightLight({ id, w, h, light, side, wall, hole = '', gap }: { id: (k: string) => string; w: number; h: number; light: KeyLight; side: Side; wall: boolean; hole?: string; gap?: readonly [number, number] }) {
  const f = wall ? facing(light, side) : 'none';
  const box = `${rect(0, 0, w, h)}${hole}`;
  const out: ReactNode[] = [];
  const defs: ReactNode[] = [];
  if (f === 'away') out.push(<path key="away" d={box} fillRule="evenodd" fill="#000000" opacity={0.25} />);
  if (f === 'lit') {
    defs.push(<Lin key="lit" id={id('lit')} s={[[0, light.color, 0.2], [1, light.color, 0.06]]} />);
    out.push(<path key="lit" d={box} fillRule="evenodd" fill={url(id('lit'))} />);
  }
  if (f === 'none' && light.from === 'far') {
    if (wall) {
      defs.push(<Lin key="far" id={id('far')} x2={1} y2={0} s={[[0, '#000000', 0.22], [0.55, '#000000', 0.04], [1, light.color, 0.16]]} />);
      out.push(<path key="far" d={box} fillRule="evenodd" fill={url(id('far'))} />);
    } else out.push(<path key="far" d={box} fillRule="evenodd" fill="#000000" opacity={0.16} />);
  }
  if (f === 'none' && (light.from === 'left' || light.from === 'right')) {
    const lit: Stop = [0, light.color, 0.14];
    const dark: Stop = [1, '#000000', 0.2];
    defs.push(<Lin key="side" id={id('side')} x2={1} y2={0} s={light.from === 'left' ? [lit, dark] : [[0, '#000000', 0.2], [1, light.color, 0.14]]} />);
    out.push(<path key="side" d={box} fillRule="evenodd" fill={url(id('side'))} />);
  }
  if (light.from === 'above' || light.from === 'below') {
    const up = light.from === 'above';
    defs.push(<Lin key="v" id={id('v')} s={up ? [[0, light.color, 0.16], [0.5, light.color, 0], [1, '#000000', 0.16]] : [[0, '#000000', 0.18], [0.55, light.color, 0], [1, light.color, 0.18]]} />);
    out.push(<path key="v" d={box} fillRule="evenodd" fill={url(id('v'))} />);
  }
  defs.push(<LinU key="ao" id={id('ao')} y1={h - 46} y2={h} s={[[0, '#000000', 0], [1, '#000000', 0.3]]} />);
  out.push(<path key="ao" d={gap ? `${rect(0, h - 46, gap[0], 46)}${rect(gap[1], h - 46, w - gap[1], 46)}` : rect(0, h - 46, w, 46)} fill={url(id('ao'))} />);
  return (
    <>
      <defs>{defs}</defs>
      {out}
    </>
  );
}

/** Above the eye line, everything settles to tone-on-tone (contrast ≤ 1.6:1): the words sit there. */
function QuietVeil({ id, w, eye, color, hole = '' }: { id: string; w: number; eye: number | null; color: string; hole?: string }) {
  if (eye === null || eye <= 0) return null;
  const end = eye + 14;
  const solid = Math.max(0, eye - 70) / end;
  return (
    <>
      <defs>
        <LinU id={id} y2={end} s={[[0, color, 0.86], [solid, color, 0.86], [1, color, 0]]} />
      </defs>
      <path d={`${rect(0, 0, w, end)}${hole}`} fillRule="evenodd" fill={url(id)} />
    </>
  );
}

// ─────────────────────────── floors ───────────────────────────

interface Material {
  tw: number;
  th: number;
  body: ReactNode;
  /** The material's average tone (distance flattens contrast toward it). */
  mean: string;
  /** Polished floors mirror the light pools as streaks. */
  polished: boolean;
}

function floorMaterial(variant: FloorVariant, c: C, n: DrawProps['nature'], low: boolean, salt: number): Material {
  const joints = (d: string, color: string, width: number, opacity = 0.55) => <path d={d} fill="none" stroke={color} strokeWidth={width} opacity={opacity} />;
  switch (variant) {
    case 'chequer': {
      const a = blend(blend(c.surface, c.background, 0.4), c.muted, 0.16);
      const b = blend(c.primary, c.text, 0.35);
      const pts: Array<[number, number]> = [];
      for (const x of [0, 100, 200]) for (const y of [0, 100, 200]) pts.push([x, y]);
      return {
        tw: 200,
        th: 200,
        mean: blend(a, b, 0.5),
        polished: true,
        body: (
          <>
            <rect width={200} height={200} fill={a} />
            <path d="M100 0h100v100H100zM0 100h100v100H0z" fill={b} />
            {low ? null : <path d="M6 34C34 22 58 72 94 58M106 146C140 120 160 178 194 160M118 22C140 40 150 30 190 70" fill="none" stroke={blend(a, c.muted, 0.4)} strokeWidth={1.3} opacity={0.6} />}
            {joints('M0 0H200M0 100H200M0 200H200M0 0V200M100 0V200M200 0V200', c.secondary, 2.4, 0.6)}
            <path d={pts.map(([x, y]) => diamond(x, y, 9)).join('')} fill={c.secondary} />
          </>
        ),
      };
    }
    case 'flags': {
      const t1 = blend(c.surface, c.muted, 0.16);
      const t2 = blend(c.surface, c.muted, 0.27);
      const t3 = blend(c.surface, c.background, 0.35);
      return {
        tw: 240,
        th: 160,
        mean: t2,
        polished: false,
        body: (
          <>
            <rect width={240} height={160} fill={t1} />
            <path d={`${rect(100, 0, 140, 80)}${rect(170, 80, 70, 80)}`} fill={t2} />
            <path d={`${rect(0, 80, 50, 80)}`} fill={t3} />
            {low ? null : <path d={circles(specks(10, 240, 160, salt, 1, 2.4))} fill={blend(t2, c.text, 0.25)} opacity={0.35} />}
            {joints('M0 0H240M0 80H240M0 160H240M100 0V80M0 0V160M240 0V160M50 80V160M170 80V160', blend(c.muted, c.text, 0.25), 3)}
            {low ? null : joints('M2 3H98M102 3H238M2 83H48M52 83H168M172 83H238', tint(t1, 0.4), 1.4, 0.5)}
          </>
        ),
      };
    }
    case 'terracotta': {
      const c0 = blend(n.clay, c.primary, 0.22);
      const grout = blend(c.background, n.clay, 0.3);
      const pts: Array<[number, number]> = [];
      for (const x of [0, 80, 160]) for (const y of [0, 80, 160]) pts.push([x, y]);
      return {
        tw: 160,
        th: 160,
        mean: c0,
        polished: false,
        body: (
          <>
            <rect width={160} height={160} fill={c0} />
            <path d={`${rect(80, 0, 80, 80)}`} fill={shade(c0, 0.08)} />
            <path d={`${rect(0, 80, 80, 80)}`} fill={tint(c0, 0.06)} />
            <path d={`${rect(80, 80, 80, 80)}`} fill={shade(c0, 0.03)} />
            {low ? null : <path d={circles(specks(8, 160, 160, salt, 1.5, 3))} fill={shade(c0, 0.2)} opacity={0.4} />}
            {joints('M0 0H160M0 80H160M0 160H160M0 0V160M80 0V160M160 0V160', grout, 4, 0.9)}
            <path d={pts.map(([x, y]) => diamond(x, y, 10)).join('')} fill={blend(c.background, c.surface, 0.5)} />
          </>
        ),
      };
    }
    case 'terrace': {
      const t = blend(c.surface, c.muted, 0.14);
      return {
        tw: 240,
        th: 240,
        mean: t,
        polished: true,
        body: (
          <>
            <rect width={240} height={240} fill={t} />
            <path d={rect(120, 0, 120, 120)} fill={blend(t, c.muted, 0.08)} />
            <path d={rect(0, 120, 120, 120)} fill={tint(t, 0.05)} />
            {joints('M0 0H240M0 120H240M0 240H240M0 0V240M120 0V240M240 0V240', blend(c.muted, c.text, 0.15), 1.6, 0.5)}
          </>
        ),
      };
    }
    case 'templeStone': {
      const s1 = blend(c.surface, c.secondary, 0.2);
      const s2 = blend(c.surface, c.secondary, 0.3);
      const s3 = blend(c.surface, c.muted, 0.24);
      return {
        tw: 240,
        th: 180,
        mean: s2,
        polished: false,
        body: (
          <>
            <rect width={240} height={180} fill={s1} />
            <path d={`${rect(130, 0, 110, 90)}${rect(70, 90, 120, 90)}`} fill={s2} />
            <path d={`${rect(0, 90, 70, 90)}`} fill={s3} />
            {low ? null : <path d={circles(specks(12, 240, 180, salt, 1.2, 3))} fill={blend(s2, c.text, 0.3)} opacity={0.3} />}
            {joints('M0 0H240M0 90H240M0 180H240M0 0V180M240 0V180M130 0V90M70 90V180M190 90V180', blend(c.muted, c.text, 0.25), 3, 0.5)}
          </>
        ),
      };
    }
    case 'cobbles': {
      // Hand-laid setts: two offset courses of rounded stones, each a little different, in warm grey.
      const grout = blend(blend(c.muted, c.text, 0.42), c.secondary, 0.08);
      const tones = [blend(blend(c.muted, c.surface, 0.24), c.secondary, 0.12), blend(c.muted, c.surface, 0.4), blend(blend(c.muted, c.text, 0.06), c.secondary, 0.1)];
      const stones: Array<[number, number, number, number]> = [];
      const jitter = (i: number, k: number, edge: boolean) => (edge ? 0 : (rand(i, salt + k) - 0.5) * 6);
      [20, 60, 100, 140].forEach((x, i) => stones.push([x + jitter(i, 1, false), 27 + jitter(i, 2, false), 17 + rand(i, salt + 3) * 3, 12 + rand(i, salt + 4) * 2]));
      [0, 40, 80, 120, 160].forEach((x, i) => {
        const edge = i === 0 || i === 4;
        stones.push([x + jitter(i + 9, 1, edge), 82 + jitter(i + 9, 2, edge), edge ? 18 : 17 + rand(i + 9, salt + 3) * 3, edge ? 13 : 12 + rand(i + 9, salt + 4) * 2]);
      });
      const oval = ([x, y, rx, ry]: [number, number, number, number]) => `M${r1(x - rx)} ${r1(y)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0`;
      return {
        tw: 160,
        th: 110,
        mean: blend(tones[0] ?? grout, grout, 0.3),
        polished: false,
        body: (
          <>
            <rect width={160} height={110} fill={grout} />
            {tones.map((tone, k) => (
              <path key={k} d={stones.filter((_, i) => i % 3 === k).map(oval).join('')} fill={tone} />
            ))}
            {low ? null : <path d={stones.map(([x, y, rx, ry]) => oval([x - rx * 0.25, y - ry * 0.3, rx * 0.5, ry * 0.32])).join('')} fill={tint(tones[1] ?? grout, 0.3)} opacity={0.4} />}
          </>
        ),
      };
    }
    case 'earth': {
      // Packed mela ground: trampled patches, grit and a few straws.
      const e = blend(blend(c.muted, c.secondary, 0.3), c.surface, 0.25);
      return {
        tw: 300,
        th: 300,
        mean: e,
        polished: false,
        body: (
          <>
            <rect width={300} height={300} fill={e} />
            <path d="M10 96C40 60 120 58 150 84S120 132 70 128 0 120 10 96Z" fill={shade(e, 0.1)} opacity={0.22} />
            <path d="M160 214C190 190 280 196 292 222S236 262 196 252 140 236 160 214Z" fill={tint(e, 0.14)} opacity={0.25} />
            <path d="M200 40C222 30 270 36 268 56S226 74 208 66 186 50 200 40Z" fill={shade(e, 0.08)} opacity={0.22} />
            <path d={circles(specks(low ? 8 : 22, 300, 300, salt, 1, 3.2))} fill={shade(e, 0.24)} opacity={0.45} />
            {low ? null : <path d={circles(specks(14, 300, 300, salt + 9, 1, 2.2))} fill={tint(e, 0.3)} opacity={0.5} />}
            {low ? null : <path d={specks(6, 300, 300, salt + 17, 6, 11).map(([x, y, l]) => `M${x} ${y}l${l} ${r1(l * 0.3)}`).join('')} stroke={blend(c.secondary, c.surface, 0.4)} strokeWidth={1.4} opacity={0.6} />}
          </>
        ),
      };
    }
    case 'redOxide': {
      const red = shade(blend(n.clayDark, n.clay, 0.35), 0.08);
      return {
        tw: 120,
        th: 120,
        mean: red,
        polished: true,
        body: (
          <>
            <rect width={120} height={120} fill={red} />
            {low ? null : <ellipse cx={70} cy={50} rx={46} ry={30} fill={tint(red, 0.06)} opacity={0.6} />}
            {joints('M0 0H120M0 0V120', shade(red, 0.35), 1.6, 0.6)}
          </>
        ),
      };
    }
    case 'granite': {
      const g = blend(c.muted, c.text, 0.45);
      return {
        tw: 120,
        th: 120,
        mean: g,
        polished: true,
        body: (
          <>
            <rect width={120} height={120} fill={g} />
            {low ? null : <path d={circles(specks(16, 120, 120, salt, 0.8, 2))} fill={tint(g, 0.4)} opacity={0.55} />}
            {low ? null : <path d={circles(specks(12, 120, 120, salt + 5, 0.8, 2.2))} fill={shade(g, 0.35)} opacity={0.6} />}
            {joints('M0 0H120M0 0V120', tint(g, 0.2), 1.4, 0.6)}
          </>
        ),
      };
    }
    case 'parquet': {
      const w0 = woodOf(c, n);
      const tones = [w0, shade(w0, 0.1), tint(w0, 0.08), shade(w0, 0.04)];
      const planks: string[] = [];
      const block = (bx: number, by: number, across: boolean, k: number) => {
        for (let i = 0; i < 4; i++) planks[(i + k) % 4] = `${planks[(i + k) % 4] ?? ''}${across ? rect(bx, by + i * 15, 60, 15) : rect(bx + i * 15, by, 15, 60)}`;
      };
      block(0, 0, true, 0);
      block(60, 0, false, 1);
      block(0, 60, false, 2);
      block(60, 60, true, 3);
      return {
        tw: 120,
        th: 120,
        mean: w0,
        polished: true,
        body: (
          <>
            {planks.map((d, i) => (
              <path key={i} d={d} fill={tones[i]} stroke={shade(w0, 0.35)} strokeWidth={0.8} />
            ))}
            {joints('M0 0H120M0 60H120M0 0V120M60 0V120', shade(w0, 0.45), 1.6, 0.7)}
          </>
        ),
      };
    }
    case 'carpet': {
      const base = blend(c.primary, c.text, 0.15);
      const motif = blend(base, c.secondary, 0.22);
      return {
        tw: 80,
        th: 80,
        mean: base,
        polished: false,
        body: (
          <>
            <rect width={80} height={80} fill={base} />
            <path d={`${diamond(40, 40, 14, 18)}${diamond(40, 40, 7, 9)}`} fill="none" stroke={motif} strokeWidth={2} />
            <path d={circles([[0, 0, 3], [80, 0, 3], [0, 80, 3], [80, 80, 3], [40, 40, 2.4]])} fill={motif} />
          </>
        ),
      };
    }
    case 'sawdust': {
      const s = blend(c.secondary, c.background, 0.48);
      return {
        tw: 120,
        th: 120,
        mean: s,
        polished: false,
        body: (
          <>
            <rect width={120} height={120} fill={s} />
            <path d={circles(specks(low ? 8 : 18, 120, 120, salt, 0.8, 2.4))} fill={blend(c.secondary, c.text, 0.35)} opacity={0.4} />
            {low ? null : <path d={specks(10, 120, 120, salt + 3, 3, 7).map(([x, y, l]) => `M${x} ${y}l${l} ${r2(l * (rand(Math.round(x), salt) - 0.5))}`).join('')} stroke={tint(s, 0.45)} strokeWidth={1.3} opacity={0.7} />}
          </>
        ),
      };
    }
    case 'lawn': {
      const g1 = blend(n.leaf, n.leafLight, 0.35);
      const g2 = blend(n.leaf, n.leafDark, 0.12);
      return {
        tw: 240,
        th: 120,
        mean: blend(g1, g2, 0.5),
        polished: false,
        body: (
          <>
            <rect width={120} height={120} fill={g1} />
            <rect x={120} width={120} height={120} fill={g2} />
            {low ? null : <path d={specks(16, 240, 120, salt, 4, 7).map(([x, y, l]) => `M${x} ${y}l${r2(l * 0.25)} ${-l}`).join('')} stroke={n.leafDark} strokeWidth={1.2} opacity={0.35} />}
            {low ? null : <path d={specks(10, 240, 120, salt + 7, 3, 6).map(([x, y, l]) => `M${x} ${y}l${r2(-l * 0.3)} ${-l}`).join('')} stroke={n.leafLight} strokeWidth={1.2} opacity={0.45} />}
          </>
        ),
      };
    }
    case 'teak': {
      const w0 = woodOf(c, n);
      const tones = [w0, shade(w0, 0.08), tint(w0, 0.07), shade(w0, 0.14)];
      const cuts = [80, 300, 190, 410];
      return {
        tw: 144,
        th: 480,
        mean: w0,
        polished: true,
        body: (
          <>
            {tones.map((t, i) => (
              <rect key={i} x={i * 36} width={36} height={480} fill={t} />
            ))}
            {low ? null : <path d={tones.map((_, i) => `M${i * 36 + 12} 0V480M${i * 36 + 25} 0V480`).join('')} stroke={shade(w0, 0.2)} strokeWidth={0.8} opacity={0.35} />}
            {joints(`${tones.map((_, i) => `M${i * 36} 0V480`).join('')}${cuts.map((y, i) => `M${i * 36} ${y}h36`).join('')}`, shade(w0, 0.45), 1.6, 0.75)}
          </>
        ),
      };
    }
  }
}

/** A small sikku kolam (drawn once round the origin, placed with <use>): a diamond of dots, each ringed by an interlocking loop, in rice-flour white. */
function Kolam({ id, rows, g, color, low }: { id: string; rows: number; g: number; color: string; low: boolean }) {
  const pts: Array<[number, number]> = [];
  const mid = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    const count = rows - 2 * Math.abs(r - mid);
    for (let k = 0; k < count; k++) pts.push([(k - (count - 1) / 2) * g, (r - mid) * g * 0.62]);
  }
  const span = mid * g + g * 0.7;
  const tips: Array<readonly [number, number, number]> = [
    [-span, 0, g * 0.32],
    [span, 0, g * 0.32],
    [0, -span * 0.62, g * 0.32],
    [0, span * 0.62, g * 0.32],
  ];
  return (
    <g id={id} fill="none" stroke={color} strokeLinecap="round">
      <path d={pts.map(([px, py]) => `M${r1(px - g * 0.46)} ${r1(py)}a${r1(g * 0.46)} ${r1(g * 0.3)} 0 1 0 ${r1(g * 0.92)} 0a${r1(g * 0.46)} ${r1(g * 0.3)} 0 1 0 ${r1(-g * 0.92)} 0`).join('')} strokeWidth={r1(g * 0.09)} />
      <path d={diamond(0, 0, span, span * 0.62)} strokeWidth={r1(g * 0.08)} opacity={0.85} />
      {low ? null : <path d={circles(tips)} strokeWidth={r1(g * 0.07)} />}
      <path d={circles(pts.map(([px, py]) => [px, py, g * 0.07] as const))} fill={color} stroke="none" />
    </g>
  );
}

/** A powder rangoli (drawn once round the origin, placed with <use>): rings of petals round a lotus heart, outlined in white dots. */
function Rangoli({ id, r, c, low }: { id: string; r: number; c: C; low: boolean }) {
  const white = blend(c.background, '#ffffff', 0.5);
  const ring = (n: number, k: string) => Array.from({ length: n }, (_, i) => <use key={`${k}${i}`} href={`#${id}${k}`} transform={`rotate(${r1((360 / n) * i)})`} />);
  return (
    <g id={id}>
      <ellipse id={`${id}o`} cx={r1(r * 0.78)} cy={0} rx={r1(r * 0.2)} ry={r1(r * 0.085)} fill={c.accent} />
      <ellipse id={`${id}m`} cx={r1(r * 0.48)} cy={0} rx={r1(r * 0.22)} ry={r1(r * 0.11)} fill={c.primary} />
      <circle r={r1(r * 0.98)} fill={blend(c.secondary, c.background, 0.45)} opacity={0.5} />
      {ring(low ? 8 : 16, 'o')}
      {ring(8, 'm')}
      <circle r={r1(r * 0.28)} fill={c.secondary} />
      <circle r={r1(r * 0.12)} fill={blend(c.primary, c.accent, 0.4)} />
      {low ? null : <circle r={r1(r * 0.99)} fill="none" stroke={white} strokeWidth={r1(r * 0.03)} strokeDasharray={`${r1(r * 0.02)} ${r1(r * 0.07)}`} strokeLinecap="round" />}
      <circle r={r1(r * 0.34)} fill="none" stroke={white} strokeWidth={r1(r * 0.025)} />
    </g>
  );
}

/** A floor plane drawn flat in plan (content top = the far end), a repeating pattern in two tints with baked light pools. */
export function Floor(props: DrawProps & FloorOptions) {
  const { w, h, colors: c, nature: n, light, plane, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'f', [variant, props.runner, props.kolam, props.rangoli, props.ring, props.channel, props.path, props.petals, props.pools]);
  const g = plane ?? { x0: 0, x1: w, y0: 800, y1: 800, dNear: 0, dFar: h };
  const fx = (x: number) => r2(x - g.x0);
  const fy = (d: number) => r2(g.dFar - d);
  const depth = g.dFar - g.dNear;
  const salt = 11 + (Math.abs(Math.round(props.seed)) % 97);
  const m = floorMaterial(variant, c, n, low, salt);
  const cx = fx(600);
  const white = blend(c.background, '#ffffff', 0.55);
  const defs: ReactNode[] = [];
  const parts: ReactNode[] = [];

  if (props.path) {
    const gravel = blend(c.surface, c.muted, 0.3);
    const edge = blend(n.clay, c.muted, 0.35);
    defs.push(
      <pattern key="pg" id={id('pg')} width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill={gravel} />
        {low ? null : <path d={circles(specks(9, 60, 60, salt + 21, 1, 2.6))} fill={shade(gravel, 0.22)} opacity={0.5} />}
      </pattern>,
    );
    parts.push(
      <g key="path">
        <rect x={r2(cx - 92)} width={184} height={h} fill={url(id('pg'))} />
        <path d={`${rect(cx - 104, 0, 14, h)}${rect(cx + 90, 0, 14, h)}`} fill={edge} />
        <path d={`M${r2(cx - 90)} 0V${h}M${r2(cx + 90)} 0V${h}`} stroke={shade(edge, 0.35)} strokeWidth={2} />
      </g>,
    );
  }
  if (props.channel) {
    const coping = blend(c.background, c.surface, 0.4);
    defs.push(<Lin key="ch" id={id('ch')} s={[[0, blend(c.background, c.accent, 0.35)], [0.5, blend(c.primary, c.background, 0.45)], [1, blend(c.primary, c.text, 0.3)]]} />);
    const shimmer = low
      ? ''
      : Array.from({ length: Math.round(h / 46) }, (_, i) => {
          const y = r2((i + rand(i, salt) * 0.6) * 46);
          const lw = r2(10 + rand(i, salt + 1) * 34);
          return `M${r2(cx - 30 + rand(i, salt + 2) * (60 - lw))} ${y}h${lw}`;
        }).join('');
    parts.push(
      <g key="channel">
        <path d={`${rect(cx - 58, 0, 18, h)}${rect(cx + 40, 0, 18, h)}`} fill={coping} />
        <rect x={r2(cx - 40)} width={80} height={h} fill={url(id('ch'))} />
        {shimmer ? <path d={shimmer} stroke={tint(c.accent, 0.4)} strokeWidth={2.2} strokeLinecap="round" opacity={0.6} /> : null}
        <path d={`M${r2(cx - 40)} 0V${h}M${r2(cx + 40)} 0V${h}`} stroke={light.rim} strokeWidth={1.6} opacity={0.6} />
        <path d={`M${r2(cx - 58)} 0V${h}M${r2(cx + 58)} 0V${h}`} stroke={shade(coping, 0.3)} strokeWidth={2} opacity={0.6} />
      </g>,
    );
  }
  if (props.runner) {
    const field = c.primary;
    const motif = blend(c.primary, c.secondary, 0.35);
    defs.push(
      <pattern key="rn" id={id('rn')} x={r2(cx - 56)} width={112} height={120} patternUnits="userSpaceOnUse">
        <rect width={112} height={120} fill={field} />
        <path d={`${diamond(56, 60, 30, 40)}${diamond(56, 60, 16, 22)}`} fill="none" stroke={motif} strokeWidth={2.4} />
        <path d={`${diamond(56, 60, 5, 7)}${diamond(0, 0, 8, 10)}${diamond(112, 0, 8, 10)}${diamond(0, 120, 8, 10)}${diamond(112, 120, 8, 10)}`} fill={motif} />
      </pattern>,
    );
    parts.push(
      <g key="runner">
        <rect x={r2(cx - 80)} width={160} height={h} fill={c.secondary} />
        <rect x={r2(cx - 68)} width={136} height={h} fill={shade(c.primary, 0.25)} />
        <rect x={r2(cx - 56)} width={112} height={h} fill={url(id('rn'))} />
        {low ? null : <path d={`M${r2(cx - 74)} 0V${h}M${r2(cx + 74)} 0V${h}`} stroke={shade(c.secondary, 0.3)} strokeWidth={2} strokeDasharray="6 8" />}
        <path d={`M${r2(cx - 80)} 0V${h}M${r2(cx + 80)} 0V${h}`} stroke={shade(c.primary, 0.4)} strokeWidth={3} opacity={0.5} />
      </g>,
    );
  }
  if (props.ring) {
    const rx = cx;
    const ry = fy(g.dNear + depth * 0.55);
    const R = Math.min(300, (g.x1 - g.x0) * 0.4);
    parts.push(
      <g key="ring">
        <circle cx={rx} cy={ry} r={r2(R + 24)} fill="#000000" opacity={0.12} />
        <circle cx={rx} cy={ry} r={r2(R - 18)} fill={tint(m.mean, 0.12)} />
        <circle cx={rx} cy={ry} r={R} fill="none" stroke={blend(c.background, c.accent, 0.3)} strokeWidth={34} />
        <circle cx={rx} cy={ry} r={R} fill="none" stroke={c.primary} strokeWidth={34} strokeDasharray="64 64" />
        <circle cx={rx} cy={ry} r={r2(R - 17)} fill="none" stroke={c.secondary} strokeWidth={4} />
        <circle cx={rx} cy={ry} r={r2(R + 17)} fill="none" stroke={shade(c.primary, 0.4)} strokeWidth={3} opacity={0.6} />
      </g>,
    );
  }
  if (props.kolam === 'center') {
    defs.push(<Kolam key="kc" id={id('kc')} rows={7} g={40} color={white} low={low} />);
    parts.push(<use key="kc" href={`#${id('kc')}`} x={cx} y={fy(g.dNear + depth * 0.45)} />);
  }
  const rangoliD = g.dNear + depth * 0.62;
  if (props.kolam === 'path') {
    const stop = props.rangoli && variant !== 'cobbles' ? rangoliD - 200 : g.dFar - 160;
    defs.push(<Kolam key="kp" id={id('kp')} rows={3} g={38} color={white} low={low} />);
    for (let d = g.dNear + 150, i = 0; d <= stop; d += 240, i++) parts.push(<use key={`kp${i}`} href={`#${id('kp')}`} x={cx} y={fy(d)} />);
  }
  if (props.rangoli) {
    const doorsteps = variant === 'cobbles';
    defs.push(<Rangoli key="rg" id={id('rg')} r={doorsteps ? 48 : 110} c={c} low={low} />);
    if (doorsteps) {
      for (let d = g.dNear + 280, i = 0; d < g.dFar - 200; d += 420, i++) parts.push(<use key={`rs${i}`} href={`#${id('rg')}`} x={fx(i % 2 ? g.x1 - 70 : g.x0 + 70)} y={fy(d)} />);
    } else parts.push(<use key="rc" href={`#${id('rg')}`} x={cx} y={fy(rangoliD)} />);
  }
  if (props.petals && !low) {
    const tones = [blend(c.secondary, c.accent, 0.3), tint(c.accent, 0.25), blend(c.primary, c.accent, 0.45)];
    const count = Math.min(70, Math.round(depth / 30));
    tones.forEach((tone, k) => {
      const d = Array.from({ length: count }, (_, i) => i)
        .filter((i) => i % 3 === k)
        .map((i) => {
          const x = cx + (rand(i, salt + 31) - 0.5) * 220;
          const y = rand(i, salt + 32) * h;
          const a = r2((rand(i, salt + 33) - 0.5) * 10);
          return `M${r2(x - 7)} ${r2(y)}q${r2(7)} ${r2(-5 + a * 0.2)} 14 ${a}q-7 ${r2(6)} -14 ${-a}`;
        })
        .join('');
      parts.push(<path key={`pt${k}`} d={d} fill={tone} opacity={0.9} />);
    });
  }

  // Light: distance flattens the pattern, the key glows from its side, pools of lamp light, the near edge falls dark.
  defs.push(<Lin key="fall" id={id('fall')} s={[[0, m.mean, 0.55], [0.45, m.mean, 0]]} />);
  if (light.from === 'far') defs.push(<Lin key="key" id={id('key')} s={[[0, light.color, 0.26], [0.5, light.color, 0]]} />);
  if (light.from === 'left' || light.from === 'right') defs.push(<Lin key="key" id={id('key')} x2={1} y2={0} s={light.from === 'left' ? [[0, light.color, 0.16], [0.6, light.color, 0], [1, '#000000', 0.14]] : [[0, '#000000', 0.14], [0.4, light.color, 0], [1, light.color, 0.16]]} />);
  defs.push(<Lin key="near" id={id('near')} s={[[0.7, '#000000', 0], [1, '#000000', 0.24]]} />);
  const pools = props.pools ?? [];
  const pooled = pools.map((pool, i) => {
    const px = fx(pool.x);
    const py = fy(pool.d);
    defs.push(<Rad key={`pl${i}`} id={id(`pl${i}`)} s={[[0, pool.color, 0.55], [0.45, pool.color, 0.22], [1, pool.color, 0]]} />);
    const glow = <ellipse key={`pl${i}`} cx={px} cy={py} rx={r2(pool.r)} ry={r2(pool.r)} fill={url(id(`pl${i}`))} />;
    if (!m.polished) return glow;
    // A polished floor mirrors the light as a streak running toward the viewer (600, d 0).
    const vx = 600 - pool.x;
    const len = Math.sqrt(vx * vx + pool.d * pool.d) || 1;
    const L = Math.min(pool.d * 0.6, 1000);
    const ex = px + (vx / len) * L;
    const ey = py + (pool.d / len) * L;
    const seg: Segment = [
      [px, py],
      [px + (ex - px) / 3, py + (ey - py) / 3],
      [px + ((ex - px) * 2) / 3, py + ((ey - py) * 2) / 3],
      [ex, ey],
    ];
    defs.push(<LinU key={`rf${i}`} id={id(`rf${i}`)} x1={px} y1={py} x2={ex} y2={ey} s={[[0, pool.color, 0.42], [1, pool.color, 0]]} />);
    return (
      <g key={`pl${i}`}>
        {glow}
        <path d={taper([seg], [pool.r * 0.42, pool.r * 0.1], 6)} fill={url(id(`rf${i}`))} />
      </g>
    );
  });

  return (
    <Svg w={w} h={h}>
      <defs>
        <pattern id={id('m')} x={r2(-g.x0)} y={r2(g.dFar)} width={m.tw} height={m.th} patternUnits="userSpaceOnUse">
          {m.body}
        </pattern>
        {defs}
      </defs>
      <rect width={w} height={h} fill={url(id('m'))} />
      {parts}
      <rect width={w} height={h} fill={url(id('fall'))} />
      {light.from === 'far' || light.from === 'left' || light.from === 'right' ? <rect width={w} height={h} fill={url(id('key'))} /> : null}
      {pooled}
      <rect width={w} height={h} fill={url(id('near'))} />
    </Svg>
  );
}

// ─────────────────────────── water ───────────────────────────

/** The sun's frame x on sunrise skies: the river's sun path lies beneath it. */
const SUN_X: Partial<Record<SkyVariant, number>> = { sunrise: 410, golden: 300 };

/** A water plane: the sky's colour far, deep near, highlight bands and reflection streaks. */
export function Water(props: DrawProps & WaterOptions) {
  const { w, h, colors: c, light, plane, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'w', [variant, props.streaks]);
  const g = plane ?? { x0: 0, x1: w, y0: 800, y1: 800, dNear: 0, dFar: h };
  const fx = (x: number) => x - g.x0;
  const salt = 5 + (Math.abs(Math.round(props.seed)) % 89);
  const pool = variant === 'pool';
  const skyTone = blend(c.background, c.accent, variant === 'river' ? 0.45 : 0.35);
  const deep = pool ? blend(c.muted, c.text, 0.42) : blend(c.primary, c.text, variant === 'river' ? 0.15 : 0.3);
  const mid = variant === 'river' ? blend(c.primary, c.accent, 0.4) : blend(c.primary, c.background, 0.45);
  const shine = tint(c.accent, 0.5);
  const inset = pool ? 12 : 0;
  // Ripple glints: short level strokes, crowded toward the far end where the water lies flattest.
  const ripples = low
    ? ''
    : Array.from({ length: pool ? 26 : 60 }, (_, i) => {
        const f = rand(i, salt);
        const y = r2(f * f * h);
        const lw = r2((pool ? 8 : 18) + rand(i, salt + 1) * (pool ? 26 : 90) * (0.4 + f));
        const x = r2(inset + rand(i, salt + 2) * (w - 2 * inset - lw));
        return variant === 'river' ? `M${x} ${y}q${r2(lw / 4)} -3 ${r2(lw / 2)} 0t${r2(lw / 2)} 0` : `M${x} ${y}h${lw}`;
      }).join('');
  const streak = (sx: number, color: string, k: string, top: number, bottom: number, width: number) => {
    const n = Math.max(8, Math.round((bottom - top) / 34));
    const d = Array.from({ length: n }, (_, i) => {
      const f = i / n;
      const y = top + (bottom - top) * f * f;
      const sw = width * (0.35 + rand(i, salt + 40) * 0.65) * (0.6 + f * 0.6);
      return rect(sx - sw / 2 + (rand(i, salt + 41) - 0.5) * width * 0.3, y, sw, 4 + f * 12);
    }).join('');
    return (
      <g key={k}>
        <defs>
          <LinU id={id(k)} y1={top} y2={bottom} s={[[0, color, 0.62], [0.55, color, 0.3], [1, color, 0]]} />
        </defs>
        <rect x={r2(sx - width * 0.32)} y={r2(top)} width={r2(width * 0.64)} height={r2(bottom - top)} fill={url(id(k))} opacity={0.5} />
        <path d={d} fill={url(id(k))} />
      </g>
    );
  };
  const streaks = (props.streaks ?? []).map((s, i) => streak(fx(s.x), s.color, `s${i}`, 0, h * 0.7, pool ? 40 : 70));
  let sunPath: ReactNode = null;
  if (variant === 'river') {
    // Beneath the sun at frame x SUN_X, the glitter lies along world x = 600 + (SUN_X − 600)·d / 692.82.
    const sx = SUN_X.sunrise ?? 410;
    const n = 30;
    const d = Array.from({ length: n }, (_, i) => {
      const f = i / n;
      const dist = g.dFar - (g.dFar - g.dNear) * f * f;
      const x = fx(600 + ((sx - 600) * dist) / 692.82);
      const y = g.dFar - dist;
      const sw = (30 + rand(i, salt + 50) * 70) * (0.5 + f);
      return rect(x - sw / 2, y, sw, 4 + f * 14);
    }).join('');
    sunPath = (
      <g opacity={0.75}>
        <path d={d} fill={light.color} />
      </g>
    );
  }
  return (
    <Svg w={w} h={h}>
      <defs>
        <Lin id={id('g')} s={[[0, skyTone], [0.35, blend(skyTone, mid, 0.5)], [0.7, mid], [1, deep]]} />
        <Lin id={id('n')} s={[[0.65, '#000000', 0], [1, '#000000', 0.22]]} />
      </defs>
      {pool ? <rect width={w} height={h} fill={blend(c.background, c.surface, 0.3)} /> : null}
      <rect x={inset} y={pool ? inset : 0} width={r2(w - 2 * inset)} height={r2(h - (pool ? 2 * inset : 0))} fill={url(id('g'))} />
      {[0.1, 0.24, 0.46].map((f, i) => (
        <rect key={i} x={inset} y={r2(h * f)} width={r2(w - 2 * inset)} height={r2(h * (0.006 + i * 0.004))} fill={shine} opacity={0.3 - i * 0.07} />
      ))}
      {ripples ? <path d={ripples} fill="none" stroke={shine} strokeWidth={variant === 'river' ? 2.4 : 2} strokeLinecap="round" opacity={0.42} /> : null}
      {sunPath}
      {streaks}
      {pool ? (
        <g>
          <path d={`${rect(0, 0, w, h)}${rect(inset, inset, w - 2 * inset, h - 2 * inset)}`} fillRule="evenodd" fill={blend(c.background, c.surface, 0.3)} />
          <rect x={inset} y={inset} width={r2(w - 2 * inset)} height={r2(h - 2 * inset)} fill="none" stroke={shade(c.surface, 0.35)} strokeWidth={3} />
          <rect x={inset / 2} y={inset / 2} width={r2(w - inset)} height={r2(h - inset)} fill="none" stroke={light.rim} strokeWidth={1.4} opacity={0.6} />
        </g>
      ) : null}
      <rect width={w} height={h} fill={url(id('n'))} />
    </Svg>
  );
}

// ─────────────────────────── ceilings ───────────────────────────

/** A ceiling, always quiet (tone-on-tone, contrast ≤ 1.6:1): coffers, beams or strips. Content top = the near end. */
export function Ceiling(props: DrawProps & CeilingOptions) {
  const { w, h, colors: c, nature: n, light, plane, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'c', [variant]);
  const g = plane ?? { x0: 0, x1: w, y0: 0, y1: 0, dNear: 0, dFar: h };
  const fx = (x: number) => r2(x - g.x0);
  const depth = g.dFar - g.dNear;
  let base = c.primary;
  let tile: { tw: number; th: number; body: ReactNode } | null = null;
  const over: ReactNode[] = [];
  switch (variant) {
    case 'mirrorCoffer': {
      base = blend(c.primary, c.text, 0.38);
      const frame = blend(base, c.secondary, 0.14);
      const recess = blend(base, c.text, 0.25);
      tile = {
        tw: 120,
        th: 120,
        body: (
          <>
            <rect width={120} height={120} fill={frame} />
            <rect x={12} y={12} width={96} height={96} fill={recess} />
            <rect x={20} y={20} width={80} height={80} fill={base} />
            <path d={star8(60, 60, 3.6)} fill="none" stroke={blend(base, c.secondary, 0.22)} strokeWidth={1.6} />
            {low ? null : <path d={circles([[60, 31, 1.6], [60, 89, 1.6], [31, 60, 1.6], [89, 60, 1.6], [40, 40, 1.2], [80, 40, 1.2], [40, 80, 1.2], [80, 80, 1.2], [60, 60, 2]])} fill={c.accent} opacity={0.25} />}
          </>
        ),
      };
      break;
    }
    case 'plasterCoffer': {
      base = blend(blend(c.primary, c.muted, 0.3), c.text, 0.12);
      const frame = blend(base, c.background, 0.12);
      tile = {
        tw: 160,
        th: 160,
        body: (
          <>
            <rect width={160} height={160} fill={frame} />
            <rect x={18} y={18} width={124} height={124} fill={blend(base, c.text, 0.12)} />
            <rect x={28} y={28} width={104} height={104} fill={base} />
            <circle cx={80} cy={80} r={26} fill="none" stroke={blend(base, c.secondary, 0.2)} strokeWidth={2} />
            <path d={star8(80, 80, 1.6)} fill={blend(base, c.secondary, 0.18)} />
            {low ? null : <rect x={23} y={23} width={114} height={114} fill="none" stroke={c.secondary} strokeWidth={1.2} opacity={0.22} />}
          </>
        ),
      };
      break;
    }
    case 'graniteBeams': {
      base = blend(c.muted, c.surface, 0.3);
      const beam = blend(base, c.text, 0.18);
      tile = {
        tw: 120,
        th: 120,
        body: (
          <>
            <rect width={120} height={120} fill={base} />
            <path d="M0 0H120M0 60H120M60 0V60M0 60V120M90 60V120" stroke={blend(base, c.text, 0.12)} strokeWidth={1.4} />
            {low ? null : <path d={circles(specks(8, 120, 120, 13, 0.8, 1.8))} fill={blend(base, c.text, 0.15)} opacity={0.5} />}
          </>
        ),
      };
      const lines = [370, 830].filter((x) => x > g.x0 && x < g.x1);
      for (let d = g.dNear + 200, i = 0; d < g.dFar; d += 260, i++) {
        const y = r2(d - g.dNear);
        over.push(<rect key={`b${i}`} x={0} y={y} width={w} height={44} fill={beam} />);
        over.push(<rect key={`e${i}`} x={0} y={r2(y + 40)} width={w} height={4} fill={blend(beam, c.text, 0.08)} />);
        for (const x of lines) over.push(<circle key={`l${i}${x}`} cx={fx(x)} cy={r2(y + 22)} r={18} fill="none" stroke={blend(beam, c.secondary, 0.16)} strokeWidth={2} />);
      }
      for (const x of lines) over.push(<rect key={`lb${x}`} x={r2(fx(x) - 30)} y={0} width={60} height={h} fill={beam} />);
      break;
    }
    case 'timberVault': {
      base = blend(woodOf(c, n), c.text, 0.35);
      tile = {
        tw: 30,
        th: 120,
        body: (
          <>
            <rect width={30} height={120} fill={base} />
            <path d="M0 0V120" stroke={blend(base, c.text, 0.22)} strokeWidth={2} />
            {low ? null : <path d="M14 0V120" stroke={blend(base, c.secondary, 0.08)} strokeWidth={1} />}
          </>
        ),
      };
      for (let d = g.dNear + 150, i = 0; d < g.dFar; d += 300, i++) {
        const y = r2(d - g.dNear);
        over.push(<rect key={`r${i}`} x={0} y={y} width={w} height={36} fill={blend(base, c.text, 0.18)} />);
        over.push(<rect key={`h${i}`} x={0} y={y} width={w} height={3} fill={blend(base, c.secondary, 0.18)} />);
      }
      over.push(<rect key="ridge" x={r2(fx(600) - 20)} y={0} width={40} height={h} fill={blend(base, c.text, 0.2)} />);
      break;
    }
    case 'lightGrid': {
      base = blend(c.primary, c.text, 0.22);
      tile = {
        tw: 150,
        th: 150,
        body: (
          <>
            <rect width={150} height={150} fill={base} />
            <path d="M0 0H150M0 0V150" stroke={blend(base, c.muted, 0.14)} strokeWidth={2} />
          </>
        ),
      };
      const strip = blend(c.secondary, c.accent, 0.5);
      for (let d = g.dNear + 120, i = 0; d < g.dFar; d += 300, i++) over.push(<rect key={`s${i}`} x={0} y={r2(d - g.dNear)} width={w} height={5} fill={strip} opacity={0.3} />);
      for (const x of [420, 780]) if (x > g.x0 && x < g.x1) over.push(<rect key={`v${x}`} x={r2(fx(x) - 2.5)} y={0} width={5} height={h} fill={strip} opacity={0.3} />);
      break;
    }
    case 'tentStripes': {
      base = c.primary;
      const alt = blend(c.primary, c.background, 0.2);
      // The big top's canvas radiates from the king pole above the ring: wedges to points walked round the edge.
      const px = fx(600);
      const py = r2(depth * 0.6);
      const per = 2 * (w + h);
      const N = 28;
      const at = (s: number): [number, number] => {
        const t = ((s % per) + per) % per;
        if (t < w) return [t, 0];
        if (t < w + h) return [w, t - w];
        if (t < 2 * w + h) return [w - (t - w - h), h];
        return [0, h - (t - 2 * w - h)];
      };
      const corners = [0, w, w + h, 2 * w + h];
      const wedges = Array.from({ length: N / 2 }, (_, k) => {
        const s0 = (2 * k * per) / N;
        const s1 = ((2 * k + 1) * per) / N;
        const inner = corners.filter((q) => q > s0 && q < s1).map((q) => at(q));
        const pts = [at(s0), ...inner, at(s1)].map(([x, y]) => `${r2(x)} ${r2(y)}`);
        return `M${px} ${py}L${pts.join('L')}Z`;
      }).join('');
      over.push(<path key="wedges" d={wedges} fill={alt} />);
      over.push(<circle key="cap" cx={px} cy={py} r={70} fill={blend(c.primary, c.text, 0.3)} />);
      over.push(<circle key="capr" cx={px} cy={py} r={70} fill="none" stroke={c.secondary} strokeWidth={4} opacity={0.3} />);
      break;
    }
    case 'boards': {
      base = blend(blend(c.background, c.accent, 0.25), c.muted, 0.1);
      tile = {
        tw: 120,
        th: 24,
        body: (
          <>
            <rect width={120} height={24} fill={base} />
            <path d="M0 0H120" stroke={blend(base, c.text, 0.12)} strokeWidth={1.6} />
          </>
        ),
      };
      const beam = blend(woodOf(c, n), c.background, 0.62);
      over.push(<path key="plates" d={`${rect(0, 0, 26, h)}${rect(w - 26, 0, 26, h)}`} fill={beam} />);
      for (let d = g.dNear + 120, i = 0; d < g.dFar; d += 280, i++) over.push(<rect key={`j${i}`} x={0} y={r2(d - g.dNear)} width={w} height={14} fill={blend(base, beam, 0.6)} />);
      break;
    }
  }
  return (
    <Svg w={w} h={h}>
      <defs>
        {tile ? (
          <pattern id={id('t')} x={r2(-g.x0)} width={tile.tw} height={tile.th} patternUnits="userSpaceOnUse">
            {tile.body}
          </pattern>
        ) : null}
        <Lin id={id('d')} s={[[0, '#000000', 0.2], [0.5, '#000000', 0], [1, light.from === 'far' ? light.color : '#000000', light.from === 'far' ? 0.12 : 0.08]]} />
        {light.from === 'left' || light.from === 'right' ? <Lin id={id('s')} x2={1} y2={0} s={light.from === 'left' ? [[0, light.color, 0.1], [1, '#000000', 0.12]] : [[0, '#000000', 0.12], [1, light.color, 0.1]]} /> : null}
      </defs>
      <rect width={w} height={h} fill={tile ? url(id('t')) : base} />
      {over}
      <rect width={w} height={h} fill={url(id('d'))} />
      {light.from === 'left' || light.from === 'right' ? <rect width={w} height={h} fill={url(id('s'))} /> : null}
    </Svg>
  );
}

// ─────────────────────────── walls ───────────────────────────

interface WallArt {
  base: string;
  pitch: number;
  defs?: ReactNode;
  /** One bay, drawn from x 0 to pitch (piers straddle the edges: draw both halves). */
  bay: ReactNode;
  /** Full-length bands drawn over the bays (plinth, cornice, per-bay variety). */
  after?: ReactNode;
}

interface WallCtx {
  c: C;
  n: DrawProps['nature'];
  light: KeyLight;
  w: number;
  h: number;
  /** World y → content y. */
  Y: (wy: number) => number;
  low: boolean;
  id: (k: string) => string;
  salt: number;
}

/** A small diya in a niche: brass bowl, flame and a warm pool of light. */
function NicheLamp({ x, y, ctx, glow }: { x: number; y: number; ctx: WallCtx; glow: string }) {
  const { c, n } = ctx;
  return (
    <g>
      <ellipse cx={x} cy={r2(y - 20)} rx={64} ry={52} fill={url(glow)} />
      <path d={`M${x - 14} ${y - 8}Q${x} ${y + 6} ${x + 14} ${y - 8}Z`} fill={c.secondary} />
      <path d={`M${x} ${y - 30}C${x + 6} ${y - 20} ${x + 5} ${y - 12} ${x} ${y - 9}C${x - 5} ${y - 12} ${x - 6} ${y - 20} ${x} ${y - 30}Z`} fill={n.flame} />
      <path d={`M${x} ${y - 22}C${x + 2.5} ${y - 17} ${x + 2} ${y - 13} ${x} ${y - 11}C${x - 2} ${y - 13} ${x - 2.5} ${y - 17} ${x} ${y - 22}Z`} fill={n.flameCore} />
    </g>
  );
}

function wallArt(variant: WallVariant, ctx: WallCtx): WallArt {
  const { c, n, light, w, h, Y, low, id } = ctx;
  const gold = c.secondary;
  switch (variant) {
    case 'cusped': {
      const base = blend(c.primary, c.text, 0.22);
      const panel = blend(c.primary, c.secondary, 0.1);
      const P = 350;
      const cx = P / 2;
      const niche = arch(cx, 78, Y(410), Y(300), Y(742), 'pointed', 5);
      const frame = arch(cx, 102, Y(410), Y(268), Y(742), 'pointed', 5);
      const pier = (x: number) => (
        <g key={x}>
          <rect x={x - 18} y={Y(330)} width={36} height={r2(Y(742) - Y(330))} fill={panel} />
          <path d={`M${x - 18} ${Y(330)}V${Y(742)}M${x + 18} ${Y(330)}V${Y(742)}`} stroke={gold} strokeWidth={1.6} opacity={0.75} />
          {low ? null : <path d={[430, 500, 570, 640, 710].map((y) => diamond(x, Y(y), 7, 11)).join('')} fill={gold} opacity={0.8} />}
          <rect x={x - 24} y={Y(318)} width={48} height={14} fill={gold} />
          <rect x={x - 24} y={Y(728)} width={48} height={14} fill={gold} />
        </g>
      );
      return {
        base,
        pitch: P,
        defs: (
          <>
            <pattern id={id('mo')} width={18} height={18} patternUnits="userSpaceOnUse">
              <rect width={18} height={18} fill={blend(c.primary, c.text, 0.45)} />
              <path d={diamond(9, 9, 5.5)} fill={tint(gold, 0.3)} />
              <path d={`${diamond(0, 0, 4)}${diamond(18, 0, 4)}${diamond(0, 18, 4)}${diamond(18, 18, 4)}`} fill={blend(gold, c.accent, 0.5)} />
              {low ? null : <circle cx={9} cy={9} r={1.5} fill={tint(c.accent, 0.7)} />}
            </pattern>
            <Lin id={id('ni')} s={[[0, blend(base, c.text, 0.5)], [0.55, blend(c.primary, c.secondary, 0.22)], [1, blend(c.secondary, c.accent, 0.5)]]} />
            <Rad id={id('ng')} s={[[0, light.color, 0.6], [1, light.color, 0]]} />
          </>
        ),
        bay: (
          <>
            <rect x={70} y={Y(130)} width={210} height={r2(Y(240) - Y(130))} fill={panel} />
            <rect x={78} y={Y(138)} width={194} height={r2(Y(232) - Y(138))} fill="none" stroke={gold} strokeWidth={1.5} opacity={0.6} />
            <path d={`${frame}${niche}`} fillRule="evenodd" fill={url(id('mo'))} />
            <path d={frame} fill="none" stroke={gold} strokeWidth={2.5} />
            <path d={niche} fill={url(id('ni'))} />
            <path d={niche} fill="none" stroke={light.rim} strokeWidth={1.8} opacity={0.6} />
            <NicheLamp x={cx} y={Y(738)} ctx={ctx} glow={id('ng')} />
            {pier(0)}
            {pier(P)}
          </>
        ),
        after: (
          <>
            <rect x={0} y={Y(742)} width={w} height={r2(h - Y(742))} fill={blend(c.primary, c.text, 0.5)} />
            <rect x={0} y={Y(742)} width={w} height={4} fill={gold} />
            <path d={`M0 ${Y(772)}H${w}`} stroke={gold} strokeWidth={6} strokeDasharray="12 16" opacity={0.7} />
            <rect x={0} y={0} width={w} height={34} fill={panel} />
            <path d={`M0 34H${w}`} stroke={gold} strokeWidth={3} />
          </>
        ),
      };
    }
    case 'lancet': {
      const stone = blend(c.surface, c.muted, 0.3);
      const dark = blend(c.surface, c.muted, 0.5);
      const wood = woodOf(c, n);
      const P = 350;
      const cx = P / 2;
      const win = arch(cx, 56, Y(250), Y(118), Y(560), 'lancet');
      const surround = arch(cx, 74, Y(250), Y(90), Y(574), 'lancet');
      const jewels = [blend(c.primary, c.accent, 0.2), blend(c.secondary, c.accent, 0.25), blend(c.primary, c.secondary, 0.5)];
      return {
        base: stone,
        pitch: P,
        defs: (
          <>
            <pattern id={id('as')} width={140} height={70} patternUnits="userSpaceOnUse">
              <path d="M0 0H140M0 35H140M0 0V35M70 35V70" stroke={blend(stone, c.text, 0.16)} strokeWidth={1.2} opacity={0.6} />
            </pattern>
            <pattern id={id('ld')} width={20} height={28} patternUnits="userSpaceOnUse">
              <path d="M0 0L10 14L0 28M20 0L10 14L20 28" fill="none" stroke={blend(c.text, c.primary, 0.3)} strokeWidth={1.3} opacity={0.75} />
            </pattern>
            <Lin id={id('gl')} s={[[0, blend(c.accent, c.background, 0.35)], [0.45, blend(c.primary, c.accent, 0.45)], [1, blend(c.secondary, c.accent, 0.35)]]} />
          </>
        ),
        bay: (
          <>
            {low ? null : <rect width={P} height={h} fill={url(id('as'))} />}
            <rect x={-20} y={0} width={40} height={h} fill={tint(stone, 0.08)} />
            <rect x={P - 20} y={0} width={40} height={h} fill={tint(stone, 0.08)} />
            <path d={`M20 0V${h}M${P - 20} 0V${h}`} stroke={dark} strokeWidth={3} opacity={0.6} />
            <path d={surround} fill={dark} />
            <path d={win} fill={url(id('gl'))} />
            <path d={win} fill={url(id('ld'))} />
            {[470, 380, 290].map((y, i) => (
              <g key={y}>
                <circle cx={cx} cy={Y(y)} r={24} fill={jewels[i]} opacity={0.85} />
                <circle cx={cx} cy={Y(y)} r={11} fill={tint(c.secondary, 0.35)} opacity={0.85} />
                <circle cx={cx} cy={Y(y)} r={24} fill="none" stroke={blend(c.text, c.primary, 0.3)} strokeWidth={2} />
              </g>
            ))}
            <path d={`M${cx} ${Y(130)}V${Y(560)}`} stroke={blend(c.text, c.primary, 0.3)} strokeWidth={3} />
            <path d={win} fill="none" stroke={light.rim} strokeWidth={1.6} opacity={0.55} />
            <rect x={cx - 80} y={Y(560)} width={160} height={14} fill={tint(stone, 0.12)} />
            <rect x={14} y={Y(612)} width={148} height={r2(Y(774) - Y(612))} fill={shade(wood, 0.08)} stroke={tint(wood, 0.18)} strokeWidth={2} />
            <rect x={188} y={Y(612)} width={148} height={r2(Y(774) - Y(612))} fill={shade(wood, 0.08)} stroke={tint(wood, 0.18)} strokeWidth={2} />
          </>
        ),
        after: (
          <>
            <path d={`M0 ${Y(598)}H${w}`} stroke={wood} strokeWidth={10} />
            <path d={`M0 ${Y(784)}H${w}`} stroke={wood} strokeWidth={14} />
            <rect x={0} y={Y(791)} width={w} height={r2(h - Y(791))} fill={dark} />
            <rect x={0} y={0} width={w} height={40} fill={dark} />
            <path d={`M0 46H${w}`} stroke={dark} strokeWidth={12} strokeDasharray="22 28" />
            <path d={`M0 ${Y(593)}H${w}`} stroke={light.rim} strokeWidth={1.4} opacity={0.4} />
          </>
        ),
      };
    }
    case 'scalloped': {
      const white = blend(c.background, c.surface, 0.5);
      const P = 340;
      // Two bays per tile, so the bougainvillea that spills over the parapet differs from bay to bay.
      const bays = [P / 2, P * 1.5];
      const openings = bays.map((cx) => arch(cx, 112, Y(560), Y(448), Y(800), 'round', 4)).join('');
      const doors = bays.map((cx) => arch(cx, 38, Y(660), Y(622), Y(800), 'round')).join('');
      // A cascade: a leafy mound on the parapet, bracts heaped over it and trailing down the pier.
      const leaves: Array<[number, number, number]> = [];
      const all: Array<[number, number, number]> = [];
      const cluster = (bx: number, k0: number, trail: number) => {
        for (let k = 0; k < 6; k++) {
          const t = k / 5;
          leaves.push([bx + (t - 0.5) * 120 + (rand(k + k0, ctx.salt + 5) - 0.5) * 16, Y(372 - 26 * (1 - (2 * t - 1) * (2 * t - 1)) + rand(k + k0, ctx.salt + 6) * 10), 14 + rand(k + k0, ctx.salt + 7) * 8]);
        }
        for (let k = 0; k < Math.round(trail / 26); k++) leaves.push([bx - 10 + (rand(k + k0, ctx.salt + 8) - 0.5) * 34 * (1 - k * 0.08), Y(398 + k * 26 + rand(k + k0, ctx.salt + 10) * 10), 7 + rand(k + k0, ctx.salt + 9) * 7]);
        for (let k = 0; k < (low ? 9 : 18); k++) {
          const t = rand(k + k0, ctx.salt);
          const down = k % 4 === 0 ? rand(k + k0, ctx.salt + 1) * trail : 0;
          const lift = 30 * (1 - (2 * t - 1) * (2 * t - 1));
          all.push([down ? bx - 10 + (t - 0.5) * 36 : bx + (t - 0.5) * 130, Y(down ? 395 + down : 384 - lift * rand(k + k0, ctx.salt + 2)), 4 + rand(k + k0, ctx.salt + 3) * 6]);
        }
      };
      cluster(P, 0, 170);
      cluster(P * 1.62, 50, 60);
      const third = (k: number) => all.filter((_, i) => i % 3 === k);
      const piers = [0, P, 2 * P];
      return {
        base: white,
        pitch: 2 * P,
        defs: <Lin id={id('lg')} s={[[0, blend(c.primary, c.text, 0.5)], [0.6, blend(c.primary, c.text, 0.32)], [1, blend(c.primary, c.secondary, 0.35)]]} />,
        bay: (
          <>
            <path d={openings} fill={url(id('lg'))} />
            <path d={doors} fill={blend(c.secondary, c.accent, 0.45)} />
            <path d={openings} fill="none" stroke={c.primary} strokeWidth={3} opacity={0.5} />
            <path d={openings} fill="none" stroke={light.rim} strokeWidth={1.6} opacity={0.7} />
            <path d={piers.map((x) => rect(x - 30, Y(548), 60, 14)).join('')} fill={blend(white, c.muted, 0.18)} />
            <path d={piers.map((x) => rect(x - 34, Y(770), 68, 30)).join('')} fill={blend(white, c.muted, 0.22)} />
            <rect x={0} y={Y(392)} width={2 * P} height={10} fill={blend(white, c.muted, 0.25)} />
            <rect x={0} y={Y(402)} width={2 * P} height={8} fill="#000000" opacity={0.1} />
            <path d={`M0 ${Y(424)}H${2 * P}`} stroke={c.primary} strokeWidth={3} opacity={0.45} />
            <path d={circles(leaves)} fill={n.leafDark} />
            <path d={circles(leaves.filter((_, i) => i % 2 === 0).map(([x, y, r]) => [x - r * 0.3, y - r * 0.3, r * 0.6] as const))} fill={n.leaf} />
            <path d={circles(third(0))} fill={shade(BOUGAINVILLEA, 0.18)} />
            <path d={circles(third(1))} fill={BOUGAINVILLEA} />
            <path d={circles(third(2))} fill={tint(BOUGAINVILLEA, 0.22)} />
          </>
        ),
      };
    }
    case 'ballroom': {
      const base = blend(c.primary, c.text, 0.18);
      const P = 380;
      const cx = P / 2;
      const win = arch(cx, 82, Y(170), Y(88), Y(640), 'round');
      const drape = blend(c.primary, c.accent, 0.26);
      const fold = shade(drape, 0.25);
      const x0 = cx - 82 - 30;
      const drapeD = `M${x0 - 6} ${Y(96)}H${x0 + 64}C${x0 + 52} ${Y(260)} ${x0 + 34} ${Y(420)} ${x0 + 30} ${Y(470)}C${x0 + 44} ${Y(560)} ${x0 + 64} ${Y(690)} ${x0 + 56} ${Y(792)}H${x0 - 6}Z`;
      const sconce = (x: number) => (
        <g key={`s${x}`}>
          <ellipse cx={x} cy={Y(352)} rx={46} ry={40} fill={url(id('sg'))} />
          <path d={`M${x - 9} ${Y(392)}h18l-4 22h-10Z`} fill={gold} />
          <path d={`M${x - 16} ${Y(380)}Q${x} ${Y(396)} ${x + 16} ${Y(380)}`} fill="none" stroke={gold} strokeWidth={3} />
          <rect x={x - 19} y={Y(358)} width={6} height={22} fill={n.ivory} />
          <rect x={x + 13} y={Y(358)} width={6} height={22} fill={n.ivory} />
          <path d={`M${x - 16} ${Y(348)}q3 6 0 10q-3 -4 0 -10ZM${x + 16} ${Y(348)}q3 6 0 10q-3 -4 0 -10Z`} fill={n.flame} />
        </g>
      );
      const pilaster = (x: number) => (
        <g key={`p${x}`}>
          <rect x={x - 22} y={Y(150)} width={44} height={r2(Y(744) - Y(150))} fill={blend(base, c.secondary, 0.16)} />
          <path d={`M${x - 10} ${Y(176)}V${Y(720)}M${x} ${Y(176)}V${Y(720)}M${x + 10} ${Y(176)}V${Y(720)}`} stroke={gold} strokeWidth={1.4} opacity={0.55} />
          <rect x={x - 28} y={Y(140)} width={56} height={22} fill={url(id('gm'))} />
          <path d={circles([[x - 22, Y(150), 6], [x + 22, Y(150), 6]])} fill={gold} />
        </g>
      );
      return {
        base,
        pitch: P,
        defs: (
          <>
            <pattern id={id('dm')} width={60} height={90} patternUnits="userSpaceOnUse">
              <path d="M0 0C20 20 20 25 30 45C40 65 40 70 60 90M60 0C40 20 40 25 30 45C20 65 20 70 0 90" fill="none" stroke={blend(base, c.secondary, 0.14)} strokeWidth={1.5} />
            </pattern>
            <Lin id={id('gl')} s={[[0, blend(c.primary, c.text, 0.55)], [0.65, blend(c.primary, c.text, 0.32)], [1, blend(c.secondary, c.primary, 0.45)]]} />
            <MetalBox id={id('gm')} base={gold} />
            <Rad id={id('sg')} s={[[0, light.color, 0.55], [1, light.color, 0]]} />
          </>
        ),
        bay: (
          <>
            {low ? null : <rect width={P} height={h} fill={url(id('dm'))} />}
            <path d={win} fill={url(id('gl'))} />
            <path d={`M${cx - 27} ${Y(100)}V${Y(640)}M${cx + 27} ${Y(100)}V${Y(640)}M${cx - 82} ${Y(260)}H${cx + 82}M${cx - 82} ${Y(380)}H${cx + 82}M${cx - 82} ${Y(500)}H${cx + 82}`} stroke={gold} strokeWidth={2} opacity={0.7} />
            <path d={win} fill="none" stroke={gold} strokeWidth={7} />
            <path d={win} fill="none" stroke={tint(gold, 0.45)} strokeWidth={1.5} />
            <path d={drapeD} fill={drape} />
            <path d={`M${x0 + 14} ${Y(110)}C${x0 + 12} ${Y(300)} ${x0 + 18} ${Y(440)} ${x0 + 24} ${Y(470)}M${x0 + 30} ${Y(480)}C${x0 + 34} ${Y(600)} ${x0 + 30} ${Y(700)} ${x0 + 26} ${Y(790)}`} fill="none" stroke={fold} strokeWidth={4} />
            <g transform={`matrix(-1 0 0 1 ${2 * cx} 0)`}>
              <path d={drapeD} fill={drape} />
              <path d={`M${x0 + 14} ${Y(110)}C${x0 + 12} ${Y(300)} ${x0 + 18} ${Y(440)} ${x0 + 24} ${Y(470)}`} fill="none" stroke={fold} strokeWidth={4} />
            </g>
            <path d={circles([[x0 + 30, Y(470), 7], [2 * cx - x0 - 30, Y(470), 7]])} fill={gold} />
            <path d={`M${cx - 120} ${Y(92)}Q${cx} ${Y(180)} ${cx + 120} ${Y(92)}Z`} fill={drape} />
            <rect x={cx - 150} y={Y(664)} width={300} height={r2(Y(780) - Y(664))} fill="none" stroke={gold} strokeWidth={4} opacity={0.8} />
            {pilaster(0)}
            {pilaster(P)}
            {sconce(0)}
            {sconce(P)}
          </>
        ),
        after: (
          <>
            <rect x={0} y={Y(744)} width={w} height={6} fill={url(id('gm'))} />
            <rect x={0} y={Y(790)} width={w} height={r2(h - Y(790))} fill={blend(base, c.text, 0.4)} />
            <rect x={0} y={0} width={w} height={46} fill={blend(base, c.secondary, 0.3)} />
            <path d={`M0 52H${w}`} stroke={gold} strokeWidth={10} strokeDasharray="8 10" opacity={0.6} />
          </>
        ),
      };
    }
    case 'veranda': {
      const lime = blend(c.background, c.surface, 0.4);
      const dado = blend(c.primary, c.surface, 0.35);
      const oxide = blend(n.clayDark, n.clay, 0.35);
      const wood = woodOf(c, n);
      const tile = blend(n.clay, c.primary, 0.15);
      const P = 700;
      const studs: Array<[number, number, number]> = [];
      if (!low) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) for (const lx of [134, 200]) studs.push([lx + k * 22, Y(390 + r * 66), 3.2]);
      return {
        base: lime,
        pitch: P,
        defs: (
          <pattern id={id('tl')} y={Y(120)} width={28} height={24} patternUnits="userSpaceOnUse">
            <rect width={28} height={24} fill={shade(tile, 0.2)} />
            <path d="M0 24Q14 2 28 24Z" fill={tile} />
            <path d="M4 22Q14 6 24 22" fill="none" stroke={tint(tile, 0.25)} strokeWidth={1.5} />
          </pattern>
        ),
        bay: (
          <>
            <rect x={0} y={Y(560)} width={P} height={r2(Y(720) - Y(560))} fill={dado} />
            <rect x={108} y={Y(318)} width={164} height={22} fill={wood} />
            <rect x={112} y={Y(338)} width={156} height={r2(Y(720) - Y(338))} fill={shade(wood, 0.1)} />
            <rect x={124} y={Y(352)} width={65} height={r2(Y(720) - Y(352))} fill={wood} stroke={shade(wood, 0.35)} strokeWidth={2} />
            <rect x={191} y={Y(352)} width={65} height={r2(Y(720) - Y(352))} fill={wood} stroke={shade(wood, 0.35)} strokeWidth={2} />
            <path d={[0, 1, 2].map((r) => `${rect(132, Y(368 + r * 118), 49, 100)}${rect(199, Y(368 + r * 118), 49, 100)}`).join('')} fill="none" stroke={tint(wood, 0.15)} strokeWidth={2} />
            {studs.length ? <path d={circles(studs)} fill={gold} /> : null}
            <circle cx={190} cy={Y(329)} r={8} fill={gold} />
            <path d={`M${124} ${Y(352)}V${Y(720)}`} stroke={light.rim} strokeWidth={1.5} opacity={0.5} />
            <rect x={420} y={Y(392)} width={200} height={r2(Y(570) - Y(392))} fill={wood} />
            <rect x={450} y={Y(404)} width={140} height={r2(Y(556) - Y(404))} fill={blend(c.text, c.primary, 0.3)} />
            <path d={[0, 1, 2, 3, 4, 5, 6].map((k) => `M${462 + k * 19} ${Y(404)}V${Y(556)}`).join('')} stroke={shade(wood, 0.1)} strokeWidth={6} />
            <path d={`${rect(426, Y(404), 22, Y(556) - Y(404))}${rect(592, Y(404), 22, Y(556) - Y(404))}`} fill={tint(wood, 0.08)} stroke={shade(wood, 0.3)} strokeWidth={1.5} />
          </>
        ),
        after: (
          <>
            <rect x={0} y={Y(720)} width={w} height={r2(h - Y(720))} fill={oxide} />
            <rect x={0} y={Y(720)} width={w} height={8} fill={tint(oxide, 0.2)} />
            <path d={`M0 ${Y(721)}H${w}`} stroke={light.rim} strokeWidth={1.6} opacity={0.6} />
            <rect x={0} y={Y(728)} width={w} height={10} fill="#000000" opacity={0.18} />
            <rect x={0} y={Y(120)} width={w} height={r2(Y(196) - Y(120))} fill={url(id('tl'))} />
            <rect x={0} y={Y(196)} width={w} height={24} fill="#000000" opacity={0.22} />
            <path d={`M0 ${Y(200)}H${w}`} stroke={wood} strokeWidth={10} strokeDasharray="10 30" />
          </>
        ),
      };
    }
    case 'tentStripes': {
      const red = c.primary;
      const ivory = blend(c.background, c.accent, 0.2);
      const valance = blend(c.primary, c.text, 0.15);
      const count = Math.ceil(w / 70);
      const scallops = Array.from({ length: count }, (_, i) => `Q${i * 70 + 35} ${Y(352)} ${i * 70 + 70} ${Y(312)}`).join('');
      const back = Array.from({ length: count }, (_, i) => count - 1 - i)
        .map((k) => `Q${k * 70 + 35} ${Y(352)} ${k * 70} ${Y(312)}`)
        .join('');
      const starsD = Array.from({ length: Math.ceil(w / 140) }, (_, i) => star5(i * 140 + 70, Y(752), 1.3)).join('');
      return {
        base: ivory,
        pitch: 140,
        defs: (
          <>
            <Lin id={id('r')} x2={1} y2={0} s={[[0, shade(red, 0.2)], [0.5, red], [1, shade(red, 0.1)]]} />
            <Lin id={id('i')} x2={1} y2={0} s={[[0, shade(ivory, 0.1)], [0.5, ivory], [1, shade(ivory, 0.05)]]} />
          </>
        ),
        bay: (
          <>
            <rect width={70} height={h} fill={url(id('r'))} />
            <rect x={70} width={70} height={h} fill={url(id('i'))} />
          </>
        ),
        after: (
          <>
            <path d={`M0 ${Y(262)}H${count * 70}V${Y(312)}${back}Z`} fill={valance} />
            <path d={`M0 ${Y(312)}${scallops}`} fill="none" stroke={gold} strokeWidth={4} />
            <path d={`M0 ${Y(270)}H${w}`} stroke={gold} strokeWidth={3} />
            {low ? null : <path d={circles(Array.from({ length: Math.ceil(w / 70) }, (_, i) => [i * 70, Y(322), 4.5] as const))} fill={gold} />}
            <rect x={0} y={Y(700)} width={w} height={r2(h - Y(700))} fill={blend(c.primary, c.text, 0.35)} />
            <path d={`M0 ${Y(702)}H${w}`} stroke={gold} strokeWidth={5} strokeDasharray="14 6" />
            <path d={starsD} fill={gold} />
          </>
        ),
      };
    }
    case 'acoustic': {
      const base = blend(c.primary, c.text, 0.25);
      const P = 350;
      const t = Y(-40);
      const b = Y(650);
      const wood = woodOf(c, n);
      return {
        base,
        pitch: P,
        defs: (
          <>
            <Lin id={id('rv')} s={[[0, c.secondary, 0.05], [0.6, c.secondary, 0.3], [1, c.secondary, 0.6]]} />
            <pattern id={id('sl')} width={24} height={20} patternUnits="userSpaceOnUse">
              <rect width={24} height={20} fill={shade(wood, 0.45)} />
              <rect width={15} height={20} fill={wood} />
              <rect width={3} height={20} fill={tint(wood, 0.15)} />
            </pattern>
            <Rad id={id('st')} s={[[0, c.accent, 0.5], [1, c.accent, 0]]} />
          </>
        ),
        bay: (
          <>
            <path d={`M14 ${t}H220L120 ${b}H14Z`} fill={blend(c.primary, c.muted, 0.28)} />
            <path d={`M220 ${t}H336V${b}H120Z`} fill={blend(c.primary, c.muted, 0.13)} />
            <path d={`M220 ${t}L120 ${b}`} stroke={light.rim} strokeWidth={1.2} opacity={0.3} />
            <rect x={-5} y={t} width={10} height={r2(b - t)} fill={url(id('rv'))} />
            <rect x={P - 5} y={t} width={10} height={r2(b - t)} fill={url(id('rv'))} />
            <rect x={-26} y={t} width={52} height={r2(b - t)} fill={url(id('rv'))} opacity={0.18} />
            <rect x={P - 26} y={t} width={52} height={r2(b - t)} fill={url(id('rv'))} opacity={0.18} />
            <ellipse cx={P / 4} cy={Y(784)} rx={34} ry={18} fill={url(id('st'))} />
            <ellipse cx={(P * 3) / 4} cy={Y(784)} rx={34} ry={18} fill={url(id('st'))} />
            <path d={`${rect(P / 4 - 9, Y(782), 18, 5)}${rect((P * 3) / 4 - 9, Y(782), 18, 5)}`} fill={tint(c.accent, 0.4)} />
          </>
        ),
        after: (
          <>
            <rect x={0} y={b} width={w} height={r2(Y(778) - b)} fill={url(id('sl'))} />
            <path d={`M0 ${b}H${w}`} stroke={tint(wood, 0.25)} strokeWidth={3} />
            <rect x={0} y={Y(778)} width={w} height={r2(h - Y(778))} fill={blend(base, c.text, 0.5)} />
          </>
        ),
      };
    }
    case 'colonnade': {
      const stone = blend(c.secondary, c.surface, 0.55);
      const dark = blend(stone, c.text, 0.22);
      const P = 350;
      const cx = P / 2;
      const open = arch(cx, 118, Y(590), Y(472), Y(800), 'round');
      const ring = archCurve(cx, 131, Y(590), Y(459), 'round');
      const win = arch(cx, 44, Y(272), Y(248), Y(384), 'round');
      const column = (x: number) => (
        <g key={x}>
          <rect x={x - 22} y={Y(598)} width={44} height={r2(Y(780) - Y(598))} fill={tint(stone, 0.1)} />
          <rect x={x + 8} y={Y(598)} width={14} height={r2(Y(780) - Y(598))} fill="#000000" opacity={0.12} />
          <rect x={x - 32} y={Y(578)} width={64} height={20} fill={stone} />
          <rect x={x - 29} y={Y(780)} width={58} height={20} fill={stone} />
          <path d={`M${x - 22} ${Y(598)}V${Y(780)}`} stroke={light.rim} strokeWidth={1.5} opacity={0.6} />
        </g>
      );
      return {
        base: stone,
        pitch: P,
        defs: (
          <>
            <Lin id={id('cr')} s={[[0, blend(c.text, c.primary, 0.4)], [0.5, blend(c.secondary, c.text, 0.42)], [1, blend(c.accent, c.secondary, 0.3)]]} />
            <Lin id={id('wn')} s={[[0, blend(c.secondary, c.accent, 0.4)], [1, tint(c.accent, 0.3)]]} />
            <Rad id={id('lg')} s={[[0, light.color, 0.55], [1, light.color, 0]]} />
          </>
        ),
        bay: (
          <>
            <path d={open} fill={url(id('cr'))} />
            <path d={arch(cx, 30, Y(660), Y(630), Y(800), 'round')} fill={tint(c.accent, 0.2)} />
            <ellipse cx={cx} cy={Y(560)} rx={48} ry={44} fill={url(id('lg'))} />
            <circle cx={cx} cy={Y(560)} r={6} fill={tint(light.color, 0.3)} />
            <path d={`M${cx} ${Y(472)}V${Y(554)}`} stroke={dark} strokeWidth={1.5} />
            <path d={ring} fill="none" stroke={dark} strokeWidth={24} />
            <path d={ring} fill="none" stroke={stone} strokeWidth={24} strokeDasharray="3 23" opacity={0.7} />
            <path d={`M${cx - 12} ${Y(456)}h24l-4 30h-16Z`} fill={tint(stone, 0.12)} />
            {column(0)}
            {column(P)}
            <path d={win} fill={url(id('wn'))} />
            <path d={`M${cx} ${Y(250)}V${Y(384)}M${cx - 44} ${Y(320)}H${cx + 44}`} stroke={dark} strokeWidth={3} />
            <rect x={cx - 54} y={Y(384)} width={108} height={10} fill={dark} />
            <path d={`${rect(-12, Y(200), 24, Y(420) - Y(200))}${rect(P - 12, Y(200), 24, Y(420) - Y(200))}`} fill={tint(stone, 0.08)} />
          </>
        ),
        after: (
          <>
            <rect x={0} y={Y(420)} width={w} height={18} fill={dark} />
            <path d={`M0 ${Y(420)}H${w}`} stroke={light.rim} strokeWidth={1.5} opacity={0.6} />
            <rect x={0} y={Y(150)} width={w} height={r2(Y(196) - Y(150))} fill={dark} />
            {low ? null : <path d={`M0 ${Y(174)}H${w}`} stroke={stone} strokeWidth={30} strokeDasharray="6 10" opacity={0.6} />}
            <rect x={0} y={Y(196)} width={w} height={8} fill={dark} />
          </>
        ),
      };
    }
    case 'shopfronts': {
      const P = 350;
      const facades = [blend(c.background, c.accent, 0.4), blend(c.background, c.primary, 0.22), blend(c.background, c.secondary, 0.4)];
      const awnings = [c.accent, c.primary, c.secondary];
      const wood = woodOf(c, n);
      const shop = (i: number) => {
        const x = i * P;
        const f = facades[i] ?? c.background;
        const awn = awnings[i] ?? c.accent;
        // Jars, tins and boxes on the shelves, in two tones.
        const goods: string[] = ['', ''];
        if (!low)
          for (const [r, y] of [560, 620, 680].entries())
            for (let k = 0; k < 6; k++) {
              const gw = 16 + rand(k + r * 6, ctx.salt + i) * 18;
              const gh = 16 + rand(k + r * 6, ctx.salt + i + 3) * 24;
              goods[k % 2] += rect(x + 48 + k * 44, Y(y) - 2 - gh, gw, gh);
            }
        const sc = Array.from({ length: 10 }, (_, k) => `Q${x + 20 + k * 31 + 15.5} ${Y(498)} ${x + 20 + (k + 1) * 31} ${Y(484)}`).join('');
        return (
          <g key={i}>
            <rect x={x} y={0} width={P} height={h} fill={f} />
            <path d={`${rect(x, 0, 14, h)}${rect(x + P - 14, 0, 14, h)}`} fill={shade(f, 0.15)} />
            <rect x={x + 34} y={Y(470)} width={282} height={r2(Y(790) - Y(470))} fill={url(id('in'))} />
            <path d={`M${x + 34} ${Y(560)}h282M${x + 34} ${Y(620)}h282M${x + 34} ${Y(680)}h282`} stroke={wood} strokeWidth={4} />
            {goods[0] ? <path d={goods[0]} fill={[c.secondary, c.primary, c.accent][i % 3]} /> : null}
            {goods[1] ? <path d={goods[1]} fill={blend([c.primary, c.accent, c.secondary][i % 3] ?? c.primary, c.background, 0.3)} /> : null}
            <rect x={x + 34} y={Y(720)} width={282} height={r2(Y(790) - Y(720))} fill={wood} />
            <rect x={x + 44} y={Y(730)} width={262} height={r2(Y(780) - Y(730))} fill="none" stroke={tint(wood, 0.2)} strokeWidth={2} />
            <path d={`M${x + 30} ${Y(456)}h290`} stroke={blend(c.muted, c.surface, 0.3)} strokeWidth={18} />
            <path d={`M${x + 20} ${Y(436)}H${x + 330}V${Y(484)}${Array.from({ length: 10 }, (_, k) => `Q${x + 330 - k * 31 - 15.5} ${Y(498)} ${x + 330 - (k + 1) * 31} ${Y(484)}`).join('')}Z`} fill={awn} />
            <path d={Array.from({ length: 5 }, (_, k) => rect(x + 35.5 + k * 62, Y(436), 15.5, Y(484) - Y(436))).join('')} fill={ctx.c.background} opacity={0.55} />
            <path d={`M${x + 20} ${Y(484)}${sc}`} fill="none" stroke={shade(awn, 0.3)} strokeWidth={2} />
            <rect x={x + 60} y={Y(286)} width={230} height={40} fill={blend(f, c.text, 0.25)} stroke={gold} strokeWidth={2} />
            <rect x={x + 140} y={Y(214)} width={70} height={r2(Y(272) - Y(214))} fill={blend(c.text, c.primary, 0.3)} />
            <path d={`M${x + 120} ${Y(214)}h110l-12 -12h-86Z`} fill={shade(f, 0.25)} />
            <rect x={x + 30} y={Y(790)} width={290} height={r2(h - Y(790))} fill={blend(c.muted, c.surface, 0.3)} />
          </g>
        );
      };
      const bulbs = low ? [] : Array.from({ length: Math.ceil(w / 36) }, (_, k) => [k * 36 + 18, Y(434) + (k % 2) * 3, 3.4] as const);
      return {
        base: facades[0] ?? c.background,
        pitch: P * 3,
        defs: <Lin id={id('in')} s={[[0, blend(c.text, c.primary, 0.35)], [0.35, blend(c.secondary, c.accent, 0.25)], [1, tint(c.accent, 0.3)]]} />,
        bay: (
          <>
            {shop(0)}
            {shop(1)}
            {shop(2)}
          </>
        ),
        after: (
          <>
            <rect x={0} y={0} width={w} height={12} fill={shade(facades[1] ?? c.background, 0.25)} />
            {bulbs.length ? <path d={circles(bulbs)} fill={tint(light.color, 0.3)} /> : null}
          </>
        ),
      };
    }
    case 'jaaliRail': {
      const marble = blend(c.background, c.surface, 0.25);
      const P = 300;
      const top = Math.min(30, h * 0.25);
      return {
        base: marble,
        pitch: P,
        defs: (
          <pattern id={id('jl')} y={top} width={24} height={24} patternUnits="userSpaceOnUse">
            <rect width={24} height={24} fill={marble} />
            <path d={`${star8(12, 12, 1)}${diamond(0, 0, 4)}${diamond(24, 0, 4)}${diamond(0, 24, 4)}${diamond(24, 24, 4)}`} fill={blend(c.primary, c.text, 0.4)} opacity={0.88} />
          </pattern>
        ),
        bay: (
          <>
            <rect x={14} y={top + 8} width={P - 28} height={r2(h - top - 22)} fill={url(id('jl'))} />
            <rect x={18} y={top + 12} width={P - 36} height={r2(h - top - 30)} fill="none" stroke={c.secondary} strokeWidth={1.5} opacity={0.55} />
            {[0, P].map((x) => (
              <g key={x}>
                <rect x={x - 14} y={top - 6} width={28} height={r2(h - top + 6)} fill={tint(marble, 0.1)} />
                <path d={`M${x - 9} ${top - 6}C${x - 12} ${top - 16} ${x - 4} ${top - 20} ${x} ${top - 28}C${x + 4} ${top - 20} ${x + 12} ${top - 16} ${x + 9} ${top - 6}Z`} fill={marble} />
                <path d={`M${x + 14} ${top - 6}V${h}`} stroke="#000000" strokeWidth={4} opacity={0.12} />
              </g>
            ))}
          </>
        ),
        after: (
          <>
            <rect x={0} y={top - 2} width={w} height={10} fill={tint(marble, 0.15)} />
            <path d={`M0 ${top - 2}H${w}`} stroke={light.rim} strokeWidth={1.5} opacity={0.7} />
            <rect x={0} y={h - 12} width={w} height={12} fill={blend(marble, c.muted, 0.3)} />
          </>
        ),
      };
    }
    case 'glassRail': {
      const P = 240;
      const glass = tint(c.background, 0.2);
      return {
        base: 'none',
        pitch: P,
        defs: (
          <>
            <Lin id={id('gs')} s={[[0, glass, 0.42], [1, blend(c.surface, c.muted, 0.2), 0.3]]} />
            <Metal id={id('mt')} base={c.secondary} x2={0} y2={14} />
            <MetalBox id={id('mp')} base={c.secondary} across />
          </>
        ),
        bay: (
          <>
            <rect x={8} y={18} width={P - 16} height={r2(h - 36)} fill={url(id('gs'))} />
            <path d={`M${P * 0.3} 18L${P * 0.2} ${h - 18}H${P * 0.27}L${P * 0.37} 18Z`} fill={tint(c.background, 0.6)} opacity={0.35} />
            <rect x={8} y={18} width={P - 16} height={r2(h - 36)} fill="none" stroke={tint(c.background, 0.5)} strokeWidth={1.4} opacity={0.6} />
            <rect x={-5} y={10} width={10} height={r2(h - 10)} fill={url(id('mp'))} />
            <rect x={P - 5} y={10} width={10} height={r2(h - 10)} fill={url(id('mp'))} />
          </>
        ),
        after: (
          <>
            <rect x={0} y={0} width={w} height={14} rx={7} fill={url(id('mt'))} />
            <path d={`M0 2H${w}`} stroke={light.rim} strokeWidth={1.4} opacity={0.7} />
            <rect x={0} y={h - 18} width={w} height={18} fill={blend(c.muted, c.text, 0.3)} />
          </>
        ),
      };
    }
    case 'marbleRail': {
      const marble = blend(c.background, c.surface, 0.3);
      const P = 160;
      const band = Math.max(18, h - 40);
      const flowers: Array<[number, number, number]> = [];
      if (!low) for (let k = 0; k < 3; k++) flowers.push([30 + k * 50, band * 0.5 + 14, 5]);
      return {
        base: marble,
        pitch: P,
        bay: (
          <>
            <rect x={14} y={16} width={P - 28} height={band} fill={blend(marble, c.muted, 0.08)} stroke={c.secondary} strokeWidth={1.5} />
            {flowers.length ? (
              <>
                <path d={`M20 ${r2(band * 0.5 + 16)}Q45 ${r2(band * 0.5 + 6)} 70 ${r2(band * 0.5 + 16)}T120 ${r2(band * 0.5 + 16)}T${P - 18} ${r2(band * 0.5 + 16)}`} fill="none" stroke={c.secondary} strokeWidth={1.4} />
                <path d={circles(flowers)} fill={blend(c.primary, c.accent, 0.3)} />
                <path d={circles(flowers.map(([x, y]) => [x, y, 2] as const))} fill={c.secondary} />
              </>
            ) : null}
            <rect x={-9} y={8} width={18} height={r2(h - 8)} fill={tint(marble, 0.12)} />
            <rect x={P - 9} y={8} width={18} height={r2(h - 8)} fill={tint(marble, 0.12)} />
          </>
        ),
        after: (
          <>
            <rect x={0} y={0} width={w} height={12} fill={tint(marble, 0.18)} />
            <path d={`M0 1H${w}`} stroke={light.rim} strokeWidth={1.5} opacity={0.8} />
            <path d={`M0 12H${w}`} stroke={blend(marble, c.muted, 0.4)} strokeWidth={2} />
            <rect x={0} y={h - 8} width={w} height={8} fill={blend(marble, c.muted, 0.3)} />
          </>
        ),
      };
    }
  }
}

/** A side wall's elevation (content left = near): bays with lit openings, a plinth and a cornice; quiet above the eye line. */
export function Wall(props: DrawProps & WallOptions) {
  const { w, h, colors: c, nature: n, light, plane, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'l', [variant]);
  const y0 = plane?.y0 ?? 800 - h;
  const side: Side = plane && plane.x0 > 600 ? 'right' : 'left';
  const ctx: WallCtx = { c, n, light, w, h, Y: (wy) => r2(wy - y0), low, id, salt: 3 + (Math.abs(Math.round(props.seed)) % 83) };
  const art = wallArt(variant, ctx);
  const rail = variant === 'jaaliRail' || variant === 'glassRail' || variant === 'marbleRail';
  return (
    <Svg w={w} h={h}>
      <defs>
        <pattern id={id('bay')} width={art.pitch} height={h} patternUnits="userSpaceOnUse">
          {art.bay}
        </pattern>
        {art.defs}
      </defs>
      {art.base !== 'none' ? <rect width={w} height={h} fill={art.base} /> : null}
      <rect width={w} height={h} fill={url(id('bay'))} />
      {art.after}
      {/* The veil settles the wall above the eye line first and the key light falls on both alike: lit after the veil,
          a wall turned away from the light kept its shade below the eye line only, a band across its windows. */}
      {rail || art.base === 'none' ? null : <QuietVeil id={id('q')} w={w} eye={props.eyeLine} color={art.base} />}
      {rail ? null : <UprightLight id={id} w={w} h={h} light={light} side={side} wall />}
    </Svg>
  );
}

// ─────────────────────────── sky ───────────────────────────

interface SkyTones {
  top: string;
  mid: string;
  low: string;
  below: string;
  glow?: { x: number; color: string; a: number };
  sun?: { x: number; y: number; r: number };
  clouds?: string;
}

function skyTones(variant: SkyVariant, c: C, light: KeyLight): SkyTones {
  const P = c.primary;
  const T = c.text;
  const A = c.accent;
  const B = c.background;
  const S = c.secondary;
  const M = c.muted;
  switch (variant) {
    case 'night':
      return { top: blend(P, T, 0.6), mid: blend(P, T, 0.4), low: blend(P, A, 0.22), below: blend(P, T, 0.45), glow: { x: 600, color: blend(A, S, 0.3), a: 0.22 } };
    case 'blueHour':
      return { top: blend(P, T, 0.45), mid: blend(P, M, 0.35), low: blend(A, B, 0.2), below: blend(P, M, 0.5), glow: { x: 760, color: blend(A, S, 0.3), a: 0.35 }, clouds: blend(A, P, 0.55) };
    case 'preDawn':
      return { top: blend(T, P, 0.35), mid: blend(blend(T, P, 0.35), M, 0.35), low: blend(M, A, 0.3), below: blend(T, M, 0.45), glow: { x: 600, color: blend(A, light.color, 0.4), a: 0.25 } };
    case 'dawn':
      return { top: blend(P, B, 0.35), mid: blend(P, B, 0.68), low: blend(A, B, 0.42), below: blend(blend(A, B, 0.42), P, 0.2), glow: { x: 600, color: blend(light.color, A, 0.4), a: 0.55 }, clouds: tint(A, 0.4) };
    case 'dawnPastel':
      return { top: blend(P, S, 0.12), mid: blend(S, B, 0.12), low: blend(A, S, 0.15), below: blend(blend(S, B, 0.3), P, 0.2), glow: { x: 600, color: A, a: 0.7 }, clouds: blend(B, S, 0.35) };
    case 'sunrise':
      return { top: blend(B, M, 0.35), mid: blend(A, B, 0.3), low: blend(P, A, 0.5), below: blend(blend(P, A, 0.5), M, 0.3), glow: { x: SUN_X.sunrise ?? 410, color: light.color, a: 0.65 }, sun: { x: SUN_X.sunrise ?? 410, y: 430, r: 46 }, clouds: blend(A, P, 0.25) };
    case 'morning':
      return { top: blend(B, M, 0.22), mid: blend(B, M, 0.1), low: B, below: blend(B, M, 0.18), clouds: tint(B, 0.7) };
    case 'golden':
      return { top: blend(B, A, 0.5), mid: blend(A, B, 0.45), low: blend(A, S, 0.35), below: blend(blend(A, S, 0.35), M, 0.25), glow: { x: SUN_X.golden ?? 300, color: light.color, a: 0.6 }, sun: { x: SUN_X.golden ?? 300, y: 420, r: 52 }, clouds: tint(A, 0.35) };
    case 'dusk':
      return { top: blend(P, T, 0.45), mid: blend(P, A, 0.45), low: blend(A, S, 0.3), below: blend(P, T, 0.3), glow: { x: 260, color: blend(A, light.color, 0.5), a: 0.5 }, clouds: blend(A, P, 0.35) };
  }
}

/** The skyline: quiet silhouettes standing on the horizon (frame y 440 = content 680), never higher than ~frame y 320. */
function SkylineArt({ kind, sil, far, c, n, light, salt, low }: { kind: Skyline; sil: string; far: string; c: C; n: DrawProps['nature']; light: KeyLight; salt: number; low: boolean }) {
  const HZ = 680;
  const inColumn = (x: number) => x > 740 && x < 1180;
  const blocks = (seedSalt: number, minW: number, maxW: number, minH: number, maxH: number, column = 0.5) => {
    const out: Array<[number, number, number]> = [];
    for (let x = -20, i = 0; x < 1940; i++) {
      const bw = minW + rand(i, seedSalt) * (maxW - minW);
      const bh = (minH + rand(i, seedSalt + 1) * (maxH - minH)) * (inColumn(x + bw / 2) ? column : 1);
      out.push([x, bw, bh]);
      x += bw;
    }
    return out;
  };
  const blockPath = (list: Array<[number, number, number]>) => list.map(([x, bw, bh]) => rect(x, HZ - bh, bw + 0.5, bh + 2)).join('');
  const windows = (list: Array<[number, number, number]>, color: string, p: number) => {
    if (low) return null;
    const pts: string[] = [];
    list.forEach(([x, bw, bh], i) => {
      if (bh < 30) return;
      const q = inColumn(x + bw / 2) ? p * 0.4 : p;
      for (let r = 0; r < Math.min(3, Math.floor(bh / 14)); r++)
        for (let k = 0; k < Math.min(4, Math.floor(bw / 12)); k++) if (rand(i * 31 + r * 5 + k, salt + 70) < q) pts.push(rect(x + 5 + k * 11, HZ - bh + 8 + r * 13, 4, 6));
    });
    return pts.length ? <path d={pts.join('')} fill={color} opacity={0.55} /> : null;
  };
  const lit = tint(blend(c.accent, light.color, 0.5), 0.2);
  /** A far line of trees: a continuous canopy of soft crowns (never loose bubbles), between x0 and x1. */
  const treeline = (x0: number, x1: number, hMin: number, hMax: number, seedSalt: number) => {
    let d = `M${x0} ${HZ + 2}`;
    let x = x0;
    for (let i = 0; x < x1; i++) {
      const cw = 34 + rand(i, seedSalt) * 46;
      const top = HZ - hMin - rand(i, seedSalt + 1) * (hMax - hMin);
      d += `Q${r1(x + cw * 0.5)} ${r1(top - cw * 0.35)} ${r1(x + cw)} ${r1(top + (hMax - hMin) * 0.3)}`;
      x += cw;
    }
    return `${d}L${r1(x)} ${HZ + 2}Z`;
  };
  /** An onion dome with its finial, as path data (silhouettes of one tone share a path). */
  const dome = (x: number, base: number, dw: number) => {
    const dh = dw * 0.95;
    return `M${r1(x - dw / 2)} ${r1(base)}C${r1(x - dw * 0.62)} ${r1(base - dh * 0.45)} ${r1(x - dw * 0.18)} ${r1(base - dh * 0.62)} ${r1(x)} ${r1(base - dh)}C${r1(x + dw * 0.18)} ${r1(base - dh * 0.62)} ${r1(x + dw * 0.62)} ${r1(base - dh * 0.45)} ${r1(x + dw / 2)} ${r1(base)}Z${rect(x - 1.5, base - dh - dw * 0.22, 3, dw * 0.22)}`;
  };
  /** A chhatri: a small dome on a slab and three posts. */
  const chhatri = (x: number, base: number, cw: number) => {
    const ph = cw * 0.6;
    return `${dome(x, base - ph - cw * 0.08, cw * 0.8)}${rect(x - cw / 2, base - ph - cw * 0.1, cw, cw * 0.1)}${[-0.4, 0, 0.4].map((k) => rect(x + k * cw - cw * 0.04, base - ph, cw * 0.08, ph)).join('')}`;
  };
  switch (kind) {
    case 'none':
      return null;
    case 'city': {
      const back = blocks(salt + 1, 40, 90, 30, 110, 0.4);
      const front = blocks(salt + 2, 50, 120, 20, 80, 0.45);
      return (
        <g>
          <path d={blockPath(back)} fill={far} />
          <path d={blockPath(front)} fill={sil} />
          {windows(front, lit, 0.2)}
          <path d={`M300 ${HZ - 118}v-30M1640 ${HZ - 110}v-26`} stroke={sil} strokeWidth={3} />
        </g>
      );
    }
    case 'rooftops': {
      const roofs = blocks(salt + 3, 50, 120, 16, 46, 0.6);
      let extras = '';
      roofs.forEach(([x, bw, bh], i) => {
        const r = rand(i, salt + 9);
        const top = HZ - bh;
        if (r < 0.14) extras += chhatri(x + bw / 2, top, Math.min(38, bw * 0.4));
        else if (r < 0.26) extras += `${rect(x + bw * 0.3, top - 22, 26, 14)}${rect(x + bw * 0.3 + 3, top - 8, 2, 8)}${rect(x + bw * 0.3 + 21, top - 8, 2, 8)}`;
        else if (r < 0.34) extras += dome(x + bw / 2, top, Math.min(44, bw * 0.5));
      });
      return (
        <g>
          <path d={`M180 ${HZ}L196 ${HZ - 96}L212 ${HZ}Z${rect(1520, HZ - 120, 14, 120)}`} fill={far} />
          <path d={circles([[1527, HZ - 124, 10]])} fill={far} />
          <path d={blockPath(roofs)} fill={sil} />
          {extras ? <path d={extras} fill={sil} /> : null}
          {windows(roofs, lit, 0.3)}
        </g>
      );
    }
    case 'domes': {
      const wall = blocks(salt + 4, 60, 140, 12, 30, 0.7);
      const minaret = (x: number, hh: number) => `${rect(x - 5, HZ - hh, 10, hh)}${rect(x - 8, HZ - hh * 0.62, 16, 4)}${rect(x - 8, HZ - hh * 0.9, 16, 4)}`;
      return (
        <g>
          <path d={treeline(0, 1920, 14, 40, salt + 30)} fill={far} />
          <path d={blockPath(wall)} fill={sil} />
          <path d={`${dome(520, HZ - 34, 110)}${rect(450, HZ - 36, 140, 36)}${dome(1400, HZ - 30, 96)}${rect(1340, HZ - 32, 120, 32)}${chhatri(240, HZ - 20, 44)}${chhatri(1700, HZ - 22, 44)}`} fill={sil} />
          <path d={`${minaret(430, 120)}${minaret(610, 120)}${minaret(1320, 110)}${minaret(1480, 110)}`} fill={sil} />
          <path d={circles([[430, HZ - 124, 8], [610, HZ - 124, 8], [1320, HZ - 114, 8], [1480, HZ - 114, 8]])} fill={sil} />
        </g>
      );
    }
    case 'minarets': {
      const minaret = (x: number, hh: number) => `${rect(x - 6, HZ - hh, 12, hh)}${rect(x - 10, HZ - hh * 0.55, 20, 5)}${rect(x - 10, HZ - hh * 0.85, 20, 5)}M${x - 8} ${HZ - hh}Q${x} ${HZ - hh - 22} ${x + 8} ${HZ - hh}Z`;
      const town = blocks(salt + 5, 50, 110, 12, 34, 0.6);
      return (
        <g>
          <path d={blockPath(town)} fill={far} />
          <path d={`${rect(300, HZ - 46, 230, 46)}${rect(1400, HZ - 42, 220, 42)}${dome(415, HZ - 44, 120)}${dome(1510, HZ - 40, 110)}`} fill={sil} />
          <path d={`${minaret(282, 150)}${minaret(548, 150)}${minaret(1384, 140)}${minaret(1636, 140)}`} fill={sil} />
        </g>
      );
    }
    case 'hills': {
      const ridge = (seedSalt: number, hMax: number, baseY: number) => {
        let d = `M0 ${baseY}L0 ${r2(baseY - hMax * 0.5)}`;
        for (let x = 0, i = 0; x < 1920; x += 240, i++) {
          const peak = baseY - hMax * (0.45 + rand(i, seedSalt) * 0.55);
          d += `Q${x + 120} ${r2(peak)} ${x + 240} ${r2(baseY - hMax * (0.35 + rand(i + 1, seedSalt) * 0.4))}`;
        }
        return `${d}L1920 ${baseY}Z`;
      };
      const tea = blend(sil, n.leaf, 0.3);
      return (
        <g>
          <path d={ridge(salt + 11, 130, HZ + 4)} fill={far} />
          <path d={ridge(salt + 12, 80, HZ + 10)} fill={sil} />
          <path d={ridge(salt + 13, 46, HZ + 60)} fill={tea} />
          {low ? null : <path d={Array.from({ length: 6 }, (_, i) => `M0 ${HZ + 8 + i * 9}Q480 ${HZ - 14 + i * 9} 960 ${HZ + 4 + i * 9}T1920 ${HZ + 6 + i * 9}`).join('')} fill="none" stroke={tint(tea, 0.15)} strokeWidth={2} opacity={0.5} />}
        </g>
      );
    }
    case 'shikhara': {
      const tower = (x: number, hw: number, hh: number) =>
        `M${x - hw} ${HZ}L${r2(x - hw * 0.94)} ${r2(HZ - hh * 0.28)}C${r2(x - hw * 0.9)} ${r2(HZ - hh * 0.68)} ${r2(x - hw * 0.5)} ${r2(HZ - hh * 0.94)} ${r2(x - hw * 0.24)} ${r2(HZ - hh)}L${r2(x + hw * 0.24)} ${r2(HZ - hh)}C${r2(x + hw * 0.5)} ${r2(HZ - hh * 0.94)} ${r2(x + hw * 0.9)} ${r2(HZ - hh * 0.68)} ${r2(x + hw * 0.94)} ${r2(HZ - hh * 0.28)}L${x + hw} ${HZ}Z`;
      const cap = (x: number, hw: number, hh: number) => `M${r2(x - hw * 0.36)} ${r2(HZ - hh - 2)}a${r2(hw * 0.36)} ${r2(hw * 0.12)} 0 1 0 ${r2(hw * 0.72)} 0a${r2(hw * 0.36)} ${r2(hw * 0.12)} 0 1 0 ${r2(-hw * 0.72)} 0${diamond(x, HZ - hh - hw * 0.3, hw * 0.08, hw * 0.16)}`;
      return (
        <g>
          <path d={`${treeline(0, 760, 16, 46, salt + 31)}${treeline(1160, 1920, 16, 46, salt + 32)}`} fill={far} />
          <path d={`${tower(960, 62, 150)}${cap(960, 62, 150)}${tower(870, 38, 92)}${cap(870, 38, 92)}${tower(1050, 38, 92)}${cap(1050, 38, 92)}`} fill={sil} />
          <path d={`M780 ${HZ}L800 ${HZ - 40}H${1120}L1140 ${HZ}Z`} fill={sil} />
          {low ? null : <path d={[0.3, 0.45, 0.6, 0.75].map((f) => `M${r2(960 - 60 * (1 - f * 0.5))} ${r2(HZ - 150 * f)}Q960 ${r2(HZ - 150 * f - 6)} ${r2(960 + 60 * (1 - f * 0.5))} ${r2(HZ - 150 * f)}`).join('')} fill="none" stroke={far} strokeWidth={2} opacity={0.5} />}
        </g>
      );
    }
  }
}

/** The part of a sun disc above the horizon line (a rising or setting sun is cut by it). */
function sunAbove(x: number, y: number, r: number, hz: number): string {
  if (y + r <= hz) return circles([[x, y, r]]);
  const dy = hz - y;
  const hc = Math.sqrt(Math.max(0, r * r - dy * dy));
  return `M${r2(x - hc)} ${hz}A${r} ${r} 0 ${dy > 0 ? 1 : 0} 1 ${r2(x + hc)} ${hz}Z`;
}

/** A sky drawn in frame coordinates (1920×1280 with the frame at 360, 240): a gradient, the horizon at frame y 440 and a hazed skyline. */
export function Sky(props: DrawProps & SkyOptions) {
  const { w, h, colors: c, nature: n, light, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 's', [variant, props.skyline, props.moon, props.stars]);
  const sx = w / 1920;
  const sy = h / 1280;
  const HZ = 680;
  const salt = 7 + (Math.abs(Math.round(props.seed)) % 79);
  const t = skyTones(variant, c, light);
  const fx = (x: number) => x + 360;
  const fy = (y: number) => y + 240;
  const sil = blend(t.low, t.mid, 0.55);
  const far = blend(t.low, t.mid, 0.3);
  // Stars: only beside the story column (frame x 415–785) and above the skyline.
  const stars = props.stars
    ? Array.from({ length: low ? 16 : 40 }, (_, i) => {
        const right = rand(i, salt + 1) > 0.5;
        const x = right ? fx(800 + rand(i, salt + 2) * 760) : fx(-360 + rand(i, salt + 2) * 760);
        const f = rand(i, salt + 3);
        return [r2(x), r2(f * f * fy(360)), r2(0.9 + rand(i, salt + 4) * 1.6)] as const;
      })
    : [];
  const sparkles = stars.filter((_, i) => i % 8 === 0);
  const moonC = tint(blend(c.background, c.accent, 0.4), 0.3);
  const moonX = fx(700);
  const moonY = fy(80);
  const clouds =
    t.clouds && !low
      ? Array.from({ length: 6 }, (_, i) => {
          const y = HZ - 40 - rand(i, salt + 20) * 230;
          const x = rand(i, salt + 21) * 1920;
          const rx = 160 + rand(i, salt + 22) * 260;
          return `M${r2(x - rx)} ${r2(y)}a${r2(rx)} ${r2(8 + rand(i, salt + 23) * 9)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(8 + rand(i, salt + 23) * 9)} 0 1 0 ${r2(-2 * rx)} 0`;
        }).join('')
      : '';
  return (
    <Svg w={w} h={h}>
      <g transform={sx !== 1 || sy !== 1 ? `scale(${r2(sx * 1000) / 1000} ${r2(sy * 1000) / 1000})` : undefined}>
        <defs>
          <LinU id={id('g')} y2={1280} s={[[0, t.top], [0.36, t.mid], [HZ / 1280, t.low], [(HZ + 110) / 1280, t.below], [1, t.below]]} />
          {t.glow ? <Rad id={id('gw')} s={[[0, t.glow.color, t.glow.a], [0.5, t.glow.color, t.glow.a * 0.35], [1, t.glow.color, 0]]} /> : null}
          {t.sun ? <Rad id={id('sn')} s={[[0, tint(light.color, 0.5), 0.9], [0.25, light.color, 0.45], [1, light.color, 0]]} /> : null}
          {props.moon ? <Rad id={id('mh')} s={[[0, moonC, 0.4], [1, moonC, 0]]} /> : null}
        </defs>
        <rect width={1920} height={1280} fill={url(id('g'))} />
        {t.glow ? <ellipse cx={fx(t.glow.x)} cy={HZ} rx={980} ry={260} fill={url(id('gw'))} /> : null}
        {clouds ? <path d={clouds} fill={t.clouds} opacity={0.32} /> : null}
        {stars.length ? <path d={circles(stars)} fill={tint(c.accent, 0.55)} opacity={0.75} /> : null}
        {sparkles.length && !low ? <path d={sparkles.map(([x, y, r]) => `M${x} ${r2(y - r * 3.4)}L${r2(x + r * 0.6)} ${r2(y - r * 0.6)}L${r2(x + r * 3.4)} ${y}L${r2(x + r * 0.6)} ${r2(y + r * 0.6)}L${x} ${r2(y + r * 3.4)}L${r2(x - r * 0.6)} ${r2(y + r * 0.6)}L${r2(x - r * 3.4)} ${y}L${r2(x - r * 0.6)} ${r2(y - r * 0.6)}Z`).join('')} fill={tint(c.accent, 0.7)} /> : null}
        {t.sun ? (
          <g>
            <circle cx={fx(t.sun.x)} cy={fy(t.sun.y)} r={r2(t.sun.r * 7)} fill={url(id('sn'))} />
            <path d={sunAbove(fx(t.sun.x), fy(t.sun.y), t.sun.r, HZ)} fill={tint(blend(light.color, c.accent, 0.4), 0.45)} />
          </g>
        ) : null}
        {props.moon ? (
          <g>
            <circle cx={moonX} cy={moonY} r={110} fill={url(id('mh'))} />
            {props.moon === 'full' ? (
              <g>
                <circle cx={moonX} cy={moonY} r={30} fill={moonC} />
                <path d={circles([[moonX - 9, moonY - 6, 5], [moonX + 8, moonY + 7, 3.5], [moonX + 4, moonY - 12, 2.5]])} fill={shade(moonC, 0.08)} />
              </g>
            ) : (
              <path d="M62 10A42 42 0 1 0 62 90A34 34 0 1 1 62 10Z" transform={`translate(${moonX - 36} ${moonY - 36}) scale(0.72)`} fill={moonC} />
            )}
          </g>
        ) : null}
        <SkylineArt kind={props.skyline ?? 'none'} sil={sil} far={far} c={c} n={n} light={light} salt={salt} low={low} />
        {/* The skyline's foot: a pale line where its silhouettes stand. A sky with none has nothing standing on the horizon, so no line (bare, it read as a seam across the sky above a set's low backdrop). */}
        {(props.skyline ?? 'none') !== 'none' ? <path d={`M0 ${HZ + 1}H1920`} stroke={tint(t.low, 0.35)} strokeWidth={2} opacity={0.5} /> : null}
      </g>
    </Svg>
  );
}

// ─────────────────────────── arch screen ───────────────────────────

/** A wall across the room with one arch opening cut with even-odd: quiet above, a carved or mirror border round the opening. */
export function ArchScreen(props: DrawProps & ArchScreenOptions) {
  const { w, h, colors: c, light, plane, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'a', [variant, props.opening]);
  const y0 = plane?.y0 ?? 800 - h;
  const Y = (wy: number) => r2(wy - y0);
  const cx = r2(plane ? 600 - plane.x0 : w / 2);
  const half = props.opening.w / 2;
  const apex = Y(props.opening.apexY);
  const kind: ArchKind = variant === 'round' ? 'round' : variant === 'lancet' ? 'lancet' : 'pointed';
  const rise = kind === 'round' ? half : kind === 'lancet' ? half * 1.6 : half * 1.05;
  const spring = apex + rise;
  const lobes = variant === 'cusped' ? 6 : 0;
  const B = 36;
  const hole = arch(cx, half, spring, apex, h, kind, lobes);
  const outer = arch(cx, half + B, spring, apex - B * 1.1, h, kind, lobes);
  const box = rect(0, 0, w, h);
  const gold = c.secondary;
  const velvet = variant === 'cusped' ? blend(c.primary, c.text, 0.32) : blend(c.surface, c.muted, variant === 'round' ? 0.22 : 0.32);
  const panel = variant === 'cusped' ? blend(c.primary, c.text, 0.18) : blend(velvet, c.surface, 0.3);
  const ax0 = cx - half - B - 64;
  const ax1 = cx + half + B + 64;
  const atop = apex - B * 1.1 - 50;
  const roundel = (x: number) => (
    <g key={x}>
      <circle cx={r2(x)} cy={r2(atop + 70)} r={24} fill={blend(panel, gold, 0.25)} />
      <path d={star8(x, atop + 70, 2.4)} fill={gold} />
      <circle cx={r2(x)} cy={r2(atop + 70)} r={24} fill="none" stroke={gold} strokeWidth={2} />
    </g>
  );
  const pilaster = (x: number) => (
    <g key={`p${x}`}>
      <rect x={r2(x - 22)} y={r2(spring)} width={44} height={r2(h - spring)} fill={blend(panel, gold, 0.12)} />
      <path d={`M${r2(x - 22)} ${r2(spring)}V${h}M${r2(x + 22)} ${r2(spring)}V${h}`} stroke={gold} strokeWidth={1.6} opacity={0.8} />
      {low ? null : <path d={Array.from({ length: Math.floor((h - spring - 80) / 46) }, (_, i) => diamond(x, spring + 50 + i * 46, 8, 13)).join('')} fill={gold} opacity={0.85} />}
      <rect x={r2(x - 28)} y={r2(spring - 16)} width={56} height={16} fill={gold} />
    </g>
  );
  return (
    <Svg w={w} h={h}>
      <defs>
        {variant === 'cusped' ? (
          <pattern id={id('bd')} width={18} height={18} patternUnits="userSpaceOnUse">
            <rect width={18} height={18} fill={blend(c.primary, c.text, 0.5)} />
            <path d={diamond(9, 9, 5.5)} fill={tint(gold, 0.3)} />
            <path d={`${diamond(0, 0, 4)}${diamond(18, 0, 4)}${diamond(0, 18, 4)}${diamond(18, 18, 4)}`} fill={blend(gold, c.accent, 0.5)} />
            {low ? null : <circle cx={9} cy={9} r={1.5} fill={tint(c.accent, 0.7)} />}
          </pattern>
        ) : (
          <pattern id={id('bd')} width={24} height={24} patternUnits="userSpaceOnUse">
            <rect width={24} height={24} fill={blend(velvet, gold, 0.18)} />
            <path d="M0 12Q6 4 12 12T24 12" fill="none" stroke={blend(velvet, c.text, 0.2)} strokeWidth={2} />
          </pattern>
        )}
        <pattern id={id('dm')} width={80} height={110} patternUnits="userSpaceOnUse">
          <rect width={80} height={110} fill={velvet} />
          <path d="M40 8C58 30 58 40 40 55C22 40 22 30 40 8ZM0 63C18 85 18 95 0 110M80 63C62 85 62 95 80 110" fill="none" stroke={blend(velvet, gold, 0.12)} strokeWidth={1.6} />
        </pattern>
      </defs>
      <path d={`${box}${hole}`} fillRule="evenodd" fill={low ? velvet : url(id('dm'))} />
      <path d={`${rect(ax0, atop, ax1 - ax0, h - atop)}${outer}`} fillRule="evenodd" fill={panel} />
      <path d={rect(ax0 + 8, atop + 8, ax1 - ax0 - 16, h - atop - 8)} fill="none" stroke={gold} strokeWidth={3} />
      <path d={rect(ax0 + 18, atop + 18, ax1 - ax0 - 36, h - atop - 18)} fill="none" stroke={gold} strokeWidth={1.2} opacity={0.6} />
      {roundel(cx - half - B * 0.4)}
      {roundel(cx + half + B * 0.4)}
      <path d={`${outer}${hole}`} fillRule="evenodd" fill={url(id('bd'))} />
      {variant === 'lancet' ? <path d={archCurve(cx, half + B / 2, spring, apex - B * 0.55, kind)} fill="none" stroke={blend(velvet, c.text, 0.3)} strokeWidth={B} strokeDasharray="2 30" opacity={0.6} /> : null}
      <path d={outer} fill="none" stroke={gold} strokeWidth={3} />
      {pilaster(cx - half - B - 30)}
      {pilaster(cx + half + B + 30)}
      <path d={`${rect(0, h - 54, cx - half, 54)}${rect(cx + half, h - 54, w - cx - half, 54)}`} fill={blend(velvet, c.text, 0.3)} />
      <path d={`M0 ${h - 54}H${r2(cx - half)}M${r2(cx + half)} ${h - 54}H${w}`} stroke={gold} strokeWidth={4} />
      <path d={hole} fill="none" stroke={gold} strokeWidth={2.4} />
      <path d={hole} fill="none" stroke={light.rim} strokeWidth={1.8} opacity={0.75} />
      <UprightLight id={id} w={w} h={h} light={light} side="left" wall={false} hole={hole} gap={[cx - half, cx + half]} />
      <QuietVeil id={id('q')} w={w} eye={props.eyeLine} color={velvet} hole={hole} />
    </Svg>
  );
}

// ─────────────────────────── mist ───────────────────────────

/** Relative luminance of a #rrggbb colour (0 black … 1 white). */
function luminanceOf(color: string): number {
  const n = Number.parseInt(hex(color).slice(1), 16);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/**
 * A long low band of haze (12–30% opacity, feathered with stacked ellipses). Every ellipse stays inside the box, so a
 * band standing on water or a floor fades out before its foot instead of ending in a line there.
 */
export function MistBand(props: DrawProps & MistBandOptions) {
  const { w, h, colors: c, variant } = props;
  const low = props.detail === 'low';
  const id = idsFor(props, 'm', [variant, props.tone]);
  const salt = 9 + (Math.abs(Math.round(props.seed)) % 71);
  const tone =
    props.tone ??
    (variant === 'river'
      ? blend(c.background, c.accent, 0.18)
      : variant === 'incense' && luminanceOf(c.background) < 0.25
        ? tint(blend(c.secondary, c.primary, 0.45), 0.5)
        : tint(c.background, 0.5));
  if (variant === 'incense') {
    const wisps = Array.from({ length: low ? 3 : 6 }, (_, i) => {
      const x = w * (0.12 + 0.76 * rand(i, salt));
      const drift = (rand(i, salt + 1) - 0.5) * w * 0.25;
      const seg: Segment = [
        [x, h],
        [x + drift * 0.2 - 40, h * 0.66],
        [x + drift * 0.8 + 50, h * 0.36],
        [x + drift, h * 0.04],
      ];
      return taper([seg], [10 + rand(i, salt + 2) * 14, 34 + rand(i, salt + 3) * 30], 14);
    });
    return (
      <Svg w={w} h={h}>
        <defs>
          <Rad id={id('b')} s={[[0, tone, 0.26], [1, tone, 0]]} />
          <LinU id={id('v')} y2={h} s={[[0, tone, 0], [0.4, tone, 0.12], [1, tone, 0.24]]} />
        </defs>
        <ellipse cx={r2(w / 2)} cy={r2(h * 0.8)} rx={r2(w * 0.48)} ry={r2(h * 0.2)} fill={url(id('b'))} />
        {wisps.map((d, i) => (
          <path key={i} d={d} fill={url(id('v'))} />
        ))}
      </Svg>
    );
  }
  const n = low ? 4 : 7;
  return (
    <Svg w={w} h={h}>
      <defs>
        <Rad id={id('b')} s={[[0, tone, variant === 'dawn' ? 0.24 : 0.2], [0.55, tone, 0.1], [1, tone, 0]]} />
      </defs>
      {Array.from({ length: n }, (_, i) => {
        const ry = h * (0.32 + rand(i, salt + 3) * 0.16);
        // Raised until its foot is the box's: the gradient reaches nothing at the ellipse's edge, never a cut.
        const cy = Math.min(h * (0.48 + rand(i, salt + 1) * 0.16), h - ry);
        return <ellipse key={i} cx={r2(w * (0.08 + (0.84 * (i + rand(i, salt) * 0.8)) / n))} cy={r2(cy)} rx={r2(w * (0.14 + rand(i, salt + 2) * 0.12))} ry={r2(ry)} fill={url(id('b'))} />;
      })}
    </Svg>
  );
}

// ─────────────────────────── registry (sheets, Studio) ───────────────────────────

const SHEET_PLANE = { x0: 230, x1: 970, y0: 800, y1: 800, dNear: 900, dFar: 2100 };
const SHEET_CEILING = { x0: 230, x1: 970, y0: -60, y1: -60, dNear: 400, dFar: 1600 };
/** Floor options that show each material as the sets use it (§5.3). */
const FLOOR_SAMPLE: Record<FloorVariant, Omit<FloorOptions, 'variant' | 'pools'>> = {
  chequer: { runner: true },
  flags: { channel: true },
  terracotta: {},
  terrace: {},
  templeStone: { rangoli: true, kolam: 'path' },
  cobbles: { rangoli: true },
  earth: {},
  redOxide: { kolam: 'center' },
  granite: { kolam: 'path' },
  parquet: {},
  carpet: { runner: true },
  sawdust: { ring: true },
  lawn: { path: true },
  teak: {},
};
/** A wall's plane for a sheet: its box standing on the floor (yTop = 800 − h), on the left. */
const wallSheet = (p: DrawProps) => ({ plane: p.plane ?? { x0: 230, x1: 230, y0: 800 - p.h, y1: 800, dNear: 400, dFar: 400 + p.w }, eyeLine: p.eyeLine ?? (p.h > 470 ? p.h - 470 : null) });

export const SURFACES_KIT: readonly KitEntry[] = [
  {
    name: 'Floor',
    file: 'surfaces',
    plane: 'floor',
    variants: ['chequer', 'flags', 'terracotta', 'terrace', 'templeStone', 'cobbles', 'earth', 'redOxide', 'granite', 'parquet', 'carpet', 'sawdust', 'lawn', 'teak'],
    box: () => ({ w: 740, h: 1200 }),
    render: (p, variant) => <Floor {...p} plane={p.plane ?? SHEET_PLANE} variant={variant as FloorVariant} {...FLOOR_SAMPLE[variant as FloorVariant]} pools={[{ x: 600, d: 1700, r: 200, color: p.light.color }, { x: 380, d: 1150, r: 110, color: p.light.color }]} />,
  },
  { name: 'Water', file: 'surfaces', plane: 'floor', variants: ['still', 'pool', 'river'], box: () => ({ w: 740, h: 1200 }), render: (p, variant) => <Water {...p} plane={p.plane ?? SHEET_PLANE} variant={variant as WaterVariant} streaks={[{ x: 600, color: p.colors.secondary }]} /> },
  { name: 'Ceiling', file: 'surfaces', plane: 'ceiling', variants: ['mirrorCoffer', 'plasterCoffer', 'graniteBeams', 'timberVault', 'lightGrid', 'tentStripes', 'boards'], box: () => ({ w: 740, h: 1200 }), render: (p, variant) => <Ceiling {...p} plane={p.plane ?? SHEET_CEILING} variant={variant as CeilingVariant} /> },
  {
    name: 'Wall',
    file: 'surfaces',
    plane: 'wallLeft',
    variants: ['cusped', 'lancet', 'scalloped', 'ballroom', 'veranda', 'tentStripes', 'acoustic', 'colonnade', 'shopfronts', 'jaaliRail', 'glassRail', 'marbleRail'],
    box: (variant) => (/Rail$/.test(variant) ? { w: 1400, h: 120 } : { w: 1400, h: 860 }),
    render: (p, variant) => <Wall {...p} {...wallSheet(p)} variant={variant as WallVariant} />,
  },
  { name: 'Sky', file: 'surfaces', plane: 'sky', variants: ['night', 'blueHour', 'preDawn', 'dawn', 'dawnPastel', 'sunrise', 'morning', 'golden', 'dusk'], box: () => ({ w: 1920, h: 1280 }), render: (p, variant) => <Sky {...p} variant={variant as SkyVariant} skyline="domes" moon={variant === 'night' || variant === 'blueHour' ? 'crescent' : undefined} stars={variant === 'night' || variant === 'preDawn' || variant === 'blueHour'} /> },
  {
    name: 'ArchScreen',
    file: 'surfaces',
    plane: 'back',
    variants: ['cusped', 'round', 'lancet'],
    box: () => ({ w: 740, h: 860 }),
    render: (p, variant) => <ArchScreen {...p} plane={p.plane ?? { x0: 230, x1: 970, y0: 800 - p.h, y1: 800, dNear: 1050, dFar: 1050 }} eyeLine={p.eyeLine ?? 330 - (800 - p.h)} variant={variant as ArchScreenVariant} opening={{ w: 440, apexY: 340 }} />,
  },
  { name: 'MistBand', file: 'surfaces', variants: ['river', 'dawn', 'incense'], box: () => ({ w: 2400, h: 120 }), render: (p, variant) => <MistBand {...p} variant={variant as MistBandVariant} /> },
];
