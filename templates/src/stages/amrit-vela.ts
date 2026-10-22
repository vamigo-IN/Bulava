import { INVOCATION, palette } from '../builder';
import type { StageTemplateSpec } from './types';

/**
 * T03 · Amrit Vela (final.md §5.2, §5.3 T03): a marble causeway across the sarovar at the hour before dawn; a silk mist lifts.
 * Stage `causeway` (packages/template-engine/src/stage/sets/), opening `silk`, track `original-anand-dawn`.
 */
export const amritVela: StageTemplateSpec = {
  website: {
    key: 'amrit-vela', name: 'Amrit Vela', category: 'Wedding', style: 'Divine', tier: 'SIGNATURE', badge: 'NEW', featured: true,
    description: 'The hour before dawn on the sarovar: a silk mist lifts from a marble causeway lined with lamps, leading across still water to a golden shrine catching the first light. For an Anand Karaj, with harmonium and tabla.',
    tags: ['signature', 'stage', 'sikh', 'anand-karaj', 'punjabi', 'dawn'], eventTypes: ['WEDDING'], layout: 'signature-wedding',
    stage: 'causeway', intro: 'silk', defaultTrack: 'original-anand-dawn', eyebrow: 'template.anandKaraj', invocation: INVOCATION.sikh,
    colors: palette('#0f2a6b', '#d98f1b', '#f6cf6b', '#fffaf1', '#fbefd8', '#16203a', '#5f6a86'),
    presets: [
      { name: 'Sarovar Dawn', colors: palette('#0f2a6b', '#d98f1b', '#f6cf6b', '#fffaf1', '#fbefd8', '#16203a', '#5f6a86') },
      { name: 'Kesari Dawn', colors: palette('#8a3b0c', '#d98f1b', '#f8d98a', '#fffaf2', '#fcefd9', '#3a1f10', '#7a6048') },
      { name: 'Ivory & Blue', colors: palette('#1e3a8a', '#b8862c', '#f1d9a0', '#ffffff', '#f4f1ea', '#172033', '#5b6478') },
    ],
    look: 'heritage', effect: 'goldDust', heroTone: 'light', fonts: 'grand', ornament: 'bagh', dress: { frame: 'arch', edge: 'phulkari', seal: 'phulkari', skyline: 'sunburst' },
    countdown: 'flip', couple: 'portraits', story: 'polaroid', timeline: 'timeline', venue: 'illustrated', gallery: 'mosaic', rsvp: 'card', footer: 'blessing',
  },
  film: {
    description: 'A silk mist lifts from the sarovar before dawn: the camera glides along the lamp-lined causeway as your names appear, comes down toward the golden shrine for your photo, moves past the lamps for each function and rises over the still water as the first light comes.',
    people: 'couple', nameStyle: 'caps', joiner: 'and', portrait: 'arch', motif: 'bagh',
    shots: { names: 'dollyIn', couple: 'craneDown', functions: 'truckLeft', closing: 'riseOver' },
    intensity: { names: 0.7, couple: 0.6, functions: 0.5, closing: 0.6 },
    particles: { opening: 'goldDust', names: 'goldDust', closing: 'marigold' },
  },
};
