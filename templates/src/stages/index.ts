import type { StageTemplateSpec } from './types';
import { sheeshMahal } from './sheesh-mahal';
import { chaarBagh } from './chaar-bagh';
import { amritVela } from './amrit-vela';
import { downTheAisle } from './down-the-aisle';
import { bougainvilleaCourt } from './bougainvillea-court';
import { rooftopRing } from './rooftop-ring';
import { bigTop } from './big-top';
import { grandBallroom } from './grand-ballroom';
import { cloudNine } from './cloud-nine';
import { jasmineAangan } from './jasmine-aangan';
import { haridwarDawn } from './haridwar-dawn';
import { thousandPillars } from './thousand-pillars';
import { shubhDwaar } from './shubh-dwaar';
import { deepstambh } from './deepstambh';
import { roshniBazaar } from './roshni-bazaar';
import { centreStage } from './centre-stage';
import { almaMater } from './alma-mater';
import { melaChowk } from './mela-chowk';
import { goldenVeranda } from './golden-veranda';

export type { StageFilmParts, StageTemplateSpec, StageWebsiteSpec } from './types';

/**
 * The Signature 3D collection (ADR-078, final.md §5.2), in the table's order:
 * websites take sort orders −100…−82 and films −60…−42 (index.ts), ahead of
 * the older catalog. One spec file per template, owned by its template agent.
 */
export const STAGE_TEMPLATE_SPECS: readonly StageTemplateSpec[] = [
  sheeshMahal,
  chaarBagh,
  amritVela,
  downTheAisle,
  bougainvilleaCourt,
  rooftopRing,
  bigTop,
  grandBallroom,
  cloudNine,
  jasmineAangan,
  haridwarDawn,
  thousandPillars,
  shubhDwaar,
  deepstambh,
  roshniBazaar,
  centreStage,
  almaMater,
  melaChowk,
  goldenVeranda,
];
