import type { ComponentType } from 'react';
import { createTranslator, formatEventDateWithWeekday, getLanguage } from '@bulava/localization';
import {
  effectiveColors,
  effectiveFonts,
  effectiveMotion,
  hiddenSectionIds,
  resolveBinding,
  resolveValue,
  type Customization,
  type RenderContext,
  type SectionInstance,
  type SectionKey,
  type TemplateDefinition,
} from '@bulava/template-schema';
import { DepthScene } from './depth';
import { Effects } from './effects';
import { IntroOverlay } from './intro';
import { MusicPlayer } from './music';
import { RevealOnScroll } from './reveal';
import type { OrnamentName } from './ornaments';
import { Couple, Family, Story, InfoBlock, Announcements } from './sections/content';
import { Hero } from './sections/hero';
import { Countdown, Footer, Gallery, PhotoShare, Rsvp } from './sections/misc';
import { EventTimeline, Venue } from './sections/schedule';
import { Menu, Quote } from './sections/signature';
import { initials } from './sections/shared';
import { themeStyle } from './theme';
import type { RenderMode, RenderSlots, SectionProps } from './types';

const REGISTRY: Record<SectionKey, ComponentType<SectionProps>> = {
  hero: Hero,
  couple: Couple,
  parents: Family,
  family: Family,
  story: Story,
  countdown: Countdown,
  eventTimeline: EventTimeline,
  gallery: Gallery,
  venue: Venue,
  map: Venue,
  rsvp: Rsvp,
  accommodation: (p) => <InfoBlock {...p} defaultHeading={p.t('template.accommodation.title')} icon="🏨" />,
  travel: (p) => <InfoBlock {...p} defaultHeading={p.t('template.travel.title')} icon="🚗" />,
  giftRegistry: (p) => <InfoBlock {...p} defaultHeading={p.t('template.gift.title')} icon="🎁" />,
  announcements: Announcements,
  photoShare: PhotoShare,
  menu: Menu,
  quote: Quote,
  footer: Footer,
};

/**
 * Reveal-on-scroll (only after RevealOnScroll adds `reveal-ready` on live pages)
 * and the Signature collection's motion. All motion stops for reduced-motion users.
 */
const STYLES = `
.bulava-template.reveal-ready .bulava-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
.bulava-template.reveal-ready .bulava-reveal.is-visible { opacity: 1; transform: none; }
@keyframes bulava-twinkle { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes bulava-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes bulava-drift { from { transform: translateX(0); } to { transform: translateX(-16%); } }
@keyframes bulava-spin { to { transform: rotate(360deg); } }
@keyframes bulava-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes bulava-rise { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(-120vh) scale(0.7); opacity: 0; } }
@keyframes bulava-fall { from { transform: translateY(-5vh) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } to { transform: translateY(110vh) rotate(540deg); opacity: 0.2; } }
@keyframes bulava-eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
@keyframes bulava-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.bulava-twinkle { animation: bulava-twinkle 3s ease-in-out infinite; }
.bulava-sway { transform-origin: top center; animation: bulava-sway 5s ease-in-out infinite; }
.bulava-drift { animation: bulava-drift 14s ease-in-out infinite alternate; }
.bulava-spin-slow { animation: bulava-spin 80s linear infinite; }
.bulava-bob { animation: bulava-bob 4s ease-in-out infinite; }
.bulava-rise { animation: bulava-rise 2s ease-in forwards; }
.bulava-fall { animation: bulava-fall 2s linear forwards; }
.bulava-eq { height: 30%; animation: bulava-eq 0.9s ease-in-out infinite; }
/* Invitation prompts ("Tap to open") breathe instead of fading, so the text stays readable. */
.bulava-breathe { display: inline-block; animation: bulava-breathe 2.4s ease-in-out infinite; }
/* Bands: whole sections on the primary or accent colour, with inks computed for that colour (see themeStyle). */
.bulava-band-primary { background-color: var(--t-primary); color: var(--bp-text); --t-text: var(--bp-text); --t-muted-ink: var(--bp-muted); --t-primary-ink: var(--bp-primary-ink); --t-secondary-ink: var(--bp-secondary-ink); --t-accent-ink: var(--bp-accent-ink); --t-heading-ink: var(--bp-accent-ink); --t-card: rgb(255 255 255 / 0.08); --t-card-alt: rgb(255 255 255 / 0.12); --t-line: color-mix(in srgb, var(--t-accent) 45%, transparent); --t-button: var(--bp-button); --t-on-button: var(--bp-on-button); }
.bulava-band-accent { background-color: var(--t-accent); color: var(--ba-text); --t-text: var(--ba-text); --t-muted-ink: var(--ba-muted); --t-primary-ink: var(--ba-primary-ink); --t-secondary-ink: var(--ba-secondary-ink); --t-accent-ink: var(--ba-accent-ink); --t-heading-ink: var(--ba-accent-ink); --t-card: rgb(255 255 255 / 0.1); --t-card-alt: rgb(255 255 255 / 0.16); --t-line: color-mix(in srgb, var(--t-primary) 35%, transparent); --t-button: var(--ba-button); --t-on-button: var(--ba-on-button); }
@keyframes bulava-flicker { 0%, 100% { transform: scale(1, 1) skewX(0deg); } 25% { transform: scale(0.94, 1.06) skewX(-2deg); } 50% { transform: scale(1.04, 0.96) skewX(2deg); } 75% { transform: scale(0.97, 1.03) skewX(-1deg); } }
@keyframes bulava-glow { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
@keyframes bulava-float-up { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(-110vh) translateX(40px); opacity: 0; } }
@keyframes bulava-sway-soft { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
@keyframes bulava-orb { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -24px) scale(1.12); } }
@keyframes bulava-medallion { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
@keyframes bulava-flip-leaf { from { transform: rotateX(0deg); } to { transform: rotateX(-180deg); } }
.bulava-flicker { animation: bulava-flicker 1.6s ease-in-out infinite; transform-box: fill-box; }
.bulava-glow { animation: bulava-glow 2.8s ease-in-out infinite; }
.bulava-float-up { animation: bulava-float-up 14s linear infinite; }
.bulava-sway-soft { transform-origin: top center; animation: bulava-sway-soft 6s ease-in-out infinite; }
.bulava-orb { animation: bulava-orb 16s ease-in-out infinite; }
.bulava-medallion { animation: bulava-medallion 14s linear infinite; }
.bulava-vinyl { position: relative; animation: bulava-spin 3.5s linear infinite; }
.bulava-flip { transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1); }
.bulava-flip-leaf { animation: bulava-flip-leaf 0.6s ease-in forwards; }
.bulava-curtain { transition: transform 1.3s cubic-bezier(0.6, 0, 0.2, 1); }
.bulava-3d-card { transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.4s ease; }
.bulava-tilt { transition: transform 0.4s ease; }
@media (hover: hover) { .bulava-tilt:hover { transform: perspective(700px) rotateX(4deg) rotateY(-6deg) scale(1.03); } }
@media (prefers-reduced-motion: reduce) {
  .bulava-twinkle, .bulava-sway, .bulava-drift, .bulava-spin-slow, .bulava-bob, .bulava-eq, .bulava-breathe,
  .bulava-flicker, .bulava-glow, .bulava-float-up, .bulava-sway-soft, .bulava-orb, .bulava-medallion, .bulava-vinyl, .bulava-flip-leaf { animation: none; }
  .bulava-flip, .bulava-curtain, .bulava-3d-card, .bulava-tilt { transition: none; }
  .bulava-float-up { display: none; }
}
`;

/**
 * Animation styles for templates. Rendered by full previews; pages showing
 * many thumbnails render it once (React hoists and de-duplicates it).
 */
export function TemplateStyles() {
  return (
    <style href="bulava-template-styles" precedence="bulava">
      {STYLES}
    </style>
  );
}

function isVisible(instance: SectionInstance, ctx: RenderContext): boolean {
  const cond = instance.visibleWhen;
  if (!cond) return true;
  if (cond.eventTypes && !cond.eventTypes.includes(ctx.event.typeKey)) return false;
  if (cond.exists) {
    const v = resolveBinding(cond.exists, ctx);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false;
  }
  return true;
}

export interface TemplateRendererProps {
  definition: TemplateDefinition;
  context: RenderContext;
  customization?: Customization | null;
  language?: string;
  slots?: RenderSlots;
  mode?: RenderMode;
  /** Scope for the intro "already opened" flag. */
  introKey?: string;
  /** Limit the number of sections (thumbnails). */
  maxSections?: number;
}

/** Renders a WEBSITE template definition for a given render context. */
export function TemplateRenderer({
  definition,
  context,
  customization,
  language: languageOverride,
  slots = {},
  mode = 'live',
  introKey,
  maxSections,
}: TemplateRendererProps) {
  const language = languageOverride ?? context.event.language;
  const t = createTranslator(language);
  const timeZone = context.event.timezone;
  const ctx: RenderContext = customization?.custom ? { ...context, custom: { ...context.custom, ...customization.custom } } : context;
  const colors = effectiveColors(definition, customization);
  const fonts = effectiveFonts(definition, customization);
  const { intro, effect } = effectiveMotion(definition, customization);
  const hidden = hiddenSectionIds(definition, customization);
  const ornament = definition.theme.ornament as OrnamentName;
  const look = definition.theme.look ?? 'classic';
  const opts = { t, language, timeZone };
  const sections = (definition.website?.pages[0]?.sections ?? []).filter((s) => isVisible(s, ctx) && !hidden.has(s.id));
  const shown = maxSections ? sections.slice(0, maxSections) : sections;
  const rootId = `bulava-t-${(introKey ?? definition.templateKey).replace(/[^A-Za-z0-9_-]/g, '')}`;

  return (
    <div
      id={rootId}
      lang={language}
      dir={getLanguage(language).direction}
      className={`bulava-template bulava-look-${look} relative min-h-full antialiased`}
      style={themeStyle(definition.theme, colors, fonts)}
    >
      {mode === 'thumbnail' ? null : <TemplateStyles />}
      {mode === 'live' ? <RevealOnScroll rootId={rootId} /> : null}
      {mode === 'thumbnail' ? null : <DepthScene rootId={rootId} />}
      {mode === 'thumbnail' || effect === 'none' ? null : <Effects effect={effect} colors={colors} contained={mode === 'preview'} />}
      {mode === 'live' && intro !== 'none' ? (
        <IntroOverlay
          variant={intro}
          monogram={initials(ctx.couple ? `${ctx.couple.partnerOne} & ${ctx.couple.partnerTwo}` : (ctx.honoree?.name ?? ctx.event.title))}
          labels={{
            open: t('template.openInvite'),
            lanterns: t('template.intro.lanterns'),
            seal: t('template.intro.seal'),
            scratch: t('template.intro.scratch'),
            reveal: t('template.intro.reveal'),
          }}
          revealText={ctx.event.startDate ? formatEventDateWithWeekday(ctx.event.startDate, { language, timeZone }) : undefined}
          storageKey={`bulava-intro:${introKey ?? definition.templateKey}`}
        />
      ) : null}
      {mode === 'live' && ctx.music?.url ? (
        <MusicPlayer url={ctx.music.url} title={ctx.music.title} vinyl={look === 'noir'} labels={{ play: t('template.music.play'), pause: t('template.music.pause') }} />
      ) : null}
      {shown.map((instance, index) => {
        const Component = REGISTRY[instance.section];
        const value = (key: string) => {
          const v = resolveValue(instance.props[key], ctx, opts);
          return v === undefined || v === '' ? undefined : String(v);
        };
        return (
          <Component
            key={instance.id}
            instance={instance}
            ctx={ctx}
            value={value}
            t={t}
            language={language}
            timeZone={timeZone}
            ornament={ornament}
            pattern={definition.theme.pattern}
            colors={colors}
            heroTone={definition.theme.heroTone ?? 'light'}
            look={look}
            index={index}
            slots={slots}
            mode={mode}
            artworks={definition.artworks}
          />
        );
      })}
    </div>
  );
}

/**
 * Static phone-sized preview (first sections only), scaled to `width`.
 * Server-renderable; used on the homepage, template gallery and dashboard.
 */
export function TemplateThumbnail({
  definition,
  context,
  customization,
  width = 260,
  height = 460,
  sections = 3,
}: {
  definition: TemplateDefinition;
  context: RenderContext;
  customization?: Customization | null;
  width?: number;
  height?: number;
  sections?: number;
}) {
  const base = 390;
  const scale = width / base;
  return (
    <div className="relative overflow-hidden" style={{ width, height }} aria-hidden="true">
      <div style={{ width: base, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="pointer-events-none">
        <TemplateRenderer definition={definition} context={context} customization={customization} mode="thumbnail" maxSections={sections} />
      </div>
    </div>
  );
}
