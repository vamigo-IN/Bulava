import type { ReactNode } from 'react';
import { hex, onCubic, shade, tint, type Pt, type Segment } from '../../art/kit';
import { r2 } from '../../art/motifs';
import { mix } from '../../theme';
import type { DrawProps } from '../types';
import { bodyStops, FlameAt, FlameDef, Glow, KitSvg, kitId, Lin, metalLit, P } from './architecture';

/**
 * Set favourites promoted to the kit (final.md §6.5): Mela Chowk's Ferris wheel and its stand, Cloud Nine's hot-air
 * balloon and Deepstambh's lamp tower. Drawn exactly as their sets drew them (the sets now import them from here),
 * so the Design Studio can offer them as canvas illustrations (art/illustrations-stage.tsx) and other sets can use
 * them. Each keeps the helpers it was written with: the set files' one-decimal path tag (P1 here) and the kit's own.
 */

const url = (id: string) => `url(#${id})`;
/** One decimal: compact markup (a unit is at most two pixels on any screen). */
const r1 = (n: number) => Math.round(n * 10) / 10;
/** A path string whose numbers are rounded to one decimal: P1`M${x} ${y}`. */
const P1 = (t: TemplateStringsArray, ...v: number[]): string => {
  let out = t[0] ?? '';
  for (let i = 0; i < v.length; i++) out += String(r1(v[i] ?? 0)) + (t[i + 1] ?? '');
  return out;
};

/** Warm lamp light (the Ferris wheel's bulbs and cabins). */
const LAMP = '#ffb347';

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
const circle = (cx: number, cy: number, r: number) => P1`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** An <svg> drawn in the piece's native units (the box it was designed in), stretched to the box. */
function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {children}
    </svg>
  );
}

/** The lamp tower's box (Deepstambh places it at its own x and d). */
const TOWER = { w: 150, h: 470 } as const;
/** Black basalt, the deepastambha's stone. */
const basaltOf = (p: DrawProps) => mix(mix(p.colors.text, p.colors.primary, 0.3), '#000000', 0.15);

/** The pieces' default boxes (units), as their sets place them. */
export const FAVOURITE_BOXES = { ferrisWheel: { w: 600, h: 600 }, ferrisStand: { w: 400, h: 300 }, hotAirBalloon: { w: 180, h: 250 }, lampTower: { w: TOWER.w, h: TOWER.h } } as const;

// ─────────────────────────── FerrisWheel ───────────────────────────

/**
 * The wheel only [520×520]: a double rim laced with bracing and strung with
 * bulbs, sixteen spokes, round lamp-pod cabins (round, so they read right at
 * every turn) and a gold hub. It turns on its own stand (FerrisStand).
 */
export function FerrisWheel(p: DrawProps) {
  const { w, colors: c, light } = p;
  const id = kitId(p, 'wheel');
  const low = p.detail === 'low';
  const cx = w / 2;
  const cy = w / 2;
  const R = cx - 26;
  const r = R - 22;
  const gold = c.secondary;
  const steel = mix(gold, c.text, 0.35);
  const rim = directions(32);
  let spokes = '';
  for (const d of directions(16)) {
    const a = at(cx, cy, d, 26);
    const b = at(cx, cy, d, r);
    spokes += P1`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  }
  let lace = '';
  rim.forEach((d, i) => {
    const a = at(cx, cy, d, R);
    const b = at(cx, cy, rim[(i + 1) % rim.length] as Pt, r);
    lace += P1`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  });
  // Bulbs: round-capped zero dashes round the rim, 32 of them, with a soft halo ring.
  const ring = circle(cx, cy, R);
  const dash = r1((2 * 3.1416 * R) / 32);
  const cabins = directions(8, 0.5).map((d, i) => {
    const b = at(cx, cy, d, R);
    const fill = i % 2 ? c.primary : mix(c.primary, gold, 0.55);
    return (
      <g key={i}>
        <path d={circle(b[0], b[1], 20)} fill={fill} stroke={gold} strokeWidth={3} />
        <path d={circle(b[0], b[1], 9)} fill={tint(light.color, 0.3)} opacity={0.9} />
      </g>
    );
  });
  return (
    <KitSvg p={p}>
      <defs>
        <Glow id={`${id}c`} color={LAMP} core={tint(LAMP, 0.4)} a={0.35} />
      </defs>
      <circle cx={cx} cy={cy} r={R + 30} fill={url(`${id}c`)} />
      <path d={spokes} stroke={steel} strokeWidth={4} />
      <path d={circle(cx, cy, r * 0.5)} fill="none" stroke={steel} strokeWidth={3} />
      <path d={lace} stroke={steel} strokeWidth={2} />
      <path d={circle(cx, cy, R) + circle(cx, cy, r)} fill="none" stroke={gold} strokeWidth={8} />
      {low ? null : <path d={ring} fill="none" stroke={tint(light.color, 0.3)} strokeWidth={26} strokeDasharray={`0 ${dash}`} strokeLinecap="round" opacity={0.22} />}
      <path d={ring} fill="none" stroke={tint(light.color, 0.55)} strokeWidth={12} strokeDasharray={`0 ${dash}`} strokeLinecap="round" />
      {cabins}
      <path d={circle(cx, cy, 24)} fill={gold} stroke={shade(gold, 0.35)} strokeWidth={3} />
      <path d={circle(cx, cy, 9)} fill={tint(gold, 0.5)} />
    </KitSvg>
  );
}

/** The wheel's stand [340×330]: two lattice A-frame legs from the hub to a boarding deck with steps and lamps. */
export function FerrisStand(p: DrawProps) {
  const { w, h, colors: c, light } = p;
  const id = kitId(p, 'stand');
  const steel = mix(c.secondary, c.text, 0.42);
  const top: Pt = [w / 2, 6];
  const footL: Pt = [18, h - 22];
  const footR: Pt = [w - 18, h - 22];
  const legs = (inset: number) => P1`M${top[0] - 6} ${top[1]}L${footL[0] + inset} ${footL[1]}M${top[0] + 6} ${top[1]}L${footR[0] - inset} ${footR[1]}`;
  let brace = '';
  for (let i = 1; i < 8; i++) {
    const t0 = i / 8;
    const t1 = (i + 1) / 8;
    const yA = top[1] + (footL[1] - top[1]) * t0;
    const yB = top[1] + (footL[1] - top[1]) * Math.min(t1, 1);
    const xL0 = top[0] + (footL[0] - top[0]) * t0;
    const xL1 = top[0] + (footL[0] + 40 - top[0]) * t1;
    const xR0 = top[0] + (footR[0] - top[0]) * t0;
    const xR1 = top[0] + (footR[0] - 40 - top[0]) * t1;
    brace += P1`M${xL0} ${yA}L${xL1} ${yB}M${xR0} ${yA}L${xR1} ${yB}`;
  }
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}d`} stops={[[0, tint(c.primary, 0.1)], [1, shade(c.primary, 0.3)]]} y1={h - 28} y2={h} />
      </defs>
      <path d={legs(0)} stroke={steel} strokeWidth={9} strokeLinecap="round" />
      <path d={legs(40)} stroke={shade(steel, 0.2)} strokeWidth={6} />
      <path d={brace} stroke={steel} strokeWidth={2.4} />
      <rect x={4} y={h - 28} width={w - 8} height={28} fill={url(`${id}d`)} />
      <path d={P1`M4 ${h - 28}h${w - 8}`} stroke={c.secondary} strokeWidth={3} />
      <path d={circle(26, h - 40, 5) + circle(w - 26, h - 40, 5)} fill={tint(light.color, 0.5)} />
    </KitSvg>
  );
}

// ─────────────────────────── HotAirBalloon ───────────────────────────

/** Gore boundaries across the envelope (a sphere's foreshortening, precomputed). */
const GORES = [-1, -0.9, -0.66, -0.34, 0, 0.34, 0.66, 0.9, 1] as const;

/**
 * A hot-air balloon far off: an envelope of eight gores in the palette's
 * pastels with a gold scalloped band, its mouth glowing with the burner, ropes
 * and a wicker basket. Lit from behind, so both edges carry the rim.
 */
export function HotAirBalloon(p: DrawProps & { scheme: 0 | 1 }) {
  const { w, h, colors: c, light } = p;
  const low = p.detail === 'low';
  const id = kitId(p, `hb${p.scheme}`);
  const cx = w / 2;
  const top = h * 0.02;
  const mouth = h * 0.66;
  const half = w * 0.5;
  const mouthHalf = w * 0.14;
  // One gore boundary: from the crown to the mouth, scaled across by f.
  const edge = (f: number) => P`M${cx} ${top}C${cx + f * half * 1.02} ${top} ${cx + f * half} ${h * 0.46} ${cx + f * mouthHalf} ${mouth}`;
  const panel = (f0: number, f1: number) =>
    P`M${cx} ${top}C${cx + f0 * half * 1.02} ${top} ${cx + f0 * half} ${h * 0.46} ${cx + f0 * mouthHalf} ${mouth}L${cx + f1 * mouthHalf} ${mouth}C${cx + f1 * half} ${h * 0.46} ${cx + f1 * half * 1.02} ${top} ${cx} ${top}Z`;
  const a = p.scheme === 0 ? hex(c.secondary) : hex(c.primary);
  const b = mix(hex(c.background), hex(c.accent), 0.3);
  const third = p.scheme === 0 ? mix(hex(c.primary), hex(c.background), 0.45) : mix(hex(c.secondary), hex(c.background), 0.25);
  const fills = [a, b, third, b, a, b, third, b];
  const gold = mix(hex(c.accent), '#c9a24e', 0.42);
  const bandY = h * 0.42;
  const basketTop = h * 0.84;
  const basketW = w * 0.24;
  const wicker = mix(p.nature.clay, hex(c.accent), 0.35);
  const outline = P`M${cx} ${top}C${cx - half * 1.02} ${top} ${cx - half} ${h * 0.46} ${cx - mouthHalf} ${mouth}L${cx + mouthHalf} ${mouth}C${cx + half} ${h * 0.46} ${cx + half * 1.02} ${top} ${cx} ${top}Z`;
  const scallops = low
    ? ''
    : Array.from({ length: 8 }, (_, i) => {
        const x0 = cx - half * 0.82 + i * ((half * 1.64) / 8);
        const x1 = x0 + (half * 1.64) / 8;
        return P`M${x0} ${bandY + 6}Q${(x0 + x1) / 2} ${bandY + 22} ${x1} ${bandY + 6}`;
      }).join('');
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={[[0, '#000000', 0.22], [0.22, '#000000', 0.04], [0.5, '#ffffff', 0.12], [0.78, '#000000', 0.04], [1, '#000000', 0.22]]} x1={cx - half} x2={cx + half} />
        <Lin id={`${id}v`} stops={[[0, '#ffffff', 0.25], [0.5, '#ffffff', 0], [1, '#000000', 0.12]]} y1={top} y2={mouth} />
        <Lin id={`${id}g`} stops={[[0, shade(gold, 0.3)], [0.35, tint(gold, 0.55)], [0.6, gold], [1, shade(gold, 0.25)]]} x1={cx - half} x2={cx + half} />
        <Glow id={`${id}f`} color={p.nature.flame} core={p.nature.flameCore} a={0.9} />
      </defs>
      {GORES.slice(0, -1).map((f0, i) => (
        <path key={i} d={panel(f0, GORES[i + 1]!)} fill={fills[i]} />
      ))}
      {low ? null : <path d={GORES.slice(1, -1).map(edge).join('')} fill="none" stroke={shade(b, 0.18)} strokeWidth={1.2} opacity={0.6} />}
      <path d={outline} fill={url(`${id}s`)} />
      <path d={outline} fill={url(`${id}v`)} />
      {/* The gold band and its scallops, a gold collar at the mouth. */}
      <path d={P`M${cx - half * 0.86} ${bandY - 4}Q${cx} ${bandY + 10} ${cx + half * 0.86} ${bandY - 4}L${cx + half * 0.84} ${bandY + 8}Q${cx} ${bandY + 22} ${cx - half * 0.84} ${bandY + 8}Z`} fill={url(`${id}g`)} />
      {scallops ? <path d={scallops} fill="none" stroke={url(`${id}g`)} strokeWidth={2.4} /> : null}
      <rect x={r2(cx - mouthHalf - 2)} y={r2(mouth - 3)} width={r2(2 * mouthHalf + 4)} height={6} rx={3} fill={url(`${id}g`)} />
      <path d={outline} fill="none" stroke={light.rim} strokeWidth={2} opacity={0.6} />
      {/* The burner's glow, ropes and the basket. */}
      <ellipse cx={r2(cx)} cy={r2(mouth + 6)} rx={r2(mouthHalf * 1.6)} ry={r2(h * 0.05)} fill={url(`${id}f`)} />
      <path d={P`M${cx - mouthHalf} ${mouth}L${cx - basketW / 2} ${basketTop}M${cx + mouthHalf} ${mouth}L${cx + basketW / 2} ${basketTop}M${cx - mouthHalf * 0.35} ${mouth}L${cx - basketW * 0.18} ${basketTop}M${cx + mouthHalf * 0.35} ${mouth}L${cx + basketW * 0.18} ${basketTop}`} stroke={shade(wicker, 0.35)} strokeWidth={1.4} />
      <path d={P`M${cx - basketW / 2} ${basketTop}H${cx + basketW / 2}L${cx + basketW * 0.42} ${h - 1}H${cx - basketW * 0.42}Z`} fill={wicker} />
      {low ? null : <path d={P`M${cx - basketW * 0.47} ${basketTop + (h - basketTop) * 0.4}H${cx + basketW * 0.47}M${cx - basketW * 0.44} ${basketTop + (h - basketTop) * 0.72}H${cx + basketW * 0.44}M${cx - basketW * 0.2} ${basketTop}V${h - 1}M${cx} ${basketTop}V${h - 1}M${cx + basketW * 0.2} ${basketTop}V${h - 1}`} stroke={shade(wicker, 0.3)} strokeWidth={1.2} opacity={0.7} />}
      <rect x={r2(cx - basketW / 2 - 2)} y={r2(basketTop - 2)} width={r2(basketW + 4)} height={5} rx={2.5} fill={shade(wicker, 0.2)} />
    </KitSvg>
  );
}

// ─────────────────────────── LampTower ───────────────────────────

const TW = TOWER.w;
const TH = TOWER.h;
const TCX = TW / 2;
/** The seven tiers of lamps, bottom to top (box y of each ledge). */
const TIER_Y = [384, 338, 292, 246, 200, 154, 108] as const;
const SHAFT = { y0: 400, y1: 74 } as const;
/** The shaft's half width at box y: 26 at the pedestal, 15 under the capital. */
const halfAt = (y: number) => 15 + 11 * ((y - SHAFT.y1) / (SHAFT.y0 - SHAFT.y1));
/** Cups round a ring seen from just above, as [sin, cos] of their bearing (constants, no trigonometry). */
const RING7 = [[-1, 0], [-0.78, 0.62], [-0.43, 0.9], [0, 1], [0.43, 0.9], [0.78, 0.62], [1, 0]] as const;
const RING5 = [[-1, 0], [-0.62, 0.78], [0, 1], [0.62, 0.78], [1, 0]] as const;

interface Cup { x: number; y: number; s: number; n: number; t: number }
/** Every lamp cup of the tower: where its wick burns and its flame's height. */
function towerCups(): Cup[] {
  const out: Cup[] = [];
  let n = 0;
  TIER_Y.forEach((y, i) => {
    const ring = i < 4 ? RING7 : RING5;
    const rr = halfAt(y) + 15 - i * 0.9;
    for (const [s, c] of ring) out.push({ x: TCX + rr * s, y: y - 3 + 3.4 * c, s: 15 - i * 0.9, n: n++, t: i });
  });
  return out;
}

/**
 * The deepastambha (150×470): a black basalt lamp tower on a two-step plinth
 * and a carved pedestal, its octagonal shaft tapering through seven ledges of
 * brass lamp cups, each wick alight, under a lotus cushion, a small dome and a
 * kalash with the crowning flame. Every tier washes the stone above it in warm
 * light; the dusk behind rims both edges. `part` 'halo' draws only the glow
 * round every other flame (`half` 0 or 1): two such layers twinkling out of
 * step make the tiers flare in turn.
 */
export function LampTower(p: DrawProps & { part: 'body' | 'halo'; half?: 0 | 1 }) {
  const c = p.colors;
  const id = kitId(p, `tw${p.part}${p.half ?? ''}`);
  const cups = towerCups();
  if (p.part === 'halo') {
    return (
      <Svg w={TW} h={TH}>
        <defs>
          <Glow id={`${id}h`} color={p.nature.flame} core={p.nature.flameCore} a={0.7} />
        </defs>
        {cups
          .filter((u) => u.n % 2 === (p.half ?? 0))
          .map((u) => (
            <circle key={u.n} cx={r2(u.x)} cy={r2(u.y - u.s * 0.45)} r={r2(u.s * 1.25)} fill={url(`${id}h`)} />
          ))}
        {p.half === 0 ? <circle cx={TCX} cy={6} r={20} fill={url(`${id}h`)} /> : null}
      </Svg>
    );
  }
  const stone = basaltOf(p);
  const brass = c.secondary;
  const warm = mix(p.nature.flame, stone, 0.35);
  const ledgeTop = mix(tint(stone, 0.22), p.nature.flame, 0.22);
  const seg = (ya: number, yb: number) => {
    const ha = halfAt(ya);
    const hb = halfAt(yb);
    return P1`M${TCX - hb} ${yb}L${TCX - ha} ${ya}H${TCX + ha}L${TCX + hb} ${yb}Z`;
  };
  const facets = (ya: number, yb: number) =>
    [-0.42, 0.42].map((f) => P1`M${TCX + halfAt(yb) * f} ${yb}L${TCX + halfAt(ya) * f} ${ya}`).join('');
  const ledge = (y: number, i: number) => {
    const rx = halfAt(y) + 18 - i * 0.9;
    return (
      <g key={`l${i}`}>
        <ellipse cx={TCX} cy={y} rx={r2(rx)} ry={4.2} fill={ledgeTop} />
        <path d={P1`M${TCX - rx} ${y}A${rx} 4.2 0 0 0 ${TCX + rx} ${y}V${y + 4.5}A${rx} 4.2 0 0 1 ${TCX - rx} ${y + 4.5}Z`} fill={url(`${id}s`)} />
        <path d={P1`M${TCX - rx} ${y + 0.3}A${rx} 4.2 0 0 0 ${TCX + rx} ${y + 0.3}`} fill="none" stroke={warm} strokeWidth={0.9} opacity={0.9} />
      </g>
    );
  };
  const cupsOf = (i: number) =>
    cups
      .filter((u) => u.t === i)
      .map((u) => <use key={`c${u.n}`} href={`#${id}c${i}`} x={r2(u.x)} y={r2(u.y)} />);
  const tiers: ReactNode[] = [
    <path key="s" d={seg(SHAFT.y0, TIER_Y[0])} fill={url(`${id}s`)} />,
    <path key="f" d={facets(SHAFT.y0, TIER_Y[0])} stroke={shade(stone, 0.35)} strokeWidth={0.8} fill="none" />,
  ];
  TIER_Y.forEach((y, i) => {
    tiers.push(ledge(y, i));
    const next = TIER_Y[i + 1] ?? SHAFT.y1;
    tiers.push(<path key={`t${i}`} d={seg(y - 1, next)} fill={url(`${id}s`)} />);
    tiers.push(<path key={`g${i}`} d={facets(y - 1, next)} stroke={shade(stone, 0.35)} strokeWidth={0.8} fill="none" />);
    tiers.push(<ellipse key={`v${i}`} cx={TCX} cy={y - 10} rx={r2(halfAt(y) + 6)} ry={15} fill={url(`${id}w`)} />);
    tiers.push(<g key={`k${i}`}>{cupsOf(i)}</g>);
  });
  return (
    <Svg w={TW} h={TH}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(stone, 'far')} x1={TCX - 28} x2={TCX + 28} />
        <Lin id={`${id}p`} stops={bodyStops(mix(stone, c.muted, 0.18), 'far')} x1={0} x2={TW} />
        <Lin id={`${id}m`} stops={metalLit(brass, 'far')} x1={TCX - 40} x2={TCX + 40} />
        <Glow id={`${id}w`} color={p.nature.flame} core={p.nature.flameCore} a={0.42} />
        <Glow id={`${id}b`} color={p.nature.flame} core={p.nature.flameCore} a={0.5} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} />
        {TIER_Y.map((_, i) => (
          <g key={i} id={`${id}c${i}`}>
            <path d="M-4.2 -1Q0 4.4 4.2 -1Z" fill={url(`${id}m`)} />
            <FlameAt href={`${id}f`} x={0} y={-1.2} s={15 - i * 0.9} />
          </g>
        ))}
      </defs>
      {/* Plinth: two steps and the carved pedestal, lit warm from the lowest tier. */}
      <path d={P1`M0 ${TH}V452H${TW}V${TH}Z`} fill={url(`${id}p`)} />
      <rect x={0} y={452} width={TW} height={3} fill={ledgeTop} />
      <path d={P1`M14 452V436H136V452Z`} fill={url(`${id}p`)} />
      <rect x={14} y={436} width={122} height={3} fill={ledgeTop} />
      <rect x={32} y={404} width={86} height={32} fill={url(`${id}s`)} />
      <rect x={40} y={410} width={70} height={20} fill="none" stroke={shade(stone, 0.4)} strokeWidth={1.2} />
      <path d={[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P1`M${TCX} 420L${TCX + [9, 6.4, 0, -6.4, -9, -6.4, 0, 6.4][k]!} ${420 + [0, 4.5, 6.4, 4.5, 0, -4.5, -6.4, -4.5][k]!}`).join('')} stroke={warm} strokeWidth={1.4} opacity={0.8} />
      <circle cx={TCX} cy={420} r={2.6} fill={url(`${id}m`)} />
      <rect x={26} y={398} width={98} height={7} fill={ledgeTop} />
      <ellipse cx={TCX} cy={446} rx={70} ry={16} fill={url(`${id}b`)} />
      {tiers}
      {/* Crown: a lotus cushion, a ribbed dome, the kalash and the crowning flame. */}
      <path d={[...Array(9)].map((_, k) => { const x = TCX - 20 + k * 5; return P1`M${x - 3} 74Q${x} 62 ${x + 3} 74`; }).join('')} fill={ledgeTop} stroke={shade(stone, 0.3)} strokeWidth={0.5} />
      <ellipse cx={TCX} cy={74} rx={22} ry={3.4} fill={url(`${id}s`)} />
      <path d={P1`M${TCX - 15} 64C${TCX - 15} 46 ${TCX - 8} 38 ${TCX} 37C${TCX + 8} 38 ${TCX + 15} 46 ${TCX + 15} 64Z`} fill={url(`${id}s`)} />
      <path d={P1`M${TCX - 7} 62C${TCX - 7} 48 ${TCX - 4} 41 ${TCX} 38M${TCX + 7} 62C${TCX + 7} 48 ${TCX + 4} 41 ${TCX} 38M${TCX} 38V63`} stroke={shade(stone, 0.35)} strokeWidth={0.7} fill="none" />
      <ellipse cx={TCX} cy={64} rx={17} ry={2.6} fill={ledgeTop} />
      <path d={P1`M${TCX - 7} 34C${TCX - 9} 28 ${TCX - 5} 24 ${TCX} 24C${TCX + 5} 24 ${TCX + 9} 28 ${TCX + 7} 34ZM${TCX - 3} 24V20H${TCX + 3}V24Z`} fill={url(`${id}m`)} />
      <ellipse cx={TCX} cy={36} rx={9} ry={2} fill={url(`${id}m`)} />
      <ellipse cx={TCX} cy={4} rx={16} ry={20} fill={url(`${id}w`)} />
      <FlameAt href={`${id}f`} x={TCX} y={20} s={24} />
      {/* The dusk behind: a rim down both edges of the shaft. */}
      <path d={P1`M${TCX - halfAt(SHAFT.y0) + 0.8} ${SHAFT.y0}L${TCX - halfAt(SHAFT.y1) + 0.8} ${SHAFT.y1}M${TCX + halfAt(SHAFT.y0) - 0.8} ${SHAFT.y0}L${TCX + halfAt(SHAFT.y1) - 0.8} ${SHAFT.y1}`} stroke={p.light.rim} strokeWidth={1.1} opacity={0.5} fill="none" />
    </Svg>
  );
}
