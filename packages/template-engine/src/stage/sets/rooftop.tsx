import type { ReactNode } from 'react';
import { blend, metalStops, shade, taper, tint, type Segment } from '../../art/kit';
import { rand, r2 } from '../../art/motifs';
import { mix } from '../../theme';
import { hazedColor } from '../haze';
import { Balustrade, Floor, illus, LightString, motif, Pedestal, Planter, Sky, Wall } from '../kit';
import { aroundEllipse, kitId, Lin, P } from '../kit/architecture';
import { back, billboard, floor, hang, sky, wall } from '../planes';
import type { DrawProps, Fog, Piece, SetContext, StageSetFactory } from '../types';
import { perspectiveOf } from '../units';

/**
 * T06 · Rooftop Ring (`rooftop-ring`, final.md §5.3): the `rooftop` stage.
 *
 * A city rooftop at blue hour. Three strings of fairy lights cross overhead in
 * the crown band; a terrace of pale stone, washed blue by the hour and pooled
 * warm under the lamps, runs between frosted-glass rails to a glass parapet,
 * and beyond it the city drops away: towers against a blush horizon, then a
 * carpet of lit windows and avenues below the eye line. The focal point is a
 * moon gate of roses (set-local `RoseRingArch`) with a curtain of tiny lights
 * inside it, and before it the ring box glowing on a marble pedestal
 * (`RingPedestal`). Potted palms frame the phone's edges, two paper lanterns
 * flank the petal aisle and a champagne table waits to the right.
 */

const FOG: Fog = { color: '#1a2346', near: 1500, far: 3300, max: 0.45 };
const KEY = { from: 'above', color: '#ffd2b0', rim: '#ffe0c8' } as const;

/** Real roses (fixed colours, allowed for real flowers), mixed toward the fog for their distance like NATURE. */
const ROSE = { deep: '#8e2a48', mid: '#d46f8a', pale: '#f6c9d2' } as const;

// ─────────────────────────── the sky: blue hour over a lit city ───────────────────────────

/** Whole-unit path numbers: the city is hundreds of tiny marks, so its markup stays small. */
const n0 = (v: number) => Math.round(v);

/** A dash pattern of `count` lit marks `dash` long with gaps between `gap0` and `gap1`, drawn from the seed. */
function dashes(count: number, dash: number, gap0: number, gap1: number, salt: number): string {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(r2(dash * (0.5 + rand(i, salt) * 1.3)), n0(gap0 + rand(i, salt + 1) * (gap1 - gap0)));
  return out.join(' ');
}

/**
 * The city skyline and the lit city below the horizon, in the sky's 1920×1280 content (horizon at y 680;
 * frame x = content x − 360). Windows are dashed columns and the city's lights dashed rows, so a thousand
 * lights cost a few dozen path commands.
 */
function CityLights({ p }: { p: DrawProps }) {
  const c = p.colors;
  const id = kitId(p, 'rcity');
  const low = p.detail === 'low';
  const HZ = 680;
  // Content x 775–1145 is the phone's story column: towers stay low there (below the names box, frame y ≥ 372).
  const inColumn = (x: number) => x > 740 && x < 1180;
  const skyLow = blend(c.accent, c.background, 0.2);
  const farTone = blend(blend(c.primary, c.muted, 0.45), skyLow, 0.32);
  const sil = blend(c.primary, c.text, 0.35);
  const warm = tint(blend(KEY.color, c.secondary, 0.25), 0.15);
  const cool = tint(blend(c.muted, c.accent, 0.4), 0.25);
  const rect = (x: number, y: number, w: number, h: number) => `M${n0(x)} ${n0(y)}h${n0(w)}v${n0(h)}h${-n0(w)}z`;

  const blocks = (salt: number, minW: number, maxW: number, minH: number, maxH: number, columnH: number) => {
    const out: Array<[number, number, number]> = [];
    for (let x = -10, i = 0; x < 1930; i++) {
      const bw = n0(minW + rand(i, salt) * (maxW - minW));
      const cap = inColumn(x + bw / 2) ? columnH : maxH;
      const bh = n0(minH + rand(i, salt + 1) * (cap - minH));
      out.push([x, bw, bh]);
      x += bw + (rand(i, salt + 2) < 0.2 ? 6 : 0);
    }
    return out;
  };
  const far = blocks(11, 26, 64, 24, 150, 58);
  const mid = blocks(23, 40, 104, 14, 112, 40);
  // Two landmark towers, outside the phone's column (desktops see them): a spire and a mast with a beacon.
  const spire = `M498 ${HZ}V${HZ - 196}l14 -14h22l14 14V${HZ}Z` + `M519 ${HZ - 210}l4 -64l4 64Z` + `M506 ${HZ - 150}h36v6h-36Z`;
  const mast = `M1418 ${HZ}V${HZ - 222}h64V${HZ}Z` + `M1432 ${HZ - 222}l18 -30l18 30Z` + `M1448 ${HZ - 252}h4v-58h-4Z`;
  // Lit windows: a column of floors per window bay, its lit floors set by one of three dash patterns.
  const bays: [string[], string[], string[]] = [[], [], []];
  mid.forEach(([x, bw, bh], i) => {
    if (bh < 26) return;
    const cols = Math.max(1, Math.min(6, Math.floor((bw - 8) / 10)));
    const q = inColumn(x + bw / 2) ? 0.5 : 0.62;
    for (let j = 0; j < cols; j++) {
      const v = rand(i * 7 + j, 41);
      if (v >= q) continue;
      const top = HZ - bh + 7 + Math.floor(rand(i * 7 + j, 43) * 3) * 11;
      if (top > HZ - 10) continue;
      bays[v < q * 0.45 ? 0 : v < q * 0.85 ? 1 : 2].push(`M${n0(x + 8 + j * 10)} ${top}V${HZ - 2}`);
    }
  });
  if (!low) {
    for (const x of [511, 529]) bays[1].push(`M${x} ${HZ - 186}V${HZ - 4}`);
    for (const x of [1428, 1442, 1456, 1470]) bays[x === 1442 ? 0 : 1].push(`M${x} ${HZ - 212}V${HZ - 4}`);
  }

  // The city below the eye line: rows of lights that crowd toward the horizon (dashed rows, three depth bands
  // in three tones), and avenues of light running to it.
  const rows = low ? 18 : 30;
  // Alternate rows take different patterns, so no two neighbouring rows repeat.
  const bands: Array<{ d: string; w: number; s: number; salt: number }> = [];
  for (let b = 0; b < 3; b++) {
    const d = ['', ''];
    let ws = 0;
    let count = 0;
    for (let r = Math.floor((rows * b) / 3); r < Math.floor((rows * (b + 1)) / 3); r++) {
      const f = r / rows;
      d[r % 2] += `M${-n0(rand(r, 77) * 420)} ${r2(HZ + 4 + f * f * 560 + rand(r, 79) * 4)}H1920`;
      ws += 1.6 + f * 4.4;
      count++;
    }
    for (let i = 0; i < 2; i++) bands.push({ d: d[i] ?? '', w: ws / Math.max(1, count), s: 1 + b * 0.9, salt: 81 + b * 11 + i * 5 });
  }

  return (
    <svg viewBox="0 0 1920 1280" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, warm, 0], [0.55, warm, 0.34], [0.62, skyLow, 0.3], [1, warm, 0]]} x1={0} y1={HZ - 170} x2={0} y2={HZ + 120} />
        <Lin id={`${id}b`} stops={[[0, blend(sil, skyLow, 0.38)], [0.18, blend(sil, c.primary, 0.3)], [1, shade(c.primary, 0.35)]]} x1={0} y1={HZ} x2={0} y2={1280} />
        <Lin id={`${id}a`} stops={[[0, warm, 0.05], [1, warm, 0.5]]} x1={0} y1={1280} x2={0} y2={HZ} />
        <Lin id={`${id}d`} stops={[[0, shade(c.primary, 0.5), 0], [0.45, shade(c.primary, 0.5), 0.5], [1, shade(c.primary, 0.55), 0.86]]} x1={0} y1={HZ + 30} x2={0} y2={1280} />
      </defs>
      {/* The city's glow on the haze at the horizon. */}
      <rect x={0} y={HZ - 170} width={1920} height={290} fill={`url(#${id}g)`} />
      <path d={far.map(([x, bw, bh]) => rect(x, HZ - bh, bw + 1, bh + 1)).join('')} fill={farTone} />
      <path d={spire + mast} fill={blend(sil, farTone, 0.25)} />
      <path d={mid.map(([x, bw, bh]) => rect(x, HZ - bh, bw + 1, bh + 1)).join('')} fill={sil} />
      <path d={bays[0].join('')} stroke={warm} strokeWidth={4} strokeDasharray="5 6 5 17 5 6 5 28" opacity={0.7} />
      <path d={bays[1].join('')} stroke={warm} strokeWidth={4} strokeDasharray="5 17 5 6 5 39 5 6" opacity={0.55} />
      {low ? null : <path d={bays[2].join('')} stroke={cool} strokeWidth={4} strokeDasharray="5 28 5 6 5 17" opacity={0.55} />}
      {/* The red beacon on the mast. */}
      <circle cx={1450} cy={HZ - 312} r={4} fill={mix(c.accent, '#ff5a4a', 0.6)} />
      {/* Below the horizon: the city seen from above. */}
      <rect x={0} y={HZ} width={1920} height={600} fill={`url(#${id}b)`} />
      <path d={avenue(260, 900, 26, HZ) + avenue(1180, 980, 30, HZ) + avenue(1880, 1080, 22, HZ)} fill={`url(#${id}a)`} />
      {bands.map((b, i) => (
        <g key={i} fill="none" strokeWidth={r2(b.w * 0.8)}>
          <path d={b.d} stroke={warm} strokeDasharray={dashes(13, b.w * 1.5, 6 * b.s, 52 * b.s, b.salt)} opacity={0.75} />
          <path d={b.d} stroke={cool} strokeDasharray={dashes(8, b.w * 1.2, 30 * b.s, 140 * b.s, b.salt + 2)} strokeDashoffset={n0(40 + i * 37)} opacity={0.6} />
          <path d={b.d} stroke={tint(c.accent, 0.3)} strokeDasharray={dashes(5, b.w * 1.1, 90 * b.s, 300 * b.s, b.salt + 4)} strokeDashoffset={n0(110 + i * 53)} opacity={0.75} />
        </g>
      ))}
      {/* Depth: the streets straight below fall into the dusk, so the lights gather toward the horizon. */}
      <rect x={0} y={HZ + 30} width={1920} height={1250 - HZ} fill={`url(#${id}d)`} />
    </svg>
  );
}

/** An avenue of light from the foot of the view to the horizon. */
function avenue(x0: number, x1: number, wide: number, HZ: number): string {
  const seg: Segment = [
    [x0, 1280],
    [x0 + (x1 - x0) * 0.45, 980],
    [x1 - (x1 - x0) * 0.1, 760],
    [x1, HZ + 3],
  ];
  return taper([seg], [wide, 0.6], 12);
}

/** The blue-hour sky (kit) with a crescent moon and the first stars, and the set's own city. */
function RoofSky(p: DrawProps): ReactNode {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Sky {...p} variant="blueHour" skyline="none" moon="crescent" stars />
      <CityLights p={p} />
    </div>
  );
}

// ─────────────────────────── the terrace ───────────────────────────

/** The terrace (kit) with the hour's blue wash over it and warm lamp pools baked back on top. */
function Terrace(p: DrawProps): ReactNode {
  const g = p.plane ?? { x0: 0, x1: p.w, y0: 800, y1: 800, dNear: 0, dFar: p.h };
  const id = kitId(p, 'rterr');
  const fx = (x: number) => r2(x - g.x0);
  const fy = (d: number) => r2(g.dFar - d);
  const pools: Array<{ x: number; d: number; r: number; a: number }> = [
    { x: 600, d: 1520, r: 240, a: 0.55 },
    { x: 450, d: 1350, r: 120, a: 0.5 },
    { x: 750, d: 1350, r: 120, a: 0.5 },
    { x: 790, d: 1400, r: 90, a: 0.3 },
    { x: 600, d: 1050, r: 340, a: 0.22 },
  ];
  const night = blend(p.colors.primary, p.colors.text, 0.3);
  const runner = blend(p.colors.accent, p.colors.primary, 0.3);
  const metal = blend(p.colors.secondary, KEY.color, 0.25);
  // Petals in drifts along the runner's edges and a few loose on it (round-capped dashes, from the seed).
  const petals = [`M${fx(544)} ${fy(1480)}V${fy(890)}M${fx(657)} ${fy(1470)}V${fy(900)}`, `M${fx(560)} ${fy(1450)}V${fy(1000)}M${fx(640)} ${fy(1440)}V${fy(960)}M${fx(600)} ${fy(1420)}V${fy(1200)}`];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Floor {...p} variant="terrace" pools={[{ x: 600, d: 1560, r: 220, color: KEY.color }]} />
      <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <Lin id={`${id}r`} stops={[[0, runner, 0.3], [1, runner, 0.5]]} x1={0} y1={fy(1480)} x2={0} y2={fy(880)} />
          <Lin id={`${id}n`} stops={[[0, night, 0.4], [1, night, 0.58]]} x1={0} y1={0} x2={0} y2={p.h} />
          <radialGradient id={`${id}p`}>
            <stop offset="0" stopColor={KEY.color} stopOpacity={0.9} />
            <stop offset="0.45" stopColor={KEY.color} stopOpacity={0.32} />
            <stop offset="1" stopColor={KEY.color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={r2(p.w)} height={r2(p.h)} fill={`url(#${id}n)`} />
        {/* The aisle: a blush runner from the near steps to the ring, edged in gold, strewn with rose petals. */}
        <rect x={fx(548)} y={fy(1480)} width={104} height={600} fill={`url(#${id}r)`} />
        <path d={`M${fx(548)} ${fy(1480)}V${fy(880)}M${fx(652)} ${fy(1480)}V${fy(880)}`} stroke={metal} strokeWidth={2.5} opacity={0.75} />
        {petals.map((d, i) => (
          <path key={i} d={d} stroke={i ? ROSE.pale : ROSE.mid} strokeWidth={i ? 9 : 11} strokeLinecap="round" strokeDasharray={dashes(8, 3, 18, 90, 91 + i * 3)} opacity={0.85} fill="none" />
        ))}
        {pools.map((pool, i) => (
          <ellipse key={i} cx={fx(pool.x)} cy={fy(pool.d)} rx={pool.r} ry={pool.r} fill={`url(#${id}p)`} opacity={pool.a} />
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────── RoseRingArch: a moon gate of roses ───────────────────────────

const bump = (t: number, at: number, width: number) => {
  const d = Math.min(Math.abs(t - at), 1 - Math.abs(t - at)) / width;
  return d >= 1 ? 0 : (1 - d * d) * (1 - d * d);
};

/** One rose at the origin, radius 20, as path data per tone: [base, outer petals, cup, petal lines, highlight]. */
function rosePaths(): [string, string, string, string, string] {
  const r = 20;
  return [
    P`M${-r} ${r * 0.08}a${r} ${r * 0.98} 0 1 0 ${2 * r} 0a${r} ${r * 0.98} 0 1 0 ${-2 * r} 0Z`,
    P`M${-r * 0.9} 0a${r * 0.9} ${r * 0.84} 0 1 0 ${1.8 * r} 0a${r * 0.9} ${r * 0.84} 0 1 0 ${-1.8 * r} 0Z`,
    P`M${-r * 0.56} ${-r * 0.14}a${r * 0.56} ${r * 0.5} 0 1 0 ${1.12 * r} 0a${r * 0.56} ${r * 0.5} 0 1 0 ${-1.12 * r} 0Z`,
    P`M${-r * 0.3} ${-r * 0.08}a${r * 0.3} ${r * 0.24} 0 1 1 ${r * 0.5} ${r * 0.1}a${r * 0.18} ${r * 0.15} 0 1 0 ${-r * 0.28} ${-r * 0.1}` +
      P`M${-r * 0.82} ${r * 0.2}q${r * 0.82} ${r * 0.62} ${r * 1.64} 0M${-r * 0.62} ${-r * 0.42}q${r * 0.62} ${-r * 0.3} ${r * 1.24} 0`,
    P`M${-r * 0.52} ${-r * 0.5}q${r * 0.52} ${-r * 0.32} ${r * 1.04} 0q${-r * 0.52} ${-r * 0.12} ${-r * 1.04} 0Z`,
  ];
}

/** A leaf from the origin along +x, 40 long, bowed to +y. */
function leafPath(): string {
  const L = 40;
  const segs: Segment[] = [
    [[0, 0], [L * 0.15, L * 0.054], [L * 0.35, L * 0.108], [L * 0.5, L * 0.18]],
    [[L * 0.5, L * 0.18], [L * 0.68, L * 0.18], [L * 0.86, L * 0.108], [L, 0]],
  ];
  return taper(segs, [1, L * 0.36, 0], 5);
}

/**
 * The focal piece: a circular moon gate (a gold hoop) wreathed in roses, heavy in a crescent from the lower
 * left and again at the upper right, with the hoop showing between; inside it hangs a curtain of tiny lights,
 * warm at the centre, and roses pool on the terrace at its foot. Lit from above: the top of every bloom
 * catches the light. Each bloom and leaf is a `<use>` of one drawn rose and one leaf, placed by a matrix
 * (rotation from the wreath's tangent, so no trigonometry), which keeps a lush wreath light in markup.
 */
function RoseRingArch(p: DrawProps, d: number): ReactNode {
  const { w, h, colors: c, nature: n } = p;
  const id = kitId(p, 'rring');
  const low = p.detail === 'low';
  const k = w / 620;
  const cx = w / 2;
  const R = 196 * k;
  const cy = h - 32 * k - R;
  const Ri = R - 30 * k;
  const fixed = (col: string) => hazedColor(col, FOG, d);
  const tones = [mix(fixed(ROSE.deep), c.secondary, 0.25), mix(fixed(ROSE.mid), c.accent, 0.35), mix(fixed(ROSE.pale), c.accent, 0.4), shade(fixed(ROSE.deep), 0.2), tint(c.accent, 0.5)];
  const ivory = [shade(c.accent, 0.18), tint(c.accent, 0.2), tint(c.accent, 0.55), shade(c.accent, 0.35), n.pearl];
  const at = (x: number, y: number, s: number) => `translate(${n0(x)} ${n0(y)}) scale(${r2(s)})`;
  /** Rotation and scale from a direction (dx, dy), mirrored across it when `flip`. */
  const along = (x: number, y: number, dx: number, dy: number, s: number, flip: boolean) => {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const a = r2((dx / len) * s);
    const b = r2((dy / len) * s);
    return flip ? `matrix(${a} ${b} ${b} ${-a} ${n0(x)} ${n0(y)})` : `matrix(${a} ${b} ${-b} ${a} ${n0(x)} ${n0(y)})`;
  };
  const roses: Array<{ t: string; cream: boolean }> = [];
  const leaves: Array<{ t: string; dark: boolean }> = [];
  const buds: string[] = [];
  const slots = low ? 60 : 88;
  for (let i = 0; i < slots; i++) {
    const t = i / slots;
    const weight = 0.3 + 0.95 * bump(t, 0.9, 0.2) + 0.7 * bump(t, 0.42, 0.13);
    if (rand(i, p.seed + 3) > weight + 0.12) continue;
    const pt = aroundEllipse(cx, cy, R, R, t);
    const ox = (pt.x - cx) / R;
    const oy = (pt.y - cy) / R;
    const off = (rand(i, p.seed + 5) - 0.5) * 34 * k * Math.min(1, weight + 0.2);
    const x = pt.x + ox * off;
    const y = pt.y + oy * off;
    const r = (11 + 15 * Math.min(1, weight) * (0.55 + rand(i, p.seed + 7) * 0.6)) * k;
    // Leaves first (they sit behind the blooms), pointing out of the wreath.
    const side = rand(i, p.seed + 9) < 0.5 ? 1 : -1;
    if (rand(i, p.seed + 15) < 0.75) leaves.push({ t: along(x + ox * r * 0.6, y + oy * r * 0.6, ox * 0.8 + pt.tx * 0.6 * side, oy * 0.8 + pt.ty * 0.6 * side, (r * 1.7) / 40, side < 0), dark: i % 2 === 1 });
    if (weight < 0.45 && rand(i, p.seed + 11) < 0.5) {
      buds.push(P`M${x - r * 0.45} ${y}a${r * 0.45} ${r * 0.55} 0 1 0 ${r * 0.9} 0a${r * 0.45} ${r * 0.55} 0 1 0 ${-r * 0.9} 0Z`);
      continue;
    }
    roses.push({ t: at(x, y, r / 20), cream: rand(i, p.seed + 13) < 0.3 });
  }
  // Roses pooled at the gate's foot, spilling left (the heavy side) and a little right.
  const pool = low ? 7 : 11;
  const leftCount = low ? 5 : 8;
  for (let i = 0; i < pool; i++) {
    const left = i < leftCount;
    const x = left ? cx - 150 * k - i * 26 * k + rand(i, 31) * 12 * k : cx + 120 * k + (i - leftCount) * 28 * k;
    const y = h - 14 * k - rand(i, 33) * 16 * k;
    const r = (13 + rand(i, 35) * 8) * k;
    leaves.push({ t: along(x, y, left ? -0.9 : 0.9, -0.3, (r * 1.8) / 40, false), dark: i % 2 === 0 });
    roses.push({ t: at(x, y, r / 20), cream: i % 3 === 1 });
  }

  // The curtain of lights inside the hoop: strands whose bulbs are round-capped dashes.
  let strands = '';
  for (let j = -6; j <= 6; j++) {
    const dx = j * 26 * k;
    if (Math.abs(dx) >= Ri - 8 * k) continue;
    const half = Math.sqrt(Ri * Ri - dx * dx);
    strands += P`M${cx + dx} ${cy - half + 6 * k}V${cy + half * (0.35 + 0.45 * rand(j + 9, 41))}`;
  }

  const gold = metalStops(c.secondary);
  const ring = (rr: number) => P`M${cx - rr} ${cy}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0Z`;
  const rose = rosePaths();
  const drawRose = (key: string, t: string[]) => (
    <g id={key}>
      <path d={rose[0]} fill={t[0]} />
      <path d={rose[1]} fill={t[1]} />
      <path d={rose[2]} fill={t[2]} />
      <path d={rose[3]} fill="none" stroke={t[3]} strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />
      {low ? null : <path d={rose[4]} fill={t[4]} opacity={0.55} />}
    </g>
  );
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}m`} gradientUnits="userSpaceOnUse" x1={r2(cx - R)} y1={r2(cy - R)} x2={r2(cx + R)} y2={r2(cy + R)}>
          {gold.map(([o, col], i) => (
            <stop key={i} offset={o} stopColor={col} />
          ))}
        </linearGradient>
        <radialGradient id={`${id}l`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={KEY.rim} stopOpacity={0.62} />
          <stop offset="0.55" stopColor={KEY.color} stopOpacity={0.2} />
          <stop offset="1" stopColor={KEY.color} stopOpacity={0} />
        </radialGradient>
        <Lin id={`${id}s`} stops={[[0, '#000000', 0], [0.55, '#000000', 0], [1, '#000000', 0.28]]} x1={0} y1={cy - R} x2={0} y2={h} />
        <path id={`${id}f`} d={leafPath()} />
        {drawRose(`${id}b`, tones)}
        {drawRose(`${id}c`, ivory)}
      </defs>
      {/* Warm light inside the gate, then the curtain of lights: wire, halo, bulb. */}
      <ellipse cx={r2(cx)} cy={r2(cy)} rx={r2(Ri)} ry={r2(Ri)} fill={`url(#${id}l)`} />
      <path d={strands} stroke={blend(c.secondary, c.text, 0.3)} strokeWidth={r2(0.8 * k)} opacity={0.6} />
      {low ? null : <path d={strands} stroke={KEY.rim} strokeWidth={r2(9 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(20 * k)}`} strokeDashoffset={r2(-4 * k)} opacity={0.16} />}
      <path d={strands} stroke={n.flameCore} strokeWidth={r2(3.6 * k)} strokeLinecap="round" strokeDasharray={`0 ${r2(20 * k)}`} strokeDashoffset={r2(-4 * k)} />
      {/* The gold hoop: a broad band between two fine rings, its feet set in a low plinth. */}
      <path d={ring(R + 12 * k)} fill="none" stroke={`url(#${id}m)`} strokeWidth={r2(2.4 * k)} opacity={0.85} />
      <path d={ring(R)} fill="none" stroke={`url(#${id}m)`} strokeWidth={r2(10 * k)} />
      <path d={ring(R - 11 * k)} fill="none" stroke={`url(#${id}m)`} strokeWidth={r2(1.6 * k)} opacity={0.7} />
      <path d={P`M${cx - 74 * k} ${h}L${cx - 58 * k} ${h - 28 * k}H${cx + 58 * k}L${cx + 74 * k} ${h}Z`} fill={`url(#${id}m)`} />
      {leaves.map((l, i) => (
        <use key={`l${i}`} href={`#${id}f`} transform={l.t} fill={l.dark ? n.leafDark : n.leaf} />
      ))}
      <path d={buds.join('')} fill={tones[1]} />
      {roses.map((r, i) => (
        <use key={`r${i}`} href={`#${id}${r.cream ? 'c' : 'b'}`} transform={r.t} />
      ))}
      {/* Lit from above: the lower blooms fall into shade. */}
      <rect x={0} y={r2(cy - R)} width={r2(w)} height={r2(h - cy + R)} fill={`url(#${id}s)`} />
    </svg>
  );
}

// ─────────────────────────── RingPedestal: the ring box on marble ───────────────────────────

/** An open ring box in rose velvet, ivory satin in the lid, a solitaire standing in the slot with its sparkle. */
function RingBox({ p }: { p: DrawProps }) {
  const c = p.colors;
  const id = kitId(p, 'rbox');
  const velvet = blend(mix(c.secondary, ROSE.deep, 0.45), c.primary, 0.12);
  const satin = tint(c.accent, 0.45);
  return (
    <svg viewBox="22 46 84 94" preserveAspectRatio="xMidYMax meet" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}v`} stops={[[0, shade(velvet, 0.15)], [0.35, tint(velvet, 0.12)], [1, shade(velvet, 0.25)]]} x1={34} x2={94} />
        <Lin id={`${id}s`} stops={[[0, tint(satin, 0.4)], [1, shade(satin, 0.12)]]} x1={0} y1={60} x2={0} y2={104} />
        <Lin id={`${id}g`} stops={metalStops(c.secondary).map(([o, col]) => [o, col] as const)} x1={50} y1={80} x2={78} y2={104} />
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor={KEY.rim} stopOpacity={0.85} />
          <stop offset="1" stopColor={KEY.rim} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* The lid, open back, lined in satin. */}
      <path d="M35 104L39 60Q64 55 89 60L93 104Z" fill={`url(#${id}v)`} />
      <path d="M40 101L43 65Q64 61 85 65L88 101Z" fill={`url(#${id}s)`} />
      {/* The body and its cushion slot. */}
      <rect x={32} y={102} width={64} height={34} rx={4} fill={`url(#${id}v)`} />
      <path d="M32 106H96" stroke={tint(velvet, 0.35)} strokeWidth={1.2} />
      <ellipse cx={64} cy={104} rx={27} ry={5} fill={shade(velvet, 0.4)} />
      {/* The solitaire. */}
      <ellipse cx={64} cy={92} rx={11.5} ry={11} fill="none" stroke={`url(#${id}g)`} strokeWidth={3.4} />
      <circle cx={64} cy={74} r={16} fill={`url(#${id}h)`} />
      <path d="M57 77L60 72H68L71 77L64 85Z" fill={p.nature.pearl} />
      <path d="M57 77H71M60 72L64 77L68 72M64 77V85" fill="none" stroke={tint(c.accent, 0.2)} strokeWidth={0.7} />
      <path d="M64 58V92M48 75H80M58.5 69.5L69.5 80.5M69.5 69.5L58.5 80.5" stroke={p.nature.ivory} strokeWidth={1.1} strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

function RingPedestal(p: DrawProps): ReactNode {
  return <Pedestal {...p} variant="marble" top={<RingBox p={p} />} />;
}

// ─────────────────────────── the champagne table ───────────────────────────

/** A marble bistro table on a brass stem with the champagne (illustration) on it. */
function ChampagneTable(p: DrawProps): ReactNode {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'rtab');
  const marble = blend(c.surface, c.background, 0.4);
  const topY = h * 0.52;
  const bottle = illus('champagne', 'secondary', { foil: true });
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <Lin id={`${id}m`} stops={metalStops(c.secondary).map(([o, col]) => [o, col] as const)} x1={w * 0.4} x2={w * 0.6} />
        </defs>
        <path d={P`M${w * 0.47} ${topY + 6}H${w * 0.53}V${h - 8}H${w * 0.47}Z`} fill={`url(#${id}m)`} />
        <path d={P`M${w * 0.24} ${h}Q${w * 0.5} ${h - 14} ${w * 0.76} ${h}Z`} fill={`url(#${id}m)`} />
        <ellipse cx={r2(w / 2)} cy={r2(topY)} rx={r2(w * 0.46)} ry={r2(w * 0.08)} fill={tint(marble, 0.25)} />
        <path d={P`M${w * 0.04} ${topY}A${w * 0.46} ${w * 0.08} 0 0 0 ${w * 0.96} ${topY}V${topY + 5}A${w * 0.46} ${w * 0.08} 0 0 1 ${w * 0.04} ${topY + 5}Z`} fill={`url(#${id}m)`} />
      </svg>
      <div style={{ position: 'absolute', left: '6%', right: '6%', top: 0, height: `${r2((topY / h) * 100 + 2)}%` }}>{bottle({ ...p, w: w * 0.88, h: topY + h * 0.02 })}</div>
    </div>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const rooftop: StageSetFactory = (ctx: SetContext) => {
  const c = ctx.colors;
  const skyCss = `linear-gradient(180deg, ${blend(c.primary, c.text, 0.45)} 0%, ${blend(c.primary, c.muted, 0.3)} 48%, ${blend(c.accent, c.primary, 0.55)} 55%, ${shade(c.primary, 0.3)} 70%, ${shade(c.primary, 0.45)} 100%)`;
  const pieces: Piece[] = [
    // Planes (5): the sky and its city, the terrace, the glass parapet across the far end and the glass rails down the sides.
    { kind: 'plane', id: 'sky', art: 'sky:blueHour', role: 'sky', plane: sky({ d: perspectiveOf(60) * 4.76 }), draw: RoofSky },
    { kind: 'plane', id: 'terrace', art: 'floor:terrace', role: 'architecture', plane: floor({ x0: 200, x1: 1000, dNear: 850, dFar: 2600 }), draw: Terrace },
    { kind: 'plane', id: 'parapet', art: 'balustrade:glass', role: 'architecture', plane: back({ x0: 200, x1: 1000, yTop: 640, d: 2400 }), draw: (p) => <Balustrade {...p} variant="glass" /> },
    { kind: 'plane', id: 'rail-left', art: 'wall:glassRail', role: 'architecture', plane: wall('left', { x: 200, yTop: 640, dNear: 900, dFar: 2400 }), draw: (p) => <Wall {...p} variant="glassRail" /> },
    { kind: 'plane', id: 'rail-right', art: 'wall:glassRail', role: 'architecture', plane: wall('right', { x: 1000, yTop: 640, dNear: 900, dFar: 2400 }), draw: (p) => <Wall {...p} variant="glassRail" /> },

    // The crown band: three strings of fairy lights overhead, twinkling in a travelling wave.
    { kind: 'prop', id: 'string-near', art: 'lightString:fairy', role: 'hanging', ...hang({ x: 600, d: 650, w: 900, h: 140, top: -120 }), draw: (p) => <LightString {...p} variant="fairy" />, motion: { kind: 'twinkle', amp: 0.5, period: 2.4, phase: 0 }, buildIn: 'drop' },
    { kind: 'prop', id: 'string-mid', art: 'lightString:fairy', role: 'hanging', ...hang({ x: 600, d: 900, w: 900, h: 160, top: -270 }), draw: (p) => <LightString {...p} variant="fairy" />, motion: { kind: 'twinkle', amp: 0.5, period: 2.4, phase: 0.33 }, buildIn: 'drop' },
    { kind: 'prop', id: 'string-far', art: 'lightString:fairy', role: 'hanging', ...hang({ x: 600, d: 1250, w: 900, h: 150, top: -470 }), draw: (p) => <LightString {...p} variant="fairy" />, motion: { kind: 'twinkle', amp: 0.5, period: 2.4, phase: 0.66 }, buildIn: 'drop' },

    // The corridor: potted palms at the phone's edges, paper lanterns flanking the petal aisle, the champagne table.
    { kind: 'prop', id: 'palm-left', art: 'planter:palm', role: 'prop', ...billboard({ x: 340, d: 1000, w: 160, h: 330 }), draw: (p) => <Planter {...p} plant="palm" />, buildIn: 'rise' },
    { kind: 'prop', id: 'palm-right', art: 'planter:palm', role: 'prop', ...billboard({ x: 860, d: 1000, w: 160, h: 330 }), draw: (p) => <Planter {...p} plant="palm" />, buildIn: 'rise' },
    { kind: 'prop', id: 'lantern-left', art: 'lantern', role: 'prop', ...billboard({ x: 450, d: 1350, w: 50, h: 90 }), draw: motif('lantern', { tint: 'secondary' }), motion: { kind: 'flicker', amp: 0.35, period: 1.7, phase: 0.2 } },
    { kind: 'prop', id: 'lantern-right', art: 'lantern', role: 'prop', ...billboard({ x: 750, d: 1350, w: 50, h: 90 }), draw: motif('lantern', { tint: 'secondary' }), motion: { kind: 'flicker', amp: 0.35, period: 1.9, phase: 0.65 } },
    { kind: 'prop', id: 'champagne', art: 'champagne', role: 'prop', ...billboard({ x: 790, d: 1400, w: 110, h: 200 }), draw: ChampagneTable, detail: 'high', buildIn: 'rise' },

    // The focal: the ring box on its pedestal before the moon gate of roses.
    { kind: 'prop', id: 'ring-pedestal', art: 'ringPedestal', role: 'prop', ...billboard({ x: 600, d: 1520, w: 135, h: 270 }), draw: RingPedestal, buildIn: 'rise' },
    { kind: 'prop', id: 'rose-ring', art: 'roseRingArch', role: 'focal', ...billboard({ x: 600, d: 1700, w: 477, h: 362 }), draw: (p) => RoseRingArch(p, 1700), buildIn: 'bloom' },

    // Lights: the ring's glow (with bloom) and the two lanterns.
    { kind: 'light', id: 'ring-glow', art: 'glow', role: 'light', at: { x: 600, y: 560, z: -1520 }, r: 90, color: '#ffe0c8', strength: 0.7, bloom: true, motion: { kind: 'pulse', amp: 0.4, period: 3 }, buildIn: 'bloom' },
    { kind: 'light', id: 'lantern-glow-left', art: 'glow', role: 'light', at: { x: 450, y: 770, z: -1350 }, r: 46, color: '#ffd2b0', strength: 0.6, motion: { kind: 'flicker', amp: 0.5, period: 1.7, phase: 0.2 }, buildIn: 'light' },
    { kind: 'light', id: 'lantern-glow-right', art: 'glow', role: 'light', at: { x: 750, y: 770, z: -1350 }, r: 46, color: '#ffd2b0', strength: 0.6, motion: { kind: 'flicker', amp: 0.5, period: 1.9, phase: 0.65 }, buildIn: 'light' },
  ];
  return {
    name: 'rooftop',
    sky: skyCss,
    light: { ...KEY },
    fog: FOG,
    veil: 0.35,
    focus: { x: 600, y: 620, z: -1650 },
    pieces,
    covers: { gate: 'lane', door: 'ballroom', silk: 'organza', card: 'trifold' },
    particles: { count: 28, dNear: 700, dFar: 2400 },
  };
};
