import type { CSSProperties } from 'react';
import { r2 } from './art/motifs';

/**
 * The newer ornaments, drawn in line with currentColor like the first ones
 * (ornaments.tsx): emblems for the suites (a gopuram, a Kerala lamp, a jaali
 * star, a marigold, a phulkari flower, a rangoli, an art deco sunburst and a
 * nursery sky), and the small glyphs every suite sets between rules, at the
 * nodes of a timeline and on stamps. Coordinates are rounded (r2), so the
 * server and every browser draw the same picture.
 */

type P = { className?: string; style?: CSSProperties };

/** A point on a circle around (cx, cy), degrees clockwise from the top. */
const around = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
};
const poly = (pts: Array<[number, number]>) => `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')}Z`;

// ─────────────────────────── Emblems (200 × 200) ───────────────────────────

/** A South Indian gopuram: five tiers of niches under a barrel vault with three kalasams. */
export function TempleEmblem({ className, style }: P) {
  const tiers = [0, 1, 2, 3, 4].map((k) => {
    const yb = 184 - 24 * k;
    const yt = 160 - 24 * k;
    const hb = 60 - 7.5 * k;
    const ht = 53 - 7.5 * k;
    const outline = `M${r2(100 - hb)} ${yb} L${r2(100 - ht)} ${yt + 5} L${r2(100 - ht - 4)} ${yt + 5} L${r2(100 - ht - 4)} ${yt} L${r2(100 + ht + 4)} ${yt} L${r2(100 + ht + 4)} ${yt + 5} L${r2(100 + ht)} ${yt + 5} L${r2(100 + hb)} ${yb}`;
    const n = 5 - k;
    const span = 2 * ht - 12;
    const ym = (yb + yt + 5) / 2;
    const niches = Array.from({ length: n }, (_, i) => {
      const x = r2(100 - span / 2 + (span / n) * (i + 0.5));
      return `M${r2(x - 3)} ${r2(ym + 6)} V${r2(ym - 1)} A3 3 0 0 1 ${r2(x + 3)} ${r2(ym - 1)} V${r2(ym + 6)}`;
    }).join(' ');
    return { outline, niches };
  });
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M24 194 H176 M32 188 H168" />
        {tiers.map((t, k) => (
          <g key={k}>
            <path d={t.outline} />
            <path d={t.niches} strokeWidth="1" opacity="0.75" />
          </g>
        ))}
        <path d="M74 64 V54 C74 36 126 36 126 54 V64" />
        <path d="M80 60 C82 46 118 46 120 60" opacity="0.6" />
        {[86, 100, 114].map((x) => (
          <g key={x}>
            <path d={`M${x} 42 V36`} />
            <circle cx={x} cy={32} r="3.4" fill="currentColor" fillOpacity="0.25" />
            <path d={`M${x} 28.6 L${x} 22`} />
          </g>
        ))}
        <path d="M90 194 V178 A10 10 0 0 1 110 178 V194" fill="currentColor" fillOpacity="0.12" />
      </g>
    </svg>
  );
}

/** A Kerala nilavilakku: a stepped foot, a knotted stem, a dish of five flames and a finial. */
export function KasavuEmblem({ className, style }: P) {
  const flames = [56, 78, 100, 122, 144];
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M58 194 H142 L134 185 C124 178 76 178 66 185 Z" fill="currentColor" fillOpacity="0.12" />
        <path d="M74 178 C80 172 120 172 126 178" />
        <path d="M95 172 V96 M105 172 V96" />
        {[156, 130, 106].map((y) => (
          <ellipse key={y} cx="100" cy={y} rx="11" ry="4.5" fill="currentColor" fillOpacity="0.18" />
        ))}
        <path d="M42 80 H158" />
        <path d="M46 80 C58 98 142 98 154 80" fill="currentColor" fillOpacity="0.12" />
        {flames.map((x) => (
          <path key={x} d={`M${x} 78 C${x - 5} 70 ${x - 3} 61 ${x} 52 C${x + 3} 61 ${x + 5} 70 ${x} 78Z`} fill="currentColor" fillOpacity="0.28" />
        ))}
        <path d="M100 80 V46" />
        <circle cx="100" cy="50" r="5" fill="currentColor" fillOpacity="0.2" />
        <path d="M100 42 C95 36 95 28 100 20 C105 28 105 36 100 42Z" fill="currentColor" fillOpacity="0.3" />
      </g>
    </svg>
  );
}

const JAALI_STAR = poly(Array.from({ length: 16 }, (_, i) => around(100, 100, i % 2 ? 56 : 84, i * 22.5)));
const JAALI_INNER = poly(Array.from({ length: 16 }, (_, i) => around(100, 100, i % 2 ? 30 : 44, i * 22.5 + 22.5)));
const JAALI_DOTS = Array.from({ length: 8 }, (_, i) => around(100, 100, 66, i * 45 + 22.5));

/** A Mughal jaali star: an eight-pointed khatam with a smaller star turned inside it. */
export function JaaliEmblem({ className, style }: P) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        <circle cx="100" cy="100" r="95" opacity="0.45" />
        <path d={JAALI_STAR} />
        <path d={JAALI_STAR} transform="translate(100 100) scale(0.86) translate(-100 -100)" opacity="0.5" />
        <path d={JAALI_INNER} fill="currentColor" fillOpacity="0.1" />
        <circle cx="100" cy="100" r="13" />
        <circle cx="100" cy="100" r="4" fill="currentColor" />
        {JAALI_DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.6" fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}

/** A marigold head: three rings of ruffled petals round a seeded centre. */
export function MarigoldEmblem({ className, style }: P) {
  const ring = (n: number, cy: number, rx: number, ry: number, offset: number, opacity: number) =>
    Array.from({ length: n }, (_, i) => <ellipse key={`${cy}-${i}`} cx="100" cy={cy} rx={rx} ry={ry} transform={`rotate(${r2((360 / n) * i + offset)} 100 100)`} opacity={opacity} />);
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2">
        {ring(18, 34, 10, 18, 0, 0.7)}
        {ring(14, 52, 9, 15, 6, 0.85)}
        {ring(10, 70, 8, 11, 12, 1)}
        <circle cx="100" cy="100" r="17" fillOpacity="0.25" />
        {Array.from({ length: 8 }, (_, i) => {
          const [x, y] = around(100, 100, 9, i * 45);
          return <circle key={i} cx={x} cy={y} r="1.8" fill="currentColor" fillOpacity="1" stroke="none" />;
        })}
      </g>
    </svg>
  );
}

/** A phulkari flower: eight darned diamonds round a square, with small diamonds between them. */
export function BaghEmblem({ className, style }: P) {
  const petal = 'M100 98 L113 62 L100 22 L87 62Z';
  const small = 'M100 14 L106 22 L100 30 L94 22Z';
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 45} 100 100)`}>
            <path d={petal} fill="currentColor" fillOpacity="0.12" />
            <path d="M100 90 L100 32 M94 76 L100 40 L106 76" strokeWidth="0.8" opacity="0.7" />
            <path d={small} transform="rotate(22.5 100 100)" fill="currentColor" fillOpacity="0.3" />
          </g>
        ))}
        <path d="M100 88 L112 100 L100 112 L88 100Z" fill="currentColor" fillOpacity="0.35" />
      </g>
    </svg>
  );
}

/** A threshold rangoli: a flower in a ring of dots, open petals and a dotted rim. */
export function RangoliEmblem({ className, style }: P) {
  const dots = Array.from({ length: 16 }, (_, i) => around(100, 100, 84, i * 22.5 + 11.25));
  const inner = Array.from({ length: 8 }, (_, i) => around(100, 100, 40, i * 45 + 22.5));
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        <circle cx="100" cy="100" r="95" strokeDasharray="1.5 5" strokeLinecap="round" />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 45} 100 100)`}>
            <path d="M100 100 C107 90 107 80 100 69 C93 80 93 90 100 100Z" fill="currentColor" fillOpacity="0.22" />
            <path d="M100 62 C113 48 113 32 100 16 C87 32 87 48 100 62Z" transform="rotate(22.5 100 100)" />
          </g>
        ))}
        {inner.map(([x, y], i) => (
          <circle key={`i${i}`} cx={x} cy={y} r="2.8" fill="currentColor" />
        ))}
        {dots.map(([x, y], i) => (
          <circle key={`o${i}`} cx={x} cy={y} r="2.2" fill="currentColor" />
        ))}
        <circle cx="100" cy="100" r="5" fill="currentColor" />
      </g>
    </svg>
  );
}

const DECO_RAYS = Array.from({ length: 13 }, (_, i) => around(100, 150, 86, -90 + i * 15));

/** An art deco sunburst: a fan of rays and arcs rising from a stepped base. */
export function DecoEmblem({ className, style }: P) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter">
        {DECO_RAYS.map(([x, y], i) => (
          <path key={i} d={`M100 150 L${x} ${y}`} opacity={i % 2 ? 0.55 : 1} />
        ))}
        <path d="M14 150 A86 86 0 0 1 186 150" />
        <path d="M40 150 A60 60 0 0 1 160 150" opacity="0.7" />
        <path d="M74 150 A26 26 0 0 1 126 150Z" fill="currentColor" fillOpacity="0.2" />
        <path d="M8 156 H192" />
        <path d="M58 156 V164 H142 V156 M74 164 V172 H126 V164 M88 172 V180 H112 V172" />
      </g>
    </svg>
  );
}

const CLOUD = 'M34 148 C20 148 14 134 24 124 C20 108 38 98 52 106 C58 88 86 86 94 104 C104 94 124 100 122 116 C136 116 142 132 132 142 C129 146 125 148 120 148Z';

/** A nursery sky: two soft clouds and three twinkling stars. */
export function CloudsEmblem({ className, style }: P) {
  const star = (x: number, y: number, r: number) => `M${x} ${y - r} L${r2(x + r * 0.28)} ${r2(y - r * 0.28)} L${x + r} ${y} L${r2(x + r * 0.28)} ${r2(y + r * 0.28)} L${x} ${y + r} L${r2(x - r * 0.28)} ${r2(y + r * 0.28)} L${x - r} ${y} L${r2(x - r * 0.28)} ${r2(y - r * 0.28)}Z`;
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        <path d={CLOUD} fill="currentColor" fillOpacity="0.1" />
        <path d={CLOUD} transform="translate(196 18) scale(-0.62 0.62)" opacity="0.7" />
        <path d={star(150, 46, 11)} fill="currentColor" fillOpacity="0.35" />
        <path d={star(46, 58, 7)} fill="currentColor" fillOpacity="0.35" />
        <path d={star(172, 112, 6)} fill="currentColor" fillOpacity="0.35" />
      </g>
    </svg>
  );
}

// ─────────────────────────── Glyphs (32 × 32) ───────────────────────────

export const GLYPHS = ['mandala', 'paisley', 'floral', 'geometric', 'confetti', 'lotus', 'peacock', 'stars', 'laurel', 'temple', 'kasavu', 'jaali', 'marigold', 'bagh', 'rangoli', 'deco', 'clouds', 'chapel', 'diya', 'heart', 'none'] as const;
export type GlyphName = (typeof GLYPHS)[number];

const GLYPH_STAR = poly(Array.from({ length: 16 }, (_, i) => around(16, 16, i % 2 ? 8 : 13, i * 22.5)));
const GLYPH_MARIGOLD = Array.from({ length: 10 }, (_, i) => around(16, 16, 8.5, i * 36));
const GLYPH_BURST = Array.from({ length: 8 }, (_, i) => [around(16, 16, 6, i * 45), around(16, 16, i % 2 ? 11 : 14, i * 45)] as const);
const GLYPH_RANGOLI = Array.from({ length: 4 }, (_, i) => around(16, 16, 12, i * 90 + 45));

/**
 * A small motif in the current colour: dividers set it between two rules,
 * timelines on their nodes, venues on the stamp. 32 × 32, mostly filled, so it
 * reads at 14–28 px.
 */
export function Glyph({ name, className, style }: { name: GlyphName } & P) {
  const body = (() => {
    switch (name) {
      case 'mandala':
        return (
          <g fill="currentColor">
            {Array.from({ length: 8 }, (_, i) => (
              <ellipse key={i} cx="16" cy="8.5" rx="2.4" ry="5.6" transform={`rotate(${i * 45} 16 16)`} opacity={i % 2 ? 0.55 : 1} />
            ))}
            <circle cx="16" cy="16" r="3.2" />
          </g>
        );
      case 'paisley':
        return <path d="M15 29 C6 27 4 16 10 10 C15 5 24 6 25 13 C26 19 19 21 17.5 17 C16.5 14.5 19 13 20.5 15" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />;
      case 'floral':
        return (
          <g fill="currentColor">
            {Array.from({ length: 5 }, (_, i) => (
              <ellipse key={i} cx="16" cy="9" rx="3.6" ry="6" transform={`rotate(${i * 72} 16 16)`} opacity="0.8" />
            ))}
            <circle cx="16" cy="16" r="2.8" fill="var(--t-bg, #fff)" />
            <circle cx="16" cy="16" r="1.6" />
          </g>
        );
      case 'geometric':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 3 L29 16 L16 29 L3 16Z" />
            <path d="M16 9 L23 16 L16 23 L9 16Z" fill="currentColor" fillOpacity="0.4" />
          </g>
        );
      case 'confetti':
        return (
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {GLYPH_BURST.map(([[x1, y1], [x2, y2]], i) => (
              <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} />
            ))}
            <circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="none" />
          </g>
        );
      case 'lotus':
        return (
          <g fill="currentColor">
            <path d="M16 27 C10.5 21 10.5 12 16 5 C21.5 12 21.5 21 16 27Z" />
            <path d="M16 27 C10.5 21 10.5 13 16 7 C21.5 13 21.5 21 16 27Z" transform="rotate(-42 16 27)" opacity="0.6" />
            <path d="M16 27 C10.5 21 10.5 13 16 7 C21.5 13 21.5 21 16 27Z" transform="rotate(42 16 27)" opacity="0.6" />
            <path d="M6 28.5 Q16 25 26 28.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </g>
        );
      case 'peacock':
        return (
          <g>
            <ellipse cx="16" cy="15" rx="9" ry="12" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2" />
            <ellipse cx="16" cy="16.5" rx="5.2" ry="7.2" fill="currentColor" fillOpacity="0.55" />
            <ellipse cx="16" cy="18" rx="2.6" ry="3.6" fill="currentColor" />
          </g>
        );
      case 'stars':
        return <path d="M16 2 L18.6 13.4 L30 16 L18.6 18.6 L16 30 L13.4 18.6 L2 16 L13.4 13.4Z" fill="currentColor" />;
      case 'laurel':
        return (
          <g fill="currentColor">
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <ellipse cx={r2(11 - i * 2.4)} cy={r2(22 - i * 6)} rx="2.2" ry="4.6" transform={`rotate(${-30 - i * 8} ${r2(11 - i * 2.4)} ${r2(22 - i * 6)})`} />
                <ellipse cx={r2(21 + i * 2.4)} cy={r2(22 - i * 6)} rx="2.2" ry="4.6" transform={`rotate(${30 + i * 8} ${r2(21 + i * 2.4)} ${r2(22 - i * 6)})`} />
              </g>
            ))}
            <path d="M11 27 Q16 30 21 27" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </g>
        );
      case 'temple':
        return (
          <g fill="currentColor">
            <path d="M16 2.5 V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8.5 22 C8.5 13 11 8 16 8 C21 8 23.5 13 23.5 22Z" />
            <path d="M6 22.5 H26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="16" cy="26.2" r="2" />
          </g>
        );
      case 'kasavu':
        return (
          <g fill="currentColor">
            <path d="M16 3 C12.5 8.5 12.5 13.5 16 17 C19.5 13.5 19.5 8.5 16 3Z" />
            <path d="M8 19 H24 C23 23.5 20 25.5 16 25.5 C12 25.5 9 23.5 8 19Z" opacity="0.75" />
            <path d="M13 28.5 H19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );
      case 'jaali':
        return (
          <g>
            <path d={GLYPH_STAR} fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
          </g>
        );
      case 'marigold':
        return (
          <g fill="currentColor">
            {GLYPH_MARIGOLD.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4" opacity={i % 2 ? 0.7 : 1} />
            ))}
            <circle cx="16" cy="16" r="5" />
            <circle cx="16" cy="16" r="2" fill="var(--t-bg, #fff)" opacity="0.6" />
          </g>
        );
      case 'bagh':
        return (
          <g fill="currentColor">
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d="M16 15 L19.2 9 L16 2.5 L12.8 9Z" transform={`rotate(${a} 16 16)`} />
            ))}
            {[45, 135, 225, 315].map((a) => (
              <path key={a} d="M16 6 L18 8.6 L16 11.2 L14 8.6Z" transform={`rotate(${a} 16 16)`} opacity="0.6" />
            ))}
          </g>
        );
      case 'rangoli':
        return (
          <g fill="currentColor">
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d="M16 15 C18.5 11 18.5 7.5 16 4 C13.5 7.5 13.5 11 16 15Z" transform={`rotate(${a} 16 16)`} />
            ))}
            {GLYPH_RANGOLI.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.9" />
            ))}
            <circle cx="16" cy="16" r="2.2" />
          </g>
        );
      case 'deco':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="1.3">
            {[-60, -30, 0, 30, 60].map((a) => (
              <path key={a} d="M16 26 L16 6" transform={`rotate(${a} 16 26)`} />
            ))}
            <path d="M4 26 A12 12 0 0 1 28 26" />
            <path d="M10 26 A6 6 0 0 1 22 26Z" fill="currentColor" />
            <path d="M3 28.5 H29" />
          </g>
        );
      case 'clouds':
        return <path d="M7.5 24 C4 24 2.5 20.6 4.8 18.4 C4 14.6 8.2 12.4 11.2 14.2 C12.6 9.8 19.4 9.4 21.2 13.8 C23.6 11.6 28 13.2 27.4 17 C30.6 17.4 31 22.6 27.6 24Z" fill="currentColor" fillOpacity="0.85" />;
      case 'chapel':
        // A gothic quatrefoil: four lobes round a pierced centre.
        return (
          <g fill="currentColor">
            <circle cx="16" cy="9.6" r="6.2" />
            <circle cx="22.4" cy="16" r="6.2" />
            <circle cx="16" cy="22.4" r="6.2" />
            <circle cx="9.6" cy="16" r="6.2" />
            <circle cx="16" cy="16" r="2.6" fill="var(--t-band, var(--t-bg, #fff))" />
          </g>
        );
      case 'diya':
        return (
          <g fill="currentColor">
            <path d="M16 3.5 C13 8 13 12 16 15 C19 12 19 8 16 3.5Z" />
            <path d="M5 17 H27 C26 23 21.5 26.5 16 26.5 C10.5 26.5 6 23 5 17Z" opacity="0.8" />
          </g>
        );
      case 'heart':
        return <path d="M16 27.5 L5.5 17.6 C2 14 3.2 8 8.4 7 C11.6 6.4 14.4 8.2 16 10.8 C17.6 8.2 20.4 6.4 23.6 7 C28.8 8 30 14 26.5 17.6Z" fill="currentColor" />;
      default:
        return <path d="M16 3 C18 11 21 14 29 16 C21 18 18 21 16 29 C14 21 11 18 3 16 C11 14 14 11 16 3Z" fill="currentColor" />;
    }
  })();
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden="true">
      {body}
    </svg>
  );
}
