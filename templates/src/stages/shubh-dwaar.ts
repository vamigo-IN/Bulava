import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T13 · Shubh Dwaar (final.md §5.2, §5.3 T13): a new home before dawn: the gate opens on a rangoli path lit with diyas.
 * Stage `dwaar` (packages/template-engine/src/stage/sets/), opening `doorway`, track `original-shubh-dhol`.
 */
export const shubhDwaar: StageTemplateSpec = {
  website: {
    key: 'shubh-dwaar', name: 'Shubh Dwaar', category: 'Housewarming', style: 'Traditional', tier: 'SIGNATURE', badge: 'NEW',
    description: 'Before dawn, the gate of your new home opens: a rangoli path lit with diyas leads to an open front door under a mango-leaf toran, kalash on the step and a warm lamp-lit room within. For griha pravesh, with a festive dhol.',
    tags: ['signature', 'stage', 'griha-pravesh', 'housewarming', 'traditional'], eventTypes: ['HOUSEWARMING'], layout: 'signature-celebration',
    stage: 'dwaar', intro: 'doorway', defaultTrack: 'original-shubh-dhol', eyebrow: 'template.joinUs', heroTitle: 'event', invocation: INVOCATION.hindu,
    colors: palette('#9a3c1e', '#c0903a', '#f8e7c8', '#fdf9f3', '#f7eee1', '#2d1b12', '#7c6a5c'),
    presets: [
      { name: 'Terracotta Dawn', colors: palette('#9a3c1e', '#c0903a', '#f8e7c8', '#fdf9f3', '#f7eee1', '#2d1b12', '#7c6a5c') },
      { name: 'Teal Door', colors: palette('#135e63', '#c0903a', '#f6e2b8', '#f5fafa', '#e9f2f2', '#10282a', '#567072') },
      { name: 'Indigo Evening', colors: palette('#1f2a5a', '#d19a3a', '#f8e1a8', '#f7f8fc', '#ecedf6', '#171c36', '#5e6480') },
    ],
    look: 'heritage', effect: 'marigold', heroTone: 'dark', fonts: 'heritage', ornament: 'rangoli', dress: { frame: 'arch', edge: 'toran', seal: 'rangoliBloom', skyline: 'diyaRow' },
    countdown: 'flip', story: 'default', timeline: 'cards', venue: 'illustrated', gallery: 'mosaic', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'The gate of your new home opens before dawn: the camera walks up the rangoli path lit with diyas as your invitation appears, moves past the kalash and the lit windows for each part of the puja and circles slowly before the open front door under its toran.',
    people: 'one', nameStyle: 'caps', motif: 'kalash',
    // Closing orbits rather than cranes up (§5.3 says craneUp): a rising eye brings the gate's toran (hung near, d 520)
    // down over the closing words, while an orbit keeps it in the crown band and swings it across the house in parallax.
    shots: { names: 'dollyIn', functions: 'truckLeft', closing: 'orbitRight' },
    intensity: { names: 0.6, functions: 0.4, closing: 0.5 },
    particles: { opening: 'marigold', names: 'goldDust', closing: 'marigold' },
  },
};
