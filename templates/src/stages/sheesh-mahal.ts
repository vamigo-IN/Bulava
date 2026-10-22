import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T01 · Sheesh Mahal (final.md §5.2, §5.3 T01): a mirror-work durbar hall by candlelight; guests arrive through the palace gate.
 * Stage `sheeshMahal` (packages/template-engine/src/stage/sets/), opening `arrival`, track `original-shehnai-darbar`.
 */
export const sheeshMahal: StageTemplateSpec = {
  website: {
    key: 'sheesh-mahal', name: 'Sheesh Mahal', category: 'Wedding', style: 'Royal', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'A mirror-work durbar hall by candlelight: you walk in through the palace gate, past chandeliers and arches of mirror mosaic, to a mandap where the sacred fire burns. Ruby, antique gold and a thousand glints, with your own shehnai.',
    tags: ['signature', 'stage', 'hindu', 'royal', 'rajasthani', 'night'], eventTypes: ['WEDDING'], layout: 'signature-wedding',
    stage: 'sheeshMahal', intro: 'arrival', defaultTrack: 'original-shehnai-darbar', invocation: INVOCATION.hindu,
    colors: palette('#4a0c1e', '#c8982f', '#f3dca0', '#fbf5ea', '#f5ead6', '#2a1419', '#7a5f63'),
    presets: [
      { name: 'Ruby Durbar', colors: palette('#4a0c1e', '#c8982f', '#f3dca0', '#fbf5ea', '#f5ead6', '#2a1419', '#7a5f63') },
      { name: 'Emerald Durbar', colors: palette('#0f3d2e', '#c8982f', '#e9d8a6', '#f7f4ea', '#eef0e4', '#1c2420', '#5f6f66') },
      { name: 'Royal Indigo', colors: palette('#1b2559', '#c29b3c', '#efd9a0', '#f8f6f0', '#eef0f8', '#1a1d2e', '#5d6380') },
    ],
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'regal', ornament: 'mandala', dress: { frame: 'jharokha', edge: 'toran', seal: 'medallion', skyline: 'lamps' },
    countdown: 'flip', couple: 'portraits', story: 'curtain', timeline: 'frames', venue: 'illustrated', gallery: 'depth', rsvp: 'card', footer: 'skyline',
  },
  film: {
    description: 'Through the palace gate into a mirror-work durbar hall: the camera circles under the crystal chandelier as your names turn up in gold, moves in on the mandap and its sacred fire for your photo, walks past the mirror arches for each function and draws back as petals fall.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'arch', motif: 'mandala',
    shots: { names: 'orbitLeft', couple: 'dollyIn', functions: 'truckRight', closing: 'dollyOut' },
    intensity: { names: 0.8, couple: 0.7, functions: 0.6, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'petals' },
  },
};
