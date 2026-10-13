import type { OrnamentNameValue, SuiteCorner, SuiteDivider, SuiteEdge, SuiteFrame, SuiteSeal, SuiteSkyline, ThemeDress } from '@bulava/template-schema';
import type { GlyphName } from '../ornaments-suite';

/**
 * Suites: how the sections below a hero are dressed, so the whole page reads
 * as one printed invitation suite (docs/templates.md#section-suites). A theme's
 * ornament names its suite: the glyph between rules under every heading and on
 * timeline nodes, the corner pieces, the border along the top of a band, the
 * round seal (monograms, the closing seal, the countdown), the shape of photo
 * frames and cards, and the art at the foot of the page. A theme may swap
 * single pieces (`theme.dress`), so two designs in one suite still differ.
 * The look sets the type and the rhythm of the bands, the palette the colours,
 * and each section's variant its layout.
 *
 * Restraint is the rule: a suite takes one or two pieces of its hero's art,
 * never all of them, and every piece is drawn by the engine in the palette.
 */

export type FrameShape = SuiteFrame;
export type EdgeName = SuiteEdge;
export type SealName = SuiteSeal;
export type SkylineName = SuiteSkyline;
export type DividerKind = SuiteDivider;
export type CornerName = SuiteCorner;

export interface Suite {
  name: OrnamentNameValue;
  glyph: GlyphName;
  divider: DividerKind;
  /** Mirrored pieces in a band's top corners (framed panels take all four). */
  corner: CornerName;
  edge: EdgeName;
  seal: SealName;
  frame: FrameShape;
  skyline: SkylineName;
  /** Strands that hang down the sides of a closing band. */
  hang?: 'marigoldStrand' | 'lantern' | 'jasmineStrand' | 'ghungroo';
  /** Sparkle over dark bands. */
  sky?: 'stars' | 'sparkles' | 'confetti';
  /** Metal art is foil-stamped. */
  foil: boolean;
  /** The paper's pattern when the theme sets none. */
  pattern: string;
}

type Base = Omit<Suite, 'name'>;

const SUITE_BASE: Record<OrnamentNameValue, Base> = {
  // The look's own dress (templates made before suites): plain rules and the look's corners.
  none: { glyph: 'none', divider: 'glyph', corner: 'none', edge: 'none', seal: 'crest', frame: 'rounded', skyline: 'none', foil: false, pattern: 'none' },
  // Rajasthani palace: the hero's foil flourish, filigree corners, a marigold toran, the medallion, jharokha windows and a pair of elephants at the foot.
  mandala: { glyph: 'mandala', divider: 'flourish', corner: 'filigreeCorner', edge: 'toran', seal: 'medallion', frame: 'jharokha', skyline: 'elephants', hang: 'lantern', sky: 'stars', foil: true, pattern: 'damask' },
  // Bandhani and mehendi folk: paisleys, tie-dye dots, an arch, a kalash either side at the foot.
  paisley: { glyph: 'paisley', divider: 'triple', corner: 'paisleyOrnate', edge: 'bandhani', seal: 'mandala', frame: 'arch', skyline: 'kalash', hang: 'marigoldStrand', foil: false, pattern: 'bandhani' },
  // Garden romance: roses in the corners, a rose garland, a botanical wreath, oval frames, roses at the foot.
  floral: { glyph: 'floral', divider: 'glyph', corner: 'roseCluster', edge: 'floralGarland', seal: 'botanicalWreath', frame: 'oval', skyline: 'roses', foil: false, pattern: 'none' },
  // Modern geometry: a diamond on fine rules, rounded cards, a geometric star.
  geometric: { glyph: 'geometric', divider: 'glyph', corner: 'none', edge: 'none', seal: 'jaali', frame: 'rounded', skyline: 'none', foil: false, pattern: 'none' },
  // The party: bunting, confetti, ticket cards, a sticker seal, balloons and presents at the foot.
  confetti: { glyph: 'confetti', divider: 'triple', corner: 'none', edge: 'bunting', seal: 'sticker', frame: 'ticket', skyline: 'balloons', sky: 'confetti', foil: false, pattern: 'confetti' },
  // Bengali: the red laal paar border, the alpana, round frames, lotuses at the foot.
  lotus: { glyph: 'lotus', divider: 'lotus', corner: 'none', edge: 'laalPaar', seal: 'alpana', frame: 'circle', skyline: 'lotuses', foil: false, pattern: 'none' },
  // Mayur: peacock feathers in the corners, the medallion, arches, a pair of royal peacocks at the foot.
  peacock: { glyph: 'peacock', divider: 'glyph', corner: 'peacockFeather', edge: 'none', seal: 'medallion', frame: 'arch', skyline: 'peacocks', foil: true, pattern: 'paisley' },
  // A night sky: stars on the rules, round frames, a moon seal, a crescent rising at the foot.
  stars: { glyph: 'stars', divider: 'glyph', corner: 'none', edge: 'none', seal: 'moon', frame: 'circle', skyline: 'moonrise', sky: 'stars', foil: true, pattern: 'stars' },
  // Heirloom classic: laurel sprigs, double hairline cards, a crest seal.
  laurel: { glyph: 'laurel', divider: 'laurel', corner: 'none', edge: 'none', seal: 'crest', frame: 'double', skyline: 'none', foil: true, pattern: 'none' },
  // South Indian temple: the temple border, the kolam, prabhavali niches, brass lamps at the foot, jasmine.
  temple: { glyph: 'temple', divider: 'glyph', corner: 'none', edge: 'templeBorder', seal: 'kolam', frame: 'niche', skyline: 'lamps', hang: 'jasmineStrand', foil: true, pattern: 'kolam' },
  // Kerala: the kasavu's gold border on ivory, the nilavilakku in a ring, simple arches, lamps at the foot.
  kasavu: { glyph: 'kasavu', divider: 'glyph', corner: 'none', edge: 'zariBand', seal: 'emblem', frame: 'arch', skyline: 'lamps', hang: 'jasmineStrand', foil: true, pattern: 'none' },
  // Mughal: a row of cusped arches, filigree, the arabesque, mihrab frames, lanterns and domes.
  jaali: { glyph: 'jaali', divider: 'glyph', corner: 'filigreeCorner', edge: 'arches', seal: 'arabesque', frame: 'mihrab', skyline: 'domes', hang: 'lantern', sky: 'stars', foil: true, pattern: 'jaali' },
  // Genda phool: marigold swags, the marigold wreath, scalloped frames, diyas at the foot.
  marigold: { glyph: 'marigold', divider: 'triple', corner: 'none', edge: 'marigoldSwag', seal: 'marigoldWreath', frame: 'scallop', skyline: 'diyaRow', hang: 'marigoldStrand', foil: false, pattern: 'dots' },
  // Punjabi phulkari: the embroidered border, phulkari flowers, arches.
  bagh: { glyph: 'bagh', divider: 'triple', corner: 'none', edge: 'phulkari', seal: 'phulkari', frame: 'arch', skyline: 'phulkari', foil: false, pattern: 'none' },
  // The threshold: a mango-leaf toran, the rangoli, doorway arches, diyas at the foot.
  rangoli: { glyph: 'rangoli', divider: 'glyph', corner: 'none', edge: 'toran', seal: 'rangoliBloom', frame: 'arch', skyline: 'diyaRow', hang: 'marigoldStrand', foil: false, pattern: 'rangoli' },
  // Art deco: stepped rules, fans, stepped frames, a sunburst seal.
  deco: { glyph: 'deco', divider: 'rule', corner: 'decoCorner', edge: 'deco', seal: 'sunburst', frame: 'deco', skyline: 'sunburst', sky: 'sparkles', foil: true, pattern: 'scales' },
  // The nursery: a scalloped cloud edge, cloud frames, a moon seal, clouds at the foot.
  clouds: { glyph: 'clouds', divider: 'glyph', corner: 'none', edge: 'scallop', seal: 'moon', frame: 'cloud', skyline: 'clouds', sky: 'stars', foil: false, pattern: 'stars' },
  // A church: a row of lancet arches, the rose window, lancet frames, a pair of doves at the foot.
  chapel: { glyph: 'chapel', divider: 'glyph', corner: 'none', edge: 'lancets', seal: 'roseWindow', frame: 'lancet', skyline: 'doves', foil: true, pattern: 'none' },
};

/** The suite a template's ornament names, with the theme's own pieces swapped in (`theme.dress`). */
export function suiteOf(ornament: OrnamentNameValue | undefined, dress?: ThemeDress): Suite {
  const name = ornament && SUITE_BASE[ornament] ? ornament : 'none';
  const base = SUITE_BASE[name];
  if (!dress) return { name, ...base };
  const own = Object.fromEntries(Object.entries(dress).filter(([, v]) => v !== undefined)) as Partial<Base>;
  return { name, ...base, ...own };
}

/** Every suite's own pieces (for the Studio and the docs). */
export const SUITES: Readonly<Record<OrnamentNameValue, Suite>> = Object.fromEntries(Object.keys(SUITE_BASE).map((k) => [k, suiteOf(k as OrnamentNameValue)])) as Record<OrnamentNameValue, Suite>;
