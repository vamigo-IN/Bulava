import { blend, hex, Metal, NATURE, shade, taper, tint, useSafeId, type IllustrationProps } from './kit';
import { r2 } from './motifs';
import { Bride, Face, Groom } from './illustrations-people';

/**
 * Children, babies and portraits in the same gentle style as the couples:
 * a birthday boy and girl in party hats, a baby asleep in a cradle, a
 * mother-to-be, and the bride's and groom's portraits (the couple's figures,
 * framed at the shoulders). The tint is the outfit; hats, bows and blankets
 * take the palette.
 */

const HAIR = '#2a1a14';

/** A short limb along one curve, rounded at the end. */
function Limb({ from, to, bend = 0, w0, w1, fill }: { from: readonly [number, number]; to: readonly [number, number]; bend?: number; w0: number; w1: number; fill: string }) {
  const mx = (from[0] + to[0]) / 2 + bend;
  const my = (from[1] + to[1]) / 2;
  const seg = [from, [r2((from[0] + mx) / 2), r2((from[1] + my) / 2)], [r2((mx + to[0]) / 2), r2((my + to[1]) / 2)], to] as const;
  return (
    <g>
      <path d={taper([seg], [w0, w1])} fill={fill} />
      <circle cx={to[0]} cy={to[1]} r={w1 / 2 + 1.5} fill={fill} />
    </g>
  );
}

/** A striped cone party hat with a pompom, its base centred at (x, y). */
function PartyHat({ x, y, w, h, tilt = 8, c, pom, id }: { x: number; y: number; w: number; h: number; tilt?: number; c: string; pom: string; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <defs>
        <clipPath id={`${id}hat`}>
          <path d={`M${-w / 2} 0 L0 ${-h} L${w / 2} 0 Q0 ${w * 0.12} ${-w / 2} 0Z`} />
        </clipPath>
      </defs>
      <path d={`M${-w / 2} 0 L0 ${-h} L${w / 2} 0 Q0 ${w * 0.12} ${-w / 2} 0Z`} fill={c} />
      <g clipPath={`url(#${id}hat)`}>
        {[0.18, 0.42, 0.66].map((t) => (
          <path key={t} d={`M${-w} ${r2(-h * t)} l${w * 2} ${r2(-w * 0.5)} l0 ${r2(w * 0.16)} l${-w * 2} ${r2(w * 0.5)}Z`} fill="#ffffff" opacity="0.85" />
        ))}
      </g>
      <path d={`M${-w / 2} 0 Q0 ${w * 0.12} ${w / 2} 0`} fill="none" stroke={shade(c, 0.25)} strokeWidth="2" />
      <circle cx="0" cy={-h} r={w * 0.16} fill={pom} />
    </g>
  );
}

function Kid({ girl, color, colors, className, style }: IllustrationProps & { girl: boolean }) {
  const id = useSafeId();
  const c = hex(color);
  const accent = hex(colors.accent);
  const skin = girl ? NATURE.skin : NATURE.skinShade;
  return (
    <svg viewBox="0 -14 200 314" className={className} style={style} aria-hidden="true">
      <ellipse cx="100" cy="290" rx="52" ry="6" fill="#000000" opacity="0.1" />
      {/* Legs and shoes. */}
      <rect x="80" y={girl ? 232 : 228} width="14" height={girl ? 46 : 50} rx="7" fill={skin} />
      <rect x="106" y={girl ? 232 : 228} width="14" height={girl ? 46 : 50} rx="7" fill={skin} />
      <path d="M74 282 C74 272 96 272 96 282 L96 287 L74 287Z M104 282 C104 272 126 272 126 282 L126 287 L104 287Z" fill={girl ? accent : '#2b2f45'} />
      {girl ? (
        <g>
          {/* A twirly frock with a white collar and a bow at the waist. */}
          <path d="M76 142 C70 168 58 210 48 238 Q100 254 152 238 C142 210 130 168 124 142Z" fill={c} />
          <path d="M50 236 Q100 252 150 236" fill="none" stroke="#ffffff" strokeWidth="5" strokeDasharray="0 9" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={74 + i * 17} cy={208 + (i % 2) * 8} r="3.4" fill={tint(c, 0.55)} />
          ))}
          <path d="M84 144 Q100 158 116 144 L112 140 Q100 150 88 140Z" fill="#ffffff" />
          <path d="M100 176 L86 168 L86 184Z M100 176 L114 168 L114 184Z" fill={accent} />
          <circle cx="100" cy="176" r="3.6" fill={shade(accent, 0.2)} />
        </g>
      ) : (
        <g>
          <path d="M72 202 L128 202 L126 236 L104 236 L100 222 L96 236 L74 236Z" fill="#33405e" />
          <path d="M74 144 C70 160 70 186 72 206 L128 206 C130 186 130 160 126 144Z" fill={c} />
          <path d="M88 144 L100 160 L112 144Z" fill="#ffffff" />
          <path d="M92 146 L100 150 L108 146 L108 154 L100 150 L92 154Z" fill={accent} />
          {[170, 186].map((y) => (
            <circle key={y} cx="100" cy={y} r="2.2" fill={tint(c, 0.6)} />
          ))}
        </g>
      )}
      {/* Arms: one waving, one at the side. */}
      <Limb from={[78, 150]} to={[46, 112]} bend={-10} w0={15} w1={11} fill={skin} />
      <Limb from={[122, 150]} to={[150, 200]} bend={8} w0={15} w1={11} fill={skin} />
      <path d={girl ? 'M70 148 C66 156 66 166 72 172 L82 160Z M130 148 C134 156 134 166 128 172 L118 160Z' : 'M70 146 C64 154 64 166 70 172 L82 158Z M130 146 C136 154 136 166 130 172 L118 158Z'} fill={shade(c, 0.08)} />
      {/* Head, hair, face. */}
      <rect x="92" y="126" width="16" height="20" rx="6" fill={skin} />
      <circle cx="56" cy="96" r="8" fill={skin} />
      <circle cx="144" cy="96" r="8" fill={skin} />
      <circle cx="100" cy="92" r="46" fill={skin} />
      {girl ? (
        <g>
          <path d="M54 100 C48 52 78 42 100 44 C124 42 152 52 146 100 C140 80 132 70 116 66 C106 76 86 76 76 68 C64 74 58 86 54 100Z" fill={HAIR} />
          <circle cx="48" cy="104" r="15" fill={HAIR} />
          <circle cx="152" cy="104" r="15" fill={HAIR} />
          {[48, 152].map((x) => (
            <g key={x} transform={`translate(${x} 88)`}>
              <path d="M0 0 L-12 -8 L-12 8Z M0 0 L12 -8 L12 8Z" fill={accent} />
              <circle r="3.6" fill={shade(accent, 0.2)} />
            </g>
          ))}
        </g>
      ) : (
        <path d="M54 92 C50 54 78 44 100 46 C126 44 150 56 146 92 C142 76 136 70 126 68 L120 76 L112 66 L102 76 L94 66 L86 76 L78 68 C66 72 58 80 54 92Z" fill={HAIR} />
      )}
      <Face x={100} y={100} s={2.3} />
      <PartyHat x={102} y={54} w={50} h={56} tilt={girl ? -10 : 10} c={girl ? blend(c, accent, 0.5) : accent} pom={girl ? hex(colors.secondary) : c} id={id} />
    </svg>
  );
}

export const KidBoy = (p: IllustrationProps) => <Kid {...p} girl={false} />;
export const KidGirl = (p: IllustrationProps) => <Kid {...p} girl />;

/** A baby asleep in a wooden cradle, under a starry blanket (the tint), with a hanging mobile. */
export function BabyCradle({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const wood = '#b77a43';
  const woodDark = '#8a5a2f';
  return (
    <svg viewBox="0 0 260 220" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={260} y2={220} />
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(wood, 0.15)} />
          <stop offset="1" stopColor={shade(wood, 0.15)} />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="210" rx="96" ry="6" fill="#000000" opacity="0.1" />
      {/* The mobile: an arm from the headboard with a moon and stars. */}
      <path d="M44 66 C44 28 70 14 108 16" fill="none" stroke={woodDark} strokeWidth="3" strokeLinecap="round" />
      {[
        [78, 22, 30],
        [96, 18, 42],
        [112, 20, 26],
      ].map(([x, y, l], i) => (
        <g key={x}>
          <path d={`M${x} ${y} V${y! + l!}`} stroke="#d6c9b4" strokeWidth="1" />
          {i === 1 ? (
            <path d={`M${x! - 6} ${y! + l! + 2} A8 8 0 1 0 ${x! + 5} ${y! + l! + 10} A6 6 0 1 1 ${x! - 6} ${y! + l! + 2}Z`} fill={metal} />
          ) : (
            <path d={`M${x} ${y! + l! - 1} l2.2 4.6 5 0.6 -3.7 3.4 1 5 -4.5 -2.5 -4.5 2.5 1 -5 -3.7 -3.4 5 -0.6Z`} fill={metal} />
          )}
        </g>
      ))}
      {/* Headboard, footboard and the tub on its rockers. */}
      <rect x="32" y="60" width="18" height="120" rx="9" fill={`url(#${id}w)`} />
      <rect x="212" y="88" width="16" height="92" rx="8" fill={`url(#${id}w)`} />
      <path d="M36 196 C90 214 170 214 224 196" fill="none" stroke={woodDark} strokeWidth="6" strokeLinecap="round" />
      <path d="M40 112 C44 170 96 188 130 188 C164 188 216 170 220 112Z" fill={`url(#${id}w)`} />
      <path d="M40 112 H220" stroke={tint(wood, 0.3)} strokeWidth="4" strokeLinecap="round" />
      {[70, 100, 130, 160, 190].map((x) => (
        <path key={x} d={`M${x} 118 V${r2(176 - Math.abs(x - 130) * 0.28)}`} stroke={shade(wood, 0.22)} strokeWidth="2" opacity="0.6" />
      ))}
      {/* Pillow, baby, blanket. */}
      <ellipse cx="82" cy="108" rx="30" ry="14" fill="#ffffff" />
      <circle cx="84" cy="96" r="24" fill={NATURE.skin} />
      <path d="M60 94 C58 70 108 66 108 92 C98 82 72 82 60 94Z" fill={tint(hex(colors.accent), 0.15)} />
      <circle cx="84" cy="70" r="6" fill={hex(colors.accent)} />
      <Face x={84} y={98} s={1.5} />
      <path d="M100 104 C130 92 180 92 214 106 C214 120 210 130 204 136 C170 146 124 146 104 134 C98 124 98 112 100 104Z" fill={c} />
      <path d="M100 104 C130 92 180 92 214 106" fill="none" stroke={tint(c, 0.45)} strokeWidth="5" strokeLinecap="round" />
      {[
        [124, 118],
        [150, 112],
        [176, 120],
        [198, 114],
        [140, 130],
        [186, 132],
      ].map(([x, y]) => (
        <path key={`${x}${y}`} d={`M${x} ${y! - 4} l1.2 2.8 3 0.3 -2.3 2 0.7 3 -2.6 -1.5 -2.6 1.5 0.7 -3 -2.3 -2 3 -0.3Z`} fill="#ffffff" opacity="0.9" />
      ))}
    </svg>
  );
}

/** A mother-to-be in profile, in a saree (the tint), her hands on her belly, jasmine in her hair. */
export function MomToBe({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const skin = NATURE.skin;
  return (
    <svg viewBox="0 0 220 340" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={220} y2={340} />
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(c, 0.18)} />
          <stop offset="0.6" stopColor={tint(c, 0.1)} />
          <stop offset="1" stopColor={shade(c, 0.1)} />
        </linearGradient>
      </defs>
      <ellipse cx="108" cy="330" rx="70" ry="6" fill="#000000" opacity="0.1" />
      {/* The saree: a straight back, the belly's curve in front, falling to the feet. */}
      <path d="M80 112 C70 160 66 230 62 320 L150 320 C150 290 146 262 140 246 C164 230 172 196 156 170 C146 154 128 146 118 120 Z" fill={`url(#${id}s)`} />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${122 + i * 5} 252 L${120 + i * 6} 318`} stroke={shade(c, 0.28)} strokeWidth="1.1" opacity="0.7" />
      ))}
      <path d="M62 314 H150" stroke={metal} strokeWidth="6" />
      {/* The pallu over the shoulder, falling behind. */}
      <path d="M88 108 C76 140 60 200 44 262 L70 266 C84 206 98 150 112 116Z" fill={tint(c, 0.15)} stroke={metal} strokeWidth="2" />
      {/* Arms resting on the belly. */}
      <path d={taper([[[100, 128], [96, 160], [120, 178], [150, 182]]], [12, 9])} fill={skin} />
      <path d={taper([[[106, 132], [118, 160], [140, 214], [156, 214]]], [12, 9])} fill={skin} />
      {[
        [143, 181],
        [149, 213],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x! - 8} cy={y} r="5" fill="none" stroke="#c0262b" strokeWidth="1.8" />
          <circle cx={x! - 4} cy={y} r="5" fill="none" stroke="#f2c14e" strokeWidth="1.8" />
        </g>
      ))}
      <path d="M86 110 C92 104 112 104 118 112 L114 126 C104 120 94 120 86 126Z" fill={shade(c, 0.1)} />
      <path d="M90 110 Q102 120 114 112" fill="none" stroke={metal} strokeWidth="2.2" />
      {/* Head in profile, looking down at the baby to come. */}
      <rect x="96" y="88" width="13" height="22" rx="5" fill={skin} />
      <path d="M90 66 C90 48 112 42 124 54 C130 60 132 68 130 74 L134 80 L130 82 C130 92 124 98 114 98 C100 98 90 84 90 66Z" fill={skin} />
      <path d="M118 74 Q122 77 126 75" fill="none" stroke="#3b2418" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M121 88 Q125 90 128 87" fill="none" stroke="#3b2418" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="116" cy="84" rx="3.6" ry="2.2" fill="#f19a8e" opacity="0.55" />
      <path d="M88 70 C84 44 112 34 128 50 C120 50 112 54 108 62 C104 70 98 74 94 86 C90 82 88 76 88 70Z" fill={HAIR} />
      <circle cx="84" cy="62" r="13" fill={HAIR} />
      {/* A ring of jasmine round the bun (points on a 13-unit circle). */}
      {[
        [0, -13],
        [9.19, -9.19],
        [13, 0],
        [9.19, 9.19],
        [0, 13],
        [-9.19, 9.19],
        [-13, 0],
        [-9.19, -9.19],
      ].map(([dx, dy]) => (
        <circle key={`${dx}:${dy}`} cx={r2(84 + dx!)} cy={r2(62 + dy!)} r="2.4" fill="#ffffff" />
      ))}
      <circle cx="122" cy="58" r="1.4" fill="#c0262b" />
      <circle cx="113" cy="94" r="2.6" fill={metal} />
    </svg>
  );
}

/** The bride's portrait at the shoulders (her figure from the couple), in a soft round vignette. */
export function BrideBust({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  return (
    <svg viewBox="-60 44 120 120" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={120} y2={160} />
      </defs>
      {/* Arms resting at her sides, behind the dupatta. */}
      <path d={taper([[[-20, 112], [-26, 130], [-28, 150], [-29, 170]]], [13, 11])} fill={shade(c, 0.1)} />
      <path d={taper([[[20, 112], [26, 130], [28, 150], [29, 170]]], [13, 11])} fill={shade(c, 0.1)} />
      <Bride dress="lehenga" c={c} metal={`url(#${id}m)`} accent={hex(colors.accent)} id={`${id}b`} skin={NATURE.skin} />
    </svg>
  );
}

/** The groom's portrait at the shoulders, in his safa. */
export function GroomBust({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  return (
    <svg viewBox="-60 30 120 120" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={120} y2={160} />
      </defs>
      <path d={taper([[[-24, 114], [-31, 132], [-33, 150], [-34, 170]]], [14, 12])} fill={tint(hex(colors.secondary), 0.72)} />
      <path d={taper([[[24, 114], [31, 132], [33, 150], [34, 170]]], [14, 12])} fill={tint(hex(colors.secondary), 0.72)} />
      <Groom dress="safa" c={c} metal={`url(#${id}m)`} accent={blend(c, colors.accent, 0.5)} id={`${id}g`} skin={NATURE.skinShade} colors={colors} />
    </svg>
  );
}
