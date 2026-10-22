import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T05 · Bougainvillea Court (final.md §5.2, §5.3 T05): a heritage-hotel courtyard at golden hour through a carved haveli gate; for every family.
 * Stage `courtyard` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-promise-strings`.
 */
export const bougainvilleaCourt: StageTemplateSpec = {
  website: {
    key: 'bougainvillea-court', name: 'Bougainvillea Court', category: 'Wedding', style: 'Destination', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'A whitewashed heritage-hotel courtyard at golden hour: through a carved haveli gate, bougainvillea spills over the arches, brass lanterns sway and marigolds float on a long pool to a tiered fountain. A destination wedding for every family.',
    tags: ['signature', 'stage', 'destination', 'courtyard', 'golden-hour'], eventTypes: ['WEDDING'], layout: 'signature-wedding',
    stage: 'courtyard', intro: 'arrival', defaultTrack: 'original-promise-strings',
    colors: palette('#9a4a2e', '#b98a3c', '#f1d8a8', '#fcf7ef', '#f6ead9', '#2e1d16', '#7d665a'),
    presets: [
      { name: 'Terracotta & Brass', colors: palette('#9a4a2e', '#b98a3c', '#f1d8a8', '#fcf7ef', '#f6ead9', '#2e1d16', '#7d665a') },
      { name: 'Bougainvillea', colors: palette('#a3245e', '#b98a3c', '#f6c9d6', '#fdf6f8', '#f8e7ee', '#321523', '#7c5a68') },
      { name: 'Sea Blue', colors: palette('#17506b', '#b98a3c', '#dbeaf0', '#f5fafc', '#e7f1f5', '#10262f', '#5c7380') },
    ],
    look: 'garden', effect: 'petals', heroTone: 'light', fonts: 'romantic', ornament: 'floral', dress: { frame: 'arch', edge: 'floralGarland', seal: 'botanicalWreath', skyline: 'roses' },
    countdown: 'calendar', couple: 'stacked', story: 'polaroid', timeline: 'tickets', venue: 'postcard', gallery: 'depth', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'Through a carved haveli gate into a courtyard at golden hour: the camera circles the bougainvillea arches as your names appear, moves in along the pool of floating marigolds for your photo, passes the swaying brass lanterns for each function and draws back as petals fall.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'circle', motif: 'floral',
    shots: { names: 'orbitRight', couple: 'dollyIn', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.6, couple: 0.6, functions: 0.6, closing: 0.8 },
    particles: { opening: 'petals', names: 'goldDust', closing: 'petals' },
  },
};
