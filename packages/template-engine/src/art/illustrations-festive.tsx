import type { ReactNode } from 'react';
import { hex, Lit, Metal, NATURE, shade, tint, useSafeId, type IllustrationProps } from './kit';
import { MangoLeaf, Marigold, r2, rand } from './motifs';

/**
 * Celebration illustrations: rings, a tiered cake, balloons, bunting, a gift,
 * fairy lights, a moon on clouds, a house with a toran and a row of diyas. The
 * palette colours them; strings and bunting are drawn to the layer's size.
 */

const ring = (n: number, render: (i: number, angle: number) => ReactNode) => Array.from({ length: n }, (_, i) => render(i, r2((360 / n) * i)));

/** A four-point sparkle centred on (x, y). */
function Sparkle({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return <path d={`M${x} ${y - s} L${r2(x + s * 0.24)} ${r2(y - s * 0.24)} L${x + s} ${y} L${r2(x + s * 0.24)} ${r2(y + s * 0.24)} L${x} ${y + s} L${r2(x - s * 0.24)} ${r2(y + s * 0.24)} L${x - s} ${y} L${r2(x - s * 0.24)} ${r2(y - s * 0.24)}Z`} fill={fill} />;
}

/** Two interlocked rings in metal, a solitaire on one, sparkles about. The tint is the metal. */
export function Rings({ color, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const metal = `url(#${id}m)`;
  const band = (cx: number, cy: number) => `M${cx - 50} ${cy} A50 50 0 1 0 ${cx + 50} ${cy} A50 50 0 1 0 ${cx - 50} ${cy}Z M${cx - 39} ${cy} A39 39 0 1 1 ${cx + 39} ${cy} A39 39 0 1 1 ${cx - 39} ${cy}Z`;
  return (
    <svg viewBox="0 0 230 170" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={color} foil={foil ?? true} x2={230} y2={170} />
        <clipPath id={`${id}c`}>
          <rect x="96" y="112" width="40" height="40" />
        </clipPath>
      </defs>
      <path d={band(88, 104)} fill={metal} fillRule="evenodd" stroke={shade(color, 0.35)} strokeWidth="0.8" />
      <path d={band(140, 92)} fill={metal} fillRule="evenodd" stroke={shade(color, 0.35)} strokeWidth="0.8" />
      <g clipPath={`url(#${id}c)`}>
        <path d={band(88, 104)} fill={metal} fillRule="evenodd" stroke={shade(color, 0.35)} strokeWidth="0.8" />
      </g>
      <g transform="translate(140 40)">
        <path d="M-8 2 L-5 -6 M8 2 L5 -6" stroke={metal} strokeWidth="3" strokeLinecap="round" />
        <path d="M-17 -8 L-10 -18 H10 L17 -8Z" fill="#e8f4ff" stroke="#9cc4ea" strokeWidth="0.8" />
        <path d="M-17 -8 H17 L0 10Z" fill="#cfe6ff" stroke="#9cc4ea" strokeWidth="0.8" />
        <path d="M-10 -18 L-5 -8 L0 -18 L5 -8 L10 -18 M-17 -8 L0 10 L17 -8 M-5 -8 L0 10 L5 -8" fill="none" stroke="#9cc4ea" strokeWidth="0.6" />
        <path d="M-12 -12 L-8 -16 L-5 -12Z" fill="#ffffff" opacity="0.9" />
      </g>
      <Sparkle x={176} y={22} s={9} fill="#ffffff" />
      <Sparkle x={104} y={30} s={6} fill={tint(color, 0.3)} />
      <Sparkle x={192} y={64} s={5} fill={tint(color, 0.3)} />
    </svg>
  );
}

/** A three-tier cake on a stand: drips of icing, pearls, rosettes and lit candles. Tiers follow the palette. */
export function Cake({ colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const metal = `url(#${id}m)`;
  const tiers: Array<{ x: number; y: number; w: number; h: number; body: string; icing: string }> = [
    { x: 30, y: 192, w: 180, h: 66, body: tint(colors.accent, 0.72), icing: hex(colors.primary) },
    { x: 52, y: 134, w: 136, h: 58, body: tint(colors.primary, 0.84), icing: hex(colors.accent) },
    { x: 76, y: 86, w: 88, h: 48, body: tint(colors.secondary, 0.78), icing: hex(colors.primary) },
  ];
  const drips = (x: number, y: number, w: number, seed: number) => {
    const n = Math.max(5, Math.round(w / 18));
    let d = `M${x} ${y} H${x + w} V${y + 8}`;
    for (let i = n; i > 0; i--) {
      const x1 = x + (w * i) / n;
      const x0 = x + (w * (i - 1)) / n;
      const len = r2(8 + rand(i, seed) * 14);
      const mid = r2((x0 + x1) / 2);
      d += ` C${r2(x1 - 2)} ${y + 8} ${r2(mid + 4)} ${y + 8} ${r2(mid + 3)} ${r2(y + 8 + len - 4)} A3 3 0 0 1 ${r2(mid - 3)} ${r2(y + 8 + len - 4)} C${r2(mid - 4)} ${y + 8} ${r2(x0 + 2)} ${y + 8} ${r2(x0)} ${y + 8}`;
    }
    return `${d}Z`;
  };
  return (
    <svg viewBox="0 0 240 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={240} y2={300} />
        <radialGradient id={`${id}f`} cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor={NATURE.flameCore} />
          <stop offset="0.45" stopColor="#ffd54f" />
          <stop offset="1" stopColor="#ff6d00" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M100 262 L92 292 H148 L140 262Z" fill={metal} />
      <ellipse cx="120" cy="293" rx="34" ry="5" fill={metal} />
      <ellipse cx="120" cy="262" rx="104" ry="12" fill={metal} />
      {tiers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="6" fill={t.body} />
          <rect x={t.x} y={t.y} width={t.w * 0.18} height={t.h} rx="6" fill="#ffffff" opacity="0.25" />
          <path d={drips(t.x, t.y, t.w, i + 2)} fill={t.icing} />
          {Array.from({ length: Math.round(t.w / 10) }, (_, k) => (
            <circle key={k} cx={t.x + 5 + k * 10} cy={t.y + t.h - 4} r="3" fill={NATURE.pearl} stroke={shade(NATURE.pearl, 0.12)} strokeWidth="0.5" />
          ))}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f} transform={`translate(${t.x + t.w * f} ${t.y + t.h * 0.58})`}>
              <circle r="5.5" fill={tint(t.icing, 0.25)} />
              <path d="M-3 0 A3 3 0 1 1 3 0 A1.6 1.6 0 1 1 0 -1" fill="none" stroke={shade(t.icing, 0.2)} strokeWidth="1" />
            </g>
          ))}
        </g>
      ))}
      {[104, 120, 136].map((x, i) => (
        <g key={x}>
          <rect x={x - 3} y="58" width="6" height="28" rx="2" fill="#ffffff" />
          {[0, 1, 2].map((s) => (
            <path key={s} d={`M${x - 3} ${64 + s * 8} L${x + 3} ${60 + s * 8}`} stroke={hex(colors.primary)} strokeWidth="2" />
          ))}
          <circle cx={x} cy="48" r="10" fill={`url(#${id}g)`} className="bulava-glow" />
          <g className="bulava-flicker" style={{ transformOrigin: `${x}px 56px`, animationDelay: `${i * 0.3}s` }}>
            <path d={`M${x} 40 C${x + 5} 47 ${x + 5} 52 ${x} 56 C${x - 5} 52 ${x - 5} 47 ${x} 40Z`} fill={`url(#${id}f)`} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** A bunch of glossy balloons in the palette, strings gathered in a bow. */
export function BalloonBunch({ colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const metal = `url(#${id}m)`;
  const balloons: Array<[number, number, number, string]> = [
    [84, 96, 46, hex(colors.primary)],
    [168, 82, 50, hex(colors.accent)],
    [126, 148, 46, hex(colors.secondary)],
    [204, 150, 40, tint(colors.primary, 0.4)],
    [56, 170, 38, tint(colors.accent, 0.35)],
  ];
  const knot = (x: number, y: number, r: number) => ({ x, y: y + r + 4 });
  const gather = { x: 132, y: 292 };
  return (
    <svg viewBox="0 0 270 350" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={270} y2={350} />
        {balloons.map(([, , , c], i) => (
          <radialGradient key={i} id={`${id}b${i}`} cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor={tint(c, 0.5)} />
            <stop offset="0.35" stopColor={c} />
            <stop offset="1" stopColor={shade(c, 0.28)} />
          </radialGradient>
        ))}
      </defs>
      {balloons.map(([x, y, r], i) => {
        const k = knot(x, y, r);
        return <path key={i} d={`M${k.x} ${k.y} Q${r2((k.x + gather.x) / 2 + (i % 2 ? 12 : -12))} ${r2((k.y + gather.y) / 2)} ${gather.x} ${gather.y}`} fill="none" stroke="#9e9e9e" strokeWidth="1.1" />;
      })}
      {balloons.map(([x, y, r, c], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r2(r * 0.86)} ry={r} fill={`url(#${id}b${i})`} />
          <path d={`M${x - 5} ${y + r - 1} L${x + 5} ${y + r - 1} L${x} ${y + r + 6}Z`} fill={shade(c, 0.15)} />
          <ellipse cx={r2(x - r * 0.3)} cy={r2(y - r * 0.42)} rx={r2(r * 0.14)} ry={r2(r * 0.26)} fill="#ffffff" opacity="0.5" transform={`rotate(-24 ${r2(x - r * 0.3)} ${r2(y - r * 0.42)})`} />
        </g>
      ))}
      <g transform={`translate(${gather.x} ${gather.y})`}>
        <path d="M0 0 C-14 -14 -30 -8 -26 2 C-22 10 -10 6 0 0Z M0 0 C14 -14 30 -8 26 2 C22 10 10 6 0 0Z" fill={metal} />
        <path d="M-2 2 L-14 32 L-6 27 L-2 36Z M2 2 L14 32 L6 27 L2 36Z" fill={metal} />
        <circle r="5" fill={metal} />
      </g>
      <path d="M132 300 C122 312 142 318 132 330 C124 338 138 342 132 348" fill="none" stroke="#9e9e9e" strokeWidth="1.1" />
    </svg>
  );
}

/** Pennant bunting drawn across the layer: a sagging string of flags in the palette, with dots. */
export function Bunting({ colors, w, h, className, style }: IllustrationProps) {
  const top = h * 0.08;
  const sag = h * 0.2;
  const at = (t: number) => ({ x: w * t, y: top + 4 * sag * t * (1 - t) });
  const n = Math.max(3, Math.round(w / (h * 0.85)));
  const fills = [hex(colors.primary), hex(colors.secondary), hex(colors.accent), tint(colors.primary, 0.45)];
  const flagLen = h * 0.62;
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <path d={`M0 ${r2(top)} Q${r2(w / 2)} ${r2(top + 2 * sag)} ${r2(w)} ${r2(top)}`} fill="none" stroke="#8d6e3f" strokeWidth={r2(Math.max(1, h * 0.018))} />
      {Array.from({ length: n }, (_, i) => {
        const a = at((i + 0.1) / n);
        const b = at((i + 0.9) / n);
        const tip = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + flagLen };
        const fill = fills[i % fills.length]!;
        const d = `M${r2(a.x)} ${r2(a.y)} L${r2(b.x)} ${r2(b.y)} L${r2(tip.x)} ${r2(tip.y)}Z`;
        const cx = r2((a.x + b.x + tip.x) / 3);
        const cy = r2((a.y + b.y + tip.y) / 3);
        return (
          <g key={i}>
            <path d={d} fill="#000000" opacity="0.12" transform={`translate(${r2(h * 0.02)} ${r2(h * 0.03)})`} />
            <path d={d} fill={fill} />
            <path d={`M${r2(a.x)} ${r2(a.y)} L${r2(b.x)} ${r2(b.y)} L${r2((a.x + b.x) / 2)} ${r2((a.y + b.y) / 2 + flagLen * 0.22)}Z`} fill="#ffffff" opacity="0.18" />
            <circle cx={cx} cy={cy} r={r2(h * 0.045)} fill="#ffffff" opacity="0.75" />
          </g>
        );
      })}
    </svg>
  );
}

/** A wrapped gift: polka-dot paper in the primary, a metal ribbon and bow. */
export function GiftBox({ colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const p = hex(colors.primary);
  const metal = `url(#${id}m)`;
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={200} y2={200} />
        <Lit id={`${id}p`} base={p} light={0.2} dark={0.2} />
        <clipPath id={`${id}c`}>
          <rect x="36" y="98" width="128" height="86" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="186" rx="76" ry="7" fill="#000000" opacity="0.12" />
      <rect x="36" y="98" width="128" height="86" rx="4" fill={`url(#${id}p)`} />
      <g clipPath={`url(#${id}c)`}>
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={40 + (i % 6) * 24 + (Math.floor(i / 6) % 2) * 12} cy={104 + Math.floor(i / 6) * 18} r="4" fill={tint(p, 0.5)} />
        ))}
      </g>
      <rect x="28" y="80" width="144" height="24" rx="4" fill={shade(p, 0.1)} />
      <rect x="90" y="80" width="20" height="104" fill={metal} />
      <rect x="36" y="128" width="128" height="16" fill={metal} />
      <path d="M100 80 C82 52 52 52 56 70 C60 84 84 84 100 80Z M100 80 C118 52 148 52 144 70 C140 84 116 84 100 80Z" fill={metal} />
      <path d="M98 84 L84 112 L92 108 L96 116Z M102 84 L116 112 L108 108 L104 116Z" fill={metal} />
      <circle cx="100" cy="80" r="8" fill={metal} />
    </svg>
  );
}

/** Fairy lights strung across the layer: a sagging wire with glowing bulbs in warm and palette colours. */
export function FairyLights({ colors, w, h, className, style }: IllustrationProps) {
  const id = useSafeId();
  const top = h * 0.12;
  const sag = h * 0.32;
  const at = (t: number) => ({ x: w * t, y: top + 4 * sag * t * (1 - t) });
  const n = Math.max(5, Math.round(w / (h * 0.7)));
  const bulbs = ['#ffd166', '#ffb74d', tint(colors.accent, 0.3), '#fff1b8'];
  const r = Math.min(h * 0.07, w / n / 4);
  return (
    <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} className={className} style={style} aria-hidden="true">
      <defs>
        {bulbs.map((c, i) => (
          <radialGradient key={i} id={`${id}g${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={c} stopOpacity="0.85" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <path d={`M0 ${r2(top)} Q${r2(w / 2)} ${r2(top + 2 * sag)} ${r2(w)} ${r2(top)}`} fill="none" stroke="#5a4632" strokeWidth={r2(Math.max(0.8, h * 0.012))} />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        const { x, y } = at(t);
        const slope = r2((Math.atan2(4 * sag * (1 - 2 * t), w) * 180) / Math.PI);
        const k = i % bulbs.length;
        return (
          <g key={i} transform={`translate(${r2(x)} ${r2(y)}) rotate(${slope})`}>
            <circle cx="0" cy={r2(r * 2.2)} r={r2(r * 3.4)} fill={`url(#${id}g${k})`} className="bulava-twinkle" style={{ animationDelay: `${r2(rand(i, 4) * 2.5)}s` }} />
            <rect x={r2(-r * 0.45)} y="0" width={r2(r * 0.9)} height={r2(r * 0.8)} rx={r2(r * 0.15)} fill="#3d3326" />
            <ellipse cx="0" cy={r2(r * 2)} rx={r2(r * 0.85)} ry={r2(r * 1.3)} fill={bulbs[k]} />
            <ellipse cx={r2(-r * 0.3)} cy={r2(r * 1.6)} rx={r2(r * 0.22)} ry={r2(r * 0.45)} fill="#ffffff" opacity="0.7" />
          </g>
        );
      })}
    </svg>
  );
}

/** A crescent moon asleep on clouds, stars hanging on threads (nurseries, baby showers). The tint is the moon. */
export function MoonCloud({ color, colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  const moon = hex(color);
  const cloud = '#ffffff';
  const stars: Array<[number, number, number]> = [
    [56, 70, 13],
    [244, 54, 11],
    [96, 34, 8],
  ];
  const star = (x: number, y: number, s: number) => {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const rad = k % 2 === 0 ? s : s * 0.45;
      const a = ((-90 + k * 36) * Math.PI) / 180;
      return `${r2(x + rad * Math.cos(a))} ${r2(y + rad * Math.sin(a))}`;
    });
    return `M${pts.join(' L')}Z`;
  };
  const puffs: Array<[number, number, number]> = [
    [150, 196, 36],
    [110, 206, 29],
    [192, 206, 28],
    [78, 216, 22],
    [222, 216, 22],
  ];
  return (
    <svg viewBox="0 0 300 260" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}h`} cx="50%" cy="45%" r="50%">
          <stop offset="0.55" stopColor={tint(moon, 0.4)} stopOpacity="0.5" />
          <stop offset="1" stopColor={tint(moon, 0.4)} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(moon, 0.55)} />
          <stop offset="1" stopColor={moon} />
        </linearGradient>
      </defs>
      {stars.map(([x, y, s]) => (
        <g key={x}>
          <path d={`M${x} 0 V${y - s}`} stroke={shade(moon, 0.2)} strokeWidth="1" />
          <path d={star(x, y, s)} fill={`url(#${id}m)`} stroke={shade(moon, 0.25)} strokeWidth="0.8" strokeLinejoin="round" />
        </g>
      ))}
      <circle cx="150" cy="104" r="96" fill={`url(#${id}h)`} />
      <path d="M176 26 A76 76 0 1 0 220 164 A60 60 0 1 1 176 26Z" fill={`url(#${id}m)`} stroke={shade(moon, 0.2)} strokeWidth="1" />
      <path d="M116 96 Q124 103 132 96" fill="none" stroke={shade(moon, 0.5)} strokeWidth="2" strokeLinecap="round" />
      <circle cx="118" cy="112" r="7" fill={tint(colors.accent, 0.4)} opacity="0.7" />
      <g transform="translate(4 6)" opacity="0.18" fill={shade(colors.primary, 0.3)}>
        {puffs.map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} />
        ))}
        <rect x="70" y="208" width="160" height="30" rx="15" />
      </g>
      <g fill={cloud}>
        {puffs.map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} />
        ))}
        <rect x="70" y="208" width="160" height="30" rx="15" />
      </g>
      <Sparkle x={262} y={120} s={7} fill={tint(moon, 0.3)} />
      <Sparkle x={36} y={140} s={6} fill={tint(moon, 0.3)} />
    </svg>
  );
}

/** A home with a marigold toran over the door, lit windows, tulsi pots and diyas on the steps (griha pravesh). */
export function House({ colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const wall = tint(colors.secondary, 0.78);
  const roof = hex(colors.primary);
  const wood = shade(colors.secondary, 0.45);
  const metal = `url(#${id}m)`;
  const glass = `url(#${id}w)`;
  const toranSpan = 54;
  return (
    <svg viewBox="0 0 300 300" className={className} style={style} aria-hidden="true">
      <defs>
        <Metal id={`${id}m`} base={colors.secondary} foil={foil ?? true} x2={300} y2={300} />
        <Lit id={`${id}r`} base={roof} light={0.18} dark={0.22} cx="50%" cy="20%" />
        <radialGradient id={`${id}w`} cx="50%" cy="60%" r="70%">
          <stop offset="0" stopColor="#fff4c9" />
          <stop offset="1" stopColor="#f5b942" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="282" rx="128" ry="10" fill="#000000" opacity="0.1" />
      <rect x="56" y="142" width="188" height="122" fill={wall} />
      <rect x="56" y="142" width="188" height="10" fill={shade(wall, 0.12)} />
      <path d="M32 148 L150 66 L268 148Z" fill={`url(#${id}r)`} />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${50 + k * 8} ${136 - k * 6} L${250 - k * 8} ${136 - k * 6}`} stroke={shade(roof, 0.25)} strokeWidth="1.2" opacity="0.6" />
      ))}
      <path d="M28 150 L150 64 L272 150" fill="none" stroke={shade(roof, 0.3)} strokeWidth="6" strokeLinejoin="round" />
      <circle cx="150" cy="112" r="13" fill={glass} stroke={shade(roof, 0.3)} strokeWidth="3" className="bulava-glow" />
      <g transform="translate(150 60)">
        <path d="M-7 4 C-9 -4 -4 -8 0 -8 C4 -8 9 -4 7 4Z" fill={metal} />
        <path d="M0 -8 V-16" stroke={metal} strokeWidth="2" />
      </g>
      {[74, 188].map((x) => (
        <g key={x}>
          <rect x={x} y="176" width="38" height="40" rx="3" fill={glass} stroke={roof} strokeWidth="4" className="bulava-glow" />
          <path d={`M${x + 19} 176 V216 M${x} 196 H${x + 38}`} stroke={roof} strokeWidth="2" />
          <rect x={x - 4} y="214" width="46" height="5" rx="2" fill={shade(wall, 0.2)} />
        </g>
      ))}
      <path d="M126 264 V210 A24 24 0 0 1 174 210 V264Z" fill={wood} />
      <path d="M150 190 V264" stroke={shade(wood, 0.3)} strokeWidth="1.5" />
      {[136, 164].map((x) => (
        <rect key={x} x={x - 7} y="222" width="14" height="30" rx="2" fill="none" stroke={tint(wood, 0.25)} strokeWidth="1.2" />
      ))}
      <circle cx="144" cy="236" r="2.2" fill={metal} />
      <circle cx="156" cy="236" r="2.2" fill={metal} />
      <path d="M118 184 H182" stroke="#8d6e3f" strokeWidth="1.5" />
      {Array.from({ length: 4 }, (_, s) => (
        <MangoLeaf key={s} x={122 + s * 18.7} y={186} size={0.5} angle={s % 2 ? 10 : -10} />
      ))}
      {Array.from({ length: 9 }, (_, k) => {
        const t = k / 8;
        return <Marigold key={k} x={r2(123 + t * toranSpan)} y={r2(186 + 26 * t * (1 - t))} r={4.6} tone={k % 3} />;
      })}
      <rect x="112" y="264" width="76" height="8" fill={shade(wall, 0.25)} />
      <rect x="102" y="272" width="96" height="8" fill={shade(wall, 0.35)} />
      {[96, 204].map((x) => (
        <g key={x}>
          <path d={`M${x - 11} 248 H${x + 11} L${x + 8} 266 H${x - 8}Z`} fill={NATURE.clay} />
          {ring(7, (i, a) => (
            <ellipse key={i} cx={x} cy={238} rx="3" ry="8" fill={i % 2 ? NATURE.leaf : NATURE.leafLight} transform={`rotate(${r2(a / 2 - 80)} ${x} 246)`} />
          ))}
        </g>
      ))}
      {[118, 182].map((x) => (
        <g key={x} transform={`translate(${x} 270)`}>
          <path d="M-7 0 C-6 4 -3 6 0 6 C3 6 6 4 7 0Z" fill={NATURE.clay} />
          <path d="M0 -9 C2.5 -6 2.5 -3 0 -1 C-2.5 -3 -2.5 -6 0 -9Z" fill={NATURE.flame} className="bulava-flicker" />
        </g>
      ))}
    </svg>
  );
}

/** One clay diya (local origin at the middle of its rim). */
function DiyaShape({ id, band, dot }: { id: string; band: string; dot: string }) {
  return (
    <g>
      <circle cx="0" cy="-20" r="26" fill={`url(#${id}g)`} className="bulava-glow" />
      <g className="bulava-flicker" style={{ transformOrigin: '0px -6px' }}>
        <path d="M0 -36 C7 -26 8 -16 0 -6 C-8 -16 -7 -26 0 -36Z" fill={`url(#${id}f)`} />
      </g>
      <path d="M-32 0 C-28 15 -15 22 0 22 C15 22 28 15 32 0 C22 4 11 5 0 5 C-11 5 -22 4 -32 0Z" fill={`url(#${id}c)`} />
      <path d="M-32 0 C-22 4 -11 5 0 5 C11 5 22 4 32 0 C22 -3 11 -4 0 -4 C-11 -4 -22 -3 -32 0Z" fill="#e3a36a" />
      <path d="M-24 10 Q0 18 24 10" fill="none" stroke={band} strokeWidth="3" />
      {[-14, -5, 5, 14].map((x) => (
        <circle key={x} cx={x} cy={r2(15 - Math.abs(x) * 0.08)} r="1.6" fill={dot} />
      ))}
    </g>
  );
}

/** Five lit diyas in a row (Diwali, pujas, griha pravesh), painted with the palette. */
export function DiyaRow({ colors, className, style }: IllustrationProps) {
  const id = useSafeId();
  return (
    <svg viewBox="0 0 400 110" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}f`} cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor={NATURE.flameCore} />
          <stop offset="0.45" stopColor="#ffd54f" />
          <stop offset="1" stopColor="#ff6d00" />
        </radialGradient>
        <linearGradient id={`${id}c`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c7773f" />
          <stop offset="1" stopColor={NATURE.clayDark} />
        </linearGradient>
      </defs>
      {[0.85, 1, 1.12, 1, 0.85].map((s, i) => (
        <g key={i} transform={`translate(${40 + i * 80} ${84 - (s - 0.85) * 20}) scale(${s})`}>
          <DiyaShape id={id} band={hex(colors.primary)} dot={hex(colors.secondary)} />
        </g>
      ))}
    </svg>
  );
}
