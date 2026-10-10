'use client';

import { useEffect, useState } from 'react';

export interface Providers {
  google: boolean;
  /** Sign-in codes on WhatsApp (needs the WhatsApp Business integration and its authentication template). */
  phoneOtp: boolean;
  /** Codes by email can be sent: signing up with an email and resetting a password need them. */
  emailCodes: boolean;
}

// Until the API answers, the email form shows (it is nearly always available) and the buttons wait.
const NONE: Providers = { google: false, phoneOtp: false, emailCodes: true };
let providers: Promise<Providers> | null = null;

/** Which sign-in methods the API offers (cached for the page). */
export function loadProviders(): Promise<Providers> {
  providers ??= fetch('/api/v1/auth/providers', { cache: 'no-store' })
    .then((r) => r.json() as Promise<{ data?: Partial<Providers> }>)
    .then((b) => ({ ...NONE, ...b.data }))
    .catch(() => NONE);
  return providers;
}

export function useProviders(): Providers {
  const [state, setState] = useState<Providers>(NONE);
  useEffect(() => {
    let alive = true;
    void loadProviders().then((p) => alive && setState(p));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Google's "G" mark, as Google's sign-in branding guidelines require. */
export function GoogleMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Continue with Google": a plain navigation to the API, which redirects to Google.
 * Someone new comes back to the sign-in page's last step (a name and the Terms box).
 */
export function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    // A redirect endpoint on the API, not a page: a plain link is correct.
    <a href={`/api/v1/auth/google/start?next=${encodeURIComponent(next)}`} className="btn-3d btn-3d-light min-h-12 w-full gap-3 rounded-2xl px-5 font-medium">
      <GoogleMark />
      {label}
    </a>
  );
}
