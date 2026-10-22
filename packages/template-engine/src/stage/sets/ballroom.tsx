import type { ReactNode } from 'react';
import { onCubic, shade, tint, type Pt, type Segment } from '../../art/kit';
import { mix } from '../../theme';
import { Ceiling, Chandelier, drawWith, Floor, Pillar, Wall } from '../kit';
import { Glow, kitId, Lin, metalLit, type Stop } from '../kit/architecture';
import { back, billboard, ceiling, floor, hang, wall } from '../planes';
import type { DrawProps, StageSetFactory } from '../types';

/**
 * T08 · Grand Ballroom (`grand-ballroom`, final.md §5.3): the `ballroom` stage.
 *
 * A palace ballroom at night, seen from the gilt doors: a grand crystal
 * chandelier blazes in the crown, the parquet gleams with its light, fluted
 * columns and candelabra lead down the room between walls of tall draped
 * windows, to a horseshoe staircase of pearl marble whose two flights sweep up
 * to a balustraded gallery under an Art Deco mirror, a lit garden arch beneath.
 * Key light from above (the chandelier), warm; rim pearl.
 *
 * Set-local pieces (§6.4): GrandStair (the focal, with the deco mirror on its
 * gallery), RoseUrn (gilt urns of garden roses), ChampagneTable, Candelabrum.
 *
 * Markup is the binding budget here (≤ 150 KB with the palace gate and 42 film
 * particles): set-local art is written in whole units (`I`) and draws railings
 * as strokes, so the whole room stays near 80 KB.
 */

const url = (id: string) => `url(#${id})`;
const rnd = (v: number) => Math.round(v);
/** A path in whole units: at these sizes a unit is under a screen pixel. */
const I = (s: TemplateStringsArray, ...v: number[]): string => {
  let out = s[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(rnd(v[i] ?? 0)) + (s[i + 1] ?? '');
  return out;
};
const pts = (a: readonly Pt[]) => a.map(([x, y]) => `${rnd(x)} ${rnd(y)}`).join('L');
const poly = (a: readonly Pt[]) => `M${pts(a)}Z`;
const at = (s: Segment, t: number): Pt => {
  const q = onCubic(s, t);
  return [q.x, q.y];
};
const lerp = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

// ─────────────────────────── GrandStair (focal) ───────────────────────────

const SW = 690;
const SH = 470;
/** The left flight's outer and inner edges (box units), bottom → gallery; the right flight mirrors them. */
const L_OUT: Segment = [[8, 470], [20, 352], [70, 214], [172, 150]];
const L_IN: Segment = [[150, 470], [148, 372], [178, 244], [242, 157]];
const mirror = (s: Segment): Segment => s.map(([x, y]) => [SW - x, y] as Pt) as unknown as Segment;
const STEPS = 15;
/** Step boundaries along a flight, a touch closer together toward the top (the flight turns away). */
const stepT = (i: number) => 1 - (1 - i / STEPS) ** 1.18;
const sample = (s: Segment, n: number) => Array.from({ length: n + 1 }, (_, i) => at(s, i / n));

/**
 * A horseshoe staircase of pearl marble, seen from the dance floor: two
 * flights curve up from flared bottom steps to a balustraded gallery, each
 * with a runner in the stock colour held by gilt rods, gilt handrails on
 * balusters and a newel lamp at the foot; between them a lit garden arch under
 * the gallery, and above the gallery an Art Deco mirror in a stepped gilt frame.
 */
function GrandStair(p: DrawProps) {
  const c = p.colors;
  const id = kitId(p, 'gst');
  const full = p.detail === 'full';
  const marble = mix(mix(c.background, c.surface, 0.5), p.light.color, 0.14);
  const tread = tint(marble, 0.22);
  const riser = shade(marble, 0.12);
  const wallC = shade(marble, 0.28);
  const line = shade(marble, 0.45);
  const gold = c.secondary;
  const runner = mix(c.primary, '#000000', 0.08);
  const runnerTread = tint(c.primary, 0.2);
  const m = url(`${id}m`);
  const cx = SW / 2;

  const flight = (o: Segment, k: number) => {
    const inner = mirrorIf(L_IN, k);
    const outer = sample(o, 12);
    const inn = sample(inner, 12);
    const treads: string[] = [];
    const runs: string[] = [];
    const rods: string[] = [];
    const noses: string[] = [];
    for (let i = 0; i < STEPS; i++) {
      const ta = stepT(i);
      const tb = stepT(i + 1);
      const tm = ta + (tb - ta) * 0.62;
      const oa = at(o, tm);
      const ia = at(inner, tm);
      const ob = at(o, tb);
      const ib = at(inner, tb);
      treads.push(poly([oa, ia, ib, ob]));
      runs.push(poly([lerp(oa, ia, 0.26), lerp(oa, ia, 0.74), lerp(ob, ib, 0.74), lerp(ob, ib, 0.26)]));
      const r0 = lerp(oa, ia, 0.24);
      const r1 = lerp(oa, ia, 0.76);
      rods.push(I`M${r0[0]} ${r0[1]}L${r1[0]} ${r1[1]}`);
      noses.push(I`M${ob[0]} ${ob[1]}L${ib[0]} ${ib[1]}`);
    }
    const runPts: Pt[] = [];
    for (let i = 0; i <= 12; i++) runPts.push(lerp(at(o, i / 12), at(inner, i / 12), 0.26));
    for (let i = 12; i >= 0; i--) runPts.push(lerp(at(o, i / 12), at(inner, i / 12), 0.74));
    /** A rail: balusters as strokes standing on the flight's edge, a gilt handrail lifted above them. */
    const rail = (s: Segment, lift: number, count: number) => {
      const top = sample(s, 14).map(([x, y]) => [x, y - lift] as Pt);
      const bal: string[] = [];
      for (let j = 1; j < count; j++) {
        const [x, y] = at(s, j / count);
        bal.push(I`M${x} ${y}V${y - lift * (0.96 - 0.25 * (j / count))}`);
      }
      return { d: `M${pts(top)}`, bal: bal.join('') };
    };
    const outR = rail(o, 40, 22);
    const inR = rail(inner, 34, 14);
    const foot = at(o, 0);
    const nx = foot[0] + (k === 0 ? 10 : -10);
    return (
      <g key={`f${k}`}>
        <path d={poly([...outer, ...inn.reverse()])} fill={riser} stroke={line} strokeWidth={1.2} strokeOpacity={0.6} />
        <path d={treads.join('')} fill={tread} />
        <path d={poly(runPts)} fill={runner} />
        <path d={runs.join('')} fill={runnerTread} />
        <path d={noses.join('')} stroke={tint(marble, 0.45)} strokeWidth={1.2} opacity={0.8} />
        {full ? <path d={rods.join('')} stroke={gold} strokeWidth={1.4} /> : null}
        <path d={inR.bal} stroke={tint(marble, 0.08)} strokeWidth={2.6} />
        <path d={inR.d} fill="none" stroke={m} strokeWidth={4} strokeLinecap="round" />
        <path d={outR.bal} stroke={tint(marble, 0.2)} strokeWidth={3.4} />
        <path d={outR.d} fill="none" stroke={m} strokeWidth={6} strokeLinecap="round" />
        <path d={outR.d} fill="none" stroke={tint(gold, 0.55)} strokeWidth={1.4} opacity={0.8} transform="translate(0 -2)" />
        {/* The newel: a marble post, a gilt ring and cap, and a lamp of frosted glass. */}
        <path d={I`M${nx - 11} ${SH}V${SH - 52}H${nx + 11}V${SH}Z`} fill={wallC} stroke={line} />
        <path d={I`M${nx - 14} ${SH - 52}H${nx + 14}V${SH - 58}H${nx - 14}ZM${nx - 2} ${SH - 58}V${SH - 96}H${nx + 2}V${SH - 58}Z`} fill={m} />
        <circle cx={rnd(nx)} cy={SH - 44} r={9} fill="none" stroke={m} strokeWidth={3} />
        <circle cx={rnd(nx)} cy={SH - 104} r={34} fill={url(`${id}lg`)} />
        <circle cx={rnd(nx)} cy={SH - 104} r={9} fill={tint(p.light.color, 0.55)} stroke={gold} strokeWidth={1.4} />
      </g>
    );
  };

  // The spandrel under the gallery, between the flights' inner edges, with the garden arch.
  const inL = sample(L_IN, 12);
  const inRgt = sample(mirror(L_IN), 12);
  const outL = sample(L_OUT, 12);
  const outRgt = sample(mirror(L_OUT), 12);
  const sil = poly([...outL, ...outRgt.reverse()]);
  const shadeV: Stop[] = [[0, '#000000', 0.34], [0.3, '#000000', 0.04], [0.5, '#000000', 0], [0.7, '#000000', 0.04], [1, '#000000', 0.34]];
  const gal: string[] = [];
  for (let x = 176; x <= 514; x += 11) if (Math.abs(x - cx) > 10 && Math.abs(x - 162) > 10 && Math.abs(x - (SW - 162)) > 10) gal.push(I`M${x} ${146}V${104}`);
  // The deco mirror: a stepped frame with a sunburst fan in its crest.
  const fx = 50;
  const fTop = 22;
  const fBot = 146;
  const fan: Segment = [[cx - 30, fTop + 26], [cx - 30, fTop - 14], [cx + 30, fTop - 14], [cx + 30, fTop + 26]];
  const rays = Array.from({ length: 9 }, (_, i) => at(fan, (i + 0.5) / 9))
    .map(([x, y]) => I`M${cx} ${fTop + 26}L${x} ${y}`)
    .join('');
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(gold, p.light.from)} x1={0} y1={0} x2={SW} y2={60} />
        <Lin id={`${id}v`} stops={shadeV} x1={0} x2={SW} />
        <Lin id={`${id}ai`} stops={[[0, mix(c.primary, '#000000', 0.55)], [0.55, mix(c.primary, p.light.color, 0.18)], [1, mix(p.light.color, c.primary, 0.3)]]} y1={196} y2={SH} />
        <Lin id={`${id}mi`} stops={[[0, mix(c.primary, c.accent, 0.3)], [0.55, mix(c.primary, '#000000', 0.35)], [1, mix(c.primary, p.light.color, 0.3)]]} x1={cx - fx} y1={fTop} x2={cx + fx} y2={fBot} />
        <Glow id={`${id}lg`} color={p.light.color} core={tint(p.light.color, 0.6)} a={0.75} />
        <Glow id={`${id}ag`} color={p.light.color} core={tint(p.light.color, 0.5)} a={0.7} cy="80%" />
        <radialGradient id={`${id}sh`} cx="50%" cy="40%" r="50%">
          <stop offset="0" stopColor={mix(c.primary, '#000000', 0.5)} stopOpacity={0.72} />
          <stop offset="0.55" stopColor={mix(c.primary, '#000000', 0.5)} stopOpacity={0.42} />
          <stop offset="1" stopColor={mix(c.primary, '#000000', 0.5)} stopOpacity={0} />
        </radialGradient>
        <Lin id={`${id}fs`} stops={[[0, tint(marble, 0.2)], [1, shade(marble, 0.2)]]} y1={150} y2={178} />
      </defs>
      {/* The deco mirror above the gallery: smoky glass catching the chandelier, a stepped gilt frame, a sunburst crest. */}
      <path d={I`M${cx - fx} ${fBot}V${fTop + 30}H${cx - fx + 12}V${fTop + 18}H${cx - 30}V${fTop + 26}A30 30 0 0 1 ${cx + 30} ${fTop + 26}V${fTop + 18}H${cx + fx - 12}V${fTop + 30}H${cx + fx}V${fBot}Z`} fill={url(`${id}mi`)} stroke={m} strokeWidth={5} />
      <path d={I`M${cx - fx + 9} ${fBot}V${fTop + 38}M${cx + fx - 9} ${fBot}V${fTop + 38}M${cx - 30} ${fTop + 26}H${cx + 30}`} stroke={m} strokeWidth={1.6} />
      <path d={rays} stroke={m} strokeWidth={1.4} />
      <path d={I`M${cx - 30} ${fTop + 46}L${cx - 8} ${fTop + 46}L${cx - 34} ${fTop + 104}L${cx - 42} ${fTop + 104}Z`} fill={tint(c.accent, 0.5)} opacity={0.2} />
      {/* The spandrel wall with panel mouldings, and the garden arch with its open doors. */}
      <path d={poly([...inL, ...inRgt.reverse()])} fill={wallC} />
      {full ? <path d={I`M${cx - 168} ${SH - 26}V${300}H${cx - 104}V${SH - 26}ZM${cx + 104} ${SH - 26}V${300}H${cx + 168}V${SH - 26}ZM${cx - 160} ${286}V${200}H${cx - 104}V${286}ZM${cx + 104} ${286}V${200}H${cx + 160}V${286}Z`} fill="none" stroke={gold} strokeWidth={1.6} opacity={0.7} /> : null}
      <path d={I`M${cx - 76} ${SH}V${272}A76 76 0 0 1 ${cx + 76} ${272}V${SH}Z`} fill={tint(marble, 0.12)} stroke={line} strokeWidth={1.2} />
      <path d={I`M${cx - 64} ${SH}V${274}A64 64 0 0 1 ${cx + 64} ${274}V${SH}Z`} fill={url(`${id}ai`)} />
      <ellipse cx={cx} cy={SH - 30} rx={90} ry={70} fill={url(`${id}ag`)} />
      <path d={I`M${cx - 64} ${330}H${cx + 64}M${cx - 64} ${390}H${cx + 64}M${cx} ${212}V${SH}M${cx - 32} ${222}V${SH}M${cx + 32} ${222}V${SH}`} stroke={gold} strokeWidth={1.6} opacity={0.55} />
      <path d={I`M${cx - 10} ${196}H${cx + 10}L${cx + 7} ${214}H${cx - 7}Z`} fill={m} />
      {flight(L_OUT, 0)}
      {flight(mirror(L_OUT), 1)}
      {/* The gallery: fascia with gilt mouldings and rosettes, balusters between piers, urns on the piers. */}
      <path d={I`M${150} ${150}H${SW - 150}V${178}H${150}Z`} fill={url(`${id}fs`)} />
      <path d={I`M${150} ${151}H${SW - 150}M${150} ${177}H${SW - 150}`} stroke={m} strokeWidth={2.4} />
      {full ? <path d={Array.from({ length: 13 }, (_, i) => I`M${167 + i * 29} ${164}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`).join('')} fill={gold} /> : null}
      <path d={gal.join('')} stroke={tint(marble, 0.16)} strokeWidth={3.6} />
      <path d={I`M${156} ${144}H${SW - 156}V${150}H${156}Z`} fill={marble} />
      <path d={I`M${156} ${98}H${SW - 156}V${105}H${156}Z`} fill={m} />
      <path d={[162, cx, SW - 162].map((x) => I`M${x - 9} ${150}V${102}H${x + 9}V${150}Z`).join('')} fill={marble} stroke={line} strokeWidth={0.8} />
      <path
        d={[162, cx, SW - 162].map((x) => I`M${x - 11} ${102}H${x + 11}V${96}H${x - 11}ZM${x - 6} ${96}H${x + 6}L${x + 4} ${92}C${x + 11} ${88} ${x + 11} ${79} ${x + 6} ${76}H${x - 6}C${x - 11} ${79} ${x - 11} ${88} ${x - 4} ${92}ZM${x - 5} ${76}Q${x} ${66} ${x + 5} ${76}Z`).join('')}
        fill={m}
      />
      {/* Depth: the stair falls off into shadow toward the walls, and the gallery lies beyond the chandelier's reach. */}
      <path d={sil} fill={url(`${id}v`)} />
      {/* A soft pool of shade over the gallery and the mirror (no edges: it sits behind the date and place). */}
      <ellipse cx={cx} cy={150} rx={320} ry={150} fill={url(`${id}sh`)} />
    </svg>
  );
}
const mirrorIf = (s: Segment, k: number) => (k === 0 ? s : mirror(s));

// ─────────────────────────── FarWall ───────────────────────────

/**
 * The far wall beyond the gallery, closing the room behind the names: plum
 * damask tone between gilt pilasters, a tall arched window of moonlit glass
 * under a swagged pelmet with velvet drapes. Above the eye line it is drawn
 * tone-on-tone (it sits behind the names), so only its shapes read.
 */
function FarWall(p: DrawProps): ReactNode {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'bfw');
  const base = mix(c.primary, c.text, 0.2);
  const q = (col: string, a = 0.62) => mix(col, base, a);
  const cx = w / 2;
  const win = I`M${cx - 110} ${h}V${260}A110 110 0 0 1 ${cx + 110} ${260}V${h}Z`;
  const drape = q(mix(c.primary, c.accent, 0.25), 0.4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        {/* Moonlit glass a shade lighter than the wall, evenly: no dark pane behind the names. */}
        <Lin id={`${id}g`} stops={[[0, q(mix(c.primary, c.accent, 0.4), 0.5)], [0.55, q(mix(c.primary, c.accent, 0.22), 0.6)], [1, mix(c.primary, p.light.color, 0.2)]]} y1={150} y2={h} />
      </defs>
      <rect width={w} height={h} fill={base} />
      <path d={I`M0 0H${w}V34H0ZM34 34H86V${h}H34ZM${w - 86} 34H${w - 34}V${h}H${w - 86}Z`} fill={q(mix(base, c.secondary, 0.3), 0.35)} />
      <path d={win} fill={url(`${id}g`)} stroke={q(c.secondary, 0.45)} strokeWidth={8} />
      <path d={I`M${cx - 37} ${170}V${h}M${cx + 37} ${170}V${h}M${cx - 110} ${260}H${cx + 110}M${cx - 110} ${400}H${cx + 110}`} stroke={q(c.secondary, 0.72)} strokeWidth={3} />
      <path d={I`M${cx + 46} ${190}L${cx + 92} ${222}V${330}L${cx + 46} ${300}Z`} fill={q(c.accent, 0.6)} opacity={0.45} />
      <path d={I`M${cx - 180} ${110}H${cx - 80}C${cx - 96} ${300} ${cx - 118} ${460} ${cx - 120} ${h}H${cx - 180}ZM${cx + 180} ${110}H${cx + 80}C${cx + 96} ${300} ${cx + 118} ${460} ${cx + 120} ${h}H${cx + 180}Z`} fill={drape} />
      <path d={I`M${cx - 190} ${96}H${cx + 190}V${130}Q${cx + 60} ${200} ${cx} ${150}Q${cx - 60} ${200} ${cx - 190} ${130}Z`} fill={mix(drape, base, 0.15)} stroke={q(c.secondary, 0.5)} strokeWidth={4} />
    </svg>
  );
}

// ─────────────────────────── RoseUrn ───────────────────────────

/** Roses in the dome (box units of 120×180): x, y, r, colour (0 ivory, 1 blush, 2 deep). Back to front. */
const ROSES: ReadonlyArray<readonly [number, number, number, number]> = [
  [30, 70, 10, 1], [50, 61, 11, 0], [72, 62, 11, 2], [92, 71, 10, 0],
  [18, 86, 10, 0], [39, 80, 12, 2], [61, 77, 12, 0], [84, 83, 12, 1], [103, 90, 9, 0],
  [28, 98, 11, 1], [51, 96, 12, 0], [75, 98, 11, 1], [96, 102, 8, 2],
];
const LEAVES: ReadonlyArray<readonly [number, number, number, number]> = [
  [10, 92, -16, 6], [14, 72, -12, -10], [34, 54, -6, -16], [60, 48, 2, -18], [86, 54, 10, -14], [108, 76, 14, -6], [112, 98, 14, 8], [62, 108, -4, 14],
];

/** A gilt Medici urn on a marble plinth, crowned with a dome of garden roses (ivory, blush and a few deep ones). */
function RoseUrn(p: DrawProps): ReactNode {
  const c = p.colors;
  const id = kitId(p, 'rur');
  const marble = mix(mix(c.background, c.surface, 0.5), p.light.color, 0.1);
  const fills = [p.nature.ivory, mix(p.nature.ivory, '#e48a9a', 0.5), mix('#a51f3c', c.primary, 0.15)];
  const curls = [mix(p.nature.ivory, '#c69a74', 0.45), mix('#e48a9a', '#7a2235', 0.4), mix('#a51f3c', '#000000', 0.45)];
  const disc = (x: number, y: number, r: number) => I`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const curl = (x: number, y: number, r: number) => I`M${x - r * 0.4} ${y}a${r * 0.42} ${r * 0.36} 0 1 1 ${r * 0.5} ${r * 0.28}M${x - r * 0.78} ${y + r * 0.1}q${r * 0.78} ${r * 0.8} ${r * 1.56} 0`;
  const byColour = (k: number, f: (x: number, y: number, r: number) => string) =>
    ROSES.filter((r) => r[3] === k)
      .map(([x, y, r]) => f(x, y, r))
      .join('');
  const leaf = ([x, y, dx, dy]: readonly [number, number, number, number]) => I`M${x} ${y}q${dx * 0.2 - dy * 0.5} ${dy * 0.2 + dx * 0.5} ${dx * 1.6} ${dy * 1.6}q${-dx * 0.3 + dy * 0.6} ${-dy * 0.3 - dx * 0.6} ${-dx * 1.6} ${-dy * 1.6}Z`;
  const m = url(`${id}m`);
  return (
    <svg viewBox="0 0 120 180" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, p.light.from)} x1={20} x2={100} />
        <Lin id={`${id}s`} stops={[[0, '#000000', 0], [1, '#000000', 0.28]]} y1={60} y2={112} />
      </defs>
      <path d={LEAVES.map(leaf).join('')} fill={p.nature.leafDark} />
      <path d={LEAVES.slice(1, 6).map(([x, y, dx, dy]) => leaf([x + 2, y + 2, dx * 0.7, dy * 0.7])).join('')} fill={p.nature.leaf} />
      {fills.map((f, k) => (
        <path key={`r${k}`} d={byColour(k, disc)} fill={f} />
      ))}
      {fills.map((_, k) => (
        <path key={`c${k}`} d={byColour(k, curl)} fill="none" stroke={curls[k]} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <path d={ROSES.map(([x, y, r]) => I`M${x - r * 0.6} ${y - r * 0.55}q${r * 0.6} ${-r * 0.5} ${r * 1.2} 0`).join('')} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M8 76Q60 128 112 76V112H8Z" fill={url(`${id}s`)} />
      {/* The urn: lip, gadrooned bowl, scroll handles, stem, foot; the plinth with a sunk panel. */}
      <path d="M24 104H96V111H24ZM28 111C30 136 46 146 56 148H64C74 146 90 136 92 111ZM54 148H66L64 158H56ZM44 158H76L80 166H40Z" fill={m} />
      <path d="M40 114Q43 132 54 145M60 114V147M80 114Q77 132 66 145M27 113C13 111 13 127 26 129M93 113C107 111 107 127 94 129" fill="none" stroke={shade(c.secondary, 0.4)} strokeWidth={1.6} />
      <path d="M36 166H84V180H36Z" fill={marble} />
      <path d="M41 169H79V177H41Z" fill="none" stroke={shade(marble, 0.3)} strokeWidth={1} />
    </svg>
  );
}

// ─────────────────────────── ChampagneTable ───────────────────────────

/**
 * A gilt guéridon with a marble top (box 100×170): a bottle of champagne in a
 * silver-gilt bucket and two coupes poured, bubbles rising, the rims catching
 * the chandelier.
 */
function ChampagneTable(p: DrawProps): ReactNode {
  const c = p.colors;
  const id = kitId(p, 'chp');
  const marble = mix(c.background, c.surface, 0.5);
  const wine = mix(c.secondary, p.nature.ivory, 0.45);
  const glass = tint(p.light.color, 0.5);
  const m = url(`${id}m`);
  const coupe = (x: number) => `M${x - 10} 64Q${x} 78 ${x + 10} 64ZM${x - 1} 72V84H${x + 1}V72ZM${x - 6} 85H${x + 6}V86H${x - 6}Z`;
  return (
    <svg viewBox="0 0 100 170" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, p.light.from)} x1={0} x2={100} />
      </defs>
      {/* The guéridon: three cabriole legs on a stretcher, a gilt apron, the marble top. */}
      <path d="M50 96V152Q30 156 18 170M50 152Q70 156 82 170M50 152V170" fill="none" stroke={m} strokeWidth={4} strokeLinecap="round" />
      <path d="M43 118H57L54 132H46Z" fill={m} />
      <path d="M8 90H92V96H8Z" fill={shade(marble, 0.18)} />
      <path d="M6 86Q50 80 94 86V91Q50 97 6 91Z" fill={marble} stroke={m} strokeWidth={1.6} />
      <path d="M8 96Q50 108 92 96" fill="none" stroke={m} strokeWidth={2.4} />
      {/* The bottle in its bucket, gold foil at the neck. */}
      <path d="M64 46Q64 40 66 38V24H72V38Q74 40 74 46V78H64Z" fill={mix(p.nature.leafDark, '#000000', 0.45)} />
      <path d="M65.5 22H72.5V36H65.5Z" fill={m} />
      <path d="M67 48H71" stroke={glass} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M58 60H80L77 85H61Z" fill={m} />
      <path d="M58 60H80" stroke={tint(c.secondary, 0.6)} strokeWidth={1.4} />
      {/* Two coupes, poured. */}
      <path d={`${coupe(24)}${coupe(44)}`} fill={wine} opacity={0.9} />
      <path d="M13 64Q24 60 35 64M33 64Q44 60 55 64" fill="none" stroke={glass} strokeWidth={1.3} />
      {p.detail === 'full' ? <path d="M23 68h1v1h-1ZM26 66h1v1h-1ZM43 69h1v1h-1ZM46 66h1v1h-1Z" fill={p.nature.ivory} /> : null}
    </svg>
  );
}

/**
 * A five-light gilt candelabrum on a tall stand (box 60×300): a tripod foot,
 * a knopped shaft, scrolled arms to drip pans and ivory candles; the flames
 * burn at the top of the box, where the set's candle glows sit.
 */
function Candelabrum(p: DrawProps): ReactNode {
  const c = p.colors;
  const id = kitId(p, 'cnd');
  const m = url(`${id}m`);
  const cups: ReadonlyArray<readonly [number, number]> = [[6, 44], [17, 36], [30, 30], [43, 36], [54, 44]];
  return (
    <svg viewBox="0 0 60 300" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, p.light.from)} x1={14} x2={46} />
        <Glow id={`${id}f`} color={p.nature.flame} core={p.nature.flameCore} a={0.9} />
      </defs>
      <path d="M12 300Q22 292 25 280H35Q38 292 48 300ZM22 281C22 270 38 270 38 281ZM28.5 272V76H31.5V272ZM25 252a5 3 0 1 0 10 0a5 3 0 1 0 -10 0ZM26 200a4 2.6 0 1 0 8 0a4 2.6 0 1 0 -8 0ZM25 120a5 3.4 0 1 0 10 0a5 3.4 0 1 0 -10 0Z" fill={m} />
      <path d="M30 76C14 78 6 66 6 48M30 76C46 78 54 66 54 48M30 68C22 68 17 60 17 40M30 68C38 68 43 60 43 40M30 76V34" fill="none" stroke={m} strokeWidth={2.4} strokeLinecap="round" />
      <path d={cups.map(([x, y]) => `M${x - 5} ${y}h10l-2 3h-6Z`).join('')} fill={m} />
      <path d={cups.map(([x, y]) => `M${x - 2} ${y}V${y - 14}h4V${y}Z`).join('')} fill={p.nature.ivory} />
      {cups.map(([x, y]) => (
        <circle key={`g${x}`} cx={x} cy={y - 20} r={7} fill={url(`${id}f`)} />
      ))}
      <path d={cups.map(([x, y]) => `M${x} ${y - 26}Q${x + 2.6} ${y - 19} ${x} ${y - 15}Q${x - 2.6} ${y - 19} ${x} ${y - 26}Z`).join('')} fill={p.nature.flame} />
      <path d={cups.map(([x, y]) => `M${x} ${y - 22}Q${x + 1.2} ${y - 18} ${x} ${y - 16}Q${x - 1.2} ${y - 18} ${x} ${y - 22}Z`).join('')} fill={p.nature.flameCore} />
    </svg>
  );
}

/**
 * The kit's classical column in pearl marble: its stone takes a breath of the stock colour, so the columns frame the
 * staircase instead of outshining it (the kit's marble is near-white in every palette).
 */
function PearlPillar(p: DrawProps): ReactNode {
  const c = p.colors;
  return <Pillar {...p} variant="classical" colors={{ ...c, surface: mix(c.surface, c.primary, 0.24), background: mix(c.background, c.primary, 0.12) }} />;
}

// ─────────────────────────── the set ───────────────────────────

/** The room: walls and ceiling from just ahead of the gilt doors, so the far pose (films' closings, the arrival) stays inside it. */
const ROOM = { x0: 250, x1: 950, top: -160, dNear: -300, dFar: 2500 } as const;

export const ballroom: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const warm = '#ffd9a0';
  const candle = '#ffd08a';
  return {
    name: 'ballroom',
    // The room's far end beyond the gallery: deep stock colour, warmed low where the garden arch and the chandelier reach.
    sky: `radial-gradient(ellipse 46% 34% at 50% 62%, ${mix(c.primary, c.secondary, 0.28)}, ${mix(c.primary, '#000000', 0.38)} 58%, ${mix(c.primary, '#000000', 0.62)})`,
    light: { from: 'above', color: '#ffe7b8', rim: '#fff4dc' },
    fog: { color: '#1e1224', near: 1500, far: 3000, max: 0.4 },
    veil: 0.35,
    focus: { x: 600, y: 600, z: -2050 },
    pieces: [
      // Planes: the parquet with the chandelier's and candles' light baked in, the coffered ceiling, the window walls, the far wall.
      {
        kind: 'plane',
        id: 'floor',
        art: 'floor:parquet',
        role: 'architecture',
        plane: floor({ x0: ROOM.x0, x1: ROOM.x1, dNear: ROOM.dNear, dFar: ROOM.dFar }),
        draw: drawWith(Floor, {
          variant: 'parquet',
          pools: [
            { x: 600, d: 1000, r: 300, color: '#ffe7b8' },
            { x: 410, d: 1300, r: 130, color: candle },
            { x: 790, d: 1300, r: 130, color: candle },
            { x: 600, d: 1950, r: 220, color: warm },
          ],
        }),
      },
      { kind: 'plane', id: 'ceiling', art: 'ceiling:plasterCoffer', role: 'architecture', plane: ceiling({ x0: ROOM.x0, x1: ROOM.x1, y: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Ceiling, { variant: 'plasterCoffer' }) },
      { kind: 'plane', id: 'wall-left', art: 'wall:ballroom', role: 'architecture', plane: wall('left', { x: ROOM.x0, yTop: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Wall, { variant: 'ballroom' }) },
      { kind: 'plane', id: 'wall-right', art: 'wall:ballroom', role: 'architecture', plane: wall('right', { x: ROOM.x1, yTop: ROOM.top, dNear: ROOM.dNear, dFar: ROOM.dFar }), draw: drawWith(Wall, { variant: 'ballroom' }) },
      { kind: 'plane', id: 'far-wall', art: 'ballroomFarWall', role: 'architecture', plane: back({ x0: ROOM.x0, x1: ROOM.x1, yTop: ROOM.top, d: ROOM.dFar }), draw: FarWall },

      // The crown: the grand chandelier.
      { kind: 'prop', id: 'chandelier', art: 'chandelier:crystalGrand', role: 'hanging', ...hang({ x: 600, d: 600, w: 380, h: 200, top: ROOM.top }), motion: { kind: 'sway', amp: 0.6, period: 9 }, buildIn: 'drop', draw: drawWith(Chandelier, { variant: 'crystalGrand' }) },

      // The corridor: fluted columns, candelabra, the champagne table.
      ...[1050, 1500].flatMap((d) =>
        [-1, 1].map((s) => ({ kind: 'prop' as const, id: `column-${s < 0 ? 'l' : 'r'}-${d}`, art: 'pillar:classical', role: 'architecture' as const, ...billboard({ x: 600 + s * 250, d, w: 70, h: 470 }), buildIn: 'rise' as const, draw: PearlPillar })),
      ),
      ...[-1, 1].map((s) => ({ kind: 'prop' as const, id: `candelabra-${s < 0 ? 'l' : 'r'}`, art: 'candelabrum', role: 'prop' as const, ...billboard({ x: 600 + s * 190, d: 1300, w: 60, h: 300 }), draw: Candelabrum })),
      { kind: 'prop', id: 'champagne', art: 'champagne', role: 'prop', ...billboard({ x: 745, d: 1650, w: 100, h: 170 }), buildIn: 'fade', draw: ChampagneTable },

      // The focal: the staircase with its deco mirror, urns of roses at its feet.
      ...[-1, 1].map((s) => ({ kind: 'prop' as const, id: `roses-${s < 0 ? 'l' : 'r'}`, art: 'roseUrn', role: 'prop' as const, ...billboard({ x: 600 + s * 205, d: 1900, w: 120, h: 180 }), buildIn: 'bloom' as const, draw: RoseUrn })),
      { kind: 'prop', id: 'grand-stair', art: 'grandStair', role: 'focal', ...billboard({ x: 600, d: 2050, w: SW, h: SH }), draw: GrandStair },

      // Lights: the chandelier's blaze, the candelabra flames, the lit garden arch.
      { kind: 'light', id: 'glow-chandelier', art: 'glow', role: 'light', at: { x: 600, y: 0, z: -600 }, r: 110, color: '#ffe7b8', strength: 0.7, motion: { kind: 'pulse', amp: 0.2, period: 6 }, buildIn: 'light' },
      ...[-1, 1].map((s, i) => ({ kind: 'light' as const, id: `glow-candles-${s < 0 ? 'l' : 'r'}`, art: 'glow', role: 'light' as const, at: { x: 600 + s * 190, y: 512, z: -1300 }, r: 70, color: candle, strength: 0.55, motion: { kind: 'flicker' as const, amp: 0.3, period: 1.9, phase: i * 0.45 }, buildIn: 'light' as const })),
      { kind: 'light', id: 'glow-arch', art: 'glow', role: 'light', at: { x: 600, y: 700, z: -2000 }, r: 150, color: warm, strength: 0.42, motion: { kind: 'pulse', amp: 0.25, period: 5, phase: 0.3 }, buildIn: 'bloom' },
    ],
    covers: { gate: 'palace', door: 'ballroom', silk: 'velvet', card: 'album' },
    particles: { count: 20, dNear: 700, dFar: 2300 },
  };
};
