import { z } from 'zod';
import { en } from '@bulava/localization';
import { bindingsIn, isKnownBinding, translationKeysIn } from './bindings';
import {
  EFFECTS,
  INTROS,
  PHOTO_SLOTS,
  TemplateDefinitionSchema,
  type EffectName,
  type Fonts,
  type IntroName,
  type PhotoSlot,
  type TemplateDefinition,
  type ThemeColors,
  type Value,
} from './definition';
import { fontPairing } from './fonts';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type DefinitionValidation =
  | { ok: true; definition: TemplateDefinition }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Structural (Zod) + semantic validation. Semantic checks:
 *  - every binding exists (custom.* must be a declared text slot)
 *  - every translation key exists in the English catalog
 *  - ids are unique within pages/scenes
 *  - painted artwork referenced by heroes and backdrops exists, and every
 *    layer's asset is listed in `assets` (so publishing checks its licence)
 */
export function validateTemplateDefinition(input: unknown): DefinitionValidation {
  const parsed = TemplateDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const d = parsed.data;
  const issues: ValidationIssue[] = [];
  const slots = d.capabilities.textSlots.map((s) => s.key);

  const checkValue = (value: Value | undefined, path: string) => {
    for (const b of bindingsIn(value)) {
      if (!isKnownBinding(b, slots)) issues.push({ path, message: `Unknown binding "${b}"` });
    }
    for (const k of translationKeysIn(value)) {
      if (!(k in en)) issues.push({ path, message: `Unknown translation key "${k}"` });
    }
  };

  d.website?.pages.forEach((page, pi) => {
    const ids = new Set<string>();
    page.sections.forEach((s, si) => {
      const base = `website.pages.${pi}.sections.${si}`;
      if (ids.has(s.id)) issues.push({ path: `${base}.id`, message: `Duplicate section id "${s.id}"` });
      ids.add(s.id);
      for (const [key, v] of Object.entries(s.props)) checkValue(v, `${base}.props.${key}`);
      if (s.section === 'hero' && s.variant === 'artwork') {
        const ref = s.props.artwork;
        const key = ref && 'literal' in ref ? String(ref.literal) : undefined;
        if (!key || !d.artworks?.[key]) issues.push({ path: `${base}.props.artwork`, message: 'Choose one of this template’s artworks: { "literal": "<key>" }' });
      }
      if (s.visibleWhen?.exists && !isKnownBinding(s.visibleWhen.exists, slots)) {
        issues.push({ path: `${base}.visibleWhen.exists`, message: `Unknown binding "${s.visibleWhen.exists}"` });
      }
    });
  });

  const sceneIds = new Set<string>();
  d.scenes?.forEach((scene, si) => {
    if (sceneIds.has(scene.id)) issues.push({ path: `scenes.${si}.id`, message: `Duplicate scene id "${scene.id}"` });
    sceneIds.add(scene.id);
    if (scene.backdrop?.artwork && !d.artworks?.[scene.backdrop.artwork]) {
      issues.push({ path: `scenes.${si}.backdrop.artwork`, message: `Unknown artwork "${scene.backdrop.artwork}"` });
    }
    const elIds = new Set<string>();
    scene.elements.forEach((el, ei) => {
      const base = `scenes.${si}.elements.${ei}`;
      if (elIds.has(el.id)) issues.push({ path: `${base}.id`, message: `Duplicate element id "${el.id}"` });
      elIds.add(el.id);
      checkValue(el.content, `${base}.content`);
      if (d.canvas && (el.frame.x + el.frame.w > d.canvas.width * 1.5 || el.frame.y + el.frame.h > d.canvas.height * 1.5)) {
        issues.push({ path: `${base}.frame`, message: 'Element is far outside the canvas' });
      }
    });
  });

  const listed = new Set(d.assets.map((a) => a.assetId));
  for (const [key, artwork] of Object.entries(d.artworks ?? {})) {
    artwork.layers.forEach((layer, li) => {
      if (!listed.has(layer.assetId)) issues.push({ path: `artworks.${key}.layers.${li}.assetId`, message: 'List this asset in assets so its licence is checked' });
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, definition: d };
}

/** Every asset the template's painted artwork uses (for licence checks, signing and preloading). */
export function artworkAssetIds(definition: Pick<TemplateDefinition, 'artworks'>): string[] {
  return [...new Set(Object.values(definition.artworks ?? {}).flatMap((a) => a.layers.map((l) => l.assetId)))];
}

/** Total video duration in seconds for a context with `functionCount` functions. */
export function videoDurationSec(definition: TemplateDefinition, functionCount: number): number {
  return (definition.scenes ?? []).reduce(
    (sum, s) => sum + s.durationSec * (s.repeatPerFunction ? Math.max(1, functionCount) : 1),
    0,
  );
}

// ─────────────────────────── Customization ───────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const CustomizationSchema = z.object({
  colors: z
    .object({
      primary: hex,
      secondary: hex,
      accent: hex,
      background: hex,
      surface: hex,
      text: hex,
      muted: hex,
    })
    .partial()
    .optional(),
  /** Name of one of capabilities.colorPresets. */
  colorPreset: z.string().max(40).optional(),
  musicId: z.uuid().nullable().optional(),
  custom: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/), z.string().max(2000)).optional(),
  /** Media item ids (from the event's media) to use as template photos. */
  photoIds: z.array(z.uuid()).max(50).optional(),
  /** Photos placed in named spots (cover, each partner, story, closing): media item ids. */
  photoSlots: z.partialRecord(z.enum(PHOTO_SLOTS), z.uuid()).optional(),
  /** One of FONT_PAIRINGS (when fonts are editable). */
  fontPairing: z.string().max(40).optional(),
  /** Opening animation (when animation is editable). */
  intro: z.enum(INTROS).optional(),
  /** Ambient effect (when animation is editable). */
  effect: z.enum(EFFECTS).optional(),
  /** Section ids the customer hid (when layout is editable). The hero always shows. */
  hiddenSections: z.array(z.string().max(64)).max(40).optional(),
});
export type Customization = z.infer<typeof CustomizationSchema>;

/** Reject anything the template does not allow the customer to change. */
export function validateCustomization(definition: TemplateDefinition, input: unknown): { ok: true; value: Customization } | { ok: false; issues: ValidationIssue[] } {
  const parsed = CustomizationSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  }
  const c = parsed.data;
  const e = definition.capabilities.editable;
  const issues: ValidationIssue[] = [];
  if ((c.colors && Object.keys(c.colors).length) || c.colorPreset) {
    if (!e.colors) issues.push({ path: 'colors', message: 'This template does not allow colour changes' });
    // Presets are suggestions: custom colours may adjust one (text stays readable, see themeStyle).
    const presets = definition.capabilities.colorPresets;
    if (c.colorPreset && !presets.some((p) => p.name === c.colorPreset)) {
      issues.push({ path: 'colorPreset', message: 'Unknown colour preset' });
    }
  }
  if (c.fontPairing) {
    if (!e.fonts) issues.push({ path: 'fontPairing', message: 'This template does not allow font changes' });
    else if (!fontPairing(c.fontPairing)) issues.push({ path: 'fontPairing', message: 'Unknown font pairing' });
  }
  if ((c.intro || c.effect) && !e.animation) {
    issues.push({ path: c.intro ? 'intro' : 'effect', message: 'This template does not allow animation changes' });
  }
  if (c.hiddenSections?.length) {
    const sections = new Map((definition.website?.pages.flatMap((p) => p.sections) ?? []).map((s) => [s.id, s]));
    if (!e.layout) issues.push({ path: 'hiddenSections', message: 'This template does not allow hiding sections' });
    for (const id of c.hiddenSections) {
      const section = sections.get(id);
      if (!section) issues.push({ path: 'hiddenSections', message: `Unknown section ${id}` });
      else if (section.section === 'hero') issues.push({ path: 'hiddenSections', message: 'The opening section always shows' });
    }
  }
  if (c.photoSlots && Object.keys(c.photoSlots).length) {
    if (!e.photos) issues.push({ path: 'photoSlots', message: 'This template does not use customer photos' });
    const allowed = definition.capabilities.photoSlots;
    for (const slot of Object.keys(c.photoSlots)) {
      if (!allowed.includes(slot as PhotoSlot)) issues.push({ path: `photoSlots.${slot}`, message: 'This template has no such photo place' });
    }
  }
  if (c.musicId !== undefined && c.musicId !== null && !e.music) {
    issues.push({ path: 'musicId', message: 'This template does not allow music changes' });
  }
  if (c.custom && Object.keys(c.custom).length) {
    if (!e.text) issues.push({ path: 'custom', message: 'This template does not allow text changes' });
    const slots = new Map(definition.capabilities.textSlots.map((s) => [s.key, s]));
    for (const [key, value] of Object.entries(c.custom)) {
      const slot = slots.get(key);
      if (!slot) issues.push({ path: `custom.${key}`, message: 'Unknown text slot' });
      else if (value.length > slot.maxLength) issues.push({ path: `custom.${key}`, message: `At most ${slot.maxLength} characters` });
    }
  }
  if (c.photoIds?.length) {
    if (!e.photos) issues.push({ path: 'photoIds', message: 'This template does not use customer photos' });
    else if (c.photoIds.length > definition.capabilities.maxPhotos) {
      issues.push({ path: 'photoIds', message: `At most ${definition.capabilities.maxPhotos} photos` });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: c };
}

/** Theme colours after applying an allowed customization: a preset, then any custom colours on top. */
export function effectiveColors(definition: TemplateDefinition, customization: Customization | null | undefined): ThemeColors {
  const base = definition.theme.colors;
  if (!customization || !definition.capabilities.editable.colors) return base;
  const preset = definition.capabilities.colorPresets.find((p) => p.name === customization.colorPreset);
  return { ...(preset?.colors ?? base), ...(customization.colors ?? {}) };
}

/** Fonts after an allowed font-pairing choice. */
export function effectiveFonts(definition: TemplateDefinition, customization: Customization | null | undefined): Fonts {
  if (!customization?.fontPairing || !definition.capabilities.editable.fonts) return definition.fonts;
  return fontPairing(customization.fontPairing)?.fonts ?? definition.fonts;
}

/** Opening animation and ambient effect after allowed changes. */
export function effectiveMotion(definition: TemplateDefinition, customization: Customization | null | undefined): { intro: IntroName; effect: EffectName } {
  const intro = definition.website?.intro ?? 'none';
  const effect = definition.theme.effect ?? 'none';
  if (!customization || !definition.capabilities.editable.animation) return { intro, effect };
  return { intro: customization.intro ?? intro, effect: customization.effect ?? effect };
}

/** Sections the customer hid (never the hero), when layout is editable. */
export function hiddenSectionIds(definition: TemplateDefinition, customization: Customization | null | undefined): Set<string> {
  if (!customization?.hiddenSections?.length || !definition.capabilities.editable.layout) return new Set();
  return new Set(customization.hiddenSections);
}
