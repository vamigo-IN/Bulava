import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T12 · Thousand Pillars (final.md §5.2, §5.3 T12): a granite mandapam at morning behind temple doors of teak and brass.
 * Stage `mandapam` (packages/template-engine/src/stage/sets/), opening `doorway`, track `original-gayatri-drone`.
 */
export const thousandPillars: StageTemplateSpec = {
  website: {
    key: 'thousand-pillars', name: 'Thousand Pillars', category: 'Thread Ceremony', style: 'Temple', tier: 'SIGNATURE', badge: 'NEW',
    description: 'Temple doors of teak and brass open on a granite mandapam at morning: carved pillars recede, bells hang high, lamps line the aisle to the homam fire under a prabhavali arch. For an upanayanam, with a Vedic drone.',
    tags: ['signature', 'stage', 'upanayanam', 'thread-ceremony', 'south-indian', 'traditional'], eventTypes: ['THREAD_CEREMONY'], layout: 'signature-celebration',
    stage: 'mandapam', intro: 'doorway', defaultTrack: 'original-gayatri-drone', eyebrow: 'template.blessings', invocation: INVOCATION.om,
    colors: palette('#4a3b32', '#c48a2b', '#f1c866', '#fbf6ec', '#f4ecdc', '#2a1f18', '#73665a'),
    presets: [
      { name: 'Granite & Gold', colors: palette('#4a3b32', '#c48a2b', '#f1c866', '#fbf6ec', '#f4ecdc', '#2a1f18', '#73665a') },
      { name: 'Vermilion', colors: palette('#8a1c1c', '#c48a2b', '#f4d27a', '#fdf6f1', '#f8ebe3', '#2c1414', '#7a5a58') },
      { name: 'Peacock Temple', colors: palette('#0b4f6c', '#b8862c', '#f0c75e', '#f4f9f8', '#e6f0ee', '#10262f', '#557079') },
    ],
    look: 'heritage', effect: 'goldDust', heroTone: 'light', fonts: 'grand', ornament: 'temple', dress: { frame: 'niche', edge: 'templeBorder', seal: 'mandala', skyline: 'kalash', divider: 'lotus' },
    countdown: 'default', story: 'letter', timeline: 'timeline', venue: 'illustrated', gallery: 'frames', rsvp: 'card', footer: 'blessing',
  },
  film: {
    description: 'Temple doors of teak and brass open on a granite mandapam: the camera walks between the carved pillars as the name appears, moves along the lamp-lit aisle for each part of the ceremony and draws back from the homam fire under its prabhavali arch.',
    people: 'one', nameStyle: 'caps', motif: 'temple',
    shots: { names: 'dollyIn', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.7, functions: 0.5, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'marigold' },
  },
};
