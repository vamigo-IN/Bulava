import type { ReactNode } from 'react';
import { Metal, NATURE, onCubic, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { mix } from '../../theme';
import { drawWith, Floor, Pillar, Wall } from '../kit';
import { billboard, floor, hang, wall } from '../planes';
import type { Draw, DrawProps, Piece, PlaneRecipe, StageSetFactory } from '../types';

/**
 * T10 · Jasmine Aangan (`jasmine-aangan`, final.md §5.3): the `aangan` stage.
 * A Kerala nalukettu at dawn for a naming ceremony. The guest stands under the
 * near veranda's tiled eaves, jasmine strands hanging from its carved fascia
 * (the near layer); teak pillars and banana plants tied at the entrance line a
 * red-oxide courtyard with a rice-flour kolam, two brass kuthuvilakku burning
 * either side of it (the middle layer); on a granite dais at the far end a
 * teak thottil (a hanging cradle) swings gently from a turned frame dressed
 * with a mango-leaf toran and two kalash (the focal point); behind it the far
 * wing's tiled roof and carved gable, coconut palms in the morning haze and
 * the low sun rising on the right.
 *
 * Set-local pieces (§6.4): CradleDais (the dais, frame, toran and kalash), and
 * Thottil (the cradle that swings on its own), plus Eaves, JasmineSwag and
 * FarWing (kit gaps: a near tiled-eave fascia, jasmine-and-kanakambaram
 * strands lit by the key light, the far wing of a nalukettu). The sky is the
 * set's CSS gradient: the far wing and the walls hide most of a sky plane.
 */

// ─────────────────────────── helpers ───────────────────────────

const hx = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#808080');
const url = (id: string) => `url(#${id})`;
const SVG_STYLE = { display: 'block', overflow: 'visible' } as const;
/** Whole units: compact markup for organic detail. */
const q = Math.round;

function Svg({ p, children }: { p: DrawProps; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={SVG_STYLE}>
      {children}
    </svg>
  );
}

/** Ids from the seed and everything the gradients depend on (integer hashing: server and browser agree). */
function idsOf(p: DrawProps, tag: string): (part: string) => string {
  const c = p.colors;
  const key = `${tag}|${p.seed}|${p.w}x${p.h}|${c.primary}${c.secondary}${c.accent}${c.background}${c.surface}${c.text}|${p.nature.leaf}${p.nature.flame}|${p.light.color}${p.light.from}|${p.detail}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const base = `ag${tag}${(h >>> 0).toString(36)}`;
  return (part) => `${base}${part}`;
}

/** The fog the engine mixed into p.nature, applied to another fixed natural colour (flowers). */
function hazer(n: DrawProps['nature']): (c: string) => string {
  const ch = (c: string, s: number) => (Number.parseInt(hx(c).slice(1), 16) >> s) & 255;
  const keep = Math.min(1, Math.max(0, (ch(n.flame, 16) - ch(n.leafDark, 16)) / (ch(NATURE.flame, 16) - ch(NATURE.leafDark, 16))));
  if (keep > 0.995) return hx;
  return (c) => `#${[16, 8, 0].map((s) => Math.min(255, Math.max(0, Math.round(ch(n.flame, s) + keep * (ch(c, s) - ch(NATURE.flame, s))))).toString(16).padStart(2, '0')).join('')}`;
}

/** Real flowers: jasmine is NATURE ivory; kanakambaram (crossandra), marigold and rose are fixed. */
const FLORA = { kanaka: '#f27a1e', kanakaDeep: '#c94f12', marigold: '#f59a0c', marigoldDeep: '#d46a06', rose: '#c2185b' } as const;

const ell = (x: number, y: number, rx: number, ry: number) => `M${q(x - rx)} ${q(y)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
/** A round dot (stroke it with a round cap: the stroke width is its diameter): flowers in a few bytes each. */
const dot = (x: number, y: number) => `M${q(x)} ${q(y)}h0`;
/** A bud: a short vertical stroke with round caps. */
const bud = (x: number, y: number, len: number) => `M${q(x)} ${q(y)}v${q(len)}`;
/** A pointed leaf hanging from (x, y), length l, half-width w, leaning by dx at its tip. */
const leafDown = (x: number, y: number, l: number, w: number, dx = 0) => `M${q(x)} ${q(y)}q${q(w + dx * 0.5)} ${q(l * 0.42)} ${q(dx)} ${q(l)}q${q(-w * 1.9 - dx * 0.5)} ${q(-l * 0.5)} ${q(-dx)} ${q(-l)}z`;

/** Teak from the fogged clay, toward the palette's text. */
const teakOf = (p: DrawProps) => mix(hx(p.nature.clayDark), hx(p.colors.text), 0.28);
/** Which side is lit: the key comes from the right unless it says left. */
const litRight = (p: DrawProps) => p.light.from !== 'left';

// ─────────────────────────── near: the tiled eaves ───────────────────────────

/** Eaves box: the rafters' underside (tall, so far poses see a roof and not sky), the tile noses, the fascia, the carved valance below. */
const EAVES = { w: 1300, h: 340, soffit: 0.794, tiles: 0.843, fascia: 0.93 } as const;

/** The walls' top (world y) and the painted border's height on them. */
const WALL_TOP = 120;
const BORDER_Y = 300;

/**
 * WallDress: what the kit's veranda wall leaves bare, painted on the same plane: the eaves' shadow falling down the
 * lime, a red-oxide and gold border with a dotted kolam chain at lintel height (the way nalukettu walls are dressed
 * for a ceremony), and a soft dawn wash on the walls' lit side. Patterns keep it to a few hundred bytes.
 */
function WallDress(p: DrawProps) {
  const c = p.colors;
  const ids = idsOf(p, 'wd');
  const y = (wy: number) => r2(((wy - WALL_TOP) * p.h) / (800 - WALL_TOP));
  const band = y(BORDER_Y);
  const ink = mix(c.primary, c.text, 0.15);
  const gold = mix(c.secondary, p.light.color, 0.2);
  return (
    <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <defs>
        <linearGradient id={ids('s')} x1="0" y1="0" x2="0" y2="1">
          <stop offset={r2(y(196) / p.h)} stopColor={c.text} stopOpacity={0.3} />
          <stop offset={r2(y(270) / p.h)} stopColor={c.text} stopOpacity={0.1} />
          <stop offset={r2(y(380) / p.h)} stopColor={c.text} stopOpacity={0} />
        </linearGradient>
        <pattern id={ids('k')} x={0} y={band} width={24} height={12} patternUnits="userSpaceOnUse">
          <path d="M12 2L17 6L12 10L7 6Z" fill="none" stroke={c.background} strokeWidth={1} opacity={0.85} />
          <circle cx={12} cy={6} r={1.3} fill={gold} />
          <circle cx={0} cy={6} r={1} fill={c.background} opacity={0.85} />
          <circle cx={24} cy={6} r={1} fill={c.background} opacity={0.85} />
        </pattern>
      </defs>
      <rect width={r2(p.w)} height={r2(p.h)} fill={`url(#${ids('s')})`} />
      <rect y={r2(band - 3)} width={r2(p.w)} height={18} fill={ink} opacity={0.88} />
      <rect y={band} width={r2(p.w)} height={12} fill={`url(#${ids('k')})`} />
      <path d={`M0 ${r2(band - 3)}H${r2(p.w)}M0 ${r2(band + 15)}H${r2(p.w)}`} stroke={gold} strokeWidth={1.6} />
    </svg>
  );
}
/** The kit's veranda wall dressed for the ceremony. */
function dressedWall(colors?: (p: DrawProps) => Partial<DrawProps>): Draw {
  return function DressedWall(p: DrawProps) {
    const q2 = { ...p, ...colors?.(p) };
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Wall {...q2} variant="veranda" detail="low" />
        <WallDress {...q2} />
      </div>
    );
  };
}

/** The near veranda's roof edge seen from beneath: rafters, a row of clay tile noses, a teak fascia with brass studs and a scalloped valance with turned drops. */
function Eaves(p: DrawProps) {
  const id = idsOf(p, 'ev');
  const { w, h } = p;
  const teak = teakOf(p);
  const soffit = mix(teak, hx(p.colors.background), 0.18);
  const tile = mix(hx(p.nature.clay), hx(p.colors.primary), 0.1);
  const brass = hx(p.colors.secondary);
  const lightTone = hx(p.light.color);
  const y1 = h * EAVES.soffit;
  const y2 = h * EAVES.tiles;
  const y3 = h * EAVES.fascia;
  const vh = h - y3;
  return (
    <Svg p={p}>
      <defs>
        <linearGradient id={id('s')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(soffit, '#000000', 0.3)} />
          <stop offset="1" stopColor={mix(soffit, lightTone, 0.15)} />
        </linearGradient>
        <linearGradient id={id('f')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(teak, '#000000', 0.2)} />
          <stop offset="0.7" stopColor={teak} />
          <stop offset="1" stopColor={mix(teak, lightTone, 0.4)} />
        </linearGradient>
        <pattern id={id('r')} width={52} height={y1} patternUnits="userSpaceOnUse">
          <rect x={18} width={14} height={y1} fill={mix(teak, hx(p.colors.background), 0.3)} />
          <rect x={18} width={4} height={y1} fill={mix(teak, '#000000', 0.25)} />
        </pattern>
        <pattern id={id('t')} width={26} height={y2 - y1 + 6} patternUnits="userSpaceOnUse" y={y1 - 6}>
          <path d={`M0 0h26v6a13 ${q(y2 - y1 - 2)} 0 0 1 -26 0z`} fill={tile} />
          <path d={`M4 8a9 ${q((y2 - y1) * 0.6)} 0 0 0 18 0`} fill="none" stroke={mix(tile, '#000000', 0.32)} strokeWidth={2} />
          <path d="M2 4h6" stroke={mix(tile, lightTone, 0.5)} strokeWidth={1.5} />
        </pattern>
        <pattern id={id('d')} width={44} height={y3 - y2} patternUnits="userSpaceOnUse" y={y2}>
          <circle cx={22} cy={q((y3 - y2) / 2)} r={3.4} fill={url(id('m'))} />
          <path d={`M6 ${q((y3 - y2) / 2)}h6M32 ${q((y3 - y2) / 2)}h6`} stroke={mix(teak, '#000000', 0.3)} strokeWidth={1.5} />
        </pattern>
        <pattern id={id('v')} width={32} height={vh} patternUnits="userSpaceOnUse" y={y3}>
          <path d={`M0 0h32v${q(vh * 0.35)}a16 ${q(vh * 0.4)} 0 0 1 -32 0z`} fill={teak} />
          <path d={`M14 ${q(vh * 0.62)}h4v${q(vh * 0.18)}h-4z`} fill={teak} />
          <circle cx={16} cy={q(vh * 0.88)} r={3} fill={url(id('m'))} />
          <path d={`M3 ${q(vh * 0.35)}a13 ${q(vh * 0.3)} 0 0 0 26 0`} fill="none" stroke={mix(teak, lightTone, 0.35)} strokeWidth={1.2} />
        </pattern>
        <Metal id={id('m')} base={brass} foil x2={w} y2={0} />
      </defs>
      <rect width={w} height={y1} fill={url(id('s'))} />
      <rect width={w} height={y1} fill={url(id('r'))} opacity={0.7} />
      <path d={[0.25, 0.55, 0.85].map((f) => `M0 ${q(y1 * f)}h${w}v8h${-w}z`).join('')} fill={mix(teak, '#000000', 0.15)} />
      <rect y={y1 - 6} width={w} height={y2 - y1 + 6} fill={url(id('t'))} />
      <rect y={y2} width={w} height={y3 - y2} fill={url(id('f'))} />
      <rect y={y2} width={w} height={3} fill={mix(teak, '#000000', 0.4)} />
      <rect y={y2} width={w} height={y3 - y2} fill={url(id('d'))} />
      <rect y={y3} width={w} height={vh} fill={url(id('v'))} />
    </Svg>
  );
}

// ─────────────────────────── near: the jasmine festoon ───────────────────────────

/** One loop of a jasmine festoon tied along the fascia: a full swag of buds, a kanakambaram knot at each tie, a pendant strand with a rose and a gold tassel. */
function JasmineSwag(p: DrawProps) {
  const { w, h } = p;
  const haze = hazer(p.nature);
  const ivory = hx(p.nature.ivory);
  const budShade = mix(ivory, hx(p.colors.muted), 0.45);
  const salt = 5 + (Math.abs(Math.round(p.seed)) % 37);
  const away = litRight(p) ? -1 : 1;
  const sag = h * 0.42;
  const swagY = (t: number) => 5 + 4 * sag * t * (1 - t);
  let buds = '';
  let shadow = '';
  const n = Math.max(12, Math.round(w / 4.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 5 + (w - 10) * t;
    const y = swagY(t);
    for (const row of [-2.6, 2.6]) {
      const jx = x + (rand(i, salt + (row > 0 ? 1 : 0)) - 0.5) * 2;
      buds += bud(jx, y + row - 1.5, 3);
      shadow += bud(jx + away, y + row - 0.5, 2);
    }
  }
  // Pendants: the centre one long, one at each tie.
  const drops: Array<[number, number, number]> = [
    [w / 2, swagY(0.5) + 4, h - 12],
    [5, 8, h * 0.55],
    [w - 5, 8, h * 0.5],
  ];
  let tips = '';
  let small = '';
  drops.forEach(([x, y0, y1], s) => {
    for (let y = y0; y < y1 - 3; y += 6) {
      const jx = x + ((Math.round(y / 6) + s) % 2 ? 1.8 : -1.8);
      buds += bud(jx, y - 1.5, 3);
      shadow += bud(jx + away, y - 0.5, 2);
    }
    if (s) small += dot(x, y1);
    else tips += dot(x, y1);
  });
  return (
    <Svg p={p}>
      <path d={buds} stroke={ivory} strokeWidth={4.6} strokeLinecap="round" />
      <path d={shadow} stroke={budShade} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
      <path d={dot(5, 5) + dot(w - 5, 5)} stroke={haze(FLORA.kanaka)} strokeWidth={9} strokeLinecap="round" />
      <path d={tips} stroke={haze(FLORA.rose)} strokeWidth={9.4} strokeLinecap="round" />
      <path d={small} stroke={haze(FLORA.rose)} strokeWidth={7} strokeLinecap="round" />
      <path d={`M${q(w / 2 - 2)} ${q(h - 8)}l-2 8M${q(w / 2)} ${q(h - 8)}v8M${q(w / 2 + 2)} ${q(h - 8)}l2 8`} stroke={hx(p.colors.secondary)} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────── middle: the colonnade and its garlands ───────────────────────────

const PILLAR = { w: 70, h: 470 } as const;
/** A colonnade bay: two teak pillars 460 apart (centres) and the garland strung between them. */
const BAY_W = 460 + PILLAR.w;

/** Two kit teak pillars (each lit by the key light, never mirrored), each dressed like a ceremonial post: a marigold garland hung over its capital, mango leaves at the dip, strands falling down both sides to a jasmine-and-rose tassel. */
function Colonnade(p: DrawProps) {
  const { w, h } = p;
  const haze = hazer(p.nature);
  const k = h / PILLAR.h;
  const tieY = 66 * k;
  const lit = litRight(p) ? 1 : -1;
  let orange = '';
  let yellow = '';
  let shine = '';
  let leaves = '';
  let jasmine = '';
  let roses = '';
  const flower = (x: number, y: number, i: number) => {
    if (i % 2) orange += dot(x, y);
    else yellow += dot(x, y);
    shine += dot(x + lit * 1.6 * k, y - 1.6 * k);
  };
  for (const px of [PILLAR.w / 2, w - PILLAR.w / 2]) {
    const a = px - 27 * k;
    const b = px + 27 * k;
    const seg: Segment = [
      [a, tieY],
      [a + 6 * k, tieY + 44 * k],
      [b - 6 * k, tieY + 44 * k],
      [b, tieY],
    ];
    for (let i = 0; i <= 10; i++) {
      const o = onCubic(seg, i / 10);
      flower(o.x, o.y, i);
    }
    const low = onCubic(seg, 0.5);
    leaves += leafDown(px - 7 * k, low.y + 3 * k, 24 * k, 4.5 * k, -5 * k) + leafDown(px + 7 * k, low.y + 3 * k, 24 * k, 4.5 * k, 5 * k) + leafDown(px, low.y + 4 * k, 28 * k, 4.5 * k);
    // Strands down both sides of the shaft, alternating flowers, each ending in jasmine and a rose.
    ([a, b] as const).forEach((x, s) => {
      const end = tieY + (s ? 150 : 170) * k;
      let n = 0;
      for (let y = tieY + 9 * k; y < end; y += 9 * k, n++) flower(x + (n % 2 ? 1 : -1) * k, y, n);
      for (let y = end; y < end + 30 * k; y += 5.5 * k) jasmine += bud(x + (Math.round(y / (5.5 * k)) % 2 ? 1.6 : -1.6) * k, y - 1.5 * k, 3 * k);
      roses += dot(x, end + 34 * k);
    });
  }
  return (
    <Svg p={p}>
      {[0, w - PILLAR.w].map((x, i) => (
        <svg key={i} x={r2(x)} y={0} width={PILLAR.w} height={r2(h)} viewBox={`0 0 ${PILLAR.w} ${r2(h)}`} preserveAspectRatio="none" style={SVG_STYLE}>
          <Pillar {...p} w={PILLAR.w} h={h} seed={p.seed + i * 7} variant="teak" detail="low" />
        </svg>
      ))}
      <path d={leaves} fill={hx(p.nature.leaf)} stroke={hx(p.nature.leafDark)} strokeWidth={0.8} />
      <path d={orange} stroke={haze(FLORA.marigold)} strokeWidth={r2(11.5 * k)} strokeLinecap="round" />
      <path d={yellow} stroke={haze('#f7c21e')} strokeWidth={r2(11.5 * k)} strokeLinecap="round" />
      <path d={shine} stroke={haze('#ffe27a')} strokeWidth={r2(4 * k)} strokeLinecap="round" opacity={0.8} />
      <path d={jasmine} stroke={hx(p.nature.ivory)} strokeWidth={r2(4.4 * k)} strokeLinecap="round" />
      <path d={roses} stroke={haze(FLORA.rose)} strokeWidth={r2(9 * k)} strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────── far: the far wing of the nalukettu ───────────────────────────

const FAR = { w: 780, h: 560 } as const;

/** The far wing: coconut palms over a tiled hip roof with a carved gable (mukhappu), a shaded veranda with a teak door, a laterite plinth and steps. */
function FarWing(p: DrawProps) {
  const id = idsOf(p, 'fw');
  const { w, h } = p;
  const c = p.colors;
  const right = litRight(p);
  const teak = teakOf(p);
  const tile = mix(hx(p.nature.clay), hx(c.primary), 0.1);
  const brass = hx(c.secondary);
  const skyTone = mix(hx(c.background), hx(c.accent), 0.4);
  const palm = mix(hx(p.nature.leafDark), skyTone, 0.55);
  const stone = mix(hx(p.nature.clay), hx(c.surface), 0.55);
  const eave = h * 0.52; // eave line (world 812 - ...)
  const ridge = h * 0.37;
  const plinth = h * 0.76;
  const cx = w / 2;
  // Coconut palms: a leaning trunk and a crown of drooping fronds (relative curves, no angles).
  const palms = [
    { x: w * 0.14, lean: 30, top: h * 0.08 },
    { x: w * 0.88, lean: -24, top: h * 0.02 },
    { x: w * 0.72, lean: 16, top: h * 0.16 },
  ];
  let fronds = '';
  let trunks = '';
  palms.forEach((pl, i) => {
    const tx = pl.x + pl.lean;
    trunks += `M${q(pl.x - 5)} ${q(ridge + 20)}Q${q(pl.x + pl.lean * 0.2)} ${q((ridge + pl.top) / 2)} ${q(tx - 3)} ${q(pl.top)}h6Q${q(pl.x + pl.lean * 0.2 + 6)} ${q((ridge + pl.top) / 2)} ${q(pl.x + 5)} ${q(ridge + 20)}z`;
    const dirs: Array<[number, number]> = [[-1, 0.15], [-0.8, -0.45], [-0.3, -0.75], [0.3, -0.75], [0.8, -0.45], [1, 0.15], [-0.55, 0.55], [0.55, 0.55]];
    dirs.forEach(([dx, dy], k) => {
      const l = 62 + rand(k, 13 + i) * 22;
      const ex = tx + dx * l;
      const ey = pl.top + dy * l * 0.6 + l * 0.35;
      const mx = tx + dx * l * 0.55;
      const my = pl.top + dy * l * 0.75;
      fronds += `M${q(tx)} ${q(pl.top)}Q${q(mx)} ${q(my - 6)} ${q(ex)} ${q(ey)}Q${q(mx)} ${q(my + 6)} ${q(tx)} ${q(pl.top + 3)}z`;
    });
  });
  // The hip roof and the gable over the entrance.
  const roof = `M0 ${q(eave)}L${q(w * 0.17)} ${q(ridge)}H${q(w * 0.83)}L${w} ${q(eave)}z`;
  const gy = h * 0.2;
  const gable = `M${q(cx - 88)} ${q(eave - 12)}L${q(cx)} ${q(gy)}L${q(cx + 88)} ${q(eave - 12)}z`;
  const face = `M${q(cx - 66)} ${q(eave - 18)}L${q(cx)} ${q(gy + 22)}L${q(cx + 66)} ${q(eave - 18)}z`;
  let slats = '';
  for (let i = -5; i <= 5; i++) slats += `M${q(cx + i * 11)} ${q(eave - 18)}V${q(gy + 22 + Math.abs(i) * 11 * ((eave - 40 - gy) / 66))}`;
  const posts = [w * 0.12, w * 0.3, w * 0.7, w * 0.88];
  const vTop = eave + 8;
  return (
    <Svg p={p}>
      <defs>
        <pattern id={id('t')} width={16} height={11} patternUnits="userSpaceOnUse">
          <rect width={16} height={11} fill={tile} />
          <path d="M0 10.5h16M8 0v11" stroke={mix(tile, '#000000', 0.22)} strokeWidth={1.2} />
        </pattern>
        <linearGradient id={id('v')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(teak, '#000000', 0.45)} />
          <stop offset="1" stopColor={mix(teak, '#000000', 0.15)} />
        </linearGradient>
        <linearGradient id={id('s')} x1={right ? '0' : '1'} y1="0" x2={right ? '1' : '0'} y2="0">
          <stop offset="0" stopColor={mix(stone, '#000000', 0.12)} />
          <stop offset="1" stopColor={mix(stone, hx(p.light.color), 0.25)} />
        </linearGradient>
        <radialGradient id={id('g')} cx="50%" cy="60%" r="60%">
          <stop offset="0" stopColor="#ffe7a8" />
          <stop offset="1" stopColor="#ffe7a8" stopOpacity={0} />
        </radialGradient>
        <Metal id={id('m')} base={brass} foil x2={w} y2={0} />
      </defs>
      <path d={trunks} fill={mix(palm, hx(p.nature.clayDark), 0.35)} />
      <path d={fronds} fill={palm} />
      {/* veranda in shade, its posts, windows and the door */}
      <rect x={w * 0.04} y={vTop} width={w * 0.92} height={plinth - vTop} fill={url(id('v'))} />
      <path d={posts.map((x) => `M${q(x - 6)} ${q(vTop)}h12V${q(plinth)}h-12z`).join('')} fill={mix(teak, hx(c.background), 0.3)} />
      <path d={posts.map((x) => `M${q(x + (right ? -6 : 3))} ${q(vTop)}h3V${q(plinth)}h-3z`).join('')} fill={mix(teak, '#000000', 0.2)} />
      {[w * 0.21, w * 0.79].map((x, i) => (
        <g key={i}>
          <rect x={x - 26} y={vTop + 34} width={52} height={60} fill={mix(teak, '#000000', 0.25)} stroke={mix(teak, hx(c.background), 0.35)} strokeWidth={4} />
          <path d={`M${q(x - 16)} ${q(vTop + 36)}v56M${q(x - 6)} ${q(vTop + 36)}v56M${q(x + 4)} ${q(vTop + 36)}v56M${q(x + 14)} ${q(vTop + 36)}v56`} stroke={mix(teak, hx(c.background), 0.25)} strokeWidth={3} />
        </g>
      ))}
      <rect x={cx - 52} y={vTop + 10} width={104} height={plinth - vTop - 10} fill={mix(teak, '#000000', 0.1)} stroke={url(id('m'))} strokeWidth={4} />
      <path d={`M${q(cx)} ${q(vTop + 14)}V${q(plinth)}`} stroke={mix(teak, '#000000', 0.4)} strokeWidth={2} />
      <path d={[0, 1, 2, 3].map((r) => [-1, 1].map((s) => `M${q(cx + s * 26 - 2.5)} ${q(vTop + 40 + r * 34)}h5v5h-5z`).join('')).join('')} fill={url(id('m'))} />
      <ellipse cx={cx} cy={vTop + 70} rx={70} ry={60} fill={url(id('g'))} opacity={0.45} />
      {/* plinth and steps */}
      <rect y={plinth} width={w} height={h - plinth} fill={url(id('s'))} />
      <rect y={plinth} width={w} height={6} fill={mix(stone, hx(p.light.color), 0.45)} />
      <path d={[0, 1, 2].map((i) => `M${q(cx - 90 - i * 14)} ${q(plinth + 12 + i * ((h - plinth - 12) / 3))}h${q(180 + i * 28)}v4h${q(-180 - i * 28)}z`).join('')} fill={mix(stone, hx(p.light.color), 0.5)} />
      <path d={`M0 ${q(plinth + 28)}H${q(cx - 110)}M${q(cx + 110)} ${q(plinth + 28)}H${w}`} stroke={mix(stone, '#000000', 0.18)} strokeWidth={3} />
      {/* the roof */}
      <path d={roof} fill={url(id('t'))} />
      <path d={roof} fill={right ? 'none' : 'none'} stroke={mix(tile, '#000000', 0.25)} strokeWidth={2} />
      <path d={`M${q(w * 0.17)} ${q(ridge)}H${q(w * 0.83)}`} stroke={mix(tile, '#000000', 0.35)} strokeWidth={5} />
      <rect y={eave - 2} width={w} height={10} fill={teak} />
      <path d={gable} fill={url(id('t'))} stroke={mix(tile, '#000000', 0.3)} strokeWidth={2} />
      <path d={face} fill={mix(teak, '#000000', 0.12)} />
      <path d={slats} stroke={mix(teak, hx(c.background), 0.3)} strokeWidth={2.5} />
      <path d={`M${q(cx - 66)} ${q(eave - 18)}L${q(cx)} ${q(gy + 22)}L${q(cx + 66)} ${q(eave - 18)}`} fill="none" stroke={url(id('m'))} strokeWidth={4} />
      <path d={`M${q(cx - 6)} ${q(gy + 2)}q6 -18 12 0q4 10 -6 14q-10 -4 -6 -14zM${q(cx - 1.5)} ${q(gy - 26)}h3v14h-3z`} fill={url(id('m'))} />
    </Svg>
  );
}

// ─────────────────────────── focal: the dais, frame, toran and kalash ───────────────────────────

/** A brass kalash with a red-and-white thread, a fan of mango leaves and a coconut, standing on (x, y). */
function kalash(x: number, y: number, s: number, metal: string, leaf: string, leafDark: string, coconut: string, thread: string): ReactNode {
  const pot = `M${q(x - 9 * s)} ${q(y)}h${q(18 * s)}q${q(9 * s)} ${q(-8 * s)} ${q(9 * s)} ${q(-20 * s)}q0 ${q(-12 * s)} ${q(-11 * s)} ${q(-17 * s)}q${q(4 * s)} ${q(-3 * s)} ${q(3 * s)} ${q(-6 * s)}h${q(-20 * s)}q${q(-1 * s)} ${q(3 * s)} ${q(3 * s)} ${q(6 * s)}q${q(-11 * s)} ${q(5 * s)} ${q(-11 * s)} ${q(17 * s)}q0 ${q(12 * s)} ${q(9 * s)} ${q(20 * s)}z`;
  const top = y - 43 * s;
  let leaves = '';
  const fan: Array<[number, number]> = [[-1, -0.25], [-0.75, -0.7], [-0.3, -0.95], [0.3, -0.95], [0.75, -0.7], [1, -0.25]];
  fan.forEach(([dx, dy]) => {
    const l = 20 * s;
    leaves += `M${q(x)} ${q(top)}q${q(dx * l * 0.5 - dy * 5 * s)} ${q(dy * l * 0.5 + dx * 5 * s)} ${q(dx * l)} ${q(dy * l)}q${q(-dx * l * 0.5 - dy * 5 * s)} ${q(-dy * l * 0.5 + dx * 5 * s)} ${q(-dx * l)} ${q(-dy * l)}z`;
  });
  return (
    <g>
      <path d={leaves} fill={leaf} stroke={leafDark} strokeWidth={0.8} />
      <ellipse cx={x} cy={top - 8 * s} rx={10 * s} ry={11 * s} fill={coconut} />
      <path d={`M${q(x - 3 * s)} ${q(top - 18 * s)}l${q(3 * s)} ${q(-7 * s)}l${q(3 * s)} ${q(7 * s)}`} fill="none" stroke={mix(coconut, '#000000', 0.3)} strokeWidth={1.5} />
      <path d={pot} fill={metal} />
      <path d={`M${q(x - 13 * s)} ${q(y - 26 * s)}h${q(26 * s)}`} stroke={thread} strokeWidth={2.4 * s} strokeDasharray={`${r2(3 * s)} ${r2(2 * s)}`} />
    </g>
  );
}

const DAIS = { w: 520, h: 440 } as const;
/** Frame posts (box x) and the beam's foot (box y): the thottil hangs from here. */
const POST_X = [84, 436] as const;
const BEAM_FOOT = 50;

/** The focal dais: a two-tier granite plinth with a lotus band, a turned teak frame wrapped in jasmine and marigold, a mango-leaf toran on its beam, a brass kalash finial and two kalash on the plinth. */
function CradleDais(p: DrawProps) {
  const id = idsOf(p, 'cd');
  const { w, h } = p;
  const c = p.colors;
  const right = litRight(p);
  const haze = hazer(p.nature);
  const teak = teakOf(p);
  const brass = hx(c.secondary);
  const stone = mix(mix(hx(c.text), hx(c.surface), 0.52), hx(p.nature.clay), 0.1);
  const lightTone = hx(p.light.color);
  const ivory = hx(p.nature.ivory);
  // Tiers: lower front face 368–400, its top 355–368; upper front face 330–355, its top 318–330.
  const t1 = h - 32;
  const t1Top = t1 - 13;
  const t2Top = t1Top - 37;
  const t2 = t2Top + 12;
  // Lotus band on the upper face.
  let lotus = '';
  for (let x = 46; x <= w - 46; x += 18) lotus += `M${q(x - 8)} ${q(t2 + 20)}q2 -12 8 -14q6 2 8 14z`;
  let dots = '';
  for (let x = 14; x < w - 8; x += 12) dots += dot(x, t1 + 16);
  // Posts: turned shafts, brass rings, a jasmine and marigold wrap.
  const postTop = BEAM_FOOT - 4;
  let wrapW = '';
  let wrapM = '';
  POST_X.forEach((x) => {
    for (let y = postTop + 30; y < t2Top - 34; y += 22) {
      wrapW += `M${q(x - 9)} ${q(y)}l18 -8v5l-18 8z`;
      wrapM += dot(x, y + 7);
    }
  });
  // Mango leaves along the beam, a marigold at each tie.
  let leaves = '';
  let leafRibs = '';
  let ties = '';
  const n = 17;
  for (let i = 0; i < n; i++) {
    const x = POST_X[0] + 16 + ((POST_X[1] - POST_X[0] - 32) * i) / (n - 1);
    const l = i % 2 ? 30 : 38;
    const dx = (x - w / 2) * 0.02;
    leaves += leafDown(x, BEAM_FOOT, l, 6.5, dx);
    leafRibs += `M${q(x)} ${q(BEAM_FOOT + 2)}l${q(dx * 0.9)} ${q(l - 6)}`;
    if (i % 2 === 0) ties += dot(x, BEAM_FOOT + 3);
  }
  const k = (s: number) => (right ? s : -s);
  return (
    <Svg p={p}>
      <defs>
        <Metal id={id('m')} base={brass} foil x2={w} y2={h * 0.2} />
        <linearGradient id={id('p')} x1={right ? '0' : '1'} y1="0" x2={right ? '1' : '0'} y2="0">
          <stop offset="0" stopColor={mix(teak, '#000000', 0.32)} />
          <stop offset="0.55" stopColor={teak} />
          <stop offset="0.8" stopColor={mix(teak, lightTone, 0.35)} />
          <stop offset="1" stopColor={mix(teak, '#000000', 0.1)} />
        </linearGradient>
        <linearGradient id={id('f')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(stone, lightTone, 0.18)} />
          <stop offset="1" stopColor={mix(stone, '#000000', 0.16)} />
        </linearGradient>
        <linearGradient id={id('l')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hx(p.nature.leafDark)} />
          <stop offset="1" stopColor={hx(p.nature.leaf)} />
        </linearGradient>
        <radialGradient id={id('d')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={hx(p.nature.flameCore)} stopOpacity={0.8} />
          <stop offset="1" stopColor={hx(p.nature.flame)} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('g')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={lightTone} stopOpacity={0.55} />
          <stop offset="1" stopColor={lightTone} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* a warm dawn glow on the plinth */}
      <ellipse cx={w * (right ? 0.62 : 0.38)} cy={t2Top + 4} rx={w * 0.45} ry={26} fill={url(id('g'))} />
      {/* the plinth: lower and upper tiers, each a lit top face over a front face */}
      <path d={`M0 ${q(t1)}L10 ${q(t1Top)}H${w - 10}L${w} ${q(t1)}z`} fill={mix(stone, lightTone, 0.42)} />
      <rect y={t1} width={w} height={h - t1} fill={url(id('f'))} />
      <path d={dots} stroke={ivory} strokeWidth={3.2} strokeLinecap="round" opacity={0.85} />
      <path d={`M24 ${q(t2)}L34 ${q(t2Top)}H${w - 34}L${w - 24} ${q(t2)}z`} fill={mix(stone, lightTone, 0.5)} />
      <rect x={24} y={t2} width={w - 48} height={t1Top - t2} fill={url(id('f'))} />
      <path d={lotus} fill={mix(stone, '#000000', 0.14)} />
      <path d={`M24 ${q(t2 + 1)}H${w - 24}M0 ${q(t1 + 1)}H${w}`} stroke={mix(stone, lightTone, 0.65)} strokeWidth={2} />
      <path d={`M${right ? 24 : w - 26} ${q(t2)}v${q(t1Top - t2)}h2v${q(-(t1Top - t2))}z`} fill={hx(p.light.rim)} opacity={0.6} />
      {/* marigold petals strewn on the lower tier */}
      <path d={[0.09, 0.15, 0.26, 0.33, 0.65, 0.73, 0.83, 0.9].map((f, i) => dot(w * f + rand(i, 3) * 10, t1Top + 6 + rand(i, 5) * 4)).join('')} stroke={haze(FLORA.marigold)} strokeWidth={4} strokeLinecap="round" />
      {/* a row of clay diyas alight along the lower tier */}
      {[0.16, 0.27, 0.38, 0.62, 0.73, 0.84].map((f, i) => (
        <g key={i}>
          <circle cx={q(w * f)} cy={q(t1Top - 4)} r={10} fill={url(id('d'))} />
          <path d={`M${q(w * f - 6)} ${q(t1Top + 5)}q6 7 12 0z`} fill={hx(p.nature.clay)} />
          <path d={`M${q(w * f)} ${q(t1Top - 9)}q3.5 7 0 13q-3.5 -6 0 -13z`} fill={hx(p.nature.flame)} />
        </g>
      ))}
      {/* the frame: two turned posts with lotus feet and brass rings, the beam and its finial */}
      {POST_X.map((x, i) => (
        <g key={i}>
          <path d={`M${x - 8} ${q(postTop)}h16v${q(t2Top - postTop - 16)}l7 16h-30l7 -16z`} fill={url(id('p'))} />
          <path d={`M${x - 15} ${q(t2Top)}q15 -14 30 0z`} fill={url(id('m'))} />
          <path d={[0.28, 0.55, 0.8].map((f) => `M${x - 10} ${q(postTop + (t2Top - postTop) * f)}h20v6h-20z`).join('')} fill={url(id('m'))} />
        </g>
      ))}
      <path d={wrapW} fill={ivory} />
      <path d={wrapM} stroke={haze(FLORA.marigold)} strokeWidth={10} strokeLinecap="round" />
      <rect x={POST_X[0] - 22} y={BEAM_FOOT - 18} width={POST_X[1] - POST_X[0] + 44} height={18} rx={3} fill={url(id('p'))} />
      <rect x={POST_X[0] - 22} y={BEAM_FOOT - 3} width={POST_X[1] - POST_X[0] + 44} height={3} fill={mix(teak, '#000000', 0.35)} />
      <path d={POST_X.map((x) => `M${x - 26} ${BEAM_FOOT - 20}h52v5h-52zM${x - 8} ${BEAM_FOOT - 26}h16v6h-16z${ell(x, BEAM_FOOT - 30, 5, 6)}`).join('')} fill={url(id('m'))} />
      {kalash(w / 2, BEAM_FOOT - 18, 0.62, url(id('m')), hx(p.nature.leaf), hx(p.nature.leafDark), mix(hx(p.nature.clayDark), '#000000', 0.1), haze(FLORA.kanaka))}
      {/* the mango-leaf toran */}
      <path d={leaves} fill={url(id('l'))} />
      <path d={leafRibs} stroke={hx(p.nature.leafLight)} strokeWidth={1} opacity={0.7} />
      <path d={ties} stroke={haze(FLORA.marigold)} strokeWidth={9.5} strokeLinecap="round" />
      {/* kalash at the plinth's front corners */}
      {kalash(22, t1Top + 4, 1, url(id('m')), hx(p.nature.leaf), hx(p.nature.leafDark), mix(hx(p.nature.clayDark), '#000000', 0.1), haze(FLORA.kanaka))}
      {kalash(w - 22, t1Top + 4, 1, url(id('m')), hx(p.nature.leaf), hx(p.nature.leafDark), mix(hx(p.nature.clayDark), '#000000', 0.1), haze(FLORA.kanaka))}
      <path d={`M${k(0) + (right ? 4 : w - 4)} ${q(t1)}v${q(h - t1)}`} stroke={hx(p.light.rim)} strokeWidth={1.5} opacity={0.5} />
    </Svg>
  );
}

/** The thottil: a teak cradle with a raised sheer and scrolled ends on four brass chains, a carved brass-studded band, an ivory quilt, a silk fall with a gold hem and a jasmine swag. */
function Thottil(p: DrawProps) {
  const id = idsOf(p, 'th');
  const { w, h } = p;
  const c = p.colors;
  const right = litRight(p);
  const haze = hazer(p.nature);
  const teak = mix(mix(hx(p.nature.clay), hx(p.nature.clayDark), 0.55), hx(c.text), 0.12);
  const brass = hx(c.secondary);
  const lightTone = hx(p.light.color);
  const silk = hx(c.primary);
  const quilt = mix(hx(c.accent), hx(c.background), 0.25);
  const ivory = hx(p.nature.ivory);
  const rim = h * 0.62;
  const foot = h * 0.88;
  const x0 = w * 0.07;
  const x1 = w * 0.93;
  const cx = w / 2;
  const hull = `M${q(x0)} ${q(rim - 10)}Q${q(cx)} ${q(rim + 6)} ${q(x1)} ${q(rim - 10)}C${q(x1 - 2)} ${q(foot - 12)} ${q(x1 - 50)} ${q(foot)} ${q(cx)} ${q(foot)}C${q(x0 + 50)} ${q(foot)} ${q(x0 + 2)} ${q(foot - 12)} ${q(x0)} ${q(rim - 10)}z`;
  const band = (dy: number, inset: number) => `M${q(x0 + inset)} ${q(rim - 8 + dy)}Q${q(cx)} ${q(rim + 8 + dy)} ${q(x1 - inset)} ${q(rim - 8 + dy)}`;
  let studs = '';
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const x = x0 + 14 + (x1 - x0 - 28) * t;
    const y = rim - 8 + 15 + 4 * 8 * t * (1 - t) * 0.9;
    studs += dot(x, y);
  }
  const scroll = (x: number, s: number) => `M${q(x)} ${q(rim - 6)}c${q(-s * 10)} -10 ${q(-s * 14)} -26 ${q(-s * 4)} -34c${q(s * 9)} -6 ${q(s * 16)} 4 ${q(s * 8)} 10c${q(-s * 5)} 3 ${q(-s * 8)} -3 ${q(-s * 4)} -5`;
  // Chains: from the beam (the box top) down to the cradle's raised ends.
  const chains: Array<[number, number]> = [
    [w * 0.02, x0 + 8],
    [w * 0.13, x0 + 22],
    [w * 0.98, x1 - 8],
    [w * 0.87, x1 - 22],
  ];
  // The jasmine swag along the rim: two dips.
  let swag = '';
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = x0 + 10 + (x1 - x0 - 20) * t;
    const dip = Math.abs(((t * 2) % 1) - 0.5);
    const y = rim - 4 + 4 * 8 * t * (1 - t) * 0.5 + (0.25 - dip * dip) * 40;
    swag += bud(x, y - 1.5, 3);
  }
  const fall = `M${q(cx - 40)} ${q(rim - 4)}Q${q(cx)} ${q(rim + 6)} ${q(cx + 40)} ${q(rim - 4)}l-6 ${q(h * 0.17)}q-17 9 -34 0q-17 9 -34 0z`;
  return (
    <Svg p={p}>
      <defs>
        <Metal id={id('m')} base={brass} foil x2={w} y2={h * 0.3} />
        <linearGradient id={id('h')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(teak, lightTone, 0.35)} />
          <stop offset="0.45" stopColor={teak} />
          <stop offset="1" stopColor={mix(teak, '#000000', 0.4)} />
        </linearGradient>
        <linearGradient id={id('x')} x1={right ? '0' : '1'} y1="0" x2={right ? '1' : '0'} y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity={0.32} />
          <stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <stop offset="0.85" stopColor={lightTone} stopOpacity={0.18} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.12} />
        </linearGradient>
        <linearGradient id={id('q')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(quilt, lightTone, 0.4)} />
          <stop offset="1" stopColor={mix(quilt, hx(c.muted), 0.35)} />
        </linearGradient>
        <linearGradient id={id('s')} x1={right ? '0' : '1'} y1="0" x2={right ? '1' : '0'} y2="0">
          <stop offset="0" stopColor={mix(silk, '#000000', 0.3)} />
          <stop offset="0.65" stopColor={silk} />
          <stop offset="1" stopColor={mix(silk, lightTone, 0.35)} />
        </linearGradient>
      </defs>
      <path d={chains.map(([a, b]) => `M${q(a)} 0L${q(b)} ${q(rim - 30)}`).join('')} stroke={url(id('m'))} strokeWidth={2.4} strokeDasharray="4 2.4" strokeLinecap="round" fill="none" />
      {/* the quilt rising above the rim, a small pillow at the head */}
      <path d={`M${q(x0 + 14)} ${q(rim - 6)}q${q((x1 - x0) * 0.18)} -26 ${q((x1 - x0) / 2 - 14)} -20q${q((x1 - x0) * 0.32)} -4 ${q((x1 - x0) / 2 - 14)} 20z`} fill={url(id('q'))} />
      <path d={ell(x0 + 44, rim - 20, 22, 11)} fill={mix(quilt, lightTone, 0.5)} />
      <path d={`M${q(x0 + 70)} ${q(rim - 22)}q40 -8 ${q(x1 - x0 - 120)} 2`} fill="none" stroke={mix(quilt, hx(c.muted), 0.45)} strokeWidth={1.4} />
      <path d={hull} fill={url(id('h'))} />
      <path d={hull} fill={url(id('x'))} />
      <path d={band(0, 0)} fill="none" stroke={url(id('m'))} strokeWidth={4.5} />
      <path d={band(28, 12)} fill="none" stroke={url(id('m'))} strokeWidth={2.2} />
      <path d={studs} stroke={brass} strokeWidth={4.4} strokeLinecap="round" />
      {/* the silk fall over the front with its gold hem and a tassel */}
      <path d={fall} fill={url(id('s'))} />
      <path d={`M${q(cx + 34)} ${q(rim - 4 + h * 0.17)}q-17 9 -34 0q-17 9 -34 0`} fill="none" stroke={url(id('m'))} strokeWidth={3} />
      <path d={`M${q(cx)} ${q(rim + h * 0.17)}v8M${q(cx - 2)} ${q(rim + h * 0.17 + 6)}l-2 8M${q(cx + 2)} ${q(rim + h * 0.17 + 6)}l2 8`} stroke={url(id('m'))} strokeWidth={1.6} strokeLinecap="round" />
      <path d={swag} stroke={ivory} strokeWidth={5} strokeLinecap="round" />
      <path d={`${ell(x0 + 10, rim - 8, 4.2, 4.2)}${ell(x1 - 10, rim - 8, 4.2, 4.2)}${ell(cx - 50, rim + 10, 3.6, 3.6)}${ell(cx + 50, rim + 10, 3.6, 3.6)}`} fill={haze(FLORA.rose)} />
      <path d={`${scroll(x0, 1)}${scroll(x1, -1)}`} fill="none" stroke={url(id('m'))} strokeWidth={5} strokeLinecap="round" />
      <path d={`M${q(x0 - 2)} ${q(rim - 2)}l-4 18M${q(x0 + 2)} ${q(rim - 2)}l0 20M${q(x1 + 2)} ${q(rim - 2)}l4 18M${q(x1 - 2)} ${q(rim - 2)}l0 20`} stroke={haze(FLORA.kanaka)} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

const URULI = { w: 190, h: 66 } as const;

/** A brass uruli on the kolam: floating marigolds, roses and jasmine, three floating diyas alight. */
function Uruli(p: DrawProps) {
  const id = idsOf(p, 'ur');
  const { w, h } = p;
  const c = p.colors;
  const haze = hazer(p.nature);
  const brass = hx(c.secondary);
  const cx = w / 2;
  const rimY = h * 0.42;
  const rx = w * 0.46;
  const water = mix(mix('#9fbcc4', hx(c.background), 0.3), hx(c.primary), 0.25);
  const body = `M${q(cx - rx)} ${q(rimY)}C${q(cx - rx + 4)} ${q(h * 0.8)} ${q(cx - rx * 0.6)} ${q(h)} ${q(cx)} ${q(h)}C${q(cx + rx * 0.6)} ${q(h)} ${q(cx + rx - 4)} ${q(h * 0.8)} ${q(cx + rx)} ${q(rimY)}z`;
  const salt = 9 + (Math.abs(Math.round(p.seed)) % 23);
  let marigolds = '';
  let roses = '';
  let buds = '';
  for (let i = 0; i < 9; i++) {
    const x = cx + (rand(i, salt) - 0.5) * rx * 1.6;
    const y = rimY + (rand(i, salt + 1) - 0.5) * 7;
    if (i % 3 === 0) roses += ell(x, y - 1, 4.5, 3);
    else marigolds += ell(x, y - 1, 6, 4);
    buds += ell(x + 7, y + 1, 1.8, 1.4);
  }
  const diyas = [cx - rx * 0.55, cx, cx + rx * 0.55];
  return (
    <Svg p={p}>
      <defs>
        <Metal id={id('m')} base={brass} foil x2={w} y2={h * 0.4} />
        <radialGradient id={id('g')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={hx(p.nature.flameCore)} stopOpacity={0.85} />
          <stop offset="1" stopColor={hx(p.nature.flame)} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={body} fill={url(id('m'))} />
      <path d={`M${q(cx - rx * 0.86)} ${q(h * 0.62)}Q${q(cx)} ${q(h * 0.8)} ${q(cx + rx * 0.86)} ${q(h * 0.62)}`} fill="none" stroke={mix(brass, '#000000', 0.3)} strokeWidth={1.6} />
      <path d={`${ell(cx - rx - 6, rimY + 4, 6, 5)}${ell(cx + rx + 6, rimY + 4, 6, 5)}`} fill="none" stroke={url(id('m'))} strokeWidth={3} />
      <path d={ell(cx, rimY, rx, 7)} fill={url(id('m'))} />
      <path d={ell(cx, rimY + 0.5, rx - 4, 5)} fill={water} />
      <path d={marigolds} fill={haze(FLORA.marigold)} />
      <path d={roses} fill={haze(FLORA.rose)} />
      <path d={buds} fill={hx(p.nature.ivory)} />
      {diyas.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={rimY - 10} r={12} fill={url(id('g'))} />
          <path d={`M${q(x - 6)} ${q(rimY - 2)}q6 6 12 0z`} fill={hx(p.nature.clay)} />
          <path d={`M${q(x)} ${q(rimY - 16)}q4 7 0 13q-4 -6 0 -13z`} fill={hx(p.nature.flame)} />
          <path d={`M${q(x)} ${q(rimY - 11)}q2 4 0 7q-2 -3 0 -7z`} fill={hx(p.nature.flameCore)} />
        </g>
      ))}
    </Svg>
  );
}

/** A brass kuthuvilakku: a domed foot, a turned stem with knops, a five-lipped bowl with five flames, and a lotus-bud finial. Drawn compact (the set's markup budget). */
function Kuthuvilakku(p: DrawProps) {
  const id = idsOf(p, 'kv');
  const { w, h } = p;
  const s = w / 60;
  const cx = w / 2;
  const brass = hx(p.colors.secondary);
  const dark = mix(brass, '#000000', 0.42);
  const Y = (v: number) => q(v * (h / 150));
  const X = (v: number) => q(cx + v * s);
  const body =
    `M${X(-22)} ${Y(150)}q${q(2 * s)} ${Y(-14)} ${q(18 * s)} ${Y(-18)}l${q(1 * s)} ${Y(-88)}l${q(-12 * s)} ${Y(-8)}q${q(-6 * s)} ${Y(-6)} ${q(-8 * s)} ${Y(-2)}h${q(46 * s)}` +
    `q${q(-2 * s)} ${Y(-4)} ${q(-8 * s)} ${Y(2)}l${q(-12 * s)} ${Y(8)}l${q(1 * s)} ${Y(88)}q${q(16 * s)} ${Y(4)} ${q(18 * s)} ${Y(18)}z`;
  const flames = [-18, -9, 0, 9, 18].map((x) => `M${X(x)} ${Y(33)}q${q(3.5 * s)} ${Y(-7)} 0 ${Y(-16)}q${q(-3.5 * s)} ${Y(9)} 0 ${Y(16)}z`).join('');
  return (
    <Svg p={p}>
      <defs>
        <Metal id={id('m')} base={brass} foil x2={w} y2={0} />
      </defs>
      <path d={body} fill={url(id('m'))} stroke={dark} strokeWidth={0.8} />
      <path d={[60, 82, 104].map((y) => `M${X(-5)} ${Y(y)}h${q(10 * s)}`).join('')} stroke={url(id('m'))} strokeWidth={r2(6 * s)} strokeLinecap="round" />
      <path d={`M${X(-1.5)} ${Y(30)}V${Y(10)}`} stroke={url(id('m'))} strokeWidth={r2(3 * s)} />
      <path d={`M${X(0)} ${Y(2)}q${q(5 * s)} ${Y(5)} 0 ${Y(10)}q${q(-5 * s)} ${Y(-5)} 0 ${Y(-10)}z`} fill={url(id('m'))} />
      <path d={`M${X(-22)} ${Y(148)}h${q(44 * s)}`} stroke={dark} strokeWidth={1.2} />
      <path d={flames} fill={hx(p.nature.flame)} />
      <path d={[-18, -9, 0, 9, 18].map((x) => `M${X(x)} ${Y(32)}v${Y(-5)}`).join('')} stroke={hx(p.nature.flameCore)} strokeWidth={r2(2 * s)} strokeLinecap="round" />
    </Svg>
  );
}

/** A banana plant tied at the entrance (as for any auspicious day in the south): a sheathed stem with a marigold tie, broad arching leaves lit on the key-light side, a furled new leaf and a dry one. Drawn compact (the set's markup budget). */
function Banana(p: DrawProps) {
  const { w, h } = p;
  const haze = hazer(p.nature);
  const sx = w / 140;
  const sy = h / 420;
  const right = litRight(p);
  const P = (x: number, y: number) => `${q(x * sx)} ${q(y * sy)}`;
  /** A leaf as a lens about a curved midrib: base b, bend c, tip t, half-width wd (no angles: the normal is a 2D perpendicular). */
  const leaf = (b: Pt, c: Pt, t: Pt, wd: number) => {
    const dx = t[0] - b[0];
    const dy = t[1] - b[1];
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / l) * wd;
    const ny = (dx / l) * wd;
    return `M${P(b[0], b[1])}Q${P(c[0] + nx, c[1] + ny)} ${P(t[0], t[1])}Q${P(c[0] - nx, c[1] - ny)} ${P(b[0], b[1])}z`;
  };
  const rib = (b: Pt, c: Pt, t: Pt) => `M${P(b[0], b[1])}Q${P(c[0], c[1])} ${P(t[0], t[1])}`;
  const top: Pt = [70, 178];
  // [base, bend, tip, half-width, faces the light]
  const leaves: Array<[Pt, Pt, Pt, number, boolean]> = [
    [top, [28, 96], [6, 36], 24, false],
    [top, [112, 92], [134, 22], 24, true],
    [[68, 186], [16, 112], [2, 196], 19, false],
    [[72, 186], [126, 116], [140, 204], 19, true],
  ];
  const litLeaves = leaves.filter((l) => l[4] === right);
  const shadeLeaves = leaves.filter((l) => l[4] !== right);
  const leafPath = (ls: typeof leaves) => ls.map(([b, c, t, wd]) => leaf(b, c, t, wd)).join('');
  // Ragged splits across the blades: short cuts from the edge toward the midrib.
  const splits = leaves.map(([b, c, t]) => [0.35, 0.55, 0.72].map((f) => {
    const o = onCubic([b, c, c, t], f);
    return `M${P(o.x, o.y)}l${q(o.ty * 16 * sx)} ${q(-o.tx * 16 * sy)}`;
  }).join('')).join('');
  return (
    <Svg p={p}>
      <path d={leaf([66, 214], [22, 236], [18, 300], 11)} fill={mix(hx(p.nature.clay), hx(p.nature.leafDark), 0.35)} />
      <path d={`M${P(60, 420)}q${q(-2 * sx)} ${q(-120 * sy)} ${q(4 * sx)} ${q(-240 * sy)}h${q(12 * sx)}q${q(6 * sx)} ${q(120 * sy)} ${q(4 * sx)} ${q(240 * sy)}z`} fill={mix(hx(p.nature.leafLight), hx(p.nature.leaf), 0.45)} />
      <path d={`M${P(right ? 61 : 72, 420)}q0 ${q(-120 * sy)} ${q(4 * sx)} ${q(-240 * sy)}`} stroke={mix(hx(p.nature.leaf), '#000000', 0.15)} strokeWidth={r2(3 * sx)} fill="none" opacity={0.6} />
      <path d={leafPath(shadeLeaves)} fill={hx(p.nature.leafDark)} />
      <path d={leafPath(litLeaves)} fill={hx(p.nature.leaf)} />
      <path d={leaf([70, 182], [74, 100], [62, 8], 8)} fill={hx(p.nature.leafLight)} />
      <path d={leaves.map(([b, c, t]) => rib(b, c, t)).join('')} stroke={hx(p.nature.leafLight)} strokeWidth={r2(2 * sx)} fill="none" />
      <path d={splits} stroke={hx(p.colors.background)} strokeWidth={r2(1.4 * sx)} opacity={0.55} />
      <path d={[300, 312, 324].map((y, i) => `M${P(66 + (i % 2) * 6, y)}h0`).join('')} stroke={haze(FLORA.marigold)} strokeWidth={r2(11 * sx)} strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────── the set ───────────────────────────

export const aangan: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const LAMP = '#ffd98a';
  const DAWN = '#fff0c8';
  const pieces: Piece[] = [];
  const plane = (id: string, art: string, recipe: PlaneRecipe, draw: Draw): void => {
    pieces.push({ kind: 'plane', id, art, role: 'architecture', plane: recipe, draw });
  };

  // Planes: the red-oxide courtyard with its kolam and the veranda walls on both sides.
  plane(
    'floor',
    'floor:redOxide',
    floor({ x0: 250, x1: 950, dNear: 850, dFar: 2650 }),
    drawWith(Floor, {
      variant: 'redOxide',
      kolam: 'center',
      pools: [
        { x: 430, d: 1600, r: 110, color: LAMP },
        { x: 770, d: 1600, r: 110, color: LAMP },
        { x: 700, d: 2150, r: 320, color: DAWN },
        { x: 860, d: 1250, r: 240, color: DAWN },
      ],
    }),
  );
  // The veranda floor under the guest: below the frame at rest, it carries the far poses (the opening's start, the film's close).
  plane('floor-near', 'floor:redOxide', floor({ x0: 250, x1: 950, dNear: 0, dFar: 850 }), drawWith(Floor, { variant: 'redOxide' }));
  plane('wall-l', 'wall:veranda', wall('left', { x: 250, yTop: WALL_TOP, dNear: 0, dFar: 2600 }), dressedWall());
  // The right wall faces away from the low sun: drawn in a cool dawn shadow rather than the kit's darkened stock.
  const shadowed = dressedWall((p) => ({
    light: { ...p.light, from: 'far' },
    colors: { ...p.colors, background: mix(p.colors.background, '#b8c4cc', 0.16), surface: mix(p.colors.surface, '#b8c4cc', 0.2) },
  }));
  plane('wall-r', 'wall:veranda', wall('right', { x: 950, yTop: WALL_TOP, dNear: 0, dFar: 2600 }), shadowed);

  // Far: the far wing closing the courtyard.
  pieces.push({ kind: 'prop', id: 'far-wing', art: 'farWing', role: 'architecture', ...billboard({ x: 600, d: 2640, w: FAR.w, h: FAR.h }), draw: FarWing });

  // Focal: the dais and frame, and the thottil swinging from the beam.
  const dais = billboard({ x: 600, d: 1850, w: DAIS.w, h: DAIS.h });
  pieces.push({ kind: 'prop', id: 'cradle-dais', art: 'cradleDais', role: 'focal', ...dais, draw: CradleDais, buildIn: 'rise' });
  const beamY = 800 - DAIS.h + BEAM_FOOT;
  pieces.push({
    kind: 'prop',
    id: 'thottil',
    art: 'thottil',
    role: 'focal',
    ...hang({ x: 600, d: 1842, w: POST_X[1] - POST_X[0] - 26, h: 270, top: beamY }),
    draw: Thottil,
    motion: { kind: 'sway', amp: 1.6, period: 5 },
    buildIn: 'drop',
  });

  // The corridor: two colonnade bays of teak pillars garlanded capital to capital, the lamps either side of the kolam,
  // banana plants tied at the entrance.
  for (const [i, d] of [
    [0, 1000],
    [1, 1450],
  ] as const)
    pieces.push({ kind: 'prop', id: `bay-${i}`, art: 'pillar:teak', role: 'architecture', ...billboard({ x: 600, d, w: BAY_W, h: PILLAR.h }), draw: Colonnade });
  for (const [k, x] of [
    ['l', 430],
    ['r', 770],
  ] as const) {
    pieces.push({ kind: 'prop', id: `lamp-${k}`, art: 'kuthuvilakku', role: 'prop', ...billboard({ x, d: 1600, w: 60, h: 150 }), draw: Kuthuvilakku, buildIn: 'rise' });
    pieces.push({ kind: 'light', id: `glow-${k}`, art: 'glow', role: 'light', at: { x, y: 660, z: -1599 }, r: 50, color: LAMP, strength: 0.55, motion: { kind: 'flicker', amp: 0.3, period: 1.9, phase: k === 'l' ? 0 : 0.45 }, buildIn: 'light' });
  }
  for (const [k, x] of [
    ['l', 375],
    ['r', 825],
  ] as const)
    pieces.push({ kind: 'prop', id: `banana-${k}`, art: 'bananaPlant', role: 'prop', ...billboard({ x, d: 850, w: 140, h: 420 }), draw: Banana });

  // Near: the tiled eaves overhead and a jasmine festoon tied along its fascia.
  pieces.push({ kind: 'prop', id: 'eaves', art: 'eaves', role: 'hanging', ...hang({ x: 600, d: 620, w: EAVES.w, h: EAVES.h, top: -384 }), draw: Eaves });
  [414, 538, 662, 786].forEach((x, i) =>
    pieces.push({
      kind: 'prop',
      id: `jasmine-${i}`,
      art: 'jasmineSwag',
      role: 'hanging',
      ...hang({ x, d: 560, w: 124, h: 64, top: -56 }),
      draw: JasmineSwag,
      motion: { kind: 'sway', amp: 1.2, period: 6, phase: [0.1, 0.35, 0.6, 0.85][i] },
      buildIn: 'drop',
    }),
  );

  // A brass uruli of floating flowers and diyas on the kolam's centre, between the lamps.
  pieces.push({ kind: 'prop', id: 'uruli', art: 'uruli', role: 'prop', ...billboard({ x: 600, d: 1660, w: URULI.w, h: URULI.h }), draw: Uruli, buildIn: 'bloom' });
  pieces.push({ kind: 'light', id: 'uruli-glow', art: 'glow', role: 'light', at: { x: 600, y: 748, z: -1655 }, r: 60, color: LAMP, strength: 0.4, buildIn: 'light' });

  return {
    name: 'aangan',
    sky: `radial-gradient(circle at 74% 47%, rgba(255, 250, 232, 0.95) 0%, rgba(255, 236, 196, 0.75) 4%, rgba(255, 224, 170, 0.28) 12%, rgba(255, 224, 170, 0) 24%), linear-gradient(180deg, ${mix(mix('#c9dde3', c.background, 0.35), c.primary, 0.06)} 0%, ${mix('#f4ecd8', c.background, 0.4)} 42%, ${mix('#ffe2b8', c.accent, 0.4)} 56%, ${mix(c.surface, c.primary, 0.2)} 100%)`,
    light: { from: 'right', color: DAWN, rim: '#ffffff' },
    fog: { color: '#f4ecd8', near: 1400, far: 3000, max: 0.35 },
    veil: 0.25,
    // Looking up 4°: the cradle's frame clears the words (a tagline included), the eaves stay in the crown band.
    poses: { rest: { x: 600, y: 330, z: 0, yaw: 0, pitch: -4, roll: 0, fov: 60 } },
    focus: { x: 600, y: 620, z: -1850 },
    pieces,
    covers: { gate: 'torana', door: 'temple', silk: 'damask', card: 'patra' },
    particles: { count: 24, dNear: 700, dFar: 2200 },
  };
};
