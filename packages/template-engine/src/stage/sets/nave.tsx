import type { ReactNode } from 'react';
import { mix } from '../../theme';
import { shade, tint } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { back, billboard, ceiling, floor, hang, wall } from '../planes';
import { Ceiling, drawWith, Floor, illus, LampStand, Wall } from '../kit';
import { FlameAt, FlameDef, Glow, kitId, KitSvg, Lin, metalLit, Rim } from '../kit/architecture';
import type { DrawProps, Piece, StageSetFactory } from '../types';

/** A kit piece drawn in this chapel's materials: the palette with some roles swapped for warm stone or limed oak. */
const inMaterial = (draw: (p: DrawProps) => ReactNode, over: (c: DrawProps['colors']) => Partial<DrawProps['colors']>) => (p: DrawProps) => draw({ ...p, colors: { ...p.colors, ...over(p.colors) } });

/**
 * T04 · Down the Aisle (`down-the-aisle`, final.md §5.3): the `nave` stage.
 *
 * A chapel nave at golden hour, seen from the back of the aisle: a flagstone
 * floor with a runner strewn with petals, three rows of oak pews dressed with
 * lily posies at the aisle ends, lancet windows down both walls pouring warm
 * light across the aisle from the right, a timber vault, and at the far end the
 * altar on its steps (linen, frontal, candles, lilies) against the chancel wall
 * with its lancet triple and rose window. Wedding bells hang in the crown band.
 *
 * Set-local pieces (§6.4): Pew (here a row of two, the aisle between them),
 * Altar, ChancelWall. Nothing is drawn at module load.
 */

/** Path data with numbers to a tenth of a unit (boxes here are hundreds of units: a tenth is invisible, and keeps the markup small). */
const P = (s: TemplateStringsArray, ...v: number[]): string => {
  let out = s[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(Math.round((v[i] ?? 0) * 10) / 10) + (s[i + 1] ?? '');
  return out;
};

const GOLD = '#ffd98a';
const ROSE = '#ffe6c0';

// ─────────────────────────── shared bits ───────────────────────────

/** A pointed (lancet) arch outline from x0 to x1, springing at ys, closed down to yb. */
const lancet = (x0: number, x1: number, ys: number, yb: number, r = 0.9) => {
  const span = x1 - x0;
  const R = span * r;
  const cx = (x0 + x1) / 2;
  // The apex of two arcs of radius R through the springers meeting on the centre line.
  const off = R - span / 2;
  const apex = ys - Math.sqrt(Math.max(0, R * R - off * off));
  return { d: P`M${x0} ${yb}V${ys}A${R} ${R} 0 0 1 ${cx} ${apex}A${R} ${R} 0 0 1 ${x1} ${ys}V${yb}Z`, apex };
};

/** An oak tone for pews and the altar's woodwork: NATURE's clay toward the palette's text, warmed by the metal. */
const oakOf = (p: DrawProps) => mix(mix(p.nature.clayDark, p.colors.text, 0.22), p.colors.secondary, 0.2);
/** Warm limestone from the paper colours. */
const stoneOf = (p: DrawProps) => mix(p.colors.surface, p.colors.secondary, 0.16);

/**
 * One lily trumpet as path data (many go into one path): its throat at (x, y),
 * opening toward (dx, dy) by `s`, two outer petals flaring back at the tips and
 * the centre petal between them. `vein` gives the centre line for a stroke.
 */
function lilyD(x: number, y: number, dx: number, dy: number, s: number): { outer: string; inner: string; vein: string } {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  const at = (f: number, g: number) => [x + ux * s * f + nx * s * g, y + uy * s * f + ny * s * g] as const;
  const petal = (side: number, spread: number, reach: number) => {
    const [ax, ay] = at(0.45, side * spread * 0.35);
    const [bx, by] = at(reach, side * spread);
    const [cx, cy] = at(reach * 0.98, side * spread * 0.55);
    const [ex, ey] = at(0.5, side * spread * 0.08);
    return P`M${x} ${y}Q${ax} ${ay} ${bx} ${by}Q${cx} ${cy} ${ex} ${ey}Z`;
  };
  const [vx, vy] = at(0.8, 0);
  return { outer: petal(1, 0.42, 1) + petal(-1, 0.42, 1), inner: petal(1, 0.16, 1.02) + petal(-1, 0.16, 1.02), vein: P`M${x} ${y}L${vx} ${vy}` };
}

/** Lilies drawn from lilyD specs: one path for the outer petals, one for the paler inner ones, one for the veins. */
function lilies(specs: Array<[number, number, number, number, number]>, petal: string, line: string, key: string): ReactNode {
  const ds = specs.map(([x, y, dx, dy, s]) => lilyD(x, y, dx, dy, s));
  const sw = specs.reduce((a, sp) => a + sp[4], 0) / Math.max(1, specs.length);
  return (
    <g key={key}>
      <path d={ds.map((d) => d.outer).join('')} fill={petal} />
      <path d={ds.map((d) => d.inner).join('')} fill={tint(petal, 0.4)} />
      <path d={ds.map((d) => d.vein).join('')} stroke={line} strokeWidth={r2(sw * 0.05)} opacity={0.5} fill="none" />
    </g>
  );
}

/** A leaf as path data from its base (x, y) toward (dx, dy), `len` long and `w` wide (many go into one path). */
function leafD(x: number, y: number, dx: number, dy: number, len: number, w: number): string {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const tx = x + ux * len;
  const ty = y + uy * len;
  const mx = x + ux * len * 0.5;
  const my = y + uy * len * 0.5;
  return P`M${x} ${y}Q${mx - uy * w} ${my + ux * w} ${tx} ${ty}Q${mx + uy * w} ${my - ux * w} ${x} ${y}Z`;
}

// ─────────────────────────── Pew row ───────────────────────────

/**
 * A row of two oak pews seen from behind (the aisle between them, 160 wide,
 * at the box's centre): capping rail, moulded back panels, the shadowed gap
 * under the seat, carved bench ends with pointed poppyheads at the aisle, and
 * a posy of white lilies with a satin bow tied to each aisle end.
 */
function PewRow(p: DrawProps & { aisle?: number }) {
  const { w, h } = p;
  const id = kitId(p, 'navePew');
  const aisle = p.aisle ?? 160;
  const pw = (w - aisle) / 2;
  const oak = oakOf(p);
  const lit = p.light.from === 'right';
  const satin = p.colors.accent;
  const petal = mix(p.nature.pearl, p.colors.background, 0.3);
  const leaf = p.nature.leaf;
  const full = p.detail === 'full';
  const top = h * 0.14;
  const rail = h * 0.08;
  const backBottom = h * 0.62;

  const pew = (x0: number, side: 'left' | 'right', part: 'shadow' | 'back' | 'ends' | 'front'): ReactNode => {
    const x1 = x0 + pw;
    const endW = 20;
    const aisleX = side === 'left' ? x1 - endW : x0;
    const wallX = side === 'left' ? x0 : x1 - 14;
    const panels = 4;
    const inner0 = side === 'left' ? x0 + 16 : x0 + endW + 6;
    const inner1 = side === 'left' ? x1 - endW - 6 : x1 - 16;
    const pwI = (inner1 - inner0) / panels;
    const ppy0 = top + rail + 8;
    const ppy1 = backBottom - 10;
    const k = side === 'left' ? 'l' : 'r';
    // The posy hangs on the bench end's aisle face, toward the aisle.
    const px = side === 'left' ? x1 + 4 : x0 - 4;
    const dir = side === 'left' ? 1 : -1;
    const py = top + 30;
    const lx = side === 'left' ? x1 + 18 : x0 - 18;
    if (part === 'shadow') {
      // The floor shadow, longer away from the key light.
      return <path key={`s${k}`} d={P`M${x0 - (lit ? 10 : 0)} ${h - 6}H${x1 + (lit ? 0 : 10)}L${x1 + (lit ? -6 : 16)} ${h}H${x0 - (lit ? 16 : 0)}Z`} fill="#000000" opacity={0.2} />;
    }
    if (part === 'back') {
      // The gap under the seat (dark, the seat lip, the kneeler rail), the back and its moulded panels with blind lancets.
      const xs = Array.from({ length: panels }, (_, i) => [inner0 + i * pwI + 4, inner0 + i * pwI + pwI - 4] as const);
      return (
        <g key={`b${k}`}>
          <rect x={r2(x0 + 6)} y={r2(backBottom)} width={r2(pw - 12)} height={r2(h - 6 - backBottom)} fill={shade(oak, 0.5)} />
          <rect x={r2(x0 + 6)} y={r2(backBottom)} width={r2(pw - 12)} height={5} fill={shade(oak, 0.3)} />
          <rect x={r2(x0 + 10)} y={r2(h - 22)} width={r2(pw - 20)} height={7} fill={shade(oak, 0.42)} />
          <rect x={r2(x0 + 4)} y={r2(top + rail)} width={r2(pw - 8)} height={r2(backBottom - top - rail)} fill={`url(#${id}b)`} />
          <path d={xs.map(([a, b]) => P`M${a} ${ppy0}H${b}V${ppy1}H${a}Z`).join('')} fill={shade(oak, 0.12)} />
          <path d={xs.map(([a, b]) => P`M${a} ${ppy1}V${ppy0}H${b}`).join('')} stroke={shade(oak, 0.38)} strokeWidth={1.6} fill="none" />
          <path d={xs.map(([a, b]) => P`M${b} ${ppy0}V${ppy1}H${a}`).join('')} stroke={tint(oak, 0.22)} strokeWidth={1.2} fill="none" />
          {full ? <path d={xs.map(([a, b]) => lancet(a + 6, b - 6, ppy0 + 22, ppy1 - 6, 0.8).d).join('')} fill="none" stroke={shade(oak, 0.28)} strokeWidth={1} opacity={0.8} /> : null}
        </g>
      );
    }
    if (part === 'ends') {
      // Lit per side: the capping rail, the plain end at the wall, the carved end at the aisle with its pointed poppyhead.
      return (
        <g key={`e${k}`}>
          <rect x={r2(x0)} y={r2(top)} width={r2(pw)} height={r2(rail)} rx={3} fill={`url(#${id}r)`} />
          <path d={P`M${x0 + 2} ${top + 1}H${x1 - 2}`} stroke={tint(oak, 0.55)} strokeWidth={1.4} opacity={0.8} />
          <rect x={r2(wallX)} y={r2(top - 6)} width={14} height={r2(h - 6 - top + 6)} fill={shade(oak, side === 'left' ? 0.18 : 0.05)} />
          <path d={P`M${aisleX} ${h - 4}V${top - 10}Q${aisleX + endW / 2} ${top - 34} ${aisleX + endW} ${top - 10}V${h - 4}Z`} fill={`url(#${id}e${k})`} />
          <path d={P`M${aisleX + endW / 2} ${top - 40}m-4 6a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`} fill={tint(oak, 0.08)} />
          {full ? <path d={lancet(aisleX + 5, aisleX + endW - 5, top + 20, top + 70, 0.75).d} fill={shade(oak, 0.4)} opacity={0.7} /> : null}
          <Rim p={p} x0={aisleX} x1={aisleX + endW} y0={top - 10} y1={h - 6} />
        </g>
      );
    }
    // In front: a hurricane lantern on the floor at the aisle end (brass cap and foot, glass, a pillar candle) and the
    // posy on the bench end (trailing ivy, three lilies, a satin bow with tails).
    return (
      <g key={`f${k}`}>
        <ellipse cx={r2(lx)} cy={r2(h - 30)} rx={30} ry={34} fill={`url(#${id}lg)`} />
        <path d={P`M${lx - 10} ${h - 4}h20l-2 -5h-16ZM${lx - 8} ${h - 50}h16l-3 -4h-10Z`} fill={`url(#${id}lm)`} />
        <path d={P`M${lx - 9} ${h - 9}C${lx - 13} ${h - 24} ${lx - 13} ${h - 40} ${lx - 7} ${h - 50}H${lx + 7}C${lx + 13} ${h - 40} ${lx + 13} ${h - 24} ${lx + 9} ${h - 9}Z`} fill={mix(GOLD, p.colors.background, 0.55)} opacity={0.55} stroke={tint(p.colors.secondary, 0.3)} strokeWidth={0.8} />
        <rect x={r2(lx - 4)} y={r2(h - 26)} width={8} height={17} fill={p.nature.pearl} />
        <FlameAt href={`${id}f`} x={lx} y={h - 26} s={9} />
        <path d={P`M${lx - 4} ${h - 54}q4 -6 8 0`} fill="none" stroke={`url(#${id}lm)`} strokeWidth={1.2} />
        <path d={P`M${px} ${py + 10}C${px + dir * 6} ${py + 40} ${px - dir * 2} ${py + 70} ${px + dir * 4} ${py + 100}`} stroke={shade(leaf, 0.1)} strokeWidth={3} strokeLinecap="round" fill="none" />
        {full ? <path d={[0, 1, 2, 3, 4].map((i) => leafD(px + dir * (i % 2 ? 1 : 0), py + 22 + i * 16, dir * (i % 2 ? 1 : -1), 0.5, 10, 3)).join('')} fill={leaf} /> : null}
        <ellipse cx={r2(px + dir * 4)} cy={r2(py + 4)} rx={13} ry={9} fill={p.nature.leafDark} />
        {lilies(
          [
            [px + dir * 2, py + 2, dir * 0.6, -0.8, 20],
            [px + dir * 4, py + 6, dir * 1, 0.1, 18],
          ],
          petal,
          p.nature.leaf,
          'ab',
        )}
        {lilies([[px, py + 8, dir * -0.15, 1, 16]], mix(petal, p.colors.accent, 0.25), p.nature.leaf, 'c')}
        <path d={P`M${px} ${py + 14}c${dir * -10} -8 ${dir * -14} 4 ${dir * -2} 5c${dir * 12} 1 ${dir * 12} -12 ${dir * 2} -5Z`} fill={satin} />
        <path d={P`M${px} ${py + 14}c${dir * 10} -8 ${dir * 14} 4 ${dir * 2} 5Z`} fill={shade(satin, 0.12)} />
        <path d={P`M${px} ${py + 16}C${px - dir * 3} ${py + 30} ${px + dir * 2} ${py + 42} ${px - dir * 2} ${py + 54}M${px + dir * 2} ${py + 16}C${px + dir * 6} ${py + 28} ${px + dir * 4} ${py + 38} ${px + dir * 8} ${py + 48}`} stroke={satin} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      </g>
    );
  };
  const bodyX = lit ? [w * 0.1, w * 0.9] : [w * 0.9, w * 0.1];
  // The backs, lanterns and posies are symmetric about the aisle: the right pew's are the left's, mirrored (<use>).
  // What the key light shades (the floor shadows, rails and bench ends) is drawn on each side.
  const mirror = `translate(${r2(w)} 0) scale(-1 1)`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} x1={0} y1={top} x2={0} y2={backBottom} stops={[[0, tint(oak, 0.08)], [0.5, oak], [1, shade(oak, 0.22)]]} />
        <Lin id={`${id}r`} x1={bodyX[1]} y1={0} x2={bodyX[0]} y2={0} stops={[[0, tint(oak, 0.2)], [1, shade(oak, 0.18)]]} />
        <Lin id={`${id}el`} bbox x2={1} stops={[[0, shade(oak, 0.1)], [0.6, tint(oak, 0.12)], [1, tint(oak, 0.26)]]} />
        <Lin id={`${id}er`} bbox x2={1} stops={[[0, shade(oak, 0.3)], [0.5, shade(oak, 0.08)], [1, oak]]} />
        <Lin id={`${id}lm`} bbox x2={1} y2={0.2} stops={metalLit(p.colors.secondary, p.light.from)} />
        <Glow id={`${id}lg`} color={GOLD} core={p.nature.flameCore} a={0.5} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
      </defs>
      {pew(0, 'left', 'shadow')}
      {pew(w - pw, 'right', 'shadow')}
      <g id={`${id}B`}>{pew(0, 'left', 'back')}</g>
      <use href={`#${id}B`} transform={mirror} />
      {pew(0, 'left', 'ends')}
      {pew(w - pw, 'right', 'ends')}
      <g id={`${id}F`}>{pew(0, 'left', 'front')}</g>
      <use href={`#${id}F`} transform={mirror} />
    </KitSvg>
  );
}

// ─────────────────────────── Sunbeam ───────────────────────────

/**
 * Golden-hour light through a window high on the right wall, falling across the
 * nave to a pool on the aisle: a long parallelogram feathered by nested layers
 * (no blur), brightest at the glass, with a few motes of dust turning in it.
 * Role 'light', so it stays faint where the words sit.
 */
function Sunbeam(p: DrawProps & { strength?: number }) {
  const { w, h } = p;
  const id = kitId(p, 'naveBeam');
  const k = p.strength ?? 1;
  const c = mix(GOLD, p.colors.secondary, 0.25);
  // Top: the window's light (right); foot: the pool on the floor (left).
  const quad = (inset: number) => P`M${w - 150 + inset} 0H${w - inset * 0.4}L${270 - inset * 0.7} ${h}H${30 + inset}Z`;
  const motes: string[] = [];
  if (p.detail === 'full') {
    for (let i = 0; i < 14; i++) {
      const t = rand(p.seed, i * 2 + 1);
      const across = rand(p.seed, i * 2 + 2);
      const x = (w - 75) * (1 - t) + 150 * t + (across - 0.5) * 90;
      const y = h * t;
      const r = 1.2 + rand(p.seed, i + 40) * 1.6;
      motes.push(P`M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`);
    }
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}a`} x1={w} y1={0} x2={150} y2={h} stops={[[0, c, 0], [0.16, c, 0.2 * k], [0.6, c, 0.1 * k], [1, c, 0.045 * k]]} />
        <radialGradient id={`${id}p`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={c} stopOpacity={r2(0.3 * k)} />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={quad(0)} fill={`url(#${id}a)`} />
      <path d={quad(28)} fill={`url(#${id}a)`} />
      <path d={quad(56)} fill={`url(#${id}a)`} />
      <ellipse cx={150} cy={r2(h - 14)} rx={150} ry={26} fill={`url(#${id}p)`} />
      {motes.length ? <path d={motes.join('')} fill={tint(c, 0.6)} opacity={0.7} /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── Altar ───────────────────────────

/**
 * The altar on its two stone steps (the runner climbs them): a stone table
 * dressed with a fair linen cloth over a frontal in the primary, edged in foil
 * with a gold quatrefoil rosette and fringe; two brass candlesticks with lit
 * candles and a brass vase of white lilies. Lit from the key side, a rim on the
 * edges away from it. No cross: the emblem lives at the top of the words.
 */
function Altar(p: DrawProps) {
  const { w, h } = p;
  const id = kitId(p, 'naveAltar');
  const cx = w / 2;
  const stone = tint(stoneOf(p), 0.25);
  const frontal = p.colors.primary;
  const gold = p.colors.secondary;
  const linen = mix(p.nature.pearl, p.colors.background, 0.4);
  const full = p.detail === 'full';
  const from = p.light.from;
  // Proportions of the 520×330 brief box.
  const sx = w / 520;
  const sy = h / 330;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;
  const tableX0 = X(108);
  const tableX1 = X(412);
  const tableY = Y(150);
  const stepY0 = Y(268);
  const stepY1 = Y(298);
  const runner0 = cx - X(52);
  const runner1 = cx + X(52);
  const candle = (x: number, i: number) => (
    <g key={`c${i}`}>
      <path d={P`M${x - X(11)} ${tableY}L${x - X(6)} ${tableY - Y(8)}H${x + X(6)}L${x + X(11)} ${tableY}Z`} fill={`url(#${id}m)`} />
      <rect x={r2(x - X(2.5))} y={r2(tableY - Y(38))} width={r2(X(5))} height={r2(Y(30))} fill={`url(#${id}m)`} />
      <ellipse cx={r2(x)} cy={r2(tableY - Y(38))} rx={r2(X(8))} ry={r2(Y(2.5))} fill={`url(#${id}m)`} />
      <rect x={r2(x - X(4.5))} y={r2(tableY - Y(92))} width={r2(X(9))} height={r2(Y(54))} fill={`url(#${id}w)`} />
      <ellipse cx={r2(x)} cy={r2(tableY - Y(118))} rx={r2(X(26))} ry={r2(Y(30))} fill={`url(#${id}g)`} />
      <FlameAt href={`${id}f`} x={x} y={tableY - Y(92)} s={Y(24)} skew={i ? 4 : -3} />
    </g>
  );
  // The vase's lilies: stems, leaves and seven trumpets (white, every third blushed with the accent).
  const stems: string[] = [];
  const white: Array<[number, number, number, number, number]> = [];
  const blush: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6 - 0.5;
    const lx = cx + t * X(70) + (rand(p.seed, i) - 0.5) * X(6);
    const ly = tableY - Y(44) - (0.5 - Math.abs(t)) * Y(44);
    stems.push(P`M${cx} ${tableY - Y(18)}Q${cx + t * X(20)} ${ly + Y(20)} ${lx} ${ly}`);
    (i % 3 === 1 ? blush : white).push([lx, ly, t * 1.4, -0.7, X(15)]);
  }
  const vaseLeaves = [0, 1, 2, 3, 4, 5].map((i) => {
    const t = i / 5 - 0.5;
    return leafD(cx + t * X(16), tableY - Y(24), t * 2, -0.35, X(20), Y(4));
  });
  const flowers = (
    <>
      <path d={stems.join('')} stroke={p.nature.leafDark} strokeWidth={r2(X(1.6))} fill="none" />
      <path d={vaseLeaves.join('')} fill={p.nature.leaf} />
      {lilies(white, linen, p.nature.leaf, 'w')}
      {lilies(blush, mix(linen, p.colors.accent, 0.3), p.nature.leaf, 'b')}
    </>
  );
  const fringe = [];
  if (full) for (let x = X(124); x < X(396); x += X(6)) fringe.push(P`M${x} ${Y(254)}v${Y(8)}`);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} x1={0} y1={0} x2={w} y2={0} stops={from === 'right' ? [[0, shade(stone, 0.2)], [0.5, stone], [1, tint(stone, 0.12)]] : [[0, tint(stone, 0.12)], [0.5, stone], [1, shade(stone, 0.2)]]} />
        <Lin id={`${id}t`} x1={tableX0} y1={0} x2={tableX1} y2={0} stops={from === 'right' ? [[0, shade(frontal, 0.25)], [0.55, frontal], [1, tint(frontal, 0.12)]] : [[0, tint(frontal, 0.12)], [0.45, frontal], [1, shade(frontal, 0.25)]]} />
        <Lin id={`${id}m`} x1={0} y1={0} x2={X(20)} y2={Y(6)} stops={metalLit(gold, from)} />
        <Lin id={`${id}k`} x1={tableX0} y1={0} x2={tableX1} y2={0} stops={metalLit(gold, from)} />
        <Lin id={`${id}w`} x1={0} y1={0} x2={X(9)} y2={0} bbox={false} stops={[[0, tint(linen, 0.2)], [1, shade(linen, 0.12)]]} />
        <Glow id={`${id}g`} color={GOLD} core={p.nature.flameCore} a={0.55} />
        <radialGradient id={`${id}h`} cx="50%" cy="100%" r="60%">
          <stop offset="0" stopColor={GOLD} stopOpacity="0.35" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <FlameDef id={`${id}f`} p={p} seed={p.seed} />
      </defs>
      {/* a warm halo the candles cast on the chancel behind */}
      <ellipse cx={r2(cx)} cy={r2(tableY)} rx={r2(X(250))} ry={r2(Y(150))} fill={`url(#${id}h)`} />
      {/* the steps */}
      <rect x={0} y={r2(stepY1)} width={r2(w)} height={r2(h - stepY1)} fill={`url(#${id}s)`} />
      <rect x={0} y={r2(stepY1)} width={r2(w)} height={r2(Y(5))} fill={tint(stone, 0.35)} />
      <rect x={r2(X(36))} y={r2(stepY0)} width={r2(w - X(72))} height={r2(stepY1 - stepY0)} fill={`url(#${id}s)`} />
      <rect x={r2(X(36))} y={r2(stepY0)} width={r2(w - X(72))} height={r2(Y(5))} fill={tint(stone, 0.35)} />
      <path d={P`M0 ${h - 1}H${w}`} stroke={shade(stone, 0.3)} strokeWidth={2} />
      {/* the runner climbing the steps */}
      <path d={P`M${runner0} ${h}V${stepY1 + Y(5)}H${runner1}V${h}Z`} fill={shade(p.colors.primary, 0.08)} />
      <path d={P`M${runner0} ${stepY1}h${runner1 - runner0}v${Y(5)}h${-(runner1 - runner0)}Z`} fill={tint(p.colors.primary, 0.12)} />
      <path d={P`M${runner0 + X(6)} ${stepY1 - Y(2)}V${stepY0 + Y(5)}H${runner1 - X(6)}V${stepY1 - Y(2)}Z`} fill={shade(p.colors.primary, 0.12)} />
      <path d={P`M${runner0 + X(6)} ${stepY0}h${runner1 - runner0 - X(12)}v${Y(5)}h${-(runner1 - runner0 - X(12))}Z`} fill={tint(p.colors.primary, 0.1)} />
      <path d={P`M${runner0 + X(4)} ${h}V${stepY1 + Y(6)}M${runner1 - X(4)} ${h}V${stepY1 + Y(6)}`} stroke={gold} strokeWidth={r2(X(1.4))} opacity={0.7} />
      {/* the table: a stone mensa, the frontal in the primary edged with foil */}
      <rect x={r2(tableX0)} y={r2(tableY)} width={r2(tableX1 - tableX0)} height={r2(stepY0 - tableY)} fill={`url(#${id}s)`} />
      <rect x={r2(tableX0 + X(12))} y={r2(tableY + Y(22))} width={r2(tableX1 - tableX0 - X(24))} height={r2(stepY0 - tableY - Y(26))} fill={`url(#${id}t)`} />
      <rect x={r2(tableX0 + X(12))} y={r2(tableY + Y(22))} width={r2(tableX1 - tableX0 - X(24))} height={r2(stepY0 - tableY - Y(26))} fill="none" stroke={`url(#${id}k)`} strokeWidth={r2(X(3))} />
      <rect x={r2(tableX0 + X(20))} y={r2(tableY + Y(30))} width={r2(tableX1 - tableX0 - X(40))} height={r2(stepY0 - tableY - Y(42))} fill="none" stroke={`url(#${id}k)`} strokeWidth={r2(X(1))} opacity={0.75} />
      {fringe.length ? <path d={fringe.join('')} stroke={`url(#${id}k)`} strokeWidth={r2(X(1.6))} /> : null}
      {/* the gold quatrefoil rosette */}
      <g transform={`translate(${r2(cx)} ${r2(tableY + Y(66))})`}>
        <path
          d={P`M0 ${-Y(22)}a${X(11)} ${Y(11)} 0 0 1 ${X(11)} ${Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${X(11)} ${Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${-X(11)} ${Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${-X(11)} ${Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${-X(11)} ${-Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${-X(11)} ${-Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${X(11)} ${-Y(11)}a${X(11)} ${Y(11)} 0 0 1 ${X(11)} ${-Y(11)}Z`}
          fill="none"
          stroke={`url(#${id}k)`}
          strokeWidth={r2(X(2.4))}
        />
        <ellipse rx={r2(X(7))} ry={r2(Y(7))} fill={`url(#${id}k)`} />
        {full ? <path d={P`M${-X(40)} 0H${-X(26)}M${X(26)} 0H${X(40)}`} stroke={`url(#${id}k)`} strokeWidth={r2(X(1.5))} /> : null}
      </g>
      {/* the fair linen, hanging over the ends, with a scalloped lace edge */}
      <path d={P`M${tableX0 - X(8)} ${tableY - Y(2)}H${tableX1 + X(8)}V${tableY + Y(70)}H${tableX1 - X(4)}V${tableY + Y(20)}H${tableX0 + X(4)}V${tableY + Y(70)}H${tableX0 - X(8)}Z`} fill={linen} />
      <path d={P`M${tableX0 - X(8)} ${tableY - Y(2)}H${tableX1 + X(8)}V${tableY + Y(3)}H${tableX0 - X(8)}Z`} fill={tint(linen, 0.5)} />
      {full ? (
        <path
          d={Array.from({ length: 26 }, (_, i) => {
            const x = tableX0 + X(4) + i * ((tableX1 - tableX0 - X(8)) / 26);
            return P`M${x} ${tableY + Y(20)}a${X(5.6)} ${Y(4)} 0 0 0 ${(tableX1 - tableX0 - X(8)) / 26} 0`;
          }).join('')}
          fill="none"
          stroke={shade(linen, 0.18)}
          strokeWidth={r2(X(1))}
        />
      ) : null}
      <path d={P`M${tableX0 - X(8)} ${tableY + Y(70)}V${tableY}M${tableX1 + X(8)} ${tableY + Y(70)}V${tableY}`} stroke={shade(linen, 0.2)} strokeWidth={r2(X(1.2))} />
      {/* brass vase of lilies, two candlesticks */}
      <path d={P`M${cx - X(12)} ${tableY}L${cx - X(16)} ${tableY - Y(14)}Q${cx - X(18)} ${tableY - Y(26)} ${cx - X(8)} ${tableY - Y(28)}H${cx + X(8)}Q${cx + X(18)} ${tableY - Y(26)} ${cx + X(16)} ${tableY - Y(14)}L${cx + X(12)} ${tableY}Z`} fill={`url(#${id}m)`} />
      {flowers}
      {candle(X(168), 0)}
      {candle(X(352), 1)}
      <Rim p={p} x0={tableX0 - X(8)} x1={tableX1 + X(8)} y0={tableY} y1={stepY0} />
    </KitSvg>
  );
}

// ─────────────────────────── Chancel wall ───────────────────────────

/**
 * The chancel wall across the nave's end: warm ashlar, a moulded pointed
 * chancel arch whose recess glows gold, a lancet triple of pastel stained glass
 * and above it a rose window, all soft (tone-on-tone) where the words sit.
 */
function ChancelWall(p: DrawProps) {
  const { w, h } = p;
  const id = kitId(p, 'naveChancel');
  const cx = w / 2;
  const stone = stoneOf(p);
  const joint = mix(stone, p.colors.text, 0.14);
  const deep = mix(stone, p.colors.text, 0.2);
  const gold = p.colors.secondary;
  const full = p.detail === 'full';
  // World y −120 is the box's top; heights below are in world units from it.
  const springY = 450;
  const arch = lancet(cx - 215, cx + 215, springY, h - 30, 0.92);
  const glassA = mix(p.colors.accent, GOLD, 0.35);
  const glassR = mix(mix(p.colors.secondary, '#ffffff', 0.35), ROSE, 0.3);
  const glassG = mix(p.colors.primary, '#ffffff', 0.45);
  const glassB = mix(mix(p.colors.primary, p.colors.background, 0.4), '#9fb6d6', 0.35);
  const windows = [
    { x0: cx - 34, x1: cx + 34, ys: 470, yb: 760 },
    { x0: cx - 122, x1: cx - 74, ys: 530, yb: 760 },
    { x0: cx + 74, x1: cx + 122, ys: 530, yb: 760 },
  ];
  const glassWindow = (win: (typeof windows)[number], i: number) => {
    const a = lancet(win.x0, win.x1, win.ys, win.yb, 0.95);
    const bars: string[] = [];
    for (let y = win.ys - 10; y < win.yb; y += 30) bars.push(P`M${win.x0} ${y}H${win.x1}`);
    const mid = (win.x0 + win.x1) / 2;
    const meds: ReactNode[] = [];
    if (full) {
      for (let j = 0, y = win.ys + 20; y < win.yb - 20; y += 60, j++) {
        meds.push(<path key={j} d={P`M${mid} ${y - 14}L${mid + 11} ${y}L${mid} ${y + 14}L${mid - 11} ${y}Z`} fill={[glassR, glassG, glassA, glassB][(i + j) % 4]} opacity={0.9} />);
      }
    }
    return (
      <g key={i}>
        <ellipse cx={r2(mid)} cy={r2((a.apex + win.yb) / 2)} rx={r2((win.x1 - win.x0) * 1.6)} ry={r2((win.yb - a.apex) * 0.75)} fill={`url(#${id}h)`} />
        <path d={a.d} fill={`url(#${id}gl)`} stroke={deep} strokeWidth={7} />
        {meds}
        <path d={bars.join('') + P`M${mid} ${a.apex}V${win.yb}`} stroke={shade(deep, 0.15)} strokeWidth={1.4} opacity={0.55} />
        <path d={a.d} fill="none" stroke={tint(stone, 0.3)} strokeWidth={1.2} transform={`translate(${p.light.from === 'right' ? 2.5 : -2.5} 0)`} opacity={0.8} />
      </g>
    );
  };
  // The rose window.
  const rx = cx;
  const ry = 300;
  const R = 74;
  const petals = Array.from({ length: 12 }, (_, i) => (
    <use key={i} href={`#${id}pt`} transform={`rotate(${i * 30} ${rx} ${ry})`} fill={i % 3 === 0 ? glassR : i % 3 === 1 ? glassA : glassB} />
  ));
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}w`} x1={0} y1={0} x2={w} y2={0} stops={p.light.from === 'right' ? [[0, shade(stone, 0.12)], [0.5, stone], [1, tint(stone, 0.08)]] : [[0, tint(stone, 0.08)], [0.5, stone], [1, shade(stone, 0.12)]]} />
        <pattern id={`${id}a`} patternUnits="userSpaceOnUse" width={96} height={48}>
          <path d="M0 0.5H96M0 24.5H96M48 0V24M0 24V48M96 24V48" stroke={joint} strokeWidth={1.2} fill="none" opacity={0.5} />
        </pattern>
        <radialGradient id={`${id}r`} cx="50%" cy="72%" r="62%">
          <stop offset="0" stopColor={mix(GOLD, stone, 0.25)} stopOpacity="0.95" />
          <stop offset="0.55" stopColor={mix(GOLD, stone, 0.6)} stopOpacity="0.55" />
          <stop offset="1" stopColor={deep} stopOpacity="0.25" />
        </radialGradient>
        <Lin id={`${id}gl`} bbox y2={1} stops={[[0, glassB], [0.35, glassR], [0.7, glassA], [1, mix(GOLD, '#ffffff', 0.3)]]} />
        <radialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={GOLD} stopOpacity="0.45" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}rg`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={mix(GOLD, '#ffffff', 0.4)} />
          <stop offset="0.45" stopColor={glassR} />
          <stop offset="1" stopColor={glassB} />
        </radialGradient>
        <path id={`${id}pt`} d={P`M${rx} ${ry - 26}C${rx - 13} ${ry - 40} ${rx - 13} ${ry - 60} ${rx} ${ry - R + 6}C${rx + 13} ${ry - 60} ${rx + 13} ${ry - 40} ${rx} ${ry - 26}Z`} />
      </defs>
      <rect width={r2(w)} height={r2(h)} fill={`url(#${id}w)`} />
      <rect width={r2(w)} height={r2(h)} fill={`url(#${id}a)`} />
      {/* string course and plinth */}
      <rect x={0} y={150} width={r2(w)} height={10} fill={deep} opacity={0.35} />
      <rect x={0} y={r2(h - 34)} width={r2(w)} height={34} fill={deep} opacity={0.35} />
      {/* the chancel arch: recess, mouldings */}
      <path d={arch.d} fill={`url(#${id}r)`} />
      <path d={lancet(cx - 235, cx + 235, springY, h - 30, 0.92).d} fill="none" stroke={deep} strokeWidth={14} opacity={0.5} />
      <path d={arch.d} fill="none" stroke={tint(stone, 0.35)} strokeWidth={4} />
      <path d={lancet(cx - 200, cx + 200, springY, h - 30, 0.92).d} fill="none" stroke={gold} strokeWidth={1.6} opacity={0.45} />
      {windows.map(glassWindow)}
      {/* the rose window */}
      <circle cx={rx} cy={ry} r={R + 22} fill={`url(#${id}h)`} />
      <circle cx={rx} cy={ry} r={R} fill={`url(#${id}rg)`} stroke={deep} strokeWidth={9} />
      <g opacity={0.9}>{petals}</g>
      <g stroke={shade(deep, 0.1)} strokeWidth={1.4} opacity={0.6}>
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={P`M${rx} ${ry - 24}V${ry - R}`} transform={`rotate(${i * 30 + 15} ${rx} ${ry})`} />
        ))}
      </g>
      <circle cx={rx} cy={ry} r={24} fill={glassA} stroke={deep} strokeWidth={4} />
      <circle cx={rx} cy={ry} r={R + 6} fill="none" stroke={tint(stone, 0.35)} strokeWidth={2} />
      {full ? <circle cx={rx} cy={ry} r={9} fill={mix(GOLD, '#ffffff', 0.4)} /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── Bells ───────────────────────────

/**
 * The wedding bells, foiled, tied with a satin bow. The illustration leaves the
 * lower 28% of its frame empty under the clappers, so the piece's box is cut to
 * the art: the box ends where the bells do and never reaches the emblem.
 */
const BELLS_ART = 0.72;
function Bells(p: DrawProps) {
  return <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: `${r2(100 / BELLS_ART)}%` }}>{illus('weddingBells', 'secondary', { foil: true })({ ...p, h: p.h / BELLS_ART })}</div>;
}

// ─────────────────────────── the set ───────────────────────────

/**
 * The side walls' stained glass with the sun behind it: the kit's lancet wall draws its glass from the primary, accent and
 * secondary, so the walls get ruby, amber and gold for those roles (each leaning a fifth toward the palette's own), and
 * glow like real glass at golden hour instead of repeating the paper colours.
 */
const sunsetGlass = (c: DrawProps['colors']): Partial<DrawProps['colors']> => ({
  muted: mix(c.secondary, c.text, 0.2),
  primary: mix('#9b2335', c.primary, 0.2),
  accent: mix('#f0b85a', c.accent, 0.2),
  secondary: mix('#c99a3e', c.secondary, 0.25),
});

export const nave: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const pieces: Piece[] = [
    // Planes: the nave ends at the chancel wall (d 2500), so nothing is drawn behind it; the floor and vault reach
    // forward to the west door (the far pose looks down the nave from there).
    {
      kind: 'plane',
      id: 'floor',
      art: 'floor:flags',
      role: 'architecture',
      plane: floor({ x0: 250, x1: 950, dNear: -300, dFar: 2500 }),
      draw: drawWith(Floor, {
        variant: 'flags',
        runner: true,
        petals: true,
        pools: [
          { x: 600, d: 2280, r: 300, color: GOLD },
          { x: 560, d: 1280, r: 210, color: GOLD },
          { x: 540, d: 1980, r: 190, color: GOLD },
        ],
      }),
    },
    { kind: 'plane', id: 'vault', art: 'ceiling:timberVault', role: 'architecture', plane: ceiling({ x0: 250, x1: 950, y: -120, dNear: 300, dFar: 2500 }), draw: inMaterial(drawWith(Ceiling, { variant: 'timberVault' }), (c) => ({ text: mix(c.background, c.secondary, 0.4) })) },
    { kind: 'plane', id: 'wall-l', art: 'wall:lancet', role: 'architecture', plane: wall('left', { x: 250, yTop: -120, dNear: 400, dFar: 2495 }), draw: inMaterial(drawWith(Wall, { variant: 'lancet' }), sunsetGlass) },
    { kind: 'plane', id: 'wall-r', art: 'wall:lancet', role: 'architecture', plane: wall('right', { x: 950, yTop: -120, dNear: 400, dFar: 2495 }), draw: inMaterial(drawWith(Wall, { variant: 'lancet' }), sunsetGlass) },
    { kind: 'plane', id: 'chancel', art: 'chancelWall', role: 'architecture', quiet: true, plane: back({ x0: 240, x1: 960, yTop: -120, d: 2500 }), draw: ChancelWall },

    // The aisle: three rows of pews (left and right of a 160 aisle), rising in from the front.
    ...[850, 1150, 1450].map((d, i): Piece => ({ kind: 'prop', id: `pews-${i}`, art: 'pew', role: 'prop', ...billboard({ x: 600, d, w: 700, h: 180 }), buildIn: 'rise', draw: PewRow })),

    // The altar, its candles and lilies.
    { kind: 'prop', id: 'altar', art: 'altar', role: 'focal', ...billboard({ x: 600, d: 2300, w: 520, h: 330 }), buildIn: 'fade', draw: Altar },
    { kind: 'prop', id: 'candle-l', art: 'lampStand:candle', role: 'prop', ...billboard({ x: 410, d: 2150, w: 40, h: 260 }), buildIn: 'rise', draw: drawWith(LampStand, { variant: 'candle' }) },
    { kind: 'prop', id: 'candle-r', art: 'lampStand:candle', role: 'prop', ...billboard({ x: 790, d: 2150, w: 40, h: 260 }), buildIn: 'rise', draw: drawWith(LampStand, { variant: 'candle' }) },


    // Golden-hour light pouring through the right-hand windows across the aisle.
    { kind: 'prop', id: 'beam-a', art: 'sunbeam', role: 'light', ...billboard({ x: 670, d: 1250, w: 560, h: 640 }), motion: { kind: 'shimmer', amp: 0.3, period: 7 }, draw: Sunbeam },
    { kind: 'prop', id: 'beam-b', art: 'sunbeam', role: 'light', ...billboard({ x: 670, d: 1900, w: 560, h: 820 }), motion: { kind: 'shimmer', amp: 0.3, period: 8, phase: 0.4 }, draw: Sunbeam },

    // Wedding bells in the crown band, near and high.
    { kind: 'prop', id: 'bells', art: 'weddingBells', role: 'hanging', ...hang({ x: 600, d: 600, w: 104, h: 65, top: -50 }), motion: { kind: 'sway', amp: 2, period: 5 }, buildIn: 'drop', draw: Bells },

    // Lights: the two candle glows and the rose window.
    { kind: 'light', id: 'glow-l', art: 'glow', role: 'light', at: { x: 410, y: 560, z: -2150 }, r: 60, color: GOLD, strength: 0.6, motion: { kind: 'flicker', amp: 0.3, period: 1.7 }, buildIn: 'light' },
    { kind: 'light', id: 'glow-r', art: 'glow', role: 'light', at: { x: 790, y: 560, z: -2150 }, r: 60, color: GOLD, strength: 0.6, motion: { kind: 'flicker', amp: 0.3, period: 1.7, phase: 0.45 }, buildIn: 'light' },
    { kind: 'light', id: 'glow-rose', art: 'glow', role: 'light', at: { x: 600, y: 210, z: -2480 }, r: 160, color: ROSE, strength: 0.35, motion: { kind: 'pulse', amp: 0.5, period: 6.5 } },
  ];
  return {
    name: 'nave',
    // The room closes the view; the box's own background is the warm air of the nave.
    sky: `linear-gradient(180deg, ${mix(c.surface, c.secondary, 0.2)} 0%, ${mix(c.background, GOLD, 0.12)} 55%, ${mix(c.surface, c.secondary, 0.12)} 100%)`,
    light: { from: 'right', color: GOLD, rim: '#fff1d6' },
    fog: { color: '#efe4d2', near: 1500, far: 3200, max: 0.35 },
    veil: 0.3,
    focus: { x: 600, y: 600, z: -2300 },
    // A chapel is drawn back from only as far as its west door: the closing pull-away stays inside the nave.
    poses: { far: { x: 600, y: 300, z: 420, yaw: 0, pitch: 0, roll: 0, fov: 52 } },
    pieces,
    covers: { gate: 'campus', door: 'church', silk: 'damask', card: 'trifold' },
    particles: { count: 26, dNear: 700, dFar: 2200 },
  };
};

