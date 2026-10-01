import { useEffect, useState, type CSSProperties } from 'react';
import { continueRender, delayRender, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CameraMove, EffectName, RenderContext, Scene, SceneNameValue, TemplateDefinition, ThemeColors } from '@bulava/template-schema';
import { backdropArt, backdropImageUrls, mix, rand } from '@bulava/template-engine';

/**
 * Illustrated scene behind a video scene, filmed with a camera move.
 *
 * The art is laid out at phone size (432 px wide, the size the website hero is
 * designed for) and scaled up to the frame, so proportions match the website.
 * Each layer moves by its depth: far layers barely drift, near ones move most,
 * which reads as a real camera travelling through the scene.
 */
const STAGE_WIDTH = 432;

type Backdrop = NonNullable<Scene['backdrop']>;

/**
 * Where a push or pull is centred. Most scenes zoom toward the art in the lower
 * half; scenes with a toran, drape or flower arch along the top zoom from higher
 * up so it stays in frame.
 */
const ZOOM_ORIGIN: Partial<Record<SceneNameValue, string>> = { toran: '50% 30%', mandap: '50% 35%', floral: '50% 30%' };

function cameraStyle(move: CameraMove, k: number, p: number, w: number, h: number, origin: string): CSSProperties {
  switch (move) {
    case 'push':
      return { transform: `scale(${1 + 0.18 * k * p})`, transformOrigin: origin };
    case 'pull':
      return { transform: `scale(${1 + 0.18 * k * (1 - p)})`, transformOrigin: origin };
    case 'panLeft':
    case 'panRight': {
      const dir = move === 'panLeft' ? 1 : -1;
      return { transform: `translateX(${dir * 0.22 * k * w * (p - 0.5)}px) scale(${1 + 0.04 * k})`, transformOrigin: '50% 100%' };
    }
    case 'rise':
      // The camera rises: the world sinks, near things fastest.
      return { transform: `translateY(${0.1 * k * h * p}px)` };
    case 'descend':
      // The camera settles: the scene rises into frame.
      return { transform: `translateY(${0.1 * k * h * (1 - p)}px)` };
    default:
      return {};
  }
}

/**
 * Hold rendering until painted layers have loaded and decoded: Remotion
 * captures a frame as soon as it renders, which would film an empty sky.
 * A layer that fails to load is logged and skipped rather than failing the render.
 */
function usePreloadedImages(urls: string[]) {
  const key = urls.join('|');
  const [handle] = useState(() => (urls.length ? delayRender('Loading painted artwork') : null));
  useEffect(() => {
    if (handle === null) return;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    void Promise.all(
      key.split('|').map(async (src) => {
        const img = new Image();
        img.src = src;
        try {
          await img.decode();
        } catch {
          console.warn(`Painted layer did not load: ${src.split('?')[0]}`);
        }
      }),
    ).then(release);
    return release;
  }, [handle, key]);
}

export function SceneBackdrop({
  backdrop,
  definition,
  ctx,
  colors,
  frames,
  monogram,
  photo,
}: {
  backdrop: Backdrop;
  definition: Pick<TemplateDefinition, 'artworks'>;
  ctx: Pick<RenderContext, 'assets'>;
  colors: ThemeColors;
  frames: number;
  monogram?: string;
  photo?: string;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  usePreloadedImages(backdropImageUrls(definition, backdrop, ctx));
  const scale = width / STAGE_WIDTH;
  const w = STAGE_WIDTH;
  const h = height / scale;
  const art = backdropArt(definition, backdrop, colors, { ctx, monogram, photo });
  const p = interpolate(frame, [0, Math.max(1, frames)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.33, 0, 0.25, 1) });
  if (!art) return null;
  const veilColor = art.dark ? mix(colors.primary, '#000000', 0.55) : colors.background;
  const origin = (backdrop.scene && ZOOM_ORIGIN[backdrop.scene]) || '50% 72%';
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0', overflow: 'hidden', background: art.background }}>
      {art.layers.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, ...cameraStyle(backdrop.camera, layer.depth * backdrop.intensity, p, w, h, origin) }}>
          {layer.node}
        </div>
      ))}
      {backdrop.veil ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, color-mix(in srgb, ${veilColor} ${Math.round(backdrop.veil * 100)}%, transparent) 0%, color-mix(in srgb, ${veilColor} ${Math.round(backdrop.veil * 60)}%, transparent) 45%, transparent 70%)`,
          }}
        />
      ) : null}
    </div>
  );
}

const MARIGOLD = ['#ffb300', '#ff8f00', '#f57c00', '#ffd54f'];

/**
 * Particles drawn as a pure function of the frame (Remotion renders frames in
 * any order, in parallel), matching the website's ambient effects.
 */
export function Particles({ effect, colors }: { effect: EffectName; colors: ThemeColors }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (effect === 'none') return null;
  const t = frame / fps;
  const s = width / STAGE_WIDTH;
  const count = { petals: 26, marigold: 30, goldDust: 60, fireflies: 28, confetti: 46, lanterns: 9, snow: 60, none: 0 }[effect];
  const palette =
    effect === 'petals'
      ? [colors.primary, colors.secondary, '#f8bbd0', '#f48fb1']
      : effect === 'marigold'
        ? MARIGOLD
        : effect === 'confetti'
          ? [colors.primary, colors.secondary, colors.accent, '#ffffff']
          : effect === 'fireflies'
            ? ['#fff59d', '#e6ee9c']
            : effect === 'snow'
              ? ['#ffffff']
              : [colors.accent, '#ffe7a3'];
  const rising = effect === 'goldDust' || effect === 'lanterns' || effect === 'fireflies';
  const span = height + 120 * s;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <defs>
        <radialGradient id="bulava-lantern-glow">
          <stop offset="0" stopColor="#ffc86e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffa03c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bulava-lantern-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset="1" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      {Array.from({ length: count }, (_, i) => {
        const r = (salt: number) => rand(i, salt + 101);
        const size = (effect === 'lanterns' ? 10 + r(1) * 8 : effect === 'goldDust' ? 1 + r(1) * 2.2 : effect === 'fireflies' ? 1.5 + r(1) * 2 : effect === 'snow' ? 1.5 + r(1) * 2.5 : 5 + r(1) * 6) * s;
        const speed = (rising ? 12 + r(2) * (effect === 'lanterns' ? 26 : 30) : 30 + r(2) * 54) * s;
        const travel = (r(3) * span + speed * t) % span;
        const y = rising ? height + 60 * s - travel : travel - 60 * s;
        const x = r(4) * width + Math.sin(t * (0.6 + r(5) * 0.6) + r(6) * 6.28) * 18 * s;
        const phase = r(7) * 6.28;
        const color = palette[Math.floor(r(8) * palette.length)]!;
        switch (effect) {
          case 'petals':
          case 'marigold': {
            const rot = r(9) * 360 + (r(10) - 0.5) * 160 * t;
            const flip = 0.55 + 0.45 * Math.sin(t * 2 + phase);
            return <ellipse key={i} cx={0} cy={0} rx={size} ry={size * (effect === 'petals' ? 0.62 : 0.45)} fill={color} opacity={0.85} transform={`translate(${x} ${y}) rotate(${rot}) scale(1 ${flip})`} />;
          }
          case 'confetti': {
            const rot = r(9) * 360 + (r(10) - 0.5) * 200 * t;
            const flip = Math.sin(t * 4 + phase);
            return <rect key={i} x={-size / 2} y={-size / 4} width={size} height={size / 2} fill={color} transform={`translate(${x} ${y}) rotate(${rot}) scale(1 ${flip})`} />;
          }
          case 'lanterns':
            return (
              <g key={i} transform={`translate(${x} ${y})`} opacity={0.85}>
                <circle r={size * 2.4} fill="url(#bulava-lantern-glow)" />
                <rect x={-size * 0.6} y={-size * 0.8} width={size * 1.2} height={size * 1.6} rx={size * 0.35} fill="url(#bulava-lantern-body)" />
              </g>
            );
          default: {
            const twinkle = effect === 'fireflies' || effect === 'goldDust' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 2.5 + phase)) : 0.9;
            return (
              <g key={i} opacity={twinkle}>
                {effect === 'snow' ? null : <circle cx={x} cy={y} r={size * 3.2} fill={color} opacity={0.18} />}
                <circle cx={x} cy={y} r={size} fill={color} />
              </g>
            );
          }
        }
      })}
    </svg>
  );
}
