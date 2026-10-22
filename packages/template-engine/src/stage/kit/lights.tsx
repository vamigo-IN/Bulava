import type { ReactNode } from 'react';
import { mix } from '../../theme';
import { frameAt, onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { rand, r2 } from '../../art/motifs';
import type { DrawProps } from '../types';
import { aroundEllipse, awayStops, bodyStops, FlameAt, FlameDef, Glow, kitId, KitSvg, Lin, marigoldOf, metalLit, P, Rim, type Stop } from './architecture';
import type { KitEntry } from './place';

/**
 * Lights and lamps (final.md §6.1): shafts of light, strings of lights,
 * chandeliers, lamp stands, hanging lanterns and the sacred fire. Glows live
 * inside each piece's own SVG (radial gradients, no blend, no blur); the set's
 * light sprites are separate light pieces. Flames are layered tongues (outer,
 * inner, core) shaped with taper, so they look alive before the engine's
 * flicker moves them.
 */

export type LightShaftVariant = 'window' | 'spot' | 'beam';
export interface LightShaftOptions {
  variant: LightShaftVariant;
}
export type LightStringVariant = 'fairy' | 'lanterns' | 'bulbs';
export interface LightStringOptions {
  variant: LightStringVariant;
  /** How far the middle hangs below the ends, as a fraction of the box height (default 0.6). */
  sag?: number;
}
export type ChandelierVariant = 'crystal' | 'crystalGrand';
export interface ChandelierOptions {
  variant: ChandelierVariant;
}
export type LampStandVariant = 'brass' | 'candelabra' | 'candle';
export interface LampStandOptions {
  variant: LampStandVariant;
}
export type HangingLanternVariant = 'brass' | 'paper';
export interface HangingLanternOptions {
  variant: HangingLanternVariant;
}

/** Default boxes (units) per piece and variant (SacredFire has no variant: ''). */
export const LIGHTS_BOXES = {
  LightShaft: { window: { w: 300, h: 600 }, spot: { w: 400, h: 800 }, beam: { w: 200, h: 900 } },
  LightString: { fairy: { w: 900, h: 140 }, lanterns: { w: 900, h: 140 }, bulbs: { w: 900, h: 140 } },
  Chandelier: { crystal: { w: 260, h: 170 }, crystalGrand: { w: 380, h: 200 } },
  LampStand: { brass: { w: 90, h: 300 }, candelabra: { w: 60, h: 300 }, candle: { w: 40, h: 260 } },
  HangingLantern: { brass: { w: 60, h: 160 }, paper: { w: 60, h: 160 } },
  SacredFire: { '': { w: 140, h: 150 } },
} as const;

/** A drop of crystal (a pendeloque), its top at (x, y), s long. */
const dropPath = (x: number, y: number, s: number) => P`M${x} ${y}C${x + s * 0.32} ${y + s * 0.42} ${x + s * 0.34} ${y + s * 0.82} ${x} ${y + s}C${x - s * 0.34} ${y + s * 0.82} ${x - s * 0.32} ${y + s * 0.42} ${x} ${y}Z`;
/** A four-point sparkle at (x, y): a cross, stroked with round caps. */
const sparkPath = (x: number, y: number, r: number) => P`M${x} ${y - r}V${y + r}M${x - r} ${y}H${x + r}`;
/** A small flame-shaped candle bulb, its base at (x, y), s tall. */
const bulbPath = (x: number, y: number, s: number) => P`M${x} ${y}C${x - s * 0.34} ${y - s * 0.15} ${x - s * 0.36} ${y - s * 0.45} ${x} ${y - s}C${x + s * 0.36} ${y - s * 0.45} ${x + s * 0.34} ${y - s * 0.15} ${x} ${y}Z`;
/** A circle as a path (many in one d). */
const dot = (x: number, y: number, r: number) => P`M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;

// ─────────────────────────── LightShaft ───────────────────────────

/** A soft parallelogram or cone of light from linear gradients at 12–22% opacity (role 'light'): a three-light window, a spotlight cone with its pool, or a stage beam. */
export function LightShaft(props: DrawProps & LightShaftOptions) {
  const p = props;
  const id = kitId(p, `ls${p.variant}`);
  const { w, h, colors } = p;
  // On a light stock a white shaft disappears: it takes a warm gold from the palette instead.
  const bg = Number.parseInt(colors.background.slice(1, 7), 16);
  const luma = (0.299 * ((bg >> 16) & 255) + 0.587 * ((bg >> 8) & 255) + 0.114 * (bg & 255)) / 255;
  const c = luma > 0.6 ? mix(p.light.color, colors.secondary, 0.5) : p.light.color;
  const full = p.detail === 'full';
  const grad: Stop[] = [
    [0, c, 0.075],
    [0.55, c, 0.045],
    [1, c, 0.008],
  ];
  // Nested quads feather the edges: three layers make the centre ~22%, the rim ~7%.
  const quad = (tl: number, tr: number, br: number, bl: number) => P`M${tl} 0H${tr}L${br} ${h}H${bl}Z`;
  const layers: string[] = [];
  let motes: Array<[number, number]> = [];
  let pool: { cx: number; rx: number } | null = null;
  if (p.variant === 'window') {
    // Three lights of a lancet window falling diagonally: from high left to the floor at the right.
    const bandW = w * 0.1;
    for (let b = 0; b < 3; b++) {
      const t0 = w * 0.04 + b * bandW * 1.25;
      const b0 = w * 0.48 + b * bandW * 1.55;
      for (let l = 0; l < 3; l++) {
        const f = l * 0.18;
        layers.push(quad(t0 + bandW * f, t0 + bandW * (1 - f), b0 + bandW * 1.35 * (1 - f), b0 + bandW * 1.35 * f));
      }
    }
    motes = Array.from({ length: 14 }, (_, i) => {
      const t = rand(i, p.seed);
      return [w * 0.08 + t * w * 0.5 + rand(i, p.seed + 1) * w * 0.3, h * t];
    });
  } else {
    const top = p.variant === 'spot' ? 0.05 : 0.14;
    const bot = p.variant === 'spot' ? 0.5 : 0.42;
    for (let l = 0; l < 3; l++) {
      const f = 1 - l * 0.3;
      layers.push(quad(w / 2 - w * top * f, w / 2 + w * top * f, w / 2 + w * bot * f, w / 2 - w * bot * f));
    }
    if (p.variant === 'beam') layers.push(quad(w * 0.48, w * 0.52, w * 0.56, w * 0.44));
    pool = { cx: w / 2, rx: w * bot * 0.95 };
    motes = Array.from({ length: 12 }, (_, i) => {
      const t = 0.15 + rand(i, p.seed) * 0.8;
      return [w / 2 + (rand(i, p.seed + 2) - 0.5) * 2 * w * (top + (bot - top) * t) * 0.8, h * t];
    });
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={grad} x1={0} y1={0} x2={0} y2={h} />
        <Glow id={`${id}p`} color={c} core={c} a={0.22} />
      </defs>
      <path d={layers.join('')} fill={`url(#${id}g)`} />
      {pool ? <ellipse cx={r2(pool.cx)} cy={r2(h * 0.985)} rx={r2(pool.rx)} ry={r2(h * 0.03)} fill={`url(#${id}p)`} /> : null}
      {p.variant !== 'window' ? <circle cx={r2(w / 2)} cy={r2(h * 0.012)} r={r2(w * 0.06)} fill={`url(#${id}p)`} /> : null}
      {full ? <path d={motes.map(([x, y], i) => dot(x, y, 0.8 + rand(i, 7) * 1.2)).join('')} fill={c} opacity={0.4} /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── LightString ───────────────────────────

/** An ellipse as a path (many in one d). */
const oval = (x: number, y: number, rx: number, ry: number) => P`M${x + rx} ${y}a${rx} ${ry} 0 1 0 ${-2 * rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0Z`;

/** A catenary of fairy lights, paper lanterns or festoon bulbs (≤ 24 bulbs or ≤ 9 lanterns), each with a halo inside the SVG. */
export function LightString(props: DrawProps & LightStringOptions) {
  const p = props;
  const id = kitId(p, `lg${p.variant}${p.sag ?? ''}`);
  const { w, h, colors, nature } = p;
  const s = h / 140;
  const full = p.detail === 'full';
  const y0 = 4 * s;
  const drop = p.variant === 'lanterns' ? 64 * s : p.variant === 'bulbs' ? 30 * s : 10 * s;
  const depth = Math.max(4, Math.min((p.sag ?? 0.6) * h, h - drop - y0 - 2));
  const cy = y0 + depth / 0.75;
  const curve: Segment = [
    [0, y0],
    [w * 0.3, cy],
    [w * 0.7, cy],
    [w, y0],
  ];
  const wire = mix(colors.text, colors.primary, 0.4);
  const wirePath = P`M0 ${y0}C${w * 0.3} ${cy} ${w * 0.7} ${cy} ${w} ${y0}`;
  if (p.variant === 'fairy') {
    const n = 24;
    const pts = Array.from({ length: n }, (_, i) => onCubic(curve, (i + 0.5 + (rand(i, p.seed) - 0.5) * 0.4) / n));
    return (
      <KitSvg p={p}>
        <defs>
          <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.75} />
          <g id={`${id}b`}>
            <rect x={0} y={r2(-1 * s)} width={r2(2.4 * s)} height={r2(2 * s)} fill={wire} />
            <ellipse cx={r2(5 * s)} cy={0} rx={r2(2.8 * s)} ry={r2(1.9 * s)} fill={nature.flameCore} />
          </g>
        </defs>
        <path d={wirePath} fill="none" stroke={wire} strokeWidth={r2(1.2 * s)} />
        {full ? <path d={P`M0 ${y0 + 1.2 * s}C${w * 0.3} ${cy + 3 * s} ${w * 0.7} ${cy - 1 * s} ${w} ${y0 + 1.2 * s}`} fill="none" stroke={wire} strokeWidth={r2(0.7 * s)} opacity={0.6} /> : null}
        {pts.map((pt, i) => (
          <circle key={`h${i}`} cx={r2(pt.x - pt.ty * 5 * s)} cy={r2(pt.y + pt.tx * 5 * s)} r={r2((9 + rand(i, 5) * 4) * s)} fill={`url(#${id}h)`} />
        ))}
        {/* Each bulb hangs across the wire, turned by its tangent (frameAt). */}
        {pts.map((pt, i) => (
          <use key={i} href={`#${id}b`} transform={frameAt(pt)} />
        ))}
      </KitSvg>
    );
  }
  if (p.variant === 'bulbs') {
    const n = 15;
    const hues = [nature.flameCore, mix(colors.accent, nature.flameCore, 0.35), mix(colors.primary, nature.flameCore, 0.5), mix(colors.secondary, nature.flameCore, 0.35)];
    const pts = Array.from({ length: n }, (_, i) => onCubic(curve, (i + 0.5) / n));
    const glass = (x: number, y: number) => P`M${x - 2.6 * s} ${y + 7 * s}C${x - 9 * s} ${y + 12 * s} ${x - 8 * s} ${y + 24 * s} ${x} ${y + 25 * s}C${x + 8 * s} ${y + 24 * s} ${x + 9 * s} ${y + 12 * s} ${x + 2.6 * s} ${y + 7 * s}Z`;
    return (
      <KitSvg p={p}>
        <defs>
          {hues.map((c, i) => (
            <Glow key={i} id={`${id}h${i}`} color={c} core={tint(c, 0.4)} a={0.6} />
          ))}
        </defs>
        <path d={wirePath} fill="none" stroke={wire} strokeWidth={r2(1.6 * s)} />
        {pts.map((pt, i) => (
          <circle key={`h${i}`} cx={r2(pt.x)} cy={r2(pt.y + 16 * s)} r={r2(22 * s)} fill={`url(#${id}h${i % 4})`} />
        ))}
        <path d={pts.map((pt) => P`M${pt.x - 2.2 * s} ${pt.y}h${4.4 * s}v${7.4 * s}h${-4.4 * s}Z`).join('')} fill={shade(wire, 0.2)} />
        {hues.map((c, hi) => (
          <path key={hi} d={pts.filter((_, i) => i % 4 === hi).map((pt) => glass(pt.x, pt.y)).join('')} fill={c} />
        ))}
        {full ? <path d={pts.map((pt) => P`M${pt.x - 2.2 * s} ${pt.y + 15 * s}q${2.2 * s} ${-3.4 * s} ${4.4 * s} 0`).join('')} fill="none" stroke={nature.flame} strokeWidth={r2(0.8 * s)} /> : null}
        <path d={pts.map((pt) => oval(pt.x - 3 * s, pt.y + 12.5 * s, 1.2 * s, 2 * s)).join('')} fill={nature.pearl} opacity={0.75} />
      </KitSvg>
    );
  }
  const n = 9;
  const papers = [colors.secondary, colors.accent, mix(colors.primary, nature.flame, 0.45)];
  const pts = Array.from({ length: n }, (_, i) => onCubic(curve, (i + 0.5) / n));
  const rx = 17 * s;
  const ry = 21 * s;
  const mid = (pt: { y: number }) => pt.y + 10 * s + ry;
  const ribs = shade(mix(colors.secondary, colors.text, 0.3), 0.1);
  return (
    <KitSvg p={p}>
      <defs>
        {papers.map((c, i) => (
          <radialGradient key={i} id={`${id}p${i}`} cx="45%" cy="45%" r="60%">
            <stop offset="0" stopColor={nature.flameCore} />
            <stop offset="0.5" stopColor={tint(c, 0.35)} />
            <stop offset="1" stopColor={shade(c, 0.25)} />
          </radialGradient>
        ))}
        <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.45} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from, false)} x1={0} y1={0} x2={w} y2={0} />
      </defs>
      <path d={wirePath} fill="none" stroke={wire} strokeWidth={r2(1.4 * s)} />
      {pts.map((pt, i) => (
        <circle key={`h${i}`} cx={r2(pt.x)} cy={r2(mid(pt))} r={r2(40 * s)} fill={`url(#${id}h)`} />
      ))}
      <path d={pts.map((pt) => P`M${pt.x} ${pt.y}V${pt.y + 10 * s}`).join('')} stroke={wire} strokeWidth={r2(0.8 * s)} />
      {/* The lanterns, lit from inside (each its paper's radial gradient). */}
      {pts.map((pt, i) => (
        <ellipse key={`l${i}`} cx={r2(pt.x)} cy={r2(mid(pt))} rx={r2(rx)} ry={r2(ry)} fill={`url(#${id}p${i % 3})`} />
      ))}
      <path d={pts.map((pt) => `${oval(pt.x, mid(pt), rx * 0.45, ry)}${P`M${pt.x} ${mid(pt) - ry}V${mid(pt) + ry}`}`).join('')} fill="none" stroke={ribs} strokeWidth={r2(0.7 * s)} opacity={0.55} />
      {full ? <path d={pts.map((pt) => oval(pt.x, mid(pt), rx * 0.78, ry)).join('')} fill="none" stroke={ribs} strokeWidth={r2(0.6 * s)} opacity={0.4} /> : null}
      <path d={pts.map((pt) => P`M${pt.x - 7 * s} ${pt.y + 8 * s}h${14 * s}v${5 * s}h${-14 * s}ZM${pt.x - 6 * s} ${mid(pt) + ry - 3 * s}h${12 * s}v${5 * s}h${-12 * s}Z`).join('')} fill={`url(#${id}m)`} />
      <path d={pts.map((pt) => taper([[[pt.x, mid(pt) + ry + 2 * s], [pt.x - 1 * s, mid(pt) + ry + 7 * s], [pt.x + 1 * s, mid(pt) + ry + 12 * s], [pt.x, mid(pt) + ry + 18 * s]]], [1.4 * s, 3.4 * s], 4)).join('')} fill={colors.primary} />
    </KitSvg>
  );
}

// ─────────────────────────── Chandelier ───────────────────────────

/** Brass arms on a ring with candle bulbs, crystal drops, bead swags and bead chains around a ringed baluster stem, hung by a chain from its top edge. The grand one carries a second tier. */
export function Chandelier(props: DrawProps & ChandelierOptions) {
  const p = props;
  const grand = p.variant === 'crystalGrand';
  const id = kitId(p, `ch${p.variant}`);
  const { w, h, colors, nature } = p;
  const k = h / (grand ? 200 : 170);
  const full = p.detail === 'full';
  const cx = w / 2;
  const metal = `url(#${id}m)`;
  const line = shade(colors.secondary, 0.5);
  const crystal = mix(nature.pearl, colors.accent, 0.22);
  const chainEnd = h * 0.17;
  const stemBot = h * 0.78;
  const tiers = grand
    ? [
        { y: h * 0.58, rx: w * 0.44, n: 8, arm: 1 },
        { y: h * 0.36, rx: w * 0.25, n: 5, arm: 0.75 },
      ]
    : [{ y: h * 0.56, rx: w * 0.42, n: 6, arm: 1 }];
  type Cup = { x: number; y: number; front: boolean; tier: number; a: number };
  const cups: Cup[] = tiers.flatMap((t, ti) =>
    Array.from({ length: t.n }, (_, i) => {
      const pt = aroundEllipse(cx, t.y, t.rx, t.rx * 0.14, (i + 0.5) / t.n);
      return { x: pt.x, y: pt.y, front: pt.y >= t.y, tier: ti, a: t.arm };
    }),
  );
  const armPath = (c: Cup) => {
    const t = tiers[c.tier]!;
    return P`M${cx} ${t.y + 6 * k}C${cx + (c.x - cx) * 0.35} ${t.y + 30 * k * c.a} ${c.x} ${c.y + 30 * k * c.a} ${c.x} ${c.y + 4 * k}`;
  };
  // One layer of cups (back or front), every part merged into one path per colour.
  const layer = (list: Cup[], front: boolean) =>
    list.length ? (
      <g opacity={front ? 1 : 0.72}>
        <path d={list.map(armPath).join('')} fill="none" stroke={metal} strokeWidth={r2(2.8 * k)} strokeLinecap="round" />
        {full ? <path d={list.map((c) => P`M${c.x - 3 * k} ${c.y + 16 * k * c.a}c${-6 * k} ${-1 * k} ${-6 * k} ${-8 * k} ${-1 * k} ${-8 * k}`).join('')} fill="none" stroke={metal} strokeWidth={r2(1.4 * k)} /> : null}
        <path d={list.map((c) => dropPath(c.x, c.y + 5 * k, 13 * k * c.a)).join('')} fill={crystal} stroke={colors.accent} strokeWidth={r2(0.5 * k)} />
        <path d={list.map((c) => oval(c.x, c.y + 4 * k, 6.5 * k * c.a, 2 * k)).join('')} fill={metal} stroke={line} strokeWidth={r2(0.4 * k)} />
        <path d={list.map((c) => P`M${c.x - 2.2 * k * c.a} ${c.y - 10 * k * c.a}h${4.4 * k * c.a}v${13 * k * c.a}h${-4.4 * k * c.a}Z`).join('')} fill={nature.ivory} />
        <path d={list.map((c) => bulbPath(c.x, c.y - 10 * k * c.a, 11 * k * c.a)).join('')} fill={nature.flameCore} />
      </g>
    ) : null;
  const back = cups.filter((c) => !c.front);
  const front = cups.filter((c) => c.front);
  const ring = tiers[0]!;
  const lower = front.filter((c) => c.tier === 0).sort((a, b) => a.x - b.x);
  const swagSegs: Segment[] = lower.slice(0, -1).map((c, i) => {
    const d = lower[i + 1]!;
    return [
      [c.x, c.y + 6 * k],
      [c.x + (d.x - c.x) * 0.3, c.y + 24 * k],
      [d.x - (d.x - c.x) * 0.3, d.y + 24 * k],
      [d.x, d.y + 6 * k],
    ];
  });
  const swags = swagSegs.map(([a, b, c, d]) => P`M${a[0]} ${a[1]}C${b[0]} ${b[1]} ${c[0]} ${c[1]} ${d[0]} ${d[1]}`).join('');
  const chains = lower
    .filter((c) => Math.abs(c.x - cx) > ring.rx * 0.5)
    .map((c) => P`M${cx} ${chainEnd + 8 * k}Q${cx + (c.x - cx) * 0.5} ${(chainEnd + c.y) / 2 + 12 * k} ${c.x} ${c.y - 2 * k}`)
    .join('');
  const swagDrops = swagSegs.map((sg) => {
    const m = onCubic(sg, 0.5);
    return dropPath(m.x, m.y + 1 * k, 9 * k);
  });
  const sparks = full
    ? Array.from({ length: grand ? 7 : 5 }, (_, i) => {
        const c = cups[Math.floor(rand(i, p.seed) * cups.length)]!;
        return sparkPath(c.x + (rand(i, p.seed + 2) - 0.5) * 14 * k, c.y + 10 * k + rand(i, p.seed + 4) * 10 * k, (2.4 + rand(i, 9) * 2) * k);
      }).join('')
    : '';
  const stem = P`M${cx - 3 * k} ${chainEnd + 8 * k}C${cx - 3 * k} ${h * 0.3} ${cx - 9 * k} ${h * 0.36} ${cx - 9 * k} ${h * 0.44}C${cx - 9 * k} ${h * 0.5} ${cx - 5 * k} ${h * 0.52} ${cx - 5 * k} ${h * 0.56}C${cx - 14 * k} ${h * 0.6} ${cx - 14 * k} ${h * 0.68} ${cx - 4 * k} ${stemBot}H${cx + 4 * k}C${cx + 14 * k} ${h * 0.68} ${cx + 14 * k} ${h * 0.6} ${cx + 5 * k} ${h * 0.56}C${cx + 5 * k} ${h * 0.52} ${cx + 9 * k} ${h * 0.5} ${cx + 9 * k} ${h * 0.44}C${cx + 9 * k} ${h * 0.36} ${cx + 3 * k} ${h * 0.3} ${cx + 3 * k} ${chainEnd + 8 * k}Z`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={cx - ring.rx} y1={0} x2={cx + ring.rx} y2={h * 0.3} />
        <radialGradient id={`${id}c`} cx="38%" cy="30%" r="70%">
          <stop offset="0" stopColor={nature.pearl} />
          <stop offset="0.6" stopColor={crystal} />
          <stop offset="1" stopColor={mix(colors.accent, colors.primary, 0.25)} />
        </radialGradient>
        <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.4} />
        <Glow id={`${id}b`} color={nature.flame} core={nature.flameCore} a={0.7} />
      </defs>
      <ellipse cx={r2(cx)} cy={r2(ring.y - 6 * k)} rx={r2(w * 0.5)} ry={r2(h * 0.4)} fill={`url(#${id}h)`} />
      {/* The chain and the crown of leaves. */}
      <path d={Array.from({ length: Math.max(2, Math.round(chainEnd / (5 * k))) }, (_, i) => P`M${cx} ${i * 5 * k}v${4 * k}`).join('')} stroke={metal} strokeWidth={r2(2 * k)} strokeLinecap="round" />
      <path d={P`M${cx - 14 * k} ${chainEnd + 6 * k}C${cx - 10 * k} ${chainEnd} ${cx + 10 * k} ${chainEnd} ${cx + 14 * k} ${chainEnd + 6 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      {full ? <path d={[-12, -6, 0, 6, 12].map((dx) => P`M${cx + dx * k - 1.6 * k} ${chainEnd + 2 * k}L${cx + dx * k} ${chainEnd - 5 * k}L${cx + dx * k + 1.6 * k} ${chainEnd + 2 * k}Z`).join('')} fill={metal} /> : null}
      {layer(back, false)}
      {full ? <path d={chains} fill="none" stroke={crystal} strokeWidth={r2(2 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(3.6 * k)}`} opacity={0.85} /> : null}
      {/* The stem: a baluster with rings, a crystal ball and a collar of beads. */}
      <path d={stem} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      <path d={[h * 0.3, h * 0.52, h * 0.7].map((y) => oval(cx, y, 8 * k, 2.2 * k)).join('')} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      <circle cx={r2(cx)} cy={r2(h * 0.44)} r={r2(7.5 * k)} fill={`url(#${id}c)`} stroke={colors.accent} strokeWidth={r2(0.5 * k)} />
      {tiers.map((t) => (
        <ellipse key={t.y} cx={r2(cx)} cy={r2(t.y + 7 * k)} rx={r2(12 * k)} ry={r2(3.6 * k)} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      ))}
      {full ? <path d={tiers.map((t) => P`M${cx - 13 * k} ${t.y + 9 * k}A${13 * k} ${4.4 * k} 0 0 0 ${cx + 13 * k} ${t.y + 9 * k}`).join('')} fill="none" stroke={crystal} strokeWidth={r2(2.4 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(3.4 * k)}`} /> : null}
      {layer(front, true)}
      {front.map((c, i) => (
        <circle key={i} cx={r2(c.x)} cy={r2(c.y - 15 * k * c.a)} r={r2(11 * k * c.a)} fill={`url(#${id}b)`} />
      ))}
      {full ? <path d={swags} fill="none" stroke={crystal} strokeWidth={r2(2.8 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(4.2 * k)}`} /> : null}
      {/* The finial: a crystal ball, a tassel of drops and drops under each swag. */}
      <circle cx={r2(cx)} cy={r2(stemBot + 5 * k)} r={r2(5.5 * k)} fill={`url(#${id}c)`} stroke={colors.accent} strokeWidth={r2(0.5 * k)} />
      <path d={[dropPath(cx, stemBot + 9 * k, h - stemBot - 10 * k), dropPath(cx - 6 * k, stemBot + 7 * k, (h - stemBot) * 0.62), dropPath(cx + 6 * k, stemBot + 7 * k, (h - stemBot) * 0.62), ...(full ? swagDrops : [])].join('')} fill={crystal} stroke={colors.accent} strokeWidth={r2(0.5 * k)} />
      {full ? <path d={sparks} fill="none" stroke={nature.pearl} strokeWidth={r2(0.9 * k)} strokeLinecap="round" /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── LampStand ───────────────────────────

/** A brass deep-stand with five wicks and bells, a three-branch candelabra with crystal drops, or a single tall church candle on a pricket stand. */
export function LampStand(props: DrawProps & LampStandOptions) {
  const p = props;
  const id = kitId(p, `lt${p.variant}`);
  const { w, h, colors, nature } = p;
  const full = p.detail === 'full';
  const cx = w / 2;
  const metal = `url(#${id}m)`;
  const line = shade(colors.secondary, 0.5);
  const flame = `${id}f`;
  const defs = (extra?: ReactNode) => (
    <defs>
      <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={0} y1={0} x2={w} y2={w * 0.2} />
      <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.6} />
      <FlameDef id={flame} p={p} seed={p.seed} />
      {extra}
    </defs>
  );
  if (p.variant === 'candle') {
    const k = w / 40;
    const candleTop = 40 * k;
    const standTop = h * 0.56;
    const wax = nature.ivory;
    return (
      <KitSvg p={p}>
        {defs(<Lin id={`${id}w`} stops={bodyStops(wax, p.light.from)} x1={cx - 8 * k} x2={cx + 8 * k} />)}
        <circle cx={r2(cx)} cy={r2(candleTop - 16 * k)} r={r2(26 * k)} fill={`url(#${id}h)`} />
        <path d={P`M${cx} ${candleTop - 2 * k}V${candleTop - 6 * k}`} stroke={p.colors.text} strokeWidth={r2(0.8 * k)} />
        <FlameAt href={flame} x={cx} y={candleTop - 4 * k} s={30 * k} />
        <rect x={r2(cx - 8 * k)} y={r2(candleTop)} width={r2(16 * k)} height={r2(standTop - candleTop)} fill={`url(#${id}w)`} />
        <path d={P`M${cx - 8 * k} ${candleTop}H${cx + 8 * k}V${candleTop + 6 * k}C${cx + 6 * k} ${candleTop + 6 * k} ${cx + 6 * k} ${candleTop + 16 * k} ${cx + 4.5 * k} ${candleTop + 16 * k}C${cx + 3 * k} ${candleTop + 16 * k} ${cx + 3 * k} ${candleTop + 5 * k} ${cx + 1 * k} ${candleTop + 5 * k}C${cx - 1 * k} ${candleTop + 5 * k} ${cx - 2 * k} ${candleTop + 10 * k} ${cx - 4 * k} ${candleTop + 10 * k}C${cx - 6 * k} ${candleTop + 10 * k} ${cx - 6 * k} ${candleTop + 5 * k} ${cx - 8 * k} ${candleTop + 5 * k}Z`} fill={tint(wax, 0.4)} />
        <ellipse cx={r2(cx)} cy={r2(candleTop)} rx={r2(8 * k)} ry={r2(1.8 * k)} fill={mix(wax, nature.flame, 0.25)} />
        {[0.42, 0.78].map((f) => (
          <rect key={f} x={r2(cx - 8 * k)} y={r2(candleTop + (standTop - candleTop) * f)} width={r2(16 * k)} height={r2(2.4 * k)} fill={metal} />
        ))}
        <Rim p={p} x0={cx - 8 * k} x1={cx + 8 * k} y0={candleTop} y1={standTop} k={k} />
        {/* The pricket stand: drip pan, knopped stem and a round foot. */}
        <path d={P`M${cx - 17 * k} ${standTop}H${cx + 17 * k}C${cx + 14 * k} ${standTop + 6 * k} ${cx + 6 * k} ${standTop + 8 * k} ${cx} ${standTop + 8 * k}C${cx - 6 * k} ${standTop + 8 * k} ${cx - 14 * k} ${standTop + 6 * k} ${cx - 17 * k} ${standTop}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
        <rect x={r2(cx - 2.6 * k)} y={r2(standTop + 8 * k)} width={r2(5.2 * k)} height={r2(h - standTop - 36 * k)} fill={metal} />
        {[standTop + 20 * k, (standTop + h - 28 * k) / 2].map((y) => (
          <ellipse key={y} cx={r2(cx)} cy={r2(y)} rx={r2(5.5 * k)} ry={r2(6 * k)} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
        ))}
        <path d={P`M${cx - 3 * k} ${h - 28 * k}C${cx - 5 * k} ${h - 14 * k} ${cx - 16 * k} ${h - 12 * k} ${cx - 18 * k} ${h - 4 * k}H${cx + 18 * k}C${cx + 16 * k} ${h - 12 * k} ${cx + 5 * k} ${h - 14 * k} ${cx + 3 * k} ${h - 28 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
        <rect x={r2(cx - 19 * k)} y={r2(h - 4 * k)} width={r2(38 * k)} height={r2(4 * k)} rx={r2(1.4 * k)} fill={metal} />
      </KitSvg>
    );
  }
  if (p.variant === 'candelabra') {
    const k = w / 60;
    const armY = h * 0.5;
    const sideCup = h * 0.37;
    const midCup = h * 0.28;
    const candle = (x: number, cup: number, len: number) => (
      <g key={x}>
        <circle cx={r2(x)} cy={r2(cup - len - 12 * k)} r={r2(16 * k)} fill={`url(#${id}h)`} />
        <FlameAt href={flame} x={x} y={cup - len - 1 * k} s={20 * k} skew={(rand(Math.round(x), p.seed) - 0.5) * 10} />
        <rect x={r2(x - 3 * k)} y={r2(cup - len)} width={r2(6 * k)} height={r2(len)} fill={`url(#${id}w)`} />
        <path d={P`M${x - 3 * k} ${cup - len}h${6 * k}v${3 * k}q${-1 * k} ${3 * k} ${-2 * k} 0q${-1 * k} ${4 * k} ${-2 * k} 0q${-1 * k} ${2 * k} ${-2 * k} 0Z`} fill={tint(nature.ivory, 0.5)} />
        <path d={P`M${x - 7 * k} ${cup}H${x + 7 * k}L${x + 3 * k} ${cup + 5 * k}H${x - 3 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.4 * k)} />
      </g>
    );
    const arm = (s: number) => P`M${cx} ${armY}C${cx + s * 6 * k} ${armY + 14 * k} ${cx + s * 26 * k} ${armY + 10 * k} ${cx + s * 26 * k} ${armY - 6 * k}C${cx + s * 26 * k} ${armY - 16 * k} ${cx + s * 22 * k} ${sideCup + 14 * k} ${cx + s * 22 * k} ${sideCup + 5 * k}`;
    return (
      <KitSvg p={p}>
        {defs(<Lin id={`${id}w`} stops={bodyStops(nature.ivory, p.light.from)} x1={0} x2={1} bbox />)}
        <path d={[arm(-1), arm(1)].join('')} fill="none" stroke={metal} strokeWidth={r2(3 * k)} strokeLinecap="round" />
        {full ? <path d={[-1, 1].map((s) => P`M${cx + s * 12 * k} ${armY + 7 * k}c${s * 4 * k} ${-6 * k} ${s * -2 * k} ${-10 * k} ${s * -4 * k} ${-5 * k}`).join('')} fill="none" stroke={metal} strokeWidth={r2(1.6 * k)} /> : null}
        {candle(cx - 22 * k, sideCup, 40 * k)}
        {candle(cx + 22 * k, sideCup, 40 * k)}
        {candle(cx, midCup, 46 * k)}
        {full ? <path d={[dropPath(cx - 22 * k, sideCup + 5 * k, 12 * k), dropPath(cx + 22 * k, sideCup + 5 * k, 12 * k), dropPath(cx - 26 * k, armY - 4 * k, 9 * k), dropPath(cx + 26 * k, armY - 4 * k, 9 * k)].join('')} fill={mix(nature.pearl, colors.accent, 0.2)} stroke={colors.accent} strokeWidth={r2(0.4 * k)} /> : null}
        {/* The baluster stem and the domed foot. */}
        <path d={P`M${cx - 2.6 * k} ${midCup + 5 * k}V${armY}C${cx - 8 * k} ${armY + 8 * k} ${cx - 3 * k} ${armY + 14 * k} ${cx - 3 * k} ${armY + 22 * k}V${h - 60 * k}C${cx - 11 * k} ${h - 52 * k} ${cx - 10 * k} ${h - 40 * k} ${cx - 4 * k} ${h - 34 * k}C${cx - 6 * k} ${h - 26 * k} ${cx - 22 * k} ${h - 16 * k} ${cx - 24 * k} ${h - 6 * k}H${cx + 24 * k}C${cx + 22 * k} ${h - 16 * k} ${cx + 6 * k} ${h - 26 * k} ${cx + 4 * k} ${h - 34 * k}C${cx + 10 * k} ${h - 40 * k} ${cx + 11 * k} ${h - 52 * k} ${cx + 3 * k} ${h - 60 * k}V${armY + 22 * k}C${cx + 3 * k} ${armY + 14 * k} ${cx + 8 * k} ${armY + 8 * k} ${cx + 2.6 * k} ${armY}V${midCup + 5 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
        <rect x={r2(cx - 26 * k)} y={r2(h - 6 * k)} width={r2(52 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
        {full ? <path d={P`M${cx - 16 * k} ${h - 14 * k}Q${cx} ${h - 10 * k} ${cx + 16 * k} ${h - 14 * k}`} fill="none" stroke={line} strokeWidth={r2(0.6 * k)} /> : null}
        <Rim p={p} x0={cx - 3 * k} x1={cx + 3 * k} y0={armY + 22 * k} y1={h - 60 * k} k={k} />
      </KitSvg>
    );
  }
  const k = w / 90;
  const dishY = 64 * k;
  const footTop = h - 62 * k;
  const wicks: Array<[number, number, number, number]> = [
    [cx - 41 * k, dishY - 1 * k, 21 * k, -12],
    [cx - 22 * k, dishY + 2 * k, 25 * k, -5],
    [cx, dishY + 4 * k, 29 * k, 0],
    [cx + 22 * k, dishY + 2 * k, 25 * k, 5],
    [cx + 41 * k, dishY - 1 * k, 21 * k, 12],
  ];
  const ring = (y: number, rx: number, ry = 3 * k) => <ellipse key={y} cx={r2(cx)} cy={r2(y)} rx={r2(rx)} ry={r2(ry)} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />;
  const bell = (x: number, y: number) => P`M${x} ${y}V${y + 10 * k}M${x - 4 * k} ${y + 18 * k}C${x - 4 * k} ${y + 11 * k} ${x + 4 * k} ${y + 11 * k} ${x + 4 * k} ${y + 18 * k}Z`;
  return (
    <KitSvg p={p}>
      {defs()}
      {wicks.map(([x, y, s]) => (
        <circle key={`h${x}`} cx={r2(x)} cy={r2(y - s * 0.45)} r={r2(s * 0.85)} fill={`url(#${id}h)`} />
      ))}
      {/* Finial: an annam (swan) on a lotus bud, then the neck. */}
      <path d={P`M${cx} ${4 * k}C${cx + 6 * k} ${10 * k} ${cx + 7 * k} ${18 * k} ${cx} ${26 * k}C${cx - 7 * k} ${18 * k} ${cx - 6 * k} ${10 * k} ${cx} ${4 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      <path d={P`M${cx - 1 * k} ${6 * k}C${cx - 4 * k} ${2 * k} ${cx - 1 * k} ${-2 * k} ${cx + 3 * k} ${1 * k}L${cx + 7 * k} ${1 * k}L${cx + 3.4 * k} ${3 * k}C${cx + 3 * k} ${6 * k} ${cx + 2 * k} ${8 * k} ${cx + 1 * k} ${9 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.4 * k)} />
      <rect x={r2(cx - 2.6 * k)} y={r2(26 * k)} width={r2(5.2 * k)} height={r2(dishY - 26 * k)} fill={metal} />
      {ring(36 * k, 5 * k, 2 * k)}
      {ring(48 * k, 6.5 * k, 2.4 * k)}
      {/* The five-wicked dish. */}
      <path d={P`M${4 * k} ${dishY}C${7 * k} ${dishY + 12 * k} ${25 * k} ${dishY + 18 * k} ${cx} ${dishY + 18 * k}C${w - 25 * k} ${dishY + 18 * k} ${w - 7 * k} ${dishY + 12 * k} ${w - 4 * k} ${dishY}Z`} fill={metal} stroke={line} strokeWidth={r2(0.6 * k)} />
      <ellipse cx={r2(cx)} cy={r2(dishY)} rx={r2(w / 2 - 4 * k)} ry={r2(5.5 * k)} fill={shade(colors.secondary, 0.3)} stroke={line} strokeWidth={r2(0.6 * k)} />
      <ellipse cx={r2(cx)} cy={r2(dishY + 0.6 * k)} rx={r2(w / 2 - 9 * k)} ry={r2(3.6 * k)} fill={mix(shade(colors.secondary, 0.55), nature.flame, 0.15)} />
      <path d={P`M${2 * k} ${dishY - 3 * k}L${9 * k} ${dishY + 1 * k}L${5 * k} ${dishY + 3 * k}ZM${w - 2 * k} ${dishY - 3 * k}L${w - 9 * k} ${dishY + 1 * k}L${w - 5 * k} ${dishY + 3 * k}Z`} fill={metal} />
      {full ? <path d={P`M${12 * k} ${dishY + 9 * k}C${30 * k} ${dishY + 15 * k} ${w - 30 * k} ${dishY + 15 * k} ${w - 12 * k} ${dishY + 9 * k}`} fill="none" stroke={tint(colors.secondary, 0.55)} strokeWidth={r2(1 * k)} opacity={0.8} /> : null}
      {wicks.map(([x, y, s, sk]) => (
        <FlameAt key={x} href={flame} x={x} y={y} s={s} skew={sk + (rand(Math.round(x), p.seed) - 0.5) * 6} />
      ))}
      {/* Bells on chains below the dish. */}
      {full ? <path d={[bell(cx - 26 * k, dishY + 14 * k), bell(cx + 26 * k, dishY + 14 * k)].join('')} fill={metal} stroke={metal} strokeWidth={r2(0.8 * k)} /> : null}
      {/* The ringed column and the stepped foot. */}
      {ring(dishY + 22 * k, 9 * k, 4 * k)}
      <rect x={r2(cx - 4.5 * k)} y={r2(dishY + 24 * k)} width={r2(9 * k)} height={r2(footTop - dishY - 24 * k)} fill={metal} />
      {[0.25, 0.5, 0.75].map((f) => ring(dishY + 24 * k + (footTop - dishY - 24 * k) * f, f === 0.5 ? 9 * k : 7.5 * k, f === 0.5 ? 6 * k : 3 * k))}
      <Rim p={p} x0={cx - 4.5 * k} x1={cx + 4.5 * k} y0={dishY + 24 * k} y1={footTop} k={k} />
      {ring(footTop, 10 * k, 4 * k)}
      <path d={P`M${cx - 6 * k} ${footTop}C${cx - 7 * k} ${footTop + 20 * k} ${cx - 30 * k} ${footTop + 30 * k} ${cx - 36 * k} ${h - 14 * k}H${cx + 36 * k}C${cx + 30 * k} ${footTop + 30 * k} ${cx + 7 * k} ${footTop + 20 * k} ${cx + 6 * k} ${footTop}Z`} fill={metal} stroke={line} strokeWidth={r2(0.6 * k)} />
      {full ? <path d={P`M${cx - 20 * k} ${h - 26 * k}Q${cx} ${h - 21 * k} ${cx + 20 * k} ${h - 26 * k}`} fill="none" stroke={line} strokeWidth={r2(0.6 * k)} /> : null}
      <rect x={r2(cx - 42 * k)} y={r2(h - 14 * k)} width={r2(84 * k)} height={r2(7 * k)} rx={r2(2.5 * k)} fill={metal} stroke={line} strokeWidth={r2(0.6 * k)} />
      <rect x={r2(cx - 38 * k)} y={r2(h - 7 * k)} width={r2(76 * k)} height={r2(7 * k)} rx={r2(2 * k)} fill={metal} stroke={line} strokeWidth={r2(0.6 * k)} />
    </KitSvg>
  );
}

// ─────────────────────────── HangingLantern ───────────────────────────

/** A chain and a pierced brass lantern whose glow shows through its piercings, or a ribbed paper lantern with a zigzag band and a fringe (the light piece is separate). */
export function HangingLantern(props: DrawProps & HangingLanternOptions) {
  const p = props;
  const id = kitId(p, `hl${p.variant}`);
  const { w, h, colors, nature } = p;
  const k = w / 60;
  const full = p.detail === 'full';
  const cx = w / 2;
  const metal = `url(#${id}m)`;
  const line = shade(colors.secondary, 0.5);
  const glowStops = (
    <radialGradient id={`${id}g`} cx="50%" cy="55%" r="60%">
      <stop offset="0" stopColor={nature.flameCore} />
      <stop offset="0.5" stopColor={nature.flame} />
      <stop offset="1" stopColor={shade(nature.flame, 0.35)} />
    </radialGradient>
  );
  if (p.variant === 'paper') {
    const paper = mix(colors.accent, nature.flame, 0.25);
    const top = 48 * k;
    const bot = h - 34 * k;
    const mid = (top + bot) / 2;
    const ry = (bot - top) / 2;
    return (
      <KitSvg p={p}>
        <defs>
          <radialGradient id={`${id}g`} cx="48%" cy="50%" r="58%">
            <stop offset="0" stopColor={nature.flameCore} />
            <stop offset="0.55" stopColor={tint(paper, 0.3)} />
            <stop offset="1" stopColor={shade(paper, 0.3)} />
          </radialGradient>
          <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.4} />
          <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={cx - 12 * k} y1={0} x2={cx + 12 * k} y2={4 * k} />
          <Lin id={`${id}a`} stops={awayStops(p.light.from, 0.2)} x1={cx - 27 * k} x2={cx + 27 * k} />
        </defs>
        <ellipse cx={r2(cx)} cy={r2(mid)} rx={r2(w * 0.5)} ry={r2(ry * 1.4)} fill={`url(#${id}h)`} />
        <path d={P`M${cx} 0V${top - 4 * k}`} stroke={mix(colors.text, colors.primary, 0.4)} strokeWidth={r2(1 * k)} />
        <ellipse cx={r2(cx)} cy={r2(mid)} rx={r2(27 * k)} ry={r2(ry)} fill={`url(#${id}g)`} />
        <path d={[0.35, 0.7].map((f) => P`M${cx} ${top}C${cx - 27 * k * f * 1.33} ${top} ${cx - 27 * k * f * 1.33} ${bot} ${cx} ${bot}C${cx + 27 * k * f * 1.33} ${bot} ${cx + 27 * k * f * 1.33} ${top} ${cx} ${top}`).join('')} fill="none" stroke={shade(paper, 0.35)} strokeWidth={r2(0.7 * k)} opacity={0.75} />
        <path d={Array.from({ length: 9 }, (_, i) => `${i ? 'L' : 'M'}${r2(cx - 24 * k + i * 6 * k)} ${r2(mid + (i % 2 ? -5 * k : 5 * k))}`).join('')} fill="none" stroke={colors.primary} strokeWidth={r2(2.4 * k)} strokeLinejoin="round" />
        {full ? <path d={P`M${cx - 26 * k} ${mid - 9 * k}H${cx + 26 * k}M${cx - 26 * k} ${mid + 9 * k}H${cx + 26 * k}`} stroke={colors.secondary} strokeWidth={r2(1.2 * k)} /> : null}
        <ellipse cx={r2(cx)} cy={r2(mid)} rx={r2(27 * k)} ry={r2(ry)} fill={`url(#${id}a)`} />
        <rect x={r2(cx - 10 * k)} y={r2(top - 4 * k)} width={r2(20 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={metal} />
        <rect x={r2(cx - 10 * k)} y={r2(bot - 2 * k)} width={r2(20 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={metal} />
        <path d={Array.from({ length: 7 }, (_, i) => P`M${cx - 9 * k + i * 3 * k} ${bot + 4 * k}v${(18 + (i % 2) * 4) * k}`).join('')} stroke={colors.primary} strokeWidth={r2(1.2 * k)} />
      </KitSvg>
    );
  }
  const top = 70 * k;
  const bot = 124 * k;
  const body = P`M${cx - 20 * k} ${top}C${cx - 30 * k} ${top + 16 * k} ${cx - 30 * k} ${top + 38 * k} ${cx - 18 * k} ${bot}H${cx + 18 * k}C${cx + 30 * k} ${top + 38 * k} ${cx + 30 * k} ${top + 16 * k} ${cx + 20 * k} ${top}Z`;
  const s = 7 * k;
  const hole = P`M0 0H${s}V${s}H0ZM${s / 2} ${s * 0.18}C${s * 0.6} ${s * 0.38} ${s * 0.62} ${s * 0.4} ${s * 0.82} ${s / 2}C${s * 0.62} ${s * 0.6} ${s * 0.6} ${s * 0.62} ${s / 2} ${s * 0.82}C${s * 0.4} ${s * 0.62} ${s * 0.38} ${s * 0.6} ${s * 0.18} ${s / 2}C${s * 0.38} ${s * 0.4} ${s * 0.4} ${s * 0.38} ${s / 2} ${s * 0.18}Z`;
  return (
    <KitSvg p={p}>
      <defs>
        {glowStops}
        <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.38} />
        <Lin id={`${id}m`} stops={metalLit(colors.secondary, p.light.from)} x1={cx - 30 * k} y1={0} x2={cx + 30 * k} y2={20 * k} />
        <Lin id={`${id}a`} stops={awayStops(p.light.from, 0.25)} x1={cx - 28 * k} x2={cx + 28 * k} />
        <pattern id={`${id}p`} patternUnits="userSpaceOnUse" x={r2(cx - s / 2)} y={r2(top)} width={r2(s)} height={r2(s)}>
          <path d={hole} fill={mix(colors.secondary, shade(colors.secondary, 0.3), 0.4)} fillRule="evenodd" />
        </pattern>
      </defs>
      <ellipse cx={r2(cx)} cy={r2((top + bot) / 2)} rx={r2(w * 0.55)} ry={r2(44 * k)} fill={`url(#${id}h)`} />
      <path d={Array.from({ length: Math.max(2, Math.round((top - 26 * k) / (6 * k))) }, (_, i) => P`M${cx} ${i * 6 * k}v${4.6 * k}`).join('')} stroke={metal} strokeWidth={r2(2 * k)} strokeLinecap="round" />
      <circle cx={r2(cx)} cy={r2(top - 26 * k)} r={r2(3 * k)} fill="none" stroke={metal} strokeWidth={r2(1.4 * k)} />
      {/* Onion dome and finial. */}
      <path d={P`M${cx} ${top - 23 * k}C${cx + 2 * k} ${top - 19 * k} ${cx + 2 * k} ${top - 17 * k} ${cx} ${top - 15 * k}C${cx - 2 * k} ${top - 17 * k} ${cx - 2 * k} ${top - 19 * k} ${cx} ${top - 23 * k}ZM${cx} ${top - 15 * k}C${cx + 8 * k} ${top - 12 * k} ${cx + 22 * k} ${top - 8 * k} ${cx + 24 * k} ${top}H${cx - 24 * k}C${cx - 22 * k} ${top - 8 * k} ${cx - 8 * k} ${top - 12 * k} ${cx} ${top - 15 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      {/* The body: the glow, the pierced brass over it, the shading and the ribs. */}
      <path d={body} fill={`url(#${id}g)`} />
      <path d={body} fill={`url(#${id}p)`} />
      <path d={body} fill={`url(#${id}a)`} />
      <path d={P`M${cx - 26 * k} ${top + 14 * k}H${cx + 26 * k}M${cx - 26 * k} ${bot - 12 * k}H${cx + 26 * k}`} stroke={metal} strokeWidth={r2(2.4 * k)} />
      {full ? <path d={P`M${cx} ${top}V${bot}M${cx - 12 * k} ${top}C${cx - 18 * k} ${top + 20 * k} ${cx - 17 * k} ${top + 40 * k} ${cx - 10 * k} ${bot}M${cx + 12 * k} ${top}C${cx + 18 * k} ${top + 20 * k} ${cx + 17 * k} ${top + 40 * k} ${cx + 10 * k} ${bot}`} fill="none" stroke={metal} strokeWidth={r2(1.4 * k)} /> : null}
      <path d={body} fill="none" stroke={metal} strokeWidth={r2(1.6 * k)} />
      <rect x={r2(cx - 22 * k)} y={r2(top - 1 * k)} width={r2(44 * k)} height={r2(4 * k)} rx={r2(1.5 * k)} fill={metal} />
      {/* Base cone, bead and tassel drop. */}
      <path d={P`M${cx - 18 * k} ${bot}H${cx + 18 * k}L${cx + 5 * k} ${bot + 14 * k}H${cx - 5 * k}Z`} fill={metal} stroke={line} strokeWidth={r2(0.5 * k)} />
      <circle cx={r2(cx)} cy={r2(bot + 18 * k)} r={r2(4 * k)} fill={metal} />
      <path d={P`M${cx} ${bot + 22 * k}C${cx + 3 * k} ${bot + 26 * k} ${cx + 4 * k} ${h - 6 * k} ${cx + 2.6 * k} ${h - 2 * k}H${cx - 2.6 * k}C${cx - 4 * k} ${h - 6 * k} ${cx - 3 * k} ${bot + 26 * k} ${cx} ${bot + 22 * k}Z`} fill={colors.primary} stroke={metal} strokeWidth={r2(0.5 * k)} />
    </KitSvg>
  );
}

// ─────────────────────────── SacredFire ───────────────────────────

/** Homa flames (NATURE flame and core, shaped with taper) over crossed samidha sticks in a stepped copper kund dressed with marigolds and kumkum. */
export function SacredFire(props: DrawProps) {
  const p = props;
  const id = kitId(p, 'sf');
  const { w, h, colors, nature } = p;
  const k = w / 140;
  const ky = h / 150;
  const full = p.detail === 'full';
  const cx = w / 2;
  const copper = mix(colors.secondary, nature.clay, 0.45);
  const cline = shade(copper, 0.5);
  const kt = h * 0.64;
  const tier = 10 * ky;
  const fireH = kt - 2 * ky;
  // x offset (share of w), height (share of fireH), width factor (negative mirrors), skew, which of the two flames.
  const tongues: Array<[number, number, number, number, number]> = [
    [-0.23, 0.48, -1.5, -8, 0],
    [0.23, 0.52, 1.5, 8, 1],
    [-0.1, 0.8, 1.7, -4, 1],
    [0.11, 0.84, -1.7, 4, 0],
    [0, 1, 1.9, 1, 1],
    [-0.02, 0.56, -1.4, 0, 0],
  ];
  const marigold = marigoldOf(p);
  const sparks = full
    ? Array.from({ length: 5 }, (_, i) => dot(cx + (rand(i, p.seed) - 0.5) * w * 0.5, (0.05 + rand(i, p.seed + 1) * 0.35) * h, (0.8 + rand(i, 3) * 0.9) * k)).join('')
    : '';
  const sticks = [
    [-30, 4, 20, -16],
    [30, 4, -20, -16],
    [-18, 6, 26, -8],
  ]
    .map(([x0, y0, x1, y1]) => P`M${cx + x0! * k} ${kt + y0! * ky}L${cx + x1! * k} ${kt + y1! * ky}`)
    .join('');
  return (
    <KitSvg p={p}>
      <defs>
        <Glow id={`${id}h`} color={nature.flame} core={nature.flameCore} a={0.6} cy="62%" />
        <Lin id={`${id}m`} stops={metalLit(copper, p.light.from, false)} x1={0} y1={0} x2={w} y2={0} />
        {[0, 1].map((s) => (
          <FlameDef key={s} id={`${id}f${s}`} p={p} seed={p.seed * 7 + s} />
        ))}
      </defs>
      <ellipse cx={r2(cx)} cy={r2(kt * 0.62)} rx={r2(w * 0.52)} ry={r2(h * 0.5)} fill={`url(#${id}h)`} />
      {/* Crossed samidha sticks, then the flames rising from them. */}
      <path d={sticks} stroke={mix(nature.clayDark, colors.text, 0.3)} strokeWidth={r2(3.4 * k)} strokeLinecap="round" />
      {tongues.map(([dx, f, wide, sk, s], i) => (
        <FlameAt key={i} href={`${id}f${s}`} x={cx + dx * w} y={kt + 3 * ky} s={fireH * f} wide={wide} skew={sk} />
      ))}
      <path d={P`M${cx - 26 * k} ${kt}h${52 * k}`} stroke={nature.flameCore} strokeWidth={r2(3 * k)} strokeLinecap="round" opacity={0.75} />
      {full ? <path d={sparks} fill={nature.flameCore} /> : null}
      {/* The stepped kund: three tiers narrowing downward, each with a lit lip. */}
      {[0, 1, 2].map((i) => {
        const inset = w * (0.05 + i * 0.08);
        const y = kt + i * tier;
        const hh = i === 2 ? h - y : tier;
        return (
          <g key={i}>
            <rect x={r2(inset)} y={r2(y)} width={r2(w - 2 * inset)} height={r2(hh)} fill={`url(#${id}m)`} stroke={cline} strokeWidth={r2(0.6 * k)} />
            <rect x={r2(inset)} y={r2(y)} width={r2(w - 2 * inset)} height={r2(1.8 * ky)} fill={tint(copper, 0.4)} />
          </g>
        );
      })}
      <Rim p={p} x0={w * 0.21} x1={w * 0.79} y0={kt + 2 * tier} y1={h} k={k} />
      {full ? (
        <>
          <path d={Array.from({ length: 8 }, (_, i) => P`M${w * 0.2 + i * w * 0.075} ${kt + tier * 2 + 9 * ky}l${w * 0.0375} ${-6 * ky}l${w * 0.0375} ${6 * ky}`).join('')} fill="none" stroke={cline} strokeWidth={r2(0.7 * k)} />
          <path d={P`M${w * 0.16} ${kt + tier * 1.5}H${w * 0.84}`} stroke={colors.primary} strokeWidth={r2(2.2 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(6 * k)}`} />
        </>
      ) : null}
      {/* Marigolds at the corners of the rim. */}
      {[w * 0.09, w * 0.91].map((x) => (
        <g key={x}>
          <circle cx={r2(x)} cy={r2(kt - 3 * ky)} r={r2(5.4 * k)} fill={marigold} />
          <circle cx={r2(x)} cy={r2(kt - 3 * ky)} r={r2(3.8 * k)} fill="none" stroke={nature.flame} strokeWidth={r2(2.4 * k)} strokeDasharray={`${r2(1.6 * k)} ${r2(1.2 * k)}`} />
          <circle cx={r2(x)} cy={r2(kt - 3 * ky)} r={r2(1.4 * k)} fill={shade(marigold, 0.4)} />
        </g>
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── registry (sheets, Studio) ───────────────────────────

type Boxes = Record<string, { w: number; h: number }>;
const boxOf = (boxes: Boxes) => (variant: string) => boxes[variant] ?? Object.values(boxes)[0]!;

export const LIGHTS_KIT: readonly KitEntry[] = [
  { name: 'LightShaft', file: 'lights', variants: Object.keys(LIGHTS_BOXES.LightShaft), box: boxOf(LIGHTS_BOXES.LightShaft), render: (p, v) => <LightShaft {...p} variant={v as LightShaftVariant} /> },
  { name: 'LightString', file: 'lights', variants: Object.keys(LIGHTS_BOXES.LightString), box: boxOf(LIGHTS_BOXES.LightString), render: (p, v) => <LightString {...p} variant={v as LightStringVariant} /> },
  { name: 'Chandelier', file: 'lights', variants: Object.keys(LIGHTS_BOXES.Chandelier), box: boxOf(LIGHTS_BOXES.Chandelier), render: (p, v) => <Chandelier {...p} variant={v as ChandelierVariant} /> },
  { name: 'LampStand', file: 'lights', variants: Object.keys(LIGHTS_BOXES.LampStand), box: boxOf(LIGHTS_BOXES.LampStand), render: (p, v) => <LampStand {...p} variant={v as LampStandVariant} /> },
  { name: 'HangingLantern', file: 'lights', variants: Object.keys(LIGHTS_BOXES.HangingLantern), box: boxOf(LIGHTS_BOXES.HangingLantern), render: (p, v) => <HangingLantern {...p} variant={v as HangingLanternVariant} /> },
  { name: 'SacredFire', file: 'lights', variants: [''], box: boxOf(LIGHTS_BOXES.SacredFire), render: (p) => <SacredFire {...p} /> },
];
