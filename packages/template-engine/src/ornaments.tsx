import type { CSSProperties } from 'react';
import { Laurel, Lotus, PeacockFeather, StarField } from './ornaments-signature';

/**
 * Hand-built decorative SVGs. They use currentColor so templates recolour them
 * through CSS variables; no external assets or licenses are involved.
 */

type OrnamentProps = { className?: string; style?: CSSProperties; title?: string };

export function Mandala({ className, style }: OrnamentProps) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const inner = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="100" cy="100" r="96" opacity="0.5" />
        <circle cx="100" cy="100" r="88" strokeDasharray="2 4" />
        {petals.map((a) => (
          <path key={`o${a}`} d="M100 12 C112 36 112 56 100 72 C88 56 88 36 100 12Z" transform={`rotate(${a} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="44" />
        {inner.map((a) => (
          <path key={`i${a}`} d="M100 58 C108 72 108 82 100 92 C92 82 92 72 100 58Z" transform={`rotate(${a} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="12" />
        <circle cx="100" cy="100" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Paisley({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 120 160" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M60 150 C10 140 8 70 44 42 C64 26 96 30 100 60 C104 88 76 96 66 80 C58 66 72 56 80 64" />
        <path d="M58 136 C24 126 24 78 50 58 C66 46 86 52 88 68" opacity="0.7" />
        <circle cx="46" cy="104" r="6" />
        <circle cx="46" cy="104" r="2" fill="currentColor" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={30 + i * 6} cy={128 - i * 12} r="1.6" fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}

export function FloralCorner({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 160 160" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M4 4 C60 10 100 40 120 100" />
        <path d="M4 4 C10 60 40 100 100 120" />
        {[
          [44, 28],
          [28, 44],
          [78, 52],
          [52, 78],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-9" rx="4.5" ry="9" transform={`rotate(${a})`} />
            ))}
            <circle r="3" fill="currentColor" />
          </g>
        ))}
        <path d="M100 30 C110 40 108 54 96 58" />
        <path d="M30 100 C40 110 54 108 58 96" />
      </g>
    </svg>
  );
}

export function GeometricStar({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="45" y="45" width="110" height="110" />
        <rect x="45" y="45" width="110" height="110" transform="rotate(45 100 100)" />
        <rect x="65" y="65" width="70" height="70" opacity="0.7" />
        <rect x="65" y="65" width="70" height="70" transform="rotate(45 100 100)" opacity="0.7" />
        <circle cx="100" cy="100" r="22" />
        <circle cx="100" cy="100" r="96" opacity="0.35" />
      </g>
    </svg>
  );
}

export function Confetti({ className, style }: OrnamentProps) {
  const bits = [
    [20, 30, 0, 'var(--t-primary)'],
    [60, 14, 30, 'var(--t-secondary)'],
    [110, 36, 60, 'var(--t-accent)'],
    [160, 18, 15, 'var(--t-primary)'],
    [185, 50, 80, 'var(--t-secondary)'],
    [40, 70, 45, 'var(--t-accent)'],
    [140, 76, 20, 'var(--t-primary)'],
    [90, 90, 70, 'var(--t-secondary)'],
  ] as const;
  return (
    <svg viewBox="0 0 200 110" className={className} style={style} aria-hidden="true">
      {bits.map(([x, y, r, c], i) =>
        i % 2 ? (
          <circle key={i} cx={x} cy={y} r="4" fill={c} />
        ) : (
          <rect key={i} x={x} y={y} width="10" height="4" rx="2" fill={c} transform={`rotate(${r} ${x} ${y})`} />
        ),
      )}
    </svg>
  );
}

/** Jharokha / palace arch outline used as a frame. */
export function ArchFrame({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <path strokeWidth="2" d="M12 396 L12 150 C12 70 80 22 150 8 C220 22 288 70 288 150 L288 396" />
        <path strokeWidth="1" opacity="0.6" d="M26 396 L26 156 C26 84 88 40 150 26 C212 40 274 84 274 156 L274 396" />
        <path strokeWidth="1" d="M150 8 L150 -2" />
      </g>
    </svg>
  );
}

/** Temple gopuram-inspired top border (South Indian templates). */
export function TempleBorder({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${i * 40} 38 L${i * 40} 22 L${i * 40 + 8} 22 L${i * 40 + 8} 12 L${i * 40 + 20} 2 L${i * 40 + 32} 12 L${i * 40 + 32} 22 L${i * 40 + 40} 22 L${i * 40 + 40} 38`} />
        ))}
        <path d="M0 38 L400 38" />
      </g>
    </svg>
  );
}

export type OrnamentName = 'none' | 'mandala' | 'paisley' | 'floral' | 'geometric' | 'confetti' | 'lotus' | 'peacock' | 'stars' | 'laurel';

/** Two crossed peacock feathers in a square box (usable as a background motif). */
export function PeacockPair({ className, style }: OrnamentProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <svg x="40" y="0" width="80" height="200" viewBox="0 0 80 220" overflow="visible">
        <g transform="rotate(-24 40 200)">
          <PeacockFeather />
        </g>
      </svg>
      <svg x="80" y="0" width="80" height="200" viewBox="0 0 80 220" overflow="visible">
        <g transform="rotate(24 40 200)">
          <PeacockFeather />
        </g>
      </svg>
    </svg>
  );
}

export function Ornament({ name, className, style }: { name: OrnamentName } & OrnamentProps) {
  switch (name) {
    case 'mandala':
      return <Mandala className={className} style={style} />;
    case 'paisley':
      return <Paisley className={className} style={style} />;
    case 'floral':
      return <FloralCorner className={className} style={style} />;
    case 'geometric':
      return <GeometricStar className={className} style={style} />;
    case 'confetti':
      return <Confetti className={className} style={style} />;
    case 'lotus':
      return <Lotus className={className} style={style} />;
    case 'peacock':
      return <PeacockPair className={className} style={style} />;
    case 'stars':
      return <StarField className={className} style={style} />;
    case 'laurel':
      return <Laurel className={className} style={style} />;
    default:
      return null;
  }
}

/** Small centred divider between sections. */
export function Divider({ ornament }: { ornament: OrnamentName }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-3 py-2 text-[var(--t-secondary)]">
      <span className="h-px w-16 bg-current opacity-60" />
      {ornament === 'confetti' || ornament === 'stars' ? (
        <span className="text-lg tracking-[0.4em]">✦</span>
      ) : ornament === 'lotus' ? (
        <Lotus className="h-5 w-8" />
      ) : ornament === 'laurel' ? (
        <Laurel className="h-6 w-7" />
      ) : ornament === 'peacock' ? (
        <svg viewBox="0 0 24 24" className="size-5">
          <ellipse cx="12" cy="12" rx="7" ry="10" fill="none" stroke="currentColor" />
          <ellipse cx="12" cy="13" rx="3.5" ry="5" fill="currentColor" />
        </svg>
      ) : ornament === 'geometric' ? (
        <svg viewBox="0 0 20 20" className="size-4">
          <rect x="4" y="4" width="12" height="12" transform="rotate(45 10 10)" fill="none" stroke="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5">
          <path d="M12 2 C14 8 16 10 22 12 C16 14 14 16 12 22 C10 16 8 14 2 12 C8 10 10 8 12 2Z" fill="currentColor" />
        </svg>
      )}
      <span className="h-px w-16 bg-current opacity-60" />
    </div>
  );
}

/** Background pattern as a CSS background-image (data URI, currentColor-free). */
export function patternStyle(pattern: string, color: string, strength?: number): CSSProperties {
  const c = encodeURIComponent(color);
  const o = (fallback: number) => strength ?? fallback;
  const svg = (w: number, h: number, body: string) => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'%3E${body}%3C/svg%3E")`,
  });
  switch (pattern) {
    case 'dots':
      return svg(24, 24, `%3Ccircle cx='12' cy='12' r='1.4' fill='${c}' fill-opacity='${o(0.22)}'/%3E`);
    case 'jaali':
      return svg(40, 40, `%3Cpath d='M20 0 L40 20 L20 40 L0 20Z M20 8 L32 20 L20 32 L8 20Z' fill='none' stroke='${c}' stroke-opacity='${o(0.12)}'/%3E`);
    case 'waves':
      return svg(60, 20, `%3Cpath d='M0 10 Q15 0 30 10 T60 10' fill='none' stroke='${c}' stroke-opacity='${o(0.14)}'/%3E`);
    case 'rangoli': {
      // A kolam flower: eight petals, a dotted ring and corner dots.
      const petals = Array.from({ length: 8 }, (_, i) => `%3Cpath d='M48 48 C53 38 53 30 48 20 C43 30 43 38 48 48Z' transform='rotate(${i * 45} 48 48)'/%3E`).join('');
      const dots = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `%3Ccircle cx='${(48 + Math.cos(a) * 34).toFixed(1)}' cy='${(48 + Math.sin(a) * 34).toFixed(1)}' r='2'/%3E`;
      }).join('');
      return svg(96, 96, `%3Cg fill='${c}' fill-opacity='${o(0.14)}'%3E${petals}${dots}%3Ccircle cx='0' cy='0' r='4'/%3E%3Ccircle cx='96' cy='0' r='4'/%3E%3Ccircle cx='0' cy='96' r='4'/%3E%3Ccircle cx='96' cy='96' r='4'/%3E%3C/g%3E`);
    }
    case 'damask':
      return svg(
        64,
        64,
        `%3Cg fill='none' stroke='${c}' stroke-opacity='${o(0.12)}' stroke-width='1.2'%3E%3Cpath d='M32 6 C44 18 44 26 32 32 C20 26 20 18 32 6Z M32 58 C44 46 44 38 32 32 C20 38 20 46 32 58Z M6 32 C18 20 26 20 32 32 C26 44 18 44 6 32Z M58 32 C46 20 38 20 32 32 C38 44 46 44 58 32Z'/%3E%3Ccircle cx='32' cy='32' r='3'/%3E%3C/g%3E`,
      );
    case 'confetti': {
      const bits = [
        [8, 10, 20],
        [40, 6, -30],
        [26, 34, 60],
        [54, 44, 10],
        [12, 52, -50],
      ]
        .map(([x, y, r]) => `%3Crect x='${x}' y='${y}' width='7' height='3' rx='1.5' transform='rotate(${r} ${x} ${y})'/%3E`)
        .join('');
      return svg(64, 64, `%3Cg fill='${c}' fill-opacity='${o(0.3)}'%3E${bits}%3Ccircle cx='48' cy='20' r='2.2'/%3E%3Ccircle cx='30' cy='56' r='2'/%3E%3C/g%3E`);
    }
    default:
      return {};
  }
}
