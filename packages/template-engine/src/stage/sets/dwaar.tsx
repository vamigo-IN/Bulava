import type { ReactNode } from 'react';
import { Lit, metalStops, onCubic, taper, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, Planter, Sky, Tree } from '../kit';
import { back, billboard, floor, hang, sky } from '../planes';
import { perspectiveOf } from '../units';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';

/**
 * T13 · Shubh Dwaar (`shubh-dwaar`, final.md §5.3): the `dwaar` stage.
 * A new home in the blue hour before dawn, for a griha pravesh. The guest has
 * just walked in under the compound gate's mango-leaf toran (the near layer,
 * backlit against the sky); two caparisoned elephants welcome them onto a
 * stone forecourt drawn with rangoli, rows of diyas lining the way and a tulsi
 * chaura on the right (the middle layer); at its end the single-storey house
 * stands with its teak door open on a warm lamp-lit room, a toran across the
 * porch, two kalash on the step and both windows lit (the focal point); a
 * mango tree leans over the compound wall behind, and the sky above still
 * holds its last stars.
 *
 * Set-local pieces (§6.4): HouseFacade (the focal home), plus NearToran (a kit
 * gap: the gate's mango-leaf and marigold toran hung across the crown band).
 */

// ─────────────────────────── helpers ───────────────────────────

const url = (id: string) => `url(#${id})`;
const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;
const q = Math.round;
/** The blue hour's own tones, mixed into each palette. */
const NIGHT = '#141a36';
const DUSKBLUE = '#3b4670';

/** Every colour of a palette (or of NATURE) mixed toward the blue hour: what stands away from the lamps. */
function dusk<T extends Record<string, string>>(o: T, a: number, to: string = DUSKBLUE): T {
  const out: Record<string, string> = {};
  for (const key of Object.keys(o)) out[key] = mix(o[key]!, to, a);
  return out as T;
}
/** A drawing seen in the blue hour: its palette and NATURE mixed toward the dusk. */
const inDusk =
  (draw: Draw, a: number, to: string = DUSKBLUE): Draw =>
  (p) =>
    draw({ ...p, colors: dusk(p.colors, a, to), nature: dusk(p.nature, a, to) });

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** A gold foil gradient across the shape's own box. */
function Gold({ id, base }: { id: string; base: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {metalStops(base, true).map(([o, col], i) => (
        <stop key={i} offset={o} stopColor={col} />
      ))}
    </linearGradient>
  );
}

/** One decimal: compact coordinates for organic detail. */
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Marigolds strung along a path, as round-capped dashes (compact markup): the deep ruff, the bloom, every other bloom
 * a deeper saffron, and a dark heart. `gap` is the spacing between flowers along the path.
 */
function Garland({ d, r, gap, flower, deep }: { d: string; r: number; gap: number; flower: string; deep: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeDasharray={`0 ${r2(gap)}`}>
      <path d={d} stroke={deep} strokeWidth={r2(r * 2)} />
      <path d={d} stroke={flower} strokeWidth={r2(r * 1.6)} />
      <path d={d} stroke={mix(flower, deep, 0.4)} strokeWidth={r2(r * 1.6)} strokeDasharray={`0 ${r2(gap * 2)}`} strokeDashoffset={r2(gap)} />
      <path d={d} stroke={deep} strokeOpacity={0.75} strokeWidth={r2(r * 0.6)} />
    </g>
  );
}

/** A mango leaf hanging from (x, y): `s` leans it (dx per dy), `len` long, `half` its half-width. */
interface Leaf {
  x: number;
  y: number;
  s: number;
  len: number;
  half: number;
}
/** Mango leaves as one path in absolute coordinates (direction vectors, no trigonometry). */
function leafPath(list: readonly Leaf[]): string {
  return list
    .map(({ x, y, s, len, half }) => {
      const m = Math.sqrt(1 + s * s);
      const dx = s / m;
      const dy = 1 / m;
      const P = (a: number, b: number) => `${r1(x + dx * a * len - dy * b * half)} ${r1(y + dy * a * len + dx * b * half)}`;
      return `M${P(0, 0)}C${P(0.16, 0.85)} ${P(0.62, 1.05)} ${P(1, 0)}C${P(0.62, -1.05)} ${P(0.16, -0.85)} ${P(0, 0)}Z`;
    })
    .join('');
}
/** Their midribs. */
function ribPath(list: readonly Leaf[]): string {
  return list
    .map(({ x, y, s, len }) => {
      const m = Math.sqrt(1 + s * s);
      return `M${r1(x + (s / m) * len * 0.06)} ${r1(y + len * 0.06 / m)}L${r1(x + (s / m) * len * 0.9)} ${r1(y + (len * 0.9) / m)}`;
    })
    .join('');
}
/** The path of a cubic, for garlands. */
const cubicD = ([a, b, c2, d]: Segment): string => `M${r1(a[0])} ${r1(a[1])}C${r1(b[0])} ${r1(b[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(d[0])} ${r1(d[1])}`;

// ─────────────────────────── the house ───────────────────────────

const HOUSE = { w: 900, h: 470 } as const;

/** The marigold swag under a window's chhajja. */
const swagOf = (cx: number): Segment => [
  [cx - 46, 230],
  [cx - 20, 244],
  [cx + 20, 244],
  [cx + 46, 230],
];
/** A lit window with an arched opening, a jaali, open shutters and a chhajja (its swag is in the house's garland). */
function windowAt(cx: number, k: (s: string) => string, wall: string, frame: string, wood: string, glowCol: string, rim: string): ReactNode {
  return (
    <g>
      <ellipse cx={cx} cy={292} rx={96} ry={86} fill={url(k('spill'))} />
      {/* shutters, swung open against the wall */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={s < 0 ? cx - 84 : cx + 54} y={242} width={30} height={98} fill={wood} />
          <rect x={s < 0 ? cx - 80 : cx + 58} y={248} width={22} height={40} fill="none" stroke={frame} strokeOpacity={0.55} strokeWidth={1.2} />
          <rect x={s < 0 ? cx - 80 : cx + 58} y={294} width={22} height={40} fill="none" stroke={frame} strokeOpacity={0.55} strokeWidth={1.2} />
        </g>
      ))}
      <rect x={cx - 52} y={226} width={104} height={124} rx={3} fill={frame} />
      <path d={`M${cx - 38} 338V262Q${cx - 38} 240 ${cx} 238Q${cx + 38} 240 ${cx + 38} 262V338Z`} fill={url(k('win'))} />
      {/* a tied-back curtain */}
      <path d={`M${cx - 38} 258Q${cx - 14} 252 ${cx - 6} 262Q${cx - 18} 290 ${cx - 30} 300Q${cx - 26} 322 ${cx - 36} 338H${cx - 38}Z`} fill={mix(glowCol, '#ffffff', 0.45)} opacity={0.75} />
      <path d={`M${cx - 19} 248V338M${cx} 240V338M${cx + 19} 248V338M${cx - 38} 290H${cx + 38}`} stroke={wood} strokeWidth={2.2} fill="none" />
      <rect x={cx - 50} y={338} width={100} height={8} fill={mix(wall, '#ffffff', 0.12)} />
      <path d={`M${cx - 50} 338.6H${cx + 50}`} stroke={glowCol} strokeOpacity={0.8} strokeWidth={1.2} />
      {/* chhajja (sunshade) */}
      <path d={`M${cx - 68} 214H${cx + 68}L${cx + 62} 225H${cx - 62}Z`} fill={mix(wall, NIGHT, 0.35)} />
      <path d={`M${cx - 68} 214.6H${cx + 68}`} stroke={rim} strokeOpacity={0.55} strokeWidth={1.2} />
    </g>
  );
}

/**
 * The focal home (900×470, foot on the floor): a single-storey house of lime-washed walls under a quiet Mangalore-tiled
 * roof, a gabled teak porch hung with a mango-leaf toran, the door standing open on a lit room (a brass samai burning,
 * a money plant in a clay pot), two lit windows with open shutters, and a low compound wall with lamp-topped piers.
 */
function HouseFacade(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const low = p.detail === 'low';
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const glowCol = p.light.color;
  const rim = p.light.rim;
  const wall = mix(mix(c.surface, c.background, 0.5), DUSKBLUE, 0.52);
  const lime = mix(wall, '#ffffff', 0.06);
  const stone = mix(mix(c.surface, c.muted, 0.4), NIGHT, 0.45);
  const roof = mix(mix(n.clay, c.primary, 0.35), NIGHT, 0.5);
  const roofDark = mix(roof, '#000000', 0.32);
  const wood = mix(mix(c.text, c.primary, 0.3), NIGHT, 0.15);
  const woodLit = mix(wood, glowCol, 0.22);
  const frame = mix(c.primary, NIGHT, 0.3);
  const door = mix(c.primary, '#000000', 0.12);
  const gold = c.secondary;
  const flower = n.flame;
  const deep = mix(n.flame, n.clayDark, 0.55);
  const room = mix(glowCol, '#fff6dc', 0.35);
  const roomDeep = mix(glowCol, c.primary, 0.42);

  // Roof tile rows between the eaves (y 172) and the ridge (y 58).
  const roofX = (y: number) => 96 + ((172 - y) * 164) / 114;
  let ribs = '';
  let ribsOdd = '';
  let courses = '';
  for (let y = 70, i = 0; y < 168; y += 12, i++) {
    const x0 = r1(roofX(y) + 2);
    if (i % 2) ribsOdd += `M${x0} ${y}H${r1(900 - x0)}`;
    else ribs += `M${x0} ${y}H${r1(900 - x0)}`;
    courses += `M${x0} ${y + 1.6}H${r1(900 - x0)}`;
  }
  const rows = (
    <g fill="none" stroke={roofDark}>
      <path d={courses} strokeOpacity={0.55} strokeWidth={0.9} />
      {low ? (
        <path d={ribs + ribsOdd} strokeWidth={2} />
      ) : (
        <>
          <path d={ribs} strokeWidth={3} strokeDasharray="3 21" />
          <path d={ribsOdd} strokeWidth={3} strokeDasharray="3 21" strokeDashoffset={12} />
        </>
      )}
    </g>
  );
  // The porch gable's tiles (apex 450,122; eaves y 216, x 306–594).
  const gableX = (y: number) => 306 + ((216 - y) * 144) / 94;

  // The toran across the porch beam: mango leaves alternating with marigolds.
  const beam: Segment = [
    [326, 228],
    [380, 236],
    [520, 236],
    [574, 228],
  ];
  const LEAVES = 15;
  const leaves: Leaf[] = Array.from({ length: LEAVES }, (_, i) => {
    const t = (i + 0.5) / LEAVES;
    const pt = onCubic(beam, t);
    return { x: pt.x, y: pt.y, s: (t - 0.5) * -0.25, len: 20 + rand(i, 31) * 6, half: 5.2 };
  });
  const toran = (
    <g>
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 0))} fill={n.leafDark} stroke={rim} strokeOpacity={0.3} strokeWidth={0.8} />
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 1))} fill={n.leaf} stroke={rim} strokeOpacity={0.3} strokeWidth={0.8} />
      <Garland d={`M330 230C383 238 517 238 570 230`} r={4.2} gap={17.4} flower={flower} deep={deep} />
    </g>
  );
  // Marigold strands down the door frame and the porch pillars.
  // One garland for the strands down the door frame and the porch pillars and the swags under both chhajjas.
  const strands = (
    <Garland
      d={`M375 252V330M525 252V330M336 244V312M564 244V312${cubicD(swagOf(195))}${cubicD(swagOf(705))}`}
      r={3.5}
      gap={7.4}
      flower={flower}
      deep={deep}
    />
  );

  // The eaves' marigold garland in scallops.
  const scallops = low ? null : (
    <Garland d={`M112 186${Array.from({ length: 6 }, () => 'c30 14 83 14 113 0').join('')}`} r={2.9} gap={6.4} flower={flower} deep={deep} />
  );

  return (
    <Svg w={HOUSE.w} h={HOUSE.h}>
      <defs>
        <linearGradient id={k('wall')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(wall, NIGHT, 0.4)} />
          <stop offset="0.35" stopColor={wall} />
          <stop offset="1" stopColor={mix(wall, glowCol, 0.16)} />
        </linearGradient>
        <linearGradient id={k('cw')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(lime, NIGHT, 0.12)} />
          <stop offset="1" stopColor={mix(lime, NIGHT, 0.32)} />
        </linearGradient>
        <linearGradient id={k('roof')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(roof, rim, 0.08)} />
          <stop offset="1" stopColor={mix(roof, '#000000', 0.2)} />
        </linearGradient>
        <radialGradient id={k('room')} cx="0.5" cy="0.62" r="0.7">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.35" stopColor={room} />
          <stop offset="1" stopColor={roomDeep} />
        </radialGradient>
        <radialGradient id={k('win')} cx="0.5" cy="0.6" r="0.7">
          <stop offset="0" stopColor="#fff3d0" />
          <stop offset="0.5" stopColor={glowCol} />
          <stop offset="1" stopColor={roomDeep} />
        </radialGradient>
        <radialGradient id={k('spill')}>
          <stop offset="0" stopColor={glowCol} stopOpacity={0.34} />
          <stop offset="1" stopColor={glowCol} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={k('halo')}>
          <stop offset="0" stopColor="#fff3c4" stopOpacity={0.95} />
          <stop offset="0.3" stopColor={n.flame} stopOpacity={0.45} />
          <stop offset="1" stopColor={n.flame} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={k('steps')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={glowCol} stopOpacity={0.55} />
          <stop offset="1" stopColor={glowCol} stopOpacity={0.12} />
        </linearGradient>
        <Gold id={k('gold')} base={gold} />
      </defs>

      {/* The compound wall either side, with lamp-topped piers. */}
      {[-1, 1].map((s) => {
        const x0 = s < 0 ? 0 : 750;
        const pier = s < 0 ? 0 : 876;
        const lampX = pier + 12;
        return (
          <g key={`cw${s}`}>
            <rect x={x0} y={392} width={150} height={78} fill={url(k('cw'))} />
            <rect x={x0} y={384} width={150} height={9} fill={mix(lime, '#ffffff', 0.1)} />
            <path d={`M${x0} 384.6H${x0 + 150}`} stroke={rim} strokeOpacity={0.5} strokeWidth={1.2} />
            <rect x={x0} y={436} width={150} height={5} fill={frame} opacity={0.7} />
            {[0, 1].map((j) => (
              <rect key={j} x={x0 + 34 + j * 52} y={404} width={30} height={22} rx={2} fill={mix(lime, NIGHT, 0.4)} />
            ))}
            <rect x={pier} y={360} width={24} height={110} fill={mix(lime, NIGHT, 0.08)} />
            <rect x={pier - 3} y={352} width={30} height={9} fill={mix(lime, '#ffffff', 0.12)} />
            <path d={`M${pier - 3} 352.6H${pier + 27}`} stroke={rim} strokeOpacity={0.55} strokeWidth={1.2} />
            <circle cx={lampX} cy={340} r={22} fill={url(k('halo'))} />
            <path d={`M${lampX - 8} 349Q${lampX} 356 ${lampX + 8} 349Z`} fill={n.clay} />
            <path d={`M${lampX} 338Q${lampX + 3.5} 344 ${lampX} 348Q${lampX - 3.5} 344 ${lampX} 338Z`} fill={n.flame} />
          </g>
        );
      })}

      {/* Roof: quiet Mangalore tiles under a rim-lit ridge. */}
      <path d="M96 172L260 58H640L804 172Z" fill={url(k('roof'))} />
      {rows}
      <rect x={252} y={50} width={396} height={9} rx={2} fill={roofDark} />
      <path d="M252 50.6H648" stroke={rim} strokeOpacity={0.6} strokeWidth={1.4} />
      <path d="M96 172L260 58M804 172L640 58" stroke={rim} strokeOpacity={0.35} strokeWidth={1.2} fill="none" />
      {[252, 648].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={44} rx={5} ry={6} fill={url(k('gold'))} />
          <path d={`M${x} 30L${x + 1.6} 39H${x - 1.6}Z`} fill={url(k('gold'))} />
        </g>
      ))}

      {/* Walls, the eave's shadow and pilasters. */}
      <rect x={140} y={176} width={620} height={266} fill={url(k('wall'))} />
      <rect x={140} y={176} width={620} height={26} fill={NIGHT} opacity={0.28} />
      <rect x={140} y={176} width={20} height={266} fill={mix(lime, NIGHT, 0.12)} />
      <rect x={740} y={176} width={20} height={266} fill={mix(lime, NIGHT, 0.3)} />
      {/* a geru (red-ochre) dado painted with a white mandana chain */}
      <rect x={140} y={404} width={620} height={36} fill={mix(c.primary, NIGHT, 0.22)} />
      <path d="M140 404.6H760" stroke={mix(lime, '#ffffff', 0.2)} strokeWidth={1.2} />
      {!low && (
        <path
          d={Array.from({ length: 31 }, (_, i) => `M${150 + i * 20} 430l6 -16l6 16Z`).join('')}
          fill="none"
          stroke={mix(lime, '#ffffff', 0.35)}
          strokeOpacity={0.75}
          strokeWidth={1}
        />
      )}
      {!low && <path d="M156 410.5H760M166 424H760" stroke={mix(lime, '#ffffff', 0.35)} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="0 20" fill="none" />}
      <ellipse cx={450} cy={380} rx={230} ry={150} fill={url(k('spill'))} />

      {/* Eaves fascia with a carved valance and the marigold garland. */}
      <rect x={90} y={170} width={720} height={10} fill={wood} />
      <path d="M90 170.6H810" stroke={rim} strokeOpacity={0.45} strokeWidth={1.1} />
      {!low && (
        <path
          d={`M90 180${'a9 6 0 0 0 18 0'.repeat(40)}`}
          fill={wood}
          stroke={gold}
          strokeOpacity={0.45}
          strokeWidth={0.8}
        />
      )}
      {scallops}

      {windowAt(195, k, wall, frame, wood, glowCol, rim)}
      {windowAt(705, k, wall, frame, wood, glowCol, rim)}

      {/* The door: a carved teak chaukhat open on a lit room. */}
      <rect x={374} y={238} width={152} height={204} fill={wood} />
      <rect x={370} y={232} width={160} height={14} fill={woodLit} />
      <path d="M370 239H530" stroke={url(k('gold'))} strokeWidth={2.2} />
      <circle cx={450} cy={239} r={6} fill={url(k('gold'))} />
      <path d="M380 252V436M520 252V436" stroke={url(k('gold'))} strokeWidth={1.4} opacity={0.8} />
      {!low && <path d="M386 256V432M514 256V432" stroke={gold} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 4" />}
      <path d="M392 440V262Q392 250 404 250H496Q508 250 508 262V440Z" fill={url(k('room'))} />
      {/* the room inside: back wall, side walls, floor */}
      <path d="M392 262Q392 250 404 250H496Q508 250 508 262L490 270H410Z" fill={roomDeep} opacity={0.55} />
      <path d="M392 262L410 270V414L392 440Z" fill={roomDeep} opacity={0.45} />
      <path d="M508 262L490 270V414L508 440Z" fill={roomDeep} opacity={0.6} />
      <path d="M392 440L410 414H490L508 440Z" fill={mix(roomDeep, c.primary, 0.3)} opacity={0.85} />
      {!low && (
        <g opacity={0.55}>
          {[420, 435, 450, 465, 480].map((x, i) => (
            <circle key={x} cx={x} cy={426 + (i % 2) * 4} r={1.6} fill="#fff6dc" />
          ))}
        </g>
      )}
      {/* a hanging brass bell, a samai burning, a money plant */}
      <path d="M450 270V300" stroke={mix(gold, '#000000', 0.2)} strokeWidth={1} />
      <path d="M443 312Q443 299 450 299Q457 299 457 312Z" fill={url(k('gold'))} />
      <circle cx={450} cy={314} r={1.8} fill={mix(gold, '#000000', 0.3)} />
      <circle cx={472} cy={352} r={24} fill={url(k('halo'))} />
      <ellipse cx={472} cy={412} rx={11} ry={3} fill={mix(gold, '#000000', 0.25)} />
      <path d="M470 411V362H474V411Z" fill={url(k('gold'))} />
      <path d="M461 362Q472 370 483 362Z" fill={url(k('gold'))} />
      <path d="M472 345Q476 352 472 360Q468 352 472 345Z" fill={n.flame} />
      <path d="M472 350Q474 354 472 359Q470 354 472 350Z" fill={n.flameCore} />
      <path d="M418 412L414 394H434L430 412Z" fill={n.clay} />
      <path d="M414 394H434" stroke={n.clayDark} strokeWidth={1.4} />
      {[
        [424, 394, 410, 372],
        [424, 394, 426, 364],
        [424, 394, 440, 374],
        [424, 394, 417, 382],
      ].map(([x0, y0, x1, y1], i) => (
        <g key={i}>
          <path d={`M${x0} ${y0}Q${(x0! + x1!) / 2 + 3} ${(y0! + y1!) / 2} ${x1} ${y1}`} stroke={n.leafDark} strokeWidth={1} fill="none" />
          <ellipse cx={x1} cy={y1} rx={4.5} ry={3} fill={i % 2 ? n.leaf : n.leafLight} transform={`rotate(${-20 + i * 14} ${x1} ${y1})`} />
        </g>
      ))}
      {/* the leaves, swung inward against the room's walls */}
      <path d="M392 262L406 268V420L392 440Z" fill={door} />
      <path d="M508 262L494 268V420L508 440Z" fill={mix(door, '#000000', 0.2)} />
      <path d="M406 268V420M494 268V420" stroke={glowCol} strokeOpacity={0.8} strokeWidth={1.2} />
      <path d="M399 300V400M501 300V400" stroke={gold} strokeWidth={3.6} strokeLinecap="round" strokeDasharray="0 50" />
      <rect x={386} y={434} width={128} height={8} fill={woodLit} />
      <path d="M386 434.6H514" stroke={glowCol} strokeWidth={1.3} />

      {/* The porch: turned teak pillars, a beam and a tiled gable with a carved lotus medallion. */}
      <path d="M306 216L450 122L594 216Z" fill={url(k('roof'))} />
      {!low &&
        [134, 146, 158, 170, 182, 194, 206].map((y, i) => (
          <path key={y} d={`M${r2(gableX(y) + 3)} ${y}H${r2(900 - gableX(y) - 3)}`} stroke={roofDark} strokeWidth={2.6} strokeDasharray="3 18" strokeDashoffset={i % 2 ? 10 : 0} fill="none" />
        ))}
      <path d="M330 210L450 136L570 210Z" fill={mix(lime, NIGHT, 0.25)} />
      <circle cx={450} cy={184} r={17} fill="none" stroke={url(k('gold'))} strokeWidth={1.6} />
      <circle cx={450} cy={184} r={10} fill="none" stroke={url(k('gold'))} strokeWidth={6} strokeDasharray="4.2 3.65" opacity={0.9} />
      <circle cx={450} cy={184} r={4} fill={url(k('gold'))} />
      <path d="M300 220L450 120L600 220" stroke={wood} strokeWidth={9} fill="none" strokeLinejoin="round" />
      <path d="M300 216L450 116L600 216" stroke={rim} strokeOpacity={0.55} strokeWidth={1.3} fill="none" />
      <path d="M304 222L450 125L596 222" stroke={url(k('gold'))} strokeWidth={1.2} fill="none" opacity={0.75} />
      <path d="M450 116V100" stroke={url(k('gold'))} strokeWidth={2} />
      <circle cx={450} cy={104} r={4.5} fill={url(k('gold'))} />
      <path d="M450 92L452.4 100H447.6Z" fill={url(k('gold'))} />
      <rect x={316} y={216} width={268} height={12} fill={wood} />
      <path d="M316 222H584" stroke={url(k('gold'))} strokeWidth={1.4} />
      {[336, 564].map((x, i) => (
        <g key={x}>
          <rect x={x - 12} y={424} width={24} height={18} fill={mix(stone, '#ffffff', 0.12)} />
          <rect x={x - 6.5} y={238} width={13} height={188} fill={i ? mix(wood, '#000000', 0.15) : wood} />
          <path d={`M${x + (i ? -6.5 : 6.5)} 238V424`} stroke={glowCol} strokeOpacity={0.55} strokeWidth={1.4} />
          <path d={[262, 300, 396, 410].map((y) => `M${x - 8.5} ${y}a8.5 3.2 0 1 0 17 0a8.5 3.2 0 1 0 -17 0Z`).join('')} fill={url(k('gold'))} opacity={0.85} />
          <path d={`M${x - 15} 238H${x + 15}L${x + 9} 228H${x - 9}Z`} fill={woodLit} />
          <path d={`M${x - 15} 238H${x + 15}`} stroke={url(k('gold'))} strokeWidth={1.2} />
        </g>
      ))}
      {toran}
      {strands}

      {/* Plinth with a red-oxide band and three steps washed by the door's light. */}
      <rect x={128} y={440} width={644} height={30} fill={stone} />
      <rect x={128} y={440} width={644} height={4} fill={mix(c.primary, NIGHT, 0.15)} />
      <path d="M392 440H508L520 450H380Z" fill={mix(stone, '#ffffff', 0.18)} />
      <rect x={380} y={450} width={140} height={10} fill={mix(stone, '#ffffff', 0.1)} />
      <rect x={368} y={460} width={164} height={10} fill={mix(stone, '#ffffff', 0.04)} />
      <path d="M392 440L368 470H532L508 440Z" fill={url(k('steps'))} />
      <path d="M380 450.6H520M368 460.6H532" stroke={glowCol} strokeOpacity={0.8} strokeWidth={1.2} />
    </Svg>
  );
}

// ─────────────────────────── the gate's toran ───────────────────────────

const TORAN = { w: 1000, h: 112 } as const;

/** The compound gate's toran the guest has just walked under: mango leaves, marigolds and bead strands on a sagging cord, backlit. */
function NearToran(p: DrawProps) {
  const n = p.nature;
  const rim = p.light.rim;
  const low = p.detail === 'low';
  const cord: Segment = [
    [0, 12],
    [330, 88],
    [670, 88],
    [1000, 12],
  ];
  const COUNT = low ? 22 : 30;
  const leaves: Leaf[] = Array.from({ length: COUNT }, (_, i) => {
    const t = (i + 0.5) / COUNT;
    const pt = onCubic(cord, t);
    return { x: pt.x, y: pt.y, s: (t - 0.5) * -0.18 + (rand(i, 23) - 0.5) * 0.14, len: 32 + rand(i, 17) * 8, half: 7.5 };
  });
  // Bead strands of three blooms every fifth flower.
  let beads = '';
  if (!low)
    for (let i = 2; i < COUNT - 1; i += 5) {
      const m = onCubic(cord, (i + 1) / COUNT);
      beads += `M${r1(m.x)} ${r1(m.y + 15)}V${r1(m.y + 34)}`;
    }
  const flower = n.flame;
  const deep = mix(n.flame, n.clayDark, 0.55);
  return (
    <Svg w={TORAN.w} h={TORAN.h}>
      <path d="M0 12C330 88 670 88 1000 12" stroke={mix(n.clayDark, '#000000', 0.4)} strokeWidth={3} fill="none" />
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 0))} fill={mix(n.leafDark, '#08120c', 0.12)} stroke={rim} strokeOpacity={0.4} strokeWidth={1.1} />
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 1))} fill={mix(n.leaf, '#08120c', 0.05)} stroke={rim} strokeOpacity={0.4} strokeWidth={1.1} />
      <path d={ribPath(leaves)} stroke={rim} strokeOpacity={0.22} strokeWidth={0.9} fill="none" />
      {beads && <Garland d={beads} r={5} gap={13} flower={mix(flower, '#fff3c4', 0.25)} deep={deep} />}
      <Garland d="M0 14C330 90 670 90 1000 14" r={11} gap={36} flower={flower} deep={deep} />
    </Svg>
  );
}

// ─────────────────────────── the gate piers ───────────────────────────

const PIER = { w: 84, h: 930 } as const;

/**
 * One of the compound gate's lime-washed piers (84×930), which the toran is tied to: a stepped plinth, a sunk panel
 * edged in geru, a moulded cap and a lamp burning on top. Only far poses and desktops see them.
 */
function GatePier(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const lime = mix(mix(c.surface, c.background, 0.5), DUSKBLUE, 0.5);
  const geru = mix(c.primary, NIGHT, 0.22);
  const rim = p.light.rim;
  return (
    <Svg w={PIER.w} h={PIER.h}>
      <defs>
        <linearGradient id={k('pier')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(lime, NIGHT, 0.1)} />
          <stop offset="1" stopColor={mix(lime, NIGHT, 0.32)} />
        </linearGradient>
        <radialGradient id={k('lamp')}>
          <stop offset="0" stopColor="#fff3c4" stopOpacity={0.95} />
          <stop offset="0.3" stopColor={n.flame} stopOpacity={0.45} />
          <stop offset="1" stopColor={n.flame} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={8} y={96} width={68} height={804} fill={url(k('pier'))} />
      <rect x={2} y={878} width={80} height={52} fill={mix(lime, NIGHT, 0.2)} />
      <rect x={4} y={862} width={76} height={16} fill={mix(lime, NIGHT, 0.14)} />
      <rect x={4} y={110} width={76} height={12} fill={mix(lime, NIGHT, 0.14)} />
      <rect x={8} y={136} width={68} height={6} fill={geru} />
      <path d="M4 862.6H80M4 110.6H80" stroke={rim} strokeOpacity={0.4} strokeWidth={1.2} />
      <rect x={18} y={170} width={48} height={660} fill="none" stroke={geru} strokeWidth={4} />
      <rect x={26} y={180} width={32} height={640} fill={mix(lime, NIGHT, 0.24)} />
      <path d="M42 230l10 18l-10 18l-10 -18Z M42 760l10 18l-10 18l-10 -18Z" fill={geru} />
      <rect x={0} y={84} width={84} height={14} fill={mix(lime, '#ffffff', 0.1)} />
      <rect x={6} y={74} width={72} height={10} fill={mix(lime, NIGHT, 0.08)} />
      <path d="M0 84.6H84M6 74.6H78" stroke={rim} strokeOpacity={0.55} strokeWidth={1.4} />
      <circle cx={42} cy={44} r={34} fill={url(k('lamp'))} />
      <path d="M30 70Q42 80 54 70Z" fill={n.clay} />
      <path d="M42 46Q48 58 42 68Q36 58 42 46Z" fill={n.flame} />
      <path d="M42 54Q45 60 42 67Q39 60 42 54Z" fill={n.flameCore} />
    </Svg>
  );
}

// ─────────────────────────── the neighbourhood ───────────────────────────

/** The back plane's world extent: wide enough for a desktop, its foot below the lawn's far edge. */
const COLONY = { x0: -1700, x1: 2900, yTop: 250, yBottom: 830, d: 2650 } as const;

/**
 * The neighbourhood beyond the garden (a back plane, quiet): flat-roofed houses with water tanks and parapets, mango
 * and coconut trees, a few windows already lit for the puja and a string of lights or two. Low behind the house, so
 * its roof stands against the dawn glow. Each layer is one path (compact markup).
 */
function FarColony(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const low = p.detail === 'low';
  const W = COLONY.x1 - COLONY.x0;
  const H = COLONY.yBottom - COLONY.yTop;
  const foot = 800 - COLONY.yTop; // box y of the ground line
  const house = mix(mix(NIGHT, c.primary, 0.12), DUSKBLUE, 0.25);
  const tree = mix(n.leafDark, NIGHT, 0.55);
  const lit = p.light.color;
  const d = { back: '', front: '', trees: '', fronds: '', windows: '', strings: '' };
  const blob = (cx: number, cy: number, rx: number, ry: number) => `M${q(cx - rx)} ${q(cy)}a${q(rx)} ${q(ry)} 0 1 0 ${q(2 * rx)} 0a${q(rx)} ${q(ry)} 0 1 0 ${q(-2 * rx)} 0Z`;
  for (const row of [0, 1] as const) {
    let x = row ? 0 : 40;
    let i = 0;
    while (x < W) {
      const world = x + COLONY.x0;
      const behind = world > 60 && world < 1140;
      const bw = (row ? 190 : 175) * (0.7 + rand(i, 41 + row) * 0.6);
      const kind = rand(i, 43 + row);
      if (kind < 0.55) {
        // A flat-roofed house with a parapet and maybe a water tank.
        const top = q(foot - (row ? 150 : 175) * (0.55 + rand(i, 47 + row) * 0.45) * (behind ? 0.25 : 1) - (row ? 0 : 20));
        let s = `M${q(x)} ${H}V${top}h-3v-6h${q(bw)}v6h-3V${H}Z`;
        if (!behind && rand(i, 53 + row) > 0.5) s += `M${q(x + bw * 0.6)} ${top - 6}v-20h22v20Z`;
        if (row) d.front += s;
        else d.back += s;
        if (row && !behind && rand(i, 59) > 0.45) d.windows += `M${q(x + bw * 0.3)} ${top + 22}h10v14h-10Z`;
        if (row && !low && !behind && rand(i, 61) > 0.72) d.strings += `M${q(x)} ${top + 5}H${q(x + bw - 8)}`;
      } else if (kind < 0.85) {
        // A mango or neem crown.
        const r = (row ? 70 : 60) * (0.7 + rand(i, 67 + row) * 0.5) * (behind ? 0.6 : 1);
        const cx = x + bw / 2;
        const cy = foot - r * (behind ? 1.1 : 1.9);
        const s = `M${q(cx - 5)} ${H}V${q(cy)}h10V${H}Z${blob(cx, cy, r * 1.2, r)}${blob(cx - r * 0.7, cy + r * 0.3, r * 0.8, r * 0.7)}`;
        if (row) d.trees += s;
        else d.back += s;
      } else if (!behind) {
        // A coconut palm: a leaning trunk and a crown of fronds.
        const h = 260 + rand(i, 71 + row) * 120;
        const cx = x + bw / 2;
        const lean = (rand(i, 73) - 0.5) * 60;
        const tx = q(cx + lean);
        const ty = q(foot - h);
        d.trees += `M${q(cx - 5)} ${foot}Q${q(cx + lean * 0.2)} ${q(foot - h * 0.6)} ${tx - 2} ${ty}h4Q${q(cx + lean * 0.2 + 8)} ${q(foot - h * 0.6)} ${q(cx + 5)} ${foot}Z`;
        d.fronds += `M${tx} ${ty}q-40 -6 -78 26M${tx} ${ty}q40 -6 78 26M${tx} ${ty}q-30 -26 -64 -20M${tx} ${ty}q30 -26 64 -20M${tx} ${ty}q-10 10 -40 50M${tx} ${ty}q10 10 40 50`;
      }
      x += bw + row * 4;
      i++;
    }
  }
  return (
    <Svg w={W} h={H}>
      <path d={d.back} fill={mix(house, DUSKBLUE, 0.3)} />
      <path d={d.front} fill={house} />
      <path d={d.trees} fill={tree} />
      <path d={d.fronds} stroke={tree} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d={d.windows} fill={lit} opacity={0.75} />
      {d.strings && <path d={d.strings} stroke={lit} strokeWidth={4.8} strokeLinecap="round" strokeDasharray="0 13" opacity={0.85} fill="none" />}
      <rect x={0} y={foot - 4} width={W} height={H - foot + 4} fill={mix(house, NIGHT, 0.3)} />
    </Svg>
  );
}

// ─────────────────────────── the garden ───────────────────────────

/**
 * The garden round the forecourt before dawn (a floor plane): dew-dark grass in short tufts (no mown stripes: this is a
 * home, not a ground), hazed toward the colony; a bed of marigolds and tulsi-green edging either side of the forecourt,
 * running from the gate to the house; the two lit windows' light lying on the grass by the house. In the plane's own
 * units: x from its x0, y from its far edge.
 */
function GardenLawn(p: DrawProps) {
  const n = p.nature;
  const g = p.plane;
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const x0 = g?.x0 ?? 0;
  const dFar = g?.dFar ?? p.h;
  const dNear = g?.dNear ?? 0;
  const fx = (x: number) => r1(x - x0);
  const fy = (d: number) => r1(dFar - d);
  const grass = mix(mix(n.leafDark, n.leaf, 0.3), '#0f1a2a', 0.6);
  const blade = mix(n.leafLight, DUSKBLUE, 0.55);
  const shadow = mix(grass, NIGHT, 0.45);
  const lamp = p.light.color;
  const flower = mix(n.flame, DUSKBLUE, 0.28);
  const deep = mix(mix(n.flame, n.clayDark, 0.55), DUSKBLUE, 0.3);
  const hedge = mix(n.leafDark, NIGHT, 0.35);
  // The beds: from just inside the gate to the house's compound wall, either side of the forecourt (x 300–900).
  const bed = (x: number) => `M${fx(x)} ${fy(1860)}V${fy(Math.max(dNear, 160))}`;
  const beds = bed(282) + bed(918);
  const edging = bed(266) + bed(934);
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      <defs>
        <linearGradient id={k('lg')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(grass, DUSKBLUE, 0.4)} />
          <stop offset="0.35" stopColor={grass} />
          <stop offset="1" stopColor={shadow} />
        </linearGradient>
        <pattern id={k('tuft')} width={150} height={90} patternUnits="userSpaceOnUse">
          <path d="M12 70l3 -14M18 72l-2 -12M70 34l4 -13M77 36l-3 -11M118 80l2 -14M124 78l-4 -10M44 16l3 -12M98 58l-2 -11" stroke={blade} strokeWidth={2.2} strokeLinecap="round" opacity={0.5} fill="none" />
          <path d="M30 50l-3 -12M88 82l3 -12M136 26l-3 -12M60 86l2 -10" stroke={shadow} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} fill="none" />
        </pattern>
        <radialGradient id={k('wl')}>
          <stop offset="0" stopColor={lamp} stopOpacity={0.3} />
          <stop offset="1" stopColor={lamp} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={r2(p.w)} height={r2(p.h)} fill={url(k('lg'))} />
      <rect width={r2(p.w)} height={r2(p.h)} fill={url(k('tuft'))} />
      {/* the windows' light on the grass by the house */}
      <ellipse cx={fx(220)} cy={fy(1870)} rx={300} ry={130} fill={url(k('wl'))} />
      <ellipse cx={fx(980)} cy={fy(1870)} rx={300} ry={130} fill={url(k('wl'))} />
      {/* the marigold beds with their green edging */}
      <path d={edging} stroke={hedge} strokeWidth={14} fill="none" />
      <path d={beds} stroke={hedge} strokeWidth={30} fill="none" />
      <path d={beds} stroke={deep} strokeWidth={17} strokeLinecap="round" strokeDasharray="0 24" fill="none" />
      <path d={beds} stroke={flower} strokeWidth={12} strokeLinecap="round" strokeDasharray="0 24" strokeDashoffset={12} fill="none" />
    </svg>
  );
}

// ─────────────────────────── the welcoming elephants ───────────────────────────

const GAJA = { w: 260, h: 210 } as const;

/**
 * A caparisoned elephant standing in welcome (260×210, facing right; its twin is mirrored): a slate body painted with
 * dots, a jhool in the palette's primary bordered in gold with a medallion and tassels, a gold mukhapatta down the
 * brow, ivory tusks, gold anklets, the trunk lowered and curling forward. Drawn compactly (one path per material).
 */
function Gaja(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const rim = p.light.rim;
  const body = mix(mix(c.muted, '#8a8794', 0.55), DUSKBLUE, 0.12);
  const far = mix(body, NIGHT, 0.3);
  const ivory = mix(c.background, '#fffaf0', 0.5);
  const gold = c.secondary;
  const cloth = mix(c.primary, NIGHT, 0.08);
  const paint = mix(c.accent, n.flame, 0.35);
  const leg = (x: number, w: number) => `M${x} 138V199Q${x + w / 2} 207 ${x + w} 199V138Z`;
  const trunk = taper(
    [
      [
        [224, 92],
        [242, 112],
        [244, 150],
        [234, 170],
      ],
      [
        [234, 170],
        [228, 184],
        [242, 192],
        [249, 178],
      ],
    ],
    [24, 12, 6],
    10,
  );
  const tail = taper(
    [
      [
        [44, 86],
        [32, 104],
        [34, 132],
        [30, 152],
      ],
    ],
    [4, 2],
    8,
  );
  return (
    <Svg w={GAJA.w} h={GAJA.h}>
      <defs>
        <Lit id={k('gb')} base={body} light={0.28} dark={0.3} cx="60%" cy="20%" />
        <Gold id={k('gg')} base={gold} />
      </defs>
      <path d={leg(84, 26) + leg(176, 26)} fill={far} />
      <path d={tail} fill={far} />
      <path d="M40 120C36 70 70 42 120 42C160 42 186 50 198 70L202 148C170 160 80 160 46 150Z" fill={url(k('gb'))} />
      <path d={leg(48, 30) + leg(144, 30)} fill={url(k('gb'))} />
      <path d="M186 52C200 30 236 34 238 66C240 86 232 100 222 106L196 110Z" fill={url(k('gb'))} />
      <path d={trunk} fill={url(k('gb'))} />
      <path d="M40 120C36 70 70 42 120 42C160 42 186 50 198 70M186 52C200 30 236 34 238 66" fill="none" stroke={rim} strokeOpacity={0.55} strokeWidth={1.6} />
      {/* the ear, edged with painted dots */}
      <path d="M184 60C160 62 154 106 168 120C180 128 198 114 202 98Z" fill={mix(body, NIGHT, 0.18)} />
      <path d="M182 64C164 68 160 104 170 115C179 122 194 112 198 99" fill="none" stroke={paint} strokeWidth={3} strokeLinecap="round" strokeDasharray="0 7" />
      {/* the jhool: primary cloth, a gold border, a medallion and tassels */}
      <path d={`M62 50C100 43 150 43 176 50L184 128${'a7 7 0 0 1 -14 0'.repeat(9)}Z`} fill={cloth} stroke={url(k('gg'))} strokeWidth={4.5} />
      <path d="M74 60C104 55 146 55 166 60L172 116H70Z" fill="none" stroke={gold} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="4 3" />
      <circle cx={121} cy={88} r={16} fill={url(k('gg'))} />
      <circle cx={121} cy={88} r={10} fill={cloth} />
      <circle cx={121} cy={88} r={5} fill={url(k('gg'))} />
      <path d="M64 138H182" stroke={url(k('gg'))} strokeWidth={4} strokeLinecap="round" strokeDasharray="0 14" fill="none" />
      {/* the mukhapatta down the brow, with a jewel */}
      <path d="M212 40C222 36 234 42 237 56L236 96C232 102 228 106 224 111L220 98C216 84 212 64 212 40Z" fill={url(k('gg'))} />
      <path d="M217 46C224 44 230 48 232 56V94" fill="none" stroke={mix(gold, '#000000', 0.35)} strokeWidth={1} strokeDasharray="2 3" />
      <circle cx={225} cy={64} r={4} fill={c.primary} stroke={ivory} strokeWidth={1} />
      <path d="M224 111V120" stroke={url(k('gg'))} strokeWidth={2.4} />
      {/* eye, tusk, painted trunk, anklets and toenails */}
      <path d="M201 70q5 -4 10 0q-5 4 -10 0Z" fill={NIGHT} />
      <path d="M223 112Q240 128 253 123L251 129Q235 135 219 119Z" fill={ivory} />
      <path d="M238 128Q244 150 238 166" fill="none" stroke={paint} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0 8" />
      <path d="M48 188h30M144 188h30M84 188h26M176 188h26" stroke={url(k('gg'))} strokeWidth={4} fill="none" />
      <path d="M52 202h6M66 202h6M148 202h6M162 202h6" stroke={ivory} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────── the kalash ───────────────────────────

const KALASH = { w: 70, h: 100 } as const;

/** A purna kalash on the step (70×100): a brass pot tied with a kumkum band of rice dots, five mango leaves and a coconut bound in red thread. */
function Kalash(p: DrawProps) {
  const c = p.colors;
  const n = p.nature;
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const kumkum = mix(c.primary, '#b3122e', 0.55);
  const leaves: Leaf[] = [2.6, 1.2, 0, -1.2, -2.6].map((s, i) => ({ x: 35, y: 45, s, len: -(30 + (i % 2) * 5), half: 6.5 }));
  return (
    <Svg w={KALASH.w} h={KALASH.h}>
      <defs>
        <Lit id={k('kp')} base={c.secondary} light={0.45} dark={0.35} cx="35%" cy="30%" />
        <Lit id={k('kc')} base={mix(n.clayDark, '#6b4a2b', 0.5)} light={0.3} dark={0.3} />
      </defs>
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 0))} fill={n.leafDark} />
      <path d={leafPath(leaves.filter((_, i) => i % 2 === 1))} fill={n.leaf} />
      <ellipse cx={35} cy={32} rx={9} ry={11} fill={url(k('kc'))} />
      <path d="M26 33Q35 38 44 33" stroke={kumkum} strokeWidth={2.4} fill="none" />
      <path d="M35 21l-3 -6M35 21l3 -6" stroke={n.leafDark} strokeWidth={1.6} />
      <path d="M26 52C6 58 4 86 18 96H52C66 86 64 58 44 52Z" fill={url(k('kp'))} />
      <rect x={26} y={44} width={18} height={9} fill={url(k('kp'))} />
      <ellipse cx={35} cy={45} rx={13} ry={3.2} fill={mix(c.secondary, '#fff6dc', 0.35)} />
      <path d="M9 70Q35 78 61 70" stroke={kumkum} strokeWidth={4.5} fill="none" />
      <path d="M12 70.8Q35 78.3 58 70.8" stroke="#fff6dc" strokeWidth={1.8} strokeLinecap="round" strokeDasharray="0 5" fill="none" />
      <rect x={21} y={95} width={28} height={5} rx={1.5} fill={mix(c.secondary, '#000000', 0.25)} />
      <path d="M8 70C8 62 14 56 22 54" stroke={p.light.rim} strokeOpacity={0.6} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

// ─────────────────────────── the diyas ───────────────────────────

const DIYAS = { w: 160, h: 44 } as const;

/** A row of five clay diyas burning along the path (160×44), each with a hot core and a small halo. */
function DiyaLine(p: DrawProps) {
  const n = p.nature;
  const k = (s: string) => `dw${Math.abs(q(p.seed))}${s}`;
  const xs = [16, 48, 80, 112, 144];
  const tip = (i: number) => q(12 + rand(i, 7 + Math.abs(q(p.seed))) * 4);
  const bowl = xs.map((x) => `M${x - 13} 33Q${x} 47 ${x + 13} 33Z`).join('');
  const lip = xs.map((x) => `M${x - 13} 33Q${x} 37 ${x + 13} 33`).join('');
  const flame = xs.map((x, i) => `M${x} ${tip(i)}Q${x + 6} 26 ${x} 31Q${x - 6} 26 ${x} ${tip(i)}Z`).join('');
  const core = xs.map((x) => `M${x} 21Q${x + 3} 27 ${x} 30Q${x - 3} 27 ${x} 21Z`).join('');
  return (
    <Svg w={DIYAS.w} h={DIYAS.h}>
      <defs>
        <radialGradient id={k('dh')}>
          <stop offset="0" stopColor={n.flameCore} stopOpacity={0.9} />
          <stop offset="0.35" stopColor={n.flame} stopOpacity={0.4} />
          <stop offset="1" stopColor={n.flame} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={k('db')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(n.clay, n.flame, 0.35)} />
          <stop offset="1" stopColor={n.clayDark} />
        </linearGradient>
      </defs>
      {xs.map((x) => (
        <circle key={x} cx={x} cy={25} r={16} fill={url(k('dh'))} />
      ))}
      <path d={bowl} fill={url(k('db'))} />
      <path d={lip} stroke={mix(n.clay, n.flameCore, 0.45)} strokeWidth={1.6} fill="none" />
      <path d={flame} fill={n.flame} />
      <path d={core} fill={n.flameCore} />
    </Svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const dwaar: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const LAMP = '#ffd27a';
  const DIYA = '#ffc070';
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, recipe: PlaneRecipe, draw: Draw, role: 'architecture' | 'sky' = 'architecture'): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw, ...(role === 'sky' ? { quiet: true } : {}) });
  };

  // The blue hour before dawn, the palette's primary a whisper in it; the last stars at the sides.
  const skyDraw: Draw = (p) => (
    <Sky
      {...p}
      variant="preDawn"
      stars
      colors={{
        ...p.colors,
        text: mix('#070e36', p.colors.text, 0.08),
        primary: mix('#1a3292', p.colors.primary, 0.1),
        muted: mix('#6a78a8', p.colors.muted, 0.18),
        accent: mix('#f2c48c', p.colors.accent, 0.3),
      }}
    />
  );
  // The first warmth of dawn low behind the house (frame y 440, centred on the story), under the plane's own drawing.
  const dawnGlow: Draw = (p) => {
    const id = `dw${Math.abs(q(p.seed))}dg`;
    // (A sky with no skyline rules no horizon line, so nothing stands bare above the low colony.)
    return (
      <>
        {skyDraw(p)}
        <svg viewBox="0 0 1920 1280" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <defs>
            <radialGradient id={id}>
              <stop offset="0" stopColor="#ffc98a" stopOpacity={0.38} />
              <stop offset="0.5" stopColor="#f2a27a" stopOpacity={0.14} />
              <stop offset="1" stopColor="#f2a27a" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={960} cy={684} rx={760} ry={150} fill={url(id)} />
        </svg>
      </>
    );
  };
  plane('sky', 'sky:preDawn', sky({ d: perspectiveOf(60) * 4.33 }), dawnGlow, 'sky');

  // The garden all round, then the stone forecourt with its rangoli and the path kolam, pools of diya and door light.
  plane('colony', 'colony', back(COLONY), FarColony);
  plane('lawn', 'floor:lawn', floor({ x0: -1700, x1: 2900, y: 801, dNear: 100, dFar: 2600 }), GardenLawn);
  plane(
    'forecourt',
    'floor:templeStone',
    floor({ x0: 300, x1: 900, dNear: 100, dFar: 1900 }),
    inDusk(drawWith(Floor, {
      variant: 'templeStone',
      rangoli: true,
      kolam: 'path',
      pools: [
        { x: 600, d: 1880, r: 260, color: LAMP },
        { x: 480, d: 1250, r: 95, color: DIYA },
        { x: 720, d: 1250, r: 95, color: DIYA },
        { x: 480, d: 1550, r: 85, color: DIYA },
        { x: 720, d: 1550, r: 85, color: DIYA },
      ],
    }), 0.42),
  );

  // Far: the mango tree over the compound wall, then the home itself.
  pieces.push({ kind: 'prop', id: 'mango', art: 'tree:mango', role: 'prop', ...billboard({ x: 220, d: 2100, w: 340, h: 470 }), draw: inDusk(drawWith(Tree, { variant: 'mango' }), 0.25), motion: { kind: 'sway', amp: 0.5, period: 8 } });
  pieces.push({ kind: 'prop', id: 'house', art: 'houseFacade', role: 'focal', ...billboard({ x: 600, d: 1900, w: HOUSE.w, h: HOUSE.h }), draw: HouseFacade });

  // The step: two kalash either side of the door.
  for (const [s, x] of [
    ['l', 490],
    ['r', 710],
  ] as const)
    pieces.push({ kind: 'prop', id: `kalash-${s}`, art: 'kalash', role: 'prop', ...billboard({ x, d: 1800, w: KALASH.w, h: KALASH.h }), draw: Kalash, buildIn: 'rise' });

  // The forecourt: diyas lining the way (turned along it), the tulsi chaura, the welcoming elephants.
  for (const [i, x, d] of [
    [0, 480, 1250],
    [1, 720, 1250],
    [2, 480, 1550],
    [3, 720, 1550],
  ] as const)
    pieces.push({ kind: 'prop', id: `diyas-${i}`, art: 'diyaLine', role: 'prop', ...billboard({ x, d, w: DIYAS.w, h: DIYAS.h, turn: x < 600 ? 25 : -25 }), draw: DiyaLine, buildIn: 'fade' });
  pieces.push({ kind: 'prop', id: 'tulsi', art: 'planter:tulsi', role: 'prop', ...billboard({ x: 850, d: 1600, w: 100, h: 180 }), draw: inDusk(drawWith(Planter, { plant: 'tulsi' }), 0.15) });
  pieces.push({ kind: 'prop', id: 'elephant-l', art: 'gaja', role: 'prop', ...billboard({ x: 320, d: 1100, w: GAJA.w, h: GAJA.h }), draw: Gaja });
  pieces.push({ kind: 'prop', id: 'elephant-r', art: 'gaja', role: 'prop', ...billboard({ x: 880, d: 1100, w: GAJA.w, h: GAJA.h }), draw: Gaja, flipX: true });

  // Near: the gate's toran overhead, in the crown band.
  pieces.push({
    kind: 'prop',
    id: 'gate-toran',
    art: 'nearToran',
    role: 'hanging',
    ...hang({ x: 600, d: 520, w: TORAN.w, h: TORAN.h, top: -62 }),
    draw: NearToran,
    motion: { kind: 'sway', amp: 0.5, period: 7 },
    buildIn: 'drop',
  });

  for (const [s, x] of [
    ['l', 58],
    ['r', 1142],
  ] as const)
    pieces.push({ kind: 'prop', id: `pier-${s}`, art: 'gatePier', role: 'architecture', ...billboard({ x, d: 520, w: PIER.w, h: PIER.h }), draw: GatePier });

  // Lights: the open door, the two windows, the diyas along the path.
  pieces.push({ kind: 'light', id: 'door-glow', art: 'glow', role: 'light', at: { x: 600, y: 650, z: -1890 }, r: 180, color: LAMP, strength: 0.75, bloom: true, motion: { kind: 'pulse', amp: 0.2, period: 5 }, buildIn: 'bloom' });
  for (const [s, x, ph] of [
    ['l', 345, 0],
    ['r', 855, 0.5],
  ] as const)
    pieces.push({ kind: 'light', id: `window-${s}`, art: 'glow', role: 'light', at: { x, y: 620, z: -1890 }, r: 70, color: LAMP, strength: 0.45, motion: { kind: 'twinkle', amp: 0.2, period: 4, phase: ph }, buildIn: 'light' });
  pieces.push({ kind: 'light', id: 'path-glow', art: 'glow', role: 'light', at: { x: 600, y: 760, z: -1250 }, r: 120, color: DIYA, strength: 0.4, motion: { kind: 'flicker', amp: 0.3, period: 1.8 } });

  return {
    name: 'dwaar',
    sky: `linear-gradient(180deg, ${mix('#0b1030', c.primary, 0.1)} 0%, ${mix('#28366a', c.primary, 0.14)} 48%, ${mix('#6a6f96', c.accent, 0.2)} 56%, ${mix('#1a2036', c.primary, 0.12)} 62%, ${mix('#10142a', c.primary, 0.1)} 100%)`,
    light: { from: 'far', color: LAMP, rim: '#ffe9b0' },
    fog: { color: '#1c1f3e', near: 1300, far: 3000, max: 0.45 },
    veil: 0.35,
    focus: { x: 600, y: 620, z: -1850 },
    pieces,
    covers: { gate: 'haveli', door: 'houseGate', silk: 'damask', card: 'trifold' },
    particles: { count: 19, dNear: 700, dFar: 1900 },
  };
};
