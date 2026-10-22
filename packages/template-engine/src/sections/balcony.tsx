import { useId, type CSSProperties, type ReactNode } from 'react';
import { formatEventDateRange, getLanguage } from '@bulava/localization';
import { resolveBinding, type IllustrationName } from '@bulava/template-schema';
import { ILLUSTRATION_ASPECT, Illustration } from '../art/illustrations';
import { emblemMetal } from '../art/illustrations-faith';
import { BalconyVista } from '../art/vignettes';
import { textureStyle } from '../canvas/colors';
import { Icon } from '../canvas/icons';
import type { SectionProps } from '../types';
import { ArtOrRef } from './decor';
import { dressOf, FleuronRule } from './dress';
import { HeroEntrance } from './entrance';
import { cx, heirloomCaps, HEIRLOOM_PILL, PillArrow } from './shared';

/** The garden roses' leaves (a natural sage that stays in every preset), as the page's rose decor draws them. */
const LEAVES = '#7c8f6a';

/**
 * hero "balcony" (The Royal Heirloom): the couple's photograph seen from a palace balcony. On wide pages a
 * golden-hour view runs behind the whole hero (sky, far hills, the lake, a lake palace low at the right, clear
 * of the words); the photo fills the left 64% under a carved arcade and fades into that view; the words stand
 * on the sky at 72% over a soft ivory wash, crowned by the faith emblem. On phones the photo stands in one
 * arch, anchored to its foot so faces stay clear of the cusps (a wide photo leaves the sky above it), and the
 * words follow below, the emblem at their head. Without a photo the lake palace stands in the arches.
 * Roses gather at the foot's corners, larger at the left; strands and brass lanterns hang from the cornice.
 * Props: eyebrow, title, date, dateEnd, tagline, image, cta, emblem (withFaith).
 */
export function BalconyHero({ p, title, emblem }: { p: SectionProps; title: string; emblem?: IllustrationName }) {
  const v = p.value;
  const image = v('image');
  const eyebrow = v('eyebrow');
  const tagline = v('tagline');
  const cta = v('cta');
  const dates = dateRange(p);
  const colors = p.colors;
  const live = p.mode === 'live';
  const script = getLanguage(p.language).script;
  const d = dressOf(p.ornament, p.look, colors, 'plain', p.dress);
  const ctaHref = p.nextSectionId ? `#${p.nextSectionId}` : undefined;
  const art = (name: IllustrationName, tint: string, w: number, h: number, style: CSSProperties, extra?: { sway?: number; className?: string; flip?: boolean }) => (
    <div aria-hidden="true" className={cx('pointer-events-none absolute', live && extra?.sway !== undefined && 'bulava-sway-soft', extra?.className)} style={{ ...style, ...(live && extra?.sway !== undefined ? { animationDelay: `${extra.sway}s` } : {}) }}>
      <Illustration name={name} color={tint} colors={colors} foil w={w} h={h} style={{ display: 'block', width: '100%', height: '100%', transform: extra?.flip ? 'scaleX(-1)' : undefined }} />
    </div>
  );
  const sand = colors.accent;
  // A strand hanging from the cornice: x and length in % of the box (26 px wide on a 1440 page).
  // Drawn at its own length (`box`: the frame's height in px), so its buds keep their spacing and markup stays light.
  const strand = (x: number, len: number, sway: number, box: number) =>
    art('jasmineStrand', colors.secondary, 26, Math.round((len / 100) * box), { left: `${x}%`, top: '9%', width: 'clamp(18px, 1.8cqw, 26px)', height: `${len}%`, transform: 'translateX(-50%)' }, { sway });
  // A brass lantern on a fine gold chain from the top, with a warm halo.
  const lantern = (x: number, len: number, sway: number, className?: string) => (
    <div key={`l${x}`} aria-hidden="true" className={cx('pointer-events-none absolute top-0', live && 'bulava-sway-soft', className)} style={{ left: `${x}%`, height: `${len}%`, width: 'clamp(40px, 3.6cqw, 52px)', transform: 'translateX(-50%)', ...(live ? { animationDelay: `${sway}s` } : {}) }}>
      <span className="absolute top-0 left-1/2 block w-px -translate-x-1/2" style={{ bottom: 'clamp(66px, 6cqw, 88px)', background: `linear-gradient(${colors.secondary}, ${colors.secondary}cc)` }} />
      <span className="absolute bottom-[-18%] left-1/2 block aspect-square w-[260%] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255, 227, 163, 0.35), rgba(255, 227, 163, 0))' }} />
      <span className="absolute bottom-0 left-0 block w-full" style={{ height: 'clamp(66px, 6cqw, 88px)' }}>
        <Illustration name="hangingLantern" color={colors.secondary} colors={colors} foil w={60} h={160} style={{ display: 'block', width: '100%', height: '100%' }} />
      </span>
    </div>
  );
  // Roses gathered in a corner of the foot (the page's shared drawing when it has one), flipped to face up.
  const roses = (className: string, flip: 'y' | 'xy') => (
    <div aria-hidden="true" className={cx('pointer-events-none absolute bottom-0 aspect-[320/270]', className)}>
      <div className="h-full w-full" style={{ transform: flip === 'y' ? 'scaleY(-1)' : 'scale(-1, -1)' }}>
        <ArtOrRef art="roseCluster" tint={LEAVES} colors={colors} foil={false} w={320} h={270} refs={p.artRefs} />
      </div>
    </div>
  );
  // The emblem is drawn once and placed where the words begin.
  const emblemId = `em${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const emblemAspect = emblem ? (ILLUSTRATION_ASPECT[emblem] ?? 1) : 1;
  const emblemNode = (size: number) =>
    emblem ? (
      <span data-emblem={emblem} aria-hidden="true" className="block" style={{ height: size, width: Math.round(size * emblemAspect) }}>
        <svg viewBox={`0 0 ${Math.round(emblemAspect * 1000) / 10} 100`} style={{ display: 'block', width: '100%', height: '100%' }}>
          <use href={`#${emblemId}`} />
        </svg>
      </span>
    ) : null;
  const lines = title.split(/\s+&\s+/);
  const longest = Math.max(...lines.map((l) => Array.from(l).length));
  const scale = longest > 18 ? 0.72 : longest > 12 ? 0.86 : 1;
  const names: ReactNode =
    lines.length === 2 ? (
      <>
        <span className="block" data-line="">
          {lines[0]}
        </span>
        <span className="block text-[0.62em] leading-none" data-line="">
          &amp;
        </span>
        <span className="block" data-line="">
          {lines[1]}
        </span>
      </>
    ) : (
      <span data-line="">{title}</span>
    );

  return (
    <header id={p.instance.id} className="bulava-heirloom-hero relative overflow-hidden bg-[var(--t-bg)] @min-[900px]:flex @min-[900px]:min-h-[min(clamp(620px,49cqw,860px),calc(var(--bulava-screen,1svh)*100))]" style={{ ['--t-band' as string]: 'var(--t-bg)' }}>
      <div className="pointer-events-none absolute inset-0" style={textureStyle('paper', 0.5, [colors.background])} aria-hidden="true" />
      {emblem ? (
        <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <defs>
            <symbol id={emblemId} viewBox={`0 0 ${Math.round(emblemAspect * 1000) / 10} 100`}>
              <Illustration name={emblem} color={emblemMetal(colors, false)} colors={colors} foil w={Math.round(emblemAspect * 100)} h={100} style={{ width: '100%', height: '100%' }} />
            </symbol>
          </defs>
        </svg>
      ) : null}
      {/* The view past the balcony: behind the whole hero on wide pages, inside the arch (above a wide photo) on phones. */}
      <BalconyVista colors={colors} photo={!!image} className="pointer-events-none absolute top-0 left-0 block aspect-[10/11] w-full @min-[900px]:inset-0 @min-[900px]:aspect-auto @min-[900px]:h-full" />
      {/* A soft ivory wash behind the words, so they read on the sky. */}
      <div className="pointer-events-none absolute top-[6%] left-[72%] hidden h-[84%] w-[46%] -translate-x-1/2 @min-[900px]:block" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--t-surface) 92%, transparent), color-mix(in srgb, var(--t-surface) 55%, transparent) 55%, transparent)' }} aria-hidden="true" />
      {/* The photo: in the arch on phones (10:11, its foot on the arch's foot), the left 64% feathered into the view on wide pages. */}
      <div className="bulava-heirloom-photo relative aspect-[10/11] w-full overflow-hidden @min-[900px]:absolute @min-[900px]:inset-y-0 @min-[900px]:left-0 @min-[900px]:aspect-auto @min-[900px]:w-[64%]">
        {image ? (
          <img
            src={image}
            alt=""
            className="absolute inset-x-0 bottom-0 h-auto max-h-full w-full object-cover [object-position:50%_35%] [mask-image:linear-gradient(to_bottom,transparent,#000_56px)] @min-[900px]:top-0 @min-[900px]:h-full @min-[900px]:max-h-none @min-[900px]:[object-position:50%_38%] @min-[900px]:[mask-image:none]"
            loading="eager"
          />
        ) : null}
        {/* Phones: one arch with pillars at both edges, its strands and a lantern; a carved finial crowns it. */}
        <div className="@min-[900px]:hidden" aria-hidden="true">
          {art('palaceArcade', sand, 390, 429, { inset: 0, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.08))' })}
          {strand(5, 26, 0, 429)}
          {strand(89, 20, 2.4, 429)}
          {strand(95, 28, 0.6, 429)}
          {lantern(72, 30, 1.8)}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 @min-[900px]:hidden" style={{ background: 'linear-gradient(to bottom, transparent, var(--t-bg))' }} aria-hidden="true" />
      </div>
      {/* Wide pages: the arcade over the photo, strands from its cornice, lanterns. */}
      <div className="pointer-events-none absolute inset-0 hidden @min-[900px]:block" aria-hidden="true">
        {art('palaceArcade', sand, 920, 708, { left: 0, top: 0, width: '64%', height: '100%', filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.08))', WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent)', maskImage: 'linear-gradient(to right, #000 82%, transparent)' })}
        {strand(2.4, 34, 0, 708)}
        {strand(29.4, 20, 2.4, 708)}
        {strand(34.6, 16, 0.6, 708)}
        {lantern(41, 17, 1.8)}
        {lantern(93.5, 29, 0.4)}
        {lantern(98, 14, 2)}
      </div>
      {/* Roses in the foot's corners: on the photo's corners on phones, at the page's corners on wide pages. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[10/11] @min-[900px]:inset-y-0 @min-[900px]:aspect-auto" aria-hidden="true">
        {roses('-left-3 h-[118px] @min-[900px]:-left-[1%] @min-[900px]:-bottom-[1%] @min-[900px]:h-[clamp(150px,15.5cqw,232px)]', 'y')}
        {roses('-right-2 h-[84px] @min-[900px]:-right-[0.6%] @min-[900px]:-bottom-[1%] @min-[900px]:h-[clamp(104px,10cqw,150px)]', 'xy')}
      </div>
      {/* The words, sheltered from the falling petals. */}
      {live ? <HeroEntrance targetId={`${p.instance.id}-words`} /> : null}
      <div
        id={`${p.instance.id}-words`}
        data-effect-shelter=""
        className="bulava-heirloom-words relative z-[1] flex flex-col items-center px-6 pt-8 pb-10 text-center @min-[900px]:mr-auto @min-[900px]:ml-[calc(72%-230px)] @min-[900px]:w-[460px] @min-[900px]:px-0 @min-[900px]:pt-[104px] @min-[900px]:pb-[150px]"
      >
        {emblem ? <div className="mb-4 @min-[900px]:mb-[18px]">{emblemNode(64)}</div> : null}
        {eyebrow ? <p className={cx('mb-[18px] text-[11.5px] leading-[1.4] font-semibold text-[var(--t-secondary-ink)] @min-[640px]:text-[13px]', heirloomCaps(script, 'tracking-[0.2em]'))}>{eyebrow}</p> : null}
        <h1
          className="text-[length:calc(42px*var(--k))] leading-[1.04] font-medium italic break-words text-balance text-[var(--t-primary-ink)] [font-family:var(--t-heading)] [overflow-wrap:break-word] @min-[640px]:text-[length:calc(60px*var(--k))]"
          style={{ ['--k' as string]: scale }}
        >
          {names}
        </h1>
        <FleuronRule d={d} size="compact" className="mt-[22px]" />
        {tagline ? <p className="mt-5 max-w-[26rem] text-[15.5px] leading-[1.6] text-[var(--t-text)] @min-[640px]:text-[17px]">{tagline}</p> : null}
        {dates ? (
          <p className={cx('flex items-center gap-2.5 text-[14px] text-[var(--t-text)] @min-[640px]:text-[15px]', tagline ? 'mt-3.5' : 'mt-5')}>
            <span className="size-[18px] shrink-0 text-[var(--t-primary-ink)]">
              <Icon name="calendar" weight={1.5} />
            </span>
            {dates}
          </p>
        ) : null}
        {cta && ctaHref && p.mode !== 'thumbnail' ? (
          <a href={ctaHref} className={cx(HEIRLOOM_PILL, 'mt-[26px] min-w-[220px] @min-[640px]:min-w-[260px] @min-[640px]:min-h-12')}>
            {cta}
            <PillArrow />
          </a>
        ) : cta ? (
          <span className={cx(HEIRLOOM_PILL, 'mt-[26px] min-w-[220px] @min-[640px]:min-w-[260px] @min-[640px]:min-h-12')}>
            {cta}
            <PillArrow />
          </span>
        ) : null}
      </div>
    </header>
  );
}

/** The event's dates as one span ("14–15 December 2026"), from the props' own bindings; else the date prop as given. */
function dateRange(p: SectionProps): string | undefined {
  const raw = (key: string) => {
    const value = p.instance.props[key];
    const out = value && 'binding' in value ? resolveBinding(value.binding, p.ctx) : undefined;
    return typeof out === 'string' && !Number.isNaN(Date.parse(out)) ? out : undefined;
  };
  const start = raw('date');
  if (start) return formatEventDateRange(start, raw('dateEnd'), { language: p.language, timeZone: p.timeZone });
  const date = p.value('date');
  const end = p.value('dateEnd');
  return date && end && end !== date ? `${date} – ${end}` : date;
}
