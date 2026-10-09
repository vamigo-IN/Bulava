import type { ReactNode } from 'react';
import { hex, Metal, NATURE, shade, taper, tint, useSafeId, type IllustrationProps } from './kit';
import { r2 } from './motifs';

/**
 * People, drawn in one gentle style: round faces with closed, smiling eyes and
 * a blush, outfits in the palette (the tint is the bride's or child's colour,
 * the metal the palette's secondary) and real skin, hair and flower colours.
 * Couples stand hand in hand, the bride on the left; every tradition shares
 * the same body so a host's colour preset restyles them all alike.
 */

const HAIR = '#2a1a14';
const GREY_HAIR = '#b9b4ae';
const LINE = '#3b2418';
const BLUSH = '#f19a8e';

/** A face: closed smiling eyes, a smile and blush (local origin at the face centre). */
export function Face({ x, y, s = 1, moustache = false, glasses = false, bindi = false }: { x: number; y: number; s?: number; moustache?: boolean; glasses?: boolean; bindi?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-8.5 1.5 Q-5.5 4.5 -2.5 1.5 M2.5 1.5 Q5.5 4.5 8.5 1.5" fill="none" stroke={LINE} strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="-9" cy="7" rx="3.2" ry="2" fill={BLUSH} opacity="0.55" />
      <ellipse cx="9" cy="7" rx="3.2" ry="2" fill={BLUSH} opacity="0.55" />
      {moustache ? <path d="M-5.5 9.5 Q-2.5 7.5 0 9 Q2.5 7.5 5.5 9.5 Q2.5 10.5 0 10 Q-2.5 10.5 -5.5 9.5Z" fill={HAIR} /> : null}
      <path d={moustache ? 'M-3 12.5 Q0 14.5 3 12.5' : 'M-3.2 10.5 Q0 13.5 3.2 10.5'} fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
      {bindi ? <circle cx="0" cy="-7" r="1.4" fill="#c0262b" /> : null}
      {glasses ? (
        <g fill="none" stroke={LINE} strokeWidth="1">
          <circle cx="-5.5" cy="2" r="4" />
          <circle cx="5.5" cy="2" r="4" />
          <path d="M-1.5 2 H1.5" />
        </g>
      ) : null}
    </g>
  );
}

/** Marigold garland as a chain of flowers along a quadratic curve. */
function Garland({ from, via, to, n = 13, size = 4.4 }: { from: readonly [number, number]; via: readonly [number, number]; to: readonly [number, number]; n?: number; size?: number }) {
  const flowers: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    const x = u * u * from[0] + 2 * u * t * via[0] + t * t * to[0];
    const y = u * u * from[1] + 2 * u * t * via[1] + t * t * to[1];
    flowers.push(<circle key={i} cx={r2(x)} cy={r2(y)} r={size} fill={i % 2 ? '#f7b733' : '#f0721f'} stroke="#c2410c" strokeWidth="0.5" />);
  }
  return <g>{flowers}</g>;
}

/** A forearm and hand along a tapered curve, with bangles near the wrist. */
function Arm({ from, c1, c2, to, sleeve, bangles, skin, sleeveTo = 0.38 }: { from: readonly [number, number]; c1: readonly [number, number]; c2: readonly [number, number]; to: readonly [number, number]; sleeve: string; bangles?: string[]; skin: string; sleeveTo?: number }) {
  const seg = [from, c1, c2, to] as const;
  const at = (t: number) => {
    const u = 1 - t;
    return [u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0], u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1]] as const;
  };
  const elbow = at(sleeveTo);
  const w = at(0.86);
  return (
    <g>
      <path d={taper([seg], [11, 7.5])} fill={skin} />
      <path d={taper([[from, [r2((from[0] + elbow[0]) / 2), r2((from[1] + elbow[1]) / 2)], [r2((from[0] + elbow[0] * 3) / 4), r2((from[1] + elbow[1] * 3) / 4)], [r2(elbow[0]), r2(elbow[1])]]], [13, 11])} fill={sleeve} />
      {(bangles ?? []).map((b, i) => (
        <circle key={i} cx={r2(w[0])} cy={r2(w[1] - 3 + i * 2.6)} r="4.6" fill="none" stroke={b} strokeWidth="1.8" />
      ))}
      <circle cx={to[0]} cy={to[1]} r="5.2" fill={skin} />
    </g>
  );
}

export type BrideDress = 'lehenga' | 'phulkari' | 'veil' | 'saree' | 'gown' | 'bengali' | 'elder';
export type GroomDress = 'safa' | 'pagri' | 'kulla' | 'veshti' | 'suit' | 'topor' | 'elder';

/** The bride, standing, centred on x = 0, her right hand reaching to x = 38, y = 206 (couple's clasped hands). */
export function Bride({ dress, c, metal, accent, id, skin }: { dress: BrideDress; c: string; metal: string; accent: string; id: string; skin: string }) {
  const lit = `url(#${id}bl)`;
  const veil = dress === 'gown' ? '#ffffff' : tint(c, 0.4);
  const isSaree = dress === 'saree' || dress === 'bengali' || dress === 'elder';
  const hair = dress === 'elder' ? GREY_HAIR : HAIR;
  const skirt = isSaree
    ? 'M-24 168 C-30 230 -40 300 -44 352 Q0 360 44 352 C40 300 30 230 24 168Z'
    : dress === 'gown'
      ? 'M-22 166 C-46 220 -80 300 -92 354 Q0 368 92 354 C80 300 46 220 22 166Z'
      : 'M-24 168 C-40 230 -70 300 -80 352 Q0 364 80 352 C70 300 40 230 24 168Z';
  const hem = isSaree ? 44 : dress === 'gown' ? 90 : 78;
  const dots: ReactNode[] = [];
  if (dress !== 'gown') {
    for (let row = 0; row < 7; row++) {
      for (let col = -6; col <= 6; col++) {
        const y = 196 + row * 21;
        const x = col * 13 + (row % 2) * 6.5;
        dots.push(<circle key={`${row}:${col}`} cx={x} cy={y} r={dress === 'phulkari' ? 1.4 : 1.6} fill={metal} opacity="0.85" />);
      }
    }
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${id}bl`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={dress === 'gown' ? '#ece8e1' : shade(c, 0.18)} />
          <stop offset="0.45" stopColor={dress === 'gown' ? '#ffffff' : tint(c, 0.12)} />
          <stop offset="1" stopColor={dress === 'gown' ? '#e6e1d9' : shade(c, 0.22)} />
        </linearGradient>
        <clipPath id={`${id}bs`}>
          <path d={skirt} />
        </clipPath>
      </defs>
      {/* The veil or dupatta behind the figure. */}
      {dress !== 'saree' && dress !== 'elder' ? (
        <path d="M-20 68 C-46 100 -60 210 -66 336 L46 336 C40 220 38 108 20 68Z" fill={veil} opacity={dress === 'gown' ? 0.72 : 0.6} stroke={dress === 'gown' ? '#e6e1d9' : metal} strokeWidth="1.4" />
      ) : null}
      {/* Skirt with buti and a zari hem. */}
      <path d={skirt} fill={lit} />
      <g clipPath={`url(#${id}bs)`}>
        {dots}
        {dress === 'gown'
          ? Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${-90 + i * 4} ${300 + i * 12} Q0 ${318 + i * 12} ${90 - i * 4} ${300 + i * 12}`} fill="none" stroke="#e3ddd3" strokeWidth="1.2" strokeDasharray="2 3" />)
          : null}
        {isSaree ? Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${-10 + i * 4} 230 L${-14 + i * 5.6} 352`} stroke={shade(c, 0.28)} strokeWidth="1" opacity="0.7" />) : null}
        {dress === 'gown' ? null : (
          <>
            <path d={`M${-hem - 4} 340 Q0 352 ${hem + 4} 340 L${hem + 4} 372 L${-hem - 4} 372Z`} fill={metal} />
            <path d={`M${-hem} 326 Q0 337 ${hem} 326`} fill="none" stroke={metal} strokeWidth="2.4" />
          </>
        )}
      </g>
      {/* Saree pallu across the body and over the left shoulder. */}
      {isSaree ? (
        <path d="M26 176 C10 160 -12 136 -24 110 L-12 108 C0 130 18 150 34 160Z" fill={dress === 'bengali' ? '#ffffff' : shade(c, 0.12)} stroke={metal} strokeWidth="2" />
      ) : null}
      {/* Blouse, with gold at the neckline. */}
      <path d="M-20 108 C-26 111 -27 122 -25 136 C-23 150 -22 162 -23 171 L23 171 C22 162 23 150 25 136 C27 122 26 111 20 108 Q0 113 -20 108Z" fill={dress === 'gown' ? '#ffffff' : shade(c, 0.1)} />
      {dress === 'gown' ? null : Array.from({ length: 4 }, (_, i) => <circle key={i} cx={-12 + i * 8} cy={150} r="1.3" fill={metal} />)}
      <path d="M-10 109 Q0 122 10 109" fill="none" stroke={dress === 'gown' ? '#e3ddd3' : metal} strokeWidth="2.2" />
      {isSaree || dress === 'lehenga' || dress === 'phulkari' || dress === 'veil' ? <path d="M-23 168 H23" stroke={metal} strokeWidth={isSaree ? 5 : 3} /> : null}
      {/* Neck, head, hair. */}
      <rect x="-5" y="98" width="10" height="14" rx="4" fill={skin} />
      <ellipse cx="0" cy="88" rx="15" ry="17" fill={skin} />
      <path d="M-16 88 C-19 64 19 64 16 88 C13 75 2 72 0 74 C-2 72 -13 75 -16 88Z" fill={hair} />
      {isSaree ? <ellipse cx="0" cy="70" rx="11" ry="6" fill={hair} /> : null}
      {dress === 'saree' || dress === 'elder' ? (
        // Jasmine (gajra) falling from the bun.
        <g fill="#ffffff" stroke="#e8e2d4" strokeWidth="0.4">
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={r2(14 + Math.min(i, 3) * 1.5)} cy={78 + i * 6} r="2.1" />
          ))}
        </g>
      ) : null}
      <Face x={0} y={88} bindi={dress !== 'gown'} glasses={dress === 'elder'} />
      {/* Jewellery: maang tikka, earrings, necklace, nose ring. */}
      {dress !== 'gown' && dress !== 'elder' ? (
        <g>
          <path d="M0 72 V78" stroke={metal} strokeWidth="1.2" />
          <circle cx="0" cy="79.5" r="2" fill={metal} />
          <circle cx="4.2" cy="94" r="1.8" fill="none" stroke={metal} strokeWidth="0.9" />
        </g>
      ) : null}
      <circle cx="-15" cy="100" r="2.6" fill={metal} />
      <circle cx="15" cy="100" r="2.6" fill={metal} />
      <path d="M-9 108 Q0 121 9 108" fill="none" stroke={metal} strokeWidth="2.6" />
      {dress !== 'gown' ? <path d="M-12 109 Q0 132 12 109" fill="none" stroke={metal} strokeWidth="1.3" strokeDasharray="0 3.4" strokeLinecap="round" /> : null}
      {/* Head covering: dupatta hood, veil, or the Bengali mukut. */}
      {dress === 'lehenga' || dress === 'phulkari' || dress === 'veil' ? (
        <path d="M-21 94 C-25 60 25 60 21 94 C17 71 -17 71 -21 94Z" fill={dress === 'phulkari' ? accent : tint(c, 0.25)} opacity="0.92" stroke={metal} strokeWidth="1.3" />
      ) : null}
      {dress === 'phulkari'
        ? Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${-14 + i * 7} 68 l2.4 -2.4 l2.4 2.4 l-2.4 2.4Z`} fill="#f7b733" />)
        : null}
      {dress === 'gown' ? <path d="M-14 72 C-18 60 18 60 14 72" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.9" /> : null}
      {dress === 'bengali' ? (
        <g>
          <path d="M-16 72 L-14 56 L-9 64 L-5 52 L0 62 L5 52 L9 64 L14 56 L16 72Z" fill="#ffffff" stroke={metal} strokeWidth="1" />
          {[-10, -6, -2, 2, 6, 10].map((x) => (
            <circle key={x} cx={x} cy={r2(78 - Math.abs(x) * 0.25)} r="0.9" fill="#ffffff" />
          ))}
        </g>
      ) : null}
    </g>
  );
}

/** The groom, standing, centred on x = 0, his left hand reaching to x = -38, y = 206. */
export function Groom({ dress, c, metal, accent, id, skin, colors }: { dress: GroomDress; c: string; metal: string; accent: string; id: string; skin: string; colors: IllustrationProps['colors'] }) {
  const ivory = tint(hex(colors.secondary), 0.72);
  const coat = dress === 'suit' ? '#2c3348' : dress === 'kulla' ? tint(hex(colors.secondary), 0.45) : dress === 'elder' ? accent : ivory;
  const coatShade = shade(coat, 0.12);
  const longCoat = dress === 'safa' || dress === 'pagri' || dress === 'kulla';
  const hair = dress === 'elder' ? GREY_HAIR : HAIR;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}gc`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={coatShade} />
          <stop offset="0.5" stopColor={tint(coat, 0.08)} />
          <stop offset="1" stopColor={shade(coat, 0.16)} />
        </linearGradient>
      </defs>
      {/* Legs: churidar, trousers, pyjama, or a veshti / dhoti. */}
      {dress === 'elder' ? (
        <g>
          <path d="M-22 214 C-22 270 -20 320 -20 348 L-3 348 L-1 214Z M1 214 L3 348 L20 348 C20 320 22 270 22 214Z" fill="#fbf8f0" stroke="#e6dfcc" strokeWidth="0.8" />
        </g>
      ) : dress === 'veshti' || dress === 'topor' ? (
        <g>
          <path d="M-26 214 L-30 350 L30 350 L26 214Z" fill="#fbf8f0" stroke="#e6dfcc" strokeWidth="1" />
          <path d="M-30 344 H30" stroke={metal} strokeWidth="5" />
          <path d="M4 214 L6 344" stroke={metal} strokeWidth="2.4" />
        </g>
      ) : (
        <g>
          <path d="M-18 280 C-17 310 -16 330 -16 348 L-4 348 C-4 330 -3 306 -2 280Z" fill={dress === 'suit' ? '#262c3f' : ivory} />
          <path d="M2 280 C3 306 4 330 4 348 L16 348 C16 330 17 310 18 280Z" fill={dress === 'suit' ? '#262c3f' : ivory} />
          {dress !== 'suit' ? <path d="M-15 336 h10 M-15 340 h10 M5 336 h10 M5 340 h10" stroke={shade(ivory, 0.15)} strokeWidth="0.8" /> : null}
        </g>
      )}
      <path d="M-20 348 C-24 350 -24 355 -14 355 L-2 355 L-2 348Z M2 348 L2 355 L14 355 C24 355 24 350 20 348Z" fill={dress === 'suit' ? '#16181f' : metal} />
      {/* The coat: a knee-length sherwani, a suit jacket, or a kurta. */}
      <path
        d={
          longCoat
            ? 'M-25 112 C-31 115 -33 128 -33 148 C-34 206 -36 256 -38 296 L38 296 C36 256 34 206 33 148 C33 128 31 115 25 112 Q0 117 -25 112Z'
            : dress === 'suit'
              ? 'M-25 112 C-31 115 -33 128 -32 150 C-32 196 -32 232 -32 262 L32 262 C32 232 32 196 32 150 C33 128 31 115 25 112 Q0 117 -25 112Z'
              : 'M-25 112 C-31 115 -32 128 -31 150 C-31 180 -32 204 -32 222 L32 222 C32 204 31 180 31 150 C32 128 31 115 25 112 Q0 117 -25 112Z'
        }
        fill={`url(#${id}gc)`}
      />
      {longCoat ? (
        <g>
          <path d="M-38 290 H38" stroke={metal} strokeWidth="4" />
          <path d="M-37 282 H37" stroke={metal} strokeWidth="1.2" strokeDasharray="0 4" strokeLinecap="round" />
          <path d="M0 116 V296" stroke={metal} strokeWidth="1.6" />
          {[136, 156, 176, 196, 216].map((y) => (
            <circle key={y} cx="0" cy={y} r="2" fill={metal} />
          ))}
          {[-1, 1].map((sx) => (
            <path key={sx} d={`M${sx * 4} 240 q${sx * 8} -6 ${sx * 14} 2 q${sx * -4} 8 ${sx * -14} -2Z`} fill="none" stroke={metal} strokeWidth="1" />
          ))}
          <path d="M-10 108 L-10 116 Q0 120 10 116 L10 108" fill="none" stroke={metal} strokeWidth="3" />
        </g>
      ) : null}
      {dress === 'suit' ? (
        <g>
          <path d="M-9 112 L0 150 L9 112Z" fill="#ffffff" />
          <path d="M-9 112 L-3 152 L-18 126Z M9 112 L3 152 L18 126Z" fill="#1d2232" />
          <path d="M-6 117 L0 120 L6 117 L6 124 L0 121 L-6 124Z" fill="#14161d" />
          <circle cx="-17" cy="140" r="4" fill={c} />
          <circle cx="0" cy="190" r="1.8" fill="#14161d" />
          <circle cx="0" cy="212" r="1.8" fill="#14161d" />
        </g>
      ) : null}
      {dress === 'veshti' || dress === 'topor' ? (
        // Angavastram (or uttariya) over the left shoulder.
        <path d="M-25 114 C-18 156 -8 200 -2 238 L10 236 C4 196 -6 152 -13 110Z" fill="#fbf8f0" stroke={metal} strokeWidth="2" />
      ) : null}
      {dress === 'elder' ? <path d="M-16 114 L-16 222 M16 114 L16 222" stroke={shade(accent, 0.2)} strokeWidth="2" /> : null}
      {/* Stole in the bride's colour. */}
      {longCoat ? <path d="M17 112 C6 166 -10 220 -24 274 L-12 278 C2 226 16 172 27 118Z" fill={c} stroke={metal} strokeWidth="1.6" /> : null}
      {/* Pearl mala. */}
      {longCoat ? <path d="M-10 116 Q0 162 10 116" fill="none" stroke="#fffaf0" strokeWidth="2.4" strokeDasharray="0 4" strokeLinecap="round" /> : null}
      {/* Neck and head. */}
      <rect x="-6" y="96" width="12" height="20" rx="4" fill={skin} />
      <ellipse cx="0" cy="85" rx="15.5" ry="17.5" fill={skin} />
      <ellipse cx="-15.5" cy="87" rx="2.6" ry="4" fill={skin} />
      <ellipse cx="15.5" cy="87" rx="2.6" ry="4" fill={skin} />
      {dress === 'suit' || dress === 'veshti' || dress === 'elder' ? <path d="M-16 82 C-18 62 18 62 16 82 C12 72 4 70 -2 72 C-8 70 -13 74 -16 82Z" fill={hair} /> : null}
      <Face x={0} y={86} moustache={dress === 'pagri' || dress === 'kulla' || dress === 'elder'} glasses={dress === 'elder'} />
      {/* Headwear (drawn for a head 8 units higher). */}
      <g transform="translate(0 8)">
      {dress === 'safa' ? (
        <g>
          <path d="M-18 68 C-22 40 -8 26 4 28 C22 30 24 50 18 68 C6 62 -6 62 -18 68Z" fill={accent} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${-19 + i * 2} ${62 - i * 8} C-4 ${50 - i * 8} 8 ${52 - i * 8} ${19 - i} ${58 - i * 8}`} fill="none" stroke={tint(accent, 0.35)} strokeWidth="2" />
          ))}
          <path d="M16 56 C26 66 30 88 28 112" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />
          <circle cx="2" cy="44" r="3.6" fill={metal} />
          <path d="M3 41 C6 30 12 24 20 20 C14 28 10 34 6 42Z" fill="#ffffff" stroke="#e8e2d6" strokeWidth="0.6" />
          <path d="M-12 60 Q0 56 12 60" fill="none" stroke="#fffaf0" strokeWidth="1.6" strokeDasharray="0 3.4" strokeLinecap="round" />
        </g>
      ) : null}
      {dress === 'pagri' ? (
        <g>
          <path d="M-18 68 C-20 46 -10 30 0 26 C10 30 20 46 18 68 C6 62 -6 62 -18 68Z" fill={accent} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${-17 + i * 3} ${62 - i * 9} L0 ${30 + i * 2} L${17 - i * 3} ${62 - i * 9}`} fill="none" stroke={tint(accent, 0.35)} strokeWidth="2" />
          ))}
        </g>
      ) : null}
      {dress === 'kulla' ? (
        <g>
          <path d="M-18 68 C-22 44 -10 30 0 30 C10 30 22 44 18 68 C6 62 -6 62 -18 68Z" fill={c} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${-18 + i * 2} ${60 - i * 9} C-6 ${52 - i * 9} 6 ${52 - i * 9} ${18 - i * 2} ${60 - i * 9}`} fill="none" stroke={tint(c, 0.3)} strokeWidth="1.8" />
          ))}
          <path d="M-18 64 C-6 58 6 58 18 64" fill="none" stroke={metal} strokeWidth="2.4" />
          <circle cx="0" cy="48" r="3.4" fill={metal} />
          <path d="M-3 46 L0 36 L3 46Z" fill={metal} />
        </g>
      ) : null}
      {dress === 'topor' ? (
        <g>
          <path d="M-16 66 L-8 18 L0 8 L8 18 L16 66Z" fill="#ffffff" stroke={metal} strokeWidth="1.2" />
          <path d="M-12 50 L12 50 M-10 36 L10 36 M-6 24 L6 24" stroke={metal} strokeWidth="1" strokeDasharray="1.6 1.6" />
        </g>
      ) : null}
      </g>
    </g>
  );
}

/** A couple hand in hand, the bride on the left: the tint is her outfit (and his stole or turban band). */
function Couple({ bride, groom, garlands = false, color, colors, foil, className, style }: IllustrationProps & { bride: BrideDress; groom: GroomDress; garlands?: boolean }) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const accent = groom === 'safa' || groom === 'pagri' ? tint(hex(colors.accent) === '#ffffff' ? c : blendSafe(c, colors.accent), 0.05) : hex(colors.accent);
  const skin = NATURE.skin;
  const skin2 = NATURE.skinShade;
  const brideSleeve = bride === 'gown' ? '#f6f3ee' : bride === 'bengali' ? '#ffffff' : shade(c, 0.1);
  // Red and gold glass bangles; the Bengali bride's shakha-pola are white and red.
  const bangles = bride === 'gown' ? [] : bride === 'bengali' ? ['#ffffff', '#c0262b', '#ffffff'] : ['#c0262b', '#f2c14e', '#c0262b'];
  return (
    <svg viewBox="0 0 300 380" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={300} y2={380} />
      </defs>
      <ellipse cx="150" cy="360" rx="120" ry="9" fill="#000000" opacity="0.08" />
      <g transform="translate(192 0)">
        <Groom dress={groom} c={c} metal={metal} accent={accent} id={`${id}g`} skin={skin2} colors={colors} />
      </g>
      <g transform="translate(108 4)">
        <Bride dress={bride} c={c} metal={metal} accent={accent} id={`${id}b`} skin={skin} />
      </g>
      {/* Arms: hers to the clasped hands, his to meet them; the outer arms rest. */}
      <Arm from={[88, 118]} c1={[80, 160]} c2={[76, 190]} to={[78, 216]} sleeve={brideSleeve} bangles={bangles} skin={skin} />
      <Arm from={[128, 118]} c1={[136, 160]} c2={[144, 190]} to={[150, 210]} sleeve={brideSleeve} bangles={bangles} skin={skin} />
      <Arm from={[167, 116]} c1={[160, 160]} c2={[156, 190]} to={[155, 210]} sleeve={groom === 'suit' ? '#2c3348' : tint(hex(colors.secondary), groom === 'kulla' ? 0.45 : 0.72)} skin={skin2} />
      <Arm from={[217, 116]} c1={[224, 160]} c2={[228, 190]} to={[226, 218]} sleeve={groom === 'suit' ? '#2c3348' : tint(hex(colors.secondary), groom === 'kulla' ? 0.45 : 0.72)} skin={skin2} />
      {bride === 'gown' ? (
        // A bouquet in her free hand.
        <g transform="translate(80 214)">
          <path d="M-2 4 L-6 26 M2 4 L4 26" stroke={NATURE.leafDark} strokeWidth="2" />
          {[
            [-8, -2],
            [0, -6],
            [8, -2],
            [-4, 4],
            [5, 4],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="5.5" fill={c} stroke={shade(c, 0.25)} strokeWidth="0.8" />
          ))}
          <path d="M-12 2 C-16 -2 -16 -8 -12 -10 M12 2 C16 -2 16 -8 12 -10" fill="none" stroke={NATURE.leaf} strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : null}
      {garlands ? (
        <g>
          <Garland from={[90, 120]} via={[108, 200]} to={[126, 120]} n={15} />
          <Garland from={[176, 118]} via={[192, 196]} to={[208, 118]} n={15} />
        </g>
      ) : null}
    </svg>
  );
}

function blendSafe(a: string, b: string): string {
  const x = hex(a);
  const y = hex(b);
  const mixC = (i: number) => Math.round((parseInt(x.slice(i, i + 2), 16) + parseInt(y.slice(i, i + 2), 16)) / 2);
  return `#${[1, 3, 5].map((i) => mixC(i).toString(16).padStart(2, '0')).join('')}`;
}

export const CoupleHindu = (p: IllustrationProps) => <Couple {...p} bride="lehenga" groom="safa" />;
export const CoupleVarmala = (p: IllustrationProps) => <Couple {...p} bride="lehenga" groom="safa" garlands />;
export const CoupleSikh = (p: IllustrationProps) => <Couple {...p} bride="phulkari" groom="pagri" />;
export const CoupleNikah = (p: IllustrationProps) => <Couple {...p} bride="veil" groom="kulla" />;
export const CoupleSouth = (p: IllustrationProps) => <Couple {...p} bride="saree" groom="veshti" />;
export const CoupleChristian = (p: IllustrationProps) => <Couple {...p} bride="gown" groom="suit" />;
export const CoupleBengali = (p: IllustrationProps) => <Couple {...p} bride="bengali" groom="topor" />;
export const CoupleElder = (p: IllustrationProps) => <Couple {...p} bride="elder" groom="elder" />;
