import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T17 · Alma Mater (final.md §5.2, §5.3 T17): a campus quadrangle at dusk; a convocation folder unfolds.
 * Stage `quadrangle` (packages/template-engine/src/stage/sets/), opening `unfold`, track `original-alma-anthem`.
 */
export const almaMater: StageTemplateSpec = {
  website: {
    key: 'alma-mater', name: 'Alma Mater', category: 'School & College', style: 'Classic', tier: 'SIGNATURE', badge: 'NEW',
    description: 'A convocation folder unfolds on a campus quadrangle at dusk: colonnades with lit windows, bunting and fairy lights over the lawn, benches and lamp posts, a clock tower glowing at the end. For annual days, farewells and convocations.',
    tags: ['signature', 'stage', 'school', 'college', 'annual-day', 'farewell', 'convocation'], eventTypes: ['SCHOOL_COLLEGE'], layout: 'signature-celebration',
    stage: 'quadrangle', intro: 'unfold', defaultTrack: 'original-alma-anthem', eyebrow: 'invitation.youAreInvited', heroTitle: 'event',
    colors: palette('#1b2a4a', '#b8893a', '#f3e7c9', '#faf8f3', '#efebe2', '#1a2232', '#626a7c'),
    presets: [
      { name: 'Oxford Navy', colors: palette('#1b2a4a', '#b8893a', '#f3e7c9', '#faf8f3', '#efebe2', '#1a2232', '#626a7c') },
      { name: 'Maroon Convocation', colors: palette('#5a1a24', '#b8893a', '#f3dcb8', '#fbf6f4', '#f5ebe8', '#2a1418', '#765a60') },
      { name: 'Forest Green', colors: palette('#1f4a30', '#b8893a', '#ecdfb0', '#f6faf6', '#eaf1ea', '#142a1c', '#5a7060') },
    ],
    look: 'classic', effect: 'confetti', heroTone: 'dark', fonts: 'classic', ornament: 'laurel', dress: { frame: 'double', edge: 'bunting', seal: 'crest', skyline: 'none' },
    countdown: 'calendar', story: 'polaroid', timeline: 'timeline', venue: 'postcard', gallery: 'polaroid', rsvp: 'card', footer: 'seal',
  },
  film: {
    description: 'A convocation folder unfolds on a campus quadrangle at dusk: the camera glides down the lawn under the bunting as your event is announced, walks the colonnades for each part of the programme and draws back from the glowing clock tower as confetti falls.',
    people: 'one', nameStyle: 'caps', motif: 'laurel',
    // §5.3 asked for craneUp and pullAway: both bring the crown's bunting down through the film's words (a rising or
    // retreating eye sees near hanging pieces fall toward the horizon), so the camera glides in and draws back to rest.
    shots: { names: 'dollyIn', functions: 'truckLeft', closing: 'dollyOut' },
    intensity: { names: 0.6, functions: 0.5, closing: 0.8 },
    particles: { opening: 'confetti', names: 'goldDust', closing: 'confetti' },
  },
};
