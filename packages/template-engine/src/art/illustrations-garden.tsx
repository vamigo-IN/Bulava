import type { ReactNode } from 'react';
import { blend, frameAt, hex, onCubic, shade, taper, tint, useSafeId, type IllustrationProps, type Pt, type Segment } from './kit';
import { r2, rand } from './motifs';

/**
 * The Sacred Garden (ADR-081): a carved Mughal garden arch over a misty lake where two swans meet, drawn on a
 * portrait 450 × 800 canvas (the phone column the design is set in). The stone is the layer's tint, the sky the
 * page's paper warmed by the sun; the lake, the trees, the jasmine and the swans keep their natural colours.
 */

/** Natural colours of the garden: sage leaves, jasmine, misty trees, the lake and white swans. */
const GARDEN = {
  leaf: '#7f9466',
  leafLight: '#a7b689',
  leafDark: '#5c704d',
  stem: '#6d6a4a',
  jasmine: '#fffdf6',
  jasmineEdge: '#e2dac6',
  jasmineHeart: '#e7c46c',
  tree: '#aead88',
  treeFar: '#c9c5a5',
  treeNear: '#9c9f7a',
  meadow: '#cdc9a2',
  lakeFar: '#f0e9da',
  lakeNear: '#d2c7b0',
  swan: '#ffffff',
  swanShade: '#e8e3da',
  swanDeep: '#cdc6ba',
  beak: '#e2793e',
  beakDark: '#b9532a',
  knob: '#2b2420',
} as const;

/** The upper half of a unit circle in 15° steps (left to right, y up as negative): bumps and canopies use it. */
const ARC: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-0.9659, -0.2588],
  [-0.866, -0.5],
  [-0.7071, -0.7071],
  [-0.5, -0.866],
  [-0.2588, -0.9659],
  [0, -1],
  [0.2588, -0.9659],
  [0.5, -0.866],
  [0.7071, -0.7071],
  [0.866, -0.5],
  [0.9659, -0.2588],
  [1, 0],
];

const P = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

/**
 * A pointed (ogee-tipped) Mughal arch from (x0, spring) to (x1, spring) through its apex at (centre, apex):
 * each side rises straight from the springing, swells, and draws up into a fine point. `move` starts with M.
 */
function ogeeArch(x0: number, x1: number, spring: number, apex: number, move = true): string {
  return archSegments(x0, x1, spring, apex)
    .map(([, c1, c2, e], i) => `${i === 0 ? `${move ? 'M' : 'L'}${P(x0, spring)} ` : ''}C${P(c1[0], c1[1])} ${P(c2[0], c2[1])} ${P(e[0], e[1])}`)
    .join(' ');
}

/** The arch's own curve as cubic segments (left springing to apex, then down to the right), for strands that follow it. */
function archSegments(x0: number, x1: number, spring: number, apex: number): Segment[] {
  const c = (x0 + x1) / 2;
  const hw = c - x0;
  const h = spring - apex;
  const a: Pt = [x0, spring];
  const b: Pt = [c - 0.12 * hw, apex + 0.1 * h];
  const top: Pt = [c, apex];
  const d: Pt = [c + 0.12 * hw, apex + 0.1 * h];
  const e: Pt = [x1, spring];
  return [
    [a, [x0, spring - 0.66 * h], [c - 0.58 * hw, apex + 0.2 * h], b],
    [b, [c - 0.05 * hw, apex + 0.06 * h], [c - 0.015 * hw, apex + 0.04 * h], top],
    [top, [c + 0.015 * hw, apex + 0.04 * h], [c + 0.05 * hw, apex + 0.06 * h], d],
    [d, [c + 0.58 * hw, apex + 0.2 * h], [x1, spring - 0.66 * h], e],
  ];
}

/** A point on a curve, as a tuple (a strand starts where another curve passes). */
function onPt(seg: Segment, t: number): Pt {
  const { x, y } = onCubic(seg, t);
  return [r2(x), r2(y)];
}

/** Shared shapes the garden places many times: two sage leaves, a jasmine flower and a bud. */
function GardenSymbols({ id }: { id: string }) {
  const petals: ReactNode[] = [];
  for (let i = 0; i < 5; i++) petals.push(<ellipse key={i} cx="0" cy="-3.1" rx="1.9" ry="3.2" transform={`rotate(${i * 72})`} />);
  return (
    <>
      <linearGradient id={`${id}lf`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={GARDEN.leafDark} />
        <stop offset="0.55" stopColor={GARDEN.leaf} />
        <stop offset="1" stopColor={GARDEN.leafLight} />
      </linearGradient>
      <linearGradient id={`${id}lg`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={GARDEN.leaf} />
        <stop offset="1" stopColor={tint(GARDEN.leafLight, 0.25)} />
      </linearGradient>
      <path id={`${id}leaf`} d="M0 0 C3.2 -4.6 9.4 -5.4 14 0 C9.4 5.4 3.2 4.6 0 0Z" fill={`url(#${id}lf)`} />
      <path id={`${id}leaf2`} d="M0 0 C3 -3.6 8.6 -4.2 12 0.4 C8 4.4 3 3.6 0 0Z" fill={`url(#${id}lg)`} />
      <g id={`${id}jas`}>
        <g fill={GARDEN.jasmine} stroke={GARDEN.jasmineEdge} strokeWidth="0.35">
          {petals}
        </g>
        <circle r="1.1" fill={GARDEN.jasmineHeart} />
      </g>
      <g id={`${id}bud`}>
        <path d="M0 1.5 C-2.2 -0.6 -1.6 -4 0 -5.4 C1.6 -4 2.2 -0.6 0 1.5Z" fill="#fbf4e6" stroke="#ddd3bd" strokeWidth="0.35" />
        <path d="M-1.2 1 L0 2.6 L1.2 1" fill={GARDEN.leaf} />
      </g>
    </>
  );
}

/**
 * A strand along a chain of curves: leaves on either side at irregular nodes (sometimes two or three together),
 * jasmine in ones and twos, the odd bud, and a bud at the tip. `seed` keeps each strand its own; leaves shrink
 * toward the tip.
 */
function Strand({ id, segs, nodes, seed, size = 1, flowers = 0.3, tip = true, stem = 1.3 }: { id: string; segs: Segment[]; nodes: number; seed: number; size?: number; flowers?: number; tip?: boolean; stem?: number }) {
  const parts: ReactNode[] = [];
  const total = segs.length;
  parts.push(<path key="stem" d={taper(segs, segs.map((_, i) => r2(stem * size * (1 - i / (total + 1)))).concat([0.35]), 10)} fill={GARDEN.stem} opacity="0.7" />);
  const at = (u: number) => {
    const s = Math.min(total - 1, Math.floor(u * total));
    return frameAt(onCubic(segs[s]!, u * total - s));
  };
  for (let i = 0; i < nodes; i++) {
    const u = Math.min(0.995, (i + 0.35 + rand(i, seed) * 0.5) / nodes);
    const frame = at(u);
    const side = (i + seed) % 2 ? 1 : -1;
    const k = r2(size * (1.08 - u * 0.42) * (0.75 + rand(i, seed + 1) * 0.5));
    const turn = r2(side * (34 + rand(i, seed + 2) * 30) - 90);
    const many = rand(i, seed + 3);
    parts.push(<use key={`l${i}`} href={`#${id}${many > 0.5 ? 'leaf' : 'leaf2'}`} transform={`${frame} rotate(${turn}) scale(${k})`} />);
    if (many > 0.62) parts.push(<use key={`m${i}`} href={`#${id}leaf2`} transform={`${frame} rotate(${r2(turn + side * 34)}) scale(${r2(k * 0.72)})`} />);
    if (many > 0.86) parts.push(<use key={`n${i}`} href={`#${id}leaf`} transform={`${frame} rotate(${r2(-turn - 180)}) scale(${r2(k * 0.6)})`} />);
    const bloom = rand(i, seed + 4);
    if (bloom < flowers) {
      const fk = r2(size * (0.85 + rand(i, seed + 5) * 0.55));
      const dx = r2(-side * (3 + rand(i, seed + 6) * 4) * size);
      parts.push(<use key={`f${i}`} href={`#${id}jas`} transform={`${frame} translate(${dx} 0) rotate(${r2(rand(i, seed + 7) * 72)}) scale(${fk})`} />);
      if (bloom < flowers * 0.4)
        parts.push(<use key={`g${i}`} href={`#${id}jas`} transform={`${frame} translate(${r2(dx - side * 6 * size)} ${r2(-4 * size)}) rotate(${r2(rand(i, seed + 8) * 72)}) scale(${r2(fk * 0.78)})`} />);
    } else if (bloom > 0.92) {
      parts.push(<use key={`b${i}`} href={`#${id}bud`} transform={`${frame} translate(${r2(-side * 5 * size)} 0) rotate(${r2(side * 50 + 180)}) scale(${r2(size)})`} />);
    }
  }
  if (tip) parts.push(<use key="tip" href={`#${id}bud`} transform={`${frameAt(onCubic(segs[total - 1]!, 1))} rotate(180) scale(${r2(size * 1.15)})`} />);
  return <g>{parts}</g>;
}

/** Feather scallops along a line from (x0, y0) to (x1, y1): `n` rounded tips bulging `drop` below it. */
function scallops(x0: number, y0: number, x1: number, y1: number, n: number, drop: number): string {
  let d = '';
  for (let k = 1; k <= n; k++) {
    const xa = x0 + ((x1 - x0) * (k - 1)) / n;
    const xb = x0 + ((x1 - x0) * k) / n;
    const ya = y0 + ((y1 - y0) * (k - 1)) / n;
    const yb = y0 + ((y1 - y0) * k) / n;
    d += ` Q${P((xa + xb) / 2 - (xb - xa) * 0.2, (ya + yb) / 2 + drop)} ${P(xb, yb)}`;
  }
  return d;
}

/**
 * One swan facing right (its chest near x 0, the water line at y 0): a long body with an upturned tail, a wing
 * raised in rows of layered feathers, and an S-neck curving over so its head meets its mate's at mid-height.
 */
function Swan({ id, reflection = false }: { id: string; reflection?: boolean }) {
  const neck = taper(
    [
      [
        [-20, -19],
        [-23, -30],
        [-31, -36],
        [-31, -46],
      ],
      [
        [-31, -46],
        [-31, -58],
        [-25, -67],
        [-16, -67],
      ],
      [
        [-16, -67],
        [-9, -67],
        [-6, -62],
        [-5, -56],
      ],
    ],
    [10.5, 6.6, 5.2, 4.6],
    14,
  );
  const body = 'M-96 -11 C-90 -5 -78 2 -62 4 C-44 7 -18 6 -6 2 C0 -2 1 -10 -4 -16 C-9 -22 -18 -24 -27 -22 C-52 -21 -78 -19 -96 -11Z';
  // The raised wing: its top swelling from the neck to a crest over the back, its rear in long feathers.
  const wing = `M-22 -20 C-28 -40 -46 -54 -64 -52 C-80 -50 -93 -39 -101 -22${scallops(-101, -22, -26, -11, 8, 4.5)}Z`;
  const row2 = `M-30 -24 C-37 -40 -52 -48 -66 -46 C-78 -44 -88 -36 -94 -26${scallops(-94, -26, -32, -18, 7, 4)}Z`;
  const row3 = `M-40 -30 C-46 -40 -56 -44 -66 -42 C-74 -40 -80 -35 -84 -30${scallops(-84, -30, -42, -26, 5, 3.4)}Z`;
  if (reflection) {
    return (
      <g fill={GARDEN.swan}>
        <path d={wing} />
        <path d={body} />
        <path d={neck} />
      </g>
    );
  }
  return (
    <g>
      <path d={wing} fill={`url(#${id}sw)`} stroke={GARDEN.swanShade} strokeWidth="0.5" />
      <path d={row2} fill="#fdfcf9" stroke={GARDEN.swanShade} strokeWidth="0.5" />
      <path d={row3} fill="#ffffff" stroke={GARDEN.swanShade} strokeWidth="0.45" />
      {/* Fine quills toward the tail, and a soft shade where the wing meets the body. */}
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${-58 - k * 9} ${-22 + k} C${-66 - k * 8} ${-26 + k * 0.5} ${-76 - k * 6} ${-28 + k * 1.5} ${-86 - k * 3} ${-26 + k * 2}`} fill="none" stroke={GARDEN.swanShade} strokeWidth="0.6" strokeLinecap="round" />
      ))}
      <path d={body} fill={`url(#${id}sb)`} />
      <path d="M-84 -12 C-66 -17 -44 -18 -24 -17 C-44 -14 -66 -12 -84 -9Z" fill={GARDEN.swanShade} opacity="0.55" />
      <path d="M-64 4 C-46 7 -22 6 -8 1 C-20 5 -46 6 -64 4Z" fill={GARDEN.swanDeep} opacity="0.55" />
      <path d="M-96 -11 C-93 -16 -88 -19 -82 -20" fill="none" stroke={GARDEN.swanDeep} strokeWidth="0.7" opacity="0.7" />
      {/* The neck and head, the beak meeting its mate's. */}
      <path d={neck} fill={`url(#${id}sn)`} />
      <path d="M-27 -38 C-31 -46 -31 -56 -27 -63" fill="none" stroke={GARDEN.swanShade} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <g transform="translate(-5 -57) rotate(-28)">
        <ellipse cx="0" cy="1.5" rx="3.6" ry="5.8" fill={GARDEN.swan} />
        <path d="M-2.2 3.4 C-2.6 6.2 -1.6 9.4 0.2 12.6 C1.6 9.4 2.4 6.2 2 3.4Z" fill={GARDEN.beak} />
        <path d="M-2.4 3.2 C-1 1.8 1 1.8 2.2 3.2 C1.6 5.2 -1.6 5.2 -2.4 3.2Z" fill={GARDEN.knob} />
        <path d="M-3.2 0.6 C-2.2 -0.6 -0.6 -0.4 0 1 C-1 1.6 -2.4 1.6 -3.2 0.6Z" fill={GARDEN.knob} opacity="0.85" />
        <path d="M0.2 12.6 C-0.4 11.4 -0.1 10.6 0.6 10.2" fill="none" stroke={GARDEN.beakDark} strokeWidth="0.7" />
      </g>
    </g>
  );
}

/** Gradients for the swans: a soft white body, a slightly cooler neck and wing. */
function SwanDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}sb`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={GARDEN.swan} />
        <stop offset="0.6" stopColor="#f8f6f2" />
        <stop offset="1" stopColor={GARDEN.swanShade} />
      </linearGradient>
      <linearGradient id={`${id}sn`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={GARDEN.swanShade} />
        <stop offset="0.45" stopColor={GARDEN.swan} />
        <stop offset="1" stopColor="#fbfaf7" />
      </linearGradient>
      <linearGradient id={`${id}sw`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fdfcf9" />
        <stop offset="1" stopColor={GARDEN.swanShade} />
      </linearGradient>
    </>
  );
}

/**
 * The pair: two swans meeting so their necks draw a heart, their reflection broken by ripples below.
 * Drawn around (0, 0) at the water line; `lake` is the water's colour for the ripples that cross the reflection.
 */
function SwanCouple({ id, lake }: { id: string; lake: string }) {
  // Ripples across the reflection: broken strokes of the water's colour, shorter as they spread.
  const ripples: ReactNode[] = [];
  for (let i = 0; i < 11; i++) {
    const w = 210 - i * 9 + rand(i, 71) * 30;
    ripples.push(<rect key={i} x={r2(-w / 2 + (rand(i, 73) - 0.5) * 24)} y={r2(3 + i * 6.2)} width={r2(w)} height={r2(1.3 + rand(i, 79) * 1.3)} rx="1" fill={lake} opacity={r2(0.55 + rand(i, 83) * 0.3)} />);
  }
  return (
    <g>
      {/* The reflection: the pair mirrored, faint, cut by ripples. */}
      <g opacity="0.42" transform="scale(1 -0.7)">
        <Swan id={id} reflection />
        <g transform="scale(-1 1)">
          <Swan id={id} reflection />
        </g>
      </g>
      {ripples}
      <g fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.55">
        <ellipse cx="-50" cy="3" rx="56" ry="5" />
        <ellipse cx="50" cy="3" rx="56" ry="5" />
        <ellipse cx="0" cy="7" rx="120" ry="9" opacity="0.5" />
      </g>
      <Swan id={id} />
      <g transform="scale(-1 1)">
        <Swan id={id} />
      </g>
    </g>
  );
}

/** Two white swans meeting on still water, their necks drawing a heart (aspect 1.6). The tint colours the water's ripples. */
export function SwanPair({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const lake = blend(hex(color), '#ffffff', 0.55);
  return (
    <svg viewBox="0 0 256 160" className={className} style={style} aria-hidden="true">
      <defs>
        <SwanDefs id={id} />
      </defs>
      <g transform="translate(128 110) scale(1.2)">
        <SwanCouple id={id} lake={lake} />
      </g>
    </svg>
  );
}

/** Foliate relief for the spandrels: scrolling stems with small leaves, faintly lit above and shadowed below. */
function FoliateRelief({ id, stone }: { id: string; stone: string }) {
  const lit = tint(stone, 0.3);
  const dark = shade(stone, 0.14);
  const scroll = 'M3 37 C3 22 13 11 26 11 C37 11 43 19 43 27 C43 34 37 37 33 37 C28 37 26 34 26 30';
  const leaves = 'M13 19 C10 13 13 8 17 7 C17 13 16 16 13 19Z M39 13 C42 9 46 9 49 10 C46 14 42 15 39 13Z M30 30 C33 27 36 28 37 30 C34 32 32 32 30 30Z';
  const group = (
    <>
      <path d={scroll} stroke={dark} strokeWidth="1.8" transform="translate(0.7 0.9)" opacity="0.4" />
      <path d={scroll} stroke={lit} strokeWidth="1.3" />
      <path d={leaves} fill={lit} stroke="none" />
      <path d={leaves} fill={dark} stroke="none" transform="translate(0.6 0.8)" opacity="0.25" />
    </>
  );
  return (
    <pattern id={`${id}ar`} width="52" height="52" patternUnits="userSpaceOnUse">
      <rect width="52" height="52" fill={stone} />
      <g fill="none" strokeLinecap="round" opacity="0.85">
        {group}
        <g transform="translate(52 52) rotate(180)">{group}</g>
      </g>
    </pattern>
  );
}

/** A Corinthian-style capital (acanthus leaves, volutes and an abacus) for a column `w` wide, its top at `y`. */
function Capital({ cx, y, w, stone }: { cx: number; y: number; w: number; stone: string }) {
  const lit = tint(stone, 0.45);
  const dark = shade(stone, 0.3);
  const half = w / 2;
  const leaves: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const x = cx - half * 0.8 + (i * half * 1.6) / 4;
    leaves.push(<path key={i} d={`M${P(x, y + 46)} C${P(x - 7, y + 34)} ${P(x - 5, y + 22)} ${P(x, y + 18)} C${P(x + 5, y + 22)} ${P(x + 7, y + 34)} ${P(x, y + 46)}Z`} fill={i % 2 ? lit : tint(stone, 0.25)} stroke={dark} strokeWidth="0.7" />);
  }
  return (
    <g>
      <path d={`M${P(cx - half * 0.86, y + 52)} C${P(cx - half * 0.86, y + 30)} ${P(cx - half * 1.1, y + 18)} ${P(cx - half * 1.22, y + 10)} H${r2(cx + half * 1.22)} C${P(cx + half * 1.1, y + 18)} ${P(cx + half * 0.86, y + 30)} ${P(cx + half * 0.86, y + 52)}Z`} fill={stone} />
      {leaves}
      {[-1, 1].map((s) => (
        <path key={s} d={`M${P(cx + s * half * 0.5, y + 14)} C${P(cx + s * half * 1.18, y + 10)} ${P(cx + s * half * 1.3, y + 24)} ${P(cx + s * half * 1.08, y + 26)} C${P(cx + s * half * 0.94, y + 27)} ${P(cx + s * half * 0.9, y + 20)} ${P(cx + s * half * 1.02, y + 19)}`} fill="none" stroke={dark} strokeWidth="1.3" strokeLinecap="round" />
      ))}
      <rect x={r2(cx - half * 1.32)} y={r2(y)} width={r2(half * 2.64)} height="10" fill={lit} stroke={dark} strokeWidth="0.8" />
      <rect x={r2(cx - half * 1.2)} y={r2(y + 52)} width={r2(half * 2.4)} height="5" fill={tint(stone, 0.2)} stroke={dark} strokeWidth="0.6" />
    </g>
  );
}

/** A misty tree canopy: a bumpy crown over a soft base (`seed` varies the bumps), `w` wide and `h` tall, its foot at (cx, base). */
function Canopy({ cx, base, w, h, seed, fill }: { cx: number; base: number; w: number; h: number; seed: number; fill: string }) {
  const rx = w / 2;
  const pts = ARC.map(([c, s], i) => {
    const j = 0.86 + rand(i, seed) * 0.22;
    return [cx + c * rx * j, base + s * h * j] as const;
  });
  let d = `M${P(pts[0]![0], pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const [nx, ny] = ARC[i]!;
    // Each bump bulges outward from the crown's middle.
    const bulge = 0.12 + rand(i, seed + 5) * 0.1;
    d += ` Q${P((ax + bx) / 2 + nx * rx * bulge, (ay + by) / 2 + ny * h * bulge)} ${P(bx, by)}`;
  }
  d += ` Q${P(cx, base + h * 0.08)} ${P(pts[0]![0], pts[0]![1])}Z`;
  return <path d={d} fill={fill} />;
}

/**
 * The Sacred Garden's arch scene, portrait 450 × 800 (aspect 0.5625): a carved stone arch (the tint) with foliate
 * spandrels and Corinthian columns, jasmine spilling from its crown and climbing the columns, and through it a warm
 * sky over misty trees and a still lake where two swans meet. The page's paper warms the sky, so presets restyle it.
 */
export function GardenArch({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const stone = blend(hex(color), hex(colors.background), 0.12);
  const lit = tint(stone, 0.42);
  const shadow = shade(stone, 0.2);
  const deep = shade(stone, 0.34);
  const paper = hex(colors.background);
  const skyTop = blend(paper, '#efdcbd', 0.5);
  const skyMid = blend(paper, '#fff9ef', 0.6);
  const horizon = blend(paper, '#ffe8c9', 0.5);
  // The opening: its sides at x 72 and 378 below the springing (y 300), its point at y 72.
  const open = { x0: 72, x1: 378, spring: 300, apex: 72 };
  const intrados = ogeeArch(open.x0, open.x1, open.spring, open.apex);
  const opening = `${intrados} V800 H${open.x0}Z`;
  const ring1 = ogeeArch(62, 388, 300, 58);
  const ring2 = ogeeArch(52, 398, 300, 46);
  const inner = archSegments(open.x0 + 6, open.x1 - 6, open.spring, open.apex + 8);

  // Jasmine from the crown: down the arch's inner edge on both sides, then hanging free; a short drop at the point.
  const leftFall: Segment[] = [
    [onPt(inner[0]!, 0.9), [156, 104], [112, 134], [92, 204]],
    [[92, 204], [80, 262], [94, 330], [86, 410]],
    [[86, 410], [82, 456], [92, 500], [86, 560]],
  ];
  const rightFall: Segment[] = [
    [onPt(inner[3]!, 0.1), [294, 104], [338, 132], [356, 204]],
    [[356, 204], [370, 262], [354, 318], [362, 392]],
  ];
  // Two short drops beside the arch's point (the faith emblem hangs under the point itself, clear of them).
  const crownDrop: Segment[] = [[[178, 98], [182, 118], [174, 138], [180, 162]]];
  const crownDrop2: Segment[] = [[[272, 98], [268, 116], [276, 134], [270, 154]]];
  const ivyLeft: Segment[] = [
    [[78, 800], [70, 720], [84, 650], [76, 590]],
    [[76, 590], [70, 540], [82, 500], [76, 452]],
  ];
  const ivyRight: Segment[] = [
    [[372, 800], [382, 730], [368, 660], [376, 600]],
    [[376, 600], [382, 560], [370, 520], [374, 486]],
  ];
  // Over the frame at the top: a lush branch from the right corner along the cornice, a lighter one at the left.
  const cornerRight: Segment[] = [
    [[452, 2], [424, 22], [392, 30], [356, 44]],
    [[356, 44], [326, 56], [306, 52], [282, 66]],
  ];
  const cornerRight2: Segment[] = [[[440, 30], [430, 70], [440, 104], [432, 150]]];
  const cornerLeft: Segment[] = [[[132, 28], [164, 20], [190, 30], [212, 44]]];

  const farTrees: ReactNode[] = [];
  const nearTrees: ReactNode[] = [];
  [
    [118, 560, 70, 88, `url(#${id}tf)`],
    [176, 562, 54, 70, `url(#${id}tf)`],
    [300, 558, 66, 92, `url(#${id}tf)`],
    [352, 560, 58, 80, `url(#${id}tf)`],
  ].forEach(([cx, base, w, h, fill], k) => farTrees.push(<Canopy key={k} cx={cx as number} base={base as number} w={w as number} h={h as number} seed={k * 11 + 3} fill={fill as string} />));
  [
    [96, 566, 62, 70, `url(#${id}tn)`],
    [146, 568, 56, 58, `url(#${id}tn)`],
    [330, 566, 60, 66, `url(#${id}tn)`],
    [272, 568, 40, 40, `url(#${id}tn)`],
    [374, 568, 44, 60, `url(#${id}tn)`],
  ].forEach(([cx, base, w, h, fill], k) => nearTrees.push(<Canopy key={k} cx={cx as number} base={base as number} w={w as number} h={h as number} seed={k * 17 + 5} fill={fill as string} />));

  const streaks: ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const y = 590 + i * 15 + rand(i, 41) * 6;
    const w = 40 + rand(i, 43) * 120;
    const x = 96 + rand(i, 47) * (260 - w * 0.5);
    streaks.push(<rect key={i} x={r2(x)} y={r2(y)} width={r2(w)} height={r2(1 + rand(i, 53) * 1.2)} rx="1" fill="#fffaf0" opacity={r2(0.35 + rand(i, 59) * 0.35)} />);
  }

  return (
    <svg viewBox="0 0 450 800" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden="true">
      <defs>
        <GardenSymbols id={id} />
        <SwanDefs id={id} />
        <FoliateRelief id={id} stone={stone} />
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="0.45" stopColor={skyMid} />
          <stop offset="0.7" stopColor={horizon} />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="225" cy="420" r="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffcf4" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fff6e6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}tf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(GARDEN.treeFar, 0.3)} />
          <stop offset="1" stopColor={GARDEN.treeFar} />
        </linearGradient>
        <linearGradient id={`${id}tn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(GARDEN.tree, 0.25)} />
          <stop offset="0.7" stopColor={GARDEN.tree} />
          <stop offset="1" stopColor={GARDEN.treeNear} />
        </linearGradient>
        <linearGradient id={`${id}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={horizon} stopOpacity="0" />
          <stop offset="1" stopColor={horizon} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GARDEN.lakeFar} />
          <stop offset="0.5" stopColor={blend(GARDEN.lakeFar, GARDEN.lakeNear, 0.55)} />
          <stop offset="1" stopColor={GARDEN.lakeNear} />
        </linearGradient>
        <linearGradient id={`${id}col`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lit} />
          <stop offset="0.35" stopColor={tint(stone, 0.22)} />
          <stop offset="0.75" stopColor={stone} />
          <stop offset="1" stopColor={shadow} />
        </linearGradient>
        <linearGradient id={`${id}st`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lit} />
          <stop offset="0.5" stopColor={tint(stone, 0.12)} />
          <stop offset="1" stopColor={stone} />
        </linearGradient>
        <linearGradient id={`${id}rev`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shadow} />
          <stop offset="1" stopColor={tint(stone, 0.1)} />
        </linearGradient>
      </defs>

      {/* Through the arch: the sky, the sun's glow behind the names, far trees in the mist, the meadow and the lake. */}
      <rect width="450" height="800" fill={`url(#${id}sky)`} />
      <rect width="450" height="800" fill={`url(#${id}sun)`} />
      <g opacity="0.75">{farTrees}</g>
      <path d="M150 506 L152.4 466 L154.8 506Z" fill={GARDEN.tree} opacity="0.45" />
      <g opacity="0.9">{nearTrees}</g>
      <rect x="0" y="470" width="450" height="100" fill={`url(#${id}mist)`} />
      <path d="M66 556 C140 562 196 568 226 570 C270 568 318 562 384 552 V582 H66Z" fill={GARDEN.meadow} />
      <path d="M66 563 C140 568 196 574 226 575 C270 574 318 568 384 559" fill="none" stroke="#e6e1c4" strokeWidth="2" opacity="0.8" />
      <path d="M66 572 C140 576 196 580 226 580 C270 580 318 576 384 568 V800 H66Z" fill={`url(#${id}lake)`} />
      {/* The trees' reflections, faint, then the light on the water. */}
      <g opacity="0.14" transform="translate(0 1150) scale(1 -1)">{nearTrees}</g>
      {streaks}
      <g transform="translate(225 672) scale(1.34)">
        <SwanCouple id={id} lake={GARDEN.lakeFar} />
      </g>

      {/* The stone: the frame round the opening, the carved spandrels, the arch's mouldings. */}
      <path d={`M0 0 H450 V800 H0Z ${opening}`} fillRule="evenodd" fill={`url(#${id}st)`} />
      <path d={`M20 30 H430 V300 H20Z ${ring2} V300Z`} fillRule="evenodd" fill={`url(#${id}ar)`} />
      <path d="M20 30 H430 V300" fill="none" stroke={deep} strokeWidth="1.2" opacity="0.5" />
      <path d="M20 300 V30" fill="none" stroke={lit} strokeWidth="1.4" />
      <path d="M14 24 H436" stroke={lit} strokeWidth="3" />
      <path d="M14 27.5 H436" stroke={deep} strokeWidth="1" opacity="0.55" />
      <path d="M0 10 H450" stroke={shadow} strokeWidth="1" opacity="0.45" />
      <path d={ring2} fill="none" stroke={deep} strokeWidth="2.2" opacity="0.45" />
      <path d={ring2} fill="none" stroke={lit} strokeWidth="1.4" transform="translate(-0.5 -1)" />
      <path d={`${ring2} L${open.x1} 300 ${ogeeArch(open.x1, open.x0, open.spring, open.apex, false)}Z`} fill={tint(stone, 0.16)} opacity="0.5" />
      <path d={ring1} fill="none" stroke={deep} strokeWidth="1.2" opacity="0.5" />
      <path d={ring1} fill="none" stroke={lit} strokeWidth="2.4" transform="translate(-0.6 -1)" opacity="0.9" />
      <path d={intrados} fill="none" stroke={`url(#${id}rev)`} strokeWidth="9" opacity="0.5" />
      <path d={intrados} fill="none" stroke={deep} strokeWidth="1.1" opacity="0.65" />
      {/* The piers' inner faces, in shade where they turn into the opening. */}
      <rect x={open.x0 - 9} y={open.spring} width="9" height={800 - open.spring} fill={shadow} opacity="0.4" />
      <rect x={open.x1} y={open.spring} width="9" height={800 - open.spring} fill={shadow} opacity="0.55" />
      {/* The columns: a carved impost, a capital and a fluted shaft on each pier. */}
      {[30, 420].map((cx) => (
        <g key={cx}>
          <rect x={cx - 24} y="240" width="48" height="60" fill={tint(stone, 0.18)} stroke={deep} strokeWidth="0.8" strokeOpacity="0.55" />
          <rect x={cx - 18} y="247" width="36" height="46" fill={`url(#${id}ar)`} stroke={lit} strokeWidth="1" />
          <Capital cx={cx} y={300} w={36} stone={stone} />
          <rect x={cx - 17} y="357" width="34" height="443" fill={`url(#${id}col)`} />
          {[1, 2, 3, 4].map((f) => (
            <line key={f} x1={r2(cx - 17 + f * 6.8)} y1="357" x2={r2(cx - 17 + f * 6.8)} y2="800" stroke="#000" strokeOpacity="0.07" strokeWidth="0.8" />
          ))}
        </g>
      ))}

      {/* Jasmine: from the crown down the arch, climbing the columns, and over the cornice at the corners. */}
      <Strand id={id} segs={leftFall} nodes={42} seed={3} size={1.2} flowers={0.4} />
      <Strand id={id} segs={rightFall} nodes={30} seed={7} size={1.15} flowers={0.38} />
      <Strand id={id} segs={crownDrop} nodes={8} seed={11} size={0.95} flowers={0.45} />
      <Strand id={id} segs={crownDrop2} nodes={6} seed={29} size={0.85} flowers={0.4} />
      <Strand id={id} segs={ivyLeft} nodes={26} seed={13} size={1.2} flowers={0.26} />
      <Strand id={id} segs={ivyRight} nodes={22} seed={17} size={1.15} flowers={0.26} />
      <Strand id={id} segs={cornerRight} nodes={34} seed={19} size={1.55} flowers={0.52} tip={false} />
      <Strand id={id} segs={cornerRight2} nodes={12} seed={31} size={1.25} flowers={0.45} />
      <Strand id={id} segs={cornerLeft} nodes={10} seed={23} size={1.1} flowers={0.4} />
    </svg>
  );
}
