import type { ReactNode } from 'react';
import { blend, Metal, onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, MistBand, motif, Water } from '../kit';
import { billboard, floor, hang, sky } from '../planes';
import type { DrawProps, Piece, StageSetFactory } from '../types';

/**
 * T11 · Haridwar Dawn (`haridwar-dawn`, final.md §5.3): the `ghat` stage.
 * Sunrise on the Ganga. The guest glides in over the river through a stone
 * river-gate (the arrival cover) and rests on the water: leaf-cup diya boats
 * float by close (the near layer), two painted rowboats lie moored in the
 * mid-stream mist (the middle layer), and across the water a ghat of broad
 * stone steps climbs from the river to a landing where a whitewashed shrine
 * with a saffron flag stands on the axis of its own stair (the focal point),
 * a bell tower beside it, marigold strings between them, cloth umbrellas on
 * bamboo poles down the steps and rows of aarti diyas along the treads. The
 * low sun rises over the open river at the left and lights every face from
 * that side; above the landing the dharamshalas and the Shivalik hills sink
 * into the morning haze, so the words sit on a calm sky.
 *
 * Set-local pieces (§6.4): GhatFacade (a sky plane at d 2200 drawn in frame
 * coordinates), Rowboat, DiyaBoat. No sky plane: the facade leaves the sky
 * open above its skyline and the set's CSS gradient shows there (the pixel
 * budget counts a sky plane whole).
 */

const url = (id: string) => `url(#${id})`;
const q = Math.round;
const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** A radial glow (hot core, alpha falloff) for small lights drawn inside a piece. */
function Glow({ id, color, a = 0.6 }: { id: string; color: string; a?: number }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={tint(color, 0.6)} stopOpacity={a} />
      <stop offset="0.35" stopColor={color} stopOpacity={a * 0.45} />
      <stop offset="1" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
}

/** Beads along a cubic: a marigold string (alternating orange and yellow blooms on a thread). */
function strand(seg: Segment, n: number, r: number): { thread: string; a: string; b: string } {
  const [p0, c1, c2, p3] = seg;
  const thread = `M${q(p0[0])} ${q(p0[1])}C${q(c1[0])} ${q(c1[1])} ${q(c2[0])} ${q(c2[1])} ${q(p3[0])} ${q(p3[1])}`;
  let a = '';
  let b = '';
  for (let i = 0; i <= n; i++) {
    const pt = onCubic(seg, i / n);
    const dot = `M${r2(pt.x - r)} ${r2(pt.y)}a${r} ${r} 0 1 0 ${r2(2 * r)} 0a${r} ${r} 0 1 0 ${r2(-2 * r)} 0`;
    if (i % 2) a += dot;
    else b += dot;
  }
  return { thread, a, b };
}
const sagged = (x0: number, y0: number, x1: number, y1: number, sag: number): Segment => [
  [x0, y0],
  [x0 + (x1 - x0) / 3, y0 + sag],
  [x1 - (x1 - x0) / 3, y1 + sag],
  [x1, y1],
];

// ─────────────────────────── the ghat (a frame-coordinate plane) ───────────────────────────

/** The water line and the landing (frame y), and the steps between them. */
const WATER_Y = 590;
const LANDING_Y = 474;
const STEPS = 8;
const RISE = (WATER_Y - LANDING_Y) / STEPS;
/** The ghat's left end steps out toward the river, one step at a time. */
const stepLeft = (i: number) => 432 - (i + 1) * 15;
const stepTop = (i: number) => LANDING_Y + i * RISE;
/**
 * The shore is drawn at SHORE scale about (600, WATER_Y): its shrine's flag stays below the words (tagline included)
 * once the rest eye looks up 4°. Everything from the far bank down is drawn in the scaled group; the sun, its halo
 * and the cirrus are in the plain frame.
 */
const SHORE = 0.7;
const toShore = (x: number) => r2(600 + (x - 600) / SHORE);
/** The sun just risen over the open river, half behind the far bank (frame coordinates). */
const SUN = { x: 462, y: 474, r: 27 };
const UMBRELLAS: ReadonlyArray<readonly [number, number]> = [
  [474, 3],
  [788, 2],
  [968, 4],
  [1150, 1],
  [1352, 3],
  [1530, 0],
];

/**
 * GhatFacade: the far shore as one plane, drawn in frame coordinates (1200×800 plus overscan, the frame's origin at
 * content 360, 240). Below the water line it is river, so the water floor and the facade meet in water on every screen;
 * above the horizon everything is hazed toward the morning (quiet behind the words).
 */
function GhatFacade(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const low = p.detail === 'low';
  const salt = 11 + (Math.abs(q(p.seed)) % 83);
  const id = (k: string) => `gh${salt}${k}`;
  const L = p.light.color;
  const rim = p.light.rim;
  const haze = blend(c.background, c.accent, 0.4);
  // Stone: a warm sandstone, its treads catching the sun, its risers in the stone's own shade.
  const stone = blend(c.surface, c.secondary, 0.46);
  const tread = blend(tint(stone, 0.45), L, 0.24);
  const riser = shade(blend(stone, c.primary, 0.2), 0.24);
  const wet = blend(riser, c.text, 0.3);
  const lime = blend(tint(c.surface, 0.5), L, 0.12);
  const limeShade = blend(blend(c.surface, c.accent, 0.75), c.primary, 0.2);
  const saffron = shade(c.primary, 0.12);
  const marigold = blend(n.flame, c.primary, 0.25);
  const marigoldY = blend(n.flame, '#ffe08a', 0.4);
  const skyTone = blend(c.background, c.accent, 0.45);
  // The scaled group's edges, so the steps, the town and the river still reach the frame's overscan.
  const right = toShore(1560);
  const left = toShore(-360);
  const sunX = toShore(SUN.x);

  // Hills: the Shivaliks behind the town (very quiet) and the low far bank across the open river.
  const ridge = (x0: number, y0: number, amp: number, k: number) => {
    let d = `M${x0} ${y0 + 20}L${x0} ${y0}`;
    for (let i = 1; i <= 9; i++) {
      const x = x0 + ((right - x0) * i) / 9;
      d += `L${q(x)} ${q(y0 - amp * (0.3 + 0.7 * rand(i, salt + k)) * Math.min(1, i / 2))}`;
    }
    return `${d}L${right} ${y0 + 20}Z`;
  };
  const hills = ridge(470, 426, 36, 1);
  const bank = `M${left} 441L${left} 432C-240 428 -120 434 0 430C120 426 240 433 330 431C380 430 420 436 470 434L470 441Z`;

  // Dharamshalas behind the landing (quiet: tone-on-tone).
  const blocks: ReadonlyArray<readonly [number, number, number]> = [
    [742, 884, 402],
    [884, 1062, 388],
    [1062, 1240, 406],
    [1240, 1418, 386],
    [1418, 1560, 398],
    [1560, right, 392],
  ];
  const wallA = blend(haze, c.primary, 0.1);
  const wallB = blend(haze, c.secondary, 0.16);
  const winC = blend(haze, c.muted, 0.3);
  let windows = '';
  let cornices = '';
  for (const [x0, x1, top] of blocks) {
    cornices += `M${x0} ${top}h${x1 - x0}v4h${x0 - x1}Z`;
    for (let row = 0; row < 3; row++) {
      const wy = top + 16 + row * 22;
      if (wy + 14 > LANDING_Y - 4) break;
      for (let x = x0 + 12; x + 9 < x1 - 6; x += 22) windows += `M${x} ${wy + 14}v-9a4.5 4.5 0 0 1 9 0v9Z`;
    }
  }

  // The steps: a lit tread over each riser, the ghat's left end stepping out toward the river.
  let treads = '';
  let risers = '';
  let rims = '';
  for (let i = 0; i < STEPS; i++) {
    const y = stepTop(i);
    const x = stepLeft(i);
    const t = r2(1.8 + i * 0.5);
    treads += `M${x} ${r2(y)}H${right}v${t}H${x}Z`;
    risers += `M${x} ${r2(y + t)}H${right}V${r2(y + RISE)}H${x}Z`;
    rims += `M${x} ${r2(y + t)}H${right}`;
  }
  // Pilasters dividing the stairs (the shrine's own stair between 506 and 694).
  const pilasters = [506, 694, 930, 1176, 1420, 1664, 1908];

  // Thin sunrise cirrus, long and level, lit from below (quiet: tone-on-tone with the sky).
  const CIRRUS: ReadonlyArray<readonly [number, number, number]> = [
    [-120, 300, 420],
    [140, 360, 300],
    [520, 250, 360],
    [860, 330, 380],
    [1180, 280, 340],
    [300, 210, 260],
  ];
  const clouds = CIRRUS.map(([x, y, w]) => `M${x} ${y}c${q(w * 0.3)} -5 ${q(w * 0.7)} -6 ${w} -1c-${q(w * 0.35)} 3 -${q(w * 0.7)} 4 -${w} 1Z`).join('');

  // Rows of aarti diyas along two treads.
  const diyas: Array<readonly [number, number]> = [];
  for (const s of low ? [3] : [2, 5]) {
    const y = stepTop(s) + 1;
    for (let x = stepLeft(s) + 10; x < right; x += 23) diyas.push([q(x + (rand(x, salt + s) - 0.5) * 6), q(y)]);
  }
  const flames = diyas.map(([x, y]) => `M${x} ${y}q-1.6 -2.6 0 -5.6q1.6 3 0 5.6Z`).join('');
  const cups = diyas.map(([x, y]) => `M${x - 2.4} ${y}h4.8l-1 1.6h-2.8Z`).join('');

  // Glitter on the open river beneath the sun.
  let glitter = '';
  for (let i = 0; i < (low ? 14 : 30); i++) {
    const f = i / 30;
    const y = 443 + f * f * 150;
    const w = 6 + f * 26 + rand(i, salt + 7) * 14;
    const x = sunX + (rand(i, salt + 8) - 0.5) * (14 + f * 70) - w / 2;
    glitter += `M${q(x)} ${r2(y)}h${q(w)}v${r2(0.8 + f * 1.6)}h${-q(w)}Z`;
  }
  let ripples = '';
  if (!low)
    for (let i = 0; i < 22; i++) {
      const y = 446 + rand(i, salt + 9) * 140;
      const x = left + 20 + rand(i, salt + 10) * (420 - left);
      ripples += `M${q(x)} ${q(y)}h${q(10 + rand(i, salt + 11) * 34)}`;
    }

  // The shrine: a whitewashed nagara shikhara on a moulded plinth, its door lit by the lamp within.
  const sk: Segment = [
    [566, 418],
    [564, 390],
    [579, 362],
    [592, 348],
  ];
  const skL = `M566 418C564 390 579 362 592 348L600 346V418Z`;
  const skR = `M634 418C636 390 621 362 608 348L600 346V418Z`;
  let bands = '';
  for (const t of [0.22, 0.42, 0.6, 0.76, 0.9]) {
    const pt = onCubic(sk, t);
    bands += `M${r2(pt.x)} ${r2(pt.y)}H${r2(1200 - pt.x)}`;
  }
  const ribs = [0.35, 0.7].map((f) => `M${r2(566 + 34 * f)} 418C${r2(568 + 32 * f)} 390 ${r2(582 + 18 * f)} 362 ${r2(593 + 7 * f)} 348`).join('') + [0.35, 0.7].map((f) => `M${r2(634 - 34 * f)} 418C${r2(632 - 32 * f)} 390 ${r2(618 - 18 * f)} 362 ${r2(607 - 7 * f)} 348`).join('');

  // A peepal by the landing's open end, drawn as a miniature painter draws trees: scalloped clumps of leaves,
  // lit from the sun's side, their lower edges ticked with leaf tips.
  const leafHaze = blend(n.leaf, haze, 0.28);
  const leafLit = blend(n.leafLight, blend(haze, L, 0.5), 0.3);
  const leafDeep = blend(n.leafDark, haze, 0.3);
  const limbs = [
    taper([[[515, 474], [517, 460], [511, 448], [508, 432]]], [8, 3.5], 8),
    taper([[[512, 455], [504, 450], [496, 446], [488, 444]]], [3.4, 1.2], 6),
    taper([[[512, 452], [522, 446], [530, 440], [538, 432]]], [3.2, 1.2], 6),
  ].join('');
  const clump = (cx: number, cy: number, W: number, H: number, k: number) => {
    const seg: Segment = [
      [cx - W / 2, cy],
      [cx - W / 2, cy - H * 1.33],
      [cx + W / 2, cy - H * 1.33],
      [cx + W / 2, cy],
    ];
    let d = `M${r2(cx - W / 2)} ${r2(cy)}`;
    for (let i = 1; i <= k; i++) {
      const a0 = onCubic(seg, (i - 1) / k);
      const a1 = onCubic(seg, i / k);
      const r = r2(Math.sqrt((a1.x - a0.x) ** 2 + (a1.y - a0.y) ** 2) * 0.62);
      d += `A${r} ${r} 0 0 1 ${r2(a1.x)} ${r2(a1.y)}`;
    }
    return `${d}Q${r2(cx)} ${r2(cy + H * 0.3)} ${r2(cx - W / 2)} ${r2(cy)}Z`;
  };
  const CLUMPS: ReadonlyArray<readonly [number, number, number, number]> = [
    [484, 450, 34, 13],
    [548, 448, 30, 12],
    [502, 434, 44, 18],
    [534, 430, 40, 17],
    [518, 414, 42, 18],
  ];
  const crownBack = CLUMPS.map(([x, y, w, h]) => clump(x + 2, y + 3, w, h, 7)).join('');
  const crown = CLUMPS.map(([x, y, w, h]) => clump(x, y, w, h, 7)).join('');
  const crownLit = CLUMPS.map(([x, y, w, h]) => clump(x - w * 0.12, y - h * 0.3, w * 0.62, h * 0.6, 5)).join('');
  const tips = low
    ? ''
    : CLUMPS.map(([x, y, w], j) =>
        Array.from({ length: 6 }, (_, i) => {
          const tx = x - w / 2 + 4 + ((w - 8) * (i + rand(i, salt + j) * 0.6)) / 6;
          return `M${q(tx)} ${q(y - 2 + rand(i, salt + j + 5) * 3)}l1.5 3l1.5 -3`;
        }).join(''),
      ).join('');

  // Marigold strings: shrine to bell tower, shrine to the first umbrella, and down the door posts.
  const strings = [
    strand(sagged(643, 420, 703, 406, 16), 14, 1.7),
    strand(sagged(557, 420, 474, 432, 14), 18, 1.7),
    strand(sagged(588, 431, 612, 431, 6), 8, 1.4),
  ];

  // Cloth umbrellas on bamboo poles, each over a wooden takht.
  const umbrella = (x: number, step: number, k: string) => {
    const base = stepTop(step) + 1;
    const top = base - 56;
    const hem = base - 40;
    const half = 38;
    let wedges = '';
    for (let i = 0; i < 8; i += 2) {
      const a = x - half + (i * 2 * half) / 8;
      wedges += `M${x} ${top}L${r2(a)} ${hem}L${r2(a + (2 * half) / 8)} ${hem + 1}Z`;
    }
    let scallop = `M${x - half} ${hem}`;
    for (let i = 0; i < 8; i++) scallop += `q${r2(half / 8)} 5 ${r2(half / 4)} 0`;
    return (
      <g key={k}>
        <path d={`M${x - 10} ${base}h${half + 30}l-6 ${r2(RISE * 0.45)}h-${half + 30}Z`} fill={c.text} opacity={0.1} />
        <path d={`M${x - 15} ${base}h30v-7h-30Z`} fill={blend(c.primary, c.text, 0.55)} />
        <path d={`M${x - 15} ${base - 7}h30v-1.5h-30Z`} fill={blend(c.secondary, L, 0.3)} />
        <path d={`M${x - 1} ${base - 7}V${top + 2}h2V${base - 7}Z`} fill={shade(c.secondary, 0.25)} />
        <path d={`M${x} ${top}L${x - half} ${hem}L${x + half} ${hem + 1}Z`} fill={blend(c.accent, c.background, 0.25)} />
        <path d={wedges} fill={saffron} />
        <path d={`M${x} ${top}L${x + half} ${hem + 1}L${x + 2} ${hem + 1}Z`} fill={c.text} opacity={0.16} />
        <path d={`${scallop}`} fill="none" stroke={c.secondary} strokeWidth={1.4} />
        <path d={`M${x} ${top}L${x - half} ${hem}`} fill="none" stroke={tint(L, 0.3)} strokeWidth={1} opacity={0.8} />
        <path d={`M${x - 1.5} ${top}h3v-4h-3Z`} fill={c.secondary} />
      </g>
    );
  };

  return (
    <Svg w={p.w} h={p.h}>
      <defs>
        <radialGradient id={id('sun')}>
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.55" stopColor={tint(L, 0.55)} />
          <stop offset="1" stopColor={L} />
        </radialGradient>
        <Glow id={id('halo')} color={L} a={0.7} />
        <Glow id={id('dg')} color={n.flame} a={0.75} />
        <radialGradient id={id('warm')}>
          <stop offset="0" stopColor={L} stopOpacity={0.32} />
          <stop offset="0.45" stopColor={L} stopOpacity={0.12} />
          <stop offset="1" stopColor={L} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('river')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={blend(skyTone, L, 0.35)} />
          <stop offset="0.25" stopColor={skyTone} />
          <stop offset="0.45" stopColor={blend(c.primary, c.accent, 0.45)} />
          <stop offset="0.75" stopColor={blend(c.primary, c.text, 0.15)} />
        </linearGradient>
        <linearGradient id={id('door')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(L, 0.5)} />
          <stop offset="1" stopColor={blend(n.flame, c.primary, 0.3)} />
        </linearGradient>
        <Metal id={id('gold')} base={c.secondary} x2={14} y2={14} />
      </defs>
      <g transform="translate(360 240)">
        {/* The sky's sun and the hills (quiet; the sky itself is the set's CSS gradient). */}
        <circle cx={SUN.x} cy={SUN.y} r={130} fill={url(id('halo'))} />
        <circle cx={SUN.x} cy={SUN.y} r={SUN.r} fill={url(id('sun'))} />
        <path d={clouds} fill={tint(L, 0.55)} opacity={0.5} />
        <path d={clouds} fill={blend(c.accent, c.primary, 0.15)} opacity={0.18} transform="translate(6 3)" />
        <g transform={`translate(600 ${WATER_Y}) scale(${SHORE}) translate(-600 -${WATER_Y})`}>
        <path d={hills} fill={blend(haze, c.muted, 0.1)} />
        <path d={ridge(520, 436, 16, 2)} fill={blend(haze, c.muted, 0.16)} />
        <path d={bank} fill={blend(haze, c.muted, 0.24)} />
        {/* The river: open to the horizon at the left, under the steps everywhere. */}
        <rect x={left} y={439} width={r2(right - left)} height={801} fill={url(id('river'))} />
        <path d={glitter} fill={tint(L, 0.45)} opacity={0.85} />
        {ripples ? <path d={ripples} stroke={tint(L, 0.5)} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} /> : null}
        {/* The town behind the landing, sunk into the haze. */}
        {blocks.map(([x0, x1, top], i) => (
          <path key={i} d={`M${x0} ${top}H${x1}V${LANDING_Y}H${x0}Z`} fill={i % 2 ? wallB : wallA} />
        ))}
        <path d={windows} fill={winC} opacity={0.8} />
        <path d={cornices} fill={blend(haze, c.secondary, 0.3)} />
        <path d={`M742 ${LANDING_Y}V402h3V${LANDING_Y}Z`} fill={tint(haze, 0.5)} />
        {/* Chhatri pavilions on the landing. */}
        {[1010, 1296].map((x) => (
          <g key={x}>
            <path d={`M${x - 26} ${LANDING_Y}V436h52V${LANDING_Y}Z`} fill={blend(haze, c.muted, 0.28)} />
            <path d={`M${x - 26} ${LANDING_Y}V436h6V${LANDING_Y}ZM${x - 3} ${LANDING_Y}V436h6V${LANDING_Y}ZM${x + 20} ${LANDING_Y}V436h6V${LANDING_Y}Z`} fill={lime} />
            <path d={`M${x - 30} 436h60v-5h-60Z`} fill={saffron} opacity={0.8} />
            <path d={`M${x - 24} 431a24 20 0 0 1 48 0Z`} fill={lime} />
            <path d={`M${x} 411a24 20 0 0 1 24 20h-24Z`} fill={limeShade} />
            <path d={`M${x - 1} 411v-8h2v8Z`} fill={c.secondary} />
          </g>
        ))}
        {/* Saffron flags on bamboo poles. */}
        {[848, 1458].map((x) => (
          <g key={x}>
            <path d={`M${x} ${LANDING_Y}V372h2V${LANDING_Y}Z`} fill={blend(c.secondary, haze, 0.3)} />
            <path d={`M${x + 2} 372q12 3 22 2q-9 5 -22 12Z`} fill={blend(saffron, haze, 0.25)} />
          </g>
        ))}
        {/* The peepal. */}
        <path d={limbs} fill={blend(c.muted, haze, 0.25)} />
        <path d={crownBack} fill={leafDeep} />
        <path d={crown} fill={leafHaze} />
        <path d={crownLit} fill={leafLit} opacity={0.8} />
        {tips ? <path d={tips} fill="none" stroke={leafDeep} strokeWidth={0.9} /> : null}
        {/* The landing and the steps down to the water. */}
        <path d={`M440 ${LANDING_Y - 5}H${right}V${LANDING_Y}H440Z`} fill={tread} />
        <path d={`M440 ${LANDING_Y - 5}H${right}`} stroke={rim} strokeWidth={1} />
        <path d={treads} fill={tread} />
        <path d={risers} fill={riser} />
        <path d={rims} stroke={shade(riser, 0.3)} strokeWidth={1.6} opacity={0.55} />
        <path d={`M300 ${WATER_Y - RISE * 2}H${right}V${WATER_Y + 6}H300Z`} fill={wet} opacity={0.45} />
        <path d={`M300 ${WATER_Y - 3}H${right}v3H300Z`} fill={tint(L, 0.4)} opacity={0.55} />
        {/* The ghat's sunlit left end. */}
        {Array.from({ length: STEPS }, (_, i) => (
          <path key={i} d={`M${stepLeft(i)} ${r2(stepTop(i))}h4v${r2(RISE)}h-4Z`} fill={tint(L, 0.35)} opacity={0.8} />
        ))}
        {pilasters.map((x) => (
          <g key={x}>
            <path d={`M${x} ${LANDING_Y - 10}h12V${WATER_Y}h-12Z`} fill={tint(stone, 0.3)} />
            <path d={`M${x + 7} ${LANDING_Y - 10}h5V${WATER_Y}h-5Z`} fill={shade(stone, 0.12)} />
            <path d={`M${x - 2} ${LANDING_Y - 13}h16v3h-16Z`} fill={blend(c.secondary, L, 0.2)} />
          </g>
        ))}
        {/* Umbrellas down the steps. */}
        {UMBRELLAS.map(([x, s], i) => umbrella(x, s, `u${i}`))}
        {/* The bell tower. */}
        <path d={`M702 ${LANDING_Y}V384H716V${LANDING_Y}Z`} fill={lime} />
        <path d={`M716 ${LANDING_Y}V384H730V${LANDING_Y}Z`} fill={limeShade} />
        <path d={`M700 430h32v3h-32ZM700 404h32v3h-32ZM700 384h32v3h-32Z`} fill={saffron} opacity={0.85} />
        <path d="M712 452v-8a4 4 0 0 1 8 0v8Z" fill={blend(limeShade, c.muted, 0.35)} />
        <path d="M702 384V362h6V384ZM724 384V362h6V384Z" fill={lime} />
        <path d="M727 384V362h3V384Z" fill={limeShade} />
        <path d="M708 384V370a8 8 0 0 1 16 0V384Z" fill={blend(limeShade, c.muted, 0.45)} />
        <path d="M716 370c-4 0 -5 4 -5 9l-2 2h14l-2 -2c0 -5 -1 -9 -5 -9Z" fill={url(id('gold'))} />
        <path d="M700 362h32v-3h-32Z" fill={saffron} />
        <path d="M702 359a14 12 0 0 1 28 0Z" fill={lime} />
        <path d="M716 347a14 12 0 0 1 14 12h-14Z" fill={limeShade} />
        <path d="M715 347v-7h2v7Z" fill={url(id('gold'))} />
        {/* The shrine: plinth, sanctum, shikhara, amalaka, kalash and flag. */}
        <path d={`M538 ${LANDING_Y}V466H662V${LANDING_Y}Z`} fill={tread} />
        <path d={`M600 ${LANDING_Y}V466H662V${LANDING_Y}Z`} fill={limeShade} opacity={0.5} />
        <path d="M547 466V458H653V466Z" fill={lime} />
        <path d="M600 466V458H653V466Z" fill={limeShade} />
        <path d="M538 466h124v1.4H538ZM547 458h106v1.4H547Z" fill={rim} opacity={0.9} />
        <path d="M556 458V418H600V458Z" fill={lime} />
        <path d="M600 458V418H644V458Z" fill={limeShade} />
        <path d="M554 418h92v4h-92ZM556 452h88v3h-88Z" fill={saffron} />
        <path d="M562 452V425h5V452ZM633 452V425h5V452Z" fill={blend(limeShade, c.secondary, 0.3)} />
        <path d="M585 458V438c0 -8 7 -12 15 -14c8 2 15 6 15 14V458Z" fill={url(id('gold'))} />
        <path d="M589 458V439c0 -6 5 -9 11 -11c6 2 11 5 11 11V458Z" fill={url(id('door'))} />
        <path d="M596 456c0 -3 2 -5 4 -8c2 3 4 5 4 8Z" fill={n.flameCore} />
        {[562, 638].map((x) => (
          <g key={x}>
            <path d={`M${x - 13} 418C${x - 14} 404 ${x - 7} 394 ${x} 389V418Z`} fill={lime} />
            <path d={`M${x + 13} 418C${x + 14} 404 ${x + 7} 394 ${x} 389V418Z`} fill={limeShade} />
            <path d={`M${x - 6} 389a6 2.4 0 0 1 12 0a6 2.4 0 0 1 -12 0Z`} fill={blend(lime, c.secondary, 0.3)} />
            <path d={`M${x - 14} 404h28`} stroke={blend(limeShade, c.secondary, 0.4)} strokeWidth={1} />
          </g>
        ))}
        <path d={skL} fill={lime} />
        <path d={skR} fill={limeShade} />
        <path d={bands} stroke={blend(limeShade, c.secondary, 0.4)} strokeWidth={1.2} />
        <path d={ribs} fill="none" stroke={blend(limeShade, c.muted, 0.2)} strokeWidth={0.9} opacity={0.8} />
        <path d="M566 418C564 390 579 362 592 348" fill="none" stroke={tint(L, 0.5)} strokeWidth={1.4} />
        <path d="M634 418C636 390 621 362 608 348" fill="none" stroke={rim} strokeWidth={1} opacity={0.7} />
        <path d="M592 418L595 350H605L608 418Z" fill={tint(L, 0.5)} opacity={0.35} />
        <path d="M592 403V393a8 9 0 0 1 16 0V403Z" fill={blend(limeShade, c.muted, 0.25)} />
        <path d="M590 404V393a10 11 0 0 1 20 0V404" fill="none" stroke={url(id('gold'))} strokeWidth={1.6} />
        <path d="M596 403v-6a4 4.5 0 0 1 8 0v6Z" fill={blend(n.flame, c.primary, 0.3)} opacity={0.7} />
        <path d="M588 345a12 4.5 0 0 1 24 0a12 4.5 0 0 1 -24 0Z" fill={lime} />
        <path d="M600 340.5a12 4.5 0 0 1 12 4.5a12 4.5 0 0 1 -12 4.5Z" fill={limeShade} />
        <path d="M595.5 341c0 -4 2 -7 4.5 -8c2.5 1 4.5 4 4.5 8Z" fill={url(id('gold'))} />
        <path d="M599.2 333V321h1.6V333Z" fill={shade(c.secondary, 0.2)} />
        {/* Marigold strings. */}
        {strings.map((s, i) => (
          <g key={i}>
            <path d={s.thread} fill="none" stroke={shade(c.secondary, 0.3)} strokeWidth={0.6} />
            <path d={s.a} fill={marigold} />
            <path d={s.b} fill={marigoldY} />
          </g>
        ))}
        {/* Diyas along the treads. */}
        {low
          ? null
          : diyas.map(([x, y], i) => <circle key={i} cx={x} cy={y - 3} r={8} fill={url(id('dg'))} />)}
        <path d={cups} fill={n.clay} />
        <path d={flames} fill={n.flame} />
        {/* A brass aarti lamp on the shrine's axis, half-way down to the water. */}
        <circle cx={600} cy={538} r={18} fill={url(id('dg'))} />
        <path d={`M594 ${q(stepTop(6))}h12l-3 -4h-6ZM599 ${q(stepTop(6)) - 4}V548h2V${q(stepTop(6)) - 4}ZM589 548h22l-3 3h-16ZM596 540h8l-1.5 2.4h-5Z`} fill={url(id('gold'))} />
        <path d="M599.3 542.4V548h1.4V542.4Z" fill={url(id('gold'))} />
        <path d="M591 548q-1.4 -2.4 0 -5q1.4 2.6 0 5ZM595.5 548q-1.4 -2.6 0 -5.4q1.4 2.8 0 5.4ZM600 548q-1.5 -2.8 0 -5.8q1.5 3 0 5.8ZM604.5 548q-1.4 -2.6 0 -5.4q1.4 2.8 0 5.4ZM609 548q-1.4 -2.4 0 -5q1.4 2.6 0 5ZM600 540q-1.6 -3 0 -6.4q1.6 3.4 0 6.4Z" fill={n.flame} />
        </g>
        {/* The low sun's warmth on the near end of the ghat, fading toward the town. */}
        <circle cx={SUN.x} cy={SUN.y + 20} r={520} fill={url(id('warm'))} />
      </g>
    </Svg>
  );
}

/** Pennant: the saffron flag on the shrine's pole, its fly edge cut in a swallowtail. */
function Pennant(p: DrawProps) {
  const c = p.colors;
  return (
    <Svg w={22} h={12}>
      <path d="M0 0.5q11 1 22 3.5l-5 2.5l5 2.5q-11 1.5 -22 3Z" fill={c.primary} />
      <path d="M0 6.5q10 0 22 2.5q-11 1.5 -22 3Z" fill={shade(c.primary, 0.18)} />
      <path d="M0 0.5q11 1 22 3.5" fill="none" stroke={p.light.rim} strokeWidth={0.6} opacity={0.8} />
    </Svg>
  );
}

/**
 * River: the kit's river (its sun path under the sunrise) with the near water deepened, so the stream grounds the
 * frame at rest while the plane still reaches under the far pose's lens (the arrival starts 1100 behind the rest eye).
 */
function River(p: DrawProps) {
  const c = p.colors;
  const g = p.plane;
  // Where the rest view's bottom edge (d 900) and the stream's near end fall along the plane (content top = far).
  const at = (d: number) => (g ? r2((g.dFar - d) / (g.dFar - g.dNear)) : 0.6);
  const id = `rv${q(p.seed)}`;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Water {...p} variant="river" streaks={[{ x: 600, color: blend(c.background, p.light.color, 0.4) }]} />
      <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset={at(1500)} stopColor={blend(c.primary, c.text, 0.2)} stopOpacity={0} />
            <stop offset={at(950)} stopColor={blend(c.primary, c.text, 0.2)} stopOpacity={0.45} />
            <stop offset={at(500)} stopColor={blend(c.primary, c.text, 0.3)} stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <rect width={r2(p.w)} height={r2(p.h)} fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

// ─────────────────────────── boats ───────────────────────────

/** Rowboat: a painted Ganga rowboat moored in the stream, a saffron pennant at the stern. `dir` 1: the prow points right. */
function rowboat(dir: 1 | -1) {
  return function Rowboat(p: DrawProps) {
    const c = p.colors;
    const n = p.nature;
    const X = (x: number) => (dir === 1 ? p.w - x : x);
    const P = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${r2(X((x * p.w) / 260))} ${r2((y * p.h) / 90)}`);
    const id = `rb${q(p.seed)}${dir === 1 ? 'r' : 'l'}`;
    const wood = blend(c.primary, c.text, 0.5);
    const band = c.primary;
    const L = p.light.color;
    // Prow at x 6 (before mirroring), stern at 252.
    const [g0, g1, g2, g3] = P([
      [6, 24],
      [40, 52],
      [200, 56],
      [252, 40],
    ]);
    const [b1, b2, b3, b4, b5, b6] = P([
      [246, 68],
      [212, 82],
      [150, 84],
      [70, 84],
      [34, 82],
      [14, 58],
    ]);
    const [f1, f2] = P([
      [40, 36],
      [200, 34],
    ]);
    const hull = `M${g0}C${g1} ${g2} ${g3}C${b1} ${b2} ${b3}L${b4}C${b5} ${b6} ${g0}Z`;
    const inside = `M${g0}C${g1} ${g2} ${g3}C${f2} ${f1} ${g0}Z`;
    const [s0, s1] = P([
      [8, 30],
      [251, 46],
    ]);
    const [s0c, s1c] = P([
      [42, 58],
      [200, 62],
    ]);
    const stripe = `M${g0}C${g1} ${g2} ${g3}L${s1}C${s1c} ${s0c} ${s0}Z`;
    const planks = [66, 74]
      .map((y) => {
        const [a, m1, m2, b] = P([
          [24, y - 10],
          [60, y + 6],
          [190, y + 4],
          [236, y - 14],
        ]);
        return `M${a}C${m1} ${m2} ${b}`;
      })
      .join('');
    const thwarts = [80, 130, 180]
      .map((x) => {
        const [a, b] = P([
          [x, 52],
          [x + 4, 38],
        ]);
        return `M${a}L${b}`;
      })
      .join('');
    const [pole0, pole1] = P([
      [240, 42],
      [234, 2],
    ]);
    const [fl1, fl2, fl3] = P([
      [234, 3],
      [210, 8],
      [234, 15],
    ]);
    const [o0, o1] = P([
      [60, 46],
      [10, 88],
    ]);
    const garland = strand(
      [
        [X(8), 30],
        [X(18), 44],
        [X(36), 52],
        [X(52), 50],
      ],
      7,
      2.6,
    );
    return (
      <Svg w={p.w} h={p.h}>
        <defs>
          <linearGradient id={`${id}h`} x1={dir === 1 ? '1' : '0'} y1="0" x2={dir === 1 ? '0' : '1'} y2="0">
            <stop offset="0" stopColor={blend(wood, L, 0.15)} />
            <stop offset="1" stopColor={shade(wood, 0.25)} />
          </linearGradient>
          <radialGradient id={`${id}s`}>
            <stop offset="0" stopColor={c.text} stopOpacity={0.3} />
            <stop offset="1" stopColor={c.text} stopOpacity={0} />
          </radialGradient>
        </defs>
        <ellipse cx={r2(p.w / 2)} cy={r2(p.h * 0.94)} rx={r2(p.w * 0.5)} ry={r2(p.h * 0.08)} fill={`url(#${id}s)`} />
        <path d={`M${o0}L${o1}`} stroke={blend(c.secondary, wood, 0.4)} strokeWidth={3} strokeLinecap="round" />
        <path d={inside} fill={shade(wood, 0.4)} />
        <path d={thwarts} stroke={blend(wood, L, 0.2)} strokeWidth={4} />
        <path d={hull} fill={`url(#${id}h)`} />
        <path d={stripe} fill={band} />
        <path d={planks} fill="none" stroke={shade(wood, 0.35)} strokeWidth={1.2} opacity={0.7} />
        <path d={`M${g0}C${g1} ${g2} ${g3}`} fill="none" stroke={c.secondary} strokeWidth={2.2} />
        <path d={`M${g0}C${g1} ${g2} ${g3}`} fill="none" stroke={p.light.rim} strokeWidth={0.8} opacity={0.8} transform="translate(0 -1.4)" />
        <path d={`M${pole0}L${pole1}`} stroke={shade(c.secondary, 0.2)} strokeWidth={2} />
        <path d={`M${fl1}Q${fl2} ${fl3}Z`} fill={c.primary} />
        <path d={garland.a} fill={blend(n.flame, c.primary, 0.25)} />
        <path d={garland.b} fill={blend(n.flame, '#ffe08a', 0.4)} />
        <path d={`M${r2(p.w * 0.1)} ${r2(p.h * 0.95)}h${r2(p.w * 0.25)}M${r2(p.w * 0.55)} ${r2(p.h * 0.97)}h${r2(p.w * 0.3)}`} stroke={tint(L, 0.5)} strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      </Svg>
    );
  };
}

/** DiyaBoat: a leaf-cup (dona) heaped with marigolds, a clay diya burning at its heart. */
function DiyaBoat(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const id = `db${q(p.seed)}`;
  const flame = taper(
    [
      [
        [25, 19],
        [21, 14],
        [24, 8],
        [25.5, 2],
      ],
    ],
    [7, 0.4],
    8,
  );
  const blooms: Array<[number, number, number]> = [
    [13, 23, 4.2],
    [19, 21, 4.4],
    [31, 21, 4.4],
    [37, 23, 4.2],
    [25, 24, 4],
  ];
  return (
    <Svg w={p.w} h={p.h}>
      <defs>
        <Glow id={`${id}g`} color={n.flame} a={0.8} />
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={n.leafLight} />
          <stop offset="1" stopColor={n.leafDark} />
        </linearGradient>
      </defs>
      <circle cx={25} cy={12} r={14} fill={`url(#${id}g)`} />
      <ellipse cx={25} cy={37.5} rx={22} ry={2.5} fill={tint(p.light.color, 0.4)} opacity={0.45} />
      <path d="M3 24Q25 44 47 24Q36 28 25 28Q14 28 3 24Z" fill={`url(#${id}l)`} />
      <path d="M3 24Q14 27 25 27Q36 27 47 24" fill="none" stroke={n.leafLight} strokeWidth={1} />
      {blooms.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? blend(n.flame, c.primary, 0.3) : blend(n.flame, '#ffe08a', 0.35)} />
      ))}
      <path d="M19 21h12l-2 4h-8Z" fill={n.clay} />
      <path d="M19 21h12" stroke={n.clayDark} strokeWidth={1} />
      <path d={flame} fill={n.flame} />
      <path d="M25 19c-1.6 -2 -1 -5 0.4 -8c1 3 1.4 6 -0.4 8Z" fill={n.flameCore} />
    </Svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

/**
 * The far shore's distance: d 2200, p·3.17 (sky() snaps its scale to two decimals, and 3.17 lands exactly here; the
 * pennant below is placed for this depth).
 */
const FACADE_D = 692.82 * 3.17;

export const ghat: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const L = '#ffd6a0';
  const pieces: Piece[] = [];

  // Planes: the river (stopping 10 short of the facade so the two never share an edge) and the far shore.
  pieces.push({
    kind: 'plane',
    id: 'river',
    art: 'water:river',
    role: 'architecture',
    plane: floor({ x0: -1400, x1: 2600, dNear: 40, dFar: 2190 }),
    draw: River,
  });
  pieces.push({ kind: 'plane', id: 'ghat', art: 'ghatFacade', role: 'architecture', plane: sky({ d: FACADE_D }), draw: GhatFacade });

  // Mist lying on the water: one at the foot of the steps, one mid-stream.
  pieces.push({ kind: 'prop', id: 'mist-far', art: 'mistBand:river', role: 'prop', quiet: true, ...billboard({ x: 600, d: 2000, w: 2400, h: 120 }), draw: drawWith(MistBand, { variant: 'river' }), motion: { kind: 'drift', amp: 30, period: 20 }, buildIn: 'fade' });
  pieces.push({ kind: 'prop', id: 'mist-near', art: 'mistBand:river', role: 'prop', quiet: true, ...billboard({ x: 600, d: 1400, w: 2400, h: 120 }), draw: drawWith(MistBand, { variant: 'river' }), motion: { kind: 'drift', amp: 30, period: 26, phase: 0.4 }, buildIn: 'fade' });

  // Two rowboats moored mid-stream, their prows toward the axis.
  pieces.push({ kind: 'prop', id: 'boat-l', art: 'rowboat', role: 'prop', ...billboard({ x: 380, d: 1500, w: 260, h: 90 }), draw: rowboat(1), motion: { kind: 'bob', amp: 2.5, period: 5.5 }, buildIn: 'fade' });
  pieces.push({ kind: 'prop', id: 'boat-r', art: 'rowboat', role: 'prop', ...billboard({ x: 830, d: 1950, w: 260, h: 90 }), draw: rowboat(-1), buildIn: 'fade' });

  // Diya boats drifting toward the guest.
  const DIYAS: ReadonlyArray<readonly [number, number, number]> = [
    [548, 1300, 0],
    [668, 1450, 0.35],
    [470, 1650, 0.7],
    [742, 1880, 0.15],
  ];
  DIYAS.forEach(([x, d, phase], i) => {
    pieces.push({ kind: 'prop', id: `diya-${i}`, art: 'diyaBoat', role: 'prop', ...billboard({ x, d, w: 50, h: 40 }), draw: DiyaBoat, ...(i < 3 ? { motion: { kind: 'bob' as const, amp: i < 2 ? 4 : 3.5, period: 3.4 + i * 0.5, phase } } : {}), buildIn: 'fade' });
  });

  // The shrine's saffron pennant, a piece of its own so it can flutter (lands on the pole drawn in the facade, which the
  // shore's scale moves to frame (600.56, 401.7)).
  {
    const k = 692.82 / 2195;
    const shore = (y: number) => WATER_Y - (WATER_Y - y) * SHORE;
    pieces.push({ kind: 'prop', id: 'pennant', art: 'pennant', role: 'prop', ...hang({ x: 600 + (0.56 + 11 * SHORE) / k, d: 2195, w: (22 * SHORE) / k, h: (12 * SHORE) / k, top: 330 + (shore(321) - 440) / k }), draw: Pennant, motion: { kind: 'flutter', amp: 6, period: 2.4 } });
  }

  // Birds over the river, below the words (placed by their top: they stand on nothing).
  pieces.push({ kind: 'prop', id: 'birds', art: 'birds', role: 'prop', ...hang({ x: 980, d: 1900, w: 300, h: 120, top: 250 }), draw: motif('birds', { tint: blend(c.text, c.muted, 0.4) }), motion: { kind: 'drift', amp: 40, period: 22 } });

  // Lights: the low sun over the open river, the two nearest diyas, the lamp in the shrine's door.
  pieces.push({ kind: 'light', id: 'sun', art: 'sun', role: 'light', at: { x: 22, y: 470, z: -2900 }, r: 340, color: L, strength: 0.55, bloom: true, buildIn: 'light' });
  DIYAS.slice(0, 2).forEach(([x, d, phase], i) => {
    pieces.push({ kind: 'light', id: `diya-glow-${i}`, art: 'glow', role: 'light', at: { x, y: 772, z: -d + 1 }, r: 42, color: '#ffc46a', strength: 0.6, motion: { kind: 'flicker', amp: 0.3, period: 1.7 + i * 0.4, phase }, buildIn: 'light' });
  });
  pieces.push({ kind: 'light', id: 'shrine-lamp', art: 'glow', role: 'light', at: { x: 600, y: 490, z: -2190 }, r: 60, color: '#ffe2a0', strength: 0.5, buildIn: 'light' });

  return {
    name: 'ghat',
    // Sunrise: a pale sky warming to a peach glow on the horizon, brightest over the open river at the left.
    sky: `radial-gradient(ellipse 55% 30% at 22% 55%, ${mix(L, '#ffffff', 0.35)} 0%, ${mix(c.accent, L, 0.5)} 35%, rgba(255, 214, 160, 0) 100%), linear-gradient(180deg, ${mix(c.surface, c.muted, 0.12)} 0%, ${mix(c.background, c.accent, 0.3)} 32%, ${mix(c.accent, L, 0.4)} 52%, ${mix(c.accent, L, 0.55)} 56%, ${mix(c.primary, c.accent, 0.45)} 80%, ${mix(c.primary, c.text, 0.2)} 100%)`,
    light: { from: 'left', color: L, rim: '#fff2dc' },
    fog: { color: '#f6e6d4', near: 1000, far: 3000, max: 0.45 },
    veil: 0.3,
    // Looking up 4°: the shore, its shrine and the sun sit below the words, the sky above them is open.
    poses: { rest: { x: 600, y: 330, z: 0, yaw: 0, pitch: -4, roll: 0, fov: 60 } },
    focus: { x: 600, y: 560, z: -2200 },
    pieces,
    covers: { gate: 'ghat', door: 'temple', silk: 'dawn', card: 'patra' },
    particles: { count: 26, dNear: 700, dFar: 2000 },
  };
};
