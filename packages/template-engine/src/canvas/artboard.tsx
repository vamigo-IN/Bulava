import type { CSSProperties, ReactNode } from 'react';
import type { Translator } from '@bulava/localization';
import {
  layerBackdrop,
  resolveBinding,
  resolveValue,
  type Artboard,
  type Fonts,
  type IconLayer,
  type ImageLayer,
  type Layer,
  type OrnamentLayer,
  type RenderContext,
  type ShapeLayer,
  type TextLayer,
  type ThemeColors,
  type WidgetLayer,
} from '@bulava/template-schema';
import { Diya, Kalash, MarigoldStrand, Toran } from '../art/motifs';
import { artworkAssetUrl } from '../art/scenes';
import { ArchFrame, Ornament, TempleBorder, type OrnamentName } from '../ornaments';
import { Crescent, CrestFrame, GateLeaf, GothicArch, Lantern, PeacockFeather, RoseWindow, SeaWaves } from '../ornaments-signature';
import type { RenderMode, RenderSlots } from '../types';
import { fillBackdrop, fillStyle, fontFamilyFor, resolveColor, solidHex, textInk } from './colors';
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
const MOTION_CLASS: Record<string, string> = { float: 'bulava-bob', sway: 'bulava-sway-soft', twinkle: 'bulava-twinkle', spin: 'bulava-spin-slow', breathe: 'bulava-breathe' };

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
        const motion = mode !== 'thumbnail' && mode !== 'edit' && layer.animation.motion !== 'none' ? MOTION_CLASS[layer.animation.motion] : undefined;
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

function TextView({ layer, env }: { layer: TextLayer; env: LayerEnv }) {
  const value = resolveValue(layer.content, env.ctx, env.opts);
  if (value === undefined || value === '') return null;
  const s = layer.style;
  const size = env.u(s.size);
  const text = String(value);
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: s.valign === 'top' ? 'flex-start' : s.valign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center',
    textAlign: s.align,
    color: textInk(s.color, env.backdrop, env.colors, s.contrast),
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
  };
  // Shrinking needs the browser; static renders (thumbnails) keep the design size.
  const shrink = layer.overflow === 'shrink' && env.mode !== 'thumbnail';
  // A box too short for two lines is a single line: it shrinks to fit the width instead of wrapping.
  const singleLine = layer.frame.h < s.size * s.lineHeight * 1.8;
  return (
    <div style={style}>
      {shrink ? (
        <FitText lineHeight={s.lineHeight} singleLine={singleLine}>
          {text}
        </FitText>
      ) : (
        <span style={{ display: 'block', width: '100%', whiteSpace: singleLine ? 'nowrap' : undefined }}>{text}</span>
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
            <linearGradient id={gradientId} gradientTransform={`rotate(${layer.fill.gradient.angle - 90} 0.5 0.5)`}>
              <stop offset="0" stopColor={resolveColor(layer.fill.gradient.from, env.colors)} />
              <stop offset="1" stopColor={resolveColor(layer.fill.gradient.to, env.colors)} />
            </linearGradient>
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

function OrnamentView({ layer, env }: { layer: OrnamentLayer; env: LayerEnv }) {
  const flip = layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : undefined;
  const color = resolveColor(layer.color, env.colors, env.colors.secondary);
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
  return (
    <div style={{ width: '100%', height: '100%', color, transform: flip }} aria-hidden="true">
      {node}
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
        labels={[env.t('template.countdown.days'), env.t('template.countdown.hours'), env.t('template.countdown.minutes'), env.t('template.countdown.seconds')]}
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
