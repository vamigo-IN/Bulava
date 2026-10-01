'use client';

import { useEffect, useState } from 'react';

/** Set by the API next to the httpOnly session cookies; it holds no secret. */
const HINT_COOKIE = 'bulava_session';

export interface SignedInUser {
  name: string;
  email: string | null;
}

export type SessionState = { status: 'unknown' } | { status: 'anonymous' } | { status: 'signed-in'; user: SignedInUser };

function hasHint(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${HINT_COOKIE}=`));
}

function clearHint(): void {
  document.cookie = `${HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

async function me(): Promise<Response> {
  return fetch('/api/v1/users/me', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
}

let pending: Promise<SessionState> | null = null;

/**
 * Who is signed in, for public pages. Unlike the dashboard client this never
 * redirects: a stale hint (signed out elsewhere, session expired) quietly
 * becomes "anonymous". One request per page load, shared by every caller.
 */
export function loadSession(): Promise<SessionState> {
  pending ??= (async (): Promise<SessionState> => {
    if (!hasHint()) return { status: 'anonymous' };
    try {
      let res = await me();
      if (res.status === 401) {
        const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'x-bulava-csrf': '1' } });
        if (refreshed.ok) res = await me();
      }
      if (!res.ok) {
        clearHint();
        return { status: 'anonymous' };
      }
      const body = (await res.json()) as { data?: SignedInUser };
      return body.data ? { status: 'signed-in', user: { name: body.data.name, email: body.data.email } } : { status: 'anonymous' };
    } catch {
      return { status: 'anonymous' };
    }
  })();
  return pending;
}

/** Session state for rendering. Starts as "unknown" on the server and the first client render. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'unknown' });
  useEffect(() => {
    let alive = true;
    void loadSession().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
