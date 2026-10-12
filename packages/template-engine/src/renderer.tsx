import { Fragment, type ComponentType, type ReactNode } from 'react';
import { createTranslator, formatEventDateWithWeekday, getLanguage } from '@bulava/localization';
import {
  canRedraw,
  effectiveColors,
  effectiveFonts,
  effectiveMotion,
  hiddenSectionIds,
  resolveBinding,
  resolveValue,
  withCanvasCustomization,
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
import { CanvasSection } from './canvas/section';
import { themeStyle } from './theme';
import { TemplateStyles } from './styles';
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
  canvas: CanvasSection,
};

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
  /** Wraps each section as it is drawn: the website's canvas editor puts its tools around the page's parts (ADR-065). */
  wrapSection?: (instance: SectionInstance, node: ReactNode, index: number) => ReactNode;
}

interface PageOptions {
  definition: TemplateDefinition;
  context: RenderContext;
  customization?: Customization | null;
  language?: string;
  slots?: RenderSlots;
  mode?: RenderMode;
}

/** What each section of a page is drawn with: the template with the host's choices, and the event's data. */
function pageOf({ definition: template, context, customization, language: languageOverride, slots = {}, mode = 'live' }: PageOptions) {
  // The host's own arrangement of the canvas sections, where it still fits the template (ADR-057), the sections they added (ADR-059) and their order (ADR-065).
  const definition = withCanvasCustomization(template, customization?.canvas, customization?.addedSections, customization?.sectionOrder);
  const language = languageOverride ?? context.event.language;
  const t = createTranslator(language);
  const timeZone = context.event.timezone;
  const ctx: RenderContext = customization?.custom ? { ...context, custom: { ...context.custom, ...customization.custom } } : context;
  const colors = effectiveColors(definition, customization);
  const fonts = effectiveFonts(definition, customization);
  const ornament = definition.theme.ornament as OrnamentName;
  const look = definition.theme.look ?? 'classic';
  const opts = { t, language, timeZone };
  const hidden = hiddenSectionIds(definition, customization);
  const sections = (definition.website?.pages[0]?.sections ?? []).filter((s) => isVisible(s, ctx) && !hidden.has(s.id));
  const rsvpSectionId = sections.find((s) => s.section === 'rsvp')?.id;
  const sectionProps = (instance: SectionInstance, index: number): SectionProps => ({
    instance,
    ctx,
    value: (key: string) => {
      const v = resolveValue(instance.props[key], ctx, opts);
      return v === undefined || v === '' ? undefined : String(v);
    },
    t,
    language,
    timeZone,
    ornament,
    pattern: definition.theme.pattern,
    colors,
    heroTone: definition.theme.heroTone ?? 'light',
    look,
    index,
    slots,
    mode,
    artworks: definition.artworks,
    fonts,
    rsvpSectionId,
    drawSection,
  });
  // One of the template's own sections behind a host's redrawn one (ADR-065): its pictures only, never a canvas.
  const own = template.website?.pages[0]?.sections ?? [];
  const drawSection = (id: string, index: number): ReactNode => {
    const instance = own.find((s) => s.id === id);
    if (!instance || !canRedraw(instance) || !isVisible(instance, ctx)) return null;
    const Component = REGISTRY[instance.section];
    return <Component {...sectionProps(instance, index)} slots={{}} />;
  };
  return { definition, language, t, timeZone, ctx, colors, fonts, look, sections, sectionProps, drawSection };
}

/**
 * Draws a template's own sections where its page is not drawn (ADR-065): the
 * website's canvas editor draws a redrawn section's backdrop with it, by the
 * section's id and its place on the page.
 */
export function sectionDrawer(options: PageOptions): (sectionId: string, index: number) => ReactNode {
  return pageOf(options).drawSection;
}

/** Renders a WEBSITE template definition for a given render context. */
export function TemplateRenderer({ definition: template, context, customization, language: languageOverride, slots = {}, mode = 'live', introKey, maxSections, wrapSection }: TemplateRendererProps) {
  const { definition, language, t, timeZone, ctx, colors, fonts, look, sections, sectionProps } = pageOf({ definition: template, context, customization, language: languageOverride, slots, mode });
  const { intro, effect } = effectiveMotion(definition, customization);
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
      {/* The sections answer to the page's width (container queries), not the window's: a phone-wide frame shows the phone's layout. */}
      <div style={{ containerType: 'inline-size' }}>
        {shown.map((instance, index) => {
          const Component = REGISTRY[instance.section];
          const node = <Component key={instance.id} {...sectionProps(instance, index)} />;
          return wrapSection ? <Fragment key={instance.id}>{wrapSection(instance, node, index)}</Fragment> : node;
        })}
      </div>
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
