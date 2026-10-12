import { BadgeCheck, CircleSlash2, Palette, ReceiptIndianRupee } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { Reveal } from '@/app/home-animations';
import { FaqList } from '@/components/marketing/faq-list';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { AddOnCards, PlanCompare } from '@/components/marketing/pricing-extras';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getAddOns, getPlans } from '@/lib/server-api';

export const revalidate = 300;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'One-time payment, no subscriptions: your invitation live, as a PDF and as an MP4 video. Design and preview free; add only what you need.',
  alternates: { canonical: '/pricing' },
};

/**
 * The plans page (ADR-062): one-time tiers for one celebration, read as such at
 * a glance (pay once, no renewal), every plan compared, add-ons on their own,
 * and the questions people ask about paying once. The ₹159 plan is never here:
 * it is offered only to a host about to leave the checkout.
 */
export default async function PricingPage() {
  const [plans, addOns] = await Promise.all([getPlans(), getAddOns()]);
  const assurances: Array<{ icon: typeof Palette; text: string; href?: string }> = [
    { icon: CircleSlash2, text: t('pricing.assure.noRenewal') },
    { icon: ReceiptIndianRupee, text: t('pricing.assure.noHidden') },
    { icon: BadgeCheck, text: t('pricing.assure.gst') },
    // Every design can be tried first, without an account (the design page, ADR-063).
    { icon: Palette, text: t('pricing.assure.free'), href: '/design' },
  ];
  return (
    <>
      <SiteHeader />
      <main className="relative isolate min-h-dvh overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
        <Mandala className="pointer-events-none absolute -top-72 left-1/2 -z-10 w-[760px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
        <section data-header-tone="light" className="mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
          <SectionHeading level={1} eyebrow={t('home.pricing.eyebrow')} title={t('pricing.title')} subtitle={t('pricing.subtitle')} />
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2" aria-label={t('pricing.title')}>
            {assurances.map(({ icon: Icon, text, href }) => (
              <li key={text}>
                {href ? (
                  <Link href={href} className="clay inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-brand-800 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                    <Icon aria-hidden className="size-4 text-brand-700" />
                    {text}
                  </Link>
                ) : (
                  <span className="clay inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-stone-700">
                    <Icon aria-hidden className="size-4 text-brand-700" />
                    {text}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-16">
            <PricingCards plans={plans} t={t} headingLevel={2} />
          </div>
        </section>

        <section data-header-tone="light" aria-labelledby="compare-title" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <Reveal>
            <h2 id="compare-title" className="mb-8 text-center font-display text-4xl tracking-[-0.015em]">
              {t('pricing.compare.title')}
            </h2>
            <PlanCompare plans={plans} t={t} />
          </Reveal>
        </section>

        {addOns.length ? (
          <section data-header-tone="light" aria-labelledby="addons-title" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
            <Reveal>
              <SectionHeading id="addons-title" eyebrow={t('home.pricing.eyebrow')} title={t('pricing.addons.title')} subtitle={t('pricing.addons.subtitle')} />
              <div className="mt-10">
                <AddOnCards addOns={addOns} plans={plans} t={t} />
              </div>
            </Reveal>
          </section>
        ) : null}

        <section data-header-tone="light" aria-labelledby="pricing-faq-title" className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
          <Reveal>
            <h2 id="pricing-faq-title" className="text-center font-display text-4xl tracking-[-0.015em]">
              {t('pricing.faq.title')}
            </h2>
            <div className="mt-10">
              <FaqList
                t={t}
                items={[
                  { q: t('pricing.faq.subscription.q'), a: t('pricing.faq.subscription.a') },
                  { q: t('pricing.faq.free.q'), a: t('pricing.faq.free.a') },
                  { q: t('pricing.faq.more.q'), a: t('pricing.faq.more.a') },
                  { q: t('pricing.faq.live.q'), a: t('pricing.faq.live.a') },
                ]}
                questions={[6, 3]}
              />
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
