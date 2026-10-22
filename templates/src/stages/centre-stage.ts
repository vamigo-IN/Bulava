import { palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T16 · Centre Stage (final.md §5.2, §5.3 T16): an auditorium before the keynote; the velvet curtain rises.
 * Stage `auditorium` (packages/template-engine/src/stage/sets/), opening `silk`, track `original-keynote-ambient`.
 */
export const centreStage: StageTemplateSpec = {
  website: {
    key: 'centre-stage', name: 'Centre Stage', category: 'Corporate', style: 'Modern', tier: 'SIGNATURE', badge: 'NEW',
    description: 'The velvet curtain rises on an auditorium before the keynote: rows of seats run to a lit stage, a wide screen carries your monogram, and beams cross through the haze. For launches, conferences and annual meets.',
    tags: ['signature', 'stage', 'corporate', 'modern', 'conference'], eventTypes: ['CORPORATE', 'CUSTOM'], layout: 'signature-celebration',
    stage: 'auditorium', intro: 'silk', defaultTrack: 'original-keynote-ambient', eyebrow: 'invitation.youAreInvited', heroTitle: 'event',
    colors: palette('#1b1f2a', '#2f6df6', '#9ad4ff', '#f6f8fb', '#eceff5', '#121622', '#5c6478'),
    presets: [
      { name: 'Electric Blue', colors: palette('#1b1f2a', '#2f6df6', '#9ad4ff', '#f6f8fb', '#eceff5', '#121622', '#5c6478') },
      { name: 'Gold Gala', colors: palette('#1a1612', '#c9a24a', '#f2e0b4', '#fbf9f5', '#f3efe8', '#1a1612', '#72685c') },
      { name: 'Emerald Tech', colors: palette('#0f2a24', '#22c08a', '#bff2dc', '#f4faf8', '#e8f2ee', '#0f2a24', '#567068') },
    ],
    look: 'modern', effect: 'none', heroTone: 'dark', fonts: 'modern', ornament: 'geometric', dress: { frame: 'rounded', edge: 'none', seal: 'sunburst', skyline: 'none', divider: 'rule' },
    countdown: 'flip', story: 'default', timeline: 'tiles', venue: 'default', gallery: 'stack', rsvp: 'card', footer: 'default',
  },
  film: {
    description: 'The velvet curtain rises on an auditorium before the keynote: the camera moves down the aisle toward the lit stage as your event is announced, passes the rows for each session on the agenda and draws back as the beams cross through the haze.',
    people: 'one', nameStyle: 'caps', motif: 'geometric',
    shots: { names: 'dollyIn', functions: 'truckRight', closing: 'pullAway' },
    intensity: { names: 0.6, functions: 0.5 },
    particles: { opening: 'none', names: 'none', closing: 'none' },
  },
};
