import { hex, Lit, Metal, NATURE, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { r2 } from './motifs';
import { Face } from './illustrations-people';

/**
 * Things that set an occasion: the stork, a teddy, a unicorn and a little
 * dinosaur, a rocket and a cupcake for children's parties; the doli, the dhol
 * and the haldi bowl for weddings; a champagne toast for receptions and
 * anniversaries. The tint is each one's main colour; metal is the palette's
 * secondary.
 */

/** A five-pointed star centred at (x, y). */
const star = (x: number, y: number, r: number) => {
  const pts = [
    [0, -1],
    [0.2245, -0.309],
    [0.9511, -0.309],
    [0.3633, 0.118],
    [0.5878, 0.809],
    [0, 0.382],
    [-0.5878, 0.809],
    [-0.3633, 0.118],
    [-0.9511, -0.309],
    [-0.2245, -0.309],
  ];
  return `M${pts.map(([px, py]) => `${r2(x + px! * r)} ${r2(y + py! * r)}`).join(' L')}Z`;
};

/** A stork flying with a bundle hanging from its beak. The tint is the bundle's cloth. */
export function Stork({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  const white = '#fbfaf6';
  const line = '#c8c2b6';
  return (
    <svg viewBox="0 0 300 230" className={className} style={style} aria-hidden="true">
      {/* Far wing, body, near wing. */}
      <path d="M150 74 C170 30 214 12 262 16 C232 30 206 52 186 84Z" fill="#e9e4da" stroke={line} strokeWidth="1" />
      <path d="M86 92 C108 70 160 66 196 80 C214 88 224 100 226 112 C204 112 180 110 160 112 C130 116 100 112 86 92Z" fill={white} stroke={line} strokeWidth="1" />
      <path d="M128 84 C140 40 184 14 236 8 C214 30 196 56 182 90 C164 92 144 90 128 84Z" fill={white} stroke={line} strokeWidth="1" />
      <path d="M218 22 C226 24 234 26 240 30 M206 34 C214 38 222 42 228 48" stroke={line} strokeWidth="1" fill="none" />
      <path d="M224 110 L252 118 L226 116Z" fill="#26262b" />
      {/* Neck, head, beak and legs trailing. */}
      <path d="M96 94 C84 84 74 70 68 56 C64 46 56 42 48 46" fill="none" stroke={white} strokeWidth="14" strokeLinecap="round" />
      <circle cx="46" cy="46" r="12" fill={white} stroke={line} strokeWidth="1" />
      <circle cx="44" cy="43" r="2" fill="#26262b" />
      <path d="M36 48 L4 64 L36 54Z" fill="#f08a24" />
      <path d="M200 112 L240 140 M204 110 L246 132" stroke="#f08a24" strokeWidth="3" strokeLinecap="round" />
      {/* The bundle: a knotted cloth with a sleeping baby. */}
      <path d="M14 62 C12 84 16 104 22 118" fill="none" stroke={shade(c, 0.2)} strokeWidth="3" />
      <path d="M0 116 C0 104 44 104 44 116 C46 150 36 176 22 176 C8 176 -2 150 0 116Z" transform="translate(4 0)" fill={c} stroke={shade(c, 0.22)} strokeWidth="1.2" />
      <path d="M8 112 C14 100 34 100 40 112" fill={tint(c, 0.3)} />
      <circle cx="26" cy="132" r="13" fill={NATURE.skin} />
      <Face x={26} y={134} s={0.9} />
      <path d="M14 128 C16 116 36 116 38 128 C32 122 20 122 14 128Z" fill={tint(c, 0.4)} />
      {[
        [62, 150],
        [80, 176],
        [52, 196],
      ].map(([x, y]) => (
        <path key={x} d={star(x!, y!, 5)} fill={hex(colors.secondary)} opacity="0.85" />
      ))}
    </svg>
  );
}

/** A teddy bear sitting, with a bow tie in the tint. */
export function TeddyBear({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const fur = '#b98352';
  const light = '#e7c49b';
  return (
    <svg viewBox="0 0 200 220" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}f`} base={fur} light={0.25} dark={0.2} />
      </defs>
      <ellipse cx="100" cy="212" rx="70" ry="6" fill="#000000" opacity="0.1" />
      <ellipse cx="62" cy="186" rx="26" ry="20" fill={`url(#${id}f)`} />
      <ellipse cx="138" cy="186" rx="26" ry="20" fill={`url(#${id}f)`} />
      <ellipse cx="62" cy="190" rx="14" ry="11" fill={light} />
      <ellipse cx="138" cy="190" rx="14" ry="11" fill={light} />
      <ellipse cx="100" cy="146" rx="50" ry="52" fill={`url(#${id}f)`} />
      <ellipse cx="100" cy="156" rx="30" ry="32" fill={light} />
      <ellipse cx="50" cy="134" rx="16" ry="24" transform="rotate(30 50 134)" fill={`url(#${id}f)`} />
      <ellipse cx="150" cy="134" rx="16" ry="24" transform="rotate(-30 150 134)" fill={`url(#${id}f)`} />
      <circle cx="58" cy="36" r="18" fill={`url(#${id}f)`} />
      <circle cx="142" cy="36" r="18" fill={`url(#${id}f)`} />
      <circle cx="58" cy="36" r="9" fill={light} />
      <circle cx="142" cy="36" r="9" fill={light} />
      <circle cx="100" cy="66" r="46" fill={`url(#${id}f)`} />
      <ellipse cx="100" cy="82" rx="20" ry="15" fill={light} />
      <ellipse cx="100" cy="75" rx="7" ry="5" fill="#3b2418" />
      <path d="M100 80 V86 M92 88 Q100 94 108 88" fill="none" stroke="#3b2418" strokeWidth="2" strokeLinecap="round" />
      <circle cx="82" cy="58" r="4.4" fill="#3b2418" />
      <circle cx="118" cy="58" r="4.4" fill="#3b2418" />
      <circle cx="83.5" cy="56.5" r="1.4" fill="#ffffff" />
      <circle cx="119.5" cy="56.5" r="1.4" fill="#ffffff" />
      <path d="M100 112 L76 100 L76 124Z M100 112 L124 100 L124 124Z" fill={c} />
      <circle cx="100" cy="112" r="6" fill={shade(c, 0.2)} />
    </svg>
  );
}

/** A little unicorn standing, with a gold horn and hooves, a flower garland and a pastel mane and tail (the tint). */
export function Unicorn({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const manes = [c, tint(c, 0.35), hex(colors.accent), tint(hex(colors.accent), 0.4)];
  const coat = '#ffffff';
  const line = '#e2d9ea';
  const far = '#f1ecf6';
  // Legs: far ones first (a shade darker), then the near ones over the body's edge.
  const leg = (x: number, fill: string, k: string) => (
    <g key={k}>
      <path d={`M${x} 172 L${x + 1.5} 218 Q${x + 1.5} 224 ${x + 7} 224 L${x + 10} 224 Q${x + 15.5} 224 ${x + 15.5} 218 L${x + 17} 172Z`} fill={fill} stroke={line} strokeWidth="1.4" />
      <path d={`M${x + 0.5} 215 L${x + 16.5} 215 L${x + 16} 226 Q${x + 16} 230 ${x + 12} 230 L${x + 5} 230 Q${x + 1} 230 ${x + 1} 226Z`} fill={metal} />
    </g>
  );
  return (
    <svg viewBox="0 0 220 250" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={220} y2={250} />
      </defs>
      <ellipse cx="128" cy="232" rx="78" ry="7" fill="#000000" opacity="0.08" />
      {/* The tail, in waves of the mane's colours. */}
      {manes.map((m, i) => (
        <path key={`t${i}`} d={`M182 ${140 + i * 4} C${200 + i * 3} ${128 + i * 5} ${214 - i * 2} ${148 + i * 6} ${202 - i * 2} ${166 + i * 6} C${194 - i} ${180 + i * 5} ${204 + i * 2} ${194 + i * 4} ${212 - i * 3} ${202 + i * 4}`} fill="none" stroke={m} strokeWidth="11" strokeLinecap="round" />
      ))}
      {leg(104, far, 'lf')}
      {leg(152, far, 'lb')}
      {/* The body and neck in one line, with a soft shadow under the belly. */}
      <path d="M78 160 C72 142 72 124 78 110 L104 96 C112 110 120 118 134 118 C164 116 186 128 188 152 C190 174 172 190 150 190 L102 190 C86 190 80 176 78 160Z" fill={coat} stroke={line} strokeWidth="1.6" />
      <path d="M96 186 C120 194 150 194 172 182 C160 190 150 191 140 191 L104 191 C100 191 98 189 96 186Z" fill={far} />
      {leg(86, coat, 'rf')}
      {leg(166, coat, 'rb')}
      {/* A garland of little flowers where the neck meets the body. */}
      {[
        [80, 118],
        [90, 124],
        [101, 127],
        [112, 125],
      ].map(([x, y], i) => (
        <g key={`f${i}`}>
          <circle cx={x} cy={y} r="5.2" fill={manes[i % 2 === 0 ? 2 : 0]} />
          <circle cx={x} cy={y} r="1.8" fill={metal} />
        </g>
      ))}
      {/* The mane down the back of the head and neck. */}
      {manes.map((m, i) => (
        <path key={`m${i}`} d={`M${96 + i * 5} ${36 + i * 6} C${116 + i * 4} ${46 + i * 8} ${108 + i * 5} ${74 + i * 8} ${122 + i * 4} ${90 + i * 8} C${128 + i * 3} ${100 + i * 6} ${124 + i * 2} ${108 + i * 4} ${132 + i * 2} ${116 + i * 2}`} fill="none" stroke={m} strokeWidth="12" strokeLinecap="round" />
      ))}
      {/* The head in profile, facing left, a round muzzle in the tint. */}
      <path d="M104 70 C104 46 84 36 66 40 C52 43 44 54 42 66 C30 70 20 80 22 94 C24 108 38 114 52 112 C66 120 90 116 100 100 C106 90 106 80 104 70Z" fill={coat} stroke={line} strokeWidth="1.6" />
      <path d="M36 74 C26 80 21 88 23 96 C26 108 38 113 50 111 C43 104 40 94 42 84 C40 80 38 77 36 74Z" fill={tint(c, 0.9)} />
      <ellipse cx="29" cy="90" rx="2.6" ry="2" fill={shade(c, 0.35)} />
      <path d="M30 103 Q37 108 45 105" fill="none" stroke="#c9bfd0" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M62 72 Q70 79 79 72" fill="none" stroke="#3b2418" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M64 71 L61 66 M70 73 L70 67 M76 71 L79 66" stroke="#3b2418" strokeWidth="1.3" strokeLinecap="round" />
      <ellipse cx="62" cy="90" rx="8" ry="4.6" fill="#f19a8e" opacity="0.45" />
      <path d="M88 44 L98 16 L108 48Z" fill={coat} stroke={line} strokeWidth="1.2" />
      <path d="M93 42 L98 26 L103 44Z" fill={tint(c, 0.7)} />
      {/* The horn, spiralled, and a forelock under it. */}
      <path d="M56 46 L50 4 L70 42Z" fill={metal} />
      {[12, 22, 32].map((y) => (
        <path key={y} d={`M${r2(52.5 + (y - 12) * 0.08)} ${y + 5} L${r2(62 - (y - 12) * 0.05)} ${y - 1}`} stroke="#ffffff" strokeWidth="1.4" opacity="0.7" />
      ))}
      <path d="M58 48 C54 36 70 30 82 40 C72 40 66 44 64 52Z" fill={manes[1]} />
      <path d="M70 46 C70 36 84 32 92 42 C84 42 78 46 76 52Z" fill={manes[2]} />
      {[
        [196, 40],
        [176, 84],
        [22, 154],
      ].map(([x, y]) => (
        <path key={x} d={star(x!, y!, 7)} fill={metal} />
      ))}
    </svg>
  );
}

/** A friendly little dinosaur (the tint), with back spikes in the accent. */
export function Dino({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const spikes = hex(colors.accent);
  return (
    <svg viewBox="0 0 260 210" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}d`} base={c} light={0.25} dark={0.2} />
      </defs>
      <ellipse cx="130" cy="202" rx="96" ry="6" fill="#000000" opacity="0.1" />
      {[
        [96, 92],
        [118, 80],
        [142, 78],
        [166, 86],
        [188, 102],
        [208, 122],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x! - 10} ${y! + 8} L${x} ${y! - 10} L${x! + 10} ${y! + 8}Z`} fill={spikes} />
      ))}
      <path d="M60 150 C60 104 100 84 140 86 C190 88 220 120 250 168 C222 160 206 158 196 162 L196 186 L172 186 L170 166 L112 166 L110 186 L86 186 L84 160 C70 160 60 158 60 150Z" fill={`url(#${id}d)`} />
      <path d="M64 120 C40 112 30 86 40 62 C50 40 82 36 98 54 C108 66 104 92 92 108Z" fill={`url(#${id}d)`} />
      <ellipse cx="120" cy="140" rx="34" ry="22" fill={tint(c, 0.4)} />
      <circle cx="62" cy="66" r="7" fill="#ffffff" />
      <circle cx="63" cy="67" r="4" fill="#2a2a2a" />
      <circle cx="64.5" cy="65.5" r="1.4" fill="#ffffff" />
      <path d="M44 86 Q58 96 74 90" fill="none" stroke={shade(c, 0.45)} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="78" cy="84" rx="6" ry="3.6" fill="#f19a8e" opacity="0.55" />
      <path d="M92 124 C100 132 98 140 90 142" fill="none" stroke={shade(c, 0.2)} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** A rocket lifting off (body in the tint) among stars. */
export function Rocket({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 170 270" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={170} y2={270} />
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dfe3ea" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cdd3dd" />
        </linearGradient>
      </defs>
      <path d="M70 196 C62 226 72 252 85 266 C98 252 108 226 100 196Z" fill="#ffb02e" />
      <path d="M76 198 C72 220 78 238 85 248 C92 238 98 220 94 198Z" fill="#fff3c4" />
      <path d="M58 150 L30 196 L60 190Z M112 150 L140 196 L110 190Z" fill={c} />
      <path d="M85 14 C112 40 120 90 114 196 L56 196 C50 90 58 40 85 14Z" fill={`url(#${id}b)`} />
      <path d="M85 14 C98 26 106 40 110 56 L60 56 C64 40 72 26 85 14Z" fill={c} />
      <circle cx="85" cy="104" r="20" fill={metal} />
      <circle cx="85" cy="104" r="14" fill="#7fc8f8" />
      <path d="M78 98 A9 9 0 0 1 90 96" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M56 178 H114" stroke={c} strokeWidth="8" />
      <path d="M85 150 V196" stroke={c} strokeWidth="5" />
      {[
        [20, 40, 7],
        [150, 70, 6],
        [24, 230, 5],
        [146, 240, 7],
      ].map(([x, y, r]) => (
        <path key={x} d={star(x!, y!, r!)} fill={metal} />
      ))}
    </svg>
  );
}

/** A cupcake: a striped liner (the tint), a swirl of frosting (the accent), a cherry and a candle. */
export function Cupcake({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  const icing = tint(hex(colors.accent), 0.35);
  return (
    <svg viewBox="0 0 160 210" className={className} style={style} aria-hidden="true">
      <ellipse cx="80" cy="204" rx="52" ry="5" fill="#000000" opacity="0.1" />
      <path d="M78 22 C76 14 82 10 80 4 C86 10 86 18 82 22Z" fill="#ffb02e" />
      <rect x="77" y="22" width="6" height="34" rx="2" fill={tint(c, 0.5)} />
      <path d="M77 30 L83 26 M77 40 L83 36 M77 50 L83 46" stroke={c} strokeWidth="2" />
      <path d="M30 120 C18 116 14 100 26 92 C20 78 34 66 48 72 C48 56 70 50 80 62 C90 50 112 56 112 72 C126 66 140 78 134 92 C146 100 142 116 130 120Z" fill={icing} />
      <path d="M40 104 C60 96 100 96 120 104 M48 88 C64 82 96 82 112 88" fill="none" stroke={tint(icing, 0.4)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="104" cy="66" r="9" fill="#c0262b" />
      <path d="M104 58 C106 50 112 46 116 46" fill="none" stroke={NATURE.leafDark} strokeWidth="1.6" />
      {[
        [52, 100, '#ffd166'],
        [70, 92, '#118ab2'],
        [92, 104, '#ef476f'],
        [114, 96, '#06d6a0'],
        [60, 112, '#118ab2'],
      ].map(([x, y, f]) => (
        <rect key={`${x}${y}`} x={x as number} y={y as number} width="7" height="2.6" rx="1.3" fill={f as string} transform={`rotate(${((x as number) * 7) % 60 - 30} ${x} ${y})`} />
      ))}
      <path d="M28 120 L40 198 L120 198 L132 120Z" fill={c} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${42 + i * 16} 122 L${48 + i * 14.4} 198`} stroke={shade(c, 0.2)} strokeWidth="5" />
      ))}
      <path d="M28 120 H132" stroke={shade(c, 0.25)} strokeWidth="3" />
    </svg>
  );
}

/** A doli (bridal palanquin): a curtained cabin under a domed roof on carrying poles, hung with marigolds. */
export function Doli({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 320 250" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={320} y2={250} />
        <Lit id={`${id}c`} base={c} light={0.2} dark={0.25} />
      </defs>
      <ellipse cx="160" cy="240" rx="110" ry="6" fill="#000000" opacity="0.1" />
      <path d="M8 168 H312" stroke={shade(hex(colors.secondary), 0.35)} strokeWidth="9" strokeLinecap="round" />
      <path d="M8 168 H312" stroke={metal} strokeWidth="4" strokeLinecap="round" />
      {/* Cabin with curtains drawn back. */}
      <rect x="92" y="96" width="136" height="104" fill={tint(c, 0.75)} />
      <path d="M92 96 C120 120 118 170 100 200 L92 200Z M228 96 C200 120 202 170 220 200 L228 200Z" fill={`url(#${id}c)`} />
      <path d="M92 96 C110 140 136 150 160 150 C184 150 210 140 228 96Z" fill={`url(#${id}c)`} />
      {[110, 130, 150, 170, 190, 210].map((x) => (
        <circle key={x} cx={x} cy={r2(108 + Math.abs(x - 160) * -0.3 + 22)} r="2" fill={metal} />
      ))}
      <rect x="86" y="196" width="148" height="14" rx="3" fill={metal} />
      <rect x="86" y="88" width="148" height="12" rx="3" fill={metal} />
      {/* Domed roof with a finial. */}
      <path d="M80 90 C90 52 126 30 160 30 C194 30 230 52 240 90Z" fill={`url(#${id}c)`} />
      <path d="M80 90 C90 52 126 30 160 30 C194 30 230 52 240 90" fill="none" stroke={metal} strokeWidth="3" />
      <path d="M100 88 C110 64 132 50 160 48 C188 50 210 64 220 88" fill="none" stroke={metal} strokeWidth="1.4" strokeDasharray="0 6" strokeLinecap="round" />
      <path d="M154 30 L160 6 L166 30Z" fill={metal} />
      <circle cx="160" cy="6" r="4" fill={metal} />
      {/* Marigold strings at the corners. */}
      {[92, 228].map((x) => (
        <g key={x}>
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={x} cy={102 + i * 11} r="4.6" fill={i % 2 ? '#f7b733' : '#f0721f'} />
          ))}
        </g>
      ))}
      <path d="M86 210 L80 230 M234 210 L240 230" stroke={shade(hex(colors.secondary), 0.35)} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** A dhol on its strap: a barrel drum with laced sides; the tint is the drum's body. */
export function Dhol({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const lace: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 62 + i * 12;
    lace.push(`M${x} 52 L${x + 6} 128`, `M${x + 6} 52 L${x} 128`);
  }
  return (
    <svg viewBox="0 0 220 170" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={220} y2={170} />
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(c, 0.2)} />
          <stop offset="0.5" stopColor={c} />
          <stop offset="1" stopColor={shade(c, 0.3)} />
        </linearGradient>
      </defs>
      <path d="M40 60 C70 10 150 10 180 60" fill="none" stroke={shade(c, 0.35)} strokeWidth="5" />
      <path d="M50 46 C80 40 140 40 170 46 C178 70 178 112 170 136 C140 142 80 142 50 136 C42 112 42 70 50 46Z" fill={`url(#${id}b)`} />
      <path d={lace.join(' ')} stroke={metal} strokeWidth="1.6" />
      <ellipse cx="50" cy="91" rx="12" ry="46" fill="#f3e7cf" stroke={metal} strokeWidth="4" />
      <ellipse cx="170" cy="91" rx="12" ry="46" fill="#ead9b8" stroke={metal} strokeWidth="4" />
      <path d="M58 48 C88 44 132 44 162 48 M58 134 C88 138 132 138 162 134" fill="none" stroke={metal} strokeWidth="3" />
      <path d="M12 150 L44 106 M200 154 L176 104" stroke="#8a5a2f" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="106" r="4" fill="#8a5a2f" />
    </svg>
  );
}

/** A brass urli of haldi paste with marigolds and mango leaves; the tint is the brass. */
export function HaldiBowl({ color, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  return (
    <svg viewBox="0 0 240 170" className={className} style={style} aria-hidden="true">
      <defs>
        <Lit id={`${id}b`} base={c} light={0.35} dark={0.3} cx="40%" cy="20%" />
      </defs>
      <ellipse cx="120" cy="162" rx="92" ry="6" fill="#000000" opacity="0.1" />
      {[
        [40, 74, -30],
        [70, 60, -12],
        [168, 58, 14],
        [196, 72, 32],
      ].map(([x, y, a]) => (
        <path key={x} d="M0 0 C10 -10 34 -12 48 0 C34 12 10 10 0 0Z" fill={NATURE.leaf} transform={`translate(${x} ${y}) rotate(${a})`} />
      ))}
      <ellipse cx="120" cy="84" rx="92" ry="22" fill={shade(c, 0.25)} />
      <ellipse cx="120" cy="84" rx="82" ry="17" fill="#f2b705" />
      <ellipse cx="108" cy="80" rx="40" ry="7" fill="#ffd54a" opacity="0.8" />
      <path d="M28 84 C30 130 72 150 120 150 C168 150 210 130 212 84 C190 100 150 106 120 106 C90 106 50 100 28 84Z" fill={`url(#${id}b)`} />
      <path d="M44 118 C70 132 170 132 196 118" fill="none" stroke={tint(c, 0.35)} strokeWidth="3" />
      {[
        [64, 82],
        [90, 72],
        [150, 72],
        [176, 82],
        [120, 90],
      ].map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <circle r="10" fill={i % 2 ? '#f7b733' : '#f0721f'} />
          <circle r="6" fill={i % 2 ? '#ffd166' : '#f7963b'} />
          <circle r="2.4" fill="#c2410c" />
        </g>
      ))}
    </svg>
  );
}

/** Two champagne flutes touching, with bubbles and a sparkle; the tint is the wine. */
export function Champagne({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const c = hex(color);
  const metal = `url(#${id}m)`;
  const glass = (rotate: number, cx: number) => (
    <g transform={`rotate(${rotate} ${cx} 210)`}>
      <path d={`M${cx - 20} 30 L${cx + 20} 30 C${cx + 20} 80 ${cx + 12} 118 ${cx} 124 C${cx - 12} 118 ${cx - 20} 80 ${cx - 20} 30Z`} fill="#ffffff" opacity="0.35" stroke="#d9d4cc" strokeWidth="1.6" />
      <path d={`M${cx - 18} 52 L${cx + 18} 52 C${cx + 18} 86 ${cx + 11} 114 ${cx} 119 C${cx - 11} 114 ${cx - 18} 86 ${cx - 18} 52Z`} fill={c} opacity="0.85" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={cx - 6 + (i % 2) * 10} cy={100 - i * 12} r="2" fill="#ffffff" opacity="0.7" />
      ))}
      <path d={`M${cx} 124 V196 M${cx - 22} 202 Q${cx} 192 ${cx + 22} 202`} fill="none" stroke="#d9d4cc" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 220 230" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={220} y2={230} />
      </defs>
      {glass(6, 70)}
      {glass(-6, 150)}
      <path d={star(110, 22, 12)} fill={metal} />
      {[
        [80, 12, 5],
        [142, 14, 4],
      ].map(([x, y, r]) => (
        <path key={x} d={star(x!, y!, r!)} fill={metal} />
      ))}
    </svg>
  );
}
