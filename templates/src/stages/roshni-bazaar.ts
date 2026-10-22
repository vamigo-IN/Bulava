import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T15 · Roshni Bazaar (final.md §5.2, §5.3 T15): a festive lane at night through a bamboo gate strung with lanterns.
 * Stage `bazaar` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-roshni-dhamaal`.
 */
export const roshniBazaar: StageTemplateSpec = {
  website: {
    key: 'roshni-bazaar', name: 'Roshni Bazaar', category: 'Festival', style: 'Festive', tier: 'SIGNATURE', badge: 'NEW',
    description: 'A festive lane at night: through a bamboo gate strung with lanterns, past shopfronts with lit windows, rangoli on every step and stalls of sweets, to a glowing gate as fireworks bloom. Presets for Diwali, Eid and Christmas.',
    tags: ['signature', 'stage', 'festival', 'lights', 'night'], eventTypes: ['FESTIVAL'], layout: 'signature-celebration',
    stage: 'bazaar', intro: 'arrival', defaultTrack: 'original-roshni-dhamaal', eyebrow: 'template.celebrateWith', heroTitle: 'event',
    colors: palette('#1c2a5a', '#ef9b2f', '#ffd37a', '#fdf9f1', '#f6eedc', '#171d3a', '#5f6680'),
    presets: [
      { name: 'Indigo Lights', colors: palette('#1c2a5a', '#ef9b2f', '#ffd37a', '#fdf9f1', '#f6eedc', '#171d3a', '#5f6680') },
      { name: 'Eid Emerald', colors: palette('#0f4a3a', '#c9a24a', '#efe3b3', '#f5faf7', '#e8f1ec', '#102520', '#5a7068') },
      { name: 'Noel Red', colors: palette('#7a1c1c', '#2f6b3a', '#f3d27a', '#fdf7f3', '#f7ebe6', '#2a1414', '#765a5a') },
    ],
    look: 'celebration', effect: 'lanterns', heroTone: 'dark', fonts: 'desi', ornament: 'marigold', dress: { frame: 'scallop', edge: 'fairyLights', seal: 'sunburst', skyline: 'lanterns' },
    countdown: 'flip', story: 'default', timeline: 'tickets', venue: 'default', gallery: 'depth', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'Through a bamboo gate strung with lanterns into a festive lane at night: the camera glides down the lane under the lanterns as your celebration is announced and fireworks bloom, moves past the stalls of sweets for each part of the evening and draws back from the glowing gate.',
    people: 'one', nameStyle: 'script', motif: 'lantern',
    shots: { names: 'dollyIn', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.6, functions: 0.5 },
    particles: { opening: 'lanterns', names: 'goldDust', closing: 'confetti' },
  },
};
