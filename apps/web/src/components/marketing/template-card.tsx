import { Play } from 'lucide-react';
import Link from 'next/link';
import type { Translator } from '@bulava/localization';
import { TiltCard } from '@/components/effects/tilt-card';
// Single modules, not the package entry: importing that would ship every client component
// of the template engine (openings, music, RSVP forms) with every page that shows a card.
import { backdropArt, backdropTitleTop, SceneStill } from '@bulava/template-engine/src/art/scenes';
import { Ornament } from '@bulava/template-engine/src/ornaments';
import { TemplateStyles } from '@bulava/template-engine/src/styles';
import type { TemplateSummary } from '@/lib/server-api';
import { cardPreview, POSTER_HEIGHT, POSTER_WIDTH, posterPreview } from '@/lib/template-previews';
import { LiveThumbnail } from './live-thumbnail';

const BADGE_STYLE = {
  NEW: 'bg-emerald-700 text-white',
  POPULAR: 'bg-gold-600 text-white',
  BESTSELLER: 'bg-brand-700 text-gold-200',
} as const;

const PHONE_FRAME = 'phone-frame transition-all duration-500 hover:shadow-[0_0_40px_rgba(227,197,133,0.2)]';

/**
 * A template's first sections inside a phone frame: the pre-rendered preview
 * image when there is one (lib/template-previews), otherwise a live preview
 * (the template engine then loads on demand). `priority` is for phones visible
 * on arrival.
 */
export function TemplatePhone({
  template,
  width = 220,
  height = 400,
  sections = 2,
  priority = false,
}: {
  template: TemplateSummary;
  width?: number;
  height?: number;
  sections?: number;
  priority?: boolean;
}) {
  if (!template.definition || template.definition.type !== 'WEBSITE') {
    return <VideoPoster template={template} width={width} height={height} priority={priority} />;
  }
  const preview = cardPreview(template.key);
  return (
    <div className={PHONE_FRAME} style={{ width: width + 14, height: height + 14 }}>
      {/* Glass reflection */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[1.8rem] bg-gradient-to-b from-white/8 via-transparent to-transparent" aria-hidden="true" />
      {preview ? (
        <img
          src={preview}
          alt=""
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="block object-cover object-top"
          style={{ width, height }}
        />
      ) : (
        <LiveThumbnail definition={template.definition} eventType={template.eventTypes[0] ?? 'WEDDING'} width={width} height={height} sections={sections} />
      )}
    </div>
  );
}

/** The scene a video or card template opens on (drawn or painted), if it has one. */
function posterScene(template: TemplateSummary) {
  const definition = template.definition;
  const colors = definition?.theme.colors;
  const backdrop = definition?.scenes?.find((s) => s.backdrop)?.backdrop;
  const art = definition && backdrop && colors ? backdropArt(definition, backdrop, colors, { width: 1200 }) : null;
  return art && definition && backdrop && colors ? { art, definition, backdrop, colors } : null;
}

export const hasPosterScene = (template: TemplateSummary) => posterScene(template) !== null;

const posterLabel = (template: TemplateSummary) => (template.outputs.includes('VIDEO') ? '▶ Video' : 'Card');

/**
 * A video or card template's scene with its title, without the phone frame (null when it
 * has no scene). Galleries show it as a pre-rendered image (lib/template-previews), which
 * /preview-frame photographs from this component.
 */
export function PosterScene({ template, width, height }: { template: TemplateSummary; width: number; height: number }) {
  const scene = posterScene(template);
  if (!scene) return null;
  const { art, definition, backdrop, colors: c } = scene;
  return (
    <>
      {/* The scene's motion (twinkling, swaying, floating lanterns); React adds the stylesheet once per page. */}
      <TemplateStyles />
      <SceneStill art={art} width={width} height={height}>
        <div className="absolute inset-x-0 flex flex-col items-center gap-2 px-7 text-center" style={{ color: art.dark ? c.accent : c.primary, top: `${backdropTitleTop(definition, backdrop) * 100}%` }}>
          <span className="text-[10px] font-semibold tracking-[0.35em] uppercase">{posterLabel(template)}</span>
          <span className="font-display text-2xl leading-tight [text-shadow:0_1px_10px_rgba(0,0,0,0.25)]">{template.name}</span>
        </div>
      </SceneStill>
    </>
  );
}

/**
 * Video/card templates: the pre-rendered poster at the gallery card's size, else the film's
 * drawn or painted scene, or a styled poster from the template's theme.
 */
function VideoPoster({ template, width, height, priority }: { template: TemplateSummary; width: number; height: number; priority: boolean }) {
  const image = width === POSTER_WIDTH && height === POSTER_HEIGHT ? posterPreview(template.key) : null;
  if (image) {
    return (
      <div className={PHONE_FRAME} style={{ width: width + 14, height: height + 14 }}>
        <img src={image} alt="" width={width} height={height} loading={priority ? 'eager' : 'lazy'} decoding="async" className="block" style={{ width, height }} />
      </div>
    );
  }
  if (posterScene(template)) {
    return (
      <div className={PHONE_FRAME} style={{ width: width + 14, height: height + 14 }}>
        <PosterScene template={template} width={width} height={height} />
      </div>
    );
  }
  const c = template.definition?.theme.colors;
  return (
    <div className={PHONE_FRAME} style={{ width: width + 14, height: height + 14 }}>
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden px-6 text-center"
        style={{ background: c ? `linear-gradient(160deg, ${c.primary}, ${c.secondary})` : '#5b0e1b', color: c?.background ?? '#fff' }}
      >
        {template.definition && template.definition.theme.ornament !== 'none' ? (
          <Ornament name={template.definition.theme.ornament} className="pointer-events-none absolute top-1/2 left-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-20" style={{ color: c?.accent }} />
        ) : null}
        <span className="relative text-[10px] tracking-[0.35em] uppercase opacity-80">{posterLabel(template)}</span>
        <span className="relative font-display text-3xl leading-tight">{template.name}</span>
        <span className="relative text-xs opacity-80">{template.category}</span>
      </div>
    </div>
  );
}

/**
 * A gallery card: the live phone preview leans toward the pointer in 3D (the
 * cursor reads "View" over it) and lifts off its floor shadow; name, plan and
 * a live-demo link sit underneath. `headingLevel` follows the page outline:
 * 2 directly under a page's h1, 3 inside a section.
 */
export function TemplateCard({
  template,
  t,
  priceLabel,
  href,
  headingLevel = 3,
}: {
  template: TemplateSummary;
  t: Translator;
  priceLabel: string | null;
  href?: string;
  headingLevel?: 2 | 3;
}) {
  const link = href ?? `/templates/${template.key}`;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="group flex flex-col items-center">
      <div className="relative">
        <span aria-hidden="true" className="absolute -bottom-5 left-1/2 h-8 w-4/5 -translate-x-1/2 rounded-[50%] bg-night-900/25 blur-xl transition-[opacity,scale] duration-500 group-hover:scale-90 group-hover:opacity-60" />
        <div className="relative transition-[translate] duration-500 ease-out group-hover:-translate-y-2">
          <TiltCard className="rounded-[2.2rem]" max={6}>
            <Link href={link} data-cursor="view" className="relative block rounded-[2.2rem]" aria-label={template.name}>
              <TemplatePhone template={template} />
            </Link>
          </TiltCard>
          {template.badge ? (
            <span className={`pointer-events-none absolute top-4 -left-2 z-30 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-lg ${BADGE_STYLE[template.badge]}`}>
              {t(`template.badge.${template.badge}`)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-6 w-full max-w-[234px] text-center">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold-600 uppercase">{template.category}</p>
        <Heading className="mt-1.5 font-display text-[1.4rem] leading-snug">
          <Link href={link} className="transition-colors duration-300 hover:text-brand-700">
            {template.name}
          </Link>
        </Heading>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
          {priceLabel ? (
            <span className="text-stone-600">
              <span className="font-semibold text-ink">{priceLabel}</span> · {t(`filter.tier.${template.tier}`)}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{t('template.free')}</span>
          )}
          {template.outputs.includes('WEBSITE') ? (
            <Link href={`/templates/${template.key}/demo`} className="group/demo inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-brand-700">
              <Play aria-hidden className="size-3 fill-current transition-transform duration-300 group-hover/demo:scale-125" />
              <span className="link-grow">{t('template.demo')}</span>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
