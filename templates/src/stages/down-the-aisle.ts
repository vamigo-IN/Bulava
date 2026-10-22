import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T04 · Down the Aisle (final.md §5.2, §5.3 T04): a chapel nave at golden hour behind oak doors.
 * Stage `nave` (packages/template-engine/src/stage/sets/), opening `doorway`, track `original-processional`.
 */
export const downTheAisle: StageTemplateSpec = {
  website: {
    key: 'down-the-aisle', name: 'Down the Aisle', category: 'Wedding', style: 'Heritage', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'Oak doors swing open on a chapel at golden hour: pews with lilies along a petal-strewn aisle, stained glass pouring colour, candles at the altar under a rose window. For church weddings, with organ and bells.',
    tags: ['signature', 'stage', 'christian', 'church', 'heritage', 'golden-hour'], eventTypes: ['WEDDING'], layout: 'signature-wedding',
    stage: 'nave', intro: 'doorway', defaultTrack: 'original-processional', invocation: INVOCATION.christian,
    colors: palette('#2f4a3e', '#b98a5a', '#e9d3b3', '#faf7f2', '#f1ebe1', '#1f2a25', '#6b776f'),
    presets: [
      { name: 'Sage & Rose Gold', colors: palette('#2f4a3e', '#b98a5a', '#e9d3b3', '#faf7f2', '#f1ebe1', '#1f2a25', '#6b776f') },
      { name: 'Navy Candlelight', colors: palette('#1f2a44', '#b8955a', '#e7d3a8', '#f8f6f1', '#eeeae0', '#1a2030', '#606879') },
      { name: 'Burgundy Chapel', colors: palette('#5a1b2a', '#c09a5a', '#efdcb8', '#fbf6f3', '#f4ebe6', '#2a1418', '#76585e') },
    ],
    look: 'classic', effect: 'petals', heroTone: 'light', fonts: 'editorial', ornament: 'chapel', dress: { frame: 'lancet', edge: 'lancets', seal: 'roseWindow', skyline: 'doves', divider: 'laurel' },
    countdown: 'rings', couple: 'profile', story: 'polaroid', timeline: 'frames', venue: 'postcard', gallery: 'depth', rsvp: 'card', footer: 'blessing',
  },
  film: {
    description: 'Oak doors swing open on a chapel at golden hour: the camera walks down the petal-strewn aisle as your names turn up in gold, circles the altar candles for your photo, passes the stained glass for each part of the day and draws back under the rose window.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'arch', motif: 'chapel',
    shots: { names: 'dollyIn', couple: 'orbitRight', functions: 'truckLeft', closing: 'dollyOut' },
    intensity: { names: 0.6, couple: 0.5, functions: 0.5, closing: 0.8 },
    particles: { opening: 'petals', names: 'goldDust', closing: 'petals' },
  },
};
