import { onCubic, shade, taper, tint, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, Fountain, Sky } from '../kit';
import { awayStops, kitId, KitSvg, Lin, metalLit, P, type Stop } from '../kit/architecture';
import { back, billboard, floor, sky, wall } from '../planes';
import type { DrawProps, Piece, SetContext, StageSetFactory } from '../types';
import { perspectiveOf } from '../units';

/**
 * T02 · Chaar Bagh (`chaar-bagh`, final.md §5.3): a Mughal garden at blue
 * hour. Carved cedar doors open onto a marble water channel between lawns,
 * fountains and two rows of cypresses leading to a white baradari whose
 * mihrab glows warm gold, with two hazed minarets beyond and a crescent moon
 * in the crown band. The key light is the mihrab (far, warm), the rim the
 * blue-hour sky (cool): every silhouette is edged in cool light and every
 * opening glows warm.
 *
 * Set-local pieces (§6.4): Cypress, Baradari, Minaret, plus the garden floor
 * (the kit's marble flags and channel with lawns, a hauz and the mihrab's
 * reflection laid over them) and the lantern post that carries a fanoos.
 */

const KEY = '#ffe6b0';

/** Unit directions of an eight-point star's sixteen corners (tips and notches), every 22.5 degrees from north. */
const STAR16: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0.383, 0.924], [0.707, 0.707], [0.924, 0.383], [1, 0], [0.924, -0.383], [0.707, -0.707], [0.383, -0.924],
  [0, -1], [-0.383, -0.924], [-0.707, -0.707], [-0.924, -0.383], [-1, 0], [-0.924, 0.383], [-0.707, 0.707], [-0.383, 0.924],
];
const LAMP = '#ffd98a';

// ─────────────────────────── small helpers ───────────────────────────

const STOPS = (list: readonly Stop[]) => list;

/** Points along a cubic, t = 0..1 in n steps. */
function along(seg: Segment, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const q = onCubic(seg, i / n);
    return [r2(q.x), r2(q.y)] as Pt;
  });
}

/**
 * A cusped (multifoil) Mughal arch as a closed path: jambs from `yb` up to the
 * spring line `ys`, then a pointed arch to the apex `ya` whose intrados is a
 * row of lobes bulging outward, the cusps between them pointing in.
 */
function cuspedArch(xl: number, xr: number, ys: number, ya: number, yb: number, lobes: number, depth = 0.34): string {
  const xc = (xl + xr) / 2;
  const half = xc - xl;
  const rise = ys - ya;
  const left: Segment = [
    [xl, ys],
    [xl, ys - rise * 0.62],
    [xc - half * 0.42, ya + rise * 0.12],
    [xc, ya],
  ];
  const right: Segment = [
    [xc, ya],
    [xc + half * 0.42, ya + rise * 0.12],
    [xr, ys - rise * 0.62],
    [xr, ys],
  ];
  const pts = [...along(left, lobes), ...along(right, lobes).slice(1)];
  let d = P`M${xl} ${yb}V${ys}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const vx = mx - xc;
    const vy = my - ys - rise * 0.15;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const seg = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    d += P`Q${mx + (vx / len) * seg * depth} ${my + (vy / len) * seg * depth} ${b[0]} ${b[1]}`;
  }
  return `${d}${P`V${yb}Z`}`;
}

/** A plain pointed arch (for niches and inlay lines). */
function pointedArch(xl: number, xr: number, ys: number, ya: number, yb: number): string {
  const xc = (xl + xr) / 2;
  const half = xc - xl;
  const rise = ys - ya;
  return P`M${xl} ${yb}V${ys}C${xl} ${ys - rise * 0.62} ${xc - half * 0.42} ${ya + rise * 0.12} ${xc} ${ya}C${xc + half * 0.42} ${ya + rise * 0.12} ${xr} ${ys - rise * 0.62} ${xr} ${ys}V${yb}`;
}

/** An onion dome on a drum: base width `w` at y `yb`, apex at `ya`, centred on `cx`. */
function onionDome(cx: number, yb: number, ya: number, w: number): string {
  const h = yb - ya;
  const half = w / 2;
  return P`M${cx - half * 0.86} ${yb}C${cx - half * 1.12} ${yb - h * 0.42} ${cx - half * 0.5} ${yb - h * 0.72} ${cx - half * 0.08} ${ya + h * 0.08}Q${cx} ${ya - h * 0.02} ${cx + half * 0.08} ${ya + h * 0.08}C${cx + half * 0.5} ${yb - h * 0.72} ${cx + half * 1.12} ${yb - h * 0.42} ${cx + half * 0.86} ${yb}Z`;
}

/** A gilt kalash finial standing on (cx, yb), `h` tall. */
function finial(cx: number, yb: number, h: number): string {
  const s = h / 30;
  return (
    P`M${cx - 1.2 * s} ${yb}V${yb - 6 * s}H${cx + 1.2 * s}V${yb}Z` +
    P`M${cx} ${yb - 6 * s}c${3.6 * s} 0 ${4.6 * s} ${-2.6 * s} ${4.2 * s} ${-5 * s}c${-0.4 * s} ${-2.2 * s} ${-2.6 * s} ${-3.2 * s} ${-4.2 * s} ${-3.4 * s}c${-1.6 * s} ${0.2 * s} ${-3.8 * s} ${1.2 * s} ${-4.2 * s} ${3.4 * s}c${-0.4 * s} ${2.4 * s} ${0.6 * s} ${5 * s} ${4.2 * s} ${5 * s}Z` +
    P`M${cx} ${yb - 14.4 * s}c${2.2 * s} 0 ${2.8 * s} ${-1.6 * s} ${2.6 * s} ${-3}c${-0.2 * s} ${-1.4 * s} ${-1.6 * s} ${-2 * s} ${-2.6 * s} ${-2}c${-1 * s} 0 ${-2.4 * s} ${0.6 * s} ${-2.6 * s} ${2}c${-0.2 * s} ${1.4 * s} ${0.4 * s} ${3 * s} ${2.6 * s} ${3}Z` +
    P`M${cx - 0.6 * s} ${yb - 19 * s}V${yb - 30 * s}H${cx + 0.6 * s}V${yb - 19 * s}Z` +
    P`M${cx - 2.6 * s} ${yb - 25 * s}h${5.2 * s}`
  );
}

// ─────────────────────────── Cypress ───────────────────────────

/**
 * A Mughal garden cypress (the sarv): a tall flame of dark foliage on a short
 * trunk in a marble ring, backlit by the mihrab, so its face is deep blue-green
 * and both edges catch the cool blue-hour rim. The foliage is built from
 * tapered tufts that lift toward the tip, so it reads as a living tree.
 */
function Cypress(p: DrawProps) {
  const { w, h } = p;
  const id = kitId(p, 'cbcy');
  const k = w / 90;
  const cx = w / 2;
  const lean = (rand(p.seed, 3) - 0.5) * 6 * k;
  const leaf = mix(p.nature.leafDark, p.colors.primary, 0.3);
  const leafLit = mix(p.nature.leaf, p.colors.primary, 0.32);
  const deep = shade(leaf, 0.4);
  const rimLeaf = mix(leafLit, p.light.rim, 0.45);
  const footY = h - 16 * k;
  const baseY = h - 30 * k;
  const crown = 4 * k;
  // The flame's half-width along its height (t 0 at the foot, 1 at the tip): full a third of the way up, then a long taper.
  const half = (t: number) => w * 0.44 * (t < 0.28 ? 0.72 + t : 1 - ((t - 0.28) / 0.72) ** 1.35);
  // Whole units (the tree is 90 wide): the outline is drawn three times, so decimals cost.
  const R = Math.round;
  const at = (t: number, side: number): Pt => [R(cx + lean * t + side * half(t)), R(baseY - (baseY - crown) * t)];
  // Scalloped flanks: feathery lobes that lift toward the tip, one outline up the left and down the right.
  const lobes = p.detail === 'low' ? 7 : 11;
  const flank = (side: number) => {
    let d = '';
    for (let i = 0; i < lobes; i++) {
      const ta = side < 0 ? i / lobes : 1 - i / lobes;
      const tb = side < 0 ? (i + 1) / lobes : 1 - (i + 1) / lobes;
      const a = at(ta, side);
      const b = at(tb, side);
      const bulge = (5 + rand(i, p.seed + side + 9) * 5) * k * (1 - Math.min(ta, tb) * 0.6);
      d += P`Q${R((a[0] + b[0]) / 2 + side * bulge)} ${R((a[1] + b[1]) / 2 - bulge * 0.5)} ${b[0]} ${b[1]}`;
    }
    return d;
  };
  const tip = at(1, 0);
  const foot = at(0, -1);
  const body = `${P`M${foot[0]} ${foot[1]}`}${flank(-1)}${P`L${tip[0]} ${tip[1] - 3 * k}L${at(1, 1)[0]} ${at(1, 1)[1]}`}${flank(1)}Z`;
  // Layered boughs: soft chevrons stacked up the face, lighter on the upper sprays.
  const boughs: string[] = [];
  const rows = p.detail === 'low' ? 6 : 10;
  for (let i = 0; i < rows; i++) {
    const t = 0.08 + (i / rows) * 0.8;
    const [x, y] = at(t, 0);
    const hw = R(half(t) * (0.82 - rand(i, p.seed + 4) * 0.12));
    const q = R(hw * 0.4);
    boughs.push(P`M${x - hw} ${R(y + 10 * k)}Q${x - q} ${R(y - 2 * k)} ${x} ${R(y - 7 * k)}Q${x + q} ${R(y - 2 * k)} ${x + hw} ${R(y + 10 * k)}`);
  }
  const ring = mix(p.colors.background, p.colors.primary, 0.3);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} x1={cx - w * 0.44} x2={cx + w * 0.44} stops={STOPS([[0, rimLeaf], [0.14, leaf], [0.5, deep], [0.86, leaf], [1, rimLeaf]])} />
        <Lin id={`${id}v`} y1={0} y2={baseY} stops={STOPS([[0, p.light.rim, 0.22], [0.25, '#000000', 0], [0.75, '#000000', 0], [1, '#000000', 0.35]])} />
        <Lin id={`${id}r`} x1={cx - 30 * k} x2={cx + 30 * k} stops={STOPS([[0, shade(ring, 0.25)], [0.4, tint(ring, 0.12)], [1, shade(ring, 0.25)]])} />
        <path id={`${id}o`} d={body} />
      </defs>
      {/* The trunk and its marble ring bed. */}
      <path d={P`M${cx - 4 * k} ${footY}L${cx - 3 * k} ${baseY - 6 * k}H${cx + 3 * k}L${cx + 4 * k} ${footY}Z`} fill={mix(p.nature.clayDark, p.colors.text, 0.5)} />
      <ellipse cx={r2(cx)} cy={r2(footY + 4 * k)} rx={r2(34 * k)} ry={r2(9 * k)} fill={`url(#${id}r)`} />
      <ellipse cx={r2(cx)} cy={r2(footY + 2 * k)} rx={r2(28 * k)} ry={r2(5.5 * k)} fill={mix(leaf, p.colors.text, 0.4)} />
      <path d={P`M${cx - 34 * k} ${footY + 4 * k}V${h}H${cx + 34 * k}V${footY + 4 * k}`} fill={shade(ring, 0.3)} />
      {/* The foliage: the scalloped flame, its boughs, the dusk at its foot, the cool rim. */}
      <use href={`#${id}o`} fill={`url(#${id}b)`} />
      <path d={boughs.join('')} fill="none" stroke={leafLit} strokeWidth={r2(2.2 * k)} strokeLinecap="round" opacity={0.32} />
      <use href={`#${id}o`} fill={`url(#${id}v)`} />
      <use href={`#${id}o`} fill="none" stroke={p.light.rim} strokeWidth={r2(1.2 * k)} opacity={0.5} />
    </KitSvg>
  );
}

// ─────────────────────────── Baradari ───────────────────────────

/**
 * The focal piece: a white marble baradari on a stepped plinth, three cusped
 * bays (the centre one a mihrab glowing warm gold, the side ones backlit jaali
 * screens), pietra-dura spandrels and inlay frames, a deep chhajja on carved
 * brackets, a parapet of kanguras, two corner chhatris and a central onion dome
 * with a gilt finial. Lit from within: the openings glow, the marble is cool
 * blue-hour white, every edge facing the sky carries the rim.
 */
function Baradari(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'cbbd');
  const s = w / 760;
  const X = (x: number) => r2(x * s);
  const Y = (y: number) => r2((y * h) / 520);
  const full = p.detail === 'full';
  const marble = mix(c.background, c.primary, 0.14);
  const marbleShade = mix(c.background, c.primary, 0.32);
  const marbleDeep = mix(c.background, c.primary, 0.5);
  const inlay = mix(c.secondary, c.background, 0.15);
  const gold = c.secondary;
  const glowCore = mix(KEY, '#ffffff', 0.55);
  const warm = mix(KEY, p.nature.flame, 0.35);
  const interior = mix(c.primary, '#000000', 0.35);
  // Bays: [left, right, spring, apex] in design units (760 × 520).
  const bays = [
    { xl: 96, xr: 246, ys: 300, ya: 222, mihrab: false },
    { xl: 286, xr: 474, ys: 290, ya: 200, mihrab: true },
    { xl: 514, xr: 664, ys: 300, ya: 222, mihrab: false },
  ];
  const floorY = 440;
  const arch = (b: (typeof bays)[number], inset = 0) => cuspedArch(X(b.xl + inset), X(b.xr - inset), Y(b.ys), Y(b.ya + inset), Y(floorY), b.mihrab ? 5 : 4);
  const jaaliTop = 336;
  // Kanguras along the parapet.
  // Brackets under the chhajja at the piers.
  const piers = [70, 266, 494, 690];
  const brackets = piers.map((x) => P`M${X(x - 12)} ${Y(186)}H${X(x + 12)}C${X(x + 12)} ${Y(198)} ${X(x + 4)} ${Y(200)} ${X(x + 4)} ${Y(212)}H${X(x - 4)}C${X(x - 4)} ${Y(200)} ${X(x - 12)} ${Y(198)} ${X(x - 12)} ${Y(186)}Z`).join('');
  // Engaged colonnettes on the piers.
  const shafts = piers.map((x) => P`M${X(x - 5)} ${Y(214)}H${X(x + 5)}V${Y(floorY)}H${X(x - 5)}Z`).join('');
  const chhatri = (cx: number) => (
    <g key={cx}>
      <rect x={X(cx - 46)} y={Y(140)} width={X(92)} height={Y(8)} fill={marbleShade} />
      <path d={P`M${X(cx - 40)} ${Y(140)}V${Y(98)}H${X(cx + 40)}V${Y(140)}Z`} fill={interior} />
      <path d={[-40, -14, 14, 40].map((dx) => P`M${X(cx + dx - 4)} ${Y(140)}V${Y(98)}H${X(cx + dx + 4)}V${Y(140)}Z`).join('')} fill={marble} />
      <path d={[-27, 0, 27].map((dx) => pointedArch(X(cx + dx - 9), X(cx + dx + 9), Y(112), Y(102), Y(140))).join('')} fill={warm} opacity={0.55} />
      <rect x={X(cx - 50)} y={Y(90)} width={X(100)} height={Y(9)} fill={marble} />
      <path d={P`M${X(cx - 50)} ${Y(99)}H${X(cx + 50)}`} stroke={marbleDeep} strokeWidth={X(1.4)} />
      <path d={onionDome(X(cx), Y(90), Y(40), X(76))} fill={`url(#${id}dm)`} />
      <path d={finial(X(cx), Y(42), Y(26))} fill={`url(#${id}au)`} />
    </g>
  );
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}mb`} x1={0} x2={w} stops={STOPS([[0, marbleShade], [0.12, marble], [0.5, tint(marble, 0.1)], [0.88, marble], [1, marbleShade]])} />
        <Lin id={`${id}dm`} x1={X(260)} x2={X(500)} stops={STOPS([[0, marbleShade], [0.35, tint(marble, 0.18)], [0.6, marble], [1, marbleDeep]])} />
        <Lin id={`${id}au`} x1={0} x2={w} stops={metalLit(gold, p.light.from)} />
        <Lin id={`${id}aw`} x1={0} x2={w} stops={awayStops(p.light.from, 0.22)} />
        <radialGradient id={`${id}mi`} gradientUnits="userSpaceOnUse" cx={X(380)} cy={Y(400)} r={X(150)}>
          <stop offset="0" stopColor={glowCore} />
          <stop offset="0.4" stopColor={KEY} />
          <stop offset="0.75" stopColor={warm} />
          <stop offset="1" stopColor={mix(warm, interior, 0.55)} />
        </radialGradient>
        <radialGradient id={`${id}sb`} gradientUnits="userSpaceOnUse" cx="0.5" cy="1" r="1">
          <stop offset="0" stopColor={warm} />
          <stop offset="1" stopColor={interior} />
        </radialGradient>
        <Lin id={`${id}sd`} y1={Y(200)} y2={Y(floorY)} stops={STOPS([[0, interior], [0.55, mix(interior, warm, 0.25)], [1, mix(interior, warm, 0.7)]])} />
        <pattern id={`${id}jl`} width={X(14)} height={X(14)} patternUnits="userSpaceOnUse">
          <rect width={X(14)} height={X(14)} fill={mix(warm, KEY, 0.4)} />
          <path d={P`M0 ${X(7)}L${X(7)} 0L${X(14)} ${X(7)}L${X(7)} ${X(14)}Z`} fill="none" stroke={marbleShade} strokeWidth={X(2.6)} />
          <circle cx={X(7)} cy={X(7)} r={X(1.6)} fill={marbleShade} />
        </pattern>
        <pattern id={`${id}kg`} x={X(50)} y={Y(132)} width={X(20)} height={r2(Y(150) - Y(132))} patternUnits="userSpaceOnUse">
          <path d={P`M${X(2)} ${Y(18)}V${Y(11)}Q${X(2)} ${Y(4)} ${X(10)} 0Q${X(18)} ${Y(4)} ${X(18)} ${Y(11)}V${Y(18)}Z`} fill={marble} />
        </pattern>
        <Lin id={`${id}pl`} y1={Y(440)} y2={Y(520)} stops={STOPS([[0, mix(marble, warm, 0.22)], [1, marbleShade]])} />
      </defs>

      {/* The central dome on its drum, then the corner chhatris. */}
      <rect x={X(300)} y={Y(118)} width={X(160)} height={Y(24)} fill={marbleShade} />
      <path d={[312, 340, 368, 396, 424].map((x) => P`M${X(x)} ${Y(140)}V${Y(126)}Q${X(x + 9)} ${Y(118)} ${X(x + 18)} ${Y(126)}V${Y(140)}Z`).join('')} fill={marbleDeep} opacity={0.55} />
      <path d={onionDome(X(380), Y(118), Y(18), X(170))} fill={`url(#${id}dm)`} />
      {full ? <path d={P`M${X(310)} ${Y(104)}Q${X(380)} ${Y(92)} ${X(450)} ${Y(104)}`} fill="none" stroke={inlay} strokeWidth={X(1.6)} opacity={0.6} /> : null}
      <path d={onionDome(X(380), Y(118), Y(18), X(170))} fill="none" stroke={p.light.rim} strokeWidth={X(1.6)} opacity={0.55} />
      <path d={finial(X(380), Y(20), Y(28))} fill={`url(#${id}au)`} />
      {chhatri(70)}
      {chhatri(690)}

      {/* The parapet with its kanguras and inlay band, the chhajja and its brackets. */}
      <rect x={X(50)} y={Y(132)} width={X(660)} height={r2(Y(150) - Y(132))} fill={`url(#${id}kg)`} />
      <rect x={X(40)} y={Y(150)} width={X(680)} height={Y(26)} fill={`url(#${id}mb)`} />
      <path d={P`M${X(48)} ${Y(163)}H${X(712)}`} stroke={inlay} strokeWidth={X(2.2)} strokeDasharray={`${X(10)} ${X(6)}`} />
      <path d={P`M${X(18)} ${Y(176)}H${X(742)}L${X(730)} ${Y(188)}H${X(30)}Z`} fill={marble} />
      <path d={P`M${X(30)} ${Y(188)}H${X(730)}V${Y(192)}H${X(30)}Z`} fill={marbleDeep} />
      <path d={P`M${X(18)} ${Y(176)}H${X(742)}`} stroke={p.light.rim} strokeWidth={X(1.6)} opacity={0.6} />

      {/* The facade. */}
      <rect x={X(40)} y={Y(192)} width={X(680)} height={Y(floorY - 192)} fill={`url(#${id}mb)`} />
      {/* Openings: the glowing mihrab, the backlit jaali bays. */}
      {bays.map((b, i) => (
        <g key={i}>
          <path d={arch(b)} fill={b.mihrab ? `url(#${id}mi)` : `url(#${id}sd)`} />
          {b.mihrab ? null : <rect x={X(b.xl)} y={Y(jaaliTop)} width={X(b.xr - b.xl)} height={Y(floorY - jaaliTop)} fill={`url(#${id}jl)`} />}
          {b.mihrab ? null : <path d={P`M${X(b.xl)} ${Y(jaaliTop)}H${X(b.xr)}`} stroke={marble} strokeWidth={X(4)} />}
          {/* An inlay frame (alfiz) and the rosettes of the spandrels. */}
          <path d={P`M${X(b.xl - 12)} ${Y(floorY)}V${Y(b.ya - 14)}H${X(b.xr + 12)}V${Y(floorY)}`} fill="none" stroke={inlay} strokeWidth={X(2)} />
          <circle cx={X(b.xl + 8)} cy={Y(b.ya + 2)} r={X(7)} fill="none" stroke={inlay} strokeWidth={X(1.6)} />
          <circle cx={X(b.xr - 8)} cy={Y(b.ya + 2)} r={X(7)} fill="none" stroke={inlay} strokeWidth={X(1.6)} />
          {full ? <path d={arch(b)} fill="none" stroke={marbleDeep} strokeWidth={X(2.2)} /> : null}
        </g>
      ))}
      {/* Inside the mihrab: a niche outlined in gold and a hanging lamp. */}
      <path d={pointedArch(X(336), X(424), Y(330), Y(268), Y(floorY))} fill="none" stroke={mix(gold, KEY, 0.4)} strokeWidth={X(2.4)} opacity={0.85} />
      <path d={P`M${X(380)} ${Y(200)}V${Y(262)}`} stroke={mix(gold, interior, 0.3)} strokeWidth={X(1.2)} />
      <path d={P`M${X(370)} ${Y(262)}H${X(390)}L${X(386)} ${Y(282)}H${X(374)}Z`} fill={`url(#${id}au)`} />
      <ellipse cx={X(380)} cy={Y(276)} rx={X(5)} ry={Y(4)} fill={glowCore} />
      {/* Piers: colonnettes and brackets, then the shading away from the light and the rim on the edges. */}
      <path d={shafts} fill={tint(marble, 0.16)} />
      <path d={brackets} fill={marbleShade} />
      <rect x={X(40)} y={Y(192)} width={X(680)} height={Y(floorY - 192)} fill={`url(#${id}aw)`} />
      <path d={P`M${X(41)} ${Y(192)}V${Y(floorY)}M${X(719)} ${Y(192)}V${Y(floorY)}`} stroke={p.light.rim} strokeWidth={X(1.6)} opacity={0.5} />

      {/* The plinth and its steps, washed by the mihrab's light. */}
      <path d={P`M${X(10)} ${Y(floorY)}H${X(750)}V${Y(472)}H${X(10)}Z`} fill={`url(#${id}pl)`} />
      <path d={[0, 1, 2, 3, 4, 5, 6, 7].map((i) => P`M${X(26 + i * 48)} ${Y(448)}h${X(30)}v${Y(16)}h${X(-30)}Z`).join('') + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => P`M${X(398 + i * 48)} ${Y(448)}h${X(30)}v${Y(16)}h${X(-30)}Z`).join('')} fill="none" stroke={inlay} strokeWidth={X(1.4)} opacity={0.75} />
      <path d={P`M${X(10)} ${Y(floorY)}H${X(750)}`} stroke={p.light.rim} strokeWidth={X(1.4)} opacity={0.5} />
      <path d={P`M${X(270)} ${Y(472)}H${X(490)}V${Y(486)}H${X(270)}Z`} fill={mix(marble, warm, 0.3)} />
      <path d={P`M${X(254)} ${Y(486)}H${X(506)}V${Y(502)}H${X(254)}Z`} fill={mix(marble, warm, 0.18)} />
      <path d={P`M${X(238)} ${Y(502)}H${X(522)}V${Y(520)}H${X(238)}Z`} fill={mix(marble, warm, 0.08)} />
      <path d={P`M${X(270)} ${Y(486)}H${X(490)}M${X(254)} ${Y(502)}H${X(506)}`} stroke={marbleDeep} strokeWidth={X(1.4)} opacity={0.6} />
      <path d={P`M${X(10)} ${Y(472)}H${X(238)}V${Y(520)}H${X(10)}ZM${X(522)} ${Y(472)}H${X(750)}V${Y(520)}H${X(522)}Z`} fill={marbleShade} />
    </KitSvg>
  );
}

// ─────────────────────────── The far garden ───────────────────────────

/**
 * The garden's far end, one quiet hazed back plane (content x 0 = world x0,
 * y 0 = world yTop): the enclosure wall with its blind arcade and corner
 * chhatris, a dark line of mango and cypress crowns behind it, and two
 * minarets (tapering shafts, three balconies on brackets, a chhatri and a gilt
 * finial) rising into the blue hour. Everything is tone on tone with the sky.
 */
function FarGarden(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'cbfg');
  const g = p.plane ?? { x0: -2600, x1: 3800, y0: 0, y1: 800, dNear: 2800, dFar: 2800 };
  const X = (x: number) => Math.round(x - g.x0);
  const Y = (y: number) => Math.round(y - g.y0);
  const marble = mix(c.background, c.primary, 0.42);
  const marbleShade = mix(c.background, c.primary, 0.58);
  const trees = mix(mix(p.nature.leafDark, c.primary, 0.6), '#000000', 0.25);
  const treesLit = mix(trees, p.light.rim, 0.14);
  // The tree line: rounded crowns with cypress spires between, behind the wall.
  let crowns = P`M0 ${Y(800)}V${Y(660)}`;
  const step = 96;
  for (let x = 0; x < w; x += step) {
    if (x < 600 || x > w - 600) {
      crowns += P`L${x + step} ${Y(650)}`;
      continue;
    }
    const top = Math.round(600 + rand(x, p.seed + 1) * 50);
    const spire = rand(x, p.seed + 2) > 0.72;
    if (spire) crowns += P`L${x + step * 0.3} ${Y(top)}L${x + step * 0.5} ${Y(top - 110)}L${x + step * 0.7} ${Y(top)}L${x + step} ${Y(650)}`;
    else crowns += P`Q${x + step * 0.1} ${Y(top - 20)} ${x + step * 0.5} ${Y(top - 26)}Q${x + step * 0.9} ${Y(top - 20)} ${x + step} ${Y(650)}`;
  }
  crowns += P`V${Y(800)}Z`;
  // The enclosure wall: coping, a blind arcade of pointed niches, corner chhatris at the garden's corners.
  const wallTop = 700;
  const chhatri = (wx: number) =>
    P`M${X(wx - 44)} ${Y(wallTop)}V${Y(wallTop - 70)}H${X(wx + 44)}V${Y(wallTop)}Z` + onionDome(X(wx), Y(wallTop - 76), Y(wallTop - 136), 92) + P`M${X(wx - 54)} ${Y(wallTop - 70)}H${X(wx + 54)}V${Y(wallTop - 80)}H${X(wx - 54)}Z`;
  // The minarets.
  const minaret = (wx: number) => {
    const cx = X(wx);
    const mw = 92;
    const mh = 760;
    const yb = Y(800);
    const top = yb - mh * 0.84;
    const halfAt = (y: number) => mw * (0.24 + ((y - top) / (yb - top)) * 0.12);
    const balconies = [0.36, 0.6, 0.82].map((f) => yb - (yb - top) * f);
    return {
      shaft: P`M${cx - mw * 0.36} ${yb}L${cx - mw * 0.24} ${top}H${cx + mw * 0.24}L${cx + mw * 0.36} ${yb}Z`,
      decks:
        balconies.map((y) => P`M${cx - halfAt(y) - mw * 0.2} ${y - 10}H${cx + halfAt(y) + mw * 0.2}V${y}H${cx - halfAt(y) - mw * 0.2}Z` + P`M${cx - halfAt(y) - mw * 0.16} ${y - 10}V${y - 22}H${cx + halfAt(y) + mw * 0.16}V${y - 10}`).join('') +
        P`M${cx - mw * 0.3} ${top}V${top - mh * 0.04}H${cx + mw * 0.3}V${top}Z` +
        onionDome(cx, top - mh * 0.04, top - mh * 0.12, mw * 0.7),
      brackets: balconies.map((y) => P`M${cx - halfAt(y) - mw * 0.16} ${y}L${cx - halfAt(y)} ${y + 18}M${cx + halfAt(y) + mw * 0.16} ${y}L${cx + halfAt(y)} ${y + 18}M${cx - halfAt(y) * 0.4} ${y + 30}V${y + 70}M${cx + halfAt(y) * 0.4} ${y + 30}V${y + 70}`).join(''),
      finial: finial(cx, top - mh * 0.115, mh * 0.04),
    };
  };
  const MINARETS = [-20, 1220];
  const mins = MINARETS.map(minaret);
  return (
    <KitSvg p={p}>
      <defs>
        {MINARETS.map((wx, i) => (
          <Lin key={i} id={`${id}s${i}`} x1={X(wx) - 26} x2={X(wx) + 26} stops={STOPS([[0, marbleShade], [0.45, mix(marble, p.light.rim, 0.12)], [1, marbleShade]])} />
        ))}
        <pattern id={`${id}n`} width={60} height={r2(h)} patternUnits="userSpaceOnUse">
          <path d={pointedArch(12, 48, Y(wallTop + 40), Y(wallTop + 24), Y(788))} fill={marbleShade} />
        </pattern>
        <Lin id={`${id}t`} y1={Y(560)} y2={Y(800)} stops={STOPS([[0, treesLit], [0.5, trees], [1, shade(trees, 0.2)]])} />
      </defs>
      <path d={crowns} fill={`url(#${id}t)`} />
      {mins.map((m, i) => (
        <g key={i}>
          <path id={`${id}m${i}`} d={m.shaft} fill={`url(#${id}s${i})`} />
          <path d={m.decks} fill={marble} />
          <path d={m.brackets} stroke={marbleShade} strokeWidth={3} />
          <path d={m.finial} fill={mix(c.secondary, marble, 0.45)} />
          <use href={`#${id}m${i}`} fill="none" stroke={p.light.rim} strokeWidth={1.4} opacity={0.3} />
        </g>
      ))}
      <path d={[-300, 1500, -1500, 2700].map(chhatri).join('')} fill={marble} />
      <rect x={0} y={Y(wallTop)} width={r2(w)} height={r2(h - Y(wallTop))} fill={marble} />
      <rect x={0} y={Y(wallTop)} width={r2(w)} height={r2(h - Y(wallTop))} fill={`url(#${id}n)`} />
      <path d={P`M0 ${Y(wallTop + 10)}H${w}`} stroke={marbleShade} strokeWidth={4} />
      <path d={P`M0 ${Y(wallTop)}H${w}`} stroke={p.light.rim} strokeWidth={2} opacity={0.4} />
    </KitSvg>
  );
}

// ─────────────────────────── Lantern post ───────────────────────────

/**
 * A slender gilt lantern standard on the marble rail: a fluted post with a
 * scrolled arm from which a hexagonal fanoos hangs, lit from within.
 * The arm reaches right; the right-hand rail's posts are flipX twins (the far
 * key light shades both sides alike).
 */
function LanternPost(p: DrawProps) {
  const { w, h } = p;
  const id = kitId(p, 'cblp');
  const k = w / 90;
  const postX = 14 * k;
  const hookX = 62 * k;
  const arm: Segment = [
    [postX, 30 * k],
    [postX + 6 * k, 6 * k],
    [hookX - 10 * k, 4 * k],
    [hookX, 22 * k],
  ];
  // The fanoos: a hexagonal Mughal lantern on a short chain, its cusped glass panels lit from within.
  const lx = hookX;
  const top = 34 * k;
  const sh = 46 * k; // shoulder
  const bot = 80 * k;
  const glass = P`M${lx - 9 * k} ${sh}L${lx - 12 * k} ${sh + 6 * k}L${lx - 9 * k} ${bot - 6 * k}H${lx + 9 * k}L${lx + 12 * k} ${sh + 6 * k}L${lx + 9 * k} ${sh}Z`;
  const frame =
    P`M${lx - 11 * k} ${sh}H${lx + 11 * k}L${lx + 7 * k} ${top + 2 * k}H${lx - 7 * k}Z` + // the hood
    P`M${lx - 10 * k} ${bot - 6 * k}H${lx + 10 * k}L${lx + 5 * k} ${bot}H${lx - 5 * k}Z` + // the base
    P`M${lx - 1.2 * k} ${bot}H${lx + 1.2 * k}L${lx} ${bot + 9 * k}Z` + // the drop
    P`M${lx - 0.6 * k} ${22 * k}H${lx + 0.6 * k}V${top + 2 * k}H${lx - 0.6 * k}Z`; // the chain
  const ribs = P`M${lx - 3.5 * k} ${sh}V${bot - 6 * k}M${lx + 3.5 * k} ${sh}V${bot - 6 * k}M${lx - 12 * k} ${sh + 6 * k}H${lx + 12 * k}`;
  const cusps = [-6.5, 0, 6.5].map((dx) => pointedArch(lx + (dx - 2.6) * k, lx + (dx + 2.6) * k, sh + 15 * k, sh + 10 * k, bot - 10 * k)).join('');
  const gold = `url(#${id}g)`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} x1={postX - 5 * k} x2={postX + 5 * k} stops={metalLit(p.colors.secondary, p.light.from)} />
        <radialGradient id={`${id}l`} gradientUnits="userSpaceOnUse" cx={r2(lx)} cy={r2((sh + bot) / 2)} r={r2(16 * k)}>
          <stop offset="0" stopColor={mix(LAMP, '#ffffff', 0.7)} />
          <stop offset="0.45" stopColor={LAMP} />
          <stop offset="1" stopColor={mix(LAMP, p.nature.flame, 0.55)} />
        </radialGradient>
      </defs>
      <path d={taper([arm], [3.2 * k, 1.6 * k], 10)} fill={gold} />
      <path d={P`M${postX - 3 * k} ${h}V${30 * k}H${postX + 3 * k}V${h}Z`} fill={gold} />
      <path d={P`M${postX - 7 * k} ${h}L${postX - 4 * k} ${h - 16 * k}H${postX + 4 * k}L${postX + 7 * k} ${h}Z`} fill={gold} />
      <path d={[0.42, 0.68].map((f) => P`M${postX - 4.5 * k} ${h * f}h${9 * k}v${3 * k}h${-9 * k}Z`).join('')} fill={gold} />
      <circle cx={r2(postX)} cy={r2(28 * k)} r={r2(4 * k)} fill={gold} />
      <path d={finial(postX, 24 * k, 18 * k)} fill={gold} />
      <path d={P`M${postX + 3 * k} ${32 * k}V${h - 16 * k}`} stroke={p.light.rim} strokeWidth={r2(0.9 * k)} opacity={0.5} />
      <path d={glass} fill={`url(#${id}l)`} />
      <path d={cusps} fill="none" stroke={mix(p.colors.secondary, p.nature.flame, 0.3)} strokeWidth={r2(0.7 * k)} opacity={0.7} />
      <path d={ribs} stroke={mix(p.colors.secondary, '#000000', 0.25)} strokeWidth={r2(1 * k)} />
      <path d={frame} fill={gold} />
      <path d={finial(lx, top + 2 * k, 9 * k)} fill={gold} />
    </KitSvg>
  );
}

// ─────────────────────────── Garden rail ───────────────────────────

/**
 * The low marble parapet along each walkway (a wall plane; content x runs from
 * the near end): a moulded coping catching the blue-hour rim, panels of
 * eight-point jaali with the dark lawn showing through, square posts with
 * inlaid lozenges every 150 units, and a plinth washed warm where the lanterns
 * stand. Moonlit marble, a step darker than the walkway so it frames, not shouts.
 */
function GardenRail(p: DrawProps & { lanterns: number[] }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'cbrl');
  const d0 = p.plane?.dNear ?? 0;
  const marble = mix(c.background, c.primary, 0.3);
  const marbleLit = mix(c.background, c.primary, 0.14);
  const marbleDeep = mix(c.background, c.primary, 0.55);
  const hole = mix(c.primary, '#000000', 0.45);
  const cop = h * 0.2;
  const plinth = h * 0.8;
  const span = 150;
  return (
    <KitSvg p={p}>
      <defs>
        <pattern id={`${id}j`} width={22} height={22} patternUnits="userSpaceOnUse" y={r2(cop)}>
          <rect width={22} height={22} fill={hole} />
          <path d={P`M11 2L13.6 8.4L20 11L13.6 13.6L11 20L8.4 13.6L2 11L8.4 8.4Z`} fill="none" stroke={marble} strokeWidth={2.6} />
          <path d="M0 0H22V22H0Z" fill="none" stroke={marble} strokeWidth={3} />
        </pattern>
        <pattern id={`${id}p`} width={span} height={r2(h)} patternUnits="userSpaceOnUse">
          <rect width={18} height={r2(h)} fill={marble} />
          <path d={P`M9 ${cop + 10}L14 ${(cop + plinth) / 2}L9 ${plinth - 10}L4 ${(cop + plinth) / 2}Z`} fill={mix(c.secondary, marble, 0.35)} />
          <path d={P`M17 ${cop}V${plinth}`} stroke={marbleDeep} strokeWidth={2} />
        </pattern>
        <Lin id={`${id}c`} y1={0} y2={cop} stops={STOPS([[0, mix(marbleLit, p.light.rim, 0.35)], [0.45, marbleLit], [1, marbleDeep]])} />
        <radialGradient id={`${id}w`}>
          <stop offset="0" stopColor={LAMP} stopOpacity="0.55" />
          <stop offset="1" stopColor={LAMP} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect y={r2(cop)} width={r2(w)} height={r2(plinth - cop)} fill={`url(#${id}j)`} />
      <rect y={r2(cop)} width={r2(w)} height={r2(plinth - cop)} fill={`url(#${id}p)`} />
      <rect width={r2(w)} height={r2(cop)} fill={`url(#${id}c)`} />
      <rect y={r2(plinth)} width={r2(w)} height={r2(h - plinth)} fill={marble} />
      <path d={P`M0 ${plinth}H${w}M0 ${cop}H${w}`} stroke={marbleDeep} strokeWidth={2} />
      <path d={P`M0 1H${w}`} stroke={p.light.rim} strokeWidth={2} opacity={0.6} />
      {p.lanterns.map((d, i) => (
        <ellipse key={i} cx={r2(d - d0)} cy={r2(h * 0.6)} rx={150} ry={r2(h * 0.7)} fill={`url(#${id}w)`} />
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── The garden floor ───────────────────────────

/**
 * The charbagh in plan: the kit's marble flags with the water channel down
 * x 600, lawns laid either side beyond the walkways, a cross walk with a hauz
 * where the second fountain plays, the mihrab's warm reflection broken in the
 * channel, and pools of lantern light. Drawn in the floor plane's own
 * coordinates (content top = the far end).
 */
function GardenFloor(p: DrawProps & { lanterns: Array<{ x: number; d: number }> }) {
  const { w, h, colors: c, nature: n } = p;
  const g = p.plane ?? { x0: 0, x1: w, y0: 800, y1: 800, dNear: 0, dFar: h };
  // Whole units: the floor is thousands of units across, so decimals only add bytes.
  const fx = (x: number) => Math.round(x - g.x0);
  const fy = (d: number) => Math.round(g.dFar - d);
  const id = kitId(p, 'cbfl');
  const lawn = mix(n.leafDark, c.primary, 0.42);
  const lawnLit = mix(n.leaf, c.primary, 0.45);
  const kerb = mix(c.background, c.primary, 0.22);
  const water = mix(c.primary, c.text, 0.3);
  const warm = mix(KEY, n.flame, 0.3);
  const crossNear = 1600;
  const crossFar = 1700;
  const hauzD = 1650;
  // Lawns either side of the walkways (x 200..470 and 730..1000), cut by the cross walk.
  const beds: string[] = [];
  for (const [a, b] of [
    [g.x0, 470],
    [730, g.x1],
  ] as const) {
    beds.push(P`M${fx(a)} ${fy(g.dFar)}H${fx(b)}V${fy(crossFar)}H${fx(a)}Z`);
    beds.push(P`M${fx(a)} ${fy(crossNear)}H${fx(b)}V${fy(g.dNear)}H${fx(a)}Z`);
  }
  // Mowing stripes and a parterre border along each bed.
  const kerbs = [470, 730].map((x) => P`M${fx(x) - 6} 0h12V${h}h-12Z`).join('') + P`M${fx(g.x0)} ${fy(crossFar)}H${fx(g.x1)}V${fy(crossFar) + 8}H${fx(g.x0)}ZM${fx(g.x0)} ${fy(crossNear) - 8}H${fx(g.x1)}V${fy(crossNear)}H${fx(g.x0)}Z`;
  // Flower borders (small blooms) along the lawn edges.
  // Planted at a steady interval, as a Mughal border is: a dotted line at the rail's foot either side, broken at the cross walk.
  const blooms = p.detail === 'full' ? [458, 742].map((x) => P`M${fx(x)} ${fy(900)}V${fy(crossNear - 20)}M${fx(x)} ${fy(crossFar + 20)}V${fy(2150)}`).join('') : '';
  // Parterres: an eight-point star bed in each quarter, edged in marble, planted in flowers.
  const star = (x: number, d: number, r: number) => {
    let path = '';
    for (let i = 0; i < 16; i++) {
      const [ux, uy] = STAR16[i]!;
      const rr = i % 2 ? r * 0.765 : r;
      path += `${i ? 'L' : 'M'}${fx(x + ux * rr)} ${fy(d + uy * rr)}`;
    }
    return `${path}Z`;
  };
  const parterres = [
    [180, 1250],
    [1020, 1250],
    [-260, 1250],
    [1460, 1250],
  ].map(([x, d]) => star(x!, d!, 150));
  // The mihrab's reflection, broken by ripples, from the baradari's foot toward the eye.
  const ripples: string[] = [];
  for (let i = 0; i < 26; i++) {
    const d = 1360 + i * 30 + rand(i, p.seed + 11) * 12;
    const half = Math.round(6 + (d - 1300) * 0.012 + rand(i, p.seed + 13) * 6);
    ripples.push(P`M${fx(600 - half)} ${fy(d)}h${half * 2}v3h${-half * 2}Z`);
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Floor {...p} variant="flags" channel pools={[]} />
      <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <pattern id={`${id}st`} x={fx(-1190)} width={60} height={r2(h)} patternUnits="userSpaceOnUse">
            <rect width={22} height={r2(h)} fill={lawnLit} opacity={0.18} />
          </pattern>
          <Lin id={`${id}l`} y1={0} y2={h} stops={STOPS([[0, mix(lawn, c.primary, 0.3)], [0.6, lawn], [1, shade(lawn, 0.25)]])} />
          <radialGradient id={`${id}p`}>
            <stop offset="0" stopColor={LAMP} stopOpacity="0.5" />
            <stop offset="0.45" stopColor={LAMP} stopOpacity="0.2" />
            <stop offset="1" stopColor={LAMP} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}m`}>
            <stop offset="0" stopColor={warm} stopOpacity="0.55" />
            <stop offset="0.5" stopColor={warm} stopOpacity="0.2" />
            <stop offset="1" stopColor={warm} stopOpacity="0" />
          </radialGradient>
          <Lin id={`${id}r`} y1={fy(2180)} y2={fy(1340)} stops={STOPS([[0, mix(KEY, '#ffffff', 0.4), 0.9], [0.5, KEY, 0.6], [1, warm, 0]])} />
          <Lin id={`${id}h`} y1={fy(hauzD + 110)} y2={fy(hauzD - 110)} stops={STOPS([[0, mix(water, KEY, 0.25)], [1, water]])} />
        </defs>
        <path d={beds.join('')} fill={`url(#${id}l)`} />
        <rect x={fx(-1190)} width={fx(460) - fx(-1190)} height={r2(h)} fill={`url(#${id}st)`} />
        <rect x={fx(740)} width={fx(2400) - fx(740)} height={r2(h)} fill={`url(#${id}st)`} />
        <path d={kerbs} fill={kerb} />
        <path id={`${id}pt`} d={parterres.join('')} fill={mix(lawn, c.accent, 0.1)} stroke={mix(kerb, lawn, 0.35)} strokeWidth={7} />
        <use href={`#${id}pt`} fill="none" stroke={mix(c.accent, '#ffffff', 0.2)} strokeWidth={5} strokeDasharray="2 10" strokeLinecap="round" opacity={0.5} />
        {blooms ? <path d={blooms} stroke={mix(c.accent, '#ffffff', 0.2)} strokeWidth={8} strokeLinecap="round" strokeDasharray="0 22" opacity={0.7} /> : null}
        {/* The hauz at the crossing: a square pool in a marble surround. */}
        <rect x={fx(492)} y={fy(hauzD + 108)} width={216} height={216} fill={kerb} />
        <rect x={fx(504)} y={fy(hauzD + 96)} width={192} height={192} fill={`url(#${id}h)`} />
        <path d={P`M${fx(504)} ${fy(hauzD + 96)}h192v192h-192Z`} fill="none" stroke={p.light.rim} strokeWidth={2} opacity={0.5} />
        <circle cx={fx(600)} cy={fy(hauzD)} r={40} fill="none" stroke={tint(water, 0.3)} strokeWidth={2} opacity={0.5} />
        <circle cx={fx(600)} cy={fy(hauzD)} r={66} fill="none" stroke={tint(water, 0.3)} strokeWidth={1.5} opacity={0.35} />
        {/* The round basin of the near fountain. */}
        <ellipse cx={fx(600)} cy={fy(1200)} rx={74} ry={74} fill={kerb} />
        <ellipse cx={fx(600)} cy={fy(1200)} rx={62} ry={62} fill={water} />
        <ellipse cx={fx(600)} cy={fy(1200)} rx={36} ry={36} fill="none" stroke={tint(water, 0.3)} strokeWidth={2} opacity={0.5} />
        {/* The mihrab's reflection in the channel. */}
        <path d={P`M${fx(588)} ${fy(2180)}L${fx(612)} ${fy(2180)}L${fx(632)} ${fy(1340)}L${fx(568)} ${fy(1340)}Z`} fill={`url(#${id}r)`} opacity={0.75} />
        <path d={ripples.join('')} fill={mix(KEY, '#ffffff', 0.5)} opacity={0.55} />
        {/* Light pools: the baradari's steps and each lantern. */}
        <ellipse cx={fx(600)} cy={fy(2160)} rx={360} ry={260} fill={`url(#${id}m)`} />
        {p.lanterns.map((l, i) => (
          <ellipse key={i} cx={fx(l.x)} cy={fy(l.d)} rx={130} ry={130} fill={`url(#${id}p)`} />
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────── The set ───────────────────────────

/** The set's sky gradient (seen wherever no plane is): blue hour, deep above, a cool glow at the horizon. */
function skyCss(ctx: SetContext): string {
  const c = ctx.colors;
  const deep = mix(c.primary, '#000000', 0.45);
  const mid = mix(c.primary, '#2a5a74', 0.35);
  const glow = mix(mix(c.primary, '#9fc4d4', 0.35), KEY, 0.12);
  return `linear-gradient(180deg, ${deep} 0%, ${mix(deep, mid, 0.6)} 35%, ${mid} 50%, ${glow} 56%, ${mix(c.primary, '#000000', 0.3)} 64%, ${mix(c.primary, '#000000', 0.5)} 100%)`;
}

export const chaarBagh: StageSetFactory = (ctx) => {
  // Lantern posts stand on the rails (x 440 / 760); their fanoos hang inward, over the walkways.
  const lanterns = [
    { x: 488, d: 1150 },
    { x: 712, d: 1150 },
    { x: 488, d: 1560 },
    { x: 712, d: 1560 },
  ];
  const railLamps = [1150, 1560];
  const cypressAt = (x: number, d: number, i: number): Piece => ({
    kind: 'prop',
    id: `cypress-${i}`,
    art: 'cypress',
    role: 'prop',
    ...billboard({ x, d, w: 90, h: 420 }),
    buildIn: 'rise',
    draw: Cypress,
  });
  const pieces: Piece[] = [
    { kind: 'plane', id: 'sky', art: 'sky:blueHour', role: 'sky', plane: sky({ d: perspectiveOf(60) * 4.62 }), draw: drawWith(Sky, { variant: 'blueHour', skyline: 'domes', moon: 'crescent', stars: true }) },
    { kind: 'plane', id: 'floor', art: 'floor:garden', role: 'architecture', plane: floor({ x0: -2600, x1: 3800, dNear: -200, dFar: 3200 }), draw: (p) => <GardenFloor {...p} lanterns={lanterns} /> },
    { kind: 'plane', id: 'rail-l', art: 'wall:gardenRail', role: 'architecture', plane: wall('left', { x: 440, yTop: 690, dNear: 900, dFar: 2040 }), draw: (p) => <GardenRail {...p} lanterns={railLamps} /> },
    { kind: 'plane', id: 'rail-r', art: 'wall:gardenRail', role: 'architecture', plane: wall('right', { x: 760, yTop: 690, dNear: 900, dFar: 2040 }), draw: (p) => <GardenRail {...p} lanterns={railLamps} /> },
    { kind: 'plane', id: 'far-garden', art: 'back:farGarden', role: 'architecture', quiet: true, plane: back({ x0: -2600, x1: 3800, yTop: 0, d: 2800 }), draw: FarGarden },
    { kind: 'prop', id: 'baradari', art: 'baradari', role: 'focal', ...billboard({ x: 600, d: 2200, w: 760, h: 520 }), draw: Baradari },
    cypressAt(370, 1000, 0),
    cypressAt(830, 1000, 1),
    cypressAt(370, 1450, 2),
    cypressAt(830, 1450, 3),
    cypressAt(370, 1900, 4),
    cypressAt(830, 1900, 5),
    { kind: 'prop', id: 'fountain-near', art: 'fountain:jet', role: 'prop', ...billboard({ x: 600, d: 1200, w: 60, h: 140 }), motion: { kind: 'shimmer', amp: 0.3, period: 2.4 }, buildIn: 'rise', draw: drawWith(Fountain, { variant: 'jet' }) },
    { kind: 'prop', id: 'fountain-hauz', art: 'fountain:jet', role: 'prop', ...billboard({ x: 600, d: 1650, w: 60, h: 140 }), motion: { kind: 'shimmer', amp: 0.3, period: 2.4, phase: 0.5 }, buildIn: 'rise', draw: drawWith(Fountain, { variant: 'jet' }) },
    ...lanterns.map(
      (l, i): Piece => ({
        kind: 'prop',
        id: `lantern-${i}`,
        art: 'fanoosPost',
        role: 'prop',
        ...billboard({ x: l.x < 600 ? l.x - 17 : l.x + 17, d: l.d, w: 90, h: 350 }),
        flipX: l.x > 600,
        motion: { kind: 'sway', amp: 0.6, period: 6 + i * 0.4, phase: i * 0.27 },
        draw: LanternPost,
      }),
    ),
    { kind: 'light', id: 'mihrab-glow', art: 'glow', role: 'light', at: { x: 600, y: 620, z: -2180 }, r: 150, color: KEY, strength: 0.65, bloom: true, motion: { kind: 'pulse', amp: 0.6, period: 7 }, buildIn: 'bloom' },
    { kind: 'light', id: 'lamp-l', art: 'glow', role: 'light', at: { x: 488, y: 518, z: -1150 }, r: 60, color: LAMP, strength: 0.6, motion: { kind: 'twinkle', amp: 0.2, period: 3 }, buildIn: 'light' },
    { kind: 'light', id: 'lamp-r', art: 'glow', role: 'light', at: { x: 712, y: 518, z: -1150 }, r: 60, color: LAMP, strength: 0.6, motion: { kind: 'twinkle', amp: 0.2, period: 3, phase: 0.5 }, buildIn: 'light' },
  ];
  return {
    name: 'chaarBagh',
    sky: skyCss(ctx),
    light: { from: 'far', color: KEY, rim: '#cfe3ff' },
    fog: { color: '#0e2a33', near: 1300, far: 3200, max: 0.5 },
    veil: 0.3,
    focus: { x: 600, y: 600, z: -2200 },
    // Seen from the garden's raised entrance terrace, 60 above the usual eye: the four-fold plan opens out below and the
    // baradari sits lower, clear of the words.
    poses: { rest: { x: 600, y: 270, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 60 } },
    pieces,
    covers: { gate: 'garden', door: 'cedar', silk: 'damask', card: 'folio' },
    particles: { count: 28, dNear: 700, dFar: 2400 },
  };
};
