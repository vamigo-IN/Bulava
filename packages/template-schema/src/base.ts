import { z } from 'zod';

/**
 * Building blocks shared by the definition and the canvas schemas (kept apart
 * so neither module has to import the other while it is still loading).
 */

export const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
export const id = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/i, 'Use letters, numbers, - and _');

// ─────────────────────────── Values ───────────────────────────

/** `initial` keeps a name's first letter, capitalised (monograms: {{couple.partnerOne|initial}}). */
export const VALUE_FORMATS = ['date', 'dateWithWeekday', 'dateShort', 'time', 'upper', 'lower', 'dateTime', 'initial'] as const;

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

export const ConditionSchema = z.object({
  /** Render only when this binding resolves to a non-empty value. */
  exists: z.string().max(120).optional(),
  /** Render only for these event types. */
  eventTypes: z.array(z.string()).optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

// ─────────────────────────── Vocabularies ───────────────────────────

/**
 * Illustrated scenes (template-engine art/scenes.tsx): website heroes use them
 * as layered 3D headers, videos as backdrops the camera moves through, and
 * canvas designs as layers.
 */
export const SCENE_NAMES = ['gopuram', 'palace', 'toran', 'arches', 'lotus', 'mandap', 'noir', 'floral', 'balloons', 'backwaters', 'sarovar', 'vrindavan'] as const;
export type SceneNameValue = (typeof SCENE_NAMES)[number];
/** Scenes drawn on the primary colour: text over them uses light inks. */
export const DARK_SCENE_NAMES: readonly SceneNameValue[] = ['palace', 'toran', 'arches', 'noir', 'sarovar', 'vrindavan'];

/** Signature 3D stages (template-engine/src/stage, ADR-078): sets in CSS 3D that a camera moves through. */
export const STAGE_NAMES = ['sheeshMahal', 'chaarBagh', 'causeway', 'nave', 'courtyard', 'rooftop', 'bigTop', 'ballroom', 'cloudNine', 'aangan', 'ghat', 'mandapam', 'dwaar', 'deepstambh', 'bazaar', 'auditorium', 'quadrangle', 'mela', 'veranda'] as const;
export type StageNameValue = (typeof STAGE_NAMES)[number];
export interface StageMeta {
  /** Light inks over it (the website words, the film's text). */
  dark: boolean;
  names: 'script' | 'caps' | 'italic';
  /** Where the hero's words start, as a fraction of the hero's height (below the crown band). */
  textTop: number;
  /** Films: px on the 1080×1920 frame that text drops below the crown band. */
  filmTextDrop: number;
  architecture: string;
  time: 'dawn' | 'morning' | 'day' | 'golden' | 'dusk' | 'blue' | 'night';
}
/**
 * What the catalog, posters and apps know of a stage without importing its art:
 * its darkness, name style, where the words start, the film's text drop, and
 * its (architecture, time) pair (unique across stages).
 */
export const STAGE_META: Readonly<Record<StageNameValue, StageMeta>> = {
  sheeshMahal: { dark: true, names: 'script', textTop: 0.22, filmTextDrop: 230, architecture: 'mirror hall', time: 'night' },
  chaarBagh: { dark: true, names: 'script', textTop: 0.14, filmTextDrop: 80, architecture: 'garden channel', time: 'blue' },
  causeway: { dark: false, names: 'caps', textTop: 0.1, filmTextDrop: 0, architecture: 'causeway over water', time: 'dawn' },
  nave: { dark: false, names: 'italic', textTop: 0.14, filmTextDrop: 80, architecture: 'chapel nave', time: 'golden' },
  courtyard: { dark: false, names: 'script', textTop: 0.1, filmTextDrop: 0, architecture: 'arcaded courtyard', time: 'golden' },
  rooftop: { dark: true, names: 'script', textTop: 0.16, filmTextDrop: 120, architecture: 'rooftop terrace', time: 'blue' },
  bigTop: { dark: true, names: 'caps', textTop: 0.16, filmTextDrop: 120, architecture: 'circus tent', time: 'night' },
  ballroom: { dark: true, names: 'script', textTop: 0.2, filmTextDrop: 190, architecture: 'ballroom', time: 'night' },
  cloudNine: { dark: false, names: 'script', textTop: 0.17, filmTextDrop: 130, architecture: 'sky of clouds', time: 'dawn' },
  aangan: { dark: false, names: 'script', textTop: 0.16, filmTextDrop: 120, architecture: 'veranda courtyard', time: 'dawn' },
  ghat: { dark: false, names: 'caps', textTop: 0.1, filmTextDrop: 0, architecture: 'river ghat', time: 'dawn' },
  mandapam: { dark: false, names: 'caps', textTop: 0.14, filmTextDrop: 80, architecture: 'pillared hall', time: 'morning' },
  dwaar: { dark: true, names: 'caps', textTop: 0.12, filmTextDrop: 40, architecture: 'house threshold', time: 'blue' },
  deepstambh: { dark: true, names: 'caps', textTop: 0.12, filmTextDrop: 40, architecture: 'temple courtyard', time: 'dusk' },
  bazaar: { dark: true, names: 'script', textTop: 0.16, filmTextDrop: 120, architecture: 'festive lane', time: 'night' },
  auditorium: { dark: true, names: 'caps', textTop: 0.12, filmTextDrop: 40, architecture: 'auditorium', time: 'night' },
  quadrangle: { dark: true, names: 'caps', textTop: 0.14, filmTextDrop: 80, architecture: 'colonnaded quad', time: 'dusk' },
  mela: { dark: true, names: 'caps', textTop: 0.14, filmTextDrop: 80, architecture: 'fair square', time: 'night' },
  veranda: { dark: false, names: 'script', textTop: 0.1, filmTextDrop: 0, architecture: 'hill veranda', time: 'golden' },
};
export const DARK_STAGE_NAMES: readonly StageNameValue[] = STAGE_NAMES.filter((n) => STAGE_META[n].dark);
/** A stage backdrop's camera (stages only; CAMERA_MOVES stay the scenes'). */
export const STAGE_SHOTS = ['still', 'settle', 'dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'orbitLeft', 'orbitRight', 'riseOver', 'flyThrough', 'pullAway'] as const;
export type StageShot = (typeof STAGE_SHOTS)[number];

/**
 * Decorative motifs the engine draws itself (no external assets). A theme's
 * ornament is also its sections' suite (template-engine sections/suites.ts):
 * the art every section below the hero is dressed in (dividers, corners,
 * borders, seals, frames, the footer), so the page reads as one design.
 * The later ones are suites first: temple (South Indian temple borders and
 * kolam), kasavu (Kerala's gold-bordered ivory), jaali (Mughal arches and
 * lattice), marigold (genda swags and wreaths), bagh (Punjabi phulkari),
 * rangoli (diyas and the threshold rangoli), deco (art deco fans and steps),
 * clouds (a soft nursery sky) and chapel (a church: lancet arches and a rose
 * window).
 */
export const ORNAMENTS = ['none', 'mandala', 'paisley', 'floral', 'geometric', 'confetti', 'lotus', 'peacock', 'stars', 'laurel', 'temple', 'kasavu', 'jaali', 'marigold', 'bagh', 'rangoli', 'deco', 'clouds', 'chapel'] as const;
export type OrnamentNameValue = (typeof ORNAMENTS)[number];

/**
 * The pieces of a suite a theme may swap for another (`theme.dress`), so two
 * designs in one suite still differ below the hero (docs/templates.md#section-suites).
 *  frame   – photo frames and shaped cards: a jharokha, a temple niche, a mihrab, a lancet…
 *  edge    – the border along the top of a band: a toran, a temple border, a laal paar…
 *  seal    – the round emblem behind monograms, numbers and the closing
 *  skyline – the art at the foot of the closing band
 *  corner  – mirrored pieces in a band's corners
 *  divider – the rule under every heading
 */
export const SUITE_FRAMES = ['jharokha', 'niche', 'mihrab', 'lancet', 'arch', 'oval', 'circle', 'scallop', 'ticket', 'deco', 'double', 'cloud', 'rounded', 'cusped'] as const;
export const SUITE_EDGES = ['none', 'toran', 'marigoldSwag', 'floralGarland', 'bunting', 'fairyLights', 'templeBorder', 'zariBand', 'laalPaar', 'phulkari', 'arches', 'lancets', 'deco', 'bandhani', 'scallop'] as const;
export const SUITE_SEALS = ['emblem', 'medallion', 'kolam', 'arabesque', 'rangoliBloom', 'marigoldWreath', 'botanicalWreath', 'alpana', 'mandala', 'crest', 'sunburst', 'moon', 'sticker', 'phulkari', 'jaali', 'roseWindow'] as const;
export const SUITE_SKYLINES = ['none', 'domes', 'diyaRow', 'lamps', 'peacocks', 'roses', 'balloons', 'clouds', 'lotuses', 'elephants', 'kalash', 'lanterns', 'sunburst', 'phulkari', 'doves', 'moonrise'] as const;
export const SUITE_CORNERS = ['none', 'filigreeCorner', 'paisleyOrnate', 'roseCluster', 'peacockFeather', 'decoCorner'] as const;
export const SUITE_DIVIDERS = ['glyph', 'flourish', 'triple', 'rule', 'laurel', 'lotus', 'fleuron'] as const;
export type SuiteFrame = (typeof SUITE_FRAMES)[number];
export type SuiteEdge = (typeof SUITE_EDGES)[number];
export type SuiteSeal = (typeof SUITE_SEALS)[number];
export type SuiteSkyline = (typeof SUITE_SKYLINES)[number];
export type SuiteCorner = (typeof SUITE_CORNERS)[number];
export type SuiteDivider = (typeof SUITE_DIVIDERS)[number];
/** Background patterns (theme paper and canvas pattern fills), drawn as small repeating SVGs. */
export const PATTERNS = ['none', 'dots', 'jaali', 'waves', 'rangoli', 'damask', 'confetti', 'bandhani', 'stars', 'paisley', 'kolam', 'scales'] as const;
/** Ambient particle effects drawn over a live invitation (off for reduced-motion users). */
export const EFFECTS = ['none', 'petals', 'marigold', 'goldDust', 'fireflies', 'confetti', 'lanterns', 'snow'] as const;
export type EffectName = (typeof EFFECTS)[number];

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
  'Baloo 2',
  'Pacifico',
  'Lora',
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
