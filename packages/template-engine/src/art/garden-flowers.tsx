import type { ReactNode } from 'react';
import { blend, hex, onCubic, shade, taper, tint, useSafeId, type IllustrationProps, type Segment } from './kit';
import { r2, rand } from './motifs';

/**
 * Garden flowers (The Sacred Garden): soft vintage watercolour botanicals. Blush and cream peonies
 * with ruffled petals and a warm heart, peach and cream garden roses, closed rose buds, small white
 * blossoms, sage leaves and fine tendrils. Petals, leaves, buds and blossoms are drawn once
 * (prototypes in <defs>, shaped by rand()) and placed with <use>, so a lush corner stays light. Real
 * flowers keep their own colours; the tint is the leaves' main green and the other greens are mixed
 * from it. Only arithmetic and square roots (no trigonometry), so server and browser agree.
 */

const r0 = Math.round;
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Compact numbers for transforms: two decimals, no leading zero. */
const n2 = (n: number) => `${r2(n)}`.replace(/^(-?)0\./, '$1.');
/** A prototype point: prototypes are drawn about 100 long, so whole units are finer than a hair. */
const pt = (x: number, y: number) => `${r0(x)} ${r0(y)}`;
type XY = readonly [number, number];

/** A smooth curve through points (Catmull-Rom as cubic Béziers) from the first, which is the current point, to the last. */
function through(p: readonly XY[]): string {
  let d = '';
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[i + 2] ?? c;
    d += `C${pt(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6)} ${pt(c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6)} ${pt(c[0], c[1])}`;
  }
  return d;
}

// ─────────────────────────── Colours ───────────────────────────

/** A flower's colours: the petal rim (nearly white), body, base, the shade between petals, and the heart (deepest fold, colour, lit frills). */
interface Tone {
  rim: string;
  body: string;
  base: string;
  deep: string;
  heart: readonly [string, string, string];
}

/** Natural flower colours (they stay put whatever the palette). */
export const GARDEN_TONES = {
  cream: { rim: '#fffbf4', body: '#f8ecd9', base: '#ecd6b6', deep: '#d3b08a', heart: ['#c4636a', '#e38d86', '#f6c5b6'] },
  blush: { rim: '#fcebe4', body: '#f4d0c4', base: '#e8b0a2', deep: '#cc887b', heart: ['#ad4f5a', '#d47676', '#efb1a4'] },
  peach: { rim: '#fff1e4', body: '#f9d9be', base: '#f0bd98', deep: '#d99772', heart: ['#c46a58', '#e29275', '#f7caa9'] },
  pink: { rim: '#fcebec', body: '#f2c6ca', base: '#e4a2ab', deep: '#c47585', heart: ['#a84e62', '#cf7184', '#eeb0b8'] },
} as const satisfies Record<string, Tone>;
export type GardenTone = keyof typeof GARDEN_TONES;

/** The leaves' greens, all mixed from the tint: [lit half, shaded half] pairs (sage, deeper sage, grey-green, olive, pale), the stems and the sepals. */
function greens(color: string) {
  const g = hex(color);
  const grey = blend(g, '#93a39b', 0.38);
  const olive = blend(g, '#aaa45a', 0.32);
  return {
    pairs: [
      [tint(g, 0.16), shade(g, 0.07)],
      [g, shade(g, 0.17)],
      [tint(grey, 0.1), shade(grey, 0.1)],
      [tint(olive, 0.16), shade(olive, 0.04)],
      [tint(g, 0.36), tint(g, 0.2)],
    ] as const,
    stem: blend(shade(g, 0.2), '#7a6a4a', 0.22),
    sepal: shade(g, 0.1),
  };
}
type Greens = ReturnType<typeof greens>;

// ─────────────────────────── Petals ───────────────────────────

interface PetalSpec {
  /** Half-width at the shoulders (the petal is 100 long). */
  w: number;
  /** How high the shoulders (the widest point) sit. */
  sh: number;
  /** Segments along the crown. */
  n: number;
  /** How likely a joint is a notch, and how deep notches cut. */
  notch: number;
  cut: number;
  /** How far the crown undulates between joints. */
  wave: number;
  /** Half-width of a broad round base (a cupped petal seen from outside); 0 for a pointed one. */
  b: number;
  /** A rose petal's rolled point at the middle of the crown (n even). */
  tip?: boolean;
  seed: number;
}

/**
 * A petal drawn 100 long pointing up from its base at the origin: a dome from shoulder to shoulder
 * through the tip (the rational circle, so no trigonometry), its joints notched (a sharp cut),
 * smooth with a soft undulation, or rolled to a point. Returns the outline, the crown alone (for
 * the light along its edge) and three veins.
 */
function petal({ w, sh, n, notch, cut, wave, b, tip, seed }: PetalSpec) {
  const peak = (rand(seed, 1) - 0.5) * w * 0.3;
  const wl = w * (0.9 + rand(seed, 2) * 0.2);
  const wr = w * (0.9 + rand(seed, 3) * 0.2);
  const y0 = -sh;
  const rise = 100 - sh;
  const domeAt = (s: number) => {
    const q = 1 + s * s;
    const span = s < 0 ? wl + peak : wr - peak;
    const dx = ((2 * (1 - s * s)) / (q * q)) * span;
    const dy = ((4 * s) / (q * q)) * rise;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: peak + ((2 * s) / q) * span, y: y0 - ((1 - s * s) / q) * rise, tx: dx / len, ty: dy / len };
  };
  const knots = Array.from({ length: n + 1 }, (_, k) => {
    const inner = k > 0 && k < n;
    const point = !!tip && 2 * k === n;
    const d = domeAt(-1 + (2 * k) / n + (inner && !point ? (rand(seed + k, 4) - 0.5) * (0.6 / n) : 0));
    const cutHere = inner && !point && rand(seed + k, 5) < notch;
    const depth = cutHere ? cut * (0.6 + rand(seed + k, 6) * 0.8) : point ? -6 : 0;
    // The outward normal of a crown running left to right over the top is (ty, -tx).
    return { ...d, x: d.x - d.ty * depth, y: d.y + d.tx * depth, cut: cutHere, point };
  });
  let crown = '';
  for (let k = 0; k < n; k++) {
    const a = knots[k]!;
    const z = knots[k + 1]!;
    const d = Math.sqrt((z.x - a.x) * (z.x - a.x) + (z.y - a.y) * (z.y - a.y)) / 3;
    const bulge = wave * (0.2 + rand(seed + k, 7));
    // Out of a notch the edge leaves outward and into one it dives in; at a point it turns sharply.
    const ka = bulge + (a.cut ? d * 1.1 : 0) - (a.point ? d * 0.5 : 0);
    const kz = bulge + (z.cut ? d * 1.1 : 0) - (z.point ? d * 0.5 : 0);
    crown += `C${pt(a.x + a.tx * d + a.ty * ka, a.y + a.ty * d - a.tx * ka)} ${pt(z.x - z.tx * d + z.ty * kz, z.y - z.ty * d - z.tx * kz)} ${pt(z.x, z.y)}`;
  }
  const left = `M${pt(-b, 0)}C${pt(-b - (wl - b) * 0.6, y0 * 0.06)} ${pt(-wl, y0 * 0.55)} ${pt(-wl, y0)}`;
  const right = `C${pt(wr, y0 * 0.55)} ${pt(b + (wr - b) * 0.6, y0 * 0.06)} ${pt(b, 0)}`;
  const bottom = b > 0 ? `C${pt(b * 0.9, b * 0.7)} ${pt(-b * 0.9, b * 0.7)} ${pt(-b, 0)}` : '';
  let veins = '';
  for (const s of [-0.55, 0, 0.55]) {
    const d = domeAt(s);
    veins += `M${pt(d.x * 0.1, -8)}Q${pt(d.x * 0.5, d.y * 0.45)} ${pt(d.x * 0.92, d.y * 0.84)}`;
  }
  return { d: `${left}${crown}${right}${bottom}Z`, crown: `M${pt(-wl, y0)}${crown}`, veins };
}

/** The petal shapes every flower is built from. */
const PETALS = {
  // Peony guard petals: broad, notched now and then.
  g: { w: 46, sh: 54, n: 5, notch: 0.45, cut: 7, wave: 2.5, b: 0, seed: 3 },
  h: { w: 42, sh: 58, n: 4, notch: 0.5, cut: 9, wave: 3, b: 0, seed: 12 },
  // The peony cup's inner wall.
  w: { w: 40, sh: 58, n: 4, notch: 0.4, cut: 6, wave: 2, b: 0, seed: 23 },
  // The peony cup's front, seen from outside: broad shoulders, a low wavy rim, a narrow base.
  c: { w: 48, sh: 62, n: 4, notch: 0.45, cut: 5, wave: 2.5, b: 9, seed: 31 },
  // The peony heart's crumpled frills.
  f: { w: 30, sh: 46, n: 5, notch: 0.8, cut: 16, wave: 5, b: 0, seed: 44 },
  // Garden rose: outer petals rolled to a point, and smooth cupped petals.
  o: { w: 50, sh: 56, n: 2, notch: 0, cut: 0, wave: 1.5, b: 0, tip: true, seed: 53 },
  r: { w: 46, sh: 60, n: 3, notch: 0.15, cut: 4, wave: 1.2, b: 8, seed: 61 },
} as const satisfies Record<string, PetalSpec>;
type PetalKey = keyof typeof PETALS;
const PEONY_PETALS: readonly PetalKey[] = ['g', 'h', 'w', 'c', 'f'];
const ROSE_PETALS: readonly PetalKey[] = ['o', 'r'];

/** The prototypes: each petal's outline (painted by the <use>), veins on the broad ones (currentColor) and the light along a cup petal's crown. */
function PetalDefs({ id, keys }: { id: string; keys: readonly PetalKey[] }) {
  return (
    <>
      {keys.map((key) => {
        const { d, crown, veins } = petal(PETALS[key]);
        return (
          <g key={key} id={`${id}${key}`}>
            <path d={d} />
            {key === 'g' || key === 'h' || key === 'o' ? <path d={veins} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.28" /> : null}
            {key === 'c' || key === 'w' || key === 'r' || key === 'o' ? <path d={crown} fill="none" stroke="#fff" strokeWidth="3" opacity="0.6" transform="translate(0 2.5)" /> : null}
          </g>
        );
      })}
      {keys.includes('r') ? (
        // A heart petal standing edge-on, seen from above: a crescent along the top of its ring (radius 10), lit along its rim.
        <g id={`${id}q`}>
          <path d="M-9.1 -4.2C-7 -10.6 7 -10.6 9.1 -4.2C6 -7.2 -6 -7.2 -9.1 -4.2Z" />
          <path d="M-7.4 -6.2C-5 -9.4 5 -9.4 7.4 -6.2" fill="none" stroke="#fff" strokeWidth=".8" opacity="0.6" />
        </g>
      ) : null}
    </>
  );
}

/** One tone's gradients (those in `keys`), along each petal from its base (0) to its crown (1). */
function ToneDefs({ id, k, t, keys = 'omwh' }: { id: string; k: string; t: Tone; keys?: string }) {
  const stops: Record<string, ReadonlyArray<readonly [number, string]>> = {
    // Petals in the light, and in shade.
    o: [
      [0, t.deep],
      [0.45, t.body],
      [1, t.rim],
    ],
    m: [
      [0, t.deep],
      [0.55, t.base],
      [1, t.body],
    ],
    // The cup's inner wall, warm from the heart.
    w: [
      [0, t.heart[1]],
      [0.55, t.base],
      [1, t.rim],
    ],
    // A bud's wrapping petal, lighter than the bud.
    f: [
      [0, t.base],
      [0.4, t.body],
      [1, t.rim],
    ],
    // The heart's frills.
    h: [
      [0, t.heart[0]],
      [0.6, t.heart[1]],
      [1, t.heart[2]],
    ],
  };
  return (
    <>
      {[...keys].map((key) => (
        <linearGradient key={key} id={`${id}${k}${key}`} y1="1" x2="0">
          {(stops[key] ?? []).map(([o, c], i) => (
            <stop key={i} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      ))}
    </>
  );
}

/** [angle (0° points up, away from the viewer), length, width, petal, shaded, lift] for a ring of petals, back to front. */
type RingPetal = readonly [number, number, number, PetalKey, 0 | 1, number];
/** [x, y, angle, length, width (negative: mirrored)] for a cup petal. */
type CupPetal = readonly [number, number, number, number, number];

const ring = (id: string, petals: readonly RingPetal[], seed: number, shaded: string) =>
  petals.map(([a, len, wid, p, dark, lift], i) => (
    <use
      key={i}
      href={`#${id}${p}`}
      fill={dark ? shaded : undefined}
      transform={`${lift ? `translate(0 ${lift})` : ''}rotate(${r0(a + (rand(i, seed) - 0.5) * 8)})scale(${n2(wid * (i % 2 ? -1 : 1) * (0.94 + rand(i, seed + 1) * 0.12))} ${n2((len * (0.94 + rand(i, seed + 2) * 0.1)) / 100)})`}
    />
  ));

const cup = (id: string, p: PetalKey, petals: readonly CupPetal[]) =>
  petals.map(([x, y, a, len, wid], i) => <use key={i} href={`#${id}${p}`} transform={`translate(${x} ${y})rotate(${a})scale(${n2(wid)} ${n2(len / 100)})`} />);

// ─────────────────────────── Peony ───────────────────────────

/** The guard petals all round: standing at the back, spread at the sides, flared toward the viewer at the front. */
const GUARD: readonly RingPetal[] = [
  [-4, 50, 0.5, 'g', 1, -26],
  [34, 48, 0.48, 'h', 1, -18],
  [-38, 47, 0.5, 'h', 0, -17],
  [70, 46, 0.5, 'g', 1, -8],
  [-74, 47, 0.5, 'g', 0, -9],
  [104, 45, 0.52, 'h', 1, -2],
  [-108, 46, 0.52, 'h', 0, -2],
  [140, 46, 0.54, 'g', 1, 0],
  [-148, 48, 0.54, 'g', 0, 0],
  [174, 47, 0.58, 'h', 0, 0],
];
const SECOND: readonly RingPetal[] = [
  [16, 40, 0.44, 'h', 0, -22],
  [-20, 40, 0.44, 'g', 0, -22],
  [54, 38, 0.46, 'g', 1, -12],
  [-56, 38, 0.46, 'h', 0, -12],
  [88, 36, 0.48, 'h', 1, -4],
  [-92, 36, 0.48, 'g', 0, -4],
  [128, 35, 0.5, 'g', 0, 0],
  [-132, 36, 0.5, 'h', 1, 0],
];
/** The inner wall behind the heart, and the cup's sides and front. */
const WALL: readonly CupPetal[] = [
  [-22, 0, -60, 28, 0.38],
  [23, 1, 58, 27, 0.36],
  [-12, -2, -26, 32, 0.4],
  [12, -2, 24, 31, 0.4],
  [0, -3, 2, 34, 0.42],
];
const FRONT: readonly CupPetal[] = [
  [-23, 12, -64, 21, 0.3],
  [24, 14, 56, 23, -0.33],
  [-11, 17, -20, 25, 0.36],
  [14, 19, 27, 20, -0.29],
  [2, 22, 7, 17, 0.3],
];

/**
 * A full-blown peony seen from three-quarters above, drawn about 104 wide and 90 tall around the
 * origin: guard petals all round (standing at the back, flared at the front), the cup's inner wall,
 * a warm heart of crumpled frills, and the cup's sides and front curling over it. `lite` leaves out
 * the second row of guard petals (for a bloom half hidden behind another). Needs <PetalDefs>
 * (PEONY_PETALS) and the tone's <ToneDefs> under `id`, the tone's gradients as `k`.
 */
function PeonyParts({ id, k, tone, lite }: { id: string; k: string; tone: GardenTone; lite?: boolean }) {
  const t = GARDEN_TONES[tone];
  const g = (key: string) => `url(#${id}${k}${key})`;
  const frills: ReactNode[] = [];
  const frill = (key: string, a: number, r: number, wid: number, len: number) =>
    frills.push(<use key={key} href={`#${id}f`} transform={`rotate(${r1(a)})translate(0 ${-r})scale(${n2(wid)} ${n2(len / 100)})`} />);
  for (let i = 0; i < 7; i++) frill(`a${i}`, -154 + i * 51 + (rand(i, 71) - 0.5) * 18, 5, (0.34 + rand(i, 72) * 0.12) * (i % 2 ? -1 : 1), 17 + rand(i, 73) * 6);
  for (let i = 0; i < 3; i++) frill(`b${i}`, -120 + i * 120 + (rand(i, 74) - 0.5) * 24, 1, (0.3 + rand(i, 75) * 0.08) * (i % 2 ? 1 : -1), 11 + rand(i, 76) * 4);
  return (
    <g stroke={t.deep} strokeOpacity="0.32" strokeWidth="1.1" color={t.deep}>
      <g transform="translate(0 9)scale(1 .68)" fill={g('o')}>
        {ring(id, GUARD, 11, g('m'))}
      </g>
      {lite ? null : (
        <g transform="translate(0 5)scale(1 .66)" fill={g('o')}>
          {ring(id, SECOND, 21, g('m'))}
        </g>
      )}
      <g fill={g('w')}>{cup(id, 'w', WALL)}</g>
      <ellipse cx="0" cy="-5" rx="24" ry="13" fill={t.heart[1]} stroke="none" />
      <g transform="translate(0 -6)scale(1 .62)" fill={g('h')} stroke={t.rim} strokeOpacity="0.55" strokeWidth="2.4">
        {frills}
      </g>
      <g fill={g('o')}>{cup(id, 'c', FRONT)}</g>
    </g>
  );
}

// ─────────────────────────── Garden rose ───────────────────────────

/** The outer petals, rolled back to points, and a shorter second row between them. */
const ROSE_RING: readonly RingPetal[] = [
  [-8, 46, 0.5, 'o', 1, -10],
  [40, 45, 0.5, 'o', 1, -7],
  [-48, 45, 0.5, 'o', 0, -7],
  [88, 44, 0.52, 'o', 1, -2],
  [-92, 44, 0.52, 'o', 0, -2],
  [136, 43, 0.54, 'o', 1, 0],
  [-140, 44, 0.54, 'o', 0, 0],
  [178, 44, 0.56, 'o', 0, 0],
];
const ROSE_SECOND: readonly RingPetal[] = [
  [16, 36, 0.5, 'r', 0, -9],
  [-24, 36, 0.5, 'r', 0, -9],
  [64, 34, 0.52, 'r', 1, -4],
  [-68, 34, 0.52, 'r', 0, -4],
  [112, 33, 0.54, 'r', 1, 0],
  [-116, 33, 0.54, 'r', 0, 0],
];
/**
 * The heart's petals seen from above, each standing edge-on as a crescent along its ring: [radius,
 * petals, turn] per ring, outermost first. Two to four to a ring, every ring turned against the
 * last, so their rims wind in toward the centre the way a rose's do.
 */
const ROSETTE: ReadonlyArray<readonly [number, number, number]> = [
  [28, 4, 8],
  [22, 3, 50],
  [16.5, 3, 112],
  [11.5, 3, 168],
  [7, 2, 232],
];

/**
 * A garden rose seen from three-quarters above, drawn about 100 wide and 84 tall around the origin:
 * outer petals rolled back to points, a second row, and the heart's rings of petals winding in to a
 * small tight centre. Needs <PetalDefs> with the rose's petals (ROSE_PETALS) and the tone's
 * <ToneDefs> (o) under `id`, the tone's gradients as `k`.
 */
function RoseParts({ id, k, tone }: { id: string; k: string; tone: GardenTone }) {
  const t = GARDEN_TONES[tone];
  const g = (key: string) => `url(#${id}${k}${key})`;
  const heart: ReactNode[] = [];
  ROSETTE.forEach(([r, n, turn], ri) => {
    for (let i = 0; i < n; i++) {
      const a = turn + (360 / n) * i + (rand(ri * 4 + i, 81) - 0.5) * 28;
      const sc = (r / 10) * (0.94 + rand(ri * 4 + i, 82) * 0.12);
      heart.push(<use key={`${ri}${i}`} href={`#${id}q`} transform={`rotate(${r1(a)})scale(${n2(sc * (i % 2 ? -1 : 1) * (0.92 + rand(ri * 4 + i, 83) * 0.2))} ${n2(sc)})`} />);
    }
  });
  return (
    <g stroke={t.deep} strokeOpacity="0.32" strokeWidth="1.1" color={t.deep}>
      <g transform="translate(0 6)scale(1 .74)" fill={g('o')}>
        {ring(id, ROSE_RING, 31, g('o'))}
      </g>
      <g transform="translate(0 3)scale(1 .72)" fill={g('o')}>
        {ring(id, ROSE_SECOND, 41, g('o'))}
      </g>
      <g transform="translate(0 -3)scale(1 .76)" fill={g('o')} strokeWidth="0.5">
        <circle r="24.5" fill={blend(blend(t.base, t.heart[1], 0.3), t.deep, 0.35)} stroke="none" />
        {heart}
        <path d="M-1.6 .4C-3 -2.6 1.6 -4.4 3 -1.6C4 1 .4 2.6 -.6 1" fill="none" strokeOpacity="0.8" strokeWidth="0.8" />
      </g>
    </g>
  );
}

// ─────────────────────────── Leaves, buds, blossoms ───────────────────────────

interface LeafSpec {
  /** Half-width at the widest, for a leaf 100 long. */
  wide: number;
  /** Positive: widest toward the stalk. */
  ovate: number;
  /** How far the midrib bows (negative: up). */
  bow: number;
  /** Side veins each side. */
  veins: number;
  /** Widens the leaf toward its tip (a rounder leaf with a short point). */
  blunt: number;
  seed: number;
}

/** A leaf drawn 100 long along +x from its stalk at the origin: two halves either side of a gently bowed midrib (one lit, one in shade) and its veins. */
function leaf({ wide, ovate, bow, veins, blunt, seed }: LeafSpec) {
  const mid = (u: number) => bow * 4 * u * (1 - u);
  const half = (u: number) => wide * 2.6 * Math.sqrt(u) * (1 - u) * (1 + ovate * (0.4 - u)) * (1 + blunt * u * u);
  const lower = 0.9 + rand(seed, 5) * 0.16;
  const us = [0.08, 0.25, 0.48, 0.72, 0.9];
  const back = `Q50 ${r0(2 * bow)} 0 0Z`;
  const a = `M0 0${through([[0, 0], ...us.map((u) => [100 * u, mid(u) - half(u)] as const), [100, 0]])}${back}`;
  const b = `M0 0${through([[0, 0], ...us.map((u) => [100 * u, mid(u) + half(u) * lower] as const), [100, 0]])}${back}`;
  let lines = `M3 ${r0(mid(0.03))}Q50 ${r0(2 * bow)} 95 ${r0(mid(0.95))}`;
  for (let i = 0; i < veins; i++) {
    const u = 0.24 + (0.4 * i) / Math.max(1, veins - 1);
    const v = u + 0.13;
    for (const s of [-1, 1]) lines += `M${pt(100 * u, mid(u))}Q${pt(100 * u + 6, mid(u) + s * half(u) * 0.45)} ${pt(100 * v, mid(v) + s * half(v) * 0.78)}`;
  }
  return { a, b, lines };
}

const LEAVES = {
  // A rose leaf.
  la: { wide: 23, ovate: 0.5, bow: -4, veins: 2, blunt: 0.5, seed: 5 },
  // A long, slightly curved leaf.
  lb: { wide: 13, ovate: 0.2, bow: -7, veins: 2, blunt: 0, seed: 9 },
  // A small round vine leaf.
  lc: { wide: 29, ovate: 0.7, bow: -2, veins: 1, blunt: 1.2, seed: 15 },
} as const satisfies Record<string, LeafSpec>;
type LeafKey = keyof typeof LEAVES;
/** A leaf, a spray of three rose leaflets (`lt`), a bud, a blossom, a cluster of blossoms, a tendril. */
type SprigKind = LeafKey | 'lt' | 'bd' | 'bl' | 'bc' | 'td';

/** A closed rose bud on its stalk, 30 tall, pointing up from the stalk's foot at the origin. */
const BUD = {
  sepalsBack: 'M0 -10C-4 -11 -8 -14 -9.5 -19C-6.5 -16.4 -3.5 -14.6 0 -13.2ZM0 -10C4 -11 7.6 -13 9.6 -17.6C6.4 -15.4 3.6 -14.2 0 -13.2Z',
  body: 'M0 -9.4C-5 -10 -6.8 -15 -5.8 -20.4C-4.8 -25.4 -2 -28.6 .4 -30.6C2.8 -28.4 5.4 -25 6 -20.4C6.6 -15 4.8 -10 0 -9.4Z',
  wrap: 'M-5.9 -18.5C-5.2 -23.4 -1.4 -26 3.2 -24.6C5.8 -20.6 5.4 -13 .4 -10C-3.8 -10.4 -6.3 -13.8 -5.9 -18.5Z',
  fold: 'M.4 -30.4C-.8 -27 .6 -24.4 2.8 -23.6',
  sepalsFront: 'M.2 -9.6C-2.4 -12.2 -4.4 -15.4 -4.2 -21C-2.6 -16.6 -.6 -14.4 1 -12.4ZM0 -9.6C2.6 -12 4.8 -14 6.6 -18.4C3.8 -15.6 2.2 -13.4 .6 -11.2ZM-2.6 -10a2.6 1.8 0 1 0 5.2 0a2.6 1.8 0 1 0 -5.2 0Z',
};
/** A five-petal blossom of radius 10: each petal softly notched, a warm glow and a ring of stamens at its centre. */
const BLOSSOM_PETAL = 'M0 -1C-3 -2 -6 -5 -5.6 -8.4C-5.2 -11 -2.4 -11.6 0 -10.2C2.4 -11.6 5.2 -11 5.6 -8.4C6 -5 3 -2 0 -1Z';
const STAMENS = 'M0 -2.9h0M2.5 -1.5h0M2.5 1.5h0M0 2.9h0M-2.5 1.5h0M-2.5 -1.5h0';
/** A fine tendril, 30 tall, rising from the origin to a curl. */
const TENDRIL = chain(0, 0, 1, -8, -3, -14, -1, -20, 1, -26, 7, -27, 7, -22, 7, -18.5, 3, -18.5, 3.4, -21);

/** Cubic segments from flat numbers: the start, then control, control and end for each segment. */
function chain(...v: number[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i + 7 < v.length; i += 6)
    segs.push([
      [v[i]!, v[i + 1]!],
      [v[i + 2]!, v[i + 3]!],
      [v[i + 4]!, v[i + 5]!],
      [v[i + 6]!, v[i + 7]!],
    ]);
  return segs;
}

/**
 * The sprigs, drawn once for <use>: the leaves (the lit half takes the <use>'s fill, the shaded half
 * its color, a sheen darkens the stalk end and lights the tip), three leaflets, the bud (pink, with
 * its gradients `${id}ko` and `${id}kf`), the blossom, a cluster of blossoms and the tendril.
 */
function SprigDefs({ id, G, centre }: { id: string; G: Greens; centre: string }) {
  const pink = GARDEN_TONES.pink;
  return (
    <>
      <linearGradient id={`${id}sn`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2a3320" stopOpacity="0.2" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.3" />
      </linearGradient>
      {(Object.keys(LEAVES) as LeafKey[]).map((key) => {
        const { a, b, lines } = leaf(LEAVES[key]);
        return (
          <g key={key} id={`${id}${key}`}>
            <path id={`${id}${key}a`} d={a} />
            <g fill="currentColor">
              <path id={`${id}${key}b`} d={b} />
            </g>
            <use href={`#${id}${key}a`} fill={`url(#${id}sn)`} />
            <use href={`#${id}${key}b`} fill={`url(#${id}sn)`} />
            <path d={lines} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.3" />
          </g>
        );
      })}
      <g id={`${id}lt`}>
        <path d="M0 0Q30 -2 58 0" fill="none" stroke={G.stem} strokeWidth="2" />
        <use href={`#${id}la`} transform="translate(56 0)scale(.6)" />
        <use href={`#${id}la`} transform="translate(30 -1)rotate(-46)scale(.5)" />
        <use href={`#${id}la`} transform="translate(32 0)rotate(42)scale(.48 -.48)" />
      </g>
      <ToneDefs id={id} k="k" t={pink} keys="of" />
      <g id={`${id}bd`}>
        <path d="M0 0C.6 -3.4 -.4 -6.6 0 -10" fill="none" stroke={G.stem} strokeWidth="1.2" strokeLinecap="round" />
        <path d={BUD.sepalsBack} fill={G.sepal} />
        <g stroke={pink.deep} strokeOpacity="0.35" strokeWidth="0.4">
          <path d={BUD.body} fill={`url(#${id}ko)`} />
          <path d={BUD.wrap} fill={`url(#${id}kf)`} />
        </g>
        <path d={BUD.fold} fill="none" stroke={pink.deep} strokeOpacity="0.6" strokeWidth="0.5" />
        <path d={BUD.sepalsFront} fill={G.sepal} />
      </g>
      <radialGradient id={`${id}bg`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="11">
        <stop offset="0" stopColor="#e9d49c" />
        <stop offset="0.42" stopColor="#f6eddb" />
        <stop offset="1" stopColor="#fffcf4" />
      </radialGradient>
      <g id={`${id}bl`}>
        <g fill={`url(#${id}bg)`} stroke="#d4c3a6" strokeWidth="0.35">
          {[0, 70, 146, 218, 290].map((a, i) => (
            <path key={i} d={BLOSSOM_PETAL} transform={`rotate(${a})${i % 2 ? 'scale(.92)' : ''}`} />
          ))}
        </g>
        <path d={STAMENS} stroke="#b8923e" strokeWidth="1.1" strokeLinecap="round" />
        <circle r="1.5" fill={centre} />
      </g>
      <g id={`${id}bc`}>
        <use href={`#${id}bl`} transform="translate(-7 3)rotate(24)scale(.78)" />
        <use href={`#${id}bl`} transform="translate(6 -2)rotate(-14)scale(.9)" />
        <use href={`#${id}bl`} transform="translate(-2 -12)rotate(52)scale(.62)" />
      </g>
      <path id={`${id}td`} d={taper(TENDRIL, [1.3, 0.9, 0.55, 0.25], 4)} />
    </>
  );
}

/** Three decimals, no leading zero (the scale in a matrix). */
const n3 = (n: number) => `${Math.round(n * 1000) / 1000}`.replace(/^(-?)0\./, '$1.');

/**
 * A transform placing a sprig on a point of a stem, turned from the stem's tangent toward its
 * right-hand side by (forward, across) and scaled: leaves point along +x, buds and tendrils up
 * (−y); `mirror` flips the sprig across its own axis. It is kit's frameAt with the turn and the
 * scale folded into the one matrix (a sprig's transform stays short); arithmetic and a square root only.
 */
function onStem(f: { x: number; y: number; tx: number; ty: number }, forward: number, across: number, size: number, mirror: number, up: boolean) {
  const len = Math.sqrt(forward * forward + across * across) || 1;
  const dx = (forward * f.tx - across * f.ty) / len;
  const dy = (forward * f.ty + across * f.tx) / len;
  const m = up ? [-dy * mirror, dx * mirror, -dx, -dy] : [dx, dy, -dy * mirror, dx * mirror];
  return `matrix(${m.map((v) => (size < 0.15 ? n3(v * size) : n2(v * size))).join(' ')} ${r1(f.x)} ${r1(f.y)})`;
}

/** [x, y, angle (0° points along +x), length, sprig, green] for a leaf placed by hand. */
type BigLeaf = readonly [number, number, number, number, LeafKey | 'lt', number];

/** Leaves placed by hand, grouped by their greens so each colour is written once. */
function leaves(id: string, list: readonly BigLeaf[], G: Greens, key: string) {
  return G.pairs.map(([lit, dark], c) => {
    const mine = list.filter((l) => l[5] % G.pairs.length === c);
    if (!mine.length) return null;
    return (
      <g key={`${key}${c}`} fill={lit} color={dark}>
        {mine.map(([x, y, a, len, kind], i) => (
          <use key={i} href={`#${id}${kind}`} transform={`translate(${x} ${y})rotate(${a})scale(${n2(len / 100)})`} />
        ))}
      </g>
    );
  });
}

/** [where along the stem 0–1, side (+1: right of the way it grows), size, sprig, green] for what grows from a stem. */
type Sprig = readonly [number, 1 | -1, number, SprigKind, number?];
/** A stem: its cubic segments, its widths at their joints, and its sprigs. */
type Stem = readonly [readonly Segment[], readonly number[], readonly Sprig[]];

/**
 * A stem tapering along its segments with leaves, leaflets, buds, blossoms and tendrils set along it
 * on either side, following the curve; leaves are grouped by green.
 */
function spray(id: string, key: string, [segs, widths, sprigs]: Stem, G: Greens): ReactNode {
  const byGreen: ReactNode[][] = G.pairs.map(() => []);
  const rest: ReactNode[] = [];
  sprigs.forEach(([at, side, size, kind, green = 0], i) => {
    const s = Math.min(segs.length - 1, Math.floor(at * segs.length));
    const f = onCubic(segs[s]!, Math.min(1, at * segs.length - s));
    const jf = (rand(i, key.charCodeAt(1) + 3) - 0.5) * 0.3;
    const ja = (rand(i, key.charCodeAt(1) + 5) - 0.5) * 0.3;
    if (kind === 'bd') rest.push(<use key={i} href={`#${id}bd`} transform={onStem(f, 1, side * 0.45 + ja, size / 30, 1, true)} />);
    else if (kind === 'td') rest.push(<use key={i} href={`#${id}td`} fill={G.stem} transform={onStem(f, 0.55 + jf, side * 0.85, size / 30, side, true)} />);
    else if (kind === 'bl' || kind === 'bc')
      rest.push(<use key={i} href={`#${id}${kind}`} transform={`translate(${r1(f.x - f.ty * side * size * 0.9)} ${r1(f.y + f.tx * side * size * 0.9)})rotate(${r0(rand(i, 9) * 72)})scale(${n2(size / 10)})`} />);
    else byGreen[green % G.pairs.length]!.push(<use key={i} href={`#${id}${kind}`} transform={onStem(f, 0.62 + jf, side * (0.8 + ja), size / 100, side, false)} />);
  });
  return (
    <g key={key}>
      <path d={taper(segs, widths, 4)} fill={G.stem} />
      {byGreen.map((list, c) =>
        list.length ? (
          <g key={c} fill={G.pairs[c]![0]} color={G.pairs[c]![1]}>
            {list}
          </g>
        ) : null,
      )}
      {rest}
    </g>
  );
}

/** [x, y, angle, scale] for a bud or a blossom placed by hand. */
type Placed = readonly [number, number, number, number];
const placed = (id: string, what: 'bd' | 'bl' | 'bc', list: readonly Placed[]) =>
  list.map(([x, y, a, s], i) => <use key={`${what}${i}`} href={`#${id}${what}`} transform={`translate(${x} ${y})rotate(${a})scale(${n2(s)})`} />);

// ─────────────────────────── The pieces ───────────────────────────

/** One full-blown blush peony from three-quarters above (aspect 1.1): a bloom to place on its own, small or large. */
export function Peony({ className, style }: IllustrationProps) {
  const id = useSafeId();
  return (
    <svg viewBox="0 0 110 100" className={className} style={style} aria-hidden="true">
      <defs>
        <PetalDefs id={id} keys={PEONY_PETALS} />
        <ToneDefs id={id} k="b" t={GARDEN_TONES.blush} />
      </defs>
      <g transform="translate(55 50)">
        <PeonyParts id={id} k="b" tone="blush" />
      </g>
    </svg>
  );
}

/** A peony for other art: centred on (x, y), `r` its half-width, with its own prototypes and gradients under `id` (one id per bloom). */
export function PeonyBloom({ x, y, r, tone = 'blush', id }: { x: number; y: number; r: number; tone?: GardenTone; id: string }) {
  return (
    <g transform={`translate(${r1(x)} ${r1(y)})scale(${n2(r / 52)})`}>
      <defs>
        <PetalDefs id={id} keys={PEONY_PETALS} />
        <ToneDefs id={id} k="t" t={GARDEN_TONES[tone]} />
      </defs>
      <PeonyParts id={id} k="t" tone={tone} />
    </g>
  );
}

/** A garden rose for other art: centred on (x, y), `r` its half-width, with its own prototypes and gradients under `id` (one id per bloom). */
export function GardenRose({ x, y, r, tone = 'peach', id }: { x: number; y: number; r: number; tone?: GardenTone; id: string }) {
  return (
    <g transform={`translate(${r1(x)} ${r1(y)})scale(${n2(r / 48)})`}>
      <defs>
        <PetalDefs id={id} keys={ROSE_PETALS} />
        <ToneDefs id={id} k="t" t={GARDEN_TONES[tone]} keys="o" />
      </defs>
      <RoseParts id={id} k="t" tone={tone} />
    </g>
  );
}

const BOUQUET_STEMS: readonly Stem[] = [
  // Up the left, the tallest, ending in a bud.
  [
    chain(36, 206, 16, 168, 60, 136, 44, 100, 30, 72, 64, 56, 52, 30),
    [2.6, 1.6, 0.5],
    [
      [0.05, 1, 34, 'lt', 1],
      [0.12, -1, 28, 'la', 0],
      [0.2, 1, 27, 'lt', 2],
      [0.28, -1, 24, 'lc', 3],
      [0.34, 1, 22, 'lb', 0],
      [0.38, -1, 8, 'bc'],
      [0.44, 1, 21, 'lt', 1],
      [0.5, -1, 15, 'td'],
      [0.53, -1, 19, 'lc', 0],
      [0.61, 1, 17, 'lc', 4],
      [0.64, -1, 7, 'bl'],
      [0.69, -1, 16, 'lt', 2],
      [0.76, 1, 13, 'td'],
      [0.79, 1, 13, 'lc', 0],
      [0.86, -1, 12, 'lc', 3],
      [0.92, 1, 10, 'lc', 1],
      [1, 1, 26, 'bd'],
    ],
  ],
  // Up and to the right, over the bouquet.
  [
    chain(86, 220, 104, 188, 118, 172, 132, 150, 146, 128, 140, 118, 160, 100),
    [2.2, 1.3, 0.45],
    [
      [0.08, -1, 28, 'lt', 1],
      [0.17, 1, 25, 'la', 0],
      [0.27, -1, 23, 'lt', 2],
      [0.36, 1, 21, 'lc', 3],
      [0.42, 1, 7, 'bl'],
      [0.48, -1, 19, 'lb', 0],
      [0.57, 1, 17, 'lt', 1],
      [0.67, -1, 15, 'lc', 4],
      [0.76, 1, 13, 'lc', 0],
      [0.82, -1, 12, 'td'],
      [0.88, -1, 11, 'lc', 2],
      [1, 1, 22, 'bd'],
    ],
  ],
  // A short one along the left edge.
  [
    chain(12, 216, -2, 182, 18, 152, 6, 118),
    [1.8, 0.45],
    [
      [0.12, 1, 22, 'lt', 0],
      [0.3, -1, 19, 'lc', 1],
      [0.46, 1, 17, 'lc', 2],
      [0.58, -1, 6, 'bl'],
      [0.62, -1, 15, 'lc', 0],
      [0.78, 1, 13, 'lc', 3],
      [1, -1, 14, 'td'],
    ],
  ],
  // To the right along the foot, and a shorter one below it.
  [
    chain(156, 296, 178, 282, 198, 268, 222, 246),
    [2, 0.5],
    [
      [0.1, -1, 26, 'lt', 0],
      [0.25, 1, 22, 'la', 1],
      [0.4, -1, 20, 'lt', 2],
      [0.52, 1, 17, 'lc', 0],
      [0.57, -1, 8, 'bc'],
      [0.68, -1, 15, 'lc', 3],
      [0.8, 1, 13, 'lc', 4],
      [0.9, 1, 12, 'td'],
      [1, 1, 18, 'bd'],
    ],
  ],
  // A short arch to the right above the blush peony.
  [
    chain(126, 236, 150, 222, 176, 224, 204, 206),
    [1.6, 0.45],
    [
      [0.15, 1, 21, 'lt', 2],
      [0.34, -1, 19, 'lc', 0],
      [0.56, -1, 17, 'lt', 1],
      [0.74, 1, 14, 'lc', 4],
      [1, 1, 18, 'bd'],
    ],
  ],
];
const BOUQUET_LEAVES: readonly BigLeaf[] = [
  [104, 284, 4, 58, 'la', 0],
  [98, 314, 36, 52, 'la', 1],
  [20, 306, 164, 54, 'la', 2],
  [16, 254, -148, 50, 'la', 1],
  [86, 228, -50, 50, 'lb', 0],
  [50, 226, -96, 44, 'la', 3],
  [66, 322, 100, 42, 'la', 2],
  [136, 262, -20, 46, 'lt', 4],
  [172, 290, -16, 50, 'la', 0],
  [182, 318, 14, 46, 'la', 3],
  [150, 282, -60, 38, 'lb', 1],
  [196, 304, 2, 40, 'lt', 2],
  [200, 326, 10, 36, 'lt', 1],
  [180, 330, -8, 30, 'lc', 0],
  [40, 190, -40, 38, 'la', 1],
  [14, 184, -116, 36, 'lb', 0],
  [4, 214, 170, 34, 'la', 2],
  [30, 176, -80, 34, 'lt', 3],
  [128, 210, -24, 38, 'la', 2],
  [112, 200, -76, 34, 'lb', 0],
];
const BOUQUET_FRONT_LEAVES: readonly BigLeaf[] = [
  [116, 290, 96, 34, 'lb', 4],
  [34, 302, 152, 32, 'lc', 4],
  [140, 238, -36, 28, 'lc', 0],
];

/**
 * A corner bouquet for the bottom-left corner of a picture (aspect 0.667; mirror it for the right):
 * a large cream peony with a blush heart massed low at the left with a blush peony, a peach garden
 * rose and pink buds, sage leaves and small white blossoms around them, and sprays of
 * leaves, buds and tendrils trailing up the left and to the right along the foot.
 */
export function PeonyBouquet({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const G = greens(color);
  const centre = blend('#d8b452', hex(colors.secondary), 0.25);
  return (
    <svg viewBox="0 0 220 330" className={className} style={style} aria-hidden="true">
      <defs>
        <PetalDefs id={id} keys={[...PEONY_PETALS, ...ROSE_PETALS]} />
        <ToneDefs id={id} k="c" t={GARDEN_TONES.cream} />
        <ToneDefs id={id} k="b" t={GARDEN_TONES.blush} />
        <ToneDefs id={id} k="p" t={GARDEN_TONES.peach} keys="o" />
        <SprigDefs id={id} G={G} centre={centre} />
        <g id={`${id}P`}>
          <PeonyParts id={id} k="b" tone="blush" lite />
        </g>
      </defs>
      <g fillOpacity="0.94">
        {BOUQUET_STEMS.map((stem, i) => spray(id, `s${i}`, stem, G))}
        {leaves(id, BOUQUET_LEAVES, G, 'l')}
      </g>
      <g transform="translate(26 196)scale(.56)">
        <RoseParts id={id} k="p" tone="peach" />
      </g>
      {placed(id, 'bl', [
        [96, 210, 30, 0.75],
        [14, 258, 10, 0.8],
      ])}
      <use href={`#${id}P`} transform="translate(116 214)rotate(-14)scale(.36)" />
      <use href={`#${id}P`} transform="translate(152 302)rotate(6)scale(.66)" />
      <g fillOpacity="0.94">{leaves(id, BOUQUET_FRONT_LEAVES, G, 'f')}</g>
      <g transform="translate(62 264)">
        <PeonyParts id={id} k="c" tone="cream" />
      </g>
      {placed(id, 'bd', [
        [140, 250, 40, 1.05],
        [64, 182, -4, 1],
        [196, 280, 74, 0.85],
        [8, 166, -30, 0.85],
        [92, 204, -24, 0.9],
      ])}
      {placed(id, 'bc', [
        [124, 262, 0, 1.05],
        [36, 230, 20, 0.95],
      ])}
      {placed(id, 'bl', [
        [188, 300, 10, 0.75],
        [206, 264, 40, 0.65],
      ])}
    </svg>
  );
}

const CORNER_STEMS: readonly Stem[] = [
  // Up the left edge, the tallest, ending in a bud.
  [
    chain(22, 186, 6, 152, 30, 124, 16, 96, 6, 72, 26, 62, 18, 46),
    [2.2, 1.4, 0.45],
    [
      [0.08, 1, 26, 'lt', 1],
      [0.16, -1, 22, 'lc', 0],
      [0.25, 1, 21, 'la', 2],
      [0.33, -1, 19, 'lc', 3],
      [0.4, 1, 8, 'bc'],
      [0.46, -1, 18, 'lt', 0],
      [0.55, 1, 16, 'lc', 1],
      [0.6, -1, 12, 'td'],
      [0.64, -1, 15, 'lc', 4],
      [0.72, 1, 14, 'lt', 2],
      [0.8, -1, 12, 'lc', 0],
      [0.9, 1, 10, 'lc', 1],
      [1, 1, 20, 'bd'],
    ],
  ],
  // A shorter one beside it.
  [
    chain(44, 178, 54, 150, 40, 126, 56, 98),
    [1.8, 0.45],
    [
      [0.12, 1, 22, 'lt', 0],
      [0.28, -1, 19, 'lc', 2],
      [0.42, 1, 17, 'lc', 1],
      [0.5, -1, 7, 'bl'],
      [0.58, -1, 15, 'lt', 3],
      [0.72, 1, 13, 'lc', 0],
      [0.86, -1, 11, 'lc', 4],
      [1, 1, 16, 'bd'],
    ],
  ],
  // Trailing to the right along the foot.
  [
    chain(138, 306, 160, 294, 182, 302, 202, 292, 212, 287, 218, 290, 226, 282),
    [2, 1, 0.4],
    [
      [0.08, -1, 22, 'lt', 0],
      [0.18, 1, 20, 'lc', 1],
      [0.28, -1, 18, 'la', 2],
      [0.36, 1, 7, 'bc'],
      [0.44, -1, 16, 'lc', 3],
      [0.54, 1, 15, 'lt', 0],
      [0.64, -1, 13, 'lc', 4],
      [0.72, 1, 11, 'td'],
      [0.84, -1, 11, 'lc', 2],
      [1, 1, 13, 'bd'],
    ],
  ],
];
const CORNER_LEAVES: readonly BigLeaf[] = [
  [96, 286, 10, 50, 'la', 0],
  [14, 312, 160, 50, 'la', 2],
  [60, 324, 96, 44, 'la', 1],
  [104, 246, -34, 48, 'la', 0],
  [72, 176, -80, 40, 'la', 3],
  [44, 168, -112, 40, 'lt', 1],
  [8, 186, -150, 38, 'la', 0],
  [58, 184, -96, 42, 'lt', 3],
  [140, 292, -14, 40, 'lt', 2],
  [146, 300, -6, 44, 'la', 1],
  [128, 326, 30, 40, 'la', 2],
  [-2, 262, 180, 40, 'la', 4],
  [86, 202, -66, 38, 'lt', 2],
  [124, 248, -24, 36, 'la', 4],
  [40, 196, -136, 34, 'lb', 0],
  [2, 216, -170, 34, 'lt', 3],
  [6, 172, -110, 30, 'lc', 1],
];
const CORNER_FRONT_LEAVES: readonly BigLeaf[] = [
  [108, 304, 120, 28, 'lb', 4],
  [36, 236, -150, 26, 'lc', 0],
];

/**
 * A corner bouquet that hugs the bottom-left corner of a picture (aspect 0.667; mirror it for the
 * right), for the foot of an arch: the large cream peony with its blush heart, a blush peony, the
 * peach garden rose, buds and clusters of small white blossoms massed in the lower left, leafy
 * sprays rising up the left edge only and one trailing to the right along the foot. The top right
 * of the frame (about 45% across and half the height) stays empty for whatever the arch frames.
 */
export function PeonyCorner({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const G = greens(color);
  const centre = blend('#d8b452', hex(colors.secondary), 0.25);
  return (
    <svg viewBox="0 0 220 330" className={className} style={style} aria-hidden="true">
      <defs>
        <PetalDefs id={id} keys={[...PEONY_PETALS, ...ROSE_PETALS]} />
        <ToneDefs id={id} k="c" t={GARDEN_TONES.cream} />
        <ToneDefs id={id} k="b" t={GARDEN_TONES.blush} />
        <ToneDefs id={id} k="p" t={GARDEN_TONES.peach} keys="o" />
        <SprigDefs id={id} G={G} centre={centre} />
        <g id={`${id}P`}>
          <PeonyParts id={id} k="b" tone="blush" lite />
        </g>
      </defs>
      <g fillOpacity="0.94">
        {CORNER_STEMS.map((stem, i) => spray(id, `c${i}`, stem, G))}
        {leaves(id, CORNER_LEAVES, G, 'l')}
      </g>
      <use href={`#${id}P`} transform="translate(24 206)rotate(-8)scale(.76)" />
      <use href={`#${id}P`} transform="translate(98 222)rotate(12)scale(.4)" />
      <g transform="translate(122 304)rotate(6)scale(.58)">
        <RoseParts id={id} k="p" tone="peach" />
      </g>
      <g fillOpacity="0.94">{leaves(id, CORNER_FRONT_LEAVES, G, 'f')}</g>
      {placed(id, 'bc', [
        [14, 246, 30, 0.9],
        [62, 214, 10, 0.85],
      ])}
      <g transform="translate(50 276)scale(1.1)">
        <PeonyParts id={id} k="c" tone="cream" />
      </g>
      {placed(id, 'bd', [
        [12, 152, -20, 0.95],
        [70, 180, -6, 0.9],
        [118, 206, 30, 0.8],
        [154, 282, 64, 0.85],
        [44, 238, -40, 0.75],
        [146, 252, 50, 0.75],
      ])}
      {placed(id, 'bc', [
        [96, 248, 0, 1],
        [112, 268, 20, 0.85],
      ])}
      {placed(id, 'bl', [
        [146, 262, 20, 0.7],
        [40, 168, 40, 0.65],
      ])}
    </svg>
  );
}

const VINE_STEMS: readonly Stem[] = [
  // Along the top edge, to the left.
  [
    chain(202, 44, 172, 30, 142, 46, 112, 36, 82, 26, 52, 38, 12, 26),
    [2, 1.2, 0.4],
    [
      [0.05, -1, 28, 'lt', 0],
      [0.11, 1, 24, 'lc', 1],
      [0.17, -1, 23, 'lc', 2],
      [0.23, 1, 22, 'la', 0],
      [0.3, -1, 21, 'lt', 3],
      [0.37, 1, 19, 'lc', 1],
      [0.43, -1, 18, 'lb', 0],
      [0.48, 1, 17, 'lc', 4],
      [0.5, -1, 18, 'bd'],
      [0.55, 1, 16, 'lc', 2],
      [0.61, -1, 15, 'lc', 0],
      [0.67, 1, 14, 'lt', 1],
      [0.7, -1, 12, 'td'],
      [0.74, -1, 13, 'lc', 3],
      [0.8, 1, 12, 'lc', 0],
      [0.86, -1, 11, 'lc', 4],
      [0.92, 1, 9, 'lc', 1],
      [1, 1, 12, 'td'],
    ],
  ],
  // Down the right edge, the long one.
  [
    chain(248, 82, 262, 122, 270, 160, 260, 200, 250, 240, 262, 280, 262, 318, 262, 336, 256, 350, 260, 366),
    [2.3, 1.6, 0.9, 0.4],
    [
      [0.03, 1, 30, 'lt', 1],
      [0.08, -1, 26, 'la', 0],
      [0.13, 1, 24, 'lc', 2],
      [0.18, -1, 24, 'lt', 0],
      [0.23, 1, 22, 'lc', 3],
      [0.27, -1, 20, 'bd'],
      [0.29, -1, 21, 'la', 1],
      [0.34, 1, 21, 'lt', 0],
      [0.39, -1, 20, 'lc', 4],
      [0.44, 1, 19, 'lb', 2],
      [0.47, -1, 14, 'td'],
      [0.5, -1, 19, 'lt', 0],
      [0.55, 1, 18, 'lc', 1],
      [0.6, -1, 16, 'bd'],
      [0.62, -1, 17, 'lc', 3],
      [0.67, 1, 17, 'lt', 0],
      [0.72, -1, 16, 'lc', 2],
      [0.77, 1, 15, 'lc', 4],
      [0.8, 1, 12, 'td'],
      [0.83, -1, 14, 'lt', 1],
      [0.88, 1, 13, 'lc', 0],
      [0.93, -1, 11, 'lc', 2],
      [0.98, 1, 9, 'lc', 4],
    ],
  ],
];
const VINE_LEAVES: readonly BigLeaf[] = [
  [198, 72, 150, 50, 'la', 0],
  [244, 24, -36, 46, 'la', 1],
  [240, 88, 84, 48, 'la', 2],
  [184, 30, -168, 40, 'lb', 3],
  [262, 62, 14, 38, 'la', 0],
  [212, 18, -84, 40, 'lt', 1],
  [194, 52, 178, 34, 'lc', 4],
  [256, 96, 60, 36, 'lt', 3],
];

/**
 * A corner spray for the top-right corner of a paper panel (aspect 0.76): a cream garden rose and
 * a blush bud at the corner, a long trailing vine of small leaves, buds and tendrils down the right
 * edge and a shorter one along the top edge.
 */
export function RoseVine({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const G = greens(color);
  return (
    <svg viewBox="0 0 276 363" className={className} style={style} aria-hidden="true">
      <defs>
        <PetalDefs id={id} keys={ROSE_PETALS} />
        <ToneDefs id={id} k="c" t={GARDEN_TONES.cream} keys="o" />
        <SprigDefs id={id} G={G} centre="#d8b452" />
      </defs>
      <g fillOpacity="0.94">
        {VINE_STEMS.map((stem, i) => spray(id, `v${i}`, stem, G))}
        {leaves(id, VINE_LEAVES, G, 'l')}
      </g>
      <g transform="translate(220 54)rotate(-8)scale(.72)">
        <RoseParts id={id} k="c" tone="cream" />
      </g>
      {placed(id, 'bd', [
        [178, 46, -66, 1.2],
        [246, 108, 150, 0.9],
      ])}
    </svg>
  );
}
