'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { PublicSiteConfig } from '@bulava/validation';
import { isPrivatePath } from '@/lib/private-routes';

type Fn = ((...args: unknown[]) => void) & Record<string, unknown>;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: Fn;
  _fbq?: Fn;
  clarity?: Fn;
  lintrk?: Fn;
  _linkedin_partner_id?: string;
  _linkedin_data_partner_ids?: string[];
  posthog?: { init: (key: string, options: object) => void; capture: (name: string, properties?: object) => void };
};

/** Module state: survives client-side navigation, reset by a full page load. */
const state = { requested: false, loaded: false, config: null as PublicSiteConfig | null };

function addScript(src: string, onload?: () => void) {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  if (onload) s.onload = onload;
  document.head.appendChild(s);
}

/** Admin-provided HTML. Scripts in a contextual fragment run when inserted (unlike innerHTML). */
function injectHtml(html: string, target: HTMLElement) {
  if (!html.trim()) return;
  target.appendChild(document.createRange().createContextualFragment(html));
}

function loadTrackers(t: PublicSiteConfig['tracking']): boolean {
  const w = window as AnalyticsWindow;
  let any = false;

  const gtagIds = [t.ga4Id, t.googleAdsId].filter((id): id is string => Boolean(id));
  if (gtagIds.length || t.gtmId) {
    w.dataLayer = w.dataLayer ?? [];
  }
  if (gtagIds.length) {
    w.gtag = function gtag() {
      // gtag.js reads the arguments object itself.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
    for (const id of gtagIds) w.gtag('config', id, id.startsWith('G-') ? { anonymize_ip: true } : {});
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagIds[0]!)}`);
    any = true;
  }
  if (t.gtmId) {
    w.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(t.gtmId)}`);
    any = true;
  }
  if (t.metaPixelId) {
    const fbq = function (...args: unknown[]) {
      if (typeof fbq.callMethod === 'function') (fbq.callMethod as (...a: unknown[]) => void)(...args);
      else (fbq.queue as unknown[]).push(args);
    } as Fn;
    Object.assign(fbq, { push: fbq, loaded: true, version: '2.0', queue: [] });
    w.fbq = fbq;
    w._fbq = w._fbq ?? fbq;
    addScript('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', t.metaPixelId);
    fbq('track', 'PageView');
    any = true;
  }
  if (t.clarityId) {
    const clarity = function (...args: unknown[]) {
      const queue = (clarity.q as unknown[] | undefined) ?? [];
      clarity.q = queue;
      queue.push(args);
    } as Fn;
    w.clarity = w.clarity ?? clarity;
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(t.clarityId)}`);
    any = true;
  }
  if (t.linkedinPartnerId) {
    w._linkedin_partner_id = t.linkedinPartnerId;
    w._linkedin_data_partner_ids = [...(w._linkedin_data_partner_ids ?? []), t.linkedinPartnerId];
    const lintrk = function (a: unknown, b: unknown) {
      (lintrk.q as unknown[]).push([a, b]);
    } as unknown as Fn;
    lintrk.q = [];
    w.lintrk = w.lintrk ?? lintrk;
    addScript('https://snap.licdn.com/li.lms-analytics/insight.min.js');
    any = true;
  }
  if (t.posthogKey) {
    const host = (t.posthogHost ?? 'https://us.i.posthog.com').replace(/\/$/, '');
    addScript(`${host.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`, () =>
      w.posthog?.init(t.posthogKey!, { api_host: host, person_profiles: 'identified_only', capture_pageview: 'history_change' }),
    );
    any = true;
  }
  return any;
}

/**
 * Trackers and the Super Admin's code snippets (Site settings > Tracking &
 * code), loaded only on public marketing pages, never on private pages
 * (dashboard, sign-in, invitations, photo rooms, check-in, walls, event
 * pages), so tokens and personal data never reach third parties. Everything
 * is added from this bundle rather than inline, which keeps private pages'
 * nonce-based Content-Security-Policy intact. Moving from a public page into a
 * private one reloads the page, so nothing loaded here keeps running there.
 */
export function AnalyticsScripts() {
  const pathname = usePathname();
  useEffect(() => {
    if (isPrivatePath(pathname)) {
      if (state.loaded) window.location.reload();
      return;
    }
    if (state.loaded) {
      // Single-page navigation between public pages: GA4, Clarity and PostHog follow history changes themselves.
      (window as AnalyticsWindow).fbq?.('track', 'PageView');
      return;
    }
    if (state.requested) return;
    state.requested = true;
    void fetch('/api/v1/public/site-config', { credentials: 'omit' })
      .then((res) => (res.ok ? (res.json() as Promise<{ success: boolean; data: PublicSiteConfig }>) : null))
      .then((body) => {
        if (!body?.success || isPrivatePath(window.location.pathname)) return;
        const config = body.data;
        const trackers = loadTrackers(config.tracking);
        injectHtml(config.code.headHtml, document.head);
        injectHtml(config.code.bodyHtml, document.body);
        state.loaded = trackers || Boolean(config.code.headHtml.trim() || config.code.bodyHtml.trim());
      })
      .catch(() => {
        state.requested = false;
      });
  }, [pathname]);
  return null;
}
