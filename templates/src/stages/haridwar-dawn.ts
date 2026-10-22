import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T11 · Haridwar Dawn (final.md §5.2, §5.3 T11): a river ghat on the Ganga at sunrise through a stone river-gate.
 * Stage `ghat` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-ganga-bells`.
 */
export const haridwarDawn: StageTemplateSpec = {
  website: {
    key: 'haridwar-dawn', name: 'Haridwar Dawn', category: 'Mundan', style: 'Traditional', tier: 'SIGNATURE', badge: 'NEW',
    description: 'Glide across the Ganga at sunrise through a stone river-gate to a ghat of broad steps: a small shrine with a bell tower, diya boats and mist on the water. For a mundan, with bells and a bansuri.',
    tags: ['signature', 'stage', 'mundan', 'traditional', 'riverside', 'dawn'], eventTypes: ['MUNDAN'], layout: 'signature-celebration',
    stage: 'ghat', intro: 'arrival', defaultTrack: 'original-ganga-bells', eyebrow: 'template.mundan', invocation: INVOCATION.om,
    colors: palette('#c2561a', '#b98a3a', '#fbd6b0', '#fdf8f2', '#f8ecdf', '#2b1a12', '#7d6657'),
    presets: [
      { name: 'Saffron Dawn', colors: palette('#c2561a', '#b98a3a', '#fbd6b0', '#fdf8f2', '#f8ecdf', '#2b1a12', '#7d6657') },
      { name: 'Ganga Blue', colors: palette('#1f4e79', '#b98a3a', '#f3dcb0', '#f6f9fc', '#e9eff5', '#14202c', '#5c6a7a') },
      { name: 'Marigold Mist', colors: palette('#9a3412', '#e39b2b', '#ffe2a8', '#fdf8f1', '#f8eddc', '#2c1a0e', '#7a6650') },
    ],
    look: 'heritage', effect: 'marigold', heroTone: 'light', fonts: 'grand', ornament: 'rangoli', dress: { frame: 'arch', edge: 'none', seal: 'rangoliBloom', skyline: 'kalash' },
    countdown: 'default', story: 'default', timeline: 'cards', venue: 'illustrated', gallery: 'mosaic', rsvp: 'default', footer: 'blessing',
  },
  film: {
    description: 'Through a stone river-gate onto the Ganga at sunrise: the camera glides toward the ghat as the name appears, drifts past the diya boats for each part of the ceremony and rises over the mist as the bells ring.',
    people: 'one', nameStyle: 'caps', motif: 'kalash',
    shots: { names: 'dollyIn', functions: 'truckLeft', closing: 'riseOver' },
    intensity: { names: 0.6, functions: 0.5, closing: 0.6 },
    particles: { opening: 'marigold', names: 'goldDust', closing: 'marigold' },
  },
};
