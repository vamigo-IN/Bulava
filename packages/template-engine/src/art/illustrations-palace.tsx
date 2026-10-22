import type { ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { Blossom, Leaf, Rose } from './illustrations-nature';
import { blend, cuspedHead, hex, Lit, Metal, NATURE, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { r2, rand } from './motifs';

/**
 * A Rajput palace (The Royal Heirloom): a carved sandstone arcade, a single pillar, a domed chhatri, a
 * palace front, the wedding mandap, a bed of garden flowers and a hanging floral strand. Stone takes the
 * tint warmed toward the palette's gold (lit stone reads on a cream page), metal is the palette's gold,
 * light comes from the upper left; flowers take the palette's pinks and creams, leaves the tint (sage).
 * Scene rules: rand()/r2(), no trigonometry, inline styles, no JSX at module load.
 */

/** Lit stone: the tint warmed a fifth of the way toward the palette's gold. */
const stoneOf = (color: string, colors: ThemeColors) => blend(hex(color), hex(colors.secondary), 0.22);

/** Window light (a natural colour, like a flame). */
const LAMPLIGHT = '#ffe2a8';

/** An eight-petal carved lotus roundel centred on 0 0, radius 1 (scale it into place). */
function Roundel({ fill, line, centre }: { fill: string; line: string; centre: string }) {
  const petals: ReactNode[] = [];
  for (let i = 0; i < 8; i++) petals.push(<ellipse key={i} cx="0" cy="-0.55" rx="0.2" ry="0.42" fill={fill} stroke={line} strokeWidth="0.05" transform={`rotate(${i * 45})`} />);
  return (
    <g>
      <circle r="1" fill="none" stroke={line} strokeWidth="0.07" />
      {petals}
      <circle r="0.24" fill={centre} stroke={line} strokeWidth="0.05" />
    </g>
  );
}

// ─────────────────────────── Arcade ───────────────────────────

/**
 * A carved sandstone arcade drawn to its frame: a cornice with dentils and a jaali frieze, N cusped arches
 * (bays = round(w / 0.8h)) with lotus roundels in the spandrels, a carved lotus finial on each keystone and a
 * double gold hairline along each arch, the arch's darker reveal inside it, a full pillar at each end lit from
 * the upper left, and between the bays a carved corbel from which a slim gilt lotus bud hangs (no pillar crosses what
 * is seen through the arches). The openings are transparent, and the foot fades away, so a photograph behind it
 * reads as the view from a palace balcony.
 */
export function PalaceArcade({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const stone = stoneOf(color, colors);
  const line = shade(stone, 0.3);
  const gold = hex(colors.secondary);
  const bays = Math.max(1, Math.round(w / (0.8 * h)));
  const pw = r2(Math.max(14, Math.min(h * 0.06, (w / bays) * 0.1)));
  const cornice = r2(Math.max(14, h * 0.038));
  const frieze = r2(Math.max(10, h * 0.028));
  const top = cornice + frieze;
  const pitch = (w - pw) / bays;
  const open = pitch - pw;
  const headH = r2(Math.min(open / 3, h * 0.3));
  const apex = r2(top + h * 0.025);
  const spring = r2(apex + headH);
  const capH = r2(pw * 0.8);
  const openings = Array.from({ length: bays }, (_, i) => {
    const x0 = r2(i * pitch + pw);
    return `M${x0} ${r2(h + 2)} V${spring} ${cuspedHead(x0, spring, r2(open), headH, false)} V${r2(h + 2)}Z`;
  });
  const heads = Array.from({ length: bays }, (_, i) => cuspedHead(r2(i * pitch + pw), spring, r2(open), headH));
  // The second gold hairline, just outside the arch's edge, and the carved moulding beyond it.
  const giltHeads = Array.from({ length: bays }, (_, i) => cuspedHead(r2(i * pitch + pw - pw * 0.14), r2(spring), r2(open + pw * 0.28), r2(headH + pw * 0.24)));
  const outerHeads = Array.from({ length: bays }, (_, i) => cuspedHead(r2(i * pitch + pw - pw * 0.34), r2(spring), r2(open + pw * 0.68), r2(headH + pw * 0.58)));
  const pillarAt = (i: number) => r2(i * pitch);
  // Between the bays: the stone stops at the springing, the arches meet on a corbel, and a slim bud (never
  // wider than 16) hangs from it on a short chain.
  const budW = r2(Math.min(15, pw * 0.36));
  const budTop = r2(spring + capH + Math.max(6, headH * 0.1));
  const budH = r2(budW * 1.9);
  const roundelR = r2(Math.min((spring - top) * 0.3, pitch * 0.07));
  // A gilt lotus bud rising from each keystone into the frieze.
  const finialH = r2(apex - top + frieze * 0.6);
  const finialW = r2(Math.max(5, pw * 0.34));
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="xMinYMin slice" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(stone, 0.3)} />
          <stop offset="0.45" stopColor={stone} />
          <stop offset="1" stopColor={shade(stone, 0.14)} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.8" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint(stone, 0.38)} />
          <stop offset="0.3" stopColor={tint(stone, 0.12)} />
          <stop offset="0.72" stopColor={stone} />
          <stop offset="1" stopColor={shade(stone, 0.22)} />
        </linearGradient>
        {/* Light from above: the cornice lit, the stone deepening toward the foot. */}
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
        </linearGradient>
        <Metal id={`${id}g`} base={gold} foil={foil ?? true} x2={r2(w)} y2={r2(h * 0.5)} />
        <pattern id={`${id}d`} width={r2(cornice * 0.5)} height={r2(cornice * 0.32)} patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width={r2(cornice * 0.28)} height={r2(cornice * 0.32)} fill={shade(stone, 0.16)} />
        </pattern>
        <pattern id={`${id}j`} width={r2(frieze * 0.72)} height={r2(frieze * 0.72)} patternUnits="userSpaceOnUse">
          <path d={`M${r2(frieze * 0.36)} ${r2(frieze * 0.06)} L${r2(frieze * 0.66)} ${r2(frieze * 0.36)} L${r2(frieze * 0.36)} ${r2(frieze * 0.66)} L${r2(frieze * 0.06)} ${r2(frieze * 0.36)}Z`} fill="none" stroke={line} strokeWidth={r2(Math.max(0.6, frieze * 0.05))} opacity="0.7" />
          <circle cx={r2(frieze * 0.36)} cy={r2(frieze * 0.36)} r={r2(frieze * 0.07)} fill={line} opacity="0.55" />
        </pattern>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width={r2(w)} height={r2(h)}>
          <rect width={r2(w)} height={r2(h)} fill={`url(#${id}f)`} />
          {openings.map((d, i) => (
            <path key={i} d={d} fill="#000" />
          ))}
          {Array.from({ length: Math.max(0, bays - 1) }, (_, k) => (
            <rect key={k} x={r2(pillarAt(k + 1) - 1)} y={spring} width={r2(pw + 2)} height={r2(h)} fill="#000" />
          ))}
        </mask>
        <clipPath id={`${id}o`}>
          {openings.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <g id={`${id}r`}>
          <Roundel fill={tint(stone, 0.18)} line={line} centre={gold} />
        </g>
      </defs>
      {/* Inside each opening: the arch's reveal (its stone thickness, in shade), then its soft shadow over the view. */}
      <g clipPath={`url(#${id}o)`}>
        {heads.map((d, i) => (
          <path key={`s${i}`} d={d} fill="none" stroke={shade(stone, 0.55)} strokeWidth={r2(Math.max(14, pw * 1.3))} opacity="0.16" />
        ))}
        {heads.map((d, i) => (
          <path key={`r${i}`} d={d} fill="none" stroke={shade(stone, 0.34)} strokeWidth={r2(Math.max(6, pw * 0.42))} opacity="0.85" />
        ))}
      </g>
      <g mask={`url(#${id}m)`}>
        <rect width={r2(w)} height={r2(h)} fill={`url(#${id}s)`} />
        <rect width={r2(w)} height={r2(h)} fill={`url(#${id}v)`} />
        {/* Cornice, dentils and the jaali frieze. */}
        <rect width={r2(w)} height={r2(cornice * 0.62)} fill={tint(stone, 0.08)} />
        <path d={`M0 ${r2(cornice * 0.62)} H${r2(w)} M0 ${r2(cornice * 0.18)} H${r2(w)}`} stroke={line} strokeWidth="0.9" opacity="0.6" />
        <rect y={r2(cornice * 0.66)} width={r2(w)} height={r2(cornice * 0.32)} fill={`url(#${id}d)`} opacity="0.7" />
        <rect y={r2(cornice)} width={r2(w)} height={r2(frieze)} fill={shade(stone, 0.06)} />
        <rect y={r2(cornice)} width={r2(w)} height={r2(frieze)} fill={`url(#${id}j)`} opacity="0.75" />
        <rect y={r2(top)} width={r2(w)} height={r2(Math.max(3, h * 0.008))} fill={shade(stone, 0.4)} opacity="0.18" />
        <path d={`M0 ${r2(cornice)} H${r2(w)} M0 ${r2(top)} H${r2(w)}`} stroke={line} strokeWidth="1" opacity="0.7" />
        <path d={`M0 ${r2(top + 2)} H${r2(w)}`} stroke={`url(#${id}g)`} strokeWidth="1.2" opacity="0.75" />
        {/* A carved moulding just outside each arch. */}
        {outerHeads.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={line} strokeWidth="0.9" opacity="0.55" />
        ))}
        {/* Lotus roundels in the spandrels. */}
        {Array.from({ length: bays + 1 }, (_, i) => (
          <use key={i} href={`#${id}r`} transform={`translate(${r2(pillarAt(i) + pw / 2)} ${r2(top + (spring - top) * 0.42)}) scale(${roundelR})`} />
        ))}
        {/* Pillars at both ends, pendant capitals between the bays. */}
        {Array.from({ length: bays + 1 }, (_, i) => {
          const x = pillarAt(i);
          const full = i === 0 || i === bays;
          const capTop = spring;
          return (
            <g key={i}>
              {full ? <rect x={x} y={r2(capTop + capH)} width={pw} height={r2(h - capTop - capH)} fill={`url(#${id}p)`} /> : null}
              {full ? <rect x={x} y={r2(capTop + capH)} width={pw} height={r2(h - capTop - capH)} fill={`url(#${id}v)`} /> : null}
              {full ? (
                <path
                  d={`M${r2(x)} ${r2(capTop + capH + (h - capTop - capH) * 0.33)} l${r2(pw / 4)} ${r2(pw * 0.22)} l${r2(pw / 4)} ${r2(-pw * 0.22)} l${r2(pw / 4)} ${r2(pw * 0.22)} l${r2(pw / 4)} ${r2(-pw * 0.22)}`}
                  fill="none"
                  stroke={line}
                  strokeWidth="0.9"
                  opacity="0.6"
                />
              ) : null}
              {/* Bracket capital with volutes, then the kalash collar (the pillars at the ends; the bays meet on a corbel). */}
              {full ? (
                <>
                  <path
                    d={`M${r2(x - pw * 0.32)} ${capTop} H${r2(x + pw * 1.32)} C${r2(x + pw * 1.32)} ${r2(capTop + capH * 0.6)} ${r2(x + pw * 1.04)} ${r2(capTop + capH * 0.7)} ${r2(x + pw)} ${r2(capTop + capH)} H${r2(x)} C${r2(x - pw * 0.04)} ${r2(capTop + capH * 0.7)} ${r2(x - pw * 0.32)} ${r2(capTop + capH * 0.6)} ${r2(x - pw * 0.32)} ${capTop}Z`}
                    fill={tint(stone, 0.2)}
                    stroke={line}
                    strokeWidth="0.9"
                  />
                  <circle cx={r2(x - pw * 0.12)} cy={r2(capTop + capH * 0.34)} r={r2(pw * 0.14)} fill="none" stroke={line} strokeWidth="0.8" />
                  <circle cx={r2(x + pw * 1.12)} cy={r2(capTop + capH * 0.34)} r={r2(pw * 0.14)} fill="none" stroke={line} strokeWidth="0.8" />
                  <ellipse cx={r2(x + pw / 2)} cy={r2(capTop + capH)} rx={r2(pw * 0.6)} ry={r2(pw * 0.18)} fill={tint(stone, 0.1)} stroke={line} strokeWidth="0.8" />
                </>
              ) : null}
              {full ? (
                <>
                  <path d={`M${r2(x - pw * 0.25)} ${r2(h)} V${r2(h - pw * 0.55)} H${r2(x + pw * 1.25)} V${r2(h)}`} fill={tint(stone, 0.08)} stroke={line} strokeWidth="0.8" />
                  <path
                    d={`M${r2(x - pw * 0.18)} ${r2(h - pw * 0.55)} C${r2(x - pw * 0.1)} ${r2(h - pw * 1.2)} ${r2(x + pw * 0.3)} ${r2(h - pw * 1.3)} ${r2(x + pw / 2)} ${r2(h - pw * 1.45)} C${r2(x + pw * 0.7)} ${r2(h - pw * 1.3)} ${r2(x + pw * 1.1)} ${r2(h - pw * 1.2)} ${r2(x + pw * 1.18)} ${r2(h - pw * 0.55)}Z`}
                    fill={tint(stone, 0.14)}
                    stroke={line}
                    strokeWidth="0.8"
                  />
                </>
              ) : null}
            </g>
          );
        })}
        {/* A double gold hairline along each arch: its edge, and a finer line just outside it. */}
        {heads.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={`url(#${id}g)`} strokeWidth={r2(Math.max(1.2, pw * 0.06))} opacity="0.9" />
        ))}
        {giltHeads.map((d, i) => (
          <path key={`g${i}`} d={d} fill="none" stroke={`url(#${id}g)`} strokeWidth={r2(Math.max(0.8, pw * 0.03))} opacity="0.75" />
        ))}
        {/* A carved lotus bud rising from each keystone, gilt. */}
        {heads.map((_, i) => {
          const cx = r2(i * pitch + pw + open / 2);
          const b = r2(apex + 1.5);
          const t = r2(apex - finialH);
          return (
            <g key={`f${i}`}>
              <path d={`M${r2(cx - finialW / 2)} ${b} C${r2(cx - finialW / 2)} ${r2(b - finialH * 0.5)} ${r2(cx - finialW * 0.12)} ${r2(t + finialH * 0.2)} ${cx} ${t} C${r2(cx + finialW * 0.12)} ${r2(t + finialH * 0.2)} ${r2(cx + finialW / 2)} ${r2(b - finialH * 0.5)} ${r2(cx + finialW / 2)} ${b}Z`} fill={`url(#${id}g)`} stroke={shade(gold, 0.3)} strokeWidth="0.5" />
              <path d={`M${r2(cx - finialW * 0.95)} ${b} C${r2(cx - finialW * 0.8)} ${r2(b - finialH * 0.34)} ${r2(cx - finialW * 0.3)} ${r2(b - finialH * 0.4)} ${cx} ${r2(b - finialH * 0.16)} C${r2(cx + finialW * 0.3)} ${r2(b - finialH * 0.4)} ${r2(cx + finialW * 0.8)} ${r2(b - finialH * 0.34)} ${r2(cx + finialW * 0.95)} ${b}Z`} fill={tint(stone, 0.22)} stroke={line} strokeWidth="0.6" />
            </g>
          );
        })}
      </g>
      {/* Between the bays: the arches meet on a carved corbel (an inverted lotus), and a slim gilt bud hangs from it on a short chain. */}
      {Array.from({ length: Math.max(0, bays - 1) }, (_, k) => {
        const cx = r2(pillarAt(k + 1) + pw / 2);
        const tip = r2(budTop + budH);
        const t = r2(spring - 1);
        const b = r2(spring + capH * 0.9);
        const half = pw * 0.62;
        return (
          <g key={k}>
            <path
              d={`M${r2(cx - half)} ${t} H${r2(cx + half)} C${r2(cx + half)} ${r2(t + capH * 0.42)} ${r2(cx + pw * 0.3)} ${r2(t + capH * 0.6)} ${r2(cx + pw * 0.2)} ${b} H${r2(cx - pw * 0.2)} C${r2(cx - pw * 0.3)} ${r2(t + capH * 0.6)} ${r2(cx - half)} ${r2(t + capH * 0.42)} ${r2(cx - half)} ${t}Z`}
              fill={`url(#${id}p)`}
              stroke={line}
              strokeWidth="0.8"
            />
            <path
              d={`M${r2(cx - half * 0.62)} ${r2(t + capH * 0.12)} C${r2(cx - half * 0.5)} ${r2(t + capH * 0.5)} ${r2(cx - pw * 0.14)} ${r2(t + capH * 0.66)} ${cx} ${r2(b - capH * 0.06)} C${r2(cx + pw * 0.14)} ${r2(t + capH * 0.66)} ${r2(cx + half * 0.5)} ${r2(t + capH * 0.5)} ${r2(cx + half * 0.62)} ${r2(t + capH * 0.12)}`}
              fill="none"
              stroke={line}
              strokeWidth="0.7"
              opacity="0.7"
            />
            <path d={`M${r2(cx - half)} ${r2(t + 1.2)} H${r2(cx + half)}`} stroke={`url(#${id}g)`} strokeWidth="1" opacity="0.85" />
            <path d={`M${cx} ${b} V${budTop}`} stroke={`url(#${id}g)`} strokeWidth={r2(Math.max(1, budW * 0.1))} />
            <ellipse cx={cx} cy={budTop} rx={r2(budW * 0.32)} ry={r2(budW * 0.14)} fill={`url(#${id}g)`} />
            <path
              d={`M${r2(cx - budW / 2)} ${r2(budTop + budH * 0.12)} C${r2(cx - budW / 2)} ${r2(budTop + budH * 0.55)} ${r2(cx - budW * 0.12)} ${r2(budTop + budH * 0.82)} ${cx} ${tip} C${r2(cx + budW * 0.12)} ${r2(budTop + budH * 0.82)} ${r2(cx + budW / 2)} ${r2(budTop + budH * 0.55)} ${r2(cx + budW / 2)} ${r2(budTop + budH * 0.12)} C${r2(cx + budW * 0.3)} ${r2(budTop + budH * 0.02)} ${r2(cx - budW * 0.3)} ${r2(budTop + budH * 0.02)} ${r2(cx - budW / 2)} ${r2(budTop + budH * 0.12)}Z`}
              fill={`url(#${id}g)`}
              stroke={shade(gold, 0.32)}
              strokeWidth="0.5"
            />
            <path d={`M${cx} ${r2(budTop + budH * 0.1)} V${r2(tip - budH * 0.12)} M${r2(cx - budW * 0.26)} ${r2(budTop + budH * 0.2)} C${r2(cx - budW * 0.24)} ${r2(budTop + budH * 0.5)} ${r2(cx - budW * 0.1)} ${r2(budTop + budH * 0.7)} ${cx} ${r2(tip - budH * 0.12)}`} fill="none" stroke={shade(gold, 0.35)} strokeWidth="0.5" opacity="0.7" />
            <circle cx={cx} cy={r2(tip + budW * 0.18)} r={r2(budW * 0.12)} fill={`url(#${id}g)`} />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────── One pillar ───────────────────────────

/**
 * One carved pillar standing on its plinth: a lotus-petal base, an octagonal shaft with a chevron band, a
 * kalash collar and a bracket capital with two volutes, and above it the spring of a cusped arch on its
 * inner (right) side. Flip it for the right edge of a page.
 */
export function PalacePillar({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const stone = stoneOf(color, colors);
  const line = shade(stone, 0.32);
  const gold = hex(colors.secondary);
  const petals: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const x = 12 + i * 11;
    petals.push(<path key={i} d={`M${x} 470 C${x - 2} 458 ${x + 3} 446 ${x + 5.5} 442 C${x + 8} 446 ${x + 13} 458 ${x + 11} 470Z`} fill={i % 2 ? tint(stone, 0.12) : tint(stone, 0.22)} stroke={line} strokeWidth="0.8" />);
  }
  const chevron = Array.from({ length: 6 }, (_, i) => `${i ? 'L' : 'M'}${22 + i * 9.2} ${i % 2 ? 252 : 244}`).join(' ');
  return (
    <svg viewBox="0 0 90 500" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint(stone, 0.4)} />
          <stop offset="0.28" stopColor={tint(stone, 0.14)} />
          <stop offset="0.7" stopColor={stone} />
          <stop offset="1" stopColor={shade(stone, 0.24)} />
        </linearGradient>
        <Metal id={`${id}g`} base={gold} foil={foil ?? true} x2={90} y2={200} />
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="90" height="110">
          <rect width="90" height="110" fill="#fff" />
          <path d="M84 100 C84 80 86 62 91 48 V112 H84Z" fill="#000" />
        </mask>
      </defs>
      {/* The stone above the capital, cut by the spring of an arch on the inner side. */}
      <g mask={`url(#${id}m)`}>
        <rect width="90" height="104" fill={`url(#${id}p)`} />
        <rect width="90" height="12" fill={tint(stone, 0.2)} />
        <path d="M0 12 H90 M0 4 H90" stroke={line} strokeWidth="0.9" opacity="0.6" />
        <g transform="translate(30 50) scale(15)">
          <Roundel fill={tint(stone, 0.2)} line={line} centre={gold} />
        </g>
      </g>
      <path d="M84 100 C84 80 86 62 91 48" fill="none" stroke={`url(#${id}g)`} strokeWidth="1.6" opacity="0.85" />
      {/* Bracket capital with two volutes, then the kalash collar. */}
      <path d="M6 100 H84 C84 112 76 116 70 122 H20 C14 116 6 112 6 100Z" fill={tint(stone, 0.22)} stroke={line} strokeWidth="0.9" />
      <circle cx="13" cy="108" r="4.4" fill="none" stroke={line} strokeWidth="0.9" />
      <circle cx="77" cy="108" r="4.4" fill="none" stroke={line} strokeWidth="0.9" />
      <path d="M20 122 H70 L66 130 C74 134 74 146 64 150 H26 C16 146 16 134 24 130Z" fill={tint(stone, 0.12)} stroke={line} strokeWidth="0.9" />
      <path d="M22 140 H68" stroke={`url(#${id}g)`} strokeWidth="1.2" opacity="0.8" />
      {/* The octagonal shaft: lit, front and shaded faces, fluted between carved bands. */}
      <rect x="22" y="150" width="46" height="292" fill={`url(#${id}p)`} />
      <path d="M31 150 V442 M59 150 V442" stroke={line} strokeWidth="0.7" opacity="0.4" />
      <path d="M38 196 V230 M45 196 V230 M52 196 V230 M38 268 V350 M45 268 V350 M52 268 V350" stroke={line} strokeWidth="0.8" opacity="0.35" />
      {/* An inverted lotus under the collar. */}
      <path d="M22 150 H68 C68 164 60 172 45 178 C30 172 22 164 22 150Z" fill={tint(stone, 0.16)} stroke={line} strokeWidth="0.8" />
      <path d="M30 152 C32 162 38 168 45 172 C52 168 58 162 60 152" fill="none" stroke={line} strokeWidth="0.7" opacity="0.6" />
      {/* Two carved bands with a row of beads and the chevron. */}
      <path d="M22 238 H68 M22 258 H68 M22 356 H68 M22 366 H68" stroke={line} strokeWidth="0.8" opacity="0.6" />
      <path d={chevron} fill="none" stroke={line} strokeWidth="1" opacity="0.7" />
      {[27, 34, 41, 48, 55, 62].map((x) => (
        <circle key={x} cx={x} cy="361" r="1.8" fill={tint(stone, 0.3)} stroke={line} strokeWidth="0.5" />
      ))}
      <path d="M22 362 H68" stroke={`url(#${id}g)`} strokeWidth="0.8" opacity="0.5" />
      {/* The full pot (purna ghata) at the foot of the shaft, leaves spilling over its rim. */}
      <path d="M30 432 C24 418 26 402 36 396 H54 C64 402 66 418 60 432Z" fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.8" />
      <path d="M34 396 C30 388 22 386 18 390 C24 392 28 396 34 400Z M56 396 C60 388 68 386 72 390 C66 392 62 396 56 400Z M40 396 C38 386 42 380 45 378 C48 380 52 386 50 396Z" fill={tint(stone, 0.1)} stroke={line} strokeWidth="0.7" />
      <path d="M30 410 H60" stroke={`url(#${id}g)`} strokeWidth="1" opacity="0.7" />
      {/* Lotus base and the two-step plinth. */}
      {petals}
      <rect x="10" y="470" width="70" height="10" fill={tint(stone, 0.14)} stroke={line} strokeWidth="0.8" />
      <rect x="4" y="480" width="82" height="20" fill={shade(stone, 0.04)} stroke={line} strokeWidth="0.9" />
      <rect x="4" y="480" width="82" height="5" fill={tint(stone, 0.2)} />
      <path d="M4 492 H86" stroke={line} strokeWidth="0.7" opacity="0.5" />
    </svg>
  );
}

// ─────────────────────────── Chhatri ───────────────────────────

/**
 * A domed pavilion seen from the front: a two-step plinth, four slender pillars (the back two in shade
 * through the cusped front arch), a deep chhajja on brackets, a ribbed dome and a gold kalash finial,
 * with blush roses at the plinth's left corner. Light from the left.
 */
export function ChhatriArt({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const stone = stoneOf(color, colors);
  const gold = hex(colors.secondary);
  // Shade is warm (the stone deepened toward its gold), never grey: ivory marble in late sun.
  const warm = (k: number) => shade(blend(stone, gold, 0.42), k);
  const line = warm(0.3);
  const rose = blend(hex(colors.primary), hex(colors.accent), 0.55);
  const green = '#7c8f6a';
  const ribs = [-46, -24, 0, 24, 46].map((dx) => <path key={dx} d={`M${156 + dx * 0.18} 78 C${156 + dx * 0.7} 96 ${156 + dx * 1.15} 126 ${156 + dx * 1.18} 158`} fill="none" stroke={line} strokeWidth="0.9" opacity="0.45" />);
  return (
    <svg viewBox="0 0 312 400" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}d`} base={blend(stone, gold, 0.12)} light={0.42} dark={0.26} cx="34%" cy="30%" />
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint(stone, 0.36)} />
          <stop offset="0.6" stopColor={stone} />
          <stop offset="1" stopColor={warm(0.2)} />
        </linearGradient>
        <linearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={warm(0.34)} />
          <stop offset="1" stopColor={warm(0.12)} />
        </linearGradient>
        <Metal id={`${id}g`} base={gold} foil={foil ?? true} x2={312} y2={120} />
      </defs>
      <ellipse cx="160" cy="390" rx="140" ry="8" fill={warm(0.5)} opacity="0.16" />
      {/* Finial and dome. */}
      <path d="M156 18 V42" stroke={`url(#${id}g)`} strokeWidth="2.2" />
      <path d="M146 58 C146 48 150 42 156 40 C162 42 166 48 166 58Z M142 62 H170 L166 70 H146Z" fill={`url(#${id}g)`} />
      <circle cx="156" cy="20" r="3.4" fill={`url(#${id}g)`} />
      <path d="M90 160 C88 116 118 84 156 72 C194 84 224 116 222 160Z" fill={`url(#${id}d)`} stroke={line} strokeWidth="1" />
      {ribs}
      <path d="M128 72 C140 64 172 64 184 72 L180 78 H132Z" fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.8" />
      {/* Drum with a frieze of small arches. */}
      <rect x="84" y="158" width="144" height="22" fill={tint(stone, 0.14)} stroke={line} strokeWidth="0.9" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${92 + i * 17} 176 V168 C${92 + i * 17} 163 ${101 + i * 17} 163 ${101 + i * 17} 168 V176`} fill="none" stroke={line} strokeWidth="0.8" opacity="0.6" />
      ))}
      {/* The chhajja on brackets. */}
      <path d="M34 192 L64 178 H248 L278 192 L270 200 H42Z" fill={tint(stone, 0.24)} stroke={line} strokeWidth="1" />
      <path d="M42 200 H270" stroke={`url(#${id}g)`} strokeWidth="1.3" opacity="0.8" />
      {[70, 108, 146, 166, 204, 242].map((x) => (
        <path key={x} d={`M${x} 200 h8 l-4 10z`} fill={warm(0.08)} stroke={line} strokeWidth="0.6" />
      ))}
      {/* The opening under the cusped front arch, the back pillars in its shade. */}
      <path d={`M92 328 V254 ${cuspedHead(92, 254, 128, 44, false)} V328Z`} fill={`url(#${id}i)`} />
      <rect x="124" y="226" width="9" height="102" fill={warm(0.2)} />
      <rect x="179" y="226" width="9" height="102" fill={warm(0.26)} />
      <path d={`M84 208 H228 V254 H84Z ${cuspedHead(92, 254, 128, 44)}Z`} fill={`url(#${id}p)`} fillRule="evenodd" />
      <path d={cuspedHead(92, 254, 128, 44)} fill="none" stroke={`url(#${id}g)`} strokeWidth="1.4" />
      {/* Front pillars with bracket capitals and lotus bases. */}
      {[70, 220].map((x) => (
        <g key={x}>
          <rect x={x} y="214" width="22" height="114" fill={`url(#${id}p)`} stroke={line} strokeWidth="0.8" />
          <path d={`M${x - 5} 210 H${x + 27} L${x + 22} 220 H${x}Z`} fill={tint(stone, 0.22)} stroke={line} strokeWidth="0.8" />
          <path d={`M${x} 262 H${x + 22} M${x} 270 H${x + 22}`} stroke={line} strokeWidth="0.7" opacity="0.55" />
          <path d={`M${x - 4} 328 C${x - 2} 318 ${x + 6} 314 ${x + 11} 312 C${x + 16} 314 ${x + 24} 318 ${x + 26} 328Z`} fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.8" />
        </g>
      ))}
      {/* Two-step plinth. */}
      <path d="M58 328 H254 V350 H58Z" fill={`url(#${id}p)`} stroke={line} strokeWidth="0.9" />
      <path d="M58 328 H254" stroke={tint(stone, 0.5)} strokeWidth="2" />
      <path d="M38 350 H274 V382 H38Z" fill={`url(#${id}p)`} stroke={line} strokeWidth="0.9" />
      <path d="M38 350 H274" stroke={tint(stone, 0.5)} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={52 + i * 36} y="358" width="22" height="16" fill="none" stroke={line} strokeWidth="0.7" opacity="0.5" />
      ))}
      {/* Blush roses and leaves at the plinth's left corner. */}
      {[
        [26, 352, -40, 0.62],
        [44, 336, -70, 0.55],
        [10, 372, -10, 0.6],
        [66, 360, -24, 0.5],
        [22, 330, -110, 0.5],
      ].map(([x, y, a, s], i) => (
        <Leaf key={i} x={x!} y={y!} angle={a!} scale={s!} fill={i % 2 ? green : shade(green, 0.14)} vein={tint(green, 0.4)} />
      ))}
      <Rose x={34} y={360} r={17} base={tint(rose, 0.25)} id={`${id}ra`} />
      <Rose x={62} y={374} r={12} base={tint(hex(colors.accent), 0.4)} id={`${id}rb`} />
      <Blossom x={14} y={344} r={6} fill="#ffffff" centre={gold} />
      <Blossom x={82} y={378} r={5} fill={tint(rose, 0.5)} centre={gold} />
    </svg>
  );
}

// ─────────────────────────── Palace front ───────────────────────────

/** The palace front itself (a group on a 360 × 400 grid); its stone and gold gradients (`${id}s`, `${id}g`) are the caller's. */
export function FacadeBody({ stone, colors, id }: { stone: string; colors: ThemeColors; id: string }) {
  const gold = hex(colors.secondary);
  // Warm shade (the stone deepened toward its gold), and deep maroon-brown window recesses edged in gold.
  const line = shade(blend(stone, gold, 0.42), 0.3);
  const recess = shade(blend(stone, hex(colors.primary), 0.55), 0.5);
  const sage = '#7c8f6a';
  const lit = (x: number, y: number, wd: number, ht: number, key: string) => (
    <g key={key}>
      <path d={`M${x} ${y + ht} V${r2(y + ht * 0.42)} ${cuspedHead(x, r2(y + ht * 0.42), wd, r2(ht * 0.42), false)} V${y + ht}Z`} fill={recess} stroke={gold} strokeWidth="0.9" />
      <path d={`M${x + 1.5} ${y + ht - 1} H${x + wd - 1.5}`} stroke={tint(gold, 0.3)} strokeWidth="1" opacity="0.7" />
    </g>
  );
  const dome = (cx: number, base: number, wd: number, ht: number) =>
    `M${cx - wd / 2} ${base} C${cx - wd / 2} ${base - ht * 0.62} ${cx - wd * 0.2} ${base - ht * 0.9} ${cx} ${base - ht} C${cx + wd * 0.2} ${base - ht * 0.9} ${cx + wd / 2} ${base - ht * 0.62} ${cx + wd / 2} ${base}Z`;
  const tower = (x: number) => (
    <g key={x}>
      <rect x={x} y="118" width="70" height="242" fill={`url(#${id}s)`} stroke={line} strokeWidth="0.9" />
      {[150, 206, 262].map((y) => lit(x + 21, y, 28, 40, `${x}-${y}`))}
      <path d={`M${x} 312 H${x + 70}`} stroke={line} strokeWidth="0.8" opacity="0.5" />
      {/* The chhatri crowning the tower. */}
      <path d={`M${x - 6} 118 H${x + 76} L${x + 70} 110 H${x}Z`} fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.8" />
      {[x + 8, x + 58].map((px) => (
        <rect key={px} x={px} y="84" width="5" height="26" fill={tint(stone, 0.1)} stroke={line} strokeWidth="0.6" />
      ))}
      <path d={`M${x - 2} 84 H${x + 72} L${x + 66} 78 H${x + 4}Z`} fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.7" />
      <path d={dome(x + 35, 78, 54, 40)} fill={`url(#${id}g)`} stroke={shade(gold, 0.3)} strokeWidth="0.7" />
      <path d={`M${x + 35} 38 V26`} stroke={`url(#${id}g)`} strokeWidth="1.8" />
      <circle cx={x + 35} cy="25" r="2.4" fill={`url(#${id}g)`} />
    </g>
  );
  return (
    <g>
      {/* Its shadow on the ground. */}
      <ellipse cx="180" cy="394" rx="182" ry="6" fill={shade(blend(stone, gold, 0.42), 0.5)} opacity="0.16" />
      {/* Cypresses at the sides. */}
      <path d="M18 362 C2 318 6 250 22 214 C38 250 42 318 26 362Z" fill={shade(sage, 0.12)} />
      <path d="M22 362 C14 320 16 262 22 226 C28 262 30 320 26 362Z" fill={tint(sage, 0.12)} opacity="0.7" />
      <path d="M342 362 C326 318 330 250 346 214 C362 250 358 318 342 362Z" fill={shade(sage, 0.18)} />
      {/* The central block: three storeys under a crenellated parapet. */}
      <rect x="86" y="150" width="188" height="210" fill={`url(#${id}s)`} stroke={line} strokeWidth="0.9" />
      <path d="M86 150 V140 H274 V150" fill={tint(stone, 0.18)} stroke={line} strokeWidth="0.8" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={88 + i * 15.6} y="130" width="9" height="10" fill={tint(stone, 0.16)} stroke={line} strokeWidth="0.6" />
      ))}
      {/* Top storey: a row of small cusped windows; a pavilion over the centre. */}
      {[104, 136, 168, 200, 232].map((x) => lit(x, 160, 22, 34, `t${x}`))}
      <path d="M146 130 V104 H214 V130" fill={tint(stone, 0.12)} stroke={line} strokeWidth="0.8" />
      {[152, 172, 188, 206].map((x) => (
        <rect key={x} x={x - 2} y="104" width="4" height="26" fill={tint(stone, 0.06)} stroke={line} strokeWidth="0.5" />
      ))}
      <path d="M140 104 H220 L214 98 H146Z" fill={tint(stone, 0.2)} stroke={line} strokeWidth="0.7" />
      <path d={dome(180, 98, 58, 38)} fill={`url(#${id}g)`} stroke={shade(gold, 0.3)} strokeWidth="0.7" />
      <path d="M180 60 V48" stroke={`url(#${id}g)`} strokeWidth="1.8" />
      {/* Middle storey: three jharokha balconies under their chhajjas. */}
      {[104, 160, 216].map((x) => (
        <g key={x}>
          <path d={`M${x - 6} 214 H${x + 46} L${x + 40} 208 H${x}Z`} fill={tint(stone, 0.22)} stroke={line} strokeWidth="0.7" />
          {lit(x + 6, 216, 28, 40, `m${x}`)}
          <rect x={x - 2} y="256" width="44" height="10" fill={tint(stone, 0.14)} stroke={line} strokeWidth="0.7" />
          <path d={`M${x + 2} 266 L${x + 20} 276 L${x + 38} 266`} fill={shade(stone, 0.06)} stroke={line} strokeWidth="0.6" />
        </g>
      ))}
      <path d="M86 204 H274 M86 282 H274" stroke={line} strokeWidth="0.8" opacity="0.55" />
      <path d="M86 284 H274" stroke={`url(#${id}g)`} strokeWidth="1" opacity="0.7" />
      {/* Ground storey: the arched gateway and two small windows. */}
      <path d={`M156 360 V316 ${cuspedHead(156, 316, 48, 20, false)} V360Z`} fill={recess} stroke={gold} strokeWidth="1" />
      <path d={cuspedHead(150, 314, 60, 24)} fill="none" stroke={`url(#${id}g)`} strokeWidth="1.2" />
      {[106, 230].map((x) => lit(x, 306, 24, 36, `g${x}`))}
      {tower(16)}
      {tower(274)}
      {/* The terrace. */}
      <path d="M0 360 H360 V376 H0Z" fill={tint(stone, 0.12)} stroke={line} strokeWidth="0.8" />
      <path d="M8 376 H352 V392 H8Z" fill={shade(stone, 0.06)} stroke={line} strokeWidth="0.8" />
    </g>
  );
}

/**
 * A Rajput palace front across a terrace: a three-storey centre with jharokha balconies under their
 * chhajjas, two flanking towers crowned by gold-domed chhatris, a crenellated parapet with a pavilion over
 * it, an arched gateway, warm-lit windows and a cypress at each side.
 */
export function PalaceFacadeArt({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const stone = stoneOf(color, colors);
  return (
    <svg viewBox="0 0 360 400" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(stone, 0.32)} />
          <stop offset="0.5" stopColor={stone} />
          <stop offset="1" stopColor={shade(stone, 0.12)} />
        </linearGradient>
        <Metal id={`${id}g`} base={hex(colors.secondary)} foil={foil ?? true} x2={360} y2={120} />
      </defs>
      <FacadeBody stone={stone} colors={colors} id={id} />
    </svg>
  );
}

// ─────────────────────────── Mandap ───────────────────────────

/**
 * The wedding mandap: four carved pillars wound with marigold strings, a domed canopy of the tint's cloth
 * under a gold scalloped valance and a kalash finial, ivory drapes tied back to the front pillars, the
 * havan kund with its fire at the centre and rangoli dots along the platform.
 */
export function MandapCanopy({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const cloth = hex(color);
  const gold = hex(colors.secondary);
  const ivory = NATURE.ivory;
  const marigold = (x: number, y0: number, y1: number, key: string) => {
    const beads: ReactNode[] = [];
    for (let y = y0, k = 0; y < y1; y += 7, k++) beads.push(<circle key={k} cx={x + (k % 2 ? 3.4 : -3.4)} cy={y} r="3.1" fill={k % 3 === 0 ? '#ffb300' : '#f57c00'} />);
    return <g key={key}>{beads}</g>;
  };
  const scallops = Array.from({ length: 14 }, (_, i) => `M${44 + i * 18.4} 112 a9.2 9.2 0 0 0 18.4 0`).join(' ');
  return (
    <svg viewBox="0 0 345 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}c`} base={cloth} light={0.34} dark={0.22} cx="36%" cy="30%" />
        <Metal id={`${id}g`} base={gold} foil={foil ?? true} x2={345} y2={140} />
        <radialGradient id={`${id}f`} cx="50%" cy="80%" r="60%">
          <stop offset="0" stopColor={NATURE.flameCore} />
          <stop offset="0.5" stopColor={NATURE.flame} />
          <stop offset="1" stopColor="#e65100" />
        </radialGradient>
      </defs>
      <ellipse cx="172" cy="292" rx="160" ry="7" fill="#000" opacity="0.1" />
      {/* Back pillars. */}
      {[92, 244].map((x) => (
        <rect key={x} x={x} y="118" width="9" height="146" fill={shade(gold, 0.18)} />
      ))}
      {/* The canopy: a dome of cloth, the finial, the valance. */}
      <path d="M172 14 V36" stroke={`url(#${id}g)`} strokeWidth="2.4" />
      <circle cx="172" cy="14" r="4" fill={`url(#${id}g)`} />
      <path d="M160 46 C160 38 166 34 172 34 C178 34 184 38 184 46Z" fill={`url(#${id}g)`} />
      <path d="M36 104 C40 70 104 44 172 44 C240 44 304 70 308 104Z" fill={`url(#${id}c)`} stroke={shade(cloth, 0.3)} strokeWidth="1" />
      {[-90, -46, 0, 46, 90].map((dx) => (
        <path key={dx} d={`M${172 + dx * 0.25} 46 C${172 + dx * 0.8} 64 ${172 + dx * 1.3} 86 ${172 + dx * 1.45} 104`} fill="none" stroke={tint(cloth, 0.3)} strokeWidth="1" opacity="0.55" />
      ))}
      <rect x="30" y="100" width="284" height="12" fill={`url(#${id}g)`} />
      <path d={scallops} fill={`url(#${id}g)`} />
      {/* Front pillars wound with marigolds. */}
      {[40, 290].map((x) => (
        <g key={x}>
          <rect x={x} y="112" width="16" height="152" fill={`url(#${id}g)`} />
          <rect x={x - 3} y="254" width="22" height="10" fill={shade(gold, 0.1)} />
          {marigold(x + 8, 124, 252, `m${x}`)}
        </g>
      ))}
      {/* Ivory drapes tied back to the front pillars. */}
      <path d="M56 116 C96 120 120 136 130 150 C112 152 88 176 58 200 C66 172 62 140 56 116Z" fill={ivory} stroke={shade(ivory, 0.12)} strokeWidth="0.8" />
      <path d="M290 116 C250 120 226 136 216 150 C234 152 258 176 288 200 C280 172 284 140 290 116Z" fill={ivory} stroke={shade(ivory, 0.12)} strokeWidth="0.8" />
      <path d="M56 200 C62 210 64 232 58 262 M290 200 C284 210 282 232 288 262" stroke={ivory} strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="58" cy="200" r="4.5" fill={`url(#${id}g)`} />
      <circle cx="288" cy="200" r="4.5" fill={`url(#${id}g)`} />
      {/* Marigold strings hanging from the valance. */}
      {[96, 132, 212, 248].map((x) => marigold(x, 124, 158, `s${x}`))}
      {/* The havan kund and its fire. */}
      <path d="M148 262 V246 H196 V262Z" fill={shade(NATURE.clay, 0.06)} />
      <path d="M154 246 V238 H190 V246Z" fill={NATURE.clay} />
      <path d="M172 196 C160 214 158 226 166 236 C162 226 170 220 172 210 C176 222 184 226 178 236 C188 226 184 212 172 196Z" fill={`url(#${id}f)`} />
      {/* The platform and its rangoli dots. */}
      <path d="M14 264 H330 V286 H14Z" fill={tint(gold, 0.55)} />
      <path d="M14 264 H330" stroke={`url(#${id}g)`} strokeWidth="1.6" />
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={32 + i * 20} cy="276" r="2.6" fill={i % 3 === 0 ? cloth : i % 3 === 1 ? '#f57c00' : '#ffffff'} />
      ))}
    </svg>
  );
}

// ─────────────────────────── Flowers ───────────────────────────

/** A leaf pointing along +x (the nature kit's leaf), 66 long: fill comes from the <use> that places it. */
const LEAF_PATH = 'M0 0 C14 -16 44 -18 66 0 C44 18 14 16 0 0Z';

/**
 * The shapes a bed or a strand repeats, drawn once at radius 10 and placed with <use> (beds run the width
 * of a page): a leaf with its vein, a five-petal blossom whose petals take the <use>'s fill, a jasmine
 * star, and a peony or (the last `roses` tones) a garden rose in each of the given tones.
 */
function BloomDefs({ id, green, tones, roses = 0 }: { id: string; green: string; tones: readonly string[]; roses?: number }) {
  const ring = (n: number, render: (i: number) => ReactNode) => Array.from({ length: n }, (_, i) => render(i));
  return (
    <>
      <g id={`${id}lf`}>
        <path d={LEAF_PATH} />
        <path d="M3 0 Q34 -2 63 0" fill="none" stroke={tint(green, 0.42)} strokeWidth="1" opacity="0.6" />
      </g>
      <g id={`${id}bl`}>
        {ring(5, (i) => (
          <ellipse key={i} cx="0" cy="-5.5" rx="4.2" ry="6" transform={`rotate(${i * 72})`} />
        ))}
        <circle r="2.6" fill={NATURE.ivory} />
      </g>
      <g id={`${id}js`}>
        {ring(5, (i) => (
          <ellipse key={i} cx="0" cy="-5.5" rx="3" ry="5.6" fill={NATURE.ivory} transform={`rotate(${i * 72})`} />
        ))}
        <circle r="1.8" fill="#e9d9a6" />
      </g>
      {tones.map((base, k) => (
        <g key={k}>
          <radialGradient id={`${id}t${k}`} cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor={tint(base, 0.5)} />
            <stop offset="0.75" stopColor={base} />
            <stop offset="1" stopColor={shade(base, 0.16)} />
          </radialGradient>
          {k < tones.length - roses ? (
            <g id={`${id}f${k}`}>
              {ring(9, (i) => (
                <ellipse key={i} cx="0" cy="-5.2" rx="4.2" ry="5" fill={`url(#${id}t${k})`} transform={`rotate(${i * 40 + 8})`} />
              ))}
              {ring(6, (i) => (
                <ellipse key={`i${i}`} cx="0" cy="-2.6" rx="3" ry="3" fill={tint(base, 0.34)} stroke={shade(base, 0.1)} strokeWidth="0.3" transform={`rotate(${i * 60 + 25})`} />
              ))}
              <circle r="1.6" fill={tint(base, 0.6)} />
            </g>
          ) : (
            <g id={`${id}f${k}`}>
              {ring(6, (i) => (
                <ellipse key={i} cx="0" cy="-4.6" rx="6" ry="4.6" fill={`url(#${id}t${k})`} stroke={shade(base, 0.18)} strokeWidth="0.3" transform={`rotate(${i * 60 + 15})`} />
              ))}
              <circle r="6" fill={tint(base, 0.2)} />
              {ring(4, (i) => (
                <ellipse key={`i${i}`} cx="0" cy="-2.2" rx="3.6" ry="2.6" fill={`url(#${id}t${k})`} stroke={shade(base, 0.2)} strokeWidth="0.3" transform={`rotate(${i * 90 + 40})`} />
              ))}
              <path d="M0 -1.8 C2 -1.8 2.2 1.2 0 1.4 C-1.6 1.4 -1.6 -0.6 0.2 -0.4" fill="none" stroke={shade(base, 0.32)} strokeWidth="0.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      ))}
    </>
  );
}

const place = (x: number, y: number, scale: number, rotate = 0) => `translate(${r2(x)} ${r2(y)})${rotate ? ` rotate(${r2(rotate)})` : ''} scale(${r2(scale)})`;

/**
 * A low bed of peonies, garden roses and jasmine sprays along the frame (blooms = round(w / 0.9h)): blooms
 * in the palette's creams and pinks, leaves in the tint placed by rand() and taller toward the ends, on a
 * soft ground shadow.
 */
export function FlowerBed({ color, colors, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const green = hex(color);
  const a = hex(colors.accent);
  // Blooms stay warm in every palette: the palette's rose warmed toward a real garden rose.
  const blush = blend(blend(hex(colors.primary), a, 0.35), '#c97a84', 0.35);
  // Peonies in three tones, garden roses in the last.
  const tones = [tint(a, 0.55), NATURE.ivory, tint(blush, 0.45), blush];
  // Dense on short beds, capped on the page-wide ones (their markup stays light).
  const n = Math.max(2, Math.min(12, Math.round(w / (0.8 * h))));
  const leafFills = [shade(green, 0.16), green, tint(green, 0.18)];
  const leaves: ReactNode[] = [];
  const count = Math.round(n * 2.8);
  for (let i = 0; i < count; i++) {
    const t = (i + rand(i, 2)) / count;
    const edge = Math.abs(2 * t - 1);
    const lift = 0.5 + edge * edge * 0.55;
    leaves.push(<use key={`l${i}`} href={`#${id}lf`} fill={leafFills[i % 3]} transform={place(t * w, h * (0.96 - lift * 0.4 * rand(i, 4)), (h / 130) * (0.42 + lift * 0.42), -90 + (rand(i, 6) - 0.5) * 120)} />);
  }
  const blooms: ReactNode[] = [];
  const backBlooms: ReactNode[] = [];
  const sprays: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5 + (rand(i, 8) - 0.5) * 0.5) / n) * w;
    const back = i % 2 === 1;
    const r = h * (back ? 0.17 + rand(i, 9) * 0.06 : 0.22 + rand(i, 9) * 0.08);
    const y = h * (back ? 0.5 + rand(i, 10) * 0.1 : 0.7 + rand(i, 10) * 0.1);
    const k = i % 4;
    const bloom = <use key={`b${i}`} href={`#${id}f${k}`} transform={place(x, y, (r * (k === 3 ? 0.86 : 1)) / 10, rand(i, 14) * 40)} />;
    if (back) backBlooms.push(bloom);
    else blooms.push(bloom, <use key={`k${i}`} href={`#${id}bl`} fill={tint(blush, 0.6)} transform={place(x + r * 1.05, y + r * 0.45, (r * 0.3) / 10)} />);
    if (i < n - 1 && i % 2 === 0) {
      const sx = ((i + 1) / n) * w;
      const sh = h * (0.42 + rand(i, 12) * 0.2);
      const tipX = sx + (rand(i * 7, 3) - 0.5) * sh * 0.5;
      sprays.push(<path key={`s${i}`} d={`M${r2(sx)} ${r2(h * 0.9)} Q${r2(sx + (tipX - sx) * 0.2)} ${r2(h * 0.9 - sh * 0.5)} ${r2(tipX)} ${r2(h * 0.9 - sh)}`} fill="none" stroke="#6f7f5c" strokeWidth={r2(Math.max(0.8, h * 0.012))} />);
      for (let j = 0; j < 3; j++) {
        const t = 0.5 + j * 0.2;
        sprays.push(<use key={`s${i}${j}`} href={`#${id}js`} transform={place(sx + (tipX - sx) * t + (rand(i * 7 + j, 5) - 0.5) * sh * 0.18, h * 0.9 - sh * t, (sh * 0.07) / 10)} />);
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="xMidYMax slice" className={className} style={style} aria-hidden="true">
      <defs>
        <BloomDefs id={id} green={green} tones={tones} roses={1} />
        <radialGradient id={`${id}g`} cx="50%" cy="100%" r="60%">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y={r2(h * 0.7)} width={r2(w)} height={r2(h * 0.3)} fill={`url(#${id}g)`} />
      {leaves}
      {sprays}
      {backBlooms}
      {blooms}
    </svg>
  );
}

/** A small pierced brass lantern hanging from (x, y), `s` tall. */
function SmallLantern({ x, y, s, metal, id }: { x: number; y: number; s: number; metal: string; id: string }) {
  const k = s / 60;
  const holes: ReactNode[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push(<circle key={`${r}${c}`} cx={r2(x + (c - 1) * 6 * k)} cy={r2(y + (24 + r * 8) * k)} r={r2(1.3 * k)} fill={LAMPLIGHT} />);
  return (
    <g>
      <path d={`M${r2(x - 6 * k)} ${r2(y + 10 * k)} L${r2(x)} ${r2(y)} L${r2(x + 6 * k)} ${r2(y + 10 * k)}Z`} fill={metal} />
      <path d={`M${r2(x - 12 * k)} ${r2(y + 16 * k)} C${r2(x - 16 * k)} ${r2(y + 30 * k)} ${r2(x - 12 * k)} ${r2(y + 44 * k)} ${r2(x)} ${r2(y + 48 * k)} C${r2(x + 12 * k)} ${r2(y + 44 * k)} ${r2(x + 16 * k)} ${r2(y + 30 * k)} ${r2(x + 12 * k)} ${r2(y + 16 * k)}Z`} fill={`url(#${id})`} />
      <rect x={r2(x - 13 * k)} y={r2(y + 10 * k)} width={r2(26 * k)} height={r2(6 * k)} rx={r2(2 * k)} fill={metal} />
      {holes}
      <path d={`M${r2(x)} ${r2(y + 48 * k)} V${r2(y + 58 * k)}`} stroke={metal} strokeWidth={r2(1.6 * k)} />
      <circle cx={r2(x)} cy={r2(y + 59 * k)} r={r2(2 * k)} fill={NATURE.clayDark} />
    </g>
  );
}

/**
 * A hanging vine drawn to its frame: a fine gold chain from the top with clusters of blush blossoms
 * (bougainvillea's papery bracts, in the palette's pinks) and leaves in the tint along it; a strand more
 * than three times as tall as it is wide ends in a small pierced brass lantern.
 */
export function FloralStrand({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const green = hex(color);
  const gold = hex(colors.secondary);
  const pink = tint(blend(blend(hex(colors.primary), hex(colors.accent), 0.3), '#c4647a', 0.4), 0.22);
  const lantern = h > 3 * w;
  const end = lantern ? h - w * 0.75 : h * 0.96;
  const x0 = w * 0.5;
  const clusters: ReactNode[] = [];
  const step = Math.max(16, w * 0.46);
  let k = 0;
  for (let y = step * 0.5; y < end - step * 0.2; y += step * (0.78 + rand(k, 3) * 0.3), k++) {
    const side = k % 2 ? 1 : -1;
    const spread = w * (0.12 + rand(k, 5) * 0.16);
    const cx = x0 + side * spread * (0.4 + (y / h) * 0.6);
    const size = w * (0.2 + rand(k, 7) * 0.08) * (1 - (y / h) * 0.3);
    for (let j = 0; j < 3; j++) clusters.push(<use key={`l${k}${j}`} href={`#${id}lf`} fill={j % 2 ? green : shade(green, 0.14)} transform={place(cx - side * size * 0.4, y + size * 0.2, size / 50, side > 0 ? 20 + j * 55 : 160 - j * 55)} />);
    for (let j = 0; j < 3; j++) {
      const bx = cx + (j - 1) * size * 0.55;
      const by = y + (j === 1 ? -size * 0.4 : size * 0.15);
      clusters.push(<use key={`b${k}${j}`} href={`#${id}bl`} fill={j === 1 ? tint(pink, 0.35) : pink} transform={place(bx, by, (size * 0.42) / 10, rand(k * 3 + j, 9) * 72)} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        <BloomDefs id={id} green={green} tones={[]} />
        <Metal id={`${id}g`} base={gold} foil={foil ?? true} x2={r2(w)} y2={r2(h * 0.3)} />
        <radialGradient id={`${id}l`} cx="38%" cy="35%" r="70%">
          <stop offset="0" stopColor={tint(gold, 0.5)} />
          <stop offset="0.6" stopColor={gold} />
          <stop offset="1" stopColor={shade(gold, 0.3)} />
        </radialGradient>
      </defs>
      <path d={`M${r2(x0)} 0 V${r2(end)}`} stroke={`url(#${id}g)`} strokeWidth={r2(Math.max(1, w * 0.018))} strokeDasharray={`${r2(Math.max(2.4, w * 0.04))} ${r2(Math.max(1.2, w * 0.016))}`} />
      {clusters}
      {lantern ? <SmallLantern x={x0} y={end} s={w * 0.7} metal={shade(gold, 0.08)} id={`${id}l`} /> : null}
    </svg>
  );
}

