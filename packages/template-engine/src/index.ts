export { sectionDrawer, TemplateRenderer, TemplateThumbnail, type TemplateRendererProps } from './renderer';
export { TemplateStyles } from './styles';
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
export { INTRO_DONE_EVENT, INTRO_OPEN_EVENT, IntroOverlay, type IntroLabels, type IntroVariant } from './intro';
export { coverMonogram, easeInOut, RibbonCover, ZipperCover, type CoverProps } from './covers';
export type { RenderSlots, RenderMode, SectionProps } from './types';
export { CanvasArtboard, type ArtboardMode, type CanvasArtboardProps } from './canvas/artboard';
export { CardView, watermarkBandHeight, type CardViewProps } from './canvas/card';
export { fillBackdrop, fillStyle, fontFamilyFor, resolveColor, solidHex, textInk } from './canvas/colors';
export { Icon as CanvasIcon } from './canvas/icons';
export {
  alignFrames,
  boundsOf,
  clampFrame,
  distributeFrames,
  frameBox,
  layerLabel,
  moveFrame,
  resizeFrame,
  rotationFor,
  scaleFrame,
  snapLines,
  Stage,
  touches,
  useHistory,
  type AlignMode,
  type Guide,
  type HandleName,
} from './canvas/editing';
export { Illustration, ILLUSTRATION_ASPECT, FRAME_SIZED, JHAROKHA_OPENING } from './art/illustrations';
/**
 * Signature 3D stages (ADR-078): the set registry, the camera, the hero, stills and what films and openings build on
 * (films import the openings' choreography and the covers' hinges from here, never from src/stage/*). Marketing and
 * dashboard pages that only show a still import `@bulava/template-engine/src/stage/still` instead: this entry point
 * pulls in the whole engine.
 */
export {
  BUILD_DURATION,
  buildAt,
  buildDelays,
  cameraMoveToShot,
  coverInfo,
  COVER_LAYOUT,
  coverMotion,
  coverPieces,
  COVER_START,
  coverStartTransforms,
  DEFAULT_POSES,
  dollyOf,
  easeCamera,
  enterFade,
  enterOf,
  fadeAt,
  filmParticleCount,
  fitStart,
  lensStyle,
  lerpPose,
  motionAt,
  nearestPropDistance,
  nearFadeAt,
  OPENING_MARKS,
  OPENING_MS,
  openingLight,
  openingStart,
  openingState,
  pieceFade,
  placeParticles,
  posesOf,
  poseTransform,
  revealProgress,
  revealTimes,
  seedOf,
  shotPose,
  STAGE_CSS,
  STAGE_REVEAL,
  STAGE_SETS,
  STAGE_TEXT_SHADOW,
  StageHero,
  stageLook,
  stagePoseData,
  stageSet,
  stageSimilarity,
  StageStill,
  StageStyles,
  stageVeil,
  StageView,
  viewIn,
  type CameraPose,
  type CoverHinge,
  type CoverMotion,
  type CoverPieceInfo,
  type EnterEdge,
  type OpeningCovers,
  type OpeningEnter,
  type OpeningState,
  type Particle,
  type PieceOverride,
  type StageMode,
  type StageName,
  type StageSet,
  type StageViewBox,
  type StageViewProps,
} from './stage';

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
    'stage',
  ],
  couple: ['default', 'stacked', 'portraits', 'duet', 'monogram', 'flip', 'profile'],
  family: ['default', 'blessings'],
  parents: ['default', 'blessings'],
  story: ['default', 'letter', 'curtain', 'polaroid'],
  eventTimeline: ['cards', 'timeline', 'frames', 'tiles', 'tickets', 'diya'],
  gallery: ['default', 'frames', 'stack', 'mosaic', 'polaroid', 'depth'],
  countdown: ['default', 'flip', 'rings', 'calendar'],
  venue: ['default', 'illustrated', 'postcard'],
  rsvp: ['default', 'card'],
  footer: ['default', 'seal', 'skyline', 'blessing'],
};

/** The section suites (sections/suites.ts): each ornament's own pieces, for the Studio and the docs. */
export { SUITES, suiteOf, type Suite } from './sections/suites';
