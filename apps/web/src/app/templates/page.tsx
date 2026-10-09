import type { Metadata } from 'next';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { TemplateCard } from '@/components/marketing/template-card';
import { type ExplorerItem } from '@/components/marketing/template-explorer';
import { TemplateGallery, type FilterGroup } from '@/components/marketing/template-gallery';
import { getGalleryTemplates, getPlans, serverApi, tierPrice } from '@/lib/server-api';

export const revalidate = 60;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Invitation templates for weddings and every celebration',
  description: 'Browse live invitation templates for Hindu, Sikh, Muslim, South Indian and Christian weddings, birthdays, griha pravesh, pujas, corporate events and more.',
  alternates: { canonical: '/templates' },
};

const PAGE_SIZE = 24;

const TRADITIONS = ['signature', 'hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi', 'rajasthani', 'destination', 'modern'];

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
      node: <TemplateCard template={tpl} t={t} priceLabel={tierPrice(tpl.tier, plans)} headingLevel={2} />,
    }));
  const current = { tag: one(params.tag), tier: one(params.tier), event: one(params.event), format: one(params.format) };
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
    { key: 'tier', label: t('gallery.plan'), options: (['FREE', 'STANDARD', 'PREMIUM'] as const).map((v) => ({ value: v, label: t(`filter.tier.${v}`) })) },
    { key: 'format', label: t('gallery.format'), options: (['WEBSITE', 'VIDEO', 'DIGITAL_CARD'] as const).map((v) => ({ value: v, label: t(`filter.type.${v}`) })) },
  ];

  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">
        {/* Clip sideways only: overflow-hidden would stop the filter sidebar from sticking. */}
        <section className="relative isolate overflow-x-clip">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
          <Mandala className="pointer-events-none absolute -top-64 left-1/2 -z-10 w-[720px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
          <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
            <SectionHeading level={1} eyebrow={t('templates.count', { count: items.length })} title={t('templates.title')} subtitle={t('templates.subtitle')} />
            <div className="mt-12">
              <TemplateGallery items={items} groups={groups} current={current} limit={pages * PAGE_SIZE} moreHref={`/templates?${moreParams.toString()}`} t={t} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
