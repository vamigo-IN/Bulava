import { fittingAddedSections, fittingCanvasCustomization, fittingSceneCustomization, type Customization, type GalleryImage, type PhotoSlot, type RenderContext, type TemplateDefinition } from '@bulava/template-schema';
import type { MediaItem } from '@/lib/types';

/** Shared by the website design page and the video page (plain module, so both server and client code may import it). */

export const toImage = (p: MediaItem): GalleryImage => ({ url: p.viewUrl, thumbUrl: p.thumbUrl ?? p.viewUrl, width: p.width, height: p.height });

/** The event's render context with the photos the host chose or placed, for live previews. */
export function previewContext(context: RenderContext, photos: MediaItem[], custom: Customization): RenderContext {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const chosen = (custom.photoIds ?? []).map((id) => byId.get(id)).filter((p): p is MediaItem => !!p);
  const slots: Partial<Record<PhotoSlot, GalleryImage>> = {};
  for (const [slot, id] of Object.entries(custom.photoSlots ?? {})) {
    const p = id ? byId.get(id) : undefined;
    if (p) slots[slot as PhotoSlot] = toImage(p);
  }
  return { ...context, photos: chosen.map(toImage), photoSlots: slots };
}

/** Approved album photos plus anything uploaded in this session (newest first, no duplicates). */
export function mergePhotos(uploaded: MediaItem[], approved: MediaItem[] | undefined): MediaItem[] {
  const seen = new Set<string>();
  return [...uploaded, ...(approved ?? [])].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Drop choices the chosen template does not offer (e.g. after switching templates), so saving never fails on them. */
export function prune(custom: Customization, definition: TemplateDefinition | undefined): Customization {
  if (!definition) return custom;
  const e = definition.capabilities.editable;
  const slots = new Set(definition.capabilities.photoSlots ?? []);
  const sections = new Set((definition.website?.pages[0]?.sections ?? []).filter((s) => s.section !== 'hero').map((s) => s.id));
  const textSlots = new Set(definition.capabilities.textSlots.map((s) => s.key));
  const next: Customization = { ...custom };
  if (!e.colors) {
    delete next.colors;
    delete next.colorPreset;
  } else if (next.colorPreset && !definition.capabilities.colorPresets.some((p) => p.name === next.colorPreset)) delete next.colorPreset;
  if (!e.fonts) delete next.fontPairing;
  if (!e.animation) {
    delete next.intro;
    delete next.effect;
  }
  if (!e.music) delete next.musicId;
  if (!e.layout) {
    delete next.hiddenSections;
    delete next.canvas;
    delete next.addedSections;
    delete next.scenes;
  } else {
    if (next.hiddenSections) next.hiddenSections = next.hiddenSections.filter((id) => sections.has(id));
    // The host's canvases fit only the sections (and sizes) this template still has; their own sections move to the end if their place is gone.
    const canvas = fittingCanvasCustomization(definition, next.canvas);
    if (canvas) next.canvas = canvas;
    else delete next.canvas;
    const added = definition.type === 'WEBSITE' ? fittingAddedSections(definition, next.addedSections) : undefined;
    if (added?.length) next.addedSections = added;
    else delete next.addedSections;
    // A film's redrawn scenes fit only the scenes (and sizes) it still has.
    const scenes = fittingSceneCustomization(definition, next.scenes);
    if (scenes) next.scenes = scenes;
    else delete next.scenes;
  }
  if (!e.photos) {
    delete next.photoSlots;
    delete next.photoIds;
  } else {
    if (next.photoSlots) next.photoSlots = Object.fromEntries(Object.entries(next.photoSlots).filter(([k]) => slots.has(k as PhotoSlot)));
    if (next.photoIds) next.photoIds = next.photoIds.slice(0, definition.capabilities.maxPhotos);
  }
  if (!e.text) delete next.custom;
  else if (next.custom) next.custom = Object.fromEntries(Object.entries(next.custom).filter(([k]) => textSlots.has(k)));
  return next;
}
