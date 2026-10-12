import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilmStudio } from '@/components/studio/film-studio';
import { getTemplate } from '@/lib/server-api';

// A visitor's own words (kept in their browser): rendered per request with the strict policy and no trackers (lib/private-routes.ts).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const tpl = await getTemplate(key);
  return { title: tpl ? `Design ${tpl.name} · Video invitation` : 'Design your video invitation', robots: { index: false, follow: true } };
}

/** A video invitation on the canvas, before signing in (ADR-063). */
export default async function DesignVideoPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ event?: string }> }) {
  const [{ key }, { event }] = await Promise.all([params, searchParams]);
  const tpl = await getTemplate(key);
  if (!tpl?.definition || tpl.definition.type !== 'VIDEO') notFound();
  const eventType = typeof event === 'string' && tpl.eventTypes.includes(event) ? event : (tpl.eventTypes[0] ?? 'WEDDING');
  return (
    <main className="min-h-dvh bg-ivory">
      <FilmStudio template={{ key: tpl.key, name: tpl.name, definition: tpl.definition, tags: tpl.tags }} eventType={eventType} />
    </main>
  );
}
