import type { CSSProperties } from 'react';
import { cubicBezier } from './camera';
import type { BuildIn, Motion, MotionKind } from './types';
import { clamp, num } from './units';

/**
 * Motion as data (final.md §3.9): one definition, two renderers. The web
 * compiles every kind once to `@keyframes bulava-m-<kind>` (StageStyles) and a
 * piece's motion wrapper runs it with `--m-amp`; films evaluate `motionAt` from
 * the same stops, frame by frame, with the same easing per segment and the same
 * transform-function order. Only transform and opacity move.
 *
 * Build-in (§3.1.5) is the same idea for the set assembling after a stage
 * opening: `.bulava-unbuilt` holds the from-states, `.bulava-build` plays them
 * with a delay by depth; films call `buildAt`.
 */

export type MotionChannel = 'x' | 'y' | 'rotate' | 'rotateY' | 'skewY' | 'scaleX' | 'scaleY' | 'opacity';
/** A channel's value at a stop: base + perAmp × amp (x and y in units, angles in degrees). */
export type MotionValue = readonly [base: number, perAmp: number];
export interface MotionStop {
  at: number;
  values: Readonly<Partial<Record<MotionChannel, MotionValue>>>;
}
export interface MotionDef {
  stops: readonly MotionStop[];
  /** Per segment, as CSS animation-timing-function. */
  timing: 'ease-in-out' | 'linear';
  /** The motion wrapper's transform-origin. */
  origin: string;
}

const s = (at: number, values: MotionStop['values']): MotionStop => ({ at, values });
const A = (perAmp: number, base = 0): MotionValue => [base, perAmp];
const C = (base: number): MotionValue => [base, 0];

/** The stops of every motion kind (the table in final.md §3.9). */
export const MOTION_TABLE: Readonly<Record<MotionKind, MotionDef>> = {
  sway: { timing: 'ease-in-out', origin: '50% 0', stops: [s(0, { rotate: A(-1) }), s(0.5, { rotate: A(1) }), s(1, { rotate: A(-1) })] },
  bob: { timing: 'ease-in-out', origin: '50% 50%', stops: [s(0, { y: C(0) }), s(0.5, { y: A(-1) }), s(1, { y: C(0) })] },
  flicker: {
    timing: 'ease-in-out',
    origin: '50% 100%',
    stops: [
      s(0, { scaleX: C(1), scaleY: C(1), opacity: C(1) }),
      s(0.25, { scaleX: A(-0.06, 1), scaleY: A(0.06, 1), opacity: A(-0.1, 1) }),
      s(0.5, { scaleX: A(0.04, 1), scaleY: A(-0.04, 1), opacity: C(1) }),
      s(0.75, { scaleX: A(-0.03, 1), scaleY: A(0.03, 1), opacity: A(-0.08, 1) }),
      s(1, { scaleX: C(1), scaleY: C(1), opacity: C(1) }),
    ],
  },
  drift: { timing: 'ease-in-out', origin: '50% 50%', stops: [s(0, { x: A(-1) }), s(0.5, { x: A(1) }), s(1, { x: A(-1) })] },
  // amp carries only the direction: the CSS gets its sign (motionAmp).
  spin: { timing: 'linear', origin: '50% 50%', stops: [s(0, { rotate: C(0) }), s(1, { rotate: A(360) })] },
  coin: { timing: 'linear', origin: '50% 50%', stops: [s(0, { rotateY: C(0) }), s(1, { rotateY: C(360) })] },
  shimmer: { timing: 'ease-in-out', origin: '50% 50%', stops: [s(0, { x: C(0), opacity: C(1) }), s(0.5, { x: A(4), opacity: A(-1, 1) }), s(1, { x: C(0), opacity: C(1) })] },
  twinkle: { timing: 'ease-in-out', origin: '50% 50%', stops: [s(0, { opacity: C(1) }), s(0.5, { opacity: A(-1, 1) }), s(1, { opacity: C(1) })] },
  flutter: { timing: 'ease-in-out', origin: '50% 50%', stops: [s(0, { skewY: C(0) }), s(0.25, { skewY: A(1) }), s(0.75, { skewY: A(-1) }), s(1, { skewY: C(0) })] },
  pulse: {
    timing: 'ease-in-out',
    origin: '50% 50%',
    stops: [s(0, { scaleX: C(1), scaleY: C(1), opacity: C(1) }), s(0.5, { scaleX: A(0.05, 1), scaleY: A(0.05, 1), opacity: A(-0.15, 1) }), s(1, { scaleX: C(1), scaleY: C(1), opacity: C(1) })],
  },
  fall: { timing: 'linear', origin: '50% 50%', stops: [s(0, { y: A(-1), opacity: C(0) }), s(0.1, { y: A(-0.8), opacity: C(1) }), s(0.9, { y: A(0.8), opacity: C(1) }), s(1, { y: A(1), opacity: C(0) })] },
  rise: { timing: 'linear', origin: '50% 50%', stops: [s(0, { y: A(1), opacity: C(0) }), s(0.1, { y: A(0.8), opacity: C(1) }), s(0.9, { y: A(-0.8), opacity: C(1) }), s(1, { y: A(-1), opacity: C(0) })] },
};

/** The kinds in a stable order (keyframes, tests). */
export const MOTION_KINDS = Object.keys(MOTION_TABLE) as MotionKind[];

/** The amplitude a kind runs with: spin keeps only its direction. */
export const motionAmp = (m: Pick<Motion, 'kind' | 'amp'>): number => (m.kind === 'spin' ? (m.amp < 0 ? -1 : 1) : m.amp);

/** The transform channels a kind moves, in the one order both renderers use. */
function channelsOf(def: MotionDef): { translate: boolean; rotate: boolean; rotateY: boolean; skewY: boolean; scale: boolean; opacity: boolean } {
  const has = (c: MotionChannel) => def.stops.some((st) => st.values[c] !== undefined);
  return { translate: has('x') || has('y'), rotate: has('rotate'), rotateY: has('rotateY'), skewY: has('skewY'), scale: has('scaleX') || has('scaleY'), opacity: has('opacity') };
}

// ─────────────────────────── CSS (the web) ───────────────────────────

/** A number channel as CSS: base + perAmp·var(--m-amp). */
function cssNumber([base, per]: MotionValue): string {
  if (per === 0) return num(base);
  return base === 0 ? `calc(${num(per)} * var(--m-amp))` : `calc(${num(base)} + ${num(per)} * var(--m-amp))`;
}
const cssAngle = ([base, per]: MotionValue): string => (per === 0 ? `${num(base)}deg` : base === 0 ? `calc(${num(per)}deg * var(--m-amp))` : `calc(${num(base)}deg + ${num(per)}deg * var(--m-amp))`);
function cssLength([base, per]: MotionValue): string {
  if (per === 0) return base === 0 ? '0' : `calc(${num(base)} * var(--u))`;
  const n = base === 0 ? `${num(per)} * var(--m-amp)` : `(${num(base)} + ${num(per)} * var(--m-amp))`;
  return `calc(${n} * var(--u))`;
}

/** One keyframe's declarations. */
function cssStop(def: MotionDef, st: MotionStop): string {
  const ch = channelsOf(def);
  const v = (c: MotionChannel, fallback: number): MotionValue => st.values[c] ?? C(fallback);
  const parts: string[] = [];
  if (ch.translate) parts.push(`translate(${cssLength(v('x', 0))}, ${cssLength(v('y', 0))})`);
  if (ch.rotate) parts.push(`rotate(${cssAngle(v('rotate', 0))})`);
  if (ch.rotateY) parts.push(`rotateY(${cssAngle(v('rotateY', 0))})`);
  if (ch.skewY) parts.push(`skewY(${cssAngle(v('skewY', 0))})`);
  if (ch.scale) parts.push(`scale(${cssNumber(v('scaleX', 1))}, ${cssNumber(v('scaleY', 1))})`);
  const decl = parts.length ? [`transform: ${parts.join(' ')}`] : [];
  if (ch.opacity) decl.push(`opacity: ${cssNumber(v('opacity', 1))}`);
  return `${num(st.at * 100)}% { ${decl.join('; ')}; }`;
}

/** Every motion kind compiled to its keyframes, once (StageStyles). */
export const motionCss: string = MOTION_KINDS.map((kind) => `@keyframes bulava-m-${kind} { ${MOTION_TABLE[kind].stops.map((st) => cssStop(MOTION_TABLE[kind], st)).join(' ')} }`).join('\n');

/** The web's motion wrapper style: the kind's keyframes with the piece's amplitude, period and phase. */
export function motionStyle(m: Motion): CSSProperties {
  const def = MOTION_TABLE[m.kind];
  const period = Math.max(0.1, m.period);
  const delay = -((((m.phase ?? 0) % 1) + 1) % 1) * period;
  return {
    animation: `bulava-m-${m.kind} ${num(period)}s ${def.timing} ${num(delay)}s infinite`,
    ['--m-amp' as string]: num(motionAmp(m)),
    transformOrigin: def.origin,
  };
}

// ─────────────────────────── Frames (films) ───────────────────────────

const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
const easeOut = cubicBezier(0, 0, 0.58, 1);

/** A length in units as CSS (films set --u in px, so their strings match the web's). */
const unitLength = (n: number): string => (Math.round(n * 100) === 0 ? '0' : `calc(${num(n)} * var(--u))`);

/** Where a motion is at t seconds: the wrapper's transform and opacity, exactly as the CSS animation would draw them. */
export function motionAt(m: Motion, t: number): { transform: string; opacity: number; origin: string } {
  const def = MOTION_TABLE[m.kind];
  const period = Math.max(0.1, m.period);
  const phase = (((t / period + (m.phase ?? 0)) % 1) + 1) % 1;
  const stops = def.stops;
  let i = 0;
  while (i < stops.length - 2 && phase >= stops[i + 1]!.at) i++;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const span = b.at - a.at;
  const local = span > 0 ? clamp((phase - a.at) / span) : 1;
  const k = def.timing === 'linear' ? local : easeInOut(local);
  const amp = motionAmp(m);
  const at = (c: MotionChannel, fallback: number) => {
    const va = a.values[c] ?? C(fallback);
    const vb = b.values[c] ?? C(fallback);
    const x = va[0] + va[1] * amp;
    const y = vb[0] + vb[1] * amp;
    return x + (y - x) * k;
  };
  const ch = channelsOf(def);
  const parts: string[] = [];
  if (ch.translate) parts.push(`translate(${unitLength(at('x', 0))}, ${unitLength(at('y', 0))})`);
  if (ch.rotate) parts.push(`rotate(${num(at('rotate', 0))}deg)`);
  if (ch.rotateY) parts.push(`rotateY(${num(at('rotateY', 0))}deg)`);
  if (ch.skewY) parts.push(`skewY(${num(at('skewY', 0))}deg)`);
  if (ch.scale) parts.push(`scale(${num(at('scaleX', 1))}, ${num(at('scaleY', 1))})`);
  return { transform: parts.length ? parts.join(' ') : 'none', opacity: ch.opacity ? clamp(Math.round(at('opacity', 1) * 1000) / 1000) : 1, origin: def.origin };
}

// ─────────────────────────── Build-in ───────────────────────────

/** Each build-in's from-state (to: none, opacity 1). y is a fraction of the piece's height. */
export const BUILD_TABLE: Readonly<Record<BuildIn, { y?: number; scale?: number; opacity: number }>> = {
  rise: { y: 0.4, opacity: 0 },
  drop: { y: -0.6, opacity: 0 },
  light: { opacity: 0.15 },
  bloom: { scale: 0.6, opacity: 0 },
  fade: { opacity: 0 },
};
export const BUILD_KINDS = Object.keys(BUILD_TABLE) as BuildIn[];
/** Seconds each piece takes to build in (ease-out). */
export const BUILD_DURATION = 0.7;
/** The first piece's delay and the stagger across the set's depth (seconds). */
export const BUILD_START = 0.15;
export const BUILD_SPREAD = 1.2;

/** A piece's build-in delay: front to back over the set's build-in pieces (dMin..dMax). */
export function buildDelay(d: number, dMin: number, dMax: number): number {
  const t = dMax > dMin ? clamp((d - dMin) / (dMax - dMin)) : 0;
  return Math.round((BUILD_START + BUILD_SPREAD * t) * 100) / 100;
}

/** The build wrapper at progress q (0 = the from-state, 1 = built), eased as the CSS (ease-out). */
export function buildAt(kind: BuildIn, q: number): { transform: string; opacity: number } {
  const from = BUILD_TABLE[kind];
  const k = easeOut(clamp(q));
  const parts: string[] = [];
  if (from.y !== undefined) {
    const y = from.y * (1 - k) * 100;
    if (Math.abs(y) >= 0.005) parts.push(`translateY(${num(y)}%)`);
  }
  if (from.scale !== undefined) {
    const sc = from.scale + (1 - from.scale) * k;
    if (sc !== 1) parts.push(`scale(${num(sc)})`);
  }
  return { transform: parts.length ? parts.join(' ') : 'none', opacity: Math.round((from.opacity + (1 - from.opacity) * k) * 1000) / 1000 };
}

/** The from-states and the build animations, compiled once (StageStyles). */
export const buildCss: string = BUILD_KINDS.map((kind) => {
  const from = BUILD_TABLE[kind];
  const transform = [from.y !== undefined ? `translateY(${num(from.y * 100)}%)` : '', from.scale !== undefined ? `scale(${num(from.scale)})` : ''].filter(Boolean).join(' ');
  const decl = `${transform ? `transform: ${transform}; ` : ''}opacity: ${num(from.opacity)};`;
  return [
    `.bulava-unbuilt [data-build="${kind}"] { ${decl} }`,
    `@keyframes bulava-b-${kind} { from { ${decl} } to { transform: none; opacity: 1; } }`,
    `.bulava-build [data-build="${kind}"] { animation: bulava-b-${kind} ${num(BUILD_DURATION)}s ease-out var(--build-delay, 0s) both; }`,
  ].join('\n');
}).join('\n');
