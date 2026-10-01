import { z } from 'zod';

/**
 * TemplateDefinition v1: the JSON document stored in TemplateVersion.definition.
 * Templates are data; one generic renderer per output type interprets them.
 * See docs/templates.md.
 */

export const TEMPLATE_TYPES = ['WEBSITE', 'VIDEO', 'DIGITAL_CARD', 'EMAIL', 'SOCIAL'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const id = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/i, 'Use letters, numbers, - and _');

// ─────────────────────────── Values ───────────────────────────

export const VALUE_FORMATS = ['date', 'dateWithWeekday', 'time', 'upper', 'lower', 'dateTime'] as const;

export type Value =
  | { literal: string | number | boolean }
  | { binding: string; fallback?: Value; format?: (typeof VALUE_FORMATS)[number] }
  | { t: string }
  | { template: string; fallback?: Value };

export const ValueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.object({ literal: z.union([z.string().max(2000), z.number(), z.boolean()]) }).strict(),
    z
      .object({
        binding: z.string().regex(/^[a-zA-Z]\w*(\[\d+\])?(\.\w+(\[\d+\])?)*$/, 'Invalid binding path').max(120),
        fallback: ValueSchema.optional(),
        format: z.enum(VALUE_FORMATS).optional(),
      })
      .strict(),
    z.object({ t: z.string().regex(/^[a-zA-Z][\w.]*$/).max(120) }).strict(),
    z.object({ template: z.string().max(2000), fallback: ValueSchema.optional() }).strict(),
  ]),
);

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

/** Decorative motifs the engine draws itself (no external assets). */
export const ORNAMENTS = ['none', 'mandala', 'paisley', 'floral', 'geometric', 'confetti', 'lotus', 'peacock', 'stars', 'laurel'] as const;
export const PATTERNS = ['none', 'dots', 'jaali', 'waves', 'rangoli', 'damask'] as const;
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
/** Ambient particle effects drawn over a live invitation (off for reduced-motion users). */
export const EFFECTS = ['none', 'petals', 'marigold', 'goldDust', 'fireflies', 'confetti', 'lanterns', 'snow'] as const;
export type EffectName = (typeof EFFECTS)[number];
/**
 * Illustrated scenes (template-engine art/scenes.tsx): website heroes use them
 * as layered 3D headers, videos as backdrops the camera moves through.
 */
export const SCENE_NAMES = ['gopuram', 'palace', 'toran', 'arches', 'lotus', 'mandap', 'noir', 'floral', 'balloons', 'backwaters', 'sarovar', 'vrindavan'] as const;
export type SceneNameValue = (typeof SCENE_NAMES)[number];
/** Scenes drawn on the primary colour: text over them uses light inks. */
export const DARK_SCENE_NAMES: readonly SceneNameValue[] = ['palace', 'toran', 'arches', 'noir', 'sarovar', 'vrindavan'];
/** Camera moves through a video backdrop; near layers move more than far ones. */
export const CAMERA_MOVES = ['still', 'push', 'pull', 'panLeft', 'panRight', 'rise', 'descend'] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];
/** Named places a customer can put their own photos. */
export const PHOTO_SLOTS = ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
/** Opening animations played before a website invitation is revealed. */
export const INTROS = ['none', 'envelope', 'curtain', 'doors', 'gates', 'seal', 'lanterns', 'petals', 'celestial', 'scratch'] as const;
export type IntroName = (typeof INTROS)[number];

export const ThemeSchema = z.object({
  colors: ThemeColorsSchema,
  radius: z.number().int().min(0).max(48).default(16),
  /** Decorative motif rendered by the engine (no external asset needed). */
  ornament: z.enum(ORNAMENTS).default('none'),
  /** Optional background pattern. */
  pattern: z.enum(PATTERNS).default('none'),
  /** dark = hero on the primary colour with gold/champagne type (luxury look). */
  heroTone: z.enum(['light', 'dark']).default('light'),
  /** Design language applied to every section. */
  look: z.enum(LOOKS).default('classic'),
  /** Default ambient effect (customers may change it when animation is editable). */
  effect: z.enum(EFFECTS).default('none'),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const FONT_FAMILIES = [
  'Playfair Display',
  'Cormorant Garamond',
  'Great Vibes',
  'Poppins',
  'Noto Sans',
  'Noto Serif',
  'Noto Sans Devanagari',
  'Noto Serif Devanagari',
  'Tiro Devanagari Hindi',
  'Cinzel',
  'Pinyon Script',
  'Parisienne',
  'Alex Brush',
  'Marcellus',
  'Montserrat',
  'Italiana',
  'Yeseva One',
  'Rozha One',
  'Yatra One',
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

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
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const ConditionSchema = z.object({
  /** Render only when this binding resolves to a non-empty value. */
  exists: z.string().max(120).optional(),
  /** Render only for these event types. */
  eventTypes: z.array(z.string()).optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const SectionInstanceSchema = z.object({
  id,
  section: z.enum(SECTION_KEYS),
  variant: z.string().regex(/^[a-z][a-zA-Z0-9-]*$/).max(40).default('default'),
  props: z.record(z.string(), ValueSchema).default({}),
  visibleWhen: ConditionSchema.optional(),
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
 * ornament turning and opening; shine: a gold light sweeping across.
 */
export const ANIMATIONS = ['none', 'fade', 'fadeUp', 'fadeDown', 'zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'typewriter', 'float', 'blurIn', 'tracking', 'reveal', 'bloom', 'shine'] as const;

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

export const SceneSchema = z.object({
  id,
  durationSec: z.number().min(0.5).max(60),
  background: z.union([hex, z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'gradient'])]).default('background'),
  transition: z.enum(['none', 'fade', 'slide', 'wipe']).default('fade'),
  /** Repeat this scene once per authorized function, binding `function.*`. */
  repeatPerFunction: z.boolean().default(false),
  /** A drawn scene or a painted artwork behind the elements, filmed with a camera move. */
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
    })
    .refine((b) => Boolean(b.scene) !== Boolean(b.artwork), { message: 'Choose either a drawn scene or a painted artwork' })
    .optional(),
  /** Particles drifting over the scene (petals, gold dust…), drawn deterministically per frame. */
  particles: z.enum(EFFECTS).default('none'),
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
    music: z.object({ defaultMusicId: z.uuid().optional(), allowCustomerChoice: z.boolean().default(false) }).optional(),
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
