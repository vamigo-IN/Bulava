'use client';

import { Monitor, Play, Smartphone } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { IntroOverlay, TemplateRenderer, themeStyle } from '@bulava/template-engine';
import { createTranslator, formatEventDateWithWeekday } from '@bulava/localization';
import { sampleRenderContext, type TemplateDefinition } from '@bulava/template-schema';
import { cn } from '@/lib/utils';

const SEGMENTS = 'inline-flex rounded-full border border-gold-200 bg-white/80 p-1 shadow-soft';
const segment = (on: boolean) =>
  cn(
    'inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-300',
    on ? 'bg-night-900 text-ivory shadow-[0_6px_16px_-8px_rgba(19,7,11,0.8)]' : 'text-stone-600 hover:text-ink',
  );

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

/** Full interactive preview of a template with sample content, in a phone or desktop frame. */
export function TemplatePreviewSwitcher({
  definition,
  eventType,
  labels,
}: {
  definition: TemplateDefinition;
  eventType: string;
  labels: { mobile: string; desktop: string; note: string; playOpening?: string };
}) {
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const ctx = sampleRenderContext({ typeKey: eventType, language });
  const isWebsite = definition.type === 'WEBSITE';
  const intro = definition.website?.intro ?? 'none';
  const [opening, setOpening] = useState<number | null>(null);
  const tr = createTranslator(language);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-7 flex flex-wrap items-center justify-center gap-3">
        {isWebsite ? (
          <div className={SEGMENTS}>
            {(['mobile', 'desktop'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={segment(view === v)}>
                {v === 'mobile' ? <Smartphone aria-hidden className="size-4" /> : <Monitor aria-hidden className="size-4" />}
                {labels[v]}
              </button>
            ))}
          </div>
        ) : null}
        <div className={SEGMENTS}>
          {(['en', 'hi'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={language === l} className={segment(language === l)}>
              {l === 'en' ? 'English' : 'हिन्दी'}
            </button>
          ))}
        </div>
        {isWebsite && intro !== 'none' && labels.playOpening ? (
          <button
            type="button"
            onClick={() => setOpening(Date.now())}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-5 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-12px_rgba(184,137,43,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200"
          >
            <Play aria-hidden className="size-3.5 fill-current" />
            {labels.playOpening}
          </button>
        ) : null}
      </div>

      {!isWebsite ? (
        <div className="phone-frame shadow-lift" style={{ width: 'min(324px, 100%)', height: definition.type === 'DIGITAL_CARD' ? 419 : 590 }}>
          <VideoPlayer definition={definition} eventType={eventType} label={definition.name} />
        </div>
      ) : view === 'mobile' ? (
        <div className="phone-frame shadow-[0_2px_6px_rgba(28,25,23,0.06),0_50px_90px_-30px_rgba(47,7,16,0.45)]" style={{ width: 'min(404px, 100%)', height: 820 }}>
          <div className="h-full w-full overflow-y-auto overscroll-contain bg-white">
            <TemplateRenderer definition={definition} context={ctx} mode="preview" language={language} />
          </div>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border-8 border-ink bg-ink shadow-[0_2px_6px_rgba(28,25,23,0.06),0_50px_90px_-30px_rgba(47,7,16,0.45)]">
          <div className="flex h-8 items-center gap-1.5 bg-ink px-3" aria-hidden>
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-green-400" />
          </div>
          <div className="h-[760px] overflow-y-auto overscroll-contain bg-white">
            <TemplateRenderer definition={definition} context={ctx} mode="preview" language={language} />
          </div>
        </div>
      )}
      <p className="mt-4 max-w-md text-center text-sm text-stone-500">{labels.note}</p>
      {opening !== null && intro !== 'none' ? (
        // A full-screen replay of the opening, as a guest sees it on their phone.
        <PreviewOpening key={opening} definition={definition} intro={intro} language={language} ctx={ctx} tr={tr} />
      ) : null}
    </div>
  );
}

function PreviewOpening({
  definition,
  intro,
  language,
  ctx,
  tr,
}: {
  definition: TemplateDefinition;
  intro: Exclude<NonNullable<TemplateDefinition['website']>['intro'], 'none'>;
  language: string;
  ctx: ReturnType<typeof sampleRenderContext>;
  tr: ReturnType<typeof createTranslator>;
}) {
  const names = ctx.couple ? `${ctx.couple.partnerOne} & ${ctx.couple.partnerTwo}` : (ctx.honoree?.name ?? ctx.event.title);
  const monogram = names
    .split(/\s+&\s+/)
    .map((p) => p.trim()[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <div style={themeStyle(definition.theme, definition.theme.colors, definition.fonts)}>
      <IntroOverlay
        variant={intro}
        monogram={monogram || '♥'}
        labels={{
          open: tr('template.openInvite'),
          lanterns: tr('template.intro.lanterns'),
          seal: tr('template.intro.seal'),
          scratch: tr('template.intro.scratch'),
          reveal: tr('template.intro.reveal'),
        }}
        revealText={ctx.event.startDate ? formatEventDateWithWeekday(ctx.event.startDate, { language, timeZone: ctx.event.timezone }) : undefined}
        storageKey={`bulava-preview-intro:${definition.templateKey}:${Date.now()}`}
      />
    </div>
  );
}

