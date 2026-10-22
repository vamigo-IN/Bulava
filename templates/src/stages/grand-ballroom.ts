import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T08 · Grand Ballroom (final.md §5.2, §5.3 T08): a ballroom at night behind gilt doors; a waltz for the years shared.
 * Stage `ballroom` (packages/template-engine/src/stage/sets/), opening `doorway`, track `original-ballroom-waltz`.
 */
export const grandBallroom: StageTemplateSpec = {
  website: {
    key: 'grand-ballroom', name: 'Grand Ballroom', category: 'Anniversary', style: 'Glamour', tier: 'SIGNATURE', badge: 'NEW',
    description: 'Gilt doors open on a ballroom at night: a crystal chandelier blazes, the parquet gleams, columns and tall draped windows lead to a sweeping staircase. A waltz for the years you have shared.',
    tags: ['signature', 'stage', 'anniversary', 'elegant', 'night'], eventTypes: ['ANNIVERSARY'], layout: 'signature-celebration',
    stage: 'ballroom', intro: 'doorway', defaultTrack: 'original-ballroom-waltz', eyebrow: 'template.anniversary',
    colors: palette('#3a1a3f', '#bfa15a', '#efe3d1', '#faf7f3', '#f1ebe4', '#241a28', '#6e6273'),
    presets: [
      { name: 'Plum & Pearl', colors: palette('#3a1a3f', '#bfa15a', '#efe3d1', '#faf7f3', '#f1ebe4', '#241a28', '#6e6273') },
      { name: 'Silver Jubilee Night', colors: palette('#1d2a3a', '#b9c2cf', '#e8edf4', '#f6f8fb', '#eceff5', '#141c28', '#5c6478') },
      { name: 'Golden Fifty', colors: palette('#3a2a10', '#d4af37', '#f4e4b0', '#fcf9f1', '#f5efe0', '#261c0c', '#766a52') },
    ],
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'elegant', ornament: 'deco', dress: { frame: 'oval', edge: 'deco', seal: 'crest', skyline: 'none', corner: 'decoCorner' },
    countdown: 'rings', story: 'letter', timeline: 'timeline', venue: 'illustrated', gallery: 'stack', rsvp: 'card', footer: 'seal',
  },
  film: {
    description: 'Gilt doors open on a ballroom at night: the camera moves in under the blazing chandelier as your names turn up in gold, circles the parquet for your photo, passes the columns and draped windows for each part of the evening and draws back from the sweeping staircase.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'arch', motif: 'deco',
    shots: { names: 'dollyIn', couple: 'orbitLeft', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.6, couple: 0.5, functions: 0.6, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'petals' },
  },
};
