import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createTranslator } from '@bulava/localization';
import { TemplateRenderer } from '@bulava/template-engine';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { PreviewBar } from '@/components/preview/preview-bar';

export const dynamic = 'force-dynamic';

// A private, unlisted page: no event details in the metadata, never indexed.
export const metadata: Metadata = {
  title: 'Invitation preview',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/** After publishing, the preview only names the public page. */
interface PublishedPreview {
  published: true;
  event: { slug: string; status: string };
}

interface PreviewView {
  published?: undefined;
  event: { id: string; title: string; slug: string; typeKey: string; language: string; timezone: string; status: string; accessMode: string };
  template: { key: string; name: string; tier: 'FREE' | 'STANDARD' | 'PREMIUM'; definition: TemplateDefinition; customization: Customization | null };
  context: RenderContext;
  watermark: boolean;
}

async function load(token: string): Promise<PreviewView | PublishedPreview | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${apiBase}/api/v1/public/preview/${encodeURIComponent(token)}`, { cache: 'no-store', headers: { accept: 'application/json' } });
    const body = (await res.json().catch(() => null)) as { success: true; data: PreviewView | PublishedPreview } | { success: false } | null;
    return body?.success ? body.data : null;
  } catch {
    return null;
  }
}

/**
 * The host's preview link: the invitation exactly as guests will see it, with
 * a "Preview" mark, before publishing and whatever the access mode. Family
 * can look and share; nobody can RSVP from here. Once published, the link
 * leads to the public page instead.
 */
export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await load(token);
  if (!view) {
    const t = createTranslator('en');
    return (
      <main className="paper flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl text-brand-700">{t('preview.notFound.title')}</h1>
          <p className="mt-3 text-stone-600">{t('preview.notFound.body')}</p>
        </div>
      </main>
    );
  }
  if (view.published) redirect(`/e/${view.event.slug}`);
  return (
    <>
      <div className="pb-28">
        <TemplateRenderer
          definition={view.template.definition}
          customization={view.template.customization}
          context={view.context}
          language={view.event.language}
          mode="live"
          introKey={`preview-${view.event.id}`}
          slots={{ watermark: true }}
        />
      </div>
      <PreviewBar eventId={view.event.id} language={view.event.language} status={view.event.status} templateName={view.template.name} />
    </>
  );
}
