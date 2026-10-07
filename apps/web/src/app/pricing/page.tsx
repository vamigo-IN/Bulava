import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getPlans } from '@/lib/server-api';

export const revalidate = 300;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free. Upgrade a single event with a one-time payment, or choose Studio for planners.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <>
      <SiteHeader />
      <main className="relative isolate min-h-dvh overflow-hidden bg-ivory">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(227,197,133,0.35),transparent_70%)]" />
        <Mandala className="pointer-events-none absolute -top-72 left-1/2 -z-10 w-[760px] -translate-x-1/2 animate-spin-slow text-gold-300 opacity-[0.12]" />
        <section className="mx-auto max-w-7xl px-4 pt-14 pb-28 sm:px-6 sm:pt-20">
          <SectionHeading level={1} eyebrow={t('home.pricing.eyebrow')} title={t('pricing.title')} subtitle={t('home.pricing.subtitle')} />
          <div className="mt-16">
            <PricingCards plans={plans} t={t} headingLevel={2} />
          </div>
          <div className="mx-auto mt-24 max-w-3xl">
            <h2 className="text-center font-display text-4xl tracking-tight">{t('home.faq.title')}</h2>
            <div className="mt-10 divide-y divide-gold-200/80 overflow-hidden rounded-[2rem] border border-gold-200/80 bg-white shadow-soft">
              {([6, 3, 5] as const).map((n) => (
                <details key={n} className="group px-6 py-5 transition-colors duration-300 open:bg-gold-100/25 sm:px-8 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-1 font-display text-xl">
                    {t(`home.faq.${n}.q`)}
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-200 text-gold-600 transition-[rotate,background-color,color,border-color] duration-500 group-open:rotate-45 group-open:border-transparent group-open:bg-brand-700 group-open:text-gold-200">
                      <Plus className="size-4" />
                    </span>
                  </summary>
                  <p className="mt-3 pr-12 leading-relaxed text-stone-600">{t(`home.faq.${n}.a`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
