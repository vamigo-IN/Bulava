'use client';

import { RotateCcw, WifiOff } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { errorMessage, isNetworkError, useT } from '@/lib/i18n';
import { Button } from '@/components/ui/primitives';

/**
 * A read that failed (no signal, the API down for a moment). It says so and offers a retry,
 * and never shows an empty state instead: "You have not created any events yet" after a
 * failed request makes a host think their wedding is gone.
 */
export function LoadError({ error, onRetry, retrying = false }: { error: unknown; onRetry: () => void; retrying?: boolean }) {
  const t = useT();
  // A refusal or a known problem says what it is; anything else is a hiccup worth retrying.
  const body = isNetworkError(error) || (error instanceof ApiError && error.status < 500) ? errorMessage(t, error) : t('load.failed.body');
  return (
    <div role="alert" className="clay mx-auto mt-6 max-w-lg rounded-[2rem] p-8 text-center">
      <span aria-hidden className="icon-3d mx-auto size-14 rounded-2xl">
        <WifiOff className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-3xl">{t('load.failed.title')}</h1>
      <p className="mt-2 leading-relaxed text-stone-600">{body}</p>
      <p className="mt-2 text-sm text-stone-500">{t('load.failed.safe')}</p>
      <Button size="lg" className="mt-7 rounded-2xl" onClick={onRetry} disabled={retrying}>
        <RotateCcw aria-hidden className={retrying ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} />
        {retrying ? t('common.loading') : t('errorPage.retry')}
      </Button>
    </div>
  );
}
