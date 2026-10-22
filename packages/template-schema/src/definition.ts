import { z } from 'zod';
import { ConditionSchema, EFFECTS, FONT_FAMILIES, hex, id, ORNAMENTS, PATTERNS, SCENE_NAMES, STAGE_NAMES, STAGE_SHOTS, SUITE_CORNERS, SUITE_DIVIDERS, SUITE_EDGES, SUITE_FRAMES, SUITE_SEALS, SUITE_SKYLINES, ValueSchema } from './base';
import { ArtboardSchema, CanvasSectionSchema } from './canvas';
import { FAITHS } from './faith';

export { ConditionSchema, DARK_SCENE_NAMES, EFFECTS, FONT_FAMILIES, ORNAMENTS, PATTERNS, SCENE_NAMES, SUITE_CORNERS, SUITE_DIVIDERS, SUITE_EDGES, SUITE_FRAMES, SUITE_SEALS, SUITE_SKYLINES, VALUE_FORMATS, ValueSchema, type OrnamentNameValue, type SceneNameValue } from './base';
export { DARK_STAGE_NAMES, STAGE_META, STAGE_NAMES, STAGE_SHOTS, type StageMeta, type StageNameValue, type StageShot } from './base';
export type { SuiteCorner, SuiteDivider, SuiteEdge, SuiteFrame, SuiteSeal, SuiteSkyline } from './base';
export type { Condition, EffectName, FontFamily, Value } from './base';

/**
 * TemplateDefinition v1: the JSON document stored in TemplateVersion.definition.
 * Templates are data; one generic renderer per output type interprets them.
 * See docs/templates.md.
 */

export const TEMPLATE_TYPES = ['WEBSITE', 'VIDEO', 'DIGITAL_CARD', 'EMAIL', 'SOCIAL'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

// ─────────────────────────── Theme & fonts ───────────────────────────

export const ThemeColorsSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  background: hex,
  surface: hex,
  text: hex,
  muted: hex,
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

/**
 * Design languages. A look restyles every section (backgrounds, headings,
 * cards, dividers), so two templates with different looks differ all the way
 * down the page, not only in the hero. Colours still come from the palette.
 *  classic     – calm cream pages with hairline ornaments (the original style)
 *  heritage    – bold colour bands, marigold torans, rangoli, gold script headings
 *  noir        – black and gold, glass cards, spotlight glow, italic serif
 *  royal       – jewel tones, gold filigree frames and arches
 *  garden      – pastel florals, soft washes, rounded cards
 *  celebration – bright bands, confetti edges, playful type
 *  modern      – editorial: large type, rules and numbers
 */
export const LOOKS = ['classic', 'heritage', 'noir', 'royal', 'garden', 'celebration', 'modern'] as const;
export type LookName = (typeof LOOKS)[number];
/** Camera moves through a video backdrop; near layers move more than far ones. */
export const CAMERA_MOVES = ['still', 'push', 'pull', 'panLeft', 'panRight', 'rise', 'descend'] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];
/** Named places a customer can put their own photos. */
export const PHOTO_SLOTS = ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
/** Opening animations played before a website invitation is revealed. */
export const INTROS = ['none', 'envelope', 'curtain', 'doors', 'gates', 'seal', 'lanterns', 'petals', 'celestial', 'scratch', 'zipper', 'ribbon', 'arrival', 'doorway', 'silk', 'unfold'] as const;
export type IntroName = (typeof INTROS)[number];
/** Openings that move through a stage hero (ADR-078): only a template whose first section is a stage hero takes them. */
export const STAGE_INTROS = ['arrival', 'doorway', 'silk', 'unfold'] as const;
export type StageIntro = (typeof STAGE_INTROS)[number];
export const isStageIntro = (n: string | undefined): n is StageIntro => !!n && (STAGE_INTROS as readonly string[]).includes(n);
/** Motion below the hero: 'stage' turns on 3D section entrances, pointer tilt and the depth gallery (ADR-078). */
export const THEME_MOTIONS = ['stage'] as const;
export type ThemeMotion = (typeof THEME_MOTIONS)[number];

/** A suite's pieces a theme swaps (base.ts SUITE_*): no defaults, so an omitted piece stays the suite's own. */
export const ThemeDressSchema = z
  .object({
    frame: z.enum(SUITE_FRAMES).optional(),
    edge: z.enum(SUITE_EDGES).optional(),
    seal: z.enum(SUITE_SEALS).optional(),
    skyline: z.enum(SUITE_SKYLINES).optional(),
    corner: z.enum(SUITE_CORNERS).optional(),
    divider: z.enum(SUITE_DIVIDERS).optional(),
  })
  .strict();
export type ThemeDress = z.infer<typeof ThemeDressSchema>;

export const ThemeSchema = z.object({
  colors: ThemeColorsSchema,
  radius: z.number().int().min(0).max(48).default(16),
  /** Decorative motif rendered by the engine (no external asset needed), and the suite every section below the hero is dressed in. */
  ornament: z.enum(ORNAMENTS).default('none'),
  /** Pieces of the suite swapped for others (docs/templates.md#section-suites); unset pieces are the suite's own. */
  dress: ThemeDressSchema.optional(),
  /** Optional background pattern. */
  pattern: z.enum(PATTERNS).default('none'),
  /** dark = hero on the primary colour with gold/champagne type (luxury look). */
  heroTone: z.enum(['light', 'dark']).default('light'),
  /** Design language applied to every section. */
  look: z.enum(LOOKS).default('classic'),
  /** Default ambient effect (customers may change it when animation is editable). */
  effect: z.enum(EFFECTS).default('none'),
  /**
   * The tradition the design belongs to, when it is clearly one family's (a
   * nikah under a mihrab, an Anand Karaj, a church wedding, Hindu rituals):
   * previews show names of that tradition and the hero wears its emblem
   * (the hero's `emblem` prop, or an emblem layer on a canvas). Unset for designs
   * that suit every family.
   */
  faith: z.enum(FAITHS).optional(),
  /** Motion below the hero: 'stage' turns on 3D entrances, pointer tilt and the depth gallery. Unset: today's motion. */
  motion: z.enum(THEME_MOTIONS).optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const FontRefSchema = z.object({
  family: z.enum(FONT_FAMILIES),
  /** ISO 15924 scripts the family covers. */
  scripts: z.array(z.string().regex(/^[A-Z][a-z]{3}$/)).min(1),
  /** Fallback family per script, e.g. {"Deva":"Noto Serif Devanagari"}. */
  fallbacks: z.record(z.string(), z.enum(FONT_FAMILIES)).default({}),
});
export type FontRef = z.infer<typeof FontRefSchema>;

export const FontsSchema = z.object({
  heading: FontRefSchema,
  body: FontRefSchema,
  script: FontRefSchema.optional(),
});
export type Fonts = z.infer<typeof FontsSchema>;

// ─────────────────────────── Capabilities ───────────────────────────

export const CapabilitiesSchema = z.object({
  editable: z.object({
    colors: z.boolean().default(false),
    fonts: z.boolean().default(false),
    music: z.boolean().default(false),
    background: z.boolean().default(false),
    layout: z.boolean().default(false),
    photos: z.boolean().default(false),
    text: z.boolean().default(false),
    animation: z.boolean().default(false),
  }),
  /** Allowed palettes when colors are editable. Empty = free choice. */
  colorPresets: z.array(z.object({ name: z.string().max(40), colors: ThemeColorsSchema })).max(12).default([]),
  /** Custom text slots (custom.<key>) the customer may fill when text is editable. */
  textSlots: z
    .array(z.object({ key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/), label: z.string().max(60), maxLength: z.number().int().min(1).max(2000) }))
    .max(20)
    .default([]),
  maxPhotos: z.number().int().min(0).max(50).default(0),
  /** Named photo places this template shows (cover, each partner, story, closing). */
  photoSlots: z.array(z.enum(PHOTO_SLOTS)).max(PHOTO_SLOTS.length).default([]),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

// ─────────────────────────── Website ───────────────────────────

export const SECTION_KEYS = [
  'hero',
  'couple',
  'parents',
  'story',
  'countdown',
  'eventTimeline',
  'gallery',
  'venue',
  'map',
  'rsvp',
  'family',
  'accommodation',
  'travel',
  'giftRegistry',
  'announcements',
  'photoShare',
  'menu',
  'quote',
  'footer',
  /** A free-form artboard designed in the Canvas editor (see canvas.ts). */
  'canvas',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SectionInstanceSchema = z
  .object({
    id,
    section: z.enum(SECTION_KEYS),
    variant: z.string().regex(/^[a-z][a-zA-Z0-9-]*$/).max(40).default('default'),
    props: z.record(z.string(), ValueSchema).default({}),
    visibleWhen: ConditionSchema.optional(),
    /** The artboards of a "canvas" section (and nothing else). */
    canvas: z.lazy(() => CanvasSectionSchema).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.section === 'canvas' && !s.canvas) ctx.addIssue({ code: 'custom', path: ['canvas'], message: 'A canvas section needs its artboards' });
    if (s.section !== 'canvas' && s.canvas) ctx.addIssue({ code: 'custom', path: ['canvas'], message: 'Only canvas sections carry artboards' });
  });
export type SectionInstance = z.infer<typeof SectionInstanceSchema>;

export const WebsitePageSchema = z.object({
  id,
  sections: z.array(SectionInstanceSchema).min(1).max(40),
});

// ─────────────────────────── Video / card ───────────────────────────

/**
 * Element entrances in videos. blurIn: out of focus into focus; tracking: wide
 * letter spacing settling in; reveal: wiped up from a baseline; bloom: an
 * ornament turning and opening; shine: a gold light sweeping across; flipUp:
 * a line turns up from rotateX(-80°) with a foil sheen; coin: turns about Y.
 */
export const ANIMATIONS = ['none', 'fade', 'fadeUp', 'fadeDown', 'zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'typewriter', 'float', 'blurIn', 'tracking', 'reveal', 'bloom', 'shine', 'flipUp', 'coin'] as const;

export const AnimationSchema = z.object({
  type: z.enum(ANIMATIONS),
  durationSec: z.number().min(0.1).max(10).default(0.8),
  delaySec: z.number().min(0).max(30).default(0),
});

export const ElementSchema = z.object({
  id,
  kind: z.enum(['text', 'image', 'shape', 'ornament', 'photo']),
  frame: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
    rotate: z.number().min(-360).max(360).default(0),
  }),
  /** Text / image source / shape colour, usually a binding. */
  content: ValueSchema.optional(),
  style: z
    .object({
      font: z.enum(['heading', 'body', 'script']).default('body'),
      fontSize: z.number().min(8).max(400).default(48),
      fontWeight: z.number().int().min(100).max(900).default(400),
      color: z.union([hex, z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'])]).default('text'),
      align: z.enum(['left', 'center', 'right']).default('center'),
      letterSpacing: z.number().min(-5).max(40).default(0),
      lineHeight: z.number().min(0.8).max(3).default(1.2),
      opacity: z.number().min(0).max(1).default(1),
      radius: z.number().min(0).max(1000).default(0),
      fill: z.union([hex, z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'])]).optional(),
      /** Image and photo shapes: a palace arch (jharokha) or a circle. */
      mask: z.enum(['arch', 'circle']).optional(),
      /** Image and photo frames: a gold border in this colour. */
      border: z.union([hex, z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'])]).optional(),
      /** Text over artwork: a soft shadow or a warm glow keeps it legible. */
      shadow: z.enum(['soft', 'glow']).optional(),
    })
    .default({ font: 'body', fontSize: 48, fontWeight: 400, color: 'text', align: 'center', letterSpacing: 0, lineHeight: 1.2, opacity: 1, radius: 0 }),
  /** Required for text: long names must never break the layout. */
  overflow: z.enum(['shrink', 'wrap', 'ellipsis']).default('shrink'),
  animation: z.object({ in: AnimationSchema.optional(), out: AnimationSchema.optional() }).default({}),
});
export type Element = z.infer<typeof ElementSchema>;

// ─────────────────────────── Painted artwork ───────────────────────────

/** Painted artwork keys: kebab-case, e.g. "vrindavan-night". */
export const ARTWORK_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const artworkKey = z.string().max(40).regex(ARTWORK_KEY, 'Use lower-case words joined by -');

/**
 * One layer of a painted scene: a transparent image the size of the whole
 * scene canvas (3:2, see docs/illustration-brief.md), so every layer lines up.
 */
export const ArtworkLayerSchema = z.object({
  assetId: z.uuid(),
  /** 0 = far (barely moves) … 1 = near (moves most) on scroll, tilt and camera moves. */
  depth: z.number().min(0).max(1),
  /** A name for the Studio: "sky", "temple", "foreground flowers"… */
  label: z.string().max(40).optional(),
});
export type ArtworkLayer = z.infer<typeof ArtworkLayerSchema>;

/**
 * Commissioned, painted artwork used like the drawn scenes: as a website hero
 * (variant "artwork"), a film or card backdrop, and a catalogue poster.
 * Painted art keeps its own colours when a host changes the palette.
 */
export const ArtworkSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Colour shown while the layers load (usually the sky's main colour). */
  background: hex.optional(),
  /** Light text over it (night skies, deep colours) instead of the palette's dark inks. */
  dark: z.boolean().default(false),
  /** Where text starts, as a fraction of the height (lower under torans, arches or drapes). */
  textTop: z.number().min(0).max(0.5).default(0.06),
  /** Far to near. The first layer is usually an opaque sky. */
  layers: z.array(ArtworkLayerSchema).min(1).max(8),
});
export type Artwork = z.infer<typeof ArtworkSchema>;

/**
 * A canvas artboard filmed as a scene (ADR-058): its layers enter one after
 * another while the camera moves over it, so a canvas design becomes a film.
 */
export const SceneCanvasSchema = z.object({
  board: ArtboardSchema,
  /** Seconds between one layer's entrance and the next (top to bottom, unless the layers set their own delays). */
  stagger: z.number().min(0).max(2).default(0.14),
  camera: z.enum(CAMERA_MOVES).default('push'),
  /** Strength of the move: 1 is a slow drift. */
  intensity: z.number().min(0).max(3).default(0.6),
});
export type SceneCanvas = z.infer<typeof SceneCanvasSchema>;

/**
 * How a film's scene can open, like its invitation's website (ADR-074): a zipper pulled open, a satin ribbon untied,
 * or one of the stage openings (ADR-078; only over a stage backdrop).
 */
export const SCENE_REVEALS = ['none', 'zipper', 'ribbon', ...STAGE_INTROS] as const;
export type SceneReveal = (typeof SCENE_REVEALS)[number];

export const SceneSchema = z.object({
  id,
  durationSec: z.number().min(0.5).max(60),
  background: z.union([hex, z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'gradient'])]).default('background'),
  transition: z.enum(['none', 'fade', 'slide', 'wipe']).default('fade'),
  /** Repeat this scene once per authorized function, binding `function.*`. */
  repeatPerFunction: z.boolean().default(false),
  /** A drawn scene, a painted artwork or a 3D stage behind the elements, filmed with a camera move. */
  backdrop: z
    .object({
      scene: z.enum(SCENE_NAMES).optional(),
      /** Key of an entry in the definition's `artworks`. */
      artwork: artworkKey.optional(),
      camera: z.enum(CAMERA_MOVES).default('push'),
      /** Strength of the move: 1 is a slow, cinematic drift. */
      intensity: z.number().min(0).max(3).default(1),
      /** Darkens the artwork behind text (0 = none). */
      veil: z.number().min(0).max(0.8).default(0),
      /** A Signature 3D stage the camera moves through (ADR-078). */
      stage: z.enum(STAGE_NAMES).optional(),
      /** Stages: the camera's shot. Unset: `camera` is mapped to the nearest shot (cameraMoveToShot). */
      shot: z.enum(STAGE_SHOTS).optional(),
    })
    .refine((b) => [b.scene, b.artwork, b.stage].filter(Boolean).length === 1, { message: 'Choose one: a drawn scene, a painted artwork or a stage' })
    .optional(),
  /** Particles drifting over the scene (petals, gold dust…), drawn deterministically per frame. */
  particles: z.enum(EFFECTS).default('none'),
  /** A canvas artboard filmed in this scene, under the elements. */
  canvas: SceneCanvasSchema.optional(),
  /** The scene opens under a cover the film pulls away over its first seconds (its words come in as it opens). */
  reveal: z.enum(SCENE_REVEALS).default('none'),
  elements: z.array(ElementSchema).max(40),
});
export type Scene = z.infer<typeof SceneSchema>;

// ─────────────────────────── Definition ───────────────────────────

export const AssetRefSchema = z.object({
  assetId: z.uuid(),
  role: z.string().max(40),
});

export const TemplateDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    templateKey: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    type: z.enum(TEMPLATE_TYPES),
    name: z.string().min(1).max(80),
    description: z.string().max(500).default(''),
    eventTypes: z.array(z.string()).default([]),
    languages: z.array(z.string()).min(1),
    theme: ThemeSchema,
    fonts: FontsSchema,
    capabilities: CapabilitiesSchema,
    assets: z.array(AssetRefSchema).default([]),
    /** Painted scenes built from licensed image assets (each layer's asset is listed in `assets`). */
    artworks: z.record(artworkKey, ArtworkSchema).optional(),
    music: z
      .object({
        defaultMusicId: z.uuid().optional(),
        /** One of Bulava's own tracks by its slug (storage key `music/<slug>.m4a`), the default when no `defaultMusicId` is set. */
        defaultTrack: z
          .string()
          .max(60)
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
          .optional(),
        allowCustomerChoice: z.boolean().default(false),
      })
      .optional(),
    website: z
      .object({
        /** Opening animation before the invitation is revealed. */
        intro: z.enum(INTROS).default('none'),
        pages: z.array(WebsitePageSchema).min(1).max(10),
      })
      .optional(),
    canvas: z.object({ width: z.number().int().min(200).max(4096), height: z.number().int().min(200).max(4096), fps: z.number().int().min(12).max(60).default(30) }).optional(),
    scenes: z.array(SceneSchema).max(30).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === 'WEBSITE' && !d.website) {
      ctx.addIssue({ code: 'custom', path: ['website'], message: 'WEBSITE templates need website.pages' });
    }
    if ((d.type === 'VIDEO' || d.type === 'DIGITAL_CARD') && (!d.canvas || !d.scenes?.length)) {
      ctx.addIssue({ code: 'custom', path: ['scenes'], message: `${d.type} templates need a canvas and at least one scene` });
    }
    if (d.type === 'DIGITAL_CARD' && (d.scenes?.length ?? 0) > 1) {
      ctx.addIssue({ code: 'custom', path: ['scenes'], message: 'DIGITAL_CARD templates have exactly one scene' });
    }
  });

export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;
export type TemplateDefinitionInput = z.input<typeof TemplateDefinitionSchema>;
