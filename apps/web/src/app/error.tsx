'use client';

import { House, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
// Straight from its module: this boundary ships with every page, and the package's
// entry point would bring the whole template engine (and Zod, ~450 KB) along.
import { Mandala } from '@bulava/template-engine/src/ornaments';

const t = createTranslator('en');

/** Last-resort boundary for public pages: a calm night screen with a retry, never a stack trace. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grain relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-night-950 px-4 text-center text-ivory">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.55),transparent)]" />
      </div>
      <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[680px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-300 opacity-[0.07]" />
      <div className="max-w-lg">
        <h1 className="font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">{t('errorPage.title')}</h1>
        <p className="mt-4 text-lg text-ivory/70">{t('errorPage.body')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-6 font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t('errorPage.retry')}
          </button>
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-medium text-ivory ring-1 ring-white/20 transition-colors duration-300 hover:bg-white/5">
            <House aria-hidden className="size-4" />
            {t('errorPage.home')}
          </Link>
        </div>
        {error.digest ? <p className="mt-8 text-xs text-ivory/55">{t('errorPage.reference', { id: error.digest })}</p> : null}
      </div>
    </main>
  );
}
