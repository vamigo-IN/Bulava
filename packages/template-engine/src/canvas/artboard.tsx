import type { CSSProperties, ReactNode } from 'react';
import type { Translator } from '@bulava/localization';
import {
  ILLUSTRATIONS,
  layerBackdrop,
  resolveBinding,
  resolveValue,
  type Artboard,
  type Fonts,
  type IconLayer,
  type IllustrationName,
  type ImageLayer,
  type Layer,
  type OrnamentLayer,
  type RenderContext,
  type SceneLayer,
  type ShapeLayer,
  type TextLayer,
  type ThemeColors,
  type WidgetLayer,
} from '@bulava/template-schema';
import { Illustration } from '../art/illustrations';
import { foilCss, hex, metalStops, useSafeId } from '../art/kit';
import { Diya, Kalash, MarigoldStrand, r2, Toran } from '../art/motifs';
import { artworkAssetUrl, sceneArt } from '../art/scenes';
import { ArchFrame, Ornament, TempleBorder, type OrnamentName } from '../ornaments';
import { Crescent, CrestFrame, GateLeaf, GothicArch, Lantern, PeacockFeather, RoseWindow, SeaWaves } from '../ornaments-signature';
import type { RenderMode, RenderSlots } from '../types';
import { fillBackdrop, fillStyle, fontFamilyFor, resolveColor, solidHex, textInk, textureStyle } from './colors';
import { FitText } from './fit-text';
import { Icon } from './icons';
import { calendarUrl } from './links';
import { CanvasCountdown } from './widgets';

/** The editor renders artboards too, with handles over them. */
export type ArtboardMode = RenderMode | 'edit';

export interface CanvasArtboardProps {
  board: Artboard;
  ctx: RenderContext;
  colors: ThemeColors;
  /** Accepted for symmetry with the renderer; roles resolve through the theme's CSS variables. */
  fonts?: Fonts;
  t: Translator;
  language: string;
  timeZone: string;
  mode: ArtboardMode;
  slots?: RenderSlots;
  /** Section id an RSVP button scrolls to when the button names none. */
  rsvpTargetId?: string;
  /** Layer ids to leave out (the editor hides the layer it is editing inline). */
  omit?: ReadonlySet<string>;
  className?: string;
  style?: CSSProperties;
}

const ENTRANCE_CLASS: Record<string, string> = {
  fade: 'bulava-cv-fade',
  fadeUp: 'bulava-cv-fade-up',
  fadeDown: 'bulava-cv-fade-down',
  zoomIn: 'bulava-cv-zoom',
  slideLeft: 'bulava-cv-slide-left',
  slideRight: 'bulava-cv-slide-right',
  blurIn: 'bulava-cv-blur',
  pop: 'bulava-cv-pop',
};
const MOTION_CLASS: Record<string, string> = { float: 'bulava-bob', sway: 'bulava-sway-soft', twinkle: 'bulava-twinkle', spin: 'bulava-spin-slow', breathe: 'bulava-breathe', shimmer: 'bulava-glint' };

const ILLUSTRATION_NAMES: ReadonlySet<string> = new Set(ILLUSTRATIONS);

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(4)}%`;

/**
 * One artboard: a frame of fixed proportions that fills its container, with
 * every layer placed by percentage and sized in `cqw` (container width units),
 * so the whole composition scales with the viewer's screen without any script.
 */
export function CanvasArtboard({ board, ctx, colors, t, language, timeZone, mode, slots, rsvpTargetId, omit, className, style }: CanvasArtboardProps) {
  const W = board.width;
  const H = board.height;
  /** Design units → container width units. */
  const u = (n: number) => `${((n / W) * 100).toFixed(4)}cqw`;
  const backdrop = fillBackdrop(board.background, colors);
  const opts = { t, language, timeZone };
  const live = mode === 'live';

  return (
    <div
      className={['bulava-artboard', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, overflow: 'hidden', containerType: 'inline-size', ...fillStyle(board.background, colors, ctx, W > 800 ? 2400 : 1200), ...style }}
    >
      {board.layers.map((layer, index) => {
        if (layer.hidden || omit?.has(layer.id)) return null;
        if (layer.visibleWhen) {
          if (layer.visibleWhen.eventTypes && !layer.visibleWhen.eventTypes.includes(ctx.event.typeKey)) return null;
          if (layer.visibleWhen.exists && isEmpty(resolveBinding(layer.visibleWhen.exists, ctx))) return null;
        }
        // Text is checked against what is actually behind it (a card, a pill), not only the artboard.
        const behind = layer.kind === 'text' || layer.kind === 'widget' ? layerBackdrop(board, index, colors) : backdrop;
        const content = renderLayer(layer, { ctx, colors, t, u, W, H, backdrop: behind, opts, mode, slots, rsvpTargetId });
        if (content === null) return null;
        const f = layer.frame;
        const entrance = live && layer.animation.entrance !== 'none' ? ENTRANCE_CLASS[layer.animation.entrance] : undefined;
        // Foil text shimmers itself (the light moves across its own background).
        const ownShimmer = layer.kind === 'text' && layer.style.foil && layer.animation.motion === 'shimmer';
        const motion = mode !== 'thumbnail' && mode !== 'edit' && layer.animation.motion !== 'none' && !ownShimmer ? MOTION_CLASS[layer.animation.motion] : undefined;
        return (
          <div
            key={layer.id}
            data-layer={layer.id}
            style={{
              position: 'absolute',
              left: pct(f.x, W),
              top: pct(f.y, H),
              width: pct(f.w, W),
              height: pct(f.h, H),
              transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined,
              opacity: layer.opacity,
              mixBlendMode: layer.blend !== 'normal' ? layer.blend : undefined,
            }}
          >
            <div
              className={entrance ? `bulava-cv-in ${entrance}` : undefined}
              style={{ width: '100%', height: '100%', ...(entrance ? { ['--cv-delay' as string]: `${layer.animation.delaySec}s`, ['--cv-dur' as string]: `${layer.animation.durationSec}s` } : {}) }}
            >
              <div className={motion} style={{ width: '100%', height: '100%' }}>
                {content}
              </div>
            </div>
          </div>
        );
      })}
      {board.texture !== 'none' ? <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...textureStyle(board.texture, board.textureStrength, backdrop) }} /> : null}
    </div>
  );
}

interface LayerEnv {
  ctx: RenderContext;
  colors: ThemeColors;
  /** Accepted for symmetry with the renderer; roles resolve through the theme's CSS variables. */
  fonts?: Fonts;
  t: Translator;
  u: (n: number) => string;
  W: number;
  H: number;
  backdrop: string[] | null;
  opts: { t: Translator; language: string; timeZone: string };
  mode: ArtboardMode;
  slots?: RenderSlots;
  rsvpTargetId?: string;
}

function renderLayer(layer: Layer, env: LayerEnv): ReactNode | null {
  switch (layer.kind) {
    case 'text':
      return <TextView layer={layer} env={env} />;
    case 'image':
      return <ImageView layer={layer} env={env} />;
    case 'shape':
      return <ShapeView layer={layer} env={env} />;
    case 'ornament':
      return <OrnamentView layer={layer} env={env} />;
    case 'icon':
      return <IconView layer={layer} env={env} />;
    case 'widget':
      return <WidgetView layer={layer} env={env} />;
    case 'scene':
      return <SceneView layer={layer} env={env} />;
    default:
      return null;
  }
}

// ─────────────────────────── Text ───────────────────────────

function textShadow(kind: TextLayer['style']['shadow'], size: string, accent: string): string | undefined {
  switch (kind) {
    case 'soft':
      return `0 calc(${size} * 0.04) calc(${size} * 0.2) rgba(0,0,0,0.35)`;
    case 'hard':
      return `calc(${size} * 0.06) calc(${size} * 0.06) 0 rgba(0,0,0,0.35)`;
    case 'glow':
      return `0 0 calc(${size} * 0.3) ${accent}aa, 0 0 calc(${size} * 0.7) ${accent}66`;
    default:
      return undefined;
  }
}

const TRANSFORM: Record<string, CSSProperties['textTransform']> = { none: 'none', upper: 'uppercase', lower: 'lowercase', capitalize: 'capitalize' };

/**
 * Static renders (thumbnails, gallery previews) have no browser to measure in,
 * so text that should shrink is scaled by an estimate instead: average glyph
 * widths for the font role, letter spacing and capitals, then the largest
 * scale at which the text fits the box (on one line, or wrapped). Long names
 * come out smaller rather than cut off.
 */
function estimatedFit(text: string, s: TextLayer['style'], frame: { w: number; h: number }, singleLine: boolean): number {
  // Generous widths: a thumbnail's text may come out a little small, never cut off.
  const glyph = (s.font === 'script' ? 0.52 : s.font === 'body' ? 0.58 : 0.62) * (s.transform === 'upper' ? 1.2 : 1) + s.letterSpacing;
  const width = Array.from(text).length * s.size * glyph;
  if (singleLine) return Math.max(0.4, Math.min(1, (frame.w * 0.96) / width));
  for (let fit = 1; fit > 0.4; fit -= 0.05) {
    const lines = Math.ceil((width * fit) / (frame.w * 0.92));
    if (lines * s.size * fit * s.lineHeight <= frame.h) return fit;
  }
  return 0.4;
}

function TextView({ layer, env }: { layer: TextLayer; env: LayerEnv }) {
  const value = resolveValue(layer.content, env.ctx, env.opts);
  if (value === undefined || value === '') return null;
  const s = layer.style;
  const size = env.u(s.size);
  const text = String(value);
  const ink = textInk(s.color, env.backdrop, env.colors, s.contrast);
  const shimmer = s.foil && layer.animation.motion === 'shimmer' && env.mode !== 'thumbnail' && env.mode !== 'edit';
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: s.valign === 'top' ? 'flex-start' : s.valign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center',
    textAlign: s.align,
    color: ink,
    fontFamily: fontFamilyFor(s.font),
    fontSize: size,
    fontWeight: s.weight,
    fontStyle: s.italic ? 'italic' : undefined,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}em` : undefined,
    lineHeight: s.lineHeight,
    textTransform: TRANSFORM[s.transform],
    textShadow: textShadow(s.shadow, size, env.colors.accent),
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    overflow: layer.overflow === 'wrap' ? 'visible' : 'hidden',
    // Foil: a metallic gradient made from the colour, painted through the letters. A shadow
    // would show through transparent glyphs, so it becomes a drop shadow around them.
    ...(s.foil
      ? {
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          backgroundImage: foilCss(hex(ink)),
          backgroundSize: shimmer ? '250% 100%' : '100% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          textShadow: undefined,
          filter: s.shadow === 'none' ? undefined : s.shadow === 'glow' ? `drop-shadow(0 0 calc(${size} * 0.25) ${env.colors.accent}aa)` : `drop-shadow(0 calc(${size} * 0.04) calc(${size} * 0.12) rgba(0,0,0,0.45))`,
        }
      : {}),
  };
  // Shrinking needs the browser; static renders (thumbnails) keep the design size.
  const shrink = layer.overflow === 'shrink' && env.mode !== 'thumbnail';
  // A box too short for two lines is a single line: it shrinks to fit the width instead of wrapping.
  const singleLine = layer.frame.h < s.size * s.lineHeight * 1.8;
  const estimate = layer.overflow === 'shrink' && !shrink ? estimatedFit(text, s, layer.frame, singleLine) : 1;
  return (
    <div style={style} className={shimmer ? 'bulava-shimmer' : undefined}>
      {shrink ? (
        <FitText lineHeight={s.lineHeight} singleLine={singleLine}>
          {text}
        </FitText>
      ) : (
        <span style={{ display: 'block', width: '100%', whiteSpace: singleLine ? 'nowrap' : undefined, ...(estimate < 1 ? { fontSize: `calc(1em * ${r2(estimate)})` } : {}) }}>{text}</span>
      )}
    </div>
  );
}

// ─────────────────────────── Images ───────────────────────────

/** The mask as CSS: a radius or a clip path, sized to the frame. */
function maskStyle(mask: ImageLayer['mask'], f: { w: number; h: number }, radius: string): CSSProperties {
  switch (mask) {
    case 'rounded':
      return { borderRadius: radius };
    case 'circle':
      return { borderRadius: '50%', aspectRatio: '1 / 1' };
    case 'ellipse':
      return { borderRadius: '50%' };
    case 'arch': {
      // Top corners meet at the centre: a palace arch whatever the frame's proportions.
      const v = `${Math.min(100, (f.w / 2 / f.h) * 100).toFixed(2)}%`;
      return { borderRadius: `50% 50% ${radius} ${radius} / ${v} ${v} ${radius} ${radius}` };
    }
    case 'diamond':
      return { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' };
    case 'leaf':
      return { borderRadius: '72% 0 72% 0 / 72% 0 72% 0' };
    default:
      return {};
  }
}

function ImageView({ layer, env }: { layer: ImageLayer; env: LayerEnv }) {
  const src = layer.source.type === 'asset' ? artworkAssetUrl(layer.source.assetId, layer.frame.w > 700 ? 2400 : 1200, env.ctx) : resolveBinding(layer.source.binding, env.ctx);
  if (typeof src !== 'string' || !src) return null;
  const radius = env.u(layer.radius);
  const border = layer.border && layer.border.width > 0 ? `${env.u(layer.border.width)} solid ${resolveColor(layer.border.color, env.colors)}` : undefined;
  const filter = [layer.brightness !== 1 ? `brightness(${layer.brightness})` : '', layer.saturate !== 1 ? `saturate(${layer.saturate})` : ''].filter(Boolean).join(' ') || undefined;
  const flip = layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : undefined;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        border,
        boxShadow: layer.shadow ? `0 ${env.u(layer.frame.w * 0.06)} ${env.u(layer.frame.w * 0.16)} -${env.u(layer.frame.w * 0.05)} rgba(0,0,0,0.45)` : undefined,
        ...maskStyle(layer.mask, layer.frame, radius),
      }}
    >
      <img
        src={src}
        alt={layer.alt ?? ''}
        loading={env.mode === 'live' ? 'lazy' : undefined}
        decoding="async"
        draggable={false}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: layer.fit, filter, transform: flip }}
      />
    </div>
  );
}

// ─────────────────────────── Shapes ───────────────────────────

/** Shapes the browser can't make with a radius are drawn as SVG paths on a 100 × 100 grid. */
const SHAPE_PATHS: Partial<Record<ShapeLayer['shape'], string>> = {
  diamond: 'M50 0 L100 50 L50 100 L0 50 Z',
  triangle: 'M50 0 L100 100 L0 100 Z',
  star: 'M50 2 L61 36 L98 36 L68 58 L79 93 L50 71 L21 93 L32 58 L2 36 L39 36 Z',
  heart: 'M50 95 C20 72 2 55 2 32 C2 16 14 5 28 5 C38 5 46 11 50 18 C54 11 62 5 72 5 C86 5 98 16 98 32 C98 55 80 72 50 95 Z',
  scallop: 'M0 100 V30 A12 12 0 0 1 20 20 A12 12 0 0 1 40 20 A12 12 0 0 1 60 20 A12 12 0 0 1 80 20 A12 12 0 0 1 100 30 V100 Z',
};

function ShapeView({ layer, env }: { layer: ShapeLayer; env: LayerEnv }) {
  const f = layer.frame;
  const stroke = layer.stroke && layer.stroke.width > 0 ? layer.stroke : undefined;
  const shadow = layer.shadow ? `0 ${env.u(f.w * 0.05)} ${env.u(f.w * 0.14)} -${env.u(f.w * 0.04)} rgba(0,0,0,0.35)` : undefined;
  if (layer.shape === 'line') {
    const color = resolveColor(stroke?.color ?? (layer.fill.type === 'color' ? layer.fill.color : 'primary'), env.colors, env.colors.primary);
    const width = stroke?.width ?? 1;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: env.u(width), background: stroke?.dash ? undefined : color, backgroundImage: stroke?.dash ? `repeating-linear-gradient(90deg, ${color} 0 ${env.u(stroke.dash)}, transparent ${env.u(stroke.dash)} ${env.u(stroke.dash * 2)})` : undefined }} />
      </div>
    );
  }
  const path = SHAPE_PATHS[layer.shape];
  if (path) {
    const gradientId = `cv-g-${layer.id}`;
    const fill = layer.fill.type === 'gradient' ? `url(#${gradientId})` : layer.fill.type === 'color' ? resolveColor(layer.fill.color, env.colors) : layer.fill.type === 'none' ? 'none' : env.colors.primary;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', filter: shadow ? `drop-shadow(0 ${env.u(f.w * 0.04)} ${env.u(f.w * 0.08)} rgba(0,0,0,0.3))` : undefined }} aria-hidden="true">
        {layer.fill.type === 'gradient' ? (
          <defs>
            {(() => {
              const g = layer.fill.gradient;
              const stops = [g.from, ...(g.via ? [g.via] : []), g.to].map((ref, i, all) => <stop key={i} offset={i / (all.length - 1)} stopColor={resolveColor(ref, env.colors)} />);
              return g.kind === 'radial' ? (
                <radialGradient id={gradientId} cx="0.5" cy="0.5" r="0.5">
                  {stops}
                </radialGradient>
              ) : (
                <linearGradient id={gradientId} gradientTransform={`rotate(${g.angle - 90} 0.5 0.5)`}>
                  {stops}
                </linearGradient>
              );
            })()}
          </defs>
        ) : null}
        <path d={path} fill={fill} stroke={stroke ? resolveColor(stroke.color, env.colors) : undefined} strokeWidth={stroke ? (stroke.width / f.w) * 100 : undefined} strokeDasharray={stroke?.dash ? `${(stroke.dash / f.w) * 100}` : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    );
  }
  const radius = env.u(layer.radius);
  const border = stroke ? `${env.u(stroke.width)} ${stroke.dash ? 'dashed' : 'solid'} ${resolveColor(stroke.color, env.colors)}` : undefined;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border,
        boxShadow: shadow,
        ...fillStyle(layer.fill, env.colors, env.ctx, f.w > 700 ? 2400 : 1200),
        ...(layer.shape === 'ellipse' ? { borderRadius: '50%' } : layer.shape === 'arch' ? maskStyle('arch', f, radius) : { borderRadius: radius }),
      }}
    />
  );
}

// ─────────────────────────── Ornaments & icons ───────────────────────────

const FILL: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/** Each line ornament's drawing box, so foil runs across the whole motif (user-space gradient). */
const ORNAMENT_BOX: Partial<Record<string, readonly [number, number]>> = {
  mandala: [200, 200],
  paisley: [120, 160],
  floral: [160, 160],
  geometric: [200, 200],
  lotus: [200, 120],
  peacock: [200, 200],
  stars: [200, 120],
  laurel: [200, 170],
  lantern: [60, 120],
  crescent: [100, 100],
  peacockFeather: [80, 220],
  roseWindow: [200, 200],
  gothicArch: [300, 420],
  crest: [200, 240],
  gateLeaf: [180, 400],
  archFrame: [300, 400],
  templeBorder: [400, 40],
  seaWaves: [400, 120],
};

function ornamentShadow(kind: OrnamentLayer['shadow'], color: string, env: LayerEnv, w: number): string | undefined {
  if (kind === 'soft') return `drop-shadow(0 ${env.u(w * 0.02)} ${env.u(w * 0.035)} rgba(0,0,0,0.38))`;
  if (kind === 'glow') return `drop-shadow(0 0 ${env.u(w * 0.03)} ${hex(color)}cc) drop-shadow(0 0 ${env.u(w * 0.09)} ${hex(color)}77)`;
  return undefined;
}

function OrnamentView({ layer, env }: { layer: OrnamentLayer; env: LayerEnv }) {
  const uid = useSafeId();
  const flip = layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : undefined;
  const color = resolveColor(layer.color, env.colors, env.colors.secondary);
  const filter = ornamentShadow(layer.shadow, color, env, layer.frame.w);
  if (ILLUSTRATION_NAMES.has(layer.ornament)) {
    return (
      <div style={{ width: '100%', height: '100%', transform: flip, filter }} aria-hidden="true">
        <Illustration name={layer.ornament as IllustrationName} color={hex(color)} colors={env.colors} foil={layer.foil} w={layer.frame.w} h={layer.frame.h} style={FILL} />
      </div>
    );
  }
  let node: ReactNode;
  switch (layer.ornament) {
    case 'toran':
      node = <Toran style={FILL} />;
      break;
    case 'marigoldStrand':
      node = <MarigoldStrand style={FILL} count={Math.max(4, Math.round(layer.frame.h / 28))} />;
      break;
    case 'diya':
      node = <Diya style={FILL} />;
      break;
    case 'kalash':
      node = <Kalash style={FILL} />;
      break;
    case 'lantern':
      node = <Lantern style={FILL} />;
      break;
    case 'crescent':
      node = <Crescent style={FILL} />;
      break;
    case 'peacockFeather':
      node = <PeacockFeather style={FILL} />;
      break;
    case 'roseWindow':
      node = <RoseWindow style={FILL} />;
      break;
    case 'gothicArch':
      node = <GothicArch style={FILL} />;
      break;
    case 'crest':
      node = <CrestFrame style={FILL} />;
      break;
    case 'gateLeaf':
      node = <GateLeaf style={FILL} />;
      break;
    case 'archFrame':
      node = <ArchFrame style={FILL} />;
      break;
    case 'templeBorder':
      node = <TempleBorder style={FILL} />;
      break;
    case 'seaWaves':
      node = <SeaWaves style={FILL} />;
      break;
    default:
      node = <Ornament name={layer.ornament as OrnamentName} style={FILL} />;
  }
  // Foil on a line ornament: its currentColor strokes and fills take a metallic gradient
  // (a scoped rule beats the SVG's own attributes; the motif's other colours stay).
  const box = ORNAMENT_BOX[layer.ornament];
  const foil = layer.foil && box;
  return (
    <div data-foil={foil ? uid : undefined} style={{ width: '100%', height: '100%', color, transform: flip, filter }} aria-hidden="true">
      {foil ? (
        <>
          <svg width="0" height="0" style={{ position: 'absolute' }} focusable="false">
            <defs>
              <linearGradient id={`${uid}f`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={box[0]} y2={box[1]}>
                {metalStops(hex(color)).map(([offset, stop], i) => (
                  <stop key={i} offset={offset} stopColor={stop} />
                ))}
              </linearGradient>
            </defs>
          </svg>
          <style>{`[data-foil="${uid}"] [stroke="currentColor"]{stroke:url(#${uid}f)}[data-foil="${uid}"] [fill="currentColor"]{fill:url(#${uid}f)}`}</style>
        </>
      ) : null}
      {node}
    </div>
  );
}

// ─────────────────────────── Scenes ───────────────────────────

/**
 * An illustrated scene inside the frame, anchored bottom-centre like a hero
 * (the frame crops its sides and sky), in the palette's colours.
 */
function SceneView({ layer, env }: { layer: SceneLayer; env: LayerEnv }) {
  const art = sceneArt(layer.scene, env.colors);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: layer.sky ? art.background : undefined }} aria-hidden="true">
      {art.layers.map((l, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0 }}>
          {l.node}
        </div>
      ))}
    </div>
  );
}

function IconView({ layer, env }: { layer: IconLayer; env: LayerEnv }) {
  const color = resolveColor(layer.color, env.colors, env.colors.primary);
  const circle = layer.circle ? resolveColor(layer.circle, env.colors) : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color, borderRadius: circle ? '50%' : undefined, background: circle, boxShadow: circle ? `0 ${env.u(2)} ${env.u(8)} rgba(0,0,0,0.12)` : undefined }}>
      <Icon name={layer.icon} weight={layer.weight} style={{ width: circle ? '52%' : '100%', height: circle ? '52%' : '100%' }} />
    </div>
  );
}

// ─────────────────────────── Widgets ───────────────────────────

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^(https:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(v) ? v : null;
}

function WidgetView({ layer, env }: { layer: WidgetLayer; env: LayerEnv }) {
  const w = layer.widget;
  if (w.type === 'countdown') {
    const target = env.ctx.function?.startsAt ?? env.ctx.event.startDate;
    if (env.mode === 'live' && target && new Date(target).getTime() < Date.now()) return null;
    // Styles are computed here (design units → cqw), so the client component gets plain props.
    // Digits sit on the boxes (or, inline, on whatever is behind the layer).
    const boxSolid = w.variant === 'inline' ? null : solidHex(w.boxColor, env.colors);
    const behind = boxSolid ? [boxSolid] : env.backdrop;
    const numberStyle: CSSProperties = { fontFamily: fontFamilyFor(w.font), fontSize: env.u(w.size), lineHeight: 1, color: textInk(w.color, behind, env.colors, true), fontVariantNumeric: 'tabular-nums' };
    const labelStyle: CSSProperties = { fontSize: env.u(Math.max(6, w.size * 0.3)), letterSpacing: '0.18em', textTransform: 'uppercase', color: textInk(w.labelColor, behind, env.colors, true), marginTop: env.u(w.size * 0.22) };
    const boxStyle: CSSProperties = {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: resolveColor(w.boxColor, env.colors, env.colors.surface),
      borderRadius: env.u(w.size * 0.45),
      padding: `${env.u(w.size * 0.45)} 0`,
      boxShadow: `0 ${env.u(w.size * 0.3)} ${env.u(w.size * 0.9)} -${env.u(w.size * 0.45)} rgba(0,0,0,0.25)`,
      position: 'relative',
      overflow: 'hidden',
    };
    return (
      <CanvasCountdown
        variant={w.variant}
        target={target}
        isStatic={env.mode === 'thumbnail' || env.mode === 'edit'}
        labels={(['days', 'hours', 'minutes', 'seconds'] as const).map((unit) => env.t(w.variant === 'inline' ? `template.countdown.short.${unit}` : `template.countdown.${unit}`)) as [string, string, string, string]}
        numberStyle={numberStyle}
        labelStyle={labelStyle}
        boxStyle={boxStyle}
        gap={env.u(w.size * 0.35)}
        inlineGap={env.u(w.size * 0.6)}
      />
    );
  }
  if (w.type === 'details') {
    const fn = env.ctx.function;
    const venue = fn?.venue ?? env.ctx.venue;
    const rows = w.rows
      .map((row) => {
        const value =
          row === 'date'
            ? resolveValue({ binding: fn ? 'function.startsAt' : 'event.startDate', format: 'dateWithWeekday' }, env.ctx, env.opts)
            : row === 'time'
              ? resolveValue({ binding: fn ? 'function.startsAt' : 'event.startDate', format: 'time' }, env.ctx, env.opts)
              : row === 'venue'
                ? venue?.name
                : row === 'address'
                  ? venue?.address
                  : venue?.city;
        return value ? { row, value: String(value) } : null;
      })
      .filter((r): r is { row: (typeof w.rows)[number]; value: string } => r !== null);
    if (!rows.length) return null;
    const icon: Record<string, Parameters<typeof Icon>[0]['name']> = { date: 'calendar', time: 'clock', venue: 'pin', address: 'navigation', city: 'pin' };
    const label: Record<string, string> = {
      date: env.t('template.details.date'),
      time: env.t('template.details.time'),
      venue: env.t('template.details.venue'),
      address: env.t('template.details.address'),
      city: env.t('template.details.city'),
    };
    const iconSize = env.u(w.valueSize * 2.2);
    const gap = env.u(w.valueSize * 0.8);
    // A <dl> may hold only dt/dd groups, so the icon lives inside the <dt>, centred on the row's text block.
    const textHeight = w.labelSize * 1.2 + w.labelSize * 0.3 + w.valueSize * 1.3;
    const iconTop = env.u((textHeight - w.valueSize * 2.2) / 2);
    return (
      <dl style={{ width: '100%', height: '100%', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', fontFamily: fontFamilyFor(w.font) }}>
        {rows.map(({ row, value }, i) => (
          <div
            key={row}
            style={{
              position: 'relative',
              paddingTop: env.u(w.valueSize * 0.35),
              paddingBottom: env.u(w.valueSize * 0.35),
              paddingLeft: w.icons ? `calc(${iconSize} + ${gap})` : 0,
              borderBottom: w.dividers && i < rows.length - 1 ? `1px solid ${resolveColor(w.dividerColor, env.colors, env.colors.muted)}55` : undefined,
            }}
          >
            <dt style={{ position: 'relative', fontSize: env.u(w.labelSize), letterSpacing: '0.2em', textTransform: 'uppercase', color: textInk(w.labelColor, env.backdrop, env.colors, true), lineHeight: 1.2 }}>
              {w.icons ? (
                <span
                  style={{
                    position: 'absolute',
                    left: `calc(-1 * (${iconSize} + ${gap}))`,
                    top: iconTop,
                    width: iconSize,
                    height: iconSize,
                    display: 'grid',
                    placeItems: 'center',
                    color: resolveColor(w.iconColor, env.colors, env.colors.primary),
                    background: w.iconCircle ? resolveColor(w.iconCircle, env.colors) : undefined,
                    borderRadius: '50%',
                    boxShadow: w.iconCircle ? `0 ${env.u(2)} ${env.u(8)} rgba(0,0,0,0.12)` : undefined,
                  }}
                  aria-hidden="true"
                >
                  <Icon name={icon[row] ?? 'sparkle'} style={{ width: w.iconCircle ? '50%' : '70%', height: w.iconCircle ? '50%' : '70%' }} />
                </span>
              ) : null}
              {label[row]}
            </dt>
            <dd style={{ margin: 0, marginTop: env.u(w.labelSize * 0.3), fontSize: env.u(w.valueSize), color: textInk(w.valueColor, env.backdrop, env.colors, true), lineHeight: 1.3, overflowWrap: 'break-word' }}>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  // button
  const label = resolveValue(w.label, env.ctx, env.opts);
  if (label === undefined || label === '') return null;
  const fn = env.ctx.function;
  const href =
    w.action === 'directions'
      ? (fn?.venue?.mapUrl ?? env.ctx.venue?.mapUrl ?? null)
      : w.action === 'calendar'
        ? calendarUrl(env.ctx)
        : w.action === 'rsvp'
          ? `#${w.target ?? env.rsvpTargetId ?? 'rsvp'}`
          : w.action === 'top'
            ? '#'
            : safeUrl(resolveValue(w.url, env.ctx, env.opts));
  if (env.mode === 'live' && !href) return null;
  const fill = resolveColor(w.fill, env.colors, env.colors.primary);
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: env.u(w.size * 0.5),
    boxSizing: 'border-box',
    padding: `0 ${env.u(w.size)}`,
    background: fill,
    color: textInk(w.color, fill.startsWith('#') ? [fill.slice(0, 7)] : null, env.colors, true),
    fontFamily: fontFamilyFor(w.font),
    fontSize: env.u(w.size),
    fontWeight: w.weight,
    letterSpacing: '0.02em',
    borderRadius: env.u(w.radius),
    border: w.border && w.border.width > 0 ? `${env.u(w.border.width)} solid ${resolveColor(w.border.color, env.colors)}` : undefined,
    boxShadow: w.shadow ? `0 ${env.u(w.size * 0.45)} ${env.u(w.size * 1.2)} -${env.u(w.size * 0.5)} rgba(0,0,0,0.4)` : undefined,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  const inner = (
    <>
      {w.icon ? <Icon name={w.icon} style={{ width: env.u(w.size * 1.1), height: env.u(w.size * 1.1), flex: 'none' }} /> : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(label)}</span>
    </>
  );
  if (env.mode !== 'live' || !href) return <span style={style}>{inner}</span>;
  const external = /^https:/i.test(href);
  return (
    <a href={href} style={style} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {inner}
    </a>
  );
}
