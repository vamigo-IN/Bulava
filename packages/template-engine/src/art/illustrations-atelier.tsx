import { blend, hex, Lit, Metal, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { r2 } from './motifs';

/**
 * The atelier's haberdashery (docs/templates.md#illustrations): the zipper, its
 * slider, the scalloped tag that hangs from it, satin ribbon and its bow, and a
 * wax seal, for invitations made like tactile stationery (ADR-074). The tint is
 * the piece's own material (the zipper's metal, the tag's card, the ribbon's
 * satin, the wax); the palette colours the rest (a zipper's tape, a tag's gold
 * frame). Arithmetic and fixed tables only, like every illustration.
 */

const f = r2;

/**
 * A closed zipper drawn down the layer: two tapes and the teeth interlocking
 * between them, as many as the layer is tall (`FRAME_SIZED`). The tint is the
 * metal; the tape is the palette's primary, a shade darker.
 */
export function Zipper({ color, colors, foil, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const metal = hex(color);
  const tape = shade(colors.primary, 0.22);
  const band = w * 0.56;
  const left = (w - band) / 2;
  const pitch = Math.max(2, w * 0.24);
  const tooth = pitch * 0.62;
  const reach = band / 2 + band * 0.16;
  const count = Math.ceil(h / pitch) + 1;
  return (
    <svg viewBox={`0 0 ${f(w)} ${f(h)}`} preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(metal, foil === false ? 0.3 : 0.55)} />
          <stop offset="0.35" stopColor={metal} />
          <stop offset="0.75" stopColor={shade(metal, 0.18)} />
          <stop offset="1" stopColor={shade(metal, 0.45)} />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={shade(tape, 0.25)} />
          <stop offset="0.5" stopColor={tape} />
          <stop offset="1" stopColor={shade(tape, 0.25)} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={f(left + band * 0.1)} height={f(h)} fill={`url(#${id}t)`} />
      <rect x={f(w - left - band * 0.1)} y="0" width={f(left + band * 0.1)} height={f(h)} fill={`url(#${id}t)`} />
      <line x1={f(left * 0.45)} y1="0" x2={f(left * 0.45)} y2={f(h)} stroke={tint(tape, 0.3)} strokeWidth={f(w * 0.025)} strokeDasharray={`${f(pitch * 0.8)} ${f(pitch * 0.5)}`} opacity="0.55" />
      <line x1={f(w - left * 0.45)} y1="0" x2={f(w - left * 0.45)} y2={f(h)} stroke={tint(tape, 0.3)} strokeWidth={f(w * 0.025)} strokeDasharray={`${f(pitch * 0.8)} ${f(pitch * 0.5)}`} opacity="0.55" />
      {Array.from({ length: count }, (_, k) => {
        const y = k * pitch - pitch / 2;
        return (
          <g key={k}>
            <rect x={f(left)} y={f(y + tooth * 0.12)} width={f(reach)} height={f(tooth)} rx={f(tooth * 0.42)} fill="#000000" opacity="0.22" />
            <rect x={f(left)} y={f(y)} width={f(reach)} height={f(tooth)} rx={f(tooth * 0.42)} fill={`url(#${id}m)`} />
            <rect x={f(left + reach * 0.18)} y={f(y + tooth * 0.12)} width={f(reach * 0.6)} height={f(tooth * 0.16)} rx={f(tooth * 0.08)} fill={tint(metal, 0.8)} opacity="0.55" />
            <rect x={f(w - left - reach)} y={f(y + pitch / 2 + tooth * 0.12)} width={f(reach)} height={f(tooth)} rx={f(tooth * 0.42)} fill="#000000" opacity="0.22" />
            <rect x={f(w - left - reach)} y={f(y + pitch / 2)} width={f(reach)} height={f(tooth)} rx={f(tooth * 0.42)} fill={`url(#${id}m)`} />
            <rect x={f(w - left - reach * 0.78)} y={f(y + pitch / 2 + tooth * 0.12)} width={f(reach * 0.6)} height={f(tooth * 0.16)} rx={f(tooth * 0.08)} fill={tint(metal, 0.8)} opacity="0.55" />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The zipper's slider with the ring a tag hangs from (60 × 140 as drawn): the
 * tint is its metal.
 */
export function ZipperPull({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const metal = hex(color);
  const m = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 60 140" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={metal} foil={foil ?? true} x2={60} y2={20} />
      </defs>
      <path d="M8 10 Q30 0 52 10 L47 46 Q30 56 13 46 Z" fill={shade(metal, 0.45)} opacity="0.35" transform="translate(1.5 3)" />
      <path d="M8 10 Q30 0 52 10 L47 46 Q30 56 13 46 Z" fill={m} />
      <path d="M14 14 Q30 7 46 14 L43 40 Q30 47 17 40 Z" fill="none" stroke={tint(metal, 0.55)} strokeWidth="1.3" opacity="0.8" />
      <path d="M30 9 L30 47" stroke={shade(metal, 0.35)} strokeWidth="1.6" opacity="0.5" />
      <path d="M24 12 Q30 9 36 12" stroke={tint(metal, 0.85)} strokeWidth="1.6" fill="none" opacity="0.8" strokeLinecap="round" />
      <rect x="22" y="44" width="16" height="12" rx="4" fill={m} />
      <path d="M30 54 C14 58 12 92 22 112 C26 120 34 120 38 112 C48 92 46 58 30 54 Z" fill="none" stroke={m} strokeWidth="6" />
      <path d="M30 60 C18 64 18 92 25 108" fill="none" stroke={tint(metal, 0.75)} strokeWidth="1.5" opacity="0.7" strokeLinecap="round" />
      <circle cx="30" cy="124" r="7" fill="none" stroke={m} strokeWidth="4" />
    </svg>
  );
}

/**
 * A Victorian scalloped tag (200 × 260 as drawn): card in the tint, scalloped
 * all round, a gold label frame inside (the palette's secondary), a gold eyelet
 * with its cord at the top. The monogram is a text layer over its centre.
 */
export function ScallopTag({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const card = hex(color);
  const gold = `url(#${id}g)`;
  // Scallops round a 152 × 206 card at 24..176, 40..246.
  const bumps: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i++) bumps.push([24 + i * 19, 40], [24 + i * 19, 246]);
  for (let i = 1; i < 11; i++) bumps.push([24, 40 + i * 18.6], [176, 40 + i * 18.6]);
  const label = 'M58 64 H142 Q142 76 154 76 V210 Q142 210 142 222 H58 Q58 210 46 210 V76 Q58 76 58 64 Z';
  const inner = 'M62 70 H138 Q139 80 148 82 V204 Q139 206 138 216 H62 Q61 206 52 204 V82 Q61 80 62 70 Z';
  const shape = (
    <>
      <rect x="24" y="40" width="152" height="206" />
      {bumps.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="10.5" />
      ))}
    </>
  );
  return (
    <svg viewBox="0 0 200 260" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}g`} base={colors.secondary} foil={foil ?? true} x2={200} y2={260} />
        <radialGradient id={`${id}c`} gradientUnits="userSpaceOnUse" cx="70" cy="80" r="240">
          <stop offset="0" stopColor={tint(card, 0.3)} />
          <stop offset="0.55" stopColor={card} />
          <stop offset="1" stopColor={shade(card, 0.12)} />
        </radialGradient>
      </defs>
      <g fill="#000000" opacity="0.14" transform="translate(3 6)">
        {shape}
      </g>
      <g fill={`url(#${id}c)`}>{shape}</g>
      <rect x="31" y="47" width="138" height="192" fill="none" stroke={shade(card, 0.12)} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      <path d={label} fill={tint(card, 0.18)} stroke={gold} strokeWidth="2.6" />
      <path d={inner} fill="none" stroke={gold} strokeWidth="0.9" />
      <path d="M86 92 C92 84 108 84 114 92 M92 92 C96 88 104 88 108 92" fill="none" stroke={gold} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M86 194 C92 202 108 202 114 194 M92 194 C96 198 104 198 108 194" fill="none" stroke={gold} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="100" cy="88" r="2.2" fill={gold} />
      <circle cx="100" cy="198" r="2.2" fill={gold} />
      <path d="M100 0 C92 10 92 20 100 26 C108 20 108 10 100 0" fill="none" stroke={shade(colors.text, 0.1)} strokeWidth="2.2" opacity="0.8" />
      <circle cx="100" cy="30" r="9" fill={gold} />
      <circle cx="100" cy="30" r="4.6" fill={shade(card, 0.55)} />
      <circle cx="98.5" cy="28.5" r="1.4" fill={tint(card, 0.6)} opacity="0.6" />
    </svg>
  );
}

/** Satin across a piece of the board (`FRAME_SIZED`): the tint is the satin, lit along its length. */
export function SatinRibbon({ color, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const satin = hex(color);
  const vertical = h > w;
  return (
    <svg viewBox={`0 0 ${f(w)} ${f(h)}`} preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2={vertical ? '1' : '0'} y2={vertical ? '0' : '1'}>
          <stop offset="0" stopColor={shade(satin, 0.3)} />
          <stop offset="0.12" stopColor={shade(satin, 0.08)} />
          <stop offset="0.3" stopColor={tint(satin, 0.42)} />
          <stop offset="0.42" stopColor={tint(satin, 0.12)} />
          <stop offset="0.7" stopColor={satin} />
          <stop offset="0.88" stopColor={shade(satin, 0.12)} />
          <stop offset="1" stopColor={shade(satin, 0.34)} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={f(w)} height={f(h)} fill={`url(#${id}s)`} />
      {vertical ? (
        <>
          <line x1={f(w * 0.06)} y1="0" x2={f(w * 0.06)} y2={f(h)} stroke={shade(satin, 0.35)} strokeWidth={f(w * 0.02)} opacity="0.5" />
          <line x1={f(w * 0.94)} y1="0" x2={f(w * 0.94)} y2={f(h)} stroke={shade(satin, 0.35)} strokeWidth={f(w * 0.02)} opacity="0.5" />
        </>
      ) : (
        <>
          <line x1="0" y1={f(h * 0.06)} x2={f(w)} y2={f(h * 0.06)} stroke={shade(satin, 0.35)} strokeWidth={f(h * 0.02)} opacity="0.5" />
          <line x1="0" y1={f(h * 0.94)} x2={f(w)} y2={f(h * 0.94)} stroke={shade(satin, 0.35)} strokeWidth={f(h * 0.02)} opacity="0.5" />
        </>
      )}
    </svg>
  );
}

/** A satin bow with long tails cut in a V (300 × 210 as drawn): the tint is the satin. */
export function SatinBow({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const satin = hex(color);
  const dark = shade(satin, 0.3);
  const fold = shade(satin, 0.16);
  const shine = tint(satin, 0.55);
  return (
    <svg viewBox="0 0 300 210" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}a`} base={satin} light={0.38} dark={0.2} cx="40%" cy="30%" />
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(satin, 0.22)} />
          <stop offset="0.35" stopColor={tint(satin, 0.3)} />
          <stop offset="0.6" stopColor={satin} />
          <stop offset="1" stopColor={shade(satin, 0.25)} />
        </linearGradient>
      </defs>
      <g opacity="0.16" fill="#000000" transform="translate(3 7)">
        <path d="M150 92 C112 52 54 18 34 44 C16 68 58 112 140 104 Z M150 92 C188 52 246 18 266 44 C284 68 242 112 160 104 Z" />
      </g>
      <path d="M140 100 C126 140 104 172 84 206 L104 196 L112 210 C130 172 148 140 156 104 Z" fill={`url(#${id}t)`} />
      <path d="M160 100 C174 140 196 172 216 206 L196 196 L188 210 C170 172 152 140 144 104 Z" fill={`url(#${id}t)`} />
      <path d="M146 106 C136 140 118 170 100 200" stroke={dark} strokeWidth="1.4" fill="none" opacity="0.45" />
      <path d="M154 106 C164 140 182 170 200 200" stroke={dark} strokeWidth="1.4" fill="none" opacity="0.45" />
      <path d="M150 92 C112 52 54 18 34 44 C16 68 58 112 140 104 Z" fill={`url(#${id}a)`} />
      <path d="M150 92 C188 52 246 18 266 44 C284 68 242 112 160 104 Z" fill={`url(#${id}a)`} />
      <path d="M140 98 C110 90 72 80 58 60 C76 72 112 84 146 92 Z" fill={fold} opacity="0.7" />
      <path d="M160 98 C190 90 228 80 242 60 C224 72 188 84 154 92 Z" fill={fold} opacity="0.7" />
      <path d="M46 46 C64 32 96 40 124 64" stroke={shine} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M254 46 C236 32 204 40 176 64" stroke={shine} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
      <rect x="134" y="80" width="32" height="32" rx="11" fill={blend(satin, '#000000', 0.08)} />
      <rect x="134" y="80" width="32" height="32" rx="11" fill={`url(#${id}a)`} opacity="0.85" />
      <path d="M140 86 C146 96 146 100 140 108 M160 86 C154 96 154 100 160 108" stroke={dark} strokeWidth="1.3" fill="none" opacity="0.45" />
      <path d="M142 86 C148 84 152 84 158 86" stroke={shine} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}

/** Unit vectors at 15° steps (fixed: no trigonometry at render). */
const ROUND: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [0.9659, 0.2588], [0.866, 0.5], [0.7071, 0.7071], [0.5, 0.866], [0.2588, 0.9659],
  [0, 1], [-0.2588, 0.9659], [-0.5, 0.866], [-0.7071, 0.7071], [-0.866, 0.5], [-0.9659, 0.2588],
  [-1, 0], [-0.9659, -0.2588], [-0.866, -0.5], [-0.7071, -0.7071], [-0.5, -0.866], [-0.2588, -0.9659],
  [0, -1], [0.2588, -0.9659], [0.5, -0.866], [0.7071, -0.7071], [0.866, -0.5], [0.9659, -0.2588],
];
/** How far the wax ran at each step: an uneven pool, the same every time. */
const POOL = [92, 95, 89, 96, 93, 88, 95, 98, 91, 94, 97, 90, 93, 97, 92, 88, 96, 94, 90, 97, 93, 91, 97, 94];

/** A smooth closed outline through points: quadratic curves between their midpoints. */
function smoothLoop(points: ReadonlyArray<readonly [number, number]>): string {
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const n = points.length;
  const start = mid(points[n - 1]!, points[0]!);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const m = mid(p, points[(i + 1) % n]!);
    d += ` Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/**
 * A wax seal (200 × 200 as drawn): an uneven pool of wax in the tint with a
 * pressed ring. The monogram is a text layer over its centre.
 */
export function WaxSeal({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const wax = hex(color);
  const pool = ROUND.map(([x, y], i) => [100 + x * POOL[i]!, 100 + y * POOL[i]!] as const);
  const edge = smoothLoop(pool);
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}w`} base={wax} light={0.3} dark={0.28} cx="36%" cy="30%" />
        <radialGradient id={`${id}p`} cx="50%" cy="50%" r="50%">
          <stop offset="0.7" stopColor={shade(wax, 0.12)} />
          <stop offset="1" stopColor={tint(wax, 0.08)} />
        </radialGradient>
      </defs>
      <path d={edge} fill="#000000" opacity="0.18" transform="translate(3 6)" />
      <path d={edge} fill={`url(#${id}w)`} />
      <circle cx="100" cy="100" r="68" fill={`url(#${id}p)`} />
      <circle cx="100" cy="100" r="68" fill="none" stroke={shade(wax, 0.32)} strokeWidth="5" opacity="0.75" />
      <circle cx="100" cy="100" r="64" fill="none" stroke={tint(wax, 0.3)} strokeWidth="1.6" opacity="0.6" />
      <path d="M48 66 C58 44 80 32 104 32" stroke={tint(wax, 0.55)} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.45" />
    </svg>
  );
}
