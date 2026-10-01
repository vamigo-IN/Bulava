import path from 'node:path';
import type { NextConfig } from 'next';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
/** Origin serving signed storage URLs (R2 custom domain in production, SeaweedFS locally). */
const storageOrigin = process.env.STORAGE_PUBLIC_ORIGIN ?? 'http://localhost:9000';
const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  // Nonce per request (src/middleware.ts); scripts loaded by nonced scripts are allowed.
  `script-src 'nonce-{NONCE}' 'strict-dynamic' 'self'${isDev ? " 'unsafe-eval'" : ''}`,
  "object-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storageOrigin}`,
  // data: is used by the Remotion player to unlock audio playback.
  `media-src 'self' blob: data: ${storageOrigin}`,
  "font-src 'self' data:",
  // Direct uploads of assets and music go to signed storage URLs.
  `connect-src 'self' ${storageOrigin}`,
  // The Google Maps preview in Integrations (the same embed invitations use).
  "frame-src https://www.google.com/maps/embed/",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@bulava/template-engine', '@bulava/video-engine'],
  poweredByHeader: false,
  // Linting runs once for the whole monorepo (`pnpm lint` in CI), not per app build.
  eslint: { ignoreDuringBuilds: true },
  // Build-time policy for the middleware (not secret).
  env: { BULAVA_CSP: csp },
  reactStrictMode: true,
  // Same-origin API proxy: the admin session cookies stay first-party and httpOnly
  // on the admin domain, separate from customer sessions on the main site.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        // Everything except hashed static assets, which keep Next's immutable caching.
        source: '/((?!_next/static).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
          // Content-Security-Policy is set per request in src/middleware.ts.
        ],
      },
    ];
  },
};

export default nextConfig;
