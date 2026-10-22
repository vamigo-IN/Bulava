import type { ReactNode } from 'react';
import { mix } from '../../theme';
import { hex, onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { rand, r2 } from '../../art/motifs';
import { Glow, KitSvg, kitId, Lin, P } from '../kit/architecture';
import { HotAirBalloon } from '../kit/favourites';
import { illus } from '../kit';
import { billboard, hang } from '../planes';
import { rgba } from '../haze';
import type { DrawProps, Piece, SetContext, StageSetFactory } from '../types';

/**
 * T09 · Cloud Nine (`cloud-nine`, final.md §5.3): a nursery above the clouds at
 * a pastel dawn. There is no floor: four banks of cumulus recede to the
 * horizon, each lit from behind by the rising sun (silver-lined tops, blush
 * bodies, powder-blue undersides) and hazed with distance. In the valley the
 * banks open, a gold-foil crescent hangs on satin ribbons, cradling a sleeping
 * baby on a quilted cushion; hot-air balloons and a stork float far off, a
 * teddy and a gift sit in the near clouds, and folded paper stars hang on
 * threads in the crown band. The sky is the set's CSS gradient (the room has
 * no plane but its clouds), so the pixel budget goes to the clouds.
 */

// ─────────────────────────── shared drawing helpers ───────────────────────────

type C = DrawProps['colors'];
const url = (id: string) => `url(#${id})`;
/** An ellipse as path data (two arcs), so many share one path. */
const oval = (cx: number, cy: number, rx: number, ry: number) => P`M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
/** The upper rim of an ellipse (from 8 o'clock-ish to 4 o'clock-ish over the top): the silver lining. */
const topRim = (cx: number, cy: number, rx: number, ry: number) => P`M${cx - rx * 0.8} ${cy - ry * 0.6}A${rx} ${ry} 0 0 1 ${cx + rx * 0.8} ${cy - ry * 0.6}`;
/** A smooth bump 0..1 over |t| < 1 (no trigonometry). */
const bump = (t: number) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) * (1 - t * t));

/** Cloud tones from the (hazed) palette and the dawn light: lit tops, blush bodies, powder-blue undersides. */
function cloudTones(c: C, light: DrawProps['light']) {
  return {
    lit: mix(hex(c.background), hex(light.color), 0.5),
    hi: mix(hex(c.background), hex(c.accent), 0.22),
    body: mix(hex(c.surface), hex(c.secondary), 0.36),
    low: mix(mix(hex(c.surface), hex(c.primary), 0.4), hex(c.secondary), 0.18),
    rim: mix('#ffffff', hex(light.color), 0.25),
    warm: mix(hex(c.accent), hex(light.color), 0.5),
  };
}

// ─────────────────────────── CloudBank ───────────────────────────

interface CloudBankOptions {
  /** How far the heaps shrink and sink toward the middle (0..1), opening a valley for the focal piece. */
  dip: number;
  /** The valley's half-width (box units). */
  dipW: number;
  /** How tall the heaps tower (0 flat stratus .. 1 full cumulus). */
  tall: number;
  /** Heap size against the box height (far banks read flatter with smaller heaps). */
  size: number;
  /** Warm the crest facing the sun (the far banks). */
  warm?: boolean;
}

/**
 * A cumulus heap as puffs [dx, dy, r] in units of the heap's main radius, top
 * to bottom, with the tallness a heap needs to carry each one: a crown, two
 * shoulders, the main body and two low skirts.
 */
const HEAP: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.06, -1.04, 0.44, 0.66],
  [-0.5, -0.6, 0.56, 0.3],
  [0.48, -0.54, 0.6, 0.22],
  [0, 0, 1, 0],
  [-0.94, 0.36, 0.56, 0],
  [0.96, 0.4, 0.5, 0],
];

/**
 * A long bank of cumulus standing on its foot: heaps of round puffs of
 * varied size, each puff shaded as a soft sphere (a pale lit crown, a blush
 * body, a powder-blue foot), drawn top to bottom so every lower puff lays its
 * bright crown over the shade of the one behind: the cauliflower edge of real
 * cumulus. Crowns carry a silver lining against the sun behind; a warm fringe
 * glows over the crest. Heaps grow toward the sides and shrink and sink in the
 * middle, framing the story like wings of a stage.
 */
function CloudBank(p: DrawProps & CloudBankOptions) {
  const { w, h, colors: c, light } = p;
  const low = p.detail === 'low';
  const id = kitId(p, 'cb');
  const t = cloudTones(c, light);
  const salt = 11 + (p.seed % 97);
  type Puff = { x: number; y: number; r: number; crown: boolean };
  const puffs: Puff[] = [];
  let x = -h * 0.15;
  for (let i = 0; i < 80 && x < w + h * 0.15; i++) {
    const v = p.dip * bump((x - w / 2) / Math.max(1, p.dipW));
    const side = Math.min(1, Math.abs(x - w / 2) / (w / 2));
    const R = Math.min(h * 0.4, h * p.size * (0.22 + rand(i, salt) * 0.14 + side * 0.1) * (1 - v * 0.85));
    const tall = p.tall * (0.3 + rand(i, salt + 1) * 0.7 + side * 0.25) * (1 - v * 0.8);
    const hy = h - R * 0.96 + v * h * 0.12;
    for (const [dx, dy, rr, need] of HEAP) {
      if (need > tall || (p.tall < 0.7 && dy > 0)) continue;
      puffs.push({ x: x + dx * R + (rand(i * 7 + Math.round(dx * 10), salt + 2) - 0.5) * 0.14 * R, y: hy + dy * R, r: rr * R * (0.9 + rand(i * 5 + Math.round(dy * 10), salt + 3) * 0.2), crown: dy < 0 || need > 0 });
    }
    x += R * ((p.tall < 0.7 ? 1.5 : 1.2) + rand(i, salt + 4) * 0.45);
  }
  puffs.sort((a, b) => a.y - a.r * 0.2 - (b.y - b.r * 0.2));
  const sw = Math.max(1.4, h / 110);
  // The silver lining on a crown: the upper third of its rim.
  const lined = p.tall >= 0.8 && !low;
  const n0 = Math.round;
  // The silver lining on a crown: a thin crescent over its upper third (filled, so it needs one attribute).
  const rim = (b: Puff) => {
    const a = b.r * 0.866;
    const s2 = Math.max(1, b.r * 0.5 - sw * 1.3);
    const R2 = (a * a + s2 * s2) / (2 * s2);
    const y0 = n0(b.y - b.r * 0.5);
    return `M${n0(b.x - a)} ${y0}A${n0(b.r)} ${n0(b.r)} 0 0 1 ${n0(b.x + a)} ${y0}A${n0(R2)} ${n0(R2)} 0 0 0 ${n0(b.x - a)} ${y0}Z`;
  };
  const foot = h * 0.84;
  const rimTone = mix(t.rim, t.lit, 0.3);
  return (
    <KitSvg p={p}>
      <defs>
        <radialGradient id={`${id}p`} cx="0.5" cy="0.3" r="0.72" fx="0.44" fy="0.12">
          <stop offset="0" stopColor={t.lit} />
          <stop offset="0.36" stopColor={t.hi} />
          <stop offset="0.68" stopColor={t.body} />
          <stop offset="1" stopColor={t.low} />
        </radialGradient>
        <Lin id={`${id}k`} stops={[[0, t.body, 0], [0.35, t.body, 1], [1, t.low]]} y1={foot} y2={h} />
        {p.warm ? <Glow id={`${id}w`} color={t.warm} core={tint(t.warm, 0.45)} a={0.85} /> : null}
      </defs>
      {/* A warm fringe over the crest where the sun stands behind, then the soft edge of the bank. */}
      {p.warm ? <ellipse cx={r2(w / 2)} cy={r2(h * 0.3)} rx={r2(w * 0.24)} ry={r2(h * 0.5)} fill={url(`${id}w`)} /> : null}
      {lined ? <path d={puffs.filter((b) => b.crown).map((b) => oval(n0(b.x), n0(b.y - b.r * 0.04), n0(b.r * 1.08), n0(b.r * 1.08))).join('')} fill={t.lit} opacity={0.4} /> : null}
      <rect x={0} y={r2(foot)} width={r2(w)} height={r2(h - foot)} fill={url(`${id}k`)} />
      <g fill={url(`${id}p`)}>
        {puffs.map((b, i) =>
          !lined || !b.crown ? (
            <circle key={i} cx={n0(b.x)} cy={n0(b.y)} r={n0(b.r)} />
          ) : (
            [<circle key={i} cx={n0(b.x)} cy={n0(b.y)} r={n0(b.r)} />, <path key={`${i}r`} d={rim(b)} fill={rimTone} />]
          ),
        )}
      </g>
    </KitSvg>
  );
}

// ─────────────────────────── DawnSun ───────────────────────────

/**
 * The rising sun behind the cloud sea: a pale-gold disc with a hot white
 * core, two soft halo rings, and three wisps of stratus drawn across its foot.
 * Quiet: tone-on-tone against the dawn sky.
 */
function DawnSun(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'ds');
  const cx = w / 2;
  const cy = h * 0.56;
  const R = h * 0.34;
  const gold = mix(hex(c.accent), hex(light.color), 0.45);
  const wisp = mix(hex(c.background), hex(c.secondary), 0.3);
  const streak = (y: number, x0: number, x1: number, th: number) => P`M${x0} ${y}C${x0 + (x1 - x0) * 0.3} ${y - th} ${x0 + (x1 - x0) * 0.7} ${y - th} ${x1} ${y}C${x0 + (x1 - x0) * 0.7} ${y + th * 0.6} ${x0 + (x1 - x0) * 0.3} ${y + th * 0.6} ${x0} ${y}Z`;
  return (
    <KitSvg p={p}>
      <defs>
        <Glow id={`${id}h`} color={gold} core={tint(gold, 0.5)} a={0.9} />
        <radialGradient id={`${id}d`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.5" stopColor={tint(gold, 0.3)} />
          <stop offset="1" stopColor={shade(gold, 0.04)} />
        </radialGradient>
      </defs>
      <ellipse cx={r2(cx)} cy={r2(cy)} rx={r2(w * 0.5)} ry={r2(h * 0.56)} fill={url(`${id}h`)} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R * 1.45)} fill="none" stroke={tint(gold, 0.5)} strokeWidth={r2(R * 0.05)} opacity={0.35} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R * 1.9)} fill="none" stroke={tint(gold, 0.6)} strokeWidth={r2(R * 0.03)} opacity={0.22} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} fill={url(`${id}d`)} />
      <path d={streak(cy + R * 0.3, cx - R * 1.9, cx + R * 0.9, R * 0.1) + streak(cy + R * 0.62, cx - R * 0.6, cx + R * 2.1, R * 0.12) + streak(cy - R * 0.12, cx + R * 0.2, cx + R * 1.6, R * 0.06)} fill={wisp} opacity={0.75} />
    </KitSvg>
  );
}

// ─────────────────────────── BabyBlocks ───────────────────────────

/**
 * Three wooden nursery blocks, two side by side and one turned on top, in the
 * palette's pastels with gilt edges and an embossed star, heart and crescent
 * (no letters). Lit from the sun behind: the tops catch it, the faces toward
 * us rest in soft shade, the right sides are darker.
 */
function BabyBlocks(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'bb');
  const a = Math.min(w * 0.36, h * 0.46);
  const d = a * 0.24;
  const gold = mix(hex(c.accent), '#c9a24e', 0.42);
  const cube = (x: number, y: number, base: string, sym: 'star' | 'heart' | 'moon', key: string) => {
    const l = x - a / 2;
    const r = x + a / 2;
    const top = y - a;
    const s = a * 0.22;
    const symbol =
      sym === 'star'
        ? starPath(x, top + a * 0.52, s * 1.25, 0.45)
        : sym === 'heart'
          ? P`M${x} ${top + a * 0.74}C${x - s * 2.2} ${top + a * 0.5} ${x - s * 1.1} ${top + a * 0.2} ${x} ${top + a * 0.38}C${x + s * 1.1} ${top + a * 0.2} ${x + s * 2.2} ${top + a * 0.5} ${x} ${top + a * 0.74}Z`
          : P`M${x + s * 0.3} ${top + a * 0.24}A${s * 1.3} ${s * 1.3} 0 1 0 ${x + s * 0.3} ${top + a * 0.8}A${s * 1.05} ${s * 1.05} 0 1 1 ${x + s * 0.3} ${top + a * 0.24}Z`;
    return (
      <g key={key}>
        <path d={P`M${l} ${top}L${l + d} ${top - d * 0.6}H${r + d}L${r} ${top}Z`} fill={tint(base, 0.42)} />
        <path d={P`M${r} ${top}L${r + d} ${top - d * 0.6}V${y - d * 0.6}L${r} ${y}Z`} fill={shade(base, 0.22)} />
        <rect x={r2(l)} y={r2(top)} width={r2(a)} height={r2(a)} fill={base} />
        <rect x={r2(l + a * 0.08)} y={r2(top + a * 0.08)} width={r2(a * 0.84)} height={r2(a * 0.84)} rx={r2(a * 0.06)} fill="none" stroke={url(`${id}g`)} strokeWidth={r2(a * 0.045)} />
        <path d={symbol} fill={url(`${id}g`)} />
        <path d={P`M${l} ${top}L${l + d} ${top - d * 0.6}H${r + d}`} fill="none" stroke={light.rim} strokeWidth={r2(Math.max(1, a * 0.025))} opacity={0.85} />
      </g>
    );
  };
  const b0 = mix(hex(c.primary), hex(c.background), 0.5);
  const b1 = mix(hex(c.secondary), hex(c.background), 0.22);
  const b2 = mix(hex(c.accent), hex(c.background), 0.1);
  const gap = a * 0.08;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, shade(gold, 0.25)], [0.4, tint(gold, 0.5)], [0.6, gold], [1, shade(gold, 0.2)]]} bbox x2={1} y2={1} />
      </defs>
      {cube(w / 2 - a / 2 - gap / 2 - d / 2, h, b0, 'star', 'a')}
      {cube(w / 2 + a / 2 + gap / 2 - d / 2, h, b1, 'heart', 'b')}
      <g transform={`rotate(-9 ${r2(w / 2)} ${r2(h - a)})`}>{cube(w / 2 - d / 2 + a * 0.06, h - a - d * 0.1, b2, 'moon', 'c')}</g>
    </KitSvg>
  );
}

// ─────────────────────────── MoonSwing ───────────────────────────

/** Unit star (10 points, outer then inner, from the top, clockwise), precomputed: no trigonometry. */
const STAR: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0.5878, -0.809],
  [0.9511, -0.309],
  [0.9511, 0.309],
  [0.5878, 0.809],
  [0, 1],
  [-0.5878, 0.809],
  [-0.9511, 0.309],
  [-0.9511, -0.309],
  [-0.5878, -0.809],
];
const starPath = (cx: number, cy: number, r: number, inner = 0.42) => `M${STAR.map(([x, y], i) => `${r2(cx + x * r * (i % 2 ? inner : 1))} ${r2(cy + y * r * (i % 2 ? inner : 1))}`).join('L')}Z`;

/**
 * The focal piece: a gold-foil crescent lying horns up, hung on two satin
 * ribbons tied in bows at its tips, cradling a sleeping baby under a starry
 * quilt on a quilted cushion. A paper star dangles from the left horn. The
 * ribbons fade into the sky above, so the swing hangs from the dawn itself.
 */
function MoonSwing(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const low = p.detail === 'low';
  const id = kitId(p, 'ms');
  const q = w / 420;
  const cx = w / 2;
  // The crescent: outer circle R about (cx, cy), inner circle r about (cx, cy − e); tips where they meet.
  const R = 150 * q;
  const r = 136 * q;
  const e = 60 * q;
  const cy = h - R - 6 * q;
  const ty = (r * r - R * R - e * e) / (2 * e); // tips, relative to the outer centre
  const tx = Math.sqrt(R * R - ty * ty);
  const tipY = cy + ty;
  const innerLarge = ty + e < 0 ? 1 : 0;
  const crescent = P`M${cx - tx} ${tipY}A${R} ${R} 0 1 0 ${cx + tx} ${tipY}` + `A${r2(r)} ${r2(r)} 0 ${innerLarge} 1 ${r2(cx - tx)} ${r2(tipY)}Z`;
  const innerBottom = cy - e + r;
  const gold = mix(hex(c.accent), '#c9a24e', 0.42);
  const satin = hex(c.secondary);
  const quilt = mix(hex(c.primary), hex(c.background), 0.62);
  const quiltDark = mix(hex(c.primary), hex(c.background), 0.38);
  const blanket = mix(hex(c.secondary), hex(c.background), 0.35);
  const cap = mix(hex(c.primary), hex(c.background), 0.45);
  // Satin ribbons: a slight S as they rise, narrowing into the sky.
  const ribbon = (x: number, k: number): Segment[] => [
    [
      [x, tipY - 4 * q],
      [x + 8 * k * q, tipY * 0.7],
      [x - 10 * k * q, tipY * 0.35],
      [x + 3 * k * q, 0],
    ],
  ];
  const bow = (x: number, k: number) =>
    `${taper([[[x, tipY], [x - 26 * k * q, tipY - 30 * q], [x - 44 * k * q, tipY + 2 * q], [x, tipY]]], [3 * q, 14 * q, 3 * q], 12)}` +
    `${taper([[[x, tipY], [x + 26 * k * q, tipY - 30 * q], [x + 44 * k * q, tipY + 2 * q], [x, tipY]]], [3 * q, 14 * q, 3 * q], 12)}` +
    `${taper([[[x, tipY], [x - 6 * q, tipY + 18 * q], [x - 16 * q, tipY + 34 * q], [x - 20 * q, tipY + 50 * q]]], [7 * q, 4 * q], 10)}` +
    `${taper([[[x, tipY], [x + 8 * q, tipY + 16 * q], [x + 14 * q, tipY + 30 * q], [x + 22 * q, tipY + 44 * q]]], [7 * q, 4 * q], 10)}`;
  // The cushion and quilt fill the bowl; their feet hide behind the crescent.
  const bowlTop = tipY + 14 * q;
  const cushion = P`M${cx - tx + 8 * q} ${bowlTop + 30 * q}C${cx - tx + 30 * q} ${bowlTop - 12 * q} ${cx + tx - 30 * q} ${bowlTop - 12 * q} ${cx + tx - 8 * q} ${bowlTop + 30 * q}L${cx + tx - 30 * q} ${innerBottom}H${cx - tx + 30 * q}Z`;
  const headX = cx - 62 * q;
  const headY = bowlTop - 14 * q;
  const headR = 30 * q;
  const quiltPath = P`M${cx - 40 * q} ${bowlTop + 4 * q}C${cx - 10 * q} ${bowlTop - 38 * q} ${cx + 70 * q} ${bowlTop - 40 * q} ${cx + tx - 22 * q} ${bowlTop - 6 * q}C${cx + tx} ${bowlTop + 8 * q} ${cx + tx - 4 * q} ${bowlTop + 40 * q} ${cx + tx - 30 * q} ${innerBottom}H${cx - 50 * q}Z`;
  const hem: Segment = [
    [cx - 40 * q, bowlTop + 4 * q],
    [cx - 10 * q, bowlTop - 38 * q],
    [cx + 70 * q, bowlTop - 40 * q],
    [cx + tx - 22 * q, bowlTop - 6 * q],
  ];
  const quiltStars = low
    ? ''
    : [
        [0.05, -0.02],
        [0.32, -0.12],
        [0.58, -0.08],
        [0.2, 0.1],
        [0.46, 0.08],
        [0.72, 0.06],
      ]
        .map(([fx, fy]) => starPath(cx - 20 * q + fx! * (tx + 10 * q), bowlTop + fy! * 120 * q + 8 * q, 5.5 * q))
        .join('');
  const diamonds = low
    ? ''
    : Array.from({ length: 7 }, (_, i) => {
        const x = cx - tx + 30 * q + i * ((2 * tx - 60 * q) / 6);
        return P`M${x - 22 * q} ${bowlTop + 22 * q}L${x} ${bowlTop + 4 * q}L${x + 22 * q} ${bowlTop + 22 * q}`;
      }).join('');
  // Engraved hairline inside the crescent and star studs along it.
  const studs = low
    ? ''
    : [0.18, 0.34, 0.5, 0.66, 0.82]
        .map((f) => {
          const x = cx - tx * 0.9 + f * tx * 1.8;
          const dx = x - cx;
          const y = cy + Math.sqrt(Math.max(0, (R - 22 * q) * (R - 22 * q) - dx * dx)) * 0.98;
          return starPath(x, y - 6 * q, 6 * q, 0.45);
        })
        .join('');
  const hairR = R - 9 * q;
  const hairTx = tx * (hairR / R) * 0.96;
  const hairTy = cy + Math.sqrt(Math.max(0, hairR * hairR - hairTx * hairTx)) * -0.35;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, shade(gold, 0.34)], [0.18, tint(gold, 0.25)], [0.36, tint(gold, 0.62)], [0.5, gold], [0.7, shade(gold, 0.24)], [0.86, tint(gold, 0.35)], [1, shade(gold, 0.2)]]} x1={cx - R} y1={cy - R * 0.4} x2={cx + R} y2={cy + R} />
        <Lin id={`${id}r`} stops={[[0, satin, 0], [0.35, satin, 0.75], [1, satin, 1]]} y2={tipY} />
        <Lin id={`${id}s`} stops={[[0, tint(satin, 0.5), 0], [0.4, tint(satin, 0.55), 0.7], [1, tint(satin, 0.6), 0.9]]} y2={tipY} />
        <Lin id={`${id}c`} stops={[[0, tint(quilt, 0.35)], [1, quiltDark]]} y1={bowlTop - 20 * q} y2={innerBottom} />
        <Lin id={`${id}q`} stops={[[0, tint(blanket, 0.4)], [0.6, blanket], [1, shade(blanket, 0.18)]]} x1={cx - 40 * q} y1={bowlTop - 40 * q} x2={cx + tx} y2={innerBottom} />
        <Glow id={`${id}h`} color={mix(hex(c.accent), light.color, 0.5)} core={tint(hex(c.accent), 0.6)} a={0.55} />
        <pattern id={`${id}t`} patternUnits="userSpaceOnUse" width={r2(24 * q)} height={r2(24 * q)}>
          <path d={P`M0 0L${24 * q} ${24 * q}M${24 * q} 0L0 ${24 * q}`} stroke={tint(blanket, 0.55)} strokeWidth={r2(1.3 * q)} strokeDasharray={`${r2(2.5 * q)} ${r2(2 * q)}`} opacity={0.85} />
          <circle cx={r2(12 * q)} cy={0} r={r2(1.8 * q)} fill={tint(gold, 0.4)} />
          <circle cx={r2(12 * q)} cy={r2(24 * q)} r={r2(1.8 * q)} fill={tint(gold, 0.4)} />
        </pattern>
      </defs>
      {/* A soft moonlight halo behind the bowl. */}
      <ellipse cx={r2(cx)} cy={r2(cy - 20 * q)} rx={r2(R * 1.35)} ry={r2(R * 1.05)} fill={url(`${id}h`)} />
      {/* Ribbons rising into the sky: a satin face and a paler sheen. */}
      <path d={`${taper(ribbon(cx - tx, 1), [9 * q, 5 * q])}${taper(ribbon(cx + tx, -1), [9 * q, 5 * q])}`} fill={url(`${id}r`)} />
      {low ? null : <path d={`${taper(ribbon(cx - tx + 2 * q, 1), [3 * q, 1.5 * q])}${taper(ribbon(cx + tx - 2 * q, -1), [3 * q, 1.5 * q])}`} fill={url(`${id}s`)} />}
      {/* Cushion, baby and quilt in the bowl. */}
      <path d={cushion} fill={url(`${id}c`)} />
      {diamonds ? <path d={diamonds} fill="none" stroke={tint(quilt, 0.5)} strokeWidth={r2(1.6 * q)} opacity={0.8} /> : null}
      <ellipse cx={r2(headX - 4 * q)} cy={r2(headY + 18 * q)} rx={r2(44 * q)} ry={r2(16 * q)} fill={hex(c.background)} />
      <circle cx={r2(headX)} cy={r2(headY)} r={r2(headR)} fill={p.nature.skin} />
      <ellipse cx={r2(headX + 13 * q)} cy={r2(headY + 9 * q)} rx={r2(6 * q)} ry={r2(4 * q)} fill={mix(p.nature.skinShade, hex(c.secondary), 0.4)} opacity={0.7} />
      <path d={P`M${headX - 11 * q} ${headY + 1 * q}q${4 * q} ${4 * q} ${8 * q} 0M${headX + 5 * q} ${headY + 1 * q}q${4 * q} ${4 * q} ${8 * q} 0M${headX - 2 * q} ${headY + 13 * q}q${3 * q} ${2 * q} ${6 * q} 0`} fill="none" stroke={shade(p.nature.skinShade, 0.45)} strokeWidth={r2(1.8 * q)} strokeLinecap="round" />
      {/* A knitted cap with a pompom. */}
      <path d={P`M${headX - headR - 2 * q} ${headY - 2 * q}C${headX - headR} ${headY - headR * 1.5} ${headX + headR} ${headY - headR * 1.5} ${headX + headR + 2 * q} ${headY - 2 * q}Q${headX} ${headY - 10 * q} ${headX - headR - 2 * q} ${headY - 2 * q}Z`} fill={cap} />
      <path d={P`M${headX - headR} ${headY - 4 * q}Q${headX} ${headY - 14 * q} ${headX + headR} ${headY - 4 * q}`} fill="none" stroke={shade(cap, 0.15)} strokeWidth={r2(5 * q)} strokeLinecap="round" />
      <circle cx={r2(headX + 4 * q)} cy={r2(headY - headR * 1.2)} r={r2(8 * q)} fill={tint(cap, 0.35)} />
      <path d={quiltPath} fill={url(`${id}q`)} />
      {low ? null : <path d={quiltPath} fill={url(`${id}t`)} />}
      {/* A lace hem of scallops along the quilt's turned-down edge, bound in satin. */}
      {low ? null : <path d={Array.from({ length: 15 }, (_, i) => onCubic(hem, i / 14)).map((o) => oval(o.x - o.ty * 4 * q, o.y + o.tx * 4 * q, 6.5 * q, 6.5 * q)).join('')} fill={tint(blanket, 0.78)} />}
      <path d={P`M${hem[0][0]} ${hem[0][1]}C${hem[1][0]} ${hem[1][1]} ${hem[2][0]} ${hem[2][1]} ${hem[3][0]} ${hem[3][1]}`} fill="none" stroke={tint(blanket, 0.5)} strokeWidth={r2(6 * q)} strokeLinecap="round" />
      <path d={P`M${hem[0][0]} ${hem[0][1]}C${hem[1][0]} ${hem[1][1]} ${hem[2][0]} ${hem[2][1]} ${hem[3][0]} ${hem[3][1]}`} fill="none" stroke={tint(gold, 0.35)} strokeWidth={r2(1.2 * q)} strokeDasharray={`${r2(3 * q)} ${r2(3 * q)}`} />
      {quiltStars ? <path d={quiltStars} fill={tint(gold, 0.3)} /> : null}
      {/* The crescent in foil, an engraved hairline and star studs, and the rim light on both edges (the sun is behind). */}
      <path d={crescent} fill={url(`${id}g`)} />
      {low ? null : <path d={P`M${cx - hairTx} ${hairTy + 18 * q}A${hairR} ${hairR} 0 0 0 ${cx + hairTx} ${hairTy + 18 * q}`} fill="none" stroke={tint(gold, 0.55)} strokeWidth={r2(1.4 * q)} opacity={0.8} />}
      {studs ? <path d={studs} fill={tint(gold, 0.6)} /> : null}
      <path d={P`M${cx - tx} ${tipY}A${R} ${R} 0 1 0 ${cx + tx} ${tipY}`} fill="none" stroke={light.rim} strokeWidth={r2(2 * q)} opacity={0.55} />
      {/* Bows where the ribbons meet the horns. */}
      <path d={`${bow(cx - tx, 1)}${bow(cx + tx, -1)}`} fill={satin} />
      <path d={`${oval(cx - tx, tipY, 6 * q, 7 * q)}${oval(cx + tx, tipY, 6 * q, 7 * q)}`} fill={shade(satin, 0.2)} />
      {/* A paper star on a thread from the left horn. */}
      <path d={P`M${cx - tx + 8 * q} ${tipY + 8 * q}V${tipY + 78 * q}`} stroke={tint(gold, 0.3)} strokeWidth={r2(1.2 * q)} />
      <path d={starPath(cx - tx + 8 * q, tipY + 92 * q, 14 * q)} fill={url(`${id}g`)} />
    </KitSvg>
  );
}

// ─────────────────────────── PaperStar ───────────────────────────

/**
 * A folded paper star on a thread: ten facets, each point's two halves lit
 * and shaded so it reads as an origami fold, in foil gold or blush.
 */
function PaperStar(p: DrawProps & { tone: 'gold' | 'blush' }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, `ps${p.tone}`);
  const R = w * 0.48;
  const cx = w / 2;
  const cy = h - R - 1;
  const base = p.tone === 'gold' ? mix(hex(c.accent), '#c9a24e', 0.42) : mix(hex(c.secondary), hex(c.background), 0.1);
  const pt = (i: number) => {
    const [x, y] = STAR[i % 10]!;
    const k = i % 2 ? 0.44 : 1;
    return [cx + x * R * k, cy + y * R * k] as const;
  };
  const facets: Array<{ d: string; lit: boolean }> = [];
  for (let i = 0; i < 10; i += 2) {
    const [ox, oy] = pt(i);
    const [lx, ly] = pt(i + 9);
    const [rx, ry] = pt(i + 1);
    facets.push({ d: P`M${cx} ${cy}L${lx} ${ly}L${ox} ${oy}Z`, lit: true });
    facets.push({ d: P`M${cx} ${cy}L${ox} ${oy}L${rx} ${ry}Z`, lit: false });
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}t`} stops={[[0, tint(hex(c.muted), 0.5), 0], [0.5, tint(hex(c.muted), 0.3), 0.7], [1, hex(c.muted), 0.8]]} y2={cy} />
      </defs>
      <path d={P`M${cx} 0V${cy - R * 0.9}`} stroke={url(`${id}t`)} strokeWidth={1.4} />
      <circle cx={r2(cx)} cy={r2(cy - R - 2)} r={2.4} fill={tint(base, 0.3)} />
      <path d={facets.filter((f) => f.lit).map((f) => f.d).join('')} fill={tint(base, 0.32)} />
      <path d={facets.filter((f) => !f.lit).map((f) => f.d).join('')} fill={shade(base, 0.16)} />
      <path d={starPath(cx, cy, R, 0.44)} fill="none" stroke={tint(base, 0.6)} strokeWidth={1} opacity={0.8} />
    </KitSvg>
  );
}

// ─────────────────────────── Nestled props ───────────────────────────

/** An illustration nestled in a cloud tuft: the art stands in the box and a puff of cloud wraps its foot. */
function nestled(art: (p: DrawProps) => ReactNode, share: number) {
  return function Nestled(p: DrawProps) {
    const id = kitId(p, 'nt');
    const t = cloudTones(p.colors, p.light);
    const artH = p.h * share;
    const puffs = [
      [0.12, 0.86, 0.2, 0.12],
      [0.32, 0.8, 0.22, 0.15],
      [0.56, 0.81, 0.24, 0.15],
      [0.8, 0.85, 0.2, 0.12],
      [0.48, 0.92, 0.5, 0.1],
    ] as const;
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: `${r2(share * 100)}%` }}>{art({ ...p, h: artH })}</div>
        <div style={{ position: 'absolute', inset: 0 }}>
          <KitSvg p={p}>
            <defs>
              <Lin id={`${id}f`} stops={[[0, t.hi], [0.5, t.body], [1, t.low]]} y1={p.h * 0.66} y2={p.h} />
            </defs>
            <path d={puffs.map(([x, y, rx, ry]) => oval(x * p.w, y * p.h, rx * p.w, ry * p.h)).join('') + P`M0 ${p.h * 0.9}H${p.w}V${p.h}H0Z`} fill={url(`${id}f`)} />
            <path d={puffs.slice(0, 4).map(([x, y, rx, ry]) => topRim(x * p.w, y * p.h, rx * p.w, ry * p.h)).join('')} fill="none" stroke={t.rim} strokeWidth={2} opacity={0.75} strokeLinecap="round" />
          </KitSvg>
        </div>
      </div>
    );
  };
}

// ─────────────────────────── the sky ───────────────────────────

/** The dawn sky as the stage's CSS background: powder blue above, blush, a peach-gold horizon at 55%, the sea of cloud below it. */
function dawnSky(c: SetContext['colors']): string {
  const top = mix(c.background, c.primary, 0.3);
  const high = mix(c.background, c.primary, 0.15);
  const mid = mix(c.background, c.secondary, 0.24);
  const horizon = mix(c.accent, c.secondary, 0.22);
  const below = mix(c.surface, c.secondary, 0.22);
  const glow = rgba(mix(c.accent, '#fff1c9', 0.5), 0.85);
  const veil = rgba('#ffffff', 0.4);
  // The deck of cloud far below the banks (seen when the camera draws back): soft lit mounds over a lavender floor.
  const deckLit = mix(c.background, '#fff1c9', 0.45);
  const deckShade = mix(mix(c.surface, c.primary, 0.3), c.secondary, 0.15);
  const deck = Array.from({ length: 9 }, (_, i) => {
    const x = r2(-4 + i * 13.5 + (rand(i, 41) - 0.5) * 6);
    const y = r2(84 + rand(i, 43) * 12);
    const rx = r2(11 + rand(i, 47) * 7);
    const ry = r2(5 + rand(i, 53) * 3);
    return `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, ${rgba(deckLit, 0.95)} 0%, ${rgba(deckLit, 0.7)} 48%, ${rgba(deckLit, 0)} 100%)`;
  });
  return [
    ...deck,
    `radial-gradient(ellipse 80% 16% at 50% 56%, ${glow}, ${rgba(c.accent, 0)} 72%)`,
    `radial-gradient(ellipse 34% 1.4% at 26% 24%, ${veil}, ${rgba('#ffffff', 0)})`,
    `radial-gradient(ellipse 28% 1.2% at 76% 33%, ${veil}, ${rgba('#ffffff', 0)})`,
    `radial-gradient(ellipse 40% 1.6% at 60% 44%, ${veil}, ${rgba('#ffffff', 0)})`,
    `linear-gradient(180deg, ${top} 0%, ${high} 22%, ${mid} 40%, ${horizon} 55%, ${below} 58%, ${below} 76%, ${deckShade} 100%)`,
  ].join(', ');
}

// ─────────────────────────── the set ───────────────────────────

const draws = {
  bank: (o: CloudBankOptions) => (p: DrawProps) => <CloudBank {...p} {...o} />,
  blocks: (p: DrawProps) => <BabyBlocks {...p} />,
  balloon: (scheme: 0 | 1) => (p: DrawProps) => <HotAirBalloon {...p} scheme={scheme} />,
  star: (tone: 'gold' | 'blush') => (p: DrawProps) => <PaperStar {...p} tone={tone} />,
};

export const cloudNine: StageSetFactory = (ctx) => {
  const swing = { x: 600, d: 1450, w: 500, h: 470, base: 785 };
  const pieces: Piece[] = [
    // The sea of cloud, near to far: the near two open a valley on the swing; the far two drift.
    { kind: 'prop', id: 'bank-near', art: 'cloudBank', role: 'architecture', nearFade: false, ...billboard({ x: 600, d: 900, w: 1800, h: 320 }), draw: draws.bank({ dip: 0.75, dipW: 330, tall: 1, size: 1 }) },
    { kind: 'prop', id: 'bank-mid', art: 'cloudBank', role: 'architecture', ...billboard({ x: 600, d: 1300, w: 2400, h: 280 }), draw: draws.bank({ dip: 0.7, dipW: 420, tall: 0.85, size: 1.05 }) },
    { kind: 'prop', id: 'bank-far', art: 'cloudBank', role: 'architecture', ...billboard({ x: 600, d: 2000, w: 3600, h: 250 }), motion: { kind: 'drift', amp: 20, period: 24 }, draw: draws.bank({ dip: 0.3, dipW: 600, tall: 0.6, size: 0.75, warm: true }) },
    { kind: 'prop', id: 'bank-horizon', art: 'cloudBank', role: 'architecture', ...billboard({ x: 600, d: 2800, w: 5000, h: 270 }), motion: { kind: 'drift', amp: 24, period: 30, phase: 0.4 }, draw: draws.bank({ dip: 0, dipW: 1, tall: 0.35, size: 0.6, warm: true }) },
    { kind: 'prop', id: 'sun-disc', art: 'dawnSun', role: 'architecture', quiet: true, ...hang({ x: 600, d: 2950, w: 900, h: 420, top: 220 }), draw: DawnSun },
    // The focal swing, its moonlight and the dawn sun behind the cloud sea.
    { kind: 'prop', id: 'moon-swing', art: 'moonSwing', role: 'focal', ...hang({ x: swing.x, d: swing.d, w: swing.w, h: swing.h, top: swing.base - swing.h }), motion: { kind: 'sway', amp: 1.2, period: 8 }, buildIn: 'drop', draw: MoonSwing },
    { kind: 'light', id: 'moon-glow', art: 'glow', role: 'light', at: { x: 600, y: 640, z: -1480 }, r: 210, color: '#fff6dc', strength: 0.32, buildIn: 'bloom' },
    { kind: 'light', id: 'sun', art: 'glow', role: 'light', at: { x: 600, y: 540, z: -2900 }, r: 380, color: '#fff1c9', strength: 0.5, bloom: true, buildIn: 'light' },
    // Far off: two balloons at different depths and a stork with its bundle.
    { kind: 'prop', id: 'balloon-left', art: 'hotAirBalloon', role: 'prop', ...hang({ x: 215, d: 1900, w: 180, h: 250, top: 325 }), motion: { kind: 'bob', amp: 12, period: 7 }, buildIn: 'rise', draw: draws.balloon(0) },
    { kind: 'prop', id: 'balloon-right', art: 'hotAirBalloon', role: 'prop', ...hang({ x: 1130, d: 2500, w: 160, h: 220, top: 260 }), motion: { kind: 'bob', amp: 12, period: 7, phase: 0.45 }, buildIn: 'rise', draw: draws.balloon(1) },
    { kind: 'prop', id: 'stork', art: 'stork', role: 'prop', ...hang({ x: 1080, d: 2600, w: 200, h: 153, top: 537 }), motion: { kind: 'drift', amp: 40, period: 20, phase: 0.2 }, draw: illus('stork', 'secondary') },
    // In the near clouds: a teddy and a gift.
    { kind: 'prop', id: 'teddy', art: 'teddyBear', role: 'prop', ...billboard({ x: 762, d: 850, w: 150, h: 175 }), buildIn: 'bloom', draw: nestled(illus('teddyBear', 'secondary'), 0.9) },
    { kind: 'prop', id: 'blocks', art: 'babyBlocks', role: 'prop', ...billboard({ x: 448, d: 860, w: 150, h: 150 }), buildIn: 'bloom', detail: 'high', draw: nestled(draws.blocks, 0.84) },
    // Paper stars on threads in the crown band.
    { kind: 'prop', id: 'star-1', art: 'paperStar', role: 'hanging', ...hang({ x: 448, d: 660, w: 46, h: 128, top: -120 }), motion: { kind: 'sway', amp: 3, period: 5 }, buildIn: 'drop', draw: draws.star('gold') },
    { kind: 'prop', id: 'star-2', art: 'paperStar', role: 'hanging', ...hang({ x: 540, d: 720, w: 36, h: 98, top: -120 }), motion: { kind: 'sway', amp: 3, period: 5.6, phase: 0.3 }, buildIn: 'drop', draw: draws.star('blush') },
    { kind: 'prop', id: 'star-3', art: 'paperStar', role: 'hanging', ...hang({ x: 668, d: 680, w: 40, h: 112, top: -120 }), motion: { kind: 'sway', amp: 3, period: 4.6, phase: 0.6 }, buildIn: 'drop', draw: draws.star('gold') },
    { kind: 'prop', id: 'star-4', art: 'paperStar', role: 'hanging', ...hang({ x: 758, d: 640, w: 34, h: 92, top: -120 }), motion: { kind: 'sway', amp: 3, period: 5.2, phase: 0.15 }, buildIn: 'drop', draw: draws.star('blush') },
  ];
  return {
    name: 'cloudNine',
    sky: dawnSky(ctx.colors),
    light: { from: 'far', color: '#fff1c9', rim: '#ffffff' },
    fog: { color: mix(ctx.colors.surface, '#eef0fb', 0.5), near: 1200, far: 3000, max: 0.5 },
    veil: 0.2,
    focus: { x: 600, y: 600, z: -swing.d },
    pieces,
    covers: { gate: 'garden', door: 'houseGate', silk: 'organza', card: 'popup' },
    particles: { count: 26, dNear: 700, dFar: 2200 },
  };
};
