import type { ReactNode } from 'react';
import { blend, frameAt, hex, Lit, Metal, NATURE, onCubic, shade, taper, tint, useSafeId, type IllustrationProps, type Pt, type Segment } from './kit';
import { r2, rand } from './motifs';

/**
 * Figures and flowers: the royal elephant, the peacock, roses, garlands,
 * jasmine, banana leaves, a mehendi hand and doves. The tint is the main colour
 * (the elephant's body, the peacock's train, the roses' leaves…); the palette
 * colours the rest, and real flowers keep their own colours.
 */

const ring = (n: number, render: (i: number, angle: number) => ReactNode) => Array.from({ length: n }, (_, i) => render(i, r2((360 / n) * i)));

// ─────────────────────────── Royal elephant ───────────────────────────

/**
 * A caparisoned elephant facing right, trunk curled up in welcome: a jhool
 * cloth in the primary colour with a metal border, pearls and tassels, a
 * forehead plate, anklets and a painted trunk. The body is the tint (ivory,
 * gold, grey…).
 */
export function Elephant({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const far = shade(c, 0.2);
  const line = shade(c, 0.4);
  const cloth = hex(colors.primary);
  const acc = hex(colors.accent);
  const metal = `url(#${id}m)`;
  const body = `url(#${id}b)`;
  const leg = (d: string, fill: string) => <path d={d} fill={fill} stroke={line} strokeWidth="0.9" />;
  const jhool = 'M96 62 C126 51 176 49 218 59 C222 95 222 131 218 163 L206 153 L194 167 L182 153 L170 167 L158 153 L146 167 L134 153 L122 167 L110 153 L100 165 C94 129 93 93 96 62Z';
  const trunk = taper(
    [
      [[292, 122], [304, 140], [314, 160], [318, 176]],
      [[318, 176], [322, 192], [338, 188], [340, 166]],
      [[340, 166], [342, 138], [340, 110], [334, 92]],
      [[334, 92], [330, 80], [319, 78], [320, 89]],
    ],
    [30, 23, 17, 12, 8],
  );
  const tail = taper([[[60, 126], [48, 146], [43, 168], [45, 192]]], [6, 3]);
  return (
    <svg viewBox="0 0 350 280" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={350} y2={280} />
        <Lit id={`${id}b`} base={c} light={0.22} dark={0.18} cx="45%" cy="25%" />
        <Lit id={`${id}c`} base={cloth} light={0.15} dark={0.25} cx="40%" cy="30%" />
      </defs>
      <path d={tail} fill={line} />
      <path d="M43 189 l-4 15 M45 190 l0 16 M47 189 l4 15" stroke={line} strokeWidth="2" strokeLinecap="round" />
      {/* Far legs. */}
      {leg('M104 172 C104 206 106 238 104 264 C114 270 132 270 142 264 C140 238 140 206 142 176Z', far)}
      {leg('M182 178 C182 210 184 240 182 264 C192 270 210 270 220 264 C218 240 218 210 220 182Z', far)}
      {/* The trunk and the near legs go under the head and body, so they grow out of them. */}
      <path d={trunk} fill={body} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      {leg('M70 150 C70 206 72 238 70 266 C82 272 104 272 116 266 C114 238 114 206 116 150Z', body)}
      {leg('M206 150 C206 210 208 238 206 266 C218 272 240 272 252 266 C250 238 250 210 252 150Z', body)}
      {/* Body and head. */}
      <path
        d="M58 124 C58 84 96 56 148 52 C188 48 216 56 236 66 C246 50 272 44 292 58 C304 66 310 84 306 102 C304 116 298 126 292 132 L288 150 C278 160 266 166 254 170 C246 184 234 194 220 198 L118 204 C92 204 70 196 62 180 C56 166 56 146 58 124Z"
        fill={body}
        stroke={line}
        strokeWidth="1"
      />
      <path d="M76 84 C104 64 150 58 204 64" fill="none" stroke={tint(c, 0.5)} strokeWidth="6" strokeLinecap="round" opacity="0.45" />
      <path d="M264 50 C276 46 288 50 296 58" fill="none" stroke={tint(c, 0.5)} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* Anklets and toenails. */}
      {[
        [70, 116],
        [206, 252],
      ].map(([a, b]) => (
        <g key={a}>
          <path d={`M${a! + 2} 242 H${b! - 2}`} stroke={metal} strokeWidth="7" strokeLinecap="round" />
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} cx={r2(a! + 6 + i * ((b! - a! - 12) / 5))} cy="250" r="2.3" fill={metal} />
          ))}
          {[0.22, 0.5, 0.78].map((t) => (
            <ellipse key={t} cx={r2(a! + (b! - a!) * t)} cy="266" rx="5" ry="2.6" fill={tint(c, 0.55)} />
          ))}
        </g>
      ))}
      {/* Ear, painted along its edge. */}
      <path d="M236 74 C218 74 204 92 202 118 C200 144 210 166 230 172 C244 176 254 168 256 154 C258 134 254 110 250 92 C248 80 242 74 236 74Z" fill={shade(c, 0.07)} stroke={line} strokeWidth="1" />
      <path d="M234 84 C220 86 210 100 209 118 C208 138 216 154 230 162" fill="none" stroke={acc} strokeWidth="2.8" strokeDasharray="0 6.5" strokeLinecap="round" />
      {/* Painted rosettes and wrinkles on the trunk. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${299 + i * 3.4} ${134 + i * 13} q8 ${2 + i} 13 ${7 + i}`} fill="none" stroke={line} strokeWidth="0.8" opacity="0.55" />
      ))}
      {[
        [304, 142],
        [311, 162],
        [316, 182],
      ].map(([x, y]) => (
        <g key={y} transform={`translate(${x} ${y})`}>
          {ring(5, (i, a) => (
            <circle key={i} cx="0" cy="-3.2" r="1.7" fill={acc} transform={`rotate(${a})`} />
          ))}
          <circle r="1.4" fill={metal} />
        </g>
      ))}
      {/* Tusk. */}
      <path d="M287 146 C300 156 314 160 328 155 C318 166 300 169 284 158Z" fill={NATURE.ivory} stroke={shade(NATURE.ivory, 0.25)} strokeWidth="0.8" />
      {/* Eye. */}
      <path d="M268 98 C272 94 280 94 284 98 C280 102 272 102 268 98Z" fill="#2a1a12" />
      <circle cx="278" cy="97" r="1.2" fill="#ffffff" />
      <path d="M266 91 C272 87 280 87 286 91" fill="none" stroke={line} strokeWidth="1" />
      {/* Forehead plate with a jewel and pearl drops. */}
      <path d="M262 54 C276 50 292 58 300 72 C292 82 280 88 268 90 C264 78 262 66 262 54Z" fill={metal} stroke={shade(colors.secondary, 0.4)} strokeWidth="0.6" />
      <circle cx="279" cy="70" r="5" fill={acc} stroke={metal} strokeWidth="1.4" />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={r2(268 + i * 6)} cy={r2(92 - i * 3.6)} r="1.9" fill={NATURE.pearl} />
      ))}
      {/* The jhool: cloth, a metal border with pearls, a medallion, rosettes and tassels. */}
      <path d={jhool} fill={`url(#${id}c)`} />
      <path d={jhool} fill="none" stroke={metal} strokeWidth="5.5" strokeLinejoin="round" />
      <path d={jhool} fill="none" stroke={NATURE.pearl} strokeWidth="1.9" strokeDasharray="0 6" strokeLinecap="round" transform="translate(157 108) scale(0.88) translate(-157 -108)" />
      <g transform="translate(157 106)">
        <circle r="21" fill={tint(cloth, 0.2)} stroke={metal} strokeWidth="2.2" />
        {ring(8, (i, a) => (
          <path key={i} d="M0 -18 C5 -12 5 -7 0 -3 C-5 -7 -5 -12 0 -18Z" fill={metal} transform={`rotate(${a})`} />
        ))}
        <circle r="4.2" fill={acc} />
      </g>
      {[114, 200].map((x) => (
        <g key={x} transform={`translate(${x} 82)`}>
          {ring(6, (i, a) => (
            <ellipse key={i} cx="0" cy="-5" rx="2.3" ry="4.6" fill={acc} transform={`rotate(${a})`} />
          ))}
          <circle r="2.1" fill={metal} />
        </g>
      ))}
      {[
        [100, 165],
        [122, 167],
        [146, 167],
        [170, 167],
        [194, 167],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 0 V6" stroke={metal} strokeWidth="1.5" />
          <path d="M-3.6 6 H3.6 L2 17 C1 19 -1 19 -2 17Z" fill={acc} />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────── Royal peacock ───────────────────────────

const PEACOCK_TAIL: Pt = [182, 178];

/** The train by tier, back to front: where each feather's eye hangs, and the eyes' size. */
const PEACOCK_TRAIN: Array<{ scale: number; ends: Pt[] }> = [
  {
    scale: 1,
    ends: [
      [296, 286],
      [294, 320],
      [282, 348],
      [264, 366],
      [242, 376],
      [218, 374],
      [196, 364],
    ],
  },
  {
    scale: 0.9,
    ends: [
      [288, 252],
      [284, 288],
      [270, 316],
      [250, 334],
      [228, 342],
      [206, 334],
    ],
  },
  {
    scale: 0.8,
    ends: [
      [268, 220],
      [262, 254],
      [248, 278],
      [228, 294],
      [208, 296],
    ],
  },
  {
    scale: 0.66,
    ends: [
      [240, 204],
      [232, 228],
      [218, 246],
      [200, 256],
    ],
  },
];

/** One feather's curve: out of the tail, then hanging down to its eye. */
function featherCurve(end: Pt): Segment {
  const [sx, sy] = PEACOCK_TAIL;
  const dx = end[0] - sx;
  const dy = end[1] - sy;
  return [PEACOCK_TAIL, [r2(sx + dx * 0.5), r2(sy + dy * 0.12)], [r2(end[0] - dx * 0.08), r2(end[1] - dy * 0.4)], end];
}

/** A feather's vane (widening toward the eye), its shaft and chevron barbs. */
function TrainFeather({ seg, scale, c, vane }: { seg: Segment; scale: number; c: string; vane: string }) {
  const wide = 20 * scale;
  const barbs = [0.5, 0.62, 0.74, 0.86]
    .map((t) => {
      const p = onCubic(seg, t);
      const half = (1.5 + (wide - 1.5) * t) / 2;
      const f = half * 0.55;
      return `M${r2(p.x - p.ty * half + p.tx * f)} ${r2(p.y + p.tx * half + p.ty * f)} L${r2(p.x)} ${r2(p.y)} L${r2(p.x + p.ty * half + p.tx * f)} ${r2(p.y - p.tx * half + p.ty * f)}`;
    })
    .join(' ');
  const [p0, c1, c2, p3] = seg;
  return (
    <g>
      <path d={taper([seg], [1.5, wide])} fill={vane} />
      <path d={`M${p0[0]} ${p0[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p3[0]} ${p3[1]}`} fill="none" stroke={shade(c, 0.35)} strokeWidth="0.8" opacity="0.85" />
      <path d={barbs} fill="none" stroke={tint(c, 0.25)} strokeWidth="0.6" opacity="0.75" />
    </g>
  );
}

/** An eye (ocellus): a fringe, a metal ring, the tint, bronze, a pale ring and a dark heart. */
function PeacockEye({ seg, scale, c, metal }: { seg: Segment; scale: number; c: string; metal: string }) {
  return (
    <g transform={`${frameAt(onCubic(seg, 1))} scale(${scale})`}>
      <ellipse cx="0" cy="-1" rx="15" ry="20" fill={tint(c, 0.3)} opacity="0.5" />
      <ellipse cx="0" cy="0" rx="12" ry="16.5" fill={metal} />
      <ellipse cx="0" cy="1.2" rx="10" ry="14" fill={c} />
      <ellipse cx="0" cy="2.6" rx="7.4" ry="10.2" fill="#9a5b2c" />
      <ellipse cx="0" cy="3.2" rx="6" ry="8.4" fill={tint(c, 0.4)} />
      <path d="M0 10.5 C-5 7.5 -5.4 1.5 -2.4 0.2 C-1.2 -0.3 0 0.4 0 1.6 C0 0.4 1.2 -0.3 2.4 0.2 C5.4 1.5 5 7.5 0 10.5Z" fill="#13235e" />
      <ellipse cx="-1.8" cy="3" rx="1.2" ry="1.9" fill="#ffffff" opacity="0.55" />
    </g>
  );
}

/**
 * A peacock on a branch, facing left, its train cascading down to the right in
 * tiers of feathers: translucent vanes with barbs, eyes with metal rings, a
 * scaled saddle, a blue body, a barred wing with chestnut flights, the white
 * face markings and a fanned crest. The tint colours the train.
 */
export function RoyalPeacock({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const vane = `url(#${id}v)`;
  const saddle = 'M148 150 C172 144 202 156 214 180 C224 202 212 224 190 226 C168 228 150 210 145 188 C142 172 142 158 148 150Z';
  const scales = [0, 1, 2, 3, 4, 5].flatMap((row) =>
    [0, 1, 2, 3, 4, 5, 6].map((col) => {
      const x = 146 + col * 10 + (row % 2) * 5;
      const y = 156 + row * 11;
      return `M${x - 5} ${y} A5 5 0 0 0 ${x + 5} ${y}`;
    }),
  );
  const tiers = PEACOCK_TRAIN.map((tier) => ({ scale: tier.scale, segs: tier.ends.map(featherCurve) }));
  return (
    <svg viewBox="0 0 320 400" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={320} y2={400} />
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={tint(c, 0.1)} stopOpacity="0.1" />
          <stop offset="0.6" stopColor={c} stopOpacity="0.45" />
          <stop offset="1" stopColor={shade(c, 0.1)} stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#3a6fe0" />
          <stop offset="0.6" stopColor="#1f4fbf" />
          <stop offset="1" stopColor="#14327a" />
        </linearGradient>
        <clipPath id={`${id}s`}>
          <path d={saddle} />
        </clipPath>
      </defs>
      {/* The branch. */}
      <path d="M14 232 C80 220 170 224 252 238" fill="none" stroke="#6d4c2f" strokeWidth="7" strokeLinecap="round" />
      <path d="M60 226 C52 216 50 208 54 200" fill="none" stroke="#6d4c2f" strokeWidth="3" strokeLinecap="round" />
      {[
        [34, 229, -30],
        [54, 202, -70],
        [76, 224, 20],
        [226, 233, -15],
      ].map(([x, y, a]) => (
        <path key={x} d="M0 0 C6 -7 18 -8 26 0 C18 8 6 7 0 0Z" fill={NATURE.leaf} transform={`translate(${x} ${y}) rotate(${a})`} />
      ))}
      {/* The train, tier by tier: each tier's eyes lie over the vanes behind them. */}
      {tiers.map((tier, t) => (
        <g key={t}>
          {tier.segs.map((seg, i) => (
            <TrainFeather key={i} seg={seg} scale={tier.scale} c={c} vane={vane} />
          ))}
          {tier.segs.map((seg, i) => (
            <PeacockEye key={i} seg={seg} scale={tier.scale} c={c} metal={metal} />
          ))}
        </g>
      ))}
      {/* The scaled saddle where the train begins. */}
      <path d={saddle} fill={shade(c, 0.18)} />
      <g clipPath={`url(#${id}s)`}>
        <path d={scales.join(' ')} fill="none" stroke={tint(c, 0.35)} strokeWidth="1.3" />
      </g>
      {/* Legs. */}
      <path d="M140 184 L136 228 M152 186 L150 228" stroke="#8c8c8c" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M128 230 L140 228 L136 232 M144 230 L156 228 L152 232" stroke="#8c8c8c" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Body and neck. */}
      <path d="M120 94 C112 72 96 56 84 52 C72 48 66 58 72 66 C78 74 92 80 100 98 C108 118 104 148 122 172 C140 194 176 194 186 174 C196 154 176 122 150 110 C138 104 126 102 120 94Z" fill={`url(#${id}b)`} />
      <path d="M78 62 C90 70 98 84 102 104" fill="none" stroke="#8fb8ff" strokeWidth="2" opacity="0.45" strokeLinecap="round" />
      <path d="M106 120 C108 140 114 156 126 168" fill="none" stroke="#5fd4c8" strokeWidth="3" opacity="0.3" strokeLinecap="round" />
      {/* The folded wing: barred coverts and chestnut flight feathers. */}
      <path d="M160 160 C172 158 184 150 190 140 C194 154 194 170 186 182 C178 188 168 184 160 160Z" fill="#9c4f24" />
      <path d="M126 124 C142 112 168 118 180 140 C186 154 178 170 164 172 C148 174 132 160 126 124Z" fill="#dcc391" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${131 + i * 7} ${125 + i * 3} C${137 + i * 7} ${133 + i * 5} ${141 + i * 6} ${146 + i * 4} ${142 + i * 6} ${160 + i * 1.6}`} fill="none" stroke="#5b4124" strokeWidth="1.2" opacity="0.85" />
      ))}
      {/* Head, white face markings, eye and beak. */}
      <circle cx="82" cy="54" r="12" fill="#1f4fbf" />
      <path d="M73 49.5 C77 46 86 45.5 92 49 C86 47.8 78 48 73 49.5Z" fill="#ffffff" />
      <path d="M74 58 C78 61.5 86 61.5 91 57 C86 59.6 79 59.8 74 58Z" fill="#ffffff" opacity="0.92" />
      <circle cx="83" cy="53" r="2.3" fill="#111827" />
      <circle cx="83.8" cy="52.2" r="0.7" fill="#ffffff" />
      <path d="M71 52.5 C66 53.5 61 55.5 57 58.5 C61 59.6 66 60 71 60Z" fill="#cdb79a" />
      {/* Crest. */}
      {[
        [71, 22],
        [76, 17],
        [81, 14],
        [87, 14],
        [92, 17],
        [97, 22],
      ].map(([x, y]) => (
        <g key={x}>
          <path d={`M85 43 L${x} ${y}`} stroke="#1f4fbf" strokeWidth="1" />
          <ellipse cx={x} cy={y} rx="2.4" ry="3.4" fill="#2563eb" />
          <circle cx={x} cy={y} r="1.1" fill="#38bdf8" />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────── Flowers ───────────────────────────

/** A garden rose seen from above: outer petals, a cupped centre and a spiral. */
function Rose({ x, y, r, base, id }: { x: number; y: number; r: number; base: string; id: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={id} cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor={tint(base, 0.55)} />
          <stop offset="0.7" stopColor={base} />
          <stop offset="1" stopColor={shade(base, 0.2)} />
        </radialGradient>
      </defs>
      {ring(6, (i, a) => (
        <ellipse key={i} cx="0" cy={-r * 0.46} rx={r * 0.6} ry={r * 0.46} fill={`url(#${id})`} stroke={shade(base, 0.18)} strokeWidth="0.6" transform={`rotate(${r2(a + 15)})`} />
      ))}
      <circle r={r * 0.6} fill={tint(base, 0.2)} />
      {ring(4, (i, a) => (
        <ellipse key={i} cx="0" cy={-r * 0.22} rx={r * 0.36} ry={r * 0.26} fill={`url(#${id})`} stroke={shade(base, 0.2)} strokeWidth="0.5" transform={`rotate(${r2(a + 40)})`} />
      ))}
      <path d={`M0 ${-r * 0.18} C${r * 0.2} ${-r * 0.18} ${r * 0.22} ${r * 0.12} 0 ${r * 0.14} C${-r * 0.16} ${r * 0.14} ${-r * 0.16} ${-r * 0.06} ${r * 0.02} ${-r * 0.04}`} fill="none" stroke={shade(base, 0.32)} strokeWidth={r2(Math.max(0.8, r * 0.04))} strokeLinecap="round" />
    </g>
  );
}

/** A five-petal filler blossom. */
function Blossom({ x, y, r, fill, centre }: { x: number; y: number; r: number; fill: string; centre: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {ring(5, (i, a) => (
        <ellipse key={i} cx="0" cy={-r * 0.55} rx={r * 0.42} ry={r * 0.6} fill={fill} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.28} fill={centre} />
    </g>
  );
}

const LEAF = 'M0 0 C14 -16 44 -18 66 0 C44 18 14 16 0 0Z';

function Leaf({ x, y, angle, scale, fill, vein }: { x: number; y: number; angle: number; scale: number; fill: string; vein: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <path d={LEAF} fill={fill} />
      <path d="M3 0 Q34 -2 63 0" fill="none" stroke={vein} strokeWidth="1" opacity="0.7" />
    </g>
  );
}

/**
 * A lush corner bouquet (top left; flip for the other corners): roses in the
 * palette's primary and accent, buds, filler blossoms and leaves in the tint.
 */
export function RoseCluster({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const green = hex(color);
  const p = hex(colors.primary);
  const a = hex(colors.accent);
  const leaves: Array<[number, number, number, number]> = [
    [118, 34, -14, 1.3],
    [150, 70, 18, 1.15],
    [196, 30, -22, 1.05],
    [180, 66, 30, 0.95],
    [230, 40, -8, 0.85],
    [62, 104, 74, 1.3],
    [36, 146, 92, 1.15],
    [92, 132, 52, 1.05],
    [124, 104, 36, 0.9],
    [30, 196, 98, 0.95],
    [20, 238, 104, 0.75],
    [262, 54, -4, 0.7],
    [10, 60, 40, 0.9],
    [60, 14, -30, 0.9],
  ];
  return (
    <svg viewBox="0 0 320 270" className={className} style={style} aria-hidden="true">
      {leaves.map(([x, y, ang, s], i) => (
        <Leaf key={i} x={x} y={y} angle={ang} scale={s} fill={i % 3 === 0 ? shade(green, 0.12) : i % 3 === 1 ? green : tint(green, 0.2)} vein={tint(green, 0.45)} />
      ))}
      {[
        [228, 46, -30],
        [44, 222, 60],
        [130, 128, 20],
      ].map(([x, y, ang], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${ang})`}>
          <path d="M0 6 C-6 0 -6 -10 0 -16 C6 -10 6 0 0 6Z" fill={i === 1 ? a : p} />
          <path d="M-5 4 C-3 9 3 9 5 4 L0 12Z" fill={shade(green, 0.1)} />
        </g>
      ))}
      <Rose x={84} y={74} r={48} base={a} id={`${id}a`} />
      <Rose x={164} y={50} r={31} base={blend(p, a, 0.35)} id={`${id}b`} />
      <Rose x={58} y={156} r={33} base={tint(a, 0.55)} id={`${id}c`} />
      {[
        [204, 92, 10, tint(p, 0.8)],
        [118, 116, 9, '#ffffff'],
        [26, 112, 9, tint(a, 0.6)],
        [258, 70, 8, '#ffffff'],
        [96, 196, 8, tint(p, 0.8)],
      ].map(([x, y, r, fill], i) => (
        <Blossom key={i} x={x as number} y={y as number} r={r as number} fill={fill as string} centre={hex(colors.secondary)} />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={r2(150 + rand(i, 3) * 130)} cy={r2(18 + rand(i, 5) * 150 * (1 - rand(i, 3) * 0.6))} r={r2(1.4 + rand(i, 9) * 1.4)} fill="#ffffff" opacity="0.85" />
      ))}
    </svg>
  );
}

/** A swag of leaves and flowers across the layer, sagging in the middle, with drops at both ends. */
export function FloralGarland({ color, colors, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const green = hex(color);
  const flowers = [hex(colors.primary), hex(colors.accent), '#ffffff'];
  const top = h * 0.22;
  const sag = h * 0.38;
  const at = (t: number) => ({ x: w * t, y: top + 4 * sag * t * (1 - t) });
  const n = Math.max(6, Math.round(w / (h * 0.42)));
  const size = Math.min(h * 0.2, (w / n) * 0.55);
  const parts: ReactNode[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const { x, y } = at(t);
    const slope = r2((Math.atan2(4 * sag * (1 - 2 * t), w) * 180) / Math.PI);
    parts.push(
      <g key={`l${i}`} transform={`translate(${r2(x)} ${r2(y)}) rotate(${slope})`}>
        <Leaf x={0} y={0} angle={-40} scale={r2(size / 60)} fill={green} vein={tint(green, 0.45)} />
        <Leaf x={0} y={0} angle={140} scale={r2(size / 66)} fill={shade(green, 0.12)} vein={tint(green, 0.4)} />
      </g>,
    );
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const { x, y } = at(t);
    const base = flowers[i % 3]!;
    parts.push(
      i % 3 === 0 ? (
        <Rose key={`f${i}`} x={r2(x)} y={r2(y)} r={r2(size * 0.62)} base={base === '#ffffff' ? tint(flowers[1]!, 0.6) : base} id={`${id}r${i}`} />
      ) : (
        <Blossom key={`f${i}`} x={r2(x)} y={r2(y)} r={r2(size * 0.48)} fill={base} centre={hex(colors.secondary)} />
      ),
    );
  }
  const drop = (x: number) =>
    [0, 1, 2].map((k) => <Blossom key={`${x}${k}`} x={r2(x)} y={r2(top + size * (1 + k * 1.05))} r={r2(size * (0.42 - k * 0.06))} fill={flowers[(k + 1) % 3]!} centre={hex(colors.secondary)} />);
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <path d={`M0 ${r2(top)} Q${r2(w / 2)} ${r2(top + 2 * sag)} ${r2(w)} ${r2(top)}`} fill="none" stroke={shade(green, 0.3)} strokeWidth={r2(Math.max(1, h * 0.012))} />
      {drop(size * 0.5)}
      {drop(w - size * 0.5)}
      {parts}
    </svg>
  );
}

/** A hanging strand of jasmine buds (gajra) with a rose now and then and a tassel. */
export function JasmineStrand({ colors, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const x = w / 2;
  const step = w * 0.5;
  const rows: ReactNode[] = [];
  let k = 0;
  for (let y = step * 0.7; y < h - step * 1.4; y += step, k++) {
    if (k % 6 === 5) {
      rows.push(<Rose key={`rose${k}`} x={r2(x)} y={r2(y)} r={r2(w * 0.3)} base={hex(colors.primary)} id={`${id}r${k}`} />);
      continue;
    }
    rows.push(
      ...[-1, 1].map((s) => (
        <g key={`${k}:${s}`} transform={`translate(${r2(x)} ${r2(y)}) rotate(${s * 32})`}>
          <ellipse cx="0" cy={r2(-w * 0.26)} rx={r2(w * 0.13)} ry={r2(w * 0.27)} fill={`url(#${id}j)`} />
          <path d={`M${r2(-w * 0.07)} ${r2(-w * 0.04)} L0 ${r2(w * 0.06)} L${r2(w * 0.07)} ${r2(-w * 0.04)}Z`} fill={NATURE.leafLight} />
        </g>
      )),
    );
  }
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe8d6" />
        </linearGradient>
      </defs>
      <path d={`M${r2(x)} 0 V${r2(h - step)}`} stroke="#a3a3a3" strokeWidth={r2(Math.max(0.6, w * 0.02))} />
      {rows}
      <path d={`M${r2(x - w * 0.1)} ${r2(h - step)} H${r2(x + w * 0.1)} L${r2(x + w * 0.05)} ${r2(h - step * 0.2)} H${r2(x - w * 0.05)}Z`} fill={hex(colors.secondary)} />
    </svg>
  );
}

/** A banana plant: broad torn leaves on a ringed trunk (the auspicious entrance plant). The tint is the leaf colour. */
export function BananaLeaf({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const leaf = (len: number, wd: number) => `M0 0 C${-wd} ${-len * 0.25} ${-wd * 0.9} ${-len * 0.75} 0 ${-len} C${wd * 0.9} ${-len * 0.75} ${wd} ${-len * 0.25} 0 0Z`;
  const leaves: Array<[number, number, number]> = [
    [-58, 200, 32],
    [52, 196, 32],
    [-24, 250, 38],
    [20, 244, 36],
  ];
  return (
    <svg viewBox="0 0 220 380" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={shade(c, 0.2)} />
          <stop offset="1" stopColor={tint(c, 0.22)} />
        </linearGradient>
      </defs>
      {leaves.map(([a, len, wd], i) => (
        <g key={i} transform={`translate(110 282) rotate(${a})`}>
          <path d={leaf(len, wd)} fill={`url(#${id}l)`} />
          <path d={`M0 0 Q4 ${-len / 2} 0 ${-len}`} fill="none" stroke={tint(c, 0.5)} strokeWidth="2" />
          {Array.from({ length: 7 }, (_, k) => {
            const y = -len * ((k + 1) / 9);
            const side = k % 2 ? 1 : -1;
            return <path key={k} d={`M${side * 3} ${r2(y)} L${side * wd * 0.82} ${r2(y - 10)}`} stroke={shade(c, 0.35)} strokeWidth="1.2" opacity="0.7" />;
          })}
        </g>
      ))}
      <path d="M110 282 C108 240 109 200 110 150 C112 200 113 240 112 282Z" fill={tint(c, 0.35)} />
      <path d="M96 380 C98 340 100 310 102 282 H118 C120 310 122 340 124 380Z" fill="#8a9a46" />
      {[300, 322, 346].map((y) => (
        <path key={y} d={`M${100 - (y - 282) * 0.03} ${y} Q110 ${y + 5} ${120 + (y - 282) * 0.03} ${y}`} fill="none" stroke="#5e6b2b" strokeWidth="1.4" />
      ))}
    </svg>
  );
}

/** A digit of the mehendi hand (viewBox 240 × 340): its axis from base to tip, and its width there. */
interface Digit {
  seg: Segment;
  w: readonly [number, number];
}

/** Palm toward us, thumb on the left: index, middle, ring and little finger. */
const HAND_FINGERS: Digit[] = [
  { seg: [[76, 172], [72, 140], [65, 100], [61, 68]], w: [32, 26] },
  { seg: [[108, 164], [107, 128], [105, 84], [104, 48]], w: [33, 27] },
  { seg: [[140, 166], [142, 132], [145, 96], [148, 64]], w: [31, 25] },
  { seg: [[168, 178], [174, 152], [181, 126], [187, 106]], w: [26, 21] },
];
const HAND_THUMB: Digit = { seg: [[84, 276], [56, 256], [32, 226], [27, 186]], w: [46, 29] };
const HAND_PALM = 'M86 340 C86 318 80 296 70 274 C58 248 52 214 56 184 C60 168 70 160 84 158 C104 152 130 152 152 156 C170 160 184 168 188 184 C192 214 188 252 178 282 C172 300 168 320 168 340Z';

const circlePath = (x: number, y: number, r: number) => `M${r2(x - r)} ${r2(y)} a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0 a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;

/** A digit's outline: the tapered shaft and its rounded tip. */
const digitPaths = ({ seg, w }: Digit) => [taper([seg], w), circlePath(seg[3][0], seg[3][1], w[1] / 2)];

/** Henna on one digit: a scalloped tip cap and dots, a leaf sprig, a dotted band and a zigzag band. */
function DigitHenna({ seg, w, h, thumb = false }: Digit & { h: string; thumb?: boolean }) {
  const half = (t: number) => (w[0] + (w[1] - w[0]) * t) / 2;
  const tip = half(1);
  const cap = r2(tip * 0.85);
  const n = 4;
  const s = (2 * tip) / n;
  const scallops = Array.from({ length: n }, () => `a${r2(s / 2)} ${r2(s / 2)} 0 0 1 ${r2(-s)} 0`).join(' ');
  const mid = half(0.64);
  const low = half(thumb ? 0.5 : 0.36);
  const zig = Array.from({ length: 7 }, (_, k) => `${k ? 'L' : 'M'}${r2(-low + (k * 2 * low) / 6)} ${k % 2 ? 3.4 : -3.4}`).join(' ');
  return (
    <g>
      <g transform={frameAt(onCubic(seg, 1))}>
        <path d={`M${r2(-tip - 4)} ${r2(-tip - 6)} H${r2(tip + 4)} V${cap} H${r2(tip)} ${scallops} H${r2(-tip - 4)}Z`} fill={h} />
        {[-0.55, 0, 0.55].map((k) => (
          <circle key={k} cx={r2(tip * k)} cy={r2(cap + s / 2 + 4)} r="1.2" fill={h} />
        ))}
      </g>
      {!thumb && (
        <g transform={frameAt(onCubic(seg, 0.78))} fill={h}>
          <path d="M0 2 C-3 -1 -7 -1 -9 1 C-7 4 -3 4 0 2Z" />
          <path d="M0 2 C3 -1 7 -1 9 1 C7 4 3 4 0 2Z" />
          <circle cx="0" cy="-3.4" r="1.4" />
        </g>
      )}
      <g transform={frameAt(onCubic(seg, thumb ? 0.74 : 0.64))} fill="none" stroke={h}>
        <path d={`M${r2(-mid)} -3 H${r2(mid)} M${r2(-mid)} 3 H${r2(mid)}`} strokeWidth="1.3" />
        {[-0.5, 0, 0.5].map((k) => (
          <circle key={k} cx={r2(mid * k)} cy="0" r="1.1" fill={h} stroke="none" />
        ))}
        {!thumb && <path d="M0 -3 C3 -6 -3 -9 0 -12" strokeWidth="1" />}
      </g>
      <g transform={frameAt(onCubic(seg, thumb ? 0.5 : 0.36))} fill="none" stroke={h}>
        <path d={`M${r2(-low)} -5 H${r2(low)} M${r2(-low)} 5 H${r2(low)}`} strokeWidth="1.3" />
        <path d={zig} strokeWidth="0.9" />
      </g>
      {thumb ? (
        <g transform={frameAt(onCubic(seg, 0.26))} fill="none" stroke={h}>
          <path d="M0 13 C-10 11 -11 -2 -4 -8 C0 -11 4 -12 3 -16 C8 -12 9 -2 6 4 C4 9 2 11 0 13Z" strokeWidth="1.3" />
          <path d="M0 8 C-5 7 -6 0 -2 -4 C0 -6 3 -6 2 -9 C5 -6 5 0 3 3 C2 6 1 7 0 8Z" strokeWidth="0.8" />
          <circle cx="0" cy="2" r="1.6" fill={h} stroke="none" />
        </g>
      ) : (
        <g transform={frameAt(onCubic(seg, 0.2))} fill={h}>
          <circle cx="0" cy="-2.4" r="1.1" />
          <circle cx="-2.6" cy="1.8" r="1.1" />
          <circle cx="2.6" cy="1.8" r="1.1" />
        </g>
      )}
    </g>
  );
}

/**
 * A hand painted with mehendi, palm toward us: fingertip caps, finger bands and
 * sprigs, a paisley on the thumb, a canopy over a palm mandala, a lattice and a
 * lace cuff at the wrist, a ring and glass bangles. The tint is the henna; the
 * bangles and the ring take the palette.
 */
export function MehendiHand({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const h = hex(color);
  const metal = `url(#${id}m)`;
  const skin = `url(#${id}s)`;
  const outline = shade(NATURE.skinShade, 0.22);
  const pieces = [HAND_PALM, ...digitPaths(HAND_THUMB), ...HAND_FINGERS.flatMap(digitPaths)];
  const canopy: Segment = [
    [80, 196],
    [92, 174],
    [156, 174],
    [168, 196],
  ];
  const canopyDots = [0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92].map((t) => {
    const p = onCubic(canopy, t);
    return [r2(p.x + p.ty * 5), r2(p.y - p.tx * 5)] as const;
  });
  const lattice = Array.from({ length: 12 }, (_, k) => `M${92 + k * 8} 282 L${100 + k * 8} 294 M${100 + k * 8} 282 L${92 + k * 8} 294`).join(' ');
  const lace = Array.from({ length: 12 }, () => 'a4 4 0 0 1 -8 0').join(' ');
  const bangles: Array<[number, string]> = [
    [313, metal],
    [319.5, hex(colors.primary)],
    [326, hex(colors.accent)],
    [332.5, metal],
  ];
  const ringAt = onCubic(HAND_FINGERS[2]!.seg, 0.27);
  const ringHalf = (HAND_FINGERS[2]!.w[0] + (HAND_FINGERS[2]!.w[1] - HAND_FINGERS[2]!.w[0]) * 0.27) / 2;
  return (
    <svg viewBox="0 0 240 340" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={240} y2={340} />
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="200" y2="340">
          <stop offset="0" stopColor={tint(NATURE.skin, 0.28)} />
          <stop offset="0.55" stopColor={NATURE.skin} />
          <stop offset="1" stopColor={NATURE.skinShade} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          {pieces.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      {/* Bangles behind the wrist. */}
      {bangles.map(([y, fill]) => (
        <path key={y} d={`M75 ${y} A52 8 0 0 1 179 ${y}`} fill="none" stroke={fill} strokeWidth="4.6" opacity="0.8" />
      ))}
      {/* The hand: every outline first, then every fill, so the pieces read as one silhouette. */}
      {pieces.map((d, i) => (
        <path key={`o${i}`} d={d} fill={outline} stroke={outline} strokeWidth="2.4" strokeLinejoin="round" />
      ))}
      {pieces.map((d, i) => (
        <path key={`f${i}`} d={d} fill={skin} />
      ))}
      <g clipPath={`url(#${id}c)`}>
        {/* Creases under the henna. */}
        <path d="M102 186 C88 212 88 252 100 286" fill="none" stroke={NATURE.skinShade} strokeWidth="1.4" opacity="0.7" />
        <path d="M188 200 C166 192 140 196 120 208" fill="none" stroke={NATURE.skinShade} strokeWidth="1.2" opacity="0.6" />
        {[HAND_THUMB, ...HAND_FINGERS].map((d, i) => (
          <DigitHenna key={i} {...d} h={h} thumb={i === 0} />
        ))}
        {/* The canopy over the mandala. */}
        <g fill="none" stroke={h}>
          <path d="M80 196 C92 174 156 174 168 196" strokeWidth="1.6" />
          <path d="M88 198 C98 182 150 182 160 198" strokeWidth="0.9" />
        </g>
        {canopyDots.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="1.5" fill={h} />
        ))}
        {/* The palm mandala. */}
        <g transform="translate(124 236)" fill="none" stroke={h}>
          <circle r="43" strokeWidth="1.8" strokeDasharray="0.1 4.4" strokeLinecap="round" />
          {ring(16, (i, a) => (
            <path key={i} d="M0 -39 C4 -35 4 -31 0 -28.5 C-4 -31 -4 -35 0 -39Z" strokeWidth="1" transform={`rotate(${a})`} />
          ))}
          <circle r="27" strokeWidth="1.8" />
          <circle r="24" strokeWidth="0.8" />
          {ring(8, (i, a) => (
            <path key={i} d="M0 -23 C6 -16 6 -10 0 -6 C-6 -10 -6 -16 0 -23Z" fill={h} stroke="none" transform={`rotate(${a})`} />
          ))}
          {ring(8, (i, a) => (
            <path key={i} d="M0 -21 C4 -15 4 -11 0 -8 C-4 -11 -4 -15 0 -21Z" strokeWidth="0.9" transform={`rotate(${r2(a + 22.5)})`} />
          ))}
          <circle r="7" fill={h} stroke="none" />
          <circle r="3.2" fill={NATURE.skin} stroke="none" />
          <circle r="1.3" fill={h} stroke="none" />
        </g>
        {/* A sprig down the side of the palm. */}
        <path d="M180 200 C172 216 184 232 175 250 C169 262 174 272 178 282" fill="none" stroke={h} strokeWidth="1.1" />
        {[
          [178, 214, 200],
          [176, 236, -20],
          [173, 258, 200],
        ].map(([x, y, a]) => (
          <path key={y} d="M0 0 C3 -3 8 -3 10 0 C8 3 3 3 0 0Z" fill={h} transform={`translate(${x} ${y}) rotate(${a})`} />
        ))}
        {/* The lattice, then the lace cuff at the wrist. */}
        <g fill="none" stroke={h}>
          <path d="M84 282 H184 M84 294 H184" strokeWidth="1.3" />
          <path d={lattice} strokeWidth="0.8" />
          <path d={`M180 302 H82 M180 302 ${lace}`} strokeWidth="1.2" />
        </g>
        {Array.from({ length: 12 }, (_, k) => (
          <circle key={k} cx={176 - k * 8} cy="310" r="1.2" fill={h} />
        ))}
      </g>
      {/* A ring with a stone. */}
      <g transform={frameAt(ringAt)}>
        <rect x={r2(-ringHalf)} y="-2.4" width={r2(ringHalf * 2)} height="4.8" fill={metal} />
        <circle r="4.2" fill={hex(colors.accent)} stroke={metal} strokeWidth="1.4" />
        <circle cx="-1.2" cy="-1.2" r="1.1" fill="#ffffff" opacity="0.6" />
      </g>
      {/* Bangles in front of the wrist, with a glint. */}
      {bangles.map(([y, fill]) => (
        <g key={y}>
          <path d={`M75 ${y} A52 8 0 0 0 179 ${y}`} fill="none" stroke={fill} strokeWidth="4.6" />
          <path d={`M92 ${r2(y + 5.2)} A40 5 0 0 0 128 ${r2(y + 7.6)}`} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.45" />
        </g>
      ))}
    </svg>
  );
}

/** One dove facing right, a wing raised (local, beak tip at x 136). */
function Dove({ fill, shadeFill, line }: { fill: string; shadeFill: string; line: string }) {
  return (
    <g stroke={line} strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round">
      <path d="M38 80 C24 78 8 82 -4 94 C10 98 24 96 40 88Z" fill={shadeFill} />
      <path d="M40 76 C24 70 6 70 -8 80 C6 86 22 86 40 84Z" fill={fill} />
      <path d="M16 78 L30 80 M10 84 L28 84" fill="none" opacity="0.6" />
      <path d="M84 56 C72 40 58 22 36 4 C50 6 64 14 76 24 C86 34 92 44 94 56Z" fill={shadeFill} />
      <path d="M86 56 C80 42 70 28 56 14 C66 18 76 26 84 36 C90 44 94 50 94 56Z" fill={fill} />
      <path d="M64 30 C70 38 76 46 80 54 M50 18 C60 28 68 38 74 48" fill="none" opacity="0.55" />
      <circle cx="114" cy="50" r="15" fill={fill} />
      <path d="M34 82 C36 60 58 48 84 50 C98 51 108 56 114 62 C120 70 120 82 112 90 C98 100 68 102 50 96 C40 93 34 88 34 82Z" fill={fill} />
      <path d="M101 55 C104 52 108 51 112 52" fill="none" stroke={fill} strokeWidth="5" />
      <path d="M100 58 C104 64 108 68 114 70" fill="none" opacity="0.4" />
      <path d="M54 88 C70 94 90 94 106 86" fill="none" opacity="0.45" />
      <circle cx="117" cy="46" r="2.3" fill="#2b2b2b" stroke="none" />
      <path d="M127 46 L137 50 L127 54Z" fill="#e2b26a" stroke="none" />
    </g>
  );
}

/** Two doves facing each other over a heart, a ribbon flowing from their beaks. The tint colours the heart and ribbon. */
export function Doves({ color, className, style }: IllustrationProps) {
  const c = hex(color);
  const dove = { fill: '#ffffff', shadeFill: '#e6e9f0', line: '#b7bcc8' };
  return (
    <svg viewBox="0 0 300 200" className={className} style={style} aria-hidden="true">
      <path d="M148 104 C134 128 108 142 70 156 C92 150 118 140 140 118 C144 113 147 108 148 104Z M152 104 C166 128 192 142 230 156 C208 150 182 140 160 118 C156 113 153 108 152 104Z" fill={c} />
      <path d="M70 156 L58 150 L64 162 Z M230 156 L242 150 L236 162 Z" fill={shade(c, 0.15)} />
      <g transform="translate(12 52)">
        <Dove {...dove} />
      </g>
      <g transform="translate(288 52) scale(-1 1)">
        <Dove {...dove} />
      </g>
      <path d="M150 84 C138 74 132 64 140 58 C145 54 150 58 150 62 C150 58 155 54 160 58 C168 64 162 74 150 84Z" fill={c} />
    </svg>
  );
}
