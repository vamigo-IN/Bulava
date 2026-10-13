'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { templateSampleContext, type Customization } from '@bulava/template-schema';
import { FilmDesigner } from '@/components/design/film-designer';
import { readStudioDraft, writeStudioDraft } from '@/lib/design-drafts';
import { I18nProvider, useT } from '@/lib/i18n';
import { Spinner } from '@/components/ui/primitives';
import type { StudioTemplate } from './website-studio';

/**
 * A video invitation designed before signing in (ADR-063): the film's canvas
 * editor on sample names and photos, its preview playing in the browser, the
 * design kept on this device. Making the video creates the host's event
 * (signing in first) and opens the video page with this design; the video
 * itself is made with a plan that includes video.
 */
export function FilmStudio(props: { template: StudioTemplate; eventType: string }) {
  // Outside the dashboard: the editors' words come from this provider (in English, like the design page).
  return (
    <I18nProvider language="en">
      <FilmStudioEditor {...props} />
    </I18nProvider>
  );
}

function FilmStudioEditor({ template, eventType }: { template: StudioTemplate; eventType: string }) {
  const t = useT();
  const router = useRouter();
  const [custom, setCustom] = useState<Customization>({});
  const [ready, setReady] = useState(false);
  const context = useMemo(() => templateSampleContext(template.definition, { typeKey: eventType, language: 'en', tags: template.tags }), [eventType, template.definition, template.tags]);

  useEffect(() => {
    const draft = readStudioDraft('video', template.key);
    if (draft) setCustom(draft.custom);
    setReady(true);
  }, [template.key]);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => writeStudioDraft('video', { templateKey: template.key, eventType, custom }), 400);
    return () => clearTimeout(id);
  }, [custom, ready, template.key, eventType]);

  const make = () => {
    writeStudioDraft('video', { templateKey: template.key, eventType, custom });
    router.push(`/dashboard/events/new?${new URLSearchParams({ template: template.key, type: eventType, studio: 'video' }).toString()}`);
  };

  if (!ready) return <Spinner label={t('common.loading')} />;
  return (
    <FilmDesigner
      definition={template.definition}
      templateName={template.name}
      context={context}
      custom={custom}
      setCustom={setCustom}
      photos={[]}
      onUploaded={() => undefined}
      language="en"
      primary={{ label: t('studio.makeVideo'), onClick: make }}
      onClose={() => router.push(`/design?${new URLSearchParams({ make: 'video', event: eventType }).toString()}`)}
    />
  );
}
