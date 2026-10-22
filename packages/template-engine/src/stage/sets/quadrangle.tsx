import type { ReactNode } from 'react';
import { Metal, tint } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, illus, LampPost, Sky, Tree, Wall } from '../kit';
import { billboard, floor, hang, sky, wall } from '../planes';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';
import { perspectiveOf } from '../units';

/**
 * T17 · Alma Mater (`alma-mater`, final.md §5.3): the `quadrangle` stage.
 * A university quadrangle at dusk, on convocation evening. The guest stands at
 * the head of the lawn under three strings of bunting and fairy lights crossing
 * the quad (the near layer); a gravel walk runs between campus lamps and two
 * iron-and-teak benches, past a pair of rain trees (the middle layer), to an
 * Indo-Saracenic clock tower whose lit face glows at the end of the walk, its
 * low wings and colonnades lit window by window (the focal point); the dusk sky
 * deepens overhead with the first stars at its sides.
 *
 * Set-local pieces (§6.4): ClockTower (with its low wings, which close the quad
 * between the colonnades) and Bench.
 */

const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;

function Svg({ vw, vh, children }: { vw: number; vh: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** Ids from the seed and everything the gradients depend on (integer hashing: server and browser agree). */
function idsOf(p: DrawProps, tag: string): (part: string) => string {
  const c = p.colors;
  const key = `${tag}|${p.seed}|${p.w}x${p.h}|${c.primary}${c.secondary}${c.accent}${c.background}${c.surface}${c.text}|${p.light.color}${p.light.rim}|${p.eyeLine ?? ''}|${p.detail}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const base = `qd${tag}${(h >>> 0).toString(36)}`;
  return (part) => `${base}${part}`;
}
const url = (id: string) => `url(#${id})`;

/** A pointed (Indo-Saracenic) arch from x0 to x1, springing at ys, apex at ya, standing on yb. */
const pointed = (x0: number, x1: number, ys: number, ya: number, yb: number) => {
  const xc = (x0 + x1) / 2;
  const cy = r2(ya + (ys - ya) * 0.3);
  return `M${x0} ${yb}V${ys}Q${x0} ${cy} ${xc} ${ya}Q${x1} ${cy} ${x1} ${ys}V${yb}Z`;
};

/** The clock's twelve hour marks as unit vectors (12 o'clock first): constants, no trigonometry. */
const DIAL: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0.5, -0.866], [0.866, -0.5], [1, 0], [0.866, 0.5], [0.5, 0.866],
  [0, 1], [-0.5, 0.866], [-0.866, 0.5], [-1, 0], [-0.866, -0.5], [-0.5, -0.866],
];
/** Hands at ten to seven: dusk on convocation evening. */
const HOUR: readonly [number, number] = [-0.44, 0.9];
const MINUTE: readonly [number, number] = [-0.866, -0.5];

// ─────────────────────────── ClockTower (focal) ───────────────────────────

const TW = 760;
const TH = 620;

/**
 * A squat Indo-Saracenic clock tower (the university's convocation hall): a
 * gateway base with a cusped arch glowing within, a shaft with paired lit
 * lancets over a little jharokha, a deep chhajja, the clock stage with its lit
 * face in a gilt frame and corner chhatris, and a quiet onion dome. Low wings
 * either side (a lit arcade below, lit windows above, a parapet with end
 * kiosks) close the quad between the colonnades. Backlit by the dusk sky: the
 * front reads in shade with a thin rim, warm light spilling from every opening.
 */
function ClockTower(p: DrawProps) {
  const c = p.colors;
  const id = idsOf(p, 'ct');
  const full = p.detail === 'full';
  const warm = p.light.color;
  const hot = p.light.rim;
  const buff = mix(c.accent, c.secondary, 0.28);
  const stone = mix(buff, c.primary, 0.4);
  const stoneLo = mix(buff, c.primary, 0.62);
  const stoneHi = mix(buff, c.surface, 0.15);
  const course = mix(stone, c.secondary, 0.4);
  const recess = mix(c.primary, '#000000', 0.45);
  const quiet = mix(c.primary, c.accent, 0.2);
  const quietLo = mix(c.primary, c.accent, 0.1);
  const ink = mix(c.primary, '#000000', 0.35);

  const wing = (x0: number, x1: number, outerLeft: boolean, key: string) => {
    const bays = 5;
    const bw = (x1 - x0) / bays;
    const arches: string[] = [];
    const windows: string[] = [];
    const dark: string[] = [];
    for (let i = 0; i < bays; i++) {
      const a = x0 + i * bw;
      arches.push(pointed(r2(a + bw * 0.2), r2(a + bw * 0.8), 566, 538, 606));
      const w = pointed(r2(a + bw * 0.32), r2(a + bw * 0.68), 482, 466, 516);
      (rand(i + (outerLeft ? 0 : 7), p.seed) > 0.28 ? windows : dark).push(w);
    }
    const kx = outerLeft ? x0 : x1 - 40;
    const merlons: string[] = [];
    for (let x = x0 + 6; x < x1 - 8; x += 14) merlons.push(`M${r2(x)} 432h8v-7q-4 -5 -8 0Z`);
    return (
      <g key={key}>
        <rect x={x0} y={440} width={x1 - x0} height={180} fill={url(id('st'))} />
        <rect x={x0} y={520} width={x1 - x0} height={5} fill={stoneHi} opacity={0.5} />
        <path d={arches.join('')} fill={url(id('ar'))} />
        <path d={windows.join('')} fill={url(id('wn'))} />
        <path d={dark.join('')} fill={recess} opacity={0.85} />
        <rect x={x0} y={432} width={x1 - x0} height={10} fill={stoneLo} />
        <rect x={x0} y={438} width={x1 - x0} height={3} fill={url(id('au'))} />
        {full && <path d={merlons.join('')} fill={stoneLo} />}
        <rect x={x0} y={606} width={x1 - x0} height={14} fill={stoneLo} />
        {/* The end kiosk: a little chhatri on a pier. */}
        <rect x={kx + 6} y={392} width={28} height={228} fill={url(id('st'))} />
        <path d={`M${kx + 2} 396h36l-4 -8h-28Z`} fill={stoneLo} />
        <path d={`M${kx + 6} 388C${kx + 4} 372 ${kx + 14} 364 ${kx + 20} 354C${kx + 26} 364 ${kx + 36} 372 ${kx + 34} 388Z`} fill={stoneLo} />
        <path d={`M${kx + 20} 354v-10`} stroke={stoneLo} strokeWidth={2} />
        <path d={`M${outerLeft ? kx + 6 : kx + 34} 392V620`} stroke={hot} strokeWidth={1.5} opacity={0.55} />
      </g>
    );
  };

  // Strings of festival lights along the cornices (lit for the evening).
  const bulbs: Array<[number, number]> = [];
  if (full) {
    for (let x = 8; x < 236; x += 15) bulbs.push([x, 446 + ((x / 15) % 2) * 2]);
    for (let x = 532; x < 756; x += 15) bulbs.push([x, 446 + ((x / 15) % 2) * 2]);
    for (let x = 242; x <= 520; x += 14) bulbs.push([x, 258]);
  }

  const ticks = DIAL.map(([dx, dy], i) => {
    const r0 = i % 3 === 0 ? 33 : 38;
    return `M${r2(380 + dx * r0)} ${r2(165 + dy * r0)}L${r2(380 + dx * 43)} ${r2(165 + dy * 43)}`;
  }).join('');

  return (
    <Svg vw={TW} vh={TH}>
      <defs>
        <linearGradient id={id('st')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(stone, stoneHi, 0.25)} />
          <stop offset="0.55" stopColor={stone} />
          <stop offset="1" stopColor={stoneLo} />
        </linearGradient>
        <linearGradient id={id('ar')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={recess} />
          <stop offset="0.5" stopColor={mix(recess, warm, 0.45)} />
          <stop offset="1" stopColor={warm} />
        </linearGradient>
        <linearGradient id={id('wn')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={warm} />
          <stop offset="1" stopColor={hot} />
        </linearGradient>
        <radialGradient id={id('sp')}>
          <stop offset="0" stopColor={warm} stopOpacity={0.42} />
          <stop offset="1" stopColor={warm} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('fc')} cx="50%" cy="46%" r="55%">
          <stop offset="0" stopColor={tint(hot, 0.65)} />
          <stop offset="0.65" stopColor={hot} />
          <stop offset="1" stopColor={warm} />
        </radialGradient>
        <radialGradient id={id('bl')}>
          <stop offset="0" stopColor={tint(hot, 0.6)} />
          <stop offset="0.35" stopColor={warm} stopOpacity={0.9} />
          <stop offset="1" stopColor={warm} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('up')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={warm} stopOpacity={0.4} />
          <stop offset="0.45" stopColor={warm} stopOpacity={0.08} />
          <stop offset="1" stopColor={warm} stopOpacity={0} />
        </linearGradient>
        <radialGradient id={id('hz')}>
          <stop offset="0" stopColor={warm} stopOpacity={0.22} />
          <stop offset="0.6" stopColor={warm} stopOpacity={0.07} />
          <stop offset="1" stopColor={warm} stopOpacity={0} />
        </radialGradient>
        <Metal id={id('au')} base={c.secondary} foil x2={TW} y2={60} />
      </defs>
      {/* The quad's own glow on the dusk air behind the tower. */}
      <ellipse cx={380} cy={300} rx={378} ry={300} fill={url(id('hz'))} />

      {wing(0, 236, true, 'wl')}
      {wing(524, TW, false, 'wr')}

      {/* The base: a gateway with a cusped arch glowing within. */}
      <rect x={236} y={440} width={288} height={180} fill={url(id('st'))} />
      <rect x={232} y={436} width={296} height={10} fill={stoneLo} />
      <rect x={236} y={443} width={288} height={3} fill={url(id('au'))} />
      <ellipse cx={380} cy={570} rx={120} ry={70} fill={url(id('sp'))} />
      <path d={pointed(330, 430, 540, 476, 620)} fill={stoneLo} />
      <path d={pointed(338, 422, 544, 486, 620)} fill={url(id('ar'))} />
      <path d={pointed(330, 430, 540, 476, 620)} fill="none" stroke={url(id('au'))} strokeWidth={2.5} />
      <path d={`${pointed(258, 300, 562, 530, 606)}${pointed(460, 502, 562, 530, 606)}`} fill={recess} opacity={0.75} />
      <path d={`${pointed(266, 292, 566, 544, 600)}${pointed(468, 494, 566, 544, 600)}`} fill={url(id('wn'))} opacity={0.75} />
      <rect x={236} y={606} width={288} height={14} fill={stoneLo} />

      {/* The shaft: corner colonnettes, paired lancets over a little jharokha. */}
      <rect x={262} y={252} width={236} height={188} fill={url(id('st'))} />
      <rect x={262} y={252} width={16} height={188} fill={mix(stone, stoneHi, 0.35)} />
      <rect x={482} y={252} width={16} height={188} fill={mix(stone, stoneHi, 0.35)} />
      <ellipse cx={380} cy={350} rx={110} ry={90} fill={url(id('sp'))} />
      <path d={`${pointed(330, 368, 312, 284, 402)}${pointed(392, 430, 312, 284, 402)}`} fill={stoneLo} />
      <path d={`${pointed(335, 363, 314, 292, 400)}${pointed(397, 425, 314, 292, 400)}`} fill={url(id('wn'))} />
      <path d="M349 300V400M411 300V400M335 344H363M397 344H425" stroke={ink} strokeWidth={2} opacity={0.6} />
      <path d="M322 402h116v8h-116Z" fill={stoneLo} />
      <path d="M326 410h108l-6 16h-96Z" fill={stone} />
      {full && <path d="M336 410v14M352 410v16M368 410v16M384 410v16M400 410v16M416 410v16M428 410v12" stroke={stoneLo} strokeWidth={3} />}
      <path d="M332 426l6 10h-4ZM428 426l-6 10h4Z" fill={stoneLo} />

      {/* Buff-and-gold courses on the shaft and the base, quoins at the corners, the convocation floodlight from below. */}
      {full && <path d="M278 282H330M430 282H482M278 312H326M434 312H482M278 452H330M430 452H482M278 482H326M434 482H482M236 512H310M450 512H524M236 548H254M506 548H524M236 584H254M506 584H524" stroke={course} strokeWidth={3} opacity={0.55} />}
      {full && <path d="M262 276h10v12h-10ZM488 276h10v12h-10ZM262 336h10v12h-10ZM488 336h10v12h-10ZM262 396h10v12h-10ZM488 396h10v12h-10ZM236 470h12v14h-12ZM512 470h12v14h-12ZM236 530h12v14h-12ZM512 530h12v14h-12Z" fill={stoneHi} opacity={0.45} />}
      <rect x={236} y={252} width={288} height={368} fill={url(id('up'))} />

      {/* The chhajja: a deep eave casting its shadow. */}
      <rect x={262} y={252} width={236} height={10} fill={recess} opacity={0.45} />
      <path d="M232 238H528L514 254H246Z" fill={stoneLo} />
      <path d="M232 238H528" stroke={stoneHi} strokeWidth={2} opacity={0.6} />

      {/* The clock stage with its corner chhatris. */}
      <rect x={262} y={98} width={236} height={142} fill={url(id('st'))} />
      <ellipse cx={380} cy={165} rx={112} ry={84} fill={url(id('sp'))} />
      <rect x={318} y={105} width={124} height={120} fill={stoneLo} />
      <rect x={322} y={109} width={116} height={112} fill="none" stroke={url(id('au'))} strokeWidth={2} />
      <circle cx={380} cy={165} r={52} fill={url(id('au'))} />
      <circle cx={380} cy={165} r={46} fill={url(id('fc'))} />
      <circle cx={380} cy={165} r={46} fill="none" stroke={ink} strokeWidth={1} opacity={0.4} />
      <path d={ticks} stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      <path d={`M380 165L${r2(380 + HOUR[0] * 22)} ${r2(165 + HOUR[1] * 22)}M380 165L${r2(380 + MINUTE[0] * 34)} ${r2(165 + MINUTE[1] * 34)}`} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      <circle cx={380} cy={165} r={3.5} fill={url(id('au'))} />
      {[250, 486].map((x) => (
        <g key={x}>
          <rect x={x} y={86} width={24} height={154} fill={quiet} />
          <path d={`M${x - 4} 90h32l-3 -6h-26Z`} fill={quietLo} />
          <path d={`M${x} 84C${x - 2} 70 ${x + 8} 62 ${x + 12} 52C${x + 16} 62 ${x + 26} 70 ${x + 24} 84Z`} fill={quietLo} />
          <path d={`M${x + 12} 52v-8`} stroke={quietLo} strokeWidth={2} />
        </g>
      ))}

      {/* The quiet crown: a cornice, a drum and an onion dome with its finial. */}
      <path d="M254 100H506L498 90H262Z" fill={quietLo} />
      <rect x={314} y={80} width={132} height={12} fill={quiet} />
      <path d="M312 82C286 62 298 40 380 14C462 40 474 62 448 82Z" fill={quiet} />
      {full && <path d="M380 16C368 40 362 62 364 82M380 16C392 40 398 62 396 82M380 16C350 40 334 62 340 82M380 16C410 40 426 62 420 82" fill="none" stroke={quietLo} strokeWidth={2} />}
      <path d="M380 14V-2" stroke={quiet} strokeWidth={3} />
      <circle cx={380} cy={2} r={3} fill={quiet} />
      <path d="M312 82C286 62 298 40 380 14C462 40 474 62 448 82" fill="none" stroke={hot} strokeWidth={1.5} opacity={0.35} />
      <path d="M262 98V438M498 98V438" stroke={hot} strokeWidth={1.5} opacity={0.5} />

      {bulbs.length > 0 && (
        <g fill={url(id('bl'))}>
          {bulbs.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} />
          ))}
        </g>
      )}
    </Svg>
  );
}

// ─────────────────────────── Bench ───────────────────────────

/** A campus bench: cast-iron scrolled ends, teak slats catching the dusk rim, a small brass plaque on the back. */
function Bench(p: DrawProps) {
  const c = p.colors;
  const id = idsOf(p, 'bn');
  const iron = mix(c.text, c.primary, 0.3);
  const wood = mix(c.secondary, c.text, 0.5);
  const woodHi = mix(c.secondary, c.accent, 0.25);
  const woodLo = mix(wood, '#000000', 0.3);
  const end = (
    <>
      <path d="M24 6C20 26 30 44 27 62C24 80 17 94 14 107" fill="none" stroke={iron} strokeWidth={5} strokeLinecap="round" />
      <path d="M30 64C36 82 40 96 42 107" fill="none" stroke={iron} strokeWidth={4} strokeLinecap="round" />
      <path d="M24 42C40 36 48 46 42 54C38 58 32 54 35 50" fill="none" stroke={iron} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M24 6C20 26 30 44 27 62" fill="none" stroke={p.light.rim} strokeWidth={1} opacity={0.5} />
    </>
  );
  return (
    <Svg vw={200} vh={110}>
      <defs>
        <linearGradient id={id('w')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={woodHi} />
          <stop offset="1" stopColor={woodLo} />
        </linearGradient>
        <Metal id={id('au')} base={c.secondary} foil x2={30} y2={8} />
      </defs>
      <ellipse cx={100} cy={106} rx={96} ry={4} fill="#000000" opacity={0.3} />
      {[10, 22, 34].map((y) => (
        <g key={y}>
          <rect x={14} y={y} width={172} height={8} rx={1.5} fill={url(id('w'))} />
          <path d={`M15 ${y + 0.6}H185`} stroke={p.light.rim} strokeWidth={1} opacity={0.55} />
        </g>
      ))}
      <rect x={91} y={23} width={18} height={7} rx={1} fill={url(id('au'))} />
      <rect x={10} y={57} width={180} height={9} fill={woodHi} />
      <rect x={10} y={66} width={180} height={6} fill={woodLo} />
      <path d="M10 57.5H190" stroke={p.light.rim} strokeWidth={1} opacity={0.6} />
      <rect x={14} y={72} width={172} height={4} fill="#000000" opacity={0.25} />
      {end}
      <g transform="matrix(-1 0 0 1 200 0)">{end}</g>
    </Svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

/**
 * Dusk on a kit piece: its stone, gravel and leaves sink toward the deep stock colour (the accent, which lights its
 * windows, and the flames stay warm), so the colonnades, the walk and the trees read as evening, not noon.
 */
function atDusk(draw: Draw, k: number, warmWindows = false, gravel = false): Draw {
  return (p) => {
    const c0 = p.colors;
    const c = gravel ? { ...c0, surface: mix(c0.accent, c0.text, 0.42), muted: mix(c0.accent, c0.text, 0.6) } : c0;
    const n = p.nature;
    return draw({
      ...p,
      colors: { ...c, accent: warmWindows ? mix(c.accent, p.light.color, 0.55) : c.accent, surface: mix(c.surface, c.primary, k), background: mix(c.background, c.primary, k), secondary: mix(c.secondary, c.primary, k * 0.55), muted: mix(c.muted, c.primary, k * 0.6) },
      nature: { ...n, leaf: mix(n.leaf, c.primary, k * 0.7), leafLight: mix(n.leafLight, c.primary, k * 0.7), leafDark: mix(n.leafDark, c.primary, k * 0.5) },
    });
  };
}

/** Warm buff sandstone for the colonnades (the kit's stone, blended toward the dusk's lamplight before dusk deepens it). */
function sandstone(draw: Draw, light: string): Draw {
  return (p) => draw({ ...p, colors: { ...p.colors, surface: mix(p.colors.surface, light, 0.5), secondary: mix(p.colors.secondary, light, 0.22) } });
}

/**
 * Convocation bunting in the college's metal and ivory: its primary pennants turned bronze (a navy, maroon or green
 * flag vanishes against the dusk), so the strings read as bronze, gold and ivory over the deep sky.
 */
function liftedBunting(tint?: 'secondary'): Draw {
  const draw = illus('bunting', tint);
  return (p) => draw({ ...p, colors: { ...p.colors, primary: mix(p.colors.secondary, p.colors.primary, 0.3) } });
}

/**
 * The dusk sky (kit Sky) with the afterglow still on the horizon behind the clock tower and the zenith deepening
 * over the words. The kit's sky box is 1920×1280 content units with frame (0, 0) at (360, 240).
 */
function duskSky(p: DrawProps): ReactNode {
  const id = idsOf(p, 'sk');
  const c = p.colors;
  const glow = mix(p.light.color, c.secondary, 0.35);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {drawWith(Sky, { variant: 'dusk', skyline: 'none', stars: true })(p)}
      <svg viewBox="0 0 1920 1280" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={id('z')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(c.primary, '#000000', 0.5)} stopOpacity={0.7} />
            <stop offset="0.42" stopColor={mix(c.primary, '#000000', 0.3)} stopOpacity={0.35} />
            <stop offset="0.56" stopColor={c.primary} stopOpacity={0} />
          </linearGradient>
          <radialGradient id={id('a')}>
            <stop offset="0" stopColor={tint(glow, 0.3)} stopOpacity={0.85} />
            <stop offset="0.35" stopColor={glow} stopOpacity={0.5} />
            <stop offset="0.7" stopColor={mix(glow, c.primary, 0.5)} stopOpacity={0.18} />
            <stop offset="1" stopColor={c.primary} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={1920} height={1280} fill={url(id('z'))} />
        <ellipse cx={960} cy={712} rx={760} ry={150} fill={url(id('a'))} />
      </svg>
    </div>
  );
}

const LAMP = { w: 40, h: 320 } as const;
/** The campus lamp's globe, from the post's foot (LampPost campus: the globe sits 24 below the box's top). */
const GLOBE_Y = 800 - LAMP.h + 24;

export const quadrangle: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const L = '#ffd9a0';
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, role: Piece['role'], recipe: PlaneRecipe, draw: Draw): void => {
    pieces.push({ kind: 'plane', id, art, role, plane: recipe, draw });
  };

  // Planes: the dusk sky, the lawn with its gravel walk, the colonnades either side.
  plane('sky', 'sky:dusk', 'sky', sky({ d: perspectiveOf(60) * 4.62 }), duskSky);
  plane(
    'lawn',
    'floor:lawn',
    'architecture',
    floor({ x0: 200, x1: 1000, dNear: 350, dFar: 2800 }),
    atDusk(drawWith(Floor, {
      variant: 'lawn',
      path: true,
      pools: [
        { x: 400, d: 1100, r: 120, color: L },
        { x: 800, d: 1100, r: 120, color: L },
        { x: 400, d: 1700, r: 110, color: L },
        { x: 800, d: 1700, r: 110, color: L },
        { x: 600, d: 2650, r: 280, color: '#ffe9c8' },
      ],
    }), 0.42, false, true),
  );
  plane('colonnade-l', 'wall:colonnade', 'architecture', wall('left', { x: 270, yTop: 150, dNear: 350, dFar: 2700 }), sandstone(atDusk(drawWith(Wall, { variant: 'colonnade' }), 0.36, true), L));
  plane('colonnade-r', 'wall:colonnade', 'architecture', wall('right', { x: 930, yTop: 150, dNear: 350, dFar: 2700 }), sandstone(atDusk(drawWith(Wall, { variant: 'colonnade' }), 0.36, true), L));

  // The focal clock tower and its wings, closing the quad.
  pieces.push({ kind: 'prop', id: 'clock-tower', art: 'clockTower', role: 'focal', ...billboard({ x: 600, d: 2800, w: 800, h: 652 }), draw: ClockTower });

  // Rain trees either side of the walk's far end (two unflipped instances: each keeps the key light).
  for (const [k, x, ph] of [
    ['l', 372, 0],
    ['r', 828, 0.5],
  ] as const)
    pieces.push({ kind: 'prop', id: `tree-${k}`, art: 'tree:campus', role: 'prop', ...billboard({ x, d: 2000, w: 290, h: 400 }), draw: atDusk(drawWith(Tree, { variant: 'campus' }), 0.35), motion: { kind: 'sway', amp: 0.5, period: 9, phase: ph } });

  // Campus lamps down the walk, benches between them.
  for (const d of [1100, 1700])
    for (const [k, x] of [
      ['l', 400],
      ['r', 800],
    ] as const)
      pieces.push({ kind: 'prop', id: `lamp-${k}${d}`, art: 'lampPost:campus', role: 'prop', ...billboard({ x, d, w: LAMP.w, h: LAMP.h }), draw: drawWith(LampPost, { variant: 'campus' }), ...(d === 1100 ? { buildIn: 'rise' as const } : {}) });
  for (const [k, x, turn] of [
    ['l', 384, 38],
    ['r', 816, -38],
  ] as const)
    pieces.push({ kind: 'prop', id: `bench-${k}`, art: 'bench', role: 'prop', ...billboard({ x, d: 1400, w: 200, h: 110, turn }), draw: Bench, buildIn: 'fade' });

  // The crown: bunting and fairy lights strung across the quad.
  pieces.push({ kind: 'prop', id: 'bunting-near', art: 'bunting', role: 'hanging', ...hang({ x: 600, d: 700, w: 900, h: 120, top: -160 }), draw: liftedBunting(), motion: { kind: 'sway', amp: 0.8, period: 5 }, buildIn: 'drop' });
  pieces.push({ kind: 'prop', id: 'bunting-mid', art: 'bunting', role: 'hanging', ...hang({ x: 600, d: 1000, w: 900, h: 120, top: -330 }), draw: liftedBunting('secondary'), motion: { kind: 'sway', amp: 0.8, period: 5, phase: 0.4 }, buildIn: 'drop' });
  pieces.push({ kind: 'prop', id: 'fairy-lights', art: 'fairyLights', role: 'hanging', ...hang({ x: 600, d: 1350, w: 900, h: 120, top: -520 }), draw: illus('fairyLights'), motion: { kind: 'twinkle', amp: 0.35, period: 2.4 }, buildIn: 'drop' });

  // Lights: the clock's face, the lamps' globes.
  pieces.push({ kind: 'light', id: 'clock-face', art: 'glow', role: 'light', at: { x: 600, y: 322, z: -2790 }, r: 64, color: '#ffe9c8', strength: 0.6, motion: { kind: 'pulse', amp: 0.5, period: 6 }, buildIn: 'light' });
  for (const d of [1100, 1700])
    for (const [k, x] of [
      ['l', 400],
      ['r', 800],
    ] as const)
      pieces.push({
        kind: 'light',
        id: `glow-${k}${d}`,
        art: 'glow',
        role: 'light',
        at: { x, y: GLOBE_Y, z: -d + 5 },
        r: d === 1100 ? 46 : 40,
        color: L,
        strength: d === 1100 ? 0.55 : 0.45,
        motion: { kind: 'flicker', amp: 0.2, period: 2.2 + (x === 400 ? 0 : 0.5), phase: d === 1100 ? 0 : 0.35 },
        ...(d === 1100 ? { buildIn: 'light' as const } : {}),
      });

  return {
    name: 'quadrangle',
    // Dusk: deep primary overhead to a warm band at the horizon (seen only where no plane is).
    sky: `linear-gradient(180deg, ${mix(c.primary, '#000000', 0.45)} 0%, ${mix(c.primary, '#1d2540', 0.4)} 40%, ${mix(c.primary, L, 0.3)} 55%, ${mix(c.primary, '#000000', 0.3)} 100%)`,
    light: { from: 'far', color: L, rim: '#ffe9c8' },
    fog: { color: '#1d2540', near: 1300, far: 3200, max: 0.45 },
    veil: 0.35,
    focus: { x: 600, y: 520, z: -2600 },
    // The far pose stands at the quad's entrance: from further out the lawn would end in mid-air.
    poses: { far: { x: 600, y: 300, z: 420, yaw: 0, pitch: 0, roll: 0, fov: 52 } },
    pieces,
    covers: { gate: 'campus', door: 'church', silk: 'velvet', card: 'certificate' },
    particles: { count: 28, dNear: 700, dFar: 2300 },
  };
};
