import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { TemplateDemo } from '@/components/marketing/template-demo';
import { getTemplate } from '@/lib/server-api';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const tpl = await getTemplate(key);
  return {
    title: tpl ? `${tpl.name} · live demo` : 'Template not found',
    // The demo repeats the template page's content with sample names; keep it out of search results.
    robots: { index: false, follow: true },
    alternates: tpl ? { canonical: `/templates/${tpl.key}` } : undefined,
  };
}

/** The template exactly as a guest sees it on their phone: opening, effects, 3D scenes, with sample names and photos. */
export default async function TemplateDemoPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const tpl = await getTemplate(key);
  if (!tpl?.definition) notFound();
  if (tpl.definition.type !== 'WEBSITE') redirect(`/templates/${tpl.key}`);
  return <TemplateDemo definition={tpl.definition} templateKey={tpl.key} name={tpl.name} eventType={tpl.eventTypes[0] ?? 'WEDDING'} eventTypes={tpl.eventTypes} />;
}
