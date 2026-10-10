import type { Metadata } from 'next';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { FaqList } from '@/components/marketing/faq-list';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getPlans } from '@/lib/server-api';

export const revalidate = 300;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free. Unlock more for a single event with a one-time payment, or choose Studio for planners.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <>
      <SiteHeader />
      <main className="relative isolate min-h-dvh overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
        <Mandala className="pointer-events-none absolute -top-72 left-1/2 -z-10 w-[760px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
        <section className="mx-auto max-w-7xl px-4 pt-14 pb-28 sm:px-6 sm:pt-20">
          <SectionHeading level={1} eyebrow={t('home.pricing.eyebrow')} title={t('pricing.title')} subtitle={t('home.pricing.subtitle')} />
          <div className="mt-16">
            <PricingCards plans={plans} t={t} headingLevel={2} />
          </div>
          <div className="mx-auto mt-24 max-w-3xl">
            <h2 className="text-center font-display text-4xl tracking-[-0.015em]">{t('home.faq.title')}</h2>
            <div className="mt-10">
              <FaqList questions={[6, 3, 5]} t={t} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
