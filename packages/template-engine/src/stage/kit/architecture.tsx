import type { CSSProperties, ReactNode } from 'react';
import { mix } from '../../theme';
import { metalStops, onCubic, shade, taper, tint, type Pt, type Segment } from '../../art/kit';
import { rand, r2 } from '../../art/motifs';
import type { DrawProps } from '../types';
import { motif, type KitEntry } from './place';

/**
 * Architecture and props (final.md §6.1): pillars, poles, lamp posts, rails,
 * stalls, pedestals and fountains, drawn as orthographic elevations in their
 * own w×h box (perspective comes from the 3D placement). Each piece is lit
 * from the set's key light (the far side 25% darker, a rim in the rim colour
 * on the edges facing away), takes its colours from the hazed palette (NATURE
 * only for leaves, flowers, flames and natural wood and clay), and draws the
 * part above the eye line quiet. Details are sized from the box's width, so a
 * taller box lengthens the shaft, never the capital.
 *
 * The small helpers above the pieces (ids, gradients, light, flames) are
 * shared with lights.tsx.
 */

export type PillarVariant = 'granite' | 'teak' | 'classical' | 'post';
export interface PillarOptions {
  variant: PillarVariant;
}
export type PoleVariant = 'striped' | 'bamboo' | 'flag';
export interface PoleOptions {
  variant: PoleVariant;
}
export type LampPostVariant = 'gilt' | 'campus' | 'iron';
export interface LampPostOptions {
  variant: LampPostVariant;
}
export type BalustradeVariant = 'turnedWood' | 'glass' | 'marbleJaali';
export interface BalustradeOptions {
  variant: BalustradeVariant;
}
export type StallVariant = 'sweets' | 'food' | 'diya';
export interface StallOptions {
  variant: StallVariant;
}
export type PedestalVariant = 'marble' | 'drum' | 'stone';
export interface PedestalOptions {
  variant: PedestalVariant;
  /** A prop drawn on the lit top face. */
  top?: ReactNode;
}
export type FountainVariant = 'jet' | 'tiered';
export interface FountainOptions {
  variant: FountainVariant;
}

/** Default boxes (units) per piece and variant. */
export const ARCHITECTURE_BOXES = {
  Pillar: { granite: { w: 70, h: 470 }, teak: { w: 70, h: 470 }, classical: { w: 70, h: 470 }, post: { w: 50, h: 700 } },
  Pole: { striped: { w: 40, h: 1000 }, bamboo: { w: 36, h: 600 }, flag: { w: 36, h: 700 } },
  LampPost: { gilt: { w: 40, h: 300 }, campus: { w: 40, h: 300 }, iron: { w: 40, h: 300 } },
  Balustrade: { turnedWood: { w: 240, h: 120 }, glass: { w: 240, h: 120 }, marbleJaali: { w: 240, h: 120 } },
  Stall: { sweets: { w: 200, h: 240 }, food: { w: 200, h: 240 }, diya: { w: 200, h: 240 } },
  Pedestal: { marble: { w: 160, h: 330 }, drum: { w: 160, h: 330 }, stone: { w: 160, h: 330 } },
  Fountain: { jet: { w: 60, h: 140 }, tiered: { w: 260, h: 300 } },
} as const;

// ─────────────────────────── shared helpers (also used by lights.tsx) ───────────────────────────

type From = DrawProps['light']['from'];
/** A gradient stop: offset, colour and an optional opacity. */
export type Stop = readonly [number, string, number?];

/** A path string whose numbers are rounded with r2: P`M${x} ${y}`. */
export const P = (s: TemplateStringsArray, ...v: number[]): string => {
  let out = s[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(r2(v[i] ?? 0)) + (s[i + 1] ?? '');
  return out;
};

/**
 * The id prefix of one drawing: its tag, its seed and a hash of everything it
 * is drawn with. Two pieces on one page share ids only when their gradients are
 * identical too (a left and right twin), so a reference never picks up another
 * piece's hazed colours. Integer hashing only (server and browser agree).
 */
export function kitId(p: DrawProps, tag: string): string {
  const c = p.colors;
  const key = `${tag}|${p.seed}|${p.w}x${p.h}|${c.primary}${c.secondary}${c.accent}${c.background}${c.surface}${c.text}${c.muted}|${p.nature.flame}${p.nature.leaf}${p.nature.clay}|${p.light.from}${p.light.color}${p.light.rim}|${p.eyeLine ?? ''}|${p.detail}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return `k${tag}${(h >>> 0).toString(36)}`;
}

const SVG_STYLE: CSSProperties = { display: 'block', overflow: 'visible' };

/** The piece's own SVG: its w×h box, drawn 1:1. */
export function KitSvg({ p, children }: { p: DrawProps; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** A linear gradient (user space unless `bbox`). */
export function Lin({ id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 0, bbox = false }: { id: string; stops: readonly Stop[]; x1?: number; y1?: number; x2?: number; y2?: number; bbox?: boolean }) {
  return (
    <linearGradient id={id} gradientUnits={bbox ? 'objectBoundingBox' : 'userSpaceOnUse'} x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)}>
      {stops.map(([o, c, a], i) => (
        <stop key={i} offset={r2(o)} stopColor={c} stopOpacity={a === undefined ? undefined : r2(a)} />
      ))}
    </linearGradient>
  );
}

/** A glow: a radial gradient from `core` at `a` through `color` to nothing. */
export function Glow({ id, color, core, a = 0.8, cx = '50%', cy = '50%' }: { id: string; color: string; core: string; a?: number; cx?: string; cy?: string }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r="50%">
      <stop offset="0" stopColor={core} stopOpacity={r2(a)} />
      <stop offset="0.38" stopColor={color} stopOpacity={r2(a * 0.42)} />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}

/** Stops across a round or faceted body lit from the key light: the far side 25% darker. */
export function bodyStops(base: string, from: From): Stop[] {
  if (from === 'left') return [[0, tint(base, 0.08)], [0.3, tint(base, 0.2)], [0.62, base], [1, shade(base, 0.25)]];
  if (from === 'right') return [[0, shade(base, 0.25)], [0.38, base], [0.7, tint(base, 0.2)], [1, tint(base, 0.08)]];
  return [[0, shade(base, 0.22)], [0.45, tint(base, 0.15)], [1, shade(base, 0.22)]];
}

/** Metal stops (the kit's foil) turned so the bright band faces the key light. */
export function metalLit(base: string, from: From, foil = true): Stop[] {
  const s = metalStops(base, foil);
  return from === 'right' ? s.map(([o, c]) => [r2(1 - o), c] as Stop).reverse() : s;
}

/** A shading wash for a whole silhouette: clear on the lit side, 25% dark on the far side. */
export function awayStops(from: From, a = 0.25): Stop[] {
  if (from === 'left') return [[0, '#000000', 0], [0.55, '#000000', 0], [1, '#000000', a]];
  if (from === 'right') return [[0, '#000000', a], [0.45, '#000000', 0], [1, '#000000', 0]];
  return [[0, '#000000', a * 0.6], [0.5, '#000000', 0], [1, '#000000', a * 0.6]];
}

/** The faces of a faceted body: [left, front, right]. */
export function faces(base: string, from: From): [string, string, string] {
  if (from === 'left') return [tint(base, 0.14), base, shade(base, 0.25)];
  if (from === 'right') return [shade(base, 0.25), base, tint(base, 0.14)];
  return [shade(base, 0.16), tint(base, 0.05), shade(base, 0.16)];
}

/** The rim light: a thin line in the rim colour down the edge(s) facing away from the key light. */
export function Rim({ p, x0, x1, y0, y1, k = 1 }: { p: DrawProps; x0: number; x1: number; y0: number; y1: number; k?: number }) {
  const inset = 0.7 * k;
  const xs = p.light.from === 'left' ? [x1 - inset] : p.light.from === 'right' ? [x0 + inset] : p.light.from === 'far' ? [x0 + inset, x1 - inset] : [];
  if (!xs.length || y1 <= y0) return null;
  return <path d={xs.map((x) => P`M${x} ${y0}V${y1}`).join('')} stroke={p.light.rim} strokeWidth={r2(1.4 * k)} opacity={0.7} fill="none" />;
}

/** Above the eye line a body is drawn quiet: a wash of its own mid-tone over it (tone-on-tone). */
export function QuietWash({ p, x, w, tone, y0 = 0 }: { p: DrawProps; x: number; w: number; tone: string; y0?: number }) {
  if (p.eyeLine === null || p.eyeLine <= y0) return null;
  return <rect x={r2(x)} y={r2(y0)} width={r2(w)} height={r2(Math.min(p.eyeLine, p.h) - y0)} fill={tone} opacity={0.72} />;
}

/** Natural wood (teak), from NATURE's clay darkened toward the palette's text. */
export const woodOf = (p: DrawProps) => mix(p.nature.clayDark, p.colors.text, 0.28);
/** Marigold orange, a real flower's colour from NATURE. */
export const marigoldOf = (p: DrawProps) => mix(p.nature.flame, p.nature.clay, 0.38);

/**
 * One flame, drawn once in <defs> with its base at 0 0 and 100 tall: a deep
 * outer tongue with a licking side tongue, the flame and its pale core, each
 * shaped with taper (narrow at the wick, full in the belly, an S-curved tip)
 * and leaning differently so it looks alive at rest. Place it with FlameAt.
 */
export function FlameDef({ id, p, seed = 0, small = false }: { id: string; p: DrawProps; seed?: number; /** Two layers only, for flames a few units tall (diyas). */ small?: boolean }) {
  const tongue = (hh: number, ww: number, lean: number, dy: number, sway: number) => {
    const at = (t: number, bend: number): Pt => [r2(lean * t * t + bend * ww), r2(-dy - hh * t)];
    const segs: Segment[] = [
      [at(0, 0), at(0.07, -0.05), at(0.14, -0.03), at(0.22, 0)],
      [at(0.22, 0), at(0.34, 0.05 * sway), at(0.46, 0.04 * sway), at(0.58, 0)],
      [at(0.58, 0), at(0.72, -0.07 * sway), at(0.86, -0.03 * sway), at(1, 0.04 * sway)],
    ];
    return taper(segs, [ww * 0.3, ww, ww * 0.6, 0], 4);
  };
  const s1 = rand(seed, 3);
  const s2 = rand(seed, 5);
  return (
    <g id={id}>
      {small ? null : <path d={tongue(58, 30, -12 - s2 * 6, 2, 1)} fill={mix(p.nature.flame, p.nature.clayDark, 0.5)} opacity={0.8} />}
      <path d={tongue(100, 46, 6 + s1 * 8, 0, 1)} fill={mix(p.nature.flame, p.nature.clayDark, 0.38)} />
      {small ? null : <path d={tongue(76, 36, -3 - s2 * 5, 2, -1)} fill={p.nature.flame} />}
      <path d={small ? tongue(60, 26, 2, 4, 1) : tongue(44, 22, 2, 4, 1)} fill={p.nature.flameCore} />
    </g>
  );
}

/** A FlameDef placed with its base at (x, y), `s` tall and `wide` times its width (negative mirrors it), leaning by `skew` degrees. */
export function FlameAt({ href, x, y, s, skew = 0, wide = 1 }: { href: string; x: number; y: number; s: number; skew?: number; wide?: number }) {
  const sy = s / 100;
  return <use href={`#${href}`} transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(sy * wide)} ${r2(sy)})${skew ? ` skewX(${r2(skew)})` : ''}`} />;
}

const KAPPA = 0.5523;
/**
 * A point at t (0..1) around an ellipse by cubic quadrants (no trigonometry):
 * t 0 is the front (bottom) point, 0.25 the right, 0.5 the back (top).
 */
export function aroundEllipse(cx: number, cy: number, rx: number, ry: number, t: number) {
  const q = (((t % 1) + 1) % 1) * 4;
  const i = Math.min(3, Math.floor(q));
  const f = q - i;
  const anchors: Pt[] = [
    [cx, cy + ry],
    [cx + rx, cy],
    [cx, cy - ry],
    [cx - rx, cy],
  ];
  const tangents: Pt[] = [
    [rx, 0],
    [0, -ry],
    [-rx, 0],
    [0, ry],
  ];
  const a = anchors[i]!;
  const b = anchors[(i + 1) % 4]!;
  const ta = tangents[i]!;
  const tb = tangents[(i + 1) % 4]!;
  return onCubic([a, [a[0] + KAPPA * ta[0], a[1] + KAPPA * ta[1]], [b[0] - KAPPA * tb[0], b[1] - KAPPA * tb[1]], b], f);
}

// ─────────────────────────── Pillar ───────────────────────────

/** A Dravidian granite pillar: square blocks with lotus medallions and a carved band, octagonal sections, a lotus and pot capital, a plank and a yali-scrolled bracket. */
function GranitePillar({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 70;
  const full = p.detail === 'full';
  const stone = mix(colors.muted, colors.surface, 0.42);
  const line = shade(stone, 0.42);
  const hi = tint(stone, 0.32);
  const [fl, ff, fr] = faces(stone, p.light.from);
  const cx = w / 2;
  const sx0 = w * 0.15;
  const sx1 = w * 0.85;
  const sw = sx1 - sx0;
  const baseTop = h - 40 * k;
  const capBot = 66 * k;
  const q = sw * 1.05;
  const blocks: Array<[number, number, 'rose' | 'band']> = [
    [capBot, capBot + q * 0.85, 'rose'],
    [baseTop - q, baseTop, 'rose'],
  ];
  const span = baseTop - capBot;
  if (span > q * 3.4) blocks.splice(1, 0, [capBot + span * 0.52 - q * 0.42, capBot + span * 0.52 + q * 0.42, 'band']);
  const cf = sw * 0.22;
  const sw7 = r2(0.7 * k);
  const block = ([y0, y1, kind]: [number, number, 'rose' | 'band'], i: number) => {
    const cy = (y0 + y1) / 2;
    const r = Math.min(sw, y1 - y0) * 0.32;
    return (
      <g key={`b${i}`}>
        <rect x={r2(sx0)} y={r2(y0)} width={r2(sw)} height={r2(y1 - y0)} fill={`url(#${id}s)`} stroke={line} strokeWidth={sw7} />
        {full ? <rect x={r2(sx0 + 3 * k)} y={r2(y0 + 3 * k)} width={r2(sw - 6 * k)} height={r2(y1 - y0 - 6 * k)} fill="none" stroke={hi} strokeWidth={r2(0.6 * k)} opacity={0.7} /> : null}
        {kind === 'rose' ? (
          <>
            <circle cx={r2(cx)} cy={r2(cy)} r={r2(r)} fill={shade(stone, 0.1)} stroke={line} strokeWidth={r2(0.8 * k)} />
            {full ? <circle cx={r2(cx)} cy={r2(cy)} r={r2(r * 0.64)} fill="none" stroke={line} strokeWidth={r2(r * 0.42)} strokeDasharray={`${r2(2.4 * k)} ${r2(1.5 * k)}`} opacity={0.75} /> : null}
            <circle cx={r2(cx)} cy={r2(cy)} r={r2(r * 0.22)} fill={line} />
          </>
        ) : (
          <>
            <path d={P`M${cx} ${y0 + 5 * k}L${sx1 - 5 * k} ${cy}L${cx} ${y1 - 5 * k}L${sx0 + 5 * k} ${cy}Z`} fill={shade(stone, 0.1)} stroke={line} strokeWidth={sw7} />
            <circle cx={r2(cx)} cy={r2(cy)} r={r2(3 * k)} fill={hi} stroke={line} strokeWidth={r2(0.6 * k)} />
            {full ? <path d={P`M${sx0 + 2 * k} ${y0 + 3.4 * k}H${sx1 - 2 * k}M${sx0 + 2 * k} ${y1 - 3.4 * k}H${sx1 - 2 * k}`} stroke={line} strokeWidth={r2(1.8 * k)} strokeDasharray={`${r2(1.4 * k)} ${r2(1.5 * k)}`} /> : null}
          </>
        )}
      </g>
    );
  };
  const oct = (y0: number, y1: number, i: number) => (
    <g key={`o${i}`}>
      <rect x={r2(sx0)} y={r2(y0)} width={r2(cf)} height={r2(y1 - y0)} fill={fl} />
      <rect x={r2(sx0 + cf)} y={r2(y0)} width={r2(sw - 2 * cf)} height={r2(y1 - y0)} fill={ff} />
      <rect x={r2(sx1 - cf)} y={r2(y0)} width={r2(cf)} height={r2(y1 - y0)} fill={fr} />
      <path d={P`M${sx0} ${y0}H${sx0 + cf}L${sx0} ${y0 + cf * 1.7}ZM${sx1} ${y0}H${sx1 - cf}L${sx1} ${y0 + cf * 1.7}ZM${sx0} ${y1}H${sx0 + cf}L${sx0} ${y1 - cf * 1.7}ZM${sx1} ${y1}H${sx1 - cf}L${sx1} ${y1 - cf * 1.7}Z`} fill={ff} />
      <path d={P`M${sx0 + cf} ${y0}V${y1}M${sx1 - cf} ${y0}V${y1}`} stroke={line} strokeWidth={r2(0.6 * k)} opacity={0.55} />
    </g>
  );
  const petals = Array.from({ length: 5 }, (_, i) => {
    const pw = (sw * 1.12) / 5;
    const x = cx - sw * 0.56 + i * pw;
    return P`M${x} ${capBot - 20 * k}Q${x + pw / 2} ${capBot - 3 * k} ${x + pw} ${capBot - 20 * k}`;
  }).join('');
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(stone, p.light.from)} x1={sx0} x2={sx1} />
        <Lin id={`${id}f`} stops={bodyStops(stone, p.light.from)} x1={0} x2={w} />
      </defs>
      {/* The base: plinth, step and the rounded kumuda moulding. */}
      <rect x={0} y={r2(h - 14 * k)} width={r2(w)} height={r2(14 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      {full ? <path d={P`M${2 * k} ${h - 7 * k}H${w - 2 * k}`} stroke={line} strokeWidth={r2(2 * k)} strokeDasharray={`${r2(3 * k)} ${r2(2 * k)}`} opacity={0.6} /> : null}
      <rect x={r2(3 * k)} y={r2(h - 26 * k)} width={r2(w - 6 * k)} height={r2(12 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      <rect x={r2(6 * k)} y={r2(baseTop)} width={r2(w - 12 * k)} height={r2(14 * k)} rx={r2(6 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      <path d={P`M${9 * k} ${baseTop + 4 * k}H${w - 9 * k}`} stroke={hi} strokeWidth={r2(1.2 * k)} opacity={0.8} />
      {/* The shaft: octagonal sections between carved square blocks. */}
      {blocks.slice(0, -1).map((b, i) => oct(b[1], blocks[i + 1]![0], i))}
      {blocks.map(block)}
      <Rim p={p} x0={sx0} x1={sx1} y0={capBot} y1={baseTop} k={k} />
      {/* The capital: a neck, an inverted lotus, the pot, the plank and the bracket. */}
      <rect x={r2(cx - sw * 0.43)} y={r2(capBot - 6 * k)} width={r2(sw * 0.86)} height={r2(6 * k)} fill={`url(#${id}s)`} stroke={line} strokeWidth={sw7} />
      <path d={P`M${cx - sw * 0.43} ${capBot - 6 * k}L${cx - sw * 0.56} ${capBot - 20 * k}H${cx + sw * 0.56}L${cx + sw * 0.43} ${capBot - 6 * k}Z`} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      {full ? <path d={petals} fill="none" stroke={line} strokeWidth={r2(0.7 * k)} /> : null}
      <path d={P`M${cx - sw * 0.5} ${capBot - 20 * k}C${cx - sw * 0.74} ${capBot - 25 * k} ${cx - sw * 0.7} ${capBot - 36 * k} ${cx - sw * 0.5} ${capBot - 38 * k}H${cx + sw * 0.5}C${cx + sw * 0.7} ${capBot - 36 * k} ${cx + sw * 0.74} ${capBot - 25 * k} ${cx + sw * 0.5} ${capBot - 20 * k}Z`} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      {full ? <path d={P`M${cx - sw * 0.6} ${capBot - 29 * k}H${cx + sw * 0.6}`} stroke={line} strokeWidth={r2(1.6 * k)} strokeDasharray={`${r2(1.2 * k)} ${r2(1.6 * k)}`} /> : null}
      <rect x={r2(w * 0.03)} y={r2(capBot - 48 * k)} width={r2(w * 0.94)} height={r2(10 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      <path d={P`M0 0H${w}V${7 * k}C${w} ${12 * k} ${w * 0.8} ${16 * k} ${w * 0.72} ${18 * k}H${w * 0.28}C${w * 0.2} ${16 * k} 0 ${12 * k} 0 ${7 * k}Z`} fill={`url(#${id}f)`} stroke={line} strokeWidth={sw7} />
      <path d={P`M${k} ${1.6 * k}H${w - k}`} stroke={hi} strokeWidth={r2(k)} opacity={0.8} />
      {[3.6 * k, w - 3.6 * k].map((x) => (
        <path key={x} d={P`M${x} ${7 * k}C${x + 2.6 * k} ${9.5 * k} ${x + 2 * k} ${13 * k} ${x} ${14.5 * k}C${x - 2 * k} ${13 * k} ${x - 2.6 * k} ${9.5 * k} ${x} ${7 * k}Z`} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      ))}
      {full ? (
        <>
          {/* Yali scrolls: the beast's curled snout and eye on each arm. */}
          <path d={P`M${w * 0.32} ${16.5 * k}C${w * 0.2} ${15.5 * k} ${w * 0.12} ${11.5 * k} ${w * 0.16} ${9 * k}C${w * 0.19} ${7.4 * k} ${w * 0.24} ${9.2 * k} ${w * 0.21} ${10.8 * k}M${w * 0.68} ${16.5 * k}C${w * 0.8} ${15.5 * k} ${w * 0.88} ${11.5 * k} ${w * 0.84} ${9 * k}C${w * 0.81} ${7.4 * k} ${w * 0.76} ${9.2 * k} ${w * 0.79} ${10.8 * k}`} fill="none" stroke={line} strokeWidth={r2(0.9 * k)} />
          <circle cx={r2(w * 0.27)} cy={r2(12 * k)} r={r2(0.9 * k)} fill={line} />
          <circle cx={r2(w * 0.73)} cy={r2(12 * k)} r={r2(0.9 * k)} fill={line} />
        </>
      ) : null}
      <Rim p={p} x0={0} x1={w} y0={0} y1={7 * k} k={k} />
      <Rim p={p} x0={0} x1={w} y0={h - 14 * k} y1={h} k={k} />
      <QuietWash p={p} x={sx0} w={sw} tone={stone} y0={capBot} />
    </KitSvg>
  );
}

/** A Chettinad teak pillar: a granite base, a brass collar, a turned teak shaft with grain, a bell capital and a carved bracket. */
function TeakPillar({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 70;
  const full = p.detail === 'full';
  const wood = woodOf(p);
  const wline = shade(wood, 0.45);
  const stone = mix(colors.muted, colors.surface, 0.4);
  const sline = shade(stone, 0.4);
  const cx = w / 2;
  const baseTop = h - 62 * k;
  const shaftBot = baseTop - 8 * k;
  const capBot = 72 * k;
  const sw7 = r2(0.7 * k);
  const len = shaftBot - capBot;
  const grain = [0.4, 0.57].map((f, i) => {
    const x = w * f;
    const j = (rand(p.seed + i, 11) - 0.5) * 3 * k;
    return P`M${x} ${capBot + 12 * k}C${x + 1.6 * k + j} ${capBot + len * 0.3} ${x - 1.6 * k} ${capBot + len * 0.6} ${x + 0.6 * k + j} ${shaftBot - 40 * k}`;
  });
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}w`} stops={bodyStops(wood, p.light.from)} x1={w * 0.14} x2={w * 0.86} />
        <Lin id={`${id}s`} stops={bodyStops(stone, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={w * 0.12} x2={w * 0.88} />
      </defs>
      {/* Granite base with a moulded cap and a carved lozenge. */}
      <rect x={0} y={r2(h - 14 * k)} width={r2(w)} height={r2(14 * k)} fill={`url(#${id}s)`} stroke={sline} strokeWidth={sw7} />
      <rect x={r2(w * 0.07)} y={r2(h - 52 * k)} width={r2(w * 0.86)} height={r2(38 * k)} fill={`url(#${id}s)`} stroke={sline} strokeWidth={sw7} />
      {full ? <path d={P`M${cx} ${h - 47 * k}L${w * 0.8} ${h - 33 * k}L${cx} ${h - 19 * k}L${w * 0.2} ${h - 33 * k}Z M${cx} ${h - 40 * k}L${w * 0.66} ${h - 33 * k}L${cx} ${h - 26 * k}L${w * 0.34} ${h - 33 * k}Z`} fill="none" stroke={sline} strokeWidth={r2(0.8 * k)} /> : null}
      <rect x={r2(w * 0.03)} y={r2(baseTop)} width={r2(w * 0.94)} height={r2(10 * k)} rx={r2(3 * k)} fill={`url(#${id}s)`} stroke={sline} strokeWidth={sw7} />
      {/* Brass collar and the turned shaft. */}
      <rect x={r2(w * 0.18)} y={r2(shaftBot)} width={r2(w * 0.64)} height={r2(8 * k)} fill={`url(#${id}m)`} stroke={shade(colors.secondary, 0.45)} strokeWidth={r2(0.5 * k)} />
      <path d={P`M${w * 0.21} ${shaftBot}L${w * 0.25} ${capBot}H${w * 0.75}L${w * 0.79} ${shaftBot}Z`} fill={`url(#${id}w)`} />
      {full ? <path d={grain.join('')} fill="none" stroke={shade(wood, 0.3)} strokeWidth={r2(0.7 * k)} opacity={0.5} /> : null}
      {[shaftBot - 26 * k, shaftBot - 31 * k].map((y) => (
        <rect key={y} x={r2(w * 0.19)} y={r2(y)} width={r2(w * 0.62)} height={r2(3.4 * k)} rx={r2(1.7 * k)} fill={`url(#${id}w)`} stroke={wline} strokeWidth={r2(0.5 * k)} />
      ))}
      <Rim p={p} x0={w * 0.22} x1={w * 0.78} y0={capBot} y1={shaftBot} k={k} />
      {/* Capital: rings, a bell, a brass band, the block and the bracket. */}
      <rect x={r2(w * 0.22)} y={r2(capBot - 4 * k)} width={r2(w * 0.56)} height={r2(4 * k)} fill={`url(#${id}w)`} stroke={wline} strokeWidth={r2(0.5 * k)} />
      <rect x={r2(w * 0.18)} y={r2(capBot - 9 * k)} width={r2(w * 0.64)} height={r2(5 * k)} rx={r2(2.5 * k)} fill={`url(#${id}w)`} stroke={wline} strokeWidth={r2(0.5 * k)} />
      <path d={P`M${w * 0.25} ${capBot - 9 * k}L${w * 0.13} ${capBot - 26 * k}H${w * 0.87}L${w * 0.75} ${capBot - 9 * k}Z`} fill={`url(#${id}w)`} stroke={wline} strokeWidth={sw7} />
      <rect x={r2(w * 0.11)} y={r2(capBot - 30 * k)} width={r2(w * 0.78)} height={r2(4 * k)} fill={`url(#${id}m)`} />
      <rect x={r2(w * 0.14)} y={r2(capBot - 50 * k)} width={r2(w * 0.72)} height={r2(20 * k)} fill={`url(#${id}w)`} stroke={wline} strokeWidth={sw7} />
      {full ? (
        <>
          <circle cx={r2(cx)} cy={r2(capBot - 40 * k)} r={r2(6 * k)} fill="none" stroke={wline} strokeWidth={r2(0.8 * k)} />
          <circle cx={r2(cx)} cy={r2(capBot - 40 * k)} r={r2(3.6 * k)} fill="none" stroke={tint(wood, 0.25)} strokeWidth={r2(2 * k)} strokeDasharray={`${r2(1.8 * k)} ${r2(1.2 * k)}`} />
        </>
      ) : null}
      <path d={P`M0 0H${w}V${6 * k}C${w} ${13 * k} ${w * 0.82} ${18 * k} ${w * 0.7} ${capBot - 50 * k}H${w * 0.3}C${w * 0.18} ${18 * k} 0 ${13 * k} 0 ${6 * k}Z`} fill={`url(#${id}w)`} stroke={wline} strokeWidth={sw7} />
      {full ? <path d={P`M${w * 0.3} ${19 * k}C${w * 0.16} ${17 * k} ${w * 0.1} ${12 * k} ${w * 0.15} ${9 * k}C${w * 0.2} ${7 * k} ${w * 0.25} ${10 * k} ${w * 0.21} ${12 * k}M${w * 0.7} ${19 * k}C${w * 0.84} ${17 * k} ${w * 0.9} ${12 * k} ${w * 0.85} ${9 * k}C${w * 0.8} ${7 * k} ${w * 0.75} ${10 * k} ${w * 0.79} ${12 * k}`} fill="none" stroke={tint(wood, 0.3)} strokeWidth={r2(1.1 * k)} /> : null}
      {[w * 0.25, w * 0.5, w * 0.75].map((x) => (
        <circle key={x} cx={r2(x)} cy={r2(3 * k)} r={r2(1.6 * k)} fill={`url(#${id}m)`} />
      ))}
      <Rim p={p} x0={0} x1={w} y0={0} y1={6 * k} k={k} />
      <Rim p={p} x0={w * 0.07} x1={w * 0.93} y0={h - 52 * k} y1={h - 14 * k} k={k} />
      <QuietWash p={p} x={w * 0.21} w={w * 0.58} tone={wood} y0={capBot} />
    </KitSvg>
  );
}

/** A classical column: an Attic base, a fluted marble shaft with entasis and a gilt Corinthian capital of acanthus and volutes. */
function ClassicalPillar({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 70;
  const full = p.detail === 'full';
  const marble = mix(colors.surface, colors.background, 0.5);
  const line = shade(marble, 0.3);
  const gilt = colors.secondary;
  const gline = shade(gilt, 0.45);
  const cx = w / 2;
  const shaftBot = h - 30 * k;
  const shaftTop = 70 * k;
  const b0 = w * 0.17;
  const b1 = w * 0.83;
  const t0 = w * 0.21;
  const t1 = w * 0.79;
  const n = 7;
  const flutes: string[] = [];
  const shine: string[] = [];
  for (let i = 1; i < n; i++) {
    const xb = b0 + ((b1 - b0) * i) / n;
    const xt = t0 + ((t1 - t0) * i) / n;
    flutes.push(P`M${xb} ${shaftBot - 3 * k}L${xt} ${shaftTop + 3 * k}`);
    shine.push(P`M${xb + 1.3 * k} ${shaftBot - 4 * k}L${xt + 1.1 * k} ${shaftTop + 4 * k}`);
  }
  const leaf = (x: number, y0: number, hh: number, ww: number) =>
    P`M${x - ww} ${y0}C${x - ww * 1.2} ${y0 - hh * 0.55} ${x - ww * 0.4} ${y0 - hh * 0.9} ${x} ${y0 - hh}C${x + ww * 0.4} ${y0 - hh * 0.9} ${x + ww * 1.2} ${y0 - hh * 0.55} ${x + ww} ${y0}Z`;
  const lower = [w * 0.26, cx, w * 0.74].map((x) => leaf(x, 64 * k, 22 * k, 7 * k)).join('');
  const upper = [w * 0.38, w * 0.62, w * 0.14, w * 0.86].map((x) => leaf(x, 52 * k, 30 * k, 6.5 * k)).join('');
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(marble, p.light.from)} x1={b0} x2={b1} />
        <Lin id={`${id}f`} stops={bodyStops(marble, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}g`} stops={metalLit(gilt, p.light.from)} x1={0} y1={0} x2={w} y2={20 * k} />
      </defs>
      {/* Attic base: plinth, torus, scotia, torus. */}
      <rect x={0} y={r2(h - 12 * k)} width={r2(w)} height={r2(12 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(w * 0.05)} y={r2(h - 20 * k)} width={r2(w * 0.9)} height={r2(8 * k)} rx={r2(4 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(w * 0.11)} y={r2(h - 24 * k)} width={r2(w * 0.78)} height={r2(4 * k)} fill={shade(marble, 0.18)} />
      <rect x={r2(w * 0.09)} y={r2(h - 30 * k)} width={r2(w * 0.82)} height={r2(6 * k)} rx={r2(3 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(w * 0.1)} y={r2(h - 31 * k)} width={r2(w * 0.8)} height={r2(1.4 * k)} fill={`url(#${id}g)`} />
      {/* The fluted shaft. */}
      <path d={P`M${b0} ${shaftBot}L${t0} ${shaftTop}H${t1}L${b1} ${shaftBot}Z`} fill={`url(#${id}s)`} />
      <path d={flutes.join('')} stroke={line} strokeWidth={r2(0.9 * k)} opacity={0.75} />
      {full ? <path d={shine.join('')} stroke={tint(marble, 0.5)} strokeWidth={r2(0.8 * k)} opacity={0.7} /> : null}
      <Rim p={p} x0={(b0 + t0) / 2} x1={(b1 + t1) / 2} y0={shaftTop} y1={shaftBot} k={k} />
      {/* The gilt capital: astragal, bell, two rows of acanthus, volutes and the abacus. */}
      <rect x={r2(w * 0.19)} y={r2(64 * k)} width={r2(w * 0.62)} height={r2(6 * k)} rx={r2(3 * k)} fill={`url(#${id}g)`} stroke={gline} strokeWidth={r2(0.5 * k)} />
      <path d={P`M${w * 0.22} ${64 * k}C${w * 0.18} ${40 * k} ${w * 0.1} ${24 * k} ${w * 0.08} ${16 * k}H${w * 0.92}C${w * 0.9} ${24 * k} ${w * 0.82} ${40 * k} ${w * 0.78} ${64 * k}Z`} fill={`url(#${id}g)`} />
      <path d={upper} fill={`url(#${id}g)`} stroke={gline} strokeWidth={r2(0.6 * k)} />
      <path d={lower} fill={`url(#${id}g)`} stroke={gline} strokeWidth={r2(0.6 * k)} />
      {full ? <path d={[w * 0.26, cx, w * 0.74].map((x) => P`M${x} ${62 * k}V${46 * k}`).join('')} stroke={gline} strokeWidth={r2(0.6 * k)} opacity={0.8} /> : null}
      {[w * 0.12, w * 0.88].map((x) => (
        <g key={x}>
          <circle cx={r2(x)} cy={r2(21 * k)} r={r2(6 * k)} fill={`url(#${id}g)`} stroke={gline} strokeWidth={r2(0.7 * k)} />
          <circle cx={r2(x)} cy={r2(21 * k)} r={r2(3.4 * k)} fill="none" stroke={gline} strokeWidth={r2(0.7 * k)} />
          <circle cx={r2(x)} cy={r2(21 * k)} r={r2(1.2 * k)} fill={gline} />
        </g>
      ))}
      <path d={P`M0 ${6 * k}Q${cx} ${10 * k} ${w} ${6 * k}L${w - 3 * k} ${16 * k}H${3 * k}Z`} fill={`url(#${id}g)`} stroke={gline} strokeWidth={r2(0.6 * k)} />
      <circle cx={r2(cx)} cy={r2(12 * k)} r={r2(2.6 * k)} fill={tint(gilt, 0.4)} stroke={gline} strokeWidth={r2(0.5 * k)} />
      <rect x={0} y={0} width={r2(w)} height={r2(6 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <Rim p={p} x0={0} x1={w} y0={0} y1={16 * k} k={k} />
      <QuietWash p={p} x={t0} w={t1 - t0} tone={marble} y0={shaftTop} />
    </KitSvg>
  );
}

/** A whitewashed veranda post: a chamfered square post on a plinth, curved brackets under the beam and a gold vine climbing to the eye line. Above the eye line it is quiet. */
function PostPillar({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 50;
  const full = p.detail === 'full';
  const white = mix(colors.background, colors.surface, 0.35);
  const quiet = p.eyeLine !== null && p.eyeLine > 60 * k;
  const line = quiet ? shade(white, 0.12) : shade(white, 0.3);
  const capLine = shade(white, quiet ? 0.1 : 0.3);
  const s0 = w * 0.22;
  const s1 = w * 0.78;
  const baseTop = h - 46 * k;
  const capBot = 52 * k;
  // The vine climbs from the plinth to just above the eye line (or 55% of the post).
  const vineTop = p.eyeLine !== null ? Math.max(capBot + 20 * k, p.eyeLine + 6 * k) : h * 0.45;
  const turns = Math.max(2, Math.round((baseTop - vineTop) / (64 * k)));
  const stepY = (baseTop - vineTop) / turns;
  const segs: Segment[] = Array.from({ length: turns }, (_, i) => {
    const y0 = baseTop - i * stepY;
    const y1 = y0 - stepY;
    const a = i % 2 ? s1 - 2 * k : s0 + 2 * k;
    const b = i % 2 ? s0 + 2 * k : s1 - 2 * k;
    return [
      [a, y0],
      [a, y0 - stepY * 0.45],
      [b, y1 + stepY * 0.45],
      [b, y1],
    ];
  });
  const leaves = full ? 3 : 2;
  const leafPath = (x: number, y: number, side: number, s: number) => P`M${x} ${y}C${x + side * 2.5 * s} ${y - 3 * s} ${x + side * 6.5 * s} ${y - 3.5 * s} ${x + side * 9 * s} ${y - 1.5 * s}C${x + side * 6.5 * s} ${y + 1.5 * s} ${x + side * 2.5 * s} ${y + 1.5 * s} ${x} ${y}Z`;
  const vineLeaves: string[] = [];
  segs.forEach((seg, i) => {
    for (let j = 1; j <= leaves; j++) {
      const pt = onCubic(seg, j / (leaves + 1));
      const side = (i + j) % 2 ? 1 : -1;
      vineLeaves.push(leafPath(pt.x, pt.y, side, k * (0.8 + rand(i * 7 + j, p.seed) * 0.35)));
    }
  });
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(white, p.light.from)} x1={s0} x2={s1} />
        <Lin id={`${id}f`} stops={bodyStops(white, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}g`} stops={metalLit(colors.secondary, p.light.from)} x1={s0} y1={0} x2={s1} y2={60 * k} />
      </defs>
      {/* Plinth with a chamfered top. */}
      <rect x={0} y={r2(h - 14 * k)} width={r2(w)} height={r2(14 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <path d={P`M${w * 0.08} ${h - 14 * k}V${baseTop + 7 * k}L${w * 0.16} ${baseTop}H${w * 0.84}L${w * 0.92} ${baseTop + 7 * k}V${h - 14 * k}Z`} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      {/* The post with its chamfers. */}
      <rect x={r2(s0)} y={r2(12 * k)} width={r2(s1 - s0)} height={r2(baseTop - 12 * k)} fill={`url(#${id}s)`} />
      <path d={P`M${s0 + 3 * k} ${capBot + 6 * k}V${baseTop - 6 * k}M${s1 - 3 * k} ${capBot + 6 * k}V${baseTop - 6 * k}`} stroke={line} strokeWidth={r2(0.7 * k)} opacity={0.8} />
      <Rim p={p} x0={s0} x1={s1} y0={capBot} y1={baseTop} k={k} />
      {/* The gold vine below the eye line. */}
      <path d={taper(segs, Array.from({ length: turns + 1 }, (_, i) => r2((1.9 - (1.1 * i) / turns) * k)), 6)} fill={`url(#${id}g)`} />
      <path d={vineLeaves.join('')} fill={`url(#${id}g)`} stroke={shade(colors.secondary, 0.4)} strokeWidth={r2(0.35 * k)} />
      <QuietWash p={p} x={s0} w={s1 - s0} tone={white} y0={capBot} />
      {/* Capital block, brackets and the beam. */}
      <rect x={r2(w * 0.14)} y={r2(36 * k)} width={r2(w * 0.72)} height={r2(16 * k)} fill={quiet ? white : `url(#${id}f)`} stroke={capLine} strokeWidth={r2(0.6 * k)} />
      <path d={P`M${w * 0.14} ${41 * k}H${w * 0.86}`} stroke={capLine} strokeWidth={r2(0.6 * k)} />
      {[1, -1].map((side) => {
        const x0 = side > 0 ? s0 : s1;
        const xe = side > 0 ? 0 : w;
        return (
          <g key={side}>
            <path d={P`M${x0} ${capBot + 30 * k}C${x0 - side * 6 * k} ${capBot + 18 * k} ${xe + side * 2 * k} ${22 * k} ${xe} ${12 * k}H${x0}Z`} fill={quiet ? white : `url(#${id}f)`} stroke={capLine} strokeWidth={r2(0.6 * k)} />
            {full ? <path d={P`M${x0 - side * 2 * k} ${capBot + 18 * k}C${x0 - side * 5 * k} ${capBot + 6 * k} ${xe + side * 5 * k} ${26 * k} ${xe + side * 3 * k} ${17 * k}`} fill="none" stroke={capLine} strokeWidth={r2(0.6 * k)} /> : null}
          </g>
        );
      })}
      <rect x={0} y={0} width={r2(w)} height={r2(12 * k)} fill={quiet ? white : `url(#${id}f)`} stroke={capLine} strokeWidth={r2(0.6 * k)} />
    </KitSvg>
  );
}

/** A pillar: a base, a shaft and a capital (granite, teak, classical or a whitewashed post). */
export function Pillar(props: DrawProps & PillarOptions) {
  const id = kitId(props, `pl${props.variant}`);
  if (props.variant === 'teak') return <TeakPillar p={props} id={id} />;
  if (props.variant === 'classical') return <ClassicalPillar p={props} id={id} />;
  if (props.variant === 'post') return <PostPillar p={props} id={id} />;
  return <GranitePillar p={props} id={id} />;
}

// ─────────────────────────── Pole ───────────────────────────

/** Alpha stops that round a flat body into a cylinder lit from the key light. */
function cylinderStops(from: From): Stop[] {
  if (from === 'left') return [[0, '#ffffff', 0.16], [0.3, '#ffffff', 0.28], [0.6, '#ffffff', 0], [1, '#000000', 0.32]];
  if (from === 'right') return [[0, '#000000', 0.32], [0.4, '#ffffff', 0], [0.7, '#ffffff', 0.28], [1, '#ffffff', 0.16]];
  return [[0, '#000000', 0.28], [0.45, '#ffffff', 0.22], [1, '#000000', 0.28]];
}

/** A circus tent pole in barber stripes with gilt collars and a ball finial; quiet above the eye line. */
function StripedPole({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 40;
  const x0 = w * 0.25;
  const sw = w * 0.5;
  const x1 = x0 + sw;
  const cx = w / 2;
  const top = 30 * k;
  const pale = mix(colors.background, colors.accent, 0.25);
  const period = sw * 2.4;
  const bands = [-period, 0, period]
    .map((a) => P`M0 ${a + sw * 0.55}L${sw} ${a}V${a + period / 2}L0 ${a + sw * 0.55 + period / 2}Z`)
    .join('');
  const collars: number[] = [];
  for (let y = top + 150 * k; y < h - 60 * k; y += 190 * k) collars.push(y);
  const quietTo = p.eyeLine === null ? top : Math.min(p.eyeLine, h);
  const metal = `url(#${id}m)`;
  return (
    <KitSvg p={p}>
      <defs>
        <pattern id={`${id}p`} patternUnits="userSpaceOnUse" x={r2(x0)} y="0" width={r2(sw)} height={r2(period)}>
          <rect width={r2(sw)} height={r2(period)} fill={pale} />
          <path d={bands} fill={colors.primary} />
        </pattern>
        <Lin id={`${id}c`} stops={cylinderStops(p.light.from)} x1={x0} x2={x1} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={x0 - 4 * k} y1={0} x2={x1 + 4 * k} y2={10 * k} />
      </defs>
      <rect x={r2(x0)} y={r2(top)} width={r2(sw)} height={r2(h - top - 12 * k)} fill={`url(#${id}p)`} />
      <rect x={r2(x0)} y={r2(top)} width={r2(sw)} height={r2(h - top - 12 * k)} fill={`url(#${id}c)`} />
      {quietTo > top ? <rect x={r2(x0)} y={r2(top)} width={r2(sw)} height={r2(quietTo - top)} fill={mix(colors.primary, pale, 0.5)} opacity={0.72} /> : null}
      {collars.map((y) => (
        <g key={y} opacity={y < quietTo ? 0.45 : 1}>
          <rect x={r2(x0 - 2.4 * k)} y={r2(y)} width={r2(sw + 4.8 * k)} height={r2(7 * k)} rx={r2(2 * k)} fill={metal} />
          <path d={P`M${x0 - 2 * k} ${y + 3.5 * k}H${x1 + 2 * k}`} stroke={shade(colors.secondary, 0.4)} strokeWidth={r2(0.6 * k)} />
        </g>
      ))}
      <Rim p={p} x0={x0} x1={x1} y0={quietTo} y1={h - 12 * k} k={k} />
      {/* Ball finial and spike. */}
      <path d={P`M${cx} 0L${cx + 2.4 * k} ${12 * k}H${cx - 2.4 * k}Z`} fill={metal} />
      <circle cx={r2(cx)} cy={r2(18 * k)} r={r2(8 * k)} fill={metal} opacity={p.eyeLine !== null && p.eyeLine > 26 * k ? 0.7 : 1} />
      <rect x={r2(x0 - 2 * k)} y={r2(top - 4 * k)} width={r2(sw + 4 * k)} height={r2(5 * k)} rx={r2(2 * k)} fill={metal} />
      {/* The foot plate. */}
      <path d={P`M${x0 - 7 * k} ${h}L${x0 - 2 * k} ${h - 14 * k}H${x1 + 2 * k}L${x1 + 7 * k} ${h}Z`} fill={metal} stroke={shade(colors.secondary, 0.45)} strokeWidth={r2(0.6 * k)} />
    </KitSvg>
  );
}

/** A bamboo pole: node rings, marigold garlands wound around it, rope lashing and a tuft of mango leaves at the top. */
function BambooPole({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors, nature } = p;
  const k = w / 36;
  const full = p.detail === 'full';
  const bamboo = mix(nature.leafLight, colors.secondary, 0.55);
  const node = shade(bamboo, 0.35);
  const x0 = w * 0.19;
  const x1 = w * 0.81;
  const cx = w / 2;
  const top = 26 * k;
  const nodes: number[] = [];
  for (let y = top + 50 * k + rand(p.seed, 2) * 20 * k; y < h - 20 * k; y += 66 * k + rand(Math.round(y), p.seed) * 14 * k) nodes.push(y);
  const marigold = marigoldOf(p);
  const wraps = [0.3, 0.56, 0.82].map((f) => top + (h - top) * f);
  const garland = (y: number) => P`M${x0 - 2 * k} ${y - 9 * k}L${x1 + 2 * k} ${y + 9 * k}`;
  const leaf = (dx: number, len: number) => {
    const end: Pt = [cx + dx, top + len * 0.15];
    return taper([[[cx, top - 2 * k], [cx + dx * 0.4, top - len * 0.5], [cx + dx * 0.9, top - len * 0.35], end]], [3.4 * k, 0.3 * k], 10);
  };
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} stops={bodyStops(bamboo, p.light.from)} x1={x0} x2={x1} />
      </defs>
      {/* Mango leaves tied at the top. */}
      <path d={[leaf(-15 * k, 34 * k), leaf(14 * k, 30 * k), leaf(-5 * k, 40 * k), leaf(7 * k, 38 * k)].join('')} fill={nature.leaf} />
      <path d={leaf(-10 * k, 30 * k)} fill={nature.leafDark} />
      <rect x={r2(x0)} y={r2(top)} width={r2(x1 - x0)} height={r2(h - top)} fill={`url(#${id}b)`} />
      <ellipse cx={r2(cx)} cy={r2(top)} rx={r2((x1 - x0) / 2)} ry={r2(2.4 * k)} fill={shade(bamboo, 0.45)} />
      {nodes.map((y) => (
        <g key={y}>
          <rect x={r2(x0 - 0.8 * k)} y={r2(y - 1.6 * k)} width={r2(x1 - x0 + 1.6 * k)} height={r2(3.2 * k)} rx={r2(1.6 * k)} fill={node} />
          <path d={P`M${x0} ${y + 2.6 * k}H${x1}`} stroke={tint(bamboo, 0.35)} strokeWidth={r2(0.8 * k)} opacity={0.8} />
        </g>
      ))}
      {full ? <path d={nodes.map((y, i) => P`M${x0 + (x1 - x0) * (0.3 + rand(i, 9) * 0.4)} ${y + 8 * k}v${18 * k}`).join('')} stroke={shade(bamboo, 0.2)} strokeWidth={r2(0.6 * k)} opacity={0.5} /> : null}
      {/* Marigold wraps: two strands of beads crossing the pole. */}
      {wraps.map((y) => (
        <g key={y}>
          <path d={garland(y)} stroke={marigold} strokeWidth={r2(6.4 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(5.4 * k)}`} fill="none" />
          <path d={garland(y + 6 * k)} stroke={nature.flame} strokeWidth={r2(6 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(5.4 * k)}`} fill="none" />
          {full ? <path d={garland(y + 3 * k)} stroke={shade(marigold, 0.35)} strokeWidth={r2(1.6 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(5.4 * k)}`} fill="none" /> : null}
        </g>
      ))}
      {/* Rope lashing near the foot. */}
      <path d={P`M${x0} ${h - 34 * k}L${x1} ${h - 40 * k}M${x0} ${h - 28 * k}L${x1} ${h - 34 * k}M${x0} ${h - 22 * k}L${x1} ${h - 28 * k}`} stroke={mix(bamboo, colors.text, 0.35)} strokeWidth={r2(1.6 * k)} />
      <Rim p={p} x0={x0} x1={x1} y0={top} y1={h} k={k} />
      <QuietWash p={p} x={x0} w={x1 - x0} tone={bamboo} y0={top} />
    </KitSvg>
  );
}

/** A flag pole on a stepped plinth: painted in the primary with gilt rings, a halyard and a gilt kalash finial (no emblem). */
function FlagPole({ p, id }: { p: DrawProps; id: string }) {
  const { w, h, colors } = p;
  const k = w / 36;
  const cx = w / 2;
  const top = 34 * k;
  const paint = mix(colors.primary, colors.background, 0.12);
  const stone = mix(colors.muted, colors.surface, 0.45);
  const metal = `url(#${id}m)`;
  const rings: number[] = [];
  for (let y = top + 80 * k; y < h - 90 * k; y += 140 * k) rings.push(y);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}p`} stops={bodyStops(paint, p.light.from)} x1={cx - 5 * k} x2={cx + 5 * k} />
        <Lin id={`${id}s`} stops={bodyStops(stone, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={cx - 9 * k} y1={0} x2={cx + 9 * k} y2={12 * k} />
      </defs>
      {/* Kalash finial: a bud, a pot and a collar. */}
      <path d={P`M${cx} 0C${cx + 3 * k} ${5 * k} ${cx + 3 * k} ${9 * k} ${cx} ${12 * k}C${cx - 3 * k} ${9 * k} ${cx - 3 * k} ${5 * k} ${cx} 0Z`} fill={metal} />
      <path d={P`M${cx - 3 * k} ${13 * k}C${cx - 10 * k} ${16 * k} ${cx - 10 * k} ${26 * k} ${cx - 4 * k} ${28 * k}H${cx + 4 * k}C${cx + 10 * k} ${26 * k} ${cx + 10 * k} ${16 * k} ${cx + 3 * k} ${13 * k}Z`} fill={metal} stroke={shade(colors.secondary, 0.45)} strokeWidth={r2(0.5 * k)} />
      <rect x={r2(cx - 7 * k)} y={r2(28 * k)} width={r2(14 * k)} height={r2(4 * k)} rx={r2(1.5 * k)} fill={metal} />
      <path d={P`M${cx - 4 * k} ${top}L${cx - 5.5 * k} ${h - 60 * k}H${cx + 5.5 * k}L${cx + 4 * k} ${top}Z`} fill={`url(#${id}p)`} />
      {rings.map((y) => (
        <rect key={y} x={r2(cx - 6 * k)} y={r2(y)} width={r2(12 * k)} height={r2(4 * k)} rx={r2(1.5 * k)} fill={metal} />
      ))}
      {/* The halyard and its cleat. */}
      <path d={P`M${cx + 5 * k} ${top + 2 * k}L${cx + 7 * k} ${h - 100 * k}`} stroke={mix(colors.background, colors.muted, 0.4)} strokeWidth={r2(0.8 * k)} opacity={0.8} />
      <rect x={r2(cx + 5 * k)} y={r2(h - 104 * k)} width={r2(4 * k)} height={r2(8 * k)} fill={metal} />
      <Rim p={p} x0={cx - 5 * k} x1={cx + 5 * k} y0={top} y1={h - 60 * k} k={k} />
      <QuietWash p={p} x={cx - 5.5 * k} w={11 * k} tone={paint} y0={top} />
      {/* Stepped plinth. */}
      <rect x={r2(w * 0.2)} y={r2(h - 60 * k)} width={r2(w * 0.6)} height={r2(18 * k)} fill={`url(#${id}s)`} stroke={shade(stone, 0.35)} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(w * 0.1)} y={r2(h - 42 * k)} width={r2(w * 0.8)} height={r2(20 * k)} fill={`url(#${id}s)`} stroke={shade(stone, 0.35)} strokeWidth={r2(0.6 * k)} />
      <rect x={0} y={r2(h - 22 * k)} width={r2(w)} height={r2(22 * k)} fill={`url(#${id}s)`} stroke={shade(stone, 0.35)} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(w * 0.1)} y={r2(h - 43 * k)} width={r2(w * 0.8)} height={r2(2 * k)} fill={metal} />
    </KitSvg>
  );
}

/** A pole: striped tent pole, bamboo with marigold wraps, or a flag pole with a gold finial (no emblem). */
export function Pole(props: DrawProps & PoleOptions) {
  const id = kitId(props, `po${props.variant}`);
  if (props.variant === 'bamboo') return <BambooPole p={props} id={id} />;
  if (props.variant === 'flag') return <FlagPole p={props} id={id} />;
  return <StripedPole p={props} id={id} />;
}

// ─────────────────────────── LampPost ───────────────────────────

/** A post with a glass lantern (its glow is a separate light piece): gilt, a campus globe lamp, or wrought iron. */
export function LampPost(props: DrawProps & LampPostOptions) {
  const p = props;
  const id = kitId(p, `lp${p.variant}`);
  const { w, h, colors, nature } = p;
  const k = w / 40;
  const full = p.detail === 'full';
  const cx = w / 2;
  const gilt = p.variant === 'gilt';
  const base = gilt ? colors.secondary : p.variant === 'campus' ? mix(colors.text, colors.primary, 0.35) : mix(colors.text, colors.muted, 0.15);
  const line = gilt ? shade(base, 0.48) : tint(base, 0.18);
  const metal = `url(#${id}m)`;
  const sw6 = r2(0.6 * k);
  const glass = `url(#${id}g)`;
  const defs = (
    <defs>
      {gilt ? <Lin id={`${id}m`} stops={metalLit(base, p.light.from)} x1={0} y1={0} x2={w} y2={14 * k} /> : <Lin id={`${id}m`} stops={bodyStops(base, p.light.from)} x1={cx - 16 * k} x2={cx + 16 * k} />}
      <radialGradient id={`${id}g`} cx="50%" cy="62%" r="62%">
        <stop offset="0" stopColor={nature.flameCore} />
        <stop offset="0.55" stopColor={mix(nature.flameCore, nature.flame, 0.45)} />
        <stop offset="1" stopColor={mix(nature.flame, base, 0.35)} />
      </radialGradient>
      <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.5} />
    </defs>
  );
  if (p.variant === 'campus') {
    const shaftTop = 41 * k;
    const shaftBot = h - 50 * k;
    return (
      <KitSvg p={p}>
        {defs}
        <circle cx={r2(cx)} cy={r2(24 * k)} r={r2(26 * k)} fill={`url(#${id}h)`} />
        <circle cx={r2(cx)} cy={r2(24 * k)} r={r2(14.5 * k)} fill={glass} />
        <path d={P`M${cx - 10 * k} ${17 * k}C${cx - 8 * k} ${13 * k} ${cx - 4 * k} ${11.5 * k} ${cx} ${11.5 * k}`} stroke={colors.background} strokeWidth={r2(1.4 * k)} opacity={0.6} fill="none" />
        <path d={P`M${cx - 9 * k} ${11 * k}C${cx - 8 * k} ${5 * k} ${cx + 8 * k} ${5 * k} ${cx + 9 * k} ${11 * k}Z`} fill={metal} />
        <circle cx={r2(cx)} cy={r2(4 * k)} r={r2(2.2 * k)} fill={metal} />
        <rect x={r2(cx - 7 * k)} y={r2(36 * k)} width={r2(14 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={metal} />
        {/* The ladder bar. */}
        <rect x={r2(cx - 17 * k)} y={r2(54 * k)} width={r2(34 * k)} height={r2(2.6 * k)} fill={metal} />
        <circle cx={r2(cx - 17 * k)} cy={r2(55.3 * k)} r={r2(2.2 * k)} fill={metal} />
        <circle cx={r2(cx + 17 * k)} cy={r2(55.3 * k)} r={r2(2.2 * k)} fill={metal} />
        <path d={P`M${cx - 3 * k} ${shaftTop}L${cx - 5 * k} ${shaftBot}H${cx + 5 * k}L${cx + 3 * k} ${shaftTop}Z`} fill={metal} />
        {[shaftTop + 30 * k, (shaftTop + shaftBot) / 2].map((y) => (
          <rect key={y} x={r2(cx - 5.5 * k)} y={r2(y)} width={r2(11 * k)} height={r2(4 * k)} rx={r2(1.5 * k)} fill={metal} stroke={line} strokeWidth={sw6} />
        ))}
        <path d={P`M${cx - 6 * k} ${shaftBot}L${cx - 9 * k} ${h - 30 * k}C${cx - 13 * k} ${h - 24 * k} ${cx - 15 * k} ${h - 16 * k} ${cx - 15 * k} ${h - 10 * k}H${cx + 15 * k}C${cx + 15 * k} ${h - 16 * k} ${cx + 13 * k} ${h - 24 * k} ${cx + 9 * k} ${h - 30 * k}L${cx + 6 * k} ${shaftBot}Z`} fill={metal} />
        {full ? <path d={P`M${cx - 4 * k} ${shaftBot + 4 * k}L${cx - 7 * k} ${h - 12 * k}M${cx} ${shaftBot + 4 * k}V${h - 12 * k}M${cx + 4 * k} ${shaftBot + 4 * k}L${cx + 7 * k} ${h - 12 * k}`} stroke={line} strokeWidth={sw6} opacity={0.7} /> : null}
        <path d={P`M${cx - 9 * k} ${h - 30 * k}H${cx + 9 * k}`} stroke={colors.secondary} strokeWidth={r2(1.6 * k)} />
        <rect x={r2(cx - 18 * k)} y={r2(h - 10 * k)} width={r2(36 * k)} height={r2(10 * k)} fill={metal} />
        <Rim p={p} x0={cx - 5 * k} x1={cx + 5 * k} y0={shaftTop} y1={shaftBot} k={k} />
      </KitSvg>
    );
  }
  if (p.variant === 'iron') {
    const shaftBot = h - 34 * k;
    return (
      <KitSvg p={p}>
        {defs}
        <circle cx={r2(cx)} cy={r2(37 * k)} r={r2(26 * k)} fill={`url(#${id}h)`} />
        <path d={P`M${cx - 14 * k} ${20 * k}H${cx + 14 * k}L${cx + 11 * k} ${56 * k}H${cx - 11 * k}Z`} fill={glass} />
        <path d={P`M${cx - 14 * k} ${20 * k}H${cx + 14 * k}L${cx + 11 * k} ${56 * k}H${cx - 11 * k}ZM${cx} ${20 * k}V${56 * k}M${cx - 12.5 * k} ${38 * k}H${cx + 12.5 * k}`} fill="none" stroke={metal} strokeWidth={r2(1.8 * k)} />
        <path d={P`M${cx} ${2 * k}L${cx + 18 * k} ${20 * k}H${cx - 18 * k}Z`} fill={metal} stroke={line} strokeWidth={sw6} />
        <circle cx={r2(cx)} cy={r2(2.5 * k)} r={r2(2.2 * k)} fill={metal} />
        <path d={P`M${cx - 12 * k} ${56 * k}H${cx + 12 * k}L${cx + 4 * k} ${64 * k}H${cx - 4 * k}Z`} fill={metal} />
        {/* Scrolls under the lantern. */}
        <path d={P`M${cx - 2 * k} ${80 * k}C${cx - 14 * k} ${78 * k} ${cx - 16 * k} ${66 * k} ${cx - 10 * k} ${63 * k}C${cx - 6 * k} ${62 * k} ${cx - 6 * k} ${68 * k} ${cx - 9 * k} ${68 * k}M${cx + 2 * k} ${80 * k}C${cx + 14 * k} ${78 * k} ${cx + 16 * k} ${66 * k} ${cx + 10 * k} ${63 * k}C${cx + 6 * k} ${62 * k} ${cx + 6 * k} ${68 * k} ${cx + 9 * k} ${68 * k}`} fill="none" stroke={metal} strokeWidth={r2(1.6 * k)} />
        <rect x={r2(cx - 3 * k)} y={r2(62 * k)} width={r2(6 * k)} height={r2(shaftBot - 62 * k)} fill={metal} />
        {full ? <path d={Array.from({ length: 9 }, (_, i) => P`M${cx - 3 * k} ${100 * k + i * 5 * k}l${6 * k} ${-3 * k}`).join('')} stroke={line} strokeWidth={sw6} /> : null}
        <path d={P`M${cx - 4 * k} ${shaftBot}H${cx + 4 * k}L${cx + 12 * k} ${h - 10 * k}H${cx - 12 * k}Z`} fill={metal} />
        <rect x={r2(cx - 15 * k)} y={r2(h - 10 * k)} width={r2(30 * k)} height={r2(10 * k)} fill={metal} stroke={line} strokeWidth={sw6} />
        <Rim p={p} x0={cx - 3 * k} x1={cx + 3 * k} y0={62 * k} y1={shaftBot} k={k} />
      </KitSvg>
    );
  }
  const shaftBot = h - 58 * k;
  return (
    <KitSvg p={p}>
      {defs}
      <circle cx={r2(cx)} cy={r2(48 * k)} r={r2(28 * k)} fill={`url(#${id}h)`} />
      <path d={P`M${cx} 0C${cx + 2 * k} ${5 * k} ${cx + 2 * k} ${7 * k} ${cx} ${9 * k}C${cx - 2 * k} ${7 * k} ${cx - 2 * k} ${5 * k} ${cx} 0Z`} fill={metal} />
      <path d={P`M${cx} ${8 * k}C${cx + 10 * k} ${10 * k} ${cx + 17 * k} ${16 * k} ${cx + 18 * k} ${24 * k}H${cx - 18 * k}C${cx - 17 * k} ${16 * k} ${cx - 10 * k} ${10 * k} ${cx} ${8 * k}Z`} fill={metal} stroke={line} strokeWidth={sw6} />
      <rect x={r2(cx - 19 * k)} y={r2(24 * k)} width={r2(38 * k)} height={r2(3.4 * k)} rx={r2(1.4 * k)} fill={metal} />
      {/* The hexagonal lantern: three panes of lit glass in a gilt frame. */}
      <path d={P`M${cx - 15 * k} ${27 * k}H${cx + 15 * k}L${cx + 11 * k} ${70 * k}H${cx - 11 * k}Z`} fill={glass} />
      <path d={P`M${cx} ${62 * k}C${cx - 3 * k} ${58 * k} ${cx - 2 * k} ${53 * k} ${cx} ${48 * k}C${cx + 2 * k} ${53 * k} ${cx + 3 * k} ${58 * k} ${cx} ${62 * k}Z`} fill={nature.flame} opacity={0.75} />
      <path d={P`M${cx - 15 * k} ${27 * k}H${cx + 15 * k}L${cx + 11 * k} ${70 * k}H${cx - 11 * k}ZM${cx - 5.5 * k} ${27 * k}L${cx - 4 * k} ${70 * k}M${cx + 5.5 * k} ${27 * k}L${cx + 4 * k} ${70 * k}`} fill="none" stroke={metal} strokeWidth={r2(1.6 * k)} />
      <path d={P`M${cx - 12 * k} ${70 * k}H${cx + 12 * k}L${cx + 4 * k} ${80 * k}H${cx - 4 * k}Z`} fill={metal} stroke={line} strokeWidth={sw6} />
      {full ? <path d={[-1, 1].map((s) => P`M${cx + s * 3 * k} ${104 * k}C${cx + s * 9 * k} ${100 * k} ${cx + s * 15 * k} ${92 * k} ${cx + s * 15 * k} ${84 * k}C${cx + s * 15 * k} ${79 * k} ${cx + s * 10 * k} ${78 * k} ${cx + s * 9 * k} ${82 * k}C${cx + s * 8.4 * k} ${85 * k} ${cx + s * 11 * k} ${86 * k} ${cx + s * 12 * k} ${84 * k}`).join('')} fill="none" stroke={metal} strokeWidth={r2(1.5 * k)} strokeLinecap="round" /> : null}
      <rect x={r2(cx - 3.2 * k)} y={r2(80 * k)} width={r2(6.4 * k)} height={r2(shaftBot - 80 * k)} fill={metal} />
      {[110 * k, (80 * k + shaftBot) / 2, shaftBot - 8 * k].map((y, i) => (i === 1 ? <ellipse key={y} cx={r2(cx)} cy={r2(y)} rx={r2(6 * k)} ry={r2(7 * k)} fill={metal} stroke={line} strokeWidth={sw6} /> : <rect key={y} x={r2(cx - 5 * k)} y={r2(y)} width={r2(10 * k)} height={r2(3.4 * k)} rx={r2(1.4 * k)} fill={metal} stroke={line} strokeWidth={sw6} />))}
      <path d={P`M${cx - 4 * k} ${shaftBot}C${cx - 6 * k} ${h - 38 * k} ${cx - 15 * k} ${h - 26 * k} ${cx - 16 * k} ${h - 14 * k}H${cx + 16 * k}C${cx + 15 * k} ${h - 26 * k} ${cx + 6 * k} ${h - 38 * k} ${cx + 4 * k} ${shaftBot}Z`} fill={metal} stroke={line} strokeWidth={sw6} />
      {full ? <path d={P`M${cx - 2 * k} ${shaftBot + 6 * k}C${cx - 4 * k} ${h - 34 * k} ${cx - 8 * k} ${h - 24 * k} ${cx - 9 * k} ${h - 15 * k}M${cx + 2 * k} ${shaftBot + 6 * k}C${cx + 4 * k} ${h - 34 * k} ${cx + 8 * k} ${h - 24 * k} ${cx + 9 * k} ${h - 15 * k}`} fill="none" stroke={line} strokeWidth={sw6} opacity={0.7} /> : null}
      <rect x={r2(cx - 19 * k)} y={r2(h - 14 * k)} width={r2(38 * k)} height={r2(14 * k)} fill={metal} stroke={line} strokeWidth={sw6} />
      <path d={P`M${cx - 19 * k} ${h - 8 * k}H${cx + 19 * k}`} stroke={line} strokeWidth={sw6} />
      <Rim p={p} x0={cx - 3.2 * k} x1={cx + 3.2 * k} y0={80 * k} y1={shaftBot} k={k} />
    </KitSvg>
  );
}

// ─────────────────────────── Balustrade ───────────────────────────

/** A low rail (≤ 120 tall): turned wood balusters, frosted glass with posts, or a marble jaali. */
export function Balustrade(props: DrawProps & BalustradeOptions) {
  const p = props;
  const id = kitId(p, `ba${p.variant}`);
  const { w, h, colors } = p;
  const k = h / 120;
  const full = p.detail === 'full';
  const wash = <rect x={0} y={0} width={r2(w)} height={r2(h)} fill={`url(#${id}a)`} />;
  if (p.variant === 'glass') {
    const metal = `url(#${id}m)`;
    const n = Math.max(1, Math.round(w / (115 * k)));
    const step = w / n;
    const glass = mix(colors.background, p.light.color, 0.3);
    return (
      <KitSvg p={p}>
        <defs>
          <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={0} y1={0} x2={0} y2={10 * k} />
          <Lin id={`${id}a`} stops={awayStops(p.light.from, 0.18)} x1={0} x2={w} />
        </defs>
        {Array.from({ length: n }, (_, i) => {
          const x = i * step + 5 * k;
          const pw = step - 10 * k;
          return (
            <g key={i}>
              <rect x={r2(x)} y={r2(14 * k)} width={r2(pw)} height={r2(h - 26 * k)} fill={glass} opacity={0.38} />
              <path d={P`M${x + pw * 0.12} ${h - 12 * k}L${x + pw * 0.42} ${14 * k}H${x + pw * 0.54}L${x + pw * 0.24} ${h - 12 * k}Z`} fill={colors.background} opacity={0.3} />
              {full ? <path d={P`M${x + pw * 0.6} ${h - 12 * k}L${x + pw * 0.76} ${14 * k}`} stroke={colors.background} strokeWidth={r2(1.4 * k)} opacity={0.35} /> : null}
              <rect x={r2(x)} y={r2(14 * k)} width={r2(pw)} height={r2(h - 26 * k)} fill="none" stroke={tint(glass, 0.4)} strokeWidth={r2(0.8 * k)} opacity={0.7} />
            </g>
          );
        })}
        {Array.from({ length: n + 1 }, (_, i) => (
          <rect key={i} x={r2(Math.min(w - 6 * k, Math.max(0, i * step - 3 * k)))} y={r2(6 * k)} width={r2(6 * k)} height={r2(h - 6 * k)} fill={metal} />
        ))}
        <rect x={0} y={0} width={r2(w)} height={r2(8 * k)} rx={r2(4 * k)} fill={metal} />
        <rect x={0} y={r2(h - 12 * k)} width={r2(w)} height={r2(12 * k)} fill={metal} />
        {wash}
      </KitSvg>
    );
  }
  if (p.variant === 'marbleJaali') {
    const marble = mix(colors.surface, colors.background, 0.55);
    const line = shade(marble, 0.32);
    const s = 16 * k;
    const n = Math.max(1, Math.round(w / (120 * k)));
    const step = w / n;
    const cell = P`M0 0H${s}V${s}H0ZM${s / 2} ${s * 0.17}A${s * 0.33} ${s * 0.33} 0 1 0 ${s / 2} ${s * 0.83}A${s * 0.33} ${s * 0.33} 0 1 0 ${s / 2} ${s * 0.17}ZM0 0H${s * 0.13}L0 ${s * 0.13}ZM${s} 0V${s * 0.13}L${s * 0.87} 0ZM${s} ${s}H${s * 0.87}L${s} ${s * 0.87}ZM0 ${s}V${s * 0.87}L${s * 0.13} ${s}Z`;
    return (
      <KitSvg p={p}>
        <defs>
          <pattern id={`${id}j`} patternUnits="userSpaceOnUse" x="0" y={r2(16 * k)} width={r2(s)} height={r2(s)}>
            <path d={cell} fill={marble} fillRule="evenodd" />
            {full ? <circle cx={r2(s / 2)} cy={r2(s / 2)} r={r2(s * 0.33)} fill="none" stroke={line} strokeWidth={r2(0.6 * k)} /> : null}
          </pattern>
          <Lin id={`${id}f`} stops={bodyStops(marble, 'above')} x1={0} y1={0} x2={0} y2={16 * k} />
          <Lin id={`${id}a`} stops={awayStops(p.light.from, 0.2)} x1={0} x2={w} />
        </defs>
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <rect x={r2(i * step + 8 * k)} y={r2(16 * k)} width={r2(step - 16 * k)} height={r2(h - 34 * k)} fill={`url(#${id}j)`} />
            <rect x={r2(i * step + 8 * k)} y={r2(16 * k)} width={r2(step - 16 * k)} height={r2(h - 34 * k)} fill="none" stroke={marble} strokeWidth={r2(3 * k)} />
            <rect x={r2(i * step + 10 * k)} y={r2(18 * k)} width={r2(step - 20 * k)} height={r2(h - 38 * k)} fill="none" stroke={line} strokeWidth={r2(0.7 * k)} />
          </g>
        ))}
        {Array.from({ length: n + 1 }, (_, i) => {
          const x = Math.min(w - 16 * k, Math.max(0, i * step - 8 * k));
          return (
            <g key={`p${i}`}>
              <rect x={r2(x)} y={r2(12 * k)} width={r2(16 * k)} height={r2(h - 24 * k)} fill={marble} stroke={line} strokeWidth={r2(0.6 * k)} />
              {full ? <circle cx={r2(x + 8 * k)} cy={r2(h / 2)} r={r2(3.4 * k)} fill="none" stroke={colors.secondary} strokeWidth={r2(1 * k)} /> : null}
            </g>
          );
        })}
        <rect x={0} y={0} width={r2(w)} height={r2(14 * k)} fill={`url(#${id}f)`} stroke={line} strokeWidth={r2(0.6 * k)} />
        <path d={P`M0 ${10 * k}H${w}`} stroke={line} strokeWidth={r2(0.6 * k)} />
        <rect x={0} y={r2(h - 16 * k)} width={r2(w)} height={r2(16 * k)} fill={shade(marble, 0.06)} stroke={line} strokeWidth={r2(0.6 * k)} />
        {full ? <path d={P`M0 ${h - 12 * k}H${w}`} stroke={colors.secondary} strokeWidth={r2(1.2 * k)} opacity={0.8} /> : null}
        {wash}
      </KitSvg>
    );
  }
  const wood = woodOf(p);
  const line = shade(wood, 0.45);
  const top = 14 * k;
  const bot = h - 16 * k;
  const bh = bot - top;
  const n = Math.max(2, Math.floor((w - 40 * k) / (19 * k)));
  const step = (w - 40 * k) / n;
  const bw = 5 * k;
  const baluster = P`M${-bw * 0.8} 0H${bw * 0.8}V${bh * 0.08}H${bw * 0.45}C${bw * 0.45} ${bh * 0.2} ${bw * 0.5} ${bh * 0.3} ${bw * 0.7} ${bh * 0.4}C${bw * 1.3} ${bh * 0.58} ${bw * 1.25} ${bh * 0.72} ${bw * 0.85} ${bh * 0.8}C${bw * 0.5} ${bh * 0.84} ${bw * 0.9} ${bh * 0.88} ${bw * 0.9} ${bh * 0.9}V${bh}H${-bw * 0.9}V${bh * 0.9}C${-bw * 0.9} ${bh * 0.88} ${-bw * 0.5} ${bh * 0.84} ${-bw * 0.85} ${bh * 0.8}C${-bw * 1.25} ${bh * 0.72} ${-bw * 1.3} ${bh * 0.58} ${-bw * 0.7} ${bh * 0.4}C${-bw * 0.5} ${bh * 0.3} ${-bw * 0.45} ${bh * 0.2} ${-bw * 0.45} ${bh * 0.08}H${-bw * 0.8}Z`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} stops={bodyStops(wood, p.light.from)} x1={0} x2={1} bbox />
        <Lin id={`${id}r`} stops={bodyStops(wood, 'above')} x1={0} y1={0} x2={0} y2={top} />
        <Lin id={`${id}a`} stops={awayStops(p.light.from, 0.16)} x1={0} x2={w} />
        <path id={`${id}t`} d={baluster} fill={`url(#${id}b)`} stroke={line} strokeWidth={r2(0.5 * k)} />
      </defs>
      {Array.from({ length: n }, (_, i) => (
        <use key={i} href={`#${id}t`} x={r2(20 * k + step * (i + 0.5))} y={r2(top)} />
      ))}
      {[0, w - 18 * k].map((x) => (
        <g key={x}>
          <rect x={r2(x)} y={r2(-4 * k)} width={r2(18 * k)} height={r2(h + 4 * k)} fill={`url(#${id}b)`} stroke={line} strokeWidth={r2(0.6 * k)} />
          {full ? <rect x={r2(x + 4 * k)} y={r2(top + 8 * k)} width={r2(10 * k)} height={r2(bh - 16 * k)} fill="none" stroke={line} strokeWidth={r2(0.6 * k)} opacity={0.7} /> : null}
          <rect x={r2(x - 2 * k)} y={r2(-8 * k)} width={r2(22 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={`url(#${id}r)`} stroke={line} strokeWidth={r2(0.6 * k)} />
        </g>
      ))}
      <rect x={r2(14 * k)} y={0} width={r2(w - 28 * k)} height={r2(top)} rx={r2(5 * k)} fill={`url(#${id}r)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(18 * k)} y={r2(top)} width={r2(w - 36 * k)} height={r2(3 * k)} fill={shade(wood, 0.4)} opacity={0.7} />
      <rect x={r2(14 * k)} y={r2(bot)} width={r2(w - 28 * k)} height={r2(9 * k)} fill={`url(#${id}r)`} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={0} y={r2(h - 7 * k)} width={r2(w)} height={r2(7 * k)} fill={shade(wood, 0.2)} />
      {wash}
    </KitSvg>
  );
}

// ─────────────────────────── Stall ───────────────────────────

/** A cart or stall with a striped scalloped awning, a marigold string, a warm lit interior and a counter of sweets, steaming pots or diyas. */
export function Stall(props: DrawProps & StallOptions) {
  const p = props;
  const id = kitId(p, `st${p.variant}`);
  const { w, h, colors, nature } = p;
  const kx = w / 200;
  const ky = h / 240;
  const k = Math.min(kx, ky);
  const full = p.detail === 'full';
  const frame = mix(colors.primary, colors.text, 0.22);
  const fline = shade(frame, 0.4);
  const metal = `url(#${id}m)`;
  const roofH = 18 * ky;
  const awnBot = 46 * ky;
  const counterTop = h * 0.6;
  const shelfY = h * 0.4;
  const panelBot = p.variant === 'food' ? h - 34 * ky : h - 26 * ky;
  const strips = 8;
  const sw = w / strips;
  const stripA = colors.accent;
  const stripB = mix(colors.background, colors.surface, 0.5);
  const marigold = marigoldOf(p);
  const swag = Array.from({ length: strips }, (_, i) => P`M${i * sw} ${awnBot + 1 * ky}Q${(i + 0.5) * sw} ${awnBot + 12 * ky} ${(i + 1) * sw} ${awnBot + 1 * ky}`).join('');
  const lit = mix(nature.flame, colors.primary, 0.3);
  const items: ReactNode[] = [];
  if (p.variant === 'sweets') {
    const tx = w * 0.3;
    const r = 5.2 * k;
    const balls: string[] = [];
    [4, 3, 2, 1].forEach((count, row) => {
      for (let j = 0; j < count; j++) balls.push(P`M${tx + (j - (count - 1) / 2) * r * 1.9 + r} ${counterTop - 7 * ky - r - row * r * 1.6}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`);
    });
    const barfi: string[] = [];
    for (let row = 0; row < 2; row++) for (let j = 0; j < 4; j++) {
      const x = w * 0.6 + j * 10 * k + (row ? 5 * k : 0);
      const y = counterTop - 10 * ky - row * 6 * k;
      barfi.push(P`M${x} ${y - 3.2 * k}L${x + 5 * k} ${y}L${x} ${y + 3.2 * k}L${x - 5 * k} ${y}Z`);
    }
    items.push(
      <g key="sweets">
        <ellipse cx={r2(tx)} cy={r2(counterTop - 5 * ky)} rx={r2(30 * k)} ry={r2(4.4 * k)} fill={metal} />
        <path d={balls.join('')} fill={`url(#${id}l)`} stroke={shade(marigold, 0.35)} strokeWidth={r2(0.4 * k)} />
        {full ? <path d={balls.slice(0, 7).map((_, i) => P`M${tx - 14 * k + i * 4.6 * k} ${counterTop - 14 * ky - (i % 3) * 5 * k}h${0.8 * k}`).join('')} stroke={tint(marigold, 0.6)} strokeWidth={r2(1.2 * k)} strokeLinecap="round" /> : null}
        <rect x={r2(w * 0.52)} y={r2(counterTop - 6 * ky)} width={r2(w * 0.4)} height={r2(4 * ky)} rx={r2(1.5 * k)} fill={metal} />
        <path d={barfi.join('')} fill={mix(nature.pearl, colors.accent, 0.18)} stroke={shade(nature.pearl, 0.28)} strokeWidth={r2(0.5 * k)} />
        {[0.3, 0.5, 0.7].map((f, i) => {
          const x = w * f;
          const fill = [mix(colors.primary, nature.flame, 0.4), colors.accent, marigold][i]!;
          return (
            <g key={f}>
              <rect x={r2(x - 8 * k)} y={r2(shelfY - 24 * k)} width={r2(16 * k)} height={r2(24 * k)} rx={r2(3 * k)} fill={mix(colors.background, colors.accent, 0.25)} opacity={0.5} />
              <rect x={r2(x - 7 * k)} y={r2(shelfY - 13 * k)} width={r2(14 * k)} height={r2(12 * k)} rx={r2(2 * k)} fill={fill} />
              <rect x={r2(x - 8.5 * k)} y={r2(shelfY - 28 * k)} width={r2(17 * k)} height={r2(4.6 * k)} rx={r2(1.5 * k)} fill={metal} />
            </g>
          );
        })}
      </g>,
    );
  } else if (p.variant === 'food') {
    const steam = (x: number, i: number) => {
      const l = (rand(i, p.seed) - 0.5) * 8 * k;
      return taper(
        [
          [[x, counterTop - 34 * k], [x + 5 * k + l, counterTop - 44 * k], [x - 6 * k, counterTop - 52 * k], [x + l, counterTop - 62 * k]],
          [[x + l, counterTop - 62 * k], [x + 6 * k + l, counterTop - 72 * k], [x - 4 * k, counterTop - 80 * k], [x + 2 * k + l, counterTop - 92 * k]],
        ],
        [2.4 * k, 4.2 * k, 0.4 * k],
        5,
      );
    };
    const handi = (x: number) => P`M${x - 15 * k} ${counterTop - 5 * ky}C${x - 23 * k} ${counterTop - 18 * k} ${x - 15 * k} ${counterTop - 31 * k} ${x - 10 * k} ${counterTop - 31 * k}H${x + 10 * k}C${x + 15 * k} ${counterTop - 31 * k} ${x + 23 * k} ${counterTop - 18 * k} ${x + 15 * k} ${counterTop - 5 * ky}Z`;
    const cups: string[] = [];
    [3, 2, 1].forEach((count, row) => {
      for (let j = 0; j < count; j++) {
        const x = w * 0.62 + (j - (count - 1) / 2) * 11 * k;
        const y = shelfY - row * 10 * k;
        cups.push(P`M${x - 5 * k} ${y - 10 * k}H${x + 5 * k}L${x + 3.6 * k} ${y}H${x - 3.6 * k}Z`);
      }
    });
    items.push(
      <g key="food">
        <path d={[w * 0.3, w * 0.68].map(handi).join('')} fill={metal} stroke={shade(colors.secondary, 0.45)} strokeWidth={r2(0.6 * k)} />
        {[w * 0.3, w * 0.68].map((x) => (
          <ellipse key={x} cx={r2(x)} cy={r2(counterTop - 31 * k)} rx={r2(10.5 * k)} ry={r2(2.6 * k)} fill={shade(colors.secondary, 0.55)} />
        ))}
        <path d={[steam(w * 0.28, 1), steam(w * 0.33, 2), steam(w * 0.66, 3), steam(w * 0.71, 4)].join('')} fill={colors.background} opacity={0.34} />
        <path d={cups.join('')} fill={nature.clay} stroke={nature.clayDark} strokeWidth={r2(0.5 * k)} />
        <ellipse cx={r2(w * 0.3)} cy={r2(shelfY - 3 * k)} rx={r2(16 * k)} ry={r2(3 * k)} fill={mix(colors.text, frame, 0.3)} />
      </g>,
    );
  } else {
    const rows: Array<[number, number, number]> = [
      [counterTop - 4 * ky, 6, 0.84],
      [shelfY, 4, 0.6],
    ];
    items.push(
      <g key="diya">
        {rows.map(([y, , span]) => (
          <ellipse key={y} cx={r2(w / 2)} cy={r2(y - 12 * k)} rx={r2((w * span) / 2 + 10 * k)} ry={r2(15 * k)} fill={`url(#${id}h)`} />
        ))}
        {rows.map(([y, count, span]) =>
          Array.from({ length: count }, (_, j) => (
            <FlameAt key={`${y}-${j}`} href={`${id}fl`} x={w / 2 + (j - (count - 1) / 2) * ((w * span) / count)} y={y - 4 * k} s={11 * k} skew={(rand(j, Math.round(y)) - 0.5) * 12} />
          )),
        )}
        <path
          d={rows
            .flatMap(([y, count, span]) =>
              Array.from({ length: count }, (_, j) => {
                const x = w / 2 + (j - (count - 1) / 2) * ((w * span) / count);
                return P`M${x - 6 * k} ${y - 4 * k}C${x - 5 * k} ${y + 1 * k} ${x + 5 * k} ${y + 1 * k} ${x + 6 * k} ${y - 4 * k}L${x + 8 * k} ${y - 6 * k}Z`;
              }),
            )
            .join('')}
          fill={nature.clay}
          stroke={nature.clayDark}
          strokeWidth={r2(0.5 * k)}
        />
      </g>,
    );
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={0} y1={0} x2={w} y2={20 * k} />
        <Lin id={`${id}f`} stops={bodyStops(frame, p.light.from)} x1={0} x2={1} bbox />
        <Lin id={`${id}a`} stops={awayStops(p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}v`} stops={[[0, '#000000', 0.22], [1, '#000000', 0]]} x1={0} y1={roofH} x2={0} y2={awnBot} />
        <radialGradient id={`${id}i`} cx="50%" cy="78%" r="72%">
          <stop offset="0" stopColor={nature.flameCore} />
          <stop offset="0.45" stopColor={mix(nature.flame, colors.background, 0.25)} />
          <stop offset="1" stopColor={shade(lit, 0.35)} />
        </radialGradient>
        <radialGradient id={`${id}l`} cx="36%" cy="30%" r="70%">
          <stop offset="0" stopColor={tint(marigold, 0.45)} />
          <stop offset="0.6" stopColor={marigold} />
          <stop offset="1" stopColor={shade(marigold, 0.3)} />
        </radialGradient>
        <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.55} />
        {p.variant === 'diya' ? <FlameDef id={`${id}fl`} p={p} seed={p.seed} small /> : null}
      </defs>
      {/* The lit interior and its back shelf. */}
      <rect x={r2(10 * kx)} y={r2(awnBot - 4 * ky)} width={r2(w - 20 * kx)} height={r2(counterTop - awnBot + 4 * ky)} fill={`url(#${id}i)`} />
      <rect x={r2(10 * kx)} y={r2(shelfY)} width={r2(w - 20 * kx)} height={r2(3.4 * ky)} fill={frame} />
      {items}
      {/* Posts. */}
      <rect x={r2(3 * kx)} y={r2(roofH)} width={r2(8 * kx)} height={r2(panelBot - roofH)} fill={`url(#${id}f)`} />
      <rect x={r2(w - 11 * kx)} y={r2(roofH)} width={r2(8 * kx)} height={r2(panelBot - roofH)} fill={`url(#${id}f)`} />
      {/* The counter: a lit top face, a painted front with a border and lozenges, and a jhalar fringe. */}
      <rect x={r2(2 * kx)} y={r2(counterTop - 2 * ky)} width={r2(w - 4 * kx)} height={r2(5 * ky)} fill={mix(colors.surface, frame, 0.25)} />
      <rect x={r2(4 * kx)} y={r2(counterTop + 3 * ky)} width={r2(w - 8 * kx)} height={r2(panelBot - counterTop - 3 * ky)} fill={`url(#${id}f)`} />
      <rect x={r2(9 * kx)} y={r2(counterTop + 14 * ky)} width={r2(w - 18 * kx)} height={r2(panelBot - counterTop - 20 * ky)} fill="none" stroke={metal} strokeWidth={r2(1.6 * k)} />
      {full ? (
        <path
          d={Array.from({ length: 7 }, (_, i) => {
            const x = w * 0.14 + (i * w * 0.72) / 6;
            const y = (counterTop + 14 * ky + panelBot - 6 * ky) / 2;
            return P`M${x} ${y - 7 * k}L${x + 5 * k} ${y}L${x} ${y + 7 * k}L${x - 5 * k} ${y}Z`;
          }).join('')}
          fill={colors.accent}
          stroke={metal}
          strokeWidth={r2(0.8 * k)}
        />
      ) : null}
      <path d={Array.from({ length: 12 }, (_, i) => P`M${4 * kx + (i * (w - 8 * kx)) / 12} ${counterTop + 3 * ky}h${(w - 8 * kx) / 12}l${-(w - 8 * kx) / 24} ${8 * ky}Z`).join('')} fill={colors.accent} opacity={0.9} />
      {p.variant === 'food' ? (
        [w * 0.24, w * 0.76].map((x) => {
          const r = 15 * k;
          const cy = h - r - 1;
          const spokes = Array.from({ length: 6 }, (_, i) => {
            const pt = aroundEllipse(x, cy, r, r, i / 6 + 0.04);
            return P`M${x} ${cy}L${pt.x} ${pt.y}`;
          }).join('');
          return (
            <g key={x}>
              <path d={spokes} stroke={fline} strokeWidth={r2(1.6 * k)} />
              <circle cx={r2(x)} cy={r2(cy)} r={r2(r)} fill="none" stroke={fline} strokeWidth={r2(3 * k)} />
              <circle cx={r2(x)} cy={r2(cy)} r={r2(r)} fill="none" stroke={metal} strokeWidth={r2(1 * k)} />
              <circle cx={r2(x)} cy={r2(cy)} r={r2(3 * k)} fill={metal} />
            </g>
          );
        })
      ) : (
        <path d={P`M${6 * kx} ${panelBot}h${10 * kx}V${h}h${-10 * kx}ZM${w - 16 * kx} ${panelBot}h${10 * kx}V${h}h${-10 * kx}Z`} fill={fline} />
      )}
      {/* Roof board, the striped awning with scallops and its marigold string. */}
      <rect x={0} y={0} width={r2(w)} height={r2(roofH)} fill={frame} />
      {full ? <path d={P`M${4 * kx} ${roofH / 2}H${w - 4 * kx}`} stroke={metal} strokeWidth={r2(4 * k)} strokeDasharray={`${r2(4 * k)} ${r2(4 * k)}`} /> : null}
      <rect x={0} y={r2(roofH - 2.6 * ky)} width={r2(w)} height={r2(2.6 * ky)} fill={metal} />
      <path d={Array.from({ length: strips }, (_, i) => (i % 2 ? '' : P`M${i * sw} ${roofH}H${(i + 1) * sw}V${awnBot - 6 * ky}Q${(i + 0.5) * sw} ${awnBot + 6 * ky} ${i * sw} ${awnBot - 6 * ky}Z`)).join('')} fill={stripA} />
      <path d={Array.from({ length: strips }, (_, i) => (i % 2 ? P`M${i * sw} ${roofH}H${(i + 1) * sw}V${awnBot - 6 * ky}Q${(i + 0.5) * sw} ${awnBot + 6 * ky} ${i * sw} ${awnBot - 6 * ky}Z` : '')).join('')} fill={stripB} />
      <rect x={0} y={r2(roofH)} width={r2(w)} height={r2(awnBot - roofH)} fill={`url(#${id}v)`} />
      <path d={swag} fill="none" stroke={marigold} strokeWidth={r2(4.6 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(4.4 * k)}`} />
      {full ? <path d={swag} fill="none" stroke={nature.flame} strokeWidth={r2(2.4 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(8.8 * k)}`} /> : null}
      <rect x={0} y={0} width={r2(w)} height={r2(panelBot)} fill={`url(#${id}a)`} />
    </KitSvg>
  );
}

// ─────────────────────────── Pedestal ───────────────────────────

/** A stepped marble pedestal with pietra dura inlay, a circus drum, or a stone plinth, each with a lit top face; `top` (any element, laid out in the space above the top face) stands on it. */
export function Pedestal(props: DrawProps & PedestalOptions) {
  const p = props;
  const id = kitId(p, `pd${p.variant}${props.top ? 't' : ''}`);
  const { w, h, colors, nature } = p;
  const k = w / 160;
  const full = p.detail === 'full';
  const T = props.top ? h * 0.42 : 0;
  let body: ReactNode;
  if (p.variant === 'drum') {
    const x0 = 10 * k;
    const x1 = w - 10 * k;
    const rx = (x1 - x0) / 2;
    const ry = 12 * k;
    const cx = w / 2;
    const top = T + ry;
    const bot = h - ry - 2 * k;
    const band = (y: number, hh: number) => P`M${x0} ${y}A${rx} ${ry} 0 0 0 ${x1} ${y}V${y + hh}A${rx} ${ry} 0 0 1 ${x0} ${y + hh}Z`;
    const teeth = 7;
    const zig = (y0: number, y1: number) => Array.from({ length: teeth * 2 + 1 }, (_, i) => `${i ? 'L' : 'M'}${r2(x0 + ((x1 - x0) * i) / (teeth * 2))} ${r2(i % 2 ? y1 : y0)}`).join('');
    const zy0 = top + 26 * k;
    const zy1 = bot - 22 * k;
    body = (
      <>
        <path d={P`M${x0} ${top}V${bot}A${rx} ${ry} 0 0 0 ${x1} ${bot}V${top}Z`} fill={`url(#${id}b)`} />
        <path d={zig(zy0, zy1)} fill="none" stroke={colors.secondary} strokeWidth={r2(5 * k)} strokeLinejoin="round" />
        {full ? <path d={zig(zy0 + 9 * k, zy1 - 9 * k)} fill="none" stroke={colors.background} strokeWidth={r2(1.6 * k)} opacity={0.8} /> : null}
        <path d={band(top, 12 * k)} fill={`url(#${id}m)`} />
        <path d={band(bot - 12 * k, 12 * k)} fill={`url(#${id}m)`} />
        {full ? <path d={P`M${x0 + 8 * k} ${top + 17 * k}H${x1 - 8 * k}M${x0 + 8 * k} ${bot + 3 * k}H${x1 - 8 * k}`} stroke={tint(colors.secondary, 0.4)} strokeWidth={r2(3 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(14 * k)}`} /> : null}
        <path d={P`M${x0} ${top}V${bot}A${rx} ${ry} 0 0 0 ${x1} ${bot}V${top}Z`} fill={`url(#${id}c)`} />
        <ellipse cx={r2(cx)} cy={r2(top)} rx={r2(rx)} ry={r2(ry)} fill={mix(colors.background, colors.accent, 0.3)} stroke={`url(#${id}m)`} strokeWidth={r2(3 * k)} />
        <Rim p={p} x0={x0} x1={x1} y0={top} y1={bot} k={k} />
      </>
    );
  } else if (p.variant === 'stone') {
    const stone = mix(colors.muted, colors.surface, 0.35);
    const line = shade(stone, 0.4);
    const tiers: Array<[number, number, number]> = [
      [0, h - 30 * k, h],
      [10 * k, T + 30 * k, h - 30 * k],
      [2 * k, T + 6 * k, T + 30 * k],
    ];
    const chisel = full
      ? Array.from({ length: 16 }, (_, i) => {
          const x = 16 * k + rand(i, p.seed) * (w - 32 * k);
          const y = T + 40 * k + rand(i, p.seed + 3) * (h - T - 80 * k);
          return P`M${x} ${y}l${3 * k} ${-1.4 * k}`;
        }).join('')
      : '';
    body = (
      <>
        {tiers.map(([inset, y0, y1]) => (
          <rect key={y0} x={r2(inset)} y={r2(y0)} width={r2(w - 2 * inset)} height={r2(y1 - y0)} fill={`url(#${id}s)`} stroke={line} strokeWidth={r2(0.8 * k)} />
        ))}
        <rect x={r2(24 * k)} y={r2(T + 48 * k)} width={r2(w - 48 * k)} height={r2(h - T - 96 * k)} fill={shade(stone, 0.08)} stroke={line} strokeWidth={r2(0.8 * k)} />
        <path d={P`M${24 * k} ${T + 48 * k}l${4 * k} ${4 * k}H${w - 28 * k}V${h - 52 * k}`} fill="none" stroke={shade(stone, 0.3)} strokeWidth={r2(1.6 * k)} opacity={0.6} />
        <path d={P`M${10 * k} ${T + 38 * k}H${w - 10 * k}M${10 * k} ${h - 38 * k}H${w - 10 * k}M${2 * k} ${T + 18 * k}H${w - 2 * k}`} stroke={line} strokeWidth={r2(0.8 * k)} />
        {full ? <path d={chisel} stroke={line} strokeWidth={r2(0.8 * k)} opacity={0.6} /> : null}
        {full ? <path d={P`M${w / 2} ${T + 62 * k}L${w / 2 + 14 * k} ${(T + h) / 2}L${w / 2} ${h - 62 * k}L${w / 2 - 14 * k} ${(T + h) / 2}Z`} fill="none" stroke={line} strokeWidth={r2(0.9 * k)} /> : null}
        <rect x={r2(2 * k)} y={r2(T)} width={r2(w - 4 * k)} height={r2(6 * k)} fill={tint(stone, 0.3)} />
        <path d={P`M${6 * k} ${h}C${10 * k} ${h - 8 * k} ${16 * k} ${h - 10 * k} ${22 * k} ${h - 4 * k}C${26 * k} ${h - 9 * k} ${32 * k} ${h - 8 * k} ${34 * k} ${h}Z`} fill={nature.leafDark} />
        <Rim p={p} x0={10 * k} x1={w - 10 * k} y0={T + 30 * k} y1={h - 30 * k} k={k} />
      </>
    );
  } else {
    const marble = mix(colors.surface, colors.background, 0.5);
    const line = shade(marble, 0.3);
    const d0 = 18 * k;
    const d1 = w - 18 * k;
    const dy0 = T + 30 * k;
    const dy1 = h - 30 * k;
    const cx = w / 2;
    const cy = (dy0 + dy1) / 2;
    const fl = Math.min((d1 - d0) * 0.3, (dy1 - dy0) * 0.22);
    const inlay = full ? (
      <>
        <path d={P`M${cx} ${cy + fl * 1.3}C${cx - fl * 0.1} ${cy} ${cx + fl * 0.1} ${cy - fl * 0.5} ${cx} ${cy - fl * 0.9}M${cx} ${cy + fl * 0.6}C${cx - fl * 0.4} ${cy + fl * 0.1} ${cx - fl * 0.7} ${cy} ${cx - fl * 0.8} ${cy - fl * 0.3}M${cx} ${cy + fl * 0.6}C${cx + fl * 0.4} ${cy + fl * 0.1} ${cx + fl * 0.7} ${cy} ${cx + fl * 0.8} ${cy - fl * 0.3}`} fill="none" stroke={nature.leafDark} strokeWidth={r2(1.2 * k)} />
        <path d={[-1, 1].map((s) => P`M${cx} ${cy + fl * 0.9}C${cx + s * fl * 0.3} ${cy + fl * 0.7} ${cx + s * fl * 0.55} ${cy + fl * 0.8} ${cx + s * fl * 0.6} ${cy + fl}C${cx + s * fl * 0.35} ${cy + fl * 1.05} ${cx + s * fl * 0.15} ${cy + fl * 1.02} ${cx} ${cy + fl * 0.9}Z`).join('')} fill={nature.leaf} />
        {[[cx, cy - fl * 0.95], [cx - fl * 0.82, cy - fl * 0.35], [cx + fl * 0.82, cy - fl * 0.35]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={r2(x!)} cy={r2(y!)} r={r2(fl * 0.24)} fill={i ? colors.accent : mix(colors.primary, colors.accent, 0.2)} stroke={colors.secondary} strokeWidth={r2(0.6 * k)} />
            <circle cx={r2(x!)} cy={r2(y!)} r={r2(fl * 0.08)} fill={colors.secondary} />
          </g>
        ))}
      </>
    ) : null;
    body = (
      <>
        <rect x={0} y={r2(h - 16 * k)} width={r2(w)} height={r2(16 * k)} fill={`url(#${id}s)`} stroke={line} strokeWidth={r2(0.6 * k)} />
        <rect x={r2(8 * k)} y={r2(dy1)} width={r2(w - 16 * k)} height={r2(14 * k)} fill={`url(#${id}s)`} stroke={line} strokeWidth={r2(0.6 * k)} />
        <rect x={r2(d0)} y={r2(dy0)} width={r2(d1 - d0)} height={r2(dy1 - dy0)} fill={`url(#${id}s)`} />
        <rect x={r2(d0 + 8 * k)} y={r2(dy0 + 10 * k)} width={r2(d1 - d0 - 16 * k)} height={r2(dy1 - dy0 - 20 * k)} fill="none" stroke={`url(#${id}m)`} strokeWidth={r2(2.2 * k)} />
        {full ? <rect x={r2(d0 + 13 * k)} y={r2(dy0 + 15 * k)} width={r2(d1 - d0 - 26 * k)} height={r2(dy1 - dy0 - 30 * k)} fill="none" stroke={colors.accent} strokeWidth={r2(0.8 * k)} /> : null}
        {inlay}
        <rect x={r2(6 * k)} y={r2(T + 12 * k)} width={r2(w - 12 * k)} height={r2(18 * k)} fill={`url(#${id}s)`} stroke={line} strokeWidth={r2(0.6 * k)} />
        <path d={P`M${6 * k} ${T + 18 * k}H${w - 6 * k}`} stroke={`url(#${id}m)`} strokeWidth={r2(1.4 * k)} />
        <rect x={r2(2 * k)} y={r2(T + 4 * k)} width={r2(w - 4 * k)} height={r2(8 * k)} fill={tint(marble, 0.4)} stroke={line} strokeWidth={r2(0.6 * k)} />
        <rect x={r2(4 * k)} y={r2(T)} width={r2(w - 8 * k)} height={r2(4 * k)} fill={tint(marble, 0.55)} />
        <Rim p={p} x0={d0} x1={d1} y0={dy0} y1={dy1} k={k} />
        <Rim p={p} x0={0} x1={w} y0={h - 16 * k} y1={h} k={k} />
      </>
    );
  }
  const base = p.variant === 'drum' ? colors.primary : mix(colors.surface, colors.background, p.variant === 'stone' ? 0 : 0.5);
  const stoneBase = p.variant === 'stone' ? mix(colors.muted, colors.surface, 0.35) : base;
  const svg = (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(stoneBase, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}b`} stops={[[0, colors.primary], [1, colors.primary]]} x1={0} x2={w} />
        <Lin id={`${id}c`} stops={cylinderStops(p.light.from)} x1={10 * k} x2={w - 10 * k} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={0} y1={0} x2={w} y2={30 * k} />
      </defs>
      {body}
    </KitSvg>
  );
  if (!props.top) return svg;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {svg}
      <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, height: `${r2(((T + (p.variant === 'drum' ? 12 * k : 4 * k)) / h) * 100)}%` }}>{props.top}</div>
    </div>
  );
}

// ─────────────────────────── Fountain ───────────────────────────

/** A slender jet (taper strokes with falling arcs and droplets) or two marble basins with water falling between them. */
export function Fountain(props: DrawProps & FountainOptions) {
  const p = props;
  const id = kitId(p, `fo${p.variant}`);
  const { w, h, colors } = p;
  const full = p.detail === 'full';
  const water = mix(colors.background, colors.primary, 0.3);
  const edge = { stroke: mix(colors.primary, colors.background, 0.4), strokeOpacity: 0.45 };
  const bright = mix(colors.background, p.light.color, 0.25);
  const marble = mix(colors.surface, colors.background, 0.5);
  const mline = shade(marble, 0.3);
  const cx = w / 2;
  const droplets = (segs: Segment[], count: number, k: number) =>
    segs
      .flatMap((s, si) =>
        Array.from({ length: count }, (_, i) => {
          const pt = onCubic(s, 0.25 + (i / count) * 0.7);
          const dx = (rand(si * 13 + i, p.seed) - 0.5) * 6 * k;
          const dy = (rand(si * 7 + i, p.seed + 1) - 0.5) * 6 * k;
          const r = (0.7 + rand(i, si + 3) * 0.9) * k;
          return P`M${pt.x + dx + r} ${pt.y + dy}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
        }),
      )
      .join('');
  if (p.variant === 'jet') {
    const k = w / 60;
    const foot = h - 10 * k;
    const wob = (rand(p.seed, 4) - 0.5) * 3 * k;
    const jet = taper(
      [
        [[cx, foot], [cx + wob, foot - h * 0.3], [cx - wob, foot - h * 0.55], [cx, h * 0.3]],
        [[cx, h * 0.3], [cx + wob * 0.5, h * 0.2], [cx, h * 0.12], [cx, 6 * k]],
      ],
      [5 * k, 3 * k, 1.2 * k],
      12,
    );
    const arcs: Segment[] = [-1, 1, -0.6, 0.6].map((s) => [
      [cx, 12 * k],
      [cx + s * 12 * k, 4 * k],
      [cx + s * 22 * k, h * 0.3],
      [cx + s * 25 * k, foot - 4 * k],
    ]);
    return (
      <KitSvg p={p}>
        <defs>
          <Lin id={`${id}j`} stops={[[0, bright, 0.95], [1, water, 0.7]]} x1={0} y1={0} x2={0} y2={h} />
        </defs>
        <path d={arcs.map((s) => taper([s], [2 * k, 0.5 * k], 10)).join('')} fill={water} opacity={0.7} />
        <path d={jet} fill={`url(#${id}j)`} {...edge} strokeWidth={r2(0.5 * k)} />
        <ellipse cx={r2(cx)} cy={r2(10 * k)} rx={r2(4 * k)} ry={r2(6 * k)} fill={bright} opacity={0.5} />
        {full ? <path d={droplets(arcs, 4, k)} fill={bright} opacity={0.85} /> : null}
        <ellipse cx={r2(cx)} cy={r2(foot + 2 * k)} rx={r2(24 * k)} ry={r2(6 * k)} fill={marble} stroke={mline} strokeWidth={r2(0.6 * k)} />
        <ellipse cx={r2(cx)} cy={r2(foot)} rx={r2(16 * k)} ry={r2(3 * k)} fill={bright} opacity={0.7} />
        <path d={P`M${cx - 10 * k} ${foot}Q${cx - 8 * k} ${foot - 9 * k} ${cx - 4 * k} ${foot - 6 * k}M${cx + 10 * k} ${foot}Q${cx + 8 * k} ${foot - 9 * k} ${cx + 4 * k} ${foot - 6 * k}`} fill="none" stroke={bright} strokeWidth={r2(1.4 * k)} opacity={0.8} />
      </KitSvg>
    );
  }
  const k = w / 260;
  const poolTop = h - 46 * k;
  const b1 = h * 0.5;
  const b2 = h * 0.24;
  const bowl = (y: number, rx: number, dh: number) => P`M${cx - rx} ${y}C${cx - rx * 0.9} ${y + dh * 0.7} ${cx - rx * 0.35} ${y + dh} ${cx} ${y + dh}C${cx + rx * 0.35} ${y + dh} ${cx + rx * 0.9} ${y + dh * 0.7} ${cx + rx} ${y}Z`;
  const stem = (y0: number, y1: number, sw: number) => P`M${cx - sw * 0.4} ${y1}C${cx - sw * 0.4} ${y1 - (y1 - y0) * 0.3} ${cx - sw} ${y1 - (y1 - y0) * 0.45} ${cx - sw * 0.6} ${y0 + (y1 - y0) * 0.25}C${cx - sw * 0.3} ${y0 + (y1 - y0) * 0.12} ${cx - sw * 0.3} ${y0} ${cx - sw * 0.5} ${y0}H${cx + sw * 0.5}C${cx + sw * 0.3} ${y0} ${cx + sw * 0.3} ${y0 + (y1 - y0) * 0.12} ${cx + sw * 0.6} ${y0 + (y1 - y0) * 0.25}C${cx + sw} ${y1 - (y1 - y0) * 0.45} ${cx + sw * 0.4} ${y1 - (y1 - y0) * 0.3} ${cx + sw * 0.4} ${y1}Z`;
  const r1 = w * 0.4;
  const r2b = w * 0.2;
  const curtains: Segment[] = [
    [[cx - r1, b1], [cx - r1 - 6 * k, b1 + 20 * k], [cx - r1 - 8 * k, poolTop - 30 * k], [cx - r1 - 6 * k, poolTop - 4 * k]],
    [[cx + r1, b1], [cx + r1 + 6 * k, b1 + 20 * k], [cx + r1 + 8 * k, poolTop - 30 * k], [cx + r1 + 6 * k, poolTop - 4 * k]],
    [[cx - r2b, b2], [cx - r2b - 4 * k, b2 + 14 * k], [cx - r2b - 6 * k, b1 - 20 * k], [cx - r2b - 5 * k, b1 - 2 * k]],
    [[cx + r2b, b2], [cx + r2b + 4 * k, b2 + 14 * k], [cx + r2b + 6 * k, b1 - 20 * k], [cx + r2b + 5 * k, b1 - 2 * k]],
  ];
  const jet: Segment = [[cx, b2 - 30 * k], [cx + 2 * k, b2 - 50 * k], [cx - 2 * k, 20 * k], [cx, 4 * k]];
  const spray: Segment[] = [-1, 1].map((s) => [[cx, 8 * k], [cx + s * 14 * k, 2 * k], [cx + s * 26 * k, b2 - 40 * k], [cx + s * 30 * k, b2 - 4 * k]]);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(marble, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={cx - 20 * k} y1={0} x2={cx + 20 * k} y2={10 * k} />
        <Lin id={`${id}j`} stops={[[0, bright, 0.9], [1, water, 0.55]]} x1={0} y1={0} x2={0} y2={h} />
      </defs>
      {/* The pool: its water and a carved wall with a lit coping. */}
      <ellipse cx={r2(cx)} cy={r2(poolTop - 2 * k)} rx={r2(w * 0.49)} ry={r2(9 * k)} fill={water} />
      {full ? <path d={P`M${cx - w * 0.3} ${poolTop - 3 * k}Q${cx} ${poolTop + 3 * k} ${cx + w * 0.3} ${poolTop - 3 * k}M${cx - w * 0.18} ${poolTop - 7 * k}Q${cx} ${poolTop - 2 * k} ${cx + w * 0.18} ${poolTop - 7 * k}`} fill="none" stroke={bright} strokeWidth={r2(1.2 * k)} opacity={0.7} /> : null}
      <rect x={0} y={r2(poolTop)} width={r2(w)} height={r2(h - poolTop)} fill={`url(#${id}s)`} stroke={mline} strokeWidth={r2(0.6 * k)} />
      <rect x={0} y={r2(poolTop)} width={r2(w)} height={r2(8 * k)} fill={tint(marble, 0.4)} stroke={mline} strokeWidth={r2(0.6 * k)} />
      {full ? <path d={[0, 1, 2].map((i) => P`M${w * (0.06 + i * 0.32)} ${poolTop + 15 * k}h${w * 0.24}v${20 * k}h${-w * 0.24}Z`).join('')} fill="none" stroke={mline} strokeWidth={r2(0.8 * k)} /> : null}
      {/* Stems, the two bowls and the gilt finial. */}
      <path d={stem(b1 + 26 * k, poolTop, 40 * k)} fill={`url(#${id}s)`} stroke={mline} strokeWidth={r2(0.6 * k)} />
      <path d={bowl(b1, r1, 32 * k)} fill={`url(#${id}s)`} stroke={mline} strokeWidth={r2(0.6 * k)} />
      {full ? <path d={[-0.6, -0.3, 0, 0.3, 0.6].map((f) => P`M${cx + f * r1} ${b1 + 2 * k}Q${cx + f * r1 * 0.75} ${b1 + 20 * k} ${cx + f * r1 * 0.4} ${b1 + 29 * k}`).join('')} fill="none" stroke={mline} strokeWidth={r2(0.7 * k)} opacity={0.7} /> : null}
      <ellipse cx={r2(cx)} cy={r2(b1)} rx={r2(r1)} ry={r2(7 * k)} fill={water} stroke={`url(#${id}m)`} strokeWidth={r2(2 * k)} />
      <path d={stem(b2 + 18 * k, b1, 26 * k)} fill={`url(#${id}s)`} stroke={mline} strokeWidth={r2(0.6 * k)} />
      <path d={bowl(b2, r2b, 20 * k)} fill={`url(#${id}s)`} stroke={mline} strokeWidth={r2(0.6 * k)} />
      <ellipse cx={r2(cx)} cy={r2(b2)} rx={r2(r2b)} ry={r2(4.5 * k)} fill={water} stroke={`url(#${id}m)`} strokeWidth={r2(1.6 * k)} />
      <path d={P`M${cx - 7 * k} ${b2}C${cx - 10 * k} ${b2 - 14 * k} ${cx - 4 * k} ${b2 - 24 * k} ${cx} ${b2 - 32 * k}C${cx + 4 * k} ${b2 - 24 * k} ${cx + 10 * k} ${b2 - 14 * k} ${cx + 7 * k} ${b2}Z`} fill={`url(#${id}m)`} stroke={shade(colors.secondary, 0.4)} strokeWidth={r2(0.6 * k)} />
      {/* Water: the jet, its spray and the curtains falling from both rims. */}
      <path d={taper([jet], [4 * k, 1 * k], 10)} fill={`url(#${id}j)`} {...edge} strokeWidth={r2(0.5 * k)} />
      <path d={spray.map((s) => taper([s], [2.2 * k, 0.6 * k], 8)).join('')} fill={water} opacity={0.55} />
      <path d={curtains.map((s) => taper([s], [5 * k, 9 * k], 6)).join('')} fill={`url(#${id}j)`} opacity={0.8} {...edge} strokeWidth={r2(0.6 * k)} />
      {full ? <path d={curtains.map((s) => taper([s], [0.8 * k, 1.4 * k], 6)).join('')} fill={bright} opacity={0.75} /> : null}
      {full ? <path d={droplets([...spray, curtains[0]!, curtains[1]!], 2, k * 1.4)} fill={bright} opacity={0.85} /> : null}
      <Rim p={p} x0={0} x1={w} y0={poolTop} y1={h} k={k} />
    </KitSvg>
  );
}

// ─────────────────────────── registry (sheets, Studio) ───────────────────────────

type Boxes = Record<string, { w: number; h: number }>;
const boxOf = (boxes: Boxes) => (variant: string) => boxes[variant] ?? Object.values(boxes)[0]!;

/** The sheet's sample top for a pedestal: a diya on the marble one. */
const sampleTop = (p: DrawProps, v: string) => (v === 'marble' ? motif('diya')({ ...p, w: p.w * 0.8, h: p.h * 0.38 }) : undefined);

export const ARCHITECTURE_KIT: readonly KitEntry[] = [
  { name: 'Pillar', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Pillar), box: boxOf(ARCHITECTURE_BOXES.Pillar), render: (p, v) => <Pillar {...p} variant={v as PillarVariant} /> },
  { name: 'Pole', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Pole), box: boxOf(ARCHITECTURE_BOXES.Pole), render: (p, v) => <Pole {...p} variant={v as PoleVariant} /> },
  { name: 'LampPost', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.LampPost), box: boxOf(ARCHITECTURE_BOXES.LampPost), render: (p, v) => <LampPost {...p} variant={v as LampPostVariant} /> },
  { name: 'Balustrade', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Balustrade), box: boxOf(ARCHITECTURE_BOXES.Balustrade), render: (p, v) => <Balustrade {...p} variant={v as BalustradeVariant} /> },
  { name: 'Stall', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Stall), box: boxOf(ARCHITECTURE_BOXES.Stall), render: (p, v) => <Stall {...p} variant={v as StallVariant} /> },
  { name: 'Pedestal', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Pedestal), box: boxOf(ARCHITECTURE_BOXES.Pedestal), render: (p, v) => <Pedestal {...p} variant={v as PedestalVariant} top={sampleTop(p, v)} /> },
  { name: 'Fountain', file: 'architecture', variants: Object.keys(ARCHITECTURE_BOXES.Fountain), box: boxOf(ARCHITECTURE_BOXES.Fountain), render: (p, v) => <Fountain {...p} variant={v as FountainVariant} /> },
];
