import type { ReactNode } from 'react';
import { onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { Balustrade, Ceiling, drawWith, Floor, Pillar, Sky, Tree } from '../kit';
import { awayStops, FlameAt, FlameDef, Glow, kitId, Lin, metalLit, Rim, woodOf } from '../kit/architecture';
import { back, billboard, ceiling, floor, hang, PLANE_GAP, sky } from '../planes';
import { FLOOR_Y, perspectiveOf } from '../units';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';

/**
 * T19 · Golden Veranda (`golden-veranda`, final.md §5.3): the `veranda` stage.
 * A hill-station bungalow's veranda at golden hour, for a retirement or a
 * farewell. The guest stands under the board ceiling with its white fretwork
 * eave; whitewashed posts and a turned-wood railing frame the view (the near
 * layer); a planter's chair with a folded shawl, spectacles and a book, and a
 * cane table laid for tea with a hurricane lantern wait at the rail (the middle
 * layer); a gravel path runs down the lawn to a garden gate under a climbing
 * rose arch hung with a laurel wreath (the focal point), a kadamba leaning over
 * the lawn, and tea gardens fold away in rows over the hills while the low sun
 * sets on the far ridge beside the gate.
 *
 * Set-local pieces (§6.4): PlantersChair, TeaTable, GardenGate, plus TeaHills
 * (the terraced tea gardens: a back plane) and Valance (the eave's fretwork).
 */

// ─────────────────────────── helpers ───────────────────────────

const url = (id: string) => `url(#${id})`;
const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;
/** Whole units for organic detail (compact markup). */
const q = Math.round;

function Svg({ p, children }: { p: DrawProps; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** An ellipse as path data, so many of them share one element (compact markup). */
const oval = (x: number, y: number, rx: number, ry = rx) => `M${r2(x - rx)} ${r2(y)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0Z`;

/** The low sun's light and the lamps' (the key light and the lantern glows). */
const SUN = '#ffd9a0';
/** The golden hour's haze: apricot, not milk, so the far hills and the sky stay warm. */
const HAZE = '#f1d3a4';
const LAMP = '#ffd28a';

/** Leaves the drawing out at detail 'low' (stills, thumbnails). */
const ifFull = (p: DrawProps, node: ReactNode): ReactNode => (p.detail === 'full' ? node : null);

/** Rose blooms on the arch: a warm apricot between the flame and the stock's accent (a real flower's colour). */
const roseOf = (p: DrawProps) => mix(p.nature.flame, p.colors.accent, 0.45);
const leafOf = (p: DrawProps) => p.nature.leaf;

// ─────────────────────────── the planter's chair ───────────────────────────

/**
 * PlantersChair (180×160): a colonial teak planter's chair in three-quarter
 * view, its reclined cane back and seat woven in a hexagonal weave, the long
 * swing-out arms reaching toward the guest; an olive shawl with a gold border
 * is folded over its back, a pair of spectacles rests on one arm and a book lies
 * open on the other: someone has just stood up.
 */
function PlantersChair(p: DrawProps) {
  const id = kitId(p, 'vch');
  const lit = p.light.from !== 'right';
  const wood = woodOf(p);
  const woodLit = tint(wood, 0.16);
  const woodDark = shade(wood, 0.28);
  const cane = mix(p.colors.accent, p.nature.clay, 0.3);
  type V = readonly [number, number, number];
  const pt = ([X, Y, Z]: V): string => `${q(90 + X * 1.3 - Z * 0.5)} ${q(150 - Y * 1.05 + Z * 0.42)}`;
  const poly = (...ps: V[]) => `M${ps.map(pt).join('L')}Z`;
  const bar = (a: V, b: V) => `M${pt(a)}L${pt(b)}`;
  const shawl = mix(p.colors.primary, p.colors.accent, 0.3);
  return (
    <Svg p={p}>
      <defs>
        <pattern id={id + 'w'} width={6} height={6} patternUnits="userSpaceOnUse">
          <rect width={6} height={6} fill={cane} />
          <path d="M0 0L6 6M6 0L0 6M0 3H6" stroke={shade(cane, 0.3)} strokeWidth={0.7} />
        </pattern>
        <Lin id={id + 's'} x2={180} stops={awayStops(p.light.from, 0.3)} />
        <Lin id={id + 'h'} x1={30} x2={70} y1={10} y2={60} stops={[[0, tint(shawl, 0.18)], [0.6, shawl], [1, shade(shawl, 0.3)]]} />
      </defs>
      {/* the shadow it throws away from the low sun */}
      <ellipse cx={lit ? 104 : 76} cy={152} rx={70} ry={8} fill="#000000" opacity={0.16} />
      {/* back legs */}
      <path d={bar([-35, 0, -30], [-35, 48, -30]) + bar([35, 0, -30], [35, 48, -30])} stroke={woodDark} strokeWidth={5} strokeLinecap="round" />
      {/* the reclined back: cane in a teak frame */}
      <path d={poly([-35, 46, -30], [35, 46, -30], [33, 112, -66], [-33, 112, -66])} fill={url(id + 'w')} stroke={wood} strokeWidth={5} strokeLinejoin="round" />
      <path d={bar([-33, 104, -62], [33, 104, -62])} stroke={woodLit} strokeWidth={3} />
      {/* the seat */}
      <path d={poly([-35, 46, -30], [35, 46, -30], [37, 42, 18], [-37, 42, 18])} fill={url(id + 'w')} stroke={wood} strokeWidth={4} strokeLinejoin="round" />
      <path d={bar([-37, 42, 18], [37, 42, 18])} stroke={woodLit} strokeWidth={5} strokeLinecap="round" />
      {/* the shawl folded over the back's left corner, its gold border and fringe */}
      <path d={`M${pt([-36, 114, -66])}C${pt([-14, 118, -64])} ${pt([-2, 110, -60])} ${pt([4, 100, -56])}L${pt([-4, 66, -40])}C${pt([-14, 62, -38])} ${pt([-28, 64, -38])} ${pt([-38, 70, -40])}Z`} fill={url(id + 'h')} />
      <path d={`M${pt([-24, 112, -64])}C${pt([-20, 96, -56])} ${pt([-18, 80, -48])} ${pt([-20, 66, -40])}`} stroke={shade(shawl, 0.3)} strokeWidth={1} fill="none" opacity={0.7} />
      <path d={`M${pt([4, 100, -56])}L${pt([-4, 66, -40])}`} stroke={p.colors.secondary} strokeWidth={2.4} fill="none" />
      <path d={`M${pt([1, 98, -55])}L${pt([-7, 66, -40])}`} stroke={tint(p.colors.secondary, 0.3)} strokeWidth={1} strokeDasharray="2 2" fill="none" />
      <path d={`M${pt([-4, 66, -40])}C${pt([-14, 62, -38])} ${pt([-28, 64, -38])} ${pt([-38, 70, -40])}`} stroke={p.colors.secondary} strokeWidth={2} strokeDasharray="1 2" fill="none" />
      {/* front legs that carry the arms */}
      <path d={bar([-40, 0, 16], [-40, 62, 16]) + bar([40, 0, 16], [40, 62, 16])} stroke={wood} strokeWidth={5.5} strokeLinecap="round" />
      <Rim p={p} x0={0} x1={q(90 + 40 * 1.3 - 8) + 3} y0={q(150 - 62 * 1.05 + 7)} y1={q(150 + 7)} />
      {/* the long swing-out arms, top faces lit, the edge beneath dark */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={poly([s * 36, 59, -30], [s * 46, 59, -30], [s * 46, 59, 64], [s * 36, 59, 64])} fill={woodDark} />
          <path d={poly([s * 36, 63, -30], [s * 46, 63, -30], [s * 46, 63, 64], [s * 36, 63, 64])} fill={s < 0 === lit ? woodLit : wood} />
          <circle cx={q(90 + s * 41 * 1.3 - 30 * 0.5)} cy={q(150 - 63 * 1.05 + 30 * 0.42)} r={1.6} fill={p.colors.secondary} />
        </g>
      ))}
      {/* spectacles on the left arm, a book open on the right */}
      <g fill="none" stroke={p.colors.secondary} strokeWidth={1.1}>
        <ellipse cx={q(90 - 41 * 1.3 - 44 * 0.5) - 3} cy={q(150 - 63 * 1.05 + 44 * 0.42) - 1} rx={3.4} ry={2} />
        <ellipse cx={q(90 - 41 * 1.3 - 44 * 0.5) + 5} cy={q(150 - 63 * 1.05 + 44 * 0.42) - 1} rx={3.4} ry={2} />
      </g>
      <path d={poly([36, 64, 30], [42, 66, 30], [42, 66, 50], [36, 64, 50]) + poly([42, 66, 30], [49, 64, 30], [49, 64, 50], [42, 66, 50])} fill={p.nature.ivory} stroke={shade(p.nature.ivory, 0.25)} strokeWidth={0.6} />
      <path d={bar([42, 66, 30], [42, 66, 50])} stroke={p.colors.primary} strokeWidth={1} />
      <rect width={180} height={160} fill={url(id + 's')} opacity={0.6} />
    </Svg>
  );
}

// ─────────────────────────── the tea table ───────────────────────────

/**
 * TeaTable (150×110): a round cane table under a crocheted cloth, laid for
 * tea: a bone-china pot with a gold band, two cups on saucers and a brass
 * hurricane lantern whose flame the `lantern` light sits on (box x 112, y 30).
 */
function TeaTable(p: DrawProps) {
  const id = kitId(p, 'vtt');
  const cane = mix(p.colors.accent, p.nature.clay, 0.34);
  const wood = woodOf(p);
  const china = p.nature.ivory;
  const gold = p.colors.secondary;
  return (
    <Svg p={p}>
      <defs>
        <Lin id={id + 'c'} x2={150} stops={[[0, tint(china, 0.3)], [0.5, china], [1, shade(china, 0.16)]]} />
        <Lin id={id + 'm'} x1={100} x2={124} stops={metalLit(gold, p.light.from)} />
        <Glow id={id + 'g'} color={p.nature.flame} core={p.nature.flameCore} a={0.75} />
        <Lin id={id + 's'} x2={150} stops={awayStops(p.light.from, 0.26)} />
        <FlameDef id={id + 'f'} p={p} seed={p.seed} small />
      </defs>
      <ellipse cx={86} cy={104} rx={66} ry={7} fill="#000000" opacity={0.15} />
      {/* three bowed cane legs and the shelf ring */}
      <path d="M30 60C22 80 22 94 24 108M120 60C128 80 128 94 126 108M75 66C74 84 76 96 75 110" stroke={cane} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <ellipse cx={75} cy={90} rx={46} ry={8} fill="none" stroke={shade(cane, 0.2)} strokeWidth={3.5} />
      {/* the top: teak edge, a crocheted cloth hanging in scallops */}
      <path d="M15 52A60 14 0 0 0 135 52V58A60 14 0 0 1 15 58Z" fill={wood} />
      <ellipse cx={75} cy={52} rx={60} ry={14} fill={shade(cane, 0.06)} />
      <ellipse cx={75} cy={53} rx={50} ry={11} fill={china} opacity={0.94} />
      <ellipse cx={75} cy={53} rx={50} ry={11} fill="none" stroke={shade(china, 0.14)} strokeWidth={2.2} strokeDasharray="2 2.5" />
      {/* the teapot */}
      <path d="M36 34C24 30 22 40 26 44M60 30C70 26 72 22 76 20" stroke={china} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d="M34 50C30 34 38 26 48 26C58 26 66 34 62 50Z" fill={url(id + 'c')} />
      <path d="M33 42H63" stroke={gold} strokeWidth={1.6} />
      <circle cx={48} cy={36} r={2.3} fill={p.colors.accent} />
      <path d="M40 27Q48 21 56 27Z" fill={shade(china, 0.08)} />
      <circle cx={48} cy={21.5} r={2} fill={gold} />
      {/* two cups on saucers */}
      {(
        [
          [76, 56],
          [92, 50],
        ] as const
      ).map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={9} ry={2.6} fill={shade(china, 0.1)} />
          <path d={`M${x - 6} ${y - 8}H${x + 6}C${x + 6} ${y - 1} ${x + 3} ${y} ${x} ${y}C${x - 3} ${y} ${x - 6} ${y - 1} ${x - 6} ${y - 8}Z`} fill={url(id + 'c')} />
          <path d={`M${x - 6} ${y - 6.5}H${x + 6}`} stroke={gold} strokeWidth={0.9} />
          <path d={`M${x + 6} ${y - 6}C${x + 10} ${y - 6} ${x + 10} ${y - 2} ${x + 5} ${y - 2}`} stroke={china} strokeWidth={1.4} fill="none" />
        </g>
      ))}
      {/* the hurricane lantern: brass foot and cap, a glass globe and its flame */}
      <circle cx={112} cy={30} r={26} fill={url(id + 'g')} />
      <path d="M102 54H122L119 48H105Z" fill={url(id + 'm')} />
      <path d="M106 48C100 40 102 26 108 18H116C122 26 124 40 118 48Z" fill={tint(china, 0.4)} opacity={0.42} stroke={shade(gold, 0.1)} strokeWidth={0.8} />
      <FlameAt href={id + 'f'} x={112} y={42} s={13} />
      <path d="M106 18H118L116 13H108Z" fill={url(id + 'm')} />
      <path d="M104 18C104 4 120 4 120 18" stroke={gold} strokeWidth={1.2} fill="none" />
      <path d="M106 48C101 40 102 28 107 19" stroke="#ffffff" strokeWidth={1} opacity={0.6} fill="none" />
      <rect width={150} height={110} fill={url(id + 's')} opacity={0.5} />
    </Svg>
  );
}

// ─────────────────────────── the garden gate ───────────────────────────

/**
 * GardenGate (360×420, focal): whitewashed stone piers with brass lamps lit for
 * the evening, a pair of white picket leaves (the right one standing ajar), a
 * wrought-iron arch grown over with climbing roses, a laurel wreath hung at its
 * crown on a ribbon, and clipped hedges running away on either side.
 */
function GardenGate(p: DrawProps) {
  const id = kitId(p, 'vgg');
  const lit = p.light.from !== 'right';
  const lime = mix(p.colors.background, p.colors.surface, 0.4);
  const limeLit = tint(lime, 0.4);
  const limeDark = mix(shade(lime, 0.22), p.colors.muted, 0.2);
  const iron = shade(p.colors.text, 0.15);
  const paint = tint(p.colors.background, 0.3);
  const hedge = mix(p.nature.leafDark, p.colors.primary, 0.25);
  const rose = roseOf(p);
  const leaf = leafOf(p);
  const gold = p.colors.secondary;
  // The arch's outer bar, pier to pier over the crown.
  const arch: readonly [Segment, Segment] = [
    [[80, 206], [80, 92], [126, 42], [180, 42]],
    [[180, 42], [234, 42], [280, 92], [280, 206]],
  ];
  const inner: readonly [Segment, Segment] = [
    [[92, 206], [92, 104], [134, 56], [180, 56]],
    [[180, 56], [226, 56], [268, 104], [268, 206]],
  ];
  const archPath = (s: readonly [Segment, Segment]) => `M${s[0][0][0]} ${s[0][0][1]}` + s.map(([, a, b, c]) => `C${a[0]} ${a[1]} ${b[0]} ${b[1]} ${c[0]} ${c[1]}`).join('');
  // Roses and leaves along the arch, thinning toward the crown where the wreath hangs.
  const blooms: Array<[number, number, number]> = [];
  const leaves: string[] = [];
  const n = p.detail === 'full' ? 26 : 14;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const seg = arch[t < 0.5 ? 0 : 1];
    const f = onCubic(seg, t < 0.5 ? t * 2 : t * 2 - 1);
    if (Math.abs(f.x - 180) < 30) continue;
    const off = (rand(i, p.seed + 3) - 0.5) * 14;
    const x = f.x - f.ty * off;
    const y = f.y + f.tx * off;
    for (let k = 0; k < 2; k++) {
      const lx = x + (rand(i * 3 + k, p.seed + 5) - 0.5) * 22;
      const ly = y + (rand(i * 3 + k, p.seed + 6) - 0.5) * 18;
      const rx = 4 + rand(i + k, p.seed + 7) * 3;
      leaves.push(`M${q(lx - rx)} ${q(ly)}Q${q(lx)} ${q(ly - rx * 0.9)} ${q(lx + rx)} ${q(ly)}Q${q(lx)} ${q(ly + rx * 0.9)} ${q(lx - rx)} ${q(ly)}Z`);
    }
    if (i % 2 === 0 || rand(i, p.seed + 9) > 0.5) blooms.push([q(x), q(y), 3.5 + rand(i, p.seed + 8) * 2.5]);
  }
  // Hedges: a row of clipped domes either side.
  const hedgePath = (x0: number, x1: number) => {
    let d = `M${x0} 420V352`;
    const steps = 3;
    const w = (x1 - x0) / steps;
    for (let i = 0; i < steps; i++) d += `Q${q(x0 + w * (i + 0.5))} ${q(326 + rand(i + x0, p.seed) * 10)} ${q(x0 + w * (i + 1))} 352`;
    return d + `V420Z`;
  };
  const pier = (x: number) => (
    <g>
      <rect x={x} y={214} width={40} height={206} fill={url(id + 'p')} />
      <rect x={x + 5} y={250} width={30} height={60} fill="none" stroke={limeDark} strokeWidth={1.2} opacity={0.6} />
      <rect x={x - 5} y={204} width={50} height={12} fill={limeLit} />
      <rect x={x - 5} y={214} width={50} height={4} fill={limeDark} />
      <rect x={x - 3} y={404} width={46} height={16} fill={limeDark} />
      {/* the lamp on the cap, lit for the evening */}
      <circle cx={x + 20} cy={186} r={26} fill={url(id + 'g')} />
      <path d={`M${x + 12} 204H${x + 28}L${x + 25} 199H${x + 15}Z`} fill={url(id + 'm')} />
      <path d={`M${x + 14} 199V181H${x + 26}V199Z`} fill={p.nature.flameCore} opacity={0.88} stroke={shade(gold, 0.2)} strokeWidth={1} />
      <path d={`M${x + 11} 181L${x + 20} 172L${x + 29} 181Z`} fill={url(id + 'm')} />
      <Rim p={p} x0={x} x1={x + 40} y0={214} y1={404} />
    </g>
  );
  const pickets = (x0: number, x1: number, topAt: (x: number) => number) => {
    let d = '';
    for (let x = x0 + 5; x < x1 - 2; x += 9) d += `M${q(x)} 400V${q(topAt(x))}`;
    return d;
  };
  // The laurel: two branches from the bow at the foot, leaves in pairs shrinking toward the open top.
  const wreath = { stems: '', leaves: '', berries: '' };
  for (const sx of [-1, 1]) {
    const seg: Segment = [[180 + sx * 3, 116], [180 + sx * 38, 112], [180 + sx * 38, 66], [180 + sx * 9, 60]];
    wreath.stems += `M${seg[0][0]} ${seg[0][1]}C${seg[1][0]} ${seg[1][1]} ${seg[2][0]} ${seg[2][1]} ${seg[3][0]} ${seg[3][1]}`;
    for (let i = 0; i < 9; i++) {
      const t = 0.06 + i * 0.105;
      const f = onCubic(seg, t);
      const L = 10 * (1 - t * 0.45);
      for (const side of [-1, 1]) {
        // A leaf leaning forward along the branch, out to one side of it.
        const ux = f.tx * 0.75 - f.ty * side * 0.66;
        const uy = f.ty * 0.75 + f.tx * side * 0.66;
        const tx = f.x + ux * L;
        const ty = f.y + uy * L;
        const w = L * 0.36;
        wreath.leaves += `M${r2(f.x)} ${r2(f.y)}Q${r2(f.x + ux * L * 0.5 - uy * w)} ${r2(f.y + uy * L * 0.5 + ux * w)} ${r2(tx)} ${r2(ty)}Q${r2(f.x + ux * L * 0.5 + uy * w)} ${r2(f.y + uy * L * 0.5 - ux * w)} ${r2(f.x)} ${r2(f.y)}Z`;
      }
      if (i % 3 === 1) wreath.berries += oval(f.x - f.ty * 3, f.y + f.tx * 3, 1.5);
    }
  }
  const leftTop = (x: number) => 296 - 22 * ((x - 100) / 80) ** 1.6;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox="0 0 360 420" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
        <defs>
          <Lin id={id + 'p'} x1={0} x2={40} stops={lit ? [[0, limeLit], [0.5, lime], [1, limeDark]] : [[0, limeDark], [0.5, lime], [1, limeLit]]} bbox />
          <Lin id={id + 'm'} x2={360} stops={metalLit(gold, p.light.from)} />
          <Glow id={id + 'g'} color={p.nature.flame} core={p.nature.flameCore} a={0.6} />
          <Lin id={id + 'w'} x1={150} x2={210} y1={60} y2={118} stops={metalLit(gold, p.light.from)} />
          <Lin id={id + 'h'} y1={320} y2={420} stops={[[0, tint(hedge, 0.18)], [1, shade(hedge, 0.3)]]} />
        </defs>
        {/* hedges, the shadow on the path */}
        <path d={hedgePath(0, 64) + hedgePath(296, 360)} fill={url(id + 'h')} />
        <ellipse cx={lit ? 200 : 160} cy={418} rx={150} ry={5} fill="#000000" opacity={0.14} />
        {/* the arch: two iron bars tied with rings */}
        <path d={archPath(arch) + archPath(inner)} stroke={iron} strokeWidth={3} fill="none" />
        <path d={Array.from({ length: 9 }, (_, i) => {
          const t = (i + 0.5) / 9;
          const a = onCubic(arch[t < 0.5 ? 0 : 1], t < 0.5 ? t * 2 : t * 2 - 1);
          const b = onCubic(inner[t < 0.5 ? 0 : 1], t < 0.5 ? t * 2 : t * 2 - 1);
          return `M${q(a.x)} ${q(a.y)}L${q(b.x)} ${q(b.y)}`;
        }).join('')} stroke={iron} strokeWidth={1.6} />
        <path d={leaves.join('')} fill={leaf} />
        {ifFull(p, <path d={leaves.filter((_, i) => i % 3 === 0).join('')} fill={tint(leaf, 0.25)} />)}
        <path d={blooms.map(([x, y, r]) => oval(x, y, r)).join('')} fill={rose} />
        <path d={blooms.map(([x, y, r]) => oval(x - 0.6, y - 0.6, r * 0.5)).join('')} fill={shade(rose, 0.18)} />
        <path d={blooms.map(([x, y, r]) => oval(x - r * 0.4, y - r * 0.45, r * 0.28)).join('')} fill={tint(rose, 0.5)} />
        {/* the ribbon the wreath hangs from */}
        <path d="M180 44V62M174 46L180 52L186 46" stroke={p.colors.primary} strokeWidth={2} fill="none" />
        {/* the piers */}
        {pier(60)}
        {pier(260)}
        {/* the left leaf, closed: a picket with an arched top rail */}
        <path d={pickets(100, 180, leftTop)} stroke={paint} strokeWidth={5} strokeLinecap="round" />
        <path d={`M100 ${q(leftTop(102))}Q140 ${q(leftTop(140) + 4)} 180 ${q(leftTop(178))}M100 330H180M100 386H180M102 386L178 330`} stroke={paint} strokeWidth={4} fill="none" />
        {/* the right leaf, standing ajar: foreshortened toward its hinge on the right pier */}
        <path d="M226 398V302M233 397V300M240 396V298M247 395V296M254 394V295" stroke={shade(paint, 0.14)} strokeWidth={3.6} strokeLinecap="round" />
        <path d="M224 300L258 292M224 336L258 330M224 384L258 388" stroke={shade(paint, 0.14)} strokeWidth={3} />
        <path d="M100 400H180" stroke={shade(paint, 0.2)} strokeWidth={2} />
        {/* the gilt laurel wreath hung at the crown, tied with a ribbon bow */}
        <path d={wreath.stems} stroke={shade(gold, 0.25)} strokeWidth={1.3} fill="none" />
        <path d={wreath.leaves} fill={url(id + 'w')} stroke={shade(gold, 0.3)} strokeWidth={0.5} />
        <path d={wreath.berries} fill={tint(gold, 0.35)} />
        <path d="M180 116C172 108 164 112 168 118C171 122 177 119 180 116C183 119 189 122 192 118C196 112 188 108 180 116ZM178 117L171 132L175 131L177 135ZM182 117L189 132L185 131L183 135Z" fill={p.colors.primary} />
      </svg>
    </div>
  );
}

// ─────────────────────────── the tea hills (a back plane) ───────────────────────────

const HILLS = { x0: -2600, x1: 3800, yTop: 120, yBottom: 842, d: 2640 } as const;
/** The low sun, setting on the far ridge left of the gate, in the view between the posts on every screen (world units, just in front of the hills; below the words). */
const SUN_AT = { x: 250, y: 232, d: 2620 } as const;

/**
 * TeaHills (back plane, 4000×722 world units): the estates beyond the lawn.
 * A blue far ridge, then two green ridges combed into rows of tea bushes that
 * follow the contours (dashed round-capped strokes, so each row reads as a
 * hedge of bushes), tall silver oaks shading them, and a planter's bungalow
 * with a red roof on the left shoulder. Lower than the horizon in the story
 * column, so the gate stands against the gardens, not the sky.
 */
function TeaHills(p: DrawProps) {
  const id = kitId(p, 'vth');
  const fog = HAZE;
  const X = (wx: number) => wx - HILLS.x0;
  const Y = (wy: number) => wy - HILLS.yTop;
  const farC = mix(mix(p.colors.primary, '#7f8fa6', 0.35), fog, 0.62);
  const midC = mix(mix(p.nature.leaf, p.colors.primary, 0.35), fog, 0.42);
  const nearC = mix(mix(p.nature.leaf, p.colors.primary, 0.25), fog, 0.22);
  type Pts = ReadonlyArray<readonly [number, number]>;
  /** A smooth contour through the points (each span an S between two crests), dropped by dy; it starts with a move to the first point. */
  const contour = (pts: Pts, dy: number) => {
    let d = '';
    let prev: readonly [number, number] | null = null;
    for (const [x1, y1] of pts) {
      if (!prev) d += `M${X(x1)} ${Y(y1 + dy)}`;
      else {
        const m = (prev[0] + x1) / 2;
        d += `C${X(m)} ${Y(prev[1] + dy)} ${X(m)} ${Y(y1 + dy)} ${X(x1)} ${Y(y1 + dy)}`;
      }
      prev = [x1, y1];
    }
    return d;
  };
  /** A ridge filled down to the plane's foot (every ridge runs the plane's full width). */
  const ridge = (pts: Pts, base: number) => `${contour(pts, 0)}L${X(HILLS.x1)} ${Y(base)}L${X(HILLS.x0)} ${Y(base)}Z`;
  const far: Pts = [[-2600, 250], [-1700, 300], [-1200, 262], [-760, 282], [-300, 330], [250, 290], [700, 312], [1200, 262], [1800, 318], [2600, 270], [3200, 300], [3800, 260]];
  const mid: Pts = [[-2600, 330], [-2000, 380], [-1400, 360], [-800, 300], [-200, 390], [400, 372], [900, 392], [1500, 318], [2100, 360], [2600, 330], [3200, 380], [3800, 340]];
  const near: Pts = [[-2600, 440], [-2000, 480], [-1400, 470], [-700, 420], [0, 500], [600, 520], [1200, 470], [1900, 430], [2600, 480], [3200, 440], [3800, 470]];
  // Rows of tea following a ridge, offset down its slope.
  const seen = (pts: Pts) => pts.filter(([x]) => x > -2100 && x < 3300);
  const rows = (pts: Pts, from: number, gap: number, count: number) => Array.from({ length: count }, (_, r) => contour(seen(pts), from + r * gap)).join('');
  const oaks: Array<[number, number, number]> = [];
  const nOaks = p.detail === 'full' ? 15 : 8;
  for (let i = 0; i < nOaks; i++) {
    const wx = -2400 + rand(i, p.seed + 11) * 6000;
    if (wx > 380 && wx < 820) continue;
    oaks.push([q(wx), q(i % 2 ? 410 + rand(i, p.seed + 12) * 40 : 470 + rand(i, p.seed + 12) * 50), q(70 + rand(i, p.seed + 13) * 50)]);
  }
  return (
    <Svg p={p}>
      <defs>
        <Lin id={id + 'f'} y1={Y(240)} y2={Y(842)} stops={[[0, farC], [1, mix(farC, fog, 0.4)]]} />
        <Lin id={id + 'm'} y1={Y(300)} y2={Y(842)} stops={[[0, tint(midC, 0.1)], [1, shade(midC, 0.12)]]} />
        <Lin id={id + 'n'} y1={Y(420)} y2={Y(842)} stops={[[0, tint(nearC, 0.12)], [1, shade(nearC, 0.18)]]} />
        <Lin id={id + 'l'} x1={X(-2600)} x2={X(1400)} stops={[[0, p.light.color, 0.3], [0.45, p.light.color, 0.1], [1, p.light.color, 0]]} />
        <radialGradient id={id + 'h'}>
          <stop offset={0} stopColor={tint(p.light.color, 0.5)} stopOpacity={0.95} />
          <stop offset={0.25} stopColor={p.light.color} stopOpacity={0.5} />
          <stop offset={1} stopColor={p.light.color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id + 'a'}>
          <stop offset={0} stopColor={mix(p.light.color, p.colors.secondary, 0.62)} stopOpacity={0.95} />
          <stop offset={0.4} stopColor={mix(p.light.color, p.colors.secondary, 0.4)} stopOpacity={0.6} />
          <stop offset={1} stopColor={p.light.color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id + 's'}>
          <stop offset={0} stopColor="#fffdf6" />
          <stop offset={0.7} stopColor={tint(p.nature.flameCore, 0.5)} />
          <stop offset={1} stopColor={p.light.color} />
        </radialGradient>
      </defs>
      {/* the afterglow along the far ridge, deepest round the sun, and the sun touching the ridge */}
      <ellipse cx={X(SUN_AT.x)} cy={Y(SUN_AT.y + 40)} rx={1700} ry={190} fill={url(id + 'a')} />
      <circle cx={X(SUN_AT.x)} cy={Y(SUN_AT.y)} r={300} fill={url(id + 'h')} />
      <circle cx={X(SUN_AT.x)} cy={Y(SUN_AT.y)} r={46} fill={url(id + 's')} />
      <path d={ridge(far, 842)} fill={url(id + 'f')} />
      <path d={ridge(mid, 842)} fill={url(id + 'm')} />
      <path d={rows(mid, 14, 18, 6)} stroke={shade(midC, 0.14)} strokeWidth={7} strokeDasharray="9 3" strokeLinecap="round" fill="none" opacity={0.75} />
      {/* the bungalow on the left shoulder */}
      <g>
        <rect x={X(-520)} y={Y(318)} width={70} height={26} fill={tint(p.colors.background, 0.2)} />
        <path d={`M${X(-528)} ${Y(320)}L${X(-485)} ${Y(298)}L${X(-442)} ${Y(320)}Z`} fill={mix('#a0442c', fog, 0.35)} />
        <path d={`M${X(-510)} ${Y(326)}h8v8h-8zM${X(-490)} ${Y(326)}h8v8h-8zM${X(-470)} ${Y(326)}h8v8h-8z`} fill={mix(p.nature.flame, fog, 0.3)} />
      </g>
      <path d={ridge(near, 842)} fill={url(id + 'n')} />
      <path d={rows(near, 18, 22, 9)} stroke={shade(nearC, 0.2)} strokeWidth={10} strokeDasharray="12 3" strokeLinecap="round" fill="none" opacity={0.8} />
      {/* silver oaks: thin trunks, sparse layered crowns */}
      <path d={oaks.map(([x, y, h]) => taper([[[X(x), Y(y)], [X(x) + 2, Y(y) - h * 0.4], [X(x) - 2, Y(y) - h * 0.7], [X(x) + 1, Y(y) - h]]], [4, 1.2], 4)).join('')} fill={shade(nearC, 0.35)} />
      <path d={oaks.map(([x, y, h]) => oval(X(x) - 3, Y(y) - h * 0.7, h * 0.2, h * 0.1)).join('')} fill={shade(nearC, 0.18)} />
      <path d={oaks.map(([x, y, h]) => oval(X(x) + 1, Y(y) - h * 0.92, h * 0.16, h * 0.12)).join('')} fill={shade(nearC, 0.12)} />
      {/* the low sun washing the hills from the left */}
      <rect width={6400} height={722} fill={url(id + 'l')} />
    </Svg>
  );
}

// ─────────────────────────── the eave's fretwork ───────────────────────────

/**
 * Valance (hangs at the eave, 1500×64): the white fretwork of a hill bungalow's
 * eave: a fascia board and a lace of scalloped drops with pierced trefoils,
 * one pattern cell every 50 units. Quiet: tone-on-tone with the sky behind it.
 */
function Valance(p: DrawProps) {
  const id = kitId(p, 'vva');
  // Warm paint in the eave's own bounce light, close to the ceiling's tone: the words of the details band may run
  // over it, so it carries no hard white edge.
  const paint = mix(mix(p.colors.background, p.colors.accent, 0.3), SUN, 0.22);
  const edge = mix(paint, p.colors.muted, 0.14);
  return (
    <Svg p={p}>
      <defs>
        <pattern id={id + 'f'} width={50} height={46} patternUnits="userSpaceOnUse" y={18}>
          <path d="M0 0H50V14C44 14 42 22 38 30C34 38 30 44 25 46C20 44 16 38 12 30C8 22 6 14 0 14Z" fill={paint} />
          <path d="M25 12a4 4 0 1 0 0.1 0M19 21a3 3 0 1 0 0.1 0M31 21a3 3 0 1 0 0.1 0M25 33a2.5 2.5 0 1 0 0.1 0" fill={edge} />
          <path d="M0 14C6 14 8 22 12 30C16 38 20 44 25 46C30 44 34 38 38 30C42 22 44 14 50 14" stroke={edge} strokeWidth={1} fill="none" />
        </pattern>
      </defs>
      <rect width={p.w} height={18} fill={paint} />
      <rect y={14} width={p.w} height={4} fill={edge} />
      <rect y={18} width={p.w} height={46} fill={url(id + 'f')} />
    </Svg>
  );
}

// ─────────────────────────── the sunlit deck ───────────────────────────

/** Where the posts stand (x, d) and the railing runs (x0, x1 at RAIL_D): the deck's shadows are cast from them. */
const POSTS = [
  ['l0', 340, 950],
  ['r0', 860, 950],
  ['l1', 340, 1250],
  ['r1', 860, 1250],
] as const;
const RAIL_D = 1280;
const RAILS = [
  ['l', -560, 530],
  ['r', 670, 1760],
] as const;
/** The low sun's direction across the deck in plan (toward the right and the guest), and how far a rail's shadow reaches. */
const SHADOW = { dx: 0.63, dd: -0.78, rail: 300 } as const;

/**
 * The teak deck (kit Floor) with the golden hour laid over it: a warm wash from
 * the sun's side, the posts' long shadows raking toward the guest, and the
 * railing's shadow printed on the boards baluster by baluster.
 */
function SunlitDeck(p: DrawProps) {
  const g = p.plane;
  const id = kitId(p, 'vdk');
  const floorArt = (
    <Floor
      {...p}
      variant="teak"
      pools={[
        { x: 300, d: 1180, r: 140, color: SUN },
        { x: 780, d: 1160, r: 90, color: LAMP },
      ]}
    />
  );
  if (!g) return floorArt;
  const cx = (wx: number) => q(wx - g.x0);
  const cy = (d: number) => q(g.dFar - d);
  const ink = shade(woodOf(p), 0.55);
  // Post shadows: a band 44 wide from the foot, running out past the deck's near end.
  const L = 2200;
  const posts = POSTS.map(([, x, d]) => {
    const ex = x + SHADOW.dx * L;
    const ed = d + SHADOW.dd * L;
    return `M${cx(x - 22)} ${cy(d)}L${cx(x + 22)} ${cy(d)}L${cx(ex + 30)} ${cy(ed)}L${cx(ex - 30)} ${cy(ed)}Z`;
  }).join('');
  // The railing's shadow: its top rail, its foot rail and a stroke per baluster between them.
  const tx = SHADOW.dx * SHADOW.rail;
  const td = SHADOW.dd * SHADOW.rail;
  let rails = '';
  for (const [, x0, x1] of RAILS) {
    rails += `M${cx(x0 + tx)} ${cy(RAIL_D + td)}H${cx(x1 + tx)}M${cx(x0 + tx * 0.08)} ${cy(RAIL_D + td * 0.08)}H${cx(x1 + tx * 0.08)}`;
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {floorArt}
      <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <Lin id={id + 'w'} x1={cx(-200)} x2={cx(1400)} stops={[[0, p.light.color, 0.26], [0.6, p.light.color, 0.1], [1, p.light.color, 0.02]]} />
          <Lin id={id + 's'} y1={cy(1300)} y2={cy(-100)} stops={[[0, ink, 0.3], [1, ink, 0.12]]} />
        </defs>
        <rect width={r2(p.w)} height={r2(p.h)} fill={url(id + 'w')} />
        <path d={posts} fill={url(id + 's')} />
        <path d={rails} stroke={url(id + 's')} strokeWidth={9} fill="none" />
      </svg>
    </div>
  );
}

// ─────────────────────────── the lit ceiling ───────────────────────────

/**
 * The board ceiling, drawn in the set (the kit's `boards` run across the view and
 * read as a flat wall; these run out toward the garden and converge on the gate,
 * the one overhead plane that gives the hero its depth; the kit's piece stays the
 * fallback off a plane), with the golden hour bounced up into it: the
 * boards by the eave catch the low sun's apricot (warmest on the sun's side),
 * the ones over the guest's head fall into a soft umber shade, so the room reads
 * as lit from the garden. Gentle enough for the words over it.
 */
function SunlitCeiling(p: DrawProps) {
  if (!p.plane) return <Ceiling {...p} variant="boards" />;
  const g = p.plane;
  const id = kitId(p, 'vcl');
  const W = r2(p.w);
  const H = r2(p.h);
  const fx = (x: number) => q(x - g.x0);
  // Lime-washed tongue-and-groove boards running out toward the garden, so they draw the eye down the veranda to
  // the view (they converge on the gate); the beams over the post rows are painted like the posts. The box's y is
  // d − dNear: 0 overhead, H at the eave.
  const lime = mix(mix(p.colors.background, p.colors.accent, 0.34), SUN, 0.12);
  const groove = mix(lime, woodOf(p), 0.16);
  let boards = '';
  for (let x = 0; x <= W; x += 38) boards += `M${x} 0V${H}`;
  const beamL = fx(340);
  const beamR = fx(860);
  const beam = tint(lime, 0.32);
  const ink = shade(woodOf(p), 0.5);
  const fromLeft = p.light.from !== 'right';
  // The low sun's apricot bounced up under the eave.
  const glow = mix(p.light.color, p.colors.secondary, 0.3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      <defs>
        <Lin id={id + 'd'} y2={H} stops={[[0, ink, 0.2], [0.5, ink, 0.05], [0.8, glow, 0.2], [1, glow, 0.5]]} />
        <Lin id={id + 's'} x2={W} stops={fromLeft ? [[0, p.light.color, 0.24], [0.45, p.light.color, 0.06], [1, ink, 0.06]] : [[0, ink, 0.06], [0.55, p.light.color, 0.06], [1, p.light.color, 0.24]]} />
      </defs>
      <rect width={W} height={H} fill={lime} />
      <path d={boards} stroke={groove} strokeWidth={1.3} opacity={0.42} />
      {/* the beams over the post rows: a lit face and the shadow line beside it */}
      <path d={`M${beamL - 20} 0h40V${H}h-40ZM${beamR - 20} 0h40V${H}h-40Z`} fill={beam} opacity={0.7} />
      <path d={`M${beamL + 20} 0V${H}M${beamR - 20} 0V${H}`} stroke={shade(lime, 0.14)} strokeWidth={5} opacity={0.4} />
      <rect width={W} height={H} fill={url(id + 'd')} />
      <rect width={W} height={H} fill={url(id + 's')} />
    </svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

const TABLE = { x: 750, d: 1150, w: 150, h: 110 } as const;
/** The garden gate (drawn in 360×420 units, stood larger so the focal point carries on a phone). */
const GATE = { d: 2050, w: 410, h: 478 } as const;
/** The veranda's deck stands a step (30 units) above the lawn. */
const DECK = 770;

export const veranda: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, role: Piece['role'], recipe: PlaneRecipe, draw: Draw): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw });
  };

  // Planes: the golden sky over the hills, the tea gardens, the lawn and its path, the teak boards, the board ceiling.
  plane('sky', 'sky:golden', 'sky', sky({ d: perspectiveOf(60) * 4.62 }), drawWith(Sky, { variant: 'golden', skyline: 'hills' }));
  plane('tea-hills', 'teaHills', 'architecture', back(HILLS), TeaHills);
  plane(
    'lawn',
    'floor:lawn',
    'architecture',
    floor({ x0: -2000, x1: 3200, dNear: 1300, dFar: 2600 }),
    drawWith(Floor, {
      variant: 'lawn',
      path: true,
      pools: [
        { x: 600, d: 2020, r: 220, color: LAMP },
        { x: 150, d: 1900, r: 420, color: SUN },
      ],
    }),
  );
  plane(
    'veranda',
    'floor:teak',
    'architecture',
    floor({ x0: -900, x1: 2100, y: DECK + PLANE_GAP, dNear: -400, dFar: 1300 }),
    SunlitDeck,
  );
  plane('ceiling', 'ceiling:boards', 'architecture', ceiling({ x0: -900, x1: 2100, y: 100, dNear: -200, dFar: 1265 }), SunlitCeiling);

  // The eave's fretwork, quiet against the sky.
  pieces.push({ kind: 'prop', id: 'valance', art: 'valance', role: 'architecture', quiet: true, ...hang({ x: 600, d: 1262, w: 2600, h: 64, top: 100 }), draw: Valance, buildIn: 'drop' });

  // Whitewashed posts, two rows; the far row carries the eave.
  for (const [k, x, d] of POSTS)
    pieces.push({ kind: 'prop', id: `post-${k}`, art: 'pillar:post', role: 'architecture', quiet: true, ...billboard({ x, d, w: 50, h: DECK - 100, base: DECK }), draw: drawWith(Pillar, { variant: 'post' }) });

  // The turned-wood railing, open in the middle where the steps go down to the path.
  for (const [k, x0, x1] of RAILS)
    pieces.push({ kind: 'prop', id: `rail-${k}`, art: 'balustrade:turnedWood', role: 'architecture', ...billboard({ x: (x0 + x1) / 2, d: RAIL_D, w: x1 - x0, h: 120, base: DECK }), draw: drawWith(Balustrade, { variant: 'turnedWood' }), buildIn: 'rise' });

  // The planter's chair and the tea table at the rail.
  pieces.push({ kind: 'prop', id: 'chair', art: 'plantersChair', role: 'prop', ...billboard({ x: 430, d: 1150, w: 180, h: 160, base: DECK }), draw: PlantersChair, buildIn: 'fade' });
  pieces.push({ kind: 'prop', id: 'table', art: 'teaTable', role: 'prop', ...billboard({ x: TABLE.x, d: TABLE.d, w: TABLE.w, h: TABLE.h, base: DECK }), draw: TeaTable, buildIn: 'fade' });

  // The garden: the gate at the end of the path, a kadamba over the lawn.
  pieces.push({ kind: 'prop', id: 'gate', art: 'gardenGate', role: 'focal', ...billboard({ x: 600, d: GATE.d, w: GATE.w, h: GATE.h }), draw: GardenGate, buildIn: 'bloom' });
  pieces.push({ kind: 'prop', id: 'tree', art: 'tree:kadamba', role: 'prop', ...billboard({ x: 960, d: 1900, w: 360, h: 470 }), draw: drawWith(Tree, { variant: 'kadamba' }), motion: { kind: 'sway', amp: 0.5, period: 9 }, buildIn: 'rise' });

  // Lights: the low sun on the hills, the hurricane lantern on the tea table.
  pieces.push({ kind: 'light', id: 'sun', art: 'sun', role: 'light', at: { x: SUN_AT.x, y: SUN_AT.y, z: -SUN_AT.d }, r: 340, color: SUN, strength: 0.6, bloom: true, motion: { kind: 'pulse', amp: 0.1, period: 10 } });
  pieces.push({
    kind: 'light',
    id: 'lantern',
    art: 'glow',
    role: 'light',
    at: { x: TABLE.x - TABLE.w / 2 + 112, y: DECK - TABLE.h + 34, z: -TABLE.d + 2 },
    r: 50,
    color: LAMP,
    strength: 0.45,
    motion: { kind: 'flicker', amp: 0.3, period: 2.3 },
    buildIn: 'light',
  });
  // The gate's pier lamps, lit for the evening: a warm pool on the path where it meets the gate.
  pieces.push({ kind: 'light', id: 'gate-lamps', art: 'glow', role: 'light', at: { x: 600, y: FLOOR_Y - GATE.h * 0.52, z: -GATE.d + 4 }, r: 170, color: LAMP, strength: 0.3, motion: { kind: 'flicker', amp: 0.2, period: 3.1, phase: 0.4 }, buildIn: 'light' });

  return {
    name: 'veranda',
    // Golden hour: warm cream overhead, apricot at the horizon, the lawn's olive under it.
    sky: `linear-gradient(180deg, ${mix(c.background, c.accent, 0.45)} 0%, ${mix(c.accent, SUN, 0.5)} 52%, ${mix(c.accent, c.primary, 0.25)} 70%, ${mix(c.surface, c.primary, 0.35)} 100%)`,
    light: { from: 'left', color: SUN, rim: '#fff2d8' },
    fog: { color: HAZE, near: 1100, far: 3200, max: 0.46 },
    veil: 0.25,
    focus: { x: 600, y: 640, z: -2050 },
    // The far pose stays under the veranda roof (the ceiling and the deck reach back over it): from the house's side the roof would float.
    poses: { far: { x: 600, y: 300, z: 560, yaw: 0, pitch: 0, roll: 0, fov: 50 } },
    pieces,
    covers: { gate: 'garden', door: 'houseGate', silk: 'damask', card: 'album' },
    particles: { count: 16, dNear: 900, dFar: 2400 },
  };
};
