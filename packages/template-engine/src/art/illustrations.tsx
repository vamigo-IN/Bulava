import type { ReactNode } from 'react';
import type { IllustrationName } from '@bulava/template-schema';
import type { IllustrationProps } from './kit';
import { BalloonBunch, Bunting, Cake, DiyaRow, FairyLights, GiftBox, House, MoonCloud, Rings } from './illustrations-festive';
import { BananaLeaf, Doves, Elephant, FloralGarland, JasmineStrand, MehendiHand, RoseCluster, RoyalPeacock } from './illustrations-nature';
import { Arabesque, Domes, FiligreeCorner, Flourish, Jharokha, Kolam, Medallion, OrnateFrame, PaisleyOrnate, RangoliBloom, TempleBells } from './illustrations-ornate';
import { CoupleBengali, CoupleChristian, CoupleElder, CoupleHindu, CoupleNikah, CoupleSikh, CoupleSouth, CoupleVarmala } from './illustrations-people';
import { BabyCradle, BrideBust, GroomBust, KidBoy, KidGirl, MomToBe } from './illustrations-family';
import { BotanicalWreath, DecoFrame, GoldVine, HairlineFrame, MandalaCrown, MandalaHalf, Sparkles } from './illustrations-heirloom';
import { Champagne, Cupcake, Dhol, Dino, Doli, HaldiBowl, Rocket, Stork, TeddyBear, Unicorn } from './illustrations-props';
import { Alpana, Ghungroo, Kuthuvilakku, LaalPaar, MarigoldSwag, MarigoldWreath, Mihrab, Phulkari, Prabhavali, ZariBand } from './illustrations-regional';

export type { IllustrationProps } from './kit';
export { foilCss, metalStops } from './kit';

/**
 * Full-colour illustrations for canvas layers (docs/templates.md#canvas-sections).
 * Every one is drawn in code: no assets, no licences, recoloured by the palette.
 */

const COMPONENTS: Record<IllustrationName, (props: IllustrationProps) => ReactNode> = {
  elephant: Elephant,
  royalPeacock: RoyalPeacock,
  jharokha: Jharokha,
  ornateFrame: OrnateFrame,
  filigreeCorner: FiligreeCorner,
  flourish: Flourish,
  medallion: Medallion,
  paisleyOrnate: PaisleyOrnate,
  roseCluster: RoseCluster,
  floralGarland: FloralGarland,
  templeBells: TempleBells,
  jasmineStrand: JasmineStrand,
  bananaLeaf: BananaLeaf,
  kolam: Kolam,
  mehendiHand: MehendiHand,
  domes: Domes,
  arabesque: Arabesque,
  doves: Doves,
  rings: Rings,
  cake: Cake,
  balloonBunch: BalloonBunch,
  bunting: Bunting,
  giftBox: GiftBox,
  fairyLights: FairyLights,
  moonCloud: MoonCloud,
  house: House,
  diyaRow: DiyaRow,
  rangoliBloom: RangoliBloom,
  coupleHindu: CoupleHindu,
  coupleVarmala: CoupleVarmala,
  coupleSikh: CoupleSikh,
  coupleNikah: CoupleNikah,
  coupleSouth: CoupleSouth,
  coupleChristian: CoupleChristian,
  coupleBengali: CoupleBengali,
  coupleElder: CoupleElder,
  kidBoy: KidBoy,
  kidGirl: KidGirl,
  babyCradle: BabyCradle,
  momToBe: MomToBe,
  brideBust: BrideBust,
  groomBust: GroomBust,
  stork: Stork,
  teddyBear: TeddyBear,
  unicorn: Unicorn,
  dino: Dino,
  rocket: Rocket,
  cupcake: Cupcake,
  doli: Doli,
  dhol: Dhol,
  haldiBowl: HaldiBowl,
  champagne: Champagne,
  mandalaCrown: MandalaCrown,
  mandalaHalf: MandalaHalf,
  hairlineFrame: HairlineFrame,
  goldVine: GoldVine,
  sparkles: Sparkles,
  prabhavali: Prabhavali,
  kuthuvilakku: Kuthuvilakku,
  zariBand: ZariBand,
  mihrab: Mihrab,
  phulkari: Phulkari,
  alpana: Alpana,
  marigoldSwag: MarigoldSwag,
  botanicalWreath: BotanicalWreath,
  decoFrame: DecoFrame,
  laalPaar: LaalPaar,
  marigoldWreath: MarigoldWreath,
  ghungroo: Ghungroo,
};

/** Drawn to the layer's own size (frames, garlands, strings); the others keep their proportions inside it. */
export const FRAME_SIZED: ReadonlySet<IllustrationName> = new Set<IllustrationName>(['ornateFrame', 'floralGarland', 'jasmineStrand', 'bunting', 'fairyLights', 'hairlineFrame', 'goldVine', 'sparkles', 'zariBand', 'mihrab', 'phulkari', 'marigoldSwag', 'decoFrame', 'laalPaar', 'ghungroo']);

/** Width ÷ height of each illustration as drawn (new layers in the editor start at it). */
export const ILLUSTRATION_ASPECT: Record<IllustrationName, number> = {
  elephant: 350 / 280,
  royalPeacock: 320 / 400,
  jharokha: 300 / 440,
  ornateFrame: 0.75,
  filigreeCorner: 1,
  flourish: 5,
  medallion: 1,
  paisleyOrnate: 160 / 222,
  roseCluster: 320 / 270,
  floralGarland: 4,
  templeBells: 1,
  jasmineStrand: 0.12,
  bananaLeaf: 220 / 380,
  kolam: 1,
  mehendiHand: 240 / 340,
  domes: 400 / 232,
  arabesque: 1,
  doves: 1.5,
  rings: 230 / 170,
  cake: 0.8,
  balloonBunch: 270 / 350,
  bunting: 4,
  giftBox: 1,
  fairyLights: 5,
  moonCloud: 300 / 260,
  house: 1,
  diyaRow: 400 / 110,
  rangoliBloom: 1,
  coupleHindu: 300 / 380,
  coupleVarmala: 300 / 380,
  coupleSikh: 300 / 380,
  coupleNikah: 300 / 380,
  coupleSouth: 300 / 380,
  coupleChristian: 300 / 380,
  coupleBengali: 300 / 380,
  coupleElder: 300 / 380,
  kidBoy: 200 / 314,
  kidGirl: 200 / 314,
  babyCradle: 260 / 220,
  momToBe: 220 / 340,
  brideBust: 1,
  groomBust: 1,
  stork: 300 / 230,
  teddyBear: 200 / 220,
  unicorn: 220 / 250,
  dino: 260 / 210,
  rocket: 170 / 270,
  cupcake: 160 / 210,
  doli: 320 / 250,
  dhol: 220 / 170,
  haldiBowl: 240 / 170,
  champagne: 220 / 230,
  mandalaCrown: 400 / 290,
  mandalaHalf: 400 / 204,
  hairlineFrame: 390 / 844,
  goldVine: 0.07,
  sparkles: 1.5,
  prabhavali: 300 / 420,
  kuthuvilakku: 120 / 300,
  zariBand: 390 / 56,
  mihrab: 340 / 600,
  phulkari: 390 / 56,
  alpana: 1,
  marigoldSwag: 390 / 120,
  botanicalWreath: 1,
  decoFrame: 390 / 844,
  laalPaar: 390 / 56,
  marigoldWreath: 1,
  ghungroo: 0.1,
};

/** Where a photo sits behind a jharokha, as fractions of the jharokha's frame (an arch mask fits it). */
export const JHAROKHA_OPENING = { x: 0.2067, y: 0.2545, w: 0.5867, h: 0.5 } as const;

export function Illustration({ name, ...props }: { name: IllustrationName } & IllustrationProps) {
  const Component = COMPONENTS[name];
  return Component ? <Component {...props} /> : null;
}
