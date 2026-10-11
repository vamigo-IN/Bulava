import { z } from 'zod';
import { ArtboardSchema, LayerSchema, type Artboard, type Layer, type LayerInput } from './canvas';
import type { Element, Scene, TemplateDefinition } from './definition';

/**
 * A host's own design of a film's scenes (ADR-059): for each scene they
 * redrew in the film's canvas editor, its board. A scene drawn from a canvas
 * (a canvas film) keeps its board's size; a scene of elements becomes a 9:16
 * board over its illustrated backdrop. The video engine films the host's
 * board in place of the scene's own.
 */

/** 9:16, the size a film scene is designed at (1080 × 1920 is 2.4 times this). */
export const FILM_BOARD = { width: 450, height: 800 } as const;
/** Film frames to board units. */
const K = FILM_BOARD.width / 1080;

/** Scenes one film may redraw. */
export const SCENE_CUSTOM_MAX = 30;

export const SceneOverrideSchema = z.object({ board: ArtboardSchema });
export type SceneOverride = z.infer<typeof SceneOverrideSchema>;

export const SceneCustomizationSchema = z
  .record(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), SceneOverrideSchema)
  .refine((v) => Object.keys(v).length <= SCENE_CUSTOM_MAX, { message: `At most ${SCENE_CUSTOM_MAX} scenes` });
export type SceneCustomization = z.infer<typeof SceneCustomizationSchema>;

/** Film entrances as the nearest canvas entrance (the film's own effects that canvases do not have). */
const ENTRANCE: Record<string, Layer['animation']['entrance']> = {
  none: 'none',
  fade: 'fade',
  fadeUp: 'fadeUp',
  fadeDown: 'fadeDown',
  zoomIn: 'zoomIn',
  zoomOut: 'zoomIn',
  slideLeft: 'slideLeft',
  slideRight: 'slideRight',
  typewriter: 'fade',
  float: 'fadeUp',
  blurIn: 'blurIn',
  tracking: 'fade',
  reveal: 'fadeUp',
  bloom: 'pop',
  shine: 'fade',
};

/** Film ornaments under their canvas names. */
const ORNAMENT: Record<string, string> = { bell: 'templeBells' };

const round = (n: number) => Math.round(n * 10) / 10;

/** One film element as a canvas layer, or null when it has no canvas equivalent. */
function layerOf(el: Element): LayerInput | null {
  const f = el.frame;
  const frame = { x: round(f.x * K), y: round(f.y * K), w: Math.max(1, round(f.w * K)), h: Math.max(1, round(f.h * K)), rotate: f.rotate };
  const anim = el.animation.in;
  const animation = anim ? { entrance: ENTRANCE[anim.type] ?? 'fade', delaySec: anim.delaySec, durationSec: Math.min(3, anim.durationSec) } : undefined;
  const s = el.style;
  const common = { id: el.id, frame, opacity: s.opacity, ...(animation ? { animation } : {}) };
  if (el.kind === 'text') {
    if (!el.content) return null;
    return {
      ...common,
      kind: 'text',
      content: el.content,
      overflow: el.overflow === 'wrap' ? 'wrap' : 'shrink',
      style: {
        font: s.font,
        size: round(s.fontSize * K),
        weight: s.fontWeight,
        color: s.color,
        align: s.align,
        lineHeight: s.lineHeight,
        // Films space letters in pixels, canvases in ems.
        letterSpacing: Math.max(-0.1, Math.min(0.6, round((s.letterSpacing / Math.max(1, s.fontSize)) * 100) / 100)),
        shadow: s.shadow ?? 'none',
        // The film's sweep of light across gold names becomes gold foil.
        foil: anim?.type === 'shine',
      },
    };
  }
  if (el.kind === 'ornament') {
    const raw = el.content && 'literal' in el.content ? String(el.content.literal) : 'mandala';
    return { ...common, kind: 'ornament', ornament: (ORNAMENT[raw] ?? raw) as never, color: s.color };
  }
  if (el.kind === 'shape') {
    return { ...common, kind: 'shape', shape: 'rect', fill: { type: 'color', color: s.fill ?? 'surface' }, radius: round(s.radius * K) };
  }
  // Photos: only the photo bindings (the host's own photos).
  if (!el.content || !('binding' in el.content)) return null;
  return {
    ...common,
    kind: 'image',
    source: { type: 'binding', binding: el.content.binding },
    fit: 'cover',
    mask: s.mask === 'arch' ? 'arch' : s.mask === 'circle' ? 'circle' : 'rounded',
    radius: round(s.radius * K),
    ...(s.border ? { border: { width: Math.max(2, Math.round(f.w * K * 0.012)), color: s.border } } : {}),
    alt: '',
  };
}

/**
 * A scene as a board the canvas editor can show: a canvas film's own board,
 * or the scene's elements laid out on a 9:16 board (transparent over the
 * scene's backdrop, else on the scene's background).
 */
export function sceneBoard(scene: Scene): Artboard {
  if (scene.canvas) return scene.canvas.board;
  const layers: Layer[] = [];
  for (const el of scene.elements) {
    const input = layerOf(el);
    if (!input) continue;
    const parsed = LayerSchema.safeParse(input);
    if (parsed.success) layers.push(parsed.data);
  }
  const background = scene.backdrop
    ? ({ type: 'none' } as const)
    : scene.background === 'gradient'
      ? ({ type: 'gradient', gradient: { kind: 'linear', from: 'primary', to: 'secondary', angle: 160 } } as const)
      : ({ type: 'color', color: scene.background } as const);
  return ArtboardSchema.parse({ width: FILM_BOARD.width, height: FILM_BOARD.height, background, layers });
}

/** The size a scene's board must keep. */
export const sceneBoardSize = (scene: Scene): { width: number; height: number } =>
  scene.canvas ? { width: scene.canvas.board.width, height: scene.canvas.board.height } : FILM_BOARD;

/** The film with the host's boards in place of their scenes' own, where they still fit. */
export function withSceneCustomization<D extends Pick<TemplateDefinition, 'scenes'>>(definition: D, scenes: SceneCustomization | undefined | null): D {
  if (!scenes || !definition.scenes || Object.keys(scenes).length === 0) return definition;
  return {
    ...definition,
    scenes: definition.scenes.map((scene) => {
      const mine = scenes[scene.id];
      const size = sceneBoardSize(scene);
      if (!mine || mine.board.width !== size.width || mine.board.height !== size.height) return scene;
      // A canvas film's scene keeps its camera; a scene of elements keeps its backdrop's camera, and the words stay still over it.
      const canvas = scene.canvas ? { ...scene.canvas, board: mine.board } : { board: mine.board, stagger: 0.14, camera: 'still' as const, intensity: 0 };
      return { ...scene, canvas, elements: [] };
    }),
  };
}

/** Keeps only the boards this film can take: scenes it still has, at their sizes. */
export function fittingSceneCustomization(definition: Pick<TemplateDefinition, 'scenes'>, scenes: SceneCustomization | undefined | null): SceneCustomization | undefined {
  if (!scenes) return undefined;
  const byId = new Map((definition.scenes ?? []).map((s) => [s.id, s]));
  const kept: SceneCustomization = {};
  for (const [id, mine] of Object.entries(scenes)) {
    const scene = byId.get(id);
    if (!scene) continue;
    const size = sceneBoardSize(scene);
    if (mine.board.width === size.width && mine.board.height === size.height) kept[id] = mine;
  }
  return Object.keys(kept).length ? kept : undefined;
}
