import { ArrowRight, House } from 'lucide-react';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

const t = createTranslator('en');

/** Unknown addresses and `notFound()`: the marketing chrome around a calm cream 404. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative isolate flex min-h-[78dvh] items-center overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(233,200,127,0.42),rgba(240,212,196,0.3)_55%,transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[760px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="eyebrow animate-fade-in-up text-brand-700">{t('notFound.eyebrow')}</p>
          <p aria-hidden="true" className="mt-4 animate-rise-in bg-gradient-to-b from-[#a83a47] to-brand-800 bg-clip-text font-display text-[8rem] leading-none text-transparent sm:text-[11rem]">
            404
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.08] tracking-[-0.015em] text-balance sm:text-5xl">{t('notFound.title')}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-stone-600">{t('notFound.body')}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/" className="btn-3d group/cta min-h-13 rounded-2xl px-6">
              <House aria-hidden className="size-4" />
              {t('notFound.home')}
            </Link>
            <Link href="/templates" className="btn-3d btn-3d-light group/more min-h-13 rounded-2xl px-6">
              {t('home.hero.browse')}
              <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/more:translate-x-1" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
