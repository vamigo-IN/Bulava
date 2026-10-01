'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TemplateRenderer } from '@bulava/template-engine';
import { sampleRenderContext, type TemplateDefinition } from '@bulava/template-schema';
import { AuthAwareLink } from '@/components/marketing/account-links';
import { createTranslator } from '@bulava/localization';

const t = createTranslator('en');

/** Full-page live demo of a website template with sample content and a floating action bar. */
export function TemplateDemo({ definition, templateKey, name, eventType }: { definition: TemplateDefinition; templateKey: string; name: string; eventType: string }) {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const ctx = useMemo(() => sampleRenderContext({ typeKey: eventType, language }), [eventType, language]);
  return (
    <div className="pb-28" style={{ background: definition.theme.colors.background }}>
      <TemplateRenderer key={language} definition={definition} context={ctx} mode="live" language={language} introKey={`demo-${templateKey}`} />
      <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
        <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/10 bg-night-900/85 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <Link
            href={`/templates/${templateKey}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ivory transition-colors duration-300 hover:bg-white/10"
            aria-label={t('templates.demo.back', { name })}
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="min-h-11 rounded-full px-4 text-sm text-ivory ring-1 ring-white/20 transition-colors duration-300 hover:bg-white/10"
            aria-label={t('templates.demo.language')}
          >
            {language === 'en' ? 'हिन्दी' : 'English'}
          </button>
          <AuthAwareLink
            signedOutHref={`/signup?template=${templateKey}`}
            signedInHref={`/dashboard/events/new?template=${templateKey}`}
            className="group/cta ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-5 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200"
          >
            {t('template.use')}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
          </AuthAwareLink>
        </div>
      </div>
    </div>
  );
}
