import { z } from 'zod';

/**
 * Building blocks shared by the definition and the canvas schemas (kept apart
 * so neither module has to import the other while it is still loading).
 */

export const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
export const id = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/i, 'Use letters, numbers, - and _');

// ─────────────────────────── Values ───────────────────────────

/** `initial` keeps a name's first letter, capitalised (monograms: {{couple.partnerOne|initial}}). */
export const VALUE_FORMATS = ['date', 'dateWithWeekday', 'time', 'upper', 'lower', 'dateTime', 'initial'] as const;

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

/** Decorative motifs the engine draws itself (no external assets). */
export const ORNAMENTS = ['none', 'mandala', 'paisley', 'floral', 'geometric', 'confetti', 'lotus', 'peacock', 'stars', 'laurel'] as const;
export const PATTERNS = ['none', 'dots', 'jaali', 'waves', 'rangoli', 'damask'] as const;
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
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
