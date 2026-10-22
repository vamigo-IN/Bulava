import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T18 · Mela Chowk (final.md §5.2, §5.3 T18): a town square at night with a pandal stage and a Ferris wheel; a fair poster opens.
 * Stage `mela` (packages/template-engine/src/stage/sets/), opening `unfold`, track `original-mela-chowk`.
 */
export const melaChowk: StageTemplateSpec = {
  website: {
    key: 'mela-chowk', name: 'Mela Chowk', category: 'Community', style: 'Festive', tier: 'SIGNATURE', badge: 'NEW',
    description: 'A folded fair poster opens on a town square at night: a pandal stage under a striped shamiana, marigold swags between bamboo poles, food stalls, string lights and a Ferris wheel turning over the rooftops. For community gatherings and every celebration.',
    tags: ['signature', 'stage', 'community', 'utsav', 'festive', 'night'], eventTypes: ['COMMUNITY', 'CUSTOM'], layout: 'signature-celebration',
    stage: 'mela', intro: 'unfold', defaultTrack: 'original-mela-chowk', eyebrow: 'template.celebrateWith', heroTitle: 'event',
    colors: palette('#1f5a3a', '#f0a020', '#fff0cf', '#fdfaf3', '#f6efdf', '#1c2a20', '#5f6e63'),
    presets: [
      { name: 'Mela Green', colors: palette('#1f5a3a', '#f0a020', '#fff0cf', '#fdfaf3', '#f6efdf', '#1c2a20', '#5f6e63') },
      { name: 'Chowk Red', colors: palette('#9a1e2a', '#f0a020', '#ffe6b8', '#fdf7f3', '#f8ebe6', '#2c1416', '#7a5a5e') },
      { name: 'Night Blue', colors: palette('#17244f', '#f0a020', '#ffe0a0', '#f7f8fc', '#ecedf6', '#141a36', '#5c6480') },
    ],
    look: 'celebration', effect: 'marigold', heroTone: 'dark', fonts: 'desi', ornament: 'marigold', dress: { frame: 'scallop', edge: 'marigoldSwag', seal: 'marigoldWreath', skyline: 'lanterns' },
    countdown: 'default', story: 'default', timeline: 'cards', venue: 'default', gallery: 'mosaic', rsvp: 'default', footer: 'skyline',
  },
  film: {
    description: 'A fair poster opens on a town square at night: the camera circles the pandal stage under its striped shamiana as your gathering is announced, moves past the food stalls for each part of the programme and draws back as the Ferris wheel turns.',
    people: 'one', nameStyle: 'caps', motif: 'marigold',
    shots: { names: 'orbitRight', functions: 'truckLeft', closing: 'dollyOut' },
    intensity: { names: 0.7, functions: 0.5, closing: 0.8 },
    particles: { opening: 'marigold', names: 'goldDust', closing: 'confetti' },
  },
};
