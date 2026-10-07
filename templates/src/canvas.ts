import type { ArtboardInput, CanvasSectionInput, EffectName, LayerInput, LookName, PhotoSlot, Value } from '@bulava/template-schema';
import { fontsFor, palette, SLOTS, TITLE, type CatalogEntry, type CatalogMeta, type FontPreset, type SlotKey } from './builder';

/**
 * Canvas templates: pages whose hero and function cards are free-form
 * artboards (docs/templates.md#canvas-sections), the kind of composition a
 * designer lays out in the Studio's Canvas editor. These two show what the
 * canvas can do with the engine's own ornaments, shapes, icons and widgets, and
 * no licensed images; designers add painted or photographic layers from the
 * asset library. The rest of each page uses the standard sections.
 */

const b = (binding: string, extra: Partial<{ format: 'date' | 'dateWithWeekday' | 'time' | 'upper' | 'dateTime'; fallback: Value }> = {}): Value => ({ binding, ...extra });
const t = (key: string): Value => ({ t: key });

interface CanvasSpec extends Omit<CatalogMeta, 'sortOrder'> {
  colors: ReturnType<typeof palette>;
  presets?: Array<{ name: string; colors: ReturnType<typeof palette> }>;
  fonts: FontPreset;
  look: LookName;
  effect: EffectName;
  slots: SlotKey[];
  photoSlots: PhotoSlot[];
  hero: CanvasSectionInput;
  card: CanvasSectionInput;
  /** Standard sections after the canvas ones (before rsvp and footer). */
  middle: Array<{ id: string; section: string; variant?: string; props?: Record<string, Value> }>;
}

/** Shorthand for a layer frame. */
const at = (x: number, y: number, w: number, h: number, rotate?: number) => ({ x, y, w, h, ...(rotate ? { rotate } : {}) });

const text = (id: string, content: Value, frame: ReturnType<typeof at>, style: NonNullable<Extract<LayerInput, { kind: 'text' }>['style']>, extra: Partial<Extract<LayerInput, { kind: 'text' }>> = {}): LayerInput => ({
  id,
  kind: 'text',
  frame,
  content,
  style,
  ...extra,
});

/** The eyebrow line reads differently for each event type the template serves. */
function eyebrows(id: string, frame: ReturnType<typeof at>, lines: Array<[string[], Value]>, style: NonNullable<Extract<LayerInput, { kind: 'text' }>['style']>): LayerInput[] {
  return lines.map(([eventTypes, content], i) => text(`${id}-${i + 1}`, content, frame, style, { visibleWhen: { eventTypes }, animation: { entrance: 'fadeDown', delaySec: 0.1 } }));
}

// ─────────────────────────── Rose Arch ───────────────────────────

const ROSE_EYEBROW = { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.28, transform: 'upper' } as const;

const roseHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 180 } },
  layers: [
    { id: 'mandala', kind: 'ornament', ornament: 'mandala', color: 'secondary', frame: at(45, 115, 300, 300), opacity: 0.22, animation: { entrance: 'none', motion: 'spin' } },
    { id: 'corner-l', kind: 'ornament', ornament: 'floral', color: 'secondary', frame: at(-30, -20, 200, 200), opacity: 0.85, animation: { entrance: 'fade', motion: 'sway' } },
    { id: 'corner-r', kind: 'ornament', ornament: 'floral', color: 'secondary', frame: at(220, -20, 200, 200), flipX: true, opacity: 0.85, animation: { entrance: 'fade', motion: 'sway', delaySec: 0.2 } },
    text('hashtag', b('custom.hashtag'), at(60, 34, 270, 24), { font: 'body', size: 12, weight: 600, color: 'secondary', letterSpacing: 0.12 }, { visibleWhen: { exists: 'custom.hashtag' }, animation: { entrance: 'fade', delaySec: 0.6 } }),
    { id: 'arch-back', kind: 'shape', shape: 'arch', fill: { type: 'color', color: 'surface' }, stroke: { width: 3, color: 'secondary' }, frame: at(75, 150, 240, 330), shadow: true, animation: { entrance: 'zoomIn' } },
    { id: 'arch-lotus', kind: 'ornament', ornament: 'lotus', color: 'accent', frame: at(115, 250, 160, 160), opacity: 0.9, animation: { entrance: 'zoomIn', delaySec: 0.2 } },
    { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photo.cover' }, mask: 'arch', frame: at(84, 159, 222, 312), border: { width: 3, color: 'surface' }, alt: '', animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    ...eyebrows('eyebrow', at(40, 500, 310, 20), [[['WEDDING'], t('template.weddingOf')], [['ENGAGEMENT'], t('template.engagementOf')]], ROSE_EYEBROW),
    text('names', TITLE, at(20, 518, 350, 124), { font: 'script', size: 50, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('blessings', t('template.blessings'), at(30, 652, 330, 20), { font: 'body', size: 9, weight: 500, color: 'muted', letterSpacing: 0.16, transform: 'upper' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    { id: 'rule', kind: 'shape', shape: 'line', fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' }, frame: at(150, 684, 90, 2), animation: { entrance: 'fade', delaySec: 0.4 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 694, 330, 24), { font: 'heading', size: 17, weight: 600, color: 'text', letterSpacing: 0.06, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('city', b('venue.city'), at(40, 720, 310, 20), { font: 'body', size: 13, color: 'muted', letterSpacing: 0.1 }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    { id: 'countdown', kind: 'widget', widget: { type: 'countdown', variant: 'boxes', size: 24, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, frame: at(30, 752, 330, 74), animation: { entrance: 'fadeUp', delaySec: 0.55 } },
  ],
};

const roseHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 160 } },
  layers: [
    { id: 'mandala', kind: 'ornament', ornament: 'mandala', color: 'secondary', frame: at(760, 30, 840, 840), opacity: 0.16, animation: { entrance: 'none', motion: 'spin' } },
    { id: 'corner-r', kind: 'ornament', ornament: 'floral', color: 'secondary', frame: at(1080, -60, 420, 420), flipX: true, opacity: 0.85, animation: { entrance: 'fade', motion: 'sway' } },
    { id: 'corner-l', kind: 'ornament', ornament: 'floral', color: 'secondary', frame: at(-80, 560, 420, 420), flipY: true, opacity: 0.7, animation: { entrance: 'fade', motion: 'sway', delaySec: 0.2 } },
    text('hashtag', b('custom.hashtag'), at(120, 70, 400, 28), { font: 'body', size: 15, weight: 600, color: 'secondary', letterSpacing: 0.14, align: 'left' }, { visibleWhen: { exists: 'custom.hashtag' }, animation: { entrance: 'fade', delaySec: 0.6 } }),
    { id: 'arch-back', kind: 'shape', shape: 'arch', fill: { type: 'color', color: 'surface' }, stroke: { width: 5, color: 'secondary' }, frame: at(880, 90, 440, 700), shadow: true, animation: { entrance: 'zoomIn' } },
    { id: 'arch-lotus', kind: 'ornament', ornament: 'lotus', color: 'accent', frame: at(950, 300, 300, 300), opacity: 0.9, animation: { entrance: 'zoomIn', delaySec: 0.2 } },
    { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photo.cover' }, mask: 'arch', frame: at(896, 106, 408, 668), border: { width: 5, color: 'surface' }, alt: '', animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    ...eyebrows('eyebrow', at(120, 250, 640, 28), [[['WEDDING'], t('template.weddingOf')], [['ENGAGEMENT'], t('template.engagementOf')]], { ...ROSE_EYEBROW, size: 15, align: 'left' }),
    text('names', TITLE, at(110, 280, 660, 250), { font: 'script', size: 108, color: 'primary', lineHeight: 1.02, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('blessings', t('template.blessings'), at(120, 540, 640, 26), { font: 'body', size: 13, weight: 500, color: 'muted', letterSpacing: 0.2, transform: 'upper', align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    { id: 'rule', kind: 'shape', shape: 'line', fill: { type: 'color', color: 'secondary' }, stroke: { width: 2, color: 'secondary' }, frame: at(120, 588, 140, 2), animation: { entrance: 'fade', delaySec: 0.4 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(120, 606, 640, 36), { font: 'heading', size: 26, weight: 600, color: 'text', letterSpacing: 0.08, transform: 'upper', align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('city', b('venue.city'), at(120, 648, 640, 26), { font: 'body', size: 17, color: 'muted', letterSpacing: 0.12, align: 'left' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    { id: 'countdown', kind: 'widget', widget: { type: 'countdown', variant: 'boxes', size: 40, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, frame: at(120, 710, 600, 120), animation: { entrance: 'fadeUp', delaySec: 0.55 } },
  ],
};

const roseCard: ArtboardInput = {
  width: 390,
  height: 640,
  background: { type: 'color', color: 'surface' },
  layers: [
    { id: 'band', kind: 'shape', shape: 'scallop', fill: { type: 'color', color: 'accent' }, frame: at(-10, -30, 410, 150, 180) },
    { id: 'toran', kind: 'ornament', ornament: 'toran', color: 'secondary', frame: at(0, -6, 390, 84), animation: { entrance: 'fadeDown', motion: 'sway' } },
    text('eyebrow', t('template.schedule.title'), at(40, 128, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }, { animation: { entrance: 'fade' } }),
    text('name', b('function.name'), at(24, 146, 342, 84), { font: 'script', size: 46, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(40, 232, 310, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.15 } }),
    { id: 'rule', kind: 'shape', shape: 'line', fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' }, frame: at(150, 282, 90, 2) },
    { id: 'details', kind: 'widget', widget: { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'primary', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'muted' }, frame: at(36, 296, 318, 236), animation: { entrance: 'fadeUp', delaySec: 0.2 } },
    { id: 'directions', kind: 'widget', widget: { type: 'button', label: t('template.getDirections'), action: 'directions', icon: 'navigation', fill: 'primary', color: 'background', size: 12, weight: 600, font: 'body', radius: 40, shadow: true }, frame: at(36, 548, 154, 44), animation: { entrance: 'pop', delaySec: 0.35 } },
    { id: 'calendar', kind: 'widget', widget: { type: 'button', label: t('template.addToCalendar'), action: 'calendar', icon: 'calendar', fill: 'surface', color: 'primary', size: 12, weight: 600, font: 'body', radius: 40, border: { width: 1.5, color: 'primary' }, shadow: false }, frame: at(200, 548, 154, 44), animation: { entrance: 'pop', delaySec: 0.45 } },
    { id: 'lotus', kind: 'ornament', ornament: 'lotus', color: 'secondary', frame: at(171, 600, 48, 32), opacity: 0.7 },
  ],
};

// ─────────────────────────── Confetti Pop ───────────────────────────

const star = (id: string, x: number, y: number, s: number, color: 'secondary' | 'accent' | 'primary', motion: 'twinkle' | 'float', delay = 0): LayerInput => ({
  id,
  kind: 'shape',
  shape: 'star',
  fill: { type: 'color', color },
  frame: at(x, y, s, s, (x * 7) % 40),
  opacity: 0.9,
  animation: { entrance: 'pop', delaySec: delay, motion },
});

const POP_EYEBROW = { font: 'body', size: 12, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper' } as const;

const popHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'color', color: 'background' },
  layers: [
    { id: 'confetti', kind: 'ornament', ornament: 'confetti', color: 'accent', frame: at(-20, -20, 430, 500), opacity: 0.35, animation: { entrance: 'fade' } },
    { id: 'blob', kind: 'shape', shape: 'ellipse', fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 140 } }, frame: at(40, 70, 310, 310), opacity: 0.18, animation: { entrance: 'zoomIn', motion: 'breathe' } },
    star('star-1', 44, 96, 34, 'secondary', 'twinkle', 0.4),
    star('star-2', 318, 128, 26, 'primary', 'float', 0.5),
    star('star-3', 300, 350, 20, 'secondary', 'twinkle', 0.6),
    star('star-4', 56, 330, 16, 'accent', 'float', 0.7),
    { id: 'photo-pop', kind: 'shape', shape: 'ellipse', fill: { type: 'color', color: 'secondary' }, frame: at(94, 120, 224, 224), animation: { entrance: 'zoomIn' } },
    // Shows through only when the host has not placed a cover photo (the photo paints over it).
    { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(160, 186, 92, 92), opacity: 0.9, animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photo.cover' }, mask: 'circle', frame: at(83, 108, 224, 224), border: { width: 6, color: 'surface' }, shadow: true, alt: '', animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    ...eyebrows('eyebrow', at(30, 372, 330, 22), [[['BIRTHDAY'], t('template.birthdayOf')], [['ANNIVERSARY', 'BABY_SHOWER', 'NAMING_CEREMONY', 'MUNDAN'], t('template.celebrateWith')]], POP_EYEBROW),
    text('names', TITLE, at(20, 396, 350, 120), { font: 'heading', size: 44, weight: 800, color: 'text', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('tagline', b('custom.tagline'), at(40, 520, 310, 44), { font: 'body', size: 15, color: 'muted', lineHeight: 1.4 }, { visibleWhen: { exists: 'custom.tagline' }, animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    { id: 'pill', kind: 'shape', shape: 'rect', fill: { type: 'color', color: 'primary' }, radius: 999, frame: at(55, 580, 280, 52), shadow: true, animation: { entrance: 'pop', delaySec: 0.35 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(70, 580, 250, 52), { font: 'heading', size: 15, weight: 700, color: 'background', letterSpacing: 0.04 }, { animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(40, 642, 310, 22), { font: 'body', size: 13, weight: 600, color: 'muted', letterSpacing: 0.14, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    { id: 'countdown', kind: 'widget', widget: { type: 'countdown', variant: 'boxes', size: 26, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, frame: at(30, 690, 330, 80), animation: { entrance: 'fadeUp', delaySec: 0.55 } },
    { id: 'rsvp', kind: 'widget', widget: { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'background', size: 14, weight: 700, font: 'body', radius: 40, shadow: true }, frame: at(105, 786, 180, 46), animation: { entrance: 'pop', delaySec: 0.7 } },
  ],
};

const popHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'color', color: 'background' },
  layers: [
    { id: 'confetti', kind: 'ornament', ornament: 'confetti', color: 'accent', frame: at(700, -40, 820, 980), opacity: 0.3, animation: { entrance: 'fade' } },
    { id: 'blob', kind: 'shape', shape: 'ellipse', fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 140 } }, frame: at(820, 120, 620, 620), opacity: 0.16, animation: { entrance: 'zoomIn', motion: 'breathe' } },
    star('star-1', 760, 150, 56, 'secondary', 'twinkle', 0.4),
    star('star-2', 1320, 180, 44, 'primary', 'float', 0.5),
    star('star-3', 1290, 700, 36, 'secondary', 'twinkle', 0.6),
    star('star-4', 790, 690, 28, 'accent', 'float', 0.7),
    { id: 'photo-pop', kind: 'shape', shape: 'ellipse', fill: { type: 'color', color: 'secondary' }, frame: at(912, 212, 460, 460), animation: { entrance: 'zoomIn' } },
    { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(1052, 352, 180, 180), opacity: 0.9, animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photo.cover' }, mask: 'circle', frame: at(890, 190, 460, 460), border: { width: 10, color: 'surface' }, shadow: true, alt: '', animation: { entrance: 'zoomIn', delaySec: 0.1 } },
    ...eyebrows('eyebrow', at(120, 230, 620, 28), [[['BIRTHDAY'], t('template.birthdayOf')], [['ANNIVERSARY', 'BABY_SHOWER', 'NAMING_CEREMONY', 'MUNDAN'], t('template.celebrateWith')]], { ...POP_EYEBROW, size: 16, align: 'left' }),
    text('names', TITLE, at(116, 262, 640, 230), { font: 'heading', size: 88, weight: 800, color: 'text', lineHeight: 1.02, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('tagline', b('custom.tagline'), at(120, 500, 600, 60), { font: 'body', size: 20, color: 'muted', lineHeight: 1.45, align: 'left' }, { visibleWhen: { exists: 'custom.tagline' }, animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    { id: 'pill', kind: 'shape', shape: 'rect', fill: { type: 'color', color: 'primary' }, radius: 999, frame: at(120, 580, 420, 64), shadow: true, animation: { entrance: 'pop', delaySec: 0.35 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(140, 580, 380, 64), { font: 'heading', size: 19, weight: 700, color: 'background', letterSpacing: 0.04 }, { animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(560, 580, 300, 64), { font: 'body', size: 16, weight: 600, color: 'muted', letterSpacing: 0.14, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    { id: 'countdown', kind: 'widget', widget: { type: 'countdown', variant: 'boxes', size: 40, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, frame: at(120, 690, 560, 118), animation: { entrance: 'fadeUp', delaySec: 0.55 } },
    { id: 'rsvp', kind: 'widget', widget: { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'background', size: 18, weight: 700, font: 'body', radius: 60, shadow: true }, frame: at(720, 718, 240, 62), animation: { entrance: 'pop', delaySec: 0.7 } },
  ],
};

const popCard: ArtboardInput = {
  width: 390,
  height: 560,
  background: { type: 'color', color: 'surface' },
  layers: [
    { id: 'wash', kind: 'shape', shape: 'rect', fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 120 } }, frame: at(0, 0, 390, 150), opacity: 0.92 },
    { id: 'confetti', kind: 'ornament', ornament: 'confetti', color: 'background', frame: at(-10, -30, 410, 220), opacity: 0.4 },
    star('c-star-1', 30, 24, 26, 'secondary', 'twinkle', 0.3),
    star('c-star-2', 330, 96, 20, 'secondary', 'float', 0.4),
    text('eyebrow', t('template.schedule.title'), at(40, 46, 310, 18), { font: 'body', size: 10, weight: 700, color: 'background', letterSpacing: 0.3, transform: 'upper' }, { animation: { entrance: 'fade' } }),
    text('name', b('function.name'), at(24, 66, 342, 64), { font: 'heading', size: 34, weight: 800, color: 'background', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(40, 166, 310, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.15 } }),
    { id: 'details', kind: 'widget', widget: { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'primary', iconCircle: 'background', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'muted' }, frame: at(36, 214, 318, 236), animation: { entrance: 'fadeUp', delaySec: 0.2 } },
    { id: 'directions', kind: 'widget', widget: { type: 'button', label: t('template.getDirections'), action: 'directions', icon: 'navigation', fill: 'primary', color: 'background', size: 12, weight: 700, font: 'body', radius: 14, shadow: true }, frame: at(36, 470, 154, 46), animation: { entrance: 'pop', delaySec: 0.35 } },
    { id: 'calendar', kind: 'widget', widget: { type: 'button', label: t('template.addToCalendar'), action: 'calendar', icon: 'calendar', fill: 'background', color: 'primary', size: 12, weight: 700, font: 'body', radius: 14, border: { width: 1.5, color: 'primary' }, shadow: false }, frame: at(200, 470, 154, 46), animation: { entrance: 'pop', delaySec: 0.45 } },
  ],
};

// ─────────────────────────── Catalog entries ───────────────────────────

const SPECS: CanvasSpec[] = [
  {
    key: 'rose-arch-card',
    name: 'Rose Arch',
    description: 'A blush-and-gold invitation designed on the canvas: your photo in a gilded arch under a slow mandala, names in script, and a card for every function with the date, time and venue, directions and an add-to-calendar button.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'hindu', 'floral', 'romantic', 'modern'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#9b2c4b', '#c98b3d', '#f6d9dd', '#fff7f3', '#ffffff', '#3a1c22', '#8a6a6f'),
    presets: [
      { name: 'Blush & Gold', colors: palette('#9b2c4b', '#c98b3d', '#f6d9dd', '#fff7f3', '#ffffff', '#3a1c22', '#8a6a6f') },
      { name: 'Sage & Ivory', colors: palette('#3f6b4f', '#b98f4a', '#dfe9df', '#f7f8f3', '#ffffff', '#1f2d24', '#66776b') },
      { name: 'Royal Plum', colors: palette('#5b1f4d', '#c99a3d', '#eed7e6', '#fbf5f9', '#ffffff', '#2b1226', '#7d6377') },
    ],
    fonts: 'romantic',
    look: 'garden',
    effect: 'petals',
    slots: ['tagline', 'story', 'partnerOneParents', 'partnerTwoParents', 'hashtag', 'closing'],
    photoSlots: ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'],
    hero: { mobile: roseHeroMobile, desktop: roseHeroDesktop },
    card: { mobile: roseCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: [
      { id: 'couple', section: 'couple', variant: 'arch', props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
      { id: 'story', section: 'story', variant: 'polaroid', props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'gallery', section: 'gallery', variant: 'mosaic' },
    ],
  },
  {
    key: 'confetti-pop-card',
    name: 'Confetti Pop',
    description: 'Bold, bright and designed on the canvas: a round photo on a burst of colour, twinkling stars and confetti, a date pill, countdown and an RSVP button, then a colour-washed card for every part of the day.',
    category: 'Birthday',
    style: 'Canvas',
    tier: 'FREE',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'modern', 'playful', 'kids'],
    eventTypes: ['BIRTHDAY', 'ANNIVERSARY', 'BABY_SHOWER', 'NAMING_CEREMONY', 'MUNDAN'],
    colors: palette('#e11d74', '#f59e0b', '#6366f1', '#fffbeb', '#ffffff', '#1f1235', '#6b5b7a'),
    presets: [
      { name: 'Candy', colors: palette('#e11d74', '#f59e0b', '#6366f1', '#fffbeb', '#ffffff', '#1f1235', '#6b5b7a') },
      { name: 'Ocean', colors: palette('#0369a1', '#f59e0b', '#14b8a6', '#f0fdfa', '#ffffff', '#0f2530', '#52707a') },
      { name: 'Mint & Coral', colors: palette('#f26b5b', '#fbbf24', '#2dd4bf', '#fefce8', '#ffffff', '#2a1a1a', '#7a6262') },
    ],
    fonts: 'modern',
    look: 'celebration',
    effect: 'confetti',
    slots: ['tagline', 'about', 'hashtag', 'closing'],
    photoSlots: ['cover', 'story', 'closing'],
    hero: { mobile: popHeroMobile, desktop: popHeroDesktop },
    card: { mobile: popCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: [
      { id: 'about', section: 'story', variant: 'polaroid', props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'gallery', section: 'gallery', variant: 'polaroid' },
    ],
  },
];

function canvasWebsite(spec: CanvasSpec, sortOrder: number): CatalogEntry {
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
        intro: 'none',
        pages: [
          {
            id: 'home',
            sections: [
              { id: 'hero', section: 'canvas', canvas: spec.hero },
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

/** Sort after the standard website templates (index.ts passes the offset). */
export const canvasTemplates = (offset: number): CatalogEntry[] => SPECS.map((spec, i) => canvasWebsite(spec, offset + i));
