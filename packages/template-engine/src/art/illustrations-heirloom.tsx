import type { ReactNode } from 'react';
import { hex, Metal, onCubic, tint, useSafeId, type IllustrationProps, type Segment } from './kit';
import { r2, rand } from './motifs';

/**
 * Heirloom stationery: gold line art in the manner of foil-stamped wedding
 * cards. A mandala crown for the top edge (and its half, without the pendant,
 * for the bottom), a double hairline frame, floral vines for the sides,
 * scattered sparkles, a botanical wreath and an art deco frame: fine lace on
 * dark or light stock. The tint is the metal; `foil` stamps it.
 */

// ─────────────────────────── Shared pieces ───────────────────────────

/**
 * Elements every `step` degrees around the mandala's centre (200, 0), from the
 * left edge through straight down to the right edge. Each is drawn pointing
 * down (+y) and turned into place by an SVG rotation, so no trigonometry runs.
 */
function fan(step: number, render: (key: number, angle: number) => ReactNode, offset = 0, limit = 96): ReactNode[] {
  const k = Math.ceil(limit / step) + 1;
  const out: ReactNode[] = [];
  for (let j = -k; j <= k; j++) {
    const a = r2(j * step + offset);
    if (Math.abs(a) <= limit) out.push(render(j, a));
  }
  return out;
}

const at0 = (a: number) => `rotate(${a} 200 0)`;

/** A unit vector, by arithmetic and a square root. */
function unit(x: number, y: number): [number, number] {
  const len = Math.sqrt(x * x + y * y) || 1;
  return [x / len, y / len];
}

/** An SVG transform placing art drawn pointing up (local -y) at (x, y), pointing along (dx, dy). */
function toward(x: number, y: number, dx: number, dy: number, scale = 1): string {
  const [ux, uy] = unit(dx, dy);
  return `matrix(${r2(-uy * scale)} ${r2(ux * scale)} ${r2(-ux * scale)} ${r2(-uy * scale)} ${r2(x)} ${r2(y)})`;
}

/** A leaf from (x, y) along (dx, dy): an almond with a midrib. */
function leafPath(x: number, y: number, dx: number, dy: number, length: number, width: number): { blade: string; rib: string } {
  const [ux, uy] = unit(dx, dy);
  const [px, py] = [-uy * width, ux * width];
  const p = (along: number, across: number) => `${r2(x + ux * length * along + px * across)} ${r2(y + uy * length * along + py * across)}`;
  return {
    blade: `M${r2(x)} ${r2(y)} C${p(0.28, 1)} ${p(0.72, 0.85)} ${p(1, 0)} C${p(0.72, -0.85)} ${p(0.28, -1)} ${r2(x)} ${r2(y)}Z`,
    rib: `M${r2(x)} ${r2(y)} L${p(0.86, 0)}`,
  };
}

// ─────────────────────────── Mandala crown ───────────────────────────

/** The mandala's rings around (200, 0): lace points, a lotus ring, scallops, a petal ring and a rosette. */
function MandalaRings({ metal, c }: { metal: string; c: string }) {
  const light = tint(c, 0.55);
  return (
    <g>
      {/* Lace points with their tip pearls, and dots between them. */}
      {fan(7.5, (k, a) => (
        <g key={`l${k}`} transform={at0(a)}>
          <path d="M200 174 C207 180.5 207 189 200 196 C193 189 193 180.5 200 174Z" fill="none" stroke={metal} strokeWidth="0.9" />
          <path d="M200 178.5 V191.5" stroke={metal} strokeWidth="0.6" />
          <circle cx="200" cy="200.2" r="1.45" fill={metal} />
        </g>
      ))}
      {fan(7.5, (k, a) => <circle key={`d${k}`} cx="200" cy="187" r="1.05" fill={metal} transform={at0(a)} />, 3.75)}
      <circle cx="200" cy="0" r="171" fill="none" stroke={metal} strokeWidth="1.1" />
      <circle cx="200" cy="0" r="166" fill="none" stroke={metal} strokeWidth="2.3" strokeDasharray="0 6.2" strokeLinecap="round" />
      <circle cx="200" cy="0" r="161" fill="none" stroke={metal} strokeWidth="0.75" />
      {/* The lotus ring: pointed petals with an inner petal and a vein, small leaves between. */}
      {fan(20, (k, a) => (
        <g key={`p${k}`} transform={at0(a)}>
          <path d="M200 116 C192 116 182.5 123 182.5 134 C182.5 146 195 152 200 164 C205 152 217.5 146 217.5 134 C217.5 123 208 116 200 116Z" fill="none" stroke={metal} strokeWidth="1.2" />
          <path d="M200 123.5 C195 123.5 189 128 189 135.5 C189 143.5 197 148 200 156 C203 148 211 143.5 211 135.5 C211 128 205 123.5 200 123.5Z" fill="none" stroke={metal} strokeWidth="0.7" />
          <path d="M200 127 V151 M200 133 Q194.5 137 195 144 M200 133 Q205.5 137 205 144" fill="none" stroke={metal} strokeWidth="0.55" />
          <circle cx="200" cy="168" r="1.2" fill={metal} />
        </g>
      ))}
      {fan(20, (k, a) => (
        <g key={`q${k}`} transform={at0(a)}>
          <path d="M200 145 C203.6 150.5 203.6 157 200 163.5 C196.4 157 196.4 150.5 200 145Z" fill={metal} />
          <circle cx="200" cy="139.5" r="1.3" fill={metal} />
        </g>
      ), 10)}
      <circle cx="200" cy="0" r="113" fill="none" stroke={metal} strokeWidth="1.3" />
      <circle cx="200" cy="0" r="108.4" fill="none" stroke={metal} strokeWidth="0.6" />
      {/* Scallops, each holding a dot. */}
      {fan(8, (k, a) => (
        <g key={`s${k}`} transform={at0(a)}>
          <path d="M193.02 99.76 A7 7 0 0 0 206.98 99.76" fill="none" stroke={metal} strokeWidth="1" />
          <circle cx="200" cy="102.4" r="1.1" fill={metal} />
        </g>
      ))}
      <circle cx="200" cy="0" r="99.8" fill="none" stroke={metal} strokeWidth="0.7" />
      <circle cx="200" cy="0" r="94" fill="none" stroke={metal} strokeWidth="1.9" strokeDasharray="0 4.4" strokeLinecap="round" />
      <circle cx="200" cy="0" r="89" fill="none" stroke={metal} strokeWidth="0.9" />
      {/* Solid petals, with outlined ones between. */}
      {fan(30, (k, a) => (
        <g key={`f${k}`} transform={at0(a)}>
          <path d="M200 50 C211 60 211 74 200 86 C189 74 189 60 200 50Z" fill="none" stroke={metal} strokeWidth="1" />
          <path d="M200 58 C205.5 64 205.5 72 200 79 C194.5 72 194.5 64 200 58Z" fill={metal} />
        </g>
      ))}
      {fan(30, (k, a) => <path key={`o${k}`} d="M200 59 C206 66.5 206 74.5 200 82 C194 74.5 194 66.5 200 59Z" fill="none" stroke={metal} strokeWidth="0.8" transform={at0(a)} />, 15)}
      <circle cx="200" cy="0" r="46" fill="none" stroke={metal} strokeWidth="1.4" />
      <circle cx="200" cy="0" r="41.8" fill="none" stroke={metal} strokeWidth="0.6" />
      {/* The rosette at the heart. */}
      {fan(30, (k, a) => (
        <g key={`r${k}`} transform={at0(a)}>
          <path d="M200 11 C208 19 208 30 200 38 C192 30 192 19 200 11Z" fill="none" stroke={metal} strokeWidth="0.9" />
          <path d="M200 16 C203.6 21 203.6 27 200 32 C196.4 27 196.4 21 200 16Z" fill={metal} />
        </g>
      ))}
      <circle cx="200" cy="0" r="9.5" fill={metal} />
      <circle cx="200" cy="0" r="4" fill={light} />
    </g>
  );
}

function MandalaGlow({ id, c }: { id: string; c: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}g`} gradientUnits="userSpaceOnUse" cx="200" cy="0" r="215">
          <stop offset="0" stopColor={tint(c, 0.35)} stopOpacity="0.2" />
          <stop offset="0.7" stopColor={tint(c, 0.2)} stopOpacity="0.08" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="0" r="215" fill={`url(#${id}g)`} />
    </>
  );
}

/**
 * A mandala crown for the top edge of a card: a half mandala of lace points,
 * a lotus ring, scallops and a rosette, with a lotus-bud pendant hanging from
 * its centre. Its flat edge is the top of the frame.
 */
export function MandalaCrown({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 400 290" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={400} y2={290} />
      </defs>
      <MandalaGlow id={id} c={c} />
      <MandalaRings metal={metal} c={c} />
      {/* The pendant: three pearls and a lotus bud between two curled leaves. */}
      <circle cx="200" cy="206" r="2.4" fill={metal} />
      <circle cx="200" cy="212.6" r="1.9" fill={metal} />
      <circle cx="200" cy="218.4" r="1.5" fill={metal} />
      <path d="M199 226 C190 222.5 181 227.5 177.5 236.5 C186 236 193.5 232 199 226Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M201 226 C210 222.5 219 227.5 222.5 236.5 C214 236 206.5 232 201 226Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M200 222 C213 233 215.5 249 200 266 C184.5 249 187 233 200 222Z" fill="none" stroke={metal} strokeWidth="1.2" />
      <path d="M200 231 C207.5 240 208.5 251 200 260 C191.5 251 192.5 240 200 231Z" fill={metal} />
      <path d="M200 235 C203.2 241 203.5 248 200 254" fill="none" stroke={tint(c, 0.55)} strokeWidth="0.8" />
      <circle cx="200" cy="271.5" r="2.2" fill={metal} />
      <path d="M200 274 V283" stroke={metal} strokeWidth="1" strokeLinecap="round" />
      <circle cx="200" cy="285.5" r="1.3" fill={metal} />
    </svg>
  );
}

/** The crown without its pendant: a half mandala for the top or (flipped) the bottom edge. */
export function MandalaHalf({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  return (
    <svg viewBox="0 0 400 204" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={400} y2={204} />
      </defs>
      <MandalaGlow id={id} c={c} />
      <MandalaRings metal={`url(#${id}m)`} c={c} />
    </svg>
  );
}

// ─────────────────────────── Hairline frame ───────────────────────────

/** Where the rules of a hairline frame of this size sit: the outer and inner insets and the unit they scale by. */
export function hairlineInsets(w: number, h: number): { unit: number; outer: number; inner: number } {
  const unit = Math.min(1.7, Math.min(w, h) / 390);
  return { unit, outer: 21.5 * unit, inner: 33 * unit };
}

/**
 * A double hairline frame for the whole card, drawn to the layer's size: a
 * firm outer rule and a fine inner rule with concave corners, a small
 * four-petal flower at each outer corner and a dot where the inner corners
 * turn. Lay it over the full artboard; the insets follow the card's shorter
 * side, so every card format keeps the same margins.
 */
export function HairlineFrame({ color, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const { unit: u, outer: o, inner: i } = hairlineInsets(w, h);
  const r = 8 * u;
  const [x0, y0, x1, y1] = [i, i, w - i, h - i];
  const f = r2;
  const notched = `M${f(x0 + r)} ${f(y0)} H${f(x1 - r)} A${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(y0 + r)} V${f(y1 - r)} A${f(r)} ${f(r)} 0 0 0 ${f(x1 - r)} ${f(y1)} H${f(x0 + r)} A${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(y1 - r)} V${f(y0 + r)} A${f(r)} ${f(r)} 0 0 0 ${f(x0 + r)} ${f(y0)}Z`;
  const corners: Array<[number, number]> = [
    [o, o],
    [w - o, o],
    [w - o, h - o],
    [o, h - o],
  ];
  return (
    <svg viewBox={`0 0 ${f(w)} ${f(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={w} y2={h} />
      </defs>
      <rect x={f(o)} y={f(o)} width={f(w - o * 2)} height={f(h - o * 2)} fill="none" stroke={metal} strokeWidth={f(1.3 * u)} />
      <path d={notched} fill="none" stroke={metal} strokeWidth={f(0.7 * u)} />
      {corners.map(([x, y], k) => (
        <g key={k} transform={`translate(${f(x)} ${f(y)}) scale(${f(u)})`}>
          {[0, 90, 180, 270].map((a) => (
            <path key={a} d="M0 -1.2 C1.9 -2.6 2 -5 0 -6.6 C-2 -5 -1.9 -2.6 0 -1.2Z" fill={metal} transform={`rotate(${a + 45})`} />
          ))}
          <circle r="1.5" fill={metal} />
        </g>
      ))}
      {[
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ].map(([x, y], k) => (
        <circle key={`d${k}`} cx={f(x!)} cy={f(y!)} r={f(1.6 * u)} fill={metal} />
      ))}
    </svg>
  );
}

// ─────────────────────────── Gold vine ───────────────────────────

/** A lotus seen from the side, pointing up (local -y), its base at the origin (about 37 × 28). */
function SideLotus({ metal, light }: { metal: string; light: string }) {
  return (
    <g>
      <path d="M0 0 C-9 -0.5 -16.5 -5.5 -18.5 -12 C-12 -11 -5 -6.5 0 0Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M0 0 C9 -0.5 16.5 -5.5 18.5 -12 C12 -11 5 -6.5 0 0Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M0 0 C-7.5 -3.5 -12.5 -10.5 -11.5 -19 C-6 -15 -2 -8.5 0 0Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M0 0 C7.5 -3.5 12.5 -10.5 11.5 -19 C6 -15 2 -8.5 0 0Z" fill="none" stroke={metal} strokeWidth="0.9" />
      <path d="M0 0 C-5.5 -6.5 -5.5 -16 0 -23.5 C5.5 -16 5.5 -6.5 0 0Z" fill={metal} stroke={metal} strokeWidth="0.8" />
      <path d="M0 -4 C1.8 -9 1.8 -14 0 -19" fill="none" stroke={light} strokeWidth="0.7" />
      <path d="M-5 1.2 Q0 4.6 5 1.2" fill="none" stroke={metal} strokeWidth="0.9" />
      <circle cx="0" cy="-27" r="1.1" fill={metal} />
      <circle cx="-4.6" cy="-25" r="0.9" fill={metal} />
      <circle cx="4.6" cy="-25" r="0.9" fill={metal} />
    </g>
  );
}

/** A flower seen from the front: two rings of petals and a beaded heart (radius 10.5). */
function Bloom({ metal, light }: { metal: string; light: string }) {
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`a${i}`} d="M0 -1.5 C3.6 -4 3.8 -8 0 -10.5 C-3.8 -8 -3.6 -4 0 -1.5Z" fill="none" stroke={metal} strokeWidth="0.75" transform={`rotate(${i * 45})`} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`b${i}`} d="M0 -1 C2 -2.6 2.1 -5.2 0 -6.8 C-2.1 -5.2 -2 -2.6 0 -1Z" fill={metal} transform={`rotate(${i * 45 + 22.5})`} />
      ))}
      <circle r="2.3" fill={metal} />
      <circle r="0.9" fill={light} />
    </g>
  );
}

/** A bud on its sepals, pointing up (about 11 × 17). */
function Bud({ metal }: { metal: string }) {
  return (
    <g>
      <path d="M0 0 C-5.5 -5 -5.5 -12 0 -17 C5.5 -12 5.5 -5 0 0Z" fill={metal} />
      <path d="M-4.6 -2.4 C-2.4 0.8 2.4 0.8 4.6 -2.4" fill="none" stroke={metal} strokeWidth="0.9" />
    </g>
  );
}

/** A curled tendril from the origin (flip with a negative x scale). */
const CURL = 'M0 0 C3 -5 9 -7 12 -3 C14.5 0.5 11.5 4 8.6 2.4 C6.6 1.3 7.6 -1.6 9.6 -1';

/**
 * A floral vine for a card's side, drawn to the layer's size: a stem winding
 * down the outer third, and at intervals a flower opening toward the card (a
 * bloom, a lotus, a leafy bud) with its leaves, between them pairs of leaves,
 * tendrils and pearls, and a fuller cluster at each end. The flowers face +x
 * (the card's inside): mirror the layer for the right-hand side.
 */
export function GoldVine({ color, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const light = tint(c, 0.55);
  const W = Math.max(24, w);
  const H = Math.max(120, h);
  const u = W / 46;
  const cx = W * 0.3;
  const amp = W * 0.08;
  const n = Math.max(4, Math.round(H / (W * 1.5)));
  const step = H / n;
  const segs: Segment[] = Array.from({ length: n }, (_, i) => {
    const y0 = i * step;
    const k = 1.33 * amp * (i % 2 ? -1 : 1);
    return [
      [cx, y0],
      [cx + k, y0 + step / 3],
      [cx + k, y0 + (2 * step) / 3],
      [cx, y0 + step],
    ];
  });
  const stem = segs.map(([p0, c1, c2, p3], i) => `${i ? '' : `M${r2(p0[0])} ${r2(p0[1])} `}C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p3[0])} ${r2(p3[1])}`).join(' ');
  /** A point on the whole stem by length (0 = top, H = bottom), with its tangent. */
  const along = (y: number) => {
    const f = Math.min(n - 0.0001, Math.max(0, y / H) * n);
    const i = Math.floor(f);
    return onCubic(segs[i]!, f - i);
  };
  const parts: ReactNode[] = [];
  /** A leaf off the stem at y, on the inner (+1) or outer (-1) side, slanting up. */
  const leaf = (key: string, y: number, side: 1 | -1, size = 1, lift = 0.6) => {
    const p = along(y);
    const l = leafPath(p.x, p.y, side * p.ty - p.tx * lift, -side * p.tx - p.ty * lift, 13.5 * u * size, 4.1 * u * size);
    parts.push(
      <g key={key}>
        <path d={l.blade} fill={metal} fillOpacity="0.85" />
        <path d={l.rib} stroke={light} strokeWidth={r2(0.45 * u)} opacity="0.7" />
      </g>,
    );
  };
  /** A stalk from the stem at y to a flower on the inner side, `reach` across and `rise` up. */
  const stalk = (y: number, reach: number, rise: number) => {
    const p = along(y);
    const x = p.x + reach * u;
    const top = p.y - rise * u;
    parts.push(<path key={`k${y}`} d={`M${r2(p.x)} ${r2(p.y)} C${r2(p.x + reach * 0.4 * u)} ${r2(p.y)} ${r2(x - reach * 0.2 * u)} ${r2(top + rise * 0.5 * u)} ${r2(x)} ${r2(top)}`} fill="none" stroke={metal} strokeWidth={r2(0.9 * u)} />);
    return { x, y: top };
  };
  const bloom = (y: number, reach: number, rise: number, size: number) => {
    const at = stalk(y, reach, rise);
    parts.push(
      <g key={`b${y}`} transform={`translate(${r2(at.x)} ${r2(at.y)}) scale(${r2(size * u)})`}>
        <Bloom metal={metal} light={light} />
      </g>,
    );
  };
  const lotus = (y: number, size: number) => {
    const at = stalk(y, 7, 2);
    parts.push(
      <g key={`o${y}`} transform={toward(at.x, at.y, 0.75, -0.66, size * u)}>
        <SideLotus metal={metal} light={light} />
      </g>,
    );
  };
  const bud = (y: number, side: 1 | -1, size = 1) => {
    const p = along(y);
    const x = p.x + side * 6 * u * size;
    const top = p.y - 7 * u * size;
    parts.push(
      <g key={`u${y}`}>
        <path d={`M${r2(p.x)} ${r2(p.y)} Q${r2(p.x + side * 5 * u * size)} ${r2(p.y - 1 * u)} ${r2(x)} ${r2(top)}`} fill="none" stroke={metal} strokeWidth={r2(0.8 * u)} />
        <g transform={toward(x, top, side * 0.5, -1, 0.7 * u * size)}>
          <Bud metal={metal} />
        </g>
      </g>,
    );
  };
  const curl = (y: number, side: 1 | -1, size = 1) => {
    const p = along(y);
    // The stroke is drawn in the curl's own units, so it scales with it.
    parts.push(<path key={`c${y}`} d={CURL} fill="none" stroke={metal} strokeWidth={r2(0.9 / size)} transform={`translate(${r2(p.x)} ${r2(p.y)}) scale(${r2(side * u * size)} ${r2(u * size)})`} />);
  };
  const pearl = (y: number, dx: number, r: number) => {
    const p = along(y);
    parts.push(<circle key={`p${y}${dx}`} cx={r2(p.x + dx * u)} cy={r2(p.y)} r={r2(r * u)} fill={metal} />);
  };

  // The end clusters: a large bloom with three leaves, a bud and a tendril (top), mirrored at the foot.
  const end = 34 * u;
  for (const [y, s] of [
    [end * 0.55, 1],
    [H - end * 0.55, -1],
  ] as const) {
    leaf(`ea${y}`, y + 9 * u * s, 1, 1.25, 0.2);
    leaf(`eb${y}`, y + 4 * u * s, -1, 1.1);
    leaf(`ec${y}`, y + 18 * u * s, -1, 0.95);
    bloom(y, 11, 1, 1.25);
    bud(y + 26 * u * s, 1, 0.9);
    curl(y - 6 * u * s, -1, 1.15);
    pearl(y + 14 * u * s, 9, 0.9);
  }
  // Flowers along the way, each with its leaves; leaf pairs, pearls and tendrils between.
  const gap = 92 * u;
  const first = end + 30 * u;
  const count = Math.max(1, Math.floor((H - first - end - 20 * u) / gap) + 1);
  const spare = H - first - end - 20 * u - (count - 1) * gap;
  for (let i = 0; i < count; i++) {
    const y = first + spare / 2 + i * gap;
    const kind = (['lotus', 'bloom', 'buds'] as const)[i % 3];
    if (kind === 'lotus') {
      leaf(`na${i}`, y + 6 * u, 1, 1.15, 0.1);
      leaf(`nb${i}`, y + 2 * u, -1, 1);
      lotus(y, 0.72);
      curl(y + 15 * u, -1);
    } else if (kind === 'bloom') {
      leaf(`na${i}`, y + 7 * u, 1, 1.1, 0.15);
      leaf(`nb${i}`, y - 4 * u, -1, 1);
      bloom(y, 10, 2, 0.95);
      bud(y + 16 * u, -1, 0.85);
    } else {
      leaf(`na${i}`, y - 3 * u, 1, 1.1);
      leaf(`nb${i}`, y + 3 * u, -1, 1.05);
      bud(y - 9 * u, 1, 1.05);
      bud(y + 8 * u, 1, 0.8);
      curl(y + 14 * u, -1);
    }
    // Between this flower and the next: a pair of leaves and a pearl.
    if (i < count - 1 || H - y > gap * 0.8) {
      leaf(`ma${i}`, y + gap * 0.42, -1, 0.85);
      leaf(`mb${i}`, y + gap * 0.56, 1, 0.8);
      pearl(y + gap * 0.5, -7, 0.75);
      pearl(y + gap * 0.66, 8, 0.65);
    }
  }
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={W} y2={H} />
      </defs>
      <path d={stem} fill="none" stroke={metal} strokeWidth={r2(1.5 * u)} strokeLinecap="round" />
      {parts}
    </svg>
  );
}

// ─────────────────────────── Sparkles ───────────────────────────

/** A four-point glint of radius `r`, its rays thin and long. */
const glint = (r: number) => {
  const q = r2(r * 0.11);
  return `M0 ${-r} Q${q} ${-q} ${r} 0 Q${q} ${q} 0 ${r} Q${-q} ${q} ${-r} 0 Q${-q} ${-q} 0 ${-r}Z`;
};

/**
 * Gold sparkles scattered over the layer's frame: a few large glints, each
 * with a fainter diagonal cross and a soft halo, and many fine specks; the
 * same on every render.
 */
export function Sparkles({ color, className, style, w, h }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const W = Math.max(10, w);
  const H = Math.max(10, h);
  const count = Math.max(6, Math.min(44, Math.round((W * H) / 2200)));
  const size = Math.max(3, Math.min(9, Math.sqrt(W * H) / 22));
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor={tint(c, 0.75)} stopOpacity="0.6" />
          <stop offset="0.45" stopColor={tint(c, 0.4)} stopOpacity="0.18" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}s`}>
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.35" stopColor={tint(c, 0.6)} />
          <stop offset="1" stopColor={tint(c, 0.15)} />
        </radialGradient>
      </defs>
      {Array.from({ length: count }, (_, i) => {
        const big = i % 5 === 0;
        const r = big ? size * (0.8 + rand(i, 23) * 0.6) : size * (0.1 + rand(i, 17) * 0.12);
        const pad = big ? r * 1.6 : r + 1;
        const x = r2(pad + rand(i, 11) * (W - pad * 2));
        const y = r2(pad + rand(i, 13) * (H - pad * 2));
        if (!big) return <circle key={i} cx={x} cy={y} r={r2(r)} fill={tint(c, 0.5)} opacity={r2(0.45 + rand(i, 19) * 0.5)} />;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r={r2(r * 1.6)} fill={`url(#${id}h)`} />
            <path d={glint(r2(r * 0.55))} fill={tint(c, 0.45)} opacity="0.7" transform="rotate(45)" />
            <path d={glint(r2(r))} fill={`url(#${id}s)`} />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────── Botanical wreath ───────────────────────────

/** The first part of a cubic Bézier, up to t (de Casteljau: arithmetic only). */
function cut([p0, c1, c2, p3]: Segment, t: number): Segment {
  const mix = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = mix(p0, c1);
  const b = mix(c1, c2);
  const c = mix(c2, p3);
  const d = mix(a, b);
  const e = mix(b, c);
  return [p0, a, d, mix(d, e)];
}

/** Left half of the wreath's circle (centre 150, 150, radius 108), bottom to top, as two cubic curves. */
const K = 108 * 0.5523;
const WREATH_LEFT: Segment[] = [
  [
    [150, 258],
    [150 - K, 258],
    [42, 150 + K],
    [42, 150],
  ],
  [
    [42, 150],
    [42, 150 - K],
    [150 - K, 42],
    [150, 42],
  ],
];

/**
 * A round wreath of leafy branches in gold, open at the top and tied with a
 * ribbon at the foot: olive leaves, berries and small blossoms along two
 * stems. The middle is left clear for a monogram or the names.
 */
export function BotanicalWreath({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  // The stem starts a little right of the foot, so the two stems cross under the ribbon, and stops short of the top.
  const first: Segment = [[163, 259], [150 - K + 8, 262], WREATH_LEFT[0]![2], WREATH_LEFT[0]![3]];
  const second = cut(WREATH_LEFT[1]!, 0.8);
  const stem: Segment[] = [first, second];
  const along = (g: number) => {
    const f = Math.min(1.9999, Math.max(0, g) * 2);
    return f < 1 ? onCubic(first, f) : onCubic(second, f - 1);
  };
  const branch: ReactNode[] = [];
  const steps = 13;
  for (let k = 1; k <= steps; k++) {
    const g = k / (steps + 1);
    const p = along(g);
    // Up the stem is the direction of growth: the tangent points from the foot toward the tip.
    const [tx, ty] = [p.tx, p.ty];
    const side = k % 2 ? 1 : -1;
    const size = 1.1 - g * 0.4;
    // A pair of leaves at every node, the inner one a little shorter.
    for (const out of [1, -1]) {
      const q = along(g + (out === side ? 0 : 0.012));
      const l = leafPath(q.x, q.y, tx * 0.8 + -ty * out * 0.62, ty * 0.8 + tx * out * 0.62, (out === 1 ? 19 : 22) * size, 5.4 * size);
      branch.push(
        <g key={`l${k}${out}`}>
          <path d={l.blade} fill={metal} fillOpacity="0.3" stroke={metal} strokeWidth="1" />
          <path d={l.rib} stroke={metal} strokeWidth="0.6" />
        </g>,
      );
    }
    if (k % 3 === 0) {
      const bx = p.x - ty * -side * 9;
      const by = p.y + tx * -side * 9;
      branch.push(
        <g key={`b${k}`}>
          <path d={`M${r2(p.x)} ${r2(p.y)} L${r2(bx)} ${r2(by)}`} stroke={metal} strokeWidth="0.7" />
          <circle cx={r2(bx)} cy={r2(by)} r="2.6" fill={metal} />
          <circle cx={r2(bx + tx * 3.5)} cy={r2(by + ty * 3.5)} r="1.9" fill={metal} />
        </g>,
      );
    }
    if (k === 5 || k === 11) {
      const fx = p.x + ty * side * 4;
      const fy = p.y - tx * side * 4;
      branch.push(
        <g key={`f${k}`} transform={`translate(${r2(fx)} ${r2(fy)})`}>
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-4.6" rx="2.7" ry="4.4" fill={metal} fillOpacity="0.35" stroke={metal} strokeWidth="0.7" transform={`rotate(${i * 72})`} />
          ))}
          <circle r="1.9" fill={metal} />
        </g>,
      );
    }
  }
  const tip = onCubic(second, 1);
  const curve = stem.map(([p0, c1, c2, p3], i) => `${i ? '' : `M${r2(p0[0])} ${r2(p0[1])} `}C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p3[0])} ${r2(p3[1])}`).join(' ');
  const half = (
    <g>
      <path d={curve} fill="none" stroke={metal} strokeWidth="1.6" strokeLinecap="round" />
      {branch}
      {(() => {
        const l = leafPath(tip.x, tip.y, tip.tx, tip.ty, 16, 4.4);
        return <path d={l.blade} fill={metal} fillOpacity="0.28" stroke={metal} strokeWidth="1" />;
      })()}
    </g>
  );
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={300} y2={300} />
      </defs>
      {half}
      <g transform="translate(300 0) scale(-1 1)">{half}</g>
      {/* The ribbon at the foot: two loops, a knot and two tails. */}
      <path d="M150 262 C138 250 120 252 122 262 C124 271 140 268 150 262Z" fill={metal} fillOpacity="0.3" stroke={metal} strokeWidth="1.2" />
      <path d="M150 262 C162 250 180 252 178 262 C176 271 160 268 150 262Z" fill={metal} fillOpacity="0.3" stroke={metal} strokeWidth="1.2" />
      <path d="M147 264 C142 274 136 282 128 288 M153 264 C158 274 164 282 172 288" fill="none" stroke={metal} strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="150" cy="262" rx="4.2" ry="3.6" fill={metal} />
    </svg>
  );
}

// ─────────────────────────── Art deco frame ───────────────────────────

/**
 * An art deco frame drawn to the layer's size: an outer rule, an inner rule
 * with stepped corners and a fine third line, a sunburst fan opening from the
 * head, a smaller one rising from the foot, quarter fans in the corners and
 * diamonds at the middle of each side.
 */
export function DecoFrame({ color, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const u = Math.min(1.7, Math.min(w, h) / 390);
  const o = 14 * u;
  const i = 22 * u;
  const s = 10 * u;
  const f = r2;
  const [x0, y0, x1, y1] = [i, i, w - i, h - i];
  const stepped = `M${f(x0 + 2 * s)} ${f(y0)} H${f(x1 - 2 * s)} V${f(y0 + s)} H${f(x1 - s)} V${f(y0 + 2 * s)} H${f(x1)} V${f(y1 - 2 * s)} H${f(x1 - s)} V${f(y1 - s)} H${f(x1 - 2 * s)} V${f(y1)} H${f(x0 + 2 * s)} V${f(y1 - s)} H${f(x0 + s)} V${f(y1 - 2 * s)} H${f(x0)} V${f(y0 + 2 * s)} H${f(x0 + s)} V${f(y0 + s)} H${f(x0 + 2 * s)}Z`;
  /** A fan of rays from (cx, cy), pointing down (dir 1) or up (dir -1). */
  const fan = (cx: number, cy: number, r: number, dir: 1 | -1, key: string) => (
    <g key={key} transform={`translate(${f(cx)} ${f(cy)}) scale(${f(u)} ${f(u * dir)})`}>
      {Array.from({ length: 31 }, (_, k) => {
        const a = r2(-90 + k * 6);
        const long = k % 2 === 0;
        return <path key={k} d={`M0 ${r2(r * 0.3)} V${r2(long ? r : r * 0.8)}`} stroke={metal} strokeWidth={long ? 1.15 : 0.6} transform={`rotate(${a})`} />;
      })}
      {Array.from({ length: 16 }, (_, k) => (
        <circle key={`p${k}`} cx="0" cy={r2(r * 1.1)} r="1.5" fill={metal} transform={`rotate(${r2(-90 + k * 12)})`} />
      ))}
      <path d={`M${r2(-r * 1.02)} 0 A${r2(r * 1.02)} ${r2(r * 1.02)} 0 0 0 ${r2(r * 1.02)} 0`} fill="none" stroke={metal} strokeWidth="0.9" />
      <path d={`M${r2(-r * 1.18)} 0 A${r2(r * 1.18)} ${r2(r * 1.18)} 0 0 0 ${r2(r * 1.18)} 0`} fill="none" stroke={metal} strokeWidth="0.5" />
      <path d={`M${r2(-r * 0.26)} 0 A${r2(r * 0.26)} ${r2(r * 0.26)} 0 0 0 ${r2(r * 0.26)} 0Z`} fill={metal} />
      <path d={`M${r2(-r * 0.18)} 0 A${r2(r * 0.18)} ${r2(r * 0.18)} 0 0 0 ${r2(r * 0.18)} 0`} fill="none" stroke={tint(c, 0.6)} strokeWidth="0.8" />
      <path d={`M0 ${r2(r * 1.24)} L4 ${r2(r * 1.32)} L0 ${r2(r * 1.4)} L-4 ${r2(r * 1.32)}Z`} fill={metal} />
    </g>
  );
  const corner = (cx: number, cy: number, sx: number, sy: number, key: string) => (
    <g key={key} transform={`translate(${f(cx)} ${f(cy)}) scale(${f(u * sx)} ${f(u * sy)})`}>
      {Array.from({ length: 7 }, (_, k) => (
        <path key={k} d="M0 6 V30" stroke={metal} strokeWidth="0.7" transform={`rotate(${r2(-k * 15)})`} />
      ))}
      {[32, 38].map((r) => (
        <path key={r} d={`M${r} 0 A${r} ${r} 0 0 1 0 ${r}`} fill="none" stroke={metal} strokeWidth="0.8" />
      ))}
      <path d="M0 0 m6 0 A6 6 0 0 1 0 6 L0 0Z" fill={metal} />
    </g>
  );
  const diamond = (cx: number, cy: number, key: string) => (
    <g key={key} transform={`translate(${f(cx)} ${f(cy)}) scale(${f(u)})`}>
      {[-16, 0, 16].map((dy) => (
        <path key={dy} d={`M0 ${dy - 6} L4 ${dy} L0 ${dy + 6} L-4 ${dy}Z`} fill={metal} />
      ))}
      <path d="M-6 -28 L0 -22 L6 -28 M-6 28 L0 22 L6 28" fill="none" stroke={metal} strokeWidth="0.8" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${f(w)} ${f(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={w} y2={h} />
      </defs>
      <rect x={f(o)} y={f(o)} width={f(w - o * 2)} height={f(h - o * 2)} fill="none" stroke={metal} strokeWidth={f(1.2 * u)} />
      <path d={stepped} fill="none" stroke={metal} strokeWidth={f(0.9 * u)} />
      <rect x={f(i + 6 * u)} y={f(i + 6 * u)} width={f(w - (i + 6 * u) * 2)} height={f(h - (i + 6 * u) * 2)} fill="none" stroke={metal} strokeWidth={f(0.45 * u)} />
      {fan(w / 2, y0, 74, 1, 'top')}
      {fan(w / 2, y1, 46, -1, 'bottom')}
      {corner(x0 + 6 * u, y0 + 6 * u, 1, 1, 'c1')}
      {corner(x1 - 6 * u, y0 + 6 * u, -1, 1, 'c2')}
      {corner(x1 - 6 * u, y1 - 6 * u, -1, -1, 'c3')}
      {corner(x0 + 6 * u, y1 - 6 * u, 1, -1, 'c4')}
      {diamond(x0, h / 2, 'dl')}
      {diamond(x1, h / 2, 'dr')}
    </svg>
  );
}
