import { Download, Paintbrush, Search, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { CardTemplateLink, RecentCards } from '@/components/cards/gallery-client';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { type ExplorerFilters, type ExplorerItem } from '@/components/marketing/template-explorer';
import { TemplateGallery, type FilterGroup } from '@/components/marketing/template-gallery';
import { getShowcase, getTemplates, serverApi, type TemplateSummary } from '@/lib/server-api';
import { cardPreview } from '@/lib/template-previews';

export const revalidate = 60;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Digital invitation cards: design online, download free',
  description: 'Personalise a wedding, engagement, haldi, mehendi, birthday or puja invitation card in your browser. Download it free with a small watermark, or without it for ₹50. No sign-up.',
  alternates: { canonical: '/cards' },
};

const PAGE_SIZE = 24;

/** Occasions in the order people look for them; others follow alphabetically. */
const CATEGORY_ORDER = ['Wedding', 'Engagement', 'Haldi', 'Mehendi', 'Sangeet', 'Reception', 'Anniversary', 'Birthday', 'Baby Shower', 'Naming Ceremony', 'Housewarming', 'Puja & Ceremonies', 'Festival'];
const TRADITIONS = ['hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi', 'rajasthani', 'signature'];
/** Looks, from the catalog's tags. */
const STYLES = ['royal', 'floral', 'traditional', 'modern', 'minimal', 'pastel', 'luxury', 'festive', 'night', 'romantic', 'kids', 'photo'];

const SORTS = ['featured', 'new', 'name'] as const;
type Sort = (typeof SORTS)[number];

function tint(hex: string | undefined, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '#f3e8d8';
  const n = Number.parseInt(m[1]!, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}

/**
 * The digital card gallery: every template whose opening is a canvas design,
 * as a card anyone can personalise without signing in. The same gallery as
 * /templates (filters in a sidebar, chips for what is chosen), with a search
 * and an order on top; filtering happens on the server from the URL, and the
 * previews are the pre-rendered images, so the page stays light on phones.
 * "Featured" puts the cards chosen in the console (Home page) first.
 */
export default async function CardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const [templates, config, showcase] = await Promise.all([getTemplates(), serverApi<{ enabled: boolean; priceMinor: number }>('/public/cards/config', { revalidate: 60 }), getShowcase()]);
  const price = `₹${Math.round((config?.priceMinor ?? 5000) / 100)}`;
  const cards = templates.filter((tpl) => tpl.preview?.heroSection === 'canvas');
  const present = [...new Set(cards.map((c) => c.category))];
  const categories = [...CATEGORY_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CATEGORY_ORDER.includes(c)).sort()];

  const sort: Sort = (SORTS as readonly string[]).includes(one(params.sort)) ? (one(params.sort) as Sort) : 'featured';
  const picked = new Map((showcase.cards ?? []).map((key, i) => [key, i]));
  const ordered =
    sort === 'name'
      ? [...cards].sort((a, b) => a.name.localeCompare(b.name))
      : sort === 'new'
        ? [...cards].sort((a, b) => Number(b.badge === 'NEW') - Number(a.badge === 'NEW'))
        : // The console's picks first, in their order; then the catalog's own (featured first).
          [...cards].sort((a, b) => (picked.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (picked.get(b.key) ?? Number.MAX_SAFE_INTEGER));
  const items: ExplorerItem[] = ordered.map((tpl, i) => ({
    key: tpl.key,
    tier: tpl.tier,
    tags: tpl.tags,
    eventTypes: tpl.eventTypes,
    outputs: tpl.outputs,
    category: tpl.category,
    search: `${tpl.name} ${tpl.category} ${tpl.style ?? ''} ${tpl.tags.join(' ')}`.toLowerCase(),
    node: <CardTile template={tpl} priority={i < 4} />,
  }));

  const pick = (value: string, allowed: readonly string[]) => (allowed.includes(value) ? value : '');
  const current: ExplorerFilters = {
    category: pick(one(params.category), categories),
    tag: pick(one(params.tag), TRADITIONS),
    style: pick(one(params.style), STYLES),
    q: one(params.q).trim().slice(0, 60),
    sort: sort === 'featured' ? '' : sort,
  };
  const pages = Math.max(1, Math.min(30, Number.parseInt(one(params.page), 10) || 1));
  const moreParams = new URLSearchParams({ ...Object.fromEntries(Object.entries(current).filter(([, v]) => v)), page: String(pages + 1) });
  const groups: FilterGroup[] = [
    { key: 'category', label: t('cards.gallery.occasion'), options: categories.map((c) => ({ value: c, label: c })), visible: 8 },
    { key: 'tag', label: t('gallery.tradition'), options: TRADITIONS.map((v) => ({ value: v, label: t(`tag.${v}` as MessageKey) })), visible: 6 },
    { key: 'style', label: t('cards.gallery.style'), options: STYLES.map((v) => ({ value: v, label: t(`cards.style.${v}` as MessageKey) })), visible: 6 },
  ];

  // Search and order keep the filters already chosen (and the filters keep them).
  const toolbar = (
    <form action="/cards" method="get" role="search" className="clay flex flex-col gap-2 rounded-3xl p-2 sm:flex-row">
      {(['category', 'tag', 'style'] as const).map((k) => (current[k] ? <input key={k} type="hidden" name={k} value={current[k]} /> : null))}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t('cards.gallery.search')}</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          name="q"
          defaultValue={current.q}
          placeholder={t('cards.gallery.searchPlaceholder')}
          className="block min-h-12 w-full rounded-2xl border border-[#e2d2c0] bg-[#f8f2ea] pr-4 pl-11 text-base shadow-clay-inset focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="cards-sort">
          {t('cards.gallery.sort')}
        </label>
        <select id="cards-sort" name="sort" defaultValue={sort} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-[#e2d2c0] bg-[#f8f2ea] px-3 text-sm shadow-clay-inset focus:border-brand-600 focus:outline-none sm:flex-none">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`cards.gallery.sort.${s}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-3d min-h-12 rounded-2xl px-6 text-sm">
          {t('cards.gallery.searchButton')}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">
        {/* Clip sideways only: overflow-hidden would stop the filter sidebar from sticking. */}
        <section data-header-tone="light" className="relative isolate overflow-x-clip">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
          <Mandala className="pointer-events-none absolute -top-64 left-1/2 -z-10 w-[720px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
          <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow text-brand-700">{cards.length ? t('cards.gallery.eyebrow', { count: cards.length }) : t('cards.recover.eyebrow')}</p>
              <h1 className="mt-4 animate-settle-up font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-6xl">{t('cards.gallery.title')}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">{t('cards.gallery.subtitle', { price })}</p>
            </div>
            <ol className="mx-auto mt-8 grid max-w-4xl grid-cols-3 gap-2 sm:mt-10 sm:gap-4">
              {[
                { icon: <Sparkles aria-hidden className="size-5" />, title: t('cards.gallery.step1'), body: t('cards.gallery.step1Body') },
                { icon: <Paintbrush aria-hidden className="size-5" />, title: t('cards.gallery.step2'), body: t('cards.gallery.step2Body') },
                { icon: <Download aria-hidden className="size-5" />, title: t('cards.gallery.step3'), body: t('cards.gallery.step3Body', { price }) },
              ].map((step, i) => (
                <li key={step.title} className="clay flex flex-col items-center gap-2 rounded-2xl p-3 text-center sm:flex-row sm:items-start sm:gap-3 sm:rounded-3xl sm:p-4 sm:text-left">
                  <span className="icon-3d grid size-10 shrink-0 place-items-center rounded-xl">{step.icon}</span>
                  <span>
                    <span className="block text-xs font-semibold text-ink sm:text-sm">
                      {i + 1}. {step.title}
                    </span>
                    {/* Phones show the three steps as a row of titles; the details are in the subtitle above. */}
                    <span className="mt-0.5 hidden text-sm leading-relaxed text-stone-600 sm:block">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <RecentCards />

            <h2 className="sr-only">{t('cards.gallery.heading')}</h2>
            {config && !config.enabled ? (
              <p role="status" className="mt-10 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200">
                {t('error.CARDS_UNAVAILABLE')}
              </p>
            ) : null}
            <div className="mt-12">
              <TemplateGallery
                items={items}
                groups={groups}
                current={current}
                limit={pages * PAGE_SIZE}
                moreHref={`/cards?${moreParams.toString()}`}
                t={t}
                basePath="/cards"
                toolbar={toolbar}
                gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] sm:gap-6"
                labels={{
                  showing: (shown, total) => t('cards.gallery.showing', { shown, total }),
                  emptyTitle: t('cards.gallery.emptyTitle'),
                  emptyBody: t('cards.gallery.emptyBody'),
                  more: (count) => t('cards.gallery.showMore', { count }),
                }}
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function CardTile({ template, priority }: { template: TemplateSummary; priority: boolean }) {
  const preview = cardPreview(template.key);
  const colors = template.preview?.colors ?? null;
  const href = `/cards/editor/${template.key}`;
  return (
    <article className="clay-lift group flex h-full flex-col rounded-[1.5rem] bg-surface p-2 shadow-clay sm:p-3">
      <CardTemplateLink href={href} templateKey={template.key} category={template.category} className="block" ariaLabel={t('cards.gallery.customizeNamed', { name: template.name })}>
        <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '390 / 780', background: tint(colors?.accent, 0.7) }}>
          {preview ? (
            <img src={preview} alt="" width={390} height={780} loading={priority ? 'eager' : 'lazy'} decoding="async" className="block size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <span className="grid size-full place-items-center p-4 text-center font-display text-xl" style={{ background: `linear-gradient(160deg, ${colors?.background ?? '#fdf7ec'}, ${colors?.accent ?? '#e9c87f'})`, color: colors?.primary ?? '#5b0e1b' }}>
              {template.name}
            </span>
          )}
          {template.badge === 'NEW' ? <span className="absolute top-2 left-2 rounded-full bg-surface/95 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-emerald-700 shadow-clay-sm">{t('cards.gallery.new')}</span> : null}
        </div>
      </CardTemplateLink>
      <div className="mt-3 flex flex-1 flex-col px-1">
        <p className="text-xs text-stone-500">{template.category}</p>
        <h3 className="font-display text-base leading-tight text-ink sm:text-lg">{template.name}</h3>
        <div className="mt-auto pt-3">
          <CardTemplateLink href={href} templateKey={template.key} category={template.category} className="btn-3d min-h-11 w-full justify-center rounded-xl text-sm">
            {t('cards.gallery.customize')}
          </CardTemplateLink>
        </div>
      </div>
    </article>
  );
}
