import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T09 · Cloud Nine (final.md §5.2, §5.3 T09): a nursery above the clouds at a pastel dawn; a muslin curtain rises.
 * Stage `cloudNine` (packages/template-engine/src/stage/sets/), opening `silk`, track `original-lori-music-box`.
 */
export const cloudNine: StageTemplateSpec = {
  website: {
    key: 'cloud-nine', name: 'Cloud Nine', category: 'Baby Shower', style: 'Dreamy', tier: 'SIGNATURE', badge: 'NEW',
    description: "A nursery above the clouds at a pastel dawn: a muslin curtain rises on banks of cloud, a crescent-moon swing cradling a sleeping baby under a quilt, hot-air balloons and a stork far away, paper stars on threads. For every family's baby shower.",
    tags: ['signature', 'stage', 'baby-shower', 'pastel', 'dreamy'], eventTypes: ['BABY_SHOWER'], layout: 'signature-celebration',
    stage: 'cloudNine', intro: 'silk', defaultTrack: 'original-lori-music-box', eyebrow: 'template.babyShower',
    colors: palette('#5b84c4', '#e7a4b4', '#fde9b1', '#fbfaff', '#f1f3fc', '#2c3350', '#7a8199'),
    presets: [
      { name: 'Powder & Blush', colors: palette('#5b84c4', '#e7a4b4', '#fde9b1', '#fbfaff', '#f1f3fc', '#2c3350', '#7a8199') },
      { name: 'Mint Dream', colors: palette('#3f8f7a', '#f0b9a6', '#fff0c2', '#fafdfc', '#eef6f3', '#1f3a34', '#5f7a73') },
      { name: 'Lavender Lullaby', colors: palette('#7b5fb8', '#f0a8c8', '#ffe6b8', '#fcfaff', '#f3eefb', '#2e2446', '#76698e') },
    ],
    look: 'garden', effect: 'goldDust', heroTone: 'light', fonts: 'romantic', ornament: 'clouds', dress: { frame: 'cloud', edge: 'scallop', seal: 'moon', skyline: 'clouds' },
    countdown: 'calendar', story: 'polaroid', timeline: 'tiles', venue: 'postcard', gallery: 'polaroid', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'A muslin curtain rises on a nursery above the clouds: the camera floats in under the paper stars as the names appear, drifts round the crescent-moon swing and the hot-air balloons for each part of the day and draws back into a pastel dawn.',
    people: 'one', nameStyle: 'script', motif: 'clouds',
    shots: { names: 'dollyIn', functions: 'orbitRight', closing: 'dollyOut' },
    intensity: { names: 0.6, functions: 0.5, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'snow', closing: 'goldDust' },
  },
};
