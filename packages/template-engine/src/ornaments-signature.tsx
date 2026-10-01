import type { CSSProperties } from 'react';

/**
 * Motifs for the Signature collection: hand-built SVGs using currentColor (or
 * theme CSS variables) so every template recolours them. No external assets.
 */

type P = { className?: string; style?: CSSProperties };

export function Lotus({ className, style }: P) {
  const petals = [-60, -35, -12, 12, 35, 60];
  return (
    <svg viewBox="0 0 200 120" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
        {petals.map((a) => (
          <path key={a} d="M100 104 C82 80 84 44 100 18 C116 44 118 80 100 104Z" transform={`rotate(${a} 100 104)`} opacity={Math.abs(a) > 40 ? 0.6 : 1} />
        ))}
        <path d="M100 104 C90 84 92 58 100 40 C108 58 110 84 100 104Z" fill="currentColor" fillOpacity="0.15" />
        <path d="M40 110 Q100 96 160 110" />
        <path d="M58 116 Q100 106 142 116" opacity="0.6" />
      </g>
    </svg>
  );
}

/** Peacock feather (mor pankh), Krishna's emblem. */
export function PeacockFeather({ className, style }: P) {
  const barbs = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg viewBox="0 0 80 220" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M40 218 C42 170 40 110 40 40" strokeWidth="1.6" />
        {barbs.map((i) => {
          const y = 200 - i * 11;
          const spread = 10 + Math.min(i, 9) * 2.4;
          return (
            <g key={i} opacity={0.35 + i * 0.04}>
              <path d={`M40 ${y} Q${40 - spread} ${y - 10} ${40 - spread - 4} ${y - 22}`} />
              <path d={`M40 ${y} Q${40 + spread} ${y - 10} ${40 + spread + 4} ${y - 22}`} />
            </g>
          );
        })}
        <ellipse cx="40" cy="46" rx="22" ry="30" fill="var(--t-accent, currentColor)" fillOpacity="0.35" />
        <ellipse cx="40" cy="50" rx="14" ry="20" fill="var(--t-secondary, currentColor)" fillOpacity="0.55" stroke="none" />
        <ellipse cx="40" cy="54" rx="8" ry="11" fill="var(--t-primary, currentColor)" stroke="none" />
        <ellipse cx="40" cy="56" rx="3.5" ry="5" fill="var(--t-bg, #fff)" fillOpacity="0.6" stroke="none" />
      </g>
    </svg>
  );
}

/** Scattered four-point stars; deterministic positions. */
export function StarField({ className, style, count = 26 }: P & { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    const x = (i * 73 + 17) % 200;
    const y = (i * 47 + 11) % 120;
    const r = 1 + ((i * 7) % 4) * 0.8;
    return { x, y, r, i };
  });
  return (
    <svg viewBox="0 0 200 120" className={className} style={style} aria-hidden="true">
      {stars.map(({ x, y, r, i }) => (
        <path
          key={i}
          className="bulava-twinkle"
          style={{ animationDelay: `${(i % 7) * 0.4}s` }}
          d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5}Z`}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function Laurel({ className, style }: P) {
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  const side = (flip: boolean) =>
    leaves.map((i) => {
      const a = (i / 8) * 150 + 15;
      const rad = ((180 - a) * Math.PI) / 180;
      const cx = 100 + (flip ? -1 : 1) * Math.cos(rad) * 70;
      const cy = 90 - Math.sin(rad) * 70;
      const rot = flip ? -a + 90 : a - 90;
      return <ellipse key={`${flip}${i}`} cx={cx} cy={cy} rx="5" ry="12" transform={`rotate(${rot} ${cx} ${cy})`} />;
    });
  return (
    <svg viewBox="0 0 200 170" className={className} style={style} aria-hidden="true">
      <g fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1">
        <path d="M30 94 A70 70 0 0 0 96 160" fill="none" />
        <path d="M170 94 A70 70 0 0 1 104 160" fill="none" />
        {side(false)}
        {side(true)}
      </g>
    </svg>
  );
}

/** A glowing paper lantern on a string. */
export function Lantern({ className, style, glow = true }: P & { glow?: boolean }) {
  return (
    <svg viewBox="0 0 60 120" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id="bulava-lantern-glow" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#fff4c2" stopOpacity="0.95" />
          <stop offset="60%" stopColor="var(--t-accent, #f6c453)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--t-secondary, #d4891c)" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {glow ? <circle cx="30" cy="70" r="30" fill="#ffd27a" opacity="0.25" /> : null}
      <path d="M30 0 L30 30" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="22" y="30" width="16" height="6" rx="2" fill="currentColor" />
      <path d="M14 42 C8 60 8 80 14 98 L46 98 C52 80 52 60 46 42Z" fill="url(#bulava-lantern-glow)" stroke="currentColor" strokeWidth="1" />
      {[22, 30, 38].map((x) => (
        <path key={x} d={`M${x} 42 C${x - 2} 62 ${x - 2} 80 ${x} 98`} fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
      ))}
      <rect x="18" y="36" width="24" height="6" rx="2" fill="currentColor" />
      <rect x="18" y="98" width="24" height="6" rx="2" fill="currentColor" />
      <path d="M30 104 L30 116" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="30" cy="117" r="2" fill="currentColor" />
    </svg>
  );
}

/** Cathedral rose window. */
export function RoseWindow({ className, style }: P) {
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="100" cy="100" r="92" />
        <circle cx="100" cy="100" r="80" opacity="0.6" />
        <circle cx="100" cy="100" r="26" />
        <circle cx="100" cy="100" r="10" fill="currentColor" fillOpacity="0.3" />
        {spokes.map((a) => (
          <g key={a} transform={`rotate(${a} 100 100)`}>
            <path d="M100 74 L100 20" />
            <path d="M100 74 C116 58 116 38 100 22 C84 38 84 58 100 74Z" fill="currentColor" fillOpacity="0.08" />
            <circle cx="100" cy="14" r="5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Pointed gothic arch frame (cathedral hero). */
export function GothicArch({ className, style }: P) {
  return (
    <svg viewBox="0 0 300 420" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <path strokeWidth="2" d="M14 418 L14 190 Q14 70 150 8 Q286 70 286 190 L286 418" />
        <path strokeWidth="1" opacity="0.55" d="M30 418 L30 196 Q30 88 150 28 Q270 88 270 196 L270 418" />
      </g>
    </svg>
  );
}

/** Layered sea waves for destination templates. */
export function SeaWaves({ className, style }: P) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <path d="M0 60 Q50 30 100 60 T200 60 T300 60 T400 60 L400 120 L0 120Z" fill="var(--t-secondary, currentColor)" fillOpacity="0.35" />
      <path d="M0 78 Q50 52 100 78 T200 78 T300 78 T400 78 L400 120 L0 120Z" fill="var(--t-primary, currentColor)" fillOpacity="0.45" />
      <path d="M0 96 Q50 74 100 96 T200 96 T300 96 T400 96 L400 120 L0 120Z" fill="var(--t-primary, currentColor)" fillOpacity="0.85" />
    </svg>
  );
}

export function Crescent({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="currentColor" opacity="0.12" />
      <path d="M62 10 A42 42 0 1 0 62 90 A34 34 0 1 1 62 10Z" fill="currentColor" />
    </svg>
  );
}

/** Heraldic crest frame for monogram heroes. */
export function CrestFrame({ className, style }: P) {
  return (
    <svg viewBox="0 0 200 240" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <path strokeWidth="2" d="M100 8 L180 36 L180 120 C180 176 140 214 100 232 C60 214 20 176 20 120 L20 36Z" />
        <path strokeWidth="1" opacity="0.6" d="M100 22 L166 46 L166 120 C166 168 132 200 100 216 C68 200 34 168 34 120 L34 46Z" />
        <path strokeWidth="1.4" d="M76 8 L88 0 L100 8 L112 0 L124 8" />
      </g>
    </svg>
  );
}

/** One leaf of an ornate palace gate (mirrored for the other side). */
export function GateLeaf({ className, style }: P) {
  const bars = Array.from({ length: 7 }, (_, i) => 18 + i * 22);
  return (
    <svg viewBox="0 0 180 400" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M6 396 L6 120 Q6 40 176 10 L176 396Z" />
        {bars.map((x) => (
          <path key={x} d={`M${x} 396 L${x} ${120 - x * 0.4}`} strokeWidth="2" />
        ))}
        {[160, 250, 340].map((y) => (
          <path key={y} d={`M6 ${y} L176 ${y}`} strokeWidth="2" />
        ))}
        {[205, 295].map((y) => (
          <g key={y}>
            {[40, 90, 140].map((x) => (
              <circle key={x} cx={x} cy={y} r="14" strokeWidth="1.6" />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
