import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T19 · Golden Veranda (final.md §5.2, §5.3 T19): a hill-station veranda at golden hour; an old album opens.
 * Stage `veranda` (packages/template-engine/src/stage/sets/), opening `unfold`, track `original-golden-veranda`.
 */
export const goldenVeranda: StageTemplateSpec = {
  website: {
    key: 'golden-veranda', name: 'Golden Veranda', category: 'Retirement', style: 'Vintage', tier: 'SIGNATURE', badge: 'NEW',
    description: "An old album opens on a hill-station veranda at golden hour: white posts and a turned-wood railing, a planter's chair and a tea table, a garden path to a gate and tea gardens receding in haze. For retirements and farewells.",
    tags: ['signature', 'stage', 'retirement', 'farewell', 'golden-hour'], eventTypes: ['RETIREMENT'], layout: 'signature-celebration',
    stage: 'veranda', intro: 'unfold', defaultTrack: 'original-golden-veranda', eyebrow: 'template.celebrateWith',
    colors: palette('#4b5a2a', '#c7a04a', '#f6d6a8', '#fbf8f1', '#f2efe3', '#22291a', '#6b7260'),
    presets: [
      { name: 'Olive Gold', colors: palette('#4b5a2a', '#c7a04a', '#f6d6a8', '#fbf8f1', '#f2efe3', '#22291a', '#6b7260') },
      { name: 'Tea Garden Dusk', colors: palette('#2f4a3e', '#c7a04a', '#f0dcb0', '#f7faf8', '#ebf1ee', '#1f2a25', '#6b776f') },
      { name: 'Sepia Afternoon', colors: palette('#5b3a29', '#a67c52', '#e8d5b5', '#f6efe3', '#ede2cf', '#2e2219', '#7a6553') },
    ],
    look: 'classic', effect: 'fireflies', heroTone: 'light', fonts: 'editorial', ornament: 'laurel', dress: { frame: 'oval', edge: 'none', seal: 'botanicalWreath', skyline: 'none', divider: 'laurel' },
    countdown: 'default', story: 'polaroid', timeline: 'timeline', venue: 'postcard', gallery: 'polaroid', rsvp: 'card', footer: 'default',
  },
  film: {
    description: "An old album opens on a hill-station veranda at golden hour: the camera rises over the railing as the name appears, moves past the planter's chair and the tea table for each part of the day and draws back down the garden path as fireflies come out.",
    people: 'one', nameStyle: 'script', motif: 'laurel',
    shots: { names: 'riseOver', functions: 'truckRight', closing: 'pullAway' },
    intensity: { names: 0.5, functions: 0.5 },
    particles: { opening: 'fireflies', names: 'goldDust', closing: 'petals' },
  },
};
