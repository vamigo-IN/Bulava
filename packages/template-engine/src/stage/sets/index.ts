import type { SetContext, StageName, StageSet, StageSetFactory } from '../types';
import { sheeshMahal } from './sheesh-mahal';
import { chaarBagh } from './chaar-bagh';
import { causeway } from './causeway';
import { nave } from './nave';
import { courtyard } from './courtyard';
import { rooftop } from './rooftop';
import { bigTop } from './big-top';
import { ballroom } from './ballroom';
import { cloudNine } from './cloud-nine';
import { aangan } from './aangan';
import { ghat } from './ghat';
import { mandapam } from './mandapam';
import { dwaar } from './dwaar';
import { deepstambh } from './deepstambh';
import { bazaar } from './bazaar';
import { auditorium } from './auditorium';
import { quadrangle } from './quadrangle';
import { mela } from './mela';
import { veranda } from './veranda';

/**
 * The stage registry (final.md §1.6): one set file per stage
 * (`sets/<stage-kebab>.tsx`, exporting one factory named after the stage),
 * each owned by its template agent. Factories are functions only: nothing is
 * drawn at module load.
 */
export const STAGE_SETS: Readonly<Record<StageName, StageSetFactory>> = {
  sheeshMahal,
  chaarBagh,
  causeway,
  nave,
  courtyard,
  rooftop,
  bigTop,
  ballroom,
  cloudNine,
  aangan,
  ghat,
  mandapam,
  dwaar,
  deepstambh,
  bazaar,
  auditorium,
  quadrangle,
  mela,
  veranda,
};

const MEMO_MAX = 256;
const memo = new Map<string, StageSet>();

/** A stage's set for a palette, monogram and detail level, memoised per (name, colors, monogram, detail). */
export function stageSet(name: StageName, ctx: SetContext): StageSet {
  const c = ctx.colors;
  const key = [name, c.primary, c.secondary, c.accent, c.background, c.surface, c.text, c.muted, ctx.monogram, ctx.detail].join('|');
  const hit = memo.get(key);
  if (hit) return hit;
  const set = STAGE_SETS[name](ctx);
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(key, set);
  return set;
}
