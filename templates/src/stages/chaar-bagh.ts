import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T02 · Chaar Bagh (final.md §5.2, §5.3 T02): a Mughal garden at blue hour behind carved cedar doors.
 * Stage `chaarBagh` (packages/template-engine/src/stage/sets/), opening `doorway`, track `original-mehfil-santoor`.
 */
export const chaarBagh: StageTemplateSpec = {
  website: {
    key: 'chaar-bagh', name: 'Chaar Bagh', category: 'Wedding', style: 'Mughal', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'A Mughal garden at blue hour: carved cedar doors open onto a marble water channel, fountains and cypress rows leading to a white baradari whose mihrab glows, under a crescent moon. For a Nikah, with santoor and soft claps.',
    tags: ['signature', 'stage', 'muslim', 'nikah', 'royal', 'night'], eventTypes: ['WEDDING'], layout: 'signature-wedding',
    stage: 'chaarBagh', intro: 'doorway', defaultTrack: 'original-mehfil-santoor', invocation: INVOCATION.muslim,
    colors: palette('#0f2e3f', '#b9933f', '#efe6c8', '#f6f8f7', '#e9efee', '#0f2027', '#587078'),
    presets: [
      { name: 'Moonlit Teal', colors: palette('#0f2e3f', '#b9933f', '#efe6c8', '#f6f8f7', '#e9efee', '#0f2027', '#587078') },
      { name: 'Emerald Night', colors: palette('#0e3b2e', '#b9933f', '#eadfb8', '#f5f8f6', '#e7efeb', '#0f2420', '#55706a') },
      { name: 'Royal Plum', colors: palette('#3a1b4a', '#c3a05a', '#f0e2c4', '#f9f6fb', '#eee8f3', '#26172c', '#6e617a') },
    ],
    look: 'royal', effect: 'fireflies', heroTone: 'dark', fonts: 'elegant', ornament: 'jaali', dress: { frame: 'mihrab', edge: 'arches', seal: 'arabesque', skyline: 'domes' },
    countdown: 'calendar', couple: 'duet', story: 'letter', timeline: 'cards', venue: 'postcard', gallery: 'depth', rsvp: 'card', footer: 'seal',
  },
  film: {
    description: 'Carved cedar doors open on a Mughal garden at blue hour: the camera rises over the water channel and fountains as your names turn up in gold, moves in toward the glowing mihrab for your photo, walks the cypress rows for each function and draws back under the crescent moon.',
    people: 'couple', nameStyle: 'script', joiner: 'and', portrait: 'arch', motif: 'jaali',
    shots: { names: 'riseOver', couple: 'dollyIn', functions: 'truckLeft', closing: 'pullAway' },
    intensity: { names: 0.6, couple: 0.7, functions: 0.6 },
    particles: { opening: 'fireflies', names: 'goldDust', closing: 'fireflies' },
  },
};
