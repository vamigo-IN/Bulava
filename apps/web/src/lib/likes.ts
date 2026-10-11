'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Hearts on designs (ADR-055). The buttons on a page ask for their designs
 * together (one GET /public/likes for the page), and a heart changes at once
 * when tapped, then settles on what the API answers. Counts are null while the
 * console keeps them hidden (or below its minimum): the heart shows without a number.
 */
interface LikeState {
  liked: boolean;
  count: number | null;
  busy: boolean;
}

const EMPTY: LikeState = { liked: false, count: null, busy: false };
const states = new Map<string, LikeState>();
const listeners = new Map<string, Set<() => void>>();
const asked = new Set<string>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const CHUNK = 120;

function put(key: string, next: LikeState) {
  states.set(key, next);
  listeners.get(key)?.forEach((fn) => fn());
}

async function flush() {
  timer = null;
  const keys = [...queue];
  queue = new Set();
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    try {
      const res = await fetch(`/api/v1/public/likes?keys=${chunk.map(encodeURIComponent).join(',')}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
      const body = (await res.json()) as { success: boolean; data?: { liked: string[]; counts: Record<string, number | null> } };
      if (!body.success || !body.data) continue;
      const liked = new Set(body.data.liked);
      for (const key of chunk) {
        const current = states.get(key) ?? EMPTY;
        // A tap that landed while the page was asking wins.
        if (!current.busy) put(key, { liked: liked.has(key), count: body.data.counts[key] ?? null, busy: false });
      }
    } catch {
      // Offline or blocked: hearts stay empty, and a tap still works.
    }
  }
}

function ask(key: string) {
  if (asked.has(key)) return;
  asked.add(key);
  queue.add(key);
  if (!timer) timer = setTimeout(() => void flush(), 40);
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

/** A design's heart: whether this viewer liked it, the count when it may be shown, and the toggle. */
export function useLike(key: string) {
  const state = useSyncExternalStore(
    useCallback((fn) => subscribe(key, fn), [key]),
    () => states.get(key) ?? EMPTY,
    () => EMPTY,
  );
  useEffect(() => ask(key), [key]);

  const toggle = useCallback(async (): Promise<string | null> => {
    const before = states.get(key) ?? EMPTY;
    if (before.busy) return null;
    const liked = !before.liked;
    put(key, { liked, count: before.count === null ? null : Math.max(0, before.count + (liked ? 1 : -1)), busy: true });
    try {
      const res = await fetch(`/api/v1/public/templates/${encodeURIComponent(key)}/like`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-bulava-csrf': '1' },
        body: JSON.stringify({ liked }),
      });
      const body = (await res.json()) as { success: boolean; data?: { liked: boolean; likes: number | null }; error?: { code?: string } };
      if (!body.success || !body.data) {
        put(key, { ...before, busy: false });
        return body.error?.code ?? 'ERROR';
      }
      put(key, { liked: body.data.liked, count: body.data.likes, busy: false });
      return null;
    } catch {
      put(key, { ...before, busy: false });
      return 'ERROR';
    }
  }, [key]);

  return { ...state, toggle };
}
