import { ArrowRight, House } from 'lucide-react';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

const t = createTranslator('en');

/** Unknown addresses and `notFound()`: the marketing chrome around a night-sky 404. */
export default function NotFound() {
  return (
    <>
      <SiteHeader tone="dark" />
      <main data-header-tone="dark" className="grain relative isolate -mt-16 flex min-h-[86dvh] items-center overflow-hidden bg-night-950 pt-16 text-ivory lg:-mt-[72px] lg:pt-[72px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.6),rgba(91,14,27,0.18)_55%,transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[760px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-300 opacity-[0.07]" />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="eyebrow animate-fade-in-up bg-white/5 text-gold-200 ring-1 ring-white/10">{t('notFound.eyebrow')}</p>
          <p aria-hidden="true" className="mt-4 animate-rise-in bg-gradient-to-b from-gold-100 to-gold-300 bg-clip-text font-display text-[8rem] leading-none text-transparent sm:text-[11rem]">
            404
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.08] tracking-tight text-balance sm:text-5xl">{t('notFound.title')}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-ivory/70">{t('notFound.body')}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="group/cta inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-6 font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_14px_30px_-14px_rgba(227,197,133,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200"
            >
              <House aria-hidden className="size-4" />
              {t('notFound.home')}
            </Link>
            <Link href="/templates" className="group/more inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40">
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
