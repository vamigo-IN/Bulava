import type { ReactNode } from 'react';
import { mix } from '../../theme';
import { metalStops, NATURE, onCubic, taper, type Segment } from '../../art/kit';
import { KadambaTree, Palm, r2, rand } from '../../art/motifs';
import type { DrawProps, KeyLight } from '../types';
import type { KitEntry } from './place';

/**
 * Nature (final.md §6.1): planters, trees and the banana plant, drawn as
 * upright elevations that stand on the floor (the box's foot is the ground).
 * Leaves, flowers and flames take p.nature (fixed natural colours, already
 * hazed); pots, brass and lime-wash take the palette. Every piece is lit from
 * p.light: the side away from the key is 25% darker and carries a thin rim in
 * p.light.rim; a back light (`far`) darkens the fronts and rims both edges.
 */

export type PlanterPlant = 'palm' | 'bougainvillea' | 'roses' | 'tulsi';
export interface PlanterOptions {
  plant: PlanterPlant;
}
export type TreeVariant = 'kadamba' | 'campus' | 'mango';
export interface TreeOptions {
  variant: TreeVariant;
}

/** Default boxes (units) per piece and variant (BananaPlant has no variant: ''). */
export const NATURE_BOXES = {
  Planter: { palm: { w: 160, h: 330 }, bougainvillea: { w: 180, h: 260 }, roses: { w: 120, h: 180 }, tulsi: { w: 100, h: 180 } },
  Tree: { kadamba: { w: 340, h: 470 }, campus: { w: 340, h: 470 }, mango: { w: 340, h: 470 } },
  BananaPlant: { '': { w: 140, h: 420 } },
} as const;

/** Bougainvillea's magenta bracts: a real flower's colour, fixed like NATURE. */
export const BOUGAINVILLEA = '#c2185b';

/** Other real flowers and fruit, fixed like NATURE and hazed with the piece. */
const FLORA = {
  bractDeep: '#8e0f45',
  bractLight: '#ea5c9e',
  rose: '#c8344f',
  tulsiSpike: '#6a3d63',
  kadamba: '#f6c343',
  mango: '#f2b134',
  mangoBlush: '#d9622b',
  banana: '#a9bd3e',
  bananaHeart: '#6e1f3c',
  marigold: '#f57c00',
  marigoldLight: '#ffb300',
} as const;

// ─────────────────────────── drawing helpers ───────────────────────────

type Nature = DrawProps['nature'];
type Stop = readonly [number, string, number?];
type Lobe = readonly [number, number, number];

const hx = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#808080');
const dk = (c: string, a: number) => mix(hx(c), '#000000', a);
const lt = (c: string, a: number) => mix(hx(c), '#ffffff', a);
const bl = (a: string, b: string, t: number) => mix(hx(a), hx(b), t);
/** Whole units: these pieces show at well under a pixel per unit, so the markup stays small. */
const n0 = (v: number) => Math.round(v);
const pt = (x: number, y: number) => `${n0(x)} ${n0(y)}`;
/** A circle as a sub-path (lobes merge into one path). */
const ring = (x: number, y: number, r: number) => `M${n0(x - r)} ${n0(y)}a${n0(r)} ${n0(r)} 0 1 0 ${n0(2 * r)} 0a${n0(r)} ${n0(r)} 0 1 0 ${n0(-2 * r)} 0`;

/** Twelve directions round a circle (30° apart): positions without trigonometry. */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.87, 0.5],
  [0.5, 0.87],
  [0, 1],
  [-0.5, 0.87],
  [-0.87, 0.5],
  [-1, 0],
  [-0.87, -0.5],
  [-0.5, -0.87],
  [0, -1],
  [0.5, -0.87],
  [0.87, -0.5],
];

/** The fog the engine mixed into p.nature, applied to another fixed natural colour (bracts, roses, fruit). */
function hazer(n: Nature): (c: string) => string {
  const ch = (c: string, s: number) => (Number.parseInt(hx(c).slice(1), 16) >> s) & 255;
  const keep = Math.min(1, Math.max(0, (ch(n.flame, 16) - ch(n.leafDark, 16)) / (ch(NATURE.flame, 16) - ch(NATURE.leafDark, 16))));
  if (keep > 0.995) return hx;
  return (c) => `#${[16, 8, 0].map((s) => Math.min(255, Math.max(0, Math.round(ch(n.flame, s) + keep * (ch(c, s) - ch(NATURE.flame, s))))).toString(16).padStart(2, '0')).join('')}`;
}

function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Ids from everything the gradients depend on: two pieces that share an id draw identical defs. */
const idOf = (p: DrawProps, tag: string) =>
  `nt${tag}${p.seed}-${hashOf([p.w, p.h, p.detail, p.colors.primary, p.colors.secondary, p.colors.accent, p.colors.surface, p.colors.text, p.nature.leaf, p.nature.clay, p.nature.flame, p.light.from, p.light.rim].join('|'))}`;

interface Lighting {
  /** -1 lit from the left, 1 from the right, 0 from above, below or behind. */
  side: number;
  back: boolean;
  rim: string;
}
const lightingOf = (l: KeyLight): Lighting => ({ side: l.from === 'left' ? -1 : l.from === 'right' ? 1 : 0, back: l.from === 'far', rim: hx(l.rim) });

/** A round body lit from the side: highlight toward the key, the far side 25% darker, a rim on the edge away. */
function cylStops(base: string, L: Lighting, metal = false): Stop[] {
  const b = hx(base);
  let s: Stop[] =
    L.side === 0
      ? metal
        ? [
            [0, dk(b, 0.34)],
            [0.3, lt(b, 0.3)],
            [0.46, lt(b, 0.55)],
            [0.62, b],
            [1, dk(b, 0.3)],
          ]
        : [
            [0, dk(b, 0.28)],
            [0.4, b],
            [0.52, lt(b, 0.1)],
            [0.66, b],
            [1, dk(b, 0.28)],
          ]
      : metal
        ? metalStops(b, true).map(([o, c]) => [o, c] as Stop)
        : [
            [0, dk(b, 0.22)],
            [0.2, lt(b, 0.16)],
            [0.42, lt(b, 0.05)],
            [0.64, b],
            [0.88, dk(b, 0.25)],
          ];
  if (L.back) s = s.map(([o, c]) => [o, dk(c, 0.2)] as Stop);
  const edge = dk(b, L.back ? 0.42 : 0.3);
  const rim = bl(edge, L.rim, 0.7);
  if (L.side !== 0 || L.back) s = [...s.filter(([o]) => o < 0.94), [0.95, edge], [0.975, rim], [1, rim]];
  if (L.back) s = [[0, rim], [0.025, rim], [0.05, edge], ...s.filter(([o]) => o > 0.06)];
  return L.side === 1 ? s.map(([o, c, a]) => [r2(1 - o), c, a] as Stop).reverse() : s;
}

/** Shade laid over painted detail on a round or square body (transparent toward the key). */
function overStops(shade: string, L: Lighting): Stop[] {
  if (L.back) {
    return [
      [0, shade, 0.34],
      [0.5, shade, 0.18],
      [1, shade, 0.34],
    ];
  }
  if (L.side === 0) {
    return [
      [0, shade, 0.22],
      [0.5, shade, 0],
      [1, shade, 0.22],
    ];
  }
  const s: Stop[] = [
    [0, shade, 0.06],
    [0.45, shade, 0],
    [0.68, shade, 0.12],
    [1, shade, 0.3],
  ];
  return L.side === 1 ? s.map(([o, c, a]) => [r2(1 - o), c, a] as Stop).reverse() : s;
}

function Grad({ id, stops, x1, x2, y1 = 0, y2 = 0 }: { id: string; stops: readonly Stop[]; x1?: number; x2?: number; y1?: number; y2?: number }) {
  const user = x1 !== undefined && x2 !== undefined;
  return (
    <linearGradient id={id} gradientUnits={user ? 'userSpaceOnUse' : undefined} x1={user ? x1 : 0} x2={user ? x2 : 1} y1={y1} y2={y2}>
      {stops.map(([o, c, a], i) => (
        <stop key={i} offset={r2(o)} stopColor={c} stopOpacity={a} />
      ))}
    </linearGradient>
  );
}

/** The piece's root: drawn in its default box, kept in proportion and standing on the box's foot. */
function Art({ box, children }: { box: { w: number; h: number }; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="xMidYMax meet" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {children}
    </svg>
  );
}

/** A soft contact shadow on the ground. */
const Ground = ({ p, x, y, rx }: { p: DrawProps; x: number; y: number; rx: number }) => <ellipse cx={x} cy={y} rx={rx} ry={r2(Math.max(2.5, rx * 0.06))} fill={dk(p.colors.text, 0.35)} opacity={0.24} />;

/** Leaf texture: scattered dark leaves in four turns, laid over a canopy's lit mass so it never reads as a flat blob. */
function LeafTexture({ id, n }: { id: string; n: Nature }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="30" height="26" patternTransform="rotate(17)">
      <path d="M2 6q4-5 9-1q-4 4-9 1ZM16 3q2 5 7 6q-2-5-7-6ZM8 17q5-3 9 1q-5 2-9-1ZM21 19q1-5 6-7q0 5-6 7ZM12 11q3-2 6 0q-3 2-6 0Z" fill={dk(n.leafDark, 0.15)} />
    </pattern>
  );
}

/**
 * A leaf mass: lobes plus seeded clumps round their rims (only those on the
 * silhouette), the lit mass offset toward the key over a dark base, a leaf
 * texture, sunlit clumps on each lobe's lit shoulder, and the rim light
 * peeking out on the side away.
 */
function Canopy({ id, lobes, seed, n, L, full, lit = 0.75 }: { id: string; lobes: readonly Lobe[]; seed: number; n: Nature; L: Lighting; full: boolean; lit?: number }) {
  const clumps: Lobe[] = [];
  lobes.forEach(([x, y, r], j) => {
    const k = full ? 5 : 3;
    for (let i = 0; i < k; i++) {
      const d = DIRS[(Math.round((i * 12) / k) + Math.floor(rand(j * 11 + i, seed) * 2)) % 12]!;
      const reach = r * (0.8 + rand(i, seed + j * 3 + 1) * 0.12);
      const c: Lobe = [x + d[0] * reach, y + d[1] * reach * 0.92, r * (0.24 + rand(j, seed + i * 5 + 2) * 0.13)];
      if (!lobes.some(([ox, oy, or], o) => o !== j && (c[0] - ox) ** 2 + (c[1] - oy) ** 2 < (or * 0.82) ** 2)) clumps.push(c);
    }
  });
  const all = [...lobes, ...clumps];
  const sx = L.side;
  const path = (list: readonly Lobe[], dx: number, dy: number, k: number) => list.map(([x, y, r]) => ring(x + dx * r, y + dy * r, r * k)).join('');
  const darkC = L.back ? dk(n.leafDark, 0.18) : n.leafDark;
  const midC = L.back ? bl(n.leaf, n.leafDark, 0.45) : n.leaf;
  // Sunlit clumps: a few small ones on each lobe's shoulder toward the key, and one on each silhouette clump.
  const lx = sx * 0.7;
  const ly = sx === 0 ? -1 : -0.7;
  const sun: Lobe[] = [];
  lobes.forEach(([x, y, r], j) => {
    for (let i = 0; i < (full ? 3 : 2); i++) {
      const d = DIRS[(Math.floor(rand(i, seed + j * 13 + 5) * 12)) % 12]!;
      const k = 0.42 + rand(j + i, seed + 17) * 0.2;
      sun.push([x + lx * r * k + d[0] * r * 0.22, y + ly * r * k + d[1] * r * 0.18, r * (0.17 + rand(i * 7 + j, seed + 19) * 0.12)]);
    }
  });
  return (
    <g>
      <defs>
        <path id={`${id}b`} d={path(all, 0, 0, 1)} />
        <path id={`${id}m`} d={L.back ? path(all, 0, 0.12, 0.88) : path(all, sx * 0.1, -0.12, 0.84)} />
        {full ? <LeafTexture id={`${id}t`} n={n} /> : null}
        {L.back ? null : <path id={`${id}l`} d={path(all, sx * 0.26, -0.3, 0.6)} />}
      </defs>
      {L.back ? (
        <use href={`#${id}b`} fill={L.rim} opacity={0.5} transform="translate(0 -1.6)" />
      ) : sx !== 0 ? (
        <use href={`#${id}b`} fill={L.rim} opacity={0.45} transform={`translate(${-sx * 1.4} -0.6)`} />
      ) : null}
      <use href={`#${id}b`} fill={L.back ? bl(n.leaf, L.rim, 0.28) : darkC} />
      <use href={`#${id}m`} fill={midC} />
      {L.back ? <path d={path(lobes, 0, 0.3, 0.62)} fill={darkC} opacity={0.28} /> : null}
      {full ? <use href={`#${id}m`} fill={`url(#${id}t)`} opacity={0.55} /> : null}
      {L.back ? null : (
        <>
          <use href={`#${id}l`} fill={bl(n.leaf, n.leafLight, 0.55)} opacity={lit} />
          {full ? <use href={`#${id}l`} fill={`url(#${id}t)`} opacity={0.4} /> : null}
          <path d={sun.filter((_, i) => i % 2 === 0).map(([x, y, r]) => ring(x + lx * r, y + ly * r, r * 0.7)).join('')} fill={n.leafLight} opacity={lit} />
        </>
      )}
    </g>
  );
}

/** Trunks and limbs: tapered, lit as round wood, the rim behind them on the side away, a few bark lines. */
function Limbs({ id, parts, n, L, full }: { id: string; parts: ReadonlyArray<{ seg: readonly Segment[]; w: readonly number[] }>; n: Nature; L: Lighting; full: boolean }) {
  const bark = bl(n.clayDark, n.leafDark, 0.3);
  const shapes = parts.map((part) => taper(part.seg, part.w, 10));
  const trunk = parts[0]!.seg[0]!;
  const lines = full
    ? [-0.2, 0.15]
        .map((k) => {
          const w = parts[0]!.w[0]!;
          return `M${[0.05, 0.3, 0.55, 0.8].map((t) => {
            const o = onCubic(trunk, t);
            return pt(o.x - o.ty * w * k * (1 - t * 0.4), o.y + o.tx * w * k * (1 - t * 0.4));
          }).join('L')}`;
        })
        .join('')
    : '';
  return (
    <g>
      <defs>
        <Grad id={`${id}k`} stops={cylStops(bark, L)} />
      </defs>
      {L.side !== 0 || L.back ? (
        <g transform={`translate(${L.back ? 0 : -L.side * 1.6} ${L.back ? -1.5 : 0})`} fill={L.rim} opacity={0.7}>
          {shapes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ) : null}
      {shapes
        .map((d, i) => <path key={i} d={d} fill={`url(#${id}k)`} />)
        .reverse()}
      {lines ? <path d={lines} fill="none" stroke={dk(bark, 0.35)} strokeWidth={1.4} strokeLinecap="round" opacity={0.5} /> : null}
    </g>
  );
}

// ─────────────────────────── planters ───────────────────────────

/** A footed brass urn (palm, roses): gadrooned bowl, beaded lip, a soil line. Coordinates for its box. */
function BrassUrn({ p, id, L, cx, top, foot, half }: { p: DrawProps; id: string; L: Lighting; cx: number; top: number; foot: number; half: number }) {
  const h = foot - top;
  const at = (k: number) => top + h * k;
  const x = (k: number) => cx + half * k;
  const metal = `url(#${id}u)`;
  const flutes = Array.from({ length: 9 }, (_, i) => {
    const k = -0.78 + (i * 1.56) / 8;
    return `M${pt(x(k), at(0.3))}Q${pt(x(k * 0.9), at(0.55))} ${pt(x(k * 0.4), at(0.7))}`;
  }).join('');
  return (
    <g>
      <defs>
        <Grad id={`${id}u`} stops={cylStops(p.colors.secondary, L, true)} x1={n0(x(-1))} x2={n0(x(1))} />
      </defs>
      <Ground p={p} x={cx} y={foot - 1} rx={half * 0.85} />
      {/* plinth, stem and bowl */}
      <path d={`M${pt(x(-0.5), foot)}L${pt(x(-0.44), at(0.9))}H${n0(x(0.44))}L${pt(x(0.5), foot)}Z`} fill={metal} />
      <path d={`M${pt(x(-0.3), at(0.9))}C${pt(x(-0.26), at(0.82))} ${pt(x(-0.18), at(0.79))} ${pt(x(-0.16), at(0.74))}H${n0(x(0.16))}C${pt(x(0.18), at(0.79))} ${pt(x(0.26), at(0.82))} ${pt(x(0.3), at(0.9))}Z`} fill={metal} />
      <path d={`M${pt(x(-0.16), at(0.75))}C${pt(x(-0.7), at(0.7))} ${pt(x(-0.95), at(0.42))} ${pt(x(-0.86), at(0.12))}H${n0(x(0.86))}C${pt(x(0.95), at(0.42))} ${pt(x(0.7), at(0.7))} ${pt(x(0.16), at(0.75))}Z`} fill={metal} />
      {p.detail === 'full' ? (
        <>
          <path d={flutes} fill="none" stroke={dk(p.colors.secondary, 0.38)} strokeWidth={1.3} opacity={0.6} />
          <path d={flutes} fill="none" stroke={lt(p.colors.secondary, 0.45)} strokeWidth={0.7} opacity={0.5} transform="translate(2 0)" />
        </>
      ) : null}
      {/* lip, a bead line under it and the soil */}
      <path d={`M${pt(x(-1), at(0.02))}Q${pt(cx, at(-0.06))} ${pt(x(1), at(0.02))}L${pt(x(0.96), at(0.14))}Q${pt(cx, at(0.07))} ${pt(x(-0.96), at(0.14))}Z`} fill={metal} />
      <path d={`M${pt(x(-0.88), at(0.2))}Q${pt(cx, at(0.15))} ${pt(x(0.88), at(0.2))}`} fill="none" stroke={lt(p.colors.secondary, 0.4)} strokeWidth={2.4} strokeDasharray="0 5" strokeLinecap="round" />
      <ellipse cx={cx} cy={n0(at(0.01))} rx={n0(half * 0.84)} ry={n0(Math.max(2, h * 0.05))} fill={dk(p.nature.clayDark, 0.4)} />
    </g>
  );
}

/** An areca palm in a brass urn: the Palm motif as the dark back fronds, arching front fronds of leaflets. */
function PalmPlanter(p: DrawProps) {
  const id = idOf(p, 'pa');
  const L = lightingOf(p.light);
  const n = p.nature;
  const full = p.detail === 'full';
  const fronds: Segment[] = [
    [[78, 244], [66, 170], [26, 120], [6, 142]],
    [[79, 244], [72, 150], [44, 84], [20, 68]],
    [[80, 244], [82, 150], [88, 62], [100, 18]],
    [[81, 244], [92, 160], [124, 98], [146, 92]],
    [[82, 244], [96, 180], [136, 140], [156, 166]],
  ];
  const k = full ? 11 : 6;
  const litLeaves: string[] = [];
  const shadeLeaves: string[] = [];
  for (const [f, seg] of fronds.entries()) {
    for (let i = 0; i < k; i++) {
      const u = i / (k - 1);
      const o = onCubic(seg, 0.32 + u * 0.66);
      for (const s of [-1, 1]) {
        let dx = -o.ty * s * 0.8 + o.tx * 0.6;
        let dy = o.tx * s * 0.8 + o.ty * 0.6 + 0.45;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;
        const l = 30 * (1 - 0.6 * u) * (0.9 + rand(i * 2 + (s > 0 ? 1 : 0), p.seed + f) * 0.2);
        const ex = o.x + dx * l;
        const ey = o.y + dy * l;
        const bow = dx > 0 ? 1 : -1;
        const mx = (o.x + ex) / 2 - dy * l * 0.14 * bow;
        const my = (o.y + ey) / 2 + dx * l * 0.14 * bow;
        const d = `M${pt(o.x, o.y)}Q${pt(mx, my)} ${pt(ex, ey)}Q${pt((o.x + ex) / 2, (o.y + ey) / 2)} ${pt(o.x, o.y)}Z`;
        const isLit = L.side !== 0 ? Math.sign(dx) === L.side : dy < 0.35;
        (isLit && !L.back ? litLeaves : shadeLeaves).push(d);
      }
    }
  }
  return (
    <Art box={NATURE_BOXES.Planter.palm}>
      <g opacity={0.95}>
        <Palm x={84} y={246} h={168} lean={-14} color={dk(n.leafDark, 0.12)} />
        <Palm x={78} y={246} h={128} lean={18} color={bl(n.leafDark, n.leaf, 0.3)} />
      </g>
      <path d={fronds.map((s) => `M${pt(...s[0])}C${pt(...s[1])} ${pt(...s[2])} ${pt(...s[3])}`).join('')} fill="none" stroke={bl(n.leafLight, n.clay, 0.25)} strokeWidth={1.8} strokeLinecap="round" />
      <path d={shadeLeaves.join('')} fill={L.back ? bl(n.leaf, n.leafDark, 0.4) : n.leaf} />
      <path d={litLeaves.join('')} fill={bl(n.leafLight, n.leaf, 0.25)} />
      <BrassUrn p={p} id={id} L={L} cx={80} top={240} foot={330} half={46} />
    </Art>
  );
}

/** A painted terracotta matka spilling bougainvillea: green leaves under clusters of magenta bracts. */
function BougainvilleaPlanter(p: DrawProps) {
  const id = idOf(p, 'bo');
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const lobes: Lobe[] = [
    [90, 74, 44],
    [50, 98, 36],
    [132, 96, 38],
    [70, 136, 38],
    [114, 138, 38],
    [32, 140, 24],
    [150, 142, 24],
    [90, 108, 42],
    [90, 36, 26],
    [58, 56, 24],
    [124, 58, 24],
  ];
  // The cascade over the rim on the side away from the key (it catches the rim light).
  const away = L.side === 0 ? -1 : -L.side;
  const fall: Lobe[] = [
    [90 + away * 52, 178, 14],
    [90 + away * 60, 196, 11],
    [90 + away * 62, 214, 9],
  ];
  const tones = [hz(FLORA.bractDeep), hz(BOUGAINVILLEA), hz(FLORA.bractLight)];
  const bracts: string[][] = [[], [], []];
  const count = full ? 22 : 12;
  const spots: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const [x, y, r] = lobes[Math.floor(rand(i, p.seed + 3) * lobes.length)]!;
    const d = DIRS[Math.floor(rand(i, p.seed + 5) * 12)]!;
    const reach = r * (0.2 + rand(i, p.seed + 7) * 0.75);
    spots.push([x + d[0] * reach, y + d[1] * reach - r * 0.12]);
  }
  for (const [x, y] of fall) spots.push([x, y + 2]);
  spots.forEach(([x, y], i) => {
    const toward = L.side === 0 ? 0 : (x - 90) * L.side;
    const tone = L.back ? (i % 3 === 0 ? 1 : 0) : y < 70 || toward > 25 ? 2 : i % 3 === 0 ? 0 : 1;
    const rot = Math.floor(rand(i, p.seed + 9) * 12);
    for (let b = 0; b < 3; b++) {
      const d = DIRS[(rot + b * 4) % 12]!;
      const s = 4.6 + rand(i * 3 + b, p.seed + 11) * 1.4;
      const ox = x + d[0] * 1.2;
      const oy = y + d[1] * 1.2;
      const ax = x + d[0] * s - d[1] * s * 0.55;
      const ay = y + d[1] * s + d[0] * s * 0.55;
      const bx = x + d[0] * s + d[1] * s * 0.55;
      const by = y + d[1] * s - d[0] * s * 0.55;
      bracts[(tone + (b === 2 ? 1 : 0)) % 3]!.push(`M${pt(ox, oy)}L${pt(ax, ay)}Q${pt(x + d[0] * s * 1.45, y + d[1] * s * 1.45)} ${pt(bx, by)}Z`);
    }
  });
  const clay = n.clay;
  const zig = Array.from({ length: 15 }, (_, i) => pt(36 + i * 7.8, i % 2 ? 216 : 208)).join('L');
  return (
    <Art box={NATURE_BOXES.Planter.bougainvillea}>
      <defs>
        <Grad id={`${id}c`} stops={cylStops(clay, L)} x1={26} x2={154} />
        <Grad id={`${id}r`} stops={cylStops(lt(clay, 0.08), L)} x1={34} x2={146} />
        <Grad id={`${id}o`} stops={overStops(dk(p.colors.text, 0.4), L)} x1={26} x2={154} />
      </defs>
      <Ground p={p} x={90} y={257} rx={64} />
      <path d={`M${fall.map(([x, y]) => pt(x, y)).join('L')}`} fill="none" stroke={bl(n.clayDark, n.leafDark, 0.4)} strokeWidth={1.6} />
      {/* the pot: body, painted band (ivory lines, a zigzag in the primary, dots), shade, rim */}
      <path d="M46 182C24 198 22 238 54 252L60 258H120L126 252C158 238 156 198 134 182Z" fill={`url(#${id}c)`} />
      {full ? (
        <g fill="none">
          <path d="M31 202Q90 213 149 202M31 222Q90 233 149 222" stroke={lt(p.colors.surface, 0.2)} strokeWidth={2} />
          <path d={`M${zig}`} stroke={p.colors.primary} strokeWidth={2.2} strokeLinejoin="round" />
          <path d="M40 232Q90 241 140 232" stroke={lt(p.colors.surface, 0.2)} strokeWidth={2.6} strokeDasharray="0 7" strokeLinecap="round" />
        </g>
      ) : (
        <path d="M31 210Q90 221 149 210" fill="none" stroke={p.colors.primary} strokeWidth={4} />
      )}
      <path d="M46 182C24 198 22 238 54 252L60 258H120L126 252C158 238 156 198 134 182Z" fill={`url(#${id}o)`} />
      <path d="M36 172H144Q149 178 144 185H36Q31 178 36 172Z" fill={`url(#${id}r)`} />
      <ellipse cx={90} cy={174} rx={52} ry={3} fill={dk(n.clayDark, 0.35)} />
      <Canopy id={id} lobes={[...lobes, ...fall]} seed={p.seed} n={n} L={L} full={full} lit={0.6} />
      {tones.map((c, t) => (
        <path key={t} d={bracts[t]!.join('')} fill={c} stroke={c} strokeWidth={1.1} strokeLinejoin="round" />
      ))}
      {full ? <path d={spots.filter((_, i) => i % 3 === 1).map(([x, y]) => ring(x, y, 1)).join('')} fill={hz(NATURE.ivory)} /> : null}
    </Art>
  );
}

/** A mound of roses in a brass urn with ring handles. */
function RosePlanter(p: DrawProps) {
  const id = idOf(p, 'ro');
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const rose = bl(hz(FLORA.rose), p.colors.primary, 0.25);
  const lobes: Lobe[] = [
    [60, 72, 34],
    [32, 90, 25],
    [88, 90, 25],
    [46, 106, 23],
    [74, 106, 23],
    [60, 46, 24],
    [20, 110, 15],
    [100, 110, 15],
    [38, 60, 18],
    [82, 60, 18],
  ];
  const blooms: Lobe[] = [
    [60, 38, 9],
    [39, 58, 8],
    [81, 58, 8.5],
    [27, 84, 8],
    [60, 70, 10],
    [93, 84, 8],
    [44, 98, 8.5],
    [76, 98, 8.5],
    [60, 108, 7],
  ];
  const buds: Array<[number, number]> = [
    [16, 102],
    [104, 102],
    [50, 24],
    [72, 26],
  ];
  const sx = L.side;
  return (
    <Art box={NATURE_BOXES.Planter.roses}>
      <defs>
        <radialGradient id={`${id}f`} cx={sx > 0 ? '64%' : sx < 0 ? '36%' : '50%'} cy="34%" r="72%">
          <stop offset="0" stopColor={lt(rose, 0.3)} />
          <stop offset="0.55" stopColor={rose} />
          <stop offset="1" stopColor={dk(rose, L.back ? 0.45 : 0.3)} />
        </radialGradient>
      </defs>
      <BrassUrn p={p} id={id} L={L} cx={60} top={112} foot={180} half={40} />
      {full ? <path d="M22 124a6 6 0 1 0 0.1 0M98 124a6 6 0 1 1-0.1 0" fill="none" stroke={`url(#${id}u)`} strokeWidth={2} /> : null}
      <Canopy id={id} lobes={lobes} seed={p.seed} n={n} L={L} full={full} lit={0.55} />
      {blooms.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={`url(#${id}f)`} />
          <path d={`M${pt(x - r, y + r * 0.05)}Q${pt(x - r * 0.9, y + r * 0.98)} ${pt(x, y + r)}Q${pt(x + r * 0.9, y + r * 0.98)} ${pt(x + r, y + r * 0.05)}Q${pt(x, y + r * 0.55)} ${pt(x - r, y + r * 0.05)}Z`} fill={lt(rose, L.back ? 0.05 : 0.2)} opacity={0.9} />
          {full ? <path d={`M${r2(x - r * 0.38)} ${r2(y)}Q${r2(x - r * 0.1)} ${r2(y - r * 0.52)} ${r2(x + r * 0.32)} ${r2(y - r * 0.18)}Q${r2(x + r * 0.42)} ${r2(y + r * 0.22)} ${r2(x)} ${r2(y + r * 0.12)}`} fill="none" stroke={dk(rose, 0.38)} strokeWidth={r2(r * 0.16)} strokeLinecap="round" /> : null}
        </g>
      ))}
      <path d={buds.map(([x, y]) => `M${x} ${y + 4}c-3-2-3-6 0-8c3 2 3 6 0 8Z`).join('')} fill={dk(rose, 0.12)} />
    </Art>
  );
}

/** Tulsi on a lime-washed chaura (tulsi vrindavan): kumkum border, a lit niche with a diya, corner horns. */
function TulsiPlanter(p: DrawProps) {
  const id = idOf(p, 'tu');
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const wash = lt(p.colors.surface, 0.25);
  const shade = dk(p.colors.text, 0.4);
  const sx = L.side;
  // The plant: opposite leaf pairs along branches, purple flower spikes at the tips.
  const branches: Segment[] = [
    [[50, 60], [50, 42], [50, 22], [50, 4]],
    [[50, 52], [42, 46], [32, 40], [22, 30]],
    [[50, 48], [58, 42], [68, 36], [78, 28]],
    [[50, 40], [44, 32], [38, 22], [33, 12]],
    [[50, 37], [56, 30], [62, 20], [67, 10]],
    [[50, 56], [40, 54], [28, 52], [17, 47]],
    [[50, 54], [60, 52], [72, 50], [84, 45]],
  ];
  const leaves: string[][] = [[], []];
  const spikes: string[] = [];
  branches.forEach((seg, b) => {
    const steps = full ? [0.22, 0.4, 0.56, 0.72, 0.88] : [0.35, 0.7];
    steps.forEach((t, i) => {
      const o = onCubic(seg, t);
      for (const s of [-1, 1]) {
        let dx = -o.ty * s + o.tx * 0.5;
        let dy = o.tx * s + o.ty * 0.5 + 0.25;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;
        const l = (10.5 - t * 3.5) * (0.9 + rand(b * 9 + i * 2 + (s > 0 ? 1 : 0), p.seed) * 0.25);
        const ex = dx * l;
        const ey = dy * l;
        const w = l * 0.32;
        leaves[(L.side !== 0 ? Math.sign(dx) === L.side : dy < 0) && !L.back ? 1 : 0]!.push(
          `M${pt(o.x, o.y)}q${r2(ex / 2 - dy * w)} ${r2(ey / 2 + dx * w)} ${r2(ex)} ${r2(ey)}q${r2(-ex / 2 - dy * w)} ${r2(-ey / 2 + dx * w)} ${r2(-ex)} ${r2(-ey)}Z`,
        );
      }
    });
    const tip = seg[3];
    if (b > 0 || full) spikes.push(`M${pt(tip[0], tip[1])}l${b % 2 ? 1 : -1} -9`);
  });
  return (
    <Art box={NATURE_BOXES.Planter.tulsi}>
      <defs>
        <Grad id={`${id}o`} stops={overStops(shade, L)} x1={2} x2={98} />
        <radialGradient id={`${id}g`} cx="50%" cy="72%" r="60%">
          <stop offset="0" stopColor={n.flameCore} stopOpacity={0.9} />
          <stop offset="0.4" stopColor={n.flame} stopOpacity={0.55} />
          <stop offset="1" stopColor={n.flame} stopOpacity={0} />
        </radialGradient>
      </defs>
      <Ground p={p} x={50} y={178} rx={50} />
      {/* steps, body, cornice and the basin with its corner horns */}
      <path d="M2 180V172H98V180ZM8 172V164H92V172ZM16 164V84H84V164ZM6 78L10 72H90L94 78ZM10 84V78H90V84ZM18 72V60H82V72Z" fill={wash} />
      <path d="M17 60L21 52L25 60ZM75 60L79 52L83 60Z" fill={wash} />
      <path d={`${ring(21, 51, 1.6)}${ring(79, 51, 1.6)}`} fill={p.colors.secondary} />
      <path d="M8 172H92M16 164H84M10 78H90M18 72H82" stroke={dk(wash, 0.18)} strokeWidth={1.2} />
      <path d="M21 159V89H79V159Z" fill="none" stroke={p.colors.primary} strokeWidth={2.2} />
      {full ? <path d="M26 154V94H74V154Z" fill="none" stroke={p.colors.secondary} strokeWidth={1.6} strokeDasharray="0 4" strokeLinecap="round" /> : null}
      <path d="M22 66H78" stroke={p.colors.primary} strokeWidth={2} />
      {/* the niche, its glow and the diya */}
      <path d="M40 152V120Q40 106 50 101Q60 106 60 120V152Z" fill={dk(bl(p.colors.primary, p.colors.text, 0.5), 0.3)} />
      <path d="M40 152V120Q40 106 50 101Q60 106 60 120V152Z" fill={`url(#${id}g)`} />
      <path d="M37 153V119Q37 103 50 97Q63 103 63 119V153" fill="none" stroke={p.colors.secondary} strokeWidth={1.8} />
      <path d="M44 147Q50 152 56 147Z" fill={n.clay} />
      <path d="M50 137C52 140 52.6 143 50 145.5C47.4 143 48 140 50 137Z" fill={n.flame} />
      <path d="M50 140.5C51 142 51 143.4 50 144.6C49 143.4 49 142 50 140.5Z" fill={n.flameCore} />
      {/* shade over the block, the rim on the edge away */}
      <path d="M2 180V172H8V164H16V84H10V78H6L10 72H18V60H82V72H90L94 78H90V84H84V164H92V172H98V180Z" fill={`url(#${id}o)`} />
      {sx !== 0 ? <path d={sx < 0 ? 'M97 180V172M91 172V164M83 164V84M89 84V78M81 72V60' : 'M3 180V172M9 172V164M17 164V84M11 84V78M19 72V60'} stroke={L.rim} strokeWidth={1.5} opacity={0.75} /> : null}
      {/* the plant */}
      <path d={branches.map((s) => `M${pt(...s[0])}C${pt(...s[1])} ${pt(...s[2])} ${pt(...s[3])}`).join('')} fill="none" stroke={bl(n.clayDark, n.leafDark, 0.5)} strokeWidth={1.4} />
      <Canopy id={`${id}c`} lobes={[[50, 32, 14], [37, 40, 11], [63, 40, 11], [50, 50, 11], [42, 21, 9], [58, 21, 9]]} seed={p.seed} n={n} L={L} full={full} lit={0.7} />
      <path d={leaves[0]!.join('')} fill={L.back ? dk(n.leafDark, 0.1) : n.leafDark} />
      <path d={leaves[1]!.join('')} fill={bl(n.leaf, n.leafLight, 0.45)} />
      <path d={spikes.join('')} fill="none" stroke={hz(FLORA.tulsiSpike)} strokeWidth={2.4} strokeDasharray="1.2 1.6" strokeLinecap="round" />
    </Art>
  );
}

// ─────────────────────────── pieces ───────────────────────────

/** An urn or pot in terracotta or brass with a palm, bougainvillea, roses, or tulsi on a chaura. */
export function Planter(props: DrawProps & PlanterOptions) {
  switch (props.plant) {
    case 'bougainvillea':
      return BougainvilleaPlanter(props);
    case 'roses':
      return RosePlanter(props);
    case 'tulsi':
      return TulsiPlanter(props);
    case 'palm':
    default:
      return PalmPlanter(props);
  }
}

/** Kadamba: the KadambaTree motif's crown on a tapered trunk, with a shade side and lit lobes added. */
function Kadamba(p: DrawProps) {
  const id = idOf(p, 'ka');
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const s = 0.98;
  const mx = 163;
  const my = 352;
  const crowns: Lobe[] = (
    [
      [-70, -190, 70],
      [10, -220, 90],
      [90, -180, 70],
      [-20, -150, 60],
      [60, -140, 55],
    ] as const
  ).map(([x, y, r]) => [mx + x * s, my + y * s, r * s]);
  const sx = L.side === 0 ? 0 : L.side;
  return (
    <Art box={NATURE_BOXES.Tree.kadamba}>
      <Ground p={p} x={168} y={466} rx={110} />
      {sx !== 0 || L.back ? <path d={crowns.map(([x, y, r]) => ring(x - sx * 3, y - (L.back ? 3 : 1), r * 1.02)).join('')} fill={L.rim} opacity={0.45} /> : null}
      <KadambaTree x={mx} y={my} size={s} color={L.back ? bl(n.leaf, n.leafDark, 0.4) : n.leaf} flower={hz(FLORA.kadamba)} />
      {L.back ? null : (
        <path
          d={crowns
            .flatMap(([x, y, r], j) => [0, 1, 2].map((i) => ring(x + sx * r * (0.3 + i * 0.12) + (i - 1) * r * 0.2, y - r * (0.5 - i * 0.1) + rand(j, p.seed + i) * r * 0.15, r * (0.16 + rand(i, p.seed + j) * 0.08))))
            .join('')}
          fill={n.leafLight}
          opacity={0.35}
        />
      )}
      <Limbs
        id={id}
        n={n}
        L={L}
        full={full}
        parts={[
          { seg: [[[162, 470], [161, 430], [163, 380], [162, 326]]], w: [40, 30] },
          { seg: [[[153, 352], [154, 317], [149, 285], [141, 256]]], w: [18, 15] },
          { seg: [[[171, 352], [172, 311], [180, 277], [192, 249]]], w: [18, 15] },
        ]}
      />
    </Art>
  );
}

/** A campus rain tree: a broad umbrella crown over open limbs. */
function CampusTree(p: DrawProps) {
  const id = idOf(p, 'ca');
  const L = lightingOf(p.light);
  const n = p.nature;
  const full = p.detail === 'full';
  const lobes: Lobe[] = [
    [56, 196, 44],
    [100, 150, 56],
    [162, 118, 64],
    [228, 140, 58],
    [284, 188, 46],
    [130, 194, 48],
    [206, 196, 50],
    [30, 232, 28],
    [312, 230, 26],
    [168, 172, 54],
    [118, 98, 34],
    [214, 92, 36],
  ];
  return (
    <Art box={NATURE_BOXES.Tree.campus}>
      <Ground p={p} x={170} y={466} rx={120} />
      <Limbs
        id={id}
        n={n}
        L={L}
        full={full}
        parts={[
          { seg: [[[170, 470], [167, 420], [173, 360], [170, 318]]], w: [40, 26] },
          { seg: [[[164, 326], [148, 292], [112, 262], [80, 238]]], w: [17, 7] },
          { seg: [[[171, 324], [174, 282], [168, 244], [170, 204]]], w: [15, 7] },
          { seg: [[[176, 326], [194, 292], [230, 262], [262, 236]]], w: [17, 7] },
        ]}
      />
      <Canopy id={id} lobes={lobes} seed={p.seed} n={n} L={L} full={full} />
    </Art>
  );
}

/** A mango tree: a dense dark dome, drooping leaf tufts at the hem and a few ripe mangoes. */
function MangoTree(p: DrawProps) {
  const id = idOf(p, 'ma');
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const lobes: Lobe[] = [
    [170, 92, 76],
    [100, 132, 68],
    [240, 132, 68],
    [60, 202, 56],
    [280, 202, 56],
    [122, 212, 70],
    [218, 214, 70],
    [170, 170, 78],
    [92, 270, 50],
    [248, 272, 50],
    [170, 262, 64],
    [40, 262, 34],
    [300, 262, 34],
  ];
  const tufts = [
    [62, 290],
    [104, 314],
    [150, 322],
    [196, 324],
    [236, 316],
    [282, 292],
    [30, 282],
    [312, 282],
  ].map(([x, y], i) => {
    const k = i % 2 ? 1 : -1;
    return `M${x} ${y}q${-4 * k} 9 ${-2 * k} 18q${4 * k}-8 ${2 * k}-18Zm2 0q2 10 5 16q-1-9-5-16Zm-4 0q-6 7-8 13q5-5 8-13Z`;
  });
  const fruit: Array<[number, number]> = [
    [96, 314],
    [134, 302],
    [208, 320],
    [246, 306],
    [70, 290],
    [276, 296],
    [172, 330],
  ];
  const sx = L.side;
  return (
    <Art box={NATURE_BOXES.Tree.mango}>
      <Ground p={p} x={170} y={466} rx={116} />
      <Limbs
        id={id}
        n={n}
        L={L}
        full={full}
        parts={[
          { seg: [[[170, 470], [172, 430], [167, 396], [170, 360]]], w: [46, 34] },
          { seg: [[[163, 372], [150, 346], [128, 326], [110, 306]]], w: [19, 10] },
          { seg: [[[177, 372], [191, 346], [214, 326], [232, 308]]], w: [19, 10] },
        ]}
      />
      <Canopy id={id} lobes={lobes} seed={p.seed} n={n} L={L} full={full} lit={0.6} />
      {full ? <path d={tufts.join('')} fill={L.back ? dk(n.leafDark, 0.2) : n.leafDark} /> : null}
      {fruit.map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y - 8}v4`} stroke={n.leafDark} strokeWidth={1.2} />
          <path d={`M${x} ${y - 5}c5 0 6 6 4 10c-2 4-7 3-8-1c-1-4 0-9 4-9Z`} fill={hz(i % 3 ? FLORA.mango : FLORA.mangoBlush)} />
          {L.back ? null : <path d={`M${x + (sx < 0 ? -2 : 2)} ${y - 3}q${sx < 0 ? -2 : 2} 3 0 6`} stroke={lt(hz(FLORA.mango), 0.5)} strokeWidth={1.2} fill="none" />}
        </g>
      ))}
    </Art>
  );
}

/** A tree: a tapered trunk and leaf masses in NATURE greens (kadamba, a campus tree, a mango). */
export function Tree(props: DrawProps & TreeOptions) {
  switch (props.variant) {
    case 'campus':
      return CampusTree(props);
    case 'mango':
      return MangoTree(props);
    case 'kadamba':
    default:
      return Kadamba(props);
  }
}

/** One banana blade along its midrib: two halves (edge to midrib) with the splits banana leaves tear into. */
function blade(seg: Segment, wMax: number, t0: number, steps: number, tears: readonly number[]) {
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const o = onCubic(seg, t0 + (1 - t0) * u);
    return { x: o.x, y: o.y, tx: o.tx, ty: o.ty, w: wMax * Math.min(1, u * 5) * Math.sqrt(Math.max(0, 1 - u * u * u)) };
  });
  const half = (s: number) => {
    const edge: string[] = [];
    pts.forEach((q, i) => {
      const ex = q.x - q.ty * s * q.w;
      const ey = q.y + q.tx * s * q.w;
      edge.push(pt(ex, ey));
      if (tears.includes(i * s)) {
        edge.push(pt(q.x - q.ty * s * q.w * 0.14 - q.tx * 4, q.y + q.tx * s * q.w * 0.14 - q.ty * 4));
        edge.push(pt(ex + q.tx * 2, ey + q.ty * 2));
      }
    });
    const rib = pts.map((q) => pt(q.x, q.y)).reverse();
    return `M${edge.join('L')}L${rib.join('L')}Z`;
  };
  const avgNx = pts.reduce((a, q) => a - q.ty, 0);
  const avgNy = pts.reduce((a, q) => a + q.tx, 0);
  const veins = pts
    .filter((_, i) => i > 1 && i < steps && i % 2 === 0)
    .map((q) => [-1, 1].map((s) => `M${pt(q.x, q.y)}l${n0(-q.ty * s * q.w * 0.9 + q.tx * q.w * 0.35)} ${n0(q.tx * s * q.w * 0.9 + q.ty * q.w * 0.35)}`).join(''))
    .join('');
  return { plus: half(1), minus: half(-1), avgNx, avgNy, veins };
}

/** A banana plant: a sheathed pseudostem tied with marigolds, arching split leaves, a hanging bunch with its heart. */
export function BananaPlant(props: DrawProps) {
  const p = props;
  const L = lightingOf(p.light);
  const n = p.nature;
  const hz = hazer(n);
  const full = p.detail === 'full';
  const id = idOf(p, 'ba');
  const steps = full ? 12 : 8;
  type Leaf = { seg: Segment; w: number; t0: number; tears: number[]; tone: 'back' | 'front' | 'under' | 'cigar' | 'dry' };
  const leaves: Leaf[] = [
    { seg: [[70, 198], [60, 160], [40, 130], [22, 112]], w: 14, t0: 0.25, tears: [4, -6], tone: 'back' },
    { seg: [[70, 198], [82, 160], [102, 136], [120, 122]], w: 14, t0: 0.25, tears: [-4, 7], tone: 'back' },
    { seg: [[64, 212], [48, 236], [36, 268], [34, 312]], w: 7, t0: 0.12, tears: [], tone: 'dry' },
    { seg: [[70, 202], [44, 170], [20, 166], [10, 202]], w: 14, t0: 0.25, tears: [5, -8], tone: 'under' },
    { seg: [[70, 202], [100, 166], [124, 168], [132, 206]], w: 14, t0: 0.25, tears: [-5, 8], tone: 'under' },
    { seg: [[70, 198], [56, 130], [34, 80], [20, 40]], w: 17, t0: 0.22, tears: [3, -5, 7, -9], tone: 'front' },
    { seg: [[70, 198], [86, 128], [106, 84], [122, 52]], w: 17, t0: 0.22, tears: [-3, 5, -7, 9], tone: 'front' },
    { seg: [[70, 198], [69, 150], [71, 90], [76, 30]], w: 5, t0: 0.3, tears: [], tone: 'cigar' },
  ];
  const toneOf = (tone: Leaf['tone']): [string, string] => {
    if (tone === 'dry') return [bl(n.clay, n.leafLight, 0.35), dk(bl(n.clay, n.leafLight, 0.35), 0.2)];
    if (tone === 'cigar') return [lt(n.leafLight, 0.18), n.leafLight];
    if (tone === 'back') return [n.leaf, n.leafDark];
    if (L.back) return [bl(n.leaf, n.leafDark, 0.3), n.leafDark];
    if (tone === 'under') return [bl(n.leafLight, n.leaf, 0.15), bl(n.leaf, n.leafDark, 0.3)];
    return [n.leafLight, n.leaf];
  };
  const stem = taper(
    [
      [
        [70, 420],
        [69, 350],
        [71, 262],
        [70, 196],
      ],
    ],
    [30, 19],
    12,
  );
  const stemC = bl(n.leaf, n.clay, 0.22);
  const tie = [58, 64, 70, 76, 82].map((x) => [x, 318 + 2.4 * (1 - ((x - 70) / 12) ** 2)] as const);
  const bunch: Segment = [
    [74, 206],
    [96, 212],
    [106, 236],
    [103, 262],
  ];
  const hands = [0.3, 0.45, 0.6, 0.75].map((t) => onCubic(bunch, t));
  const fruit = hz(FLORA.banana);
  return (
    <Art box={NATURE_BOXES.BananaPlant['']}>
      <defs>
        <Grad id={`${id}s`} stops={cylStops(stemC, L)} />
      </defs>
      <Ground p={p} x={70} y={418} rx={34} />
      {leaves.slice(0, 2).map((leaf, i) => {
        const b = blade(leaf.seg, leaf.w, leaf.t0, steps, full ? leaf.tears : []);
        const [litC, shadeC] = toneOf(leaf.tone);
        const plusLit = L.side !== 0 ? Math.sign(b.avgNx) === L.side : b.avgNy < 0;
        return (
          <g key={i}>
            <path d={b.plus} fill={plusLit ? litC : shadeC} />
            <path d={b.minus} fill={plusLit ? shadeC : litC} />
          </g>
        );
      })}
      {L.side !== 0 || L.back ? <path d={stem} fill={L.rim} opacity={0.7} transform={`translate(${L.back ? 0 : -L.side * 1.6} ${L.back ? -1.5 : 0})`} /> : null}
      <path d={stem} fill={`url(#${id}s)`} />
      {full ? <path d="M64 418C62 360 63 300 66 230M75 418C77 350 76 290 73 226M70 400C69 340 70 280 70 220" fill="none" stroke={dk(stemC, 0.25)} strokeWidth={1.2} opacity={0.55} /> : null}
      <path d="M58 420C58 396 62 380 66 372C66 392 64 408 64 420Z" fill={bl(n.clay, n.leafLight, 0.35)} opacity={0.9} />
      {/* the marigold tie */}
      <path d={tie.map(([x, y]) => ring(x, y, 3.4)).join('')} fill={hz(FLORA.marigold)} />
      <path d={tie.filter((_, i) => i % 2 === 0).map(([x, y]) => ring(x, y - 0.6, 2.2)).join('')} fill={hz(FLORA.marigoldLight)} />
      {full ? <path d={[0, 1, 2].map((i) => ring(L.side > 0 ? 80 : 60, 326 + i * 7, 2.8)).join('')} fill={hz(FLORA.marigoldLight)} /> : null}
      {leaves.slice(2).map((leaf, i) => {
        const b = blade(leaf.seg, leaf.w, leaf.t0, steps, full ? leaf.tears : []);
        const [litC, shadeC] = toneOf(leaf.tone);
        const plusLit = L.side !== 0 ? Math.sign(b.avgNx) === L.side : b.avgNy < 0;
        return (
          <g key={i}>
            <path d={b.plus} fill={plusLit ? litC : shadeC} />
            <path d={b.minus} fill={plusLit ? shadeC : litC} />
            {full && leaf.tone !== 'cigar' && leaf.tone !== 'dry' ? <path d={b.veins} fill="none" stroke={dk(shadeC, 0.22)} strokeWidth={0.7} opacity={0.5} /> : null}
          </g>
        );
      })}
      <path d={leaves.filter((l) => l.tone === 'front' || l.tone === 'under').map(({ seg: s }) => `M${pt(...s[0])}C${pt(...s[1])} ${pt(...s[2])} ${pt(...s[3])}`).join('')} fill="none" stroke={bl(n.leafLight, n.flameCore, 0.15)} strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
      {/* the bunch: hands of fingers along the stalk and the maroon heart */}
      <path d={`M${pt(...bunch[0])}C${pt(...bunch[1])} ${pt(...bunch[2])} ${pt(...bunch[3])}`} fill="none" stroke={bl(n.leaf, n.clay, 0.3)} strokeWidth={3} strokeLinecap="round" />
      <path
        d={hands
          .map((h, k) =>
            [-6, -2, 2, 6]
              .slice(k === 3 ? 1 : 0)
              .map((dx) => `M${pt(h.x + dx * 0.8, h.y + 2)}q${n0(dx * 0.5 + 3)} -3 ${n0(dx + 6)} -10`)
              .join(''),
          )
          .join('')}
        fill="none"
        stroke={fruit}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      {full ? <path d={hands.map((h) => `M${pt(h.x - 5, h.y + 1)}q4-3 9-10`).join('')} fill="none" stroke={lt(fruit, 0.35)} strokeWidth={1} strokeLinecap="round" /> : null}
      <path d="M103 260C111 267 111 282 103 293C95 282 95 267 103 260Z" fill={hz(FLORA.bananaHeart)} />
      <path d="M103 260C108 266 108 276 104 284" fill="none" stroke={lt(hz(FLORA.bananaHeart), 0.3)} strokeWidth={1.2} />
    </Art>
  );
}

// ─────────────────────────── registry (sheets, Studio) ───────────────────────────

type Boxes = Record<string, { w: number; h: number }>;
const boxOf = (boxes: Boxes) => (variant: string) => boxes[variant] ?? Object.values(boxes)[0]!;

export const NATURE_KIT: readonly KitEntry[] = [
  { name: 'Planter', file: 'nature', variants: Object.keys(NATURE_BOXES.Planter), box: boxOf(NATURE_BOXES.Planter), render: (p, v) => <Planter {...p} plant={v as PlanterPlant} /> },
  { name: 'Tree', file: 'nature', variants: Object.keys(NATURE_BOXES.Tree), box: boxOf(NATURE_BOXES.Tree), render: (p, v) => <Tree {...p} variant={v as TreeVariant} /> },
  { name: 'BananaPlant', file: 'nature', variants: [''], box: boxOf(NATURE_BOXES.BananaPlant), render: (p) => <BananaPlant {...p} /> },
];
