import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T07 · Big Top (final.md §5.2, §5.3 T07): a circus big top through the tent flap; for birthdays of every age.
 * Stage `bigTop` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-carnival-tumble`.
 */
export const bigTop: StageTemplateSpec = {
  website: {
    key: 'big-top', name: 'Big Top', category: 'Birthday', style: 'Circus', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'Step through the tent flap into a circus big top: striped canopy, bunting overhead, spotlights crossing on a cake standing on a circus drum, balloon arches and presents around the ring. For birthdays of every age.',
    tags: ['signature', 'stage', 'birthday', 'kids', 'party', 'circus'], eventTypes: ['BIRTHDAY'], layout: 'signature-celebration',
    stage: 'bigTop', intro: 'arrival', defaultTrack: 'original-carnival-tumble', eyebrow: 'template.birthdayOf',
    colors: palette('#b3202a', '#e4b23a', '#fff1cc', '#fffaf2', '#fdf0dc', '#2a1a14', '#7a6657'),
    presets: [
      { name: 'Carnival Red', colors: palette('#b3202a', '#e4b23a', '#fff1cc', '#fffaf2', '#fdf0dc', '#2a1a14', '#7a6657') },
      { name: 'Candy Pastel', colors: palette('#7a4aa8', '#f29ad6', '#ffe9f5', '#fdfaff', '#f6f0fb', '#2c1f3a', '#7a6f8a') },
      { name: 'Midnight Circus', colors: palette('#1e1b4b', '#f0abfc', '#fde68a', '#f8f7ff', '#efedff', '#1c1a3a', '#625f86') },
    ],
    look: 'celebration', effect: 'confetti', heroTone: 'dark', fonts: 'playful', ornament: 'confetti', dress: { frame: 'ticket', edge: 'bunting', seal: 'sticker', skyline: 'balloons' },
    countdown: 'flip', story: 'polaroid', timeline: 'tiles', venue: 'default', gallery: 'depth', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'Through the tent flap into a circus big top: the camera circles the ring as the name lands in big bright capitals under crossing spotlights, moves past the balloon arches and presents for each part of the party and draws back as confetti falls.',
    people: 'one', nameStyle: 'caps', motif: 'confetti',
    shots: { names: 'orbitLeft', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.8, functions: 0.6, closing: 0.8 },
    particles: { opening: 'confetti', names: 'goldDust', closing: 'confetti' },
  },
};
