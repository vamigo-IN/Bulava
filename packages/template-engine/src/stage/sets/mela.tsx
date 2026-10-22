import type { ReactNode } from 'react';
import { onCubic, shade, taper, tint, type Pt, type Segment } from '../../art/kit';
import { rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, LightString, Sky, Stall } from '../kit';
import { bodyStops, FlameAt, FlameDef, Glow, KitSvg, kitId, Lin, marigoldOf, metalLit, Rim, woodOf } from '../kit/architecture';
import { FerrisStand, FerrisWheel } from '../kit/favourites';
import { billboard, floor, hang, sky } from '../planes';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';
import { perspectiveOf } from '../units';

/**
 * T18 · Mela Chowk (`mela-chowk`, final.md §5.3): the `mela` stage.
 * A town square on the night of the fair. Bamboo poles wrapped in marigolds
 * carry swags of flowers and festoon bulbs across the square (the near layer);
 * two food carts glow at its sides over a striped durrie laid down the middle
 * (the middle layer); at the far end a low pandal stage under a striped
 * shamiana, its gold mandala crown, dhol and brass lamps lit from within, is
 * the focal point, and a Ferris wheel strung with bulbs turns slowly over the
 * old town's rooftops beside it.
 *
 * Set-local pieces (§6.4): PandalStage. The Ferris wheel and its stand (a
 * piece of its own so the wheel can turn on it) are the kit's (kit/favourites.tsx).
 */

// ─────────────────────────── helpers ───────────────────────────

const url = (id: string) => `url(#${id})`;
/** One decimal: compact markup (a unit is at most two pixels on any screen). */
const r1 = (n: number) => Math.round(n * 10) / 10;
/** A path string whose numbers are rounded to one decimal: P`M${x} ${y}`. */
const P = (t: TemplateStringsArray, ...v: number[]): string => {
  let out = t[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(r1(v[i] ?? 0)) + (t[i + 1] ?? '');
  return out;
};

/** Warm lamp light (the pandal) and the carts' softer glow. */
const LAMP = '#ffb347';
const CART = '#ffc46b';

/** A unit circle's quarter arcs as cubics: points round a circle by `onCubic`, never trigonometry. */
const K = 0.5523;
const QUARTERS: readonly Segment[] = [
  [[1, 0], [1, K], [K, 1], [0, 1]],
  [[0, 1], [-K, 1], [-1, K], [-1, 0]],
  [[-1, 0], [-1, -K], [-K, -1], [0, -1]],
  [[0, -1], [K, -1], [1, -K], [1, 0]],
];
/** n unit directions round the circle (n a multiple of 4), turned by `turn` of a step. */
function directions(n: number, turn = 0): Pt[] {
  const per = n / 4;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const quarter = QUARTERS[Math.floor(i / per) % 4] as Segment;
    const pt = onCubic(quarter, (i % per) / per + turn / per);
    const len = Math.sqrt(pt.x * pt.x + pt.y * pt.y) || 1;
    out.push([pt.x / len, pt.y / len]);
  }
  return out;
}
const at = (cx: number, cy: number, d: Pt, r: number): Pt => [r1(cx + d[0] * r), r1(cy + d[1] * r)];
const circle = (cx: number, cy: number, r: number) => P`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** A petal pointing outward from (cx, cy) along d: base at r0, tip at r1, half-width w. */
function petal(cx: number, cy: number, d: Pt, r0: number, r1: number, w: number): string {
  const n: Pt = [-d[1], d[0]];
  const b = at(cx, cy, d, r0);
  const t = at(cx, cy, d, r1);
  const m = (r0 + r1) / 2;
  const l: Pt = [cx + d[0] * m + n[0] * w, cy + d[1] * m + n[1] * w];
  const rr: Pt = [cx + d[0] * m - n[0] * w, cy + d[1] * m - n[1] * w];
  return P`M${b[0]} ${b[1]}Q${l[0]} ${l[1]} ${t[0]} ${t[1]}Q${rr[0]} ${rr[1]} ${b[0]} ${b[1]}Z`;
}

/** A cubic as a path. */
const cubic = ([p0, c1, c2, p3]: Segment) => P`M${p0[0]} ${p0[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p3[0]} ${p3[1]}`;

/**
 * Marigold heads strung along a path, in two tones with darker hearts: round-capped dashes of zero length make
 * the heads (one compact path per tone, however long the garland).
 */
function Beads({ d, r, p }: { d: string; r: number; p: DrawProps }) {
  const m = marigoldOf(p);
  const deep = mix(p.nature.flame, p.nature.clayDark, 0.42);
  const step = r * 1.7;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={m} strokeWidth={r1(r * 2)} strokeDasharray={`0 ${r1(step * 2)}`} />
      <path d={d} stroke={deep} strokeWidth={r1(r * 1.9)} strokeDasharray={`0 ${r1(step * 2)}`} strokeDashoffset={r1(step)} />
      <path d={d} stroke={shade(deep, 0.35)} strokeWidth={r1(r * 0.8)} strokeDasharray={`0 ${r1(step)}`} opacity={0.5} />
    </g>
  );
}

/** Marigold heads along a sagging curve. */
function Garland({ seg, r, p }: { seg: Segment; r: number; p: DrawProps }) {
  return <Beads d={cubic(seg)} r={r} p={p} />;
}

/**
 * A bamboo pole [36–40 × 470–900]: a lit cane with node rings, two marigold wraps, rope lashing at the foot and a
 * tuft of mango leaves at the top. Drawn lean (the square stands six of them).
 */
function Bamboo(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'bam');
  const cane = tint(mix(p.nature.clay, c.secondary, 0.6), 0.12);
  const m = marigoldOf(p);
  const x0 = w * 0.3;
  const x1 = w * 0.7;
  const top = 26;
  let nodes = '';
  for (let y = top + 52; y < h - 20; y += 64) nodes += P`M${x0 - 0.8} ${y}h${x1 - x0 + 1.6}v3h${-(x1 - x0 + 1.6)}Z`;
  const wrap = (y: number) => P`M${x0} ${y}L${x1} ${y - 9}M${x0} ${y + 8}L${x1} ${y - 1}M${x0} ${y + 16}L${x1} ${y + 7}`;
  const leaf = (dx: number, dy: number) => taper([[[w / 2, top + 4], [w / 2 + dx * 0.4, top - 4], [w / 2 + dx * 0.8, top - 6 + dy * 0.5], [w / 2 + dx, top + dy]]], [1.5, 4, 0], 5);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} stops={bodyStops(cane, light.from)} x1={x0} x2={x1} />
      </defs>
      <path d={leaf(-18, 14) + leaf(16, 18) + leaf(-4, -18) + leaf(8, -14)} fill={p.nature.leaf} />
      <rect x={r1(x0)} y={top} width={r1(x1 - x0)} height={h - top} fill={url(`${id}b`)} />
      <path d={nodes} fill={shade(cane, 0.3)} />
      <path d={wrap(h * 0.3) + wrap(h * 0.62)} stroke={m} strokeWidth={6} strokeLinecap="round" strokeDasharray="0 5.5" />
      <path d={P`M${x0} ${h - 34}L${x1} ${h - 40}M${x0} ${h - 27}L${x1} ${h - 33}`} stroke={mix(cane, c.text, 0.45)} strokeWidth={1.6} />
      <Rim p={p} x0={x0} x1={x1} y0={top} y1={h} />
    </KitSvg>
  );
}

/**
 * A marigold toran [w×h]: scalloped swags of marigold heads (two tones) with a jasmine strand inside each,
 * and at every joint a pair of mango leaves and a hanging marigold string ending in a small gold bell.
 */
function MarigoldToran(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'toran');
  const low = p.detail === 'low';
  const n = Math.max(2, Math.round(w / 200));
  const span = w / n;
  const sag = Math.min(h * 0.42, span * 0.3);
  const top = 8;
  let swags = '';
  let jasmine = '';
  let drops = '';
  let leaves = '';
  let bells = '';
  for (let s = 0; s < n; s++) {
    const x0 = s * span;
    swags += cubic([[x0 + 6, top + 4], [x0 + span * 0.3, top + sag * 1.33], [x0 + span * 0.7, top + sag * 1.33], [x0 + span - 6, top + 4]]);
    jasmine += cubic([[x0 + 14, top + 2], [x0 + span * 0.3, top + sag * 1.05], [x0 + span * 0.7, top + sag * 1.05], [x0 + span - 14, top + 2]]);
  }
  const drop = h - top - 30;
  for (let s = 0; s <= n; s++) {
    const x = s * span;
    const len = s % 2 ? drop : drop * 0.7;
    drops += P`M${x} ${top + 10}V${top + len}`;
    const by = top + len + 6;
    bells += P`M${x - 6} ${by + 10}Q${x - 6} ${by} ${x} ${by - 1}Q${x + 6} ${by} ${x + 6} ${by + 10}Z`;
    if (!low) {
      // A pair of mango leaves: each a pointed blade of two quadratic curves.
      leaves += P`M${x} ${top}q-14 2 -18 26q12 -6 18 -26Zm0 0q14 2 18 26q-12 -6 -18 -26Z`;
    }
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, light.from)} x2={1} bbox />
      </defs>
      <path d={P`M0 ${top}H${w}`} stroke={shade(p.nature.leafDark, 0.2)} strokeWidth={2} />
      {low ? null : <path d={leaves} fill={p.nature.leaf} />}
      <path d={jasmine} stroke={p.nature.ivory} strokeWidth={4.2} strokeDasharray="0 6.5" strokeLinecap="round" fill="none" opacity={0.9} />
      <Beads d={swags} r={7.4} p={p} />
      <Beads d={drops} r={5.6} p={p} />
      <path d={bells} fill={url(`${id}m`)} />
    </KitSvg>
  );
}

// ─────────────────────────── PandalStage (focal) ───────────────────────────

/**
 * A low stage under a striped shamiana [760×470]: the canopy's stripes run
 * from a gold finial, a frieze and a scalloped jhalar with tassels and bulbs;
 * inside, a deep curtain carries a gold mandala crown with a warm glow behind,
 * two brass samai lamps and a dhol on its stool; marigold garlands loop
 * between the four wrapped poles; the deck wears a pleated skirt and has
 * steps at its front.
 */
function PandalStage(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'pandal');
  const low = p.detail === 'low';
  const cx = w / 2;
  const deep = shade(c.primary, 0.45);
  const cream = mix(c.accent, c.background, 0.4);
  const gold = c.secondary;
  const wood = woodOf(p);
  const marigold = marigoldOf(p);
  const drum = mix(p.nature.clay, '#8a1c1c', 0.45);

  // Canopy: stripes radiating from the finial to the frieze.
  const apex: Pt = [cx, 32];
  const eaveY = 92;
  const eaveL = 22;
  const eaveR = w - 22;
  const stripes = 14;
  let darkStripes = '';
  for (let i = 0; i < stripes; i += 2) {
    const a = eaveL + ((eaveR - eaveL) * i) / stripes;
    const b = eaveL + ((eaveR - eaveL) * (i + 1)) / stripes;
    darkStripes += P`M${apex[0]} ${apex[1]}L${a} ${eaveY}L${b} ${eaveY}Z`;
  }
  // Frieze diamonds and the jhalar scallops.
  const friezeY0 = eaveY;
  const friezeY1 = eaveY + 22;
  let diamonds = '';
  for (let x = eaveL + 16; x < eaveR - 8; x += 32) diamonds += P`M${x} ${friezeY0 + 4}l7 7l-7 7l-7 -7Z`;
  const sw = 34;
  const jw = Math.floor((eaveR - eaveL) / sw) * sw;

  // Interior: the curtain's folds and the mandala crown.
  const inY0 = friezeY1;
  const deckY = 352;
  const mc: Pt = [cx, 214];
  const outer = directions(24);
  const inner = directions(16, 0.5);
  let petalsOut = '';
  for (const d of outer) petalsOut += petal(mc[0], mc[1], d, 54, 86, 9);
  let petalsIn = '';
  for (const d of inner) petalsIn += petal(mc[0], mc[1], d, 24, 50, 7);
  let beads = '';
  for (const d of directions(24, 0.5)) {
    const b = at(mc[0], mc[1], d, 60);
    beads += circle(b[0], b[1], 2.4);
  }

  // Poles (wrapped in marigold), the garlands between them.
  const poles = [64, 236, w - 236, w - 64];
  // Marigold wraps: a dashed stroke down each pole, skewed so the bands spiral.
  let wraps = '';
  for (const x of poles) wraps += P`M${x} ${friezeY1 + 8 + x * 0.5}V${deckY - 6 + x * 0.5}`;

  // Deck skirt pleats.
  const skirtY0 = deckY + 10;
  const skirtY1 = h - 10;

  // Brass samai lamps: base, stem and three saucers of wicks.
  const samai = (x: number) => {
    const y = deckY;
    return (
      <g key={`s${x}`}>
        <path d={P`M${x - 20} ${y}q20 -12 40 0Z M${x - 3} ${y - 8}h6V${y - 104}h-6Z`} fill={url(`${id}m`)} />
        <path d={P`M${x - 26} ${y - 52}q26 12 52 0q-26 -6 -52 0Z M${x - 20} ${y - 80}q20 10 40 0q-20 -5 -40 0Z M${x - 14} ${y - 104}q14 8 28 0q-14 -4 -28 0Z`} fill={url(`${id}m`)} />
        <path d={P`M${x - 4} ${y - 106}q4 -18 8 0Z`} fill={gold} />
        {low ? null : (
          <>
            <FlameAt href={`${id}f`} x={x - 22} y={y - 54} s={14} />
            <FlameAt href={`${id}f`} x={x + 22} y={y - 54} s={14} skew={4} />
            <FlameAt href={`${id}f`} x={x - 16} y={y - 82} s={12} skew={-3} />
            <FlameAt href={`${id}f`} x={x + 16} y={y - 82} s={12} />
          </>
        )}
        <FlameAt href={`${id}f`} x={x} y={y - 120} s={16} />
      </g>
    );
  };

  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(gold, light.from)} x2={1} bbox />
        <Lin id={`${id}c`} stops={[[0, tint(c.primary, 0.08)], [1, shade(c.primary, 0.2)]]} y1={0} y2={eaveY} />
        <Lin id={`${id}k`} stops={[[0, tint(drum, 0.18)], [0.45, drum], [1, shade(drum, 0.35)]]} y1={deckY - 74} y2={deckY - 22} />
        <Glow id={`${id}g`} color={LAMP} core={tint(LAMP, 0.5)} a={0.75} />
        <Lin id={`${id}d`} stops={[[0, tint(wood, 0.3)], [1, shade(wood, 0.15)]]} y1={deckY - 4} y2={deckY + 10} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
        <pattern id={`${id}j`} x={eaveL} y={friezeY1} width={sw} height={34} patternUnits="userSpaceOnUse">
          <path d={`M0 0q${sw / 2} 30 ${sw} 0Z`} fill={c.primary} stroke={gold} strokeWidth={1.6} />
          <path d={`M${sw / 2 - 1.5} 14h3v12h-3ZM${sw / 2 - 3.5} 26h7l-3.5 6Z`} fill={gold} />
        </pattern>
        <pattern id={`${id}s`} x={30} y={skirtY0} width={20} height={8} patternUnits="userSpaceOnUse">
          <path d="M0 0q10 14 20 0Z" fill={gold} />
        </pattern>
      </defs>
      {/* The interior: curtain, its folds and the warm light inside. */}
      <rect x={30} y={inY0} width={w - 60} height={deckY - inY0} fill={deep} />
      <path d={P`M74 ${(inY0 + deckY) / 2}H${w - 70}`} stroke={shade(deep, 0.35)} strokeWidth={deckY - inY0} strokeDasharray="5 17" opacity={0.6} />
      <ellipse cx={cx} cy={238} rx={330} ry={150} fill={url(`${id}g`)} />
      {/* The mandala crown. */}
      <path d={petalsOut} fill={url(`${id}m`)} />
      <path d={circle(mc[0], mc[1], 56)} fill={shade(c.primary, 0.25)} stroke={gold} strokeWidth={3} />
      <path d={beads} fill={tint(gold, 0.35)} />
      <path d={petalsIn} fill={url(`${id}m`)} opacity={0.92} />
      <path d={circle(mc[0], mc[1], 20)} fill={url(`${id}m`)} stroke={shade(gold, 0.35)} strokeWidth={2} />
      <path d={circle(mc[0], mc[1], 8)} fill={c.accent} />
      {/* Garlands hung down the curtain from the frieze, and looped between the poles. */}
      {low ? null : (
        <>
          <Garland seg={[[110, inY0 + 4], [108, inY0 + 70], [112, inY0 + 120], [110, inY0 + 168]]} r={5} p={p} />
          <Garland seg={[[w - 110, inY0 + 4], [w - 108, inY0 + 70], [w - 112, inY0 + 120], [w - 110, inY0 + 168]]} r={5} p={p} />
        </>
      )}
      {samai(150)}
      {samai(w - 150)}
      {/* The dhol on its stool: a red barrel with gold rings, cream heads and rope lacing, its sticks resting on it. */}
      <g>
        <path d={P`M${cx + 82} ${deckY}l5 -20h46l5 20Z`} fill={shade(wood, 0.25)} />
        <path d={P`M${cx + 66} ${deckY - 22}h84q9 -26 0 -52h-84q-9 26 0 52Z`} fill={url(`${id}k`)} />
        <path d={P`M${cx + 74} ${deckY - 70}l11 44l11 -44l11 44l11 -44l11 44l11 -44l11 44`} stroke={shade(drum, 0.45)} strokeWidth={1.6} fill="none" />
        <path d={P`M${cx + 64} ${deckY - 74}h10v52h-10Z M${cx + 142} ${deckY - 74}h10v52h-10Z`} fill={url(`${id}m`)} />
        <ellipse cx={cx + 64} cy={deckY - 48} rx={9} ry={26} fill={cream} stroke={shade(gold, 0.3)} strokeWidth={2} />
        <path d={P`M${cx + 104} ${deckY - 80}l50 -26M${cx + 112} ${deckY - 78}l46 -14`} stroke={tint(wood, 0.3)} strokeWidth={3.5} strokeLinecap="round" />
      </g>
      {/* Poles wrapped in marigold. */}
      {poles.map((x) => (
        <rect key={x} x={x - 7} y={friezeY1 - 2} width={14} height={deckY - friezeY1 + 2} fill={cream} />
      ))}
      <path d={wraps} stroke={marigold} strokeWidth={14} strokeDasharray="5 11" transform="skewY(-26.57)" />
      {/* Garlands looping between the poles. */}
      {low ? null : (
        <>
          <Garland seg={[[poles[0]!, friezeY1 + 30], [poles[0]! + 50, friezeY1 + 80], [poles[1]! - 50, friezeY1 + 80], [poles[1]!, friezeY1 + 30]]} r={5.5} p={p} />
          <Garland seg={[[poles[2]!, friezeY1 + 30], [poles[2]! + 50, friezeY1 + 80], [poles[3]! - 50, friezeY1 + 80], [poles[3]!, friezeY1 + 30]]} r={5.5} p={p} />
        </>
      )}
      {/* The shamiana. */}
      <path d={P`M${apex[0]} ${apex[1]}L${eaveL} ${eaveY}H${eaveR}Z`} fill={cream} />
      <path d={darkStripes} fill={url(`${id}c`)} />
      <path d={P`M${apex[0]} ${apex[1]}L${eaveR} ${eaveY}H${cx + 140}Z`} fill="#000000" opacity={0.12} />
      <path d={P`M${apex[0] - 6} ${apex[1] + 2}h12l-2 -10h-8Z`} fill={url(`${id}m`)} />
      <path d={circle(apex[0], apex[1] - 6, 4)} fill={gold} />
      <path d={P`M${apex[0] - 1} ${apex[1] - 8}V${apex[1] - 30}h2V${apex[1] - 8}Z`} fill={shade(gold, 0.2)} />
      <path d={P`M${apex[0] + 1} ${apex[1] - 30}q12 3 24 -2q-10 7 -2 12q-10 -2 -22 2Z`} fill={marigold} />
      <rect x={eaveL} y={friezeY0} width={eaveR - eaveL} height={friezeY1 - friezeY0} fill={url(`${id}m`)} />
      <path d={diamonds} fill={c.primary} />
      <rect x={eaveL} y={friezeY1} width={jw} height={34} fill={url(`${id}j`)} />
      <path d={P`M${eaveL + 10} ${friezeY1 - 1}H${eaveR}`} stroke={tint(light.color, 0.45)} strokeWidth={6} strokeDasharray="0 24" strokeLinecap="round" />
      {/* The deck: its lit top, the pleated skirt with a gold jhalar, the steps. */}
      <rect x={24} y={deckY - 2} width={w - 48} height={12} fill={url(`${id}d`)} />
      <rect x={30} y={skirtY0} width={w - 60} height={skirtY1 - skirtY0} fill={shade(c.primary, 0.15)} />
      <path d={P`M30 ${(skirtY0 + skirtY1) / 2}H${w - 30}`} stroke={shade(c.primary, 0.38)} strokeWidth={skirtY1 - skirtY0} strokeDasharray="9 9" opacity={0.55} />
      <rect x={30} y={skirtY0} width={w - 60} height={8} fill={url(`${id}s`)} />
      <path d={P`M${cx - 70} ${h - 34}h140v12h-140Z M${cx - 82} ${h - 22}h164v12h-164Z M${cx - 94} ${h - 10}h188v10h-188Z`} fill={tint(wood, 0.35)} />
      <path d={P`M${cx - 70} ${h - 23}h140M${cx - 82} ${h - 11}h164`} stroke={shade(wood, 0.3)} strokeWidth={2} />
      <Rim p={p} x0={30} x1={w - 30} y0={skirtY0} y1={skirtY1} />
    </KitSvg>
  );
}

// ─────────────────────────── the square's ground and sky ───────────────────────────

/** A striped cotton durrie laid down the square to the stage, drawn in plan over the earth floor. */
function durrie(p: DrawProps): ReactNode {
  const g = p.plane;
  if (!g) return null;
  const c = p.colors;
  const vid = kitId(p, 'vig');
  const fx = (x: number) => r1(x - g.x0);
  const fy = (d: number) => r1(g.dFar - d);
  const x0 = fx(520);
  const x1 = fx(680);
  const d0 = 1000;
  const d1 = 2130;
  // A woven dhurrie runner: a rust-saffron ground (the marigold's metal deepened), fine ivory and stock-colour
  // pinstripes across it every so often, and a border of the stock colour along both edges.
  const ground = mix(shade(c.secondary, 0.35), c.primary, 0.18);
  const ivory = mix(c.accent, c.muted, 0.2);
  // Woven bands, not rungs: a broad soft ivory band, then a fine stock-colour, ivory, stock-colour group, every 64.
  let bands = '';
  let fine = '';
  let hair = '';
  for (let d = d0 + 20; d < d1 - 30; d += 64) {
    bands += `M${x0} ${fy(d)}H${x1}`;
    fine += `M${x0} ${fy(d + 24)}H${x1}M${x0} ${fy(d + 38)}H${x1}`;
    hair += `M${x0} ${fy(d + 31)}H${x1}`;
  }
  const rows: ReactNode[] = [
    <rect key="g" x={x0} y={fy(d1)} width={r1(x1 - x0)} height={r1(d1 - d0)} fill={ground} opacity={0.85} />,
    <path key="b" d={bands} stroke={ivory} strokeWidth={14} opacity={0.26} />,
    <path key="f" d={fine} stroke={shade(c.primary, 0.1)} strokeWidth={3.5} opacity={0.6} />,
    <path key="h" d={hair} stroke={ivory} strokeWidth={2} opacity={0.5} />,
  ];
  const vcx = fx(600);
  const vcy = fy(1900);
  return (
    <g>
      <defs>
        <radialGradient id={vid} gradientUnits="userSpaceOnUse" cx={vcx} cy={vcy} r={1500} gradientTransform={`translate(${vcx} ${vcy}) scale(1 0.9) translate(${-vcx} ${-vcy})`}>
          <stop offset="0.25" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor={shade(c.primary, 0.7)} stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={p.w} height={p.h} fill={url(vid)} />
      {rows}
      <path d={`M${x0 + 9} ${fy(d1)}V${fy(d0)}M${x1 - 9} ${fy(d1)}V${fy(d0)}`} stroke={shade(c.primary, 0.2)} strokeWidth={12} opacity={0.85} />
      <path d={`M${x0 + 19} ${fy(d1)}V${fy(d0)}M${x1 - 19} ${fy(d1)}V${fy(d0)}`} stroke={ivory} strokeWidth={3} opacity={0.6} />
    </g>
  );
}

/**
 * The rest of the fair beyond the square, drawn into the sky plane between the horizon and the floor's far edge
 * (frame y 440–560): a row of peaked tents and stalls in silhouette with lit doorways, a string of tiny bulbs
 * between them, hazed by the night (it fills what a flat floor never reaches).
 */
function farFair(p: DrawProps): ReactNode {
  const c = p.colors;
  const ox = 360;
  const oy = 240;
  const base = oy + 552;
  const sil = mix(shade(c.primary, 0.5), '#18241c', 0.3);
  const sil2 = mix(shade(c.primary, 0.35), '#18241c', 0.4);
  const fid = kitId(p, 'fair');
  const q = Math.round;
  // A farther row of small tents (frame y ~ 500), then the near row with stripes, lit doors and a bulb string.
  let far = '';
  for (let j = 0, fx = -160; fx < 1360; j++) {
    const fw = q(26 + rand(j, 71) * 26);
    const fh = q(10 + rand(j, 73) * 10);
    const fb = q(oy + 512 + rand(j, 79) * 8);
    const X = q(fx + ox);
    far += `M${X} ${fb}v${-q(fh / 2)}l${q(fw / 2)} ${-q(fh / 2)}l${q(fw / 2)} ${q(fh / 2)}V${fb}Z`;
    fx += fw * (0.9 + rand(j, 89) * 0.6);
  }
  let tents = '';
  let tents2 = '';
  let stripes = '';
  let doors = '';
  let wire = '';
  for (let i = 0, x = -140; x < 1340; i++) {
    const back = i % 3 === 1;
    const tw = q((back ? 46 : 54) + rand(i, 41) * 40);
    const th = q((back ? 30 : 24) + rand(i, 43) * 18);
    const X = q(x + ox);
    const top = base - th;
    const wall = q(th * 0.45);
    const path = `M${X} ${base}v${-wall}l${q(tw / 2)} ${wall - th}l${tw - q(tw / 2)} ${th - wall}V${base}Z`;
    if (back) tents2 += path;
    else {
      tents += path;
      stripes += `M${X + q(tw / 2)} ${top}l${-q(tw * 0.2)} ${th - wall}h${q(tw * 0.12)}Z`;
      if (rand(i, 53) < 0.75) doors += `M${X + q(tw / 2) - 6} ${base}v${-q(8 + rand(i, 59) * 6)}h12V${base}Z`;
      wire += `${wire ? 'L' : 'M'}${X + q(tw / 2)} ${top + 2}`;
    }
    x += tw * (back ? 0.55 : 0.8 + rand(i, 61) * 0.25);
  }
  return (
    <svg viewBox={`0 0 ${p.w} ${p.h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id={`${fid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sil2} stopOpacity="0.8" />
          <stop offset="1" stopColor={sil} />
        </linearGradient>
      </defs>
      <rect x={0} y={oy + 439} width={p.w} height={p.h - oy - 439} fill={url(`${fid}b`)} />
      <path d={far} fill={sil2} opacity={0.8} />
      <path d={tents2} fill={sil2} />
      <path d={tents} fill={sil} />
      <path d={stripes} fill={mix(shade(c.secondary, 0.35), sil, 0.55)} />
      <path d={doors} fill={mix(LAMP, sil, 0.3)} opacity={0.8} />
      <path d={wire} stroke={mix(p.light.color, sil, 0.6)} strokeWidth={0.8} fill="none" />
      <path d={wire} stroke={tint(p.light.color, 0.3)} strokeWidth={3.2} strokeDasharray="0 13" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** The square's dust in the night air: a warm umber the ground and the haze lean toward. */
const DUST = '#3b2a17';

/**
 * The night over the fair, drawn into the sky plane over the kit's sky: the zenith deepened toward indigo (the words
 * sit on it), and the amber glow the fair's thousand bulbs throw up into the dust over the rooftops (below the names,
 * behind the skyline). Frame (0, 0) is the sky box's (360, 240).
 */
function nightGlow(p: DrawProps): ReactNode {
  const c = p.colors;
  const gid = kitId(p, 'ngl');
  const zenith = mix(mix(c.primary, '#0b1030', 0.5), '#000000', 0.35);
  return (
    <svg viewBox={`0 0 ${p.w} ${p.h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id={`${gid}z`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={zenith} stopOpacity="0.8" />
          <stop offset="0.38" stopColor={zenith} stopOpacity="0.45" />
          <stop offset="0.55" stopColor={zenith} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${gid}g`}>
          <stop offset="0" stopColor={LAMP} stopOpacity="0.42" />
          <stop offset="0.45" stopColor={mix(LAMP, c.primary, 0.4)} stopOpacity="0.2" />
          <stop offset="1" stopColor={c.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={p.w} height={p.h} fill={url(`${gid}z`)} />
      <ellipse cx={960} cy={692} rx={980} ry={150} fill={url(`${gid}g`)} />
    </svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const mela: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, role: Piece['role'], recipe: PlaneRecipe, draw: Draw, quiet?: boolean): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw, ...(quiet ? { quiet } : {}) });
  };

  // The square: beaten earth with the durrie down its middle and the lamps' light pooled on it; the old town's
  // rooftops under a starry night.
  const earth = drawWith(Floor, {
    variant: 'earth',
    pools: [
      { x: 600, d: 2250, r: 420, color: LAMP },
      { x: 270, d: 1700, r: 210, color: CART },
      { x: 930, d: 1700, r: 210, color: CART },
      { x: 600, d: 1200, r: 260, color: LAMP },
      { x: 1250, d: 2650, r: 320, color: LAMP },
    ],
  });
  // The ground in a night key: lit by the fair's lamps, not by day.
  const dusk = mix(shade(c.primary, 0.5), DUST, 0.45);
  const ground: Draw = (p) => earth({ ...p, colors: { ...p.colors, muted: mix(p.colors.muted, dusk, 0.66), surface: mix(p.colors.surface, dusk, 0.75), secondary: mix(p.colors.secondary, dusk, 0.45) } });
  plane('square', 'floor:earth', 'architecture', floor({ x0: -2200, x1: 3400, dNear: 0, dFar: 3150 }), (p) => (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {ground(p)}
      <svg viewBox={`0 0 ${p.w} ${p.h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        {durrie(p)}
      </svg>
    </div>
  ));
  const night = drawWith(Sky, { variant: 'night', skyline: 'rooftops', stars: true, moon: 'crescent' });
  plane('sky', 'sky:night', 'sky', sky({ d: perspectiveOf(60) * 4.62 }), (p) => (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {night(p)}
      {nightGlow(p)}
      {farFair(p)}
    </div>
  ));

  // The pandal stage, the focal point, and its glow.
  pieces.push({ kind: 'prop', id: 'pandal', art: 'pandalStage', role: 'focal', ...billboard({ x: 600, d: 2300, w: 760, h: 470 }), draw: PandalStage, buildIn: 'rise' });
  pieces.push({ kind: 'light', id: 'pandal-glow', art: 'glow', role: 'light', at: { x: 600, y: 600, z: -2290 }, r: 200, color: LAMP, strength: 0.6, bloom: true, motion: { kind: 'pulse', amp: 0.6, period: 3.4 }, buildIn: 'bloom' });

  // The Ferris wheel turning over the rooftops, on its stand.
  pieces.push({ kind: 'prop', id: 'wheel', art: 'ferrisWheel', role: 'prop', at: { x: 1290, y: 500, z: -2650 }, w: 600, h: 600, anchor: 'center', draw: FerrisWheel, motion: { kind: 'spin', amp: 1, period: 40 } });
  pieces.push({ kind: 'prop', id: 'wheel-stand', art: 'ferrisStand', role: 'prop', ...billboard({ x: 1290, d: 2640, w: 400, h: 300 }), draw: FerrisStand });

  // Food carts at the square's sides, their lamps flickering.
  for (const [k, x] of [
    ['l', 270],
    ['r', 930],
  ] as const) {
    pieces.push({ kind: 'prop', id: `cart-${k}`, art: 'stall:food', role: 'prop', ...billboard({ x, d: 1700, w: 220, h: 260 }), draw: drawWith(Stall, { variant: 'food' }) });
    pieces.push({ kind: 'light', id: `cart-glow-${k}`, art: 'glow', role: 'light', at: { x, y: 690, z: -1690 }, r: 110, color: CART, strength: 0.45, motion: { kind: 'flicker', amp: 0.4, period: 2.3, phase: k === 'l' ? 0 : 0.45 }, buildIn: 'light' });
  }

  // Bamboo poles in two pairs down the square, swags of marigold between each pair.
  const bamboo: Draw = Bamboo;
  for (const d of [1000, 1500])
    for (const [k, x] of [
      ['l', 350],
      ['r', 850],
    ] as const)
      pieces.push({ kind: 'prop', id: `pole-${k}-${d}`, art: 'pole:bamboo', role: 'architecture', ...billboard({ x, d, w: 36, h: 470 }), draw: bamboo, buildIn: 'rise' });
  // Above the eye line a mast is a silhouette against the night (quiet); the fair lights it from below.
  const mast: Draw = (p) => {
    const eye = p.eyeLine ?? 0;
    const night = mix(p.colors.primary, '#000000', 0.6);
    const mid = kitId(p, 'mast');
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {bamboo(p)}
        {eye > 0 ? (
          <svg viewBox={`0 0 ${p.w} ${p.h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id={mid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={r1(eye + 120)}>
                <stop offset="0" stopColor={night} stopOpacity="0.88" />
                <stop offset={r1(eye / (eye + 120))} stopColor={night} stopOpacity="0.78" />
                <stop offset="1" stopColor={night} stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={p.w} height={r1(Math.min(p.h, eye + 120))} fill={`url(#${mid})`} />
          </svg>
        ) : null}
      </div>
    );
  };
  // Two tall bamboo masts at the near swag's ends (they frame desktops and carry the swags; a phone never sees them).
  for (const [k, x] of [
    ['l', 190],
    ['r', 1010],
  ] as const)
    pieces.push({ kind: 'prop', id: `mast-${k}`, art: 'pole:bamboo', role: 'architecture', quiet: true, ...billboard({ x, d: 560, w: 40, h: 900 }), draw: mast });

  // Marigold swags strung high across the square, under and between the bulbs (the crown band).
  (
    [
      { d: 560, w: 820, h: 116, top: -80 },
      { d: 850, w: 760, h: 110, top: -215 },
    ] as const
  ).forEach((s, i) =>
    pieces.push({ kind: 'prop', id: `swag-${i}`, art: 'marigoldToran', role: 'hanging', ...hang({ x: 600, d: s.d, w: s.w, h: s.h, top: s.top }), draw: MarigoldToran, motion: { kind: 'sway', amp: 0.8, period: 6, phase: i * 0.4 }, buildIn: 'drop' }),
  );

  // More of the fair at the square's far corners: two more food carts, lit, beyond the poles (they fill desktops and a
  // film's turn; a phone never sees them). Architecture that runs on past the frame's edge, never a prop cut in half
  // in mid-air.
  for (const [k, x] of [
    ['l', -260],
    ['r', 1460],
  ] as const)
    pieces.push({ kind: 'prop', id: `cart-far-${k}`, art: 'stall:food', role: 'prop', ...billboard({ x, d: 2050, w: 220, h: 260 }), draw: drawWith(Stall, { variant: 'food' }), detail: 'high' });

  // Festoon bulbs strung across the square (the crown band).
  (
    [
      { d: 700, h: 140, top: -160 },
      { d: 1000, h: 150, top: -350 },
    ] as const
  ).forEach((s, i) =>
    pieces.push({
      kind: 'prop',
      id: `bulbs-${i}`,
      art: 'lightString:bulbs',
      role: 'hanging',
      ...hang({ x: 600, d: s.d, w: 900, h: s.h, top: s.top }),
      draw: drawWith(LightString, { variant: 'bulbs', sag: 0.6 }),
      motion: { kind: 'twinkle', amp: 0.5, period: 2, phase: i * 0.5 },
      buildIn: 'drop',
    }),
  );

  return {
    name: 'mela',
    // Behind the sky plane (seen only past its overscan): the night.
    sky: `linear-gradient(180deg, ${mix(c.primary, '#000000', 0.62)} 0%, ${mix(c.primary, '#000000', 0.4)} 60%, ${mix(c.primary, c.secondary, 0.18)} 100%)`,
    light: { from: 'above', color: '#ffd28a', rim: '#ffe9c0' },
    // Night haze with the fair's dust in it, in the stock's own key (green, red or blue nights alike).
    fog: { color: mix(mix(c.primary, '#000000', 0.68), DUST, 0.35), near: 1300, far: 3200, max: 0.45 },
    veil: 0.35,
    focus: { x: 600, y: 600, z: -2300 },
    pieces,
    covers: { gate: 'lane', door: 'haveli', silk: 'damask', card: 'poster' },
    particles: { count: 20, dNear: 700, dFar: 2300 },
  };
};
