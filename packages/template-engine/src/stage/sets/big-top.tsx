import type { ReactNode } from 'react';
import { mix } from '../../theme';
import { onCubic, shade, tint, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { awayStops, bodyStops, FlameAt, FlameDef, Glow, kitId, KitSvg, Lin, metalLit, P, type Stop } from '../kit/architecture';
import { Ceiling, drawWith, Floor, illus, Pole, Wall } from '../kit';
import { back, billboard, ceiling, floor, hang, wall } from '../planes';
import type { DrawProps, Piece, SetContext, StageSetFactory } from '../types';

/**
 * T07 · Big Top (`big-top`, final.md §5.3 T07): an evening circus tent seen from
 * the ring door. Red-and-ivory canvas radiates from the king pole overhead,
 * bunting swings in the crown, two spotlights cross on the focal piece (a
 * three-tier birthday cake on a lacquered circus drum in the middle of the
 * sawdust ring), balloon half-arches frame it, presents, a teddy and a unicorn
 * wait at its foot, and the performers' entrance glows at the far end of the
 * tent between the grandstands. Key light from above (the tent rig).
 *
 * Set-local pieces (§6.4): TentBack, CakeDrum, BalloonArch, plus SpotBeam (a
 * slanted spotlight cone: the kit's LightShaft only draws upright cones) and
 * Presents (the `giftBox` illustration draws with a clip-path, which the stage
 * bans).
 */

// ─────────────────────────── helpers ───────────────────────────

type Side = 'left' | 'right';
const url = (id: string) => `url(#${id})`;
/** A circle as a path (many in one d). */
const dot = (x: number, y: number, r: number) => P`M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
/** An ellipse as a path. */
const oval = (x: number, y: number, rx: number, ry: number) => P`M${x + rx} ${y}a${rx} ${ry} 0 1 0 ${-2 * rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0Z`;
/** Where a point u (−1..1 across a cylinder's face, by angle) lands across its silhouette: sin(u·π/2) as a cubic, no trigonometry. */
const across = (u: number) => u * (1.5 - 0.5 * u * u);
/** The front rim of an ellipse at x offset fraction s (−1..1): how far below the centre line it sits, ×ry. */
const front = (s: number) => Math.sqrt(Math.max(0, 1 - s * s));
/** A five-point star of radius r at (x, y) (points precomputed: no trigonometry). */
function star(x: number, y: number, r: number, inner = 0.42): string {
  const o: Pt[] = [[0, -1], [0.951, -0.309], [0.588, 0.809], [-0.588, 0.809], [-0.951, -0.309]];
  const i: Pt[] = [[0.588, -0.809], [0.951, 0.309], [0, 1], [-0.951, 0.309], [-0.588, -0.809]];
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = o[k]!;
    const b = i[k]!;
    d += `${k ? 'L' : 'M'}${r2(x + a[0] * r)} ${r2(y + a[1] * r)}L${r2(x + b[0] * r * inner)} ${r2(y + b[1] * r * inner)}`;
  }
  return `${d}Z`;
}
/** A cylinder's front silhouette: top ellipse (cx, y0), straight sides down to the bottom ellipse at y1. */
const drumPath = (cx: number, rx: number, y0: number, y1: number, ry: number) => P`M${cx - rx} ${y0}V${y1}A${rx} ${ry} 0 0 0 ${cx + rx} ${y1}V${y0}A${rx} ${ry} 0 0 1 ${cx - rx} ${y0}Z`;
/** A band round a cylinder's front: between the front rims at y0 and y1. */
const bandPath = (cx: number, rx: number, y0: number, y1: number, ry: number) => P`M${cx - rx} ${y0}A${rx} ${ry} 0 0 0 ${cx + rx} ${y0}V${y1}A${rx} ${ry} 0 0 1 ${cx - rx} ${y1}Z`;

// ─────────────────────────── TentBack (back plane) ───────────────────────────

/**
 * The far canvas wall of the tent (700×1000, world x 250–950, y −200–800): the
 * performers' entrance (velvet drapes tied back, a gold valance, warm light
 * within), stepped grandstands with a bulb-lit rail either side. Above the eye
 * line the canvas stripes and the valance's star are tone-on-tone.
 */
function TentBack(p: DrawProps): ReactNode {
  const id = kitId(p, 'btback');
  const { w, h, colors: c } = p;
  const eye = Math.min(h, p.eyeLine ?? 0);
  const full = p.detail === 'full';
  const red = c.primary;
  const ivory = mix(c.accent, c.background, 0.3);
  const gold = c.secondary;
  const warm = p.light.color;
  const cx = w / 2;
  const doorW = 150;
  const doorTop = eye - 40;
  // Canvas stripes: 50 wide, primary and ivory, quiet everywhere (it is far and hazed) and tone-on-tone above the eye.
  const stripes: string[] = [];
  for (let x = 0; x < w; x += 100) stripes.push(P`M${x} 0h50v${h}h-50Z`);
  // Grandstands: five tiers stepping up toward the side walls.
  const tiers = 5;
  const standTop = eye + 70;
  const tierH = (h - standTop) / tiers;
  const stands: ReactNode[] = [];
  const bands: string[] = [];
  const rails: string[] = [];
  const bulbs: string[] = [];
  for (const side of [-1, 1] as const) {
    for (let t = 0; t < tiers; t++) {
      const y = standTop + t * tierH;
      const inner = cx + side * (doorW / 2 + 70 + (tiers - 1 - t) * 22);
      const outer = side < 0 ? 0 : w;
      const x0 = Math.min(inner, outer);
      const x1 = Math.max(inner, outer);
      stands.push(<path key={`s${side}${t}`} d={P`M${x0} ${y}H${x1}V${y + tierH}H${x0}Z`} fill={shade(red, 0.28 + t * 0.04)} />);
      bands.push(P`M${x0} ${y + tierH * 0.2}H${x1}V${y + tierH * 0.42}H${x0}Z`);
      rails.push(P`M${x0} ${y}H${x1}`);
      // A rail of bulbs: one dashed line with round caps (a dot every 28), not a circle each.
      if (full) bulbs.push(P`M${x0 + 14} ${y - 3}H${x1 - 6}`);
    }
  }
  // The drapes either side of the door: velvet tied back at 72% of the door's height.
  const tie = doorTop + (h - doorTop) * 0.62;
  // Each drape hangs from the valance, meets its twin at the top, sweeps out to its tieback and falls to the floor.
  const drape = (s: number) => {
    const far = cx + s * (doorW / 2 + 160);
    const tx = cx + s * (doorW / 2 + 22);
    const foot = cx + s * (doorW / 2 - 4);
    return P`M${far} ${doorTop - 40}H${cx + s * 4}C${cx + s * 10} ${doorTop + 40} ${tx - s * 30} ${tie - 70} ${tx} ${tie}C${tx + s * 4} ${tie + 50} ${foot} ${h - 90} ${foot} ${h}H${far}Z`;
  };
  const folds = (s: number) => {
    let d = '';
    for (let k = 1; k <= 4; k++) {
      const x = cx + s * (doorW / 2 + 20 + k * 26);
      d += P`M${x} ${doorTop}C${x - s * 6} ${tie - 30} ${x - s * (18 + k * 4)} ${tie + 10} ${x - s * (6 + k * 3)} ${h}`;
    }
    return d;
  };
  // A scalloped valance across the door, straddling the eye line (quiet above it).
  const vY = doorTop - 60;
  const vX0 = cx - doorW / 2 - 110;
  const vX1 = cx + doorW / 2 + 110;
  const n = 7;
  const sw = (vX1 - vX0) / n;
  let valance = P`M${vX0} ${vY}H${vX1}V${vY + 34}`;
  for (let k = n; k > 0; k--) valance += P`Q${vX0 + (k - 0.5) * sw} ${vY + 70} ${vX0 + (k - 1) * sw} ${vY + 34}`;
  valance += 'Z';
  const tone = mix(red, ivory, 0.25);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}door`} stops={[[0, mix(warm, gold, 0.35)], [0.55, warm], [1, mix(warm, ivory, 0.4)]]} x1={0} y1={doorTop} x2={0} y2={h} />
        <Glow id={`${id}spill`} color={warm} core={warm} a={0.55} cy="70%" />
        <Lin id={`${id}top`} stops={[[0, shade(red, 0.55), 0.85], [0.5, shade(red, 0.4), 0.35], [1, shade(red, 0.3), 0]]} x1={0} y1={0} x2={0} y2={eye} />
        <Lin id={`${id}vel`} stops={[[0, shade(red, 0.35)], [0.5, red], [1, shade(red, 0.4)]]} x1={cx - doorW / 2 - 160} y1={0} x2={cx + doorW / 2 + 160} y2={0} />
        <Lin id={`${id}gold`} stops={metalLit(gold, p.light.from)} x1={vX0} y1={0} x2={vX1} y2={0} />
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={ivory} />
      <path d={stripes.join('')} fill={red} />
      {/* Above the eye line the canvas is tone-on-tone: a wash of its own mid tone, darkening toward the peak. */}
      <rect x={0} y={0} width={w} height={r2(eye)} fill={tone} opacity={0.78} />
      <rect x={0} y={0} width={w} height={r2(eye)} fill={url(`${id}top`)} />
      <path d={star(cx, vY - 120, 46)} fill={mix(tone, gold, 0.28)} />
      <path d={P`M${cx - 90} ${vY - 120}H${cx - 56}M${cx + 56} ${vY - 120}H${cx + 90}`} stroke={mix(tone, gold, 0.24)} strokeWidth={3} />
      {stands}
      <path d={bands.join('')} fill={shade(red, 0.1)} />
      <path d={rails.join('')} stroke={gold} strokeWidth={3} opacity={0.8} />
      {bulbs.length ? <path d={bulbs.join('')} stroke={mix(warm, gold, 0.3)} strokeWidth={6.4} strokeLinecap="round" strokeDasharray="0 28" fill="none" opacity={0.85} /> : null}
      {/* The lit door and the warm light spilling onto the drapes and the floor of the passage. */}
      <ellipse cx={r2(cx)} cy={r2(h - 140)} rx={r2(doorW * 1.6)} ry={r2((h - doorTop) * 0.75)} fill={url(`${id}spill`)} />
      <path d={P`M${cx - doorW / 2} ${h}V${doorTop + 50}Q${cx - doorW / 2} ${doorTop} ${cx} ${doorTop}Q${cx + doorW / 2} ${doorTop} ${cx + doorW / 2} ${doorTop + 50}V${h}Z`} fill={url(`${id}door`)} />
      <path d={P`M${cx - 50} ${h}L${cx - 30} ${doorTop + 120}H${cx + 30}L${cx + 50} ${h}Z`} fill={tint(warm, 0.5)} opacity={0.5} />
      <path d={drape(-1)} fill={url(`${id}vel`)} />
      <path d={drape(1)} fill={url(`${id}vel`)} />
      {full ? <path d={folds(-1) + folds(1)} stroke={shade(red, 0.45)} strokeWidth={4} fill="none" opacity={0.5} /> : null}
      {/* Gold tiebacks with tassels. */}
      {[-1, 1].map((s) => {
        const x = cx + s * (doorW / 2 + 22);
        return (
          <g key={s}>
            <path d={P`M${x - 26} ${tie - 6}Q${x} ${tie + 12} ${x + 26} ${tie - 6}`} stroke={url(`${id}gold`)} strokeWidth={9} fill="none" />
            <path d={P`M${x - 6} ${tie + 6}L${x - 12} ${tie + 52}H${x + 12}L${x + 6} ${tie + 6}Z`} fill={gold} />
            <circle cx={r2(x)} cy={r2(tie + 5)} r={8} fill={tint(gold, 0.3)} />
          </g>
        );
      })}
      <path d={valance} fill={mix(red, tone, 0.35)} />
      <path d={P`M${vX0} ${vY + 6}H${vX1}`} stroke={mix(gold, tone, 0.45)} strokeWidth={6} />
      <rect x={0} y={r2(eye - 6)} width={w} height={6} fill={shade(red, 0.3)} opacity={0.6} />
    </KitSvg>
  );
}

// ─────────────────────────── CakeDrum (focal) ───────────────────────────

/**
 * The focal piece (300×470): a three-tier birthday cake on a lacquered circus
 * drum. The drum has gold hoops, criss-cross gold lacing with brass studs and
 * stars between; the cake is circus-striped below, ivory with dripped icing in
 * the middle and lacquer-red on top, with five striped candles. Lit from above:
 * the tops of the tiers catch the light, the sides roll off 25% darker.
 */
function CakeDrum(p: DrawProps): ReactNode {
  const id = kitId(p, 'btcake');
  const { w, colors: c, light } = p;
  const full = p.detail === 'full';
  const red = c.primary;
  const gold = c.secondary;
  const ivory = mix(c.accent, '#ffffff', 0.35);
  const cx = w / 2;
  // The drum.
  const dRx = 134;
  const dRy = 20;
  const dTop = 298;
  const dBot = 460;
  const hoop = 15;
  const studs: string[] = [];
  const lace: string[] = [];
  const stars: string[] = [];
  const nZ = 8;
  for (let k = 0; k <= nZ; k++) {
    const s = across(-1 + (2 * k) / nZ);
    const x = cx + s * dRx;
    const up = k % 2 === 0;
    const y = (up ? dTop + hoop + 2 : dBot - hoop - 2) + dRy * front(s);
    lace.push(`${k ? 'L' : 'M'}${r2(x)} ${r2(y)}`);
    if (Math.abs(s) < 0.97) studs.push(dot(x, (up ? dTop + hoop / 2 : dBot - hoop / 2) + dRy * front(s), 4.2));
    if (k < nZ && Math.abs(s) < 0.8) {
      const sm = across(-1 + (2 * k + 1) / nZ);
      const ym = (up ? dBot - 46 : dTop + 46) + dRy * front(sm);
      stars.push(star(cx + sm * dRx, ym, 11 * (1 - 0.35 * Math.abs(sm))));
    }
  }
  // The cake: three tiers on a gold board.
  const tiers = [
    { rx: 112, y0: 208, y1: 286, kind: 'stripes' as const },
    { rx: 86, y0: 140, y1: 208, kind: 'drip' as const },
    { rx: 60, y0: 84, y1: 140, kind: 'lacquer' as const },
  ];
  const tRy = (rx: number) => rx * 0.13;
  const tierNodes = tiers.map((t, i) => {
    const ry = tRy(t.rx);
    const body = t.kind === 'stripes' ? ivory : t.kind === 'drip' ? ivory : red;
    const stripes: string[] = [];
    if (t.kind === 'stripes') {
      const n = 12;
      for (let k = 0; k < n; k += 2) {
        const a = across(-1 + (2 * k) / n);
        const b = across(-1 + (2 * (k + 1)) / n);
        const xa = cx + a * t.rx;
        const xb = cx + b * t.rx;
        stripes.push(P`M${xa} ${t.y0 + ry * front(a)}L${xb} ${t.y0 + ry * front(b)}L${xb} ${t.y1 + ry * front(b)}L${xa} ${t.y1 + ry * front(a)}Z`);
      }
    }
    let drip = '';
    if (t.kind !== 'stripes') {
      const n = t.kind === 'drip' ? 11 : 8;
      const len = t.kind === 'drip' ? 26 : 16;
      drip = P`M${cx - t.rx} ${t.y0}`;
      for (let k = 0; k < n; k++) {
        const s0 = -1 + (2 * k) / n;
        const s1 = -1 + (2 * (k + 1)) / n;
        const xm = cx + across((s0 + s1) / 2) * t.rx;
        const ym = t.y0 + ry * front((s0 + s1) / 2) + 8 + rand(k, p.seed + i) * len;
        const x1 = cx + across(s1) * t.rx;
        const y1 = t.y0 + ry * front(s1) + 6;
        drip += P`Q${xm - 5} ${t.y0 + ry * front((s0 + s1) / 2) + 4} ${xm - 3} ${ym - 3}A3 3 0 0 0 ${xm + 3} ${ym - 3}Q${xm + 5} ${y1} ${x1} ${y1}`;
      }
      drip += P`A${t.rx} ${ry} 0 0 0 ${cx - t.rx} ${t.y0}Z`;
    }
    // A string of gold beads round the tier's foot: the front rim, dashed into dots (pathLength spaces them evenly).
    const nBeads = Math.round(t.rx / 6);
    return (
      <g key={i}>
        <path d={drumPath(cx, t.rx, t.y0, t.y1, ry)} fill={body} />
        {stripes.length ? <path d={stripes.join('')} fill={red} /> : null}
        {drip ? <path d={drip} fill={t.kind === 'drip' ? red : ivory} /> : null}
        <path d={drumPath(cx, t.rx, t.y0, t.y1, ry)} fill={url(`${id}roll`)} />
        <ellipse cx={r2(cx)} cy={r2(t.y0)} rx={t.rx} ry={r2(ry)} fill={t.kind === 'lacquer' ? tint(red, 0.18) : tint(ivory, 0.4)} />
        {t.kind === 'lacquer' ? <ellipse cx={r2(cx)} cy={r2(t.y0)} rx={r2(t.rx - 6)} ry={r2(ry - 2)} fill="none" stroke={url(`${id}gold`)} strokeWidth={3} /> : null}
        {t.kind === 'drip' && full ? <path d={[-0.5, 0, 0.5].map((s) => star(cx + across(s) * t.rx, (t.y0 + t.y1) / 2 + 12 + ry * front(s), 8)).join('')} fill={url(`${id}gold`)} /> : null}
        {full ? <path d={P`M${cx - t.rx} ${t.y1 - 1}A${t.rx} ${ry} 0 0 0 ${cx + t.rx} ${t.y1 - 1}`} pathLength={nBeads} stroke={url(`${id}gold`)} strokeWidth={7.2} strokeLinecap="round" strokeDasharray="0 1" fill="none" /> : null}
      </g>
    );
  });
  // Five striped candles on the top tier.
  const candles = [-0.62, -0.31, 0, 0.31, 0.62].map((s, k) => ({ x: cx + s * 46, y: 84 + tRy(60) * front(s) * 0.6 - 2 - (k === 2 ? 4 : 0) }));
  const cH = 34;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}gold`} stops={metalLit(gold, light.from)} x1={cx - dRx} y1={0} x2={cx + dRx} y2={40} />
        <Lin id={`${id}body`} stops={bodyStops(red, light.from)} x1={cx - dRx} y1={0} x2={cx + dRx} y2={0} />
        <Lin id={`${id}roll`} stops={awayStops(light.from, 0.32)} bbox x2={1} />
        <Lin id={`${id}skin`} stops={[[0, tint(ivory, 0.5)], [1, mix(ivory, gold, 0.25)]]} bbox y2={1} />
        <Glow id={`${id}sh`} color="#000000" core="#000000" a={0.6} />
        <Glow id={`${id}halo`} color={light.color} core={tint(light.color, 0.6)} a={0.75} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} />
      </defs>
      <ellipse cx={r2(cx)} cy={r2(dBot + 2)} rx={r2(dRx * 1.25)} ry={14} fill={url(`${id}sh`)} />
      {/* The drum. */}
      <path d={drumPath(cx, dRx, dTop, dBot, dRy)} fill={url(`${id}body`)} />
      {full ? <path d={stars.join('')} fill={mix(c.accent, gold, 0.3)} opacity={0.9} /> : null}
      <path d={lace.join('')} fill="none" stroke={shade(gold, 0.45)} strokeWidth={7} strokeLinejoin="round" opacity={0.6} />
      <path d={lace.join('')} fill="none" stroke={url(`${id}gold`)} strokeWidth={4.5} strokeLinejoin="round" />
      <path d={bandPath(cx, dRx, dTop, dTop + hoop, dRy)} fill={url(`${id}gold`)} />
      <path d={bandPath(cx, dRx, dBot - hoop, dBot, dRy)} fill={url(`${id}gold`)} />
      <path d={studs.join('')} fill={tint(gold, 0.45)} stroke={shade(gold, 0.35)} strokeWidth={1} />
      <path d={drumPath(cx, dRx, dTop, dBot, dRy)} fill={url(`${id}roll`)} opacity={0.6} />
      <ellipse cx={r2(cx)} cy={dTop} rx={dRx} ry={dRy} fill={url(`${id}skin`)} />
      <ellipse cx={r2(cx)} cy={dTop} rx={dRx} ry={dRy} fill="none" stroke={url(`${id}gold`)} strokeWidth={4} />
      {/* The cake board and the tiers, bottom up. */}
      <ellipse cx={r2(cx)} cy={290} rx={124} ry={16} fill={url(`${id}gold`)} />
      {tierNodes}
      {/* Candles, flames and their halo. */}
      <ellipse cx={r2(cx)} cy={46} rx={74} ry={44} fill={url(`${id}halo`)} />
      {candles.map((k, i) => (
        <g key={i}>
          <rect x={r2(k.x - 3.5)} y={r2(k.y - cH)} width={7} height={cH} rx={2} fill={ivory} />
          <path d={P`M${k.x - 3.5} ${k.y - cH + 8}L${k.x + 3.5} ${k.y - cH + 3}M${k.x - 3.5} ${k.y - cH + 18}L${k.x + 3.5} ${k.y - cH + 13}M${k.x - 3.5} ${k.y - cH + 28}L${k.x + 3.5} ${k.y - cH + 23}`} stroke={i % 2 ? gold : red} strokeWidth={2.6} />
          <FlameAt href={`${id}f`} x={k.x} y={k.y - cH - 1} s={17} skew={(rand(i, p.seed) - 0.5) * 10} />
        </g>
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── BalloonArch ───────────────────────────

/**
 * A half arch of balloons (220×420): clusters of three along a curve rising
 * from a weighted base on the outer side and arching in over the ring, in the
 * palette (primary, gold foil, ivory, a tint), each lit from the key light,
 * with a gold star balloon at the inner tip. Drawn per side (never flipped):
 * the highlights stay where the light is.
 */
function BalloonArch(p: DrawProps & { side: Side }): ReactNode {
  const id = kitId(p, `btarch${p.side}`);
  const { w, h, colors: c, light } = p;
  const L = p.side === 'left';
  const X = (x: number) => (L ? x : w - x);
  const curve: Segment = [[X(36), h - 10], [X(6), h * 0.42], [X(70), h * 0.06], [X(w - 16), h * 0.15]];
  const fills = [c.primary, c.secondary, mix(c.accent, '#ffffff', 0.3), tint(c.primary, 0.4)];
  const hx = light.from === 'left' ? '36%' : light.from === 'right' ? '64%' : '50%';
  const balloons: Array<{ x: number; y: number; r: number; f: number; back: boolean }> = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = 0.04 + (0.9 * i) / (N - 1);
    const q = onCubic(curve, t);
    const nx = -q.ty;
    const ny = q.tx;
    const base = 27 - t * 6;
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 0.95 * base;
      const jt = (rand(i * 3 + k, p.seed) - 0.5) * base * 0.6;
      balloons.push({ x: q.x + nx * off + q.tx * jt, y: q.y + ny * off + q.ty * jt, r: base * (0.82 + rand(i * 3 + k, p.seed + 1) * 0.3), f: (i + k * 2) % 4, back: k !== 1 && rand(i, p.seed + 3) > 0.5 });
    }
  }
  balloons.sort((a, b) => Number(b.back) - Number(a.back));
  const tip = onCubic(curve, 1);
  const baseX = X(36);
  return (
    <KitSvg p={p}>
      <defs>
        {fills.map((f, k) => (
          <radialGradient key={k} id={`${id}b${k}`} cx={hx} cy="30%" r="72%">
            <stop offset="0" stopColor={tint(f, k === 1 ? 0.62 : 0.42)} />
            <stop offset="0.45" stopColor={f} />
            <stop offset="1" stopColor={shade(f, 0.32)} />
          </radialGradient>
        ))}
        <Lin id={`${id}gold`} stops={metalLit(c.secondary, light.from)} bbox x2={1} y2={1} />
      </defs>
      {/* Ribbons from the weight up into the first cluster. */}
      <path d={P`M${baseX} ${h - 26}C${baseX + (L ? 14 : -14)} ${h - 60} ${baseX - (L ? 10 : -10)} ${h - 90} ${baseX + (L ? 4 : -4)} ${h - 120}M${baseX} ${h - 26}C${baseX - (L ? 12 : -12)} ${h - 70} ${baseX + (L ? 16 : -16)} ${h - 96} ${baseX + (L ? 10 : -10)} ${h - 128}`} stroke={c.secondary} strokeWidth={1.6} fill="none" />
      {/* Back balloons, then the front ones; knots and the front ones' sheen are one path each (markup budget). */}
      {balloons.map((b, k) => (
        <ellipse key={k} cx={r2(b.x)} cy={r2(b.y)} rx={r2(b.r)} ry={r2(b.r * 1.1)} fill={url(`${id}b${b.f}`)} opacity={b.back ? 0.88 : undefined} />
      ))}
      <path d={balloons.map((b) => P`M${b.x - 2.4} ${b.y + b.r * 1.1 + 3}L${b.x} ${b.y + b.r * 1.1 - 0.5}L${b.x + 2.4} ${b.y + b.r * 1.1 + 3}Z`).join('')} fill={shade(c.secondary, 0.35)} opacity={0.8} />
      <path d={balloons.filter((b) => !b.back).map((b) => oval(b.x + (L ? -1 : 1) * b.r * 0.12, b.y - b.r * 0.55, b.r * 0.3, b.r * 0.13)).join('')} fill="#ffffff" opacity={0.5} />
      {/* A gold star balloon at the inner tip, on its ribbon. */}
      <path d={P`M${tip.x} ${tip.y + 16}C${tip.x + (L ? 8 : -8)} ${tip.y + 40} ${tip.x - (L ? 6 : -6)} ${tip.y + 60} ${tip.x + (L ? 2 : -2)} ${tip.y + 84}`} stroke={c.secondary} strokeWidth={1.4} fill="none" />
      <path d={star(tip.x, tip.y - 6, 24, 0.5)} fill={url(`${id}gold`)} stroke={shade(c.secondary, 0.3)} strokeWidth={1} />
      {/* The weight: a small gold-banded box. */}
      <path d={P`M${baseX - 16} ${h - 28}H${baseX + 16}V${h - 2}H${baseX - 16}Z`} fill={c.primary} />
      <path d={P`M${baseX - 16} ${h - 18}H${baseX + 16}M${baseX} ${h - 28}V${h - 2}`} stroke={url(`${id}gold`)} strokeWidth={4} />
    </KitSvg>
  );
}

// ─────────────────────────── Presents ───────────────────────────

/** A stack of two wrapped presents (120×120): the lower box striped, the upper polka-dot, gold ribbons and a bow; seen from just above (top faces show). */
function Presents(p: DrawProps & { side: Side }): ReactNode {
  const id = kitId(p, `btgift${p.side}`);
  const { w, h, colors: c, light } = p;
  const L = p.side === 'left';
  const red = c.primary;
  const ivory = mix(c.accent, '#ffffff', 0.3);
  const gold = c.secondary;
  const full = p.detail === 'full';
  const box = (x: number, y: number, bw: number, bh: number, top: number, paper: string, ink: string, kind: 'stripe' | 'dot', k: number) => {
    const marks: string[] = [];
    if (full && kind === 'stripe') for (let s = x + 6; s < x + bw - 4; s += 14) marks.push(P`M${s} ${y}h6v${bh}h-6Z`);
    // Polka dots: rows of a dashed line with round caps, every other row shifted half a step.
    const rows: string[] = [];
    if (full && kind === 'dot') for (let r = 0, yy = y + 8; yy < y + bh - 4; r++, yy += 12) rows.push(P`M${x + 7 + (r % 2) * 6} ${yy}H${x + bw - 4}`);
    return (
      <g key={k}>
        <path d={P`M${x} ${y}H${x + bw}V${y + bh}H${x}Z`} fill={paper} />
        {marks.length ? <path d={marks.join('')} fill={ink} opacity={0.85} /> : null}
        {rows.length ? <path d={rows.join('')} stroke={ink} strokeWidth={4.8} strokeLinecap="round" strokeDasharray="0 12" fill="none" opacity={0.85} /> : null}
        <path d={P`M${x} ${y}H${x + bw}V${y + bh}H${x}Z`} fill={url(`${id}roll`)} />
        <path d={P`M${x} ${y}L${x + 8} ${y - top}H${x + bw - 8}L${x + bw} ${y}Z`} fill={tint(paper, 0.22)} />
        <path d={P`M${x + bw / 2 - 4} ${y - top}h8v${top + bh}h-8Z`} fill={url(`${id}gold`)} />
        <path d={P`M${x + 4} ${y - top / 2 - 2}H${x + bw - 4}V${y - top / 2 + 2}H${x + 4}Z`} fill={url(`${id}gold`)} />
      </g>
    );
  };
  const bx = L ? 6 : 18;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}gold`} stops={metalLit(gold, light.from)} x1={0} y1={0} x2={w} y2={20} />
        <Lin id={`${id}roll`} stops={awayStops(light.from, 0.28)} bbox x2={1} />
        <Glow id={`${id}sh`} color="#000000" core="#000000" a={0.5} />
      </defs>
      <ellipse cx={r2(w / 2)} cy={r2(h - 4)} rx={r2(w * 0.5)} ry={6} fill={url(`${id}sh`)} />
      {box(bx, h - 58, 96, 56, 12, L ? red : ivory, L ? ivory : red, 'stripe', 0)}
      {box(bx + (L ? 30 : 14), h - 98, 54, 38, 9, L ? ivory : gold, L ? red : ivory, 'dot', 1)}
      {/* The bow on the top box. */}
      {(() => {
        const x = bx + (L ? 30 : 14) + 27;
        const y = h - 106;
        return (
          <g>
            <path d={P`M${x} ${y}C${x - 22} ${y - 18} ${x - 26} ${y + 4} ${x} ${y}ZM${x} ${y}C${x + 22} ${y - 18} ${x + 26} ${y + 4} ${x} ${y}Z`} fill={url(`${id}gold`)} stroke={shade(gold, 0.35)} strokeWidth={0.8} />
            <circle cx={r2(x)} cy={r2(y)} r={3.4} fill={tint(gold, 0.3)} />
          </g>
        );
      })()}
    </KitSvg>
  );
}

// ─────────────────────────── SpotBeam ───────────────────────────

/**
 * A spotlight's slanted cone (role light): from a narrow throat high on the
 * outer side down across the ring to a wide foot on the inner side, feathered
 * in three nested layers, brightest at the foot so it never lights the words.
 */
function SpotBeam(p: DrawProps & { side: Side }): ReactNode {
  const id = kitId(p, `btspot${p.side}`);
  const { w, h } = p;
  const L = p.side === 'left';
  const X = (x: number) => (L ? x : w - x);
  const col = mix(p.light.color, '#ffffff', 0.2);
  const layers: string[] = [];
  // The foot lands past the middle of the ring, so the two beams cross on the cake.
  const fx = w * 0.84;
  const fw = w * 0.17;
  for (let l = 0; l < 3; l++) {
    const f = 1 - l * 0.3;
    const t0 = 22;
    const t1 = 22 + 26 * f;
    layers.push(P`M${X(t0)} 0L${X(t1)} 0L${X(fx + fw * f)} ${h}L${X(fx - fw * f)} ${h}Z`);
  }
  const stops: Stop[] = [
    [0, col, 0],
    [0.4, col, 0.03],
    [0.7, col, 0.12],
    [1, col, 0.24],
  ];
  const motes: string[] = [];
  if (p.detail === 'full') {
    for (let i = 0; i < 10; i++) {
      const t = 0.3 + rand(i, p.seed) * 0.68;
      const cxm = 35 + (fx - 35) * t;
      const half = (13 + fw * t) * 0.7;
      motes.push(dot(X(cxm + (rand(i, p.seed + 1) - 0.5) * 2 * half), h * t, 1 + rand(i, 5) * 1.3));
    }
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={stops} x1={0} y1={0} x2={0} y2={h} />
        <Glow id={`${id}p`} color={col} core={col} a={0.4} />
      </defs>
      {/* Three nested cones as separate paths, so their light adds up toward the core. */}
      {layers.map((d, k) => (
        <path key={k} d={d} fill={url(`${id}g`)} />
      ))}
      <ellipse cx={r2(X(fx))} cy={r2(h - 8)} rx={r2(fw * 1.3)} ry={16} fill={url(`${id}p`)} />
      {motes.length ? <path d={motes.join('')} fill={col} opacity={0.45} /> : null}
    </KitSvg>
  );
}

/**
 * The kit's striped canvas wall in the evening: the canvas above the valance falls into the tent's dusk (the rig's
 * light reaches the ring, not the roof), and the near end darkens toward the door, so the stripes frame the ring
 * instead of filling a desktop with flat pink.
 */
function TentWall(p: DrawProps): ReactNode {
  const id = kitId(p, 'btwall');
  const { w, h } = p;
  const eye = p.eyeLine ?? h * 0.53;
  const dusk = mix(p.colors.primary, '#000000', 0.62);
  const near = Math.min(1300, w);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Wall {...p} variant="tentStripes" />
      <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <Lin id={`${id}u`} stops={[[0, dusk, 0.82], [(eye - 120) / h, dusk, 0.5], [(eye + 40) / h, dusk, 0.12], [1, dusk, 0.2]]} x1={0} y1={0} x2={0} y2={h} />
          <Lin id={`${id}n`} stops={[[0, dusk, 0.6], [1, dusk, 0]]} x1={0} y1={0} x2={near} y2={0} />
        </defs>
        <rect width={r2(w)} height={r2(h)} fill={url(`${id}u`)} />
        <rect width={r2(near)} height={r2(h)} fill={url(`${id}n`)} />
      </svg>
    </div>
  );
}

// ─────────────────────────── the set ───────────────────────────

/**
 * What shows where no plane is drawn: only outside the tent (the far poses, the
 * pull-away, above the flap at the opening). A night over the fairground: deep
 * primary darkening to the zenith, the tent's own warm glow low in the middle,
 * and a few stars high up, where the canopy hides them at rest.
 */
function tentSky(ctx: SetContext): string {
  const c = ctx.colors;
  const night = mix(mix(c.primary, c.text, 0.55), '#000000', 0.55);
  // Stars as rgba (they are points, not the sky's tone).
  const n = Number.parseInt(mix(c.background, c.secondary, 0.25).slice(1), 16);
  const star = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.85)`;
  const stars = ([[12, 6], [27, 13], [44, 4], [63, 10], [81, 5], [91, 15]] as const).map(([x, y]) => `radial-gradient(circle at ${x}% ${y}%, ${star} 0 1.2px, transparent 1.8px)`).join(', ');
  return `${stars}, radial-gradient(ellipse 75% 45% at 50% 60%, ${mix(c.primary, '#000000', 0.45)} 0%, ${mix(c.primary, '#000000', 0.66)} 55%, ${night} 100%)`;
}

export const bigTop: StageSetFactory = (ctx) => {
  const warm = '#fff1cc';
  const pieces: Piece[] = [
    // Planes: canvas ceiling and walls, the sawdust ring floor, the far wall.
    { kind: 'plane', id: 'canopy', art: 'ceiling:tentStripes', role: 'architecture', quiet: true, plane: ceiling({ x0: 250, x1: 950, y: -200, dNear: 400, dFar: 2800 }), draw: drawWith(Ceiling, { variant: 'tentStripes' }) },
    { kind: 'plane', id: 'canvas-l', art: 'wall:tentStripes', role: 'architecture', plane: wall('left', { x: 250, yTop: -200, dNear: 400, dFar: 2800 }), draw: TentWall },
    { kind: 'plane', id: 'canvas-r', art: 'wall:tentStripes', role: 'architecture', plane: wall('right', { x: 950, yTop: -200, dNear: 400, dFar: 2800 }), draw: TentWall },
    {
      kind: 'plane',
      id: 'ring',
      art: 'floor:sawdust',
      role: 'architecture',
      plane: floor({ x0: 250, x1: 950, dNear: 400, dFar: 2800 }),
      draw: drawWith(Floor, {
        variant: 'sawdust',
        ring: true,
        runner: true,
        pools: [
          { x: 600, d: 1900, r: 360, color: warm },
          { x: 578, d: 1860, r: 150, color: warm },
          { x: 622, d: 1860, r: 150, color: warm },
          { x: 600, d: 2700, r: 220, color: warm },
        ],
      }),
    },
    { kind: 'plane', id: 'tent-back', art: 'tentBack', role: 'architecture', quiet: true, plane: back({ x0: 250, x1: 950, yTop: -200, d: 2800 }), draw: TentBack },
    // King-pole guys: two striped poles either side of the ring.
    { kind: 'prop', id: 'pole-l', art: 'pole:striped', role: 'architecture', quiet: true, ...billboard({ x: 290, d: 1200, w: 40, h: 1000 }), draw: drawWith(Pole, { variant: 'striped' }) },
    { kind: 'prop', id: 'pole-r', art: 'pole:striped', role: 'architecture', quiet: true, ...billboard({ x: 910, d: 1200, w: 40, h: 1000 }), draw: drawWith(Pole, { variant: 'striped' }) },
    // The crown band: three swags of bunting near and high.
    { kind: 'prop', id: 'bunting-1', art: 'bunting', role: 'hanging', ...hang({ x: 600, d: 600, w: 700, h: 120, top: -150 }), draw: illus('bunting'), motion: { kind: 'sway', amp: 0.8, period: 5 }, buildIn: 'drop' },
    { kind: 'prop', id: 'bunting-2', art: 'bunting', role: 'hanging', ...hang({ x: 600, d: 760, w: 700, h: 100, top: -196 }), draw: illus('bunting'), motion: { kind: 'sway', amp: 0.8, period: 5.6, phase: 0.3 }, buildIn: 'drop' },
    { kind: 'prop', id: 'bunting-3', art: 'bunting', role: 'hanging', ...hang({ x: 600, d: 920, w: 700, h: 70, top: -197 }), draw: illus('bunting'), motion: { kind: 'sway', amp: 0.8, period: 6.2, phase: 0.6 }, buildIn: 'drop' },
    // The spotlights crossing on the cake.
    { kind: 'prop', id: 'spot-l', art: 'spotBeam', role: 'light', ...hang({ x: 470, d: 1960, w: 440, h: 870, top: -70 }), draw: (p) => <SpotBeam {...p} side="left" />, motion: { kind: 'pulse', amp: 0.3, period: 4 } },
    { kind: 'prop', id: 'spot-r', art: 'spotBeam', role: 'light', ...hang({ x: 730, d: 1960, w: 440, h: 870, top: -70 }), draw: (p) => <SpotBeam {...p} side="right" />, motion: { kind: 'pulse', amp: 0.3, period: 4, phase: 0.5 } },
    // Balloon half-arches framing the ring.
    { kind: 'prop', id: 'arch-l', art: 'balloonArch', role: 'prop', ...billboard({ x: 380, d: 1700, w: 220, h: 420 }), draw: (p) => <BalloonArch {...p} side="left" />, motion: { kind: 'bob', amp: 6, period: 5 }, buildIn: 'rise' },
    { kind: 'prop', id: 'arch-r', art: 'balloonArch', role: 'prop', ...billboard({ x: 820, d: 1700, w: 220, h: 420 }), draw: (p) => <BalloonArch {...p} side="right" />, motion: { kind: 'bob', amp: 6, period: 5, phase: 0.45 }, buildIn: 'rise' },
    // The focal piece: the cake on its circus drum, in the middle of the ring.
    { kind: 'prop', id: 'cake-drum', art: 'cakeDrum', role: 'focal', ...billboard({ x: 600, d: 1900, w: 300, h: 470 }), draw: CakeDrum, buildIn: 'rise' },
    // Presents and friends at the foot of the drum.
    { kind: 'prop', id: 'gifts-l', art: 'presents', role: 'prop', ...billboard({ x: 455, d: 1550, w: 120, h: 120 }), draw: (p) => <Presents {...p} side="left" />, buildIn: 'bloom' },
    { kind: 'prop', id: 'gifts-r', art: 'presents', role: 'prop', ...billboard({ x: 745, d: 1550, w: 120, h: 120 }), draw: (p) => <Presents {...p} side="right" />, buildIn: 'bloom' },
    { kind: 'prop', id: 'teddy', art: 'teddyBear', role: 'prop', ...billboard({ x: 780, d: 1450, w: 120, h: 130 }), draw: illus('teddyBear'), buildIn: 'bloom' },
    { kind: 'prop', id: 'unicorn', art: 'unicorn', role: 'prop', ...billboard({ x: 420, d: 1450, w: 120, h: 140 }), draw: illus('unicorn'), buildIn: 'bloom' },
    // Lights: the candles' glow and the ring's pool (with its bloom).
    { kind: 'light', id: 'glow-candles', art: 'glow', role: 'light', at: { x: 600, y: 370, z: -1890 }, r: 70, color: '#ffd27a', strength: 0.6, motion: { kind: 'flicker', amp: 0.6, period: 1.6 }, buildIn: 'light' },
    { kind: 'light', id: 'glow-ring', art: 'glow', role: 'light', at: { x: 600, y: 790, z: -1900 }, r: 260, color: warm, strength: 0.35, bloom: true, buildIn: 'light' },
  ];
  return {
    name: 'bigTop',
    sky: tentSky(ctx),
    light: { from: 'above', color: warm, rim: '#ffd27a' },
    fog: { color: '#2a1418', near: 1400, far: 3000, max: 0.4 },
    veil: 0.35,
    focus: { x: 600, y: 600, z: -1900 },
    pieces,
    covers: { gate: 'tentFlap', door: 'ballroom', silk: 'velvet', card: 'popup' },
    particles: { count: 32, dNear: 700, dFar: 2300 },
  };
};
