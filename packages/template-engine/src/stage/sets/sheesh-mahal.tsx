import type { CSSProperties, ReactNode } from 'react';
import { onCubic, shade, tint, type Pt, type Segment } from '../../art/kit';
import { rand } from '../../art/motifs';
import { mix } from '../../theme';
import { ArchScreen, Ceiling, Chandelier, drawWith, Floor, SacredFire, Wall } from '../kit';
import { FlameAt, FlameDef, Glow, kitId, Lin, marigoldOf, metalLit } from '../kit/architecture';
import { back, billboard, ceiling, floor, hang, wall } from '../planes';
import type { Draw, DrawProps, Piece, StageSetFactory } from '../types';

/**
 * T01 · Sheesh Mahal (`sheesh-mahal`, final.md §5.3): the `sheeshMahal` stage.
 *
 * A mirror-work durbar hall by candlelight. From the palace gate the guest
 * looks down a hall of ruby velvet and marble chequer under a crystal
 * chandelier, through two cusped arches bordered in mirror mosaic, the first
 * hung with a mango-leaf toran and genda-phool ladis and flanked by brass
 * deep-stands and caparisoned ivory elephants, the second glinting as its
 * mirrors catch the flame, to the focal mandap: a gilt chhatri on carved
 * pillars, its back a jharokha of mirror mosaic lit by the sacred fire.
 * Key light far (the fire), warm; rim pale gold. Night.
 *
 * Set-local pieces (§6.4): Mandap (the focal), Toran, Ladis, Elephant,
 * Deepstand and MirrorGlints. The toran, the strands, the elephant and the
 * deep-stands are drawn here rather than placed from motif()/illus()/the kit:
 * those come to 77, 59, 16 and 5.4 KB of markup each, and the set must stay within 150 KB with the palace gate and the film's
 * particles. Paths are written in whole units (`I`).
 */

const url = (id: string) => `url(#${id})`;
/** A path in whole units: at these sizes a unit is under a screen pixel. */
const I = (s: TemplateStringsArray, ...v: number[]): string => {
  let out = s[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(Math.round(v[i] ?? 0)) + (s[i + 1] ?? '');
  return out;
};
const at = (s: Segment, t: number): Pt => {
  const q = onCubic(s, t);
  return [q.x, q.y];
};
const svgStyle = (): CSSProperties => ({ display: 'block', overflow: 'visible' });
const svg = (w: number, h: number, children: ReactNode) => (
  <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={svgStyle()}>
    {children}
  </svg>
);

/** A four-point glint (a mirror catching the flame) at (x, y), s units from centre to tip. */
const glint = (x: number, y: number, s: number): string => {
  const q = Math.max(1, s * 0.22);
  return I`M${x} ${y - s}L${x + q} ${y - q}L${x + s} ${y}L${x + q} ${y + q}L${x} ${y + s}L${x - q} ${y + q}L${x - s} ${y}L${x - q} ${y - q}Z`;
};

/** A row of scallops (a cusped valance edge) from x0 to x1 hanging from y, each about `cell` wide and `drop` deep. */
const scallops = (x0: number, x1: number, y: number, cell: number, drop: number): string => {
  const n = Math.max(1, Math.round((x1 - x0) / cell));
  const s = (x1 - x0) / n;
  let d = I`M${x0} ${y - 1}`;
  for (let i = 0; i < n; i++) d += I`Q${x0 + s * (i + 0.5)} ${y + drop * 2} ${x0 + s * (i + 1)} ${y}`;
  return `${d}${I`L${x1} ${y - 1}Z`}`;
};

/**
 * Marigold heads along a path: deep and bright heads alternating, each with a lit crown (round-capped dashes, one element
 * per tone). `dim` (0..1) sinks them toward the hall's shadow: pieces near the gate are lit from behind by the fire, so they
 * read as warm silhouettes with a rim, and never as bright colour behind the words.
 */
function Marigolds({ d, size, p, dim = 0 }: { d: string; size: number; p: DrawProps; dim?: number }) {
  const m = marigoldOf(p);
  const night = mix(p.colors.primary, '#000000', 0.45);
  const sink = (col: string) => (dim > 0 ? mix(col, night, dim) : col);
  const step = Math.round(size * 0.86);
  const dash = `0.1 ${step * 2 - 0.1}`;
  return (
    <>
      <path d={d} stroke={sink(shade(m, 0.12))} strokeWidth={size} strokeLinecap="round" strokeDasharray={dash} fill="none" />
      <path d={d} stroke={sink(mix(m, p.nature.flame, 0.55))} strokeWidth={size} strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={-step} fill="none" />
      <path d={d} stroke={dim > 0 ? p.light.rim : tint(p.nature.flame, 0.3)} strokeWidth={Math.round(size * (dim > 0 ? 0.28 : 0.36))} strokeLinecap="round" strokeDasharray={`0.1 ${step - 0.1}`} fill="none" transform={I`translate(${-size * 0.14} ${-size * 0.3})`} opacity={dim > 0 ? 0.55 : 0.75} />
    </>
  );
}

// ─────────────────────────── Mandap (focal) ───────────────────────────

const MW = 560;
const MH = 470;

/**
 * The wedding mandap, drawn in a 560×470 elevation: a two-step marble vedi
 * with a gold inlay band and a velvet rug; at its back a jharokha screen of
 * mirror mosaic lit by the sacred fire; four gilt pillars (the front pair on
 * kumbha bases, wound with marigold and jasmine) under a mirror-inlaid cornice
 * with a velvet valance and a sagging marigold garland with laris; a gilt
 * chhatri dome with a lotus collar and kalash finial between two corner
 * domelets; silk drapes tied back at the front pillars; stacked painted kalash
 * pots on the vedi.
 */
function Mandap(p: DrawProps) {
  const id = kitId(p, 'md');
  const c = p.colors;
  const n = p.nature;
  const full = p.detail === 'full';
  const gold = c.secondary;
  const goldDeep = shade(gold, 0.42);
  const velvet = mix(c.primary, '#000000', 0.12);
  const marble = mix(c.background, c.surface, 0.5);
  const mirrorBase = mix(c.primary, '#000000', 0.5);
  const flame = p.light.color;
  const jasmine = n.ivory;
  const glass = tint(mix(flame, c.accent, 0.4), 0.15);

  // The back screen's cusped niche: jambs up to the springing, eight lobes over the head.
  const niche = (x0: number, x1: number, yFoot: number, ySpring: number, yApex: number): string => {
    const cx = (x0 + x1) / 2;
    const left: Segment = [[x0, ySpring], [x0, ySpring - (ySpring - yApex) * 0.55], [cx - (x1 - x0) * 0.28, yApex + 6], [cx, yApex]];
    const right: Segment = [[cx, yApex], [cx + (x1 - x0) * 0.28, yApex + 6], [x1, ySpring - (ySpring - yApex) * 0.55], [x1, ySpring]];
    let d = I`M${x0} ${yFoot}L${x0} ${ySpring}`;
    for (const seg of [left, right]) {
      for (let i = 0; i < 4; i++) {
        const a = at(seg, i / 4);
        const b = at(seg, (i + 1) / 4);
        const r = Math.abs(b[0] - a[0]) * 0.36 + 4;
        d += I`A${r} ${r} 0 0 1 ${b[0]} ${b[1]}`;
      }
    }
    return `${d}${I`L${x1} ${yFoot}Z`}`;
  };

  // Front pillars at x 52 and 508: shafts, kumbha bases, bracket capitals; flowers wound round them.
  const shafts = [52, 508].map((x) => I`M${x - 13} 136h26v270h-26Z`).join('');
  const bases = [52, 508].map((x) => I`M${x - 14} 402C${x - 30} 410 ${x - 30} 432 ${x - 18} 438H${x + 18}C${x + 30} 432 ${x + 30} 410 ${x + 14} 402ZM${x - 24} 436h48v12h-48Z`).join('');
  const caps = [52, 508].map((x) => I`M${x - 22} 120H${x + 22}L${x + 17} 128C${x + 10} 130 ${x + 15} 138 ${x + 13} 140H${x - 13}C${x - 15} 138 ${x - 10} 130 ${x - 17} 128Z`).join('');
  const wraps = (dy: number) =>
    [52, 508]
      .map((x) => Array.from({ length: 6 }, (_, i) => I`M${x - 15} ${152 + i * 40 + dy}L${x + 15} ${172 + i * 40 + dy}`).join(''))
      .join('');

  // Stacked kalash pots (three each) at x 96 and 464, coconut and mango leaves on top.
  const POTS: ReadonlyArray<readonly [number, number]> = [
    [446, 17],
    [418, 14],
    [395, 11],
  ];
  const potsAt = (cx: number) => POTS.map(([y, r]) => I`M${cx - r * 0.45} ${y - r * 1.5}C${cx - r * 1.25} ${y - r * 1.2} ${cx - r * 1.2} ${y - r * 0.05} ${cx - r * 0.5} ${y}H${cx + r * 0.5}C${cx + r * 1.2} ${y - r * 0.05} ${cx + r * 1.25} ${y - r * 1.2} ${cx + r * 0.45} ${y - r * 1.5}Z`).join('');
  const potBands = (cx: number) => POTS.map(([y, r]) => I`M${cx - r} ${y - r * 0.8}Q${cx} ${y - r * 0.55} ${cx + r} ${y - r * 0.8}`).join('');
  const potLeaves = (cx: number) => I`M${cx - 9} 379C${cx - 20} 370 ${cx - 24} 364 ${cx - 28} 360C${cx - 18} 360 ${cx - 10} 366 ${cx - 4} 377ZM${cx + 9} 379C${cx + 20} 370 ${cx + 24} 364 ${cx + 28} 360C${cx + 18} 360 ${cx + 10} 366 ${cx + 4} 377Z`;
  const pots = `${potsAt(96)}${potsAt(464)}`;

  // Silk drapes tied back at the front pillars (the right mirrors the left).
  const drape = (side: -1 | 1) => {
    const X = (x: number) => (side < 0 ? x : MW - x);
    return {
      body: I`M${X(16)} 122C${X(10)} 220 ${X(30)} 250 ${X(42)} 262L${X(48)} 270C${X(36)} 320 ${X(18)} 400 ${X(8)} 446L${X(26)} 446C${X(32)} 390 ${X(44)} 320 ${X(54)} 270L${X(50)} 262C${X(56)} 236 ${X(64)} 190 ${X(62)} 122Z`,
      hem: I`M${X(62)} 122C${X(64)} 190 ${X(56)} 236 ${X(50)} 262`,
      folds: I`M${X(28)} 140C${X(26)} 200 ${X(34)} 236 ${X(44)} 258M${X(40)} 290C${X(30)} 340 ${X(22)} 390 ${X(16)} 440`,
    };
  };
  const dl = drape(-1);
  const dr = drape(1);

  // The garland under the cornice, and three laris dropping from it.
  const swag: Segment = [[72, 150], [170, 214], [390, 214], [488, 150]];
  const swagD = I`M${swag[0][0]} ${swag[0][1]}C${swag[1][0]} ${swag[1][1]} ${swag[2][0]} ${swag[2][1]} ${swag[3][0]} ${swag[3][1]}`;
  const laris = [0.25, 0.5, 0.75].map((t) => at(swag, t));

  // Glints on the mirror screen, the cornice inlay and the dome.
  const glints = full
    ? Array.from({ length: 12 }, (_, i) => {
        const zone = i % 3;
        const x = zone === 0 ? 150 + rand(i, p.seed + 7) * 260 : zone === 1 ? 30 + rand(i, p.seed + 9) * 500 : 220 + rand(i, p.seed + 11) * 120;
        const y = zone === 0 ? 180 + rand(i, p.seed + 13) * 200 : zone === 1 ? 104 + rand(i, p.seed + 15) * 10 : 40 + rand(i, p.seed + 17) * 36;
        return glint(x, y, 3 + rand(i, p.seed + 19) * 5);
      }).join('')
    : '';

  return svg(
    MW,
    MH,
    <>
      <defs>
        <Lin id={`${id}g`} stops={metalLit(gold, p.light.from, false)} x2={1} bbox />
        <Lin id={`${id}v`} stops={[[0, tint(gold, 0.4)], [0.5, gold], [1, shade(gold, 0.35)]]} y2={1} bbox />
        <Lin id={`${id}s`} stops={[[0, shade(c.primary, 0.3)], [0.45, tint(c.primary, 0.14)], [1, shade(c.primary, 0.35)]]} x2={1} bbox />
        <Glow id={`${id}f`} color={flame} core={tint(flame, 0.4)} a={0.75} />
        <pattern id={`${id}m`} width={16} height={16} patternUnits="userSpaceOnUse">
          <rect width={16} height={16} fill={mirrorBase} />
          <path d="M8 1L15 8L8 15L1 8Z" fill={mix(gold, mirrorBase, 0.35)} />
          <path d="M8 4L12 8L8 12L4 8Z" fill={glass} />
          <path d="M0 0h.1M16 0h.1M0 16h.1M16 16h.1" stroke={tint(c.accent, 0.3)} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
        </pattern>
      </defs>

      {/* The back screen: velvet, the cusped niche of mirror mosaic, lit by the fire; the back pillars. */}
      <rect x={112} y={124} width={336} height={300} fill={velvet} />
      <path d={niche(138, 422, 424, 250, 150)} fill={url(`${id}m`)} stroke={gold} strokeWidth={3} />
      <path d={niche(150, 410, 424, 256, 166)} fill="none" stroke={tint(gold, 0.3)} strokeWidth={1.2} opacity={0.8} />
      <ellipse cx={280} cy={380} rx={190} ry={170} fill={url(`${id}f`)} />
      <path d="M108 128h14v292h-14ZM438 128h14v292h-14Z" fill={shade(gold, 0.3)} />

      {/* The vedi: two marble steps, a gold inlay band with lotus studs, a velvet rug, the fire's light on the step. */}
      <path d="M58 420H502L548 448H12Z" fill={tint(marble, 0.06)} />
      <path d="M150 422H410L436 446H124Z" fill={velvet} stroke={gold} strokeWidth={1.4} />
      <rect x={10} y={448} width={540} height={22} fill={shade(marble, 0.12)} />
      <path d="M10 456H550M10 462H550" stroke={gold} strokeWidth={1.3} opacity={0.9} />
      {full ? <path d="M40 459H520" stroke={mix(c.accent, gold, 0.5)} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 59.9" /> : null}
      <ellipse cx={280} cy={448} rx={240} ry={30} fill={url(`${id}f`)} opacity={0.5} />

      {/* Kalash stacks on the vedi. */}
      <path d={pots} fill={c.accent} />
      <path d={pots} fill={url(`${id}g`)} opacity={0.35} />
      <path d={`${potBands(96)}${potBands(464)}`} stroke={gold} strokeWidth={3} fill="none" />
      <path d={`${potLeaves(96)}${potLeaves(464)}`} fill={n.leaf} />
      <path d="M96 372h.1M464 372h.1" stroke={mix(n.clayDark, n.clay, 0.3)} strokeWidth={15} strokeLinecap="round" />

      {/* Cornice with a mirror inlay, the velvet valance with bead drops. */}
      <rect x={18} y={96} width={524} height={26} fill={url(`${id}v`)} stroke={goldDeep} strokeWidth={1} />
      <path d="M30 109H530" stroke={tint(mix(flame, '#ffffff', 0.3), 0.2)} strokeWidth={8} strokeDasharray="8 8.2" />
      <path d={scallops(64, 496, 122, 27, 14)} fill={velvet} stroke={gold} strokeWidth={1.6} />
      {full ? <path d="M77.5 141H496" stroke={gold} strokeWidth={4} strokeLinecap="round" strokeDasharray="0.1 26.9" /> : null}

      {/* The front pillars. */}
      <path d={shafts} fill={url(`${id}g`)} stroke={goldDeep} strokeWidth={1.2} />
      <path d={wraps(0)} stroke={marigoldOf(p)} strokeWidth={10} strokeLinecap="round" strokeDasharray="0.1 10" fill="none" />
      <path d={wraps(10)} stroke={jasmine} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 7" fill="none" />
      <path d={`${bases}${caps}`} fill={url(`${id}g`)} stroke={goldDeep} strokeWidth={1} />
      {p.light.from === 'far' ? <path d="M40 140V402M64 140V402M496 140V402M520 140V402" stroke={p.light.rim} strokeWidth={1.2} opacity={0.6} /> : null}

      {/* The garland and its laris. */}
      <Marigolds d={swagD} size={14} p={p} />
      <path d={swagD} stroke={jasmine} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 7" fill="none" transform="translate(0 10)" />
      <Marigolds d={laris.map(([x, y]) => I`M${x} ${y + 10}V${y + 58}`).join('')} size={11} p={p} />
      <path d={laris.map(([x, y]) => I`M${x} ${y + 66}l-5 9h10Z`).join('')} fill={gold} />

      {/* Silk drapes tied back with gold. */}
      <path d={`${dl.body}${dr.body}`} fill={url(`${id}s`)} />
      <path d={`${dl.hem}${dr.hem}`} stroke={gold} strokeWidth={2.4} fill="none" />
      <path d={`${dl.folds}${dr.folds}`} stroke={shade(c.primary, 0.45)} strokeWidth={1.4} fill="none" opacity={0.7} />
      <path d="M39 265a9 6 0 1 0 18 0a9 6 0 1 0 -18 0ZM503 265a9 6 0 1 0 18 0a9 6 0 1 0 -18 0Z" fill={gold} />

      {/* The roof: a jaali parapet, the gilt chhatri dome with a lotus collar and kalash finial, corner domelets. */}
      <rect x={34} y={80} width={492} height={16} fill={shade(gold, 0.18)} />
      <path d="M44 89H526" stroke={mirrorBase} strokeWidth={9} strokeDasharray="8 13" />
      <path d="M200 80C176 58 222 34 280 18C338 34 384 58 360 80ZM26 80C22 66 38 54 52 48C66 54 82 66 78 80ZM482 80C478 66 494 54 508 48C522 54 538 66 534 80Z" fill={url(`${id}g`)} stroke={goldDeep} strokeWidth={1.2} />
      <path d="M232 80C226 58 250 38 280 22M328 80C334 58 310 38 280 22M280 22V80" stroke={goldDeep} strokeWidth={1.2} fill="none" opacity={0.7} />
      <path d={scallops(196, 364, 80, 14, -5)} fill={tint(gold, 0.25)} stroke={goldDeep} strokeWidth={0.8} />
      <path d="M272 18C272 12 288 12 288 18ZM276 12C270 6 290 6 284 12ZM279 6V-6h2V6ZM51 48V38h2v10ZM507 48V38h2v10Z" fill={gold} />
      {full ? <path d={glints} fill={n.ivory} opacity={0.95} /> : null}
    </>,
  );
}

// ─────────────────────────── Toran ───────────────────────────

/**
 * A bandhanwar across the first arch's head (400×100): an embroidered velvet
 * band set with mirrors, mango leaves hanging from it in two greens with
 * marigold drops between them, and a mirror medallion at the centre.
 */
function Toran(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const gold = c.secondary;
  const W = 400;
  const leavesA: string[] = [];
  const leavesB: string[] = [];
  const ribs: string[] = [];
  const drops: string[] = [];
  for (let i = 0; i < 15; i++) {
    const x = 14 + i * 26.6;
    if (Math.abs(x - 200) < 20) continue;
    const len = i % 2 ? 50 : 60;
    (i % 2 ? leavesB : leavesA).push(I`M${x} 18C${x - 10} 30 ${x - 9} ${18 + len * 0.7} ${x} ${18 + len}C${x + 9} ${18 + len * 0.7} ${x + 10} 30 ${x} 18Z`);
    ribs.push(I`M${x} 20V${14 + len}`);
    if (i < 14 && Math.abs(x + 13 - 200) > 22) drops.push(I`M${x + 13} 24V${i % 2 ? 62 : 50}`);
  }
  const mirror = tint(mix(p.light.color, c.accent, 0.4), 0.2);
  // Backlit by the fire beyond: the leaves sink toward the hall's shadow and keep a warm rim on their edges.
  const night = mix(c.primary, '#000000', 0.45);
  return svg(
    W,
    100,
    <>
      <path d={leavesA.join('')} fill={mix(n.leafDark, night, 0.45)} />
      <path d={leavesB.join('')} fill={mix(n.leaf, night, 0.5)} />
      <path d={`${leavesA.join('')}${leavesB.join('')}`} fill="none" stroke={p.light.rim} strokeWidth={0.9} opacity={0.4} />
      <path d={ribs.join('')} stroke={mix(gold, night, 0.4)} strokeWidth={1.1} opacity={0.7} />
      <Marigolds d={drops.join('')} size={11} p={p} dim={0.5} />
      <rect x={0} y={0} width={W} height={20} fill={mix(c.primary, '#000000', 0.3)} />
      <path d={`M0 2.5H${W}M0 17.5H${W}`} stroke={gold} strokeWidth={2.4} />
      <path d={`M7 10H${W}`} stroke={mirror} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 19.9" />
      <path d={`M17 10H${W}`} stroke={gold} strokeWidth={4} strokeLinecap="square" strokeDasharray="0.1 19.9" />
      <path d="M200 22l18 18l-18 18l-18 -18Z" fill={gold} stroke={shade(gold, 0.4)} strokeWidth={1.2} />
      <circle cx={200} cy={40} r={9} fill={mirror} stroke={shade(gold, 0.3)} strokeWidth={1.4} />
      <path d="M200 58V70" stroke={gold} strokeWidth={2} />
      <Marigolds d="M200 74V96" size={10} p={p} dim={0.5} />
      <path d={glint(196, 36, 5)} fill={n.ivory} />
    </>,
  );
}

// ─────────────────────────── Ladis ───────────────────────────

/** Two genda-phool ladis down one jamb of the first arch (56×290): the outer one longer, leaves at the top, a gilt tassel at each foot. */
function ladis(side: -1 | 1): Draw {
  return (p) => {
    const outer = side < 0 ? 10 : 46;
    const inner = side < 0 ? 46 : 10;
    const gold = p.colors.secondary;
    return svg(
      56,
      290,
      <>
        <path d={I`M${outer} 0V272M${inner} 0V206`} stroke={shade(gold, 0.2)} strokeWidth={1.4} />
        <path d={I`M${outer - 2} 6C${outer - 14} 10 ${outer - 16} 22 ${outer - 12} 30C${outer - 8} 22 ${outer - 4} 14 ${outer} 8ZM${inner + 2} 6C${inner + 14} 10 ${inner + 16} 22 ${inner + 12} 30C${inner + 8} 22 ${inner + 4} 14 ${inner} 8Z`} fill={mix(p.nature.leafDark, mix(p.colors.primary, '#000000', 0.45), 0.4)} />
        <Marigolds d={I`M${outer} 14V262M${inner} 14V196`} size={17} p={p} dim={0.5} />
        <path d={I`M${outer} 268l-6 14h12ZM${inner} 202l-6 14h12Z`} fill={gold} />
      </>,
    );
  };
}

// ─────────────────────────── Elephant ───────────────────────────

/**
 * A caparisoned ivory elephant in profile, facing the aisle (300×240): a
 * velvet jhool with a gold border, fringe and mirror medallion, a gilt
 * mathapatti with a jewel drop, painted dots down the trunk, a tusk, gold
 * anklets. Lit from far: a rim along the back. The right-hand one is flipX.
 */
function Elephant(p: DrawProps) {
  const id = kitId(p, 'el');
  const c = p.colors;
  const n = p.nature;
  // Candlelit ivory: the body turned from the fire sits in the hall's warm shade, its back caught by the rim light.
  const skin = mix(mix(c.accent, c.surface, 0.3), shade(mix(c.secondary, c.primary, 0.3), 0.5), 0.3);
  const far = shade(skin, 0.34);
  const gold = c.secondary;
  const velvet = mix(c.primary, '#000000', 0.08);
  const backLine = 'M30 104C40 62 82 40 130 37C166 35 194 41 210 50C222 32 250 26 266 42';
  // Rump, back, the dip behind the head, the domed head, the trunk down to a curl, the jaw, the legs and belly.
  const body = `${backLine}C282 56 287 84 281 104C276 130 274 160 276 184C277 197 285 203 293 197C297 204 291 214 280 214C265 214 257 200 257 186C257 164 255 142 250 128C246 140 239 150 231 156L231 230H205L203 186C170 193 132 193 100 186L98 230H72L69 180C34 166 22 134 30 104Z`;
  // The jhool: velvet over the back to a scalloped hem, tasselled at each point.
  const hem = 'Q196 158 182 146Q168 160 154 147Q140 161 126 147Q112 159 98 145Q85 155 74 140';
  return svg(
    300,
    240,
    <>
      <defs>
        <Lin id={`${id}k`} stops={[[0, tint(skin, 0.42)], [0.3, skin], [1, shade(skin, 0.42)]]} y2={1} bbox />
      </defs>
      {/* The far legs, in shade. */}
      <path d="M104 178L106 229H126L127 182ZM178 182L180 229H200L199 180Z" fill={far} />
      <path d={body} fill={url(`${id}k`)} />
      <path d="M72 184C110 196 170 196 204 188" stroke={shade(skin, 0.3)} strokeWidth={6} fill="none" opacity={0.5} />
      {/* The jhool. */}
      <path d={`M70 56C100 40 170 36 208 48L212 140${hem}Z`} fill={velvet} stroke={gold} strokeWidth={3} />
      <path d="M80 64C106 52 166 48 200 57L203 132Q190 144 178 136Q166 148 154 138Q142 149 128 138Q114 147 100 136Q88 144 80 132Z" fill="none" stroke={gold} strokeWidth={1.2} opacity={0.75} />
      <path d="M74 141l-4 12h8ZM98 146l-4 12h8ZM126 148l-4 12h8ZM154 148l-4 12h8ZM182 147l-4 12h8ZM212 141l-4 12h8Z" fill={gold} />
      <circle cx={140} cy={94} r={19} fill={shade(gold, 0.25)} stroke={gold} strokeWidth={2.4} />
      <path d={`${glint(140, 94, 13)}`} fill={gold} />
      <circle cx={140} cy={94} r={6} fill={tint(mix(p.light.color, c.accent, 0.4), 0.3)} />
      <path d="M104 80h.1M176 80h.1M104 118h.1M176 118h.1" stroke={gold} strokeWidth={7} strokeLinecap="round" />
      {/* The fan ear with a painted border. */}
      <path d="M216 58C197 64 189 96 195 124C201 141 221 143 229 128C237 108 235 74 216 58Z" fill={shade(skin, 0.1)} stroke={shade(skin, 0.32)} strokeWidth={1.4} />
      <path d="M214 68C202 76 198 98 202 120C207 131 218 132 223 122" fill="none" stroke={gold} strokeWidth={2} strokeLinecap="round" strokeDasharray="0.1 6" />
      {/* The mathapatti down the forehead, a jewel at its point; the painted trunk; eye, tusk and anklets. */}
      <path d="M242 40C253 36 266 44 270 58L268 92L262 102L256 92C253 72 248 54 242 40Z" fill={gold} stroke={shade(gold, 0.4)} strokeWidth={1} />
      <path d="M250 48C258 51 264 58 265 68M258 60L262 88" stroke={shade(gold, 0.35)} strokeWidth={1.2} fill="none" />
      <circle cx={264} cy={110} r={4.5} fill={c.accent} stroke={gold} strokeWidth={1.2} />
      <path d="M279 116C278 140 277 160 279 182" stroke={c.primary} strokeWidth={4} strokeLinecap="round" strokeDasharray="0.1 9" fill="none" />
      <path d="M268 124C267 146 266 166 268 186" stroke={gold} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1 11" fill="none" />
      <ellipse cx={252} cy={76} rx={3.2} ry={2.2} fill={shade(c.primary, 0.5)} />
      <path d="M252 134C258 150 274 156 290 150C276 160 256 156 249 140Z" fill={n.ivory} />
      <path d="M72 218h26v7h-26ZM205 218h26v7h-26ZM106 218h20v6h-20ZM180 218h20v6h-20Z" fill={gold} />
      <path d="M76 230q4 -4 8 0M88 230q4 -4 8 0M209 230q4 -4 8 0M221 230q4 -4 8 0" stroke={n.ivory} strokeWidth={1.6} fill="none" opacity={0.7} />
      <path d={backLine} stroke={p.light.rim} strokeWidth={2} fill="none" opacity={0.6} />
      {p.detail === 'full' ? <path d={`${glint(140, 94, 5)}${glint(104, 118, 3.5)}${glint(176, 118, 3.5)}`} fill={n.ivory} /> : null}
    </>,
  );
}

// ─────────────────────────── Deepstand ───────────────────────────

/**
 * A brass samai deep-stand (90×300): a bell foot, a shaft with knops, a wide
 * five-wick dish and a three-wick upper tier under a kalash finial.
 */
function Deepstand(p: DrawProps) {
  const id = kitId(p, 'ds');
  const brass = mix(p.colors.secondary, p.nature.clay, 0.18);
  const edge = shade(brass, 0.42);
  const fill = url(`${id}b`);
  const knops = [100, 140, 180, 220, 250].map((y) => I`M36 ${y}a9 4 0 1 0 18 0a9 4 0 1 0 -18 0Z`).join('');
  return svg(
    90,
    300,
    <>
      <defs>
        <Lin id={`${id}b`} stops={metalLit(brass, p.light.from)} x2={1} bbox />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
      </defs>
      <path d={`M41 64h8v198h-8ZM43 30h4v30h-4Z${knops}M45 258C34 262 14 278 10 296H80C76 278 56 262 45 258ZM6 295h78v5H6ZM4 60Q45 90 86 60L82 56H8ZM24 30Q45 44 66 30L63 27H27ZM45 6C40 12 38 18 41 24H49C52 18 50 12 45 6Z`} fill={fill} stroke={edge} strokeWidth={0.8} />
      <path d="M8 57H82M27 28H63" stroke={tint(brass, 0.55)} strokeWidth={1.5} />
      {p.light.from === 'far' ? <path d="M41.5 64V258M48.5 64V258" stroke={p.light.rim} strokeWidth={0.8} opacity={0.5} /> : null}
      {[12, 28, 45, 62, 78].map((x, i) => (
        <FlameAt key={x} href={`${id}f`} x={x} y={58} s={i === 2 ? 26 : 21} skew={(x - 45) * 0.12} />
      ))}
      {[30, 45, 60].map((x) => (
        <FlameAt key={`u${x}`} href={`${id}f`} x={x} y={29} s={15} skew={(x - 45) * 0.15} />
      ))}
    </>,
  );
}

// ─────────────────────────── MirrorGlints ───────────────────────────

/** The glints' box: the second arch screen's mirror border (opening 480 wide, apex y 350, border 36; ArchScreen 'pointed' rise 1.05). */
const GW = 580;
const GH = 500;
const GTOP = 300;
/** The border's centre line (box units, left half): up the jamb from the foot to the springing, then over to the apex. */
const JAMB_X = GW / 2 - 258;
const SPRING_Y = 602 - GTOP;
const HEAD: Segment = [[JAMB_X, SPRING_Y], [JAMB_X, SPRING_Y - 132], [GW / 2 - 120, 362 - GTOP], [GW / 2, 330 - GTOP]];

/**
 * Glints on the mirror mosaic (set k of two): four-point stars with a soft
 * warm halo, scattered along the border band of the second arch, both sides.
 */
function mirrorGlints(k: number): Draw {
  return (p) => {
    const count = p.detail === 'full' ? 8 : 5;
    const spots: Array<[number, number, number]> = [];
    for (let i = 0; i < count; i++) {
      const j = i * 2 + k;
      const t = rand(j, p.seed + 31);
      const jitter = (rand(j, p.seed + 37) - 0.5) * 22;
      // 40% on the jambs, the rest round the head.
      const onJamb = t < 0.4;
      const [x, y] = onJamb ? [JAMB_X + jitter, SPRING_Y + (t / 0.4) * (GH - SPRING_Y - 30)] : at(HEAD, (t - 0.4) / 0.6);
      const size = 9 + rand(j, p.seed + 41) * 10;
      const dx = onJamb ? 0 : jitter * 0.6;
      const dy = onJamb ? 0 : jitter * 0.4;
      spots.push([x + dx, y + dy, size]);
      spots.push([GW - x - dx, y - dy, size * (0.8 + rand(j, p.seed + 43) * 0.4)]);
    }
    // Halos as round dots (one element per ring), the glints over them.
    const dots = spots.map(([x, y]) => I`M${x} ${y}h0.1`).join('');
    const halo = tint(p.light.color, 0.2);
    return svg(
      GW,
      GH,
      <>
        <path d={dots} stroke={halo} strokeWidth={44} strokeLinecap="round" opacity={0.14} />
        <path d={dots} stroke={halo} strokeWidth={22} strokeLinecap="round" opacity={0.3} />
        <path d={spots.map(([x, y, s]) => glint(x, y, s)).join('')} fill={p.nature.ivory} />
      </>,
    );
  };
}

// ─────────────────────────── the set ───────────────────────────

/** The hall: side walls x 230–970 from d 400 to 3000, ceiling at y −60. */
const ROOM = { x0: 230, x1: 970, top: -60, dNear: 400, dFar: 3000 };

export const sheeshMahal: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const fire = '#ffb35a';
  const lamp = '#ffc070';
  return {
    name: 'sheeshMahal',
    // The far end of the hall beyond the mandap: deep ruby, warmed where the fire burns.
    sky: `radial-gradient(ellipse 40% 30% at 50% 66%, ${mix(c.accent, '#fff0c8', 0.4)}, ${mix(c.primary, '#000000', 0.35)} 55%, ${mix(c.primary, '#000000', 0.6)})`,
    light: { from: 'far', color: '#ffc070', rim: '#ffe7b0' },
    fog: { color: '#2a0a14', near: 1400, far: 3000, max: 0.45 },
    veil: 0.35,
    focus: { x: 600, y: 600, z: -2100 },
    pieces: [
      {
        kind: 'plane',
        id: 'floor',
        art: 'floor:chequer',
        role: 'architecture',
        plane: floor({ x0: ROOM.x0, x1: ROOM.x1, dNear: ROOM.dNear, dFar: ROOM.dFar }),
        // Candlelit marble: the pale squares warmed toward the stock and the gold so the chequer glows instead of glaring.
        draw: (p) =>
          Floor({
            ...p,
            colors: { ...p.colors, surface: mix(mix(p.colors.surface, p.colors.primary, 0.3), p.colors.secondary, 0.12), background: mix(p.colors.background, p.colors.primary, 0.3) },
            variant: 'chequer',
            runner: true,
            pools: [
              { x: 600, d: 950, r: 240, color: '#ffe2a8' },
              { x: 355, d: 1000, r: 120, color: lamp },
              { x: 845, d: 1000, r: 120, color: lamp },
              { x: 600, d: 2060, r: 320, color: fire },
            ],
          }),
      },
      { kind: 'plane', id: 'ceiling', art: 'ceiling:mirrorCoffer', role: 'architecture', plane: ceiling({ x0: ROOM.x0, x1: ROOM.x1, y: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Ceiling, { variant: 'mirrorCoffer' }) },
      { kind: 'plane', id: 'wall-left', art: 'wall:cusped', role: 'architecture', plane: wall('left', { x: ROOM.x0, yTop: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Wall, { variant: 'cusped' }) },
      { kind: 'plane', id: 'wall-right', art: 'wall:cusped', role: 'architecture', plane: wall('right', { x: ROOM.x1, yTop: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Wall, { variant: 'cusped' }) },
      { kind: 'plane', id: 'screen-1', art: 'archScreen:cusped', role: 'architecture', plane: back({ x0: ROOM.x0, x1: ROOM.x1, yTop: ROOM.top, d: 1050 }), draw: drawWith(ArchScreen, { variant: 'cusped', opening: { w: 440, apexY: 340 } }) },
      { kind: 'plane', id: 'screen-2', art: 'archScreen:cusped', role: 'architecture', plane: back({ x0: ROOM.x0, x1: ROOM.x1, yTop: ROOM.top, d: 1750 }), draw: drawWith(ArchScreen, { variant: 'cusped', opening: { w: 480, apexY: 350 } }) },

      // The crown: the crystal chandelier, near and high.
      { kind: 'prop', id: 'chandelier', art: 'chandelier:crystal', role: 'hanging', ...hang({ x: 600, d: 500, w: 260, h: 170, top: ROOM.top }), motion: { kind: 'sway', amp: 1.2, period: 7 }, buildIn: 'drop', draw: drawWith(Chandelier, { variant: 'crystal' }) },

      // The first arch: brass deep-stands, elephants beyond the phone's edges, the toran across its head, ladis down its jambs.
      ...[-1, 1].map((s): Piece => ({ kind: 'prop', id: `lamp-${s < 0 ? 'l' : 'r'}`, art: 'deepstand', role: 'prop', ...billboard({ x: 600 + s * 245, d: 1000, w: 90, h: 300 }), buildIn: 'rise', draw: Deepstand })),
      ...[-1, 1].map((s): Piece => ({ kind: 'prop', id: `elephant-${s < 0 ? 'l' : 'r'}`, art: 'elephant', role: 'prop', ...billboard({ x: 600 + s * 240, d: 900, w: 260, h: 208 }), ...(s > 0 ? { flipX: true } : {}), draw: Elephant })),
      { kind: 'prop', id: 'toran', art: 'toran', role: 'hanging', ...hang({ x: 600, d: 1040, w: 400, h: 100, top: 330 }), motion: { kind: 'sway', amp: 0.8, period: 6 }, buildIn: 'drop', draw: Toran },
      ...([-1, 1] as const).map((s, i): Piece => ({ kind: 'prop', id: `ladis-${s < 0 ? 'l' : 'r'}`, art: 'marigoldStrand', role: 'hanging', ...hang({ x: 600 + s * 194, d: 1045, w: 56, h: 290, top: 380 }), motion: { kind: 'sway', amp: 1.6, period: 5.5, phase: i * 0.5 }, buildIn: 'drop', draw: ladis(s) })),

      // The second arch's mirror border catching the flame: two interleaved sets of glints twinkling out of step.
      ...[0, 1].map((k): Piece => ({ kind: 'prop', id: `glints-${k ? 'b' : 'a'}`, art: 'mirrorGlints', role: 'light', ...hang({ x: 600, d: 1740, w: GW, h: GH, top: GTOP }), motion: { kind: 'twinkle', amp: 0.85, period: k ? 3.1 : 2.3, phase: k * 0.5 }, buildIn: 'fade', draw: mirrorGlints(k) })),

      // The focal: the mandap and the sacred fire before it.
      { kind: 'prop', id: 'mandap', art: 'mandap', role: 'focal', ...billboard({ x: 600, d: 2100, w: MW, h: MH }), draw: Mandap },
      { kind: 'prop', id: 'fire', art: 'sacredFire', role: 'prop', ...billboard({ x: 600, d: 2060, w: 160, h: 170 }), motion: { kind: 'flicker', amp: 1, period: 1.6 }, buildIn: 'bloom', draw: SacredFire },

      // Lights: the fire's glow, the chandelier, the deep-stand flames.
      { kind: 'light', id: 'glow-fire', art: 'glow', role: 'light', at: { x: 600, y: 705, z: -2080 }, r: 170, color: fire, strength: 0.85, bloom: true, buildIn: 'bloom' },
      { kind: 'light', id: 'glow-chandelier', art: 'glow', role: 'light', at: { x: 600, y: -10, z: -500 }, r: 110, color: '#ffe2a8', strength: 0.4, motion: { kind: 'pulse', amp: 0.2, period: 6 } },
      ...[-1, 1].map((s, i): Piece => ({ kind: 'light', id: `glow-lamp-${s < 0 ? 'l' : 'r'}`, art: 'glow', role: 'light', at: { x: 600 + s * 245, y: 545, z: -1000 }, r: 70, color: lamp, strength: 0.55, motion: { kind: 'flicker', amp: 0.3, period: 1.9, phase: i * 0.45 }, buildIn: 'light' })),
    ],
    covers: { gate: 'palace', door: 'haveli', silk: 'damask', card: 'trifold' },
    particles: { count: 16, dNear: 600, dFar: 2200 },
  };
};
