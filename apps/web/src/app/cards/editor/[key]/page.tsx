import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasCardDesign, type TemplateDefinition } from '@bulava/template-schema';
import { CardEditor } from '@/components/cards/card-editor';
import { getTemplate, serverApi } from '@/lib/server-api';
import { getSiteConfig } from '@/lib/site-config';

// The editor works with a visitor's own card (names, photos, a phone number): rendered per request
// with the strict policy and no trackers (lib/private-routes.ts).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const tpl = await getTemplate(key);
  return { title: tpl ? `Customise ${tpl.name} · Digital card` : 'Digital card', robots: { index: false, follow: true } };
}

/** Only what the card editor uses from the definition: the opening section, palette, fonts and languages. */
function forCards(definition: TemplateDefinition): TemplateDefinition {
  const first = definition.website!.pages[0]!;
  return { ...definition, website: { ...definition.website!, pages: [{ ...first, sections: first.sections.slice(0, 1) }] }, scenes: undefined, artworks: undefined };
}

export default async function CardEditorPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ event?: string }> }) {
  const [{ key }, { event }] = await Promise.all([params, searchParams]);
  const [tpl, eventTypes, site] = await Promise.all([
    getTemplate(key),
    serverApi<Array<{ key: string; name: string }>>('/meta/event-types', { revalidate: 300 }).then((e) => e ?? []),
    getSiteConfig(),
  ]);
  if (!tpl?.definition || !hasCardDesign(tpl.definition)) notFound();
  return (
    <CardEditor
      template={{ key: tpl.key, name: tpl.name, category: tpl.category, definition: forCards(tpl.definition), eventTypes: tpl.eventTypes, tags: tpl.tags }}
      occasions={eventTypes.map((e) => ({ key: e.key, name: e.name.split(' / ')[0]! }))}
      initialEvent={typeof event === 'string' ? event : undefined}
      siteName={site.site.name}
    />
  );
}
