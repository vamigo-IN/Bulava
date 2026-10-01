'use client';

import { Lock } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { backdropArt, backdropTitleTop } from '@bulava/template-engine';
import type { MessageKey } from '@bulava/localization';
import type { Customization } from '@bulava/template-schema';
import { api, apiGet, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useApprovedPhotos, useCatalog, useDesign, useEvent, useInvalidateEvent, useVideos } from '@/lib/queries';
import type { MediaItem, TemplateSummaryLite } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MusicPicker } from '@/components/events/music-picker';
import { mergePhotos, previewContext, prune } from '@/components/design/customization';
import { PhotosPanel, StylePanel } from '@/components/design/design-panels';
import { ScenePoster } from '@/components/design/scene-poster';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui/primitives';

const Preview = dynamic(() => import('@/components/events/video-preview').then((m) => m.VideoPreview), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

const TIER_RANK = { FREE: 0, STANDARD: 1, PREMIUM: 2 } as const;

export default function VideoPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const design = useDesign(eventId);
  const eventType = event.data?.typeKey ?? 'WEDDING';
  const videos = useCatalog('VIDEO', eventType);
  const cards = useCatalog('DIGITAL_CARD', eventType);
  const jobs = useVideos(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [selected, setSelected] = useState<TemplateSummaryLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicId, setMusicId] = useState<string | null>(null);
  // Colours, fonts and the cover photo for this render; the photo carries over between templates.
  const [custom, setCustom] = useState<Customization>({});
  const [tab, setTab] = useState<'style' | 'photos'>('style');
  const approved = useApprovedPhotos(eventId);
  const [uploaded, setUploaded] = useState<MediaItem[]>([]);
  const photos = useMemo(() => mergePhotos(uploaded, approved.data), [uploaded, approved.data]);
  const context = useMemo(() => (design.data ? previewContext(design.data.context, photos, custom) : null), [design.data, photos, custom]);

  if (!event.data || videos.isPending || cards.isPending || !design.data || !context) return <Spinner label={t('common.loading')} />;
  const maxTier = design.data.entitlements['templates.maxTier']?.limit ?? 0;
  const all = [...(videos.data ?? []), ...(cards.data ?? [])];
  const choice = selected ?? all[0] ?? null;
  const editable = choice?.definition?.capabilities.editable;
  const tabs = (['style', 'photos'] as const).filter((id) => (id === 'style' ? editable?.colors || editable?.fonts : editable?.photos));

  const pick = (tpl: TemplateSummaryLite) => {
    setSelected(tpl);
    setCustom((c) => ({ photoSlots: c.photoSlots }));
    setTab('style');
  };

  const create = async (tpl: TemplateSummaryLite) => {
    setBusy(true);
    setError(null);
    try {
      const customization = prune(custom, tpl.definition);
      await apiPost(`/events/${eventId}/videos`, { templateKey: tpl.key, customization, ...(musicId && tpl.outputs.includes('VIDEO') ? { musicId } : {}) });
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const download = async (jobId: string) => {
    const { url } = await apiGet<{ url: string }>(`/events/${eventId}/videos/${jobId}/download`);
    window.location.assign(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('video.title')}</h2>
        <p className="mt-1 text-stone-600">{t('video.subtitle')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {all.map((tpl) => {
            const locked = TIER_RANK[tpl.tier] > maxTier;
            const backdrop = tpl.definition?.scenes?.find((sc) => sc.backdrop)?.backdrop;
            const colors = tpl.definition?.theme.colors;
            const art = tpl.definition && backdrop && colors ? backdropArt(tpl.definition, backdrop, colors, { width: 1200 }) : null;
            return (
              <li key={tpl.key}>
                <button
                  type="button"
                  onClick={() => pick(tpl)}
                  aria-pressed={choice?.key === tpl.key}
                  className={cn('w-full rounded-2xl border-2 bg-white p-3 text-left', choice?.key === tpl.key ? 'border-brand-700 shadow-lg' : 'border-gold-200 hover:border-gold-400')}
                >
                  {art && backdrop && colors && tpl.definition ? (
                    // Films show their drawn or painted scene.
                    <ScenePoster art={art} ratio={9 / 14}>
                      <span
                        className="absolute inset-x-0 px-4 text-center font-display text-xl leading-tight"
                        style={{ top: `${backdropTitleTop(tpl.definition, backdrop) * 100}%`, color: art.dark ? colors.accent : colors.primary }}
                      >
                        {tpl.outputs.includes('VIDEO') ? '▶ ' : ''}
                        {tpl.name}
                      </span>
                    </ScenePoster>
                  ) : (
                  <div
                    className="flex aspect-[9/14] flex-col items-center justify-center rounded-xl p-3 text-center"
                    style={{ background: `linear-gradient(160deg, ${tpl.definition?.theme.colors.primary ?? '#5b0e1b'}, ${tpl.definition?.theme.colors.secondary ?? '#b8892b'})`, color: tpl.definition?.theme.colors.background }}
                  >
                    <span className="text-2xl" aria-hidden>
                      {tpl.outputs.includes('VIDEO') ? '▶' : '🖼️'}
                    </span>
                    <span className="mt-2 font-display text-xl leading-tight">{tpl.name}</span>
                  </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={tpl.tier === 'FREE' ? 'success' : 'brand'}>{t(`filter.tier.${tpl.tier}`)}</Badge>
                    {locked ? (
                      <span title={t('design.locked')}>
                        <Lock aria-hidden className="size-4 text-gold-600" />
                        <span className="sr-only">{t('design.locked')}</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {choice?.definition ? (
          <Card className="space-y-4 rounded-3xl xl:sticky xl:top-24 xl:self-start">
            <h3 className="font-display text-2xl">{choice.name}</h3>
            <div className="mx-auto overflow-hidden rounded-[1.6rem] border-[6px] border-ink" style={{ width: 'min(100%, 270px)', aspectRatio: choice.outputs.includes('VIDEO') ? '9 / 16' : '4 / 5' }}>
              <Preview definition={choice.definition} context={context} customization={custom} />
            </div>
            {design.data.watermark ? <p className="text-xs text-stone-500">{t('video.watermark')}</p> : null}
            {tabs.length ? (
              <div className="space-y-4 rounded-2xl border border-gold-100 bg-ivory/60 p-3">
                <p className="text-sm font-semibold">{t('video.customize')}</p>
                {tabs.length > 1 ? (
                  <div className="flex gap-1 rounded-full bg-sand p-1" role="tablist" aria-label={t('video.customize')}>
                    {tabs.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`video-tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls={`video-panel-${id}`}
                        onClick={() => setTab(id)}
                        className={cn('min-h-10 flex-1 rounded-full px-3 text-sm font-medium', tab === id ? 'bg-white text-brand-800 shadow' : 'text-stone-600 hover:text-stone-900')}
                      >
                        {t(`design.tab.${id}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div role="tabpanel" id={`video-panel-${tabs.includes(tab) ? tab : tabs[0]}`} aria-labelledby={tabs.length > 1 ? `video-tab-${tabs.includes(tab) ? tab : tabs[0]}` : undefined}>
                  {(tabs.includes(tab) ? tab : tabs[0]) === 'style' ? (
                    <StylePanel definition={choice.definition} custom={custom} setCustom={setCustom} />
                  ) : (
                    <PhotosPanel definition={choice.definition} custom={custom} setCustom={setCustom} eventId={eventId} photos={photos} onUploaded={(p) => setUploaded((u) => [p, ...u])} />
                  )}
                </div>
              </div>
            ) : null}
            {choice.outputs.includes('VIDEO') && choice.definition.capabilities.editable.music ? <MusicPicker value={musicId} onChange={setMusicId} /> : null}
            {TIER_RANK[choice.tier] > maxTier ? (
              <Link href={`/dashboard/events/${eventId}/upgrade`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold-600 font-semibold text-white hover:bg-gold-700">
                <Lock aria-hidden className="size-4" />
                {t('design.locked')}
              </Link>
            ) : (
              <Button size="lg" className="w-full rounded-full" disabled={busy} onClick={() => create(choice)}>
                {t('video.create')}
              </Button>
            )}
          </Card>
        ) : null}
      </div>

      <section>
        <h3 className="mb-3 font-display text-2xl">{t('video.queue')}</h3>
        {jobs.data?.length ? (
          <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
            {jobs.data.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{job.templateName}</p>
                  <p className="text-xs text-stone-500">{new Date(job.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  {job.status === 'PROCESSING' ? (
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-sand">
                      <div className="h-full bg-brand-700 transition-all" style={{ width: `${job.progress}%` }} />
                    </div>
                  ) : null}
                  <Badge tone={job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'danger' : 'neutral'}>
                    {t(`video.status.${job.status}` as MessageKey, { progress: job.progress })}
                  </Badge>
                  {job.status === 'COMPLETED' ? (
                    <Button size="sm" className="rounded-full" onClick={() => download(job.id)}>
                      {t('video.download')}
                    </Button>
                  ) : null}
                  {job.status === 'QUEUED' || job.status === 'PROCESSING' ? (
                    <Button size="sm" variant="ghost" onClick={() => api(`/events/${eventId}/videos/${job.id}/cancel`, { method: 'POST', body: {} }).then(invalidate)}>
                      {t('video.cancel')}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t('video.empty')}</EmptyState>
        )}
      </section>
    </div>
  );
}
