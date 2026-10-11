import { z } from 'zod';
import { ArtboardSchema, type Artboard, type CanvasSection } from './canvas';
import type { SectionInstance, TemplateDefinition } from './definition';

/**
 * A host's own arrangement of a website template's canvas sections (ADR-057):
 * the artboards they redrew in the invitation's canvas editor, by section id.
 * They replace the template's artboards when the website is drawn, and only
 * while they still fit (the same section, at the same size): a template that
 * changes a section's size falls back to its own design there.
 */

/** Canvas sections one invitation may redraw (templates have a handful). */
export const CANVAS_CUSTOM_MAX_SECTIONS = 12;

/** Sections a host may add to their page. */
export const ADDED_SECTIONS_MAX = 8;
/** An added section's phone artboard is phone-wide; its height is the host's. */
export const ADDED_SECTION_WIDTH = 390;

export const CanvasOverrideSchema = z.object({
  mobile: ArtboardSchema.optional(),
  desktop: ArtboardSchema.optional(),
});
export type CanvasOverride = z.infer<typeof CanvasOverrideSchema>;

export const CanvasCustomizationSchema = z
  .record(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), CanvasOverrideSchema)
  .refine((v) => Object.keys(v).length <= CANVAS_CUSTOM_MAX_SECTIONS, { message: `At most ${CANVAS_CUSTOM_MAX_SECTIONS} sections` });
export type CanvasCustomization = z.infer<typeof CanvasCustomizationSchema>;

/**
 * A canvas section the host added to their page (ADR-059), after one of the
 * template's sections (`after`; empty: at the end, before the footer). It is
 * drawn like the template's canvas sections, on wide screens as its phone
 * artboard centred.
 */
export const AddedSectionSchema = z.object({
  id: z.string().regex(/^my-[a-z0-9]{1,24}$/),
  after: z.string().max(64),
  mobile: ArtboardSchema,
});
export type AddedSection = z.infer<typeof AddedSectionSchema>;
export const AddedSectionsSchema = z.array(AddedSectionSchema).max(ADDED_SECTIONS_MAX);

export type CanvasSectionInstance = SectionInstance & { section: 'canvas'; canvas: CanvasSection };

/** An added section as the page draws it. */
export function addedSectionInstance(added: AddedSection): CanvasSectionInstance {
  return { id: added.id, section: 'canvas', variant: 'default', props: {}, canvas: { mobile: added.mobile, desktopMaxWidth: 480, repeatPerFunction: false } };
}

/** The canvas sections of a website template's page, in order: what the canvas editor offers. */
export function canvasSectionsOf(definition: Pick<TemplateDefinition, 'website'>): CanvasSectionInstance[] {
  return (definition.website?.pages[0]?.sections ?? []).filter((s): s is CanvasSectionInstance => s.section === 'canvas' && Boolean(s.canvas));
}

const sameSize = (a: Pick<Artboard, 'width' | 'height'> | undefined, b: Pick<Artboard, 'width' | 'height'> | undefined) => Boolean(a && b && a.width === b.width && a.height === b.height);

/** A section's artboards with the host's in place, where they still fit. */
export function canvasWithOverride(canvas: CanvasSection, override: CanvasOverride | undefined): CanvasSection {
  if (!override) return canvas;
  const mobile = override.mobile && sameSize(override.mobile, canvas.mobile) ? override.mobile : canvas.mobile;
  const desktop = canvas.desktop && override.desktop && sameSize(override.desktop, canvas.desktop) ? override.desktop : canvas.desktop;
  return mobile === canvas.mobile && desktop === canvas.desktop ? canvas : { ...canvas, mobile, desktop };
}

/**
 * The template with the host's canvas changes applied: their artboards in
 * place of the template's, and the sections they added, after the section each
 * names (at the end, before the footer, when it names none or one that is gone).
 */
export function withCanvasCustomization<D extends Pick<TemplateDefinition, 'website'>>(
  definition: D,
  canvas: CanvasCustomization | undefined | null,
  added?: readonly AddedSection[] | null,
): D {
  const hasCanvas = Boolean(canvas && Object.keys(canvas).length);
  if ((!hasCanvas && !added?.length) || !definition.website) return definition;
  const [first, ...rest] = definition.website.pages;
  if (!first) return definition;
  let sections: SectionInstance[] = hasCanvas ? first.sections.map((s) => (s.section === 'canvas' && s.canvas && canvas![s.id] ? { ...s, canvas: canvasWithOverride(s.canvas, canvas![s.id]) } : s)) : first.sections;
  if (added?.length) {
    const ids = new Set(sections.map((s) => s.id));
    const out: SectionInstance[] = [];
    for (const s of sections) {
      out.push(s);
      for (const a of added) if (a.after === s.id) out.push(addedSectionInstance(a));
    }
    // Added sections whose place is gone (or was never named) go before the footer.
    const loose = added.filter((a) => !a.after || !ids.has(a.after)).map(addedSectionInstance);
    if (loose.length) {
      const footer = out.findIndex((s) => s.section === 'footer');
      out.splice(footer === -1 ? out.length : footer, 0, ...loose);
    }
    sections = out;
  }
  return { ...definition, website: { ...definition.website, pages: [{ ...first, sections }, ...rest] } };
}

/** Added sections re-anchored to this template: a section that is gone means at the end. */
export function fittingAddedSections(definition: Pick<TemplateDefinition, 'website'>, added: readonly AddedSection[] | undefined | null): AddedSection[] | undefined {
  if (!added?.length) return undefined;
  const ids = new Set((definition.website?.pages[0]?.sections ?? []).map((s) => s.id));
  return added.filter((a) => a.mobile.width === ADDED_SECTION_WIDTH).map((a) => (a.after && !ids.has(a.after) ? { ...a, after: '' } : a));
}

/**
 * Keeps only the changes this template can take: sections it still has, at
 * their sizes. Used when a host's saved arrangement meets a newer version of
 * the template, or another template.
 */
export function fittingCanvasCustomization(definition: Pick<TemplateDefinition, 'website'>, canvas: CanvasCustomization | undefined | null): CanvasCustomization | undefined {
  if (!canvas) return undefined;
  const sections = new Map(canvasSectionsOf(definition).map((s) => [s.id, s.canvas]));
  const kept: CanvasCustomization = {};
  for (const [id, override] of Object.entries(canvas)) {
    const own = sections.get(id);
    if (!own) continue;
    const mobile = override.mobile && sameSize(override.mobile, own.mobile) ? override.mobile : undefined;
    const desktop = override.desktop && own.desktop && sameSize(override.desktop, own.desktop) ? override.desktop : undefined;
    if (mobile || desktop) kept[id] = { ...(mobile ? { mobile } : {}), ...(desktop ? { desktop } : {}) };
  }
  return Object.keys(kept).length ? kept : undefined;
}
