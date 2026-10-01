import type { CSSProperties } from 'react';
import { ArchFrame, Confetti, FloralCorner, Mandala, Ornament, patternStyle, TempleBorder } from '../ornaments';
import { CrestFrame, Crescent, GothicArch, Lantern, Laurel, PeacockFeather, RoseWindow, SeaWaves, StarField } from '../ornaments-signature';
import { artworkArt, DARK_SCENES, SceneHero, sceneArt, type SceneName } from '../art/scenes';
import type { SectionProps } from '../types';
import { cx, initials, Names } from './shared';

/** Name styling per scene: grand capitals for heritage scenes, italic serif for noir, script elsewhere. */
const SCENE_TYPE: Partial<Record<string, 'script' | 'caps' | 'italic'>> = {
  gopuram: 'caps',
  toran: 'caps',
  mandap: 'caps',
  sarovar: 'caps',
  noir: 'italic',
  palace: 'script',
  arches: 'script',
  lotus: 'script',
  floral: 'script',
  balloons: 'caps',
  backwaters: 'script',
  vrindavan: 'script',
};

/**
 * Hero variants:
 *  arch     – jharokha/palace arch frame (royal Hindu, Rajasthani, Muslim)
 *  classic  – centred mandala medallion
 *  split    – photo in an arched mask beside the names
 *  photo    – full-bleed photo with overlay
 *  minimal  – editorial typography (modern, corporate)
 *  festive  – confetti (birthdays, parties)
 *  temple   – gopuram borders + kolam dots (South Indian)
 *  monogram – initials in a crest with laurels (heritage, royal)
 *  cathedral – gothic arch and rose window (church weddings)
 *  seaside  – sun and layered waves (beach and destination)
 *  celestial – night sky, crescent moon and twinkling stars (always dark)
 *  lantern  – hanging paper lanterns over a night sky (always dark)
 *  peacock  – crossed peacock feathers (Krishna-inspired)
 * Illustrated scenes with layered 3D parallax (art/scenes.tsx):
 *  gopuram, palace, toran, arches, lotus, mandap, noir, floral, balloons, backwaters, sarovar, vrindavan
 *  artwork – one of the template's painted artworks (prop `artwork`: its key; `nameStyle`: script, caps or italic)
 * Theme heroTone "dark" sets the hero on the primary colour with gold type.
 * Props: invocation, eyebrow, title, subtitle, date, place, tagline, image
 */
export function Hero(p: SectionProps) {
  const v = p.value;
  const dark = p.heroTone === 'dark' && p.instance.variant !== 'photo';
  const title = v('title') ?? p.ctx.event.title;
  const image = v('image');
  // Personal invitations greet the guest by name (never in catalogue thumbnails).
  const greeting = p.ctx.guest && p.mode !== 'thumbnail' ? p.t('invitation.dear', { guestName: p.ctx.guest.name }) : undefined;
  const common = { title, greeting, invocation: v('invocation'), eyebrow: v('eyebrow'), subtitle: v('subtitle'), date: v('date'), place: v('place'), tagline: v('tagline'), dark };
  const pattern = patternStyle(p.pattern, dark ? p.colors.accent : p.colors.secondary);
  const surface: CSSProperties = dark ? { ...pattern, backgroundColor: p.colors.primary, color: 'var(--t-on-primary)' } : pattern;
  const ornamentColor = dark ? 'text-[var(--t-accent)]' : 'text-[var(--t-secondary)]';

  const scene = SCENE_TYPE[p.instance.variant];
  if (scene) {
    // Scenes carry the names alone; the noir medallion holds the cover photo.
    const art = sceneArt(p.instance.variant as SceneName, p.colors, { monogram: initials(title), photo: image });
    return (
      <SceneHero art={art} colors={p.colors} thumbnail={p.mode === 'thumbnail'}>
        <HeroText {...common} dark={DARK_SCENES.has(p.instance.variant)} names={scene} />
      </SceneHero>
    );
  }
  const key = p.instance.variant === 'artwork' ? v('artwork') : undefined;
  const artwork = key ? p.artworks?.[key] : undefined;
  if (artwork) {
    // Painted art: thumbnails load the lighter rendition.
    const art = artworkArt(artwork, p.colors, { ctx: p.ctx, width: p.mode === 'thumbnail' ? 1200 : 2400 });
    const style = v('nameStyle');
    return (
      <SceneHero art={art} colors={p.colors} thumbnail={p.mode === 'thumbnail'}>
        <HeroText {...common} dark={artwork.dark} names={style === 'caps' || style === 'italic' ? style : 'script'} />
      </SceneHero>
    );
  }

  switch (p.instance.variant) {
    case 'arch':
      return (
        <header className="relative overflow-hidden px-6 pt-12 pb-16 text-center" style={surface}>
          <Mandala className={cx('pointer-events-none absolute -top-24 left-1/2 w-[420px] -translate-x-1/2', ornamentColor, dark ? 'opacity-[0.18]' : 'opacity-[0.13]')} />
          <div className="relative mx-auto w-full max-w-sm">
            <ArchFrame className={cx('absolute inset-0 h-full w-full', ornamentColor)} />
            <div className="relative flex min-h-[460px] flex-col items-center justify-center px-10 pt-20 pb-10">
              <HeroText {...common} />
            </div>
          </div>
        </header>
      );
    case 'split':
      return (
        <header className="relative overflow-hidden px-6 py-12" style={surface}>
          <div className="mx-auto grid max-w-4xl items-center gap-10 sm:grid-cols-2">
            <div className="mx-auto w-64 overflow-hidden rounded-t-full border-4 border-[var(--t-secondary)] bg-[var(--t-surface)] shadow-xl sm:w-full">
              {image ? (
                <img src={image} alt="" className="aspect-[3/4] w-full object-cover" loading="eager" />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-6xl text-[var(--t-secondary-ink)] [font-family:var(--t-script)]">{initials(title)}</div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <HeroText {...common} align="left" />
            </div>
          </div>
        </header>
      );
    case 'photo':
      return (
        <header className="relative flex min-h-[88vh] items-end overflow-hidden text-center text-white">
          {image ? (
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--t-secondary),var(--t-primary))]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          <div className="relative w-full px-6 pb-16">
            <HeroText {...common} inverse />
          </div>
        </header>
      );
    case 'minimal':
      return (
        <header className="px-6 pt-16 pb-12" style={dark ? surface : undefined}>
          <div className={cx('mx-auto max-w-3xl border-y py-12', dark ? 'border-[var(--t-accent)]/40' : 'border-[var(--t-secondary)]/40')}>
            {common.eyebrow ? <p className={cx('text-xs font-semibold tracking-[0.35em] uppercase', dark ? 'text-[var(--t-accent-on-primary)]' : 'text-[var(--t-secondary-ink)]')}>{common.eyebrow}</p> : null}
            <h1 className="mt-4 text-5xl leading-[1.05] tracking-tight [font-family:var(--t-heading)] sm:text-7xl">{title}</h1>
            {common.subtitle ? <p className={cx('mt-5 max-w-xl text-lg', dark ? 'opacity-80' : 'text-[var(--t-muted-ink)]')}>{common.subtitle}</p> : null}
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm font-medium">
              {common.date ? <span>{common.date}</span> : null}
              {common.place ? <span className={dark ? 'opacity-75' : 'text-[var(--t-muted-ink)]'}>{common.place}</span> : null}
            </div>
          </div>
        </header>
      );
    case 'festive':
      return (
        <header className="relative overflow-hidden px-6 pt-14 pb-16 text-center" style={surface}>
          <Confetti className="pointer-events-none absolute top-2 left-1/2 w-[520px] -translate-x-1/2" />
          <Confetti className="pointer-events-none absolute bottom-0 left-1/2 w-[520px] -translate-x-1/2 rotate-180" />
          <div className="relative mx-auto max-w-lg">
            <div
              className={cx(
                'mx-auto mb-6 flex size-28 items-center justify-center rounded-full text-4xl shadow-lg ring-8 [font-family:var(--t-script)]',
                dark ? 'bg-[var(--t-accent)] text-[var(--t-primary)] ring-[var(--t-secondary)]/40' : 'bg-[var(--t-primary)] text-[var(--t-on-primary)] ring-[var(--t-accent)]/40',
              )}
            >
              {initials(title)}
            </div>
            <HeroText {...common} />
          </div>
        </header>
      );
    case 'temple':
      return (
        <header className="relative overflow-hidden px-6 pt-6 pb-14 text-center" style={dark ? { ...patternStyle('dots', p.colors.accent), backgroundColor: p.colors.primary, color: p.colors.background } : patternStyle('dots', p.colors.secondary)}>
          <TempleBorder className={cx('mx-auto h-8 w-full max-w-md', ornamentColor)} />
          <div className="mx-auto max-w-md py-10">
            <HeroText {...common} />
          </div>
          <TempleBorder className={cx('mx-auto h-8 w-full max-w-md rotate-180', ornamentColor)} />
        </header>
      );
    case 'monogram': {
      const mono = initials(title);
      return (
        <header className="relative overflow-hidden px-6 pt-14 pb-16 text-center" style={surface}>
          <div className="relative mx-auto w-56">
            <Laurel className={cx('absolute -inset-x-10 top-10 w-[calc(100%+5rem)]', ornamentColor, 'opacity-80')} />
            <CrestFrame className={cx('relative w-full', ornamentColor)} />
            <span
              className={cx(
                'absolute inset-x-0 top-[34%] text-center text-6xl tracking-wide [font-family:var(--t-heading)]',
                dark ? 'text-[var(--t-accent-on-primary)]' : 'text-[var(--t-primary-ink)]',
              )}
            >
              {mono.split('').join(' ')}
            </span>
          </div>
          <div className="relative mx-auto mt-8 max-w-lg">
            <HeroText {...common} />
          </div>
        </header>
      );
    }
    case 'cathedral':
      return (
        <header className="relative overflow-hidden px-6 pt-10 pb-16 text-center" style={surface}>
          <div className="relative mx-auto w-full max-w-sm">
            <GothicArch className={cx('absolute inset-0 h-full w-full', ornamentColor)} />
            <div className="relative flex min-h-[500px] flex-col items-center px-10 pt-10 pb-10">
              <RoseWindow className={cx('mb-6 w-28', ornamentColor, 'bulava-spin-slow')} />
              <HeroText {...common} />
            </div>
          </div>
        </header>
      );
    case 'seaside':
      return (
        <header
          className="relative flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-6 pt-16 pb-40 text-center"
          style={{ background: `linear-gradient(180deg, ${p.colors.surface} 0%, ${p.colors.background} 55%, ${p.colors.accent} 100%)` }}
        >
          <div className="pointer-events-none absolute top-[22%] left-1/2 size-48 -translate-x-1/2 rounded-full opacity-60 blur-[1px]" style={{ background: `radial-gradient(circle, ${p.colors.accent}, transparent 70%)` }} />
          <div className="relative mx-auto max-w-lg">
            <HeroText {...common} />
          </div>
          <SeaWaves className="bulava-drift pointer-events-none absolute inset-x-0 bottom-0 h-36 w-[120%]" />
        </header>
      );
    case 'celestial':
      return (
        <header
          className="relative flex min-h-[82vh] items-center justify-center overflow-hidden px-6 py-16 text-center"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${p.colors.secondary}55, transparent 60%), linear-gradient(180deg, ${p.colors.primary} 0%, #05060f 100%)`, color: p.colors.background }}
        >
          <StarField
            className="pointer-events-none absolute inset-0 h-full w-full text-[var(--t-accent)] opacity-80"
            count={40}
            style={{ maskImage: 'radial-gradient(ellipse 42% 36% at 50% 50%, transparent 55%, black 85%)', WebkitMaskImage: 'radial-gradient(ellipse 42% 36% at 50% 50%, transparent 55%, black 85%)' }}
          />
          <Crescent className="pointer-events-none absolute top-10 right-10 w-16 text-[var(--t-accent)] opacity-90" />
          <div className="relative mx-auto max-w-lg">
            <HeroText {...common} dark />
          </div>
        </header>
      );
    case 'lantern':
      return (
        <header
          className="relative overflow-hidden px-6 pt-4 pb-16 text-center"
          style={{ background: `linear-gradient(180deg, #070a1a 0%, ${p.colors.primary} 100%)`, color: p.colors.background }}
        >
          <div className="pointer-events-none flex justify-center gap-6 text-[var(--t-secondary)]" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <Lantern key={i} className="bulava-sway w-10 sm:w-12" style={{ marginTop: `${[0, 36, 10, 48, 4][i]}px`, animationDelay: `${i * 0.35}s` }} />
            ))}
          </div>
          <div className="relative mx-auto mt-6 max-w-lg">
            <HeroText {...common} dark />
          </div>
        </header>
      );
    case 'peacock':
      return (
        <header className="relative overflow-hidden px-6 pt-14 pb-16 text-center" style={surface}>
          {/* Feathers lean outward from the corners so they frame, never cross, the text. */}
          <PeacockFeather className="bulava-sway pointer-events-none absolute -top-4 -left-6 h-64 -rotate-[32deg] text-[var(--t-secondary)] opacity-70 sm:left-6 sm:h-80" />
          <PeacockFeather
            className="bulava-sway pointer-events-none absolute -top-4 -right-6 h-64 -scale-x-100 rotate-[32deg] text-[var(--t-secondary)] opacity-70 sm:right-6 sm:h-80"
            style={{ animationDelay: '1.2s' }}
          />
          <div className="relative mx-auto max-w-lg pt-28">
            <HeroText {...common} />
          </div>
        </header>
      );
    default:
      return (
        <header className="relative overflow-hidden px-6 pt-16 pb-16 text-center" style={surface}>
          {p.ornament === 'floral' ? (
            <>
              <FloralCorner className={cx('pointer-events-none absolute top-0 left-0 w-40 opacity-70', ornamentColor)} />
              <FloralCorner className={cx('pointer-events-none absolute top-0 right-0 w-40 -scale-x-100 opacity-70', ornamentColor)} />
            </>
          ) : (
            <Ornament
              name={p.ornament}
              className={cx('pointer-events-none absolute top-1/2 left-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2', ornamentColor, dark ? 'opacity-[0.2]' : 'opacity-[0.12]')}
            />
          )}
          <div className="relative mx-auto max-w-lg">
            <HeroText {...common} />
          </div>
        </header>
      );
  }
}

function HeroText({
  title,
  greeting,
  invocation,
  eyebrow,
  subtitle,
  date,
  place,
  tagline,
  inverse,
  dark,
  align = 'center',
  names: namesStyle = 'script',
  portrait,
}: {
  title: string;
  greeting?: string;
  invocation?: string;
  eyebrow?: string;
  subtitle?: string;
  date?: string;
  place?: string;
  tagline?: string;
  inverse?: boolean;
  dark?: boolean;
  align?: 'center' | 'left';
  /** script (default), caps (grand spaced capitals) or italic (editorial serif). */
  names?: 'script' | 'caps' | 'italic';
  /** Cover photo shown as a portrait above the names (scenes). */
  portrait?: string;
}) {
  const onColor = inverse || dark;
  // Text on a dark hero sits on the primary colour; on a light hero, on the page background.
  const accent = inverse ? 'text-[var(--t-accent)]' : dark ? 'text-[var(--t-accent-on-primary)]' : 'text-[var(--t-secondary-ink)]';
  const names = inverse ? 'text-white' : dark ? 'text-[var(--t-accent-on-primary)]' : 'text-[var(--t-primary-ink)]';
  return (
    <div className={cx('flex flex-col', align === 'left' ? 'items-center sm:items-start' : 'items-center', dark && !inverse && 'text-[var(--t-on-primary)]')}>
      {portrait ? (
        <div className="mb-5 size-24 overflow-hidden rounded-full border-[3px] border-[var(--t-accent)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] sm:size-28">
          <img src={portrait} alt="" className="h-full w-full object-cover" loading="eager" />
        </div>
      ) : null}
      {invocation ? <p className={cx('mb-4 text-sm', accent)}>{invocation}</p> : null}
      {greeting ? <p className={cx('mb-3 text-lg italic [font-family:var(--t-heading)]', onColor ? 'opacity-90' : 'text-[var(--t-muted-ink)]')}>{greeting}</p> : null}
      {eyebrow ? <p className={cx('mb-4 text-[0.7rem] font-semibold tracking-[0.35em] uppercase', accent)}>{eyebrow}</p> : null}
      <h1
        className={cx(
          names,
          namesStyle === 'caps'
            ? 'text-4xl leading-[1.1] tracking-[0.12em] uppercase [font-family:var(--t-heading)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.12)] sm:text-6xl'
            : namesStyle === 'italic'
              ? 'text-5xl leading-[1.05] italic [font-family:var(--t-heading)] sm:text-7xl'
              : 'text-5xl leading-[1.05] [font-family:var(--t-script)] sm:text-6xl',
        )}
      >
        <Names text={title} className={align === 'left' ? 'sm:items-start' : undefined} ampersandClassName={dark ? 'text-[var(--t-on-primary)] normal-case tracking-normal' : 'normal-case tracking-normal'} />
      </h1>
      {subtitle ? <p className={cx('mt-5 max-w-sm text-base', onColor ? 'opacity-85' : 'text-[var(--t-muted-ink)]')}>{subtitle}</p> : null}
      {date ? (
        <p className={cx('mt-6 border-y py-2 text-lg tracking-wide [font-family:var(--t-heading)]', inverse ? 'border-white/40' : dark ? 'border-[var(--t-accent)]/50' : 'border-[var(--t-secondary)]/50')}>
          {date}
        </p>
      ) : null}
      {place ? <p className={cx('mt-2 text-sm tracking-[0.2em] uppercase', onColor ? 'opacity-80' : 'text-[var(--t-muted-ink)]')}>{place}</p> : null}
      {tagline ? <p className={cx('mt-5 text-2xl [font-family:var(--t-script)]', accent)}>{tagline}</p> : null}
    </div>
  );
}
