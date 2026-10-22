import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { TemplateCard } from '@/components/marketing/template-card';
import { type ExplorerItem } from '@/components/marketing/template-explorer';
import { TemplateGallery, type FilterGroup } from '@/components/marketing/template-gallery';
import { getGalleryTemplates, getPlans, serverApi, tierPrice } from '@/lib/server-api';
import { onePerLook } from '@/lib/template-looks';

export const revalidate = 60;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Invitation templates for weddings and every celebration',
  description: 'Browse live invitation templates for Hindu, Sikh, Muslim, South Indian and Christian weddings, birthdays, griha pravesh, pujas, corporate events and more.',
  alternates: { canonical: '/templates' },
};

const PAGE_SIZE = 24;

// 'stage' (Signature 3D, "3D walk-in") is a style like 'signature': the home page's walk-in section links to ?tag=stage,
// and an option here gives that filter its chip and its place in the sidebar.
const TRADITIONS = ['signature', 'stage', 'hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi', 'rajasthani', 'destination', 'modern'];

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const [templates, plans, eventTypes] = await Promise.all([
    getGalleryTemplates(),
    getPlans(),
    serverApi<Array<{ key: string; name: string }>>('/meta/event-types', { revalidate: 300 }).then((e) => e ?? []),
  ]);
  const items: ExplorerItem[] = templates.map((tpl) => ({
      key: tpl.key,
      tier: tpl.tier,
      tags: tpl.tags,
      eventTypes: tpl.eventTypes,
      outputs: tpl.outputs,
      // What a search matches, as on /cards: the name, the occasion, the style and the tags (traditions included).
      search: `${tpl.name} ${tpl.category} ${tpl.style ?? ''} ${tpl.tags.join(' ')}`.toLowerCase(),
      look: tpl.preview?.look ?? null,
      node: <TemplateCard template={tpl} t={t} priceLabel={tierPrice(tpl.tier, plans)} headingLevel={2} />,
    }));
  // A design made for several occasions counts (and shows) once.
  const designs = onePerLook(items, (i) => i.look).length;
  const current = { tag: one(params.tag), tier: one(params.tier), event: one(params.event), format: one(params.format), q: one(params.q).trim().slice(0, 60) };
  // The gallery grows on request, a page of cards at a time.
  const pages = Math.max(1, Math.min(20, Number.parseInt(one(params.page), 10) || 1));
  const moreParams = new URLSearchParams({ ...Object.fromEntries(Object.entries(current).filter(([, v]) => v)), page: String(pages + 1) });
  const groups: FilterGroup[] = [
    {
      key: 'event',
      label: t('gallery.occasion'),
      options: eventTypes.filter((e) => e.key !== 'CUSTOM').map((e) => ({ value: e.key, label: e.name.split(' / ')[0]! })),
      visible: 6,
    },
    { key: 'tag', label: t('gallery.tradition'), options: TRADITIONS.map((v) => ({ value: v, label: t(`tag.${v}` as MessageKey) })), visible: 7 },
    { key: 'tier', label: t('gallery.plan'), options: (['FREE', 'PREMIUM', 'SIGNATURE'] as const).map((v) => ({ value: v, label: t(`filter.tier.${v}`) })) },
    { key: 'format', label: t('gallery.format'), options: (['WEBSITE', 'VIDEO', 'DIGITAL_CARD'] as const).map((v) => ({ value: v, label: t(`filter.type.${v}`) })) },
  ];

  // The search keeps the filters already chosen (and the filters keep it), as on /cards.
  const toolbar = (
    <form action="/templates" method="get" role="search" className="clay flex flex-col gap-2 rounded-3xl p-2 sm:flex-row">
      {(['event', 'tag', 'tier', 'format'] as const).map((k) => (current[k] ? <input key={k} type="hidden" name={k} value={current[k]} /> : null))}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t('templates.search')}</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          name="q"
          defaultValue={current.q}
          placeholder={t('templates.searchPlaceholder')}
          className="block min-h-12 w-full rounded-2xl border border-[#e2d2c0] bg-[#f8f2ea] pr-4 pl-11 text-base shadow-clay-inset focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
      </label>
      <button type="submit" className="btn-3d min-h-12 rounded-2xl px-6 text-sm">
        {t('templates.searchButton')}
      </button>
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
            <SectionHeading level={1} eyebrow={t('templates.count', { count: designs })} title={t('templates.title')} subtitle={t('templates.subtitle')} />
            <div className="mt-12">
              <TemplateGallery items={items} groups={groups} current={current} limit={pages * PAGE_SIZE} moreHref={`/templates?${moreParams.toString()}`} t={t} toolbar={toolbar} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
