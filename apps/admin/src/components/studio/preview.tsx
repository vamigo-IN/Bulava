'use client';

import { Player } from '@remotion/player';
import { useQuery } from '@tanstack/react-query';
import { Monitor, Play, Smartphone } from 'lucide-react';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TemplateRenderer } from '@bulava/template-engine';
import { sampleRenderContext, SAMPLE_PRESETS, templateAssetIds, videoDurationSec, type TemplateDefinition } from '@bulava/template-schema';
import { apiPost } from '@/lib/api';
import { TemplateVideo, templateVideoMetadata, type TemplateVideoProps } from '@bulava/video-engine';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Button, Checkbox, Select } from '../ui';

class PreviewBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  override state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    // A new definition gets a fresh attempt.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  override render() {
    if (this.state.error) return <Alert>{t('studio.previewError', { message: this.state.error.message })}</Alert>;
    return this.props.children;
  }
}

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', hi: 'हिन्दी', 'hi-Latn': 'Hinglish' };

export function StudioPreview({ definition, version }: { definition: TemplateDefinition; version: string }) {
  const typeOptions = useMemo(() => {
    const keys = definition.eventTypes.length ? definition.eventTypes : Object.keys(SAMPLE_PRESETS);
    return keys.filter((k) => k in SAMPLE_PRESETS);
  }, [definition.eventTypes]);
  const [language, setLanguage] = useState(definition.languages[0] ?? 'en');
  const [typeKey, setTypeKey] = useState(typeOptions[0] ?? 'WEDDING');
  const [longNames, setLongNames] = useState(false);
  const [noPhotos, setNoPhotos] = useState(false);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [watermark, setWatermark] = useState(false);
  const [introRun, setIntroRun] = useState<number | null>(null);

  const effectiveType = typeOptions.includes(typeKey) ? typeKey : (typeOptions[0] ?? 'WEDDING');
  const effectiveLanguage = definition.languages.includes(language) ? language : (definition.languages[0] ?? 'en');
  // Painted layers and canvas images may not be approved or published yet: staff previews use signed URLs.
  const artworkIds = templateAssetIds(definition).sort();
  const artworkUrls = useQuery({
    queryKey: ['admin', 'asset-urls', artworkIds],
    queryFn: () => apiPost<Record<string, string>>('/admin/assets/urls', { ids: artworkIds }),
    enabled: artworkIds.length > 0,
    staleTime: 30 * 60_000,
  });
  const context = useMemo(
    () => ({ ...sampleRenderContext({ language: effectiveLanguage, longNames, noPhotos, typeKey: effectiveType }), ...(artworkUrls.data ? { assets: artworkUrls.data } : {}) }),
    [effectiveLanguage, longNames, noPhotos, effectiveType, artworkUrls.data],
  );
  const isWebsite = definition.type === 'WEBSITE';
  const intro = definition.website?.intro ?? 'none';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
        <Select aria-label={t('studio.preview.language')} value={effectiveLanguage} onChange={(e) => setLanguage(e.target.value)} className="min-h-8 w-auto py-0 text-xs">
          {definition.languages.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l] ?? l}
            </option>
          ))}
        </Select>
        <Select aria-label={t('studio.preview.eventType')} value={effectiveType} onChange={(e) => setTypeKey(e.target.value)} className="min-h-8 w-auto py-0 text-xs">
          {typeOptions.map((k) => (
            <option key={k} value={k}>
              {k.replaceAll('_', ' ').toLowerCase()}
            </option>
          ))}
        </Select>
        <Checkbox className="min-h-8 text-xs" label={t('studio.preview.longNames')} checked={longNames} onChange={(e) => setLongNames(e.target.checked)} />
        <Checkbox className="min-h-8 text-xs" label={t('studio.preview.noPhotos')} checked={noPhotos} onChange={(e) => setNoPhotos(e.target.checked)} />
        <Checkbox className="min-h-8 text-xs" label={t('studio.preview.watermark')} checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
        {isWebsite ? (
          <div className="ml-auto flex items-center gap-1">
            {intro !== 'none' ? (
              <Button size="sm" variant="secondary" onClick={() => setIntroRun(Date.now())}>
                <Play className="size-3.5" /> {t('theme.intro')}
              </Button>
            ) : null}
            <Button size="icon" variant={device === 'mobile' ? 'primary' : 'ghost'} aria-label={t('studio.preview.mobile')} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
              <Smartphone className="size-4" />
            </Button>
            <Button size="icon" variant={device === 'desktop' ? 'primary' : 'ghost'} aria-label={t('studio.preview.desktop')} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
              <Monitor className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="ml-auto text-xs text-stone-500">{t('scenes.total', { seconds: videoDurationSec(definition, context.functions.length).toFixed(1) })}</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[repeating-conic-gradient(#f5f5f4_0%_25%,#fafaf9_0%_50%)] bg-[length:24px_24px] p-4">
        <PreviewBoundary resetKey={`${version}:${effectiveLanguage}:${effectiveType}:${longNames}:${noPhotos}`}>
          {isWebsite ? (
            <div className={cn('mx-auto overflow-hidden bg-white shadow-xl', device === 'mobile' ? 'w-[min(390px,100%)] rounded-[1.75rem] border-[6px] border-stone-900' : 'w-full rounded-lg')}>
              <DesktopZoom enabled={device === 'desktop'}>
                <TemplateRenderer
                  key={introRun ?? 'preview'}
                  definition={definition}
                  context={context}
                  language={effectiveLanguage}
                  mode={introRun ? 'live' : 'preview'}
                  introKey={introRun ? `studio-${introRun}` : undefined}
                  slots={{ watermark }}
                />
              </DesktopZoom>
            </div>
          ) : (
            <VideoPreview definition={definition} context={context} language={effectiveLanguage} watermark={watermark} />
          )}
        </PreviewBoundary>
      </div>
    </div>
  );
}

function VideoPreview({ definition, context, language, watermark }: { definition: TemplateDefinition; context: ReturnType<typeof sampleRenderContext>; language: string; watermark: boolean }) {
  const props = useMemo<TemplateVideoProps>(() => ({ definition, context, customization: null, language, watermark, musicUrl: null }), [definition, context, language, watermark]);
  const meta = templateVideoMetadata(props);
  const portrait = meta.height >= meta.width;
  return (
    <div className={cn('mx-auto overflow-hidden rounded-xl bg-black shadow-xl', portrait ? 'w-[min(360px,100%)]' : 'w-full')} style={{ aspectRatio: `${meta.width} / ${meta.height}` }}>
      <Player
        component={TemplateVideo}
        inputProps={props}
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        compositionWidth={meta.width}
        compositionHeight={meta.height}
        style={{ width: '100%', height: '100%' }}
        controls
        loop
        autoPlay={definition.type === 'VIDEO'}
        initiallyMuted
        acknowledgeRemotionLicense
      />
    </div>
  );
}

/** The desktop preview lays the page out at a laptop width and zooms it to the pane, so desktop layouts show as desktops. */
function DesktopZoom({ enabled, width = 1280, children }: { enabled: boolean; width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, width]);
  if (!enabled) return <>{children}</>;
  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div style={{ width, zoom }}>{children}</div>
    </div>
  );
}
