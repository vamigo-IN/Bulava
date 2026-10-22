import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTranslator } from '@bulava/localization';
import {
  effectiveColors,
  effectiveFonts,
  FILM_FORMAT_SIZE,
  isStageIntro,
  resolveValue,
  STAGE_META,
  videoDurationSec,
  withFilmCustomization,
  type Customization,
  type Element,
  type RenderContext,
  type Scene,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { Bell, coverMonogram, Crescent, Diya, easeInOut, fontStack, initials, Kalash, Lantern, MarigoldStrand, mix, Ornament, PeacockFeather, RibbonCover, STAGE_REVEAL, Toran, ZipperCover } from '@bulava/template-engine';
import { BackdropView, Particles } from './backdrop';
import { CanvasScene } from './canvas-scene';
import { fitFontSize } from './fit';

export const COMPOSITION_ID = 'TemplateVideo';

export interface TemplateVideoProps extends Record<string, unknown> {
  definition: TemplateDefinition;
  context: RenderContext;
  customization: Customization | null;
  language: string;
  watermark: boolean;
  musicUrl: string | null;
  /**
   * The share of its size the film is drawn at (default 1). The worker draws a standard-size Signature 3D film at 0.5,
   * natively at 540×960, rather than shrinking the full frame at render time: SwiftShader takes about 1.8 times as long
   * per frame at a device scale of 0.5. Every scene scales to the frame, so the picture is the same.
   */
  frameScale?: number;
}

/** The film's drawing scale: `frameScale` when it shrinks the film, else 1. */
const frameScaleOf = (props: Pick<TemplateVideoProps, 'frameScale'>): number => (props.frameScale && props.frameScale > 0 && props.frameScale < 1 ? props.frameScale : 1);

export interface PlannedScene {
  key: string;
  scene: Scene;
  ctx: RenderContext;
  from: number;
  frames: number;
  /** Which copy of a per-function scene this is (0 for other scenes): a stage films each one a station further down the set. */
  repeatIndex: number;
}

/** Expand per-function scenes and lay scenes out on the timeline. */
export function planScenes(definition: TemplateDefinition, context: RenderContext, fps: number): PlannedScene[] {
  const out: PlannedScene[] = [];
  let from = 0;
  for (const scene of definition.scenes ?? []) {
    const copies = scene.repeatPerFunction && context.functions.length ? context.functions.map((fn) => ({ ...context, function: fn, venue: fn.venue ?? context.venue })) : [context];
    copies.forEach((ctx, i) => {
      const frames = Math.max(1, Math.round(scene.durationSec * fps));
      out.push({ key: `${scene.id}-${i}`, scene, ctx, from, frames, repeatIndex: i });
      from += frames;
    });
  }
  return out;
}

/** The size scenes are designed at (a film's 9:16 frame). */
const stageOf = (definition: TemplateDefinition) => ({ width: definition.canvas?.width ?? 1080, height: definition.canvas?.height ?? 1920 });

/** The film's length (with the host's added scenes) and frame (the size they chose, ADR-061). */
export function templateVideoMetadata(props: TemplateVideoProps) {
  const fps = props.definition.canvas?.fps ?? 30;
  const film = withFilmCustomization(props.definition, props.customization);
  const seconds = Math.max(1, videoDurationSec(film, props.context.functions.length));
  const format = props.definition.type === 'VIDEO' ? props.customization?.filmFormat : undefined;
  const size = format && format !== 'story' ? FILM_FORMAT_SIZE[format] : stageOf(props.definition);
  const k = frameScaleOf(props);
  return { durationInFrames: Math.max(1, Math.round(seconds * fps)), fps, width: Math.round(size.width * k), height: Math.round(size.height * k) };
}

/**
 * Elements are placed on the 9:16 stage the scene was designed at. In a square
 * or wide film that stage is scaled to the frame's height and centred, so the
 * words and photos keep their places while the art fills the whole frame.
 */
function Stage({ stage, children }: { stage: { width: number; height: number }; children: ReactNode }) {
  const { width, height } = useVideoConfig();
  if (width === stage.width && height === stage.height) return <>{children}</>;
  const k = Math.min(width / stage.width, height / stage.height);
  return (
    <div style={{ position: 'absolute', left: (width - stage.width * k) / 2, top: (height - stage.height * k) / 2, width: stage.width, height: stage.height, transform: `scale(${k})`, transformOrigin: '0 0' }}>
      {children}
    </div>
  );
}

function color(value: string | undefined, colors: ThemeColors, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith('#')) return value;
  return (colors as Record<string, string>)[value] ?? fallback;
}

/** After a `flipUp` line has turned up, its foil sheen crosses it over this long (seconds; the website's type-in is 1.4 s). */
const FLIP_SHEEN_SEC = 1.2;

/** An element's entrance at the current frame: its style, its progress, and where a foil sheen is (shine, flipUp). */
interface Entrance {
  style: CSSProperties;
  progress: number;
  /** 0..1 across the letters (shine and flipUp only). */
  sheen?: number;
}

/** `offsetSec` delays the entrance (the words of a scene that opens under a cover come in as it opens). */
function useAnimation(el: Element, sceneFrames: number, offsetSec = 0): Entrance {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = el.animation.in;
  if (!anim || anim.type === 'none') return { style: {}, progress: 1 };
  const start = (anim.delaySec + offsetSec) * fps;
  const end = start + Math.max(1, anim.durationSec * fps);
  const p = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  switch (anim.type) {
    case 'fade':
      return { style: { opacity: p }, progress: p };
    case 'fadeUp':
      return { style: { opacity: p, transform: `translateY(${(1 - p) * 60}px)` }, progress: p };
    case 'fadeDown':
      return { style: { opacity: p, transform: `translateY(${(p - 1) * 60}px)` }, progress: p };
    case 'zoomIn':
      return { style: { opacity: p, transform: `scale(${0.82 + 0.18 * p})` }, progress: p };
    case 'zoomOut': {
      // Slow Ken Burns across the whole scene.
      const k = interpolate(frame, [0, sceneFrames], [1.12, 1], { extrapolateRight: 'clamp' });
      return { style: { transform: `scale(${k})` }, progress: 1 };
    }
    case 'slideLeft':
      return { style: { opacity: p, transform: `translateX(${(1 - p) * 140}px)` }, progress: p };
    case 'slideRight':
      return { style: { opacity: p, transform: `translateX(${(p - 1) * 140}px)` }, progress: p };
    case 'typewriter':
      return { style: {}, progress: p };
    case 'float':
      return { style: { opacity: p, transform: `translateY(${Math.sin(frame / (fps / 2)) * 8}px)` }, progress: p };
    case 'blurIn':
      return { style: { opacity: p, filter: `blur(${(1 - p) * 18}px)`, transform: `scale(${1.08 - 0.08 * p})` }, progress: p };
    case 'tracking':
      // Letter spacing settles from wide to the element's own spacing.
      return { style: { opacity: p, letterSpacing: el.style.letterSpacing + (1 - p) * el.style.fontSize * 0.45 }, progress: p };
    case 'reveal':
      return { style: { clipPath: `inset(${(1 - p) * 100}% -20% -20% -20%)`, transform: `translateY(${(1 - p) * 40}px)` }, progress: p };
    case 'bloom':
      return { style: { opacity: p, transform: `rotate(${(1 - p) * -120}deg) scale(${0.5 + 0.5 * p})` }, progress: p };
    case 'shine':
      return { style: { opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }) }, progress: p, sheen: p };
    case 'flipUp': {
      // 3D type (final.md §3.1.6): the line turns up from lying toward the viewer, hinged on its foot, as the
      // website's names do; once it stands, a foil sheen crosses it. No drop shadow (a filter) under it.
      const sheen = interpolate(frame, [start + (end - start) * 0.55, end + FLIP_SHEEN_SEC * fps], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      });
      return {
        style: {
          opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
          transform: p < 1 ? `perspective(800px) rotateX(${-80 * (1 - p)}deg)` : undefined,
          transformOrigin: '50% 100%',
        },
        progress: p,
        sheen,
      };
    }
    case 'coin':
      // A medallion turning to face the camera like a coin.
      return {
        style: { opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }), transform: p < 1 ? `perspective(800px) rotateY(${90 * (1 - p)}deg)` : undefined },
        progress: p,
      };
    default:
      return { style: {}, progress: 1 };
  }
}

function ElementView({
  el,
  ctx,
  colors,
  fonts,
  language,
  sceneFrames,
  offsetSec = 0,
}: {
  el: Element;
  ctx: RenderContext;
  colors: ThemeColors;
  fonts: TemplateDefinition['fonts'];
  language: string;
  sceneFrames: number;
  offsetSec?: number;
}) {
  const { style: animStyle, progress, sheen = progress } = useAnimation(el, sceneFrames, offsetSec);
  const t = createTranslator(language);
  const value = resolveValue(el.content, ctx, { t, language, timeZone: ctx.event.timezone });
  const box: CSSProperties = {
    position: 'absolute',
    left: el.frame.x,
    top: el.frame.y,
    width: el.frame.w,
    height: el.frame.h,
    transform: el.frame.rotate ? `rotate(${el.frame.rotate}deg)` : undefined,
    opacity: el.style.opacity,
  };

  if (el.kind === 'text') {
    if (value === undefined) return null;
    const full = String(value);
    const text = el.animation.in?.type === 'typewriter' ? full.slice(0, Math.ceil(full.length * progress)) : full;
    const family = el.style.font === 'heading' ? fonts.heading : el.style.font === 'script' ? (fonts.script ?? fonts.heading) : fonts.body;
    const generic = el.style.font === 'script' && fonts.script ? 'cursive' : el.style.font === 'body' ? 'sans-serif' : 'serif';
    const fontFamily = fontStack(family, generic);
    // Canvas cannot resolve the CSS variables in the font stack, so text is measured by family name.
    const fontSize =
      el.overflow === 'shrink'
        ? fitFontSize(full, el.style.fontSize, el.style.lineHeight, el.frame.w, el.frame.h, {
            letterSpacing: el.style.letterSpacing,
            family: family ? `'${family.family}', ${generic}` : generic,
            weight: el.style.fontWeight,
          })
        : el.style.fontSize;
    const ink = color(el.style.color, colors, colors.text);
    const shadow =
      el.style.shadow === 'glow'
        ? `0 0 ${Math.round(fontSize * 0.25)}px ${colors.accent}99, 0 0 ${Math.round(fontSize * 0.6)}px ${colors.accent}55`
        : el.style.shadow === 'soft'
          ? `0 ${Math.round(fontSize * 0.04)}px ${Math.round(fontSize * 0.2)}px rgba(0,0,0,0.45)`
          : undefined;
    // Shine: a band of light sweeps across the letters once they are in. flipUp: the same foil, after the line stands.
    const entrance = el.animation.in?.type;
    const shining = entrance === 'shine' || entrance === 'flipUp';
    const shine: CSSProperties = shining
      ? {
          backgroundImage: `linear-gradient(105deg, ${ink} 0%, ${ink} 40%, #fff6d6 50%, ${ink} 60%, ${ink} 100%)`,
          backgroundSize: '300% 100%',
          backgroundPosition: entrance === 'flipUp' ? `${110 - sheen * 120}% 0` : `${100 - sheen * 100}% 0`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }
      : {};
    return (
      <div style={box}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: el.style.align === 'left' ? 'flex-start' : el.style.align === 'right' ? 'flex-end' : 'center',
            textAlign: el.style.align,
            color: ink,
            // Clipped-background text cannot carry a text shadow; a drop shadow filter stands in (never under 3D type).
            textShadow: shining ? undefined : shadow,
            filter: entrance === 'shine' && shadow ? `drop-shadow(0 0 ${Math.round(fontSize * 0.15)}px ${colors.accent}88)` : undefined,
            fontFamily,
            fontSize,
            fontWeight: el.style.fontWeight,
            letterSpacing: el.style.letterSpacing,
            lineHeight: el.style.lineHeight,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: el.overflow === 'ellipsis' ? 'ellipsis' : undefined,
            ...animStyle,
            ...shine,
          }}
        >
          {text}
        </div>
      </div>
    );
  }
  if (el.kind === 'ornament') {
    const name = typeof value === 'string' ? value : 'mandala';
    return (
      <div style={{ ...box, color: color(el.style.color, colors, colors.secondary) }}>
        <div style={{ ...animStyle, width: '100%', height: '100%' }}>
          <VideoOrnament name={name} />
        </div>
      </div>
    );
  }
  if (el.kind === 'shape') {
    return <div style={{ ...box, ...animStyle, background: color(el.style.fill, colors, colors.surface), borderRadius: el.style.radius }} />;
  }
  // image / photo
  if (typeof value !== 'string' || !value) return null;
  const radius = el.style.mask === 'arch' ? `${el.frame.w / 2}px ${el.frame.w / 2}px ${el.style.radius}px ${el.style.radius}px` : el.style.mask === 'circle' ? '50%' : el.style.radius;
  const border = el.style.border ? color(el.style.border, colors, colors.accent) : undefined;
  // zoomOut is a Ken Burns inside the frame; other entrances move the whole frame.
  const zoom = el.animation.in?.type === 'zoomOut';
  return (
    <div style={{ ...box, ...(zoom ? {} : animStyle) }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: radius,
          border: border ? `${Math.max(4, Math.round(el.frame.w * 0.012))}px solid ${border}` : undefined,
          boxShadow: border ? `0 0 0 ${Math.max(2, Math.round(el.frame.w * 0.006))}px ${border}55, 0 30px 60px -20px rgba(0,0,0,0.55)` : undefined,
        }}
      >
        <Img src={value} style={{ ...(zoom ? animStyle : {}), width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

/** Ornament elements: the website ornaments plus the illustrated motifs. */
function VideoOrnament({ name }: { name: string }) {
  const fill = { width: '100%', height: '100%' };
  switch (name) {
    case 'toran':
      return <Toran style={fill} />;
    case 'marigoldStrand':
      return <MarigoldStrand style={fill} count={16} />;
    case 'diya':
      return <Diya style={fill} />;
    case 'kalash':
      return <Kalash style={fill} />;
    case 'bell':
      return (
        <svg viewBox="-20 -10 40 60" style={fill} aria-hidden="true">
          <Bell x={0} y={0} size={1.4} />
        </svg>
      );
    case 'crescent':
      return <Crescent style={fill} />;
    case 'lantern':
      return <Lantern style={fill} />;
    case 'peacockFeather':
      return <PeacockFeather style={fill} />;
    default:
      return <Ornament name={name as 'mandala'} style={fill} />;
  }
}

/** A scene's cover (ADR-074): held, pulled open, then moved off, in seconds from the scene's start. */
export const REVEAL_TIMING = { hold: 0.7, pull: 1.9, release: 0.7 } as const;
/** When the scene's own layers start to come in under a cover: as it opens. */
export const REVEAL_CONTENT_DELAY = REVEAL_TIMING.hold + REVEAL_TIMING.pull * 0.25;
/**
 * A stage opening (`reveal: 'arrival' | 'doorway' | 'silk' | 'unfold'`, ADR-078) holds its cover 0.7 s and opens it
 * over 2.6 s inside the stage: the scene's words come in at 80% of that run (0.7 + 0.8 × 2.6 = 2.78 s).
 */
export const STAGE_REVEAL_CONTENT_DELAY = STAGE_REVEAL.content;

/** A triangle wave in [-1, 1]: the tag's swing, from the frame alone. */
const swingAt = (t: number) => 1 - 4 * Math.abs(t - Math.floor(t) - 0.5);

/** The initials or names printed on a cover's seal (the website's own monogram). */
function monogramOf(ctx: RenderContext): string {
  const names = ctx.couple ? `${ctx.couple.partnerOne} & ${ctx.couple.partnerTwo}` : (ctx.honoree?.name ?? ctx.event.title);
  return coverMonogram(ctx.couple, initials(names));
}

/** The film's script face (its heading face when it has none), for monograms. */
const scriptOf = (definition: TemplateDefinition) => fontStack(definition.fonts.script ?? definition.fonts.heading, definition.fonts.script ? 'cursive' : 'serif');

function SceneReveal({ reveal, ctx, colors, definition }: { reveal: 'zipper' | 'ribbon'; ctx: RenderContext; colors: ThemeColors; definition: TemplateDefinition }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { hold, pull, release } = REVEAL_TIMING;
  const progress = easeInOut(interpolate(frame, [hold * fps, (hold + pull) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const gone = interpolate(frame, [(hold + pull) * fps, (hold + pull + release) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (gone >= 1) return null;
  const Cover = reveal === 'zipper' ? ZipperCover : RibbonCover;
  return (
    <Cover
      progress={progress}
      release={gone}
      width={width}
      height={height}
      colors={colors}
      monogram={monogramOf(ctx)}
      script={scriptOf(definition)}
      heading={fontStack(definition.fonts.heading, 'serif')}
      swing={progress > 0 ? 0 : 3 * swingAt(frame / (fps * 3.4))}
    />
  );
}

function SceneView({ planned, colors, definition, language }: { planned: PlannedScene; colors: ThemeColors; definition: TemplateDefinition; language: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.min(Math.round(0.35 * fps), Math.floor(planned.frames / 3));
  const opacity =
    planned.scene.transition === 'none' || fadeFrames < 1
      ? 1
      : interpolate(frame, [0, fadeFrames, planned.frames - fadeFrames, planned.frames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bg = planned.scene.background;
  const background = bg === 'gradient' ? `linear-gradient(160deg, ${colors.primary}, ${colors.secondary})` : color(bg, colors, colors.background);
  const backdrop = planned.scene.backdrop;
  const canvas = planned.scene.canvas;
  // A board without a background is words and art over the scene (a host's redrawn scene): it goes over the particles, as elements do.
  const overlay = canvas?.board.background.type === 'none';
  const reveal = planned.scene.reveal;
  // A stage draws its particles at depth and plays a stage opening inside itself (final.md §3.3); its words wait for the opening.
  // The opening plays under the scene's board: a host's board with its own background hides the stage, so that scene drops
  // the opening and starts as any other, and over one without, every layer waits for the opening (whole-board ones too).
  const stage = !!backdrop?.stage;
  const stageReveal = stage && isStageIntro(reveal) && (!canvas || overlay);
  const board = canvas ? (
    <CanvasScene
      canvas={canvas}
      ctx={planned.ctx}
      colors={colors}
      fonts={definition.fonts}
      theme={definition.theme}
      language={language}
      frames={planned.frames}
      offsetSec={stageReveal ? STAGE_REVEAL_CONTENT_DELAY : reveal === 'zipper' || reveal === 'ribbon' ? REVEAL_CONTENT_DELAY : 0}
      coversWait={stageReveal}
    />
  ) : null;
  return (
    <AbsoluteFill style={{ background, opacity }}>
      {backdrop ? (
        <BackdropView
          backdrop={backdrop}
          definition={definition}
          ctx={planned.ctx}
          colors={colors}
          frames={planned.frames}
          monogram={initials(planned.ctx.event.title)}
          photo={planned.ctx.photoSlots?.cover?.url ?? planned.ctx.photos[0]?.url}
          stage={{ reveal: isStageIntro(reveal) && !stageReveal ? 'none' : reveal, station: planned.repeatIndex, particles: planned.scene.particles, monogram: monogramOf(planned.ctx), script: scriptOf(definition), seed: planned.key }}
        />
      ) : null}
      {overlay ? null : board}
      {stage ? null : <Particles effect={planned.scene.particles} colors={colors} />}
      {overlay ? board : null}
      {planned.scene.elements.length ? (
        <Stage stage={stageOf(definition)}>
          {planned.scene.elements.map((el) => (
            <ElementView
              key={el.id}
              el={el}
              ctx={planned.ctx}
              colors={colors}
              fonts={definition.fonts}
              language={language}
              sceneFrames={planned.frames}
              offsetSec={stageReveal ? STAGE_REVEAL_CONTENT_DELAY : 0}
            />
          ))}
        </Stage>
      ) : null}
      {reveal === 'zipper' || reveal === 'ribbon' ? <SceneReveal reveal={reveal} ctx={planned.ctx} colors={colors} definition={definition} /> : null}
    </AbsoluteFill>
  );
}

/**
 * The colour a film fades through between scenes and from on its first frame. A film on a dark stage fades through
 * its own night (the ink of the stage's words veil), never through the template's light page colour, which would
 * flash at every cut.
 */
export function filmBaseColor(definition: Pick<TemplateDefinition, 'scenes'>, colors: ThemeColors): string {
  const stage = definition.scenes?.find((s) => s.backdrop?.stage)?.backdrop?.stage;
  return stage && STAGE_META[stage].dark ? mix(colors.primary, '#000000', 0.55) : colors.background;
}

/** Generic renderer for VIDEO and DIGITAL_CARD template definitions. */
export function TemplateVideo(props: TemplateVideoProps) {
  const { fps, durationInFrames } = useVideoConfig();
  const colors = effectiveColors(props.definition, props.customization);
  // A customer's font pairing replaces the template fonts wherever scenes read them; their redrawn scenes replace the film's
  // and the scenes they added play where they put them (ADR-059, ADR-061).
  const definition = { ...withFilmCustomization(props.definition, props.customization), fonts: effectiveFonts(props.definition, props.customization) };
  const ctx: RenderContext = props.customization?.custom ? { ...props.context, custom: { ...props.context.custom, ...props.customization.custom } } : props.context;
  const scenes = planScenes(definition, ctx, fps);
  // Sizes in px below are the full frame's; a film drawn smaller (frameScale) draws them smaller too.
  const k = frameScaleOf(props);
  return (
    <AbsoluteFill style={{ background: filmBaseColor(definition, colors), fontFamily: fontStack(definition.fonts.body, 'sans-serif') }}>
      {scenes.map((s) => (
        <Sequence key={s.key} from={s.from} durationInFrames={s.frames}>
          <SceneView planned={s} colors={colors} definition={definition} language={props.language} />
        </Sequence>
      ))}
      {props.musicUrl ? (
        <Audio
          src={props.musicUrl}
          volume={(f) => interpolate(f, [0, fps, durationInFrames - fps * 1.5, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      ) : null}
      {props.watermark ? (
        // A dark translucent pill stays legible on light and dark templates alike.
        <div style={{ position: 'absolute', bottom: 32 * k, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(20,16,12,0.55)', color: '#ffffff', fontSize: 26 * k, padding: `${8 * k}px ${22 * k}px`, borderRadius: 999, letterSpacing: 0.5 * k }}>
            {createTranslator(props.language)('template.madeWith')} · bulava.in
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
