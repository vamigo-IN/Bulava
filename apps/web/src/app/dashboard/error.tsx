'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
import { buttonVariants } from '@/components/ui/primitives';

const t = createTranslator('en');

/** A dashboard page failed: say so inside the shell (navigation stays), with a retry. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="clay mx-auto mt-6 max-w-lg rounded-[2rem] p-8 text-center">
      <span aria-hidden className="icon-3d mx-auto size-14 rounded-2xl">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-3xl">{t('errorPage.title')}</h1>
      <p className="mt-2 text-stone-600">{t('errorPage.body')}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonVariants({ className: 'rounded-2xl' })}>
          <RotateCcw aria-hidden className="size-4" />
          {t('errorPage.retry')}
        </button>
        <Link href="/dashboard" className={buttonVariants({ variant: 'secondary', className: 'rounded-2xl' })}>
          {t('dash.nav.events')}
        </Link>
      </div>
      {error.digest ? <p className="mt-6 text-xs text-stone-500">{t('errorPage.reference', { id: error.digest })}</p> : null}
    </div>
  );
}
