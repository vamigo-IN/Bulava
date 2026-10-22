import type { ReactNode } from 'react';
import { Metal, NATURE, onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { BOUGAINVILLEA, drawWith, Floor, Fountain, HangingLantern, Wall } from '../kit';
import { billboard, floor, hang, wall } from '../planes';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';

/**
 * T05 · Bougainvillea Court (`bougainvillea-court`, final.md §5.3): the
 * `courtyard` stage. A whitewashed heritage-hotel courtyard at golden hour.
 * The guest stands under a pergola whose bougainvillea festoon dips into the
 * top of the frame (the near layer); strings of marigold cross the court wall
 * to wall with brass lanterns swaying from them (the middle layer); a long
 * pool of floating marigolds and diyas leads to a tiered fountain (the focal
 * point), and behind it the haveli's far wing closes the court with a carved,
 * studded double door under a scalloped arch, the low sun glowing behind it.
 *
 * Set-local pieces (§6.4): HaveliGate, FloatingMarigolds, plus LanternLine,
 * FountainSpray and BougainvilleaSwag (kit gaps: a catenary of marigolds strung
 * between two walls, a water-spray overlay, a near foliage festoon). Their
 * paths are written relative and in whole units: the set's markup budget
 * (150 KB with a cover and the film's particles) is tight.
 */

// ─────────────────────────── helpers ───────────────────────────

const hx = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#808080');
const url = (id: string) => `url(#${id})`;
const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;
/** Whole units: compact markup for organic detail (a unit is at most two pixels on any screen). */
const q = Math.round;

function Svg({ p, children }: { p: DrawProps; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** Ids from the seed and everything the gradients depend on (integer hashing: server and browser agree). */
function idsOf(p: DrawProps, tag: string): (part: string) => string {
  const c = p.colors;
  const key = `${tag}|${p.seed}|${p.w}x${p.h}|${c.primary}${c.secondary}${c.accent}${c.background}${c.surface}${c.text}|${p.nature.leaf}${p.nature.flame}|${p.light.color}${p.light.from}|${p.detail}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const base = `ct${tag}${(h >>> 0).toString(36)}`;
  return (part) => `${base}${part}`;
}

/** The fog the engine mixed into p.nature, applied to another fixed natural colour (bracts, marigolds). */
function hazer(n: DrawProps['nature']): (c: string) => string {
  const ch = (c: string, s: number) => (Number.parseInt(hx(c).slice(1), 16) >> s) & 255;
  const keep = Math.min(1, Math.max(0, (ch(n.flame, 16) - ch(n.leafDark, 16)) / (ch(NATURE.flame, 16) - ch(NATURE.leafDark, 16))));
  if (keep > 0.995) return hx;
  return (c) => `#${[16, 8, 0].map((s) => Math.min(255, Math.max(0, Math.round(ch(n.flame, s) + keep * (ch(c, s) - ch(NATURE.flame, s))))).toString(16).padStart(2, '0')).join('')}`;
}

/** Fixed flower colours: bougainvillea bracts (kit nature's magenta) and marigolds. */
const FLORA = { bract: BOUGAINVILLEA, bractDeep: '#8e0f45', bractLight: '#ea5c9e', marigold: '#f57c00', marigoldLight: '#ffb300', marigoldDeep: '#d84315' } as const;

/** One pointed blade from the current point along (dx, dy), back to it: relative, whole units. */
function blade(len: number, wid: number, dx: number, dy: number): string {
  const ax = q(dx * len);
  const ay = q(dy * len);
  const mx = dx * len * 0.5;
  const my = dy * len * 0.5;
  const c1x = q(mx - dy * wid);
  const c1y = q(my + dx * wid);
  const c2x = q(mx + dy * wid);
  const c2y = q(my - dx * wid);
  return `q${c1x} ${c1y} ${ax} ${ay}q${c2x - ax} ${c2y - ay} ${-ax} ${-ay}z`;
}
/** A leaf at (x, y) along the unit direction (dx, dy): no trigonometry. */
const leaf = (x: number, y: number, len: number, wid: number, dx: number, dy: number) => `M${q(x)} ${q(y)}${blade(len, wid, dx, dy)}`;
/** A unit direction from a seeded pair. */
function dirOf(i: number, salt: number, bias: readonly [number, number] = [0, 0]): readonly [number, number] {
  const dx = rand(i, salt) * 2 - 1 + bias[0];
  const dy = rand(i, salt + 1) * 2 - 1 + bias[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  return [dx / l, dy / l];
}
/** Three bracts round a centre (a bougainvillea flower), turned by a seeded direction: a 2×2 multiply, no angles. */
const BRACT_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0.87, 0.5],
  [-0.87, 0.5],
];
function flower(x: number, y: number, s: number, i: number, salt: number, wide = 0.45): string {
  const [tx, ty] = dirOf(i, salt);
  return `M${q(x)} ${q(y)}${BRACT_DIRS.map(([bx, by]) => blade(s, s * wide, bx * ty - by * tx, bx * tx + by * ty)).join('')}`;
}
const circle = (x: number, y: number, r: number) => `M${q(x - r)} ${q(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const cubic = ([a, b, c, d]: Segment) => `M${q(a[0])} ${q(a[1])}C${q(b[0])} ${q(b[1])} ${q(c[0])} ${q(c[1])} ${q(d[0])} ${q(d[1])}`;

/**
 * A multifoil (scalloped) arch from (x0, spring) over the apex to (x1, spring):
 * `lobes` foils that bulge into the masonry, cusps pointing inward.
 */
function foilArch(x0: number, x1: number, spring: number, apex: number, lobes: number): string {
  const cx = (x0 + x1) / 2;
  const rise = spring - apex;
  const left: Segment = [[x0, spring], [x0, spring - rise * 0.66], [cx - (cx - x0) * 0.52, apex], [cx, apex]];
  const right: Segment = [[cx, apex], [cx + (x1 - cx) * 0.52, apex], [x1, spring - rise * 0.66], [x1, spring]];
  const pts: Array<readonly [number, number]> = [];
  const half = Math.max(1, Math.round(lobes / 2));
  for (let i = 0; i <= half; i++) {
    const o = onCubic(left, i / half);
    pts.push([o.x, o.y]);
  }
  for (let i = 1; i <= half; i++) {
    const o = onCubic(right, i / half);
    pts.push([o.x, o.y]);
  }
  let d = `M${q(pts[0]![0])} ${q(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const chord = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    d += `A${q(chord * 0.56)} ${q(chord * 0.56)} 0 0 1 ${q(bx)} ${q(by)}`;
  }
  return d;
}

/** Bougainvillea trained along a curve: leaves in three tones and flowers in three, into the given accumulators. */
function vine(seg: Segment, count: number, salt: number, size: number, spread: (t: number) => number, leaves: string[], flowers: string[], bloom = 0.35): void {
  for (let i = 0; i < count; i++) {
    const t = Math.min(1, (i + rand(i, salt) * 0.8) / count);
    const o = onCubic(seg, t);
    const th = spread(t);
    const x = o.x + (rand(i, salt + 1) - 0.5) * th * 1.6;
    const y = o.y + (rand(i, salt + 2) - 0.3) * th;
    const [dx, dy] = dirOf(i, salt + 3, [0, 0.55]);
    const len = (10 + rand(i, salt + 4) * 8) * size;
    leaves[i % 3] += leaf(x, y, len, len * 0.36, dx, dy);
    if (rand(i, salt + 5) > bloom) flowers[(i + 1) % 3] += flower(x + dx * len * 0.5, y + dy * len * 0.5 + 3 * size, (7 + rand(i, salt + 6) * 4) * size, i, salt + 7);
  }
}

// ─────────────────────────── HaveliGate ───────────────────────────

/**
 * The haveli's far wing, closing the court (box 696×470, standing): a taller
 * gate block with a kangura parapet, carved pilasters and a scalloped arch
 * over a closed, brass-studded double door with a wooden jaali tympanum, and
 * two lower wings with lamp-lit jharokha windows. Bougainvillea spills over
 * both wings onto the gate. Lit from the key side, the far side darker.
 */
function HaveliGate(p: DrawProps) {
  const { w, h, colors: c, nature: n, light } = p;
  const id = idsOf(p, 'hg');
  const low = p.detail === 'low';
  const haze = hazer(n);
  const fromLeft = light.from !== 'right';
  // The far wing faces the guest with the sun low behind it: its lime wash a little in shade, so the white fountain stands out.
  const lime = mix(mix(mix(c.background, c.surface, 0.45), light.color, 0.1), c.primary, 0.12);
  const trim = mix(c.secondary, c.surface, 0.42);
  const trimDark = shade(trim, 0.22);
  const plinth = mix(c.primary, c.surface, 0.3);
  const wood = mix(mix(n.clayDark, c.text, 0.32), c.primary, 0.18);
  const brass = c.secondary;
  const G0 = 170;
  const G1 = w - 170;
  const gx = (G0 + G1) / 2;
  const WT = 150; // wing top
  const FOOT = h - 30; // plinth top
  const ox0 = gx - 104;
  const ox1 = gx + 104;
  const spring = 196;
  const apex = 92;
  const arch = foilArch(ox0, ox1, spring, apex, 9);
  const frameOuter = foilArch(ox0 - 16, ox1 + 16, spring, apex - 16, 9);
  // Kangura merlons along a top edge.
  const merlons = (x0: number, x1: number, y: number, size: number) => {
    let d = '';
    const n2 = Math.max(2, Math.round((x1 - x0) / (size * 1.5)));
    const step = (x1 - x0) / n2;
    const s = q(size / 2);
    for (let i = 0; i < n2; i++) d += `M${q(x0 + step * (i + 0.5) - s)} ${y}v${-q(size * 0.55)}q0 ${-q(size * 0.45)} ${s} ${-q(size * 0.6)}q${s} ${q(size * 0.15)} ${s} ${q(size * 0.6)}v${q(size * 0.55)}z`;
    return d;
  };
  // Brass studs: dotted strokes (a zero dash with round caps).
  const studs = `${[ox0 + 14, gx - 12, gx + 12, ox1 - 14].map((x) => `M${q(x)} ${spring + 14}V${FOOT - 6}`).join('')}${[spring + 6, 300, FOOT - 10].map((y) => `M${q(ox0 + 26)} ${y}H${q(gx - 14)}M${q(gx + 26)} ${y}H${q(ox1 - 20)}`).join('')}`;
  // Recessed panels: 2 × 2 per leaf.
  const panels: Array<[number, number, number, number]> = [];
  for (const [a, b] of [
    [ox0 + 24, gx - 22],
    [gx + 22, ox1 - 24],
  ] as const)
    for (const [y0, y1] of [
      [spring + 22, 290],
      [312, FOOT - 22],
    ] as const)
      panels.push([q(a), y0, q(b - a), y1 - y0]);
  // Jharokha windows in the wings, warm with lamplight.
  const windows = [85, w - 85].map((cx) => ({ cx: q(cx), x0: q(cx - 30), x1: q(cx + 30), spring: 262, apex: 228 }));
  // Bougainvillea spilling over the wing parapets and down the gate's flanks.
  const leaves = ['', '', ''];
  const flowers = ['', '', ''];
  vine([[G0 - 70, WT - 6], [G0 - 30, WT - 30], [G0 + 6, WT + 20], [G0 + 12, WT + 120]], low ? 8 : 15, 11, 0.95, (t) => 14 - t * 6, leaves, flowers, 0.25);
  vine([[G1 + 64, WT - 4], [G1 + 30, WT - 26], [G1 - 4, WT + 16], [G1 - 10, WT + 78]], low ? 6 : 11, 23, 0.8, (t) => 12 - t * 5, leaves, flowers, 0.25);
  const doorL = `M${q(ox0)} ${spring}H${q(ox1)}V${FOOT}H${q(ox0)}Z`;
  return (
    <Svg p={p}>
      <defs>
        <linearGradient id={id('wash')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint(light.color, 0.3)} stopOpacity={fromLeft ? 0.22 : 0} />
          <stop offset="0.55" stopColor={light.color} stopOpacity="0" />
          <stop offset="1" stopColor={shade(lime, 0.4)} stopOpacity={fromLeft ? 0.16 : 0.22} />
        </linearGradient>
        <linearGradient id={id('wood')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(wood, 0.3)} />
          <stop offset="0.16" stopColor={shade(wood, 0.12)} />
          <stop offset="0.5" stopColor={tint(wood, 0.08)} />
          <stop offset="0.52" stopColor={shade(wood, 0.35)} />
          <stop offset="0.55" stopColor={tint(wood, 0.06)} />
          <stop offset="1" stopColor={shade(wood, 0.18)} />
        </linearGradient>
        <Metal id={id('brass')} base={brass} x2={w} y2={h * 0.4} />
        <radialGradient id={id('lamp')} cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor={tint(light.color, 0.55)} />
          <stop offset="0.5" stopColor={light.color} />
          <stop offset="1" stopColor={mix(light.color, c.primary, 0.5)} />
        </radialGradient>
        <linearGradient id={id('tym')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(wood, 0.4)} />
          <stop offset="1" stopColor={shade(wood, 0.15)} />
        </linearGradient>
        <pattern id={id('jl')} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 0L14 14M14 0L0 14" stroke={mix(brass, wood, 0.4)} strokeWidth="1.8" />
        </pattern>
      </defs>
      {/* Wings */}
      <path d={`M0 ${WT}H${G0}V${FOOT}H0ZM${G1} ${WT}H${w}V${FOOT}H${G1}Z${merlons(4, G0 - 4, WT - 12, 13)}${merlons(G1 + 4, w - 4, WT - 12, 13)}`} fill={lime} />
      <path d={`M0 ${WT - 12}h${G0}v14h${-G0}ZM${G1} ${WT - 12}h${w - G1}v14h${G1 - w}Z`} fill={trim} />
      <path d={`M0 ${WT + 2}h${G0}v3h${-G0}ZM${G1} ${WT + 2}h${w - G1}v3h${G1 - w}Z`} fill={trimDark} opacity={0.6} />
      {windows.map((win, i) => {
        const a = foilArch(win.x0, win.x1, win.spring, win.apex, 5);
        const fr = foilArch(win.x0 - 9, win.x1 + 9, win.spring, win.apex - 9, 5);
        return (
          <g key={i}>
            <path d={`${fr}L${win.x1 + 9} 330H${win.x0 - 9}Z`} fill={trim} />
            <path d={`${a}L${win.x1} 322H${win.x0}Z`} fill={url(id('lamp'))} />
            {!low ? <path d={`M${win.cx} ${win.apex}V322M${win.x0} 280H${win.x1}M${win.x0} 300H${win.x1}`} stroke={shade(wood, 0.2)} strokeWidth={2.2} fill="none" /> : null}
            {/* sill and the chhajja brackets under it */}
            <path d={`M${win.x0 - 16} 330h${win.x1 - win.x0 + 32}v7h${win.x0 - win.x1 - 32}ZM${win.x0 - 8} 337l6 14 4-14ZM${win.x1 + 8} 337l-6 14-4-14Z`} fill={trimDark} />
          </g>
        );
      })}
      {/* Gate block, its parapet and dentils */}
      <path d={`M${G0} 44H${G1}V${FOOT}H${G0}Z${merlons(G0 + 6, G1 - 6, 30, 17)}`} fill={lime} />
      <rect x={G0 - 6} y={30} width={G1 - G0 + 12} height={16} fill={trim} />
      {!low ? <path d={`M${G0 + 6} 49H${G1 - 6}`} stroke={trimDark} strokeWidth={6} strokeDasharray="6 6" /> : null}
      {/* pilasters */}
      {[G0 + 4, G1 - 30].map((x, i) => (
        <g key={i}>
          <rect x={x} y={56} width={26} height={FOOT - 56} fill={trim} />
          <rect x={x + 6} y={70} width={14} height={FOOT - 90} fill={i === (fromLeft ? 1 : 0) ? trimDark : tint(trim, 0.2)} opacity={0.55} />
          <path d={`M${x - 4} 56h34v8h-34ZM${x - 4} ${FOOT - 12}h34v12h-34Z`} fill={trimDark} />
        </g>
      ))}
      {/* the arch: carved frame, spandrel rosettes, the door */}
      <path d={`${frameOuter}L${q(ox1 + 16)} ${FOOT}L${q(ox0 - 16)} ${FOOT}Z`} fill={trim} stroke={trimDark} strokeWidth={2} />
      {[q(ox0 - 24), q(ox1 + 24)].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={80} r={13} fill={c.primary} />
          <circle cx={x} cy={80} r={8} fill="none" stroke={tint(trim, 0.3)} strokeWidth={2} strokeDasharray="3 2.4" />
          <circle cx={x} cy={80} r={3} fill={url(id('brass'))} />
        </g>
      ))}
      <path d={doorL} fill={url(id('wood'))} />
      <path d={`${arch}Z`} fill={url(id('tym'))} />
      {!low ? <path d={`${arch}Z`} fill={url(id('jl'))} opacity={0.8} /> : null}
      <rect x={q(ox0)} y={spring - 4} width={q(ox1 - ox0)} height={8} fill={url(id('brass'))} />
      {panels.map(([x, y, pw, ph], i) => (
        <g key={i}>
          <rect x={x} y={y} width={pw} height={ph} fill={shade(wood, 0.22)} />
          <path d={`M${x} ${y + ph}V${y}h${pw}`} stroke={shade(wood, 0.45)} strokeWidth={2} fill="none" />
          <path d={`M${x + pw} ${y}v${ph}H${x}`} stroke={tint(wood, 0.2)} strokeWidth={1.5} fill="none" />
          {!low ? <path d={`M${q(x + pw / 2)} ${y + 10}l${q(pw * 0.28)} ${q(ph / 2 - 10)} ${-q(pw * 0.28)} ${q(ph / 2 - 10)} ${-q(pw * 0.28)} ${-q(ph / 2 - 10)}Z`} fill="none" stroke={mix(brass, wood, 0.5)} strokeWidth={1.4} /> : null}
        </g>
      ))}
      {!low ? <path d={studs} stroke={url(id('brass'))} strokeWidth={5} strokeLinecap="round" strokeDasharray="0 22" fill="none" /> : null}
      <rect x={q(gx - 3)} y={spring} width={6} height={FOOT - spring} fill={url(id('brass'))} />
      <path d={`${circle(gx - 14, 318, 7)}${circle(gx + 14, 318, 7)}`} fill="none" stroke={url(id('brass'))} strokeWidth={2.4} />
      {/* the reveal: the jamb away from the key light in shadow */}
      <path d={fromLeft ? `M${q(ox0)} ${spring}V${FOOT}h26V${spring + 30}Z` : `M${q(ox1)} ${spring}V${FOOT}h-26V${spring + 30}Z`} fill="#000000" opacity={0.22} />
      {/* plinth and threshold steps */}
      <rect x={0} y={FOOT} width={w} height={h - FOOT} fill={plinth} />
      <rect x={0} y={FOOT} width={w} height={4} fill={tint(plinth, 0.25)} />
      <path d={`M${q(ox0 - 30)} ${FOOT + 10}H${q(ox1 + 30)}V${h}H${q(ox0 - 30)}Z`} fill={tint(plinth, 0.18)} />
      <path d={`M${q(ox0 - 50)} ${FOOT + 20}H${q(ox1 + 50)}V${h}H${q(ox0 - 50)}Z`} fill={tint(plinth, 0.3)} />
      {/* golden-hour light and shade across the facade */}
      <rect x={0} y={0} width={w} height={h} fill={url(id('wash'))} />
      <rect x={fromLeft ? G1 - 6 : G0} y={44} width={6} height={FOOT - 44} fill="#000000" opacity={0.12} />
      <path d={fromLeft ? `M${G1 + 1} 30V${FOOT}M${w - 1} ${WT - 12}V${FOOT}` : `M${G0 - 1} 30V${FOOT}M1 ${WT - 12}V${FOOT}`} stroke={light.rim} strokeWidth={1.6} opacity={0.7} />
      {/* bougainvillea */}
      <path d={leaves[0]} fill={haze(NATURE.leafDark)} />
      <path d={leaves[1]} fill={haze(NATURE.leaf)} />
      <path d={leaves[2]} fill={haze(NATURE.leafLight)} />
      <path d={flowers[2]} fill={haze(FLORA.bractDeep)} />
      <path d={flowers[0]} fill={haze(FLORA.bract)} />
      <path d={flowers[1]} fill={haze(FLORA.bractLight)} />
    </Svg>
  );
}

// ─────────────────────────── FloatingMarigolds ───────────────────────────

/** Marigold heads and a lit clay diya floating on the pool (box 90×30), with rings on the water. */
function FloatingMarigolds(p: DrawProps) {
  const { w, h, nature: n } = p;
  const id = idsOf(p, 'fm');
  const haze = hazer(n);
  const salt = 3 + (Math.abs(Math.round(p.seed)) % 41);
  const heads = Array.from({ length: 6 }, (_, i) => ({
    x: w * (0.1 + 0.8 * ((i + rand(i, salt) * 0.6) / 6)),
    y: h * (0.6 + rand(i, salt + 1) * 0.18),
    r: q(6.5 + rand(i, salt + 2) * 3),
  }));
  const ell = (x: number, y: number, rx: number, ry: number) => `M${q(x - rx)} ${q(y)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  const tone = ['', ''];
  let top = '';
  let rings = '';
  heads.forEach((hd, i) => {
    tone[i % 2] += ell(hd.x, hd.y, hd.r, q(hd.r * 0.62));
    top += ell(hd.x - 1, hd.y - hd.r * 0.2, q(hd.r * 0.7), q(hd.r * 0.4));
    rings += ell(hd.x, hd.y + 3, hd.r * 2, 3);
  });
  const leaves = heads
    .filter((_, i) => i % 2 === 0)
    .map((hd, i) => leaf(hd.x, hd.y + 1, 11, 2.6, rand(i, salt + 4) > 0.5 ? 0.96 : -0.96, 0.28))
    .join('');
  const dx = q(w * (0.36 + rand(1, salt + 9) * 0.28));
  const dy = q(h * 0.7);
  return (
    <Svg p={p}>
      <defs>
        <radialGradient id={id('fl')} cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor={n.flameCore} />
          <stop offset="0.5" stopColor={n.flame} stopOpacity="0.85" />
          <stop offset="1" stopColor={n.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={rings} fill="none" stroke={tint(p.colors.background, 0.4)} strokeWidth={0.9} opacity={0.6} />
      <path d={leaves} fill={n.leaf} />
      <path d={tone[0]} fill={haze(FLORA.marigold)} />
      <path d={tone[1]} fill={haze(FLORA.marigoldDeep)} />
      <path d={top} fill={haze(FLORA.marigoldLight)} />
      {/* the diya: a clay boat with a flame */}
      <path d={`M${dx - 9} ${dy - 2}q9 9 19 -1h-4Z`} fill={n.clay} stroke={n.clayDark} strokeWidth={0.8} />
      <circle cx={dx + 3} cy={dy - 9} r={9} fill={url(id('fl'))} />
      <path d={`M${dx + 3} ${dy - 3}q-3 -4 0 -10q3 6 0 10Z`} fill={n.flame} />
    </Svg>
  );
}

// ─────────────────────────── LanternLine ───────────────────────────

/** Where the line hangs from (local y at the walls) and how far it sags (units). */
const LINE = { end: 8, sag: 30 } as const;
const lineSeg = (w: number): Segment => [[0, LINE.end], [w / 3, LINE.end + LINE.sag * 1.33], [(2 * w) / 3, LINE.end + LINE.sag * 1.33], [w, LINE.end]];
/** The line's local y at local x (its control points are evenly spaced in x, so t = x / w). */
const lineY = (w: number, x: number) => onCubic(lineSeg(w), Math.min(1, Math.max(0, x / w))).y;

/**
 * A rope strung wall to wall across the court (box w×70, hung from its top),
 * dressed with marigold balls and mango-leaf tassels like a bandanwar, with a
 * brass hook at each wall; the lanterns hang from it as their own pieces. The
 * balls are a dotted stroke along the rope (a zero dash with round caps).
 */
function LanternLine(p: DrawProps) {
  const { w, nature: n, colors: c } = p;
  const id = idsOf(p, 'll');
  const haze = hazer(n);
  const low = p.detail === 'low';
  const seg = lineSeg(w);
  const rope = cubic(seg);
  const gap = low ? 36 : 24;
  let leaves = '';
  for (let x = gap; x < w - gap / 2; x += gap) leaves += leaf(x, lineY(w, x) + 1, 15, 3.6, 0.12, 0.99);
  return (
    <Svg p={p}>
      <defs>
        <Metal id={id('m')} base={c.secondary} x2={w} y2={20} />
      </defs>
      <path d={rope} fill="none" stroke={shade(mix(n.clayDark, c.text, 0.3), 0.1)} strokeWidth={2.2} />
      <path d={leaves} fill={n.leaf} />
      <path d={rope} fill="none" stroke={haze(FLORA.marigold)} strokeWidth={10} strokeLinecap="round" strokeDasharray={`0 ${gap}`} strokeDashoffset={-gap / 2} transform="translate(0 4)" />
      <path d={rope} fill="none" stroke={haze(FLORA.marigoldLight)} strokeWidth={5} strokeLinecap="round" strokeDasharray={`0 ${gap}`} strokeDashoffset={-gap / 2} transform="translate(-1.4 2.6)" />
      <path d={`M2 ${LINE.end - 6}v10h6M${w - 2} ${LINE.end - 6}v10h-6`} stroke={url(id('m'))} strokeWidth={3} fill="none" />
    </Svg>
  );
}

// ─────────────────────────── FountainSpray ───────────────────────────

/** The tiered fountain's moving water (box 300×346, over the fountain): a crown jet, falling arcs, droplets and splash rings, glinting gold. */
function FountainSpray(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = idsOf(p, 'fs');
  const low = p.detail === 'low';
  const water = tint(mix(c.background, c.accent, 0.25), 0.4);
  const cx = w / 2;
  const top = h * 0.06;
  const arcs: Segment[] = [
    [[cx, top + 30], [cx - 8, top - 6], [cx - 38, top - 2], [cx - 52, top + 66]],
    [[cx, top + 30], [cx + 8, top - 6], [cx + 38, top - 2], [cx + 52, top + 66]],
    [[cx, top + 30], [cx - 4, top - 18], [cx - 18, top - 14], [cx - 26, top + 54]],
    [[cx, top + 30], [cx + 4, top - 18], [cx + 18, top - 14], [cx + 26, top + 54]],
  ];
  const drops = low ? '' : Array.from({ length: 11 }, (_, i) => circle(cx + (rand(i, 71) - 0.5) * w * 0.8, top + 40 + rand(i, 72) * h * 0.7, r2(1.2 + rand(i, 73) * 1.3))).join('');
  const jets = [taper([[[cx, top + 58], [cx - 2, top + 30], [cx + 2, top + 12], [cx, top - 8]]], [7, 1.5], 10), ...arcs.map((a) => taper([a], [3.2, 1], 10))].join('');
  return (
    <Svg p={p}>
      <defs>
        <linearGradient id={id('jet')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(light.color, 0.7)} stopOpacity="0.95" />
          <stop offset="1" stopColor={water} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path d={jets} fill={url(id('jet'))} />
      {drops ? <path d={drops} fill={tint(light.color, 0.6)} opacity={0.85} /> : null}
      <path d={`M${q(cx - w * 0.42)} ${q(h * 0.94)}a${q(w * 0.42)} 7 0 1 0 ${q(w * 0.84)} 0M${q(cx - w * 0.3)} ${q(h * 0.6)}a${q(w * 0.3)} 5 0 1 0 ${q(w * 0.6)} 0`} fill="none" stroke={tint(light.color, 0.5)} strokeWidth={1.5} opacity={0.55} />
    </Svg>
  );
}

// ─────────────────────────── BougainvilleaSwag ───────────────────────────

/**
 * The near frame (box 960×110, hung from above the frame): bougainvillea
 * trained along the pergola's front beam in three scallops, the middle one
 * centred over the words, with a trailing strand at each tie. The box keeps
 * to the crown band at every rig extreme. Lit from the key side.
 */
function BougainvilleaSwag(p: DrawProps) {
  const { w, h, nature: n, light } = p;
  const low = p.detail === 'low';
  const haze = hazer(n);
  const fromLeft = light.from !== 'right';
  const tieY = h * 0.4;
  const dip = h * 0.74;
  const ctrl = (dip - 0.25 * tieY) / 0.75;
  const ties = [-12, w / 3, (2 * w) / 3, w + 12];
  const leaves = ['', '', ''];
  const flowers = ['', '', ''];
  let rope = '';
  for (let k = 0; k < 3; k++) {
    const x0 = ties[k]!;
    const x1 = ties[k + 1]!;
    const seg: Segment = [[x0, tieY], [x0 + (x1 - x0) * 0.28, ctrl], [x1 - (x1 - x0) * 0.28, ctrl], [x1, tieY]];
    rope += cubic(seg);
    vine(seg, low ? 16 : 29, 101 + k * 29, 1.25, (t) => 9 + Math.abs(t - 0.5) * 16, leaves, flowers, 0.4);
  }
  // A trailing strand from each inner tie, and two short drips from the middle scallop.
  const drips: Array<[number, number, number]> = [
    [w / 3, tieY, h - 8 - tieY],
    [(2 * w) / 3, tieY, h - 8 - tieY],
    [w * 0.43, dip + 2, h - 6 - dip],
    [w * 0.58, dip + 2, h - 8 - dip],
  ];
  drips.forEach(([x, y, fall], k) => {
    const sway = (rand(k, 301) - 0.5) * 14;
    const strand: Segment = [[x, y], [x + sway, y + fall * 0.35], [x - sway * 0.6, y + fall * 0.7], [x + sway * 0.3, y + fall]];
    rope += cubic(strand);
    vine(strand, low ? 2 : fall > 30 ? 5 : 2, 311 + k * 13, 1, () => 5, leaves, flowers, 0.2);
  });
  // Key-side leaves take the light tone, the far side the dark.
  const tone = fromLeft ? [haze(NATURE.leafDark), haze(NATURE.leaf), haze(NATURE.leafLight)] : [haze(NATURE.leafLight), haze(NATURE.leaf), haze(NATURE.leafDark)];
  return (
    <Svg p={p}>
      <path d={rope} fill="none" stroke={shade(n.clayDark, 0.15)} strokeWidth={3} />
      <path d={leaves[0]} fill={tone[0]} />
      <path d={leaves[1]} fill={tone[1]} />
      <path d={leaves[2]} fill={tone[2]} />
      <path d={flowers[2]} fill={haze(FLORA.bractDeep)} />
      <path d={flowers[0]} fill={haze(FLORA.bract)} />
      <path d={flowers[1]} fill={haze(FLORA.bractLight)} />
    </Svg>
  );
}

// ─────────────────────────── BougainvilleaUrn ───────────────────────────

/**
 * A painted terracotta matka of bougainvillea (box 180×260, standing): a
 * domed bush of leaves crowned and spilling with magenta bracts, two strands
 * cascading over the rim, the pot's belly banded in the palette's primary with
 * lime-white dots, a contact shadow at its foot. Lit from the key side. Drawn
 * here rather than with the kit's Planter: bloom-heavy, and a third of its
 * markup (the set's budget).
 */
function BougainvilleaUrn(p: DrawProps) {
  const { w, h, colors: c, nature: n, light } = p;
  const id = idsOf(p, 'bu');
  const low = p.detail === 'low';
  const haze = hazer(n);
  const side = light.from === 'right' ? -1 : 1;
  const X = (f: number) => q(w * (side > 0 ? f : 1 - f));
  const Y = (f: number) => q(h * f);
  const salt = 7 + (Math.abs(Math.round(p.seed)) % 31);
  // The bush: a base of overlapping lobes, then leaves and flowers over it.
  const cx = w / 2;
  const cy = h * 0.4;
  const lobe = (list: ReadonlyArray<readonly [number, number, number]>) => list.map(([dx, dy, r]) => circle(cx + dx * w, cy + dy * h, q(r * w))).join('');
  const under = lobe([
    [-0.22, 0.1, 0.22],
    [0.22, 0.1, 0.22],
    [0, 0.1, 0.3],
  ]);
  const lobes = lobe([
    [0, -0.01, 0.33],
    [-0.25, 0.04, 0.2],
    [0.25, 0.03, 0.21],
    [-0.13, -0.13, 0.24],
    [0.14, -0.14, 0.23],
    [0, -0.22, 0.2],
  ]);
  const leaves = ['', '', ''];
  const flowers = ['', '', ''];
  const count = low ? 22 : 40;
  for (let i = 0, k = 0; i < count * 3 && k < count; i++) {
    const u = rand(i, salt) * 2 - 1;
    const v = rand(i, salt + 1) * 2 - 1;
    if (u * u + v * v > 1) continue;
    k++;
    const x = cx + u * w * 0.42;
    const y = cy + v * h * 0.28;
    const len = Math.sqrt(u * u + v * v) || 1;
    const [jx, jy] = dirOf(i, salt + 2);
    const dx = u / len + jx * 0.6;
    const dy = v / len + jy * 0.6 - 0.2;
    const dl = Math.sqrt(dx * dx + dy * dy) || 1;
    // Lit on the key side and on top, dark underneath and away.
    const lit = u * side - v;
    const tone = lit > 0.5 ? 2 : lit > -0.3 ? 1 : 0;
    leaves[tone] += leaf(x, y, 13 + rand(i, salt + 3) * 6, 4.6, dx / dl, dy / dl);
    if (v < 0.6 && rand(i, salt + 4) > 0.12) flowers[tone === 2 ? 1 : tone === 1 ? 0 : 2] += flower(x + jx * 6, y + jy * 5, 9 + rand(i, salt + 5) * 5, i, salt + 6, 0.68);
  }
  // A fringe of leaves round the dome's silhouette, pointing out.
  for (let i = 0; i < (low ? 10 : 20); i++) {
    const u = (i + 0.5) / (low ? 10 : 20) * 2 - 1;
    const v = -Math.sqrt(1 - u * u) * (0.75 + rand(i, salt + 20) * 0.25);
    const x = cx + u * w * 0.44;
    const y = cy + 0.04 * h + v * h * 0.3;
    const l = Math.sqrt(u * u + v * v) || 1;
    leaves[u * side - v > 0.4 ? 2 : 1] += leaf(x, y, 12 + rand(i, salt + 21) * 5, 4.4, u / l, v / l);
  }
  // Two strands over the rim, the longer on the key side.
  vine([[X(0.3), Y(0.6)], [X(0.12), Y(0.64)], [X(0.06), Y(0.74)], [X(0.1), Y(0.86)]], low ? 4 : 8, salt + 40, 0.9, () => 6, leaves, flowers, 0.15);
  vine([[X(0.72), Y(0.6)], [X(0.88), Y(0.64)], [X(0.92), Y(0.7)], [X(0.88), Y(0.77)]], low ? 3 : 5, salt + 60, 0.85, () => 5, leaves, flowers, 0.15);
  const clay = mix(n.clay, c.primary, 0.25);
  const pot = `M${X(0.27)} ${Y(0.57)}C${X(0.12)} ${Y(0.62)} ${X(0.05)} ${Y(0.82)} ${X(0.3)} ${Y(0.98)}H${X(0.7)}C${X(0.95)} ${Y(0.82)} ${X(0.88)} ${Y(0.62)} ${X(0.73)} ${Y(0.57)}Z`;
  const band = `M${X(0.13)} ${Y(0.7)}Q${X(0.5)} ${Y(0.77)} ${X(0.87)} ${Y(0.7)}`;
  return (
    <Svg p={p}>
      <defs>
        <linearGradient id={id('pot')} x1={side > 0 ? '0' : '1'} y1="0" x2={side > 0 ? '1' : '0'} y2="0">
          <stop offset="0" stopColor={tint(clay, 0.12)} />
          <stop offset="0.3" stopColor={tint(clay, 0.22)} />
          <stop offset="0.65" stopColor={clay} />
          <stop offset="1" stopColor={shade(clay, 0.38)} />
        </linearGradient>
      </defs>
      <ellipse cx={q(cx)} cy={Y(0.975)} rx={q(w * 0.36)} ry={7} fill="#000000" opacity={0.22} />
      <path d={pot} fill={url(id('pot'))} />
      <path d={band} fill="none" stroke={c.primary} strokeWidth={12} />
      {!low ? <path d={band} fill="none" stroke={c.background} strokeWidth={3.2} strokeLinecap="round" strokeDasharray="0 9" /> : null}
      <path d={`M${X(0.17)} ${Y(0.66)}Q${X(0.5)} ${Y(0.72)} ${X(0.83)} ${Y(0.66)}M${X(0.13)} ${Y(0.745)}Q${X(0.5)} ${Y(0.815)} ${X(0.87)} ${Y(0.745)}`} fill="none" stroke={c.secondary} strokeWidth={1.6} />
      <path d={`M${X(0.24)} ${Y(0.55)}h${X(0.76) - X(0.24)}v${Y(0.04)}h${X(0.24) - X(0.76)}Z`} fill={shade(clay, 0.2)} />
      <path d={under} fill={haze(NATURE.leafDark)} />
      <path d={lobes} fill={haze(NATURE.leaf)} />
      <path d={leaves[0]} fill={shade(haze(NATURE.leafDark), 0.15)} />
      <path d={leaves[1]} fill={haze(NATURE.leaf)} />
      <path d={leaves[2]} fill={haze(NATURE.leafLight)} />
      <path d={flowers[2]} fill={haze(FLORA.bractDeep)} />
      <path d={flowers[0]} fill={haze(FLORA.bract)} />
      <path d={flowers[1]} fill={haze(FLORA.bractLight)} />
    </Svg>
  );
}

// ─────────────────────────── the court's water and the arcades' shade ───────────────────────────

/**
 * The court floor (kit, with its rill) and the rill's water over it: deep and still near the guest, catching the
 * golden sky toward the fountain, with the low sun's ripples in gold and its glints. A pale channel read as a
 * runner; water darker than its coping reads as a pool on every screen.
 */
function CourtFloor(p: DrawProps): ReactNode {
  const { w, h, colors: c, light } = p;
  const id = idsOf(p, 'cf');
  const g = p.plane ?? { x0: 0, x1: w, y0: 800, y1: 800, dNear: 0, dFar: h };
  const cx = 600 - g.x0;
  const fy = (d: number) => q(g.dFar - d);
  const top = fy(2210);
  // Still water over a dark bed: the deep green of a stepwell, from the leaves' own tone.
  const deep = mix(mix(p.nature.leafDark, c.text, 0.3), c.muted, 0.18);
  const sky = mix(mix(c.accent, light.color, 0.45), c.background, 0.2);
  const ripples = Array.from({ length: p.detail === 'low' ? 10 : 22 }, (_, i) => {
    const y = q(top + ((i + rand(i, 41) * 0.7) / (p.detail === 'low' ? 10 : 22)) * (h - top));
    const lw = q(12 + rand(i, 42) * 30);
    return `M${q(cx - 34 + rand(i, 43) * (68 - lw))} ${y}h${lw}`;
  }).join('');
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Floor {...p} variant="terracotta" channel pools={COURT_POOLS} />
      <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <linearGradient id={id('w')} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={q(h)}>
            <stop offset="0" stopColor={sky} />
            <stop offset="0.22" stopColor={mix(sky, deep, 0.5)} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
        </defs>
        <rect x={q(cx - 40)} y={top} width={80} height={q(h - top)} fill={url(id('w'))} />
        <path d={ripples} stroke={tint(light.color, 0.35)} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
        <path d={`M${q(cx - 40)} ${top}V${q(h)}`} stroke="#000000" strokeWidth={6} opacity={0.18} />
      </svg>
    </div>
  );
}

const COURT_POOLS = [
  { x: 400, d: 950, r: 120, color: '#ffd28a' },
  { x: 800, d: 950, r: 120, color: '#ffd28a' },
  { x: 600, d: 2300, r: 260, color: '#ffd28a' },
  { x: 380, d: 2700, r: 300, color: '#ffe2a0' },
];

/**
 * The kit's scalloped arcade at low detail, warmed for the hour: the wall turned from the sun keeps a warm
 * shade (not grey), and lamplight glows deep inside every arch, so the openings read as a lit gallery behind
 * the piers instead of flat cut-outs.
 */
function Arcade(p: DrawProps): ReactNode {
  const { w, h, colors: c, light } = p;
  const id = idsOf(p, 'ar');
  const away = (p.plane?.x0 ?? 0) > 600 ? light.from === 'right' : light.from === 'left';
  const y0 = p.plane?.y0 ?? 800 - h;
  const Y = (wy: number) => q(wy - y0);
  const P = 340;
  const ember = mix(c.primary, light.color, 0.35);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Wall {...p} variant="scalloped" detail="low" />
      <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <radialGradient id={id('g')} cx="50%" cy="62%" r="50%">
            <stop offset="0" stopColor={tint(light.color, 0.3)} stopOpacity={0.78} />
            <stop offset="0.55" stopColor={light.color} stopOpacity={0.38} />
            <stop offset="1" stopColor={light.color} stopOpacity={0} />
          </radialGradient>
          <pattern id={id('p')} width={2 * P} height={q(h)} patternUnits="userSpaceOnUse">
            {[P / 2, P * 1.5].map((x) => (
              <ellipse key={x} cx={x} cy={Y(650)} rx={110} ry={190} fill={url(id('g'))} />
            ))}
          </pattern>
        </defs>
        {away ? <rect width={r2(w)} height={r2(h)} fill={ember} opacity={0.3} /> : null}
        <rect width={r2(w)} height={r2(h)} fill={url(id('p'))} />
      </svg>
    </div>
  );
}

// ─────────────────────────── the set ───────────────────────────

/** The near and far marigold lines: depth and the height they hang from at the walls. */
const LINES = [
  { d: 950, top: 284 },
  { d: 1400, top: 290 },
] as const;
const LINE_X0 = 252;
const LINE_W = 696;
const LANTERN = { w: 60, h: 160 } as const;
export const courtyard: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const L = '#ffd28a';
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, role: Piece['role'], recipe: PlaneRecipe, draw: Draw): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw });
  };

  // Planes: the terracotta court with its rill, the scalloped arcades. The sky is the set's CSS gradient
  // (a sky plane would cost pixels and markup for a strip the arcades and the far wing mostly hide). Court and
  // arcades begin at the arrival's gate (z +250, d −250), so the guest walks through it straight into the court.
  plane('court', 'floor:terracotta', 'architecture', floor({ x0: 250, x1: 950, dNear: -250, dFar: 3000 }), CourtFloor);
  plane('arcade-l', 'wall:scalloped', 'architecture', wall('left', { x: 250, yTop: 300, dNear: -250, dFar: 3000 }), Arcade);
  plane('arcade-r', 'wall:scalloped', 'architecture', wall('right', { x: 950, yTop: 300, dNear: -250, dFar: 3000 }), Arcade);

  // The far wing of the haveli with its carved gate (closes the court in front of the walls' end).
  pieces.push({ kind: 'prop', id: 'haveli-gate', art: 'haveliGate', role: 'architecture', ...billboard({ x: 600, d: 2900, w: LINE_W, h: 470 }), draw: HaveliGate });

  // The focal fountain and its moving water.
  pieces.push({ kind: 'prop', id: 'fountain', art: 'fountain:tiered', role: 'focal', ...billboard({ x: 600, d: 2300, w: 300, h: 346 }), draw: drawWith(Fountain, { variant: 'tiered' }), buildIn: 'rise' });
  pieces.push({ kind: 'prop', id: 'fountain-spray', art: 'fountainSpray', role: 'prop', ...billboard({ x: 600, d: 2290, w: 300, h: 346 }), draw: FountainSpray, motion: { kind: 'shimmer', amp: 0.45, period: 2.6 }, buildIn: 'fade' });

  // Marigolds and diyas floating down the pool.
  pieces.push({ kind: 'prop', id: 'marigolds-near', art: 'floatingMarigolds', role: 'prop', ...billboard({ x: 596, d: 1300, w: 80, h: 30 }), draw: FloatingMarigolds, motion: { kind: 'bob', amp: 3, period: 4 }, buildIn: 'bloom' });
  pieces.push({ kind: 'prop', id: 'marigolds-far', art: 'floatingMarigolds', role: 'prop', ...billboard({ x: 605, d: 1800, w: 80, h: 30 }), draw: FloatingMarigolds, motion: { kind: 'bob', amp: 3, period: 4, phase: 0.45 }, buildIn: 'bloom' });

  // Bougainvillea in painted matkas flanking the pool's near end (two unflipped instances: each keeps the key light).
  for (const [k, x] of [
    ['l', 375],
    ['r', 825],
  ] as const)
    pieces.push({ kind: 'prop', id: `planter-${k}`, art: 'bougainvilleaUrn', role: 'prop', ...billboard({ x, d: 1100, w: 180, h: 260 }), draw: BougainvilleaUrn });

  // Marigold lines strung wall to wall, brass lanterns swaying from them.
  LINES.forEach((line, i) => {
    pieces.push({ kind: 'prop', id: `line-${i}`, art: 'lanternLine', role: 'hanging', ...hang({ x: LINE_X0 + LINE_W / 2, d: line.d, w: LINE_W, h: 70, top: line.top }), draw: LanternLine });
    for (const [k, x] of [
      ['l', 400],
      ['r', 800],
    ] as const) {
      const top = line.top + lineY(LINE_W, x - LINE_X0) - 2;
      pieces.push({
        kind: 'prop',
        id: `lantern-${i}${k}`,
        art: 'hangingLantern:brass',
        role: 'hanging',
        ...hang({ x, d: line.d, w: LANTERN.w, h: LANTERN.h, top }),
        draw: drawWith(HangingLantern, { variant: 'brass' }),
        motion: { kind: 'sway', amp: 2.5, period: 6.5, phase: (i * 2 + (k === 'l' ? 0 : 1)) * 0.23 },
        buildIn: 'drop',
      });
    }
  });

  // The near frame: bougainvillea festooned along the pergola over the guest's head.
  pieces.push({ kind: 'prop', id: 'swag', art: 'bougainvilleaSwag', role: 'hanging', ...hang({ x: 600, d: 560, w: 960, h: 110, top: -90 }), draw: BougainvilleaSwag, motion: { kind: 'sway', amp: 0.5, period: 9 }, buildIn: 'drop' });

  // Lights: the near lanterns' glows, and the low sun behind the far wing.
  for (const [k, x] of [
    ['l', 400],
    ['r', 800],
  ] as const) {
    const top = LINES[0].top + lineY(LINE_W, x - LINE_X0);
    pieces.push({ kind: 'light', id: `glow-${k}`, art: 'glow', role: 'light', at: { x, y: top + 100, z: -LINES[0].d + 1 }, r: 50, color: L, strength: 0.5, motion: { kind: 'flicker', amp: 0.25, period: 2.1, phase: k === 'l' ? 0 : 0.4 }, buildIn: 'light' });
  }
  pieces.push({ kind: 'light', id: 'sun', art: 'sun', role: 'light', at: { x: 420, y: 400, z: -3050 }, r: 300, color: '#ffe2a0', strength: 0.35, buildIn: 'light' });

  return {
    name: 'courtyard',
    // The low sun setting just west of the far wing (the key light's side), its glow below the names; the sky warms toward it.
    sky: `radial-gradient(circle at 40% 56%, rgba(255, 246, 222, 0.95) 0%, rgba(255, 226, 160, 0.75) 3%, rgba(255, 210, 138, 0.32) 11%, rgba(255, 210, 138, 0) 26%), linear-gradient(180deg, ${mix(mix(c.accent, c.background, 0.3), c.primary, 0.1)} 0%, ${mix(c.accent, L, 0.3)} 34%, ${mix(c.accent, L, 0.6)} 56%, ${mix(c.surface, c.primary, 0.25)} 100%)`,
    light: { from: 'left', color: L, rim: '#fff0d0' },
    fog: { color: '#f3e2c4', near: 1500, far: 3200, max: 0.35 },
    veil: 0.25,
    focus: { x: 600, y: 640, z: -2300 },
    // The far pose stays inside the pergola: from further out the festoon would hang in an empty sky.
    poses: { far: { x: 600, y: 300, z: 420, yaw: 0, pitch: 0, roll: 0, fov: 52 } },
    pieces,
    covers: { gate: 'haveli', door: 'haveli', silk: 'damask', card: 'trifold' },
    particles: { count: 20, dNear: 700, dFar: 2300 },
  };
};
