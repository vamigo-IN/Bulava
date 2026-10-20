import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TemplateStyles, TemplateThumbnail } from '@bulava/template-engine';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { LookNotFound, loadLook } from '@/components/previews/look-data';
import { LookPage } from '@/components/previews/look-page';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

// A private, unlisted page: no names in the metadata, never indexed, no referrer.
export const metadata: Metadata = {
  title: 'Your invitation preview',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/** What a website's preview link serves (GET /public/preview/:token), as far as its thumbnail needs. */
interface WebsitePreview {
  published?: boolean;
  template: { definition: TemplateDefinition; customization: Customization | null };
  context: RenderContext;
}

/**
 * The customer's preview page (ADR-076, docs/previews.md): what a preview
 * provider made for them, shared from the preview desk, with the way to make
 * it theirs. The token in the path is checked by the API (it receives it in a
 * header). Each website shows its own opening, with the customer's names, as
 * its picture (never the template's sample).
 */
export default async function LookRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadLook(token);
  if (!view) return <LookNotFound />;
  const websites = view.items.filter((i) => i.kind === 'WEBSITE' && i.href?.startsWith('/preview/'));
  const thumbs: Record<string, ReactNode> = Object.fromEntries(
    await Promise.all(
      websites.map(async (item) => {
        const site = await serverApi<WebsitePreview>(`/public/preview/${encodeURIComponent(item.href!.split('/').pop()!)}`, { revalidate: false });
        return [item.id, site && !site.published ? <TemplateThumbnail definition={site.template.definition} customization={site.template.customization} context={site.context} width={216} height={384} sections={3} /> : null] as const;
      }),
    ),
  );
  return (
    <>
      {Object.values(thumbs).some(Boolean) ? <TemplateStyles /> : null}
      <LookPage token={token} initial={view} thumbs={thumbs} />
    </>
  );
}
