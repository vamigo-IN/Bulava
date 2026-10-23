import { Fragment, type ComponentType, type ReactNode } from 'react';
import { createTranslator, formatEventDateWithWeekday, getLanguage, type Translator } from '@bulava/localization';
import {
  canRedraw,
  effectiveColors,
  effectiveFonts,
  effectiveMotion,
  heroStage,
  hiddenSectionIds,
  isStageIntro,
  resolveBinding,
  resolveValue,
  STAGE_META,
  withCanvasCustomization,
  type Customization,
  type RenderContext,
  type SectionInstance,
  type SectionKey,
  type StageIntro,
  type StageNameValue,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { DepthScene } from './depth';
import { Effects } from './effects';
import { IntroOverlay } from './intro';
import { BelowHeroMotion } from './motion-below';
import { MusicPlayer } from './music';
import { RevealOnScroll } from './reveal';
import { COVER_LAYOUT, coverMotion, enterOf } from './stage/covers3d';
import { COVER_BOXES } from './stage/kit/covers';
import type { StageOpeningPlan } from './stage/opening';
import { StageRig } from './stage/rig';
import { stageSet } from './stage/sets';
import type { OrnamentName } from './ornaments';
import { Couple, Family, Story, InfoBlock, Announcements } from './sections/content';
import { Essentials } from './sections/essentials';
import { Invitation } from './sections/invitation';
import { calendarUrl } from './canvas/links';
import { PageNav, type PageNavLink } from './nav';
import { SharedArt, sharedArtOf } from './sections/decor';
import { VISTA_PEACOCK } from './sections/vista';
import { Hero } from './sections/hero';
import { Countdown, Footer, Gallery, PhotoShare, Rsvp } from './sections/misc';
import { EventTimeline, Venue } from './sections/schedule';
import { Menu, Quote } from './sections/signature';
import { coverMonogram } from './covers';
import { initials } from './sections/shared';
import { CanvasSection } from './canvas/section';
import { themeStyle } from './theme';
import { TemplateStyles } from './styles';
import { WatermarkVeil } from './veil';
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
  invitation: Invitation,
  essentials: Essentials,
  footer: Footer,
  canvas: CanvasSection,
};

/**
 * The page menu's links (website.nav "bar"): one per kind of section the page shows and draws (the same
 * tests as each section's own: a story with words, functions, a venue, photos, the stay strip's travel and
 * gifts columns, the reply section where it shows), in page order, Home first.
 */
function navLinksOf(sections: SectionInstance[], props: (instance: SectionInstance, index: number) => SectionProps, rootId: string, t: Translator): PageNavLink[] {
  const links: PageNavLink[] = [];
  const seen = new Set<string>();
  const add = (kind: string, href: string, label: string) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    links.push({ href, label });
  };
  sections.forEach((instance, index) => {
    const p = props(instance, index);
    const at = `#${instance.id}`;
    switch (instance.section) {
      case 'hero':
        if (index === 0) add('home', `#${rootId}`, t('template.nav.home'));
        break;
      case 'story':
        if (p.value('text')) add('story', at, t('template.nav.story'));
        break;
      case 'eventTimeline':
        if (p.ctx.functions.length) add('functions', at, t('template.nav.functions'));
        break;
      case 'venue':
      case 'map':
        if (p.ctx.venue) add('venue', at, t('template.nav.venue'));
        break;
      case 'gallery':
        if (p.ctx.gallery.images.length || p.ctx.photos.length) add('gallery', at, t('template.nav.gallery'));
        break;
      case 'essentials':
        if (p.value('travel')) add('travel', `${at}-travel`, t('template.nav.travel'));
        if (p.value('gifts')) add('gifts', `${at}-gifts`, t('template.nav.gifts'));
        break;
      case 'travel':
        if (p.value('text')) add('travel', at, t('template.nav.travel'));
        break;
      case 'giftRegistry':
        if (p.value('text')) add('gifts', at, t('template.nav.gifts'));
        break;
      case 'rsvp':
        if (p.mode !== 'live' || p.slots.rsvp) add('rsvp', at, t('template.nav.rsvp'));
        break;
      default:
        break;
    }
  });
  return links;
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
  /** Wraps each section as it is drawn: the website's canvas editor puts its tools around the page's parts (ADR-065). */
  wrapSection?: (instance: SectionInstance, node: ReactNode, index: number) => ReactNode;
  /**
   * Kinds of section left out of the page: RSVP when the host takes no replies, the gallery and photo
   * sharing when the plan has no gallery (ADR-067, ADR-068). Canvas buttons that lead to them go too.
   */
  without?: readonly SectionKey[];
}

interface PageOptions {
  definition: TemplateDefinition;
  context: RenderContext;
  customization?: Customization | null;
  language?: string;
  slots?: RenderSlots;
  mode?: RenderMode;
  without?: readonly SectionKey[];
}

/** What each section of a page is drawn with: the template with the host's choices, and the event's data. */
function pageOf({ definition: template, context, customization, language: languageOverride, slots = {}, mode = 'live', without = [] }: PageOptions) {
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
  const sections = (definition.website?.pages[0]?.sections ?? []).filter((s) => isVisible(s, ctx) && !hidden.has(s.id) && !without.includes(s.section));
  const rsvpSectionId = sections.find((s) => s.section === 'rsvp')?.id;
  // The page's opening and effect: a stage hero draws the effect at depth and its opening's cover (ADR-078).
  const motion = effectiveMotion(definition, customization);
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
    ...(definition.theme.dress ? { dress: definition.theme.dress } : {}),
    ...(definition.theme.faith ? { faith: definition.theme.faith } : {}),
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
    nextSectionId: sections[index + 1]?.id,
    motion,
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
  return { definition, language, t, timeZone, ctx, colors, fonts, look, sections, sectionProps, drawSection, motion };
}

/**
 * The stage a page opens on (ADR-078): its first section's stage hero, or the template's stage hero drawn behind
 * a host's redrawn first section (a `section` layer on the stand-in's board). Null: no stage to open on, so a stage
 * opening plays its 2D twin and the effect is drawn flat.
 */
function openingStage(first: SectionInstance | undefined, template: TemplateDefinition): StageNameValue | null {
  const direct = heroStage(first);
  if (direct || first?.section !== 'canvas') return direct;
  const own = template.website?.pages[0]?.sections[0];
  const stage = heroStage(own);
  if (!stage || !own) return null;
  const boards = [first.canvas?.mobile, first.canvas?.desktop];
  return boards.some((board) => board?.layers.some((layer) => layer.kind === 'section' && layer.section === own.id && !layer.hidden)) ? stage : null;
}

/**
 * What a stage opening needs of its set on the client, as plain data (final.md §3.2): the set's darkness, its
 * cover's hinge lines (its leaves stopping at the set's walls), its key light, how wide the cover stands (wide
 * screens start close enough to fill), and the walls and ceilings that wait off the picture while their ends are on
 * screen. Set art never reaches the client this way.
 */
function stageOpeningPlan(name: StageNameValue, intro: StageIntro, colors: ThemeColors, monogram: string): StageOpeningPlan {
  const set = stageSet(name, { colors, monogram, detail: 'full' });
  const fit =
    intro === 'arrival'
      ? { half: COVER_BOXES.gate.frame.w / 2, z: COVER_LAYOUT.arrival.z + 2 }
      : intro === 'doorway'
        ? { half: COVER_BOXES.door.frame.w / 2, z: COVER_LAYOUT.doorway.z + 2 }
        : undefined;
  const enter = enterOf(set);
  return { dark: STAGE_META[name].dark, motion: coverMotion(intro, set), light: set.light.color, ...(fit ? { fit } : {}), ...(enter.edges.length ? { enter } : {}) };
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
export function TemplateRenderer({ definition: template, context, customization, language: languageOverride, slots = {}, mode = 'live', introKey, maxSections, wrapSection, without }: TemplateRendererProps) {
  const { definition, language, t, timeZone, ctx, colors, fonts, look, sections, sectionProps, motion } = pageOf({ definition: template, context, customization, language: languageOverride, slots, mode, without });
  const { intro, effect } = motion;
  const shown = maxSections ? sections.slice(0, maxSections) : sections;
  const rootId = `bulava-t-${(introKey ?? definition.templateKey).replace(/[^A-Za-z0-9_-]/g, '')}`;
  const monogram = initials(ctx.couple ? `${ctx.couple.partnerOne} & ${ctx.couple.partnerTwo}` : (ctx.honoree?.name ?? ctx.event.title));
  const sealMonogram = coverMonogram(ctx.couple, monogram);
  // The page opens on a stage (ADR-078): its own stage hero, or the template's drawn behind the host's redrawn one.
  const stage = openingStage(shown[0], template);
  const stagePlan = mode === 'live' && stage && isStageIntro(intro) ? stageOpeningPlan(stage, intro, colors, sealMonogram) : null;
  const stageMotion = definition.theme.motion === 'stage';
  // Drawings that recur down the page (roses, peacocks) are defined once and placed with <use>.
  const shared = sharedArtOf(shown, colors, shown.some((s) => s.section === 'footer' && s.variant === 'vista') ? [VISTA_PEACOCK] : []);
  const artRefs: Record<string, string> = Object.fromEntries([...shared.keys()].map((key, i) => [key, `${rootId}-art${i}`]));

  return (
    <div
      id={rootId}
      lang={language}
      dir={getLanguage(language).direction}
      data-script={getLanguage(language).script}
      className={`bulava-template bulava-look-${look}${stageMotion ? ' bulava-motion-stage' : ''} relative min-h-full antialiased`}
      style={themeStyle(definition.theme, colors, fonts)}
    >
      {mode === 'thumbnail' ? null : <TemplateStyles />}
      {mode === 'live' ? <RevealOnScroll rootId={rootId} /> : null}
      {mode === 'live' && stageMotion ? <BelowHeroMotion rootId={rootId} /> : null}
      {mode === 'thumbnail' ? null : <DepthScene rootId={rootId} />}
      {/* A stage hero draws the effect itself, at depth in its set: no flat particles over it. */}
      {mode === 'thumbnail' || effect === 'none' || stage ? null : <Effects effect={effect} colors={colors} contained={mode === 'preview'} />}
      {mode === 'live' && intro !== 'none' ? (
        <IntroOverlay
          variant={intro}
          monogram={monogram}
          labels={{
            open: t('template.openInvite'),
            lanterns: t('template.intro.lanterns'),
            seal: t('template.intro.seal'),
            scratch: t('template.intro.scratch'),
            reveal: t('template.intro.reveal'),
            zipper: t('template.intro.zipper'),
            ribbon: t('template.intro.ribbon'),
            arrival: t('template.intro.arrival'),
            doorway: t('template.intro.doorway'),
            silk: t('template.intro.silk'),
            unfold: t('template.intro.unfold'),
          }}
          revealText={ctx.event.startDate ? formatEventDateWithWeekday(ctx.event.startDate, { language, timeZone }) : undefined}
          storageKey={`bulava-intro:${introKey ?? definition.templateKey}`}
          colors={colors}
          coverMonogram={sealMonogram}
          rootId={rootId}
          stage={stagePlan}
          frame={definition.theme.dress?.frame}
        />
      ) : null}
      {/* The camera rig runs on any stage the page shows (a stage hero further down, too). */}
      {mode !== 'thumbnail' && (stage || shown.some((s) => heroStage(s))) ? <StageRig rootId={rootId} /> : null}
      {mode === 'live' && ctx.music?.url ? (
        <MusicPlayer url={ctx.music.url} title={ctx.music.title} vinyl={look === 'noir'} round={look === 'deckle'} labels={{ play: t('template.music.play'), pause: t('template.music.pause') }} />
      ) : null}
      {slots.veil ? <WatermarkVeil text={slots.veil} /> : null}
      <SharedArt art={shared} ids={artRefs} colors={colors} />
      {/* The sections answer to the page's width (container queries), not the window's: a phone-wide frame shows the phone's layout. */}
      <div style={{ containerType: 'inline-size' }}>
        {definition.website?.nav === 'bar' ? (
          <PageNav
            links={navLinksOf(shown, sectionProps, rootId, t)}
            monogram={ctx.couple ? [ctx.couple.partnerOne.trim().charAt(0).toUpperCase(), ctx.couple.partnerTwo.trim().charAt(0).toUpperCase()] : monogram}
            save={(() => {
              const href = calendarUrl(ctx);
              return href ? { href, label: t('template.saveTheDate') } : null;
            })()}
            labels={{ nav: t('template.nav.label'), open: t('template.nav.open'), close: t('template.nav.close') }}
            heroId={shown[0]?.id}
            interactive={mode === 'live'}
          />
        ) : null}
        {shown.map((instance, index) => {
          const Component = REGISTRY[instance.section];
          const node = <Component key={instance.id} {...sectionProps(instance, index)} artRefs={artRefs} />;
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
