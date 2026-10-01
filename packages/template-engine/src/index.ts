export { TemplateRenderer, TemplateStyles, TemplateThumbnail, type TemplateRendererProps } from './renderer';
export { FONT_CSS_VARS, fontStack, themeStyle, isDark, mix } from './theme';
export {
  SCENES,
  DARK_SCENES,
  sceneArt,
  artworkArt,
  artworkAssetUrl,
  backdropArt,
  backdropImageUrls,
  backdropTitleTop,
  SceneHero,
  SceneStill,
  sceneTitleTop,
  type SceneArt,
  type SceneLayer,
  type SceneName,
} from './art/scenes';
export { Toran, MarigoldStrand, Marigold, Diya, Kalash, Bell, LotusBloom, Balloon, Gopuram, Dome, Chhatri, PeacockPlume, Bansuri, KadambaTree, Moon, rand, r2 } from './art/motifs';
export { FunctionMotif, motifFor } from './art/function-icons';
export { initials } from './sections/shared';
export { Effects } from './effects';
export { Mandala, Paisley, FloralCorner, GeometricStar, Confetti, ArchFrame, TempleBorder, Ornament, Divider, PeacockPair } from './ornaments';
export { Lotus, PeacockFeather, StarField, Laurel, Lantern, RoseWindow, GothicArch, SeaWaves, Crescent, CrestFrame, GateLeaf } from './ornaments-signature';
export { INTRO_OPEN_EVENT, IntroOverlay, type IntroLabels, type IntroVariant } from './intro';
export type { RenderSlots, RenderMode, SectionProps } from './types';

/**
 * Layout variants each section understands (Template Studio offers these).
 * Sections not listed render a single 'default' layout.
 */
export const SECTION_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  hero: [
    'classic',
    'arch',
    'split',
    'photo',
    'minimal',
    'festive',
    'temple',
    'monogram',
    'cathedral',
    'seaside',
    'celestial',
    'lantern',
    'peacock',
    'gopuram',
    'palace',
    'toran',
    'arches',
    'lotus',
    'mandap',
    'noir',
    'floral',
    'balloons',
    'backwaters',
    'sarovar',
    'vrindavan',
    'artwork',
  ],
  couple: ['default', 'stacked', 'arch', 'flip', 'profile'],
  story: ['default', 'curtain', 'polaroid'],
  eventTimeline: ['cards', 'timeline', 'tiles', 'tickets', 'diya'],
  gallery: ['default', 'stack', 'mosaic', 'polaroid'],
  countdown: ['default', 'flip'],
};
