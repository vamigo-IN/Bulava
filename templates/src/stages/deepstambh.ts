import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T14 · Deepstambh (final.md §5.2, §5.3 T14): a temple courtyard at dusk; the silk curtain rises for the sandhya aarti.
 * Stage `deepstambh` (packages/template-engine/src/stage/sets/), opening `silk`, track `original-sandhya-aarti`.
 */
export const deepstambh: StageTemplateSpec = {
  website: {
    key: 'deepstambh', name: 'Deepstambh', category: 'Puja & Ceremonies', style: 'Temple', tier: 'SIGNATURE', badge: 'NEW',
    description: "At dusk the temple's silk curtain rises for the sandhya aarti: a stone lamp tower ablaze with wicks, a bell pavilion, incense haze and the sanctum's open doors glowing. For pujas, kathas and every sacred function.",
    tags: ['signature', 'stage', 'puja', 'religious', 'traditional', 'dusk'], eventTypes: ['RELIGIOUS'], layout: 'signature-celebration',
    stage: 'deepstambh', intro: 'silk', defaultTrack: 'original-sandhya-aarti', eyebrow: 'template.puja', heroTitle: 'event', invocation: INVOCATION.om,
    colors: palette('#4a1017', '#c48a2b', '#f6c35a', '#fcf6ee', '#f6eadb', '#2a1416', '#7a5f5a'),
    presets: [
      { name: 'Aarti Maroon', colors: palette('#4a1017', '#c48a2b', '#f6c35a', '#fcf6ee', '#f6eadb', '#2a1416', '#7a5f5a') },
      { name: 'Temple Saffron', colors: palette('#9a3412', '#c48a2b', '#fcd9a8', '#fffaf3', '#fbeedd', '#2f1a0d', '#86684f') },
      { name: 'Indigo Dusk', colors: palette('#1a2050', '#d19a3a', '#f8dd98', '#f7f8fc', '#ecedf6', '#141a3a', '#5e6480') },
    ],
    look: 'heritage', effect: 'goldDust', heroTone: 'dark', fonts: 'heritage', ornament: 'lotus', dress: { frame: 'niche', edge: 'none', seal: 'sunburst', skyline: 'diyaRow' },
    countdown: 'flip', story: 'letter', timeline: 'diya', venue: 'illustrated', gallery: 'frames', rsvp: 'card', footer: 'seal',
  },
  film: {
    description: "The temple's silk curtain rises for the sandhya aarti: the camera circles the stone lamp tower ablaze with wicks as your invitation appears, glides past the bell pavilion for each part of the puja and draws back under the courtyard gate's toran, the sanctum's doors still glowing.",
    people: 'one', nameStyle: 'caps', motif: 'diya',
    shots: { names: 'orbitLeft', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.7, functions: 0.5, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'goldDust' },
  },
};
