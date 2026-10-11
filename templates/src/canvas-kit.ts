import type { ArtboardInput, CanvasSectionInput, EffectName, IntroName, LayerInput, LookName, OrnamentLayerName, PhotoSlot, Value } from '@bulava/template-schema';
import { fontsFor, palette, SLOTS, type CatalogEntry, type CatalogMeta, type FontPreset, type SlotKey } from './builder';

/**
 * Building blocks for canvas templates (canvas.ts, canvas-cards.ts): value and
 * layer shorthands, and the website a canvas design becomes (canvas hero, a
 * canvas card per function, standard sections, RSVP and footer).
 */

export const b = (binding: string, extra: Partial<{ format: 'date' | 'dateWithWeekday' | 'dateShort' | 'time' | 'upper' | 'dateTime'; fallback: Value }> = {}): Value => ({ binding, ...extra });
export const t = (key: string): Value => ({ t: key });
export const lit = (literal: string): Value => ({ literal });
/** Seconds rounded to hundredths: sums like 0.35 + 0.1 would otherwise store float noise in the definition. */
export const sec = (n: number) => Math.round(n * 100) / 100;

type TextInput = Extract<LayerInput, { kind: 'text' }>;
type OrnamentInput = Extract<LayerInput, { kind: 'ornament' }>;
type ShapeInput = Extract<LayerInput, { kind: 'shape' }>;
type ImageInput = Extract<LayerInput, { kind: 'image' }>;
type SceneInput = Extract<LayerInput, { kind: 'scene' }>;
type WidgetInput = Extract<LayerInput, { kind: 'widget' }>;
export type TextStyleInput = NonNullable<TextInput['style']>;

export interface CanvasSpec extends Omit<CatalogMeta, 'sortOrder'> {
  colors: ReturnType<typeof palette>;
  presets?: Array<{ name: string; colors: ReturnType<typeof palette> }>;
  fonts: FontPreset;
  look: LookName;
  effect: EffectName;
  intro?: IntroName;
  slots: SlotKey[];
  photoSlots: PhotoSlot[];
  hero: CanvasSectionInput;
  /** Canvas sections between the hero and the function cards (a blessing card, an invitation note…). */
  extra?: Array<{ id: string; canvas: CanvasSectionInput }>;
  card: CanvasSectionInput;
  /** Standard sections after the canvas ones (before rsvp and footer). */
  middle: Array<{ id: string; section: string; variant?: string; props?: Record<string, Value> }>;
}

/** Shorthand for a layer frame. */
export const at = (x: number, y: number, w: number, h: number, rotate?: number) => ({ x, y, w, h, ...(rotate ? { rotate } : {}) });
export type Frame = ReturnType<typeof at>;

export const text = (id: string, content: Value, frame: Frame, style: TextStyleInput, extra: Partial<TextInput> = {}): LayerInput => ({
  id,
  kind: 'text',
  frame,
  content,
  style,
  ...extra,
});

/** The eyebrow line reads differently for each event type the template serves. */
export function eyebrows(id: string, frame: Frame, lines: Array<[string[], Value]>, style: TextStyleInput): LayerInput[] {
  return lines.map(([eventTypes, content], i) => text(`${id}-${i + 1}`, content, frame, style, { visibleWhen: { eventTypes }, animation: { entrance: 'fadeDown', delaySec: 0.1 } }));
}

export const orn = (id: string, ornament: OrnamentLayerName, frame: Frame, extra: Partial<OrnamentInput> = {}): LayerInput => ({ id, kind: 'ornament', ornament, frame, ...extra });

export const shape = (id: string, kind: ShapeInput['shape'], frame: Frame, extra: Partial<ShapeInput> = {}): LayerInput => ({ id, kind: 'shape', shape: kind, frame, ...extra });

export const scene = (id: string, name: SceneInput['scene'], frame: Frame, extra: Partial<SceneInput> = {}): LayerInput => ({ id, kind: 'scene', scene: name, frame, ...extra });

/** A host photo (hidden when the host has none, so designs put a shape or ornament behind it). */
export const photo = (id: string, binding: string, frame: Frame, extra: Partial<ImageInput> = {}): LayerInput => ({ id, kind: 'image', source: { type: 'binding', binding }, frame, alt: '', ...extra });

export const widget = (id: string, w: WidgetInput['widget'], frame: Frame, extra: Partial<WidgetInput> = {}): LayerInput => ({ id, kind: 'widget', widget: w, frame, ...extra });

/** Get directions and Add to calendar, side by side. */
export function cardButtons(y: number, x: number, width: number, opts: { fill: 'primary' | 'secondary' | 'accent' | 'surface' | 'background' | 'text'; color: 'primary' | 'secondary' | 'accent' | 'surface' | 'background' | 'text'; outline: 'primary' | 'secondary' | 'accent' | 'text' | 'surface'; radius?: number; delay?: number }): LayerInput[] {
  const half = (width - 10) / 2;
  return [
    widget('directions', { type: 'button', label: t('template.getDirections'), action: 'directions', icon: 'navigation', fill: opts.fill, color: opts.color, size: 12, weight: 600, font: 'body', radius: opts.radius ?? 40, shadow: true }, at(x, y, half, 44), { animation: { entrance: 'pop', delaySec: opts.delay ?? 0.35 } }),
    widget('calendar', { type: 'button', label: t('template.addToCalendar'), action: 'calendar', icon: 'calendar', fill: 'transparent', color: opts.outline, size: 12, weight: 600, font: 'body', radius: opts.radius ?? 40, border: { width: 1.5, color: opts.outline }, shadow: false }, at(x + half + 10, y, half, 44), { animation: { entrance: 'pop', delaySec: sec((opts.delay ?? 0.35) + 0.1) } }),
  ];
}

/** The website a canvas design becomes: its canvas sections, standard sections, RSVP and footer. */
export function canvasWebsite(spec: CanvasSpec, sortOrder: number): CatalogEntry {
  return {
    meta: {
      key: spec.key,
      name: spec.name,
      description: spec.description,
      category: spec.category,
      style: spec.style,
      tier: spec.tier,
      badge: spec.badge,
      featured: spec.featured,
      tags: spec.tags,
      eventTypes: spec.eventTypes,
      sortOrder,
    },
    definition: {
      schemaVersion: 1,
      templateKey: spec.key,
      type: 'WEBSITE',
      name: spec.name,
      description: spec.description,
      eventTypes: spec.eventTypes,
      languages: ['en', 'hi', 'hi-Latn'],
      theme: { colors: spec.colors, radius: 20, ornament: 'none', pattern: 'none', heroTone: 'light', look: spec.look, effect: spec.effect },
      fonts: fontsFor(spec.fonts),
      capabilities: {
        editable: { colors: true, fonts: true, music: false, background: false, layout: true, photos: true, text: true, animation: true },
        colorPresets: spec.presets ?? [],
        textSlots: spec.slots.map((s) => SLOTS[s]),
        maxPhotos: 6,
        photoSlots: spec.photoSlots,
      },
      website: {
        intro: spec.intro ?? 'none',
        pages: [
          {
            id: 'home',
            sections: [
              { id: 'hero', section: 'canvas', canvas: spec.hero },
              ...(spec.extra ?? []).map((e) => ({ id: e.id, section: 'canvas', canvas: e.canvas })),
              { id: 'functions', section: 'canvas', canvas: spec.card },
              ...spec.middle,
              { id: 'rsvp', section: 'rsvp' },
              { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
            ] as never,
          },
        ],
      },
    },
  };
}

export type { ArtboardInput, CanvasSectionInput, EffectName, LayerInput, LookName, PhotoSlot };
