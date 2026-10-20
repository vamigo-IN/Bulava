import { BadgeCheck, MessageCircle, Palette, PenLine, Wand2, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { PreviewRequestForm } from '@/components/previews/request-form';
import { serverApi } from '@/lib/server-api';
import type { EventType, Language } from '@/lib/types';

export const revalidate = 300;

const t = createTranslator('en');

export const metadata: Metadata = {
  title: t('previewReq.meta.title'),
  description: t('previewReq.meta.description'),
  alternates: { canonical: '/get-preview' },
};

/**
 * Asking for a preview (ADR-076): customers who would rather have it made for
 * them tell us about the celebration, and a preview provider designs it and
 * sends the link on WhatsApp. People type their details here, so the page is
 * tracker-free (lib/private-routes.ts, FORM_PATHS).
 */
export default async function GetPreviewPage() {
  const [eventTypes, languages] = await Promise.all([serverApi<EventType[]>('/meta/event-types', { revalidate: 300 }), serverApi<Language[]>('/meta/languages', { revalidate: 300 })]);
  const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
    { icon: PenLine, title: t('previewReq.step1'), body: t('previewReq.step1Body') },
    { icon: Wand2, title: t('previewReq.step2'), body: t('previewReq.step2Body') },
    { icon: MessageCircle, title: t('previewReq.step3'), body: t('previewReq.step3Body') },
    { icon: BadgeCheck, title: t('previewReq.step4'), body: t('previewReq.step4Body') },
  ];
  return (
    <>
      <SiteHeader />
      <main className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(233,200,127,0.42),transparent_70%)]" />
        <Mandala className="pointer-events-none absolute -top-72 left-1/2 -z-10 w-[760px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
        <section data-header-tone="light" className="mx-auto max-w-7xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center text-brand-700 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              <Palette aria-hidden className="size-3.5" />
              {t('previewReq.eyebrow')}
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.04] tracking-[-0.02em] text-balance text-ink sm:text-6xl animate-settle-up">{t('previewReq.title')}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-stone-700 animate-settle-up" style={{ animationDelay: '80ms' }}>
              {t('previewReq.subtitle')}
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <Suspense fallback={<div className="clay h-[42rem] rounded-[2rem]" />}>
              <PreviewRequestForm eventTypes={eventTypes ?? []} languages={languages ?? []} />
            </Suspense>
            <aside className="order-first lg:sticky lg:top-24 lg:order-none" aria-label={t('home.how')}>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {steps.map(({ icon: Icon, title, body }, i) => (
                  <li key={title} className="clay flex gap-4 rounded-[1.5rem] p-4">
                    <span aria-hidden className="icon-3d size-11 shrink-0 rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{t('home.how.step', { n: i + 1 })}</span>
                      <span className="mt-0.5 block font-display text-xl leading-tight text-ink">{title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-stone-600">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
