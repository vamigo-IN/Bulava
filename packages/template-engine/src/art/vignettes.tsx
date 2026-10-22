import type { CSSProperties, ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { blend, cuspedHead, hex, shade, tint, useSafeId } from './kit';
import { r2, rand } from './motifs';

/** Window light and the low sun (natural colours, like a flame). */
const LAMPLIGHT = '#ffe2a8';
const SUN = '#ffe6b8';
/** A warm golden-hour sky: natural light, warmed and cooled a little by the palette. */
const DUSK_HIGH = '#f7dcc2';
const DUSK_LOW = '#f1b9a0';
/** The low sun's golden band along the horizon (natural light). */
const GOLDEN = '#ffcf98';
/** The far hills' haze and the shore's trees (natural colours). */
const HILL_HAZE = '#9a8fb0';
const GROVE = '#4f5c45';

/** Lit ivory stone of the palace, from the palette's surface and its gold. */
export const lakeStone = (colors: ThemeColors) => blend(hex(colors.surface), hex(colors.secondary), 0.36);

/** The golden-hour sky of a scene: pale near the page at the top, peach in the middle, rose at the horizon. */
function duskOf(colors: ThemeColors) {
  const surface = hex(colors.surface);
  const primary = hex(colors.primary);
  const low = blend(DUSK_LOW, primary, 0.08);
  return { top: blend(surface, DUSK_HIGH, 0.5), mid: blend(DUSK_HIGH, DUSK_LOW, 0.4), low, haze: tint(low, 0.5) };
}

/**
 * The gradients a lake palace is drawn with (`${id}s` stone, `${id}g` gold, `${id}a` the lit arches: a deep
 * warm shade under each cusp glowing to lamplight at the sill), defined once by whoever places the palace.
 */
export function LakePalaceDefs({ id, colors }: { id: string; colors: ThemeColors }) {
  const stone = lakeStone(colors);
  const gold = hex(colors.secondary);
  const recess = shade(blend(stone, hex(colors.primary), 0.35), 0.38);
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stopColor={tint(stone, 0.42)} />
        <stop offset="0.45" stopColor={stone} />
        <stop offset="1" stopColor={shade(stone, 0.2)} />
      </linearGradient>
      <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="520" y2="60">
        <stop offset="0" stopColor={shade(gold, 0.25)} />
        <stop offset="0.45" stopColor={tint(gold, 0.55)} />
        <stop offset="1" stopColor={shade(gold, 0.1)} />
      </linearGradient>
      <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={recess} />
        <stop offset="0.5" stopColor={blend(recess, LAMPLIGHT, 0.55)} />
        <stop offset="1" stopColor={LAMPLIGHT} />
      </linearGradient>
    </>
  );
}

/**
 * A lake palace seen across the water, on a 520 × 140 grid with its ghat's foot at y 140: a long, low front of
 * two storeys of cusped arches lit from within (deep shade under each cusp, lamplight at the sill), shadow under
 * every chhajja, the wings a storey lower and in shade, five chhatris along the roof with gold domes (the middle
 * one the largest), and the ghat's steps into the water. Its gradients come from LakePalaceDefs.
 */
export function LakePalace({ id, stone }: { id: string; stone: string }) {
  const line = shade(stone, 0.34);
  const arches = (y: number, h: number, from: number, to: number, n: number, key: string) => {
    const pitch = (to - from) / n;
    const out: ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const x = r2(from + i * pitch + pitch * 0.18);
      const w = r2(pitch * 0.64);
      const spring = r2(y + h * 0.45);
      out.push(<path key={`${key}${i}`} d={`M${x} ${y + h} V${spring} ${cuspedHead(x, spring, w, r2(h * 0.4), false)} V${y + h}Z`} fill={`url(#${id}a)`} stroke={line} strokeWidth="0.5" />);
    }
    return out;
  };
  const chhatri = (cx: number, base: number, s: number) => (
    <g key={cx}>
      <rect x={r2(cx - 15 * s)} y={r2(base - 14 * s)} width={r2(2.4 * s)} height={r2(14 * s)} fill={tint(stone, 0.1)} stroke={line} strokeWidth="0.4" />
      <rect x={r2(cx + 12.6 * s)} y={r2(base - 14 * s)} width={r2(2.4 * s)} height={r2(14 * s)} fill={shade(stone, 0.12)} stroke={line} strokeWidth="0.4" />
      <rect x={r2(cx - 12.6 * s)} y={r2(base - 14 * s)} width={r2(25.2 * s)} height={r2(14 * s)} fill={shade(stone, 0.42)} opacity="0.45" />
      <path d={`M${r2(cx - 18 * s)} ${r2(base - 14 * s)} H${r2(cx + 18 * s)} L${r2(cx + 15 * s)} ${r2(base - 17 * s)} H${r2(cx - 15 * s)}Z`} fill={tint(stone, 0.22)} stroke={line} strokeWidth="0.4" />
      <path
        d={`M${r2(cx - 13 * s)} ${r2(base - 17 * s)} C${r2(cx - 13 * s)} ${r2(base - 27 * s)} ${r2(cx - 5 * s)} ${r2(base - 32 * s)} ${cx} ${r2(base - 34 * s)} C${r2(cx + 5 * s)} ${r2(base - 32 * s)} ${r2(cx + 13 * s)} ${r2(base - 27 * s)} ${r2(cx + 13 * s)} ${r2(base - 17 * s)}Z`}
        fill={`url(#${id}g)`}
      />
      <path d={`M${cx} ${r2(base - 34 * s)} V${r2(base - 40 * s)}`} stroke={`url(#${id}g)`} strokeWidth={r2(1.2 * s)} />
    </g>
  );
  const shadowUnder = (x: number, y: number, w: number) => <rect x={x} y={y} width={w} height="3.2" fill={shade(stone, 0.5)} opacity="0.32" />;
  return (
    <g>
      {/* The ghat: steps down into the water. */}
      <path d="M0 140 V132 H520 V140Z" fill={shade(stone, 0.16)} />
      <path d="M4 132 V127 H516 V132Z" fill={shade(stone, 0.06)} stroke={line} strokeWidth="0.4" />
      <path d="M8 127 V122 H512 V127Z" fill={tint(stone, 0.18)} stroke={line} strokeWidth="0.5" />
      <path d="M8 132 H516 M4 137 H520" stroke={tint(stone, 0.4)} strokeWidth="0.6" opacity="0.7" />
      {/* The lower storey and its parapet. */}
      <rect x="24" y="74" width="472" height="48" fill={`url(#${id}s)`} stroke={line} strokeWidth="0.6" />
      {arches(78, 42, 24, 496, 15, 'a')}
      <path d="M18 74 H502 L496 69 H24Z" fill={tint(stone, 0.24)} stroke={line} strokeWidth="0.5" />
      {shadowUnder(24, 74, 472)}
      {/* The upper storey under its crenellated parapet. */}
      <rect x="70" y="40" width="380" height="29" fill={`url(#${id}s)`} stroke={line} strokeWidth="0.6" />
      {arches(43, 25, 70, 450, 13, 'b')}
      <path d="M64 40 H456 L452 36 H68Z" fill={tint(stone, 0.24)} stroke={line} strokeWidth="0.5" />
      {shadowUnder(70, 40, 380)}
      {Array.from({ length: 20 }, (_, i) => (
        <rect key={i} x={72 + i * 19} y="31" width="9" height="5" fill={i % 2 ? tint(stone, 0.12) : tint(stone, 0.2)} stroke={line} strokeWidth="0.4" />
      ))}
      {/* Wings at the ends, a storey lower, turned from the light. */}
      <rect x="24" y="52" width="46" height="22" fill={shade(stone, 0.06)} stroke={line} strokeWidth="0.5" />
      <rect x="450" y="52" width="46" height="22" fill={shade(stone, 0.14)} stroke={line} strokeWidth="0.5" />
      {arches(55, 16, 24, 70, 2, 'c')}
      {arches(55, 16, 450, 496, 2, 'd')}
      {shadowUnder(24, 52, 46)}
      {shadowUnder(450, 52, 46)}
      {chhatri(47, 52, 0.9)}
      {chhatri(473, 52, 0.9)}
      {chhatri(150, 31, 0.8)}
      {chhatri(370, 31, 0.8)}
      {chhatri(260, 31, 1.25)}
    </g>
  );
}

/**
 * A lake palace with its reflection, drawn on its own (520 × 200: the palace on a 520 × 140 grid, its
 * reflection below the waterline at y 140, fading into the water), for a scene to place where its words
 * leave room.
 */
export function LakePalaceArt({ colors, className, style }: { colors: ThemeColors; className?: string; style?: CSSProperties }) {
  const id = useSafeId();
  return (
    <svg viewBox="0 0 520 200" className={className} style={style} aria-hidden="true">
      <defs>
        <LakePalaceDefs id={id} colors={colors} />
        <g id={`${id}p`}>
          <LakePalace id={id} stone={lakeStone(colors)} />
        </g>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="140" width="520" height="60">
          <rect x="0" y="140" width="520" height="60" fill={`url(#${id}f)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`} opacity="0.3">
        <use href={`#${id}p`} transform="translate(0 280) scale(1 -1)" />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${r2(60 + rand(i, 3) * 360)} ${r2(146 + i * 8)} h${r2(40 + rand(i, 5) * 90)}`} stroke={i % 2 ? SUN : '#ffffff'} strokeWidth="1.2" strokeLinecap="round" opacity={0.5 - i * 0.05} />
      ))}
      <use href={`#${id}p`} />
    </svg>
  );
}

/** Still water's shimmer: short lines of sun and gold across `[x0, x1]` between `y0` and `y1`, denser near the top. */
function shimmerLines(n: number, x0: number, x1: number, y0: number, y1: number, gold: string, salt = 3): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = rand(i, salt);
    const y = r2(y0 + t * t * (y1 - y0));
    const x = r2(x0 + rand(i, salt + 2) * (x1 - x0));
    const len = r2(24 + rand(i, salt + 4) * 110 * (0.5 + t));
    out.push(<path key={i} d={`M${x} ${y} H${r2(x + len)}`} stroke={i % 3 ? tint(gold, 0.4) : SUN} strokeWidth={i % 4 ? 1.1 : 1.6} strokeLinecap="round" opacity={i % 3 ? 0.32 : 0.6} />);
  }
  return out;
}

/** A grove on the far shore: round crowns from `x0` to `x1` standing on `y`. */
function grove(x0: number, x1: number, y: number, k: number, salt: number): ReactNode[] {
  const out: ReactNode[] = [];
  const n = Math.max(2, Math.round((x1 - x0) / 34));
  for (let i = 0; i < n; i++) {
    const x = r2(x0 + ((i + 0.5) / n) * (x1 - x0) + (rand(i, salt) - 0.5) * 14);
    const r = r2((18 + rand(i, salt + 2) * 18) * k);
    out.push(<ellipse key={i} cx={x} cy={r2(y - r * 0.62)} rx={r} ry={r2(r * 0.82)} fill={i % 2 ? GROVE : shade(GROVE, 0.14)} />);
  }
  return out;
}

/**
 * A lake palace at golden hour, drawn on a 1200 × 800 canvas that fills its box from the foot (xMidYMax
 * slice): the stand-in for a missing cover or venue photograph on the Royal Heirloom, and its closing's
 * view. A warm sky with the low sun and a haze along the horizon, two bands of hills, still water with
 * shimmer, trees on the far shore and (unless `palace` is false: the closing places its own) a long, low
 * palace on the waterline at the centre with its reflection. Sky, hills and water mix natural light with
 * the palette.
 */
export function LakePalaceVignette({ colors, palace = true, className, style }: { colors: ThemeColors; palace?: boolean; className?: string; style?: CSSProperties }) {
  const id = useSafeId();
  const gold = hex(colors.secondary);
  const sky = duskOf(colors);
  const far = blend(blend(hex(colors.muted), sky.low, 0.55), HILL_HAZE, 0.25);
  const near = blend(hex(colors.muted), sky.low, 0.3);
  const stone = lakeStone(colors);
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="0.42" stopColor={sky.mid} />
          <stop offset="0.7" stopColor={blend(sky.mid, sky.low, 0.6)} />
          <stop offset="0.75" stopColor={sky.low} />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={blend(sky.low, sky.top, 0.35)} />
          <stop offset="0.5" stopColor={tint(blend(sky.low, sky.top, 0.55), 0.12)} />
          <stop offset="1" stopColor={tint(blend(sky.low, sky.top, 0.5), 0.3)} />
        </linearGradient>
        <radialGradient id={`${id}u`} cx="0.66" cy="0.72" r="0.46">
          <stop offset="0" stopColor={SUN} stopOpacity="0.9" />
          <stop offset="0.3" stopColor={SUN} stopOpacity="0.42" />
          <stop offset="1" stopColor={SUN} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.haze} stopOpacity="0" />
          <stop offset="0.7" stopColor={sky.haze} stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLDEN} stopOpacity="0" />
          <stop offset="0.65" stopColor={GOLDEN} stopOpacity="0.34" />
          <stop offset="1" stopColor={GOLDEN} stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={SUN} stopOpacity="0" />
          <stop offset="0.5" stopColor={SUN} stopOpacity="0.55" />
          <stop offset="1" stopColor={SUN} stopOpacity="0" />
        </linearGradient>
        <LakePalaceDefs id={id} colors={colors} />
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="600" width="1200" height="200">
          <rect x="0" y="600" width="1200" height="200" fill={`url(#${id}f)`} />
        </mask>
        {palace ? (
          <g id={`${id}p`}>
            <LakePalace id={id} stone={stone} />
          </g>
        ) : null}
      </defs>
      <rect width="1200" height="600" fill={`url(#${id}k)`} />
      <rect width="1200" height="800" fill={`url(#${id}u)`} />
      <path d="M0 520 C110 490 210 492 320 508 C420 476 520 474 620 500 C730 478 850 466 980 494 C1070 478 1140 484 1200 496 V600 H0Z" fill={far} opacity="0.55" />
      <path d="M0 560 C150 540 270 546 390 556 C520 542 610 546 720 558 C850 546 1000 538 1200 552 V600 H0Z" fill={near} opacity="0.6" />
      <rect y="440" width="1200" height="162" fill={`url(#${id}o)`} />
      <rect y="520" width="1200" height="82" fill={`url(#${id}h)`} />
      <rect y="600" width="1200" height="200" fill={`url(#${id}w)`} />
      {/* The sun's path on the water, under the glow. */}
      <rect x="660" y="600" width="270" height="200" fill={`url(#${id}r)`} mask={`url(#${id}m)`} />
      {palace ? (
        <g mask={`url(#${id}m)`} opacity="0.26">
          <use href={`#${id}p`} transform="translate(340 740) scale(1 -1)" />
        </g>
      ) : null}
      {shimmerLines(30, 40, 1140, 606, 790, gold)}
      {shimmerLines(18, 700, 900, 604, 740, gold, 13)}
      {grove(960, 1200, 598, 1, 11)}
      <path d="M940 600 C990 590 1100 588 1200 594 V604 H940Z" fill={shade(GROVE, 0.12)} />
      {palace ? <use href={`#${id}p`} transform="translate(340 460)" /> : null}
    </svg>
  );
}

/**
 * The balcony hero's view (The Royal Heirloom), seen past the arcade: a golden-hour sky over a lake on a
 * 1440 × 720 frame that fills its box from the foot (xMidYMax slice). The sky is pale at the top (where the
 * page menu lies), warm behind the words and rose at the horizon; far hills in haze, still water with shimmer,
 * a grove on the far shore. With a photograph (`photo`), a long, low lake palace stands at the right on wide
 * pages, clear of the words; without one it stands inside the arcade on wide pages and in the arch on phones.
 */
export function BalconyVista({ colors, photo, className, style }: { colors: ThemeColors; photo: boolean; className?: string; style?: CSSProperties }) {
  const id = useSafeId();
  const gold = hex(colors.secondary);
  // Paler than the closing's sky: the words stand on it, so it stays near ivory until the horizon warms.
  const dusk = duskOf(colors);
  const surface = hex(colors.surface);
  const sky = { top: blend(surface, DUSK_HIGH, 0.3), mid: blend(surface, DUSK_HIGH, 0.75), low: blend(DUSK_HIGH, dusk.low, 0.7), haze: dusk.haze };
  const far = blend(blend(hex(colors.muted), sky.low, 0.6), HILL_HAZE, 0.3);
  const near = blend(blend(hex(colors.muted), sky.low, 0.4), HILL_HAZE, 0.1);
  const stone = lakeStone(colors);
  const H = 636; // the waterline
  // The palace on the waterline (its 520 × 140 grid scaled by s from x) and its reflection below it.
  const palaceAt = (x: number, s: number, className: string) => (
    <g className={className}>
      <g mask={`url(#${id}m)`} opacity="0.28">
        <use href={`#${id}p`} transform={`translate(${x} ${r2(H + 140 * s)}) scale(${s} ${-s})`} />
      </g>
      <use href={`#${id}p`} transform={`translate(${x} ${r2(H - 140 * s)}) scale(${s})`} />
    </g>
  );
  return (
    <svg viewBox="0 0 1440 720" preserveAspectRatio="xMidYMax slice" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="0.5" stopColor={sky.mid} />
          <stop offset="0.82" stopColor={blend(sky.mid, sky.low, 0.6)} />
          <stop offset="0.884" stopColor={sky.low} />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={blend(sky.low, sky.top, 0.3)} />
          <stop offset="1" stopColor={tint(blend(sky.low, sky.top, 0.5), 0.26)} />
        </linearGradient>
        <radialGradient id={`${id}u`} cx="0.72" cy="0.84" r="0.42">
          <stop offset="0" stopColor={SUN} stopOpacity="0.8" />
          <stop offset="0.35" stopColor={SUN} stopOpacity="0.32" />
          <stop offset="1" stopColor={SUN} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.haze} stopOpacity="0" />
          <stop offset="0.75" stopColor={sky.haze} stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.45" />
        </linearGradient>
        <LakePalaceDefs id={id} colors={colors} />
        <g id={`${id}p`}>
          <LakePalace id={id} stone={stone} />
        </g>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y={H} width="1440" height={720 - H}>
          <rect x="0" y={H} width="1440" height={720 - H} fill={`url(#${id}f)`} />
        </mask>
      </defs>
      <rect width="1440" height={H} fill={`url(#${id}k)`} />
      <rect width="1440" height="720" fill={`url(#${id}u)`} />
      <path d="M0 588 C120 566 250 570 380 584 C500 560 640 556 760 576 C880 560 1010 548 1150 572 C1260 558 1360 562 1440 574 V640 H0Z" fill={far} opacity="0.62" />
      <path d="M0 614 C170 600 300 604 430 612 C580 600 700 604 820 614 C980 602 1150 598 1440 610 V640 H0Z" fill={near} opacity="0.66" />
      <rect y="566" width="1440" height={H - 566 + 2} fill={`url(#${id}h)`} />
      <rect y={H} width="1440" height={720 - H} fill={`url(#${id}w)`} />
      {shimmerLines(30, 60, 1400, H + 6, 712, gold, 7)}
      {photo ? (
        palaceAt(1146, 0.54, 'hidden @min-[900px]:inline')
      ) : (
        <>
          {/* A grove on the far shore at the right, on its strip of land. */}
          <path d={`M1250 ${H + 2} C1290 ${H - 6} 1380 ${H - 9} 1440 ${H - 7} V${H + 3} H1250Z`} fill={shade(GROVE, 0.1)} />
          {grove(1262, 1440, H - 2, 1, 17)}
          {palaceAt(150, 1.15, 'hidden @min-[900px]:inline')}
          {palaceAt(476, 0.94, '@min-[900px]:hidden')}
        </>
      )}
    </svg>
  );
}
