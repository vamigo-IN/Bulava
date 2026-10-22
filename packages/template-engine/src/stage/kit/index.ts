/**
 * The stage kit (final.md §6): shared pieces every set draws with. Each file
 * belongs to one art owner; this index only re-exports them (it never changes
 * when art replaces a stub).
 */
import { ARCHITECTURE_KIT } from './architecture';
import { LIGHTS_KIT } from './lights';
import { NATURE_KIT } from './nature';
import type { KitEntry } from './place';
import { SURFACES_KIT } from './surfaces';

export { ArchScreen, Ceiling, Floor, MistBand, Sky, SURFACES_KIT, Wall, Water } from './surfaces';
export type {
  ArchScreenOptions,
  ArchScreenVariant,
  CeilingOptions,
  CeilingVariant,
  FloorOptions,
  FloorVariant,
  MistBandOptions,
  MistBandVariant,
  Skyline,
  SkyOptions,
  SkyVariant,
  WallOptions,
  WallVariant,
  WaterOptions,
  WaterVariant,
} from './surfaces';

export { ARCHITECTURE_BOXES, ARCHITECTURE_KIT, Balustrade, Fountain, LampPost, Pedestal, Pillar, Pole, Stall } from './architecture';
export type {
  BalustradeOptions,
  BalustradeVariant,
  FountainOptions,
  FountainVariant,
  LampPostOptions,
  LampPostVariant,
  PedestalOptions,
  PedestalVariant,
  PillarOptions,
  PillarVariant,
  PoleOptions,
  PoleVariant,
  StallOptions,
  StallVariant,
} from './architecture';

export { Chandelier, HangingLantern, LampStand, LIGHTS_BOXES, LIGHTS_KIT, LightShaft, LightString, SacredFire } from './lights';
export type {
  ChandelierOptions,
  ChandelierVariant,
  HangingLanternOptions,
  HangingLanternVariant,
  LampStandOptions,
  LampStandVariant,
  LightShaftOptions,
  LightShaftVariant,
  LightStringOptions,
  LightStringVariant,
} from './lights';

export { BananaPlant, BOUGAINVILLEA, NATURE_BOXES, NATURE_KIT, Planter, Tree } from './nature';
export type { PlanterOptions, PlanterPlant, TreeOptions, TreeVariant } from './nature';

export { CardCover, COVER_BOXES, DoorCover, GateCover, SilkCover } from './covers';
export type { CardCoverOptions, CardPart, DoorCoverOptions, DoorPart, GateCoverOptions, GatePart, SilkCoverOptions, SilkPart } from './covers';

export { ParticleArt, particleLook } from './particles';
export type { ParticleArtProps, ParticleColorVar, ParticleLook } from './particles';

export { drawWith, illus, illusAspect, motif } from './place';
export type { KitEntry, MotifName } from './place';

/** Every shared kit piece (surfaces, architecture, lights, nature): names, variants and default boxes. */
export const KIT_PIECES: readonly KitEntry[] = [...SURFACES_KIT, ...ARCHITECTURE_KIT, ...LIGHTS_KIT, ...NATURE_KIT];
