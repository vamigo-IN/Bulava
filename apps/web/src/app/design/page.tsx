import { ArrowRight, Check, Clapperboard, Globe, Image as ImageIcon, PenTool, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getTemplates, serverApi, type TemplateSummary } from '@/lib/server-api';
import { forEvent, onePerLook } from '@/lib/template-looks';
import { cardPreview, posterPreview } from '@/lib/template-previews';
import { cn } from '@/lib/utils';

export const revalidate = 60;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Design your invitation online: website, video or card',
  description: 'Design a website invitation, a video invitation or a digital card on the canvas, free: start from any design or a blank canvas, and choose a plan only when you publish or download.',
  alternates: { canonical: '/design' },
};

const KINDS = ['website', 'video', 'card'] as const;
type Kind = (typeof KINDS)[number];

const KIND_ICON: Record<Kind, LucideIcon> = { website: Globe, video: Clapperboard, card: ImageIcon };
/** The blank canvas (templates/src/blank.ts) and its film. */
const BLANK: Record<Kind, string> = { website: 'blank-canvas', video: 'blank-canvas-film', card: 'blank-canvas' };
const PAGE_SIZE = 24;

/** Where each kind is designed: websites and films here, cards in the card editor (which needs no account either). */
function editorHref(kind: Kind, key: string, event: string): string {
  const query = event ? `?event=${encodeURIComponent(event)}` : '';
  return kind === 'card' ? `/cards/editor/${encodeURIComponent(key)}${query}` : `/design/${kind}/${encodeURIComponent(key)}${query}`;
}

function fits(kind: Kind, tpl: TemplateSummary): boolean {
  if (tpl.tags.includes('blank')) return false;
  if (kind === 'video') return tpl.outputs.includes('VIDEO');
  if (kind === 'card') return tpl.outputs.includes('WEBSITE') && tpl.preview?.heroSection === 'canvas';
  return tpl.outputs.includes('WEBSITE');
}

/**
 * The design page (ADR-063): for everyone, signed in or not. It asks what to
 * make (a website, a video or a card), for which occasion, then offers the
 * designs for it and a blank canvas. The editors keep the design on the
 * visitor's device and preview it with a watermark; publishing and downloads
 * go through the account and its plan.
 */
export default async function DesignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const make = (KINDS as readonly string[]).includes(one(params.make)) ? (one(params.make) as Kind) : null;
  const [templates, eventTypes] = await Promise.all([getTemplates(), serverApi<Array<{ key: string; name: string }>>('/meta/event-types', { revalidate: 300 }).then((e) => e ?? [])]);
  const occasions = eventTypes.map((e) => ({ key: e.key, name: e.key === 'CUSTOM' ? t('studio.occasion.other') : e.name.split(' / ')[0]! }));
  const event = occasions.some((o) => o.key === one(params.event)) ? one(params.event) : '';
  const pages = Math.max(1, Math.min(20, Number.parseInt(one(params.page), 10) || 1));

  const designs = make ? onePerLook(templates.filter((tpl) => fits(make, tpl) && (!event || tpl.eventTypes.includes(event))), (tpl) => tpl.preview?.look, forEvent(event || undefined)) : [];
  const shown = designs.slice(0, pages * PAGE_SIZE);
  const query = (extra: Record<string, string>) => `/design?${new URLSearchParams(Object.fromEntries(Object.entries({ make: make ?? '', event, ...extra }).filter(([, v]) => v))).toString()}`;
  // Each choice lands on the next step (#occasion, with the designs under it). Without the anchor the page
  // goes back to its top and, on a phone, the step that just appeared is a screen below: nothing seems to happen.
  const NEXT_STEP = '#occasion';

  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">
        <section data-header-tone="light" className="relative isolate overflow-x-clip">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
          <Mandala className="pointer-events-none absolute -top-64 left-1/2 -z-10 w-[720px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
          <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow text-brand-700">{t('studio.eyebrow')}</p>
              <h1 className="mt-4 animate-settle-up font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-6xl">{t('studio.title')}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">{t('studio.subtitle')}</p>
            </div>

            <h2 className="mt-12 text-center text-sm font-semibold tracking-[0.18em] text-stone-500 uppercase">{t('studio.step.make')}</h2>
            <ul className="mx-auto mt-5 grid max-w-5xl gap-4 sm:grid-cols-3">
              {KINDS.map((kind) => {
                const Icon = KIND_ICON[kind];
                const active = make === kind;
                return (
                  <li key={kind}>
                    <Link
                      href={`/design?${new URLSearchParams({ make: kind, ...(event ? { event } : {}) }).toString()}${NEXT_STEP}`}
                      aria-current={active ? 'true' : undefined}
                      className={cn('clay clay-lift flex h-full items-start gap-4 rounded-3xl p-5 transition-shadow', active && 'ring-2 ring-brand-600')}
                    >
                      <span aria-hidden className="icon-3d grid size-12 shrink-0 place-items-center rounded-2xl">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-display text-xl text-ink">
                          {t(`studio.make.${kind}` as MessageKey)}
                          {active ? <Check aria-hidden className="size-4 text-brand-700" /> : null}
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-stone-600">{t(`studio.make.${kind}.hint` as MessageKey)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {make ? (
              <>
                <h2 id="occasion" className="mt-12 scroll-mt-24 text-center text-sm font-semibold tracking-[0.18em] text-stone-500 uppercase">
                  {t('studio.step.occasion')}
                </h2>
                <ul className="mx-auto mt-5 flex max-w-5xl flex-wrap justify-center gap-2">
                  {[{ key: '', name: t('studio.occasion.all') }, ...occasions].map((o) => (
                    <li key={o.key || 'all'}>
                      <Link
                        href={`${query({ event: o.key, page: '' })}${NEXT_STEP}`}
                        aria-current={event === o.key ? 'true' : undefined}
                        className={cn('inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors', event === o.key ? 'bg-brand-700 text-ivory shadow-clay-sm' : 'clay text-stone-700 hover:text-ink')}
                      >
                        {o.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink sm:text-3xl">{t('studio.step.design')}</h2>
                  <p className="text-sm text-stone-500">{t('studio.count', { count: designs.length })}</p>
                </div>
                <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-5">
                  <li>
                    <Link href={editorHref(make, BLANK[make], event)} className="clay clay-lift group flex h-full flex-col rounded-[1.5rem] p-2 sm:p-3">
                      <span className="relative grid place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-gold-300 bg-ivory" style={{ aspectRatio: make === 'video' ? '9 / 16' : '390 / 780' }}>
                        <span className="flex flex-col items-center gap-3 px-4 text-center">
                          <span aria-hidden className="icon-3d grid size-14 place-items-center rounded-2xl">
                            <PenTool className="size-6" />
                          </span>
                          <span className="font-display text-xl text-ink">{t('studio.blank')}</span>
                        </span>
                      </span>
                      <span className="mt-3 block px-1 text-sm leading-relaxed text-stone-600">{t('studio.blank.hint')}</span>
                    </Link>
                  </li>
                  {shown.map((tpl, i) => {
                    const image = make === 'video' ? posterPreview(tpl.key) : cardPreview(tpl.key);
                    const colors = tpl.preview?.colors ?? null;
                    return (
                      <li key={tpl.key}>
                        <Link href={editorHref(make, tpl.key, event)} className="clay clay-lift group flex h-full flex-col rounded-[1.5rem] p-2 sm:p-3" aria-label={t('studio.designNamed', { name: tpl.name })}>
                          <span className="relative block overflow-hidden rounded-2xl" style={{ aspectRatio: make === 'video' ? '9 / 16' : '390 / 780', background: colors?.accent ?? '#f3e8d8' }}>
                            {image ? (
                              <img src={image} alt="" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" className="block size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                            ) : (
                              <span className="grid size-full place-items-center p-4 text-center font-display text-xl" style={{ background: `linear-gradient(160deg, ${colors?.background ?? '#fdf7ec'}, ${colors?.accent ?? '#e9c87f'})`, color: colors?.primary ?? '#5b0e1b' }}>
                                {tpl.name}
                              </span>
                            )}
                            {tpl.tier !== 'FREE' ? <span className="absolute top-2 left-2 rounded-full bg-surface/95 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-brand-800 shadow-clay-sm">{t(`filter.tier.${tpl.tier}`)}</span> : null}
                          </span>
                          <span className="mt-3 flex items-start justify-between gap-2 px-1">
                            <span className="min-w-0">
                              <span className="block text-xs text-stone-500">{tpl.category}</span>
                              <span className="block font-display text-base leading-tight text-ink sm:text-lg">{tpl.name}</span>
                            </span>
                            <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {designs.length > shown.length ? (
                  <div className="mt-10 text-center">
                    <Link href={query({ page: String(pages + 1) })} scroll={false} className="btn-3d btn-3d-light min-h-12 rounded-full px-6 text-sm">
                      {t('studio.more', { count: designs.length - shown.length })}
                    </Link>
                  </div>
                ) : null}
              </>
            ) : null}

            <p className="mx-auto mt-14 max-w-2xl rounded-2xl bg-gold-100/50 px-5 py-4 text-center text-sm leading-relaxed text-stone-700 ring-1 ring-gold-200">
              {t('studio.planNote')}{' '}
              <Link href="/pricing" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                {t('studio.planNote.link')}
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
