'use client';

import { House, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
// Straight from its module: this boundary ships with every page, and the package's
// entry point would bring the whole template engine (and Zod, ~450 KB) along.
import { Mandala } from '@bulava/template-engine/src/ornaments';

const t = createTranslator('en');

/** Last-resort boundary for public pages: a calm cream screen with a retry, never a stack trace. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 text-center text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(233,200,127,0.42),transparent)]" />
      </div>
      <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[680px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-500 opacity-[0.1]" />
      <div className="clay max-w-lg rounded-[2rem] px-6 py-12 sm:px-12">
        <h1 className="font-display text-4xl leading-[1.08] tracking-[-0.015em] sm:text-5xl">{t('errorPage.title')}</h1>
        <p className="mt-4 text-lg text-stone-600">{t('errorPage.body')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button type="button" onClick={reset} className="btn-3d min-h-12 rounded-2xl px-6">
            <RotateCcw aria-hidden className="size-4" />
            {t('errorPage.retry')}
          </button>
          <Link href="/" className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6">
            <House aria-hidden className="size-4" />
            {t('errorPage.home')}
          </Link>
        </div>
        {error.digest ? <p className="mt-8 text-xs text-stone-500">{t('errorPage.reference', { id: error.digest })}</p> : null}
      </div>
    </main>
  );
}
