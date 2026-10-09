import type { ReactNode } from 'react';
import { hex, Lit, Metal, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { Marigold, r2 } from './motifs';

/**
 * Ornament and architecture illustrations: frames drawn to their layer's
 * proportions, filigree, medallions, paisley, arabesque, kolam, rangoli, the
 * jharokha window, a Mughal skyline and temple bells. The tint is the main
 * colour; `foil` turns the metal parts into stamped foil.
 */

const ring = (n: number, render: (i: number, angle: number) => ReactNode) => Array.from({ length: n }, (_, i) => render(i, r2((360 / n) * i)));

// ─────────────────────────── Frames and flourishes ───────────────────────────

/** One corner of the ornate frame, at (0, 0) with the frame running along +x and +y (100 design units). */
function FrameCorner({ paint, accent }: { paint: string; accent: string }) {
  return (
    <g>
      {ring(3, (i) => (
        <path key={i} d="M16 16 C22 12.5 30 12.5 37 16 C30 19.5 22 19.5 16 16Z" fill={paint} opacity="0.9" transform={`rotate(${[20, 45, 70][i]} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="3.2" fill={accent} />
      <path d="M0 -7 L7 0 L0 7 L-7 0Z" fill={paint} />
      <circle cx="0" cy="0" r="2" fill={accent} />
      {[0, 1].map((k) => (
        <g key={k} transform={k ? 'matrix(0 1 1 0 0 0)' : undefined}>
          <path d="M54 8 C64 1 77 3 81 11 C84 17 79 22 74 19 C70 17 71 12 75 12" fill="none" stroke={paint} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M84 6 C94 4 104 6 112 10" fill="none" stroke={paint} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M62 14 C66 18 72 20 78 20" fill="none" stroke={paint} strokeWidth="1" />
          <circle cx="116" cy="11" r="2.2" fill={paint} />
        </g>
      ))}
    </g>
  );
}

/** The jewel at the middle of the top and bottom edges (inward is +y). */
function EdgeJewel({ paint, accent }: { paint: string; accent: string }) {
  return (
    <g>
      <path d="M0 -9 L8 0 L0 9 L-8 0Z" fill={paint} />
      <circle cx="0" cy="0" r="2.6" fill={accent} />
      {[1, -1].map((s) => (
        <g key={s} transform={`scale(${s} 1)`}>
          <path d="M11 0 C19 -7 28 -5 30 1 C32 6 27 9 24 6" fill="none" stroke={paint} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14 4 C20 9 28 10 34 7" fill="none" stroke={paint} strokeWidth="1" />
          <circle cx="38" cy="2" r="1.8" fill={paint} />
        </g>
      ))}
    </g>
  );
}

/**
 * A rectangular frame drawn to the layer's own size: a strong outer rule, a
 * fine inner rule with notched corners, foliate corners and edge jewels.
 */
export function OrnateFrame({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const m = Math.min(w, h);
  const p = m * 0.045;
  const g = m * 0.032;
  const r = m * 0.075;
  const [x0, y0, x1, y1] = [p, p, w - p, h - p];
  const [ix0, iy0, ix1, iy1] = [x0 + g, y0 + g, x1 - g, y1 - g];
  const paint = `url(#${id}m)`;
  const accent = tint(colors.accent, 0.15);
  const k = r2(m * 0.0019);
  const f = (n: number) => r2(n);
  const notched = `M${f(ix0 + r)} ${f(iy0)} H${f(ix1 - r)} A${f(r)} ${f(r)} 0 0 0 ${f(ix1)} ${f(iy0 + r)} V${f(iy1 - r)} A${f(r)} ${f(r)} 0 0 0 ${f(ix1 - r)} ${f(iy1)} H${f(ix0 + r)} A${f(r)} ${f(r)} 0 0 0 ${f(ix0)} ${f(iy1 - r)} V${f(iy0 + r)} A${f(r)} ${f(r)} 0 0 0 ${f(ix0 + r)} ${f(iy0)}Z`;
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={color} foil={foil} x2={w} y2={h} />
      </defs>
      <rect x={f(x0)} y={f(y0)} width={f(x1 - x0)} height={f(y1 - y0)} fill="none" stroke={paint} strokeWidth={r2(Math.max(1.2, m * 0.008))} />
      <path d={notched} fill="none" stroke={paint} strokeWidth={r2(Math.max(0.7, m * 0.003))} />
      {[
        [x0, y0, 0],
        [x1, y0, 90],
        [x1, y1, 180],
        [x0, y1, 270],
      ].map(([x, y, rot]) => (
        <g key={`${rot}`} transform={`translate(${f(x!)} ${f(y!)}) rotate(${rot}) scale(${k})`}>
          <FrameCorner paint={paint} accent={accent} />
        </g>
      ))}
      <g transform={`translate(${f(w / 2)} ${f(y0)}) scale(${k})`}>
        <EdgeJewel paint={paint} accent={accent} />
      </g>
      <g transform={`translate(${f(w / 2)} ${f(y1)}) rotate(180) scale(${k})`}>
        <EdgeJewel paint={paint} accent={accent} />
      </g>
    </svg>
  );
}

/** A filigree corner: scrolls along both edges, a diagonal tendril with leaves and a rosette (top-left; flip for the others). */
export function FiligreeCorner({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const paint = `url(#${id}m)`;
  const leaf = 'M0 0 C5 -5 13 -5 18 0 C13 5 5 5 0 0Z';
  return (
    <svg viewBox="0 0 160 160" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={color} foil={foil} x2={160} y2={160} />
      </defs>
      {[0, 1].map((k) => (
        <g key={k} transform={k ? 'matrix(0 1 1 0 0 0)' : undefined}>
          <path d="M8 8 C46 8 78 16 98 34 C113 48 111 67 97 71 C85 74 79 61 89 57" fill="none" stroke={paint} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M30 12 C56 20 70 34 74 48 C77 58 70 64 64 60" fill="none" stroke={paint} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M100 30 C116 26 130 28 146 36" fill="none" stroke={paint} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="150" cy="38" r="2.6" fill={paint} />
          <circle cx="89" cy="57" r="2.4" fill={paint} />
          <path d={leaf} fill={paint} transform="translate(52 10) rotate(8)" />
          <path d={leaf} fill={paint} transform="translate(104 46) rotate(78) scale(0.9)" />
          <path d={leaf} fill={paint} transform="translate(118 30) rotate(-14) scale(0.8)" />
        </g>
      ))}
      <path d="M8 8 C32 32 50 48 74 56" fill="none" stroke={paint} strokeWidth="1.3" />
      <path d="M8 8 C32 32 48 50 56 74" fill="none" stroke={paint} strokeWidth="1.3" />
      <path d={leaf} fill={paint} transform="translate(30 30) rotate(45) scale(1.2)" />
      {ring(8, (i, a) => (
        <ellipse key={i} cx="8" cy="0" rx="3.2" ry="6" fill={paint} transform={`rotate(${a} 8 8)`} opacity="0.9" />
      ))}
      <circle cx="8" cy="8" r="4.5" fill={paint} />
    </svg>
  );
}

/** A symmetric divider: scrolls, leaves and a central jewel. */
export function Flourish({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const paint = `url(#${id}m)`;
  const leaf = 'M0 0 C5 -5 13 -5 18 0 C13 5 5 5 0 0Z';
  return (
    <svg viewBox="0 0 300 60" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={color} foil={foil} x2={300} y2={60} />
      </defs>
      <g transform="translate(150 30)">
        {[1, -1].map((s) => (
          <g key={s} transform={`scale(${s} 1)`}>
            <path d="M12 0 C34 0 48 -14 70 -14 C88 -14 94 0 84 6 C76 10 70 2 76 -2" fill="none" stroke={paint} strokeWidth="2" strokeLinecap="round" />
            <path d="M70 -14 C98 -14 116 2 144 0" fill="none" stroke={paint} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M26 3 C40 13 56 15 68 9" fill="none" stroke={paint} strokeWidth="1.1" strokeLinecap="round" />
            <path d={leaf} fill={paint} transform="translate(44 -9) rotate(-28)" />
            <path d={leaf} fill={paint} transform="translate(108 -6) rotate(14) scale(0.85)" />
            <circle cx="146" cy="0" r="2.4" fill={paint} />
            <circle cx="126" cy="-1" r="1.4" fill={paint} />
          </g>
        ))}
        <path d="M0 -11 L9 0 L0 11 L-9 0Z" fill={paint} />
        <circle cx="0" cy="0" r="3.2" fill={tint(colors.accent, 0.1)} />
      </g>
    </svg>
  );
}

// ─────────────────────────── Medallions and patterns ───────────────────────────

/** A rich mandala medallion: scalloped disc, petal rings, a lotus ring in the accent and a metal centre. */
export function Medallion({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const acc = hex(colors.accent);
  const line = shade(c, 0.35);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={300} y2={300} />
        <radialGradient id={`${id}d`} cx="50%" cy="50%" r="50%">
          <stop offset="0.5" stopColor={tint(c, 0.86)} />
          <stop offset="1" stopColor={tint(c, 0.62)} />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="136" fill={`url(#${id}d)`} />
      {ring(32, (i, a) => (
        <circle key={i} cx="150" cy="15" r="9.5" fill={tint(c, 0.62)} transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="129" fill="none" stroke={metal} strokeWidth="2" />
      {ring(24, (i, a) => (
        <path key={i} d="M150 26 C161 44 161 56 150 66 C139 56 139 44 150 26Z" fill={i % 2 ? tint(c, 0.3) : c} stroke={line} strokeWidth="0.8" transform={`rotate(${a} 150 150)`} />
      ))}
      {ring(48, (i, a) => (
        <circle key={i} cx="150" cy="70" r="1.7" fill={metal} transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="76" fill={tint(c, 0.9)} stroke={metal} strokeWidth="2.4" />
      {ring(12, (i, a) => (
        <g key={i} transform={`rotate(${a} 150 150)`}>
          <path d="M150 78 C168 92 168 104 150 114 C132 104 132 92 150 78Z" fill={acc} stroke={shade(acc, 0.3)} strokeWidth="0.8" />
          <path d="M150 86 C155 94 155 101 150 108" fill="none" stroke={tint(acc, 0.55)} strokeWidth="1" />
        </g>
      ))}
      <circle cx="150" cy="150" r="36" fill={tint(c, 0.85)} stroke={metal} strokeWidth="2" />
      {ring(8, (i, a) => (
        <path key={i} d="M150 116 C159 124 159 132 150 138 C141 132 141 124 150 116Z" fill={metal} transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="10" fill={metal} />
      <circle cx="150" cy="150" r="4" fill={tint(c, 0.8)} />
    </svg>
  );
}

const PAISLEY = 'M80 214 C38 214 12 184 14 146 C16 106 46 82 68 64 C88 48 100 28 94 6 C122 18 142 54 144 96 C146 132 140 160 128 182 C116 202 100 214 80 214Z';

/** An ornate paisley (kairi): bands of colour, a pearl edge, a flower in the bulb and a curled tip. */
export function PaisleyOrnate({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const acc = hex(colors.accent);
  const metal = `url(#${id}m)`;
  const leaf = 'M0 0 C5 -5 13 -5 18 0 C13 5 5 5 0 0Z';
  return (
    <svg viewBox="0 0 160 222" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil} x2={160} y2={222} />
        <Lit id={`${id}l`} base={c} />
      </defs>
      <path d={PAISLEY} fill="none" stroke={metal} strokeWidth="3.2" strokeDasharray="0 8.5" strokeLinecap="round" transform="translate(80 128) scale(1.07) translate(-80 -128)" />
      <path d={PAISLEY} fill={`url(#${id}l)`} stroke={metal} strokeWidth="2" />
      <path d={PAISLEY} fill={tint(c, 0.72)} stroke={metal} strokeWidth="1.2" transform="translate(80 146) scale(0.8) translate(-80 -146)" />
      <path d={PAISLEY} fill={acc} transform="translate(82 158) scale(0.56) translate(-80 -158)" />
      {[
        [34, 150, -62],
        [42, 118, -50],
        [56, 92, -36],
        [114, 150, 240],
        [116, 116, 250],
      ].map(([x, y, a], i) => (
        <path key={i} d={leaf} fill={shade(c, 0.15)} transform={`translate(${x} ${y}) rotate(${a}) scale(0.9)`} />
      ))}
      <g transform="translate(80 160)">
        {ring(6, (i, a) => (
          <ellipse key={i} cx="0" cy="-12" rx="6.5" ry="12" fill={tint(acc, 0.55)} stroke={shade(acc, 0.25)} strokeWidth="0.8" transform={`rotate(${a})`} />
        ))}
        <circle r="5.5" fill={metal} />
      </g>
      <path d="M94 6 C84 11 80 22 88 28 C94 32 100 26 96 21" fill="none" stroke={metal} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Eight-point star with a band, points from the centre (150, 150). */
function octagram(R: number): string {
  const pts = Array.from({ length: 16 }, (_, k) => {
    const radius = k % 2 === 0 ? R : R * 0.7654;
    const a = ((-90 + k * 22.5) * Math.PI) / 180;
    return `${r2(150 + radius * Math.cos(a))} ${r2(150 + radius * Math.sin(a))}`;
  });
  return `M${pts.join(' L')}Z`;
}

/** An arabesque medallion: an eight-point star in a metal band, a rosette and a small star at the heart. */
export function Arabesque({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil} x2={300} y2={300} />
        <Lit id={`${id}l`} base={c} light={0.2} dark={0.25} cx="50%" cy="45%" />
      </defs>
      <path d={octagram(126)} fill={`url(#${id}l)`} />
      <path d={`${octagram(142)} ${octagram(126)}`} fill={metal} fillRule="evenodd" />
      {ring(8, (i, a) => (
        <circle key={i} cx="150" cy="3" r="3.4" fill={metal} transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="72" fill="none" stroke={metal} strokeWidth="2" />
      <circle cx="150" cy="150" r="66" fill="none" stroke={metal} strokeWidth="0.8" strokeDasharray="1 5" strokeLinecap="round" />
      {ring(16, (i, a) => (
        <path key={i} d="M150 86 C158 99 158 110 150 118 C142 110 142 99 150 86Z" fill={tint(c, 0.38)} stroke={metal} strokeWidth="1" transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="30" fill={metal} />
      <path d={octagram(24)} transform="translate(150 150) scale(1) translate(-150 -150)" fill={tint(c, 0.6)} />
      <circle cx="150" cy="150" r="5" fill={metal} />
    </svg>
  );
}

/** A South Indian kolam: loops drawn around a diamond of dots, with petals all round. */
export function Kolam({ color, className, style }: IllustrationProps) {
  const c = hex(color);
  const dots: Array<[number, number]> = [];
  [1, 3, 5, 3, 1].forEach((count, row) => {
    for (let k = 0; k < count; k++) dots.push([150 + (k - (count - 1) / 2) * 40, 70 + row * 40]);
  });
  const loop = (x: number, y: number) => `M${x} ${y - 20} Q${x + 20} ${y - 20} ${x + 20} ${y} Q${x + 20} ${y + 20} ${x} ${y + 20} Q${x - 20} ${y + 20} ${x - 20} ${y} Q${x - 20} ${y - 20} ${x} ${y - 20}Z`;
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {dots.map(([x, y], i) => (
          <path key={i} d={loop(x, y)} />
        ))}
        {ring(8, (i, a) => (
          <path key={i} d="M150 46 C166 32 166 16 150 6 C134 16 134 32 150 46" transform={`rotate(${a} 150 150)`} />
        ))}
        {ring(8, (i, a) => (
          <path key={`s${i}`} d="M150 40 C140 30 128 30 122 38" transform={`rotate(${r2(a + 22.5)} 150 150)`} />
        ))}
      </g>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill={c} />
      ))}
      {ring(8, (i, a) => (
        <circle key={`d${i}`} cx="150" cy="22" r="3" fill={c} transform={`rotate(${a} 150 150)`} />
      ))}
    </svg>
  );
}

/** A festive rangoli in powder colours, with the palette in its inner rings. */
export function RangoliBloom({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  const p = hex(colors.primary);
  const powder = ['#d81b60', '#fb8c00', '#fdd835', '#2e9d4a', '#1e88e5', '#8e24aa'] as const;
  const edge = { stroke: '#ffffff', strokeOpacity: 0.65, strokeWidth: 1 };
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      {ring(40, (i, a) => (
        <circle key={i} cx="150" cy="5" r="2.6" fill={i % 2 ? c : powder[1]} transform={`rotate(${a} 150 150)`} />
      ))}
      {ring(16, (i, a) => (
        <path key={i} d="M150 10 C164 26 164 38 150 48 C136 38 136 26 150 10Z" fill={i % 2 ? powder[0] : powder[1]} {...edge} transform={`rotate(${a} 150 150)`} />
      ))}
      {ring(16, (i, a) => (
        <circle key={i} cx="150" cy="56" r="8" fill={powder[2]} {...edge} transform={`rotate(${r2(a + 11.25)} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="88" fill="none" stroke={powder[3]} strokeWidth="7" />
      <circle cx="150" cy="150" r="84" fill={tint(c, 0.86)} />
      {ring(8, (i, a) => (
        <g key={i} transform={`rotate(${a} 150 150)`}>
          <path d="M150 68 C174 84 174 100 150 112 C126 100 126 84 150 68Z" fill={p} {...edge} />
          <path d="M150 78 C162 88 162 98 150 106 C138 98 138 88 150 78Z" fill={powder[2]} />
        </g>
      ))}
      {ring(8, (i, a) => (
        <path key={i} d="M150 84 C156 96 156 104 150 110 C144 104 144 96 150 84Z" fill={powder[3]} transform={`rotate(${r2(a + 22.5)} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="38" fill={powder[4]} {...edge} />
      {ring(8, (i, a) => (
        <ellipse key={i} cx="150" cy="128" rx="7" ry="13" fill="#ffffff" opacity="0.9" transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="9" fill={powder[1]} />
      <circle cx="150" cy="150" r="3.5" fill={powder[2]} />
    </svg>
  );
}

// ─────────────────────────── Architecture ───────────────────────────

/**
 * A Rajput jharokha (oriel window) in carved stone or gold: a cusped arch on
 * fluted pillars, a chhatri dome above and a latticed balcony below. The
 * opening is see-through: put a photo or a colour behind it at x 20.7–79.3 %,
 * y 25.5–75.5 % of the frame (an arch mask fits it).
 */
export function Jharokha({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const body = `url(#${id}m)`;
  const line = shade(c, 0.4);
  const hi = tint(c, 0.45);
  const acc = hex(colors.accent);
  const opening =
    'M62 332 V200 A20 20 0 0 1 72 172 A22 22 0 0 1 92 144 A24 24 0 0 1 120 122 A26 26 0 0 1 150 112 A26 26 0 0 1 180 122 A24 24 0 0 1 208 144 A22 22 0 0 1 228 172 A20 20 0 0 1 238 200 V332Z';
  const dome = (cx: number, base: number, wd: number, hgt: number) =>
    `M${cx - wd / 2} ${base} C${cx - wd / 2} ${base - hgt * 0.55} ${cx - wd * 0.18} ${base - hgt * 0.9} ${cx} ${base - hgt} C${cx + wd * 0.18} ${base - hgt * 0.9} ${cx + wd / 2} ${base - hgt * 0.55} ${cx + wd / 2} ${base}Z`;
  const lattice: ReactNode[] = [];
  for (let x = -40; x <= 320; x += 12) {
    lattice.push(<path key={`a${x}`} d={`M${x} 376 L${x + 26} 402`} />, <path key={`b${x}`} d={`M${x + 26} 376 L${x} 402`} />);
  }
  return (
    <svg viewBox="0 0 300 440" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={300} y2={440} />
        <clipPath id={`${id}j`}>
          <rect x="16" y="376" width="268" height="26" />
        </clipPath>
      </defs>
      {/* Chhatri on top, with small domes over the pillars. */}
      <path d="M150 2 V14" stroke={body} strokeWidth="2.4" />
      <circle cx="150" cy="6" r="3" fill={body} />
      <path d={dome(150, 40, 92, 27)} fill={body} stroke={line} strokeWidth="1" />
      {[-22, 0, 22].map((dx) => (
        <path key={dx} d={`M${150 + dx} 16 C${150 + dx * 1.6} 24 ${150 + dx * 1.8} 32 ${150 + dx * 1.9} 40`} fill="none" stroke={hi} strokeWidth="0.9" />
      ))}
      <path d="M92 40 H208 L200 46 H100Z" fill={body} stroke={line} strokeWidth="1" />
      {[108, 128, 172, 192].map((x) => (
        <rect key={x} x={x - 3} y="46" width="6" height="14" fill={body} stroke={line} strokeWidth="0.8" />
      ))}
      <rect x="96" y="58" width="108" height="8" fill={body} stroke={line} strokeWidth="1" />
      {[38, 262].map((x) => (
        <g key={x}>
          <path d={`M${x} 40 V48`} stroke={body} strokeWidth="1.6" />
          <path d={dome(x, 66, 30, 18)} fill={body} stroke={line} strokeWidth="0.9" />
        </g>
      ))}
      {/* Cornice with dentils. */}
      <rect x="8" y="66" width="284" height="16" rx="2" fill={body} stroke={line} strokeWidth="1" />
      {Array.from({ length: 27 }, (_, i) => (
        <rect key={i} x={14 + i * 10.4} y="82" width="5" height="5" fill={body} stroke={line} strokeWidth="0.6" />
      ))}
      {/* The frame, with the cusped opening cut out. */}
      <path d={`M20 362 V87 H280 V362Z ${opening}`} fill={body} fillRule="evenodd" stroke={line} strokeWidth="1.2" />
      <path d={opening} fill="none" stroke={hi} strokeWidth="2" transform="translate(150 222) scale(1.05) translate(-150 -222)" />
      <path d={opening} fill="none" stroke={line} strokeWidth="3.2" strokeDasharray="0 7.5" strokeLinecap="round" transform="translate(150 222) scale(1.11) translate(-150 -222)" />
      {/* Spandrel rosettes. */}
      {[44, 256].map((x) => (
        <g key={x} transform={`translate(${x} 108)`}>
          {ring(8, (i, a) => (
            <ellipse key={i} cx="0" cy="-6" rx="2.6" ry="5" fill={acc} transform={`rotate(${a})`} />
          ))}
          <circle r="2.6" fill={hi} />
        </g>
      ))}
      {/* Fluted pillars with capitals and bases. */}
      {[
        [20, 56],
        [244, 280],
      ].map(([a, b]) => (
        <g key={a}>
          {[0.25, 0.5, 0.75].map((t) => (
            <path key={t} d={`M${a! + (b! - a!) * t} 150 V336`} stroke={line} strokeWidth="0.9" opacity="0.8" />
          ))}
          <rect x={a! - 4} y="136" width={b! - a! + 8} height="10" rx="2" fill={body} stroke={line} strokeWidth="0.9" />
          <rect x={a! - 4} y="336" width={b! - a! + 8} height="12" rx="2" fill={body} stroke={line} strokeWidth="0.9" />
        </g>
      ))}
      {/* Balcony: ledge, lattice, ledge, three lotus brackets. */}
      <rect x="6" y="360" width="288" height="16" rx="3" fill={body} stroke={line} strokeWidth="1" />
      <rect x="16" y="376" width="268" height="26" fill={shade(c, 0.55)} opacity="0.55" />
      <g clipPath={`url(#${id}j)`} stroke={body} strokeWidth="2" fill="none">
        {lattice}
      </g>
      <rect x="16" y="376" width="268" height="26" fill="none" stroke={line} strokeWidth="1" />
      <rect x="10" y="402" width="280" height="9" rx="2" fill={body} stroke={line} strokeWidth="1" />
      {[46, 150, 254].map((x) => (
        <g key={x} transform={`translate(${x} 411)`}>
          <path d="M-18 0 C-14 14 -6 22 0 28 C6 22 14 14 18 0Z" fill={body} stroke={line} strokeWidth="0.9" />
          <path d="M-10 2 C-7 10 -3 15 0 18 C3 15 7 10 10 2" fill="none" stroke={hi} strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  );
}

/** A Mughal skyline: an onion dome on a drum, side domes, minarets and lit arches (a silhouette in the tint). */
export function Domes({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const body = `url(#${id}b)`;
  const hi = tint(c, 0.38);
  const lit = `url(#${id}w)`;
  const onion = (cx: number, base: number, wd: number, hgt: number) =>
    `M${cx - wd / 2} ${base} C${cx - wd * 0.62} ${base - hgt * 0.32} ${cx - wd * 0.42} ${base - hgt * 0.62} ${cx - wd * 0.14} ${base - hgt * 0.78} C${cx - wd * 0.05} ${base - hgt * 0.84} ${cx - 2} ${base - hgt * 0.92} ${cx} ${base - hgt} C${cx + 2} ${base - hgt * 0.92} ${cx + wd * 0.05} ${base - hgt * 0.84} ${cx + wd * 0.14} ${base - hgt * 0.78} C${cx + wd * 0.42} ${base - hgt * 0.62} ${cx + wd * 0.62} ${base - hgt * 0.32} ${cx + wd / 2} ${base}Z`;
  const arch = (x: number, y: number, wd: number, hgt: number) => `M${x} ${y + hgt} V${y + wd / 2} A${wd / 2} ${wd / 2} 0 0 1 ${x + wd} ${y + wd / 2} V${y + hgt}Z`;
  return (
    <svg viewBox="0 0 400 232" className={className} style={style} aria-hidden="true">
      <defs>
        {foil ? <Metal id={`${id}b`} base={c} foil x2={400} y2={232} /> : <Lit id={`${id}b`} base={c} light={0.18} dark={0.22} cx="50%" cy="20%" />}
        <radialGradient id={`${id}w`} cx="50%" cy="60%" r="70%">
          <stop offset="0" stopColor="#fff4c9" />
          <stop offset="1" stopColor="#f5b942" />
        </radialGradient>
      </defs>
      {/* Minarets. */}
      {[27, 373].map((x) => (
        <g key={x}>
          <rect x={x - 8} y="56" width="16" height="176" fill={body} />
          <rect x={x - 13} y="96" width="26" height="6" rx="2" fill={body} />
          <rect x={x - 13} y="146" width="26" height="6" rx="2" fill={body} />
          <path d={onion(x, 58, 22, 26)} fill={body} />
          <path d={`M${x} 32 V22`} stroke={body} strokeWidth="2" />
          <path d={arch(x - 4, 112, 8, 18)} fill={lit} className="bulava-glow" />
        </g>
      ))}
      {/* Side domes on drums. */}
      {[86, 314].map((x) => (
        <g key={x}>
          <rect x={x - 26} y="128" width="52" height="46" fill={body} />
          <path d={onion(x, 130, 56, 52)} fill={body} />
          <path d={`M${x} 78 V66`} stroke={body} strokeWidth="2" />
          <path d={arch(x - 7, 142, 14, 26)} fill={lit} className="bulava-glow" />
        </g>
      ))}
      {/* The main dome. */}
      <rect x="146" y="104" width="108" height="70" fill={body} />
      <path d={onion(200, 106, 124, 96)} fill={body} />
      <path d="M200 10 V0" stroke={body} strokeWidth="2.4" />
      <circle cx="200" cy="12" r="3" fill={body} />
      {[-30, -12, 12, 30].map((dx) => (
        <path key={dx} d={`M200 14 C${200 + dx * 0.5} 40 ${200 + dx * 1.3} 70 ${200 + dx * 1.6} 104`} fill="none" stroke={hi} strokeWidth="1" opacity="0.7" />
      ))}
      <rect x="140" y="100" width="120" height="7" rx="2" fill={body} />
      {[160, 189, 218].map((x) => (
        <path key={x} d={arch(x, 120, 22, 44)} fill={lit} className="bulava-glow" />
      ))}
      {/* The base wall with arches. */}
      <rect x="40" y="172" width="320" height="60" fill={body} />
      <rect x="34" y="168" width="332" height="7" rx="2" fill={body} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={arch(56 + i * 34, 186, 18, 32)} fill={lit} opacity={i % 2 ? 0.75 : 1} className="bulava-glow" />
      ))}
    </svg>
  );
}

/** Three brass temple bells on chains from a carved bar hung with marigolds. */
export function TempleBells({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.45);
  const bells: Array<[number, number, number]> = [
    [72, 92, 2.3],
    [150, 140, 2.9],
    [228, 92, 2.3],
  ];
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={300} y2={300} />
      </defs>
      {bells.map(([x, len, s]) => (
        <g key={x}>
          {Array.from({ length: Math.floor(len / 7) }, (_, i) => (
            <ellipse key={i} cx={x} cy={26 + i * 7} rx="2.2" ry="3.4" fill="none" stroke={metal} strokeWidth="1.4" />
          ))}
          <g transform={`translate(${x} ${24 + len}) scale(${s})`}>
            <circle cx="0" cy="1.5" r="3" fill={metal} />
            <path d="M0 3 C-3 3 -5 7 -5 11 C-5 19 -10 26 -16 31 H16 C10 26 5 19 5 11 C5 7 3 3 0 3Z" fill={metal} stroke={line} strokeWidth="0.35" />
            <path d="M-3 9 C-3 16 -7 23 -11 28" fill="none" stroke={tint(c, 0.6)} strokeWidth="0.9" opacity="0.8" />
            <ellipse cx="0" cy="31.5" rx="17" ry="3.2" fill={metal} stroke={line} strokeWidth="0.35" />
            <path d="M-13 23 H13" stroke={line} strokeWidth="0.5" opacity="0.7" />
            <circle cx="0" cy="37" r="3.2" fill={shade(c, 0.35)} />
          </g>
        </g>
      ))}
      <rect x="12" y="10" width="276" height="14" rx="7" fill={metal} stroke={line} strokeWidth="0.8" />
      <circle cx="12" cy="17" r="8" fill={metal} />
      <circle cx="288" cy="17" r="8" fill={metal} />
      {Array.from({ length: 15 }, (_, i) => (
        <Marigold key={i} x={30 + i * 17.2} y={28} r={6.4} tone={i % 3} />
      ))}
    </svg>
  );
}
