import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T06 · Rooftop Ring (final.md §5.2, §5.3 T06): a city rooftop at blue hour under fairy lights; a card unfolds.
 * Stage `rooftop` (packages/template-engine/src/stage/sets/), opening `unfold`, track `original-promise-strings`.
 */
export const rooftopRing: StageTemplateSpec = {
  website: {
    key: 'rooftop-ring', name: 'Rooftop Ring', category: 'Engagement', style: 'Modern', tier: 'SIGNATURE', badge: 'NEW',
    description: 'A city rooftop at blue hour: a card unfolds under strings of fairy lights, then the terrace opens to a skyline of lit windows and a ring box glowing under a ring of roses. For engagements and roka, with strings.',
    tags: ['signature', 'stage', 'engagement', 'ring-ceremony', 'modern', 'night'], eventTypes: ['ENGAGEMENT'], layout: 'signature-wedding',
    stage: 'rooftop', intro: 'unfold', defaultTrack: 'original-promise-strings', eyebrow: 'template.engagementOf',
    colors: palette('#101a3a', '#c98a6a', '#f3d2c6', '#faf6f4', '#f2e8e4', '#161a2c', '#6a6d80'),
    presets: [
      { name: 'Blue Hour', colors: palette('#101a3a', '#c98a6a', '#f3d2c6', '#faf6f4', '#f2e8e4', '#161a2c', '#6a6d80') },
      { name: 'Champagne Dusk', colors: palette('#3a2a2a', '#c9a24a', '#f2e0b4', '#fbf8f3', '#f3ede4', '#241a18', '#76685e') },
      { name: 'Emerald Terrace', colors: palette('#0f3a34', '#c98a6a', '#f1d7c8', '#f5faf8', '#e9f1ee', '#112420', '#5a7068') },
    ],
    look: 'modern', effect: 'goldDust', heroTone: 'dark', fonts: 'romantic', ornament: 'stars', dress: { frame: 'circle', edge: 'fairyLights', seal: 'moon', skyline: 'lanterns' },
    countdown: 'flip', couple: 'flip', story: 'polaroid', timeline: 'tickets', venue: 'postcard', gallery: 'stack', rsvp: 'card', footer: 'seal',
  },
  film: {
    description: 'A card unfolds on a city rooftop at blue hour: the camera circles under the fairy lights as your names turn up, moves in on the ring box under the arch of roses for your photo, passes the lanterns for each function and draws back from the lit skyline.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'circle', motif: 'stars',
    shots: { names: 'orbitRight', couple: 'dollyIn', functions: 'truckLeft', closing: 'dollyOut' },
    intensity: { names: 0.7, couple: 0.6, functions: 0.5, closing: 0.8 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'confetti' },
  },
};
