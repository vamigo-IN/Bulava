import { z } from 'zod';
import { ConditionSchema, EFFECTS, FONT_FAMILIES, ORNAMENTS, PATTERNS, ValueSchema } from './base';

/**
 * Canvas sections: free-form artboards designed by hand in the Studio's Canvas
 * editor (docs/templates.md#canvas-sections). An artboard is a fixed design
 * frame in design units (CSS px at the design width, e.g. 390 wide for phones);
 * every layer is placed absolutely inside it. The renderer scales the whole
 * artboard to the viewer's width, so a composition keeps its proportions on
 * every screen. A canvas section always has a mobile artboard; a desktop
 * artboard is optional (without one, the mobile artboard is shown centred).
 */

/** The palette's names, usable wherever a colour is expected (they follow the host's colour choices). */
export const PALETTE_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Use a #RRGGBB or #RRGGBBAA colour');
const id = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/i, 'Use letters, numbers, - and _');

/** A colour: a hex value, one of the palette's names, or none. */
export const ColorRefSchema = z.union([hex, z.enum(PALETTE_KEYS), z.literal('transparent')]);
export type ColorRef = z.infer<typeof ColorRefSchema>;

export const GradientSchema = z.object({
  from: ColorRefSchema,
  to: ColorRefSchema,
  /** Degrees, CSS convention (180 = top to bottom). */
  angle: z.number().min(0).max(360).default(180),
});

/** What fills an artboard or a shape. */
export const FillSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('color'), color: ColorRefSchema }),
  z.object({ type: z.literal('gradient'), gradient: GradientSchema }),
  z.object({
    type: z.literal('pattern'),
    pattern: z.enum(PATTERNS.filter((p) => p !== 'none') as [string, ...string[]]),
    color: ColorRefSchema,
    /** The colour under the pattern. */
    base: ColorRefSchema,
    /** Pattern strength, 0–1. */
    strength: z.number().min(0).max(1).default(0.25),
  }),
  z.object({
    type: z.literal('image'),
    /** A licensed image asset (listed in the definition's `assets`). */
    assetId: z.uuid(),
    fit: z.enum(['cover', 'contain']).default('cover'),
    /** A tint over the image, for readable text (a colour with alpha, e.g. #00000066). */
    overlay: ColorRefSchema.optional(),
  }),
]);
export type Fill = z.infer<typeof FillSchema>;

// ─────────────────────────── Layers ───────────────────────────

/** Position and size in design units; rotation in degrees around the centre. */
export const FrameSchema = z.object({
  x: z.number().min(-4000).max(8000),
  y: z.number().min(-4000).max(8000),
  w: z.number().min(1).max(8000),
  h: z.number().min(1).max(8000),
  rotate: z.number().min(-360).max(360).default(0),
});
export type Frame = z.infer<typeof FrameSchema>;

/** Entrances play once when the section scrolls into view (never for reduced-motion users). */
export const LAYER_ENTRANCES = ['none', 'fade', 'fadeUp', 'fadeDown', 'zoomIn', 'slideLeft', 'slideRight', 'blurIn', 'pop'] as const;
/** Ambient loops drawn from the engine's existing motion vocabulary. */
export const LAYER_MOTIONS = ['none', 'float', 'sway', 'twinkle', 'spin', 'breathe'] as const;

export const LayerAnimationSchema = z.object({
  entrance: z.enum(LAYER_ENTRANCES).default('none'),
  delaySec: z.number().min(0).max(10).default(0),
  durationSec: z.number().min(0.1).max(6).default(0.8),
  motion: z.enum(LAYER_MOTIONS).default('none'),
});

const base = {
  id,
  /** Shown in the editor's layer list. */
  name: z.string().max(60).optional(),
  frame: FrameSchema,
  opacity: z.number().min(0).max(1).default(1),
  /** Editor only: a locked layer cannot be moved by accident. */
  locked: z.boolean().default(false),
  /** Kept in the design but not rendered. */
  hidden: z.boolean().default(false),
  visibleWhen: ConditionSchema.optional(),
  animation: LayerAnimationSchema.default({ entrance: 'none', delaySec: 0, durationSec: 0.8, motion: 'none' }),
};

export const TEXT_SHADOWS = ['none', 'soft', 'glow', 'hard'] as const;
export const TEXT_TRANSFORMS = ['none', 'upper', 'lower', 'capitalize'] as const;

export const TextStyleSchema = z.object({
  /** A theme role (follows the host's font pairing) or a fixed family. */
  font: z.union([z.enum(['heading', 'body', 'script']), z.enum(FONT_FAMILIES)]).default('body'),
  /** In design units (scales with the artboard). */
  size: z.number().min(6).max(600).default(24),
  weight: z.number().int().min(100).max(900).default(400),
  italic: z.boolean().default(false),
  color: ColorRefSchema.default('text'),
  align: z.enum(['left', 'center', 'right']).default('center'),
  valign: z.enum(['top', 'middle', 'bottom']).default('middle'),
  /** In em. */
  letterSpacing: z.number().min(-0.2).max(1).default(0),
  lineHeight: z.number().min(0.7).max(3).default(1.2),
  transform: z.enum(TEXT_TRANSFORMS).default('none'),
  shadow: z.enum(TEXT_SHADOWS).default('none'),
  /**
   * Nudge the colour toward readable (WCAG AA) on the artboard's background,
   * as the engine does for every template text. Off for decorative lettering.
   */
  contrast: z.boolean().default(true),
});

export const TextLayerSchema = z.object({
  ...base,
  kind: z.literal('text'),
  content: ValueSchema,
  style: TextStyleSchema.prefault({}),
  /** shrink: fit long names into the box; wrap: let lines grow; clip: cut off. */
  overflow: z.enum(['shrink', 'wrap', 'clip']).default('shrink'),
});

export const IMAGE_MASKS = ['none', 'rounded', 'circle', 'ellipse', 'arch', 'diamond', 'leaf'] as const;

export const ImageLayerSchema = z.object({
  ...base,
  kind: z.literal('image'),
  /** A licensed asset, or a photo the host placed (photo.*, photos[n]). */
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('asset'), assetId: z.uuid() }),
    z.object({ type: z.literal('binding'), binding: z.string().regex(/^[a-zA-Z]\w*(\[\d+\])?(\.\w+(\[\d+\])?)*$/).max(120) }),
  ]),
  fit: z.enum(['cover', 'contain']).default('cover'),
  mask: z.enum(IMAGE_MASKS).default('none'),
  /** Corner radius in design units (mask "rounded"). */
  radius: z.number().min(0).max(1000).default(0),
  border: z.object({ width: z.number().min(0).max(100), color: ColorRefSchema }).optional(),
  shadow: z.boolean().default(false),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  /** 0.2–2, 1 = unchanged. */
  brightness: z.number().min(0.2).max(2).default(1),
  saturate: z.number().min(0).max(2).default(1),
  /** Hide the layer rather than show a broken frame when a bound photo is missing (always true for bindings). */
  alt: z.string().max(120).optional(),
});

export const SHAPES = ['rect', 'ellipse', 'line', 'arch', 'diamond', 'triangle', 'star', 'heart', 'scallop'] as const;

export const ShapeLayerSchema = z.object({
  ...base,
  kind: z.literal('shape'),
  shape: z.enum(SHAPES),
  fill: FillSchema.default({ type: 'color', color: 'primary' }),
  stroke: z.object({ width: z.number().min(0).max(100), color: ColorRefSchema, dash: z.number().min(0).max(100).default(0) }).optional(),
  /** Corner radius for rectangles, in design units. */
  radius: z.number().min(0).max(1000).default(0),
  shadow: z.boolean().default(false),
});

/** Decorations the engine draws itself (no assets to license). */
export const ORNAMENT_LAYERS = [
  ...ORNAMENTS.filter((o) => o !== 'none'),
  'toran',
  'marigoldStrand',
  'diya',
  'kalash',
  'lantern',
  'crescent',
  'peacockFeather',
  'roseWindow',
  'gothicArch',
  'crest',
  'gateLeaf',
  'archFrame',
  'templeBorder',
  'seaWaves',
] as const;
export type OrnamentLayerName = (typeof ORNAMENT_LAYERS)[number];

export const OrnamentLayerSchema = z.object({
  ...base,
  kind: z.literal('ornament'),
  ornament: z.enum(ORNAMENT_LAYERS),
  color: ColorRefSchema.default('secondary'),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

/** Small line icons for detail rows and buttons (drawn by the engine). */
export const ICONS = ['calendar', 'clock', 'pin', 'heart', 'rings', 'music', 'camera', 'gift', 'phone', 'mail', 'sparkle', 'star', 'car', 'bed', 'dinner', 'flower', 'bell', 'diya', 'navigation'] as const;
export type IconName = (typeof ICONS)[number];

export const IconLayerSchema = z.object({
  ...base,
  kind: z.literal('icon'),
  icon: z.enum(ICONS),
  color: ColorRefSchema.default('primary'),
  /** A filled circle behind the icon (the detail-row look). */
  circle: ColorRefSchema.optional(),
  /** Stroke width in design units at a 24-unit icon (1–3). */
  weight: z.number().min(1).max(3).default(1.75),
});

export const BUTTON_ACTIONS = ['directions', 'calendar', 'rsvp', 'link', 'top'] as const;

/** Readymade pieces: the live countdown, buttons and the date/time/venue rows. */
export const WidgetLayerSchema = z.object({
  ...base,
  kind: z.literal('widget'),
  widget: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('countdown'),
      variant: z.enum(['boxes', 'flip', 'inline']).default('boxes'),
      /** Text and label colours; boxes take the surface colour. */
      color: ColorRefSchema.default('primary'),
      labelColor: ColorRefSchema.default('muted'),
      boxColor: ColorRefSchema.default('surface'),
      size: z.number().min(10).max(200).default(28),
      font: z.union([z.enum(['heading', 'body', 'script']), z.enum(FONT_FAMILIES)]).default('heading'),
    }),
    z.object({
      type: z.literal('button'),
      label: ValueSchema,
      action: z.enum(BUTTON_ACTIONS).default('directions'),
      /** For action "link": the address, or a binding such as venue.mapUrl. */
      url: ValueSchema.optional(),
      /** For action "rsvp": the id of the section to scroll to (default: the first RSVP section). */
      target: z.string().max(64).optional(),
      icon: z.enum(ICONS).optional(),
      fill: ColorRefSchema.default('primary'),
      color: ColorRefSchema.default('background'),
      font: z.union([z.enum(['heading', 'body', 'script']), z.enum(FONT_FAMILIES)]).default('body'),
      size: z.number().min(8).max(120).default(15),
      weight: z.number().int().min(100).max(900).default(600),
      radius: z.number().min(0).max(500).default(999),
      border: z.object({ width: z.number().min(0).max(20), color: ColorRefSchema }).optional(),
      shadow: z.boolean().default(true),
    }),
    z.object({
      type: z.literal('details'),
      rows: z.array(z.enum(['date', 'time', 'venue', 'address', 'city'])).min(1).max(5).default(['date', 'time', 'venue']),
      icons: z.boolean().default(true),
      iconColor: ColorRefSchema.default('primary'),
      iconCircle: ColorRefSchema.optional(),
      labelColor: ColorRefSchema.default('muted'),
      valueColor: ColorRefSchema.default('text'),
      labelSize: z.number().min(6).max(60).default(10),
      valueSize: z.number().min(8).max(120).default(15),
      font: z.union([z.enum(['heading', 'body', 'script']), z.enum(FONT_FAMILIES)]).default('body'),
      /** A hairline between rows. */
      dividers: z.boolean().default(true),
      dividerColor: ColorRefSchema.default('muted'),
    }),
  ]),
});

export const LayerSchema = z.discriminatedUnion('kind', [TextLayerSchema, ImageLayerSchema, ShapeLayerSchema, OrnamentLayerSchema, IconLayerSchema, WidgetLayerSchema]);
export type Layer = z.infer<typeof LayerSchema>;
export type LayerInput = z.input<typeof LayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;
export type OrnamentLayer = z.infer<typeof OrnamentLayerSchema>;
export type IconLayer = z.infer<typeof IconLayerSchema>;
export type WidgetLayer = z.infer<typeof WidgetLayerSchema>;
export type LayerKind = Layer['kind'];

// ─────────────────────────── Artboards ───────────────────────────

export const ArtboardSchema = z.object({
  /** Design units; the phone artboard is usually 390 wide, the desktop one 1440. */
  width: z.number().int().min(200).max(4000),
  height: z.number().int().min(100).max(8000),
  background: FillSchema.default({ type: 'color', color: 'background' }),
  /** Ambient particles over this artboard (website only). */
  effect: z.enum(EFFECTS).default('none'),
  /** Bottom to top. */
  layers: z.array(LayerSchema).max(120).default([]),
});
export type Artboard = z.infer<typeof ArtboardSchema>;
export type ArtboardInput = z.input<typeof ArtboardSchema>;

export const CanvasSectionSchema = z.object({
  mobile: ArtboardSchema,
  /** A separate composition for wide screens; without it the mobile artboard is shown centred. */
  desktop: ArtboardSchema.optional(),
  /** Without a desktop artboard: how wide the mobile artboard may grow on wide screens (CSS px). */
  desktopMaxWidth: z.number().int().min(320).max(1200).default(480),
  /** Render the artboard once per function the viewer may see, with function.* bound to each. */
  repeatPerFunction: z.boolean().default(false),
});
export type CanvasSection = z.infer<typeof CanvasSectionSchema>;
export type CanvasSectionInput = z.input<typeof CanvasSectionSchema>;

/** The phone artboard most designs start from (CSS px of a common phone). */
export const DEFAULT_MOBILE_ARTBOARD = { width: 390, height: 844 } as const;
export const DEFAULT_DESKTOP_ARTBOARD = { width: 1440, height: 900 } as const;

/** Every licensed asset an artboard shows (image layers and image backgrounds). */
export function artboardAssetIds(board: Artboard): string[] {
  const ids: string[] = [];
  if (board.background.type === 'image') ids.push(board.background.assetId);
  for (const layer of board.layers) {
    if (layer.kind === 'image' && layer.source.type === 'asset') ids.push(layer.source.assetId);
    if (layer.kind === 'shape' && layer.fill.type === 'image') ids.push(layer.fill.assetId);
  }
  return ids;
}

export function canvasAssetIds(canvas: CanvasSection): string[] {
  return [...new Set([...artboardAssetIds(canvas.mobile), ...(canvas.desktop ? artboardAssetIds(canvas.desktop) : [])])];
}

// ─────────────────────────── Colours behind text ───────────────────────────

/** The palette, by role (structurally the theme's colours). */
export type PaletteColors = Record<PaletteKey, string>;

/** A colour reference as #rrggbb, or null when it has no single solid colour (transparent, or alpha). */
export function solidColorOf(ref: ColorRef, colors: PaletteColors): string | null {
  if (ref === 'transparent') return null;
  if (ref.startsWith('#')) return ref.length === 7 ? ref : ref.length === 9 && ref.slice(7).toLowerCase() === 'ff' ? ref.slice(0, 7) : null;
  return colors[ref as PaletteKey] ?? null;
}

/** The solid colours a fill paints, or null when text over it cannot be checked (images, see-through fills). */
export function fillSolidColors(fill: Fill, colors: PaletteColors): string[] | null {
  switch (fill.type) {
    case 'color': {
      const c = solidColorOf(fill.color, colors);
      return c ? [c] : null;
    }
    case 'gradient': {
      const a = solidColorOf(fill.gradient.from, colors);
      const b = solidColorOf(fill.gradient.to, colors);
      return a && b ? [a, b] : null;
    }
    case 'pattern': {
      const c = solidColorOf(fill.base, colors);
      return c ? [c] : null;
    }
    default:
      return null;
  }
}

const covers = (a: Frame, b: Frame, tolerance = 2) => a.x - tolerance <= b.x && a.y - tolerance <= b.y && a.x + a.w + tolerance >= b.x + b.w && a.y + a.h + tolerance >= b.y + b.h;

/**
 * What is behind a layer, for contrast: the nearest lower layer that covers its
 * frame (a solid shape gives its colours; a photo or image fill means unknown),
 * else the artboard's own fill. Text on a card or a date pill is checked against
 * the card, not the page.
 */
export function layerBackdrop(board: Pick<Artboard, 'background' | 'layers'>, index: number, colors: PaletteColors): string[] | null {
  const target = board.layers[index];
  if (!target) return fillSolidColors(board.background, colors);
  for (let i = index - 1; i >= 0; i--) {
    const below = board.layers[i]!;
    if (below.hidden || !covers(below.frame, target.frame)) continue;
    if (below.kind === 'image') return null;
    if (below.kind === 'shape' && below.shape !== 'line' && below.opacity >= 0.85) {
      if (below.fill.type === 'none') continue;
      if (below.fill.type === 'image') return null;
      const solid = fillSolidColors(below.fill, colors);
      if (solid) return solid;
    }
  }
  return fillSolidColors(board.background, colors);
}
