import type { ReactNode } from 'react';
import { ensureContrast, isStageIntro, STAGE_META, type EffectName, type IntroName, type ThemeColors } from '@bulava/template-schema';
import { deepOf } from '../theme';
import { coverPieces } from './covers3d';
import { placeParticles } from './particles';
import { stageSet } from './sets';
import { StageStyles } from './styles';
import type { StageName } from './types';
import { seedOf, STAGE_TEXT_SHADOW, stageScrim, stageVeil, StageView } from './view';

/**
 * The stage hero (final.md §3.1.1–3.1.3): the website's first section as a
 * set the guest looks into. Server-rendered at the rest pose, it carries
 * everything the client pieces drive by selector (rig.tsx, opening.tsx): the
 * stage DOM, the opening's cover pieces (hidden until it plays), the effect's
 * particles at depth, the words veil and the words themselves, with the scrim
 * that keeps their lower lines legible however long the block runs.
 */

/** The contrast the small lines' inks keep against the paper on a light stage (StageHero). */
const STAGE_SMALL_INK = 7;

export type StageHeroMode = 'live' | 'preview' | 'thumbnail';

export interface StageHeroProps {
  name: StageName;
  colors: ThemeColors;
  mode: StageHeroMode;
  /** The page's effective opening: a stage opening adds its cover pieces (live pages only). */
  intro?: IntroName;
  /** The page's effective effect, drawn as particles at depth (`none`: no particles). */
  effect?: EffectName;
  /** coverMonogram(couple, initials): printed on the covers' seals. */
  monogram: string;
  /** The words (HeroText with typeLines). */
  children: ReactNode;
}

export function StageHero({ name, colors, mode, intro, effect = 'none', monogram, children }: StageHeroProps) {
  const meta = STAGE_META[name];
  const thumbnail = mode === 'thumbnail';
  const ctx = { colors, monogram, detail: thumbnail ? ('low' as const) : ('full' as const) };
  const set = stageSet(name, ctx);
  const opening = mode === 'live' && isStageIntro(intro) ? intro : null;
  const covers = opening ? coverPieces(opening, set, ctx, { fontFamily: 'var(--t-script)' }) : [];
  const particles = thumbnail ? [] : placeParticles(set, effect, set.particles.count, seedOf(name));
  // Where the hero meets the page: a dark stage settles into its own deep shade (never a pale haze over its floor), a
  // light one into the paper. StageStyles swaps in the colour of the section that follows when the page shows it.
  const ground = meta.dark ? deepOf(colors) : colors.background;
  // The small lines' inks on a light stage (the greeting, the place, the eyebrow, the invocation, the tagline): the
  // page's own muted and secondary inks are corrected to 4.5:1 against the bare paper, which leaves nothing for the
  // stage showing through the words scrim. Over the stage they are held to 7:1 against the paper instead, so they keep
  // 4.5:1 over the scrim on a mid-tone ceiling or dark pews (QA, final.md §8.2 item 4). Dark stages set light inks on
  // the shade, which the scrim deepens.
  const inks = meta.dark
    ? {}
    : { ['--t-muted-ink' as string]: ensureContrast(colors.muted, [colors.background], STAGE_SMALL_INK), ['--t-secondary-ink' as string]: ensureContrast(colors.secondary, [colors.background], STAGE_SMALL_INK) };
  return (
    <header
      data-bulava-stage-hero=""
      data-stage={name}
      data-stage-tone={meta.dark ? 'dark' : 'light'}
      className={`relative isolate overflow-hidden ${thumbnail ? 'h-[720px]' : 'h-[calc(var(--bulava-screen,1svh)*100)] min-h-[640px] max-h-[980px]'}`}
      style={{ background: set.sky }}
    >
      <StageStyles />
      <StageView set={set} colors={colors} mode={mode} covers={covers} coversHidden particles={particles} intro={opening ?? ''} />
      <div className="bulava-stage-veil pointer-events-none absolute inset-0" style={{ background: stageVeil(set, colors) }} aria-hidden="true" />
      <div
        className="relative z-10 flex h-full flex-col items-center px-6 text-center"
        style={{ ...(meta.dark ? { textShadow: STAGE_TEXT_SHADOW } : {}), ...inks, ['--bulava-scrim' as string]: stageScrim(set, colors) }}
      >
        <div aria-hidden="true" style={{ flex: `0 0 ${Math.round(meta.textTop * 1000) / 10}%` }} />
        {children}
      </div>
      <div
        className="bulava-stage-foot pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16"
        style={{ background: `linear-gradient(to bottom, transparent, var(--bulava-stage-foot, ${ground}))` }}
        aria-hidden="true"
      />
    </header>
  );
}
