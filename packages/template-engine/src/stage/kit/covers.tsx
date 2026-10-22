import type { ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { mix } from '../../theme';
import { frameAt, hex, Lit, Metal, onCubic, shade, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import type { CardStyle, DoorStyle, DrawProps, GateStyle, SilkStyle } from '../types';

/**
 * The stage openings' covers (final.md §4, §6.2): the gate, the door, the silk
 * and the card, drawn in the palette as orthographic elevations (the 3D
 * placement gives the perspective). Leaves are drawn front only and hinge on
 * their outer edge; the right leaf is the left one mirrored inside its own
 * drawing (no flipX), so the key light still falls from the stage's side.
 * Covers carry no words but the monogram, set in the script face
 * (`var(--t-script)` on the web, the film's font stack in films).
 *
 * Colours: stock and wood = the primary mixed toward the material, metal = the
 * secondary as foil (`Metal`), satin and seals = the accent; NATURE only for
 * flowers, leaves and flames. No hooks: SVG ids come from the piece's seed, the
 * cover, the variant and the part, so two pieces on one page never collide.
 * The sheet test bans filters, masks, clip-paths and blend modes anywhere in
 * the markup, so every cut shape here is computed (archPoints, cutAbove, yOn).
 */

export type GatePart = 'frame' | 'leafL' | 'leafR' | 'seal' | 'ground' | 'groundIn';
export type DoorPart = 'frame' | 'leafL' | 'leafR' | 'edgeL' | 'edgeR';
export type SilkPart = 'band';
export type CardPart = 'panelL' | 'panelC' | 'panelR' | 'seal';

interface CoverBase {
  /** The monogram printed on seals (coverMonogram(couple, initials)). */
  monogram: string;
  /** The monogram's font: the script face by default (films pass their font stack). */
  fontFamily?: string;
  /** A dark stage (STAGE_META.dark): the torana's strands turn from jasmine to marigold. */
  dark?: boolean;
}
export interface GateCoverOptions extends CoverBase {
  variant: GateStyle;
  part: GatePart;
}
export interface DoorCoverOptions extends CoverBase {
  variant: DoorStyle;
  part: DoorPart;
}
export interface SilkCoverOptions extends CoverBase {
  variant: SilkStyle;
  part: SilkPart;
  /** Which band, 0 (top) … bands − 1 (the hem). */
  band: number;
  bands: number;
}
export interface CardCoverOptions extends CoverBase {
  variant: CardStyle;
  part: CardPart;
}

/** Each cover part's box (units). Silk bands are sized from the start pose (covers3d.ts). */
export const COVER_BOXES = {
  gate: { frame: { w: 1000, h: 800 }, leafL: { w: 300, h: 620 }, leafR: { w: 300, h: 620 }, seal: { w: 120, h: 120 }, ground: { w: 1400, h: 1200 } },
  door: { frame: { w: 700, h: 760 }, leafL: { w: 250, h: 620 }, leafR: { w: 250, h: 620 }, edgeL: { w: 24, h: 620 }, edgeR: { w: 24, h: 620 } },
  card: { panelL: { w: 180, h: 300 }, panelC: { w: 180, h: 300 }, panelR: { w: 180, h: 300 }, seal: { w: 70, h: 70 } },
} as const;

// ─────────────────────────── shared drawing helpers ───────────────────────────

type P = DrawProps;
type Ids = (name: string) => string;
interface Art {
  p: P;
  I: Ids;
}
interface LeafArt extends Art {
  mirror: boolean;
}
type Pt2 = [number, number];

const SCRIPT = 'var(--t-script)';
const url = (id: string) => `url(#${id})`;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;
/** One decimal: arch outlines are sampled finely enough that a tenth of a unit never shows. */
const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: readonly Pt2[]) => `M${pts.map(([x, y]) => pt(x, y)).join('L')}`;

/** A short integer hash (FNV-1a) of a string, base 36. */
function hashOf(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Ids unique to one drawn part (never a hook): the piece's seed, a key naming
 * the cover, variant and part, and a hash of everything else the drawing reads
 * (palette, light, box, detail), so two stages on one page never share a pattern.
 */
function idsOf(p: P, key: string): Ids {
  const c = p.colors;
  const sig = hashOf([c.primary, c.secondary, c.accent, c.background, c.text, p.light.from, p.light.color, p.light.rim, r2(p.w), r2(p.h), p.detail].join('|'));
  const base = `cv${key}${Math.abs(Math.round(p.seed))}${sig}`.replace(/[^a-zA-Z0-9_-]/g, '');
  return (name) => `${base}-${name}`;
}

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      {children}
    </svg>
  );
}

/** Perceived lightness 0..1 of a colour. */
function lum(c: string): number {
  const n = Number.parseInt(hex(c).slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** n copies turned about the origin, `step` degrees apart from `start` (SVG rotation: no trigonometry here). */
const turns = (n: number, step: number, render: (a: number, i: number) => ReactNode, start = 0) => Array.from({ length: n }, (_, i) => render(r2(start + step * i), i));

/** Half a pointed arch, from its springing (x0, ys) up to the apex (xc, ya). `round` lifts the haunch. */
function archHalf(x0: number, ys: number, xc: number, ya: number, round = 0.55): Segment {
  return [
    [x0, ys],
    [x0, r2(ys - (ys - ya) * round)],
    [r2(xc - (xc - x0) * 0.45), r2(ya + (ys - ya) * 0.08)],
    [xc, ya],
  ];
}
const mirrorSeg = (s: Segment, xc: number): Segment => [
  [r2(2 * xc - s[3][0]), s[3][1]],
  [r2(2 * xc - s[2][0]), s[2][1]],
  [r2(2 * xc - s[1][0]), s[1][1]],
  [r2(2 * xc - s[0][0]), s[0][1]],
];

/**
 * An arch's edge as points from the left springing over the apex to the right
 * springing. With `lobes`, the edge is cusped: each lobe bulges out of the
 * opening (into the stone) and the cusps point in, as in Rajput and Mughal
 * multifoil arches.
 */
function archPoints(x0: number, x1: number, ys: number, ya: number, lobes = 0, round = 0.55): Pt2[] {
  const xc = (x0 + x1) / 2;
  const left = archHalf(x0, ys, xc, ya, round);
  const out: Pt2[] = [[x0, ys]];
  for (const seg of [left, mirrorSeg(left, xc)]) {
    const n = lobes || 10;
    let prev = onCubic(seg, 0);
    for (let i = 1; i <= n; i++) {
      const q = onCubic(seg, i / n);
      if (lobes) {
        const dx = q.x - prev.x;
        const dy = q.y - prev.y;
        const cx = (prev.x + q.x) / 2 + dy * 0.55;
        const cy = (prev.y + q.y) / 2 - dx * 0.55;
        for (let s = 1; s <= 3; s++) {
          const t = s / 3;
          const u = 1 - t;
          out.push([r1(u * u * prev.x + 2 * u * t * cx + t * t * q.x), r1(u * u * prev.y + 2 * u * t * cy + t * t * q.y)]);
        }
      } else out.push([r1(q.x), r1(q.y)]);
      prev = q;
    }
  }
  return out;
}

/** An arched opening as a closed path: up the left jamb from `bottom`, over the arch, down the right jamb. */
function arch(x0: number, x1: number, ys: number, ya: number, bottom: number, lobes = 0, round = 0.55): string {
  return `M${pt(x0, bottom)}L${poly(archPoints(x0, x1, ys, ya, lobes, round)).slice(1)}L${pt(x1, bottom)}Z`;
}

/** The part of a run of points above y = cut, closed along the cut (a tympanum above a lintel). */
function cutAbove(pts: readonly Pt2[], cut: number): string {
  const out: Pt2[] = [];
  pts.forEach(([x, y], i) => {
    const prev = pts[i - 1];
    if (prev && (prev[1] <= cut) !== (y <= cut)) {
      const t = (cut - prev[1]) / (y - prev[1]);
      out.push([r2(prev[0] + (x - prev[0]) * t), cut]);
    }
    if (y <= cut) out.push([x, y]);
  });
  return out.length > 2 ? `${poly(out)}Z` : '';
}

/** The y of a run of points (sorted by x) at x, by linear interpolation. */
function yOn(pts: readonly Pt2[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) return b[0] === a[0] ? a[1] : r2(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return pts[pts.length - 1]?.[1] ?? 0;
}

/** Where a run of points crosses y: the leftmost and rightmost x (a lintel set exactly into an arch). */
function spanAt(pts: readonly Pt2[], y: number): [number, number] {
  const xs: number[] = [];
  pts.forEach(([x1, y1], i) => {
    const prev = pts[i - 1];
    if (prev && (prev[1] <= y) !== (y1 <= y)) xs.push(prev[0] + ((x1 - prev[0]) * (y - prev[1])) / (y1 - prev[1]));
  });
  return xs.length ? [r2(Math.min(...xs)), r2(Math.max(...xs))] : [0, 0];
}

/** Wood grain: long, slightly wandering lines (a pattern laid over a wood fill). */
function Grain({ id, wood, seed }: { id: string; wood: string; seed: number }) {
  const lines = Array.from({ length: 5 }, (_, i) => {
    const x = r2(6 + i * 12 + rand(i, seed) * 6);
    const b = r2((rand(i, seed + 1) - 0.5) * 10);
    return `M${x} 0C${r2(x + b)} 80 ${r2(x - b)} 160 ${x} 240`;
  }).join('');
  return (
    <pattern id={id} width="64" height="240" patternUnits="userSpaceOnUse">
      <path d={lines} fill="none" stroke={shade(wood, 0.2)} strokeWidth="0.9" opacity="0.55" />
      <path d={`M${r2(30 + rand(seed, 9) * 10)} 60q6 18 0 36q-6 -18 0 -36Z`} fill="none" stroke={shade(wood, 0.24)} strokeWidth="0.8" opacity="0.5" />
    </pattern>
  );
}

/** A quadratic's y at x when its control point sits midway in x (x then runs linearly with t). */
function qY(x: number, x0: number, x1: number, yEnds: number, yCtrl: number): number {
  const t = (x - x0) / (x1 - x0);
  return r2((1 - t) * (1 - t) * yEnds + 2 * t * (1 - t) * yCtrl + t * t * yEnds);
}

/** Two overlapping squares: an eight-pointed star (girih, khatam). */
function octagram(x: number, y: number, r: number): string {
  const k = r2(r * 0.7071);
  return `M${pt(x, y - r)}L${pt(x + r, y)}L${pt(x, y + r)}L${pt(x - r, y)}Z M${pt(x - k, y - k)}H${r2(x + k)}V${r2(y + k)}H${r2(x - k)}Z`;
}

const STAR5: readonly Pt2[] = [
  [0, -1],
  [0.235, -0.324],
  [0.951, -0.309],
  [0.38, 0.124],
  [0.588, 0.809],
  [0, 0.4],
  [-0.588, 0.809],
  [-0.38, 0.124],
  [-0.951, -0.309],
  [-0.235, -0.324],
];
const star5 = (x: number, y: number, r: number) => `${poly(STAR5.map(([a, b]) => [x + a * r, y + b * r] as Pt2))}Z`;

/** A temple bell hanging from (x, y), s = scale (about 20 × 22 at 1). */
const bellPath = (x: number, y: number, s: number) =>
  `M${pt(x - 7 * s, y + 15 * s)}C${pt(x - 7 * s, y + 4 * s)} ${pt(x - 4 * s, y)} ${pt(x, y)}C${pt(x + 4 * s, y)} ${pt(x + 7 * s, y + 4 * s)} ${pt(x + 7 * s, y + 15 * s)}L${pt(x + 10 * s, y + 19 * s)}H${r2(x - 10 * s)}Z`;

/** A girih lattice tile: an eight-pointed star tied to its neighbours (stroke only: the holes stay open). */
function Girih({ id, color, s = 40, width = 3.2, bg }: { id: string; color: string; s?: number; width?: number; bg?: string }) {
  const m = r2(s / 2);
  const a = r2(s * 0.3);
  const b = r2(s * 0.21);
  const d = `M${pt(m, m - a)}L${pt(m + a, m)}L${pt(m, m + a)}L${pt(m - a, m)}Z M${pt(m - b, m - b)}H${r2(m + b)}V${r2(m + b)}H${r2(m - b)}Z M${m} 0V${r2(m - a)}M${m} ${s}V${r2(m + a)}M0 ${m}H${r2(m - a)}M${s} ${m}H${r2(m + a)}M0 0L${pt(m - b, m - b)}M${s} 0L${pt(m + b, m - b)}M0 ${s}L${pt(m - b, m + b)}M${s} ${s}L${pt(m + b, m + b)}`;
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      {bg ? <rect width={s} height={s} fill={bg} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
    </pattern>
  );
}

/** A diamond lattice with rosettes at the crossings (a stone jaali; the holes stay open). */
function Jaali({ id, color, s = 24, width = 3.4 }: { id: string; color: string; s?: number; width?: number }) {
  const m = r2(s / 2);
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      <path d={`M${m} 0L${s} ${m}L${m} ${s}L0 ${m}Z`} fill="none" stroke={color} strokeWidth={width} />
      <circle cx={m} cy={m} r={r2(s * 0.12)} fill={color} />
      {[0, s].map((x) => [0, s].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r2(s * 0.15)} fill={color} />))}
    </pattern>
  );
}

/**
 * The key light on a solid part (outline `d`): the side away from the light
 * 25% darker (backlit 'far': an even shadow, deeper below) and a thin rim in
 * the rim colour on the edges that face away. Inside a mirrored leaf, `mirror`
 * swaps left and right so the light still comes from the stage's side.
 */
function Lighting({ p, I, d, mirror = false, rim = true, k = '', amount = 1 }: { p: P; I: Ids; d: string; mirror?: boolean; rim?: boolean; k?: string; amount?: number }) {
  const f = p.light.from;
  const side = mirror && f === 'left' ? 'right' : mirror && f === 'right' ? 'left' : f;
  const [x1, y1, x2, y2] = side === 'left' ? [0, 0, 1, 0] : side === 'right' ? [1, 0, 0, 0] : side === 'below' ? [0, 1, 0, 0] : [0, 0, 0, 1];
  const back = f === 'far';
  const ink = shade(p.colors.text, 0.5);
  return (
    <g>
      <defs>
        <linearGradient id={I(`sh${k}`)} x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor={ink} stopOpacity={r2((back ? 0.12 : 0) * amount)} />
          <stop offset="1" stopColor={ink} stopOpacity={r2((back ? 0.3 : 0.25) * amount)} />
        </linearGradient>
        {rim ? (
          <linearGradient id={I(`rm${k}`)} x1={x1} y1={y1} x2={x2} y2={y2}>
            <stop offset={back ? 0 : 0.6} stopColor={p.light.rim} stopOpacity={back ? 0.85 : 0} />
            <stop offset="1" stopColor={p.light.rim} stopOpacity={0.95} />
          </linearGradient>
        ) : null}
      </defs>
      <defs>
        <path id={I(`o${k}`)} d={d} />
      </defs>
      <use href={`#${I(`o${k}`)}`} fill={url(I(`sh${k}`))} fillRule="evenodd" />
      {rim ? <use href={`#${I(`o${k}`)}`} fill="none" stroke={url(I(`rm${k}`))} strokeWidth={2} /> : null}
    </g>
  );
}

/** A group and its mirror image about the box's centre line (the mirror is a <use> of the group: half the markup). */
function Twin({ id, w, children }: { id: string; w: number; children: ReactNode }) {
  return (
    <>
      <g id={id}>{children}</g>
      <use href={`#${id}`} transform={`translate(${w} 0) scale(-1 1)`} />
    </>
  );
}

/** A domed boss (brass stud) lit from the upper left. */
const Boss = ({ x, y, r, fill, hi }: { x: number; y: number; r: number; fill: string; hi: string }) => (
  <g>
    <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={fill} />
    <circle cx={r2(x - r * 0.32)} cy={r2(y - r * 0.34)} r={r2(r * 0.3)} fill={hi} opacity={0.8} />
  </g>
);

/** A chhatri (domed kiosk) standing on (cx, base), w wide: eave, four slender pillars with the sky between, an onion dome, a finial. */
function Kiosk({ cx, base, w, fill, deep, gold }: { cx: number; base: number; w: number; fill: string; deep: string; gold: string }) {
  const h = w * 0.9;
  const x0 = cx - w / 2;
  const eave = base - h * 0.06;
  const top = base - h * 0.42;
  const db = top - h * 0.05;
  return (
    <g>
      <path d={`M${pt(x0 - w * 0.06, base)}H${r2(x0 + w * 1.06)}L${pt(x0 + w * 0.96, eave)}H${r2(x0 + w * 0.04)}Z`} fill={deep} />
      {[0.1, 0.36, 0.58, 0.84].map((f) => (
        <rect key={f} x={r2(x0 + w * f)} y={r2(top)} width={r2(w * 0.06)} height={r2(eave - top)} fill={fill} />
      ))}
      <path d={`M${pt(x0 - w * 0.04, top)}H${r2(x0 + w * 1.04)}L${pt(x0 + w * 0.98, db)}H${r2(x0 + w * 0.02)}Z`} fill={fill} />
      <path
        d={`M${pt(cx - w * 0.42, db)}C${pt(cx - w * 0.5, db - h * 0.26)} ${pt(cx - w * 0.12, db - h * 0.3)} ${pt(cx, db - h * 0.46)}C${pt(cx + w * 0.12, db - h * 0.3)} ${pt(cx + w * 0.5, db - h * 0.26)} ${pt(cx + w * 0.42, db)}Z`}
        fill={fill}
      />
      <path d={`M${pt(cx - w * 0.3, db - h * 0.12)}Q${pt(cx, db - h * 0.2)} ${pt(cx + w * 0.3, db - h * 0.12)}`} fill="none" stroke={gold} strokeWidth={r2(w * 0.02)} />
      <path d={`M${pt(cx, db - h * 0.46)}V${r2(db - h * 0.6)}`} stroke={gold} strokeWidth={r2(w * 0.03)} />
      <circle cx={r2(cx)} cy={r2(db - h * 0.52)} r={r2(w * 0.04)} fill={gold} />
    </g>
  );
}

/** A kalash finial (brass pot, mango leaves, a coconut) on (x, base), s = scale (about 40 tall at 1). */
const Kalash = ({ x, base, s, gold, leaf }: { x: number; base: number; s: number; gold: string; leaf: string }) => (
  <g>
    <path d={`M${pt(x - 12 * s, base)}C${pt(x - 18 * s, base - 14 * s)} ${pt(x - 8 * s, base - 22 * s)} ${pt(x, base - 22 * s)}C${pt(x + 8 * s, base - 22 * s)} ${pt(x + 18 * s, base - 14 * s)} ${pt(x + 12 * s, base)}Z`} fill={gold} />
    <path d={`M${pt(x - 11 * s, base - 22 * s)}Q${pt(x - 4 * s, base - 30 * s)} ${pt(x, base - 24 * s)}Q${pt(x + 4 * s, base - 30 * s)} ${pt(x + 11 * s, base - 22 * s)}Z`} fill={leaf} />
    <ellipse cx={r2(x)} cy={r2(base - 30 * s)} rx={r2(6 * s)} ry={r2(8 * s)} fill={gold} />
  </g>
);

/** The monogram in the script face, debossed (a soft highlight under it). */
function Monogram({ text, cx, cy, width, max, fill, hi, font }: { text: string; cx: number; cy: number; width: number; max: number; fill: string; hi?: string; font: string }) {
  const len = Math.max(1, Array.from(text).length);
  const size = r2(Math.min(max, width / (len * 0.5)));
  const y = r2(cy + size * 0.32);
  return (
    <g style={{ fontFamily: font }}>
      {hi ? (
        <text x={cx} y={r2(y + Math.max(0.8, size * 0.05))} textAnchor="middle" fontSize={size} fill={hi} opacity={0.6}>
          {text}
        </text>
      ) : null}
      <text x={cx} y={y} textAnchor="middle" fontSize={size} fill={fill}>
        {text}
      </text>
    </g>
  );
}

type SealShape = 'lotus' | 'wax' | 'medal' | 'star' | 'badge' | 'foil';

/** A seal carrying the monogram, drawn in a 120-unit design box and fitted to the piece. */
function Seal({ p, shape, monogram, fontFamily }: { p: P; shape: SealShape } & CoverBase) {
  const I = idsOf(p, `seal${shape}`);
  const c = p.colors;
  const full = p.detail === 'full';
  const s = r2(Math.min(p.w, p.h) / 120);
  const wax = shape === 'foil' ? c.secondary : shape === 'wax' ? mix(mix(c.accent, '#8e1b26', 0.62), c.primary, 0.12) : c.accent;
  const light = lum(wax) > 0.55;
  const ink = shape === 'foil' ? shade(c.secondary, 0.5) : light ? shade(c.primary, 0.3) : tint(c.accent, 0.85);
  const hi = light || shape === 'foil' ? tint(wax, 0.65) : shade(wax, 0.45);
  const gold = url(I('g'));
  const cy = shape === 'medal' ? 50 : 60;
  const disc = shape === 'foil' ? 54 : shape === 'medal' ? 38 : shape === 'wax' ? 47 : 42;
  return (
    <Svg w={p.w} h={p.h}>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={120} y2={120} />
        <Lit id={I('w')} base={wax} light={0.34} dark={0.3} />
      </defs>
      <g transform={`translate(${r2(p.w / 2 - 60 * s)} ${r2(p.h / 2 - 60 * s)}) scale(${s})`}>
        {shape === 'medal' ? (
          <g>
            <path d="M47 64L33 118L44 111L51 119L59 70Z" fill={c.primary} />
            <path d="M73 64L87 118L76 111L69 119L61 70Z" fill={shade(c.primary, 0.15)} />
            <path d="M43 80L37 104M77 80L83 104" stroke={c.accent} strokeWidth="2.4" />
            <g transform="translate(60 50)">{turns(24, 15, (a) => <circle key={a} cx="0" cy="-44" r="6.4" fill={gold} transform={`rotate(${a})`} />)}</g>
            <circle cx="60" cy="50" r="44" fill={gold} />
          </g>
        ) : null}
        {shape === 'lotus' ? (
          <g transform="translate(60 60)">
            {turns(16, 22.5, (a) => (
              <path key={a} d="M0 -59C8 -52 10 -44 0 -37C-10 -44 -8 -52 0 -59Z" fill={gold} transform={`rotate(${a})`} />
            ))}
            {full ? turns(16, 22.5, (a) => <path key={a} d="M0 -51C5 -47 6 -42 0 -39C-6 -42 -5 -47 0 -51Z" fill={tint(c.accent, 0.2)} transform={`rotate(${a})`} />, 11.25) : null}
          </g>
        ) : null}
        {shape === 'star' ? <path d={octagram(60, 60, 58)} fill={gold} stroke={shade(c.secondary, 0.3)} strokeWidth="1.2" /> : null}
        {shape === 'badge' ? (
          <g transform="translate(60 60)">
            {turns(24, 15, (a, i) => (
              <path key={a} d="M-7 -40L0 -59L7 -40Z" fill={i % 2 ? c.primary : c.secondary} transform={`rotate(${a})`} />
            ))}
          </g>
        ) : null}
        {shape === 'wax' ? (
          <g transform="translate(60 60)">
            {turns(12, 30, (a, i) => (
              <circle key={a} cx="0" cy="-45" r={r2(9 + rand(i, 7) * 5)} fill={shade(wax, 0.08)} transform={`rotate(${r2(a + rand(i, 3) * 12)})`} />
            ))}
          </g>
        ) : null}
        <circle cx="60" cy={cy} r={disc} fill={shape === 'foil' ? gold : url(I('w'))} stroke={shape === 'wax' ? 'none' : gold} strokeWidth="3" />
        {shape === 'wax' ? <circle cx="60" cy="60" r="36" fill="none" stroke={shade(wax, 0.28)} strokeWidth="2.6" /> : null}
        {shape === 'foil' || shape === 'medal' ? (
          <g transform={`translate(60 ${cy})`}>
            {turns(18, 20, (a) => (
              <ellipse key={a} cx="0" cy={shape === 'foil' ? -45 : -31} rx="5.6" ry="2.2" fill={shape === 'foil' ? shade(c.secondary, 0.3) : gold} transform={`rotate(${r2(a + 10)})`} />
            ))}
          </g>
        ) : full ? (
          <circle cx="60" cy={cy} r={shape === 'wax' ? 41 : 36} fill="none" stroke={shape === 'wax' ? tint(wax, 0.35) : gold} strokeWidth="2.2" strokeDasharray="0.1 5.6" strokeLinecap="round" />
        ) : null}
        <Monogram text={monogram} cx={60} cy={cy} width={shape === 'medal' ? 50 : 62} max={shape === 'medal' ? 28 : 34} fill={ink} hi={hi} font={fontFamily ?? SCRIPT} />
        <path d={`M${pt(60 - disc * 0.7, cy - disc * 0.45)}A${disc} ${disc} 0 0 1 ${pt(60 + disc * 0.1, cy - disc * 0.86)}`} fill="none" stroke={tint(wax, 0.75)} strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      </g>
    </Svg>
  );
}

// ─────────────────────────── Gate (arrival): frames ───────────────────────────

/** Palace: a Rajput cusped gateway in rose-tinted marble, jaali tympanum, inlaid spandrels, chhatri pylons. */
function PalaceFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const stone = mix(c.primary, '#f3e6d2', 0.8);
  const deep = shade(stone, 0.26);
  const inlay = mix(c.accent, c.primary, 0.45);
  const gold = url(I('g'));
  const edge = archPoints(222, 778, 300, 84, 6);
  const hole = `M222 800L${poly(edge).slice(1)}L778 800Z`;
  const body = 'M0 172H190V58H810V172H1000V800H0Z';
  const pylon = (
    <g>
      <rect x="22" y="190" width="146" height="590" fill="none" stroke={gold} strokeWidth="1.6" />
      <path d={arch(58, 132, 262, 224, 300, 3)} fill={deep} />
      {full ? <path d={arch(58, 132, 262, 224, 300, 3)} fill={url(I('jj'))} /> : null}
      <rect x="46" y="300" width="98" height="8" fill={deep} />
      {[62, 95, 128].map((x) => (
        <path key={x} d={`M${x - 6} 308H${x + 6}L${x} 324Z`} fill={stone} stroke={deep} strokeWidth="1" />
      ))}
      <path d={arch(46, 144, 430, 366, 650, 3)} fill={deep} />
      <path d={arch(46, 144, 430, 366, 650, 3)} fill="none" stroke={gold} strokeWidth="2" />
      <ellipse cx="95" cy="628" rx="40" ry="34" fill={url(I('glow'))} />
      <path d="M84 640Q95 648 106 640L102 634H88Z" fill={n.clay} />
      <path d="M95 616C100 623 100 630 95 633C90 630 90 623 95 616Z" fill={n.flame} />
      <rect x="22" y="680" width="146" height="10" fill={deep} />
      <rect x="0" y="760" width="190" height="40" fill={shade(stone, 0.12)} />
      <Kiosk cx={95} base={172} w={150} fill={stone} deep={deep} gold={gold} />
    </g>
  );
  const spandrel = (
    <g>
      <circle cx="296" cy="150" r="27" fill="none" stroke={gold} strokeWidth="1.6" />
      <g transform="translate(296 150)">
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -22C6 -16 6 -9 0 -5C-6 -9 -6 -16 0 -22Z" fill={inlay} transform={`rotate(${a})`} />
        ))}
      </g>
      <circle cx="296" cy="150" r="5" fill={gold} />
      <path d="M272 168C250 190 238 220 236 262M318 132C350 112 384 102 420 96" fill="none" stroke={gold} strokeWidth="1.4" />
      {full ? turns(3, 1, (_a, i) => <path key={i} d={`M${244 - i * 3} ${206 + i * 24}q-12 -4 -16 -14q12 2 16 14Z`} fill={n.leaf} opacity="0.8" />) : null}
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={260} />
        <Jaali id={I('j')} color={stone} s={26} />
        <Jaali id={I('jj')} color={tint(stone, 0.1)} s={10} width={1.6} />
        <radialGradient id={I('glow')}>
          <stop offset="0" stopColor={n.flameCore} stopOpacity="0.9" />
          <stop offset="1" stopColor={n.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={`${body} ${hole}`} fill={stone} fillRule="evenodd" />
      <path d={cutAbove(edge, 176)} fill={url(I('j'))} />
      <Lighting p={p} I={I} d={`${body} ${hole}`} />
      <Twin id={I('twpylon')} w={1000}>
        {pylon}
      </Twin>
      <rect x="200" y="68" width="600" height="732" fill="none" stroke={gold} strokeWidth="3" />
      <rect x="213" y="81" width="574" height="719" fill="none" stroke={gold} strokeWidth="1.2" />
      <rect x="206.5" y="74.5" width="587" height="725" fill="none" stroke={inlay} strokeWidth="3.4" strokeDasharray="0.1 11" strokeLinecap="round" />
      <path d={poly(archPoints(206, 794, 300, 66))} fill="none" stroke={gold} strokeWidth="2.4" />
      <path d={poly(edge)} fill="none" stroke={gold} strokeWidth="3.6" />
      <Twin id={I('twspandrel')} w={1000}>
        {spandrel}
      </Twin>
      <rect x="222" y="166" width="556" height="24" fill={stone} />
      <path d="M222 167H778M222 189H778" stroke={gold} strokeWidth="2" />
      {full ? <path d="M232 178H768" stroke={deep} strokeWidth="5" strokeDasharray="0.1 14" strokeLinecap="round" /> : null}
      <g transform="translate(500 178)">
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -16C4 -12 4 -7 0 -4C-4 -7 -4 -12 0 -16Z" fill={gold} transform={`rotate(${a})`} />
        ))}
        <circle r="4" fill={inlay} />
      </g>
      {[206, 778].map((x) => (
        <g key={x}>
          <rect x={x} y="300" width="16" height="500" fill={deep} opacity="0.35" />
          <rect x={x - 3} y="292" width="22" height="10" fill={gold} />
        </g>
      ))}
      <path
        d={Array.from({ length: 18 }, (_, i) => {
          const x = r2(192 + i * 34.4);
          return `M${x} 60V46Q${r2(x + 14)} 24 ${r2(x + 28)} 46V60Z`;
        }).join('')}
        fill={stone}
        stroke={deep}
        strokeWidth="1"
      />
      <Kalash x={500} base={52} s={1.2} gold={gold} leaf={n.leaf} />
    </>
  );
}

/** Garden: a Mughal gateway in red sandstone with white marble inlay, guldasta turrets, a row of chhatris, a girih jaali. */
function GardenFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const sand = mix(c.primary, '#a9573a', 0.72);
  const deep = shade(sand, 0.28);
  const marble = mix(c.background, '#ffffff', 0.55);
  const inlay = mix(c.accent, c.secondary, 0.35);
  const gold = url(I('g'));
  const edge = archPoints(226, 774, 330, 112, 0, 0.44);
  const hole = `M226 800L${poly(edge).slice(1)}L774 800Z`;
  const [lx, rx] = spanAt(edge, 166);
  const body = 'M0 236H122V44H878V236H1000V800H0Z';
  const wing = (
    <g>
      <path d={arch(20, 104, 340, 292, 480)} fill={deep} stroke={marble} strokeWidth="2.4" />
      <path d={arch(20, 104, 580, 534, 720)} fill={deep} stroke={marble} strokeWidth="2.4" />
      <rect x="8" y="236" width="108" height="564" fill="none" stroke={marble} strokeWidth="2" />
      <rect x="116" y="26" width="30" height="774" fill={sand} />
      <path d="M124 40V800M138 40V800" stroke={marble} strokeWidth="1.4" />
      {[180, 360, 540, 720].map((y) => (
        <rect key={y} x="112" y={y} width="38" height="7" fill={marble} />
      ))}
      <path d="M112 30C112 12 124 6 131 0C138 6 150 12 150 30Z" fill={marble} />
    </g>
  );
  const spandrel = (
    <g>
      <path d={octagram(296, 176, 30)} fill={marble} fillRule="nonzero" />
      <path d={octagram(296, 176, 18)} fill={inlay} />
      <circle cx="296" cy="176" r="6" fill={deep} />
      <path d="M262 206C246 236 240 270 238 318M330 150C362 130 400 122 440 118" fill="none" stroke={marble} strokeWidth="2.4" strokeLinecap="round" />
      {full ? <path d="M254 232q-14 -2 -20 -12q14 0 20 12ZM360 136q-6 -12 -2 -22q8 10 2 22Z" fill={n.leaf} /> : null}
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={260} />
        <Girih id={I('j')} color={marble} s={34} width={3.4} />
      </defs>
      <path d={`${body} ${hole}`} fill={sand} fillRule="evenodd" />
      <path d={cutAbove(edge, 176)} fill={url(I('j'))} />
      <Lighting p={p} I={I} d={`${body} ${hole}`} />
      <Twin id={I('twwing')} w={1000}>
        {wing}
      </Twin>
      <rect x="174" y="86" width="652" height="714" fill="none" stroke={marble} strokeWidth="14" />
      {full ? <rect x="174" y="86" width="652" height="714" fill="none" stroke={deep} strokeWidth="5" strokeDasharray="8 10" /> : null}
      <rect x="190" y="102" width="620" height="698" fill="none" stroke={gold} strokeWidth="1.4" />
      <path d={poly(archPoints(208, 792, 330, 92, 0, 0.44))} fill="none" stroke={marble} strokeWidth="11" />
      <path d={poly(archPoints(208, 792, 330, 92, 0, 0.44))} fill="none" stroke={inlay} strokeWidth="2" strokeDasharray="10 6" />
      <path d={poly(edge)} fill="none" stroke={marble} strokeWidth="3.4" />
      <Twin id={I('twspandrel')} w={1000}>
        {spandrel}
      </Twin>
      <rect x={r2(lx - 8)} y="166" width={r2(rx - lx + 16)} height="26" fill={marble} />
      <path d={`M${lx} 179${Array.from({ length: Math.max(2, Math.floor((rx - lx) / 24)) }, (_, i) => `L${r2(lx + 12 + i * 24)} ${i % 2 ? 170 : 188}`).join('')}L${rx} 179`} fill="none" stroke={inlay} strokeWidth="2.4" />
      <rect x="146" y="40" width="708" height="12" fill={marble} />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 212 + i * 96;
        return (
          <g key={x}>
            <rect x={x - 22} y="22" width="44" height="18" fill={sand} stroke={marble} strokeWidth="1.2" />
            <path d={`M${x - 20} 24C${x - 22} 10 ${x - 8} 4 ${x} 0C${x + 8} 4 ${x + 22} 10 ${x + 20} 24Z`} fill={marble} />
          </g>
        );
      })}
      <circle cx="500" cy="18" r="3" fill={gold} />
    </>
  );
}

/** Torana: a carved stone torana, its pillars banded, a cusped makara arch, an architrave with scrolled ends, bells and a kalash. */
function ToranaFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const stone = mix(c.primary, '#cfbb98', 0.8);
  const deep = shade(stone, 0.26);
  const lite = tint(stone, 0.22);
  const gold = url(I('g'));
  const pillar = (
    <g>
      <path d="M146 800V764H154V728H246V764H254V800Z" fill={stone} />
      <rect x="168" y="208" width="64" height="520" fill={stone} />
      <path d="M184 222V720M200 222V720M216 222V720" stroke={deep} strokeWidth="2" opacity="0.45" />
      {[300, 410, 520, 630].map((y) => (
        <g key={y}>
          <rect x="163" y={y} width="74" height="16" fill={deep} />
          {full ? <path d={`M168 ${y + 8}H234`} stroke={lite} strokeWidth="5" strokeDasharray="0.1 8" strokeLinecap="round" /> : null}
        </g>
      ))}
      <path d="M152 208H248L258 190H142Z" fill={stone} />
      <ellipse cx="200" cy="216" rx="40" ry="9" fill={deep} />
      <path d="M232 380C258 372 268 352 262 330" fill="none" stroke={deep} strokeWidth="3" />
      <circle cx="120" cy="60" r="26" fill={stone} stroke={deep} strokeWidth="2" />
      <path d="M120 60m-15 0a15 15 0 1 1 15 15a9 9 0 1 1 -9 -9" fill="none" stroke={deep} strokeWidth="2.4" />
      <Kalash x={200} base={40} s={0.8} gold={gold} leaf={n.leaf} />
    </g>
  );
  const outer = archPoints(232, 768, 392, 192, 0, 0.5);
  const inner = archPoints(254, 746, 392, 222, 6, 0.5);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={200} />
      </defs>
      <Twin id={I('twpillar')} w={1000}>
        {pillar}
      </Twin>
      <path d={`${poly(outer)}Z ${poly(inner)}Z`} fill={stone} fillRule="evenodd" />
      <path d={poly(inner)} fill="none" stroke={deep} strokeWidth="2.4" />
      {full ? <path d={poly(archPoints(243, 757, 392, 207, 0, 0.5))} fill="none" stroke={lite} strokeWidth="4" strokeDasharray="0.1 12" strokeLinecap="round" /> : null}
      <rect x="132" y="150" width="736" height="38" fill={stone} />
      <path d="M132 152H868M132 186H868" stroke={deep} strokeWidth="2" />
      {full ? <path d="M140 169H860" stroke={deep} strokeWidth="7" strokeDasharray="7 9" /> : null}
      <rect x="104" y="40" width="792" height="40" fill={stone} />
      <path d="M104 44H896M104 76H896" stroke={deep} strokeWidth="2" />
      {[320, 500, 680].map((x) => (
        <g key={x}>
          <rect x={x - 12} y="80" width="24" height="70" fill={stone} />
          <rect x={x - 16} y="80" width="32" height="8" fill={deep} />
        </g>
      ))}
      {[230, 410, 590, 770].map((x) =>
        [-40, 40].map((dx) => <path key={x + dx} d={arch(x + dx - 18, x + dx + 18, 128, 98, 146, 2)} fill={deep} opacity="0.8" />),
      )}
      <circle cx="500" cy="115" r="17" fill={lite} stroke={deep} strokeWidth="2" />
      <g transform="translate(500 115)">
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -14C4 -10 4 -5 0 -2C-4 -5 -4 -10 0 -14Z" fill={deep} transform={`rotate(${a})`} />
        ))}
      </g>
      {[290, 410, 590, 710].map((x) => (
        <g key={x}>
          <path d={`M${x} 188V206`} stroke={gold} strokeWidth="1.6" strokeDasharray="3 2" />
          <path d={bellPath(x, 205, 1)} fill={gold} />
          <circle cx={x} cy="226" r="2.6" fill={shade(c.secondary, 0.35)} />
        </g>
      ))}
      <Kalash x={500} base={40} s={1.1} gold={gold} leaf={n.leaf} />
      <Lighting p={p} I={I} d="M104 40H896V80H104Z M132 150H868V188H132Z" rim={false} />
    </>
  );
}

/** Tent flap: the big top's striped entrance, a pennant valance with tassels, gilt poles with flags, a star. */
function TentFrame({ p, I }: Art) {
  const c = p.colors;
  const full = p.detail === 'full';
  const cream = mix(c.background, c.accent, 0.35);
  const gold = url(I('g'));
  const walls = 'M0 152Q100 124 200 152V800H0Z M800 152Q900 124 1000 152V800H800Z';
  const facade = 'M192 214V140Q500 18 808 140V214Z';
  const points = Array.from({ length: 13 }, (_, i) => r2(200 + i * 50));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={120} />
        <pattern id={I('st')} width="48" height="10" patternUnits="userSpaceOnUse">
          <rect width="48" height="10" fill={cream} />
          <rect width="24" height="10" fill={c.primary} />
        </pattern>
        <linearGradient id={I('fold')} x1="0" y1="0" x2="0.25" y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
          <stop offset="0.5" stopColor={shade(c.text, 0.5)} stopOpacity="0.14" />
          <stop offset="1" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={walls} fill={url(I('st'))} />
      <path d={walls} fill={url(I('fold'))} />
      <path d={facade} fill={url(I('st'))} />
      <Lighting p={p} I={I} d={`${walls} ${facade}`} />
      <path d="M0 152Q100 124 200 152M800 152Q900 124 1000 152M192 140Q500 18 808 140" fill="none" stroke={gold} strokeWidth="4" />
      <path d={`M196 170H804V194${points
        .slice(1)
        .reverse()
        .map((x) => `L${r2(x + 25)} 226L${x - 50 < 200 ? 196 : x - 50} 194`)
        .join('')}Z`} fill={c.accent} />
      <path d="M196 170H804V194H196Z" fill={shade(c.primary, 0.1)} />
      <path d="M196 171H804M196 194H804" stroke={gold} strokeWidth="2.4" />
      {points.slice(0, 12).map((x) => (
        <g key={x}>
          <path d={`M${r2(x + 25)} 226V238`} stroke={gold} strokeWidth="1.6" />
          <path d={`M${r2(x + 21)} 238H${r2(x + 29)}L${r2(x + 27)} 250H${r2(x + 23)}Z`} fill={gold} />
        </g>
      ))}
      {[192, 792].map((x, k) => (
        <g key={x}>
          <rect x={x} y="34" width="16" height="766" fill={gold} />
          <circle cx={x + 8} cy="28" r="11" fill={gold} />
          <path d={k ? `M${x} 40Q${x - 30} 34 ${x - 62} 50Q${x - 30} 58 ${x} 66Z` : `M${x + 16} 40Q${x + 46} 34 ${x + 78} 50Q${x + 46} 58 ${x + 16} 66Z`} fill={k ? c.secondary : c.accent} />
        </g>
      ))}
      <path d="M208 62Q354 128 500 72Q646 128 792 62" fill="none" stroke={gold} strokeWidth="3" />
      <circle cx="500" cy="98" r="38" fill={c.primary} stroke={gold} strokeWidth="3" />
      <path d={star5(500, 100, 28)} fill={gold} />
      {full ? <circle cx="500" cy="98" r="31" fill="none" stroke={cream} strokeWidth="2" strokeDasharray="0.1 7" strokeLinecap="round" /> : null}
    </>
  );
}

/** Lane: an arched bamboo gate lashed with rope, a marigold garland, paper lanterns aglow, bunting. */
function LaneFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const bamboo = mix(c.primary, '#c9a45c', 0.8);
  const knot = shade(bamboo, 0.32);
  const rope = mix(c.accent, '#a8835a', 0.45);
  const arc: Segment = [
    [202, 170],
    [202, 30],
    [798, 30],
    [798, 170],
  ];
  const arcD = 'M202 170C202 30 798 30 798 170';
  const shell = [c.accent, c.secondary, tint(c.primary, 0.35), c.secondary, c.accent];
  return (
    <>
      <defs>
        <radialGradient id={I('glow')}>
          <stop offset="0" stopColor={n.flameCore} stopOpacity="0.85" />
          <stop offset="0.45" stopColor={n.flame} stopOpacity="0.35" />
          <stop offset="1" stopColor={n.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M202 800V170C202 30 798 30 798 170V800" fill="none" stroke={bamboo} strokeWidth="22" />
      <path d="M202 800V170C202 30 798 30 798 170V800" fill="none" stroke={knot} strokeWidth="23" strokeDasharray="3 66" />
      <path d="M196 800V170C196 40 804 40 804 170V800" fill="none" stroke={tint(bamboo, 0.35)} strokeWidth="3" opacity="0.7" />
      <path d="M208 800V170C208 22 792 22 792 170V800" fill="none" stroke={p.light.rim} strokeWidth="2" opacity="0.6" />
      <path d="M140 176H860" stroke={bamboo} strokeWidth="16" />
      <path d="M140 176H860" stroke={knot} strokeWidth="17" strokeDasharray="3 58" />
      {[202, 798].map((x) => (
        <path key={x} d={`M${x - 16} 160L${x + 16} 192M${x + 16} 160L${x - 16} 192M${x - 14} 166H${x + 14}M${x - 14} 186H${x + 14}`} stroke={rope} strokeWidth="3.4" />
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const x = 226 + i * 40;
        return <path key={x} d={`M${x} 184L${x + 34} 184L${x + 17} 214Z`} fill={shell[i % 5]} opacity="0.95" />;
      })}
      <path d={arcD} fill="none" stroke={n.leaf} strokeWidth="8" strokeDasharray="0.1 30" strokeLinecap="round" />
      <path d={arcD} fill="none" stroke={n.flame} strokeWidth="13" strokeDasharray="0.1 15" strokeLinecap="round" />
      <path d={arcD} fill="none" stroke={mix(n.flame, n.clay, 0.45)} strokeWidth="9" strokeDasharray="0.1 15" strokeDashoffset="7.5" strokeLinecap="round" />
      {[0.12, 0.3, 0.5, 0.7, 0.88].map((t, i) => {
        const q = onCubic(arc, t);
        const x = r2(q.x);
        const top = r2(q.y + 6);
        const drop = i === 2 ? 46 : 30;
        const cy = r2(top + drop + 22);
        const tone = shell[i] ?? c.accent;
        return (
          <g key={t}>
            <path d={`M${x} ${top}V${r2(top + drop)}`} stroke={rope} strokeWidth="1.6" />
            {full ? <circle cx={x} cy={cy} r="46" fill={url(I('glow'))} /> : null}
            <ellipse cx={x} cy={cy} rx="18" ry="22" fill={tone} />
            <ellipse cx={x} cy={cy} rx="9" ry="22" fill="none" stroke={shade(tone, 0.25)} strokeWidth="1.4" />
            <path d={`M${x} ${r2(cy - 22)}V${r2(cy + 22)}`} stroke={shade(tone, 0.25)} strokeWidth="1.2" />
            <ellipse cx={r2(x - 5)} cy={r2(cy - 6)} rx="5" ry="9" fill={n.flameCore} opacity="0.55" />
            <rect x={r2(x - 7)} y={r2(cy - 26)} width="14" height="5" fill={knot} />
            <rect x={r2(x - 7)} y={r2(cy + 21)} width="14" height="5" fill={knot} />
            <path d={`M${x} ${r2(cy + 26)}V${r2(cy + 44)}`} stroke={c.primary} strokeWidth="3" />
          </g>
        );
      })}
    </>
  );
}

/** Haveli: a frescoed haveli facade, a carved lintel on brackets, a jharokha with a bangaldar roof, lit windows. */
function HaveliFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const plaster = mix(c.primary, '#e8cc9c', 0.74);
  const deep = shade(plaster, 0.28);
  const fresco = mix(c.primary, plaster, 0.12);
  const gold = url(I('g'));
  const body = 'M0 124H1000V800H0Z M200 800V192H800V800Z';
  const wing = (
    <g>
      <path d={arch(60, 150, 304, 262, 392, 3)} fill={url(I('lit'))} />
      {full ? <path d={arch(60, 150, 304, 262, 392, 3)} fill={url(I('j'))} /> : null}
      <path d={arch(60, 150, 304, 262, 392, 3)} fill="none" stroke={fresco} strokeWidth="4" />
      <rect x="50" y="392" width="110" height="9" fill={deep} />
      {[66, 105, 144].map((x) => (
        <path key={x} d={`M${x - 7} 401H${x + 7}L${x} 418Z`} fill={plaster} stroke={deep} strokeWidth="1" />
      ))}
      <circle cx="105" cy="560" r="42" fill="none" stroke={fresco} strokeWidth="4" />
      <g transform="translate(105 560)">
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -34C9 -24 9 -12 0 -6C-9 -12 -9 -24 0 -34Z" fill={a % 90 ? c.accent : fresco} transform={`rotate(${a})`} />
        ))}
        {full ? turns(8, 45, (a) => <path key={a} d="M0 -40q6 -6 12 -2q-6 6 -12 2Z" fill={n.leaf} transform={`rotate(${a})`} />, 22.5) : null}
      </g>
      <rect x="0" y="740" width="200" height="60" fill={shade(plaster, 0.1)} />
      <path d="M170 800V162" stroke={fresco} strokeWidth="26" />
      <path d="M170 800V162" stroke={c.accent} strokeWidth="5" strokeDasharray="0.1 16" strokeLinecap="round" />
      <path d="M200 192H244C232 204 220 222 214 248H200Z" fill={plaster} stroke={deep} strokeWidth="1.6" />
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={200} />
        <Jaali id={I('j')} color={plaster} s={12} width={1.8} />
        <linearGradient id={I('lit')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(p.light.color, c.accent, 0.3)} />
          <stop offset="1" stopColor={mix(n.flame, c.primary, 0.35)} />
        </linearGradient>
      </defs>
      <path d={body} fill={plaster} fillRule="evenodd" />
      <Lighting p={p} I={I} d={body} />
      <Twin id={I('twwing')} w={1000}>
        {wing}
      </Twin>
      <path d="M170 162H830" stroke={fresco} strokeWidth="26" />
      <path d="M170 162H830" stroke={c.accent} strokeWidth="5" strokeDasharray="0.1 16" strokeLinecap="round" />
      <rect x="200" y="172" width="600" height="22" fill={plaster} />
      <path d="M200 173H800M200 193H800" stroke={deep} strokeWidth="1.6" />
      {full ? <path d="M208 183H792" stroke={deep} strokeWidth="4" strokeDasharray="0.1 10" strokeLinecap="round" /> : null}
      <rect x="0" y="110" width="1000" height="16" fill={deep} />
      <path d={Array.from({ length: 20 }, (_, i) => `M${15 + i * 50} 110V100Q${25 + i * 50} 84 ${35 + i * 50} 100V110Z`).join('')} fill={plaster} />
      <rect x="380" y="150" width="240" height="10" fill={deep} />
      {[402, 466, 534, 598].map((x) => (
        <path key={x} d={`M${x - 8} 160H${x + 8}L${x} 176Z`} fill={plaster} stroke={deep} strokeWidth="1" />
      ))}
      <rect x="394" y="84" width="212" height="66" fill={plaster} />
      {[404, 471, 538].map((x) => (
        <g key={x}>
          <path d={arch(x, x + 58, 118, 96, 150, 3)} fill={url(I('lit'))} />
          {full ? <path d={arch(x, x + 58, 118, 96, 150, 3)} fill={url(I('j'))} /> : null}
          <path d={arch(x, x + 58, 118, 96, 150, 3)} fill="none" stroke={fresco} strokeWidth="2.4" />
        </g>
      ))}
      <path d="M370 86Q500 18 630 86L618 96Q500 38 382 96Z" fill={fresco} />
      <path d="M370 86Q500 18 630 86" fill="none" stroke={gold} strokeWidth="2.4" />
      {[372, 500, 628].map((x) => (
        <circle key={x} cx={x} cy={x === 500 ? 46 : 84} r="4" fill={gold} />
      ))}
    </>
  );
}

/** Ghat: a sandstone river gate between chhatri piers, a carved sunburst tympanum, marigold swags, diyas on the steps, the river. */
function GhatFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const sand = mix(c.primary, '#ddb98b', 0.78);
  const deep = shade(sand, 0.26);
  const lite = tint(sand, 0.24);
  const water = mix(c.primary, '#4d8aa6', 0.55);
  const saffron = mix(c.secondary, '#f08a1c', 0.5);
  const gold = url(I('g'));
  const edge = archPoints(222, 778, 300, 92, 6, 0.6);
  const body = `M0 800V160H40V40H960V160H1000V800Z M222 800L${poly(edge).slice(1)}L778 800Z`;
  const pier = (
    <g>
      <path d={arch(76, 164, 340, 286, 560, 3)} fill={deep} />
      <path d={arch(76, 164, 340, 286, 560, 3)} fill="none" stroke={lite} strokeWidth="2" />
      <rect x="40" y="590" width="160" height="10" fill={deep} />
      <rect x="40" y="250" width="160" height="8" fill={deep} />
      <Kiosk cx={120} base={160} w={150} fill={sand} deep={deep} gold={gold} />
      <path d="M120 30V8" stroke={deep} strokeWidth="2" />
      <path d="M121 8Q140 10 156 18Q140 24 121 26Z" fill={saffron} />
    </g>
  );
  const swag = 'M222 198Q361 270 500 204Q639 270 778 198';
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={200} />
        <radialGradient id={I('glow')}>
          <stop offset="0" stopColor={n.flameCore} stopOpacity="0.9" />
          <stop offset="1" stopColor={n.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={body} fill={sand} fillRule="evenodd" />
      <path d={cutAbove(edge, 172)} fill={shade(sand, 0.08)} />
      <g>
        {turns(11, 15, (a) => (
          <path key={a} d="M0 -12V-96" stroke={deep} strokeWidth="3" transform={`translate(500 172) rotate(${r2(a - 75)})`} />
        ))}
      </g>
      <circle cx="500" cy="172" r="24" fill={lite} stroke={deep} strokeWidth="2" />
      <Lighting p={p} I={I} d={body} />
      <path d={poly(archPoints(204, 796, 300, 70, 0, 0.6))} fill="none" stroke={lite} strokeWidth="10" />
      <path d={poly(archPoints(204, 796, 300, 70, 0, 0.6))} fill="none" stroke={deep} strokeWidth="1.6" />
      <path d={poly(edge)} fill="none" stroke={lite} strokeWidth="6" />
      <path d={poly(edge)} fill="none" stroke={deep} strokeWidth="2.4" />
      <Twin id={I('twpier')} w={1000}>
        {pier}
      </Twin>
      <path
        d={Array.from({ length: 22 }, (_, i) => {
          const x = r2(222 + i * 25.4);
          return `M${x} 40V30Q${r2(x + 10)} 16 ${r2(x + 20)} 30V40Z`;
        }).join('')}
        fill={sand}
      />
      <rect x="40" y="40" width="920" height="10" fill={deep} />
      <rect x="222" y="166" width="556" height="20" fill={shade(c.secondary, 0.35)} />
      <path d="M222 168H778" stroke={gold} strokeWidth="2.4" />
      <path d={swag} fill="none" stroke={n.leaf} strokeWidth="7" strokeDasharray="0.1 26" strokeLinecap="round" />
      <path d={swag} fill="none" stroke={n.flame} strokeWidth="14" strokeDasharray="0.1 15" strokeLinecap="round" />
      <path d={swag} fill="none" stroke={mix(n.flame, n.clay, 0.5)} strokeWidth="9" strokeDasharray="0.1 15" strokeDashoffset="7.5" strokeLinecap="round" />
      {[222, 500, 778].map((x) => (
        <g key={x}>
          <path d={`M${x} 204V222`} stroke={gold} strokeWidth="1.4" />
          <path d={bellPath(x, 220, 1.2)} fill={gold} />
        </g>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <g key={i}>
          <rect x="0" y={696 + i * 21} width="1000" height="21" fill={i % 2 ? deep : sand} />
          <path d={`M0 ${696 + i * 21}H1000`} stroke={lite} strokeWidth="2" />
        </g>
      ))}
      <rect x="0" y="752" width="1000" height="48" fill={water} opacity="0.88" />
      {full ? <path d="M30 770H220M300 784H520M610 768H880M120 792H360" stroke={tint(water, 0.4)} strokeWidth="2" strokeDasharray="22 10" /> : null}
      {[120, 270, 730, 880].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="690" rx="34" ry="28" fill={url(I('glow'))} />
          <path d={`M${x - 10} 696Q${x} 704 ${x + 10} 696L${x + 7} 690H${x - 7}Z`} fill={n.clay} />
          <path d={`M${x} 674C${x + 4} 680 ${x + 4} 686 ${x} 689C${x - 4} 686 ${x - 4} 680 ${x} 674Z`} fill={n.flame} />
        </g>
      ))}
    </>
  );
}

/** Campus: brick gate piers with stone caps and lanterns, a wrought-iron overthrow, a crest (a shield, a book, a laurel: no institution's arms). */
function CampusFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const brick = mix(c.primary, '#8e4b36', 0.72);
  const mortar = mix(c.background, '#d8cfc0', 0.45);
  const stone = mix(c.background, '#cfc6b4', 0.55);
  const iron = mix(c.primary, '#2a2e36', 0.7);
  const gold = url(I('g'));
  const branch: Segment = [
    [-8, 44],
    [-46, 40],
    [-58, 2],
    [-40, -36],
  ];
  const pier = (
    <g>
      <rect x="112" y="176" width="116" height="624" fill={url(I('br'))} />
      <rect x="134" y="300" width="72" height="200" fill={stone} stroke={shade(stone, 0.2)} strokeWidth="2" />
      <path d="M100 178H240V160H100Z" fill={stone} />
      <path d="M108 160L170 134L232 160Z" fill={shade(stone, 0.12)} />
      <rect x="104" y="740" width="132" height="60" fill={stone} />
      <rect x="0" y="600" width="112" height="200" fill={url(I('br'))} />
      <rect x="0" y="592" width="112" height="10" fill={stone} />
      {full ? <path d="M8 592V520M24 592V520M40 592V520M56 592V520M72 592V520M88 592V520M104 592V520M0 524H112" stroke={iron} strokeWidth="3" /> : null}
      <path d="M170 134V120" stroke={iron} strokeWidth="5" />
      <path d="M150 80H190L184 120H156Z" fill={url(I('lamp'))} stroke={iron} strokeWidth="3" />
      <path d="M170 80V120" stroke={iron} strokeWidth="2" />
      <path d="M142 80L170 60L198 80Z" fill={iron} />
      <circle cx="170" cy="56" r="4" fill={gold} />
    </g>
  );
  const bars = Array.from({ length: 23 }, (_, i) => 236 + i * 24);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={1000} y2={160} />
        <pattern id={I('br')} width="32" height="16" patternUnits="userSpaceOnUse">
          <rect width="32" height="16" fill={mortar} />
          <rect x="1" y="1" width="30" height="6.5" fill={brick} />
          <rect x="-15" y="9" width="30" height="6" fill={shade(brick, 0.06)} />
          <rect x="17" y="9" width="30" height="6" fill={shade(brick, 0.06)} />
        </pattern>
        <linearGradient id={I('lamp')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={n.flameCore} />
          <stop offset="1" stopColor={n.flame} />
        </linearGradient>
      </defs>
      <Twin id={I('twpier')} w={1000}>
        {pier}
      </Twin>
      <Lighting p={p} I={I} d="M112 176H228V800H112Z M772 176H888V800H772Z" />
      <path d={`${bars.map((x) => `M${x} ${qY(x, 228, 772, 186, 30)}V180`).join('')}M228 186Q500 30 772 186M228 180H772M228 164H772`} fill="none" stroke={p.light.rim} strokeWidth="9" opacity="0.3" />
      {bars.map((x) => (
        <path key={x} d={`M${x} ${qY(x, 228, 772, 186, 30)}V180`} stroke={iron} strokeWidth="3.4" />
      ))}
      <path d="M228 186Q500 30 772 186" fill="none" stroke={iron} strokeWidth="7" />
      <path d="M228 186Q500 62 772 186" fill="none" stroke={iron} strokeWidth="3" />
      <path d="M228 180H772M228 164H772" stroke={iron} strokeWidth="6" />
      {[300, 380, 620, 700].map((x, i) => (
        <path key={x} d={i < 2 ? `M${x} 164C${x - 4} 140 ${x + 24} 132 ${x + 30} 150C${x + 32} 160 ${x + 18} 164 ${x + 14} 154` : `M${x} 164C${x + 4} 140 ${x - 24} 132 ${x - 30} 150C${x - 32} 160 ${x - 18} 164 ${x - 14} 154`} fill="none" stroke={iron} strokeWidth="3" />
      ))}
      <g transform="translate(500 104)">
        {[1, -1].map((s) => (
          <g key={s} transform={`scale(${s} 1)`}>
            {Array.from({ length: 8 }, (_, i) => {
              const q = onCubic(branch, (i + 0.5) / 8);
              return <ellipse key={i} cx="0" cy="-5" rx="3.6" ry="8" fill={gold} transform={frameAt(q)} />;
            })}
          </g>
        ))}
        <path d="M-30 -38H30V-4C30 20 14 34 0 42C-14 34 -30 20 -30 -4Z" fill={c.primary} stroke={gold} strokeWidth="3.4" />
        <path d="M-30 4L0 -16L30 4V14L0 -6L-30 14Z" fill={gold} />
        <path d="M-16 20Q-8 16 0 20Q8 16 16 20V30Q8 26 0 30Q-8 26 -16 30Z" fill={c.background} />
        <path d={star5(-13, -26, 6)} fill={gold} />
        <path d={star5(13, -26, 6)} fill={gold} />
        <path d="M-46 46H46L39 54L46 62H-46L-39 54Z" fill={c.accent} stroke={gold} strokeWidth="1.4" />
      </g>
    </>
  );
}

const GATE_FRAMES: Record<GateStyle, (a: Art) => ReactNode> = {
  palace: PalaceFrame,
  garden: GardenFrame,
  torana: ToranaFrame,
  tentFlap: TentFrame,
  lane: LaneFrame,
  haveli: HaveliFrame,
  ghat: GhatFrame,
  campus: CampusFrame,
};

// ─────────────────────────── Gate (arrival): leaves ───────────────────────────
// Each leaf is drawn as the left one (hinge at x 0, the meeting edge at x 300);
// GateCover mirrors it for the right.

const LEAF = 'M0 0H300V620H0Z';

/** Palace leaf: maroon lacquer framed in brass, a mirror-work rosette, a lattice of mirrors with bosses, the meeting stile studded. */
function PalaceLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const lac = mix(c.primary, '#24050d', 0.14);
  const lacLite = tint(lac, 0.1);
  const glass = mix(c.background, '#dfe7ef', 0.5);
  const spark = tint(c.background, 0.85);
  const brass = url(I('b'));
  const boss = url(I('k'));
  const panel = arch(28, 272, 116, 30, 252, 4);
  return (
    <>
      <defs>
        <Metal id={I('b')} base={c.secondary} x2={300} y2={140} />
        <Lit id={I('k')} base={c.secondary} light={0.5} dark={0.32} />
        <linearGradient id={I('mi')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={spark} />
          <stop offset="0.45" stopColor={glass} />
          <stop offset="1" stopColor={shade(glass, 0.3)} />
        </linearGradient>
        <pattern id={I('sd')} width="18" height="41" patternUnits="userSpaceOnUse" x="282" y="4">
          <Boss x={9} y={20} r={5.4} fill={url(I('k'))} hi={spark} />
        </pattern>
        <pattern id={I('lat')} width="30" height="30" patternUnits="userSpaceOnUse" x="28" y="272">
          <path d="M15 5L25 15L15 25L5 15Z" fill={url(I('mi'))} stroke={c.secondary} strokeWidth="1.2" />
          {[0, 30].map((x) => [0, 30].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.6" fill={c.secondary} />))}
          <circle cx="13" cy="12" r="1.3" fill={spark} />
        </pattern>
      </defs>
      <rect width="300" height="620" fill={lac} />
      <path d={panel} fill={lacLite} />
      <path d={panel} fill="none" stroke={brass} strokeWidth="3" />
      <g transform="translate(150 162)">
        {turns(12, 30, (a) => (
          <path key={a} d="M0 -76C9 -66 9 -54 0 -44C-9 -54 -9 -66 0 -76Z" fill={url(I('mi'))} stroke={c.secondary} strokeWidth="1" transform={`rotate(${a})`} />
        ))}
        {full ? turns(12, 30, (a) => <circle key={a} cx="0" cy="-56" r="3.4" fill={boss} transform={`rotate(${a})`} />, 15) : null}
        <circle r="34" fill="none" stroke={brass} strokeWidth="3" />
        <circle r="24" fill={url(I('mi'))} stroke={c.secondary} strokeWidth="1.6" />
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -22C4 -17 4 -12 0 -9C-4 -12 -4 -17 0 -22Z" fill={c.accent} transform={`rotate(${a})`} />
        ))}
        <Boss x={0} y={0} r={6} fill={boss} hi={spark} />
      </g>
      <rect x="28" y="272" width="244" height="252" fill={url(I('lat'))} />
      <rect x="28" y="272" width="244" height="252" fill="none" stroke={brass} strokeWidth="3" />
      <rect x="28" y="544" width="244" height="56" fill={lacLite} stroke={brass} strokeWidth="2.4" />
      {Array.from({ length: 8 }, (_, i) => {
        const x = 44 + i * 30;
        return <path key={x} d={`M${x} 572L${x + 10} 560L${x + 20} 572L${x + 10} 584Z`} fill={url(I('mi'))} stroke={c.secondary} strokeWidth="1" />;
      })}
      <rect x="5" y="5" width="290" height="610" fill="none" stroke={brass} strokeWidth="10" />
      <rect x="282" y="0" width="18" height="620" fill={brass} />
      <rect x="282" y="4" width="18" height="612" fill={url(I('sd'))} />
      {[60, 310, 560].map((y) => (
        <g key={y}>
          <path d={`M0 ${y - 7}H58Q70 ${y} 58 ${y + 7}H0Z`} fill={brass} />
          <Boss x={44} y={y} r={4.4} fill={boss} hi={spark} />
        </g>
      ))}
      <Lighting p={p} I={I} d={LEAF} mirror={mirror} />
      <rect x="297.5" y="0" width="2.5" height="620" fill={p.light.color} opacity="0.85" />
    </>
  );
}

/** Garden leaf: a marble leaf pierced with a girih jaali under a pointed arch, inlaid with pietra dura flowers. */
function GardenLeaf({ p, I, mirror, dark }: LeafArt & { dark: boolean }) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const marble = dark ? mix(c.background, '#ffffff', 0.45) : mix(c.primary, '#a9573a', 0.72);
  const inlay = dark ? mix(c.accent, c.secondary, 0.4) : mix(c.background, '#ffffff', 0.55);
  const top = arch(30, 270, 120, 34, 300, 0, 0.5);
  const low = 'M30 330H270V592H30Z';
  const solid = `${LEAF} ${top} ${low}`;
  return (
    <>
      <defs>
        <Metal id={I('b')} base={c.secondary} x2={300} y2={140} />
        <Girih id={I('j')} color={marble} s={34} width={3.6} />
      </defs>
      <path d={solid} fill={marble} fillRule="evenodd" />
      <path d={top} fill={url(I('j'))} />
      <path d={low} fill={url(I('j'))} />
      <Lighting p={p} I={I} d={solid} mirror={mirror} />
      <path d={top} fill="none" stroke={inlay} strokeWidth="2.4" />
      <path d={arch(20, 280, 120, 22, 310, 0, 0.5)} fill="none" stroke={inlay} strokeWidth="1" />
      <path d={low} fill="none" stroke={inlay} strokeWidth="2.4" />
      <rect x="20" y="320" width="260" height="282" fill="none" stroke={inlay} strokeWidth="1" />
      {[90, 150, 210].map((x) => (
        <g key={x} transform={`translate(${x} 315)`}>
          {full ? <path d="M-14 0q-6 -8 -16 -6q4 8 16 6Z M14 0q6 -8 16 -6q-4 8 -16 6Z" fill={n.leaf} /> : null}
          {turns(6, 60, (a) => (
            <ellipse key={a} cx="0" cy="-5.5" rx="3" ry="5.5" fill={c.accent} transform={`rotate(${a})`} />
          ))}
          <circle r="2.6" fill={c.secondary} />
        </g>
      ))}
      <circle cx="276" cy="320" r="14" fill="none" stroke={url(I('b'))} strokeWidth="4" />
      <rect x="290" y="0" width="10" height="620" fill={shade(marble, 0.06)} />
      <rect x="297.5" y="0" width="2.5" height="620" fill={p.light.color} opacity="0.8" />
    </>
  );
}

/** Torana and ghat leaves: a curtain of strands from a brass rod (jasmine on light stages, marigold on dark ones and at the ghat). */
function StrandLeaf({ p, I, flower, bells }: LeafArt & { flower: 'jasmine' | 'marigold'; bells: boolean }) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const N = 12;
  const step = r2(300 / N);
  const mid = r2(step / 2);
  const tile = flower === 'marigold' ? 18 : 20;
  const thread = flower === 'jasmine' ? shade(n.leafDark, 0.1) : shade(c.secondary, 0.25);
  const deepM = mix(n.flame, n.clay, 0.5);
  const unit = (dy: number) => (
    <g>
      <path d={`M${mid} 0V${tile}`} stroke={thread} strokeWidth={flower === 'jasmine' ? 1.3 : 0.9} />
      {flower === 'marigold' ? (
        <g>
          <circle cx={mid} cy={r2(dy + 9)} r="8.6" fill={n.flame} />
          <circle cx={mid} cy={r2(dy + 9)} r="8.6" fill="none" stroke={deepM} strokeWidth="1.6" strokeDasharray="2 2.4" />
          <circle cx={mid} cy={r2(dy + 9)} r="4.4" fill={deepM} />
          <circle cx={r2(mid - 2.6)} cy={r2(dy + 6.2)} r="2" fill={n.flameCore} opacity="0.8" />
        </g>
      ) : (
        <g>
          <path d={`M${r2(mid - 5)} ${r2(dy + 4)}q-5 4 -3 10q4 -2 3 -10Z M${r2(mid + 5)} ${r2(dy + 4)}q5 4 3 10q-4 -2 -3 -10Z`} fill={n.leaf} />
          {[-3.4, 3.4].map((dx) => (
            <ellipse key={dx} cx={r2(mid + dx)} cy={r2(dy + 10)} rx="3.6" ry="7.4" fill={dx < 0 ? n.pearl : n.ivory} stroke={shade(n.pearl, 0.3)} strokeWidth="0.7" transform={`rotate(${dx < 0 ? -16 : 16} ${r2(mid + dx)} ${r2(dy + 10)})`} />
          ))}
          <circle cx={mid} cy={r2(dy + 3)} r="1.8" fill={n.leafLight} />
        </g>
      )}
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('b')} base={c.secondary} x2={300} y2={40} />
        <pattern id={I('a')} width={step} height={tile} patternUnits="userSpaceOnUse">
          {unit(0)}
        </pattern>
        <pattern id={I('o')} width={step} height={tile} patternUnits="userSpaceOnUse" y={r2(tile / 2)}>
          {unit(0)}
        </pattern>
      </defs>
      {Array.from({ length: N }, (_, i) => {
        const x = r2(i * step);
        const len = r2(500 + rand(i, 41) * 70 + (i % 2) * 12);
        const end = r2(16 + len);
        const cx = r2(x + mid);
        return (
          <g key={i}>
            <rect x={x} y="16" width={step} height={len} fill={url(I(i % 2 ? 'o' : 'a'))} />
            {flower === 'jasmine' && full
              ? [0.22, 0.5, 0.78].map((f) => <circle key={f} cx={cx} cy={r2(16 + len * f + rand(i, f * 100) * 20)} r="5.6" fill={n.flame} />)
              : null}
            {bells && i % 2 === 0 ? (
              <g>
                <path d={bellPath(cx, end, 0.8)} fill={url(I('b'))} />
                <circle cx={cx} cy={r2(end + 16)} r="1.8" fill={thread} />
              </g>
            ) : (
              <g>
                <circle cx={cx} cy={r2(end + 4)} r="6" fill={flower === 'marigold' ? deepM : mix(c.primary, c.accent, 0.25)} />
                <path d={`M${cx} ${r2(end + 9)}V${r2(end + 24)}`} stroke={c.secondary} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
      <rect x="0" y="0" width="300" height="16" fill={url(I('b'))} />
      {Array.from({ length: N }, (_, i) => (
        <circle key={i} cx={r2(i * step + mid)} cy="16" r="3.6" fill="none" stroke={url(I('b'))} strokeWidth="2" />
      ))}
    </>
  );
}

/** Tent flap: striped canvas with folds, a gold rope edge and fringe, a tie-back with a tassel, a star appliqué. */
function TentLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const cream = mix(c.background, c.accent, 0.35);
  const gold = url(I('g'));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={300} y2={80} />
        <pattern id={I('st')} width="48" height="10" patternUnits="userSpaceOnUse">
          <rect width="48" height="10" fill={cream} />
          <rect width="24" height="10" fill={c.primary} />
        </pattern>
        <linearGradient id={I('fold')} x1="0" y1="0" x2="0.34" y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
          <stop offset="0.55" stopColor={shade(c.text, 0.5)} stopOpacity="0.16" />
          <stop offset="1" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="300" height="620" fill={url(I('st'))} />
      <rect width="300" height="620" fill={url(I('fold'))} />
      <Lighting p={p} I={I} d={LEAF} mirror={mirror} />
      <rect x="0" y="582" width="300" height="12" fill={c.accent} />
      <path d="M0 607H300" stroke={gold} strokeWidth="26" strokeDasharray="2 4" />
      <rect x="284" y="0" width="16" height="594" fill={gold} />
      {full ? <path d="M292 0V594" stroke={shade(c.secondary, 0.3)} strokeWidth="16" strokeDasharray="2 6" /> : null}
      <path d="M296 360C226 382 138 402 42 372" fill="none" stroke={gold} strokeWidth="7" strokeLinecap="round" />
      <path d="M42 372C30 368 24 378 30 386C22 394 26 404 36 400" fill="none" stroke={gold} strokeWidth="5" />
      <path d="M26 400H46L52 440H20Z" fill={gold} />
      <path d="M24 440V456M30 440V458M36 440V458M42 440V456M48 440V454" stroke={gold} strokeWidth="2" />
      <path d={star5(216, 140, 34)} fill={gold} stroke={shade(c.secondary, 0.3)} strokeWidth="1.4" />
      {full ? [[110, 86, 12], [240, 262, 10], [80, 236, 9]].map(([x, y, r]) => <path key={x} d={star5(x!, y!, r!)} fill={gold} />) : null}
    </>
  );
}

/** Lane leaf: a block-printed cotton panel on a bamboo rod, a printed border, tassels. */
function LaneLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const fabric = mix(c.secondary, c.primary, 0.12);
  const print = shade(c.primary, 0.08);
  const bamboo = mix(c.primary, '#c9a45c', 0.8);
  return (
    <>
      <defs>
        <pattern id={I('pr')} width="36" height="36" patternUnits="userSpaceOnUse">
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="18" cy="12" rx="3.4" ry="5.4" fill={print} transform={`rotate(${a} 18 18)`} />
          ))}
          <circle cx="18" cy="18" r="2.6" fill={c.accent} />
          {[0, 36].map((x) => [0, 36].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill={c.accent} />))}
        </pattern>
        <linearGradient id={I('fold')} x1="0" y1="0" x2="0.25" y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
          <stop offset="0.5" stopColor={shade(c.text, 0.5)} stopOpacity="0.12" />
          <stop offset="1" stopColor={shade(c.text, 0.5)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="12" width="300" height="578" fill={fabric} />
      {full ? <rect x="0" y="30" width="262" height="490" fill={url(I('pr'))} /> : null}
      <rect x="262" y="12" width="38" height="578" fill={print} />
      <path d={`M281 16${Array.from({ length: 48 }, (_, i) => `L${i % 2 ? 288 : 274} ${16 + (i + 1) * 12}`).join('')}`} fill="none" stroke={c.accent} strokeWidth="2" />
      <rect x="0" y="520" width="262" height="62" fill={print} />
      <path d="M8 551H256" stroke={c.accent} strokeWidth="9" strokeDasharray="0.1 18" strokeLinecap="round" />
      <path d="M0 532H262M0 570H262" stroke={c.accent} strokeWidth="1.6" />
      <rect x="0" y="12" width="300" height="578" fill={url(I('fold'))} />
      <Lighting p={p} I={I} d="M0 12H300V590H0Z" mirror={mirror} />
      <path d="M0 604H300" stroke={c.accent} strokeWidth="28" strokeDasharray="2.4 9" />
      <path d="M5 604H300" stroke={c.primary} strokeWidth="24" strokeDasharray="2 9.4" />
      <rect x="0" y="0" width="300" height="12" fill={bamboo} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={8 + i * 30} y="4" width="14" height="22" rx="3" fill={shade(fabric, 0.18)} />
      ))}
    </>
  );
}

/** Haveli leaf: dark teak, iron straps with elephant spikes, studded carved panels, a wicket door (left leaf), a ring knocker. */
function HaveliLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const wood = mix(c.primary, '#4a2a14', 0.7);
  const lite = tint(wood, 0.12);
  const dark = shade(wood, 0.32);
  const iron = mix(c.primary, '#232022', 0.8);
  const brass = url(I('b'));
  const spark = tint(c.secondary, 0.7);
  return (
    <>
      <defs>
        <Metal id={I('b')} base={c.secondary} x2={300} y2={120} />
        <Lit id={I('k')} base={c.secondary} light={0.5} dark={0.35} />
        <radialGradient id={I('sp')} cx="40%" cy="38%" r="65%">
          <stop offset="0" stopColor={tint(c.secondary, 0.75)} />
          <stop offset="0.4" stopColor={c.secondary} />
          <stop offset="1" stopColor={shade(iron, 0.2)} />
        </radialGradient>
        <Grain id={I('wg')} wood={wood} seed={11} />
        <pattern id={I('st')} width="30" height="30" patternUnits="userSpaceOnUse" x="26" y="0">
          <circle cx="15" cy="15" r="3.8" fill={url(I('k'))} />
        </pattern>
      </defs>
      <rect width="300" height="620" fill={wood} />
      <rect width="300" height="620" fill={url(I('wg'))} />
      {[30, 238, 428].map((y, i) => (
        <g key={y}>
          <rect x="26" y={y} width="248" height={i === 2 ? 158 : 170} fill={lite} />
          <rect x="34" y={y + 8} width="232" height={i === 2 ? 142 : 154} fill="none" stroke={dark} strokeWidth="3" />
          {full ? <rect x="34" y={y + 8} width="232" height={i === 2 ? 142 : 154} fill={url(I('st'))} /> : null}
        </g>
      ))}
      {!mirror ? (
        <g>
          <rect x="52" y="262" width="150" height="316" rx="4" fill="none" stroke={dark} strokeWidth="4" />
          <circle cx="186" cy="420" r="8" fill="none" stroke={brass} strokeWidth="3" />
        </g>
      ) : null}
      {[200, 408, 592].map((y, i) => (
        <g key={y}>
          <rect x="0" y={y} width="300" height="20" fill={iron} />
          {full ? <path d={`M8 ${y + 10}H296`} stroke={tint(iron, 0.3)} strokeWidth="4" strokeDasharray="0.1 24" strokeLinecap="round" /> : null}
          {i < 2
            ? [60, 120, 180, 240].map((x) => (
                <g key={x}>
                  <circle cx={x} cy={y + 10} r="12" fill={url(I('sp'))} />
                  <circle cx={x - 2} cy={y + 8} r="2.4" fill={spark} />
                </g>
              ))
            : null}
        </g>
      ))}
      <rect x="282" y="0" width="18" height="620" fill={dark} />
      <path d="M291 10V610" stroke={url(I('k'))} strokeWidth="7" strokeDasharray="0.1 28" strokeLinecap="round" />
      <path d="M264 300L272 312L264 324L256 312Z" fill={brass} />
      <circle cx="264" cy="336" r="15" fill="none" stroke={brass} strokeWidth="4.4" />
      <Lighting p={p} I={I} d={LEAF} mirror={mirror} />
      <rect x="298" y="0" width="2" height="620" fill={p.light.color} opacity="0.75" />
    </>
  );
}

/** Campus leaf: wrought-iron bars with gilt spear tips rising to the meeting stile, rails, scrolls, a half medallion. */
function CampusLeaf({ p, I }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const iron = mix(c.primary, '#2a2e36', 0.7);
  const gilt = url(I('g'));
  const xs = Array.from({ length: 15 }, (_, i) => 10 + i * 20);
  const topY = (x: number) => r2(70 - 60 * (x / 300) * (x / 300));
  const rail = (dy: number) => poly([0, ...xs, 300].map((x) => [x, topY(x) + dy] as Pt2));
  // The ironwork, drawn twice: a soft halo in the rim colour (the stage's light behind the gate), then the iron.
  const work = (color: string, grow: number) => (
    <g stroke={color} fill="none">
      <path d={xs.map((x) => `M${x} ${topY(x)}V612`).join('')} strokeWidth={3.6 + grow} />
      <path d={rail(22)} strokeWidth={6 + grow} />
      <path d={rail(40)} strokeWidth={3.4 + grow} />
      <path d="M0 300H300M0 316H300M0 462H300M0 548H300M0 606H300" strokeWidth={5 + grow} />
      <path d="M300 128A72 72 0 0 0 300 272" strokeWidth={6 + grow} />
      <path d="M300 152A48 48 0 0 0 300 248" strokeWidth={3 + grow} />
      {turns(5, 30, (a) => <path key={a} d="M0 -48V-72" strokeWidth={3 + grow} transform={`translate(300 200) rotate(${r2(-a - 30)})`} />)}
      {full ? <path d={Array.from({ length: 14 }, (_, i) => `M${20 + i * 20} 562V606`).join('')} strokeWidth={2.4 + grow} /> : null}
      <path d="M5 60V620M296 0V620" strokeWidth={9 + grow} />
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={300} y2={60} />
        <pattern id={I('sc')} width="40" height="72" patternUnits="userSpaceOnUse" x="0" y="470">
          <path d="M20 4C2 4 2 36 20 36C38 36 38 68 20 68" fill="none" stroke={iron} strokeWidth="3" />
          <circle cx="12" cy="14" r="4" fill="none" stroke={iron} strokeWidth="2.4" />
          <circle cx="28" cy="58" r="4" fill="none" stroke={iron} strokeWidth="2.4" />
        </pattern>
      </defs>
      <g opacity="0.4">{work(p.light.rim, 2.6)}</g>
      {work(iron, 0)}
      {full ? <rect x="0" y="470" width="292" height="72" fill={url(I('sc'))} /> : null}
      {xs.map((x) => (
        <g key={x}>
          <path d={`M${x - 4.5} ${r2(topY(x) + 6)}L${x} ${r2(topY(x) - 11)}L${x + 4.5} ${r2(topY(x) + 6)}Z`} fill={gilt} />
          <rect x={x - 3.5} y="296" width="7" height="24" fill={gilt} />
        </g>
      ))}
      <path d="M300 182A18 18 0 0 0 300 218Z" fill={gilt} />
      <rect x="290" y="296" width="12" height="24" fill={gilt} />
    </>
  );
}

/** One gate leaf in the variant (left as drawn, right mirrored inside the drawing). */
function GateLeaf({ p, I, variant, mirror, dark }: LeafArt & { variant: GateStyle; dark: boolean }) {
  const a = { p, I, mirror };
  const art =
    variant === 'palace' ? <PalaceLeaf {...a} />
    : variant === 'garden' ? <GardenLeaf {...a} dark={dark} />
    : variant === 'torana' ? <StrandLeaf {...a} flower={dark ? 'marigold' : 'jasmine'} bells={false} />
    : variant === 'ghat' ? <StrandLeaf {...a} flower="marigold" bells />
    : variant === 'tentFlap' ? <TentLeaf {...a} />
    : variant === 'lane' ? <LaneLeaf {...a} />
    : variant === 'haveli' ? <HaveliLeaf {...a} />
    : <CampusLeaf {...a} />;
  return mirror ? <g transform="translate(300 0) scale(-1 1)">{art}</g> : art;
}

/** The ground outside the gate (a floor plane in plan, its top edge at the gate; the opening is x 400–1000). */
function GateGround({ p, I, variant }: Art & { variant: GateStyle }) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  if (variant === 'ghat') {
    const water = mix(c.primary, '#4d8aa6', 0.55);
    return (
      <>
        <defs>
          <linearGradient id={I('w')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint(water, 0.18)} />
            <stop offset="1" stopColor={shade(water, 0.22)} />
          </linearGradient>
          <linearGradient id={I('streak')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.light.color} stopOpacity="0.55" />
            <stop offset="1" stopColor={p.light.color} stopOpacity="0" />
          </linearGradient>
          <pattern id={I('rp')} width="120" height="40" patternUnits="userSpaceOnUse">
            <path d="M8 14Q30 8 52 14M64 32Q86 26 108 32" fill="none" stroke={tint(water, 0.4)} strokeWidth="2.2" />
          </pattern>
        </defs>
        <rect width="1400" height="1200" fill={url(I('w'))} />
        <rect width="1400" height="1200" fill={url(I('rp'))} opacity="0.7" />
        <rect x="600" y="0" width="200" height="900" fill={url(I('streak'))} />
        {full
          ? Array.from({ length: 7 }, (_, i) => {
              const x = r2(420 + rand(i, 17) * 560);
              const y = r2(60 + rand(i, 23) * 480);
              return (
                <g key={i}>
                  <ellipse cx={x} cy={y} rx="26" ry="10" fill={mix(n.leaf, water, 0.3)} />
                  <path d={`M${r2(x - 10)} ${y}Q${x} ${r2(y + 8)} ${r2(x + 10)} ${y}Z`} fill={n.clay} />
                  <circle cx={x} cy={r2(y - 4)} r="4" fill={n.flame} />
                </g>
              );
            })
          : null}
      </>
    );
  }
  const stoneGround = variant === 'palace' || variant === 'haveli' || variant === 'garden';
  const stone = mix(c.primary, '#d8c6a4', 0.8);
  const earth = mix(n.clay, c.background, 0.55);
  const base = variant === 'campus' ? mix(c.background, '#bdb4a4', 0.5) : stoneGround ? stone : earth;
  const lawn = mix(n.leafDark, c.primary, 0.12);
  return (
    <>
      <defs>
        <pattern id={I('pv')} width="140" height="100" patternUnits="userSpaceOnUse">
          <rect width="140" height="100" fill={base} />
          {stoneGround ? <path d="M0 1H140M0 51H140M1 0V50M71 50V100" stroke={shade(base, 0.14)} strokeWidth="2.4" fill="none" /> : <circle cx="40" cy="30" r="3" fill={shade(base, 0.1)} />}
        </pattern>
        <linearGradient id={I('spill')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.light.color} stopOpacity="0.38" />
          <stop offset="0.45" stopColor={p.light.color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1400" height="1200" fill={url(I('pv'))} />
      {variant === 'garden' || variant === 'campus' ? (
        <g>
          <rect x="0" y="0" width="380" height="1200" fill={lawn} />
          <rect x="1020" y="0" width="380" height="1200" fill={lawn} />
          {full ? <path d="M60 0V1200M180 0V1200M300 0V1200M1100 0V1200M1220 0V1200M1340 0V1200" stroke={tint(lawn, 0.12)} strokeWidth="60" /> : null}
        </g>
      ) : null}
      {variant === 'tentFlap' ? (
        <g>
          <rect x="460" y="0" width="480" height="1200" fill={c.primary} />
          <path d="M472 0V1200M928 0V1200" stroke={c.secondary} strokeWidth="6" />
        </g>
      ) : (
        <g>
          <rect x="400" y="0" width="600" height="1200" fill={tint(base, 0.12)} opacity="0.8" />
          <path d="M400 0V1200M1000 0V1200" stroke={shade(base, 0.2)} strokeWidth="6" />
        </g>
      )}
      {variant === 'torana' ? (
        <g transform="translate(700 150)">
          <circle r="110" fill="none" stroke={c.background} strokeWidth="5" strokeDasharray="0.1 14" strokeLinecap="round" />
          <circle r="72" fill="none" stroke={c.background} strokeWidth="5" strokeDasharray="0.1 12" strokeLinecap="round" />
          {turns(8, 45, (a) => (
            <path key={a} d="M0 -96C16 -76 16 -56 0 -40C-16 -56 -16 -76 0 -96Z" fill={a % 90 ? n.flame : c.accent} transform={`rotate(${a})`} />
          ))}
          <circle r="24" fill={c.primary} />
        </g>
      ) : null}
      {full && variant !== 'campus'
        ? Array.from({ length: 34 }, (_, i) => {
            const x = r2(420 + rand(i, 5) * 560);
            const y = r2(10 + rand(i, 9) * rand(i, 13) * 420);
            return <ellipse key={i} cx={x} cy={y} rx="7" ry="4" fill={i % 3 ? n.flame : c.accent} transform={`rotate(${r2(rand(i, 11) * 180)} ${x} ${y})`} />;
          })
        : null}
      <rect width="1400" height="1200" fill={url(I('spill'))} />
    </>
  );
}

/**
 * The ground on through the gate (the arrival's `cover-ground-in`, drawn in the plane's own box: its top edge deep in
 * the set, its foot at the gate): the outside's paving, path and lawns (the ghat's water) carried on under the set's
 * own floor to where that floor begins, darkening toward the gateway's shade. It lies a hair below the set's floors,
 * so it shows only where they leave a gap.
 */
function GateGroundIn({ p, I, variant }: Art & { variant: GateStyle }) {
  const c = p.colors;
  const n = p.nature;
  const w = r2(p.w);
  const h = r2(p.h);
  const shadeIn = (
    <linearGradient id={I('sh')} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#000000" stopOpacity="0.04" />
      <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
    </linearGradient>
  );
  if (variant === 'ghat') {
    const water = mix(c.primary, '#4d8aa6', 0.55);
    return (
      <>
        <defs>
          <linearGradient id={I('w')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint(water, 0.22)} />
            <stop offset="1" stopColor={tint(water, 0.18)} />
          </linearGradient>
          {shadeIn}
        </defs>
        <rect width={w} height={h} fill={url(I('w'))} />
        <rect width={w} height={h} fill={url(I('sh'))} />
      </>
    );
  }
  const stoneGround = variant === 'palace' || variant === 'haveli' || variant === 'garden';
  const stone = mix(c.primary, '#d8c6a4', 0.8);
  const earth = mix(n.clay, c.background, 0.55);
  const base = variant === 'campus' ? mix(c.background, '#bdb4a4', 0.5) : stoneGround ? stone : earth;
  const lawn = mix(n.leafDark, c.primary, 0.12);
  return (
    <>
      <defs>
        <pattern id={I('pv')} width="140" height="100" patternUnits="userSpaceOnUse">
          <rect width="140" height="100" fill={base} />
          {stoneGround ? <path d="M0 1H140M0 51H140M1 0V50M71 50V100" stroke={shade(base, 0.14)} strokeWidth="2.4" fill="none" /> : <circle cx="40" cy="30" r="3" fill={shade(base, 0.1)} />}
        </pattern>
        {shadeIn}
      </defs>
      <rect width={w} height={h} fill={url(I('pv'))} />
      {variant === 'garden' || variant === 'campus' ? (
        <g>
          <rect x="0" y="0" width="380" height={h} fill={lawn} />
          <rect x="1020" y="0" width="380" height={h} fill={lawn} />
        </g>
      ) : null}
      {variant === 'tentFlap' ? (
        <g>
          <rect x="460" y="0" width="480" height={h} fill={c.primary} />
          <path d={`M472 0V${h}M928 0V${h}`} stroke={c.secondary} strokeWidth="6" />
        </g>
      ) : (
        <g>
          <rect x="400" y="0" width="600" height={h} fill={tint(base, 0.12)} opacity="0.8" />
          <path d={`M400 0V${h}M1000 0V${h}`} stroke={shade(base, 0.2)} strokeWidth="6" />
        </g>
      )}
      <rect width={w} height={h} fill={url(I('sh'))} />
    </>
  );
}

const GATE_SEAL: Record<GateStyle, SealShape> = { palace: 'lotus', garden: 'star', torana: 'lotus', tentFlap: 'badge', lane: 'wax', haveli: 'lotus', ghat: 'lotus', campus: 'medal' };

/** Arrival: the venue's own gate (frame, two leaves, the monogram seal, the ground outside). */
export function GateCover(props: DrawProps & GateCoverOptions) {
  const { part, variant } = props;
  if (part === 'seal') return <Seal p={props} shape={GATE_SEAL[variant]} monogram={props.monogram} fontFamily={props.fontFamily} />;
  const I = idsOf(props, `g${variant}${part}`);
  if (part === 'ground')
    return (
      <Svg w={1400} h={1200}>
        <GateGround p={props} I={I} variant={variant} />
      </Svg>
    );
  if (part === 'groundIn')
    return (
      <Svg w={props.w} h={props.h}>
        <GateGroundIn p={props} I={I} variant={variant} />
      </Svg>
    );
  if (part === 'frame') {
    const Frame = GATE_FRAMES[variant];
    return (
      <Svg w={1000} h={800}>
        <Frame p={props} I={I} />
      </Svg>
    );
  }
  return (
    <Svg w={300} h={620}>
      <GateLeaf p={props} I={I} variant={variant} mirror={part === 'leafR'} dark={props.dark ?? false} />
    </Svg>
  );
}

// ─────────────────────────── Door (doorway) ───────────────────────────
// Frames are 700 × 760 with the opening at x 100–600 below y 140 (the leaves
// stand behind it); leaves are 250 × 620, drawn as the left one (hinge x 0,
// meeting edge x 250). At the start pose only the upper half of the leaves and
// the inner quarter by the seam reach a phone, so the richest carving is there.

const DOOR_LEAF = 'M0 0H250V620H0Z';
const DOOR_BODY = 'M0 0H700V760H0Z M108 760V148H592V760Z';

function woodOf(c: ThemeColors, variant: DoorStyle): string {
  return variant === 'ballroom'
    ? mix(c.primary, '#f5eddf', 0.88)
    : variant === 'church'
      ? // Old oak, warm: a light palette's primary (a chapel's sage or blush) only tints it, never greys it.
        mix(c.primary, '#7c4e2a', 0.86)
      : variant === 'cedar'
        ? mix(c.primary, '#a8743f', 0.7)
        : variant === 'haveli'
          ? mix(c.primary, '#4a2a14', 0.7)
          : mix(c.primary, '#6e3f1c', 0.66);
}

/** Temple: a carved teak frame in three bands (beads, lotus petals, brass bosses), a brass lotus on the lintel, a bell over the seam. */
function TempleDoorFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const wood = shade(woodOf(c, 'temple'), 0.12);
  const lite = tint(wood, 0.2);
  const gold = url(I('g'));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={700} y2={200} />
        <pattern id={I('pt')} width="36" height="26" patternUnits="userSpaceOnUse">
          <path d="M18 2C30 8 30 20 18 24C6 20 6 8 18 2Z" fill="none" stroke={lite} strokeWidth="2" />
        </pattern>
      </defs>
      <path d={DOOR_BODY} fill={wood} fillRule="evenodd" />
      {full ? <path d="M18 760V18H682V760" fill="none" stroke={lite} strokeWidth="7" strokeDasharray="0.1 13" strokeLinecap="round" /> : null}
      <path d="M54 760V54H646V760" fill="none" stroke={url(I('pt'))} strokeWidth="30" />
      <path d="M92 760V132H608V760" fill="none" stroke={gold} strokeWidth="12" />
      <path d="M92 760V132H608V760" fill="none" stroke={tint(c.secondary, 0.5)} strokeWidth="7" strokeDasharray="0.1 34" strokeLinecap="round" />
      <Lighting p={p} I={I} d={DOOR_BODY} />
      <g transform="translate(350 112)">
        {turns(9, 20, (a) => (
          <path key={a} d="M0 -76C16 -62 18 -36 0 -20C-18 -36 -16 -62 0 -76Z" fill={gold} stroke={shade(c.secondary, 0.35)} strokeWidth="1" transform={`rotate(${a})`} />
        ), -80)}
        {turns(7, 24, (a) => (
          <path key={a} d="M0 -50C10 -40 11 -26 0 -16C-11 -26 -10 -40 0 -50Z" fill={c.accent} transform={`rotate(${a})`} />
        ), -72)}
        <path d="M-30 -4H30L22 10H-22Z" fill={gold} />
        {full ? <path d="M-34 4q-30 -2 -48 -18q30 -6 48 18Z M34 4q30 -2 48 -18q-30 -6 -48 18Z" fill={n.leaf} /> : null}
      </g>
      <path d="M0 6H700" stroke={gold} strokeWidth="10" strokeDasharray="22 6" />
      <path d="M350 148V180" stroke={gold} strokeWidth="2.4" strokeDasharray="4 2.4" />
      <path d={bellPath(350, 178, 2.4)} fill={gold} stroke={shade(c.secondary, 0.35)} strokeWidth="1" />
      <circle cx="350" cy="228" r="5" fill={shade(c.secondary, 0.4)} />
    </>
  );
}

/** House gate: plastered posts with lamps, a wrought-iron arch, a toran of mango leaves and marigolds across the top. */
function HouseGateFrame({ p, I }: Art) {
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const plaster = mix(c.primary, '#e4cfae', 0.78);
  const iron = mix(c.primary, '#1f1d1d', 0.8);
  const gold = url(I('g'));
  const post = (
    <g>
      <rect x="0" y="120" width="104" height="640" fill={plaster} />
      <rect x="16" y="200" width="72" height="480" fill="none" stroke={shade(plaster, 0.2)} strokeWidth="2.4" />
      <path d="M-6 120H110V102H-6Z" fill={shade(plaster, 0.12)} />
      <path d="M4 102L52 74L100 102Z" fill={shade(plaster, 0.2)} />
      <path d="M52 74V64" stroke={iron} strokeWidth="4" />
      <ellipse cx="52" cy="40" rx="26" ry="24" fill={url(I('glow'))} />
      <path d="M38 26H66L62 62H42Z" fill={n.flameCore} stroke={iron} strokeWidth="3" />
      <path d="M32 26L52 12L72 26Z" fill={iron} />
    </g>
  );
  const bars = Array.from({ length: 20 }, (_, i) => 116 + i * 24);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={700} y2={160} />
        <radialGradient id={I('glow')}>
          <stop offset="0" stopColor={n.flameCore} stopOpacity="0.8" />
          <stop offset="1" stopColor={n.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      <Twin id={I('twpost')} w={700}>
        {post}
      </Twin>
      <Lighting p={p} I={I} d="M0 120H104V760H0Z M596 120H700V760H596Z" />
      {bars.map((x) => (
        <path key={x} d={`M${x} ${qY(x, 104, 596, 140, 6)}V140`} stroke={iron} strokeWidth="3" />
      ))}
      <path d="M104 140Q350 -10 596 140" fill="none" stroke={iron} strokeWidth="7" />
      <path d="M104 140Q350 40 596 140" fill="none" stroke={iron} strokeWidth="3.4" />
      <circle cx="350" cy="92" r="20" fill="none" stroke={iron} strokeWidth="3.4" />
      <circle cx="350" cy="92" r="7" fill={gold} />
      <path d="M104 142H596" stroke={iron} strokeWidth="8" />
      <path d="M110 146Q350 160 590 146" fill="none" stroke={n.flame} strokeWidth="4" />
      {Array.from({ length: 17 }, (_, i) => {
        const x = r2(118 + i * 29);
        const sag = r2(qY(x, 110, 590, 146, 174) - 146);
        const y = r2(146 + sag);
        return (
          <g key={i}>
            <path d={`M${x} ${y}C${r2(x + 9)} ${r2(y + 12)} ${r2(x + 8)} ${r2(y + 34)} ${x} ${r2(y + 48)}C${r2(x - 8)} ${r2(y + 34)} ${r2(x - 9)} ${r2(y + 12)} ${x} ${y}Z`} fill={i % 2 ? n.leaf : n.leafLight} />
            {full ? <path d={`M${x} ${y}V${r2(y + 44)}`} stroke={n.leafDark} strokeWidth="1" /> : null}
            <circle cx={x} cy={r2(y - 1)} r="7" fill={i % 3 ? n.flame : mix(n.flame, n.clay, 0.5)} />
          </g>
        );
      })}
    </>
  );
}

/** Church: a limestone portal with moulded pointed archivolts, colonnettes, and a lancet transom of glass glowing from within. */
function ChurchDoorFrame({ p, I }: Art) {
  const c = p.colors;
  const full = p.detail === 'full';
  const stone = mix(c.primary, '#bdb2a0', 0.75);
  const deep = shade(stone, 0.26);
  const outer = 'M0 760V236C0 112 170 22 350 0C530 22 700 112 700 236V760Z';
  const door = arch(108, 592, 290, 200, 760, 0, 0.62);
  const lancet = (x0: number, x1: number, ys: number, ya: number, bottom: number) => arch(x0, x1, ys, ya, bottom, 0, 0.7);
  return (
    <>
      <defs>
        <linearGradient id={I('gl')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(c.accent, 0.35)} />
          <stop offset="0.55" stopColor={mix(c.secondary, p.light.color, 0.45)} />
          <stop offset="1" stopColor={mix(c.primary, c.secondary, 0.4)} />
        </linearGradient>
      </defs>
      <path d={`${outer} ${door}`} fill={stone} fillRule="evenodd" />
      <Lighting p={p} I={I} d={`${outer} ${door}`} />
      {[30, 64].map((k) => (
        <path key={k} d={poly(archPoints(k, 700 - k, 260, k * 1.6, 0, 0.62))} fill="none" stroke={deep} strokeWidth="3" />
      ))}
      {[18, 52, 648, 682].map((x) => (
        <g key={x}>
          <rect x={x - 7} y="270" width="14" height="472" fill={tint(stone, 0.14)} stroke={deep} strokeWidth="1.4" />
          <rect x={x - 11} y="262" width="22" height="10" fill={deep} />
          <rect x={x - 11} y="740" width="22" height="20" fill={deep} />
        </g>
      ))}
      <path d={lancet(318, 382, 150, 62, 190)} fill={url(I('gl'))} stroke={deep} strokeWidth="5" />
      <path d={lancet(250, 302, 186, 132, 204)} fill={url(I('gl'))} stroke={deep} strokeWidth="4" />
      <path d={lancet(398, 450, 186, 132, 204)} fill={url(I('gl'))} stroke={deep} strokeWidth="4" />
      {full ? <path d="M350 70V190M318 130H382M318 162H382M276 160V204M424 160V204" stroke={deep} strokeWidth="2" /> : null}
      <circle cx="350" cy="40" r="17" fill={url(I('gl'))} stroke={deep} strokeWidth="4" />
      {full ? <path d="M350 23V57M333 40H367" stroke={deep} strokeWidth="2" /> : null}
      <path d={poly(archPoints(108, 592, 290, 200, 0, 0.62))} fill="none" stroke={deep} strokeWidth="5" />
    </>
  );
}

/** Cedar: a carved deodar frame with khatamband jambs, a Kashmiri arcade of cusped niches and a girih star on the lintel. */
function CedarDoorFrame({ p, I }: Art) {
  const c = p.colors;
  const wood = shade(woodOf(c, 'cedar'), 0.1);
  const dark = shade(wood, 0.32);
  const gold = url(I('g'));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={700} y2={120} />
        <Girih id={I('k')} color={dark} s={28} width={2} bg={tint(wood, 0.12)} />
      </defs>
      <path d={DOOR_BODY} fill={wood} fillRule="evenodd" />
      <rect x="18" y="140" width="72" height="620" fill={url(I('k'))} />
      <rect x="610" y="140" width="72" height="620" fill={url(I('k'))} />
      <path d="M18 760V140H90V760M610 760V140H682V760" fill="none" stroke={dark} strokeWidth="3" />
      <Lighting p={p} I={I} d={DOOR_BODY} />
      <path d="M-4 22H704L694 0H6Z" fill={dark} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 106 + i * 54;
        return <path key={x} d={arch(x, x + 46, 104, 70, 132, 2)} fill={dark} />;
      })}
      <path d="M96 134H604M96 58H604" stroke={gold} strokeWidth="2.4" />
      <path d={octagram(350, 34, 24)} fill={gold} />
      <circle cx="350" cy="34" r="8" fill={c.accent} />
    </>
  );
}

/** Ballroom: ivory pilasters with gilt capitals, a frieze of gilt swags, a dentil cornice and a gilt cartouche. */
function BallroomDoorFrame({ p, I }: Art) {
  const c = p.colors;
  const full = p.detail === 'full';
  const ivory = woodOf(c, 'ballroom');
  const line = shade(ivory, 0.14);
  const gold = url(I('g'));
  const pilaster = (
    <g>
      <rect x="14" y="166" width="80" height="568" fill={tint(ivory, 0.3)} />
      {[30, 46, 62, 78].map((x) => (
        <path key={x} d={`M${x} 184V716`} stroke={line} strokeWidth="3.4" strokeLinecap="round" />
      ))}
      <rect x="8" y="142" width="92" height="24" fill={gold} />
      <circle cx="16" cy="150" r="9" fill="none" stroke={gold} strokeWidth="3" />
      <circle cx="92" cy="150" r="9" fill="none" stroke={gold} strokeWidth="3" />
      <rect x="8" y="734" width="92" height="26" fill={gold} />
    </g>
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={700} y2={180} />
      </defs>
      <path d={DOOR_BODY} fill={ivory} fillRule="evenodd" />
      <Lighting p={p} I={I} d={DOOR_BODY} />
      <Twin id={I('twpilaster')} w={700}>
        {pilaster}
      </Twin>
      <path d="M0 52H700M0 70H700M100 120H600M100 138H600" stroke={gold} strokeWidth="2.6" />
      <path d="M0 61H700" stroke={line} strokeWidth="9" strokeDasharray="7 5" />
      {[150, 270, 390, 510].map((x) => (
        <g key={x}>
          <path d={`M${x - 52} 82Q${x} 118 ${x + 52} 82`} fill="none" stroke={gold} strokeWidth="4" />
          {full ? <path d={`M${x - 44} 88Q${x} 112 ${x + 44} 88`} fill="none" stroke={gold} strokeWidth="5" strokeDasharray="0.1 9" strokeLinecap="round" /> : null}
          <circle cx={x + 60} cy="82" r="6" fill={gold} />
        </g>
      ))}
      <g transform="translate(350 50)">
        {turns(9, 20, (a) => (
          <path key={a} d="M0 -6L-5 -38H5Z" fill={gold} transform={`rotate(${a})`} />
        ), -80)}
        <path d="M-50 0C-60 -20 -40 -34 -28 -22M50 0C60 -20 40 -34 28 -22" fill="none" stroke={gold} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="0" cy="-4" rx="14" ry="10" fill={gold} />
      </g>
    </>
  );
}

/** Haveli door frame: sandstone jambs carved with diamonds, brackets, a pierced lunette niche on the lintel, brass studs. */
function HaveliDoorFrame({ p, I }: Art) {
  const c = p.colors;
  const sand = mix(c.primary, '#d6b086', 0.75);
  const deep = shade(sand, 0.28);
  const gold = url(I('g'));
  const lunette = arch(220, 480, 140, 24, 140, 5);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={700} y2={160} />
        <Jaali id={I('j')} color={sand} s={16} width={2.4} />
        <pattern id={I('d')} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M12 2L22 12L12 22L2 12Z" fill="none" stroke={deep} strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.4" fill={deep} />
        </pattern>
      </defs>
      <path d={`${DOOR_BODY} ${lunette}`} fill={sand} fillRule="evenodd" />
      <path d={lunette} fill={url(I('j'))} />
      <path d={lunette} fill="none" stroke={deep} strokeWidth="4" />
      <rect x="20" y="140" width="68" height="620" fill={url(I('d'))} />
      <rect x="612" y="140" width="68" height="620" fill={url(I('d'))} />
      <Lighting p={p} I={I} d={DOOR_BODY} />
      <path d="M108 148H158C146 160 132 178 124 204H108Z M592 148H542C554 160 568 178 576 204H592Z" fill={sand} stroke={deep} strokeWidth="1.6" />
      {[150, 550].map((x) => (
        <g key={x} transform={`translate(${x} 76)`}>
          {turns(8, 45, (a) => (
            <path key={a} d="M0 -26C7 -18 7 -10 0 -6C-7 -10 -7 -18 0 -26Z" fill={deep} transform={`rotate(${a})`} />
          ))}
          <circle r="5" fill={gold} />
        </g>
      ))}
      <path d="M100 134H600" stroke={gold} strokeWidth="9" strokeDasharray="0.1 22" strokeLinecap="round" />
      <path d="M100 760V142H600V760" fill="none" stroke={c.accent} strokeWidth="3" />
    </>
  );
}

const DOOR_FRAMES: Record<DoorStyle, (a: Art) => ReactNode> = {
  temple: TempleDoorFrame,
  houseGate: HouseGateFrame,
  church: ChurchDoorFrame,
  cedar: CedarDoorFrame,
  ballroom: BallroomDoorFrame,
  haveli: HaveliDoorFrame,
};

/** Temple leaf: teak with a half lotus that meets its twin at the seam, a field of brass bosses, a knocker, crossed straps. */
function TempleLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const teak = woodOf(c, 'temple');
  const lite = tint(teak, 0.12);
  const dark = shade(teak, 0.3);
  const brass = url(I('b'));
  const spark = tint(c.secondary, 0.75);
  return (
    <>
      <defs>
        <Metal id={I('b')} base={c.secondary} x2={250} y2={120} />
        <Lit id={I('k')} base={c.secondary} light={0.5} dark={0.32} />
        <Grain id={I('wg')} wood={teak} seed={3} />
        <pattern id={I('bs')} width="30" height="30" patternUnits="userSpaceOnUse" x="22" y="256">
          <circle cx="15" cy="15" r="5.6" fill={url(I('k'))} />
        </pattern>
      </defs>
      <rect width="250" height="620" fill={teak} />
      <rect width="250" height="620" fill={url(I('wg'))} />
      <rect x="22" y="22" width="228" height="214" fill={lite} />
      <rect x="22" y="22" width="228" height="214" fill={url(I('wg'))} />
      <path d="M22 22H250M22 236H250M22 22V236" stroke={dark} strokeWidth="3" />
      <g transform="translate(250 130)">
        <path d="M0 -104A104 104 0 0 0 0 104" fill="none" stroke={brass} strokeWidth="3.4" strokeDasharray="0.1 9" strokeLinecap="round" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d="M0 -94C20 -76 22 -50 0 -32C-22 -50 -20 -76 0 -94Z" fill={brass} stroke={shade(c.secondary, 0.4)} strokeWidth="1" transform={`rotate(${-180 + i * 22.5})`} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d="M0 -58C11 -48 12 -34 0 -24C-12 -34 -11 -48 0 -58Z" fill={c.accent} transform={`rotate(${-180 + i * 22.5})`} />
        ))}
        <path d="M0 -22A22 22 0 0 0 0 22Z" fill={brass} />
      </g>
      <rect x="22" y="256" width="210" height="216" fill={url(I('bs'))} />
      <rect x="22" y="256" width="210" height="216" fill="none" stroke={dark} strokeWidth="3" />
      <rect x="22" y="492" width="210" height="106" fill={lite} stroke={dark} strokeWidth="3" />
      <path d="M30 500L224 590M224 500L30 590" stroke={brass} strokeWidth="6" />
      <Boss x={127} y={545} r={8} fill={url(I('k'))} hi={spark} />
      <path d="M212 286C218 278 226 278 232 286C226 296 218 296 212 286Z" fill={brass} />
      <circle cx="222" cy="312" r="16" fill="none" stroke={brass} strokeWidth="4.4" />
      {[70, 320, 560].map((y) => (
        <path key={y} d={`M0 ${y - 7}H62L74 ${y}L62 ${y + 7}H0Z`} fill={brass} />
      ))}
      <rect x="240" y="0" width="10" height="620" fill={brass} />
      {full ? <path d="M245 8V612" stroke={url(I('k'))} strokeWidth="7" strokeDasharray="0.1 26" strokeLinecap="round" /> : null}
      <Lighting p={p} I={I} d={DOOR_LEAF} mirror={mirror} />
      <rect x="248" y="0" width="2" height="620" fill={p.light.color} opacity="0.85" />
    </>
  );
}

/** House-gate leaf: a teak frame whose upper half is a wrought-iron grille (the house shows through), raised panels below, a hasp. */
function HouseGateLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const teak = woodOf(c, 'houseGate');
  const lite = tint(teak, 0.12);
  const dark = shade(teak, 0.3);
  const iron = mix(c.primary, '#1f1d1d', 0.8);
  const gold = url(I('g'));
  const solid = `${DOOR_LEAF} M18 18H232V300H18Z`;
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={250} y2={120} />
        <Grain id={I('wg')} wood={teak} seed={13} />
      </defs>
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M${29 + i * 22} 18V300`} stroke={iron} strokeWidth="3.2" />
      ))}
      <path d="M18 62H232M18 256H232" stroke={iron} strokeWidth="3.6" />
      {full ? Array.from({ length: 5 }, (_, i) => <path key={i} d={arch(18 + i * 43, 61 + i * 43, 62, 32, 62)} fill="none" stroke={iron} strokeWidth="2.6" />) : null}
      <path d="M250 98A62 62 0 0 0 250 222" fill="none" stroke={iron} strokeWidth="5" />
      <path d="M250 124A36 36 0 0 0 250 196" fill="none" stroke={iron} strokeWidth="3" />
      <path d="M250 160C220 130 196 150 208 170C216 182 232 172 226 162" fill="none" stroke={iron} strokeWidth="3" />
      <path d="M250 136A24 24 0 0 0 250 184Z" fill={gold} />
      <path d="M250 146A14 14 0 0 0 250 174Z" fill={c.accent} />
      <path d="M29 62H232M29 256H232" stroke={gold} strokeWidth="6" strokeDasharray="0.1 22" strokeLinecap="round" />
      <path d="M18 20H232" stroke={gold} strokeWidth="3" />
      <path d={solid} fill={teak} fillRule="evenodd" />
      <path d={solid} fill={url(I('wg'))} fillRule="evenodd" />
      {[356, 486].map((y) => (
        <g key={y}>
          <rect x="26" y={y} width="198" height="110" fill={lite} stroke={dark} strokeWidth="3" />
          <rect x="38" y={y + 12} width="174" height="86" fill="none" stroke={dark} strokeWidth="1.6" />
          {[
            [26, y],
            [224, y],
            [26, y + 110],
            [224, y + 110],
          ].map(([x, yy], k) => (
            <path key={k} d={`M${x! + (k % 2 ? -18 : 18)} ${yy}H${x}V${yy! + (k < 2 ? 18 : -18)}`} fill="none" stroke={gold} strokeWidth="4" />
          ))}
        </g>
      ))}
      <rect x="0" y="300" width="250" height="36" fill={teak} />
      <path d="M0 302H250M0 334H250" stroke={dark} strokeWidth="2" />
      <rect x="206" y="312" width="44" height="12" rx="3" fill={iron} />
      <circle cx="212" cy="318" r="3" fill={gold} />
      <Lighting p={p} I={I} d={solid} mirror={mirror} />
      <rect x="248" y="300" width="2" height="320" fill={p.light.color} opacity="0.8" />
    </>
  );
}

/** Church leaf: oak planks under a pointed head, long iron strap hinges with scrolled ends, nail heads, a ring pull. */
function ChurchLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const oak = woodOf(c, 'church');
  const grain = shade(oak, 0.26);
  const iron = mix(c.primary, '#1d1c1e', 0.8);
  const head = archPoints(0, 500, 142, 52, 0, 0.62).filter(([x]) => x <= 250);
  const shape = `M0 620${poly(head).replace('M', 'L')}L250 620Z`;
  const joints = [0, 41, 83, 125, 167, 209, 250];
  return (
    <>
      <defs>
        {/* Old oak darkens toward the foot, where hands and weather have worked it. */}
        <linearGradient id={I('ok')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(oak, 0.1)} />
          <stop offset="0.55" stopColor={oak} />
          <stop offset="1" stopColor={shade(oak, 0.2)} />
        </linearGradient>
      </defs>
      <path d={shape} fill={url(I('ok'))} />
      {/* Each plank its own tone, so the leaf reads as boards and not as a painted panel. */}
      {joints.slice(0, -1).map((x0, i) => {
        const x1 = joints[i + 1]!;
        const t = rand(i, 17);
        return <path key={`pk${i}`} d={`M${x0} 620V${r2(yOn(head, x0))}L${x1} ${r2(yOn(head, x1))}V620Z`} fill={t < 0.5 ? '#000000' : '#ffffff'} opacity={r2(t < 0.5 ? 0.04 + t * 0.06 : 0.02 + (t - 0.5) * 0.06)} />;
      })}
      {joints.slice(1, -1).map((x) => (
        <g key={x}>
          <path d={`M${x} ${r2(yOn(head, x) + 2)}V620`} stroke={grain} strokeWidth="2.2" />
          <path d={`M${x + 1.8} ${r2(yOn(head, x) + 3)}V620`} stroke={tint(oak, 0.18)} strokeWidth="0.9" opacity="0.7" />
        </g>
      ))}
      {full
        ? Array.from({ length: 12 }, (_, i) => {
            const x = r2(12 + (i % 6) * 41.6 + rand(i, 3) * 20);
            const y0 = r2(yOn(head, x) + 30 + rand(i, 5) * 140);
            return <path key={i} d={`M${x} ${y0}Q${r2(x + 6)} ${r2(y0 + 120)} ${r2(x - 2)} ${r2(y0 + 260)}`} fill="none" stroke={grain} strokeWidth="0.9" opacity="0.55" />;
          })
        : null}
      {[190, 360, 540].map((y) => (
        <g key={y}>
          {/* Forged strap hinges: a shadow on the boards below, a lit top edge, a spear head between the scrolls. */}
          <rect x="0" y={y + 7} width="186" height="3.5" fill={shade(oak, 0.5)} opacity="0.45" />
          <rect x="0" y={y - 7} width="188" height="14" fill={iron} />
          <path d={`M0 ${y - 5.6}H186`} stroke={tint(iron, 0.42)} strokeWidth="1.3" opacity="0.8" />
          <path d={`M186 ${y - 6}L208 ${y}L186 ${y + 6}Z`} fill={iron} />
          <path d={`M188 ${y - 7}C212 ${y - 18} 228 ${y - 2} 214 ${y + 8}C206 ${y + 13} 198 ${y + 5} 204 ${y + 1}M188 ${y + 7}C200 ${y + 16} 206 ${y + 26} 196 ${y + 30}`} fill="none" stroke={iron} strokeWidth="4" strokeLinecap="round" />
          {full ? <path d={`M10 ${y}H180`} stroke={tint(iron, 0.35)} strokeWidth="4.4" strokeDasharray="0.1 22" strokeLinecap="round" /> : null}
        </g>
      ))}
      <path d="M222 304L236 330L222 356L208 330Z" fill={iron} />
      <circle cx="222" cy="352" r="18" fill="none" stroke={iron} strokeWidth="4.6" />
      {full ? <path d="M30 236H230M30 266H230M30 296H230" stroke={tint(iron, 0.3)} strokeWidth="4" strokeDasharray="0.1 30" strokeLinecap="round" /> : null}
      <Lighting p={p} I={I} d={shape} mirror={mirror} />
      <rect x="248" y={r2(yOn(head, 248))} width="2" height="560" fill={p.light.color} opacity="0.85" />
    </>
  );
}

/** Cedar leaf: carved deodar, a great girih star whose half meets its twin at the seam, a khatamband lattice below. */
function CedarLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const cedar = woodOf(c, 'cedar');
  const lite = tint(cedar, 0.14);
  const dark = shade(cedar, 0.32);
  const gold = url(I('g'));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={250} y2={120} />
        <Grain id={I('wg')} wood={cedar} seed={7} />
        <Girih id={I('gi')} color={dark} s={34} width={2.4} bg={lite} />
        <pattern id={I('kh')} width="30" height="18" patternUnits="userSpaceOnUse" x="16" y="322">
          <rect width="30" height="18" fill={lite} />
          <path d="M0 0.8H30M0 9.8H30M0.8 0V9M15.8 9V18" stroke={dark} strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect width="250" height="620" fill={cedar} />
      <rect width="250" height="620" fill={url(I('wg'))} />
      <rect x="16" y="18" width="234" height="284" fill={url(I('gi'))} />
      <path d={octagram(250, 160, 96)} fill={cedar} stroke={gold} strokeWidth="3" />
      <path d={octagram(250, 160, 60)} fill={dark} stroke={gold} strokeWidth="2" />
      <g transform="translate(250 160)">
        {turns(5, 45, (a) => (
          <path key={a} d="M0 -34C8 -24 8 -14 0 -8C-8 -14 -8 -24 0 -34Z" fill={c.accent} transform={`rotate(${a})`} />
        ), -180)}
      </g>
      <rect x="16" y="18" width="234" height="284" fill="none" stroke={dark} strokeWidth="3" />
      {full ? <rect x="16" y="322" width="218" height="278" fill={url(I('kh'))} /> : <rect x="16" y="322" width="218" height="278" fill={lite} />}
      <rect x="16" y="322" width="218" height="278" fill="none" stroke={dark} strokeWidth="3" />
      <circle cx="228" cy="334" r="12" fill="none" stroke={gold} strokeWidth="3.6" />
      <rect x="238" y="302" width="12" height="318" fill={dark} />
      <Lighting p={p} I={I} d={DOOR_LEAF} mirror={mirror} />
      <rect x="248" y="0" width="2" height="620" fill={p.light.color} opacity="0.85" />
    </>
  );
}

/** Ballroom leaf: painted ivory, an arched mirror light in gilt muntins, a gilt-moulded panel with a rosette and swags, a tall handle. */
function BallroomLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const ivory = woodOf(c, 'ballroom');
  const gilt = url(I('g'));
  const glassTop = archPoints(30, 220, 92, 30, 0, 0.55);
  const glass = arch(30, 220, 92, 30, 300, 0, 0.55);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={250} y2={140} />
        <linearGradient id={I('gl')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(c.background, 0.9)} />
          <stop offset="0.5" stopColor={mix(c.accent, p.light.color, 0.4)} />
          <stop offset="1" stopColor={mix(c.primary, c.accent, 0.55)} />
        </linearGradient>
      </defs>
      <rect width="250" height="620" fill={ivory} />
      <path d={glass} fill={url(I('gl'))} />
      {full ? <path d="M50 280L160 60M120 290L200 130" stroke={tint(c.background, 0.95)} strokeWidth="8" opacity="0.35" /> : null}
      {[93, 157].map((x) => (
        <path key={x} d={`M${x} ${yOn(glassTop, x)}V300`} stroke={gilt} strokeWidth="2.6" />
      ))}
      <path d="M30 150H220M30 226H220" stroke={gilt} strokeWidth="2.6" />
      <path d={glass} fill="none" stroke={gilt} strokeWidth="4.4" />
      <rect x="20" y="318" width="210" height="22" fill="none" stroke={gilt} strokeWidth="2" />
      {full ? <path d="M28 329H222" stroke={gilt} strokeWidth="4" strokeDasharray="0.1 8" strokeLinecap="round" /> : null}
      <rect x="30" y="360" width="190" height="230" fill="none" stroke={gilt} strokeWidth="3" />
      <rect x="42" y="372" width="166" height="206" fill="none" stroke={gilt} strokeWidth="1.2" />
      <path d="M42 384Q125 440 208 384" fill="none" stroke={gilt} strokeWidth="2.4" />
      <g transform="translate(125 476)">
        {turns(8, 45, (a) => (
          <path key={a} d="M0 -26C7 -18 7 -10 0 -6C-7 -10 -7 -18 0 -26Z" fill={gilt} transform={`rotate(${a})`} />
        ))}
        <circle r="6" fill={c.accent} />
        <path d="M-12 -34C-24 -46 -6 -50 0 -38C6 -50 24 -46 12 -34" fill="none" stroke={gilt} strokeWidth="2.6" />
      </g>
      <rect x="226" y="286" width="9" height="96" rx="4.5" fill={gilt} />
      <circle cx="230.5" cy="286" r="7" fill={tint(c.background, 0.8)} stroke={gilt} strokeWidth="1.6" />
      <circle cx="230.5" cy="382" r="7" fill={tint(c.background, 0.8)} stroke={gilt} strokeWidth="1.6" />
      <Lighting p={p} I={I} d={DOOR_LEAF} mirror={mirror} />
      <rect x="248" y="0" width="2" height="620" fill={p.light.color} opacity="0.85" />
    </>
  );
}

/** Haveli door leaf: studded dark wood, a cusped niche panel with a brass vase of flowers, iron straps, a ring. */
function HaveliDoorLeaf({ p, I, mirror }: LeafArt) {
  const c = p.colors;
  const full = p.detail === 'full';
  const wood = woodOf(c, 'haveli');
  const dark = shade(wood, 0.3);
  const iron = mix(c.primary, '#232022', 0.8);
  const gilt = url(I('g'));
  const niche = arch(36, 214, 132, 40, 322, 4);
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={250} y2={140} />
        <Lit id={I('k')} base={c.secondary} light={0.5} dark={0.32} />
        <Grain id={I('wg')} wood={wood} seed={5} />
        <pattern id={I('st')} width="28" height="28" patternUnits="userSpaceOnUse" x="6" y="6">
          <circle cx="14" cy="14" r="4.2" fill={url(I('k'))} />
        </pattern>
      </defs>
      <rect width="250" height="620" fill={wood} />
      <rect width="250" height="620" fill={url(I('wg'))} />
      {full ? <rect x="6" y="6" width="232" height="608" fill={url(I('st'))} /> : null}
      <path d={niche} fill={tint(wood, 0.12)} stroke={gilt} strokeWidth="3.4" />
      <path d="M100 312C94 290 106 274 125 272C144 274 156 290 150 312Z" fill={gilt} />
      <path d="M125 272C125 230 125 196 125 150M125 250C108 226 90 220 74 210M125 236C142 214 160 208 176 198" fill="none" stroke={gilt} strokeWidth="2.6" />
      {[
        [125, 140, 15],
        [70, 204, 12],
        [180, 192, 12],
      ].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          {turns(6, 60, (a) => (
            <ellipse key={a} cx="0" cy={-r! / 2} rx={r! / 3.4} ry={r! / 2} fill={c.accent} transform={`rotate(${a})`} />
          ))}
          <circle r={r! / 4} fill={gilt} />
        </g>
      ))}
      {[360, 560].map((y) => (
        <g key={y}>
          <rect x="0" y={y} width="250" height="16" fill={iron} />
          <path d={`M8 ${y + 8}H246`} stroke={tint(iron, 0.35)} strokeWidth="4" strokeDasharray="0.1 20" strokeLinecap="round" />
        </g>
      ))}
      <path d="M226 384L234 396L226 408L218 396Z" fill={gilt} />
      <circle cx="226" cy="422" r="15" fill="none" stroke={gilt} strokeWidth="4.2" />
      <rect x="238" y="0" width="12" height="620" fill={dark} />
      <Lighting p={p} I={I} d={DOOR_LEAF} mirror={mirror} />
      <rect x="248" y="0" width="2" height="620" fill={p.light.color} opacity="0.8" />
    </>
  );
}

const DOOR_LEAVES: Record<DoorStyle, (a: LeafArt) => ReactNode> = {
  temple: TempleLeaf,
  houseGate: HouseGateLeaf,
  church: ChurchLeaf,
  cedar: CedarLeaf,
  ballroom: BallroomLeaf,
  haveli: HaveliDoorLeaf,
};

/** A leaf's thickness (24 deep): end grain in the leaf's wood, the straps' ends in metal. */
function DoorEdge({ p, I, variant }: Art & { variant: DoorStyle }) {
  const c = p.colors;
  const wood = shade(woodOf(c, variant), variant === 'ballroom' ? 0.08 : 0.18);
  const metal = variant === 'church' || variant === 'haveli' ? mix(c.primary, '#1d1c1e', 0.8) : url(I('g'));
  const straps = variant === 'church' ? [190, 360, 540] : variant === 'haveli' ? [360, 560] : variant === 'temple' ? [70, 320, 560] : [];
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={24} y2={0} />
      </defs>
      <rect width="24" height="620" fill={wood} />
      {variant === 'ballroom' ? (
        <path d="M2 0V620M22 0V620" stroke={url(I('g'))} strokeWidth="2" />
      ) : (
        <path d={`M6 0Q8 ${r2(150 + rand(p.seed, 3) * 80)} 6 620M13 0Q11 310 14 620M19 0Q20 ${r2(400 + rand(p.seed, 5) * 80)} 18 620`} fill="none" stroke={shade(wood, 0.22)} strokeWidth="0.9" />
      )}
      {straps.map((y) => (
        <rect key={y} x="0" y={y - 7} width="24" height="14" fill={metal} />
      ))}
      <rect x="0" y="0" width="1.6" height="620" fill={p.light.rim} opacity="0.7" />
    </>
  );
}

/** Doorway: carved leaves with real thickness (edges 24 deep) in a frame; the seam's light is a light piece. */
export function DoorCover(props: DrawProps & DoorCoverOptions) {
  const { part, variant } = props;
  const I = idsOf(props, `d${variant}${part}`);
  if (part === 'frame') {
    const Frame = DOOR_FRAMES[variant];
    return (
      <Svg w={700} h={760}>
        <Frame p={props} I={I} />
      </Svg>
    );
  }
  if (part === 'edgeL' || part === 'edgeR')
    return (
      <Svg w={24} h={620}>
        <DoorEdge p={props} I={I} variant={variant} />
      </Svg>
    );
  const Leaf = DOOR_LEAVES[variant];
  const mirror = part === 'leafR';
  return (
    <Svg w={250} h={620}>
      <g transform={mirror ? 'translate(250 0) scale(-1 1)' : undefined}>
        <Leaf p={props} I={I} mirror={mirror} />
      </g>
    </Svg>
  );
}

// ─────────────────────────── Silk (silk) ───────────────────────────
// Six bands of one परदा (a stage or temple curtain, never a bride's veil). Each
// band draws its slice of the whole drape: pleats run on x and patterns are
// shifted by the band's place, so the closed drape reads as one cloth; each
// band's lower edge is a little darker (the underside, seen as it turns up).

/** Each silk band's box runs this many units past its pitch, under the next band, so no seam shows between them. */
export const SILK_OVERLAP = 2;

/** How far a colour is from grey (0 grey … 1 a pure hue): its channels' spread. */
function chromaOf(c: string): number {
  const n = Number.parseInt(hex(c).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (Math.max(...ch) - Math.min(...ch)) / 255;
}

/**
 * The drape's cloth. Velvet takes the palette's primary; a near-black primary is lifted a little, and one that is
 * also near grey (a midnight or charcoal) takes a fifth of the secondary, so the velvet reads as a deep jewel tone
 * and never as grey felt.
 */
function clothOf(variant: SilkStyle, c: ThemeColors): string {
  return variant === 'velvet'
    ? lum(c.primary) < 0.14
      ? chromaOf(c.primary) < 0.12
        ? mix(c.primary, c.secondary, 0.2)
        : tint(c.primary, 0.1)
      : c.primary
    : variant === 'temple'
      ? mix(c.primary, '#a3161c', 0.55)
      : variant === 'dawn'
        ? mix(c.background, '#fff6e6', 0.5)
        : variant === 'organza'
          ? mix(c.secondary, c.background, 0.62)
          : mix(c.accent, c.secondary, 0.3);
}

/**
 * Silk: one of six bands of a परदा (a stage or temple curtain, never a bride's veil).
 * The drape is 15% larger than the frame at the start pose, so its top and
 * bottom 7.5% never reach a screen: the heading border sits low in the top band
 * and the hem's border and fringe end at 55% of the hem band (the stage shows
 * below the fringe, as under a real curtain). Light falls on the whole drape
 * at once (gradients in drape coordinates), never band by band.
 */
export function SilkCover(props: DrawProps & SilkCoverOptions) {
  const { w, h, colors: c, variant, band, bands } = props;
  const full = props.detail === 'full';
  const I = idsOf(props, `s${variant}${band}`);
  const head = band === 0;
  const hem = band === bands - 1;
  const pitch = r2(Math.max(1, h - SILK_OVERLAP));
  const y0 = r2(band * pitch);
  const H = r2(bands * pitch);
  const cloth = clothOf(variant, c);
  const depth = variant === 'velvet' ? 0.42 : variant === 'temple' ? 0.24 : variant === 'damask' ? 0.2 : 0.12;
  // Velvet's crests catch the stage light (a warm sheen, not a grey one).
  const lite = variant === 'velvet' ? mix(tint(cloth, 0.22), props.light.color, 0.22) : tint(cloth, 0.16);
  const deep = shade(cloth, depth);
  const ink = shade(c.text, 0.5);
  const period = r2(w / 13);
  const saffron = mix(c.secondary, '#f08a1c', 0.5);
  const gold = url(I('g'));
  const shift = `translate(0 ${-y0})`;
  const f = props.light.from;
  const backlit = f === 'far';
  // The hem band: cloth to `fall`, the border to `edge`, the fringe to `tips`; transparent below.
  const fall = r2(pitch * 0.3);
  const edge = r2(pitch * 0.42);
  const tips = r2(pitch * 0.55);
  const clothH = hem ? edge : h;
  const [lx1, ly1, lx2, ly2] = f === 'left' ? [0, 0, w, 0] : f === 'right' ? [w, 0, 0, 0] : f === 'below' ? [0, r2(H - y0), 0, -y0] : [0, -y0, 0, r2(H - y0)];
  const bandY = (k: number) => r2(pitch * k);
  const swags = Math.ceil(w / 120);
  return (
    <Svg w={w} h={h}>
      <defs>
        {/* A theatre curtain's trim is gold whatever the palette (a blue or pink secondary made it read as tin). */}
        <Metal id={I('g')} base={variant === 'velvet' ? mix('#c9a24a', c.secondary, 0.15) : c.secondary} x2={r2(w / 6)} y2={r2(h / 2)} />
        <linearGradient id={I('pl')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={period} y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor={lite} />
          <stop offset="0.3" stopColor={cloth} />
          <stop offset="0.62" stopColor={deep} />
          <stop offset="0.86" stopColor={cloth} />
          <stop offset="1" stopColor={lite} />
        </linearGradient>
        <linearGradient id={I('p2')} gradientUnits="userSpaceOnUse" x1={r2(w * 0.013)} y1="0" x2={r2(period * 2.37 + w * 0.013)} y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor={ink} stopOpacity="0" />
          <stop offset="0.5" stopColor={ink} stopOpacity={variant === 'velvet' ? 0.2 : 0.1} />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={I('us')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink} stopOpacity="0" />
          <stop offset="1" stopColor={ink} stopOpacity="0.09" />
        </linearGradient>
        {backlit ? (
          <radialGradient id={I('lt')} gradientUnits="userSpaceOnUse" cx={r2(w / 2)} cy={r2(H * 0.45 - y0)} r={r2(w * 0.5)}>
            <stop offset="0" stopColor={props.light.color} stopOpacity={variant === 'velvet' ? 0.22 : 0.34} />
            <stop offset="1" stopColor={props.light.color} stopOpacity="0" />
          </radialGradient>
        ) : (
          <linearGradient id={I('lt')} gradientUnits="userSpaceOnUse" x1={lx1} y1={ly1} x2={lx2} y2={ly2}>
            <stop offset="0" stopColor={props.light.color} stopOpacity="0.14" />
            <stop offset="0.5" stopColor={ink} stopOpacity="0" />
            <stop offset="1" stopColor={ink} stopOpacity="0.25" />
          </linearGradient>
        )}
        {variant === 'dawn' ? (
          <linearGradient id={I('dw')} gradientUnits="userSpaceOnUse" x1="0" y1={-y0} x2="0" y2={r2(H - y0)}>
            <stop offset="0" stopColor={cloth} />
            <stop offset="0.45" stopColor={mix(cloth, saffron, 0.22)} />
            <stop offset="1" stopColor={mix(saffron, cloth, 0.15)} />
          </linearGradient>
        ) : null}
        {variant === 'damask' ? (
          <pattern id={I('m')} width="96" height="128" patternUnits="userSpaceOnUse" patternTransform={shift}>
            {[
              [48, 64],
              [0, 0],
              [96, 0],
              [0, 128],
              [96, 128],
            ].map(([x, y]) => (
              <g key={`${x}${y}`} transform={`translate(${x! - 48} ${y! - 64})`}>
                <path d="M48 12C64 30 70 46 58 62C70 78 64 96 48 116C32 96 26 78 38 62C26 46 32 30 48 12Z" fill={shade(cloth, 0.16)} opacity="0.75" />
                <path d="M48 40C54 50 54 56 48 64C42 56 42 50 48 40Z M48 70C56 78 56 86 48 94C40 86 40 78 48 70Z" fill={tint(cloth, 0.3)} opacity="0.7" />
              </g>
            ))}
          </pattern>
        ) : null}
        {variant === 'organza' ? (
          <pattern id={I('m')} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform={shift}>
            <circle cx="5" cy="5" r="2.2" fill={tint(cloth, 0.7)} />
            <circle cx="16" cy="16" r="1.5" fill={tint(cloth, 0.55)} />
          </pattern>
        ) : null}
        {variant === 'dawn' ? (
          <pattern id={I('m')} width="56" height="64" patternUnits="userSpaceOnUse" patternTransform={shift}>
            <path d="M14 10C18 15 18 20 14 24C10 20 10 15 14 10Z" fill={c.secondary} opacity="0.55" />
            <circle cx="42" cy="44" r="1.8" fill={c.secondary} opacity="0.6" />
          </pattern>
        ) : null}
        {variant === 'temple' ? (
          <pattern id={I('m')} width="64" height="72" patternUnits="userSpaceOnUse" patternTransform={shift}>
            <path d="M32 18C40 26 40 38 32 46C24 38 24 26 32 18Z M20 32Q32 36 44 32" fill="none" stroke={c.secondary} strokeWidth="1.8" />
            <circle cx="0" cy="0" r="3" fill={c.secondary} />
            <circle cx="64" cy="0" r="3" fill={c.secondary} />
            <circle cx="0" cy="72" r="3" fill={c.secondary} />
            <circle cx="64" cy="72" r="3" fill={c.secondary} />
          </pattern>
        ) : null}
        {variant === 'temple' ? (
          <pattern id={I('t')} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform={shift}>
            <rect width="28" height="28" fill={mix(c.secondary, cloth, 0.15)} />
            <path d="M3 24L14 6L25 24Z" fill={shade(cloth, 0.1)} />
            <circle cx="14" cy="18" r="2.4" fill={c.accent} />
          </pattern>
        ) : null}
      </defs>
      <rect width={w} height={clothH} fill={variant === 'dawn' ? url(I('dw')) : url(I('pl'))} />
      {variant === 'dawn' ? <rect width={w} height={clothH} fill={url(I('pl'))} opacity="0.4" /> : null}
      {variant !== 'velvet' && full ? <rect width={w} height={clothH} fill={url(I('m'))} /> : null}
      {variant === 'temple' ? (
        <g>
          <rect x="0" y="0" width="56" height={clothH} fill={url(I('t'))} />
          <rect x={r2(w - 56)} y="0" width="56" height={clothH} fill={url(I('t'))} />
          <path d={`M58 0V${clothH}M${r2(w - 58)} 0V${clothH}`} stroke={gold} strokeWidth="3" />
        </g>
      ) : null}
      <rect width={w} height={clothH} fill={url(I('p2'))} />
      <rect width={w} height={clothH} fill={url(I('lt'))} />
      {!hem ? <rect x="0" y={bandY(0.86)} width={w} height={r2(h - bandY(0.86))} fill={url(I('us'))} /> : null}

      {head && variant === 'velvet' ? (
        <g>
          <path d={`M0 ${bandY(0.56)}H${w}`} stroke={gold} strokeWidth="5" />
          <path d={`M0 ${bandY(0.62)}${Array.from({ length: swags }, (_, i) => `Q${r2(i * 120 + 60)} ${bandY(0.98)} ${r2(i * 120 + 120)} ${bandY(0.62)}`).join('')}`} fill="none" stroke={shade(cloth, 0.35)} strokeWidth="6" />
          <path d={`M0 ${bandY(0.66)}${Array.from({ length: swags }, (_, i) => `Q${r2(i * 120 + 60)} ${bandY(1.02)} ${r2(i * 120 + 120)} ${bandY(0.66)}`).join('')}`} fill="none" stroke={gold} strokeWidth="9" strokeDasharray="1.6 2.4" />
          {Array.from({ length: swags + 1 }, (_, i) => (
            <g key={i}>
              <circle cx={r2(i * 120)} cy={bandY(0.64)} r="5" fill={gold} />
              <path d={`M${r2(i * 120 - 4)} ${bandY(0.68)}H${r2(i * 120 + 4)}L${r2(i * 120 + 6)} ${bandY(0.94)}H${r2(i * 120 - 6)}Z`} fill={gold} />
            </g>
          ))}
        </g>
      ) : null}
      {head && variant === 'damask' ? (
        <g>
          <rect x="0" y={bandY(0.66)} width={w} height={bandY(0.16)} fill={gold} />
          <path d={`M0 ${bandY(0.74)}H${w}`} stroke={shade(c.secondary, 0.35)} strokeWidth="4" strokeDasharray="0.1 12" strokeLinecap="round" />
        </g>
      ) : null}
      {head && variant === 'temple' ? (
        <g>
          <rect x="0" y={bandY(0.58)} width={w} height={bandY(0.28)} fill={url(I('t'))} />
          <path d={`M0 ${bandY(0.58)}H${w}M0 ${bandY(0.86)}H${w}`} stroke={gold} strokeWidth="3" />
        </g>
      ) : null}
      {head && variant === 'dawn' ? <path d={`M0 ${bandY(0.7)}H${w}M0 ${bandY(0.76)}H${w}`} stroke={gold} strokeWidth="1.6" /> : null}
      {head && variant === 'organza' ? (
        <g>
          <rect x="0" y={bandY(0.66)} width={w} height={bandY(0.1)} fill={c.accent} />
          {Array.from({ length: Math.floor(w / 200) }, (_, i) => (
            <path key={i} d={`M${r2(100 + i * 200)} ${bandY(0.71)}l-16 -10v20Zl16 -10v20Z`} fill={shade(c.accent, 0.12)} />
          ))}
        </g>
      ) : null}

      {hem && variant === 'velvet' ? (
        <g>
          <rect x="0" y={fall} width={w} height={r2(edge - fall)} fill={gold} />
          {full ? <path d={`M0 ${r2((fall + edge) / 2)}H${w}`} stroke={shade(c.secondary, 0.35)} strokeWidth="5" strokeDasharray="0.1 9" strokeLinecap="round" /> : null}
          <path d={`M0 ${r2((edge + tips) / 2)}H${w}`} stroke={gold} strokeWidth={r2(tips - edge)} strokeDasharray="2.2 2.6" />
          {Array.from({ length: Math.floor(w / 90) }, (_, i) => (
            <path key={i} d={`M${r2(45 + i * 90 - 4)} ${edge}H${r2(45 + i * 90 + 4)}L${r2(45 + i * 90 + 7)} ${r2(tips + 6)}H${r2(45 + i * 90 - 7)}Z`} fill={gold} />
          ))}
        </g>
      ) : null}
      {hem && variant === 'damask' ? (
        <g>
          <rect x="0" y={fall} width={w} height={r2(edge - fall)} fill={gold} />
          <path d={`M0 ${r2((fall + edge) / 2)}H${w}`} stroke={c.primary} strokeWidth="3" strokeDasharray="10 6" />
          <path d={`M0 ${r2((edge + tips) / 2)}H${w}`} stroke={gold} strokeWidth={r2(tips - edge)} strokeDasharray="2 5" />
        </g>
      ) : null}
      {hem && variant === 'temple' ? (
        <g>
          <rect x="0" y={r2(fall - 10)} width={w} height={r2(edge - fall + 10)} fill={url(I('t'))} />
          <path d={`M0 ${r2(fall - 10)}H${w}M0 ${edge}H${w}`} stroke={gold} strokeWidth="3" />
          {Array.from({ length: Math.floor(w / 40) }, (_, i) => (
            <g key={i}>
              <path d={`M${r2(20 + i * 40)} ${edge}V${r2(edge + 6)}`} stroke={gold} strokeWidth="1.4" />
              <path d={bellPath(r2(20 + i * 40), r2(edge + 6), 0.55)} fill={gold} />
            </g>
          ))}
        </g>
      ) : null}
      {hem && variant === 'dawn' ? (
        <g>
          <rect x="0" y={fall} width={w} height={r2(edge - fall)} fill={shade(saffron, 0.1)} />
          <path d={`M0 ${fall}H${w}M0 ${edge}H${w}`} stroke={gold} strokeWidth="2.4" />
          <path d={`M0 ${r2((fall + edge) / 2)}H${w}`} stroke={gold} strokeWidth="5" strokeDasharray="0.1 14" strokeLinecap="round" />
          <path d={`M0 ${r2((edge + tips) / 2)}H${w}`} stroke={saffron} strokeWidth={r2(tips - edge)} strokeDasharray="1 3" opacity="0.8" />
        </g>
      ) : null}
      {hem && variant === 'organza' ? (
        <g>
          <path d={`M0 ${r2(edge - 1)}${Array.from({ length: Math.ceil(w / 40) }, (_, i) => `Q${r2(i * 40 + 20)} ${r2(tips + 8)} ${r2(i * 40 + 40)} ${r2(edge - 1)}`).join('')}Z`} fill={cloth} />
          <path d={`M0 ${r2(edge + 3)}${Array.from({ length: Math.ceil(w / 40) }, (_, i) => `Q${r2(i * 40 + 20)} ${r2(tips + 4)} ${r2(i * 40 + 40)} ${r2(edge + 3)}`).join('')}`} fill="none" stroke={tint(cloth, 0.75)} strokeWidth="2.4" strokeDasharray="0.1 6" strokeLinecap="round" />
          <path d={`M0 ${r2(edge - 8)}H${w}`} stroke={c.accent} strokeWidth="3" />
        </g>
      ) : null}
    </Svg>
  );
}

// ─────────────────────────── Card (unfold) ───────────────────────────
// A tri-fold card: three 180 × 300 panels. Closed, the right panel lies over
// the others and its back (the same art, mirrored) is the card's cover, so the
// seal sits on its centre. Panels carry ornament, never words.

type CardArt = (a: Art & { part: Exclude<CardPart, 'seal'> }) => ReactNode;
const PANEL = 'M0 0H180V300H0Z';

/** A laurel wreath round (cx, cy): two branches of leaves along cubic arcs, a bow at the foot. */
function Laurel({ cx, cy, r, fill, bow }: { cx: number; cy: number; r: number; fill: string; bow: string }) {
  const s = r / 44;
  const branch: Segment = [
    [-6, 44],
    [-42, 40],
    [-56, 4],
    [-36, -36],
  ];
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r2(s)})`}>
      {[1, -1].map((k) => (
        <g key={k} transform={`scale(${k} 1)`}>
          <path d="M-6 44C-42 40 -56 4 -36 -36" fill="none" stroke={fill} strokeWidth="1.6" />
          {Array.from({ length: 9 }, (_, i) => {
            const q = onCubic(branch, (i + 0.6) / 9.6);
            return <ellipse key={i} cx="-4" cy="-3" rx="3.4" ry="7.6" fill={fill} transform={frameAt(q)} />;
          })}
        </g>
      ))}
      <path d="M-8 44L-16 56M8 44L16 56" stroke={bow} strokeWidth="3" />
      <circle cx="0" cy="44" r="4" fill={bow} />
    </g>
  );
}

const TrifoldPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const full = p.detail === 'full';
  const stock = mix(c.background, '#fffdf7', 0.5);
  const gold = url(I('g'));
  const corner = (
    <path d="M18 34C18 24 24 18 34 18M18 26C22 22 26 22 28 26C30 30 26 32 24 30" fill="none" stroke={gold} strokeWidth="1.2" />
  );
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={180} y2={120} />
      </defs>
      <rect x="1.5" y="1.5" width="177" height="297" rx="3" fill={stock} stroke={gold} strokeWidth="3" />
      <rect x="12" y="12" width="156" height="276" fill="none" stroke={gold} strokeWidth="0.9" />
      <rect x="16" y="16" width="148" height="268" fill="none" stroke={gold} strokeWidth="0.5" />
      {[0, 1, 2, 3].map((k) => (
        <g key={k} transform={`translate(${k % 2 ? 180 : 0} ${k > 1 ? 300 : 0}) scale(${k % 2 ? -1 : 1} ${k > 1 ? -1 : 1})`}>
          {corner}
        </g>
      ))}
      {part === 'panelC' ? (
        <g transform="translate(90 150)">
          {turns(16, 22.5, (a) => (
            <path key={a} d="M0 -50C8 -42 8 -32 0 -26C-8 -32 -8 -42 0 -50Z" fill="none" stroke={gold} strokeWidth="1.2" transform={`rotate(${a})`} />
          ))}
          {turns(8, 45, (a) => (
            <path key={a} d="M0 -24C6 -18 6 -11 0 -7C-6 -11 -6 -18 0 -24Z" fill={c.accent} transform={`rotate(${a})`} />
          ), 22.5)}
          <circle r="56" fill="none" stroke={gold} strokeWidth="0.8" />
          {full ? <circle r="60" fill="none" stroke={gold} strokeWidth="2" strokeDasharray="0.1 6" strokeLinecap="round" /> : null}
          <circle r="5" fill={gold} />
        </g>
      ) : (
        <g>
          <path d={arch(30, 150, 100, 44, 266, 4)} fill={tint(c.accent, 0.55)} opacity="0.4" />
          <path d={arch(30, 150, 100, 44, 266, 4)} fill="none" stroke={gold} strokeWidth="1.4" />
          <path d={bellPath(90, 66, 0.7)} fill={gold} />
          <g transform="translate(90 246)">
            {turns(5, 36, (a) => (
              <path key={a} d="M0 -16C5 -11 5 -6 0 -2C-5 -6 -5 -11 0 -16Z" fill={c.accent} stroke={gold} strokeWidth="0.6" transform={`rotate(${a})`} />
            ), -72)}
          </g>
        </g>
      )}
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const FolioPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const cover = mix(c.primary, '#0d2a33', 0.1);
  const gold = url(I('g'));
  const big = part === 'panelC';
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={180} y2={140} />
        <Girih id={I('gi')} color={c.secondary} s={14} width={1.1} />
      </defs>
      <rect width="180" height="300" rx="3" fill={cover} />
      <rect x="10" y="10" width="160" height="280" fill="none" stroke={url(I('gi'))} strokeWidth="14" />
      <rect x="2.5" y="2.5" width="175" height="295" rx="2" fill="none" stroke={gold} strokeWidth="2" />
      <rect x="20" y="20" width="140" height="260" fill="none" stroke={gold} strokeWidth="1" />
      {big ? (
        <g>
          <path d={octagram(90, 150, 46)} fill="none" stroke={gold} strokeWidth="2" />
          <path d={octagram(90, 150, 26)} fill={gold} />
          <circle cx="90" cy="150" r="9" fill={c.accent} />
        </g>
      ) : (
        <g>
          <path d={octagram(90, 70, 18)} fill={gold} />
          <path d={octagram(90, 230, 18)} fill={gold} />
          <path d="M90 92V208" stroke={gold} strokeWidth="1" strokeDasharray="3 4" />
          <path d={octagram(90, 150, 36)} fill="none" stroke={gold} strokeWidth="1.2" />
        </g>
      )}
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const PatraPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const full = p.detail === 'full';
  const leaf = mix(c.primary, '#d8bd84', 0.85);
  const edge = shade(leaf, 0.32);
  const ink = shade(c.primary, 0.35);
  const cord = mix(c.accent, c.primary, 0.45);
  const strips = [0, 1, 2, 3, 4].map((i) => r2(3 + i * 59));
  return (
    <>
      <defs>
        <linearGradient id={I('burn')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={edge} stopOpacity="0.55" />
          <stop offset="0.12" stopColor={edge} stopOpacity="0" />
          <stop offset="0.88" stopColor={edge} stopOpacity="0" />
          <stop offset="1" stopColor={edge} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {strips.map((y, i) => (
        <g key={y}>
          <rect x="2" y={y} width="176" height="55" rx="11" fill={leaf} stroke={edge} strokeWidth="1.2" />
          {full ? <path d={`M10 ${r2(y + 14)}H170M8 ${r2(y + 28)}H172M10 ${r2(y + 42)}H170`} stroke={shade(leaf, 0.12)} strokeWidth="0.7" /> : null}
          <rect x="2" y={y} width="176" height="55" rx="11" fill={url(I('burn'))} />
          <path d={`M22 ${r2(y + 8)}V${r2(y + 47)}M26 ${r2(y + 8)}V${r2(y + 47)}M154 ${r2(y + 8)}V${r2(y + 47)}M158 ${r2(y + 8)}V${r2(y + 47)}`} stroke={ink} strokeWidth="0.8" />
          {i !== 2 && full ? <path d={`M38 ${r2(y + 28)}H142`} stroke={ink} strokeWidth="2.4" strokeDasharray="0.1 9" strokeLinecap="round" /> : null}
          <circle cx="50" cy={r2(y + 27.5)} r="3.4" fill={edge} />
          <circle cx="130" cy={r2(y + 27.5)} r="3.4" fill={edge} />
        </g>
      ))}
      <g transform="translate(90 150)" fill="none" stroke={ink} strokeWidth="1.2">
        {turns(7, 24, (a) => <path key={a} d="M0 -2C7 -10 7 -18 0 -24C-7 -18 -7 -10 0 -2Z" transform={`rotate(${a})`} />, -72)}
        <path d="M-30 4Q-15 10 0 4Q15 10 30 4M-24 12Q-12 16 0 12Q12 16 24 12" />
      </g>
      {part === 'panelR' ? (
        <path d="M0 150H180" stroke={cord} strokeWidth="3.4" />
      ) : (
        <path d="M50 0V300M130 0V300" stroke={cord} strokeWidth="2.2" opacity="0.9" />
      )}
      <circle cx={part === 'panelR' ? 30 : 50} cy={part === 'panelR' ? 150 : 292} r="5.4" fill={mix(c.secondary, '#7a4a22', 0.4)} />
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const AlbumPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const leather = mix(c.primary, '#4a2a18', 0.45);
  const gold = url(I('g'));
  const fleuron = <path d="M22 22C30 22 34 26 34 34M22 22C22 30 26 34 34 34M22 22L30 30" fill="none" stroke={gold} strokeWidth="1.4" />;
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={180} y2={140} />
        <pattern id={I('gr')} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.9" fill={shade(leather, 0.2)} />
          <circle cx="5.5" cy="5" r="0.7" fill={tint(leather, 0.1)} />
        </pattern>
      </defs>
      {part === 'panelC' ? (
        <g>
          <rect width="180" height="300" rx="3" fill={mix(c.background, '#f6efe0', 0.5)} />
          <rect x="6" y="6" width="168" height="288" fill="none" stroke={gold} strokeWidth="1.2" />
          <ellipse cx="90" cy="142" rx="56" ry="74" fill={tint(c.accent, 0.4)} stroke={gold} strokeWidth="3" />
          <ellipse cx="90" cy="142" rx="46" ry="64" fill={mix(c.background, c.accent, 0.15)} stroke={gold} strokeWidth="1" />
          <path d="M60 244Q90 262 120 244" fill="none" stroke={gold} strokeWidth="1.4" />
        </g>
      ) : (
        <g>
          <rect width="180" height="300" rx="3" fill={leather} />
          <rect width="180" height="300" rx="3" fill={url(I('gr'))} />
          <rect x="9" y="9" width="162" height="282" fill="none" stroke={gold} strokeWidth="1.6" />
          <rect x="14" y="14" width="152" height="272" fill="none" stroke={gold} strokeWidth="0.7" />
          {[0, 1, 2, 3].map((k) => (
            <g key={k} transform={`translate(${k % 2 ? 180 : 0} ${k > 1 ? 300 : 0}) scale(${k % 2 ? -1 : 1} ${k > 1 ? -1 : 1})`}>
              {fleuron}
            </g>
          ))}
          <Laurel cx={90} cy={146} r={50} fill={gold} bow={c.accent} />
        </g>
      )}
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const CertificatePanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const folder = mix(c.primary, '#1a2342', 0.25);
  const gold = url(I('g'));
  return (
    <>
      <defs>
        <Metal id={I('g')} base={c.secondary} x2={180} y2={140} />
        <pattern id={I('gu')} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6Q3 0 6 6T12 6M0 9Q3 3 6 9T12 9" fill="none" stroke={c.secondary} strokeWidth="0.8" />
        </pattern>
      </defs>
      {part === 'panelC' ? (
        <g>
          <rect width="180" height="300" rx="2" fill={mix(c.background, '#f1e2bf', 0.6)} />
          <rect x="8" y="8" width="164" height="284" fill="none" stroke={url(I('gu'))} strokeWidth="12" />
          <rect x="16" y="16" width="148" height="268" fill="none" stroke={gold} strokeWidth="1" />
          <Laurel cx={90} cy={70} r={22} fill={gold} bow={c.accent} />
          <path d="M40 130H140M50 150H130M40 170H140" stroke={shade(c.secondary, 0.1)} strokeWidth="0.8" strokeDasharray="1 3" />
          <g transform="translate(90 236)">
            <path d="M-8 6L-16 34L-8 30L-4 36L0 10ZM8 6L16 34L8 30L4 36L0 10Z" fill={c.primary} />
            {turns(16, 22.5, (a) => <circle key={a} cx="0" cy="-16" r="4" fill={gold} transform={`rotate(${a})`} />)}
            <circle r="16" fill={gold} />
          </g>
        </g>
      ) : (
        <g>
          <rect width="180" height="300" rx="2" fill={folder} />
          <rect x="8" y="8" width="164" height="284" fill="none" stroke={gold} strokeWidth="2" />
          <rect x="13" y="13" width="154" height="274" fill="none" stroke={gold} strokeWidth="0.7" />
          {[0, 1, 2, 3].map((k) => (
            <path key={k} d="M8 8H34L8 34Z" fill={gold} transform={`translate(${k % 2 ? 180 : 0} ${k > 1 ? 300 : 0}) scale(${k % 2 ? -1 : 1} ${k > 1 ? -1 : 1})`} />
          ))}
          <Laurel cx={90} cy={148} r={50} fill={gold} bow={c.accent} />
        </g>
      )}
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const PosterPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const full = p.detail === 'full';
  return (
    <>
      <defs>
        <pattern id={I('dots')} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="3" fill={c.accent} />
          <circle cx="15" cy="15" r="3" fill={c.accent} />
        </pattern>
        <pattern id={I('chev')} width="40" height="24" patternUnits="userSpaceOnUse">
          <rect width="40" height="24" fill={c.accent} />
          <path d="M0 18L20 4L40 18V24L20 10L0 24Z" fill={c.primary} />
        </pattern>
      </defs>
      {part === 'panelL' ? (
        <g>
          <rect width="180" height="300" fill={c.secondary} />
          {turns(18, 10, (a, i) => (
            <path key={a} d="M0 0L-26 -400H26Z" fill={i % 2 ? c.accent : c.secondary} transform={`translate(90 330) rotate(${a})`} />
          ), -85)}
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${i * 30} 14H${i * 30 + 30}L${i * 30 + 15} 40Z`} fill={i % 2 ? c.primary : c.background} />
          ))}
        </g>
      ) : part === 'panelC' ? (
        <g>
          <rect width="180" height="300" fill={c.background} />
          {full ? <rect width="180" height="300" fill={url(I('dots'))} opacity="0.55" /> : null}
          <g transform="translate(90 150)">
            {turns(8, 45, (a, i) => (
              <path key={a} d="M0 0C10 -20 30 -40 8 -66C-6 -46 -8 -22 0 0Z" fill={i % 2 ? c.primary : c.secondary} transform={`rotate(${a})`} />
            ))}
            <circle r="12" fill={c.accent} stroke={c.primary} strokeWidth="3" />
          </g>
        </g>
      ) : (
        <g>
          <rect width="180" height="300" fill={url(I('chev'))} />
          <path d="M90 70L136 150L90 230L44 150Z" fill={c.secondary} stroke={c.background} strokeWidth="4" />
          <path d="M90 104L116 150L90 196L64 150Z" fill={c.primary} />
        </g>
      )}
      <rect x="3" y="3" width="174" height="294" fill="none" stroke={c.primary} strokeWidth="6" />
      <rect x="9" y="9" width="162" height="282" fill="none" stroke={c.background} strokeWidth="1.6" />
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const PopupPanel: CardArt = ({ p, I, part }) => {
  const c = p.colors;
  const sky = mix(c.primary, '#ffffff', 0.72);
  const cloud = mix(c.background, '#ffffff', 0.6);
  const shadow = shade(c.text, 0.4);
  const puff = (x: number, y: number, s: number) => (
    <g key={`${x}${y}`} fill={cloud}>
      <circle cx={x} cy={y} r={r2(14 * s)} />
      <circle cx={r2(x + 14 * s)} cy={r2(y - 6 * s)} r={r2(16 * s)} />
      <circle cx={r2(x + 30 * s)} cy={y} r={r2(12 * s)} />
      <rect x={x} y={y} width={r2(30 * s)} height={r2(12 * s)} />
    </g>
  );
  const balloons: Array<[number, number, string]> = [
    [58, 112, c.accent],
    [116, 90, c.secondary],
    [92, 164, tint(c.primary, 0.25)],
  ];
  return (
    <>
      <rect width="180" height="300" rx="8" fill={sky} />
      {puff(18, 60, 1)}
      {puff(110, 250, 0.9)}
      {[
        [150, 40, c.accent],
        [30, 200, c.secondary],
        [140, 140, c.accent],
      ].map(([x, y, f]) => (
        <path key={`${x}`} d={star5(x as number, y as number, 7)} fill={f as string} />
      ))}
      {part === 'panelL' ? (
        <g fill="none" strokeWidth="7">
          <path d="M-10 300A110 110 0 0 1 200 300" stroke={c.secondary} />
          <path d="M3 300A97 97 0 0 1 187 300" stroke={c.accent} />
          <path d="M16 300A84 84 0 0 1 174 300" stroke={tint(c.primary, 0.3)} />
        </g>
      ) : null}
      {part === 'panelC' ? (
        <g>
          <path d="M0 262Q50 236 96 256T180 250V300H0Z" fill={mix(c.accent, c.primary, 0.3)} />
          {balloons.map(([x, y, f]) => (
            <g key={x}>
              <path d={`M${x} ${y + 30}Q${x - 8} ${y + 70} ${x + 2} ${y + 110}`} fill="none" stroke={shade(c.text, 0.1)} strokeWidth="1" />
              <ellipse cx={x + 4} cy={y + 5} rx="22" ry="27" fill={shadow} opacity="0.18" />
              <ellipse cx={x} cy={y} rx="22" ry="27" fill={f} />
              <path d={`M${x - 4} ${y + 27}H${x + 4}L${x} ${y + 33}Z`} fill={f} />
              <ellipse cx={x - 8} cy={y - 10} rx="5" ry="8" fill="#ffffff" opacity="0.45" />
            </g>
          ))}
        </g>
      ) : null}
      {part === 'panelR' ? <path d={star5(90, 150, 44)} fill="none" stroke={c.secondary} strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" /> : null}
      <rect x="2" y="2" width="176" height="296" rx="7" fill="none" stroke={cloud} strokeWidth="3" />
      <Lighting p={p} I={I} d={PANEL} rim={false} amount={0.4} />
    </>
  );
};

const CARD_PANELS: Record<CardStyle, CardArt> = {
  trifold: TrifoldPanel,
  folio: FolioPanel,
  patra: PatraPanel,
  album: AlbumPanel,
  certificate: CertificatePanel,
  poster: PosterPanel,
  popup: PopupPanel,
};
const CARD_SEAL: Record<CardStyle, SealShape> = { trifold: 'wax', folio: 'star', patra: 'wax', album: 'foil', certificate: 'medal', poster: 'badge', popup: 'badge' };

/** Unfold: a tri-fold card's panels (ornament and seal, never words) and its monogram seal. */
export function CardCover(props: DrawProps & CardCoverOptions) {
  const { part, variant } = props;
  if (part === 'seal') return <Seal p={props} shape={CARD_SEAL[variant]} monogram={props.monogram} fontFamily={props.fontFamily} />;
  const Panel = CARD_PANELS[variant];
  return (
    <Svg w={180} h={300}>
      <Panel p={props} I={idsOf(props, `c${variant}${part}`)} part={part} />
    </Svg>
  );
}
