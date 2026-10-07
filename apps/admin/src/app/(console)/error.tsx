'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * A console page failed while rendering: say so inside the shell (the
 * navigation stays usable), with a retry and the reference the server logged.
 */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-10 max-w-lg rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-stone-900">{t('errorPage.title')}</h1>
      <p className="mt-2 text-sm text-stone-600">{t('errorPage.body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={buttonVariants()}>
          <RotateCcw aria-hidden className="size-4" />
          {t('common.retry')}
        </button>
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          {t('errorPage.overview')}
        </Link>
      </div>
      {error.digest ? <p className="mt-6 text-xs text-stone-500">{t('errorPage.reference', { id: error.digest })}</p> : null}
    </div>
  );
}
