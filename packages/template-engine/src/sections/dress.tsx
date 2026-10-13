import { useId, type CSSProperties, type ReactNode } from 'react';
import type { IllustrationName, LookName, OrnamentNameValue, ThemeColors, ThemeDress } from '@bulava/template-schema';
import { Illustration, JHAROKHA_OPENING } from '../art/illustrations';
import { PRABHAVALI_OPENING } from '../art/illustrations-regional';
import { Cloud, Kalash, LotusBloom, MarigoldStrand, r2, Toran } from '../art/motifs';
import { Mandala, Ornament } from '../ornaments';
import { Crescent, Lantern, Laurel, Lotus, PeacockFeather, RoseWindow, StarField } from '../ornaments-signature';
import { BaghEmblem, DecoEmblem, Glyph, JaaliEmblem } from '../ornaments-suite';
import { suiteOf, type EdgeName, type FrameShape, type SealName, type Suite } from './suites';

/**
 * The pieces a suite dresses sections in (suites.ts): the rule under a
 * heading, the border along a band's top, corner pieces, the round seal, photo
 * frames, round portraits and the foot of the page. Each is given the
 * section's dress (`d`: the band it sits on, the look, the palette and the
 * suite), so art on a dark or coloured band takes a colour that shows on it.
 * Sections render on the server (no context), so the dress is passed down as
 * a prop. Everything is drawn in code, in the palette.
 */

export type Band = 'plain' | 'surface' | 'primary' | 'accent' | 'deep';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export interface Dress {
  band: Band;
  look: LookName;
  colors: ThemeColors;
  suite: Suite;
}

const FALLBACK: ThemeColors = { primary: '#5c0f1f', secondary: '#c9973f', accent: '#f3d9a4', background: '#fbf4ea', surface: '#fffaf2', text: '#2b1712', muted: '#7a5d52' };

export function dressOf(ornament: OrnamentNameValue | undefined, look: LookName, colors: ThemeColors | undefined, band: Band, own?: ThemeDress): Dress {
  return { band, look, colors: colors ?? FALLBACK, suite: suiteOf(ornament, own) };
}

/** The same dress on another band (a closing band, a card on the page). */
export const onBand = (d: Dress, band: Band): Dress => ({ ...d, band });

/** Is this band dark (the art turns to the accent colour)? Noir pages are dark throughout. */
export const onDark = (d: Pick<Dress, 'band' | 'look'>) => d.band === 'primary' || d.band === 'deep' || (d.look === 'noir' && d.band !== 'accent');

/** The colour metal art takes on this band: gold on paper, the light accent on dark bands, the primary on the accent band. */
export function metalOf(d: Dress): string {
  if (d.band === 'accent') return d.colors.primary;
  return onDark(d) ? d.colors.accent : d.colors.secondary;
}

const art = (name: IllustrationName, d: Dress, w: number, h: number, style?: CSSProperties, foil = d.suite.foil) => (
  <Illustration name={name} color={metalOf(d)} colors={d.colors} foil={foil} w={w} h={h} style={{ display: 'block', ...style }} />
);

// ─────────────────────────── The rule under a heading ───────────────────────────

const Rule = ({ className }: { className?: string }) => <span className={`block h-px bg-current opacity-60 ${className ?? 'w-14 @min-[640px]:w-20'}`} />;

export function SuiteDivider({ d, className }: { d: Dress; className?: string }) {
  const { suite } = d;
  const wrap = (children: ReactNode) => (
    <div aria-hidden="true" className={`flex items-center justify-center gap-3 text-[var(--t-orn)] ${className ?? ''}`}>
      {children}
    </div>
  );
  switch (suite.divider) {
    case 'flourish':
      return (
        <div aria-hidden="true" className={`mx-auto w-44 @min-[640px]:w-56 ${className ?? ''}`}>
          {art('flourish', d, 300, 60, { width: '100%', height: 'auto' })}
        </div>
      );
    case 'triple':
      return wrap(
        <>
          <Rule />
          <Glyph name={suite.glyph} className="size-3 opacity-70" />
          <Glyph name={suite.glyph} className="size-5" />
          <Glyph name={suite.glyph} className="size-3 opacity-70" />
          <Rule />
        </>,
      );
    case 'rule':
      return wrap(
        <>
          <span className="flex flex-col items-end gap-[3px]">
            <Rule className="w-16 @min-[640px]:w-24" />
            <Rule className="w-10 @min-[640px]:w-16" />
            <Rule className="w-5 @min-[640px]:w-8" />
          </span>
          <Glyph name={suite.glyph} className="size-6" />
          <span className="flex flex-col items-start gap-[3px]">
            <Rule className="w-16 @min-[640px]:w-24" />
            <Rule className="w-10 @min-[640px]:w-16" />
            <Rule className="w-5 @min-[640px]:w-8" />
          </span>
        </>,
      );
    case 'laurel':
      return wrap(
        <>
          <Rule />
          <Laurel className="h-6 w-7" />
          <Rule />
        </>,
      );
    case 'lotus':
      return wrap(
        <>
          <Rule />
          <Lotus className="h-5 w-9" />
          <Rule />
        </>,
      );
    default:
      return wrap(
        <>
          <Rule />
          <Glyph name={suite.glyph} className="size-[18px]" />
          <Rule />
        </>,
      );
  }
}

// ─────────────────────────── Borders along a band's top ───────────────────────────

/** How tall each border is (px); swags that hang push the heading down by it. */
export const EDGE_HEIGHT: Record<EdgeName, number> = {
  toran: 84,
  marigoldSwag: 92,
  floralGarland: 72,
  bunting: 62,
  fairyLights: 54,
  templeBorder: 24,
  zariBand: 30,
  laalPaar: 34,
  phulkari: 30,
  arches: 26,
  lancets: 28,
  deco: 16,
  scallop: 0,
  bandhani: 14,
  none: 0,
};

/** Borders that hang over the band (the heading starts below them); the others are a strip along its edge. */
export const SWAG_EDGES = new Set<EdgeName>(['toran', 'marigoldSwag', 'floralGarland', 'bunting', 'fairyLights']);

const strip = (children: ReactNode, top = 0) => (
  <div className="pointer-events-none absolute inset-x-0 flex justify-center overflow-hidden" style={{ top }} aria-hidden="true">
    {children}
  </div>
);

/** A repeating line pattern 1560 px wide (wider than any page), centred and cut by the band. */
function PatternStrip({ tile, h, body }: { tile: number; h: number; body: ReactNode }) {
  const id = `e${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width="1560" height={h} viewBox={`0 0 1560 ${h}`} style={{ flex: 'none', display: 'block' }}>
      <defs>
        <pattern id={id} width={tile} height={h} patternUnits="userSpaceOnUse" x={780 % tile}>
          {body}
        </pattern>
      </defs>
      <rect width="1560" height={h} fill={`url(#${id})`} />
    </svg>
  );
}

export function SuiteEdge({ d, name, bottom = false }: { d: Dress; name: EdgeName; bottom?: boolean }) {
  if (name === 'none') return null;
  const flip: CSSProperties = bottom ? { transform: 'scaleY(-1)' } : {};
  const wide = (illo: IllustrationName, h: number) => strip(<div style={{ flex: 'none', ...flip }}>{art(illo, d, 1560, h, { width: 1560, height: h })}</div>);
  const line = (tile: number, h: number, body: ReactNode) =>
    strip(
      <div className="text-[var(--t-orn)]" style={flip}>
        <PatternStrip tile={tile} h={h} body={body} />
      </div>,
    );
  switch (name) {
    case 'toran':
      return strip(
        <div className="flex" style={{ flex: 'none', ...flip }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Toran key={i} swags={3} bells={i % 2 === 0} style={{ width: 280, height: 84, flex: 'none', display: 'block' }} />
          ))}
        </div>,
      );
    case 'marigoldSwag':
      return wide('marigoldSwag', EDGE_HEIGHT.marigoldSwag);
    case 'floralGarland':
      return wide('floralGarland', EDGE_HEIGHT.floralGarland);
    case 'bunting':
      return wide('bunting', EDGE_HEIGHT.bunting);
    case 'fairyLights':
      return wide('fairyLights', EDGE_HEIGHT.fairyLights);
    case 'zariBand':
      return wide('zariBand', EDGE_HEIGHT.zariBand);
    case 'laalPaar':
      return wide('laalPaar', EDGE_HEIGHT.laalPaar);
    case 'phulkari':
      return wide('phulkari', EDGE_HEIGHT.phulkari);
    case 'templeBorder':
      return line(
        36,
        24,
        <g fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M0 22 V14 H6 V8 H11 L18 2 L25 8 H30 V14 H36 V22" />
          <path d="M15 22 V16 A3 3 0 0 1 21 16 V22" opacity="0.7" />
          <path d="M0 23 H36" />
        </g>,
      );
    case 'arches':
      return line(
        34,
        26,
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M3 25 V15 C3 10 9 7 17 3 C25 7 31 10 31 15 V25" />
          <path d="M8 25 V16 C8 13 12 10 17 8 C22 10 26 13 26 16 V25" opacity="0.55" />
          <circle cx="17" cy="1.6" r="1.4" fill="currentColor" stroke="none" />
          <path d="M0 25.4 H34" />
        </g>,
      );
    case 'lancets':
      return line(
        30,
        28,
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M4 27 V15 Q4 7 15 1.5 Q26 7 26 15 V27" />
          <path d="M9 27 V16 Q9 10.5 15 7 Q21 10.5 21 16 V27" opacity="0.55" />
          <circle cx="15" cy="18.5" r="2.2" opacity="0.7" />
          <path d="M0 27.4 H30" />
        </g>,
      );
    case 'deco':
      return line(
        28,
        16,
        <g fill="none" stroke="currentColor" strokeWidth="1.1">
          <path d="M0 3 H28 M0 13 H28" />
          <path d="M6 13 L14 5 L22 13" />
          <path d="M10 13 L14 9 L18 13" opacity="0.6" />
        </g>,
      );
    case 'bandhani':
      return line(
        18,
        14,
        <g fill="currentColor">
          <circle cx="4.5" cy="4" r="1.6" />
          <circle cx="13.5" cy="10" r="1.6" />
          <circle cx="9" cy="7" r="0.9" opacity="0.6" />
        </g>,
      );
    case 'scallop':
      // Soft scallops rising from the band into the one above: a cloud's edge.
      return (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-[13px] h-[14px]"
          style={{ background: 'radial-gradient(circle at 14px 14px, var(--t-band) 13px, transparent 13.6px) 0 0 / 28px 14px repeat-x' }}
        />
      );
    default:
      return null;
  }
}

// ─────────────────────────── Corners ───────────────────────────

function DecoCorner({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M4 76 V4 H76" />
        <path d="M12 76 V20 H20 V12 H76" opacity="0.75" />
        <path d="M20 76 V28 H28 V20 H76" opacity="0.5" />
        <path d="M4 4 L22 22" />
        <circle cx="26" cy="26" r="2.6" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Mirrored pieces in the top corners of a band (and the bottom ones of a framed panel). */
export function SuiteCorners({ d, bottom = false, inset = 0, size = 'md' }: { d: Dress; bottom?: boolean; inset?: number; size?: 'sm' | 'md' }) {
  const corner = d.suite.corner;
  if (corner === 'none') return null;
  const px = size === 'sm' ? 'w-14 @min-[640px]:w-20' : 'w-20 @min-[640px]:w-28';
  const piece = (side: 'l' | 'r', vertical: 'top' | 'bottom') => {
    const sx = side === 'r' ? -1 : 1;
    const sy = vertical === 'bottom' ? -1 : 1;
    const pos: CSSProperties = { [vertical]: inset, [side === 'l' ? 'left' : 'right']: inset, transform: `scale(${sx}, ${sy})` };
    let body: ReactNode;
    if (corner === 'peacockFeather') body = <PeacockFeather className="h-full w-full -rotate-[38deg]" />;
    else if (corner === 'decoCorner') body = <DecoCorner className="h-full w-full" />;
    else if (corner === 'paisleyOrnate') body = art('paisleyOrnate', d, 160, 222, { width: '70%', height: 'auto', transform: 'rotate(-38deg) translate(-8%, -6%)' });
    else if (corner === 'roseCluster') body = art('roseCluster', d, 320, 270, { width: '120%', height: 'auto', transform: 'translate(-26%, -30%)' });
    else body = art(corner, d, 200, 200, { width: '100%', height: 'auto' });
    return (
      <div key={`${side}${vertical}`} aria-hidden="true" className={`pointer-events-none absolute text-[var(--t-orn)] ${px} ${corner === 'peacockFeather' ? 'aspect-[1/1.6] opacity-70' : 'aspect-square'}`} style={pos}>
        {body}
      </div>
    );
  };
  return (
    <>
      {piece('l', 'top')}
      {piece('r', 'top')}
      {bottom ? (
        <>
          {piece('l', 'bottom')}
          {piece('r', 'bottom')}
        </>
      ) : null}
    </>
  );
}

// ─────────────────────────── Seals ───────────────────────────

/** Two rings: the emblem seal's border and a crest's. */
function Rings({ inner = true }: { inner?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="94" strokeWidth="1.5" />
        {inner ? <circle cx="100" cy="100" r="86" strokeWidth="0.7" opacity="0.6" /> : null}
      </g>
    </svg>
  );
}

const SUN_RAYS = Array.from({ length: 32 }, (_, i) => {
  const a = ((i * 360) / 32 - 90) * (Math.PI / 180);
  const r1 = i % 2 ? 58 : 50;
  return `M${r2(100 + r1 * Math.cos(a))} ${r2(100 + r1 * Math.sin(a))} L${r2(100 + 92 * Math.cos(a))} ${r2(100 + 92 * Math.sin(a))}`;
}).join(' ');

function SunburstSeal() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <path d={SUN_RAYS} strokeWidth="1.1" opacity="0.8" />
        <circle cx="100" cy="100" r="96" strokeWidth="1.4" />
        <circle cx="100" cy="100" r="46" strokeWidth="1.4" />
        <circle cx="100" cy="100" r="40" strokeWidth="0.7" opacity="0.6" />
      </g>
    </svg>
  );
}

const MOON_STARS = [
  [34, 40, 7],
  [164, 52, 5],
  [150, 168, 6],
  [40, 154, 4],
] as const;

const star4 = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${r2(x + r * 0.28)} ${r2(y - r * 0.28)} L${x + r} ${y} L${r2(x + r * 0.28)} ${r2(y + r * 0.28)} L${x} ${y + r} L${r2(x - r * 0.28)} ${r2(y + r * 0.28)} L${x - r} ${y} L${r2(x - r * 0.28)} ${r2(y - r * 0.28)}Z`;

function MoonSeal() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="100" cy="100" r="64" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 5" strokeLinecap="round" />
      {MOON_STARS.map(([x, y, r]) => (
        <path key={`${x}${y}`} d={star4(x, y, r)} fill="currentColor" />
      ))}
    </svg>
  );
}

const STICKER = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 48; i++) {
    const a = ((i * 360) / 48 - 90) * (Math.PI / 180);
    const r = i % 2 ? 88 : 96;
    pts.push(`${r2(100 + r * Math.cos(a))} ${r2(100 + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')}Z`;
})();

function StickerSeal({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <path d={STICKER} fill={fill} />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.6" strokeDasharray="4 5" />
    </svg>
  );
}

/** Seals drawn as a ring of art: they read well around a round photo (RoundPortrait's halo). */
const HALO_SEALS = new Set<SealName>(['medallion', 'marigoldWreath', 'botanicalWreath', 'alpana', 'arabesque', 'sunburst', 'mandala', 'jaali', 'phulkari', 'kolam', 'rangoliBloom', 'crest', 'moon', 'sticker', 'roseWindow']);

/**
 * The suite's round seal at a size, with children (initials, a number, an
 * icon) centred over it. Light enough to set words on: busy art fades behind them.
 */
export function Seal({ d, className, children, quiet = false }: { d: Dress; className?: string; children?: ReactNode; quiet?: boolean }) {
  const seal = d.suite.seal;
  const behind = quiet || !!children;
  let body: ReactNode;
  switch (seal) {
    case 'emblem':
      body = (
        <>
          <Rings />
          <div className="absolute inset-[19%]" style={{ opacity: behind ? 0.22 : 1 }}>
            <Ornament name={d.suite.name} className="h-full w-full" />
          </div>
        </>
      );
      break;
    case 'roseWindow':
      body = <RoseWindow className="absolute inset-0 h-full w-full" style={{ opacity: behind ? 0.3 : 1 }} />;
      break;
    case 'mandala':
      body = <Mandala className="absolute inset-0 h-full w-full" style={{ opacity: behind ? 0.45 : 1 }} />;
      break;
    case 'jaali':
      body = <JaaliEmblem className="absolute inset-0 h-full w-full" style={{ opacity: behind ? 0.4 : 1 }} />;
      break;
    case 'phulkari':
      body = <BaghEmblem className="absolute inset-0 h-full w-full" style={{ opacity: behind ? 0.35 : 1 }} />;
      break;
    case 'crest':
      body = (
        <>
          <Rings />
          <Laurel className="absolute inset-x-[14%] bottom-[5%] h-auto w-[72%]" style={{ opacity: behind ? 0.7 : 1 }} />
        </>
      );
      break;
    case 'sunburst':
      body = <SunburstSeal />;
      break;
    case 'moon':
      body = <MoonSeal />;
      break;
    case 'sticker':
      body = <StickerSeal fill={d.colors.accent} />;
      break;
    default:
      body = <div className="absolute inset-0" style={{ opacity: behind ? 0.3 : 1 }}>{art(seal, d, 200, 200, { width: '100%', height: '100%' })}</div>;
  }
  return (
    <div className={`relative flex aspect-square items-center justify-center text-[var(--t-orn)] ${className ?? ''}`}>
      {body}
      {children ? <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}

/** The suite's glyph on a small disc of the band's colour, hung on the top of a ring like a pendant. */
export function Pendant({ d, className }: { d: Dress; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('absolute top-0 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[var(--t-orn)]', className)} style={{ background: 'var(--t-band, var(--t-bg))' }}>
      <Glyph name={d.suite.glyph} className="size-[18px]" />
    </span>
  );
}

const PHOTO_GROUND: CSSProperties = { background: 'linear-gradient(160deg, var(--t-accent), var(--t-primary))' };

/**
 * A round portrait: the photo (or, until the host adds one, the fallback) in a
 * double ring of the band's metal, with the suite's seal as a halo behind it
 * when the seal is a ring of art, else the suite's glyph hung on the ring.
 */
export function RoundPortrait({ d, src, alt, fallback, className, halo = true, pendant = true }: { d: Dress; src?: string; alt: string; fallback?: ReactNode; className?: string; halo?: boolean; pendant?: boolean }) {
  const withHalo = halo && HALO_SEALS.has(d.suite.seal);
  const metal = metalOf(d);
  return (
    <div className={cx('relative aspect-square', className)}>
      {withHalo ? <Seal d={d} className="absolute inset-0 h-full w-full" /> : null}
      <div
        className={cx('absolute overflow-hidden rounded-full', withHalo ? 'inset-[16%]' : 'inset-[6%]')}
        style={{ ...PHOTO_GROUND, boxShadow: `0 0 0 2px ${metal}, 0 0 0 6px var(--t-band, var(--t-bg)), 0 0 0 7px ${metal}, 0 18px 30px -14px rgba(0,0,0,0.55)` }}
      >
        {src ? <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center">{fallback}</span>}
      </div>
      {withHalo || !pendant ? null : <Pendant d={d} className="top-[6%]" />}
    </div>
  );
}

// ─────────────────────────── Photo frames ───────────────────────────

/** Width ÷ height of each frame. */
export const FRAME_ASPECT: Record<FrameShape, string> = {
  jharokha: '300 / 440',
  niche: '300 / 420',
  mihrab: '300 / 430',
  lancet: '3 / 4.3',
  arch: '3 / 4',
  oval: '3 / 4',
  circle: '1 / 1',
  scallop: '1 / 1',
  ticket: '4 / 5',
  deco: '3 / 4',
  double: '3 / 4',
  cloud: '1 / 1',
  rounded: '4 / 5',
};

const SCALLOP_MASK = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = ((i * 360) / 96) * (Math.PI / 180);
    const r = 46 + 3.2 * Math.cos(a * 16);
    pts.push(`${r2(50 + r * Math.cos(a))} ${r2(50 + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')}Z`;
})();
const CLOUD_MASK = 'M24 88 C10 88 2 76 8 64 C0 52 8 36 24 38 C24 20 44 10 58 20 C66 8 88 10 92 28 C100 34 100 48 94 56 C102 66 98 82 84 86 C80 92 70 94 64 88 C56 96 40 96 34 88Z';
const MIHRAB_MASK = 'M0 100 V46 C0 30 22 16 50 0 C78 16 100 30 100 46 V100Z';
const LANCET_MASK = 'M0 100 V42 Q0 15 50 0 Q100 15 100 42 V100Z';
const DECO_MASK = 'M14 0 H86 L100 12 V88 L86 100 H14 L0 88 V12Z';

const svgMask = (path: string, view = '0 0 100 100'): CSSProperties => {
  const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${view}' preserveAspectRatio='none'><path d='${path}'/></svg>`)}")`;
  return { WebkitMaskImage: url, maskImage: url, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' };
};

/** The opening's shape for each frame (what the photo is cut to). */
function openingStyle(shape: FrameShape): CSSProperties {
  switch (shape) {
    case 'jharokha':
    case 'niche':
    case 'arch':
      return { borderRadius: '50% 50% 0 0 / 34% 34% 0 0' };
    case 'mihrab':
      return svgMask(MIHRAB_MASK);
    case 'lancet':
      return svgMask(LANCET_MASK);
    case 'oval':
    case 'circle':
      return { borderRadius: '50%' };
    case 'scallop':
      return svgMask(SCALLOP_MASK);
    case 'cloud':
      return svgMask(CLOUD_MASK);
    case 'deco':
      return svgMask(DECO_MASK);
    case 'ticket':
      return {
        WebkitMaskImage: 'radial-gradient(circle at 0 50%, transparent 12px, #000 12.5px), radial-gradient(circle at 100% 50%, transparent 12px, #000 12.5px)',
        maskImage: 'radial-gradient(circle at 0 50%, transparent 12px, #000 12.5px), radial-gradient(circle at 100% 50%, transparent 12px, #000 12.5px)',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
        borderRadius: 10,
      };
    case 'double':
      return { borderRadius: 2 };
    default:
      return { borderRadius: 'calc(var(--t-radius) * 1.2)' };
  }
}

/** An outline that follows the opening (drawn over the photo's edge). */
function Outline({ shape }: { shape: FrameShape }) {
  const common = { fill: 'none', stroke: 'currentColor', vectorEffect: 'non-scaling-stroke' as const };
  const svg = (children: ReactNode, inset = '-4%') => (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute" style={{ inset }} aria-hidden="true">
      {children}
    </svg>
  );
  switch (shape) {
    case 'arch':
      return svg(
        <>
          <path d="M0 100 V34 A50 34 0 0 1 100 34 V100Z" {...common} strokeWidth="1.6" />
          <path d="M4 100 V35 A46 31 0 0 1 96 35 V100" {...common} strokeWidth="0.8" opacity="0.6" />
        </>,
      );
    case 'mihrab':
      return svg(
        <>
          <path d={MIHRAB_MASK} {...common} strokeWidth="1.6" />
          <path d="M5 100 V47 C5 33 25 20 50 6 C75 20 95 33 95 47 V100" {...common} strokeWidth="0.8" opacity="0.6" />
        </>,
      );
    case 'lancet':
      return svg(
        <>
          <path d={LANCET_MASK} {...common} strokeWidth="1.6" />
          <path d="M5 100 V43 Q5 19 50 5.5 Q95 19 95 43 V100" {...common} strokeWidth="0.8" opacity="0.6" />
        </>,
      );
    case 'oval':
    case 'circle':
      return svg(
        <>
          <ellipse cx="50" cy="50" rx="50" ry="50" {...common} strokeWidth="1.6" />
          <ellipse cx="50" cy="50" rx="46" ry="46" {...common} strokeWidth="0.8" opacity="0.6" />
        </>,
      );
    case 'scallop':
      return svg(<path d={SCALLOP_MASK} {...common} strokeWidth="1.6" />, '-5%');
    case 'cloud':
      return svg(<path d={CLOUD_MASK} {...common} strokeWidth="1.6" />, '-5%');
    case 'deco':
      return svg(
        <>
          <path d={DECO_MASK} {...common} strokeWidth="1.6" />
          <path d="M16 4 H84 L96 14 V86 L84 96 H16 L4 86 V14Z" {...common} strokeWidth="0.8" opacity="0.6" />
        </>,
      );
    case 'double':
      return svg(
        <>
          <rect x="0" y="0" width="100" height="100" {...common} strokeWidth="1.4" />
          <rect x="3.5" y="3" width="93" height="94" {...common} strokeWidth="0.7" opacity="0.7" />
        </>,
        '-6%',
      );
    case 'ticket':
      return null;
    default:
      return svg(<rect x="0" y="0" width="100" height="100" rx="8" {...common} strokeWidth="1.4" />, '-3%');
  }
}

/**
 * A photo (or, until the host adds one, the fallback) in the suite's frame: a
 * jharokha window, a temple prabhavali, a mihrab, a lancet, an arch, an oval,
 * a scalloped round, a ticket… The frame keeps its proportions.
 */
export function PhotoFrame({ d, shape, src, alt, fallback, className, tilt }: { d: Dress; shape?: FrameShape; src?: string; alt: string; fallback?: ReactNode; className?: string; tilt?: boolean }) {
  const frame = shape ?? d.suite.frame;
  const inner = src ? <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center">{fallback}</div>;
  if (frame === 'jharokha' || frame === 'niche') {
    const o = frame === 'jharokha' ? JHAROKHA_OPENING : PRABHAVALI_OPENING;
    return (
      <div className={cx('relative', tilt && 'bulava-tilt', className)} style={{ aspectRatio: FRAME_ASPECT[frame] }}>
        <div className="absolute overflow-hidden" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%`, ...PHOTO_GROUND, ...openingStyle(frame) }}>
          {inner}
        </div>
        <div className="pointer-events-none absolute inset-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]">{art(frame === 'jharokha' ? 'jharokha' : 'prabhavali', d, 300, frame === 'jharokha' ? 440 : 420, { width: '100%', height: '100%' })}</div>
      </div>
    );
  }
  if (frame === 'mihrab') {
    return (
      <div className={cx('relative', tilt && 'bulava-tilt', className)} style={{ aspectRatio: FRAME_ASPECT.mihrab }}>
        <div className="absolute overflow-hidden" style={{ left: '9%', top: '11%', width: '82%', height: '84%', ...PHOTO_GROUND, ...openingStyle('mihrab') }}>
          {inner}
        </div>
        <div className="pointer-events-none absolute inset-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.22)]">{art('mihrab', d, 300, 430, { width: '100%', height: '100%' })}</div>
      </div>
    );
  }
  return (
    <div className={cx('relative', tilt && 'bulava-tilt', className)} style={{ aspectRatio: FRAME_ASPECT[frame] }}>
      <div className="absolute inset-0 overflow-hidden shadow-[0_18px_34px_-22px_rgba(0,0,0,0.55)]" style={{ ...PHOTO_GROUND, ...openingStyle(frame) }}>
        {inner}
      </div>
      <div className="pointer-events-none absolute inset-0 text-[var(--t-orn)]">
        <Outline shape={frame} />
      </div>
    </div>
  );
}

// ─────────────────────────── Shaped cards ───────────────────────────

const CUT = 'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)';

/**
 * A card of any height in the suite's frame: an arched panel (jharokha, niche,
 * arch), an arch with a pointed finial (mihrab, lancet), stepped corners
 * (deco), a double rule, a ticket with notches, a soft pill (oval, circle,
 * cloud)… `fill` is the card's own colour (the look's card by default).
 */
export function ShapedCard({ d, shape, className, children, fill = 'var(--t-card)' }: { d: Dress; shape?: FrameShape; className?: string; children: ReactNode; fill?: string }) {
  const frame = shape ?? d.suite.frame;
  const pad = className ?? 'px-6 py-8';
  switch (frame) {
    case 'jharokha':
    case 'niche':
    case 'arch':
    case 'mihrab':
    case 'lancet': {
      const radius: CSSProperties = { borderTopLeftRadius: '50% 72px', borderTopRightRadius: '50% 72px' };
      return (
        <div className="relative pt-3">
          {frame === 'mihrab' || frame === 'lancet' ? <span aria-hidden="true" className="absolute top-0 left-1/2 z-10 size-3 -translate-x-1/2 rotate-45 border border-[var(--t-orn)]" style={{ background: fill }} /> : null}
          <div className={cx('relative border border-[var(--t-line)] shadow-[0_18px_36px_-26px_rgba(0,0,0,0.55)]', pad)} style={{ ...radius, background: fill }}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-1.5 border border-[var(--t-line)] opacity-70" style={{ borderTopLeftRadius: '50% 66px', borderTopRightRadius: '50% 66px' }} />
            <div className="relative">{children}</div>
          </div>
        </div>
      );
    }
    case 'deco':
      // The stepped outline is the metal showing round the card: the card's own fill (glass on dark bands) is laid over the band's colour, so the metal never shows through it.
      return (
        <div className="relative bg-[var(--t-orn)] p-px shadow-[0_18px_36px_-26px_rgba(0,0,0,0.55)]" style={{ clipPath: CUT }}>
          <div className={cx('relative', pad)} style={{ clipPath: CUT, backgroundColor: 'var(--t-band, var(--t-bg))', backgroundImage: `linear-gradient(${fill}, ${fill})` }}>
            {children}
          </div>
        </div>
      );
    case 'double':
      return (
        <div className={cx('relative border border-[var(--t-orn)] shadow-sm', pad)} style={{ background: fill }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-1.5 border border-[var(--t-line)]" />
          <div className="relative">{children}</div>
        </div>
      );
    case 'ticket':
      return (
        <div className={cx('relative', pad)} style={{ background: fill, ...openingStyle('ticket'), borderRadius: 14 }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-1/2 border-t border-dashed border-[var(--t-line)] opacity-0" />
          {children}
        </div>
      );
    case 'scallop':
      return (
        <div className={cx('relative mt-3 rounded-b-[1.6rem] border border-[var(--t-line)] shadow-[0_18px_36px_-26px_rgba(0,0,0,0.5)]', pad)} style={{ background: fill }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-[11px] h-3" style={{ background: `radial-gradient(circle at 12px 12px, ${fill} 10.5px, var(--t-line) 11px, transparent 11.6px) 0 0 / 24px 12px repeat-x` }} />
          <div className="relative">{children}</div>
        </div>
      );
    case 'oval':
    case 'circle':
    case 'cloud':
      return (
        <div className={cx('relative rounded-[2.4rem] border border-[var(--t-line)] shadow-[0_18px_36px_-26px_rgba(0,0,0,0.45)]', pad)} style={{ background: fill }}>
          {children}
        </div>
      );
    default:
      return (
        <div className={cx('relative rounded-[var(--t-radius)] border border-[var(--t-line)] shadow-sm', pad)} style={{ background: fill }}>
          {children}
        </div>
      );
  }
}

// ─────────────────────────── The foot of the page ───────────────────────────

const pair = (left: ReactNode, right: ReactNode, className = 'items-end justify-between') => (
  <div className={`pointer-events-none flex ${className}`} aria-hidden="true">
    <div>{left}</div>
    <div style={{ transform: 'scaleX(-1)' }}>{right}</div>
  </div>
);

/** The art along the foot of the closing band: the suite's skyline, its lamps, its pair of animals or flowers. */
export function Skyline({ d, className }: { d: Dress; className?: string }) {
  const sky = d.suite.skyline;
  const box = (children: ReactNode) => (
    <div aria-hidden="true" className={`pointer-events-none mx-auto w-full ${className ?? ''}`}>
      {children}
    </div>
  );
  const twin = (name: IllustrationName, w: number, h: number, width: string, gap: string, foil = false) =>
    box(pair(<div className={width}>{art(name, d, w, h, { width: '100%', height: 'auto' }, foil)}</div>, <div className={width}>{art(name, d, w, h, { width: '100%', height: 'auto' }, foil)}</div>, `items-end justify-center ${gap}`));
  switch (sky) {
    case 'domes':
      return box(<div className="mx-auto w-72 @min-[640px]:w-[26rem]">{art('domes', d, 400, 232, { width: '100%', height: 'auto' })}</div>);
    case 'diyaRow':
      return box(<div className="mx-auto w-64 @min-[640px]:w-80">{art('diyaRow', d, 400, 110, { width: '100%', height: 'auto' }, false)}</div>);
    case 'lamps':
      return twin('kuthuvilakku', 120, 300, 'w-14 @min-[640px]:w-20', 'gap-44 @min-[640px]:gap-80', d.suite.foil);
    case 'peacocks':
      return twin('royalPeacock', 320, 400, 'w-28 @min-[640px]:w-40', 'gap-16 @min-[640px]:gap-56');
    case 'elephants':
      return twin('elephant', 350, 280, 'w-28 @min-[640px]:w-40', 'gap-14 @min-[640px]:gap-56');
    case 'doves':
      return box(<div className="mx-auto w-36 @min-[640px]:w-48">{art('doves', d, 300, 200, { width: '100%', height: 'auto' }, false)}</div>);
    case 'roses':
      return box(
        pair(
          <div className="w-32 -scale-y-100 @min-[640px]:w-48">{art('roseCluster', d, 320, 270, { width: '100%', height: 'auto' }, false)}</div>,
          <div className="w-32 -scale-y-100 @min-[640px]:w-48">{art('roseCluster', d, 320, 270, { width: '100%', height: 'auto' }, false)}</div>,
        ),
      );
    case 'balloons':
      return box(
        <div className="flex items-end justify-center gap-4">
          <div className="w-20 @min-[640px]:w-28">{art('balloonBunch', d, 270, 350, { width: '100%', height: 'auto' }, false)}</div>
          <div className="w-16 @min-[640px]:w-20">{art('giftBox', d, 200, 200, { width: '100%', height: 'auto' }, false)}</div>
          <div className="w-20 -scale-x-100 @min-[640px]:w-28">{art('balloonBunch', d, 270, 350, { width: '100%', height: 'auto' }, false)}</div>
        </div>,
      );
    case 'kalash':
      return box(pair(<Kalash className="w-14 @min-[640px]:w-20" />, <Kalash className="w-14 @min-[640px]:w-20" />, 'items-end justify-center gap-44 @min-[640px]:gap-80'));
    case 'lanterns':
      return box(
        <div className="flex items-start justify-center gap-10 text-[var(--t-orn)]">
          {[0, 1, 2].map((i) => (
            <Lantern key={i} className="w-10" style={{ marginTop: i === 1 ? 24 : 0 }} />
          ))}
        </div>,
      );
    case 'lotuses':
      return box(
        <svg viewBox="0 0 360 70" className="mx-auto w-72 @min-[640px]:w-96" aria-hidden="true">
          <path d="M0 62 Q180 52 360 62" fill="none" stroke="var(--t-orn)" strokeWidth="1" opacity="0.6" />
          <LotusBloom x={70} y={58} size={0.55} tinted />
          <LotusBloom x={180} y={56} size={0.75} tinted />
          <LotusBloom x={290} y={58} size={0.55} tinted />
        </svg>,
      );
    case 'clouds':
      return box(
        <svg viewBox="0 0 360 90" className="mx-auto w-80 @min-[640px]:w-[28rem]" aria-hidden="true">
          <g fill="var(--t-card-alt, #fff)" opacity="0.95">
            <Cloud x={20} y={40} w={150} opacity={0.9} />
            <Cloud x={190} y={46} w={150} opacity={0.9} />
            <Cloud x={110} y={52} w={140} opacity={1} />
          </g>
        </svg>,
      );
    case 'moonrise':
      return box(
        <div className="relative mx-auto h-24 w-72 text-[var(--t-orn)] @min-[640px]:w-96">
          <StarField className="absolute inset-0 h-full w-full opacity-80" count={14} />
          <Crescent className="absolute top-1 left-1/2 w-14 -translate-x-1/2" />
        </div>,
      );
    case 'sunburst':
      return box(
        <div className="mx-auto w-40 text-[var(--t-orn)] opacity-80 @min-[640px]:w-52">
          <DecoEmblem className="h-auto w-full" />
        </div>,
      );
    case 'phulkari':
      return box(
        <div className="flex items-end justify-center gap-6 text-[var(--t-orn)]">
          {[0, 1, 2].map((i) => (
            <BaghEmblem key={i} className={i === 1 ? 'w-16' : 'w-10 opacity-70'} />
          ))}
        </div>,
      );
    default:
      return null;
  }
}

/** Strands hanging down both sides of a band (marigolds, jasmine, ghungroo, lanterns). */
export function Hangings({ d }: { d: Dress }) {
  const hang = d.suite.hang;
  if (!hang) return null;
  const strand = (side: 'left' | 'right', long: boolean) => {
    const pos: CSSProperties = { [side]: long ? 18 : 46 };
    let body: ReactNode;
    if (hang === 'marigoldStrand') body = <MarigoldStrand count={long ? 9 : 6} style={{ width: 22, height: 'auto', display: 'block' }} />;
    else if (hang === 'lantern') body = <Lantern className="w-9 text-[var(--t-orn)]" style={{ height: 'auto' }} />;
    else body = art(hang, d, 28, long ? 200 : 140, { width: 22, height: long ? 160 : 112 }, false);
    return (
      <div key={`${side}${long}`} aria-hidden="true" className="bulava-sway pointer-events-none absolute top-0" style={pos}>
        {body}
      </div>
    );
  };
  return (
    <>
      {strand('left', true)}
      {strand('left', false)}
      {strand('right', true)}
      {strand('right', false)}
    </>
  );
}
