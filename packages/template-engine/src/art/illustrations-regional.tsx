import type { ReactNode } from 'react';
import { hex, Metal, NATURE, onCubic, shade, tint, useSafeId, type IllustrationProps, type Segment } from './kit';
import { MangoLeaf, Marigold, r2 } from './motifs';

/**
 * Regional stationery: the vocabulary of one tradition each. A South Indian
 * temple prabhavali (the flame arch around a shrine), a brass kuthuvilakku
 * and a Kanjeevaram zari border; a Mughal mihrab; a Punjabi phulkari border;
 * a Bengali alpana; marigold swags for a haldi. The tint is the metal (or the
 * main thread or paste); real flames, flowers and leaves keep their colours.
 */

/** Elements every `step` degrees over the top of a circle around (cx, cy), drawn pointing up and turned into place. */
function crest(step: number, cx: number, cy: number, render: (key: number, transform: string) => ReactNode, skip = 0): ReactNode[] {
  const k = Math.floor(90 / step);
  const out: ReactNode[] = [];
  for (let j = -k; j <= k; j++) {
    const a = r2(j * step);
    if (Math.abs(a) < skip) continue;
    out.push(render(j, `rotate(${a} ${cx} ${cy})`));
  }
  return out;
}

// ─────────────────────────── Prabhavali ───────────────────────────

/** Where a photo sits behind a prabhavali, as fractions of its frame (an arch mask fits it). */
export const PRABHAVALI_OPENING = { x: 70 / 300, y: 120 / 420, w: 160 / 300, h: 252 / 420 } as const;

/** A flame tongue pointing up from (150, 100), curling to the right at its tip. */
const FLAME = 'M142 101 C141 93 146.5 88 147.5 81 C148.2 77 150.5 75 152 71.5 C154.5 78 159 84 158 92 C157.6 96 158 99 158 101Z';

/**
 * A South Indian temple prabhavali: a round arch on carved pillars, its band
 * set with lotus petals and pearls, ringed by flames, crowned by a kalasam
 * finial, with makara scrolls where it springs and a lotus frieze below. The
 * opening is see-through: put a photo or a lamp behind it at x 23.3–76.7 %,
 * y 28.6–88.6 % of the frame (an arch mask fits it).
 */
export function Prabhavali({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.45);
  const light = tint(c, 0.55);
  const jewel = hex(colors.accent);
  const scroll = (
    <g>
      <path d="M46 202 C30 200 20 210 22 222 C24 234 40 236 44 226 C47 218 40 211 34 215 C30 218 33 224 37 222" fill="none" stroke={metal} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 226 C40 238 30 244 18 244" fill="none" stroke={metal} strokeWidth="2" strokeLinecap="round" />
      <path d="M30 240 C26 248 28 256 34 258" fill="none" stroke={metal} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="35.5" cy="218.5" r="2" fill={jewel} />
    </g>
  );
  return (
    <svg viewBox="0 0 300 420" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={300} y2={420} />
        <radialGradient id={`${id}f`} cx="50%" cy="85%" r="70%">
          <stop offset="0" stopColor={tint(c, 0.75)} />
          <stop offset="0.6" stopColor={tint(c, 0.25)} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      {/* The flame ring, behind the band; the finial replaces the flames at the crown. */}
      {crest(8, 150, 200, (k, transform) => (
        <g key={`f${k}`} transform={transform}>
          <path d={FLAME} fill={`url(#${id}f)`} stroke={line} strokeWidth="0.6" />
          <path d="M147 99 C147 93 150.5 89 151.5 84" fill="none" stroke={light} strokeWidth="0.8" />
        </g>
      ), 10)}
      {/* The band: outer and inner rims, lotus petals and pearls between. */}
      <path d="M48 200 A102 102 0 0 1 252 200 L232 200 A82 82 0 0 0 68 200Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M53 200 A97 97 0 0 1 247 200" fill="none" stroke={shade(c, 0.3)} strokeWidth="0.8" />
      {crest(7.5, 150, 200, (k, transform) => (
        <path key={`p${k}`} d="M150 103 C154.5 107 154.5 113 150 117.5 C145.5 113 145.5 107 150 103Z" fill={jewel} stroke={line} strokeWidth="0.5" transform={transform} />
      ))}
      {crest(7.5, 150, 200, (k, transform) => (
        <circle key={`b${k}`} cx="150" cy="111" r="1.6" fill={NATURE.pearl} transform={transform} />
      ), 0)}
      <path d="M70 200 A80 80 0 0 1 230 200" fill="none" stroke={light} strokeWidth="1.2" />
      {/* Kalasam finial at the crown: mango leaves, the pot, its rim and the coconut. */}
      <path d="M150 64 C141 60 132 61 126 66 C134 69 142 68 150 64Z" fill={NATURE.leaf} stroke={NATURE.leafDark} strokeWidth="0.6" />
      <path d="M150 64 C159 60 168 61 174 66 C166 69 158 68 150 64Z" fill={NATURE.leaf} stroke={NATURE.leafDark} strokeWidth="0.6" />
      <ellipse cx="150" cy="96" rx="20" ry="4.5" fill={metal} stroke={line} strokeWidth="0.7" />
      <path d="M134 94 C127 85 131 72 150 70 C169 72 173 85 166 94Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M137 84 H163" stroke={line} strokeWidth="0.7" />
      <path d="M139 80 C144 76 156 76 161 80" fill="none" stroke={light} strokeWidth="1" />
      <rect x="142" y="64" width="16" height="7" rx="2" fill={metal} stroke={line} strokeWidth="0.7" />
      <path d="M141 64 C142 52 147 42 150 30 C153 42 158 52 159 64Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M150 34 V62" stroke={light} strokeWidth="0.8" />
      <circle cx="150" cy="27" r="3" fill={metal} />
      <circle cx="150" cy="85" r="3.2" fill={jewel} stroke={line} strokeWidth="0.5" />
      {/* Pillars with brackets, fluting and bases. */}
      {[
        [44, 70],
        [230, 256],
      ].map(([a, b]) => (
        <g key={a}>
          <rect x={a} y="212" width={b! - a!} height="160" fill={metal} stroke={line} strokeWidth="0.8" />
          {[0.3, 0.5, 0.7].map((t) => (
            <path key={t} d={`M${r2(a! + (b! - a!) * t)} 222 V362`} stroke={line} strokeWidth="0.8" opacity="0.75" />
          ))}
          <path d={`M${a! - 6} 212 H${b! + 6} L${b! + 2} 204 H${a! - 2}Z`} fill={metal} stroke={line} strokeWidth="0.8" />
          <rect x={a! - 3} y="224" width={b! - a! + 6} height="6" rx="2" fill={metal} stroke={line} strokeWidth="0.6" />
          <rect x={a! - 3} y="352" width={b! - a! + 6} height="6" rx="2" fill={metal} stroke={line} strokeWidth="0.6" />
          <circle cx={r2((a! + b!) / 2)} cy="292" r="4" fill={jewel} stroke={line} strokeWidth="0.6" />
        </g>
      ))}
      {/* Makara scrolls where the arch springs. */}
      {scroll}
      <g transform="translate(300 0) scale(-1 1)">{scroll}</g>
      {/* The plinth with its lotus frieze. */}
      <rect x="30" y="372" width="240" height="16" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
      {Array.from({ length: 15 }, (_, i) => (
        <path key={i} d={`M${38 + i * 16} 388 C${42 + i * 16} 394 ${50 + i * 16} 394 ${54 + i * 16} 388`} fill="none" stroke={line} strokeWidth="0.8" />
      ))}
      <rect x="22" y="388" width="256" height="10" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M30 380 H270" stroke={light} strokeWidth="0.8" opacity="0.8" />
      <rect x="14" y="398" width="272" height="8" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
    </svg>
  );
}

// ─────────────────────────── Kuthuvilakku ───────────────────────────

/** A lamp flame with its halo, its base at (x, y). */
function Flame({ x, y, s = 1, glow }: { x: number; y: number; s?: number; glow: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-8" r="11" fill={`url(#${glow})`} />
      <path d="M0 0 C-4.5 -3 -4.5 -9 0 -18 C4.5 -9 4.5 -3 0 0Z" fill={NATURE.flame} />
      <path d="M0 -1.5 C-2 -3.5 -2 -7 0 -11.5 C2 -7 2 -3.5 0 -1.5Z" fill={NATURE.flameCore} />
    </g>
  );
}

/**
 * A brass kuthuvilakku, the standing lamp lit at South Indian weddings: a
 * lotus-bud finial, a five-wicked dish with its flames, a ringed column and a
 * stepped foot.
 */
export function Kuthuvilakku({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.45);
  const light = tint(c, 0.55);
  const glow = `${id}g`;
  const ring = (y: number, rx: number, ry = 3.4) => <ellipse cx="60" cy={y} rx={rx} ry={ry} fill={metal} stroke={line} strokeWidth="0.6" />;
  return (
    <svg viewBox="0 0 120 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={120} y2={300} />
        <radialGradient id={glow}>
          <stop offset="0" stopColor={NATURE.flameCore} stopOpacity="0.85" />
          <stop offset="0.45" stopColor={NATURE.flame} stopOpacity="0.35" />
          <stop offset="1" stopColor={NATURE.flame} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Finial: a lotus bud on its sepals, a neck and a knob. */}
      <path d="M60 4 C66.5 12 68 21 60 31 C52 21 53.5 12 60 4Z" fill={metal} stroke={line} strokeWidth="0.7" />
      <path d="M60 8 C62.5 14 62.5 21 60 27" fill="none" stroke={light} strokeWidth="0.8" />
      <path d="M51 29 C54.5 25 57.5 26 60 31 C62.5 26 65.5 25 69 29 C65 33.5 55 33.5 51 29Z" fill={metal} stroke={line} strokeWidth="0.6" />
      <rect x="57" y="32" width="6" height="30" fill={metal} stroke={line} strokeWidth="0.6" />
      {ring(42, 6, 2.4)}
      {ring(52, 7.5, 3)}
      {/* The dish with five spouts and their flames. */}
      <path d="M10 66 C12 77 30 84 60 84 C90 84 108 77 110 66Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <ellipse cx="60" cy="66" rx="50" ry="7.5" fill={shade(c, 0.25)} stroke={line} strokeWidth="0.8" />
      <ellipse cx="60" cy="65" rx="45" ry="5.5" fill={shade(c, 0.5)} opacity="0.7" />
      {[
        [8, 63, -1],
        [112, 63, 1],
      ].map(([x, y, s]) => (
        <path key={x} d={`M${x! - s! * 6} ${y! + 1} L${x! + s! * 3} ${y! - 3} L${x! - s! * 2} ${y! + 6}Z`} fill={metal} stroke={line} strokeWidth="0.6" />
      ))}
      <path d="M16 72 C34 79 86 79 104 72" fill="none" stroke={light} strokeWidth="1" opacity="0.8" />
      <path d="M55 72 L60 76.5 L65 72Z" fill={metal} stroke={line} strokeWidth="0.6" />
      {[
        [8, 60, 0.85],
        [31, 62, 0.9],
        [89, 62, 0.9],
        [112, 60, 0.85],
        [60, 73, 1.05],
      ].map(([x, y, s]) => (
        <Flame key={x} x={x!} y={y!} s={s!} glow={glow} />
      ))}
      {/* The column with its rings. */}
      {ring(88, 10, 4.5)}
      <rect x="55" y="92" width="10" height="136" fill={metal} stroke={line} strokeWidth="0.6" />
      <path d="M58 94 V226" stroke={light} strokeWidth="1" opacity="0.8" />
      {ring(118, 9)}
      {ring(158, 10)}
      {ring(198, 9)}
      {ring(226, 11, 4)}
      {/* The stepped foot. */}
      <path d="M53 228 C53 242 40 252 24 263 C18 267 16 272 17 278 H103 C104 272 102 267 96 263 C80 252 67 242 67 228Z" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M58 232 C57 246 46 256 31 266" fill="none" stroke={light} strokeWidth="1" opacity="0.8" />
      <ellipse cx="60" cy="256" rx="22" ry="3" fill="none" stroke={line} strokeWidth="0.6" opacity="0.8" />
      <rect x="11" y="278" width="98" height="8" rx="3" fill={metal} stroke={line} strokeWidth="0.8" />
      <rect x="17" y="286" width="86" height="10" rx="2" fill={metal} stroke={line} strokeWidth="0.8" />
      <path d="M20 291 H100" stroke={line} strokeWidth="0.6" />
    </svg>
  );
}

// ─────────────────────────── Zari band ───────────────────────────

/**
 * A Kanjeevaram zari border drawn to the layer's size: a contrast ground in
 * the palette's accent, gold rules, a row of temple towers pointing inward and
 * a line of rudraksha beads. Lay it along the top; flip it for the foot.
 */
export function ZariBand({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const ground = hex(colors.accent);
  const u = Math.max(0.4, h / 56);
  const p = 30 * u;
  const n = Math.max(2, Math.round(w / p));
  const step = w / n;
  const top = 11 * u;
  const tip = h - 15 * u;
  const tower = (x0: number) => {
    const x1 = x0 + step;
    const m = (x0 + x1) / 2;
    const levels = 4;
    const pts: string[] = [`${r2(x0 + step * 0.06)} ${r2(top)}`];
    for (let l = 1; l <= levels; l++) {
      const y = top + ((tip - top) * l) / (levels + 1);
      const half = (step * 0.44 * (levels + 1 - l)) / (levels + 1);
      pts.push(`${r2(m - half - step * 0.06)} ${r2(y)}`, `${r2(m - half)} ${r2(y)}`);
    }
    pts.push(`${r2(m)} ${r2(tip)}`);
    const right = pts.slice(1, -1).map((pt) => {
      const [x, y] = pt.split(' ').map(Number);
      return `${r2(2 * m - x!)} ${y}`;
    });
    return `M${pts.join(' L')} L${right.reverse().join(' L')} L${r2(x1 - step * 0.06)} ${r2(top)}Z`;
  };
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={w} y2={h} />
      </defs>
      <rect x="0" y="0" width={r2(w)} height={r2(h)} fill={ground} />
      <rect x="0" y={r2(2 * u)} width={r2(w)} height={r2(2.2 * u)} fill={metal} />
      <rect x="0" y={r2(6.4 * u)} width={r2(w)} height={r2(0.9 * u)} fill={metal} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <path d={tower(i * step)} fill={metal} stroke={shade(c, 0.4)} strokeWidth={r2(0.4 * u)} />
          <path d={`M${r2(i * step + step / 2)} ${r2(top + 4 * u)} V${r2(tip - 6 * u)}`} stroke={ground} strokeWidth={r2(1.2 * u)} opacity="0.55" />
          <circle cx={r2(i * step + step / 2)} cy={r2(top + (tip - top) * 0.36)} r={r2(1.8 * u)} fill={ground} />
          <circle cx={r2(i * step)} cy={r2(tip - 2 * u)} r={r2(2.1 * u)} fill={metal} />
        </g>
      ))}
      <rect x="0" y={r2(h - 6.4 * u)} width={r2(w)} height={r2(0.9 * u)} fill={metal} />
      {Array.from({ length: n * 3 }, (_, i) => (
        <circle key={`d${i}`} cx={r2((i + 0.5) * (step / 3))} cy={r2(h - 3.4 * u)} r={r2(1.25 * u)} fill={metal} />
      ))}
    </svg>
  );
}

// ─────────────────────────── Mihrab ───────────────────────────

/** An eight-point star of radius r at the origin (two squares), as a path. */
const STAR8 = (r: number) => {
  const a = r2(r);
  const b = r2(r * 0.7071);
  return `M0 ${-a} L${r2(b * 0.42)} ${-b} L${b} ${-b} L${b} ${r2(-b * 0.42)} L${a} 0 L${b} ${r2(b * 0.42)} L${b} ${b} L${r2(b * 0.42)} ${b} L0 ${a} L${r2(-b * 0.42)} ${b} L${-b} ${b} L${-b} ${r2(b * 0.42)} L${-a} 0 L${-b} ${r2(-b * 0.42)} L${-b} ${-b} L${r2(-b * 0.42)} ${-b}Z`;
};

/**
 * A Mughal mihrab drawn to the layer's size: a double-ruled panel with a band
 * of stars along its head, a pointed arch with a cusped inner edge springing
 * from slender columns, star lattice in the spandrels and a crescent finial.
 * The arch is open: set the words (or a photo) inside it.
 */
export function Mihrab({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const jewel = hex(colors.accent);
  const W = Math.max(80, w);
  const H = Math.max(120, h);
  const u = Math.min(W, H) / 340;
  const m = 7 * u;
  const band = 16 * u;
  const colX = m + 9 * u;
  const cw = 13 * u;
  const xl = colX + cw;
  const xr = W - xl;
  const cx = W / 2;
  const hw = (xr - xl) / 2;
  const apex = m + band + 30 * u;
  const spring = Math.min(H * 0.6, apex + hw * 1.3);
  const base = H - m - 16 * u;
  const rise = spring - apex;
  const t = 12 * u;
  // The inner and outer edges of the arch band, each two cubic curves meeting at the point.
  const inner: Segment[] = [
    [[xl, spring], [xl, spring - rise * 0.62], [cx - hw * 0.34, apex + rise * 0.16], [cx, apex]],
    [[cx, apex], [cx + hw * 0.34, apex + rise * 0.16], [xr, spring - rise * 0.62], [xr, spring]],
  ];
  const outer: Segment[] = [
    [[xl - t, spring], [xl - t, spring - rise * 0.66 - t], [cx - hw * 0.4, apex - t * 0.2], [cx, apex - t * 1.3]],
    [[cx, apex - t * 1.3], [cx + hw * 0.4, apex - t * 0.2], [xr + t, spring - rise * 0.66 - t], [xr + t, spring]],
  ];
  const curve = (segs: Segment[]) => segs.map(([p0, c1, c2, p3], i) => `${i ? '' : `M${r2(p0[0])} ${r2(p0[1])} `}C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p3[0])} ${r2(p3[1])}`).join(' ');
  // The cusps: small lobes along the inner edge, bulging into the opening.
  const lobes = Math.max(6, Math.round(rise / (16 * u)));
  const pts = [...Array.from({ length: lobes }, (_, i) => onCubic(inner[0]!, i / lobes)), ...Array.from({ length: lobes + 1 }, (_, i) => onCubic(inner[1]!, i / lobes))];
  const cusps = pts
    .slice(0, -1)
    .map((p, i) => {
      const q = pts[i + 1]!;
      const chord = Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
      return `M${r2(p.x)} ${r2(p.y)} A${r2(chord * 0.56)} ${r2(chord * 0.56)} 0 0 0 ${r2(q.x)} ${r2(q.y)}`;
    })
    .join(' ');
  const reversed = (segs: Segment[]) => curve([...segs].reverse().map(([p0, c1, c2, p3]) => [p3, c2, c1, p0] as Segment)).replace(/^M[^C]+/, '');
  const band2 = `${curve(outer)} L${r2(xr)} ${r2(spring)} ${reversed(inner)} Z`;
  const mid = inner.map((seg, s) => seg.map((pt, k) => [(pt[0] + outer[s]![k]![0]) / 2, (pt[1] + outer[s]![k]![1]) / 2]) as unknown as Segment);
  const spandrel = `M${r2(m)} ${r2(m + band)} H${r2(W - m)} V${r2(spring)} H${r2(xr + t)} ${reversed(outer)} H${r2(m)}Z`;
  const starStep = 15 * u;
  const headStars = Math.max(3, Math.floor((W - m * 2) / (14 * u)));
  const sillDiamonds = Math.max(3, Math.floor((W - m * 2) / (18 * u)));
  const lattice: ReactNode[] = [];
  for (let y = m + band + starStep * 0.6; y < spring; y += starStep) {
    for (let x = m + starStep * 0.5; x < W - m; x += starStep) {
      lattice.push(<path key={`${r2(x)}-${r2(y)}`} d={STAR8(3.2 * u)} transform={`translate(${r2(x)} ${r2(y)})`} fill={metal} />);
    }
  }
  const column = (x: number) => (
    <g key={x}>
      <rect x={r2(x)} y={r2(spring + 10 * u)} width={r2(cw)} height={r2(base - spring - 10 * u)} fill="none" stroke={metal} strokeWidth={r2(1.1 * u)} />
      <path d={`M${r2(x + cw / 2)} ${r2(spring + 16 * u)} V${r2(base - 6 * u)}`} stroke={metal} strokeWidth={r2(0.7 * u)} />
      <rect x={r2(x - 3 * u)} y={r2(spring)} width={r2(cw + 6 * u)} height={r2(10 * u)} rx={r2(2 * u)} fill={metal} />
      <circle cx={r2(x + cw / 2)} cy={r2(spring + 5 * u)} r={r2(2.2 * u)} fill={jewel} />
      <rect x={r2(x - 3 * u)} y={r2(base - 8 * u)} width={r2(cw + 6 * u)} height={r2(8 * u)} rx={r2(2 * u)} fill={metal} />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={W} y2={H} />
        <clipPath id={`${id}s`}>
          <path d={spandrel} />
        </clipPath>
      </defs>
      {/* The panel's rules and its head band of stars. */}
      <rect x={r2(m * 0.4)} y={r2(m * 0.4)} width={r2(W - m * 0.8)} height={r2(H - m * 0.8)} fill="none" stroke={metal} strokeWidth={r2(1.6 * u)} />
      <rect x={r2(m)} y={r2(m)} width={r2(W - m * 2)} height={r2(H - m * 2)} fill="none" stroke={metal} strokeWidth={r2(0.8 * u)} />
      <path d={`M${r2(m)} ${r2(m + band)} H${r2(W - m)}`} stroke={metal} strokeWidth={r2(0.8 * u)} />
      {Array.from({ length: headStars }, (_, i) => (
        <path key={`b${i}`} d={STAR8(4 * u)} transform={`translate(${r2(m + ((i + 0.5) * (W - m * 2)) / headStars)} ${r2(m + band / 2)})`} fill={metal} />
      ))}
      {/* Spandrels: a lattice of stars. */}
      <g clipPath={`url(#${id}s)`} opacity="0.55">
        {lattice}
      </g>
      {/* The arch band: rules, beads and the cusped inner edge. */}
      <path d={band2} fill={metal} fillOpacity="0.12" stroke="none" />
      <path d={curve(outer)} fill="none" stroke={metal} strokeWidth={r2(1.6 * u)} />
      <path d={curve(inner)} fill="none" stroke={metal} strokeWidth={r2(1 * u)} />
      <path d={curve(mid)} fill="none" stroke={metal} strokeWidth={r2(2.2 * u)} strokeDasharray={`0 ${r2(5 * u)}`} strokeLinecap="round" />
      <path d={cusps} fill="none" stroke={metal} strokeWidth={r2(1.3 * u)} strokeLinecap="round" />
      {/* Finial: a crescent over a pearl and a drop. */}
      <g transform={`translate(${r2(cx)} ${r2(apex - t * 1.3)}) scale(${r2(u)})`}>
        <path d="M0 0 V-7" stroke={metal} strokeWidth="1.6" />
        <circle cy="-10" r="3.6" fill={metal} />
        <path d="M-0.5 -26 A8 8 0 1 0 6 -15 A6.4 6.4 0 1 1 -0.5 -26Z" fill={metal} />
        <circle cy="5" r="2.4" fill={jewel} />
      </g>
      {column(colX)}
      {column(W - colX - cw)}
      {/* The sill. */}
      <path d={`M${r2(m)} ${r2(base)} H${r2(W - m)}`} stroke={metal} strokeWidth={r2(1.2 * u)} />
      {Array.from({ length: sillDiamonds }, (_, i) => (
        <path key={`d${i}`} d={`M0 ${r2(-3 * u)} L${r2(3 * u)} 0 L0 ${r2(3 * u)} L${r2(-3 * u)} 0Z`} transform={`translate(${r2(m + ((i + 0.5) * (W - m * 2)) / sillDiamonds)} ${r2((base + H - m) / 2)})`} fill={metal} />
      ))}
    </svg>
  );
}

// ─────────────────────────── Phulkari ───────────────────────────

/**
 * A phulkari border drawn to the layer's size: a row of bagh diamonds darned
 * in silk floss, each facet stitched the other way so it catches the light
 * differently, with an inner diamond in the second silk and a running stitch
 * along both edges. The tint is the main silk (golden yellow), the accent the
 * second, the background the highlights.
 */
export function Phulkari({ color, colors, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const silk = hex(color);
  const second = hex(colors.accent);
  const third = hex(colors.background);
  const W = Math.max(40, w);
  const H = Math.max(16, h);
  const u = H / 60;
  const n = Math.max(2, Math.round(W / (H * 0.95)));
  const step = W / n;
  const cy = H / 2;
  const ry = H * 0.3;
  const rx = step * 0.4;
  const gap = r2(1.7 * u);
  const stitches = (key: string, base: string, vertical: boolean) => (
    <pattern key={key} id={`${id}${key}`} width={vertical ? gap : r2(6 * u)} height={vertical ? r2(6 * u) : gap} patternUnits="userSpaceOnUse">
      <rect width={vertical ? gap : r2(6 * u)} height={vertical ? r2(6 * u) : gap} fill={base} />
      <path d={vertical ? `M${r2(gap / 2)} 0 V${r2(6 * u)}` : `M0 ${r2(gap / 2)} H${r2(6 * u)}`} stroke={tint(base, 0.4)} strokeWidth={r2(0.45 * u)} opacity="0.7" />
    </pattern>
  );
  const facets = (x: number, a: number, b: number, fillA: string, fillB: string) => [
    <path key="tl" d={`M${r2(x)} ${r2(cy)} L${r2(x - a)} ${r2(cy)} L${r2(x)} ${r2(cy - b)}Z`} fill={fillA} />,
    <path key="tr" d={`M${r2(x)} ${r2(cy)} L${r2(x)} ${r2(cy - b)} L${r2(x + a)} ${r2(cy)}Z`} fill={fillB} />,
    <path key="br" d={`M${r2(x)} ${r2(cy)} L${r2(x + a)} ${r2(cy)} L${r2(x)} ${r2(cy + b)}Z`} fill={fillA} />,
    <path key="bl" d={`M${r2(x)} ${r2(cy)} L${r2(x)} ${r2(cy + b)} L${r2(x - a)} ${r2(cy)}Z`} fill={fillB} />,
  ];
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        {stitches('h', silk, false)}
        {stitches('v', shade(silk, 0.08), true)}
        {stitches('a', second, false)}
        {stitches('b', shade(second, 0.12), true)}
      </defs>
      {Array.from({ length: n }, (_, i) => {
        const x = (i + 0.5) * step;
        return (
          <g key={i}>
            {facets(x, rx, ry, `url(#${id}h)`, `url(#${id}v)`)}
            {facets(x, rx * 0.56, ry * 0.56, `url(#${id}a)`, `url(#${id}b)`)}
            {facets(x, rx * 0.2, ry * 0.2, third, tint(third, 0.2))}
            {/* The half diamonds between, in the second silk. */}
            <path d={`M${r2(i * step)} ${r2(cy - ry * 0.55)} L${r2(i * step + rx * 0.3)} ${r2(cy)} L${r2(i * step)} ${r2(cy + ry * 0.55)} L${r2(i * step - rx * 0.3)} ${r2(cy)}Z`} fill={`url(#${id}a)`} />
          </g>
        );
      })}
      {[2.5 * u, H - 2.5 * u].map((y) => (
        <path key={y} d={`M0 ${r2(y)} H${r2(W)}`} stroke={silk} strokeWidth={r2(1.3 * u)} strokeDasharray={`${r2(4 * u)} ${r2(2.4 * u)}`} />
      ))}
      {Array.from({ length: n * 6 }, (_, i) => {
        const tw = step / 6;
        const x = (i + 0.5) * tw;
        const t = 6 * u;
        return (
          <g key={`t${i}`}>
            <path d={`M${r2(x - tw * 0.42)} ${r2(5 * u)} L${r2(x + tw * 0.42)} ${r2(5 * u)} L${r2(x)} ${r2(5 * u + t)}Z`} fill={`url(#${id}${i % 2 ? 'v' : 'b'})`} />
            <path d={`M${r2(x - tw * 0.42)} ${r2(H - 5 * u)} L${r2(x + tw * 0.42)} ${r2(H - 5 * u)} L${r2(x)} ${r2(H - 5 * u - t)}Z`} fill={`url(#${id}${i % 2 ? 'v' : 'b'})`} />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────── Alpana ───────────────────────────

/**
 * A Bengali alpana painted in rice paste: a lotus at the heart, a ring of
 * conch spirals, a ring of flame-leaves with dots, a beaded circle and an
 * outer edge of curls. The tint is the paste (white on red, red on white);
 * the accent dots it.
 */
export function Alpana({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  const dot = hex(colors.accent);
  const ringOf = (n: number, render: (i: number, a: number) => ReactNode, offset = 0) => Array.from({ length: n }, (_, i) => render(i, r2((360 / n) * i + offset)));
  const line = { fill: 'none', stroke: c, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      {/* Outer edge: curls and drops. */}
      {ringOf(24, (i, a) => (
        <g key={`e${i}`} transform={`rotate(${a} 150 150)`}>
          <path d="M150 16 C157 12 163 17 160 22 C158 26 153 24 154 21" {...line} strokeWidth="2.4" />
          <path d="M150 16 C143 12 137 17 140 22 C142 26 147 24 146 21" {...line} strokeWidth="2.4" />
          <circle cx="150" cy="9" r="2.6" fill={c} />
        </g>
      ))}
      <circle cx="150" cy="150" r="124" {...line} strokeWidth="2.6" />
      <circle cx="150" cy="150" r="117" fill="none" stroke={c} strokeWidth="5" strokeDasharray="0 11.5" strokeLinecap="round" />
      {/* Flame-leaves with a dot in each. */}
      {ringOf(12, (i, a) => (
        <g key={`f${i}`} transform={`rotate(${a} 150 150)`}>
          <path d="M150 88 C138 78 136 64 150 48 C164 64 162 78 150 88Z" {...line} strokeWidth="3" />
          <path d="M150 82 C145.5 75 145.5 66 150 58" {...line} strokeWidth="1.8" />
          <circle cx="150" cy="70" r="2.6" fill={dot} />
        </g>
      ))}
      {ringOf(12, (i, a) => (
        <g key={`s${i}`} transform={`rotate(${a} 150 150)`}>
          <path d="M150 90 C150 80 156 74 161.5 77 C166 80 163 86 158.5 84.5" {...line} strokeWidth="2.2" />
          <circle cx="150" cy="56" r="2.2" fill={c} />
        </g>
      ), 15)}
      <circle cx="150" cy="150" r="108" {...line} strokeWidth="1.6" />
      <circle cx="150" cy="150" r="50" {...line} strokeWidth="2.6" />
      <circle cx="150" cy="150" r="56" fill="none" stroke={c} strokeWidth="3.6" strokeDasharray="0 8.8" strokeLinecap="round" />
      {/* The lotus at the heart. */}
      {ringOf(8, (i, a) => (
        <g key={`l${i}`} transform={`rotate(${a} 150 150)`}>
          <path d="M150 140 C140 128 140 114 150 104 C160 114 160 128 150 140Z" {...line} strokeWidth="2.8" />
          <path d="M150 132 C147 126 147 118 150 112" {...line} strokeWidth="1.6" />
        </g>
      ))}
      <circle cx="150" cy="150" r="10" {...line} strokeWidth="2.8" />
      <circle cx="150" cy="150" r="4" fill={dot} />
    </svg>
  );
}

// ─────────────────────────── Marigold swag ───────────────────────────

/**
 * Marigold garlands swagged across the top of the layer, drawn to its size:
 * swags hung from brass rosettes with mango leaves, and a strand of marigolds
 * with a bell falling from every rosette. Real flowers and leaves keep their
 * colours; the tint is the brass.
 */
export function MarigoldSwag({ color, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const W = Math.max(80, w);
  const H = Math.max(40, h);
  const u = Math.min(1.6, Math.max(0.5, H / 120));
  const swags = Math.max(1, Math.round(W / (190 * u)));
  const span = W / swags;
  const sag = Math.min(H * 0.48, span * 0.28);
  const r = 7.2 * u;
  const blooms: ReactNode[] = [];
  for (let s = 0; s < swags; s++) {
    const x0 = s * span;
    const count = Math.max(6, Math.round(span / (r * 1.55)));
    for (let k = 1; k < count; k++) {
      const t2 = k / count;
      blooms.push(<Marigold key={`m${s}-${k}`} x={r2(x0 + t2 * span)} y={r2(10 * u + 4 * sag * t2 * (1 - t2))} r={r2(r)} tone={(s + k) % 3} />);
    }
  }
  const strand = Math.max(2, Math.floor((H - 16 * u - 24 * u) / (r * 1.6)));
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil} x2={W} y2={H} />
      </defs>
      {Array.from({ length: swags + 1 }, (_, s) => {
        const x = s * span;
        return (
          <g key={`h${s}`}>
            <path d={`M${r2(x)} ${r2(12 * u)} V${r2(12 * u + strand * r * 1.6)}`} stroke={NATURE.clayDark} strokeWidth={r2(0.8 * u)} />
            {Array.from({ length: strand }, (_, k) => (
              <Marigold key={k} x={r2(x)} y={r2(16 * u + k * r * 1.6)} r={r2(r * (1 - k * 0.05))} tone={(s + k + 1) % 3} />
            ))}
            <g transform={`translate(${r2(x)} ${r2(12 * u + strand * r * 1.6)}) scale(${r2(u)})`}>
              <path d="M-4 0 C-5 6 -9 10 -11 14 H11 C9 10 5 6 4 0Z" fill={metal} />
              <rect x="-12" y="13" width="24" height="3" rx="1.5" fill={metal} />
              <circle cy="18.5" r="2.4" fill={shade(c, 0.4)} />
            </g>
            <MangoLeaf x={r2(x)} y={r2(8 * u)} size={r2(0.62 * u)} angle={-38} />
            <MangoLeaf x={r2(x)} y={r2(8 * u)} size={r2(0.62 * u)} angle={38} />
          </g>
        );
      })}
      {blooms}
      {Array.from({ length: swags + 1 }, (_, s) => (
        <g key={`r${s}`} transform={`translate(${r2(s * span)} ${r2(8 * u)}) scale(${r2(u)})`}>
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-4.6" rx="2.2" ry="4.4" fill={metal} transform={`rotate(${i * 45})`} />
          ))}
          <circle r="3" fill={metal} />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────── Lal paar ───────────────────────────

/**
 * The red border of a Bengali bride's white saree (lal paar), drawn to the
 * layer's size: a band in the tint with gold rules and an alpana edging of
 * curls and dots in the palette's background along its inner edge. Lay it
 * along the top; flip it for the foot.
 */
export function LaalPaar({ color, colors, w, h, className, style }: IllustrationProps) {
  const c = hex(color);
  const gold = hex(colors.secondary);
  const paste = hex(colors.background);
  const W = Math.max(40, w);
  const H = Math.max(16, h);
  const u = H / 56;
  const band = H - 16 * u;
  const n = Math.max(3, Math.round(W / (26 * u)));
  const step = W / n;
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <rect x="0" y="0" width={r2(W)} height={r2(band)} fill={c} />
      <rect x="0" y={r2(band - 9 * u)} width={r2(W)} height={r2(1.6 * u)} fill={gold} />
      <rect x="0" y={r2(band - 5 * u)} width={r2(W)} height={r2(0.8 * u)} fill={gold} />
      <path d={`M0 ${r2(6 * u)} H${r2(W)}`} stroke={paste} strokeWidth={r2(0.9 * u)} strokeDasharray={`${r2(1.4 * u)} ${r2(3 * u)}`} strokeLinecap="round" />
      {Array.from({ length: n }, (_, i) => {
        const x = (i + 0.5) * step;
        return (
          <g key={i} transform={`translate(${r2(x)} ${r2(band)}) scale(${r2(u)})`}>
            <path d="M-13 0 C-13 7 -6 11 0 11 C6 11 13 7 13 0" fill={c} />
            <path d="M-9 2 C-8 7 -3 9 0 9 C3 9 8 7 9 2" fill="none" stroke={paste} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M0 9 C-2 12 -1 15 1.5 15" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="0" cy="4.5" r="1.7" fill={paste} />
            <circle cx="-13" cy="1" r="1.3" fill={gold} />
          </g>
        );
      })}
      {Array.from({ length: n * 2 }, (_, i) => (
        <circle key={`d${i}`} cx={r2((i + 0.5) * (step / 2))} cy={r2(band - 14 * u)} r={r2(1.3 * u)} fill={paste} opacity="0.85" />
      ))}
    </svg>
  );
}

// ─────────────────────────── Marigold wreath ───────────────────────────

/**
 * A round wreath of marigolds (genda phool) for a haldi or mehendi: a ring of
 * flowers in three tones with mango leaves fanning out between them and
 * jasmine buds tucked inside, clear in the middle for a photo or a monogram.
 * Real flowers and leaves keep their colours; the tint is the jasmine.
 */
export function MarigoldWreath({ color, className, style }: IllustrationProps) {
  const bud = hex(color);
  const ring = (n: number, render: (i: number, a: number) => ReactNode, offset = 0) => Array.from({ length: n }, (_, i) => render(i, r2((360 / n) * i + offset)));
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      {ring(14, (i, a) => (
        <g key={`l${i}`} transform={`rotate(${a} 150 150)`}>
          <MangoLeaf x={150} y={30} size={0.72} angle={164} />
          <MangoLeaf x={150} y={30} size={0.72} angle={196} />
        </g>
      ), 6.43)}
      {ring(28, (i, a) => (
        <g key={`m${i}`} transform={`rotate(${a} 150 150)`}>
          <Marigold x={150} y={34} r={15} tone={i % 3} />
        </g>
      ))}
      {ring(28, (i, a) => (
        <g key={`n${i}`} transform={`rotate(${a} 150 150)`}>
          <Marigold x={150} y={58} r={10.5} tone={(i + 1) % 3} />
        </g>
      ), 6.43)}
      {ring(14, (i, a) => (
        <g key={`j${i}`} transform={`rotate(${a} 150 150)`}>
          <circle cx="150" cy="73" r="3.4" fill={bud} stroke={shade(bud, 0.2)} strokeWidth="0.6" />
          <circle cx="145" cy="76" r="2.4" fill={bud} stroke={shade(bud, 0.2)} strokeWidth="0.5" />
          <circle cx="155" cy="76" r="2.4" fill={bud} stroke={shade(bud, 0.2)} strokeWidth="0.5" />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────── Ghungroo ───────────────────────────

/**
 * A string of ghungroo, the dancer's ankle bells, hanging down the layer: brass
 * bells on a red cord in threes, a knot of tassels at the foot. Drawn to the
 * layer's height (a strand for a sangeet's sides).
 */
export function Ghungroo({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const cord = hex(colors.accent);
  const W = Math.max(10, w);
  const H = Math.max(40, h);
  const u = W / 24;
  const cx = W / 2;
  const r = 4.4 * u;
  const foot = 26 * u;
  const n = Math.max(3, Math.floor((H - foot - 6 * u) / (r * 2.25)));
  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={W} y2={H} />
        <radialGradient id={`${id}b`} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor={tint(c, 0.7)} />
          <stop offset="0.55" stopColor={c} />
          <stop offset="1" stopColor={shade(c, 0.4)} />
        </radialGradient>
      </defs>
      <path d={`M${r2(cx)} 0 V${r2(H - foot + 4 * u)}`} stroke={cord} strokeWidth={r2(1.4 * u)} />
      {Array.from({ length: n }, (_, i) => {
        const y = 6 * u + r + i * r * 2.25;
        const side = i % 3 === 1 ? 0 : i % 3 === 0 ? -1 : 1;
        const x = cx + side * r * 0.9;
        return (
          <g key={i}>
            <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={`url(#${id}b)`} stroke={shade(c, 0.45)} strokeWidth={r2(0.4 * u)} />
            <path d={`M${r2(x - r * 0.62)} ${r2(y + r * 0.2)} Q${r2(x)} ${r2(y + r * 0.62)} ${r2(x + r * 0.62)} ${r2(y + r * 0.2)}`} fill="none" stroke={shade(c, 0.6)} strokeWidth={r2(0.9 * u)} strokeLinecap="round" />
            <circle cx={r2(x - r * 0.35)} cy={r2(y - r * 0.38)} r={r2(r * 0.22)} fill={tint(c, 0.85)} opacity="0.85" />
          </g>
        );
      })}
      <g transform={`translate(${r2(cx)} ${r2(H - foot)}) scale(${r2(u)})`}>
        <circle cy="2" r="3.2" fill={metal} />
        <path d="M-5 6 C-6 12 -5 18 -6 24 M0 6 V25 M5 6 C6 12 5 18 6 24 M-2.5 6 C-3 13 -2.5 18 -3 24 M2.5 6 C3 13 2.5 18 3 24" stroke={cord} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <rect x="-6" y="4.5" width="12" height="3" rx="1.5" fill={metal} />
      </g>
    </svg>
  );
}
