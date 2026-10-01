import { useId, type CSSProperties, type ReactElement } from 'react';

/**
 * Illustrated motifs drawn in code (no external assets, no licences to track).
 * Structural colours come from the template palette through CSS variables, so
 * a customer's colour change recolours the art; natural things (marigolds,
 * leaves, flames) keep their natural colours. All of this is decorative:
 * every SVG is aria-hidden and carries no text.
 */

type Svg = { className?: string; style?: CSSProperties };

const TAU = Math.PI * 2;

/**
 * Deterministic pseudo-random in [0, 1): integer hashing only, so the server
 * (Node) and the browser produce bit-identical values. (Math.sin differs in
 * the last digits between engines, which breaks hydration.)
 */
export const rand = (i: number, salt = 1) => {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** Round coordinates from trigonometry: engines differ in the last digits of sin/cos. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────── Garlands ───────────────────────────

const MARIGOLD = [
  ['#ffb300', '#f57c00', '#fff3c4'],
  ['#ff8f00', '#d84315', '#ffe0a3'],
  ['#ffd54f', '#f9a825', '#fffbe6'],
] as const;

/** A marigold head seen from the front: ruffled rim, full centre, soft highlight. */
export function Marigold({ x, y, r, tone = 0 }: { x: number; y: number; r: number; tone?: number }) {
  const [base, deep, light] = MARIGOLD[tone % 3]!;
  return (
    <g>
      {Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * TAU;
        return <circle key={i} cx={r2(x + Math.cos(a) * r * 0.6)} cy={r2(y + Math.sin(a) * r * 0.6)} r={r2(r * 0.46)} fill={deep} />;
      })}
      <circle cx={x} cy={y} r={r * 0.78} fill={base} />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * TAU + 0.3;
        return <circle key={i} cx={r2(x + Math.cos(a) * r * 0.36)} cy={r2(y + Math.sin(a) * r * 0.36)} r={r2(r * 0.22)} fill={deep} opacity={0.55} />;
      })}
      <circle cx={x - r * 0.25} cy={y - r * 0.28} r={r * 0.22} fill={light} opacity={0.55} />
    </g>
  );
}

/** Mango leaf hanging from (x, y), tip down. */
export function MangoLeaf({ x, y, size = 1, angle = 0 }: { x: number; y: number; size?: number; angle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
      <path d="M0 0 C7 9 8 24 0 38 C-8 24 -7 9 0 0Z" fill="#2e7d32" />
      <path d="M0 0 C4 9 4.5 24 0 38" fill="#43a047" />
      <path d="M0 2 L0 36" stroke="#1b5e20" strokeWidth="0.8" opacity="0.7" />
    </g>
  );
}

/** Brass temple bell with clapper, hanging from (x, y). */
export function Bell({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const id = useId();
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="1">
          <stop offset="0" stopColor="#8a5a12" />
          <stop offset="0.45" stopColor="#f4c95d" />
          <stop offset="1" stopColor="#9c6716" />
        </linearGradient>
      </defs>
      <path d="M0 0 V10" stroke="#8a5a12" strokeWidth="1.5" />
      <circle cx="0" cy="12" r="3" fill={`url(#${id}b)`} />
      <path d="M-4 15 C-5 22 -10 28 -13 34 H13 C10 28 5 22 4 15Z" fill={`url(#${id}b)`} />
      <rect x="-14" y="33" width="28" height="3.5" rx="1.75" fill="#b7812a" />
      <circle cx="0" cy="39.5" r="3" fill="#6d4610" />
    </g>
  );
}

/**
 * A toran: marigold swags across the top edge with mango leaves at every
 * joint and a bell in the middle. `width` is in SVG units; height ~ 110.
 */
export function Toran({ className, style, swags = 5, bells = true }: Svg & { swags?: number; bells?: boolean }) {
  const W = 400;
  const span = W / swags;
  const sag = 34;
  const blooms: Array<{ x: number; y: number; r: number; tone: number }> = [];
  for (let s = 0; s < swags; s++) {
    const x0 = s * span;
    for (let k = 0; k <= 9; k++) {
      const t = k / 9;
      blooms.push({ x: x0 + t * span, y: 8 + 4 * sag * t * (1 - t), r: 7.2, tone: (s + k) % 3 });
    }
  }
  return (
    <svg viewBox={`0 0 ${W} 120`} className={className} style={style} aria-hidden="true" preserveAspectRatio="xMidYMin meet">
      <path d={`M0 7 H${W}`} stroke="#8d6e3f" strokeWidth="2" />
      {Array.from({ length: swags + 1 }, (_, s) => (
        <g key={`l${s}`}>
          <MangoLeaf x={s * span} y={12} size={0.9} angle={-12} />
          <MangoLeaf x={s * span} y={12} size={0.9} angle={12} />
        </g>
      ))}
      {blooms.map((b, i) => (
        <Marigold key={i} {...b} />
      ))}
      {bells ? <Bell x={W / 2} y={8 + sag + 6} size={0.9} /> : null}
    </svg>
  );
}

/** A hanging string of marigolds (the side strands of a mandap or doorway). */
export function MarigoldStrand({ className, style, count = 14, leaf = true }: Svg & { count?: number; leaf?: boolean }) {
  const h = count * 13 + (leaf ? 40 : 6);
  return (
    <svg viewBox={`-12 0 24 ${h}`} className={className} style={style} aria-hidden="true">
      <path d={`M0 0 V${count * 13}`} stroke="#8d6e3f" strokeWidth="1" />
      {Array.from({ length: count }, (_, i) => (
        <Marigold key={i} x={0} y={7 + i * 13} r={7.4} tone={i % 3} />
      ))}
      {leaf ? <MangoLeaf x={0} y={count * 13} size={0.8} /> : null}
    </svg>
  );
}

// ─────────────────────────── Light ───────────────────────────

/** Clay diya with a flickering flame and warm glow. */
export function Diya({ className, style, glow = true }: Svg & { glow?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 80 80" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}g`} cx="50%" cy="40%" r="50%">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}f`} cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.45" stopColor="#ffd54f" />
          <stop offset="1" stopColor="#ff6d00" />
        </radialGradient>
        <linearGradient id={`${id}c`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c7773f" />
          <stop offset="1" stopColor="#7a3b1b" />
        </linearGradient>
      </defs>
      {glow ? <circle cx="40" cy="36" r="34" fill={`url(#${id}g)`} className="bulava-glow" /> : null}
      <g className="bulava-flicker" style={{ transformOrigin: '40px 50px' }}>
        <path d="M40 22 C46 32 47 40 40 50 C33 40 34 32 40 22Z" fill={`url(#${id}f)`} />
      </g>
      <path d="M12 50 C16 64 28 70 40 70 C52 70 64 64 68 50 C58 54 50 55 40 55 C30 55 22 54 12 50Z" fill={`url(#${id}c)`} />
      <path d="M12 50 C22 54 30 55 40 55 C50 55 58 54 68 50 C60 48 50 47 40 47 C30 47 20 48 12 50Z" fill="#e3a36a" />
      <path d="M20 60 Q40 66 60 60" stroke="#f3c18a" strokeWidth="1.2" fill="none" opacity="0.7" />
    </svg>
  );
}

/** Kalash: brass pot with mango leaves and a coconut. */
export function Kalash({ className, style }: Svg) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 130" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}p`} x1="0" x2="1">
          <stop offset="0" stopColor="#8a5a12" />
          <stop offset="0.4" stopColor="#f6d27a" />
          <stop offset="0.7" stopColor="#d59b33" />
          <stop offset="1" stopColor="#7c4f0f" />
        </linearGradient>
      </defs>
      {[-58, -32, -10, 10, 32, 58].map((a, i) => (
        <MangoLeaf key={i} x={50} y={40} size={1.05} angle={180 + a} />
      ))}
      <circle cx="50" cy="30" r="15" fill="#6d4c2f" />
      <path d="M40 22 Q50 8 60 22" stroke="#8d6e3f" strokeWidth="3" fill="none" />
      <path d="M34 46 H66 L62 52 C82 60 86 86 72 104 C66 112 58 116 50 116 C42 116 34 112 28 104 C14 86 18 60 38 52Z" fill={`url(#${id}p)`} />
      <rect x="32" y="42" width="36" height="7" rx="3" fill="#b7812a" />
      <path d="M24 78 Q50 88 76 78" stroke="#8a1c1c" strokeWidth="4" fill="none" />
      <path d="M26 86 Q50 96 74 86" stroke="#f6d27a" strokeWidth="1.5" fill="none" opacity="0.8" />
      <text x="50" y="104" textAnchor="middle" fontSize="16" fill="#8a1c1c" opacity="0.85">
        ॐ
      </text>
    </svg>
  );
}

// ─────────────────────────── Nature ───────────────────────────

/** A lotus in bloom, filled (pink by default, recolours with --t-secondary when tinted). */
export function LotusBloom({ x, y, size = 1, tinted = false }: { x: number; y: number; size?: number; tinted?: boolean }) {
  const id = useId();
  const outer = tinted ? 'var(--t-secondary)' : '#f48fb1';
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <defs>
        <linearGradient id={`${id}p`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff5f8" />
          <stop offset="1" style={{ stopColor: outer }} />
        </linearGradient>
      </defs>
      {[-62, -38, 38, 62].map((a) => (
        <path key={a} d="M0 0 C10 -14 10 -30 0 -44 C-10 -30 -10 -14 0 0Z" transform={`rotate(${a})`} fill={`url(#${id}p)`} opacity="0.92" />
      ))}
      {[-18, 18].map((a) => (
        <path key={a} d="M0 0 C11 -16 11 -34 0 -50 C-11 -34 -11 -16 0 0Z" transform={`rotate(${a})`} fill={`url(#${id}p)`} />
      ))}
      <path d="M0 0 C12 -18 12 -38 0 -56 C-12 -38 -12 -18 0 0Z" fill={`url(#${id}p)`} />
      <ellipse cx="0" cy="-4" rx="9" ry="3.5" fill="#f9c74f" />
    </g>
  );
}

/** Lotus leaf pad floating on water. */
export function LotusLeaf({ x, y, r = 30 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0 L${r} -2 A${r} ${r * 0.34} 0 1 1 ${r} 2 Z`} fill="#2e7d32" />
      <ellipse cx={-r * 0.1} cy={0} rx={r * 0.7} ry={r * 0.22} fill="#43a047" opacity="0.6" />
    </g>
  );
}

/** Coconut palm silhouette rooted at (x, y). */
export function Palm({ x, y, h = 160, lean = 8, color = '#1f3b2d' }: { x: number; y: number; h?: number; lean?: number; color?: string }) {
  const topX = x + lean;
  const topY = y - h;
  const frond = (a: number, len: number) => {
    const rad = (a * Math.PI) / 180;
    const ex = r2(topX + Math.cos(rad) * len);
    const ey = r2(topY + Math.sin(rad) * len * 0.55 + len * 0.25);
    const cx = r2(topX + Math.cos(rad) * len * 0.5);
    const cy = r2(topY + Math.sin(rad) * len * 0.3 - 12);
    return `M${topX} ${topY} Q${cx} ${cy} ${ex} ${ey} Q${cx} ${cy + 10} ${topX} ${topY + 3}Z`;
  };
  return (
    <g>
      <path d={`M${x - 4} ${y} Q${x + lean * 0.3} ${y - h * 0.5} ${topX - 2} ${topY} L${topX + 2} ${topY} Q${x + lean * 0.3 + 5} ${y - h * 0.5} ${x + 4} ${y}Z`} fill={color} />
      {[-170, -140, -110, -70, -40, -10, 20, 160].map((a, i) => (
        <path key={i} d={frond(a, 58 + (i % 3) * 8)} fill={color} />
      ))}
    </g>
  );
}

/** Birds in flight, drifting slowly. */
export function Birds({ className, style }: Svg) {
  return (
    <svg viewBox="0 0 200 60" className={className} style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {[
        [20, 30, 1],
        [48, 18, 0.8],
        [70, 34, 0.9],
        [120, 14, 0.7],
        [150, 26, 0.85],
      ].map(([x, y, s], i) => (
        <path key={i} d={`M${x! - 8 * s!} ${y! - 3 * s!} Q${x! - 3 * s!} ${y! - 7 * s!} ${x} ${y} Q${x! + 3 * s!} ${y! - 7 * s!} ${x! + 8 * s!} ${y! - 3 * s!}`} />
      ))}
    </svg>
  );
}

/** Soft cloud. */
export function Cloud({ x, y, w = 120, opacity = 0.8 }: { x: number; y: number; w?: number; opacity?: number }) {
  const s = w / 120;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} fill="#ffffff">
      <ellipse cx="40" cy="22" rx="30" ry="16" />
      <ellipse cx="70" cy="16" rx="28" ry="18" />
      <ellipse cx="92" cy="26" rx="24" ry="12" />
      <rect x="18" y="22" width="92" height="14" rx="7" />
    </g>
  );
}

/** Glossy 3D balloon with a curly string. */
export function Balloon({ x, y, size = 1, color }: { x: number; y: number; size?: number; color: string }) {
  const id = useId();
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <defs>
        <radialGradient id={`${id}b`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.25" style={{ stopColor: color }} stopOpacity="0.95" />
          <stop offset="1" style={{ stopColor: color }} />
        </radialGradient>
      </defs>
      <path d="M0 86 C-6 100 6 110 -2 124 C-8 136 4 144 0 156" stroke="#9e9e9e" strokeWidth="1" fill="none" />
      <ellipse cx="0" cy="40" rx="34" ry="42" fill={`url(#${id}b)`} />
      <path d="M-5 82 L5 82 L0 88Z" style={{ fill: color }} />
      <ellipse cx="-12" cy="22" rx="7" ry="11" fill="#ffffff" opacity="0.45" transform="rotate(-25 -12 22)" />
    </g>
  );
}

// ─────────────────────────── Architecture ───────────────────────────

/**
 * South Indian gopuram (temple gateway tower) standing on (x, baseY).
 * Tiers narrow towards the top, each with niches; a barrel roof with kalasam
 * finials crowns it. Colours: body / shade / niche.
 */
export function Gopuram({
  x,
  baseY,
  width,
  height,
  tiers = 7,
  body,
  shade,
  niche,
  gold = '#f2c14e',
  figures,
}: {
  x: number;
  baseY: number;
  width: number;
  height: number;
  tiers?: number;
  body: string;
  shade: string;
  niche: string;
  gold?: string;
  /** Painted sculpture colours, one figure per niche (South Indian gopurams are painted). */
  figures?: readonly string[];
}) {
  const roofH = height * 0.14;
  const towerH = height - roofH;
  const tierH = towerH / tiers;
  const topW = width * 0.42;
  const parts: ReactElement[] = [];
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const t1 = (i + 1) / tiers;
    const w0 = width - (width - topW) * t0;
    const w1 = width - (width - topW) * t1;
    const y0 = baseY - tierH * i;
    const y1 = y0 - tierH;
    parts.push(
      <g key={i}>
        <path d={`M${x - w0 / 2} ${y0} L${x - w1 / 2} ${y1} L${x + w1 / 2} ${y1} L${x + w0 / 2} ${y0}Z`} style={{ fill: body }} />
        <path d={`M${x + w0 * 0.18} ${y0} L${x + w1 * 0.18} ${y1} L${x + w1 / 2} ${y1} L${x + w0 / 2} ${y0}Z`} style={{ fill: shade }} opacity="0.55" />
        <rect x={x - w1 / 2 - 2} y={y1 - 2} width={w1 + 4} height={3.5} style={{ fill: shade }} />
        {Array.from({ length: Math.max(3, Math.round(w1 / 16)) }, (_, k) => {
          const n = Math.max(3, Math.round(w1 / 16));
          const cx = x - w1 / 2 + (w1 / n) * (k + 0.5);
          const nh = tierH * 0.52;
          const nicheShape = <path d={`M${r2(cx - 3.2)} ${r2(y0 - 3)} V${r2(y0 - nh + 3)} Q${r2(cx)} ${r2(y0 - nh - 2)} ${r2(cx + 3.2)} ${r2(y0 - nh + 3)} V${r2(y0 - 3)}Z`} style={{ fill: niche }} opacity="0.75" />;
          if (!figures?.length) return <g key={k}>{nicheShape}</g>;
          const fig = figures[(i * 3 + k) % figures.length]!;
          return (
            <g key={k}>
              {nicheShape}
              <circle cx={r2(cx)} cy={r2(y0 - nh * 0.7)} r={r2(Math.min(2.4, nh * 0.1))} fill={fig} />
              <path d={`M${r2(cx - 2.6)} ${r2(y0 - 3)} Q${r2(cx)} ${r2(y0 - nh * 0.75)} ${r2(cx + 2.6)} ${r2(y0 - 3)}Z`} fill={fig} />
            </g>
          );
        })}
      </g>,
    );
  }
  const roofY = baseY - towerH;
  return (
    <g>
      {parts}
      <path d={`M${x - topW / 2} ${roofY} C${x - topW / 2} ${roofY - roofH * 1.2} ${x + topW / 2} ${roofY - roofH * 1.2} ${x + topW / 2} ${roofY}Z`} style={{ fill: body }} />
      <path d={`M${x - topW / 2} ${roofY} C${x - topW / 2} ${roofY - roofH * 0.6} ${x + topW / 2} ${roofY - roofH * 0.6} ${x + topW / 2} ${roofY}Z`} style={{ fill: shade }} opacity="0.45" />
      {Array.from({ length: 5 }, (_, k) => {
        const kx = x - topW * 0.36 + (topW * 0.72 * k) / 4;
        const ky = roofY - roofH * 0.9 + Math.abs(k - 2) * roofH * 0.08;
        return <path key={k} d={`M${kx} ${ky - roofH * 0.55} C${kx + 3} ${ky - roofH * 0.3} ${kx + 4} ${ky - 2} ${kx} ${ky} C${kx - 4} ${ky - 2} ${kx - 3} ${ky - roofH * 0.3} ${kx} ${ky - roofH * 0.55}Z`} fill={gold} />;
      })}
    </g>
  );
}

/** Onion dome with a finial, centred on (x, baseY). */
export function Dome({ x, baseY, w, fill, gold = '#f2c14e' }: { x: number; baseY: number; w: number; fill: string; gold?: string }) {
  const h = w * 0.95;
  return (
    <g>
      <path
        d={`M${x - w / 2} ${baseY} C${x - w * 0.62} ${baseY - h * 0.45} ${x - w * 0.18} ${baseY - h * 0.62} ${x} ${baseY - h} C${x + w * 0.18} ${baseY - h * 0.62} ${x + w * 0.62} ${baseY - h * 0.45} ${x + w / 2} ${baseY}Z`}
        style={{ fill }}
      />
      <path d={`M${x} ${baseY - h} V${baseY - h - w * 0.22}`} stroke={gold} strokeWidth={Math.max(1.5, w * 0.03)} />
      <circle cx={x} cy={baseY - h - w * 0.24} r={Math.max(1.8, w * 0.035)} fill={gold} />
      <path d={`M${x - w * 0.08} ${baseY - h - w * 0.1} H${x + w * 0.08}`} stroke={gold} strokeWidth={Math.max(1, w * 0.02)} />
    </g>
  );
}

/** Chhatri: a small domed pavilion on pillars. */
export function Chhatri({ x, baseY, w, fill, gold }: { x: number; baseY: number; w: number; fill: string; gold?: string }) {
  const pillarH = w * 0.6;
  return (
    <g>
      <Dome x={x} baseY={baseY - pillarH - w * 0.08} w={w * 0.8} fill={fill} gold={gold} />
      <rect x={x - w / 2} y={baseY - pillarH - w * 0.1} width={w} height={w * 0.1} style={{ fill }} />
      {[-0.4, 0, 0.4].map((k) => (
        <rect key={k} x={x + k * w - w * 0.04} y={baseY - pillarH} width={w * 0.08} height={pillarH} style={{ fill }} />
      ))}
    </g>
  );
}

// ─────────────────────────── Krishna motifs ───────────────────────────

/** A filled peacock plume rooted at (x, y), leaning by `angle` degrees. */
export function PeacockPlume({ x, y, length = 300, angle = 0 }: { x: number; y: number; length?: number; angle?: number }) {
  const id = useId();
  const barbs: ReactElement[] = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const py = -t * length * 0.82;
    const spread = Math.sin(t * Math.PI) * length * 0.2 + 6;
    barbs.push(<path key={`l${i}`} d={`M0 ${r2(py)} Q${r2(-spread * 0.6)} ${r2(py - 10)} ${r2(-spread)} ${r2(py - 26)}`} stroke="#2e7d5b" strokeWidth="2" fill="none" opacity="0.85" />);
    barbs.push(<path key={`r${i}`} d={`M0 ${r2(py)} Q${r2(spread * 0.6)} ${r2(py - 10)} ${r2(spread)} ${r2(py - 26)}`} stroke="#3f9c6f" strokeWidth="2" fill="none" opacity="0.85" />);
  }
  const eyeY = -length * 0.84;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <defs>
        <radialGradient id={`${id}e`} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#0b1f4d" />
          <stop offset="0.35" stopColor="#1e63a8" />
          <stop offset="0.55" stopColor="#1fa38a" />
          <stop offset="0.8" stopColor="#d9b44a" />
          <stop offset="1" stopColor="#2e7d5b" />
        </radialGradient>
      </defs>
      <path d={`M0 0 Q4 ${r2(-length * 0.5)} 0 ${r2(-length * 0.95)}`} stroke="#c9a54a" strokeWidth="3" fill="none" />
      {barbs}
      <ellipse cx="0" cy={r2(eyeY)} rx={r2(length * 0.13)} ry={r2(length * 0.17)} fill={`url(#${id}e)`} />
      <ellipse cx="0" cy={r2(eyeY + length * 0.02)} rx={r2(length * 0.05)} ry={r2(length * 0.07)} fill="#0b1f4d" />
    </g>
  );
}

/** Krishna's bansuri: a golden flute with finger holes, bands and a tassel. */
export function Bansuri({ x, y, length = 420, angle = -18 }: { x: number; y: number; length?: number; angle?: number }) {
  const id = useId();
  const w = length;
  const h = length * 0.045;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset="0.45" stopColor="#d9a53a" />
          <stop offset="1" stopColor="#8a5a12" />
        </linearGradient>
      </defs>
      <rect x={r2(-w / 2)} y={r2(-h / 2)} width={w} height={r2(h)} rx={r2(h / 2)} fill={`url(#${id}f)`} />
      {[0.12, 0.2, 0.8].map((k) => (
        <rect key={k} x={r2(-w / 2 + w * k)} y={r2(-h / 2)} width={r2(w * 0.02)} height={r2(h)} fill="#9b1c1c" />
      ))}
      {[0.38, 0.45, 0.52, 0.59, 0.66, 0.73].map((k) => (
        <ellipse key={k} cx={r2(-w / 2 + w * k)} cy="0" rx={r2(h * 0.22)} ry={r2(h * 0.2)} fill="#3b2508" />
      ))}
      <path d={`M${r2(-w / 2 + w * 0.12)} ${r2(h / 2)} q-6 40 4 80 q-10 20 -2 46`} stroke="#b91c1c" strokeWidth="3" fill="none" />
      <circle cx={r2(-w / 2 + w * 0.12 + 2)} cy={r2(h / 2 + 128)} r="7" fill="#f6c343" />
    </g>
  );
}

/** A kadamba tree: a dark trunk, a leafy crown lit from one side, and golden flower balls. */
export function KadambaTree({ x, y, size = 1, color, flower = '#f6c343' }: { x: number; y: number; size?: number; color: string; flower?: string }) {
  const crowns: Array<[number, number, number]> = [
    [-70, -190, 70],
    [10, -220, 90],
    [90, -180, 70],
    [-20, -150, 60],
    [60, -140, 55],
  ];
  // Leaf clumps around each crown's rim make a soft, uneven silhouette.
  const clumps = crowns.flatMap(([cx, cy, r], c) =>
    Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + rand(i, 51 + c) * 0.6;
      return { x: r2(cx + Math.cos(a) * r * 0.82), y: r2(cy + Math.sin(a) * r * 0.82), r: r2(r * (0.3 + rand(i, 53 + c) * 0.14)), lit: Math.cos(a) < -0.2 && Math.sin(a) < 0.3 };
    }),
  );
  const flowers = Array.from({ length: 30 }, (_, i) => {
    const [cx, cy, r] = crowns[i % crowns.length]!;
    const a = rand(i, 61) * TAU;
    const d = Math.sqrt(rand(i, 67)) * r * 0.85;
    return { x: r2(cx + Math.cos(a) * d), y: r2(cy + Math.sin(a) * d), r: r2(3 + rand(i, 71) * 3.2) };
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M-10 0 C-8 -60 -24 -110 -40 -150 M8 0 C10 -70 30 -120 60 -150" style={{ stroke: color }} strokeWidth="14" fill="none" strokeLinecap="round" />
      {crowns.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} style={{ fill: color }} />
      ))}
      {clumps.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r} style={{ fill: color }} />
      ))}
      {/* Moonlight catches the clumps on the upper left. */}
      {clumps
        .filter((c) => c.lit)
        .map((c, i) => (
          <circle key={`h${i}`} cx={c.x} cy={c.y} r={c.r} fill="#ffffff" opacity="0.09" />
        ))}
      {flowers.map((f, i) => (
        <g key={`f${i}`}>
          <circle cx={f.x} cy={f.y} r={r2(f.r * 1.8)} fill={flower} opacity="0.18" />
          <circle cx={f.x} cy={f.y} r={f.r} fill={flower} opacity="0.95" />
        </g>
      ))}
    </g>
  );
}

/** A glowing full moon. */
export function Moon({ x, y, r, color = '#fff6d8' }: { x: number; y: number; r: number; color?: string }) {
  const id = useId();
  return (
    <g>
      <defs>
        <radialGradient id={`${id}m`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 2.4} fill={`url(#${id}m)`} />
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={r2(x - r * 0.3)} cy={r2(y - r * 0.2)} r={r2(r * 0.16)} fill="#e9dcb8" opacity="0.6" />
      <circle cx={r2(x + r * 0.28)} cy={r2(y + r * 0.25)} r={r2(r * 0.11)} fill="#e9dcb8" opacity="0.5" />
    </g>
  );
}
