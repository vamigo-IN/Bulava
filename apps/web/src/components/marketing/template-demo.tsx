'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TemplateRenderer } from '@bulava/template-engine';
import { sampleRenderContext, type TemplateDefinition } from '@bulava/template-schema';
import { UseTemplateButton } from '@/components/marketing/quick-start';
import { createTranslator } from '@bulava/localization';

const t = createTranslator('en');

/** Full-page live demo of a website template with sample content and a floating action bar. */
export function TemplateDemo({
  definition,
  templateKey,
  name,
  eventType,
  eventTypes,
  tags,
}: {
  definition: TemplateDefinition;
  templateKey: string;
  name: string;
  eventType: string;
  eventTypes: string[];
  tags?: string[];
}) {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const ctx = useMemo(() => sampleRenderContext({ typeKey: eventType, language, tags }), [eventType, language, tags]);
  return (
    <div className="pb-28" style={{ background: definition.theme.colors.background }}>
      <TemplateRenderer key={language} definition={definition} context={ctx} mode="live" language={language} introKey={`demo-${templateKey}`} />
      <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
        {/* A floating clay bar over the template: back, language, and the main action. */}
        <div className="clay flex w-full max-w-md items-center gap-2 rounded-full p-2">
          <Link href={`/templates/${templateKey}`} className="btn-3d btn-3d-light size-11 shrink-0 rounded-full" aria-label={t('templates.demo.back', { name })}>
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="btn-3d btn-3d-light min-h-11 rounded-full px-4 text-sm font-medium"
            aria-label={t('templates.demo.language')}
          >
            {language === 'en' ? 'हिन्दी' : 'English'}
          </button>
          <UseTemplateButton template={{ key: templateKey, name, eventTypes }} className="btn-3d group/cta ml-auto min-h-11 flex-1 rounded-full px-5 text-sm">
            {t('template.use')}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
          </UseTemplateButton>
        </div>
      </div>
    </div>
  );
}
