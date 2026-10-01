import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AnalyticsScripts } from '@/components/analytics';
import { getSiteConfig, shareImages } from '@/lib/site-config';
import { fontVariables } from './fonts';
import { QueryProvider } from './providers';
import './globals.css';

const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

/** Title, description, icons, share images and verification tags come from the admin console (Site settings > SEO). */
export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const { site, seo } = config;
  const v = seo.verification;
  const other: Record<string, string> = {};
  if (v.bing) other['msvalidate.01'] = v.bing;
  if (v.pinterest) other['p:domain_verify'] = v.pinterest;
  if (v.facebook) other['facebook-domain-verification'] = v.facebook;
  const images = shareImages(config);
  return {
    title: { default: seo.title, template: seo.titleTemplate },
    description: seo.description,
    ...(seo.keywords.length ? { keywords: seo.keywords } : {}),
    applicationName: site.name,
    metadataBase: new URL(origin),
    icons: { icon: site.faviconUrl ?? '/brand-icon.svg' },
    openGraph: { siteName: site.name, type: 'website', locale: 'en_IN', images },
    twitter: { card: 'summary_large_image', images, ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}) },
    verification: { ...(v.google ? { google: v.google } : {}), ...(v.yandex ? { yandex: v.yandex } : {}), ...(Object.keys(other).length ? { other } : {}) },
    // Pre-launch or staging: ask every search engine to stay away (robots.txt says the same).
    ...(seo.indexing ? {} : { robots: { index: false, follow: false } }),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { site } = await getSiteConfig();
  return { width: 'device-width', initialScale: 1, themeColor: site.themeColor };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh font-sans">
        <QueryProvider>{children}</QueryProvider>
        <AnalyticsScripts />
      </body>
    </html>
  );
}
