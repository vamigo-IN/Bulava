import { createElement } from 'react';
import { metalStops, onCubic, shade, taper, tint, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import type { ThemeColors } from '@bulava/template-schema';
import { drawWith, Floor, LampPost, motif, Pole, Wall } from '../kit';
import { Glow, kitId, KitSvg, Lin, P } from '../kit/architecture';
import { billboard, floor, hang, sky, wall } from '../planes';
import type { DrawProps, Piece, StageSetFactory } from '../types';

/**
 * T03 · Amrit Vela (`amrit-vela`, final.md §5.3): the `causeway` stage.
 *
 * The hour before dawn on the sarovar. A marble causeway, its balustrades
 * lined with gilt lamps, runs out across still water to the golden shrine,
 * backlit by the first light rising behind it; its gold and marble lie broken
 * in the water on either side of the causeway. Two tall Nishan Sahib staffs
 * rise from the water, their kesari pennants lifting in the dawn breeze; low
 * mist drifts over the sarovar; a few birds cross the pale sky; the far
 * parikrama and its two brick towers stand in the haze. Key light far (the
 * dawn behind the shrine), rim pale gold. Dawn.
 *
 * Set-local pieces (§6.4): Shrine (the focal, drawn here because the
 * `goldenTemple` illustration masks its own reflection, and stages allow no
 * masks), the shrine's reflection (baked into the water plane, pre-distorted
 * for the rest eye: an upright reflection piece would lie under the water),
 * Pennant (the Nishan Sahib's cloth, no emblem), DawnMist (drawn while the
 * kit's MistBand still cut its banks square at the box's foot, a line on the
 * water; it keeps its own look), and the dawn sky with its rays and the far parikrama (one sky
 * plane). The flagstaffs are the kit's Pole(flag).
 */

const url = (id: string) => `url(#${id})`;

/** The causeway: x 420–780, from behind the eye (the far pose stands on it) to the shrine's plinth. */
const CW = { x0: 420, x1: 780, y: 796.5, dNear: -1150, dFar: 2030 } as const;
/** The lamps along the causeway: their depths and offset from the centre line. */
const LAMP_D = [950, 1250, 1550] as const;
const LAMP_X = 150;
/** The sarovar. */
const POOL = { x0: -2200, x1: 3400, dNear: -1150, dFar: 3200 } as const;
/** The sky plane: just beyond the water, at a depth whose scale (d / 692.82 = 4.62) the transform string carries exactly. */
const SKY_D = 692.82 * 4.62;
/** Still water at dawn holds the sky's blue whatever the palette's primary (a real colour, like NATURE's). */
const DAWN_WATER = '#8fb3e0';
/** The shrine. */
const SHRINE = { d: 2050, w: 600, h: 459 } as const;
/**
 * The rest eye stands 60 higher than the stages' usual 330, as if from the parikrama's steps: the sarovar opens out below,
 * and the shrine sits lower, clear of the words. The reflection is pre-distorted for this eye.
 */
const REST_Y = 270;
const EYE_ABOVE_WATER = 800.5 - REST_Y;

/** A cusped (ogee-lobed) arch from x a to b, its apex at `top`, its jambs down to `bottom`. */
const cuspArch = (a: number, b: number, top: number, bottom: number): string => {
  const w = b - a;
  const m = (a + b) / 2;
  const s = top + (bottom - top) * 0.42;
  const hh = s - top;
  return P`M${a} ${bottom}V${s}Q${a} ${s - hh * 0.38} ${a + w * 0.2} ${s - hh * 0.5}Q${a + w * 0.24} ${top + hh * 0.28} ${m} ${top}Q${b - w * 0.24} ${top + hh * 0.28} ${b - w * 0.2} ${s - hh * 0.5}Q${b} ${s - hh * 0.38} ${b} ${s}V${bottom}Z`;
};

/** A small dome (a domelet or chhatri cap) on a base from x a to b at y, rising h. */
const domelet = (a: number, b: number, y: number, h: number): string => {
  const m = (a + b) / 2;
  return P`M${a} ${y}C${a} ${y - h * 0.6} ${m - (b - a) * 0.18} ${y - h * 0.8} ${m} ${y - h}C${m + (b - a) * 0.18} ${y - h * 0.8} ${b} ${y - h * 0.6} ${b} ${y}Z`;
};

// ─────────────────────────── Shrine (focal) ───────────────────────────

/**
 * The golden shrine in the sarovar, in a 600×459 elevation: a marble plinth in
 * the water with a low balustrade and corner lamps; the marble lower storey
 * with its cusped arcade, inlay band and the gilt central doorway lit within;
 * a gilt chhajja; the gold upper storey with seven lit windows; a parapet of
 * domelets; four corner chhatris; a drum of niches, a ring of lotus petals and
 * the great fluted inverted-lotus dome with its kalash and chhatri finial.
 * Backlit: the dawn rims every edge, the halo glows behind the dome.
 */
function Shrine(p: DrawProps) {
  const id = kitId(p, 'shr');
  const c = p.colors;
  const gold = mix(c.secondary, c.accent, 0.18);
  const line = shade(gold, 0.45);
  const marble = mix(c.background, '#ffffff', 0.35);
  const marbleShade = mix(marble, c.muted, 0.22);
  const recess = shade(gold, 0.42);
  const lamp = '#ffd98a';
  const rim = p.light.rim;
  const lit = mix(recess, lamp, 0.45);
  const g = url(`${id}m`);
  // Corner chhatri at x (centre), standing on y, s its scale.
  const chhatri = (x: number, y: number, s: number) =>
    P`M${x - 20 * s} ${y}V${y - 3 * s}H${x + 20 * s}V${y}Z` +
    P`M${x - 17 * s} ${y - 3 * s}h${3 * s}v${-20 * s}h${-3 * s}ZM${x - 5.5 * s} ${y - 3 * s}h${3 * s}v${-20 * s}h${-3 * s}ZM${x + 2.5 * s} ${y - 3 * s}h${3 * s}v${-20 * s}h${-3 * s}ZM${x + 14 * s} ${y - 3 * s}h${3 * s}v${-20 * s}h${-3 * s}Z` +
    P`M${x - 21 * s} ${y - 23 * s}H${x + 21 * s}L${x + 18 * s} ${y - 27 * s}H${x - 18 * s}Z` +
    domelet(x - 16 * s, x + 16 * s, y - 27 * s, 24 * s) +
    P`M${x - 1.6 * s} ${y - 51 * s}h${3.2 * s}v${-9 * s}h${-3.2 * s}Z`;
  const flutes = [-56, -40, -24, -8, 8, 24, 40, 56].map((dx) => {
    const seg: Segment = [
      [300 + dx * 1.18, 160],
      [300 + dx * 1.42, 128],
      [300 + dx * 0.7, 84],
      [300, 36],
    ];
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => onCubic(seg, t));
    return pts.map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('');
  });
  const dome = P`M232 160C214 128 236 96 262 76C282 61 294 52 300 34C306 52 318 61 338 76C364 96 386 128 368 160Z`;
  const petals = Array.from({ length: 15 }, (_, i) => {
    const x = 231 + i * 9.9;
    return P`M${x - 5} 172C${x - 5} 165 ${x - 1.5} 161 ${x} 158C${x + 1.5} 161 ${x + 5} 165 ${x + 5} 172Z`;
  }).join('');
  const domelets = Array.from({ length: 17 }, (_, i) => domelet(162 + i * 16.5 - 5, 162 + i * 16.5 + 5, 196, 11)).join('');
  const upperWin = Array.from({ length: 7 }, (_, i) => cuspArch(171 + i * 38, 193 + i * 38, 218, 266)).join('');
  const lowerBays = [180, 236].flatMap((x) => [cuspArch(x - 19, x + 19, 316, 418), cuspArch(600 - x - 19, 600 - x + 19, 316, 418)]).join('');
  const posts = Array.from({ length: 24 }, (_, i) => P`M${78 + i * 19.1} 431V420`).join('');
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} x1={150} y1={20} x2={450} y2={459} stops={metalStops(shade(gold, 0.06)).map(([o, col]) => [o, col] as const)} />
        <Glow id={`${id}h`} color={p.light.color} core={tint(p.light.color, 0.5)} a={0.55} />
        <Glow id={`${id}d`} color={lamp} core="#fff4d0" a={0.95} />
        <Lin id={`${id}w`} x2={0} y1={285} y2={432} stops={[[0, marble], [0.75, marbleShade], [1, shade(marbleShade, 0.08)]]} />
      </defs>
      {/* The halo of the dawn behind the dome. */}
      <ellipse cx={300} cy={170} rx={250} ry={168} fill={url(`${id}h`)} />
      {/* Plinth and its balustrade. */}
      <path d={P`M66 432H534L540 459H60Z`} fill={marbleShade} />
      <path d={P`M66 432H534`} stroke={g} strokeWidth={2.4} />
      <path d={P`M70 418H530`} stroke={marble} strokeWidth={3} />
      <path d={posts} stroke={marbleShade} strokeWidth={4} />
      <path d={P`M70 418H530`} stroke={g} strokeWidth={1} opacity={0.8} />
      {[74, 526].map((x) => (
        <g key={x}>
          <path d={P`M${x - 3} 418V396H${x + 3}V418Z`} fill={g} />
          <circle cx={x} cy={392} r={5} fill={url(`${id}d`)} />
        </g>
      ))}
      {/* The marble lower storey: arcade, inlay band, the gilt doorway lit within. */}
      <rect x={150} y={285} width={300} height={147} fill={url(`${id}w`)} />
      <path d={lowerBays} fill={marbleShade} stroke={line} strokeWidth={0.8} />
      <path d={[180, 236, 364, 420].map((x) => cuspArch(x - 12, x + 12, 336, 410)).join('')} fill={lit} opacity={0.55} />
      <path d={P`M150 296H450M150 306H450`} stroke={g} strokeWidth={1.4} />
      <path d={Array.from({ length: 30 }, (_, i) => P`M${155 + i * 10} 301q2.5 -3 5 0t5 0`).join('')} stroke={mix(c.primary, marble, 0.45)} strokeWidth={1.1} fill="none" />
      <path d={P`M159.5 301.3H452`} stroke={c.secondary} strokeWidth={2.6} strokeDasharray="0 10" strokeLinecap="round" />
      <path d={P`M150 418H450V432H150Z`} fill={marbleShade} />
      <path d={cuspArch(266, 334, 312, 432)} fill={g} />
      <path d={cuspArch(274, 326, 322, 432)} fill={lamp} />
      <path d={cuspArch(282, 318, 336, 432)} fill={url(`${id}d`)} />
      {[150, 444].map((x) => (
        <rect key={x} x={x} y={285} width={6} height={147} fill={g} opacity={0.85} />
      ))}
      {/* The chhajja. */}
      <path d={P`M136 272H464L456 287H144Z`} fill={g} stroke={line} strokeWidth={0.8} />
      <path d={Array.from({ length: 14 }, (_, i) => P`M${158 + i * 22} 287v5h4v-5`).join('')} fill={g} />
      {/* The gold upper storey. */}
      <rect x={160} y={205} width={280} height={67} fill={g} stroke={line} strokeWidth={0.8} />
      <path d={P`M160 211H440`} stroke={tint(gold, 0.45)} strokeWidth={2.2} opacity={0.8} />
      <path d={upperWin} fill={recess} />
      <path d={Array.from({ length: 7 }, (_, i) => cuspArch(175 + i * 38, 189 + i * 38, 230, 266)).join('')} fill={lit} opacity={0.7} />
      {/* Roof cornice, parapet of domelets. */}
      <rect x={150} y={196} width={300} height={9} fill={g} stroke={line} strokeWidth={0.7} />
      <path d={domelets} fill={g} stroke={line} strokeWidth={0.5} />
      {/* Corner chhatris. */}
      <path d={chhatri(172, 196, 1) + chhatri(428, 196, 1)} fill={g} stroke={line} strokeWidth={0.6} />
      {/* Drum with niches, the lotus ring, the dome and its finial. */}
      <rect x={238} y={168} width={124} height={28} fill={g} stroke={line} strokeWidth={0.7} />
      <path d={Array.from({ length: 7 }, (_, i) => cuspArch(244 + i * 16.6, 254 + i * 16.6, 173, 193)).join('')} fill={recess} />
      <path d={petals} fill={g} stroke={line} strokeWidth={0.5} />
      <path d={dome} fill={g} stroke={line} strokeWidth={1} />
      <path d={flutes.join('')} stroke={line} strokeWidth={0.8} fill="none" opacity={0.6} />
      <path d={P`M248 120C266 104 284 98 300 97C316 98 334 104 352 120`} stroke={tint(gold, 0.6)} strokeWidth={1.6} fill="none" opacity={0.55} />
      <path d={P`M300 34C305 30 307 26 300 20C293 26 295 30 300 34ZM296 20h8v-3h-8ZM286 15C292 9 308 9 314 15ZM298.6 9V-1h2.8V9Z`} fill={g} stroke={line} strokeWidth={0.5} />
      {/* Backlight: a rim on every edge facing the dawn. */}
      <path d={`${dome}${chhatri(172, 196, 1)}${chhatri(428, 196, 1)}`} fill="none" stroke={rim} strokeWidth={1.3} opacity={0.75} />
      <path d={P`M136 272H464M160 205V272M440 205V272M150 285V432M450 285V432M150 196H450`} stroke={rim} strokeWidth={1.1} opacity={0.55} fill="none" />
    </KitSvg>
  );
}

// ─────────────────────────── the reflection in the water ───────────────────────────

/** The shrine's silhouette by height above the water: half-widths (world units) and the material. */
function profile(hgt: number): Array<{ dx: number; half: number; gold: boolean }> {
  if (hgt < 27) return [{ dx: 0, half: 236, gold: false }];
  if (hgt < 41) return [{ dx: 0, half: 230, gold: false }];
  if (hgt < 174) return [{ dx: 0, half: 150, gold: false }];
  if (hgt < 187) return [{ dx: 0, half: 162, gold: true }];
  if (hgt < 263) return [{ dx: 0, half: 145, gold: true }];
  const out: Array<{ dx: number; half: number; gold: boolean }> = [];
  if (hgt < 323) out.push({ dx: -128, half: 18 - Math.max(0, hgt - 290) * 0.45, gold: true }, { dx: 128, half: 18 - Math.max(0, hgt - 290) * 0.45, gold: true });
  if (hgt < 291) out.push({ dx: 0, half: 64, gold: true });
  else if (hgt < 425) {
    const f = (hgt - 299) / 126; // 0 at the dome's foot, 1 at its tip
    out.push({ dx: 0, half: Math.max(3, 70 * (1 - f * f) - (f < 0.2 ? 0 : 0)), gold: true });
  } else out.push({ dx: 0, half: 3, gold: true });
  return out;
}

/**
 * The sarovar with the shrine lying in it: the kit's still water, and over it
 * the shrine's reflection drawn on the water plane, pre-distorted for the rest
 * eye (a point h above the water at depth D mirrors to the water at depth
 * D·e/(e+h), x likewise toward the centre), in strips broken by ripples.
 */
function Sarovar(p: DrawProps) {
  const g = p.plane ?? { x0: POOL.x0, x1: POOL.x1, y0: 800.5, y1: 800.5, dNear: POOL.dNear, dFar: POOL.dFar };
  const id = kitId(p, 'srv');
  const c = p.colors;
  const low = p.detail === 'low';
  const gold = tint(mix(c.secondary, c.accent, 0.35), 0.12);
  const marble = mix(c.background, '#ffffff', 0.3);
  const fx = (x: number) => x - g.x0;
  const fy = (d: number) => g.dFar - d;
  const at = (d: number) => r2((g.dFar - d) / (g.dFar - g.dNear));
  const rows: Array<{ y: number; th: number; gold: string; marble: string; a: number }> = [];
  const step = low ? 14 : 10;
  for (let hgt = 0, i = 0; hgt < 440; hgt += step, i++) {
    const t0 = EYE_ABOVE_WATER / (EYE_ABOVE_WATER + hgt);
    const t1 = EYE_ABOVE_WATER / (EYE_ABOVE_WATER + hgt + step * 0.62);
    const d0 = SHRINE.d * t0;
    const d1 = SHRINE.d * t1;
    const wobble = (rand(i, p.seed + 3) - 0.5) * (4 + hgt * 0.05);
    const row = { y: Math.round(fy((d0 + d1) / 2)), th: d0 - d1, gold: '', marble: '', a: 0.85 - (hgt / 440) * 0.45 };
    rows.push(row);
    // The causeway parts the reflection: each row's silhouette is laid out from the causeway's edges outward,
    // so the shrine lies in the water on both sides of it, row for row with the shrine above.
    for (const s of profile(hgt)) {
      const half = s.half * t0 * 1.1;
      for (const side of [-1, 1]) {
        const edge = side < 0 ? CW.x0 : CW.x1;
        const inner = edge + side * (Math.max(0, s.dx * side) * t0 * 0.9 + 2);
        const outer = inner + side * (s.dx === 0 ? half : half * 2);
        const lo = Math.min(inner, outer) + wobble;
        const hi = Math.max(inner, outer) + wobble;
        // Broken by ripples: two or three dashes.
        const cuts = rand(i * 2 + (side > 0 ? 1 : 0), p.seed + 5) < 0.5 ? [0.35] : [0.25, 0.68];
        let a = lo;
        for (const k of [...cuts, 1]) {
          const b = lo + (hi - lo) * k;
          const gap = k < 1 ? (hi - lo) * 0.06 : 0;
          if (b - gap - a > row.th) row[s.gold ? 'gold' : 'marble'] += `M${Math.round(fx(a + row.th / 2))} ${row.y}H${Math.round(fx(b - gap - row.th / 2))}`;
          a = b + gap;
        }
      }
    }
  }
  // The dawn's path on the water: level dashes under the glow, widening toward the eye.
  const glitter = Array.from({ length: low ? 30 : 84 }, (_, i) => {
    const f = rand(i, p.seed + 21);
    const d = g.dFar - (g.dFar - g.dNear) * f * f;
    const spread = 60 + (g.dFar - d) * 0.12;
    const r = rand(i, p.seed + 22);
    const x = d > CW.dFar ? 600 + (r - 0.5) * 2 * (180 + spread) : r < 0.5 ? CW.x0 - r * 2 * spread : CW.x1 + (r - 0.5) * 2 * spread;
    const lw = (16 + rand(i, p.seed + 23) * 50) * (0.6 + f);
    return `M${Math.round(fx(x - lw / 2))} ${Math.round(fy(d))}h${Math.round(lw)}v${Math.round(3 + f * 9)}h${-Math.round(lw)}Z`;
  }).join('');
  // Ripples: long level strokes in the sky's colour, crowding toward the far end.
  const ripples = low
    ? ''
    : Array.from({ length: 110 }, (_, i) => {
        const f = rand(i, p.seed + 31);
        const d = g.dFar - (g.dFar - g.dNear) * (0.15 + 0.85 * f);
        const lw = 40 + rand(i, p.seed + 32) * 160 * (0.5 + f);
        const x = g.x0 + rand(i, p.seed + 33) * (g.x1 - g.x0 - lw);
        return `M${Math.round(fx(x))} ${Math.round(fy(d))}h${Math.round(lw)}`;
      }).join('');
  const swell = low
    ? ''
    : Array.from({ length: 46 }, (_, i) => {
        const f = rand(i, p.seed + 61);
        const d = CW.dFar - (CW.dFar - g.dNear) * f;
        const lw = 60 + rand(i, p.seed + 62) * 240 * (0.4 + f);
        const r = rand(i, p.seed + 63);
        const x = r < 0.5 ? CW.x0 - 40 - r * 2 * (900 + 800 * f) - lw : CW.x1 + 40 + (r - 0.5) * 2 * (900 + 800 * f);
        return `M${Math.round(fx(x))} ${Math.round(fy(d))}h${Math.round(lw)}`;
      }).join('');
  const horizon = mix(c.background, c.accent, 0.5);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin
          id={`${id}w`}
          y2={p.h}
          stops={[
            [0, horizon],
            [at(2750), mix(c.background, c.secondary, 0.22)],
            [at(2150), mix(mix(c.background, c.primary, 0.3), c.secondary, 0.06)],
            [at(1500), mix(mix(c.primary, c.background, 0.6), DAWN_WATER, 0.3)],
            [1, mix(mix(c.primary, c.background, 0.4), DAWN_WATER, 0.3)],
          ]}
        />
        <Glow id={`${id}g`} color={tint(p.light.color, 0.2)} core={tint(p.light.color, 0.6)} a={0.5} />
      </defs>
      <rect width={r2(p.w)} height={r2(p.h)} fill={url(`${id}w`)} />
      {/* The dawn glow lying on the water beyond and around the shrine. */}
      <ellipse cx={fx(600)} cy={fy(2700)} rx={1000} ry={620} fill={url(`${id}g`)} />
      {/* The sun's path: the dawn's gold lying down the water toward the eye, on both sides of the causeway. */}
      <ellipse cx={fx(600)} cy={fy(1500)} rx={1100} ry={1500} fill={url(`${id}g`)} opacity={0.5} />
      {ripples ? <path d={ripples} stroke={tint(c.background, 0.4)} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.42} /> : null}
      {swell ? <path d={swell} stroke={mix(c.primary, c.background, 0.3)} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.22} /> : null}
      <path d={glitter} fill={tint(p.light.color, 0.3)} opacity={0.85} />
      {rows.map((r, i) => (
        <g key={i} strokeWidth={r2(r.th)} strokeLinecap="round" opacity={r2(r.a)}>
          {r.marble ? <path d={r.marble} stroke={marble} opacity={0.72} /> : null}
          {r.gold ? <path d={r.gold} stroke={gold} opacity={0.92} /> : null}
        </g>
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── Pennant ───────────────────────────

/** The Nishan Sahib's kesari pennant (no emblem), flying to the right from its staff at the box's left edge. */
function Pennant(p: DrawProps) {
  const id = kitId(p, 'pen');
  const c = p.colors;
  const cloth = mix(c.secondary, '#e8701a', 0.35);
  const { w, h } = p;
  const top: Segment = [
    [0, 2],
    [w * 0.35, -2],
    [w * 0.6, h * 0.22],
    [w, h * 0.42],
  ];
  const bottom: Segment = [
    [w, h * 0.42],
    [w * 0.62, h * 0.62],
    [w * 0.32, h * 0.96],
    [0, h - 2],
  ];
  const q = (s: Segment, t: number) => onCubic(s, t);
  const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => q(top, t)).concat([0.2, 0.4, 0.6, 0.8, 1].map((t) => q(bottom, t)));
  const d = `${pts.map((pt, i) => `${i ? 'L' : 'M'}${r2(pt.x)} ${r2(pt.y)}`).join('')}Z`;
  const fold = taper(
    [
      [
        [w * 0.08, h * 0.5],
        [w * 0.3, h * 0.42],
        [w * 0.5, h * 0.6],
        [w * 0.82, h * 0.46],
      ],
    ],
    [h * 0.12, 0.5],
    10,
  );
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}c`} x2={w} stops={[[0, shade(cloth, 0.12)], [0.45, tint(cloth, 0.18)], [1, cloth]]} />
      </defs>
      <path d={d} fill={url(`${id}c`)} />
      <path d={fold} fill={shade(cloth, 0.22)} opacity={0.45} />
      <path d={d} fill="none" stroke={tint(c.accent, 0.2)} strokeWidth={1.6} opacity={0.85} />
      <path d={P`M0 0V${h}`} stroke={shade(cloth, 0.4)} strokeWidth={2.5} />
    </KitSvg>
  );
}

// ─────────────────────────── DawnMist ───────────────────────────

/** Mist lying on the sarovar: soft banks of the dawn's pale tone, feathered inside the box on every side. */
function DawnMist(p: DrawProps) {
  const id = kitId(p, 'mst');
  const tone = tint(p.colors.background, 0.5);
  const n = p.detail === 'low' ? 4 : 7;
  return (
    <KitSvg p={p}>
      <defs>
        <radialGradient id={`${id}b`}>
          <stop offset="0" stopColor={tone} stopOpacity={0.34} />
          <stop offset="0.55" stopColor={tone} stopOpacity={0.14} />
          <stop offset="1" stopColor={tone} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={r2(p.w / 2)} cy={r2(p.h * 0.66)} rx={r2(p.w * 0.5)} ry={r2(p.h * 0.32)} fill={url(`${id}b`)} />
      {Array.from({ length: n }, (_, i) => {
        const ry = p.h * (0.2 + rand(i, p.seed + 61) * 0.12);
        return <ellipse key={i} cx={r2(p.w * (0.08 + (0.84 * (i + rand(i, p.seed + 62) * 0.8)) / n))} cy={r2(p.h * 0.96 - ry)} rx={r2(p.w * (0.1 + rand(i, p.seed + 63) * 0.1))} ry={r2(ry)} fill={url(`${id}b`)} />;
      })}
    </KitSvg>
  );
}

// ─────────────────────────── the sky and the far parikrama ───────────────────────────

/**
 * The dawn sky (the kit's Sky) with the far shore drawn into it in frame
 * coordinates: the white parikrama standing on the water's far edge (frame y
 * 542 at d 3200), a few gilt domelets, and the two brick towers beside the
 * story column. Hazed by the sky plane's distance; quiet.
 */
function DawnSky(p: DrawProps & { pure: ThemeColors }) {
  const c = p.colors;
  const u = p.pure;
  const id = kitId(p, 'dsk');
  const sx = p.w / 1920;
  const sy = p.h / 1280;
  const fx = (x: number) => x + 360;
  const fy = (y: number) => y + 240;
  const low = p.detail === 'low';
  const base = 546;
  const marble = mix(c.background, c.muted, 0.12);
  const shadow = mix(c.background, c.muted, 0.35);
  const brick = mix(mix(mix(c.secondary, '#9a5a3c', 0.5), c.muted, 0.2), c.background, 0.3);
  const gold = mix(c.secondary, c.accent, 0.4);
  const blocks: string[] = [];
  const domes: string[] = [];
  for (let x = -360, i = 0; x < 1560; i++) {
    const bw = 40 + rand(i, p.seed + 11) * 70;
    const tall = 22 + rand(i, p.seed + 12) * 18;
    blocks.push(P`M${fx(x)} ${fy(base + 2)}V${fy(base - tall)}H${fx(x + bw + 0.5)}V${fy(base + 2)}Z`);
    if (rand(i, p.seed + 13) < 0.35) domes.push(domelet(fx(x + bw / 2 - 6), fx(x + bw / 2 + 6), fy(base - tall), 9));
    x += bw;
  }
  // The two bungas: a brick shaft tapering a little, two balcony ledges, an open kiosk with a domelet on top.
  const tower = (x: number) =>
    P`M${fx(x - 14)} ${fy(base)}L${fx(x - 11)} ${fy(base - 104)}H${fx(x + 11)}L${fx(x + 14)} ${fy(base)}Z` +
    P`M${fx(x - 16)} ${fy(base - 62)}h32v4h-32ZM${fx(x - 15)} ${fy(base - 104)}h30v5h-30Z` +
    P`M${fx(x - 12)} ${fy(base - 104)}V${fy(base - 118)}h3v14ZM${fx(x - 1.5)} ${fy(base - 104)}V${fy(base - 118)}h3v14ZM${fx(x + 9)} ${fy(base - 104)}V${fy(base - 118)}h3v14ZM${fx(x - 14)} ${fy(base - 118)}h28v3h-28Z` +
    domelet(fx(x - 11), fx(x + 11), fy(base - 121), 13);
  const slits = (x: number) => [26, 46, 80, 92].map((y) => P`M${fx(x - 1.6)} ${fy(base - y)}h3.2v-7h-3.2Z`).join('');
  // Long stratus streaks lit from below by the coming sun, kept low and soft.
  const streaks = Array.from({ length: low ? 5 : 9 }, (_, i) => {
    const y = 250 + rand(i, p.seed + 41) * 170;
    const x = -300 + rand(i, p.seed + 42) * 1800;
    const len = 260 + rand(i, p.seed + 43) * 520;
    const th = 3 + rand(i, p.seed + 44) * 6;
    return P`M${fx(x)} ${fy(y)}C${fx(x + len * 0.3)} ${fy(y - th)} ${fx(x + len * 0.7)} ${fy(y - th)} ${fx(x + len)} ${fy(y)}C${fx(x + len * 0.7)} ${fy(y + th * 0.6)} ${fx(x + len * 0.3)} ${fy(y + th * 0.6)} ${fx(x)} ${fy(y)}Z`;
  }).join('');
  // Rays: wedges from the shrine's dome, between -64° and +64° of upright, as fractions of a quarter turn built on a cubic (no trig).
  const rays = Array.from({ length: 15 }, (_, i) => {
    const f = (i + 0.5) / 15 - 0.5; // -0.5..0.5
    const lean = f * 1.4; // horizontal run per unit of rise
    const len = 520;
    const half = 0.018 + (i % 2) * 0.012;
    const ox = fx(600);
    const oy = fy(470);
    return P`M${ox} ${oy}L${ox + (lean - half) * len} ${oy - len}L${ox + (lean + half) * len} ${oy - len}Z`;
  }).join('');
  // The last stars of the night, beside the story column only.
  const stars = low
    ? ''
    : Array.from({ length: 22 }, (_, i) => {
        const right = rand(i, p.seed + 51) > 0.5;
        const x = right ? 830 + rand(i, p.seed + 52) * 700 : -330 + rand(i, p.seed + 52) * 700;
        const f = rand(i, p.seed + 53);
        const y = -200 + f * f * 360;
        const r = 0.8 + rand(i, p.seed + 54) * 1.4;
        return P`M${fx(x) - r} ${fy(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      }).join('');
  return (
    <KitSvg p={p}>
      <g transform={sx !== 1 || sy !== 1 ? `scale(${r2(sx * 1000) / 1000} ${r2(sy * 1000) / 1000})` : undefined}>
        <defs>
          <Lin
            id={`${id}s`}
            y2={1280}
            stops={[
              [0, tint(u.primary, 0.5)],
              [fy(40) / 1280, tint(u.primary, 0.62)],
              [fy(200) / 1280, mix(tint(u.primary, 0.78), u.secondary, 0.16)],
              [fy(390) / 1280, mix(u.background, u.secondary, 0.24)],
              [fy(445) / 1280, mix(u.background, u.accent, 0.62)],
              [1, mix(u.background, u.accent, 0.45)],
            ]}
          />
          <Glow id={`${id}g`} color={tint(p.light.color, 0.1)} core={tint(p.light.color, 0.55)} a={0.75} />
          <radialGradient id={`${id}r`} gradientUnits="userSpaceOnUse" cx={fx(600)} cy={fy(470)} r={560}>
            <stop offset="0" stopColor={tint(p.light.color, 0.4)} stopOpacity={0.26} />
            <stop offset="0.45" stopColor={p.light.color} stopOpacity={0.09} />
            <stop offset="1" stopColor={p.light.color} stopOpacity={0} />
          </radialGradient>
          <Lin id={`${id}c`} y1={fy(250)} y2={fy(430)} stops={[[0, mix(u.background, u.primary, 0.18)], [1, mix(u.background, u.secondary, 0.4)]]} />
        </defs>
        <rect width={1920} height={1280} fill={url(`${id}s`)} />
        <ellipse cx={fx(600)} cy={fy(470)} rx={620} ry={250} fill={url(`${id}g`)} />
        {/* The first light fanning up from behind the shrine: thin, soft rays (the sunburst of the suite). */}
        <path d={rays} fill={url(`${id}r`)} />
        <path d={streaks} fill={url(`${id}c`)} opacity={0.55} />
        {stars ? <path d={stars} fill={tint(u.accent, 0.6)} opacity={0.7} /> : null}
        <path d={tower(230) + tower(985)} fill={brick} />
        <path d={slits(230) + slits(985)} fill={shade(brick, 0.35)} />
        <path d={blocks.join('')} fill={marble} />
        {low ? null : <path d={P`M0 ${fy(base - 4)}H1920`} stroke={shadow} strokeWidth={7} strokeDasharray="4 3" opacity={0.7} />}
        <path d={domes.join('')} fill={gold} opacity={0.75} />
      </g>
    </KitSvg>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const causeway: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const lampGlow = '#ffe2a0';
  const lamps: Piece[] = LAMP_D.flatMap((d, j) =>
    [-1, 1].map(
      (s): Piece => ({
        kind: 'prop',
        id: `lamp-${j}-${s < 0 ? 'l' : 'r'}`,
        art: 'lampPost:gilt',
        role: 'prop',
        ...billboard({ x: 600 + s * LAMP_X, d, w: 40, h: 300, base: 796 }),
        buildIn: 'rise',
        draw: drawWith(LampPost, { variant: 'gilt' }),
      }),
    ),
  );
  return {
    name: 'causeway',
    // Behind everything: the dawn, pale gold at the horizon, the night's blue lifting overhead.
    sky: `linear-gradient(180deg, ${mix(c.primary, c.background, 0.56)} 0%, ${mix(c.background, c.secondary, 0.24)} 46%, ${mix(c.background, c.accent, 0.6)} 55%, ${mix(c.background, c.primary, 0.3)} 100%)`,
    light: { from: 'far', color: '#ffe9c2', rim: '#fff3d6' },
    fog: { color: '#e9dcc6', near: 1700, far: 3200, max: 0.42 },
    veil: 0.25,
    focus: { x: 600, y: 600, z: -SHRINE.d },
    poses: { rest: { x: 600, y: REST_Y, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 60 } },
    pieces: [
      { kind: 'plane', id: 'sky', art: 'sky:dawn', role: 'sky', quiet: true, plane: sky({ d: SKY_D }), draw: (p) => createElement(DawnSky, { ...p, pure: c }) },
      { kind: 'plane', id: 'water', art: 'water:still', role: 'architecture', plane: floor({ x0: POOL.x0, x1: POOL.x1, dNear: POOL.dNear, dFar: POOL.dFar }), draw: Sarovar },
      {
        kind: 'plane',
        id: 'causeway',
        art: 'floor:flags',
        role: 'architecture',
        plane: floor({ x0: CW.x0, x1: CW.x1, y: CW.y, dNear: CW.dNear, dFar: CW.dFar }),
        draw: drawWith(Floor, {
          variant: 'flags',
          pools: [
            ...LAMP_D.flatMap((d, j) => [-1, 1].map((s) => ({ x: 600 + s * LAMP_X, d, r: 95 - j * 12, color: lampGlow }))),
            { x: 600, d: CW.dFar - 60, r: 170, color: '#ffe9a8' },
          ],
        }),
      },
      { kind: 'plane', id: 'rail-left', art: 'wall:marbleRail', role: 'architecture', plane: wall('left', { x: CW.x0, yTop: 720, dNear: CW.dNear, dFar: CW.dFar }), draw: drawWith(Wall, { variant: 'marbleRail' }) },
      { kind: 'plane', id: 'rail-right', art: 'wall:marbleRail', role: 'architecture', plane: wall('right', { x: CW.x1, yTop: 720, dNear: CW.dNear, dFar: CW.dFar }), draw: drawWith(Wall, { variant: 'marbleRail' }) },

      // The focal: the golden shrine.
      { kind: 'prop', id: 'shrine', art: 'goldenTemple', role: 'focal', ...billboard({ x: 600, d: SHRINE.d, w: SHRINE.w, h: SHRINE.h }), draw: Shrine },

      // The lamp-lined causeway.
      ...lamps,

      // The Nishan Sahib staffs in the water, their pennants in the dawn breeze.
      ...[-1, 1].map((s): Piece => ({ kind: 'prop', id: `staff-${s < 0 ? 'l' : 'r'}`, art: 'pole:flag', role: 'prop', ...billboard({ x: 600 + s * 440, d: 1700, w: 40, h: 620 }), buildIn: 'rise', draw: (p) => drawWith(Pole, { variant: 'flag' })({ ...p, colors: { ...p.colors, primary: shade(mix(p.colors.secondary, '#e8701a', 0.35), 0.08) } }) })),
      ...[-1, 1].map((s, i): Piece => ({ kind: 'prop', id: `pennant-${s < 0 ? 'l' : 'r'}`, art: 'pennant', role: 'prop', ...hang({ x: 600 + s * 440 + 46, d: 1699, w: 90, h: 60, top: 196 }), motion: { kind: 'flutter', amp: 4, period: 1.2, phase: i * 0.37 }, draw: Pennant })),

      // Mist on the water; birds crossing the dawn.
      { kind: 'prop', id: 'mist-near', art: 'mist', role: 'prop', ...billboard({ x: 600, d: 1100, w: 2400, h: 100 }), motion: { kind: 'drift', amp: 30, period: 18 }, draw: DawnMist },
      { kind: 'prop', id: 'mist-far', art: 'mist', role: 'prop', ...billboard({ x: 600, d: 2600, w: 2600, h: 130 }), motion: { kind: 'drift', amp: 30, period: 18, phase: 0.5 }, draw: DawnMist },
      { kind: 'prop', id: 'birds', art: 'birds', role: 'hanging', detail: 'high', ...hang({ x: 920, d: 2800, w: 520, h: 150, top: -1500 }), motion: { kind: 'drift', amp: 24, period: 14 }, draw: motif('birds', { tint: shade(c.text, 0.1) }) },

      // Lights: the dawn at the shrine, the nearest lamps.
      { kind: 'light', id: 'glow-shrine', art: 'glow', role: 'light', at: { x: 600, y: 610, z: -(SHRINE.d - 50) }, r: 220, color: '#ffe9a8', strength: 0.6, bloom: true, buildIn: 'bloom' },
      ...[-1, 1].map((s, i): Piece => ({ kind: 'light', id: `glow-lamp-${s < 0 ? 'l' : 'r'}`, art: 'glow', role: 'light', at: { x: 600 + s * LAMP_X, y: 522, z: -LAMP_D[0] }, r: 50, color: lampGlow, strength: 0.5, motion: { kind: 'pulse', amp: 0.4, period: 3.2, phase: i * 0.5 }, buildIn: 'light' })),
    ],
    covers: { gate: 'ghat', door: 'haveli', silk: 'dawn', card: 'trifold' },
    particles: { count: 30, dNear: 700, dFar: 2400 },
  };
};
