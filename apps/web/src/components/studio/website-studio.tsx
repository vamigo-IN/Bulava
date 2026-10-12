'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { sampleRenderContext, type Customization, type TemplateDefinition } from '@bulava/template-schema';
import { CanvasDesigner } from '@/components/design/canvas-designer';
import { readStudioDraft, writeStudioDraft } from '@/lib/design-drafts';
import { I18nProvider, useT } from '@/lib/i18n';
import { Spinner } from '@/components/ui/primitives';

export interface StudioTemplate {
  key: string;
  name: string;
  definition: TemplateDefinition;
  tags: string[];
}

/**
 * A website invitation designed before signing in (ADR-063): the canvas editor
 * on sample names and photos, the design kept on this device as it changes,
 * and a watermarked preview. Publishing creates the host's event (signing in
 * first) with this design on it; the plan is asked for when it goes live.
 */
export function WebsiteStudio(props: { template: StudioTemplate; eventType: string }) {
  // Outside the dashboard: the editors' words come from this provider (in English, like the design page).
  return (
    <I18nProvider language="en">
      <WebsiteStudioEditor {...props} />
    </I18nProvider>
  );
}

function WebsiteStudioEditor({ template, eventType }: { template: StudioTemplate; eventType: string }) {
  const t = useT();
  const router = useRouter();
  const [custom, setCustom] = useState<Customization>({});
  const [ready, setReady] = useState(false);
  const context = useMemo(() => sampleRenderContext({ typeKey: eventType, language: 'en', tags: template.tags }), [eventType, template.tags]);

  useEffect(() => {
    const draft = readStudioDraft('website', template.key);
    if (draft) setCustom(draft.custom);
    setReady(true);
  }, [template.key]);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => writeStudioDraft('website', { templateKey: template.key, eventType, custom }), 400);
    return () => clearTimeout(id);
  }, [custom, ready, template.key, eventType]);

  const publish = () => {
    writeStudioDraft('website', { templateKey: template.key, eventType, custom });
    router.push(`/dashboard/events/new?${new URLSearchParams({ template: template.key, type: eventType, studio: 'website' }).toString()}`);
  };

  if (!ready) return <Spinner label={t('common.loading')} />;
  return (
    <CanvasDesigner
      definition={template.definition}
      templateName={template.name}
      context={context}
      custom={custom}
      setCustom={setCustom}
      photos={[]}
      onUploaded={() => undefined}
      language="en"
      watermark
      dirty
      saving={false}
      onSave={publish}
      primary={{ label: t('studio.publish'), onClick: publish }}
      onClose={() => router.push(`/design?${new URLSearchParams({ make: 'website', event: eventType }).toString()}`)}
    />
  );
}
