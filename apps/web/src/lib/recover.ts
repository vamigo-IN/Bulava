'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';

/**
 * A script of an older release that no longer exists: a tab left open across a deploy
 * asks for a chunk the server has replaced. Only a fresh page load fixes it.
 */
export function isChunkError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return !!e && (e.name === 'ChunkLoadError' || /loading (css )?chunk|dynamically imported module|importing a module script failed|failed to fetch dynamically/i.test(e.message ?? ''));
}

const RELOADED = 'bulava.reloaded';

/**
 * Error boundaries' "Try again": after a deploy, reload once on its own (a stale chunk);
 * otherwise fetch the page's server data again and re-render it. `reset()` alone re-renders
 * with the same failed data, so a page that failed on the server would fail again forever.
 */
export function useRecover(error: unknown, reset: () => void): () => void {
  const router = useRouter();
  const chunk = isChunkError(error);
  useEffect(() => {
    if (!chunk) return;
    try {
      // At most once in 30 seconds, so a file missing on the server can never loop the page.
      if (Date.now() - Number(sessionStorage.getItem(RELOADED) ?? 0) < 30_000) return;
      sessionStorage.setItem(RELOADED, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [chunk]);
  return () => {
    if (chunk) {
      window.location.reload();
      return;
    }
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
}
