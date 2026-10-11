import { useMemo, type CSSProperties } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTranslator } from '@bulava/localization';
import type { Artboard, CameraMove, Fonts, Layer, RenderContext, SceneCanvas, TemplateDefinition, ThemeColors } from '@bulava/template-schema';
import { CanvasArtboard, fillStyle, TemplateStyles, themeStyle } from '@bulava/template-engine';

/**
 * A canvas artboard filmed as a scene (ADR-058). The board fills the frame's
 * width (a 9:16 board fills it exactly), its layers enter one after another
 * (top to bottom, or in the order of their own delays) and the camera drifts
 * over it. Everything follows the frame number: CSS animations do not follow
 * Remotion's clock, so the artboard is drawn still and each layer is moved here.
 */

type Entrance = Layer['animation']['entrance'];

/** How a layer comes in when its designer chose nothing: words rise, photos open, art fades in; what covers the board is there from the start. */
function entranceOf(layer: Layer, board: Artboard): Entrance {
  if (layer.animation.entrance !== 'none') return layer.animation.entrance;
  const covers = layer.frame.w >= board.width * 0.85 && layer.frame.h >= board.height * 0.85;
  if (covers) return 'none';
  if (layer.kind === 'text' || layer.kind === 'widget') return 'fadeUp';
  if (layer.kind === 'image') return 'zoomIn';
  return 'fade';
}

/** Pieces made for websites (buttons, the live countdown) have no place in a film; the date, time and venue rows do. */
function filmOmits(board: Artboard): Set<string> {
  return new Set(board.layers.filter((l) => l.kind === 'widget' && l.widget.type !== 'details').map((l) => l.id));
}

function entranceStyle(entrance: Entrance, q: number): CSSProperties {
  const settled = q >= 1;
  switch (entrance) {
    case 'fade':
      return { opacity: q };
    case 'fadeUp':
      return { opacity: q, transform: settled ? undefined : `translateY(${(1 - q) * 4}cqw)` };
    case 'fadeDown':
      return { opacity: q, transform: settled ? undefined : `translateY(${(q - 1) * 4}cqw)` };
    case 'zoomIn':
      return { opacity: q, transform: settled ? undefined : `scale(${0.86 + 0.14 * q})` };
    case 'slideLeft':
      return { opacity: q, transform: settled ? undefined : `translateX(${(1 - q) * 8}cqw)` };
    case 'slideRight':
      return { opacity: q, transform: settled ? undefined : `translateX(${(q - 1) * 8}cqw)` };
    case 'blurIn':
      return { opacity: q, filter: settled ? undefined : `blur(${(1 - q) * 14}px)`, transform: settled ? undefined : `scale(${1.06 - 0.06 * q})` };
    case 'pop': {
      // A little overshoot, like a stamp.
      const s = q < 0.7 ? interpolate(q, [0, 0.7], [0.6, 1.06]) : interpolate(q, [0.7, 1], [1.06, 1]);
      return { opacity: Math.min(1, q * 1.6), transform: settled ? undefined : `scale(${s})` };
    }
    default:
      return {};
  }
}

function cameraStyle(move: CameraMove, k: number, p: number): CSSProperties {
  switch (move) {
    case 'push':
      return { transform: `scale(${1 + 0.07 * k * p})` };
    case 'pull':
      return { transform: `scale(${1 + 0.07 * k * (1 - p)})` };
    case 'panLeft':
      return { transform: `translateX(${(0.5 - p) * 4 * k}%) scale(${1 + 0.05 * k})` };
    case 'panRight':
      return { transform: `translateX(${(p - 0.5) * 4 * k}%) scale(${1 + 0.05 * k})` };
    case 'rise':
      return { transform: `translateY(${p * 3 * k}%) scale(${1 + 0.04 * k})` };
    case 'descend':
      return { transform: `translateY(${(1 - p) * 3 * k}%) scale(${1 + 0.04 * k})` };
    default:
      return {};
  }
}

export function CanvasScene({
  canvas,
  ctx,
  colors,
  fonts,
  theme,
  language,
  frames,
}: {
  canvas: SceneCanvas;
  ctx: RenderContext;
  colors: ThemeColors;
  fonts: Fonts;
  theme: TemplateDefinition['theme'];
  language: string;
  frames: number;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const board = canvas.board;
  const t = useMemo(() => createTranslator(language), [language]);
  const omit = useMemo(() => filmOmits(board), [board]);

  // When each layer starts, in seconds: the layers' own delays when any are set, else top to bottom.
  const starts = useMemo(() => {
    const moving = board.layers.filter((l) => !omit.has(l.id) && entranceOf(l, board) !== 'none');
    const own = moving.some((l) => l.animation.delaySec > 0);
    const sorted = [...moving].sort((a, b) => (own ? a.animation.delaySec - b.animation.delaySec : a.frame.y - b.frame.y || a.frame.x - b.frame.x));
    return new Map(sorted.map((l, i) => [l.id, own ? 0.3 + l.animation.delaySec : 0.35 + i * canvas.stagger]));
  }, [board, omit, canvas.stagger]);

  const layerStyle = (layer: Layer): CSSProperties | undefined => {
    const start = starts.get(layer.id);
    if (start === undefined) return undefined;
    const from = start * fps;
    const to = from + Math.max(0.4, Math.min(1.6, layer.animation.durationSec || 0.9)) * fps;
    const q = interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    return entranceStyle(entranceOf(layer, board), q);
  };

  const scale = Math.min(width / board.width, height / board.height);
  const p = frames > 1 ? Math.min(1, frame / (frames - 1)) : 1;
  const boardWidth = board.width * scale;
  const boardHeight = board.height * scale;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...(board.background.type === 'none' ? {} : fillStyle(board.background, colors, ctx, 2400)) }}>
      <TemplateStyles />
      <div
        style={{
          position: 'absolute',
          left: (width - boardWidth) / 2,
          top: (height - boardHeight) / 2,
          width: boardWidth,
          height: boardHeight,
          transformOrigin: '50% 45%',
          ...cameraStyle(canvas.camera, canvas.intensity, Easing.inOut(Easing.sin)(p)),
        }}
      >
        <div className="bulava-template" lang={language} style={{ ...themeStyle(theme, colors, fonts), width: '100%', backgroundColor: 'transparent' }}>
          <CanvasArtboard board={board} ctx={ctx} colors={colors} fonts={fonts} t={t} language={language} timeZone={ctx.event.timezone} mode="edit" omit={omit} layerStyle={layerStyle} />
        </div>
      </div>
    </div>
  );
}
