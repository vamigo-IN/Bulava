import type { ArtboardInput } from '@bulava/template-schema';
import { palette, TITLE } from './builder';
import { at, b, cardButtons, text, widget, type CanvasSpec } from './canvas-kit';

/**
 * The blank canvas (ADR-063): where a host starts with nothing but their names
 * and the date on plain paper, and draws the rest with every tool the editors
 * have (text, shapes, ornaments, illustrations, photos, widgets). One template
 * for every occasion; its opening is also a blank card, and its film a blank
 * film (canvas-films.ts). Galleries leave it out (the `blank` tag): the design
 * page offers it first.
 */

const INK = { font: 'heading', color: 'text' } as const;

const heroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'color', color: 'background' },
  layers: [
    text('names', TITLE, at(30, 330, 330, 130), { ...INK, size: 44, lineHeight: 1.08 }, { overflow: 'shrink', animation: { entrance: 'fadeUp' } }),
    { id: 'rule', kind: 'shape', shape: 'line', fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' }, frame: at(165, 478, 60, 2), animation: { entrance: 'fade', delaySec: 0.2 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 494, 330, 24), { font: 'body', size: 14, weight: 500, color: 'muted', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
  ],
};

const heroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'color', color: 'background' },
  layers: [
    text('names', TITLE, at(220, 300, 1000, 200), { ...INK, size: 84, lineHeight: 1.05 }, { overflow: 'shrink', animation: { entrance: 'fadeUp' } }),
    { id: 'rule', kind: 'shape', shape: 'line', fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' }, frame: at(670, 528, 100, 2), animation: { entrance: 'fade', delaySec: 0.2 } },
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(220, 552, 1000, 32), { font: 'body', size: 20, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
  ],
};

const functionCard: ArtboardInput = {
  width: 390,
  height: 520,
  background: { type: 'color', color: 'surface' },
  layers: [
    text('name', b('function.name'), at(30, 40, 330, 56), { ...INK, size: 32, lineHeight: 1.1 }, { overflow: 'shrink', animation: { entrance: 'fadeUp' } }),
    text('description', b('function.description'), at(40, 100, 310, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'primary', iconCircle: 'background', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'muted' }, at(36, 150, 318, 236), {
      animation: { entrance: 'fadeUp', delaySec: 0.2 },
    }),
    ...cardButtons(420, 36, 318, { fill: 'primary', color: 'background', outline: 'primary' }),
  ],
};

export const BLANK_SPEC: CanvasSpec = {
  key: 'blank-canvas',
  name: 'Blank Canvas',
  description: 'Start from plain paper with your names and date, and design everything else yourself: words, shapes, ornaments, illustrations, photos, a countdown and buttons, on the canvas.',
  category: 'Blank canvas',
  style: 'Canvas',
  tier: 'FREE',
  featured: false,
  tags: ['blank', 'canvas', 'minimal', 'modern'],
  eventTypes: ['WEDDING', 'ENGAGEMENT', 'BIRTHDAY', 'ANNIVERSARY', 'BABY_SHOWER', 'NAMING_CEREMONY', 'MUNDAN', 'THREAD_CEREMONY', 'HOUSEWARMING', 'RELIGIOUS', 'FESTIVAL', 'CORPORATE', 'SCHOOL_COLLEGE', 'COMMUNITY', 'RETIREMENT', 'CUSTOM'],
  colors: palette('#1f2937', '#b08d57', '#efe7da', '#fbf8f3', '#ffffff', '#1c1917', '#6b6259'),
  presets: [
    { name: 'Ivory & Ink', colors: palette('#1f2937', '#b08d57', '#efe7da', '#fbf8f3', '#ffffff', '#1c1917', '#6b6259') },
    { name: 'Blush', colors: palette('#9b2c4b', '#c98b3d', '#f6d9dd', '#fff7f3', '#ffffff', '#3a1c22', '#8a6a6f') },
    { name: 'Sage', colors: palette('#3f6b4f', '#b98f4a', '#dfe9df', '#f7f8f3', '#ffffff', '#1f2d24', '#66776b') },
    { name: 'Midnight', colors: palette('#e9c87f', '#c9a45c', '#2a2f45', '#121624', '#1b2033', '#f6f1e6', '#b9b2a3') },
  ],
  fonts: 'classic',
  look: 'modern',
  effect: 'none',
  slots: ['tagline', 'hashtag', 'closing'],
  photoSlots: ['cover', 'closing'],
  hero: { mobile: heroMobile, desktop: heroDesktop },
  card: { mobile: functionCard, desktopMaxWidth: 520, repeatPerFunction: true },
  middle: [],
};
