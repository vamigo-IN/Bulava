'use client';

import { Monitor, Play, Smartphone, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { INTRO_DONE_EVENT, IntroOverlay, TemplateRenderer, themeStyle } from '@bulava/template-engine';
import { createTranslator, formatEventDateWithWeekday } from '@bulava/localization';
import { isStageIntro, templateSampleContext, type TemplateDefinition } from '@bulava/template-schema';
import { cn } from '@/lib/utils';

/** How long the names hold after a stage opening lands before the replay closes. */
const STAGE_HOLD_MS = 1900;

/** A segmented control: a pressed-in track with the chosen segment raised as a 3D button. */
const SEGMENTS = 'clay-inset inline-flex gap-1 rounded-full p-1.5';
const segment = (on: boolean) =>
  cn('inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium', on ? 'btn-3d' : 'text-stone-600 transition-colors duration-300 hover:text-ink');

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

/** Full interactive preview of a template with sample content, in a phone or desktop frame. */
export function TemplatePreviewSwitcher({
  definition,
  eventType,
  tags,
  labels,
}: {
  definition: TemplateDefinition;
  eventType: string;
  tags?: string[];
  labels: { mobile: string; desktop: string; note: string; playOpening?: string };
}) {
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const ctx = templateSampleContext(definition, { typeKey: eventType, language, tags });
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
            className="btn-3d btn-3d-gold min-h-11 rounded-full px-5 text-sm"
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
            <DesktopZoom>
              <TemplateRenderer definition={definition} context={ctx} mode="preview" language={language} />
            </DesktopZoom>
          </div>
        </div>
      )}
      <p className="mt-4 max-w-md text-center text-sm text-stone-500">{labels.note}</p>
      {opening !== null && intro !== 'none' ? (
        // A full-screen replay of the opening, as a guest sees it on their phone.
        isStageIntro(intro) ? (
          <StagePreviewOpening key={opening} definition={definition} language={language} ctx={ctx} play={opening} closeLabel={tr('common.close')} onClose={() => setOpening(null)} />
        ) : (
          <PreviewOpening key={opening} definition={definition} intro={intro} language={language} ctx={ctx} tr={tr} />
        )
      ) : null}
    </div>
  );
}

/**
 * A stage opening replayed (final.md §3.2): the page's first section drawn live, so the real overlay drives the
 * real hero (its cover, camera and build-in), then the replay closes once the names have landed. Escape or the
 * close button leave at any time.
 */
function StagePreviewOpening({
  definition,
  language,
  ctx,
  play,
  closeLabel,
  onClose,
}: {
  definition: TemplateDefinition;
  language: string;
  ctx: ReturnType<typeof templateSampleContext>;
  play: number;
  closeLabel: string;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    let hold = 0;
    const done = () => {
      window.clearTimeout(hold);
      hold = window.setTimeout(() => setLeaving(true), STAGE_HOLD_MS);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener(INTRO_DONE_EVENT, done);
    window.addEventListener('keydown', key);
    // Reduced motion: the opening never plays (nor says it is done), so the hero at rest is shown for the hold and the replay closes.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    return () => {
      window.clearTimeout(hold);
      window.removeEventListener(INTRO_DONE_EVENT, done);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const out = window.setTimeout(() => close.current(), 450);
    return () => window.clearTimeout(out);
  }, [leaving]);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black transition-opacity duration-[450ms]" style={{ opacity: leaving ? 0 : 1 }}>
      <TemplateRenderer definition={definition} context={ctx} mode="live" language={language} maxSections={1} introKey={`preview-${definition.templateKey}-${play}`} />
      <button
        type="button"
        onClick={() => close.current()}
        aria-label={closeLabel}
        className="absolute top-4 right-4 z-[70] inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <X aria-hidden className="size-5" />
      </button>
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
  ctx: ReturnType<typeof templateSampleContext>;
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
          zipper: tr('template.intro.zipper'),
          ribbon: tr('template.intro.ribbon'),
        }}
        revealText={ctx.event.startDate ? formatEventDateWithWeekday(ctx.event.startDate, { language, timeZone: ctx.event.timezone }) : undefined}
        storageKey={`bulava-preview-intro:${definition.templateKey}:${Date.now()}`}
        colors={definition.theme.colors}
      />
    </div>
  );
}

/**
 * A desktop preview lays the page out at a laptop width and zooms it to the
 * frame, so desktop layouts (and canvas desktop artboards) show as a visitor
 * sees them rather than as a tablet.
 */
function DesktopZoom({ width = 1280, children }: { width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div style={{ width, zoom }}>{children}</div>
    </div>
  );
}
