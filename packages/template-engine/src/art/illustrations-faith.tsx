import type { ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { frameAt, hex, Metal, NATURE, onCubic, shade, taper, tint, useSafeId, type IllustrationProps, type Segment } from './kit';
import { r2 } from './motifs';

/**
 * Faith emblems for the very top of an invitation (docs/templates.md#faith):
 * Lord Ganesha for Hindu families, the crescent and star for Muslim families,
 * the Khanda for Sikh families and the cross with olive branches for Christian
 * families. Each is drawn like a foil stamp: one metal (the tint), engraved
 * lines in a darker shade of it and a soft sheen, so it sits on light or dark
 * stock and reads at a few millimetres. Drawn upright and whole: never crop,
 * flip, tilt or spin them, and never set them behind text or at the foot.
 */

const MIRROR = (width: number) => `matrix(-1 0 0 1 ${width} 0)`;

/** Foil gold, for a palette that has no metal of its own. */
const FOIL_GOLD = '#c9a24a';

/** Is this colour a metal: gold, bronze, copper (a warm hue, some saturation) or silver (nearly grey)? */
function isMetal(color: string): boolean {
  const n = Number.parseInt(hex(color).slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return l >= 0.45 && l <= 0.85;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = 60 * (max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return (h >= 18 && h <= 60 && s >= 0.2 && l >= 0.35 && l <= 0.85) || (s < 0.14 && l >= 0.45 && l <= 0.85);
}

/**
 * The metal an emblem is stamped in: the design's usual metal (the accent on
 * dark stock, the secondary on light) when it is gold, bronze or silver, else
 * the other one, else foil gold. An emblem is never printed in a leaf green.
 */
export function emblemMetal(colors: ThemeColors, dark: boolean): string {
  const order = dark ? [colors.accent, colors.secondary] : [colors.secondary, colors.accent];
  return hex(order.find(isMetal) ?? FOIL_GOLD);
}

// ─────────────────────────── Ganesha ───────────────────────────

/** The trunk's centre line: down from between the eyes, curling to the viewer's right (Vamamukhi). */
const TRUNK: Segment[] = [
  [
    [100, 108],
    [100, 124],
    [100, 144],
    [98, 162],
  ],
  [
    [98, 162],
    [96, 178],
    [100, 194],
    [114, 199],
  ],
  [
    [114, 199],
    [126, 203],
    [134, 194],
    [130, 185],
  ],
  [
    [130, 185],
    [127, 179],
    [120, 181],
    [121, 187],
  ],
];
const TRUNK_WIDTHS = [30, 23, 15, 9, 5];

/** The left ear: a fan with a scalloped rim; its inner edge tucks under the head. */
const EAR =
  'M63 86 Q52 72 40 79 Q26 77 20 91 Q8 98 12 112 Q4 123 14 134 Q11 150 26 152 Q31 168 44 164 Q54 170 58 160 L64 142 C60 122 59 102 63 86Z';

/**
 * Lord Ganesha: the crowned head with the great fanned ears, serene eyes, a
 * tilak and the trunk curling to his left, one tusk whole and one broken
 * (Ekadanta). Line and foil, in the tint's metal.
 */
export function Ganesha({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const light = tint(c, 0.6);
  const jewel = hex(colors.accent);
  // Folds across the trunk, each drawn across the curve at its point (no trigonometry).
  const folds: ReactNode[] = [];
  const along: Array<[number, number, number]> = [
    [0, 0.42, 12],
    [0, 0.6, 11.2],
    [0, 0.78, 10.4],
    [0, 0.95, 9.6],
    [1, 0.2, 9],
    [1, 0.42, 8.2],
  ];
  along.forEach(([s, t, half], i) => {
    folds.push(<path key={i} d={`M${-half} 0 Q0 -3.2 ${half} 0`} transform={frameAt(onCubic(TRUNK[s]!, t))} fill="none" stroke={line} strokeWidth="0.9" strokeLinecap="round" />);
  });
  const ear = (
    <g>
      <path d={EAR} fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M60 94 C46 86 30 90 23 104 C17 118 20 136 30 148 C38 156 48 158 56 154" fill="none" stroke={line} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M58 104 C47 100 37 105 33 115 C29 126 33 138 42 145" fill="none" stroke={line} strokeWidth="0.75" strokeLinecap="round" />
      <path d="M36 84 C28 86 22 92 20 100" fill="none" stroke={light} strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
    </g>
  );
  const eye = (
    <g>
      <path d="M69 98 Q78 92.5 88 96.5" fill="none" stroke={line} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M71 108 Q79 101.5 87 107" fill="none" stroke={line} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M72.5 109 Q79 112.5 85.5 108.6" fill="none" stroke={line} strokeWidth="0.75" strokeLinecap="round" />
      <circle cx="79.6" cy="107.6" r="2.5" fill={line} />
    </g>
  );
  // Pearls along the diadem, on its curve (arithmetic only).
  const pearls: ReactNode[] = [];
  for (let x = 68; x <= 132; x += 6.4) {
    const u = (x - 100) / 37;
    pearls.push(<circle key={x} cx={r2(x)} cy={r2(77 + 6 * (1 - u * u))} r="1.35" fill={light} />);
  }
  // The mukut's tiers, base to top: each a band crowned with a row of lotus petals.
  const tiers: Array<{ x0: number; x1: number; top: number; bottom: number; petals: number; lean: number }> = [
    { x0: 72, x1: 128, top: 59, bottom: 75, petals: 5, lean: 4.5 },
    { x0: 79.5, x1: 120.5, top: 46, bottom: 59, petals: 4, lean: 3.5 },
    { x0: 86, x1: 114, top: 34, bottom: 46, petals: 3, lean: 2.8 },
  ];
  const crown = tiers.map((t, i) => {
    const w = (t.x1 - t.x0 - 2 * t.lean) / t.petals;
    const left = t.x0 + t.lean;
    const petals = Array.from({ length: t.petals }, (_, k) => {
      const a = r2(left + k * w);
      const m = r2(a + w / 2);
      const b = r2(a + w);
      const peak = t.top - w * 0.78;
      return `M${a} ${t.top} C${r2(a + w * 0.12)} ${r2(t.top - w * 0.42)} ${r2(m - w * 0.2)} ${r2(peak + w * 0.18)} ${m} ${r2(peak)} C${r2(m + w * 0.2)} ${r2(peak + w * 0.18)} ${r2(b - w * 0.12)} ${r2(t.top - w * 0.42)} ${b} ${t.top}Z`;
    }).join(' ');
    return (
      <g key={i}>
        <path d={petals} fill={metal} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
        <path d={`M${t.x0} ${t.bottom} L${left} ${t.top} H${r2(t.x1 - t.lean)} L${t.x1} ${t.bottom}Z`} fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
        <path d={`M${r2(t.x0 + 2.5)} ${r2(t.top + 3)} H${r2(t.x1 - 2.5)}`} stroke={line} strokeWidth="0.6" opacity="0.85" />
      </g>
    );
  });
  return (
    <svg viewBox="0 0 200 212" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={200} y2={212} />
      </defs>
      {/* The ears, behind the head. */}
      {ear}
      <g transform={MIRROR(200)}>{ear}</g>
      {/* The head, its cheeks folding into the trunk. */}
      <path d="M64 84 C58 98 57 116 63 131 C69 144 81 151 92 153 L108 153 C119 151 131 144 137 131 C143 116 142 98 136 84 C122 90 78 90 64 84Z" fill={metal} stroke={line} strokeWidth="1" />
      <path d="M77 127 C81 137 87 143 93 146" fill="none" stroke={line} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M123 127 C119 137 113 143 107 146" fill="none" stroke={line} strokeWidth="0.8" strokeLinecap="round" />
      {/* The whole tusk to the viewer's right, the broken one to the left. */}
      <path d="M113 139 C121 142 127 150 129 161 C123 157 117 151 110 147Z" fill={NATURE.ivory} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M87 140 C82 142 79.5 145.5 79.5 149.5 C83.5 148.5 87 146.8 90 144.5Z" fill={NATURE.ivory} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      {/* The trunk and its folds. */}
      <path d={taper(TRUNK, TRUNK_WIDTHS)} fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      {/* The trunk grows out of the brow: cover the outline across its root. */}
      <rect x="84.4" y="103" width="31.2" height="8.5" fill={metal} />
      <path d="M95 116 C94.5 132 94.5 148 92.5 164" fill="none" stroke={light} strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
      {folds}
      {/* Eyes, brows and the tilak. */}
      {eye}
      <g transform={MIRROR(200)}>{eye}</g>
      <path d="M100 90.5 C103 95.5 103 101 100 106 C97 101 97 95.5 100 90.5Z" fill={line} />
      {/* The mukut: a lotus-bud finial, then three tiers of petals, the lower ones in front, jewels down the middle. */}
      <path d="M100 5 C105.5 10 106.5 17 100 24 C93.5 17 94.5 10 100 5Z" fill={metal} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M100 9 C101.7 13 101.7 17 100 20.5" fill="none" stroke={light} strokeWidth="0.8" />
      <path d="M94 27.5 C96 24 104 24 106 27.5" fill={metal} stroke={line} strokeWidth="0.8" />
      {[...crown].reverse()}
      <circle cx="100" cy="39.5" r="2.2" fill={jewel} stroke={line} strokeWidth="0.6" />
      <circle cx="100" cy="52" r="2.7" fill={jewel} stroke={line} strokeWidth="0.6" />
      <circle cx="100" cy="66" r="3.4" fill={jewel} stroke={line} strokeWidth="0.6" />
      <circle cx="86" cy="67" r="1.5" fill={light} />
      <circle cx="114" cy="67" r="1.5" fill={light} />
      <path d="M83 48 L80.5 58 M75 61 L73 71" stroke={light} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
      {/* The diadem across the brow, set with pearls, with a jewel hanging at each temple. */}
      <path d="M64 72.5 C81 79 119 79 136 72.5 L137.5 81.5 C120 88.5 80 88.5 62.5 81.5Z" fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      {pearls}
      <path d="M63.5 82 C61 86 61 90.5 63.5 94 C66 90.5 66 86 63.5 82Z" fill={metal} stroke={line} strokeWidth="0.7" />
      <path d="M136.5 82 C134 86 134 90.5 136.5 94 C139 90.5 139 86 136.5 82Z" fill={metal} stroke={line} strokeWidth="0.7" />
    </svg>
  );
}

// ─────────────────────────── Crescent and star ───────────────────────────

/** Unit vectors every 36° from straight up (a five-pointed star's points and notches), so no trigonometry runs. */
const STAR5: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0.5878, -0.809],
  [0.9511, -0.309],
  [0.9511, 0.309],
  [0.5878, 0.809],
  [0, 1],
  [-0.5878, 0.809],
  [-0.9511, 0.309],
  [-0.9511, -0.309],
  [-0.5878, -0.809],
];

/** A five-pointed star around (cx, cy): points at radius `outer`, notches at `inner`. */
export function star5(cx: number, cy: number, outer: number, inner = outer * 0.4): string {
  return `M${STAR5.map(([x, y], i) => `${r2(cx + x * (i % 2 ? inner : outer))} ${r2(cy + y * (i % 2 ? inner : outer))}`).join(' L')}Z`;
}

/**
 * The crescent and star: a slender crescent opening to the upper right with a
 * five-pointed star in its embrace, an engraved line along its inner curve.
 */
export function CrescentStar({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const light = tint(c, 0.6);
  // Outer circle (78, 84) r 72, cut by (94, 72) r 64; the horns are where they meet.
  return (
    <svg viewBox="0 4 156 156" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={156} y2={160} />
      </defs>
      <path d="M70.77 12.36 A72 72 0 1 0 144.75 111 A64 64 0 1 1 70.77 12.36Z" fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M62.2 19.0 A66 66 0 1 0 136.4 116.6" fill="none" stroke={line} strokeWidth="0.8" strokeLinecap="round" opacity="0.85" />
      <path d="M38 48 C30 62 27 80 31 98" fill="none" stroke={light} strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
      <path d={star5(116, 54, 19)} fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      <path d={star5(116, 54, 9.5)} fill="none" stroke={light} strokeWidth="0.7" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// ─────────────────────────── Khanda ───────────────────────────

/** The left kirpan's blade: from its guard right of centre, across the foot, up around the chakkar to the tip. */
const KIRPAN: Segment[] = [
  [
    [110, 190],
    [100, 182],
    [78, 172],
    [58, 160],
  ],
  [
    [58, 160],
    [40, 148],
    [30, 124],
    [32, 100],
  ],
  [
    [32, 100],
    [34, 80],
    [42, 64],
    [38, 48],
  ],
];

/**
 * The Khanda: the double-edged khanda upright through the chakkar, flanked by
 * two kirpans whose hilts cross below it.
 */
export function Khanda({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const light = tint(c, 0.6);
  const kirpan = (
    <g>
      <path d={taper(KIRPAN, [12, 15, 12, 2])} fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M99 182 C86 175 70 169 57 159 C43 148 35 128 36 104 C37 88 41 74 40 60" fill="none" stroke={light} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      {/* The grip runs on from the blade, down and out; a guard across it and a pommel at its end. */}
      <path d="M112 192 L125 206" stroke={line} strokeWidth="8.6" strokeLinecap="round" />
      <path d="M112 192 L125 206" stroke={metal} strokeWidth="6.8" strokeLinecap="round" />
      <path d="M115.5 199.4 L117.8 197.2 M119.4 203.4 L121.6 201.2" stroke={line} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M103.4 197.6 L117 183.2" stroke={line} strokeWidth="6.2" strokeLinecap="round" />
      <path d="M103.4 197.6 L117 183.2" stroke={metal} strokeWidth="4.4" strokeLinecap="round" />
      <circle cx="127.6" cy="208.6" r="4.4" fill={metal} stroke={line} strokeWidth="0.8" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 216" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={200} y2={216} />
      </defs>
      {kirpan}
      <g transform={MIRROR(200)}>{kirpan}</g>
      {/* The chakkar. */}
      <circle cx="100" cy="112" r="41.5" fill="none" stroke={metal} strokeWidth="11" />
      <circle cx="100" cy="112" r="47" fill="none" stroke={line} strokeWidth="0.9" />
      <circle cx="100" cy="112" r="36" fill="none" stroke={line} strokeWidth="0.9" />
      <circle cx="100" cy="112" r="41.5" fill="none" stroke={light} strokeWidth="0.8" strokeDasharray="0 5.4" strokeLinecap="round" opacity="0.9" />
      {/* The khanda: a broad blade with its ridge, the guard, the grip and the pommel. */}
      <path d="M100 6 C92 12 85 22 84 32 C84 40 86 52 88 70 L91 146 H109 L112 70 C114 52 116 40 116 32 C115 22 108 12 100 6Z" fill={metal} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M100 13 V141" stroke={line} strokeWidth="1" />
      <path d="M95.5 30 C94.5 50 95 90 95.6 140" fill="none" stroke={light} strokeWidth="0.9" opacity="0.85" />
      <path d="M78 146 H122 A5 5 0 0 1 122 156 H78 A5 5 0 0 1 78 146Z" fill={metal} stroke={line} strokeWidth="0.9" />
      <circle cx="71.5" cy="151" r="3.6" fill={metal} stroke={line} strokeWidth="0.8" />
      <circle cx="128.5" cy="151" r="3.6" fill={metal} stroke={line} strokeWidth="0.8" />
      <rect x="94.5" y="156" width="11" height="27" rx="2" fill={metal} stroke={line} strokeWidth="0.9" />
      <path d="M94.5 165 H105.5 M94.5 174 H105.5" stroke={line} strokeWidth="0.8" />
      <circle cx="100" cy="189" r="6" fill={metal} stroke={line} strokeWidth="0.9" />
      <circle cx="100" cy="197.5" r="2.8" fill={metal} stroke={line} strokeWidth="0.8" />
    </svg>
  );
}

// ─────────────────────────── Cross ───────────────────────────

/** An olive branch from the foot of the cross up its left side; leaves alternate along it. */
const OLIVE: Segment = [
  [76, 188],
  [64, 184],
  [50, 172],
  [41, 152],
];

/** Where the trefoil buds of a budded cross sit: the end of each arm, then its two side buds. */
const BUDS: ReadonlyArray<readonly [number, number, number]> = [
  [80, 17, 7.5],
  [71.5, 23.5, 5.4],
  [88.5, 23.5, 5.4],
  [33, 62, 7.5],
  [39.5, 53.5, 5.4],
  [39.5, 70.5, 5.4],
  [127, 62, 7.5],
  [120.5, 53.5, 5.4],
  [120.5, 70.5, 5.4],
  [80, 171, 7.5],
  [71.5, 164.5, 5.4],
  [88.5, 164.5, 5.4],
];

/**
 * The cross: a slender budded cross with a glory behind its crossing, rising
 * from two olive branches. Line and foil, in the tint's metal.
 */
export function Cross({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const line = shade(c, 0.5);
  const light = tint(c, 0.6);
  const leaves: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.2 + i * 0.16;
    const side = i % 2 ? 1 : -1;
    const length = 12.5 - i * 0.7;
    const width = length * 0.38;
    leaves.push(
      <path
        key={i}
        d={`M0 0 C${r2(side * width)} ${r2(-length * 0.25)} ${r2(side * width)} ${r2(-length * 0.72)} 0 ${r2(-length)} C${r2(-side * width * 0.55)} ${r2(-length * 0.72)} ${r2(-side * width * 0.55)} ${r2(-length * 0.25)} 0 0Z`}
        transform={`${frameAt(onCubic(OLIVE, Math.min(t, 0.96)))} rotate(${side * 38} 0 0)`}
        fill={metal}
        stroke={line}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />,
    );
  }
  leaves.push(<path key="tip" d="M0 0 C4 -3.5 4 -9.5 0 -13 C-4 -9.5 -4 -3.5 0 0Z" transform={frameAt(onCubic(OLIVE, 1))} fill={metal} stroke={line} strokeWidth="0.7" strokeLinejoin="round" />);
  const branch = (
    <g>
      <path d={taper([OLIVE], [2.6, 1])} fill={metal} stroke={line} strokeWidth="0.5" />
      {leaves}
    </g>
  );
  return (
    <svg viewBox="0 0 160 200" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={c} foil={foil ?? true} x2={160} y2={200} />
      </defs>
      {/* The glory: a fine ring and rays behind the crossing. */}
      <circle cx="80" cy="62" r="23" fill="none" stroke={line} strokeWidth="0.8" opacity="0.9" />
      {Array.from({ length: 16 }, (_, k) => (
        <path key={k} d="M80 33 V27" stroke={metal} strokeWidth={k % 2 ? 1 : 1.6} strokeLinecap="round" transform={`rotate(${r2(k * 22.5)} 80 62)`} />
      ))}
      {branch}
      <g transform={MIRROR(160)}>{branch}</g>
      {/* The cross: the arms, their trefoil buds and an engraved line down each arm. */}
      <path d="M74.5 22 H85.5 V56.5 H122 V67.5 H85.5 V168 H74.5 V67.5 H38 V56.5 H74.5Z" fill={metal} stroke={line} strokeWidth="0.9" strokeLinejoin="round" />
      {BUDS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={metal} stroke={line} strokeWidth="0.9" />
      ))}
      <path d="M74.5 22 H85.5 V56.5 H122 V67.5 H85.5 V168 H74.5 V67.5 H38 V56.5 H74.5Z" fill={metal} />
      <path d="M80 26 V158 M44 62 H116" stroke={line} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M77.3 30 V54" stroke={light} strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
