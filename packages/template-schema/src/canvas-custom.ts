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

/** Sections a host may add to their page, the template's sections they redrew included (ADR-065: any section is redrawn by clicking it). */
export const ADDED_SECTIONS_MAX = 20;
/** Entries in a host's order of the page's sections (ADR-065). */
export const SECTION_ORDER_MAX = 80;
/** An added section's phone artboard is phone-wide; its height is the host's. */
export const ADDED_SECTION_WIDTH = 390;
/**
 * A phone screen's height: a template section drawn behind a redrawn one
 * (ADR-065) lays out on it, so its screen-high hero is as high as it was in
 * the editor's phone, whatever the guest's screen.
 */
export const SECTION_SCREEN_HEIGHT = 844;

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
 * artboard centred. A template section the host redrew on the canvas
 * (`replaces`) takes that section's place: the template's own is not drawn
 * while it exists, and removing it brings the template's back.
 */
export const AddedSectionSchema = z.object({
  id: z.string().regex(/^my-[a-z0-9]{1,24}$/),
  after: z.string().max(64),
  mobile: ArtboardSchema,
  /** Stands in for the section named in `after` (a redrawn template section). */
  replaces: z.boolean().optional(),
  /** Drawn once per function the viewer may see, with function.* bound to each (a redrawn timeline). */
  perFunction: z.boolean().optional(),
});
export type AddedSection = z.infer<typeof AddedSectionSchema>;
export const AddedSectionsSchema = z.array(AddedSectionSchema).max(ADDED_SECTIONS_MAX);

export type CanvasSectionInstance = SectionInstance & { section: 'canvas'; canvas: CanvasSection };

/** An added section as the page draws it. */
export function addedSectionInstance(added: AddedSection): CanvasSectionInstance {
  return { id: added.id, section: 'canvas', variant: 'default', props: {}, canvas: { mobile: added.mobile, desktopMaxWidth: 480, repeatPerFunction: added.perFunction ?? false } };
}

/** Template sections a host may redraw on the canvas in their place: any but its own canvases and the footer. */
export const replaceable = (section: Pick<SectionInstance, 'section'> | undefined): boolean => Boolean(section && section.section !== 'canvas' && section.section !== 'footer');

/** The template sections the host's redrawn sections stand in for, by section id: the id of the section drawn instead. */
export function replacedSections(definition: Pick<TemplateDefinition, 'website'>, added: readonly AddedSection[] | undefined | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!added?.length) return out;
  const byId = new Map((definition.website?.pages[0]?.sections ?? []).map((s) => [s.id, s]));
  for (const a of added) if (a.replaces && a.after && replaceable(byId.get(a.after)) && !out.has(a.after)) out.set(a.after, a.id);
  return out;
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
 * What a part of the page is ordered by (ADR-065): a template section's id, a
 * host's section's id, and for a redrawn section the id of the section it
 * stands in for, so that bringing the template's back keeps the place.
 */
export function orderKeys(definition: Pick<TemplateDefinition, 'website'>, added: readonly AddedSection[] | undefined | null): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [original, standIn] of replacedSections(definition, added)) keys.set(standIn, original);
  return keys;
}

/**
 * The page's sections in the host's order (ADR-065): the opening stays first
 * and the footer last; the others follow `order` (by `keyOf`). A section the
 * order does not name (one a newer template version added) keeps its place
 * after the section it followed.
 */
export function withSectionOrder<S extends Pick<SectionInstance, 'id' | 'section'>>(sections: readonly S[], order: readonly string[] | undefined | null, keyOf: (section: S) => string = (s) => s.id): S[] {
  if (!order?.length || sections.length < 3) return [...sections];
  const [opening, ...others] = sections;
  const footers = others.filter((s) => s.section === 'footer');
  const middle = others.filter((s) => s.section !== 'footer');
  const rank = new Map(order.map((key, i) => [key, i] as const));
  // Each named section leads a group; unnamed ones ride along with the section before them.
  const groups: Array<{ rank: number; items: S[] }> = [{ rank: -1, items: [] }];
  for (const s of middle) {
    const r = rank.get(keyOf(s));
    if (r === undefined) groups[groups.length - 1]!.items.push(s);
    else groups.push({ rank: r, items: [s] });
  }
  const sorted = groups.map((g, i) => ({ ...g, i })).sort((a, b) => a.rank - b.rank || a.i - b.i);
  return [opening!, ...sorted.flatMap((g) => g.items), ...footers];
}

/**
 * The template with the host's canvas changes applied: their artboards in
 * place of the template's, the sections they added, after the section each
 * names (at the end, before the footer, when it names none or one that is
 * gone), and the page in the order they chose (ADR-065).
 */
export function withCanvasCustomization<D extends Pick<TemplateDefinition, 'website'>>(
  definition: D,
  canvas: CanvasCustomization | undefined | null,
  added?: readonly AddedSection[] | null,
  order?: readonly string[] | null,
): D {
  const hasCanvas = Boolean(canvas && Object.keys(canvas).length);
  if ((!hasCanvas && !added?.length && !order?.length) || !definition.website) return definition;
  const [first, ...rest] = definition.website.pages;
  if (!first) return definition;
  let sections: SectionInstance[] = hasCanvas ? first.sections.map((s) => (s.section === 'canvas' && s.canvas && canvas![s.id] ? { ...s, canvas: canvasWithOverride(s.canvas, canvas![s.id]) } : s)) : first.sections;
  if (added?.length) {
    const ids = new Set(sections.map((s) => s.id));
    // A redrawn section takes its original's place; the host's other sections follow it.
    const replaced = replacedSections(definition, added);
    const out: SectionInstance[] = [];
    for (const s of sections) {
      const standIn = replaced.get(s.id);
      const mine = added.filter((a) => a.after === s.id);
      if (standIn) out.push(...mine.filter((a) => a.id === standIn).map(addedSectionInstance));
      else out.push(s);
      for (const a of mine) if (a.id !== standIn) out.push(addedSectionInstance(a));
    }
    // Added sections whose place is gone (or was never named) go before the footer.
    const loose = added.filter((a) => !a.after || !ids.has(a.after)).map(addedSectionInstance);
    if (loose.length) {
      const footer = out.findIndex((s) => s.section === 'footer');
      out.splice(footer === -1 ? out.length : footer, 0, ...loose);
    }
    sections = out;
  }
  if (order?.length) {
    const keys = orderKeys(definition, added);
    sections = withSectionOrder(sections, order, (s) => keys.get(s.id) ?? s.id);
  }
  return { ...definition, website: { ...definition.website, pages: [{ ...first, sections }, ...rest] } };
}

/** The host's order kept to what the page has (its sections and the host's own, once each). */
export function fittingSectionOrder(definition: Pick<TemplateDefinition, 'website'>, added: readonly AddedSection[] | undefined | null, order: readonly string[] | undefined | null): string[] | undefined {
  if (!order?.length) return undefined;
  const known = new Set([...(definition.website?.pages[0]?.sections ?? []).map((s) => s.id), ...(added ?? []).filter((a) => !a.replaces).map((a) => a.id)]);
  const seen = new Set<string>();
  const kept = order.filter((key) => known.has(key) && !seen.has(key) && (seen.add(key), true));
  return kept.length ? kept : undefined;
}

/** Added sections re-anchored to this template: a section that is gone means at the end (and replaces nothing). */
export function fittingAddedSections(definition: Pick<TemplateDefinition, 'website'>, added: readonly AddedSection[] | undefined | null): AddedSection[] | undefined {
  if (!added?.length) return undefined;
  const byId = new Map((definition.website?.pages[0]?.sections ?? []).map((s) => [s.id, s]));
  const taken = new Set<string>();
  return added
    .filter((a) => a.mobile.width === ADDED_SECTION_WIDTH)
    .map((a) => {
      if (a.after && !byId.has(a.after)) {
        const { replaces: _gone, ...rest } = a;
        return { ...rest, after: '' };
      }
      if (!a.replaces) return a;
      // One stand-in per section, and only for sections that can have one.
      if (!replaceable(byId.get(a.after)) || taken.has(a.after)) {
        const { replaces: _no, ...rest } = a;
        return rest;
      }
      taken.add(a.after);
      return a;
    });
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
