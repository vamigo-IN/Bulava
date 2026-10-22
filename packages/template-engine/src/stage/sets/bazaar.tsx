import type { ReactNode } from 'react';
import { Metal, onCubic, shade, taper, tint, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, HangingLantern, LightString, Sky, Stall, Wall } from '../kit';
import { Glow, KitSvg, kitId, Lin } from '../kit/architecture';
import { floor, billboard, hang, sky, wall } from '../planes';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';

/**
 * T15 · Roshni Bazaar (`roshni-bazaar`, final.md §5.3): the `bazaar` stage.
 * A festive lane on the night of the festival, seen from its mouth. Strings of
 * paper lanterns and fairy lights are tied across the lane between the
 * havelis' upper storeys (the near layer); below them painted shopfronts glow,
 * garlanded with marigolds, rangoli on the doorsteps, diyas at the near doors,
 * paper kandils swaying from the eaves and two stalls (sweets and diyas) at
 * the corridor's sides (the middle layer); at the end of the lane a
 * bamboo-and-fabric festival gate outlined in bulbs blazes with light (the
 * focal point), the old town's domes behind it and fireworks blooming over
 * the rooftops.
 *
 * Set-local pieces (§6.4): FestiveGate and Firework, plus LaneSide (the kit's
 * shopfronts under two haveli storeys drawn here: the kit has no tall street
 * facade) and DoorstepDiyas (a light row of five; the `diyaRow` illustration
 * costs 7 KB of markup). Rows of bulbs, beads and marigolds are dashed strokes
 * with round caps, so the set stays inside its markup budget.
 */

// ─────────────────────────── helpers ───────────────────────────

const url = (id: string) => `url(#${id})`;
/** One decimal: compact markup for organic detail. */
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The kit's plaster and stone in a night key: lit by the lane's lamps, not by day. */
function night(p: DrawProps, amount: number): DrawProps {
  const c = p.colors;
  return { ...p, colors: { ...c, background: mix(c.background, c.primary, amount), surface: mix(c.surface, c.primary, amount * 0.9), muted: mix(c.muted, c.primary, amount * 0.4) } };
}

/** Round dots along a path (a dashed stroke of zero-length dashes with round caps): bulbs, beads, marigolds. */
function Beads({ d, color, size, gap, opacity }: { d: string; color: string; size: number; gap: number; opacity?: number }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={size} strokeLinecap="round" strokeDasharray={`0 ${gap}`} opacity={opacity} />;
}
/** Zero-length subpaths at points: with round caps each is a dot. */
const points = (pts: readonly Pt[]) => pts.map(([x, y]) => `M${r1(x)} ${r1(y)}h0`).join('');

/** A unit circle's quarter arcs as cubics (kappa 0.5523): directions round a circle by `onCubic`, never trigonometry. */
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
  return Array.from({ length: n }, (_, i) => {
    const pt = onCubic(QUARTERS[Math.floor(i / per) % 4] as Segment, (i % per) / per + turn / per);
    const len = Math.sqrt(pt.x * pt.x + pt.y * pt.y) || 1;
    return [pt.x / len, pt.y / len] as Pt;
  });
}

// ─────────────────────────── FestiveGate (focal) ───────────────────────────

/** The crown's ogee (box units, 520×470), its inner line, and the bulbs' runs. */
const CROWN = 'M78 126C82 52 234 76 260 10C286 76 438 52 442 126';
const CROWN_IN = 'M100 126C104 70 236 92 260 40C284 92 416 70 420 126';
const BULB_RUNS = `${CROWN}M14 158H506M16 196V440M504 196V440M17 126C17 100 69 100 69 126M451 126C451 100 503 100 503 126`;

/**
 * A bamboo-and-fabric festival gate at the end of the lane, outlined in bulbs: bamboo bundles lashed with rope on
 * whitewashed plinths, an ogee crown of dark cloth with a gilt sunburst and a diya flame, a swagged valance, drapes in
 * the secondary tied back with marigolds, marigold strands, and through the opening the blaze of the fair beyond.
 * Drawn in a 520×470 box; lit from above.
 */
function FestiveGate(p: DrawProps): ReactNode {
  const c = p.colors;
  const n = p.nature;
  const id = (t: string) => kitId(p, `fg${t}`);
  const full = p.detail === 'full';
  const bamboo = mix(n.clay, n.ivory, 0.5);
  const fabric = c.secondary;
  const cloth = mix(c.primary, '#000000', 0.18);
  const marigold = n.flame;
  const joints = [82, 171, 260, 349, 438];
  // The sunburst medallion's rays.
  const sun = directions(16)
    .map(([ux, uy], i) => {
      const r = i % 2 ? 28 : 36;
      return `M${r1(260 + ux * 17 - uy * 4)} ${r1(92 + uy * 17 + ux * 4)}L${r1(260 + ux * r)} ${r1(92 + uy * r)}L${r1(260 + ux * 17 + uy * 4)} ${r1(92 + uy * 17 - ux * 4)}Z`;
    })
    .join('');
  const fold = [
    [0, shade(fabric, 0.35)],
    [0.3, fabric],
    [0.55, tint(fabric, 0.2)],
    [0.8, shade(fabric, 0.12)],
    [1, shade(fabric, 0.3)],
  ] as const;
  return (
    <KitSvg p={p}>
      <defs>
        <Metal id={id('m')} base={c.accent} foil x2={0} y2={470} />
        <radialGradient id={id('o')} cx="50%" cy="72%" r="68%">
          <stop offset="0" stopColor={tint(c.accent, 0.75)} />
          <stop offset="0.28" stopColor={c.accent} />
          <stop offset="0.62" stopColor={mix(c.secondary, c.primary, 0.25)} />
          <stop offset="1" stopColor={mix(c.primary, '#000000', 0.45)} />
        </radialGradient>
        <Lin id={id('c')} y2={126} stops={[[0, tint(cloth, 0.18)], [1, shade(cloth, 0.2)]]} />
        <Lin id={id('f')} x1={82} x2={206} stops={fold} />
        <Lin id={id('g')} x1={438} x2={314} stops={fold} />
        <Lin id={id('p')} x1={-7} x2={7} stops={[[0, tint(bamboo, 0.25)], [0.6, bamboo], [1, shade(bamboo, 0.3)]]} />
      </defs>

      {/* The blaze through the opening, two lines of the fair's lamps receding into it. */}
      <rect x={80} y={170} width={360} height={300} fill={url(id('o'))} />
      <Beads d="M104 372L248 304M416 372L272 304" color={tint(c.accent, 0.6)} size={5} gap={17} opacity={0.85} />

      {/* Drapes tied back with marigold bands, gold-bordered on their inner edges. */}
      <path d="M82 176H206C176 236 112 286 104 330C112 380 134 430 150 470H82Z" fill={url(id('f'))} />
      <path d="M438 176H314C344 236 408 286 416 330C408 380 386 430 370 470H438Z" fill={url(id('g'))} />
      <path d="M206 176C176 236 112 286 104 330C112 380 134 430 150 470M314 176C344 236 408 286 416 330C408 380 386 430 370 470" fill="none" stroke={url(id('m'))} strokeWidth={5} />
      {full ? <path d="M150 182C140 240 106 292 101 330M370 182C380 240 414 292 419 330" fill="none" stroke={shade(fabric, 0.3)} strokeWidth={2} opacity={0.6} /> : null}
      <Beads d="M92 330h22M406 330h22" color={marigold} size={17} gap={11} />

      {/* The bamboo bundles, lashed with rope, on whitewashed plinths. */}
      <path d="M23 150h14V452h-14ZM39 150h14V452h-14ZM55 150h14V452h-14ZM451 150h14V452h-14ZM467 150h14V452h-14ZM483 150h14V452h-14Z" fill={url(id('p'))} />
      <path d="M23 190H69M23 234H69M23 278H69M23 366H69M23 410H69M451 199H497M451 243H497M451 287H497M451 375H497M451 419H497" stroke={shade(bamboo, 0.32)} strokeWidth={2.5} />
      <path d="M20 206h52M20 213h52M20 318h52M20 325h52M448 206h52M448 213h52M448 318h52M448 325h52" stroke={mix(n.clay, c.text, 0.35)} strokeWidth={3} />
      <path d="M14 448h70v22h-70ZM436 448h70v22h-70Z" fill={mix(n.ivory, c.primary, 0.25)} />

      {/* The beam with its marigold border, and the swagged valance. */}
      <rect x={0} y={150} width={520} height={20} fill={url(id('m'))} />
      <Beads d="M10 175H512" color={mix(marigold, n.clay, 0.45)} size={12} gap={19} />
      <path d="M82 176Q126 226 171 176Q215 226 260 176Q304 226 349 176Q393 226 438 176Z" fill={mix(c.primary, c.secondary, 0.25)} />
      <path d="M82 176Q126 226 171 176Q215 226 260 176Q304 226 349 176Q393 226 438 176" fill="none" stroke={url(id('m'))} strokeWidth={3} />
      {/* Marigold strands from the valance's joints, the middle one shortest (a toran's rhythm). */}
      <Beads d={joints.map((x, j) => `M${x} 214v${[91, 65, 39, 65, 91][j] ?? 52}`).join('')} color={marigold} size={11} gap={13} />
      {full ? <Beads d={joints.map((x, j) => `M${x - 2} 212v${[91, 65, 39, 65, 91][j] ?? 52}`).join('')} color={tint(marigold, 0.45)} size={4} gap={13} /> : null}

      {/* The crown: shoulders with little gilt domes, an ogee of dark cloth with a gilt border and a sunburst. */}
      <path d="M8 126h70v24h-70ZM442 126h70v24h-70Z" fill={cloth} />
      <path d="M17 126C17 104 69 104 69 126ZM451 126C451 104 503 104 503 126Z" fill={url(id('m'))} />
      <path d={`${CROWN}V150H78Z`} fill={url(id('c'))} />
      <path d={CROWN_IN} fill="none" stroke={c.accent} strokeWidth={2} opacity={0.7} />
      {full ? <path d="M120 126l20 -12 20 12 20 -12 20 12 20 -12 20 12 20 -12 20 12 20 -12 20 12 20 -12 20 12 20 -12" fill="none" stroke={tint(cloth, 0.3)} strokeWidth={1.5} /> : null}
      <path d={CROWN} fill="none" stroke={url(id('m'))} strokeWidth={6} />
      <path d={sun} fill={url(id('m'))} />
      <circle cx={260} cy={92} r={15} fill={url(id('m'))} />
      <circle cx={260} cy={92} r={9} fill={cloth} />
      <path d={taper([[[260, 99], [252, 92], [258, 86], [260, 80]]], [6, 0.5], 6)} fill={n.flame} />
      <path d="M260 10v-8M43 104v-10M477 104v-10" stroke={url(id('m'))} strokeWidth={3} />

      {/* Bulbs outline the whole gate: a soft halo under each bright core. */}
      <Beads d={BULB_RUNS} color={c.accent} size={17} gap={21} opacity={0.3} />
      <Beads d={BULB_RUNS} color={tint(c.accent, 0.6)} size={6} gap={21} />
    </KitSvg>
  );
}

// ─────────────────────────── Firework (light) ───────────────────────────

/**
 * A firework in bloom, 380×380: a chrysanthemum of drooping streaks that brighten toward their tips, an inner ring in a
 * second colour, sparkling heads and falling willow sparks, round a hot core. The seed picks the colourway.
 */
function Firework(p: DrawProps): ReactNode {
  const c = p.colors;
  const id = (t: string) => kitId(p, `fw${t}`);
  const full = p.detail === 'full';
  const silver = p.seed % 2 === 1;
  const outer = silver ? tint(c.background, 0.4) : c.accent;
  const inner = silver ? c.accent : c.secondary;
  const C = 190;
  const heads: Pt[] = [];
  const rays = directions(24, 0.3)
    .map(([ux, uy], i) => {
      const r = 140 + rand(i, p.seed) * 34;
      const droop = 6 + (uy + 1) * 10;
      const x = C + ux * r;
      const y = C + uy * r + droop;
      heads.push([x, y]);
      return `M${Math.round(C + ux * 26)} ${Math.round(C + uy * 26)}Q${Math.round(C + ux * r * 0.7)} ${Math.round(C + uy * r * 0.7)} ${Math.round(x)} ${Math.round(y)}`;
    })
    .join('');
  const ring = directions(12, 0.6)
    .map(([ux, uy], i) => {
      const r = 76 + rand(i, p.seed + 3) * 16;
      return `M${Math.round(C + ux * 16)} ${Math.round(C + uy * 16)}L${Math.round(C + ux * r)} ${Math.round(C + uy * r + 3)}`;
    })
    .join('');
  const willow: Pt[] = full ? heads.filter((_, i) => i % 3 === 0).flatMap(([x, y], i) => [1, 2, 3].map((k) => [x + (rand(i, k) - 0.5) * 4, y + k * 13] as Pt)) : [];
  return (
    <KitSvg p={p}>
      <defs>
        <radialGradient id={id('o')} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={185}>
          <stop offset="0.12" stopColor={outer} stopOpacity="0" />
          <stop offset="0.55" stopColor={outer} stopOpacity="0.5" />
          <stop offset="0.92" stopColor={tint(outer, 0.7)} />
        </radialGradient>
        <radialGradient id={id('i')} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={95}>
          <stop offset="0.1" stopColor={inner} stopOpacity="0.15" />
          <stop offset="0.85" stopColor={tint(inner, 0.35)} />
        </radialGradient>
        <Glow id={id('g')} color={outer} core={tint(c.accent, 0.8)} a={0.55} />
      </defs>
      <circle cx={C} cy={C} r={190} fill={url(id('g'))} opacity={0.45} />
      <path d={rays} fill="none" stroke={url(id('o'))} strokeWidth={3.2} strokeLinecap="round" />
      <path d={ring} fill="none" stroke={url(id('i'))} strokeWidth={2.6} strokeLinecap="round" />
      <path d={points(heads)} stroke={outer} strokeWidth={13} strokeLinecap="round" opacity={0.3} />
      <path d={points(heads)} stroke={tint(outer, 0.85)} strokeWidth={4.5} strokeLinecap="round" />
      {willow.length ? <path d={points(willow)} stroke={tint(outer, 0.5)} strokeWidth={3.5} strokeLinecap="round" opacity={0.7} /> : null}
      <circle cx={C} cy={C} r={32} fill={url(id('g'))} />
    </KitSvg>
  );
}

// ─────────────────────────── FairyString ───────────────────────────

/**
 * A string of fairy lights tied across the lane, 540×150: a sagging wire (a cubic) hung with warm bulbs, each a bright
 * core in a soft halo, every third one a little brighter. Beads along the curve keep it a few hundred bytes.
 */
function FairyString(p: DrawProps): ReactNode {
  const n = p.nature;
  const s = p.h / 150;
  const sag = 82 * s;
  const wire = `M0 4C${r1(p.w * 0.3)} ${r1(4 + sag / 0.75)} ${r1(p.w * 0.7)} ${r1(4 + sag / 0.75)} ${p.w} 4`;
  const drop = `M0 ${r1(4 + 5 * s)}C${r1(p.w * 0.3)} ${r1(4 + 5 * s + sag / 0.75)} ${r1(p.w * 0.7)} ${r1(4 + 5 * s + sag / 0.75)} ${p.w} ${r1(4 + 5 * s)}`;
  return (
    <KitSvg p={p}>
      <path d={wire} fill="none" stroke={mix(p.colors.text, p.colors.primary, 0.4)} strokeWidth={r1(1.4 * s)} />
      <Beads d={drop} color={n.flame} size={r1(16 * s)} gap={r1(22 * s)} opacity={0.28} />
      <Beads d={drop} color={n.flameCore} size={r1(5 * s)} gap={r1(22 * s)} />
      <Beads d={drop} color={n.flameCore} size={r1(7 * s)} gap={r1(66 * s)} />
    </KitSvg>
  );
}

// ─────────────────────────── DoorstepDiyas ───────────────────────────

/** Five clay diyas in a row on a doorstep, 150×42, each with its flame and a little pool of light. */
function DoorstepDiyas(p: DrawProps): ReactNode {
  const n = p.nature;
  const id = (t: string) => kitId(p, `dd${t}`);
  return (
    <KitSvg p={p}>
      <defs>
        <Glow id={id('g')} color={n.flame} core={n.flameCore} a={0.7} />
        <g id={id('d')}>
          <ellipse cx={0} cy={-8} rx={22} ry={16} fill={url(id('g'))} />
          <path d="M-11 -2C-9 6 9 6 11 -2Z" fill={n.clay} />
          <path d="M-11 -2H11" stroke={mix(n.clay, n.flame, 0.4)} strokeWidth={1.6} />
          <path d={taper([[[0, -3], [-3.4, -7], [-1, -12], [0, -16]]], [4.4, 0.4], 6)} fill={n.flame} />
          <path d={taper([[[0, -3], [-1.4, -6], [-0.4, -9], [0, -11]]], [2, 0.3], 4)} fill={n.flameCore} />
        </g>
      </defs>
      {[15, 45, 75, 105, 135].map((x, i) => (
        <use key={i} href={`#${id('d')}`} x={x} y={40 - (i % 2) * 2} />
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── LaneSide (the lane's buildings) ───────────────────────────

/** World y where the kit's shopfront storey begins, and where its awnings start (the houses are drawn down to it). */
const SHOP_TOP = 200;
const AWNING_TOP = 438;
/** How far the plaster is taken toward the primary at night. */
const NIGHT = 0.84;

/** A pointed window arch (cubics), its foot at y + hh. */
const arch = (x: number, y: number, w: number, hh: number) =>
  `M${x} ${y + hh}V${y + w * 0.5}C${x} ${y + w * 0.12} ${x + w * 0.4} ${y + w * 0.1} ${x + w / 2} ${y}C${x + w * 0.6} ${y + w * 0.1} ${x + w} ${y + w * 0.12} ${x + w} ${y + w * 0.5}V${y + hh}Z`;

/**
 * A side of the lane: the kit's shopfronts (in a night key) under two upper storeys of a haveli and a shop storey drawn
 * here, three houses to the kit's three shops, each in its own night tone with its own roofline. A storey is a jharokha
 * (brackets, ledge, a dimly lit window with its jaali, an eave and a bangaldar canopy) between shuttered side windows,
 * drawn once in light and shade over any plaster; string courses carry fairy lights; the shop storey has a painted
 * signboard (no words) and a carved fascia hung with marigolds. Above the eye line it is tone-on-tone.
 */
function LaneSide(p: DrawProps): ReactNode {
  const g = p.plane;
  const shopsOnly = drawWith(Wall, { variant: 'shopfronts' });
  if (!g || g.y0 >= SHOP_TOP) return shopsOnly(night(p, NIGHT));
  const c = p.colors;
  const Y = (wy: number) => wy - g.y0;
  const up = Y(SHOP_TOP);
  const top = Y(AWNING_TOP);
  const shops: DrawProps = { ...night(p, NIGHT), h: p.h - up, eyeLine: p.eyeLine === null ? null : p.eyeLine - up, plane: { ...g, y0: SHOP_TOP } };
  const id = (t: string) => kitId(p, `ls${t}`);
  const low = p.detail === 'low';
  const P = 350;
  const base = mix(c.background, c.primary, NIGHT);
  const houses = [mix(base, c.secondary, 0.16), mix(base, c.primary, 0.4), mix(base, c.accent, 0.12)].map((f, i) => {
    const plaster = shade(f, 0.12);
    return { plaster, line: mix(plaster, c.background, 0.14), board: mix(plaster, [c.secondary, c.accent, c.primary][i] ?? c.secondary, 0.35), roof: [0, 44, 18][i] ?? 0 };
  });
  const wood = mix(p.nature.clayDark, c.primary, 0.35);
  const bulb = tint(c.accent, 0.4);
  const LIGHT = '#ffffff';
  const SHADE = '#000000';
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', left: 0, top: `${r2((up / p.h) * 100)}%`, width: '100%', height: `${r2(((p.h - up) / p.h) * 100)}%` }}>{shopsOnly(shops)}</div>
      <svg viewBox={`0 0 ${p.w} ${r2(top)}`} preserveAspectRatio="none" width="100%" height={`${r2((top / p.h) * 100)}%`} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
        <defs>
          <Lin id={id('w')} y2={1} bbox stops={[[0, mix(c.accent, base, 0.4), 0.6], [1, c.accent, 0.45]]} />
          <Lin id={id('t')} y2={top} stops={[[0, LAMP, 0.1], [0.5, LAMP, 0], [1, SHADE, 0.1]]} />
          {/* One storey in light and shade, over any plaster. */}
          <g id={id('s')}>
            <path d="M112 214h126l-10 14h-106ZM98 64h154l-14 -18h-126Z" fill={LIGHT} fillOpacity={0.12} />
            <path d={`M122 228l12 22h8l-6 -22ZM228 228l-12 22h-8l6 -22Z${arch(36, 110, 40, 104)}${arch(274, 110, 40, 104)}`} fill={SHADE} fillOpacity={0.26} />
            <path d={arch(125, 70, 100, 144)} fill={url(id('w'))} />
            {low ? null : <path d="M150 120V214M175 96V214M200 120V214M125 160h100" stroke={SHADE} strokeOpacity={0.3} strokeWidth={3} />}
            <path d="M120 46C130 14 220 14 230 46Z" fill={LIGHT} fillOpacity={0.06} stroke={LIGHT} strokeOpacity={0.12} strokeWidth={3} />
          </g>
          {/* A jharokha lit from inside for the festival: a warm lamp-glow behind its jaali, kept soft above the eye line. */}
          <Lin id={id('l')} y2={1} bbox stops={[[0, LAMP, 0.32], [0.7, WARM, 0.5], [1, WARM, 0.62]]} />
          <g id={id('k')}>
            <path d={arch(125, 70, 100, 144)} fill={url(id('l'))} />
            {low ? null : <path d="M150 120V214M175 96V214M200 120V214M125 160h100" stroke={SHADE} strokeOpacity={0.34} strokeWidth={3} />}
          </g>
          <pattern id={id('b')} width={P * 3} height={r2(top)} patternUnits="userSpaceOnUse">
            {houses.map((h, i) => {
              const x = i * P;
              return (
                <g key={i}>
                  <rect x={x} y={h.roof + 16} width={P} height={r2(top - h.roof - 16)} fill={h.plaster} />
                  <path d={`M${x} ${h.roof + 28}V${h.roof + 16}${'h18v-16h14v16h18'.repeat(7)}V${h.roof + 28}Z`} fill={h.line} />
                  <use href={`#${id('s')}`} x={x} y={r2(40 + h.roof * 0.4)} />
                  <use href={`#${id('s')}`} x={x} y={350} />
                  {i === 1 ? null : <use href={`#${id('k')}`} x={x} y={i === 0 ? 350 : r2(40 + h.roof * 0.4)} />}
                  {/* The shop storey: a painted signboard in a gilt frame, a carved wooden fascia hung with marigolds. */}
                  <rect x={x + 46} y={up + 34} width={258} height={66} fill={h.board} stroke={mix(c.accent, h.plaster, 0.35)} strokeWidth={3} />
                  {/* Its painted ornament: a lozenge between two rows of dots (no words). */}
                  <path d={`M${x + 175} ${up + 47}l28 20l-28 20l-28 -20Z`} fill={mix(c.accent, h.board, 0.45)} />
                  {low ? null : <Beads d={`M${x + 64} ${up + 67}h76M${x + 210} ${up + 67}h76`} color={mix(c.accent, h.board, 0.3)} size={5} gap={12} />}
                  <rect x={x + 14} y={r2(top - 46)} width={P - 28} height={46} fill={wood} />
                  <path d={`M${x + 5} ${h.roof + 28}V${r2(top)}M${x + P - 5} ${h.roof + 28}V${r2(top)}`} stroke={SHADE} strokeOpacity={0.26} strokeWidth={10} />
                  {low ? null : <Beads d={`M${x + 6} ${h.roof + 36}h${P - 12}`} color={bulb} size={5} gap={25} opacity={0.9} />}
                </g>
              );
            })}
            {/* String courses as shadow lines: a light band runs in perspective like a ray of light through the words. */}
            <path d={`M0 326h${P * 3}v5h-${P * 3}ZM0 ${up - 4}h${P * 3}v6h-${P * 3}Z`} fill={SHADE} fillOpacity={0.16} />
            <Beads d={`M${P * 0.06} ${r2(top - 40)}${'q51 34 103 0'.repeat(9)}`} color={p.nature.flame} size={9} gap={9} />
            {low ? null : <Beads d={`M12 338H${P * 3}M12 ${r2(top - 4)}H${P * 3}`} color={bulb} size={5.5} gap={25} opacity={0.9} />}
          </pattern>
        </defs>
        <rect width={p.w} height={r2(top)} fill={url(id('b'))} />
        <rect y={44} width={p.w} height={r2(top - 44)} fill={url(id('t'))} />
      </svg>
      {/* The nearest houses fall into shadow (seen on wide screens only): the lane's light gathers toward the gate. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: `${r2((1300 / p.w) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${mix(c.primary, SHADE, 0.65)}e6, ${mix(c.primary, SHADE, 0.6)}b8 42%, ${c.primary}00)` }} />
    </div>
  );
}

// ─────────────────────────── the set ───────────────────────────

const LAMP = '#ffd37a';
const WARM = '#ffb45c';
/** The havelis' roofline: the lantern strings are tied to their upper storeys. */
const WALL_TOP = -480;

export const bazaar: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, role: Piece['role'], recipe: PlaneRecipe, draw: Draw): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw });
  };

  // Planes: the cobbled lane with rangoli at the doorsteps and the shops' light spilling on it; the havelis and their
  // shopfronts on both sides, from behind the eye (desktops and the far pose see them to the frame's edge) to the gate;
  // the old town's domes under a night sky.
  const cobbles = drawWith(Floor, {
    variant: 'cobbles',
    rangoli: true,
    pools: [
      { x: 430, d: 1300, r: 190, color: WARM },
      { x: 770, d: 1300, r: 190, color: WARM },
      { x: 600, d: 2250, r: 320, color: LAMP },
      { x: 350, d: 1000, r: 140, color: WARM },
      { x: 850, d: 1700, r: 150, color: WARM },
    ],
  });
  plane('lane', 'floor:cobbles', 'architecture', floor({ x0: 330, x1: 870, dNear: -150, dFar: 2800 }), (p) => cobbles(night(p, 0.45)));
  plane('shops-l', 'wall:shopfronts', 'architecture', wall('left', { x: 330, yTop: WALL_TOP, dNear: -150, dFar: 2600 }), LaneSide);
  plane('shops-r', 'wall:shopfronts', 'architecture', wall('right', { x: 870, yTop: WALL_TOP, dNear: -150, dFar: 2600 }), LaneSide);
  // d = p·4.33 (≈ 3000): sky() snaps its scale to two decimals, and 4.33 lands exactly here.
  plane('sky', 'sky:night', 'sky', sky({ d: 692.82 * 4.33 }), drawWith(Sky, { variant: 'night', skyline: 'rooftops' }));

  // The focal gate at the end of the lane and its blaze.
  pieces.push({ kind: 'prop', id: 'gate', art: 'festiveGate', role: 'focal', ...billboard({ x: 600, d: 2300, w: 520, h: 470 }), draw: FestiveGate, buildIn: 'rise' });
  pieces.push({ kind: 'light', id: 'gate-glow', art: 'glow', role: 'light', at: { x: 600, y: 600, z: -2290 }, r: 180, color: LAMP, strength: 0.6, bloom: true, motion: { kind: 'pulse', amp: 0.6, period: 3.2 }, buildIn: 'bloom' });

  // The stalls of sweets and diyas at the corridor's sides, their lamps flickering.
  for (const [k, x, variant] of [
    ['l', 430, 'sweets'],
    ['r', 770, 'diya'],
  ] as const) {
    pieces.push({ kind: 'prop', id: `stall-${k}`, art: `stall:${variant}`, role: 'prop', ...billboard({ x, d: 1300, w: 200, h: 240 }), draw: drawWith(Stall, { variant }), buildIn: 'rise' });
    pieces.push({ kind: 'light', id: `stall-glow-${k}`, art: 'glow', role: 'light', at: { x, y: 690, z: -1290 }, r: 100, color: WARM, strength: 0.45, motion: { kind: 'flicker', amp: 0.4, period: 2.2, phase: k === 'l' ? 0 : 0.45 }, buildIn: 'light' });
  }

  // Paper kandils hung from the eaves, swaying.
  for (const [k, x] of [
    ['l', 372],
    ['r', 828],
  ] as const)
    pieces.push({ kind: 'prop', id: `kandil-${k}`, art: 'hangingLantern:paper', role: 'hanging', ...hang({ x, d: 1700, w: 60, h: 160, top: 250 }), draw: drawWith(HangingLantern, { variant: 'paper' }), motion: { kind: 'sway', amp: 3, period: 5.5, phase: k === 'l' ? 0.2 : 0.7 }, detail: 'high' });

  // Diyas along the near doorsteps.
  for (const [k, x] of [
    ['l', 405],
    ['r', 795],
  ] as const)
    pieces.push({ kind: 'prop', id: `diyas-${k}`, art: 'doorstepDiyas', role: 'prop', ...billboard({ x, d: 1050, w: 150, h: 42 }), draw: DoorstepDiyas });

  // A string of paper lanterns and one of fairy lights tied across the lane (the crown band). The lanterns' papers are
  // lit from inside, so they take the flame's colours (saffron, the palette's gold, a deep flame red), never a stock or a
  // cool colour: a navy or green paper reads as a grey, unlit lantern.
  const lanterns = drawWith(LightString, { variant: 'lanterns', sag: 0.55 });
  const paperLanterns: Draw = (p) =>
    lanterns({ ...p, colors: { ...p.colors, secondary: mix(p.nature.flame, p.colors.accent, 0.35), accent: mix(p.colors.accent, p.nature.flame, 0.25), primary: shade(p.nature.flame, 0.22) } });
  (
    [
      { d: 650, h: 140, top: -120, variant: 'lanterns' },
      { d: 1000, h: 150, top: -330, variant: 'fairy' },
    ] as const
  ).forEach((s, i) =>
    pieces.push({
      kind: 'prop',
      id: `lights-${i}`,
      art: s.variant === 'fairy' ? 'fairyString' : `lightString:${s.variant}`,
      role: 'hanging',
      ...hang({ x: 600, d: s.d, w: 540, h: s.h, top: s.top }),
      draw: s.variant === 'fairy' ? FairyString : paperLanterns,
      motion: { kind: 'twinkle', amp: 0.4, period: 2.2, phase: i * 0.33 },
      buildIn: 'drop',
    }),
  );

  // Fireworks blooming over the rooftops.
  for (const [k, x, phase] of [
    ['l', 254, 0],
    ['r', 946, 0.5],
  ] as const)
    pieces.push({ kind: 'prop', id: `firework-${k}`, art: 'firework', role: 'light', ...hang({ x, d: 2400, w: 380, h: 380, top: -1270 }), draw: Firework, motion: { kind: 'pulse', amp: 1, period: 2.6, phase }, buildIn: 'bloom' });

  return {
    name: 'bazaar',
    // Behind the sky plane (seen only past its overscan): the night's indigo.
    sky: `linear-gradient(180deg, ${mix(c.primary, '#000000', 0.55)} 0%, ${mix(c.primary, '#000000', 0.3)} 60%, ${mix(c.primary, c.secondary, 0.2)} 100%)`,
    light: { from: 'above', color: LAMP, rim: '#ffe9b8' },
    fog: { color: '#141a3a', near: 1300, far: 3000, max: 0.45 },
    veil: 0.35,
    focus: { x: 600, y: 600, z: -2300 },
    pieces,
    covers: { gate: 'lane', door: 'haveli', silk: 'damask', card: 'poster' },
    particles: { count: 14, dNear: 900, dFar: 2600 },
  };
};
