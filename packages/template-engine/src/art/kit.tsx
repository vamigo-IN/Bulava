import { useId, type CSSProperties } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { mix } from '../theme';
import { r2 } from './motifs';

/**
 * Shared pieces for the full-colour illustrations (illustrations-*.tsx): colour
 * shading, metallic foil and ids. Illustrations follow the same rules as the
 * scenes: integer-hash randomness, rounded trigonometry, inline styles only.
 */

/** What every illustration receives from its canvas layer. */
export interface IllustrationProps {
  /** The tint, #rrggbb (an alpha suffix is ignored): the illustration's main colour. */
  color: string;
  colors: ThemeColors;
  /** Foil: stronger metallic highlights on the metal parts. */
  foil?: boolean;
  /** The layer's frame in design units: frames, garlands and strings are drawn to it, never stretched. */
  w: number;
  h: number;
  className?: string;
  style?: CSSProperties;
}

/** #rrggbb from a colour that may carry alpha, or a neutral when it is not a hex colour. */
export const hex = (c: string): string => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#9a8a78');
export const shade = (c: string, amount: number) => mix(hex(c), '#000000', amount);
export const tint = (c: string, amount: number) => mix(hex(c), '#ffffff', amount);
export const blend = (a: string, b: string, amount: number) => mix(hex(a), hex(b), amount);

/** An id usable both in url(#…) and in a CSS attribute selector (stable between server and browser). */
export function useSafeId(): string {
  return `i${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Metallic stops made from one colour: a dark edge, a band of light, the colour,
 * a second softer band. `foil` is the stamped look; without it the sheen is gentle.
 */
export function metalStops(base: string, foil = true): Array<[number, string]> {
  const b = hex(base);
  return foil
    ? [
        [0, shade(b, 0.36)],
        [0.2, tint(b, 0.2)],
        [0.38, tint(b, 0.62)],
        [0.5, b],
        [0.7, shade(b, 0.26)],
        [0.86, tint(b, 0.32)],
        [1, shade(b, 0.18)],
      ]
    : [
        [0, shade(b, 0.14)],
        [0.45, tint(b, 0.16)],
        [1, shade(b, 0.1)],
      ];
}

/** Foil as a CSS background (text is painted with it through background-clip). */
export function foilCss(base: string, angle = 100): string {
  return `linear-gradient(${angle}deg, ${metalStops(base).map(([o, c]) => `${c} ${Math.round(o * 100)}%`).join(', ')})`;
}

/**
 * A metallic gradient across the illustration's own coordinates (user space, so
 * straight lines and dots take it too; a bounding-box gradient skips flat lines).
 */
export function Metal({ id, base, foil, x2, y2 }: { id: string; base: string; foil?: boolean; x2: number; y2: number }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={x2} y2={y2}>
      {metalStops(base, foil).map(([offset, color], i) => (
        <stop key={i} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );
}

/** A soft radial highlight: the colour lit from the upper left. */
export function Lit({ id, base, light = 0.35, dark = 0.18, cx = '38%', cy = '32%' }: { id: string; base: string; light?: number; dark?: number; cx?: string; cy?: string }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r="75%">
      <stop offset="0" stopColor={tint(base, light)} />
      <stop offset="0.55" stopColor={hex(base)} />
      <stop offset="1" stopColor={shade(base, dark)} />
    </radialGradient>
  );
}

export type Pt = readonly [number, number];
/** One cubic Bézier: start, two controls, end. */
export type Segment = readonly [Pt, Pt, Pt, Pt];

/**
 * A filled outline that follows a chain of cubic Béziers and narrows from one
 * width to the next (`widths` has one entry per joint): trunks, tails, necks,
 * stems. Only arithmetic and square roots, so server and browser agree.
 */
export function taper(segments: readonly Segment[], widths: readonly number[], steps = 18): string {
  const left: string[] = [];
  const right: string[] = [];
  segments.forEach(([p0, c1, c2, p3], s) => {
    for (let i = s === 0 ? 0 : 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1];
      const dx = 3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p3[0] - c2[0]);
      const dy = 3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p3[1] - c2[1]);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const half = ((widths[s] ?? 1) + ((widths[s + 1] ?? widths[s] ?? 1) - (widths[s] ?? 1)) * t) / 2;
      left.push(`${r2(x - (dy / len) * half)} ${r2(y + (dx / len) * half)}`);
      right.push(`${r2(x + (dy / len) * half)} ${r2(y - (dx / len) * half)}`);
    }
  });
  return `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
}

/** A point on a cubic Bézier and its unit tangent (arithmetic and a square root, like `taper`). */
export function onCubic([p0, c1, c2, p3]: Segment, t: number) {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1];
  const dx = 3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p3[0] - c2[0]);
  const dy = 3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p3[1] - c2[1]);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len };
}

/**
 * A local frame at a point on a curve, as an SVG transform: y runs back along
 * the curve (toward its start), x across it. A rotation built from the tangent,
 * so no trigonometry is needed.
 */
export const frameAt = ({ x, y, tx, ty }: { x: number; y: number; tx: number; ty: number }) => `matrix(${r2(-ty)} ${r2(tx)} ${r2(-tx)} ${r2(-ty)} ${r2(x)} ${r2(y)})`;

/**
 * A Rajput cusped (multifoil) arch head, as path commands from (x, base) to (x + w, base): three lobes up
 * each side, the cusps between them pointing inward, then an ogee rising to a pointed apex at (x + w/2,
 * base - h). Drawn on a 300 × 100 grid and scaled, so every frame, card and arcade shares one profile.
 * `move` starts the path with M (else it continues one).
 */
export function cuspedHead(x: number, base: number, w: number, h: number, move = true): string {
  const sx = w / 300;
  const sy = h / 100;
  const at = (u: number, v: number) => `${r2(x + u * sx)} ${r2(base - h + v * sy)}`;
  // A lobe from a to b bulging outward (up and away from the opening) by `bulge` grid units.
  const lobe = (a: Pt, b: Pt, bulge: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = (bulge * 4) / 3;
    const nx = (dy / len) * k;
    const ny = (-dx / len) * k;
    return ` C${at(a[0] + dx / 3 + nx, a[1] + dy / 3 + ny)} ${at(a[0] + (2 * dx) / 3 + nx, a[1] + (2 * dy) / 3 + ny)} ${at(b[0], b[1])}`;
  };
  const left: Pt[] = [
    [0, 100],
    [24, 85],
    [52, 69],
    [88, 50],
  ];
  const right: Pt[] = left.map(([u, v]) => [300 - u, v] as const).reverse();
  return [
    move ? `M${at(0, 100)}` : `L${at(0, 100)}`,
    lobe(left[0]!, left[1]!, 5),
    lobe(left[1]!, left[2]!, 6.5),
    lobe(left[2]!, left[3]!, 8),
    ` C${at(89, 30)} ${at(138, 20)} ${at(150, 0)}`,
    ` C${at(162, 20)} ${at(211, 30)} ${at(212, 50)}`,
    lobe(right[0]!, right[1]!, 8),
    lobe(right[1]!, right[2]!, 6.5),
    lobe(right[2]!, right[3]!, 5),
  ].join('');
}

/** Natural colours that stay put whatever the palette (leaves, flames, petals of real flowers). */
export const NATURE = {
  leaf: '#3f7a46',
  leafLight: '#6aa36c',
  leafDark: '#24502c',
  flame: '#ffb02e',
  flameCore: '#fff3c4',
  clay: '#b4643a',
  clayDark: '#7a3a1c',
  skin: '#f2c9a3',
  skinShade: '#e2ad84',
  ivory: '#fffaf0',
  pearl: '#fdf8ee',
} as const;
