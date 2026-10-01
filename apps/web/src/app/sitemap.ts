import type { MetadataRoute } from 'next';
import { getTemplates, serverApi } from '@/lib/server-api';

export const revalidate = 600;

/** Public pages only: marketing, templates and PUBLIC + LISTED events. Private links never appear. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const [templates, events] = await Promise.all([
    getTemplates(),
    serverApi<Array<{ slug: string; updatedAt: string }>>('/public/events/sitemap', { revalidate: 600 }).then((e) => e ?? []),
  ]);
  const staticPages = ['', '/templates', '/pricing', '/about', '/contact', '/privacy', '/terms', '/refund'];
  return [
    ...staticPages.map((p) => ({ url: `${origin}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...templates.map((t) => ({ url: `${origin}/templates/${t.key}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...events.map((e) => ({ url: `${origin}/e/${e.slug}`, lastModified: e.updatedAt, changeFrequency: 'daily' as const, priority: 0.5 })),
  ];
}
