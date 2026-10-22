import { createElement, type ReactNode } from 'react';
import { onCubic, shade, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, MistBand } from '../kit';
import { bodyStops, FlameAt, FlameDef, Glow, kitId, Lin, marigoldOf, metalLit } from '../kit/architecture';
import { LampTower } from '../kit/favourites';
import { back, billboard, floor, hang, sky } from '../planes';
import type { DrawProps, Piece, StageSetFactory } from '../types';
import { perspectiveOf } from '../units';

/**
 * T14 · Deepstambh (`deepstambh`, final.md §5.3): the `deepstambh` stage.
 * A temple courtyard at dusk, the hour of the sandhya aarti. Down the axis, the
 * sanctum's rose-stone front: a stepped plinth lined with diyas, two kalash at
 * its steps, carved niches each holding a lamp, and the open silver doors with
 * the prabhavali glowing inside (no idol); the shikhara rises behind it as a
 * hazed silhouette against the afterglow. Left of the axis the black basalt
 * deepastambha burns with seven tiers of wicks, its flames flaring in turn;
 * right, a stone bell pavilion whose brass bell swings on its red cord. The
 * courtyard wall's deepamala runs off either side in a line of tiny flames,
 * incense haze drifts across the stone floor and its rangoli, and a mango-leaf
 * toran hangs near overhead.
 *
 * Set-local pieces (§6.4): SanctumFront, BellMandap, plus BrassBell, PrakaraWall (the courtyard
 * wall with its deepamala) and CrownToran. The two kalash of the brief are
 * drawn on the sanctum's steps (they stand on it, a piece of their own would
 * only cost the budget). The lamp tower (the body and its two flaring halo
 * layers) is the kit's (kit/favourites.tsx), so the Design Studio offers it.
 */

// ─────────────────────────── geometry ───────────────────────────

const TOWER = { x: 370, d: 1500, w: 150, h: 470 } as const;
const SANCTUM = { d: 2150, w: 600, h: 470 } as const;
const MANDAP = { x: 830, d: 1300, w: 210, h: 420 } as const;
/** The bell hangs from the pavilion's beam (box y 122) on its own piece, so it can swing. */
const BELL = { w: 64, h: 250, top: 800 - MANDAP.h + 124 } as const;
const WALL = { d: 2400, yTop: 560, x0: -1600, x1: 2800 } as const;
/** The courtyard's gateway near the eye: two granite posts and the toran between them (desktops, and the far pose's frame). */
const GATE = { d: 650, x: [222, 978], w: 84, top: -112 } as const;
const TORAN = { d: GATE.d - 4, w: 840, h: 70, top: -100 } as const;
const LAMP = '#ffc56a';
const DOOR = '#ffe2a0';

/** An <svg> drawn in the piece's native units (the box it was designed in), stretched to the box. */
function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {children}
    </svg>
  );
}

const url = (id: string) => `url(#${id})`;
/** A path string whose numbers are rounded to a tenth of a unit (finer is invisible at these sizes; it keeps the markup small). */
const P = (s: TemplateStringsArray, ...v: number[]): string => {
  let out = s[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(Math.round((v[i] ?? 0) * 10) / 10) + (s[i + 1] ?? '');
  return out;
};
/** Rose sandstone, the sanctum's and the pavilion's, in the dusk shadow. */
const roseOf = (p: DrawProps) => mix(mix(p.colors.muted, p.colors.primary, 0.28), p.colors.surface, 0.1);

// ─────────────────────────── SanctumFront ───────────────────────────

const SW = SANCTUM.w;
const SH = SANCTUM.h;
const SCX = SW / 2;
/** The doorway opening (box units): its jambs, lintel and threshold. */
const DOORWAY = { x0: 246, x1: 354, y0: 184, y1: 398 } as const;

/** A horseshoe kudu arch outline, `w` wide, standing on y (a gavaksha window of temple cornices). */
const kudu = (x: number, y: number, w: number, h: number) => P`M${x - w / 2} ${y}V${y - h * 0.45}C${x - w / 2} ${y - h * 1.05} ${x + w / 2} ${y - h * 1.05} ${x + w / 2} ${y - h * 0.45}V${y}`;

/**
 * The sanctum's front (600×470): a stepped plinth (moulded bands, a frieze, a
 * row of diyas along its top) with three steps rising to the door and a brass
 * kalash either side; rose-stone walls with pilasters and a carved niche on
 * each side holding a lamp; the door portal's receding carved jambs and lotus
 * lintel under a mango-leaf toran; the silver leaves turned open inside, and
 * within, the gilt prabhavali of flames round a soft glow above a lamp on its
 * pitha (no idol). A heavy cornice with gavaksha arches and a parapet of
 * miniature shrines cap it; the shikhara of the sky stands behind.
 */
function SanctumFront(p: DrawProps) {
  const c = p.colors;
  const id = kitId(p, 'sf');
  const stone = roseOf(p);
  const lit = tint(stone, 0.14);
  const deep = shade(stone, 0.32);
  const line = shade(stone, 0.42);
  const silver = tint(mix(c.muted, c.surface, 0.55), 0.25);
  const leaf = p.nature.leaf;
  const D = DOORWAY;
  const diyaXs = [...Array(9)].flatMap((_, k) => [24 + k * 20, SW - 24 - k * 20]);
  const shrineXs = [40, 116, 484, 560];
  const flames: Array<[number, number, number]> = [
    ...diyaXs.map((x) => [x, 401, 7] as [number, number, number]),
    [105, 300, 10],
    [SW - 105, 300, 10],
    [SCX, 366, 15],
  ];
  return (
    <Svg w={SW} h={SH}>
      <defs>
        <Lin id={`${id}w`} stops={[[0, shade(stone, 0.26)], [0.55, stone], [1, mix(stone, p.nature.flame, 0.14)]]} y1={90} y2={400} />
        <Lin id={`${id}pl`} stops={[[0, lit], [0.3, stone], [1, deep]]} y1={398} y2={470} />
        <Lin id={`${id}m`} stops={metalLit(c.secondary, 'far')} x1={0} x2={SW} />
        <Lin id={`${id}ag`} stops={metalLit(c.secondary, 'far')} x1={D.x0 + 10} x2={D.x1 - 10} />
        <Lin id={`${id}sv`} stops={metalLit(silver, 'far', false)} x1={D.x0} x2={D.x1} />
        <radialGradient id={`${id}in`} cx="50%" cy="72%" r="70%">
          <stop offset="0" stopColor={p.nature.flameCore} />
          <stop offset="0.3" stopColor={mix(p.nature.flame, p.nature.flameCore, 0.45)} />
          <stop offset="0.7" stopColor={mix(c.secondary, p.nature.clayDark, 0.4)} />
          <stop offset="1" stopColor={shade(mix(c.primary, p.nature.clayDark, 0.4), 0.45)} />
        </radialGradient>
        <Glow id={`${id}g`} color={p.nature.flame} core={p.nature.flameCore} a={0.55} />
        <Glow id={`${id}sp`} color={p.nature.flame} core={p.nature.flameCore} a={0.38} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
        <g id={`${id}d`}>
          <circle cx={0} cy={-3.5} r={7.7} fill={url(`${id}g`)} />
          <path d="M-4 0Q0 3 4 0Z" fill={p.nature.clay} />
          <FlameAt href={`${id}f`} x={0} y={0} s={7} />
        </g>
      </defs>
      {/* Parapet of miniature shrines (kuta and shala), the great gable over the door. */}
      {shrineXs.map((x, k) => (
        <g key={`sh${k}`}>
          <path d={k % 3 === 0 ? P`M${x - 17} 86V56H${x + 17}V86ZM${x - 20} 56Q${x} 30 ${x + 20} 56Z` : P`M${x - 26} 86V58H${x + 26}V86ZM${x - 28} 58C${x - 28} 38 ${x + 28} 38 ${x + 28} 58Z`} fill={url(`${id}w`)} />
          <path d={kudu(x, 80, 12, 16)} fill={deep} />
          <path d={P`M${x} ${k % 3 === 0 ? 38 : 40}V${k % 3 === 0 ? 30 : 30}`} stroke={url(`${id}m`)} strokeWidth={2.4} />
          <circle cx={x} cy={k % 3 === 0 ? 28 : 28} r={2.6} fill={url(`${id}m`)} />
        </g>
      ))}
      <path d={P`M${SCX - 58} 88V46C${SCX - 58} 2 ${SCX + 58} 2 ${SCX + 58} 46V88Z`} fill={url(`${id}w`)} />
      <path d={P`M${SCX - 44} 88V50C${SCX - 44} 16 ${SCX + 44} 16 ${SCX + 44} 50V88`} fill="none" stroke={lit} strokeWidth={3} />
      <path d={P`M${SCX - 30} 88V54C${SCX - 30} 30 ${SCX + 30} 30 ${SCX + 30} 54V88Z`} fill={deep} />
      <path d={[...Array(8)].map((_, k) => P`M${SCX} 62L${SCX + [12, 8.5, 0, -8.5, -12, -8.5, 0, 8.5][k]!} ${62 + [0, 8.5, 12, 8.5, 0, -8.5, -12, -8.5][k]!}`).join('')} stroke={url(`${id}m`)} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={SCX} cy={62} r={4.5} fill={url(`${id}m`)} />
      <path d={P`M${SCX} 4V-10`} stroke={url(`${id}m`)} strokeWidth={3} />
      <circle cx={SCX} cy={-12} r={3.4} fill={url(`${id}m`)} />
      {/* The walls, pilasters and a carved niche either side with its lamp. */}
      <rect x={8} y={100} width={SW - 16} height={300} fill={url(`${id}w`)} />
      {[8, 178, 398, 568].map((x) => (
        <g key={`pi${x}`}>
          <rect x={x} y={104} width={24} height={296} fill={lit} opacity={0.5} />
          <rect x={x - 3} y={104} width={30} height={12} fill={lit} />
          <rect x={x - 3} y={384} width={30} height={16} fill={lit} />
          <path d={P`M${x + 6} 124V376M${x + 18} 124V376`} stroke={line} strokeWidth={1} opacity={0.6} />
        </g>
      ))}
      {[105, SW - 105].map((x) => (
        <g key={`ni${x}`}>
          <path d={P`M${x - 46} 196L${x} 154L${x + 46} 196Z`} fill={lit} stroke={line} strokeWidth={1} />
          <path d={kudu(x, 196, 24, 26)} fill={deep} />
          <path d={P`M${x - 38} 330V220C${x - 38} 196 ${x + 38} 196 ${x + 38} 220V330Z`} fill={lit} />
          <path d={P`M${x - 28} 326V226C${x - 28} 208 ${x + 28} 208 ${x + 28} 226V326Z`} fill={shade(mix(stone, p.nature.clayDark, 0.3), 0.35)} />
          <ellipse cx={x} cy={292} rx={34} ry={40} fill={url(`${id}sp`)} />
          <path d={P`M${x - 10} 304H${x + 10}L${x + 6} 310H${x - 6}Z`} fill={url(`${id}m`)} />
          <rect x={x - 44} y={326} width={88} height={8} fill={lit} />
        </g>
      ))}
      <rect x={8} y={346} width={SW - 16} height={3} fill={lit} />
      <rect x={8} y={367} width={SW - 16} height={3} fill={lit} />
      {/* The door portal: receding carved jambs, the lotus lintel and its toran. */}
      <rect x={196} y={118} width={208} height={282} fill={lit} />
      <path d={[...Array(9)].map((_, k) => P`M203 ${136 + k * 28}h7v7h-7zM390 ${136 + k * 28}h7v7h-7z`).join('')} fill={deep} opacity={0.7} />
      <rect x={216} y={138} width={168} height={262} fill={stone} />
      <rect x={216} y={138} width={168} height={262} fill="none" stroke={line} strokeWidth={1.2} />
      <rect x={230} y={160} width={140} height={240} fill={url(`${id}m`)} opacity={0.85} />
      <rect x={236} y={168} width={128} height={232} fill={deep} />
      <circle cx={SCX} cy={150} r={11} fill={url(`${id}m`)} />
      <path d={[...Array(8)].map((_, k) => P`M${SCX} 150L${SCX + [17, 12, 0, -12, -17, -12, 0, 12][k]!} ${150 + [0, 12, 17, 12, 0, -12, -17, -12][k]!}`).join('')} stroke={url(`${id}m`)} strokeWidth={2.2} strokeLinecap="round" />
      {/* Inside: the glow, the prabhavali of flames, the lamp on its pitha. */}
      <rect x={D.x0} y={D.y0} width={D.x1 - D.x0} height={D.y1 - D.y0} fill={url(`${id}in`)} />
      <path d={P`M${SCX - 38} 384V300C${SCX - 38} 252 ${SCX + 38} 252 ${SCX + 38} 300V384`} fill="none" stroke={url(`${id}ag`)} strokeWidth={5} />
      <path
        d={[...Array(13)].map((_, k) => {
          const seg: Segment = k < 3 ? [[SCX - 38, 384], [SCX - 38, 360], [SCX - 38, 330], [SCX - 38, 300]] : k > 9 ? [[SCX + 38, 300], [SCX + 38, 330], [SCX + 38, 360], [SCX + 38, 384]] : [[SCX - 38, 300], [SCX - 38, 252], [SCX + 38, 252], [SCX + 38, 300]];
          const t = k < 3 ? k / 3 + 0.15 : k > 9 ? (k - 10) / 3 + 0.1 : (k - 3) / 6;
          const { x, y } = onCubic(seg, Math.min(1, t));
          const ox = x < SCX - 30 ? -1 : x > SCX + 30 ? 1 : (x - SCX) / 38;
          const oy = y < 300 ? -1 : 0;
          return P`M${x - 3} ${y}Q${x + ox * 8} ${y + oy * 8 - 1} ${x + ox * 11} ${y + oy * 12}Q${x + ox * 4} ${y + oy * 4} ${x + 3} ${y}Z`;
        }).join('')}
        fill={url(`${id}ag`)}
      />
      <ellipse cx={SCX} cy={322} rx={30} ry={46} fill={url(`${id}g`)} />
      <path d={P`M${SCX - 22} 392V378H${SCX + 22}V392ZM${SCX - 16} 378V370H${SCX + 16}V378Z`} fill={url(`${id}ag`)} />
      <path d={P`M${SCX - 7} 368H${SCX + 7}L${SCX + 4} 372H${SCX - 4}Z`} fill={url(`${id}m`)} />
      {/* The silver leaves, turned open inside the jambs. */}
      <path d={P`M${D.x0} ${D.y0}L${D.x0 + 22} ${D.y0 + 12}V${D.y1 - 10}L${D.x0} ${D.y1}Z`} fill={url(`${id}sv`)} />
      <path d={P`M${D.x1} ${D.y0}L${D.x1 - 22} ${D.y0 + 12}V${D.y1 - 10}L${D.x1} ${D.y1}Z`} fill={url(`${id}sv`)} />
      <path d={P`M${D.x0 + 22} ${D.y0 + 12}V${D.y1 - 10}M${D.x1 - 22} ${D.y0 + 12}V${D.y1 - 10}`} stroke={tint(silver, 0.6)} strokeWidth={1} />
      {/* Mango-leaf toran under the lintel. */}
      <path d={P`M${D.x0 - 8} ${D.y0 - 14}H${D.x1 + 8}`} stroke={url(`${id}m`)} strokeWidth={1.6} />
      <path d={[...Array(11)].map((_, k) => { const x = D.x0 - 4 + k * 11.6; return P`M${x - 3} ${D.y0 - 14}Q${x - 4} ${D.y0 - 2} ${x} ${D.y0 + 4}Q${x + 4} ${D.y0 - 2} ${x + 3} ${D.y0 - 14}Z`; }).join('')} fill={leaf} />
      <path d={[...Array(10)].map((_, k) => { const x = D.x0 + 2 + k * 11.6; return P`M${x} ${D.y0 - 10}a3.4 3.4 0 1 0 .1 0`; }).join('')} fill={marigoldOf(p)} />
      {/* Threshold, plinth and steps, the diya row along the plinth. */}
      <rect x={232} y={396} width={136} height={6} fill={url(`${id}m`)} />
      <rect x={0} y={400} width={SW} height={70} fill={url(`${id}pl`)} />
      <rect x={0} y={400} width={SW} height={4} fill={lit} />
      <rect x={0} y={414} width={SW} height={2} fill={line} opacity={0.6} />
      <rect x={0} y={448} width={SW} height={3} fill={lit} opacity={0.7} />
      {[[236, 364, 404], [222, 378, 426], [208, 392, 448]].map(([a, b, y]) => (
        <g key={`st${y}`}>
          <rect x={a} y={y} width={b! - a!} height={22} fill={stone} />
          <rect x={a} y={y} width={b! - a!} height={4} fill={tint(lit, 0.1)} />
        </g>
      ))}
      <ellipse cx={SCX} cy={430} rx={150} ry={54} fill={url(`${id}sp`)} />
      {[214, 386].map((x) => (
        <g key={`ka${x}`}>
          <path d={P`M${x - 11} 402C${x - 15} 392 ${x - 13} 382 ${x - 6} 378H${x + 6}C${x + 13} 382 ${x + 15} 392 ${x + 11} 402Z`} fill={url(`${id}m`)} />
          <rect x={x - 7} y={374} width={14} height={4} fill={url(`${id}m`)} />
          <path d={[-1, 1, -0.5, 0.5].map((s) => P`M${x} 374Q${x + s * 10} ${370} ${x + s * 16} ${376 - Math.abs(s) * 2}Q${x + s * 9} ${374} ${x} 374Z`).join('')} fill={leaf} />
          <ellipse cx={x} cy={368} rx={6} ry={7} fill={p.nature.clay} />
          <path d={P`M${x - 9} 392H${x + 9}`} stroke={c.accent} strokeWidth={1.4} opacity={0.8} />
        </g>
      ))}
      {flames.map(([x, y, s], k) =>
        s < 9 ? (
          <use key={`fl${k}`} href={`#${id}d`} x={x} y={y} />
        ) : (
          <g key={`fl${k}`}>
            <circle cx={x} cy={r2(y - s * 0.5)} r={r2(s * 1.1)} fill={url(`${id}g`)} />
            <FlameAt href={`${id}f`} x={x} y={y} s={s} />
          </g>
        ),
      )}
      {/* Cornice: the curved eave with its gavaksha arches. */}
      <path d={P`M0 104V96C120 84 480 84 ${SW} 96V104Z`} fill={lit} />
      <path d={P`M0 96C120 84 480 84 ${SW} 96`} stroke={p.light.rim} strokeWidth={1} opacity={0.4} fill="none" />
      <path d={P`M8.8 104V400M${SW - 8.8} 104V400`} stroke={p.light.rim} strokeWidth={1.2} opacity={0.45} />
    </Svg>
  );
}

// ─────────────────────────── BellMandap and BrassBell ───────────────────────────

const MW = MANDAP.w;
const MH = MANDAP.h;
const MCX = MW / 2;

/**
 * The bell pavilion (210×420): a two-step stone platform, four slender pillars
 * (the back pair darker, set in), bracket capitals under a carved beam with
 * the bell's hook, and a stepped stone roof with gilt edges, an amalaka and a
 * kalash. The bell itself is BrassBell, a piece of its own that swings.
 */
function BellMandap(p: DrawProps) {
  const c = p.colors;
  const id = kitId(p, 'bm');
  const stone = roseOf(p);
  const lit = tint(stone, 0.16);
  const line = shade(stone, 0.4);
  const pillar = (x: number, y0: number, y1: number, wd: number, back: boolean) => (
    <g key={`p${x}`} opacity={back ? 0.82 : 1}>
      <rect x={x - wd / 2 - 3} y={y1 - 26} width={wd + 6} height={26} fill={back ? shade(stone, 0.3) : url(`${id}s`)} />
      <rect x={x - wd / 2} y={y0 + 18} width={wd} height={y1 - y0 - 44} fill={back ? shade(stone, 0.3) : url(`${id}s`)} />
      {back ? null : <path d={P`M${x - wd * 0.2} ${y0 + 22}V${y1 - 28}M${x + wd * 0.2} ${y0 + 22}V${y1 - 28}`} stroke={line} strokeWidth={0.7} />}
      {[0.32, 0.58].map((t) => (
        <rect key={t} x={x - wd / 2 - 1.5} y={r2(y0 + (y1 - y0) * t)} width={wd + 3} height={5} fill={back ? shade(stone, 0.22) : lit} />
      ))}
      <path d={P`M${x - wd / 2 - 9} ${y0}H${x + wd / 2 + 9}L${x + wd / 2 + 2} ${y0 + 10}L${x + wd / 2} ${y0 + 18}H${x - wd / 2}L${x - wd / 2 - 2} ${y0 + 10}Z`} fill={back ? shade(stone, 0.26) : lit} />
    </g>
  );
  return (
    <Svg w={MW} h={MH}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(stone, 'far')} x1={0} x2={22} />
        <Lin id={`${id}r`} stops={[[0, shade(stone, 0.22)], [1, stone]]} y1={0} y2={104} />
        <Lin id={`${id}m`} stops={metalLit(c.secondary, 'far')} x1={0} x2={MW} />
      </defs>
      {/* Platform. */}
      <rect x={10} y={380} width={MW - 20} height={18} fill={stone} />
      <rect x={10} y={380} width={MW - 20} height={3} fill={lit} />
      <rect x={0} y={398} width={MW} height={22} fill={shade(stone, 0.1)} />
      <rect x={0} y={398} width={MW} height={3} fill={lit} />
      {pillar(56, 114, 376, 11, true)}
      {pillar(154, 114, 376, 11, true)}
      {pillar(28, 114, 382, 18, false)}
      {pillar(182, 114, 382, 18, false)}
      {/* Beam with dentils and the bell's hook. */}
      <rect x={6} y={100} width={MW - 12} height={16} fill={lit} />
      <path d={[...Array(16)].map((_, k) => P`M${12 + k * 12} 110h6v6h-6z`).join('')} fill={line} opacity={0.6} />
      <path d={P`M${MCX} 116v6`} stroke={url(`${id}m`)} strokeWidth={2.4} />
      {/* Stepped roof, gilt edges, amalaka and kalash. */}
      <path d={P`M-8 100L4 78H${MW - 4}L${MW + 8} 100Z`} fill={url(`${id}r`)} />
      <rect x={4} y={76} width={MW - 8} height={4} fill={lit} />
      <path d={P`M20 78L30 56H${MW - 30}L${MW - 20} 78Z`} fill={url(`${id}r`)} />
      <rect x={30} y={54} width={MW - 60} height={4} fill={lit} />
      <path d={P`M44 56L54 36H${MW - 54}L${MW - 44} 56Z`} fill={url(`${id}r`)} />
      <rect x={54} y={34} width={MW - 108} height={3} fill={lit} />
      <path d={P`M-8 100H${MW + 8}M20 78H${MW - 20}M44 56H${MW - 44}`} stroke={url(`${id}m`)} strokeWidth={2} />
      <ellipse cx={MCX} cy={30} rx={26} ry={6} fill={stone} />
      <path d={[...Array(9)].map((_, k) => P`M${MCX - 22 + k * 5.5} 25V35`).join('')} stroke={line} strokeWidth={1} />
      <path d={P`M${MCX - 9} 24C${MCX - 12} 16 ${MCX - 7} 10 ${MCX} 10C${MCX + 7} 10 ${MCX + 12} 16 ${MCX + 9} 24ZM${MCX - 2} 10V2H${MCX + 2}V10Z`} fill={url(`${id}m`)} />
      <path d={P`M-7.2 100L4.6 78.4M${MW + 7.2} 100L${MW - 4.6} 78.4M19 380V116M${MW - 19} 380V116`} stroke={p.light.rim} strokeWidth={1.1} opacity={0.5} />
    </Svg>
  );
}

/**
 * The pavilion's brass bell (64×250): a chain of links, the bell with its
 * crown loop, bands and flared lip in the key-lit gold, the clapper, and the
 * red cord a devotee pulls, ending in a gold tassel. It hangs from its top.
 */
function BrassBell(p: DrawProps) {
  const c = p.colors;
  const id = kitId(p, 'bb');
  const cx = BELL.w / 2;
  const cord = mix(c.primary, '#b3261e', 0.45);
  return (
    <Svg w={BELL.w} h={BELL.h}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, 'far')} x1={cx - 30} x2={cx + 30} />
      </defs>
      <path d={[...Array(5)].map((_, k) => P`M${cx} ${k * 7.2}m0 0a${k % 2 ? 1.4 : 2.6} 3.8 0 1 0 .1 0`).join('')} fill="none" stroke={url(`${id}m`)} strokeWidth={1.6} />
      <path d={P`M${cx - 4} 44a4 6 0 1 1 8 0`} fill="none" stroke={url(`${id}m`)} strokeWidth={2.4} />
      <path d={P`M${cx - 10} 44C${cx - 20} 47 ${cx - 22} 72 ${cx - 25} 96L${cx - 30} 104H${cx + 30}L${cx + 25} 96C${cx + 22} 72 ${cx + 20} 47 ${cx + 10} 44Z`} fill={url(`${id}m`)} />
      <path d={P`M${cx - 18} 58H${cx + 18}M${cx - 24} 90H${cx + 24}`} stroke={shade(c.secondary, 0.4)} strokeWidth={1.4} />
      <path d={P`M${cx - 30} 104H${cx + 30}`} stroke={shade(c.secondary, 0.5)} strokeWidth={2.4} />
      <path d={P`M${cx - 8} 50C${cx - 14} 60 ${cx - 15} 78 ${cx - 16} 92`} stroke={tint(c.secondary, 0.6)} strokeWidth={2} fill="none" opacity={0.75} />
      <circle cx={cx} cy={110} r={4.5} fill={url(`${id}m`)} />
      <path d={P`M${cx} 114C${cx + 3} 150 ${cx - 3} 190 ${cx} 232`} stroke={cord} strokeWidth={3} fill="none" />
      <path d={P`M${cx} 114C${cx + 3} 150 ${cx - 3} 190 ${cx} 232`} stroke={tint(cord, 0.35)} strokeWidth={3} strokeDasharray="2 4" fill="none" />
      <path d={P`M${cx - 3} 230H${cx + 3}L${cx + 6} 250H${cx - 6}Z`} fill={url(`${id}m`)} />
    </Svg>
  );
}

// ─────────────────────────── PrakaraWall ───────────────────────────

/**
 * The courtyard wall (a back plane, 4400×240): rose stone in the dusk shadow,
 * a coping with a crest of small stepped merlons rimmed by the afterglow,
 * mouldings, and the deepamala: a long row of arched niches, a lit diya in
 * each with its glow. Repeats through <pattern>s, so the markup stays small.
 */
function PrakaraWall(p: DrawProps) {
  const id = kitId(p, 'pw');
  const stone = shade(roseOf(p), 0.12);
  const lit = tint(stone, 0.12);
  const line = shade(stone, 0.4);
  const { w, h } = p;
  return (
    <Svg w={w} h={h}>
      <defs>
        <Lin id={`${id}s`} stops={[[0, shade(stone, 0.18)], [0.6, stone], [1, mix(stone, p.nature.flame, 0.1)]]} y1={0} y2={h} />
        <Glow id={`${id}g`} color={p.nature.flame} core={p.nature.flameCore} a={0.75} />
        <pattern id={`${id}n`} patternUnits="userSpaceOnUse" x={0} y={0} width={64} height={h}>
          <path d="M20 152V112C20 98 44 98 44 112V152Z" fill={shade(mix(stone, p.nature.clayDark, 0.3), 0.4)} />
          <circle cx={32} cy={136} r={15} fill={url(`${id}g`)} />
          <path d="M27 150Q32 153 37 150Z" fill={p.nature.clay} />
          <path d="M32 136C34.5 141 35 145 32 149C29 145 29.5 141 32 136Z" fill={p.nature.flame} />
          <path d="M32 142C33 145 33 147 32 149C31 147 31 145 32 142Z" fill={p.nature.flameCore} />
          <rect x={16} y={152} width={32} height={4} fill={lit} />
        </pattern>
        <pattern id={`${id}m`} patternUnits="userSpaceOnUse" x={0} y={0} width={32} height={24}>
          <path d="M6 24V14H10V8H22V14H26V24Z" fill={stone} />
          <path d="M10 8H22" stroke={p.light.rim} strokeWidth={1} opacity={0.45} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={w} height={24} fill={`url(#${id}m)`} />
      <rect x={0} y={22} width={w} height={h - 22} fill={url(`${id}s`)} />
      <rect x={0} y={22} width={w} height={12} fill={lit} />
      <path d={`M0 22.6H${w}`} stroke={p.light.rim} strokeWidth={1.2} opacity={0.4} />
      <rect x={0} y={62} width={w} height={4} fill={line} opacity={0.5} />
      <rect x={0} y={88} width={w} height={74} fill={`url(#${id}n)`} />
      <rect x={0} y={176} width={w} height={4} fill={lit} />
      <rect x={0} y={204} width={w} height={h - 204} fill={shade(stone, 0.18)} />
    </Svg>
  );
}

// ─────────────────────────── CrownToran ───────────────────────────

/**
 * A mango-leaf toran hung near overhead (1000×70): a gold cord in shallow
 * swags, mango leaves hanging along it, marigold balls at each dip and a short
 * marigold tassel at each crest. Only its lower half shows at the top of a
 * phone; it frames the sky without touching the words.
 */
function CrownToran(p: DrawProps) {
  const id = kitId(p, 'ct');
  const { w } = p;
  const swags = 8;
  const sw = w / swags;
  const mari = marigoldOf(p);
  const leaves: string[] = [];
  const darkLeaves: string[] = [];
  const balls: Array<[number, number, number]> = [];
  let cord = `M0 30`;
  for (let i = 0; i < swags; i++) {
    const x0 = i * sw;
    const seg: Segment = [[x0, 30], [x0 + sw * 0.3, 42], [x0 + sw * 0.7, 42], [x0 + sw, 30]];
    cord += P`C${x0 + sw * 0.3} 42 ${x0 + sw * 0.7} 42 ${x0 + sw} 30`;
    for (let k = 1; k < 6; k++) {
      const { x, y } = onCubic(seg, k / 6);
      const len = 22 + (k % 2) * 5;
      const lean = (k - 3) * 0.8;
      const d = P`M${x - 3.2} ${y}C${x - 6} ${y + len * 0.4} ${x - 2 + lean} ${y + len * 0.8} ${x + lean} ${y + len}C${x + 2 + lean} ${y + len * 0.8} ${x + 6} ${y + len * 0.4} ${x + 3.2} ${y}Z`;
      (k % 2 ? leaves : darkLeaves).push(d);
    }
    balls.push([x0 + sw / 2, 44, 6.5]);
    balls.push([x0, 36, 5], [x0, 46, 4.6], [x0, 55, 4.2]);
  }
  return (
    <Svg w={w} h={TORAN.h}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(p.colors.secondary, 'far')} x1={0} x2={w} />
      </defs>
      <path d={darkLeaves.join('')} fill={p.nature.leafDark} />
      <path d={leaves.join('')} fill={p.nature.leaf} />
      <path d={cord} fill="none" stroke={url(`${id}m`)} strokeWidth={2.2} />
      <path d={balls.map(([x, y, r]) => P`M${x} ${y - r}a${r} ${r} 0 1 0 .1 0`).join('')} fill={mari} />
      <path d={balls.map(([x, y, r]) => P`M${x - r * 0.4} ${y - r * 0.2}a${r * 0.45} ${r * 0.45} 0 1 0 .1 0`).join('')} fill={tint(mari, 0.35)} />
    </Svg>
  );
}

// ─────────────────────────── the lamps ───────────────────────────

/** A pair of brass kuthuvilakku either side of the path, one piece: `gap` apart, each w×h. */
const LAMPS = { gap: 240, w: 50, h: 150 } as const;

/**
 * Two brass kuthuvilakku (one piece, a lamp at either end of its box): a
 * stepped round foot, a tall stem with turned knops, the wide five-wick bowl
 * with three flames to the front, and a swan (annam) finial. One lamp is drawn
 * once in <defs> and used twice.
 */
function LampPair(p: DrawProps) {
  const c = p.colors;
  const id = kitId(p, 'lp');
  const W = LAMPS.gap + LAMPS.w;
  const H = LAMPS.h;
  const x = LAMPS.w / 2;
  const line = shade(c.secondary, 0.5);
  const m = url(`${id}m`);
  return (
    <Svg w={W} h={H}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, 'far')} x1={0} x2={LAMPS.w} />
        <Glow id={`${id}g`} color={p.nature.flame} core={p.nature.flameCore} a={0.55} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
        <g id={`${id}l`}>
          <ellipse cx={x} cy={36} rx={30} ry={20} fill={url(`${id}g`)} />
          <path d={P`M${x - 22} ${H}H${x + 22}L${x + 18} ${H - 6}H${x - 18}ZM${x - 13} ${H - 6}H${x + 13}L${x + 8} ${H - 14}H${x - 8}Z`} fill={m} stroke={line} strokeWidth={0.5} />
          <rect x={x - 2.2} y={44} width={4.4} height={H - 58} fill={m} />
          <path d={[66, 92, 118].map((y) => P`M${x - 5.5} ${y}a5.5 3 0 1 0 11 0a5.5 3 0 1 0 -11 0`).join('')} fill={m} stroke={line} strokeWidth={0.4} />
          <path d={P`M${x - 21} 38Q${x} 52 ${x + 21} 38Z`} fill={m} stroke={line} strokeWidth={0.5} />
          <ellipse cx={x} cy={38} rx={21} ry={2.2} fill={tint(c.secondary, 0.4)} />
          <path d={P`M${x - 1.4} 38V20H${x + 1.4}V38ZM${x - 5} 20C${x - 7} 12 ${x - 2} 6 ${x + 2} 8C${x + 5} 2 ${x + 9} 4 ${x + 7} 9C${x + 5} 12 ${x + 3} 14 ${x + 5} 20Z`} fill={m} />
          {[-15, 0, 15].map((dx) => (
            <FlameAt key={dx} href={`${id}f`} x={x + dx} y={37} s={dx ? 10 : 12} skew={dx * -0.3} />
          ))}
        </g>
      </defs>
      <use href={`#${id}l`} />
      <use href={`#${id}l`} x={LAMPS.gap} />
    </Svg>
  );
}

/**
 * A marigold strand (20×190) hung at the sanctum's door: alternating orange
 * and yellow-orange balls on a thread, two mango leaves at the top and a
 * small gold tassel at the foot.
 */
function MarigoldStrand(p: DrawProps) {
  const id = kitId(p, 'ms');
  const mari = marigoldOf(p);
  const gold = mix(mari, p.nature.flameCore, 0.35);
  const balls = [...Array(13)].map((_, k) => [10, 22 + k * 12.4, k % 3 === 2 ? 5.4 : 6.4] as const);
  const ring = (list: ReadonlyArray<readonly [number, number, number]>) => list.map(([x, y, r]) => P`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`).join('');
  return (
    <Svg w={20} h={190}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(p.colors.secondary, 'far')} x1={0} x2={20} />
      </defs>
      <path d="M10 0V184" stroke={shade(mari, 0.4)} strokeWidth={0.8} />
      <path d="M10 6C3 8 0 14 1 22C5 18 8 13 10 6ZM10 6C17 8 20 14 19 22C15 18 12 13 10 6Z" fill={p.nature.leaf} />
      <path d={ring(balls.filter((_, k) => k % 2 === 0))} fill={mari} />
      <path d={ring(balls.filter((_, k) => k % 2 === 1))} fill={gold} />
      <path d={ring(balls.map(([x, y, r]) => [x - r * 0.35, y - r * 0.35, r * 0.35] as const))} fill={tint(gold, 0.4)} opacity={0.7} />
      <path d="M8 178H12L14 190H6Z" fill={url(`${id}m`)} />
    </Svg>
  );
}

/** Eight unit directions (a table, no trigonometry), for the lotus medallions' petals. */
const DIR8: ReadonlyArray<readonly [number, number]> = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];

/**
 * A carved basalt pillar of the courtyard's gateway (84 wide, floor to lintel), the Dravidian order the temple's own
 * mandapas use: a moulded plinth; a shaft of square blocks (sadura), each carved with an eight-petalled lotus in
 * relief, between chamfered octagonal lengths (kattu) whose facets catch the lamps on the side toward the axis; a
 * capital of pot (kalasha), lotus (padma) and abacus (palagai) under drooping-bud brackets (pushpa potika) that carry
 * the lintel. Dark and backlit, it frames desktops and the far pose as a silhouette, quiet above the eye line.
 */
function GatePost(p: DrawProps & { inner: 'left' | 'right' }) {
  const id = kitId(p, `gp${p.inner[0]}`);
  const { w, h } = p;
  const basalt = mix(shade(roseOf(p), 0.5), '#120a0c', 0.25);
  const face = tint(basalt, 0.07);
  const dark = shade(basalt, 0.35);
  const carve = shade(basalt, 0.5);
  const warm = mix(LAMP, p.light.rim, 0.4);
  const k = w / 84;
  const cx = w / 2;
  const s0 = 16 * k;
  const s1 = w - 16 * k;
  const sw = s1 - s0;
  const eye = p.eyeLine ?? 0;
  /** The lit edge: the facet toward the axis. */
  const litX = p.inner === 'right' ? s1 : s0;
  const capY = 64 * k;
  const footY = h - 96 * k;
  // The shaft from the capital down to the plinth: blocks and octagonal lengths alternating.
  const span = footY - capY;
  const blocks = [0, 0.27, 0.54, 0.81].map((t) => capY + span * t);
  const blockH = 74 * k;
  const lotus = (y: number) => {
    const c0 = y + blockH / 2;
    // Almond petals: from the seed pod out to a point, swelling between (two quadratics through side controls).
    const petals = DIR8.map(([ux, uy]) => {
      const at = (r: number, s: number) => `${r2(cx + (ux * r - uy * s) * k)} ${r2(c0 + (uy * r + ux * s) * k)}`;
      return `M${at(5, 0)}Q${at(13, 7.5)} ${at(21, 0)}Q${at(13, -7.5)} ${at(5, 0)}Z`;
    }).join('');
    return { petals, c0 };
  };
  return (
    <Svg w={w} h={h}>
      <defs>
        <Lin id={`${id}s`} stops={p.inner === 'right' ? [[0, dark], [0.55, basalt], [0.82, face], [1, mix(face, warm, 0.3)]] : [[0, mix(face, warm, 0.3)], [0.18, face], [0.45, basalt], [1, dark]]} x1={s0} x2={s1} />
      </defs>
      {/* Brackets and abacus under the lintel. */}
      <rect x={0} y={0} width={w} height={14 * k} fill={dark} />
      <path d={P`M0 ${14 * k}H${w}V${24 * k}H${w - 6 * k}C${w - 10 * k} ${36 * k} ${w - 14 * k} ${40 * k} ${w - 18 * k} ${46 * k}H${18 * k}C${14 * k} ${40 * k} ${10 * k} ${36 * k} ${6 * k} ${24 * k}H0Z`} fill={url(`${id}s`)} />
      <path d={P`M${6 * k} ${30 * k}a${3.4 * k} ${3.4 * k} 0 1 0 .1 0M${w - 6 * k} ${30 * k}a${3.4 * k} ${3.4 * k} 0 1 0 .1 0`} fill={face} />
      {/* The capital: palagai, padma, kalasha. */}
      <rect x={s0 - 10 * k} y={46 * k} width={sw + 20 * k} height={8 * k} fill={face} />
      <path d={P`M${s0 - 6 * k} ${54 * k}H${s1 + 6 * k}C${s1 + 2 * k} ${60 * k} ${s1} ${62 * k} ${s1 - 2 * k} ${capY}H${s0 + 2 * k}C${s0} ${62 * k} ${s0 - 2 * k} ${60 * k} ${s0 - 6 * k} ${54 * k}Z`} fill={url(`${id}s`)} />
      {/* The shaft. */}
      <rect x={s0} y={capY} width={sw} height={span} fill={url(`${id}s`)} />
      <path d={P`M${s0 + 9 * k} ${capY}V${footY}M${s1 - 9 * k} ${capY}V${footY}`} stroke={carve} strokeWidth={1.2 * k} opacity={0.75} />
      {blocks.map((y, i) => {
        const { petals, c0 } = lotus(y);
        return (
          <g key={i}>
            <rect x={s0 - 3 * k} y={y} width={sw + 6 * k} height={blockH} fill={url(`${id}s`)} />
            <path d={P`M${s0 - 3 * k} ${y + 0.6 * k}H${s1 + 3 * k}M${s0 - 3 * k} ${y + blockH - 0.6 * k}H${s1 + 3 * k}`} stroke={carve} strokeWidth={1.4 * k} />
            <path d={P`M${cx - 23 * k} ${c0}a${23 * k} ${23 * k} 0 1 0 ${46 * k} 0a${23 * k} ${23 * k} 0 1 0 ${-46 * k} 0`} fill={carve} opacity={0.55} />
            <path d={petals} fill={face} stroke={carve} strokeWidth={0.9 * k} />
            <path d={P`M${cx - 4.6 * k} ${c0}a${4.6 * k} ${4.6 * k} 0 1 0 ${9.2 * k} 0a${4.6 * k} ${4.6 * k} 0 1 0 ${-9.2 * k} 0`} fill={carve} />
            {/* the chamfers where the block meets the octagon below */}
            {i < blocks.length - 1 ? <path d={P`M${s0 - 3 * k} ${y + blockH}L${s0 + 9 * k} ${y + blockH + 12 * k}M${s1 + 3 * k} ${y + blockH}L${s1 - 9 * k} ${y + blockH + 12 * k}`} stroke={carve} strokeWidth={1.2 * k} /> : null}
          </g>
        );
      })}
      {/* The plinth's mouldings. */}
      <path d={P`M${s0 - 8 * k} ${footY}H${s1 + 8 * k}V${footY + 22 * k}H${s0 - 8 * k}ZM${s0 - 14 * k} ${footY + 30 * k}H${s1 + 14 * k}V${h - 20 * k}H${s0 - 14 * k}Z`} fill={url(`${id}s`)} />
      <path d={P`M${s0 - 4 * k} ${footY + 22 * k}H${s1 + 4 * k}L${s1 + 10 * k} ${footY + 30 * k}H${s0 - 10 * k}Z`} fill={face} />
      <rect x={0} y={h - 20 * k} width={w} height={20 * k} fill={dark} />
      {/* The lamps' warmth on the facet toward the axis. */}
      <path d={P`M${litX} ${capY}V${footY + 22 * k}`} stroke={warm} strokeWidth={1.6 * k} opacity={0.55} />
      {eye > capY ? <rect x={s0 - 3 * k} y={capY} width={sw + 6 * k} height={Math.min(eye, footY) - capY} fill={dark} opacity={0.4} /> : null}
    </Svg>
  );
}

// ─────────────────────────── DuskSky ───────────────────────────

/** The sky's content box: the frame plus 30% overscan, the frame's origin at (360, 240), the horizon at 680. */
const SKY = { w: 1920, h: 1280, fx: 360, fy: 240, hz: 680 } as const;
/** Long thin clouds (box x, y, rx, ry) either side of the story column. */
const CLOUDS: ReadonlyArray<readonly [number, number, number, number]> = [[110, 560, 250, 5], [440, 592, 290, 4], [300, 624, 170, 3], [1460, 548, 280, 5], [1720, 606, 210, 4]];

/**
 * The dusk sky (a sky plane, frame coordinates): deep maroon overhead falling
 * through rose to a saffron afterglow on the horizon, left of the axis where
 * the sun went down; long thin clouds lit from below; stars and the evening
 * star beside the story column; birds flying home; coconut palms and a far
 * treeline low on the horizon; and on the axis the shikhara behind the sanctum,
 * backlit and hazed (quiet): curved courses, two lesser spires, the amalaka,
 * kalash and the saffron dhwaja. Drawn in the template's own colours (`colors`,
 * not hazed: the afterglow is the light of the scene).
 */
function DuskSky(p: DrawProps & { sky: DrawProps['colors'] }) {
  const c = p.sky;
  const id = kitId(p, 'ds');
  const { fx, fy, hz } = SKY;
  const X = (x: number) => x + fx;
  const top = mix(c.primary, '#000000', 0.62);
  const high = mix(c.primary, '#000000', 0.34);
  const rose = mix(mix(c.primary, c.accent, 0.3), '#d0607a', 0.18);
  const glow = mix(c.accent, LAMP, 0.45);
  const sil = mix(mix(c.primary, '#000000', 0.4), rose, 0.3);
  const silFar = mix(sil, rose, 0.35);
  const rim = mix(glow, '#ffffff', 0.2);
  const stars: string[] = [];
  for (let i = 0; i < 26; i++) {
    const right = i % 2 === 1;
    const x = right ? X(800 + rand(i, 41) * 760) : X(-360 + rand(i, 42) * 760);
    const f = rand(i, 43);
    const y = 20 + f * f * 380;
    const r = 0.8 + rand(i, 44) * 1.5;
    stars.push(P`M${x} ${y - r}a${r} ${r} 0 1 0 .1 0`);
  }
  const star = (x: number, y: number, r: number) => P`M${x} ${y - r * 4}L${x + r * 0.7} ${y - r * 0.7}L${x + r * 4} ${y}L${x + r * 0.7} ${y + r * 0.7}L${x} ${y + r * 4}L${x - r * 0.7} ${y + r * 0.7}L${x - r * 4} ${y}L${x - r * 0.7} ${y - r * 0.7}Z`;
  const birds = [[905, 236, 9], [930, 222, 7], [952, 244, 8], [884, 254, 6], [1000, 210, 6]].map(([x, y, s]) => P`M${X(x!) - s!} ${fy + y! - s! * 0.5}Q${X(x!) - s! * 0.4} ${fy + y! - s! * 0.7} ${X(x!)} ${fy + y!}Q${X(x!) + s! * 0.4} ${fy + y! - s! * 0.7} ${X(x!) + s!} ${fy + y! - s! * 0.5}Q${X(x!) + s! * 0.4} ${fy + y! - s! * 0.3} ${X(x!)} ${fy + y! + s! * 0.25}Q${X(x!) - s! * 0.4} ${fy + y! - s! * 0.3} ${X(x!) - s!} ${fy + y! - s! * 0.5}Z`).join('');
  /** A curvilinear spire: base half width hw at the horizon, apex h above it. */
  /** A rekha (curvilinear) spire: upright at its foot, curving in toward a narrow neck under the amalaka. */
  const spire = (x: number, hw: number, h: number) =>
    P`M${x - hw} ${hz + 4}L${x - hw * 0.98} ${hz - h * 0.28}C${x - hw * 0.93} ${hz - h * 0.66} ${x - hw * 0.62} ${hz - h * 0.94} ${x - hw * 0.26} ${hz - h}H${x + hw * 0.26}C${x + hw * 0.62} ${hz - h * 0.94} ${x + hw * 0.93} ${hz - h * 0.66} ${x + hw * 0.98} ${hz - h * 0.28}L${x + hw} ${hz + 4}Z`;
  /** The spire's half width at height fraction f (its profile, for the courses and their corner amalakas). */
  const halfAt = (hw: number, f: number) => hw * (f < 0.28 ? 1 : 1 - 0.74 * ((f - 0.28) / 0.72) ** 1.6);
  const courses = (x: number, hw: number, h: number, n: number) =>
    [...Array(n)].map((_, k) => {
      const f = (k + 1) / (n + 1);
      const w = halfAt(hw, f);
      return P`M${x - w} ${hz - h * f}Q${x} ${hz - h * f - 3} ${x + w} ${hz - h * f}`;
    }).join('');
  /** The bhumi-amalakas: a ribbed disc at each storey's corners, which bead the spire's outline. */
  const beads = (x: number, hw: number, h: number, n: number) =>
    [...Array(n)].map((_, k) => {
      const f = (k + 1) / (n + 1);
      const w = halfAt(hw, f);
      const r = 2.2 + (1 - f) * 1.6;
      return P`M${x - w - r} ${hz - h * f}a${r} ${r * 0.62} 0 1 0 ${2 * r} 0a${r} ${r * 0.62} 0 1 0 ${-2 * r} 0M${x + w - r} ${hz - h * f}a${r} ${r * 0.62} 0 1 0 ${2 * r} 0a${r} ${r * 0.62} 0 1 0 ${-2 * r} 0`;
    }).join('');
  /** The central offset (lata) running up the face: a band narrowing with the spire. */
  const lata = (x: number, hw: number, h: number) => P`M${x - hw * 0.24} ${hz + 4}L${x - hw * 0.23} ${hz - h * 0.3}C${x - hw * 0.21} ${hz - h * 0.7} ${x - hw * 0.16} ${hz - h * 0.95} ${x - hw * 0.12} ${hz - h}H${x + hw * 0.12}C${x + hw * 0.16} ${hz - h * 0.95} ${x + hw * 0.21} ${hz - h * 0.7} ${x + hw * 0.23} ${hz - h * 0.3}L${x + hw * 0.24} ${hz + 4}Z`;
  const C = X(600);
  const H = 108;
  const HW = 40;
  const palm = (x: number, h: number, lean: number) => {
    const trunk: Segment = [[x, hz + 2], [x + lean * 0.2, hz - h * 0.4], [x + lean * 0.7, hz - h * 0.8], [x + lean, hz - h]];
    const tip = onCubic(trunk, 1);
    const fronds = [[-34, 10], [-24, -6], [-8, -14], [10, -12], [26, -4], [34, 12]].map(([dx, dy]) => P`M${tip.x} ${tip.y}Q${tip.x + dx! * 0.5} ${tip.y + dy! - 8} ${tip.x + dx!} ${tip.y + dy! + 6}Q${tip.x + dx! * 0.55} ${tip.y + dy! - 2} ${tip.x} ${tip.y + 2}Z`).join('');
    return P`M${x - 2.4} ${hz + 2}C${x + lean * 0.2 - 2} ${hz - h * 0.4} ${x + lean * 0.7 - 1.4} ${hz - h * 0.8} ${tip.x - 1.2} ${tip.y}H${tip.x + 1.2}C${x + lean * 0.7 + 1.4} ${hz - h * 0.8} ${x + lean * 0.2 + 2} ${hz - h * 0.4} ${x + 2.4} ${hz + 2}Z` + fronds;
  };
  const trees = (x0: number, x1: number, salt: number) => {
    let d = P`M${x0} ${hz + 4}`;
    for (let x = x0, i = 0; x < x1; i++) {
      const w = 16 + rand(i, salt) * 18;
      const h = 5 + rand(i, salt + 1) * 9;
      d += P`Q${x + w / 2} ${hz - h * 2} ${x + w} ${hz - h * 0.5}`;
      x += w;
    }
    return d + P`L${x1} ${hz + 4}Z`;
  };
  return (
    <Svg w={SKY.w} h={SKY.h}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, top], [0.22, top], [0.36, high], [0.47, rose], [0.52, glow], [hz / SKY.h, tint(glow, 0.2)], [0.56, mix(c.primary, '#000000', 0.45)], [1, mix(c.primary, '#000000', 0.55)]]} y1={0} y2={SKY.h} />
        <Lin id={`${id}l`} stops={[[0, mix(silFar, glow, 0.35)], [0.12, mix(sil, glow, 0.12)], [1, mix(c.primary, '#000000', 0.55)]]} y1={hz} y2={SKY.h} />
        <radialGradient id={`${id}a`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={tint(glow, 0.35)} stopOpacity={0.75} />
          <stop offset="0.45" stopColor={glow} stopOpacity={0.32} />
          <stop offset="1" stopColor={glow} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={SKY.w} height={SKY.h} fill={url(`${id}g`)} />
      <ellipse cx={X(330)} cy={hz} rx={900} ry={190} fill={url(`${id}a`)} />
      <rect x={0} y={hz} width={SKY.w} height={SKY.h - hz} fill={url(`${id}l`)} />
      {/* Long clouds lit from below. */}
      {/* (beside the story column only, box x 775–1145: a band of cloud behind the names reads as a rule through them) */}
      <path d={CLOUDS.map(([x, y, rx, ry]) => P`M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`).join('')} fill={mix(rose, high, 0.45)} opacity={0.5} />
      <path d={CLOUDS.map(([x, y, rx]) => P`M${x - rx * 0.85} ${y + 1}Q${x} ${y + 4} ${x + rx * 0.85} ${y + 1}`).join('')} stroke={glow} strokeWidth={1.2} opacity={0.32} fill="none" />
      <path d={stars.join('')} fill={tint(c.accent, 0.6)} opacity={0.8} />
      <path d={star(X(270), fy + 130, 2.2) + star(X(1010), fy + 60, 1.4)} fill={tint(c.accent, 0.75)} />
      <circle cx={X(270)} cy={fy + 130} r={14} fill={url(`${id}a`)} />
      <path d={birds} fill={sil} opacity={0.75} />
      {/* The far horizon: treelines and coconut palms either side of the column. */}
      <path d={trees(0, X(330), 61) + trees(X(870), SKY.w, 63)} fill={silFar} />
      <path d={palm(X(250), 74, 10) + palm(X(196), 58, -12) + palm(X(330), 52, 8) + palm(X(905), 70, -10) + palm(X(968), 56, 12) + palm(X(1100), 66, -6)} fill={sil} />
      {/* The shikhara on the axis, backlit. */}
      {/* the urushringas clustered on its flanks (lesser spires climbing it), then the main spire */}
      <path d={spire(C - 50, 14, 34) + spire(C + 50, 14, 34)} fill={mix(silFar, rose, 0.2)} />
      <path d={spire(C - 32, 21, 70) + spire(C + 32, 21, 70)} fill={silFar} />
      <path d={beads(C - 32, 21, 70, 5) + beads(C + 32, 21, 70, 5)} fill={silFar} />
      <path d={spire(C, HW, H)} fill={sil} />
      <path d={beads(C, HW, H, 9)} fill={sil} />
      <path d={lata(C, HW, H)} fill={mix(sil, rose, 0.16)} />
      <path d={courses(C, HW, H, 9) + courses(C - 32, 21, 70, 5) + courses(C + 32, 21, 70, 5)} stroke={mix(sil, rose, 0.4)} strokeWidth={1.2} fill="none" />
      <ellipse cx={C} cy={hz - H - 4} rx={15} ry={4.4} fill={sil} />
      <path d={[...Array(7)].map((_, k) => P`M${C - 12 + k * 4} ${hz - H - 7.6}V${hz - H - 0.6}`).join('')} stroke={mix(sil, rose, 0.4)} strokeWidth={1} />
      <path d={P`M${C - 6} ${hz - H - 8}C${C - 8} ${hz - H - 14} ${C - 4} ${hz - H - 18} ${C} ${hz - H - 18}C${C + 4} ${hz - H - 18} ${C + 8} ${hz - H - 14} ${C + 6} ${hz - H - 8}Z`} fill={sil} />
      <path d={P`M${C} ${hz - H - 18}V${hz - H - 40}`} stroke={sil} strokeWidth={1.6} />
      <path d={P`M${C} ${hz - H - 40}L${C + 18} ${hz - H - 35}L${C + 4} ${hz - H - 31}L${C} ${hz - H - 29}Z`} fill={mix(mix(c.accent, LAMP, 0.3), sil, 0.5)} />
      <path d={spire(C, HW, H)} stroke={rim} strokeWidth={1.2} opacity={0.35} fill="none" />
    </Svg>
  );
}

/**
 * The courtyard's stone floor at dusk: the kit's temple stone and rangoli in
 * the palette's colours deepened toward the stock (only the baked lamp pools
 * stay bright), with a dark vignette toward the sides that frames desktops.
 */
function duskFloor(p: DrawProps): ReactNode {
  const c = p.colors;
  const stone = mix(mix(c.surface, c.primary, 0.5), '#000000', 0.32);
  const colors = { ...c, surface: stone, secondary: mix(c.secondary, '#000000', 0.25), muted: mix(c.muted, '#000000', 0.3), background: mix(c.background, c.primary, 0.4) };
  const id = kitId(p, 'df');
  const g = p.plane;
  // The axis in content units (x 600 in the world); the vignette clears over the story column.
  const ax = g ? 600 - g.x0 : p.w / 2;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {createElement(Floor, {
        ...p,
        colors,
        variant: 'templeStone',
        rangoli: true,
        pools: [
          { x: TOWER.x, d: TOWER.d, r: 320, color: LAMP },
          { x: 600, d: SANCTUM.d - 20, r: 340, color: DOOR },
          { x: 480, d: 1100, r: 120, color: LAMP },
          { x: 720, d: 1100, r: 120, color: LAMP },
          { x: 480, d: 1750, r: 90, color: LAMP },
          { x: 720, d: 1750, r: 90, color: LAMP },
          { x: MANDAP.x, d: MANDAP.d, r: 150, color: LAMP },
        ],
      })}
      <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <linearGradient id={`${id}v`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={r2(p.w)} y2={0}>
            <stop offset={0} stopColor={c.primary} stopOpacity={0.85} />
            <stop offset={r2(Math.max(0, (ax - 1100) / p.w))} stopColor={mix(c.primary, '#000000', 0.4)} stopOpacity={0.55} />
            <stop offset={r2((ax - 420) / p.w)} stopColor={mix(c.primary, '#000000', 0.4)} stopOpacity={0} />
            <stop offset={r2((ax + 420) / p.w)} stopColor={mix(c.primary, '#000000', 0.4)} stopOpacity={0} />
            <stop offset={r2(Math.min(1, (ax + 1100) / p.w))} stopColor={mix(c.primary, '#000000', 0.4)} stopOpacity={0.55} />
            <stop offset={1} stopColor={c.primary} stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={r2(p.w)} height={r2(p.h)} fill={url(`${id}v`)} />
      </svg>
    </div>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const deepstambh: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const pieces: Piece[] = [];
  const towerTop = 800 - TOWER.h;
  const lampTop = 800 - 150;

  // Planes: the dusk sky with the shikhara, the courtyard wall's deepamala, the stone floor and its rangoli.
  pieces.push({ kind: 'plane', id: 'sky', art: 'duskSky', role: 'sky', quiet: true, plane: sky({ d: perspectiveOf(60) * 4.33 }), draw: (p) => createElement(DuskSky, { ...p, sky: c }) });
  pieces.push({ kind: 'plane', id: 'prakara', art: 'prakaraWall', role: 'architecture', plane: back({ x0: WALL.x0, x1: WALL.x1, yTop: WALL.yTop, d: WALL.d }), draw: PrakaraWall });
  pieces.push({
    kind: 'plane',
    id: 'floor',
    art: 'floor:templeStone',
    role: 'architecture',
    plane: floor({ x0: -1500, x1: 2700, dNear: 40, dFar: WALL.d + 20 }),
    draw: duskFloor,
  });

  // Focal: the sanctum front on the axis, its door garlands swaying.
  pieces.push({ kind: 'prop', id: 'sanctum', art: 'sanctumFront', role: 'focal', ...billboard({ x: 600, d: SANCTUM.d, w: SANCTUM.w, h: SANCTUM.h }), draw: SanctumFront });
  for (const [i, x] of [
    [0, 507],
    [1, 693],
  ] as const)
    pieces.push({
      kind: 'prop',
      id: `strand-${i}`,
      art: 'marigoldStrand',
      role: 'hanging',
      ...hang({ x, d: SANCTUM.d - 12, w: 20, h: 190, top: 800 - SANCTUM.h + 122 }),
      draw: MarigoldStrand,
      motion: { kind: 'sway', amp: 1.5, period: 6, phase: i * 0.45 },
      buildIn: 'drop',
    });
  pieces.push({ kind: 'light', id: 'sanctum-glow', art: 'glow', role: 'light', at: { x: 600, y: 640, z: -(SANCTUM.d - 14) }, r: 160, color: DOOR, strength: 0.6, motion: { kind: 'pulse', amp: 0.5, period: 3.2 }, buildIn: 'bloom' });

  // The deepastambha, left of the axis: its body and two halo layers flaring out of step.
  pieces.push({ kind: 'prop', id: 'tower', art: 'lampTower', role: 'prop', ...billboard({ x: TOWER.x, d: TOWER.d, w: TOWER.w, h: TOWER.h }), draw: drawWith(LampTower, { part: 'body' as const }), buildIn: 'rise' });
  for (const half of [0, 1] as const)
    pieces.push({
      kind: 'prop',
      id: `tower-halo-${half}`,
      art: 'lampTower:halo',
      role: 'light',
      ...hang({ x: TOWER.x, d: TOWER.d - 2 - half, w: TOWER.w, h: TOWER.h, top: towerTop }),
      draw: drawWith(LampTower, { part: 'halo' as const, half }),
      motion: { kind: 'twinkle', amp: 0.75, period: 1.3 + half * 0.4, phase: half * 0.5 },
      buildIn: 'light',
    });
  pieces.push({
    kind: 'light',
    id: 'tower-glow',
    art: 'glow',
    role: 'light',
    at: { x: TOWER.x, y: 560, z: -(TOWER.d - 10) },
    r: 150,
    color: LAMP,
    strength: 0.7,
    bloom: true,
    motion: { kind: 'flicker', amp: 0.25, period: 1.8 },
    buildIn: 'light',
  });

  // The bell pavilion, right of the axis, and its bell on a red cord.
  pieces.push({ kind: 'prop', id: 'mandap', art: 'bellMandap', role: 'prop', ...billboard({ x: MANDAP.x, d: MANDAP.d, w: MANDAP.w, h: MANDAP.h }), draw: BellMandap });
  pieces.push({ kind: 'prop', id: 'bell', art: 'brassBell', role: 'hanging', ...hang({ x: MANDAP.x, d: MANDAP.d - 4, w: BELL.w, h: BELL.h, top: BELL.top }), draw: BrassBell, motion: { kind: 'sway', amp: 3, period: 3.6 }, buildIn: 'drop' });

  // The path to the door: kuthuvilakku in pairs, the near pair's flames glowing.
  for (const [i, d] of [
    [0, 1100],
    [1, 1750],
  ] as const)
    pieces.push({ kind: 'prop', id: `lamps-${i}`, art: 'kuthuvilakku', role: 'prop', ...billboard({ x: 600, d, w: LAMPS.gap + LAMPS.w, h: LAMPS.h }), draw: LampPair, buildIn: 'fade' });
  for (const [i, x] of [
    [0, 480],
    [1, 720],
  ] as const)
    pieces.push({
      kind: 'light',
      id: `lamp-glow-${i}`,
      art: 'glow',
      role: 'light',
      at: { x, y: lampTop + 14, z: -1098 },
      r: 42,
      color: LAMP,
      strength: 0.55,
      motion: { kind: 'flicker', amp: 0.35, period: 1.6 + i * 0.3, phase: i * 0.4 },
      buildIn: 'light',
    });

  // Incense haze drifting low across the courtyard.
  for (const [i, d] of [[0, 1700]] as const)
    pieces.push({
      kind: 'prop',
      id: `incense-${i}`,
      art: 'mistBand:incense',
      role: 'prop',
      quiet: true,
      ...billboard({ x: 600, d, w: 2000, h: 300 }),
      opacity: 0.4,
      draw: (p) => createElement(MistBand, { ...p, colors: { ...p.colors, background: mix(p.colors.secondary, p.colors.primary, 0.45) }, variant: 'incense' }),
      motion: { kind: 'drift', amp: 25, period: 16 + i * 5, phase: i * 0.5 },
    });

  // Near: the courtyard gateway, its posts beside the frame and the mango-leaf toran across its top.
  for (const [i, x] of GATE.x.entries())
    pieces.push({ kind: 'prop', id: `gate-${i}`, art: 'gatePost', role: 'architecture', quiet: true, ...billboard({ x, d: GATE.d, w: GATE.w, h: 800 - GATE.top }), draw: (p) => createElement(GatePost, { ...p, inner: i === 0 ? 'right' : 'left' }) });
  pieces.push({ kind: 'prop', id: 'toran', art: 'crownToran', role: 'hanging', detail: 'high', ...hang({ x: 600, d: TORAN.d, w: TORAN.w, h: TORAN.h, top: TORAN.top }), draw: CrownToran });

  return {
    name: 'deepstambh',
    sky: [
      `radial-gradient(ellipse 60% 22% at 30% 55%, ${mix(c.accent, LAMP, 0.4)}, transparent 70%)`,
      `linear-gradient(180deg, ${mix(c.primary, '#000000', 0.55)} 0%, ${mix(c.primary, '#000000', 0.25)} 38%, ${mix(c.primary, c.accent, 0.35)} 55%, ${mix(c.primary, '#000000', 0.45)} 64%, ${mix(c.primary, '#000000', 0.6)} 100%)`,
    ].join(', '),
    light: { from: 'far', color: LAMP, rim: '#ffe2a0' },
    fog: { color: '#2a1418', near: 1200, far: 3000, max: 0.5 },
    veil: 0.4,
    focus: { x: TOWER.x, y: 600, z: -TOWER.d },
    pieces,
    covers: { gate: 'torana', door: 'temple', silk: 'temple', card: 'patra' },
    particles: { count: 22, dNear: 700, dFar: 2300 },
  };
};
