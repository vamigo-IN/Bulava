import path from 'node:path';
import type { NextConfig } from 'next';

const apiInternalUrl = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
/** Origin serving signed storage URLs (R2 custom domain in production, SeaweedFS locally). */
const storageOrigin = process.env.STORAGE_PUBLIC_ORIGIN || 'http://localhost:9000';
const analytics = {
  posthog: process.env.NEXT_PUBLIC_POSTHOG_KEY ? (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com') : null,
  ga: process.env.NEXT_PUBLIC_GA4_ID ? 'https://www.googletagmanager.com https://www.google-analytics.com' : null,
};
const isDev = process.env.NODE_ENV === 'development';

const scriptHosts = [
  'https://checkout.razorpay.com',
  analytics.posthog ? 'https://us-assets.i.posthog.com https://eu-assets.i.posthog.com' : '',
  analytics.ga ?? '',
]
  .filter(Boolean)
  .join(' ');

const shared = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${storageOrigin}`,
  // data: is used by the Remotion player to unlock audio playback.
  `media-src 'self' blob: data: ${storageOrigin} https:`,
  "font-src 'self' data:",
  ["connect-src 'self'", storageOrigin, 'https://*.razorpay.com', analytics.posthog ?? '', analytics.ga ?? ''].join(' '),
  // Google Maps embeds on invitations (when the Super Admin turns on Maps in Integrations).
  "frame-src 'self' https://*.razorpay.com https://www.google.com/maps/embed/",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
];

/**
 * Two policies, chosen per request by src/middleware.ts:
 * - strict (dashboard, sign-in, guest and event pages): scripts only with this
 *   request's nonce or loaded by such scripts ('strict-dynamic'); hosts and
 *   'self' remain as fallbacks for browsers without CSP3.
 * - static (marketing pages, which are pre-rendered and cached, so they cannot
 *   carry a per-request nonce): the previous policy with inline scripts.
 */
const cspStrict = [
  `script-src 'nonce-{NONCE}' 'strict-dynamic' 'self' ${scriptHosts}${isDev ? " 'unsafe-eval'" : ''}`,
  "object-src 'none'",
  ...shared,
].join('; ');
const cspStatic = [`script-src 'self' 'unsafe-inline' ${scriptHosts}${isDev ? " 'unsafe-eval'" : ''}`, "object-src 'none'", ...shared].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  // Content-Security-Policy is set per request in src/middleware.ts.
];

const privateHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'private, no-store' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace workspace packages from the monorepo root into the standalone bundle.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Next's server references @rspack/core for rspack builds (NEXT_RSPACK) and the tracer follows it,
  // copying rspack (a native binary, and a vendored tinypool with critical CVEs) into the image.
  // `next start` never loads it.
  outputFileTracingExcludes: { '*': ['**/@rspack/**'] },
  // Source-only workspace packages (React/Remotion components) compiled by Next.
  transpilePackages: ['@bulava/template-engine', '@bulava/video-engine'],
  poweredByHeader: false,
  // Linting runs once for the whole monorepo (`pnpm lint` in CI), not per app build.
  eslint: { ignoreDuringBuilds: true },
  // Render metadata in <head> before the page instead of streaming it in a Suspense
  // boundary at the top of <body>. On slow phones the cached app bundle could start
  // hydrating before that boundary resolved, which surfaced as React hydration error
  // #418 on dynamic pages (template gallery and detail pages).
  htmlLimitedBots: /.*/,
  // Build-time policies for the middleware (not secret).
  env: {
    BULAVA_CSP_STRICT: cspStrict,
    BULAVA_CSP_STATIC: cspStatic,
    // For routing requests that arrive on customers' own domains.
    BULAVA_WEB_ORIGIN: process.env.WEB_ORIGIN || 'http://localhost:3000',
    BULAVA_API_INTERNAL_URL: apiInternalUrl,
  },
  reactStrictMode: true,
  // Browser calls go to the same origin and are proxied to the API, so auth
  // cookies are first-party and no CORS is needed for the web app.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Secret-bearing URLs: never leak via Referer, never index, never cache.
      { source: '/invite/:token*', headers: privateHeaders },
      { source: '/p/:code*', headers: privateHeaders },
      { source: '/checkin/:code*', headers: privateHeaders },
    ];
  },
};

export default nextConfig;
