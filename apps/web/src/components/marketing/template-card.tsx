import { ArrowRight, Clapperboard, Globe, Image as ImageIcon, Play } from 'lucide-react';
import Link from 'next/link';
import type { MessageKey, Translator } from '@bulava/localization';
// Single modules, not the package entry: importing that would ship every client component
// of the template engine (openings, music, RSVP forms) with every page that shows a card.
import { backdropArt, backdropTitleTop, SceneStill } from '@bulava/template-engine/src/art/scenes';
import { Ornament } from '@bulava/template-engine/src/ornaments';
import { TemplateStyles } from '@bulava/template-engine/src/styles';
import type { TemplateSummary } from '@/lib/server-api';
import { cardPreview, POSTER_HEIGHT, POSTER_WIDTH, posterPreview } from '@/lib/template-previews';
import { LiveThumbnail } from './live-thumbnail';

/** Badges are clay pills on the card; only the text takes the badge's colour. */
const BADGE_STYLE = {
  NEW: 'text-emerald-700',
  POPULAR: 'text-gold-600',
  BESTSELLER: 'text-brand-700',
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
  if (!template.outputs.includes('WEBSITE')) {
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
      ) : template.definition ? (
        <LiveThumbnail definition={template.definition} eventType={template.eventTypes[0] ?? 'WEDDING'} tags={template.tags} width={width} height={height} sections={sections} />
      ) : (
        <PlainScreen template={template} width={width} height={height} />
      )}
    </div>
  );
}

/** The template's colours and name, for a template with neither an image nor a definition at hand. */
function PlainScreen({ template, width, height }: { template: TemplateSummary; width: number; height: number }) {
  const c = colorsOf(template);
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 text-center"
      style={{ width, height, background: c ? `linear-gradient(160deg, ${c.background}, ${c.accent})` : '#f7ead2', color: c?.primary ?? '#5b0e1b' }}
    >
      <span className="text-[10px] tracking-[0.3em] uppercase opacity-80">{template.category}</span>
      <span className="font-display text-2xl leading-tight">{template.name}</span>
    </div>
  );
}

const colorsOf = (template: TemplateSummary) => template.preview?.colors ?? template.definition?.theme.colors ?? null;

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
  // The poster was rendered at the gallery size; any phone of the same shape, up to that size, can show it.
  const sameShape = width <= POSTER_WIDTH && Math.abs(width / height - POSTER_WIDTH / POSTER_HEIGHT) < 0.01;
  const image = sameShape ? posterPreview(template.key) : null;
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
  const c = colorsOf(template);
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

/** A hex colour mixed with white (`amount` 0 = unchanged, 1 = white): the stage's pastel tints. */
function tint(hex: string | undefined, amount: number, fallback: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return fallback;
  const n = Number.parseInt(m[1]!, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}

const FORMAT_ICON = { WEBSITE: Globe, VIDEO: Clapperboard, DIGITAL_CARD: ImageIcon } as const;

/** The card's phone: the gallery poster's shape at 80% (posters are pre-rendered at 220 × 400). */
const CARD_PHONE = { width: 176, height: 320 };

/**
 * A gallery card. The phone rises out of a soft stage tinted with the template's
 * own colours, lifting as the card does (the cursor reads "View" over it); the
 * occasion, name, price, palette and actions sit underneath. Cards need 280px
 * (see TemplateExplorer). `headingLevel` follows the page outline: 2 directly
 * under a page's h1, 3 inside a section.
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
  const c = colorsOf(template);
  const palette = c ? [c.primary, c.secondary, c.accent, c.background] : [];
  const tradition = template.tags.find((tag) => TRADITION_TAGS.has(tag));
  const stage = `radial-gradient(70% 55% at 50% 38%, rgba(255,255,255,0.9), transparent 70%), linear-gradient(160deg, ${tint(c?.accent, 0.78, '#f7ead2')}, ${tint(c?.primary, 0.86, '#f3dcd8')})`;
  return (
    <article className="clay clay-lift group flex h-full flex-col rounded-[1.6rem] p-2.5">
      {/* The stage: the phone stands near the bottom edge and rises on hover. */}
      <div className="relative h-[300px] overflow-hidden rounded-[1.2rem] shadow-[inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-10px_24px_-12px_rgba(70,40,26,0.25)]" style={{ background: stage }}>
        <Link
          href={link}
          data-cursor="view"
          aria-label={template.name}
          className="absolute top-7 left-1/2 block -translate-x-1/2 rounded-[2rem] shadow-[0_30px_50px_-22px_rgba(70,40,26,0.55)] transition-[translate] duration-500 ease-out group-hover:-translate-y-2.5"
        >
          <TemplatePhone template={template} width={CARD_PHONE.width} height={CARD_PHONE.height} />
        </Link>
        {template.badge ? (
          <span className={`pointer-events-none absolute top-3 left-3 z-30 rounded-full bg-surface/95 px-3 py-1 text-[10.5px] font-bold tracking-[0.14em] uppercase shadow-clay-sm ${BADGE_STYLE[template.badge]}`}>
            {t(`template.badge.${template.badge}`)}
          </span>
        ) : null}
        <ul className="pointer-events-none absolute top-3 right-3 z-30 flex gap-1.5">
          {template.outputs.map((format) => {
            const Icon = FORMAT_ICON[format];
            return (
              <li key={format} className="grid size-7 place-items-center rounded-full bg-surface/95 text-brand-700 shadow-clay-sm">
                <Icon aria-hidden className="size-3.5" />
                <span className="sr-only">{t(`filter.type.${format}`)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-1 flex-col px-2.5 pt-4 pb-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold tracking-[0.2em] text-gold-600 uppercase">
              {template.category}
              {tradition ? ` · ${t(`tag.${tradition}` as MessageKey)}` : null}
            </p>
            <Heading className="mt-1 truncate font-display text-[1.35rem] leading-snug">
              <Link href={link} className="transition-colors duration-300 hover:text-brand-700">
                {template.name}
              </Link>
            </Heading>
          </div>
          {priceLabel ? (
            <p className="shrink-0 text-right leading-tight">
              <span className="block font-display text-[1.3rem] text-ink">{priceLabel}</span>
              <span className="block text-[10.5px] font-semibold tracking-[0.14em] text-stone-500 uppercase">{t(`filter.tier.${template.tier}`)}</span>
            </p>
          ) : (
            <span className="mt-1 shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-emerald-700 shadow-clay-sm">{t('template.free')}</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {palette.length ? (
            <span aria-hidden="true" className="flex -space-x-1.5">
              {palette.map((color, i) => (
                <span key={i} className="size-5 rounded-full shadow-[0_0_0_2px_var(--color-surface),0_2px_4px_rgba(70,40,26,0.25)]" style={{ background: color }} />
              ))}
            </span>
          ) : (
            <span />
          )}
          {template.outputs.includes('WEBSITE') ? (
            <Link href={`/templates/${template.key}/demo`} className="btn-3d group/demo min-h-10 rounded-xl px-4 text-xs">
              <Play aria-hidden className="size-3 fill-current transition-transform duration-300 group-hover/demo:scale-125" />
              {t('template.demo')}
            </Link>
          ) : (
            <Link href={link} className="btn-3d btn-3d-light group/view min-h-10 rounded-xl px-4 text-xs">
              {t('template.view')}
              <ArrowRight aria-hidden className="size-3.5 transition-transform duration-300 group-hover/view:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Tags shown on cards as the tradition (the first one a template has; Signature is a collection, not a tradition). */
const TRADITION_TAGS = new Set(['hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi', 'rajasthani', 'destination', 'modern']);
