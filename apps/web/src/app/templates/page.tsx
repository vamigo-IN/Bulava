import type { Metadata } from 'next';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { TemplateCard } from '@/components/marketing/template-card';
import { filterItems, TemplateExplorer, type ExplorerItem } from '@/components/marketing/template-explorer';
import { getPlans, getTemplates, serverApi, tierPrice } from '@/lib/server-api';

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
    getTemplates(),
    getPlans(),
    serverApi<Array<{ key: string; name: string }>>('/meta/event-types', { revalidate: 300 }).then((e) => e ?? []),
  ]);
  const items: ExplorerItem[] = templates
    .filter((x) => x.definition)
    .map((tpl) => ({
      key: tpl.key,
      tier: tpl.tier,
      tags: tpl.tags,
      eventTypes: tpl.eventTypes,
      outputs: tpl.outputs,
      node: <TemplateCard template={tpl} t={t} priceLabel={tierPrice(tpl.tier, plans)} headingLevel={2} />,
    }));
  const all = { value: '', label: t('filter.all') };
  const current = { tag: one(params.tag), tier: one(params.tier), event: one(params.event), format: one(params.format) };
  const matching = filterItems(items, current);
  // The gallery grows on request, a page of cards at a time.
  const pages = Math.max(1, Math.min(20, Number.parseInt(one(params.page), 10) || 1));
  const shown = pages * PAGE_SIZE;
  const moreParams = new URLSearchParams({ ...Object.fromEntries(Object.entries(current).filter(([, v]) => v)), page: String(pages + 1) });

  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh bg-ivory">
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(227,197,133,0.35),transparent_70%)]" />
          <Mandala className="pointer-events-none absolute -top-64 left-1/2 -z-10 w-[720px] -translate-x-1/2 animate-spin-slow text-gold-300 opacity-[0.12]" />
          <div className="mx-auto max-w-7xl px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
            <SectionHeading level={1} eyebrow={t('templates.count', { count: items.length })} title={t('templates.title')} subtitle={t('templates.subtitle')} />
            <div className="mt-12">
              <TemplateExplorer
                items={matching}
                current={current}
                limit={shown}
                moreHref={`/templates?${moreParams.toString()}`}
                moreLabel={t('templates.showMore', { count: matching.length - shown })}
                moreKeepsScroll
                occasions={[all, ...eventTypes.filter((e) => e.key !== 'CUSTOM').map((e) => ({ value: e.key, label: e.name.split(' / ')[0]! }))]}
                traditions={[all, ...TRADITIONS.map((v) => ({ value: v, label: t(`tag.${v}` as MessageKey) }))]}
                tiers={[all, ...(['FREE', 'STANDARD', 'PREMIUM'] as const).map((v) => ({ value: v, label: t(`filter.tier.${v}`) }))]}
                formats={[all, ...(['WEBSITE', 'VIDEO', 'DIGITAL_CARD'] as const).map((v) => ({ value: v, label: t(`filter.type.${v}`) }))]}
                emptyLabel={t('home.grid.empty')}
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
