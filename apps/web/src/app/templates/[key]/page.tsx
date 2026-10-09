import { AuthAwareLink } from '@/components/marketing/account-links';
import { ArrowLeft, ArrowRight, BookOpen, Check, Music, Play, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator, getLanguage, type MessageKey } from '@bulava/localization';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { TemplateCard } from '@/components/marketing/template-card';
import { TemplatePreviewSwitcher } from '@/components/marketing/template-preview-switcher';
import { UseTemplateButton } from '@/components/marketing/quick-start';
import { getGalleryTemplates, getPlans, getTemplate, tierPrice } from '@/lib/server-api';

export const revalidate = 60;

const t = createTranslator('en');

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const tpl = await getTemplate(key);
  if (!tpl) return { title: 'Template not found' };
  return {
    title: `${tpl.name} · ${tpl.category} invitation template`,
    description: tpl.description ?? undefined,
    alternates: { canonical: `/templates/${tpl.key}` },
  };
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [tpl, plans, all] = await Promise.all([getTemplate(key), getPlans(), getGalleryTemplates()]);
  if (!tpl?.definition) notFound();
  const price = tierPrice(tpl.tier, plans);
  const related = all.filter((x) => x.key !== tpl.key && x.outputs.some((o) => tpl.outputs.includes(o)) && x.tags.some((g) => tpl.tags.includes(g))).slice(0, 4);
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-medium text-brand-700 shadow-clay-sm';

  return (
    <>
      <SiteHeader />
      <main className="relative isolate">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_55%_60%_at_30%_0%,rgba(233,200,127,0.38),transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-28 sm:px-6">
          <Link href="/templates" className="group/back inline-flex items-center gap-2 text-sm font-medium text-brand-700">
            <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 group-hover/back:-translate-x-1" />
            <span className="link-grow">{t('templates.detail.back')}</span>
          </Link>
          <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <TemplatePreviewSwitcher
              definition={tpl.definition}
              eventType={tpl.eventTypes[0] ?? 'WEDDING'}
              tags={tpl.tags}
              labels={{ mobile: t('templates.detail.mobile'), desktop: t('templates.detail.desktop'), note: t('templates.detail.previewNote'), playOpening: t('signature.play') }}
            />
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="clay rounded-[2rem] p-7 sm:p-8">
                <p className="eyebrow text-brand-700">{tpl.category}</p>
                <h1 className="mt-3 font-display text-5xl leading-[1.04] tracking-[-0.015em]">{tpl.name}</h1>
                {tpl.description ? <p className="mt-4 text-lg leading-relaxed text-stone-600">{tpl.description}</p> : null}
                {tpl.definition.website && tpl.definition.website.intro !== 'none' ? (
                  <ul className="mt-5 flex flex-wrap gap-2 text-sm">
                    <li className={chip}>
                      <Sparkles aria-hidden className="size-3.5" />
                      {t('signature.opens', { intro: t(`intro.name.${tpl.definition.website.intro}` as MessageKey) })}
                    </li>
                    {tpl.definition.capabilities.editable.music ? (
                      <li className={chip}>
                        <Music aria-hidden className="size-3.5" />
                        {t('signature.music')}
                      </li>
                    ) : null}
                    {tpl.tags.includes('signature') ? (
                      <li className={chip}>
                        <BookOpen aria-hidden className="size-3.5" />
                        {t('signature.menu')}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <div className="mt-7 flex items-baseline gap-3 border-t border-gold-100 pt-6">
                  <p className="font-display text-4xl">{price ?? t('template.free')}</p>
                  {price ? <p className="text-sm text-stone-500">{t('template.included', { plan: t(`filter.tier.${tpl.tier}`) })}</p> : null}
                </div>
                {tpl.definition.type === 'WEBSITE' ? (
                  // Websites start with the quick start: a preview with the host's names before any sign-up.
                  <UseTemplateButton template={{ key: tpl.key, name: tpl.name, eventTypes: tpl.eventTypes }} className="btn-3d group/cta mt-6 min-h-14 w-full rounded-2xl text-base">
                    {t('template.use')}
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </UseTemplateButton>
                ) : (
                  <AuthAwareLink
                    signedOutHref={`/signup?template=${tpl.key}`}
                    signedInHref={`/dashboard/events/new?template=${tpl.key}${tpl.eventTypes[0] ? `&type=${tpl.eventTypes[0]}` : ''}`}
                    className="btn-3d group/cta mt-6 min-h-14 w-full rounded-2xl text-base"
                  >
                    {t('template.use')}
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </AuthAwareLink>
                )}
                {tpl.definition.type === 'WEBSITE' ? (
                  <Link href={`/templates/${tpl.key}/demo`} className="btn-3d btn-3d-light mt-3 min-h-12 w-full rounded-2xl text-brand-700">
                    <Play aria-hidden className="size-3.5 fill-current" />
                    {t('templates.detail.demo')}
                  </Link>
                ) : null}
              </div>
              <dl className="clay-inset mt-5 space-y-5 rounded-[2rem] p-7 text-sm">
                {tpl.tags.length ? (
                  <div>
                    <dt className="font-semibold text-ink">{t('templates.detail.for')}</dt>
                    <dd className="mt-3 flex flex-wrap gap-2">
                      {tpl.tags.map((g) => (
                        <Link key={g} href={`/templates?tag=${g}`} className="btn-3d btn-3d-light min-h-9 rounded-full px-3.5 text-xs font-medium capitalize">
                          {g.replace(/-/g, ' ')}
                        </Link>
                      ))}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-semibold text-ink">{t('templates.detail.languages')}</dt>
                  <dd className="mt-1.5 text-stone-600">{tpl.languages.map((l) => getLanguage(l).nativeName).join(' · ')}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">{t('templates.detail.includes')}</dt>
                  <dd>
                    <ul className="mt-3 space-y-2.5 text-stone-600">
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <li key={n} className="flex gap-2.5">
                          <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          {t(`templates.detail.include.${n}`)}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
          {related.length ? (
            <section className="mt-28" aria-labelledby="related-title">
              <h2 id="related-title" className="text-center font-display text-4xl tracking-[-0.015em]">
                {t('home.grid.title')}
              </h2>
              <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-6">
                {related.map((r) => (
                  <li key={r.key}>
                    <TemplateCard template={r} t={t} priceLabel={tierPrice(r.tier, plans)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
