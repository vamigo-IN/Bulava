import type { EffectName, StageIntro, StageNameValue, StageShot } from '@bulava/template-schema';
import type { WebsiteSpec } from '../builder';

/**
 * Signature 3D template specs (ADR-078, final.md §5.4): one file per template
 * in templates/src/stages/<key>.ts exporting exactly one StageTemplateSpec
 * (named the camelCase key), turned into a website (stageWebsite, builder.ts)
 * and its film (stageFilm, video.ts) by the catalog. The builders fix what
 * every stage template shares: the hero is the stage, the pattern none, music
 * on (the template's own track by default), theme.motion 'stage', tier
 * SIGNATURE, badge NEW unless set.
 *
 * Check one template without building the catalog (local, gitignored):
 *   pnpm --filter @bulava/template-catalog exec vitest run src/stages/stage-template.test.ts -t <key>
 */

export interface StageWebsiteSpec extends Omit<WebsiteSpec, 'hero' | 'intro' | 'music' | 'pattern' | 'motion'> {
  stage: StageNameValue;
  intro: StageIntro;
  /** Translation key replacing the layout's eyebrow ('template.engagementOf', 'template.naming', …). */
  eyebrow?: string;
  /** §7.1 slug: one of Bulava's own tracks (music.defaultTrack, website and film alike). */
  defaultTrack: string;
  /** 'event': the hero (and the film) show the event's own title instead of the names (pujas, festivals, programmes). */
  heroTitle?: 'names' | 'event';
}

export interface StageFilmParts {
  /** The film's own description (its catalog card). */
  description: string;
  people: 'couple' | 'one';
  nameStyle: 'script' | 'caps';
  /** A VideoOrnament name: toran, marigoldStrand, diya, kalash, bell, crescent, lantern, peacockFeather or an ORNAMENTS name. */
  motif: string;
  joiner?: 'weds' | 'and';
  portrait?: 'arch' | 'circle';
  /** Each part's camera through the stage (the opening always settles from the opening's end pose). */
  shots: { names: StageShot; couple?: StageShot; functions: StageShot; closing: StageShot };
  /** Each shot's strength (backdrop.intensity; 1 when unset). */
  intensity?: Partial<Record<'names' | 'couple' | 'functions' | 'closing', number>>;
  /** Particles drawn at depth in the stage: the opening's, the names' (and the couple's), the closing's. */
  particles: { opening: EffectName; names: EffectName; closing: EffectName };
}

export interface StageTemplateSpec {
  website: StageWebsiteSpec;
  film: StageFilmParts;
}
