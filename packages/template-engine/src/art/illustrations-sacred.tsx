import type { ReactNode } from 'react';
import { blend, hex, Lit, Metal, NATURE, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { r2 } from './motifs';

/**
 * Art in the vocabulary of each faith's weddings (docs/templates.md#faith),
 * for the faith themes: Islamic geometry (a girih rosette, a jaali mehrab
 * window, a hanging fanoos), the Sikh Darbar Sahib on its sarovar and a
 * phulkari medallion, and for church weddings a stained-glass lancet window,
 * Madonna lilies and wedding bells. The tint is each piece's metal or main
 * colour, the palette colours the rest (glass, silk, ribbons); lilies and
 * flames keep their own colours (NATURE). Directions come from a table of
 * unit vectors, so no trigonometry runs.
 */

// ─────────────────────────── Geometry ───────────────────────────

/** sin of 0°, 11.25°, 22.5° … 90°. */
const S9 = [0, 0.19509, 0.38268, 0.55557, 0.70711, 0.83147, 0.92388, 0.98079, 1] as const;

/** Unit vectors every 11.25°, clockwise from straight up: 32 of them, from the table above. */
const U32: ReadonlyArray<readonly [number, number]> = Array.from({ length: 32 }, (_, k) => {
  const q = Math.floor(k / 8);
  const j = k % 8;
  return q === 0 ? [S9[j]!, -S9[8 - j]!] : q === 1 ? [S9[8 - j]!, S9[j]!] : q === 2 ? [-S9[j]!, S9[8 - j]!] : [-S9[8 - j]!, -S9[j]!];
});

/** The point at direction k of n (8, 16 or 32 directions, k may run past n) at radius r from (cx, cy). */
function pt(cx: number, cy: number, k: number, n: 8 | 16 | 32, r: number): [number, number] {
  const [x, y] = U32[(((k * 32) / n) % 32 + 32) % 32]!;
  return [r2(cx + x * r), r2(cy + y * r)];
}

const poly = (points: Array<[number, number]>) => `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}Z`;

/** A star of `points` (8 or 16) points: tips at R, notches at r, the first tip straight up (or half a step round). */
function starPath(cx: number, cy: number, points: 8 | 16, R: number, r: number, half = false): string {
  const n = (points * 2) as 16 | 32;
  return poly(Array.from({ length: n }, (_, i) => pt(cx, cy, i + (half ? 1 : 0), n === 16 ? 16 : 32, i % 2 ? r : R)));
}

/** The {8/3} star: eight long points whose lines cross into an octagon, the heart of girih patterns. */
function star83(cx: number, cy: number, R: number, offset = 0): string {
  const order = [0, 3, 6, 1, 4, 7, 2, 5];
  return poly(order.map((k) => pt(cx, cy, k * 2 + offset, 16, R)));
}

const MIRROR = (width: number) => `matrix(-1 0 0 1 ${width} 0)`;

/** Five petals: unit vectors 72° apart from straight up. */
const FIVE: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0.95106, -0.30902],
  [0.58779, 0.80902],
  [-0.58779, 0.80902],
  [-0.95106, -0.30902],
];

// ─────────────────────────── Girih rosette ───────────────────────────

/**
 * A girih rosette: an eight-fold Islamic star interlaced in gold over a
 * field of the tint, ringed with lozenges and small stars, like a tile
 * medallion. Round, so it may turn slowly behind a photo.
 */
export function GirihRosette({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const field = hex(color);
  const gold = hex(colors.secondary);
  const light = hex(colors.accent);
  const metal = `url(#${id}m)`;
  const line = shade(gold, 0.45);
  const c = 100;
  const lozenges = Array.from({ length: 16 }, (_, k) => {
    const [x0, y0] = pt(c, c, k, 16, 79);
    const [x1, y1] = pt(c, c, k, 16, 89);
    const [xa, ya] = pt(c, c, k * 2 + 1, 32, 84.5);
    const [xb, yb] = pt(c, c, k * 2 - 1, 32, 84.5);
    return `M${x0} ${y0} L${r2(x0 + (xa - x0) * 0.42 + (xa - xb) * 0)} ${r2(y0 + (ya - y0) * 0.42)} L${x1} ${y1} L${r2(x0 + (xb - x0) * 0.42)} ${r2(y0 + (yb - y0) * 0.42)}Z`;
  }).join(' ');
  const gapStars: ReactNode[] = Array.from({ length: 8 }, (_, k) => {
    const [x, y] = pt(c, c, k * 2 + 1, 16, 63);
    return <path key={k} d={starPath(x, y, 8, 8.5, 4.6)} fill={light} stroke={line} strokeWidth="0.7" strokeLinejoin="round" />;
  });
  const dots: ReactNode[] = Array.from({ length: 32 }, (_, k) => {
    const [x, y] = pt(c, c, k, 32, 93.5);
    return <circle key={k} cx={x} cy={y} r="1.3" fill={metal} />;
  });
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={gold} foil={foil ?? true} x2={200} y2={200} />
        <Lit id={`${id}f`} base={field} light={0.22} dark={0.22} cx="50%" cy="45%" />
      </defs>
      {/* The ring and the field. */}
      <circle cx={c} cy={c} r="97" fill={metal} />
      <circle cx={c} cy={c} r="90.5" fill={`url(#${id}f)`} />
      {dots}
      <path d={lozenges} fill={metal} stroke={line} strokeWidth="0.6" strokeLinejoin="round" />
      {/* The sixteen-point star behind the strapwork, a shade lighter than the field. */}
      <path d={starPath(c, c, 16, 77, 58, true)} fill={blend(field, light, 0.18)} stroke={metal} strokeWidth="1" strokeLinejoin="round" />
      {/* The interlaced {8/3} star: a gold band with a fillet down its middle. */}
      <path d={star83(c, c, 74)} fill="none" stroke={line} strokeWidth="7.4" strokeLinejoin="miter" strokeMiterlimit="8" />
      <path d={star83(c, c, 74)} fill="none" stroke={metal} strokeWidth="5.6" strokeLinejoin="miter" strokeMiterlimit="8" />
      <path d={star83(c, c, 74)} fill="none" stroke={line} strokeWidth="0.8" strokeLinejoin="miter" strokeMiterlimit="8" opacity="0.8" />
      {gapStars}
      {/* The heart: an octagonal star in the light, a gold boss. */}
      <path d={starPath(c, c, 8, 27, 19.5, true)} fill={light} stroke={metal} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={starPath(c, c, 8, 15, 10.5)} fill={metal} stroke={line} strokeWidth="0.7" strokeLinejoin="round" />
      <circle cx={c} cy={c} r="4.2" fill={field} stroke={line} strokeWidth="0.6" />
    </svg>
  );
}

// ─────────────────────────── Jaali mehrab window ───────────────────────────

/** Where a photo sits behind the jaali mehrab, as fractions of its frame (an arch mask fits it). */
export const JAALI_ARCH_OPENING = { x: 0.24, y: 0.16, w: 0.52, h: 0.7 } as const;

/**
 * A Mughal window in carved stone and gold: a cusped mehrab arch on slender
 * columns, its spandrels and base filled with jaali, star-and-cross lattice,
 * a crenellated cornice above. The opening is left clear for a photo
 * (JAALI_ARCH_OPENING). Drawn at 300 × 440.
 */
export function JaaliArch({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  // White marble inlaid with the gold, as the screens of Fatehpur Sikri and the Taj.
  const panel = NATURE.pearl;
  const veins = blend(NATURE.pearl, c, 0.18);
  const jewel = hex(colors.accent);
  // The opening: x 72–228, its arch springing at 150 from an apex at 70, down to the sill at 378.
  const ox0 = 72;
  const ox1 = 228;
  const apex = 70;
  const spring = 150;
  const sill = 378;
  const archPath = `M${ox0} ${sill} V${spring} C${ox0} ${spring - 44} ${118} ${apex + 22} 150 ${apex} C${182} ${apex + 22} ${ox1} ${spring - 44} ${ox1} ${spring} V${sill}Z`;
  // Cusps along the arch: lobes bulging into the opening between points on its curve.
  const cuspPts: Array<[number, number]> = [
    [ox0, spring],
    [74.5, 128],
    [83, 108],
    [97.5, 91],
    [116, 79],
    [133, 72.5],
    [150, apex],
    [167, 72.5],
    [184, 79],
    [202.5, 91],
    [217, 108],
    [225.5, 128],
    [ox1, spring],
  ];
  const cusps = cuspPts
    .slice(0, -1)
    .map(([x, y], i) => {
      const [qx, qy] = cuspPts[i + 1]!;
      const chord = Math.sqrt((qx - x) ** 2 + (qy - y) ** 2);
      return `M${x} ${y} A${r2(chord * 0.58)} ${r2(chord * 0.58)} 0 0 0 ${qx} ${qy}`;
    })
    .join(' ');
  // The lattice: rows of eight-point stars with crosses between, clipped to the stone.
  const lattice: ReactNode[] = [];
  const step = 17;
  for (let y = 26; y < 434; y += step) {
    for (let x = 14; x < 300; x += step) {
      lattice.push(<path key={`s${x}-${y}`} d={starPath(x, y, 8, 6.2, 3.6)} fill="none" stroke={metal} strokeWidth="1.1" />);
      lattice.push(<path key={`c${x}-${y}`} d={`M${x + step / 2} ${r2(y - 3.6)} V${r2(y + 3.6)} M${r2(x + step / 2 - 3.6)} ${y} H${r2(x + step / 2 + 3.6)}`} stroke={metal} strokeWidth="0.8" />);
    }
  }
  const merlons = Array.from({ length: 11 }, (_, i) => {
    const x = 22 + i * 25.6;
    return `M${r2(x - 9)} 30 C${r2(x - 9)} 22 ${r2(x - 4)} 17 ${r2(x)} 11 C${r2(x + 4)} 17 ${r2(x + 9)} 22 ${r2(x + 9)} 30Z`;
  }).join(' ');
  const column = (x: number) => (
    <g key={x}>
      <rect x={x - 6} y={spring + 6} width="12" height={sill - spring - 14} fill={metal} stroke={line} strokeWidth="0.8" />
      <path d={`M${x} ${spring + 14} V${sill - 16}`} stroke={line} strokeWidth="0.7" opacity="0.7" />
      <path d={`M${x - 9} ${spring + 8} H${x + 9} L${x + 6} ${spring - 2} H${x - 6}Z`} fill={metal} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      <path d={`M${x - 9} ${sill - 8} H${x + 9} V${sill} H${x - 9}Z`} fill={metal} stroke={line} strokeWidth="0.8" />
      <path d={`M${x - 7} ${spring + 26} C${x - 4} ${spring + 20} ${x + 4} ${spring + 20} ${x + 7} ${spring + 26}`} fill="none" stroke={line} strokeWidth="0.7" />
    </g>
  );
  return (
    <svg viewBox="0 0 300 440" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={300} y2={440} />
        <clipPath id={`${id}s`}>
          <path d={`M10 34 H290 V430 H10Z ${archPath}`} clipRule="evenodd" fillRule="evenodd" />
        </clipPath>
      </defs>
      {/* The stone around the opening, then its jaali. */}
      <path d={`M10 34 H290 V430 H10Z ${archPath}`} fill={panel} fillRule="evenodd" stroke={veins} strokeWidth="1" />
      <g clipPath={`url(#${id}s)`} opacity="0.85">
        {lattice}
      </g>
      {/* Frames: the outer rules, the cornice and its merlons. */}
      <path d={merlons} fill={metal} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="6" y="30" width="288" height="404" fill="none" stroke={metal} strokeWidth="5" />
      <rect x="13" y="37" width="274" height="390" fill="none" stroke={metal} strokeWidth="1.2" />
      {/* The arch: a broad gold band, its cusped inner edge, a rosette in each spandrel. */}
      <path d={archPath} fill="none" stroke={line} strokeWidth="13" strokeLinejoin="round" />
      <path d={archPath} fill="none" stroke={metal} strokeWidth="11" strokeLinejoin="round" />
      <path d={cusps} fill="none" stroke={metal} strokeWidth="3.4" strokeLinecap="round" />
      <path d={cusps} fill="none" stroke={line} strokeWidth="0.8" strokeLinecap="round" />
      {[
        [40, 74],
        [260, 74],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="17" fill={panel} stroke={metal} strokeWidth="2.4" />
          <path d={starPath(x!, y!, 8, 13, 7.5)} fill={metal} stroke={line} strokeWidth="0.6" />
          <circle cx={x} cy={y} r="3" fill={jewel} />
        </g>
      ))}
      {/* The keystone jewel and the finial over the apex. */}
      <path d={`M150 ${apex - 22} C156 ${apex - 15} 156 ${apex - 9} 150 ${apex - 4} C144 ${apex - 9} 144 ${apex - 15} 150 ${apex - 22}Z`} fill={metal} stroke={line} strokeWidth="0.8" />
      <circle cx="150" cy={apex - 12} r="2.6" fill={jewel} />
      {column(ox0 - 7)}
      {column(ox1 + 7)}
      {/* The sill and a band of small arches below it. */}
      <rect x="44" y={sill} width="212" height="12" rx="2" fill={metal} stroke={line} strokeWidth="0.9" />
      <path d={Array.from({ length: 9 }, (_, i) => `M${52 + i * 22} 420 V406 C${52 + i * 22} 398 ${66 + i * 22} 398 ${66 + i * 22} 406 V420`).join(' ')} fill="none" stroke={metal} strokeWidth="1.6" />
      <path d="M44 422 H256" stroke={metal} strokeWidth="1.6" />
    </svg>
  );
}

// ─────────────────────────── Fanoos ───────────────────────────

/**
 * A fanoos: a Mughal hanging lantern of pierced brass on its chain, a dome
 * and finial, six glowing panels (three seen) and a tasselled drop. The tint
 * is the brass; the glow is a flame's (NATURE).
 */
export function Fanoos({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const pane = (x0: number, x1: number, key: string, narrow: boolean) => (
    <g key={key}>
      <path d={`M${x0} 108 L${x1} 108 L${x1} 176 L${x0} 176Z`} fill={`url(#${id}g)`} />
      {/* The piercing: an arch window with a star over it. */}
      <path d={`M${r2(x0 + (x1 - x0) * 0.22)} 168 V132 C${r2(x0 + (x1 - x0) * 0.22)} 120 ${r2(x1 - (x1 - x0) * 0.22)} 120 ${r2(x1 - (x1 - x0) * 0.22)} 132 V168`} fill="none" stroke={metal} strokeWidth={narrow ? 1.2 : 2} />
      {narrow ? null : <path d={starPath((x0 + x1) / 2, 116, 8, 4.4, 2.4)} fill={metal} />}
      <path d={`M${x0} 108 V176 M${x1} 108 V176`} stroke={metal} strokeWidth="2.4" />
    </g>
  );
  return (
    <svg viewBox="0 0 120 260" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={120} y2={260} />
        <radialGradient id={`${id}g`} cx="50%" cy="60%" r="70%">
          <stop offset="0" stopColor={NATURE.flameCore} />
          <stop offset="0.55" stopColor={NATURE.flame} />
          <stop offset="1" stopColor={shade(NATURE.flame, 0.35)} />
        </radialGradient>
        <radialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={NATURE.flame} stopOpacity="0.45" />
          <stop offset="1" stopColor={NATURE.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The glow around it. */}
      <ellipse cx="60" cy="142" rx="58" ry="62" fill={`url(#${id}h)`} />
      {/* The chain: links down to a ring. */}
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse key={i} cx="60" cy={6 + i * 9} rx={i % 2 ? 1.6 : 3} ry="4.6" fill="none" stroke={metal} strokeWidth="1.4" />
      ))}
      <circle cx="60" cy="62" r="4.5" fill="none" stroke={metal} strokeWidth="2" />
      {/* The finial and the onion dome. */}
      <path d="M60 64 C63 70 63 74 60 78 C57 74 57 70 60 64Z" fill={metal} />
      <path d="M60 76 C70 80 86 88 92 102 L28 102 C34 88 50 80 60 76Z" fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M38 96 C46 88 54 84 60 83 C66 84 74 88 82 96" fill="none" stroke={line} strokeWidth="0.7" opacity="0.8" />
      <rect x="22" y="101" width="76" height="7" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
      {/* Three of the six panels: the side ones foreshortened. */}
      {pane(24, 38, 'l', true)}
      {pane(38, 82, 'c', false)}
      {pane(82, 96, 'r', true)}
      <path d="M24 108 H96 M24 176 H96" stroke={metal} strokeWidth="2.6" />
      <rect x="20" y="175" width="80" height="7" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
      {/* The base cone, a bead and the tassel. */}
      <path d="M24 182 L96 182 L70 210 L50 210Z" fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M36 190 H84 M46 200 H74" stroke={line} strokeWidth="0.7" opacity="0.8" />
      <circle cx="60" cy="216" r="5.5" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M60 221 C64 232 66 244 64 254 H56 C54 244 56 232 60 221Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M58 230 V252 M62 230 V252" stroke={line} strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}

// ─────────────────────────── Darbar Sahib ───────────────────────────

/**
 * Sri Harmandir Sahib, the Darbar Sahib at Amritsar, seen across the
 * sarovar: the gilded upper storey with its fluted dome and kalash, the
 * corner chhatris, the marble lower storey, and its reflection in the water
 * below. The tint is the gold; the marble is ivory (NATURE). Drawn at 400 × 300.
 */
export function GoldenTemple({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const marble = NATURE.pearl;
  const marbleShade = blend(NATURE.pearl, c, 0.22);
  const water = 214;
  const chhatri = (x: number, y: number, s: number, key: string) => (
    <g key={key}>
      <path d={`M${x} ${y - 30 * s} C${x + 3 * s} ${y - 26 * s} ${x + 3 * s} ${y - 24 * s} ${x} ${y - 21 * s} C${x - 3 * s} ${y - 24 * s} ${x - 3 * s} ${y - 26 * s} ${x} ${y - 30 * s}Z`} fill={metal} />
      <path d={`M${x - 11 * s} ${y - 9 * s} C${x - 11 * s} ${y - 17 * s} ${x - 4 * s} ${y - 21 * s} ${x} ${y - 22 * s} C${x + 4 * s} ${y - 21 * s} ${x + 11 * s} ${y - 17 * s} ${x + 11 * s} ${y - 9 * s}Z`} fill={metal} stroke={line} strokeWidth="0.7" />
      <rect x={x - 13 * s} y={y - 9 * s} width={26 * s} height={3 * s} fill={metal} stroke={line} strokeWidth="0.5" />
      <path d={`M${x - 10 * s} ${y - 6 * s} V${y} M${x + 10 * s} ${y - 6 * s} V${y} M${x - 3.5 * s} ${y - 6 * s} V${y} M${x + 3.5 * s} ${y - 6 * s} V${y}`} stroke={metal} strokeWidth={1.6 * s} />
    </g>
  );
  // A storey's row of cusped arches between x0 and x1, from top to bottom.
  const arcade = (x0: number, x1: number, top: number, bottom: number, count: number, fill: string, key: string) => {
    const w = (x1 - x0) / count;
    return (
      <g key={key}>
        {Array.from({ length: count }, (_, i) => {
          const a = x0 + i * w + w * 0.18;
          const b = x0 + (i + 1) * w - w * 0.18;
          const m = (a + b) / 2;
          return <path key={i} d={`M${r2(a)} ${bottom} V${r2(top + (bottom - top) * 0.42)} C${r2(a)} ${r2(top + (bottom - top) * 0.16)} ${r2(m - w * 0.1)} ${r2(top + 2)} ${r2(m)} ${top} C${r2(m + w * 0.1)} ${r2(top + 2)} ${r2(b)} ${r2(top + (bottom - top) * 0.16)} ${r2(b)} ${r2(top + (bottom - top) * 0.42)} V${bottom}Z`} fill={fill} stroke={line} strokeWidth="0.7" />;
        })}
      </g>
    );
  };
  const temple = (
    <g>
      {/* The plinth in the water. */}
      <rect x="92" y={water - 12} width="216" height="12" fill={marbleShade} stroke={line} strokeWidth="0.8" />
      {/* The lower storey in marble, with its arcade. */}
      <rect x="112" y="150" width="176" height={water - 12 - 150} fill={marble} stroke={line} strokeWidth="0.9" />
      {arcade(116, 284, 160, water - 14, 5, shade(c, 0.12), 'lower')}
      {/* The cornice and the gilded upper storey. */}
      <rect x="104" y="140" width="192" height="10" fill={metal} stroke={line} strokeWidth="0.8" />
      <rect x="118" y="96" width="164" height="44" fill={metal} stroke={line} strokeWidth="0.9" />
      {arcade(124, 276, 103, 136, 7, shade(c, 0.22), 'upper')}
      <rect x="110" y="88" width="180" height="8" fill={metal} stroke={line} strokeWidth="0.8" />
      {/* The parapet of small domes along the roof. */}
      {Array.from({ length: 13 }, (_, i) => {
        const x = 118 + i * 13.66;
        return <path key={i} d={`M${r2(x - 4.5)} 88 C${r2(x - 4.5)} 82 ${r2(x - 1.5)} 79 ${r2(x)} 77 C${r2(x + 1.5)} 79 ${r2(x + 4.5)} 82 ${r2(x + 4.5)} 88Z`} fill={metal} stroke={line} strokeWidth="0.5" />;
      })}
      {/* The corner chhatris. */}
      {chhatri(118, 88, 1.15, 'cl')}
      {chhatri(282, 88, 1.15, 'cr')}
      {/* The great fluted dome on its drum, the kalash and the chhatri crowning it. */}
      <rect x="156" y="70" width="88" height="18" fill={metal} stroke={line} strokeWidth="0.8" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${162 + i * 14} 86 V76 C${162 + i * 14} 72 ${168 + i * 14} 72 ${168 + i * 14} 76 V86`} fill="none" stroke={line} strokeWidth="0.6" />
      ))}
      <path d="M148 72 C138 42 166 20 200 11 C234 20 262 42 252 72Z" fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      {[-40, -26, -13, 0, 13, 26, 40].map((dx) => (
        <path key={dx} d={`M${200 + dx * 1.22} 71 C${200 + dx * 1.18} 50 ${200 + dx * 0.72} 28 200 13`} fill="none" stroke={line} strokeWidth="0.6" opacity="0.75" />
      ))}
      <path d="M156 50 C170 42 186 38 200 37 C214 38 230 42 244 50" fill="none" stroke={tint(c, 0.5)} strokeWidth="1.4" opacity="0.6" />
      {/* Lotus petals at the dome's foot. */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = 152 + i * 8.7;
        return <path key={i} d={`M${r2(x - 4.4)} 72 C${r2(x - 4)} 66 ${r2(x - 1)} 63 ${r2(x)} 62 C${r2(x + 1)} 63 ${r2(x + 4)} 66 ${r2(x + 4.4)} 72Z`} fill={metal} stroke={line} strokeWidth="0.5" />;
      })}
      <path d="M200 11 C203.5 8 203.5 4 200 0 C196.5 4 196.5 8 200 11Z" fill={metal} stroke={line} strokeWidth="0.6" />
      <path d="M191 1 C195 -3 205 -3 209 1" fill="none" stroke={metal} strokeWidth="2" strokeLinecap="round" />
      <path d="M200 -1 V-5.5" stroke={metal} strokeWidth="1.4" />
    </g>
  );
  return (
    <svg viewBox="0 -6 400 306" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={400} y2={300} />
        <linearGradient id={`${id}r`} x1="0" y1={water} x2="0" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}k`}>
          <rect x="0" y={water} width="400" height="90" fill={`url(#${id}r)`} />
        </mask>
      </defs>
      {/* The causeway's balustrade reaching in from either side. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR(400) : undefined}>
          <rect x="6" y={water - 18} width="86" height="6" fill={metal} stroke={line} strokeWidth="0.6" />
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${12 + i * 12} ${water - 12} V${water} M${8 + i * 12} ${water - 22} V${water - 18}`} stroke={metal} strokeWidth="1.6" />
          ))}
          <path d={`M6 ${water} H92`} stroke={metal} strokeWidth="2" />
          {chhatri(14, water - 18, 0.62, `p${side}`)}
        </g>
      ))}
      {temple}
      {/* The water line, and the temple again in the sarovar, fading. */}
      <path d={`M0 ${water} H400`} stroke={metal} strokeWidth="1.6" />
      <g mask={`url(#${id}k)`}>
        <g transform={`matrix(1 0 0 -1 0 ${2 * water})`} opacity="0.75">
          {temple}
        </g>
      </g>
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M${60 + (i % 3) * 30} ${water + 10 + i * 9} H${340 - (i % 2) * 40}`} stroke={metal} strokeWidth="0.8" strokeDasharray={`${14 + i * 3} ${6 + i}`} opacity={r2(0.7 - i * 0.08)} />
      ))}
    </svg>
  );
}

// ─────────────────────────── Phulkari medallion ───────────────────────────

/**
 * A phulkari bagh medallion: an eight-pointed flower of silk-floss diamonds,
 * each worked in darning stitches (fine parallel lines), on a khaddar ground.
 * The tint is the golden silk; the palette's accent and primary give the
 * second and third flosses. Round, so it may turn slowly.
 */
export function PhulkariBagh({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const silk = hex(color);
  const second = hex(colors.accent);
  const ground = shade(hex(colors.primary), 0.18);
  const c = 100;
  // A diamond (lozenge) from p0 to p1 with half-width hw, filled with stitches along it.
  const diamond = (k: number, n: 8 | 16, r0: number, r1: number, hw: number, fill: string, key: string) => {
    const [x0, y0] = pt(c, c, k, n, r0);
    const [x1, y1] = pt(c, c, k, n, r1);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * hw;
    const ny = (dx / len) * hw;
    const shape = poly([
      [x0, y0],
      [r2(mx + nx), r2(my + ny)],
      [x1, y1],
      [r2(mx - nx), r2(my - ny)],
    ]);
    const stitches = Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10 - 0.5;
      return `M${r2(x0 + nx * t * 2)} ${r2(y0 + ny * t * 2)} L${r2(x1 + nx * t * 2)} ${r2(y1 + ny * t * 2)}`;
    }).join(' ');
    return (
      <g key={key}>
        <path d={shape} fill={fill} />
        <g clipPath={`url(#${id}${key})`}>
          <path d={stitches} stroke={shade(fill, 0.22)} strokeWidth="0.55" opacity="0.8" />
        </g>
        <clipPath id={`${id}${key}`}>
          <path d={shape} />
        </clipPath>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <circle cx={c} cy={c} r="97" fill={ground} />
      <circle cx={c} cy={c} r="92" fill="none" stroke={silk} strokeWidth="1.4" strokeDasharray="5 3" />
      {/* Sixteen small diamonds round the rim, then eight great petals, then the heart. */}
      {Array.from({ length: 16 }, (_, k) => diamond(k, 16, 70, 88, 6.5, k % 2 ? second : silk, `r${k}`))}
      {Array.from({ length: 8 }, (_, k) => diamond(k, 8, 16, 66, 17, silk, `p${k}`))}
      {Array.from({ length: 8 }, (_, k) => diamond(k * 2 + 1, 16, 24, 50, 8.5, second, `q${k}`))}
      <path d={starPath(c, c, 8, 15, 8)} fill={second} stroke={silk} strokeWidth="1" />
      <circle cx={c} cy={c} r="4" fill={silk} />
    </svg>
  );
}

// ─────────────────────────── Stained-glass lancet ───────────────────────────

/** Where a photo sits behind the lancet window, as fractions of its frame (an arch mask fits it). */
export const LANCET_OPENING = { x: 0.2577, y: 0.2955, w: 0.4846, h: 0.6136 } as const;

/**
 * A church window: a stone lancet with stained glass round a clear opening
 * for a photo (LANCET_OPENING), a quatrefoil roundel in its head, the glass
 * in the palette's colours between lead lines. The tint is the stone and
 * tracery. Drawn at 260 × 440.
 */
export function LancetWindow({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const lead = shade(c, 0.62);
  const glass = [hex(colors.primary), hex(colors.accent), blend(hex(colors.secondary), '#ffffff', 0.35), blend(hex(colors.primary), hex(colors.accent), 0.5)];
  // The lancet: an equilateral pointed arch over straight jambs (SVG arcs, radius = width).
  const outer = 'M20 432 V170 A220 220 0 0 1 130 12 A220 220 0 0 1 240 170 V432Z';
  const inner = 'M36 420 V172 A194 194 0 0 1 130 34 A194 194 0 0 1 224 172 V420Z';
  // The photo opening: a round-headed light (what an arch mask draws).
  const ox = 67;
  const ow = 126;
  const oy = 130;
  const oh = 270;
  const opening = `M${ox} ${oy + oh} V${oy + ow / 2} A${ow / 2} ${ow / 2} 0 0 1 ${ox + ow} ${oy + ow / 2} V${oy + oh}Z`;
  // Quarries: a diamond lattice of glass, coloured in turn, clipped to the window round the opening.
  const quarries: ReactNode[] = [];
  const q = 22;
  let n = 0;
  for (let row = 0; row < 22; row++) {
    for (let col = -1; col < 13; col++) {
      const x = col * q + (row % 2 ? q / 2 : 0) + 14;
      const y = row * (q / 2) * 1.6 + 20;
      quarries.push(<path key={`${row}-${col}`} d={`M${r2(x)} ${r2(y - q * 0.8)} L${r2(x + q / 2)} ${r2(y)} L${r2(x)} ${r2(y + q * 0.8)} L${r2(x - q / 2)} ${r2(y)}Z`} fill={glass[(row * 3 + col * 2 + n++) % glass.length]} />);
    }
  }
  const roundel = (
    <g>
      <circle cx="130" cy="92" r="27" fill={glass[0]} stroke={metal} strokeWidth="3" />
      {/* A quatrefoil of four lobes in one light glass, cusped where they meet, round a gold boss. */}
      {[
        [0, -11],
        [11, 0],
        [0, 11],
        [-11, 0],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={130 + dx!} cy={92 + dy!} r="10" fill={glass[2]} stroke={metal} strokeWidth="1.8" />
      ))}
      <circle cx="130" cy="92" r="7.5" fill={glass[1]} stroke={metal} strokeWidth="1.6" />
      <circle cx="130" cy="92" r="3" fill={metal} />
    </g>
  );
  return (
    <svg viewBox="0 0 260 440" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={260} y2={440} />
        <clipPath id={`${id}g`}>
          <path d={`${inner} ${opening}`} clipRule="evenodd" />
        </clipPath>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* The glass and its lead, then light falling through it. */}
      <g clipPath={`url(#${id}g)`}>
        <rect x="0" y="0" width="260" height="440" fill={glass[0]} />
        {quarries}
        <g stroke={lead} strokeWidth="1.6" opacity="0.9">
          {Array.from({ length: 26 }, (_, i) => (
            <path key={`a${i}`} d={`M${-200 + i * q} 0 L${100 + i * q} ${r2(300 * 1.6 * 1.03)}`} />
          ))}
          {Array.from({ length: 26 }, (_, i) => (
            <path key={`b${i}`} d={`M${460 - i * q} 0 L${160 - i * q} ${r2(300 * 1.6 * 1.03)}`} />
          ))}
        </g>
        <rect x="0" y="0" width="260" height="440" fill={`url(#${id}l)`} />
      </g>
      {roundel}
      {/* The tracery: the opening's moulding, the jambs, the stone. */}
      <path d={opening} fill="none" stroke={lead} strokeWidth="7" />
      <path d={opening} fill="none" stroke={metal} strokeWidth="4.5" />
      <path d={`${outer} ${inner}`} fill={metal} fillRule="evenodd" stroke={lead} strokeWidth="0.9" />
      <path d={inner} fill="none" stroke={lead} strokeWidth="1.2" />
      <path d="M8 432 H252 V440 H8Z" fill={metal} stroke={lead} strokeWidth="0.9" />
      <path d="M130 12 V2" stroke={metal} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────── Madonna lilies ───────────────────────────

/**
 * A spray of Madonna lilies: three open trumpets and two buds on green stems
 * with lance leaves, tied with a ribbon in the tint. The flowers keep their
 * own white and gold (NATURE). Drawn at 240 × 300.
 */
export function Lilies({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const ribbon = hex(color);
  const petal = NATURE.ivory;
  const petalShade = '#e6e0d2';
  const leaf = NATURE.leaf;
  const leafDark = NATURE.leafDark;
  const pollen = '#d98b1f';
  // One open lily seen nearly face on: three outer and three inner tepals round a green throat, six stamens.
  const tepal = (deg: number, length: number, half: number, fill: string, k: string) => (
    <g key={k} transform={`rotate(${deg})`}>
      <path d={`M0 0 C${-half * 0.7} ${-length * 0.18} ${-half * 1.05} ${-length * 0.48} ${-half * 0.82} ${-length * 0.72} C${-half * 0.55} ${-length * 0.9} ${-half * 0.12} ${-length * 0.98} 0 ${-length} C${half * 0.12} ${-length * 0.98} ${half * 0.55} ${-length * 0.9} ${half * 0.82} ${-length * 0.72} C${half * 1.05} ${-length * 0.48} ${half * 0.7} ${-length * 0.18} 0 0Z`} fill={fill} stroke={petalShade} strokeWidth="0.7" />
      <path d={`M0 ${-length * 0.12} C${-half * 0.08} ${-length * 0.45} ${-half * 0.05} ${-length * 0.7} 0 ${-length * 0.9}`} fill="none" stroke={petalShade} strokeWidth="0.8" />
    </g>
  );
  const bloom = (key: string, transform: string) => (
    <g key={key} transform={transform}>
      {[30, 150, 270].map((deg, i) => tepal(deg, 52, 15, `url(#${id}q)`, `o${i}`))}
      {[90, 210, 330].map((deg, i) => tepal(deg, 56, 17, `url(#${id}p)`, `i${i}`))}
      <path d={starPath(0, 0, 8, 9, 5)} fill="#d6e3a6" opacity="0.9" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <g key={i} transform={`rotate(${deg + 15})`}>
          <path d="M0 -3 C1 -10 0.5 -18 0 -26" fill="none" stroke="#c8d6a0" strokeWidth="1" />
          <ellipse cx="0" cy="-28" rx="2" ry="4.4" fill={pollen} />
        </g>
      ))}
      <path d="M0 0 L2 -20" stroke="#b9cc8a" strokeWidth="1.4" />
      <circle cx="2" cy="-21" r="2.6" fill="#a8bf72" />
    </g>
  );
  const bud = (key: string, transform: string) => (
    <g key={key} transform={transform}>
      <path d="M0 0 C-8 -14 -7 -36 0 -50 C7 -36 8 -14 0 0Z" fill={`url(#${id}b)`} stroke={petalShade} strokeWidth="0.6" />
      <path d="M0 -4 V-44" stroke={petalShade} strokeWidth="0.6" />
    </g>
  );
  const lance = (key: string, d: string) => <path key={key} d={d} fill={leaf} stroke={leafDark} strokeWidth="0.6" />;
  return (
    <svg viewBox="0 0 240 300" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}p`} cx="0" cy="0" r="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef3d6" />
          <stop offset="0.3" stopColor={petal} />
          <stop offset="1" stopColor="#ffffff" />
        </radialGradient>
        <radialGradient id={`${id}q`} cx="0" cy="0" r="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3f6df" />
          <stop offset="0.35" stopColor={petalShade} />
          <stop offset="1" stopColor={petal} />
        </radialGradient>
        <linearGradient id={`${id}b`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#d8e2b8" />
          <stop offset="1" stopColor={petal} />
        </linearGradient>
      </defs>
      {/* Stems gathered at the foot. */}
      <g fill="none" stroke={leaf} strokeWidth="3.2" strokeLinecap="round">
        <path d="M118 296 C116 250 96 200 70 160" />
        <path d="M120 296 C120 240 122 180 124 120" />
        <path d="M122 296 C126 250 150 206 176 170" />
        <path d="M119 296 C112 240 100 196 96 80" />
        <path d="M121 296 C130 240 150 170 160 96" />
      </g>
      {lance('l1', 'M116 260 C96 246 76 248 58 262 C78 266 98 266 116 260Z')}
      {lance('l2', 'M124 248 C146 232 168 232 186 244 C166 250 144 252 124 248Z')}
      {lance('l3', 'M118 220 C102 200 98 180 102 162 C110 178 116 198 118 220Z')}
      {lance('l4', 'M123 206 C136 190 150 184 164 186 C152 196 138 204 123 206Z')}
      {bud('b1', 'translate(96 82) rotate(-8)')}
      {bud('b2', 'translate(160 98) rotate(10)')}
      {bloom('f1', 'translate(66 160) rotate(-20) scale(0.86 0.74)')}
      {bloom('f2', 'translate(178 168) rotate(18) scale(0.86 0.74)')}
      {bloom('f3', 'translate(122 112) scale(1 0.9)')}
      {/* The ribbon tying the stems: a bow with two tails. */}
      <path d="M108 262 C96 252 84 254 82 264 C84 274 96 274 108 266Z" fill={ribbon} stroke={shade(ribbon, 0.3)} strokeWidth="0.7" />
      <path d="M132 262 C144 252 156 254 158 264 C156 274 144 274 132 266Z" fill={ribbon} stroke={shade(ribbon, 0.3)} strokeWidth="0.7" />
      <path d="M112 268 C108 280 100 290 92 298 L100 298 C108 290 114 282 116 272Z" fill={ribbon} />
      <path d="M128 268 C132 280 140 290 148 298 L140 298 C132 290 126 282 124 272Z" fill={ribbon} />
      <rect x="108" y="258" width="24" height="12" rx="4" fill={tint(ribbon, 0.15)} stroke={shade(ribbon, 0.3)} strokeWidth="0.7" />
    </svg>
  );
}

// ─────────────────────────── Wedding bells ───────────────────────────

/**
 * Two wedding bells leaning together under a ribbon bow, a sprig of orange
 * blossom between them. The tint is the bells' metal; the bow is the
 * palette's accent. Drawn at 220 × 190.
 */
export function WeddingBells({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const bow = hex(colors.accent);
  const bell = (key: string, transform: string) => (
    <g key={key} transform={transform}>
      <path d="M0 0 C-10 0 -16 8 -18 22 C-20 40 -24 54 -36 64 H36 C24 54 20 40 18 22 C16 8 10 0 0 0Z" fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M-36 64 C-30 70 30 70 36 64 C34 60 -34 60 -36 64Z" fill={metal} stroke={line} strokeWidth="0.9" />
      <path d="M-9 8 C-13 20 -14 40 -22 56" fill="none" stroke={tint(c, 0.6)} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      <path d="M-28 58 H28" stroke={line} strokeWidth="0.7" opacity="0.7" />
      <circle cx="0" cy="72" r="6" fill={metal} stroke={line} strokeWidth="0.8" />
      <rect x="-5" y="-8" width="10" height="9" rx="3" fill={metal} stroke={line} strokeWidth="0.8" />
    </g>
  );
  const blossom = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      {FIVE.map(([ux, uy], k) => (
        <circle key={k} cx={r2(ux * 5.2)} cy={r2(uy * 5.2)} r="3.6" fill={NATURE.pearl} stroke="#e4ddcd" strokeWidth="0.5" />
      ))}
      <circle cx="0" cy="0" r="2" fill="#f2c94c" />
    </g>
  );
  return (
    <svg viewBox="0 0 220 190" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={220} y2={190} />
      </defs>
      {/* Ribbon tails falling behind the bells. */}
      <path d="M104 40 C92 70 84 96 72 118 L80 120 C92 98 100 72 108 44Z" fill={shade(bow, 0.1)} />
      <path d="M116 40 C128 70 136 96 148 118 L140 120 C128 98 120 72 112 44Z" fill={shade(bow, 0.1)} />
      {bell('l', 'translate(76 52) rotate(14)')}
      {bell('r', 'translate(144 52) rotate(-14)')}
      {/* The leaves and blossom where they meet. */}
      <path d="M110 46 C96 52 88 64 86 76 C98 70 106 60 110 46Z" fill={NATURE.leaf} />
      <path d="M110 46 C124 52 132 64 134 76 C122 70 114 60 110 46Z" fill={NATURE.leafLight} />
      {blossom(102, 62, 1, 'b1')}
      {blossom(118, 64, 0.9, 'b2')}
      {blossom(110, 74, 0.8, 'b3')}
      {/* The bow. */}
      <path d="M110 40 C96 26 74 24 72 36 C72 48 94 48 110 42Z" fill={bow} stroke={shade(bow, 0.32)} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M110 40 C124 26 146 24 148 36 C148 48 126 48 110 42Z" fill={bow} stroke={shade(bow, 0.32)} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M84 36 C92 34 100 36 106 40 M136 36 C128 34 120 36 114 40" fill="none" stroke={shade(bow, 0.32)} strokeWidth="0.7" />
      <ellipse cx="110" cy="41" rx="7" ry="6" fill={tint(bow, 0.12)} stroke={shade(bow, 0.32)} strokeWidth="0.9" />
    </svg>
  );
}
