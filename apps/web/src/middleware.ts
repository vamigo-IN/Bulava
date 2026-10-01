import { NextResponse, type NextRequest } from 'next/server';
import { withExtraSources, type CspExtras } from '@/lib/csp';
import { isPrivatePath } from '@/lib/private-routes';

/**
 * 1. Customer domains: a request whose Host is an event's own domain serves
 *    that event (its page at "/", plus invitation and photo-room links);
 *    anything else goes to the main site, and unknown hosts get a 404.
 * 2. Secret event links (`/e/<slug>?k=<key>`, or `/?k=<key>` on an event's
 *    own domain): the key moves into an httpOnly cookie for that event and the
 *    visitor continues at the clean address, so it does not linger in the
 *    address bar, history or referrers. The API checks it on every request.
 * 3. Content-Security-Policy: private pages get a nonce-based policy, so only
 *    scripts carrying this request's nonce (Next.js adds it to its own) or
 *    loaded by them may run, and an injected <script> is refused. These routes
 *    render per request. Pre-rendered marketing pages keep the static policy,
 *    plus the hosts that the trackers and code snippets configured in the
 *    admin console need (never added to private pages).
 */

const MAIN_ORIGIN = (process.env.BULAVA_WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');
const MAIN_HOST = new URL(MAIN_ORIGIN).hostname;
const API = (process.env.BULAVA_API_INTERNAL_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

/** The main site, plus internal names (no dot) and IPs used by health checks and proxies. */
function isMainHost(host: string): boolean {
  return host === MAIN_HOST || host === `www.${MAIN_HOST}` || !host.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

const hostCache = new Map<string, { slug: string | null; expires: number }>();

async function eventForHost(host: string): Promise<string | null> {
  const cached = hostCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${API}/api/v1/public/domains/resolve?host=${encodeURIComponent(host)}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (res.ok) slug = ((await res.json()) as { data?: { slug?: string } }).data?.slug ?? null;
    else if (res.status !== 404) return cached?.slug ?? null;
  } catch {
    return cached?.slug ?? null;
  }
  if (hostCache.size > 2000) hostCache.clear();
  hostCache.set(host, { slug, expires: Date.now() + (slug ? 60_000 : 30_000) });
  return slug;
}

let extras: { value: CspExtras | null; expires: number } | null = null;

/** The public pages' extra sources from the site settings, cached for a minute (the last known ones if the API is down). */
async function publicCspExtras(): Promise<CspExtras | null> {
  if (extras && extras.expires > Date.now()) return extras.value;
  try {
    const res = await fetch(`${API}/api/v1/public/site-config`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const value = ((await res.json()) as { data?: { csp?: CspExtras } }).data?.csp ?? null;
      extras = { value, expires: Date.now() + 60_000 };
      return value;
    }
  } catch {
    // Fall through: keep serving the last known sources.
  }
  extras = { value: extras?.value ?? null, expires: Date.now() + 15_000 };
  return extras.value;
}

async function withPolicy(request: NextRequest, rewriteTo?: URL): Promise<NextResponse> {
  if (!isPrivatePath(rewriteTo?.pathname ?? request.nextUrl.pathname)) {
    const response = rewriteTo ? NextResponse.rewrite(rewriteTo) : NextResponse.next();
    response.headers.set('Content-Security-Policy', withExtraSources(process.env.BULAVA_CSP_STATIC!, await publicCspExtras()));
    return response;
  }
  const nonce = btoa(crypto.randomUUID());
  const policy = process.env.BULAVA_CSP_STRICT!.replaceAll('{NONCE}', nonce);
  // Next.js reads the nonce from the request's policy and stamps its scripts with it.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = rewriteTo ? NextResponse.rewrite(rewriteTo, { request: { headers } }) : NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

/** `?k=<key>` on an event page: keep the key for this event in a cookie and continue without it. */
function secretLinkRedirect(request: NextRequest, slug: string): NextResponse | null {
  const key = request.nextUrl.searchParams.get('k');
  if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
  const clean = request.nextUrl.clone();
  clean.searchParams.delete('k');
  const response = NextResponse.redirect(clean, 307);
  response.cookies.set(`bulava_link_${slug}`, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 90 * 24 * 3600,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  if (!host || isMainHost(host)) {
    const eventPage = /^\/e\/([a-z0-9-]{1,120})$/.exec(request.nextUrl.pathname);
    if (eventPage) {
      const redirect = secretLinkRedirect(request, eventPage[1]!);
      if (redirect) return redirect;
    }
    return withPolicy(request);
  }

  const slug = await eventForHost(host);
  if (!slug) return new NextResponse('This site is not available.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { pathname, search } = request.nextUrl;
  if (pathname === '/') {
    const redirect = secretLinkRedirect(request, slug);
    if (redirect) return redirect;
    const url = request.nextUrl.clone();
    url.pathname = `/e/${slug}`;
    return withPolicy(request, url);
  }
  if (pathname === `/e/${slug}`) return NextResponse.redirect(new URL(`/${search}`, request.url), 308);
  // Guests' personal links work on the event's domain; everything else lives on the main site.
  if (pathname.startsWith('/invite/') || pathname.startsWith('/p/') || pathname === '/healthz') return withPolicy(request);
  return NextResponse.redirect(`${MAIN_ORIGIN}${pathname}${search}`, 307);
}

export const config = {
  matcher: [
    {
      // Documents only: not the API proxy, static files or images.
      source: '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|webmanifest)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
