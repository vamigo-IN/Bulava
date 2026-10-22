import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T10 · Jasmine Aangan (final.md §5.2, §5.3 T10): a South Indian courtyard at dawn through a stone torana's jasmine strands.
 * Stage `aangan` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-prabhat-bansuri`.
 */
export const jasmineAangan: StageTemplateSpec = {
  website: {
    key: 'jasmine-aangan', name: 'Jasmine Aangan', category: 'Naming Ceremony', style: 'Traditional', tier: 'SIGNATURE', badge: 'NEW',
    description: "A South Indian courtyard at dawn: a stone torana's jasmine strands part, and you walk past teak pillars and brass lamps to a decorated cradle under a mango-leaf toran. For the naming of your little one, with a dawn bansuri.",
    tags: ['signature', 'stage', 'namkaran', 'naming', 'traditional', 'south-indian'], eventTypes: ['NAMING_CEREMONY'], layout: 'signature-celebration',
    stage: 'aangan', intro: 'arrival', defaultTrack: 'original-prabhat-bansuri', eyebrow: 'template.naming', invocation: INVOCATION.hindu,
    colors: palette('#1f5a46', '#c59a3a', '#fff6e6', '#fbfaf4', '#f2f1e6', '#1c2a24', '#5f6f67'),
    presets: [
      { name: 'Jasmine Green', colors: palette('#1f5a46', '#c59a3a', '#fff6e6', '#fbfaf4', '#f2f1e6', '#1c2a24', '#5f6f67') },
      { name: 'Kumkum Red', colors: palette('#8a1c2a', '#c59a3a', '#fde9c8', '#fdf7f3', '#f7ece6', '#2a1416', '#7a5c5e') },
      { name: 'Haldi Yellow', colors: palette('#8a5a0f', '#c0871f', '#ffe9a8', '#fdfaf0', '#f8f1dc', '#2a2010', '#76684a') },
    ],
    look: 'heritage', effect: 'petals', heroTone: 'light', fonts: 'heritage', ornament: 'temple', dress: { frame: 'niche', edge: 'templeBorder', seal: 'kolam', skyline: 'lamps' },
    countdown: 'default', story: 'letter', timeline: 'diya', venue: 'illustrated', gallery: 'frames', rsvp: 'card', footer: 'blessing',
  },
  film: {
    description: "A stone torana's jasmine strands part on a Kerala courtyard at dawn: the camera circles slowly past garlanded teak pillars as your little one's name appears, glides past the brass lamps for each part of the ceremony and draws back from the swinging cradle under its mango-leaf toran.",
    people: 'one', nameStyle: 'script', motif: 'temple',
    // orbitRight, not craneDown: a crane starts high, and the near eaves and jasmine festoon would hang over the words.
    shots: { names: 'orbitRight', functions: 'truckLeft', closing: 'dollyOut' },
    intensity: { names: 0.6, functions: 0.5, closing: 0.8 },
    particles: { opening: 'petals', names: 'goldDust', closing: 'petals' },
  },
};
