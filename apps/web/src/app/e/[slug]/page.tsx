import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createTranslator } from '@bulava/localization';
import { TemplateRenderer } from '@bulava/template-engine';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { PinGate } from '@/components/invite/pin-gate';
import { RegistrationIsland } from '@/components/invite/registration-form';
import type { PublicRegistrationInfo } from '@/lib/types';
import { getSiteConfig, shareImages } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

interface PublicEventView {
  event: { title: string; slug: string; description: string | null; typeKey: string; language: string; timezone: string; status: string; accessMode: string; indexable: boolean };
  template: { key: string; definition: TemplateDefinition; customization: Customization | null };
  context: RenderContext;
  watermark: boolean;
  registration: PublicRegistrationInfo | null;
}

/** `hadKey`: the visitor brought a secret link's key (so a refusal means that link no longer works). */
type Result = { ok: true; data: PublicEventView } | { ok: false; code: string; hadKey: boolean };

const load = cache(async (slug: string): Promise<Result> => {
  const jar = await cookies();
  const pass = jar.get(`bulava_pin_${slug}`)?.value;
  // A secret link's key, kept by the middleware when the visitor opened /e/<slug>?k=<key>.
  const linkKey = jar.get(`bulava_link_${slug}`)?.value;
  const apiBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${apiBase}/api/v1/public/events/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', ...(pass ? { 'x-bulava-pin-pass': pass } : {}), ...(linkKey ? { 'x-bulava-link-key': linkKey } : {}) },
    });
    const body = (await res.json().catch(() => null)) as { success: true; data: PublicEventView } | { success: false; error: { code: string } } | null;
    if (body?.success) return { ok: true, data: body.data };
    return { ok: false, code: body && !body.success ? body.error.code : 'INTERNAL_ERROR', hadKey: !!linkKey };
  } catch {
    return { ok: false, code: 'INTERNAL_ERROR', hadKey: !!linkKey };
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await load(slug);
  // Only public, listed events get titles, descriptions and rich previews.
  if (!result.ok || !result.data.event.indexable) {
    return { title: 'You are invited', robots: { index: false, follow: false } };
  }
  const e = result.data.event;
  // A page's openGraph replaces the site's, so repeat the share image.
  const images = shareImages(await getSiteConfig());
  return {
    title: e.title,
    description: e.description ?? undefined,
    alternates: { canonical: `/e/${e.slug}` },
    openGraph: { title: e.title, description: e.description ?? undefined, type: 'website', url: `/e/${e.slug}`, images },
  };
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await load(slug);
  const t = createTranslator('en');
  if (!result.ok) {
    if (result.code === 'PIN_REQUIRED') return <PinGate slug={slug} />;
    if (result.code === 'INVITATION_REQUIRED' || result.code === 'EVENT_LINK_EXPIRED') {
      // Expired secret link; a secret link that was replaced (or mistyped); or no way in at all.
      const state = result.code === 'EVENT_LINK_EXPIRED' ? 'linkExpired' : result.hadKey ? 'linkInvalid' : 'private';
      return (
        <main className="paper flex min-h-dvh items-center justify-center px-6 text-center">
          <div>
            <h1 className="font-display text-4xl text-brand-700">{t(`event.${state}.title`)}</h1>
            <p className="mt-3 text-stone-600">{t(`event.${state}.body`)}</p>
          </div>
        </main>
      );
    }
    notFound();
  }
  const { data } = result;
  const registration = data.registration ? (
    <RegistrationIsland slug={data.event.slug} info={data.registration} language={data.event.language} timeZone={data.event.timezone} />
  ) : undefined;
  const hasRsvpSection = data.template.definition.website?.pages.some((page) => page.sections.some((s) => s.section === 'rsvp')) ?? false;
  const tr = createTranslator(data.event.language);
  return (
    <>
      <TemplateRenderer
        definition={data.template.definition}
        customization={data.template.customization}
        context={data.context}
        language={data.event.language}
        mode="live"
        introKey={`e-${data.event.slug}`}
        slots={{ watermark: data.watermark, rsvp: registration, rsvpHeading: registration ? tr('register.title') : undefined }}
      />
      {registration && !hasRsvpSection ? (
        // Templates without an RSVP section still get the form, after the invitation.
        <section className="bg-stone-50 px-6 py-14">
          <h2 className="mb-6 text-center font-display text-3xl">{tr('register.title')}</h2>
          {registration}
        </section>
      ) : null}
    </>
  );
}
