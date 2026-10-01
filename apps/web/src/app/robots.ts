import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@/lib/site-config';

export const revalidate = 60;

/** Pages that are personal or behind a sign-in; never crawled, whatever the settings say. */
const ALWAYS_DISALLOWED = ['/invite/', '/p/', '/checkin/', '/wall/', '/dashboard', '/api/', '/login', '/signup'];

/** robots.txt from the admin console (Site settings > SEO): indexing, extra disallowed paths and AI crawlers. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const { seo } = await getSiteConfig();
  if (!seo.indexing) return { rules: [{ userAgent: '*', disallow: '/' }] };
  const blocked = Object.entries(seo.aiCrawlers)
    .filter(([, rule]) => rule === 'block')
    .map(([bot]) => bot);
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...ALWAYS_DISALLOWED, ...seo.robotsDisallow] },
      ...(blocked.length ? [{ userAgent: blocked, disallow: '/' }] : []),
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
