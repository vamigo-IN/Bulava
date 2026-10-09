'use client';

import { ExternalLink, Images, LayoutList, Lock, Palette, Shapes, Sparkles, Type, Wand2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { TemplateRenderer } from '@bulava/template-engine';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { mergePhotos, previewContext as withPhotos, prune } from '@/components/design/customization';
import { MotionPanel, PhotosPanel, SectionsPanel, StylePanel, WordsPanel } from '@/components/design/design-panels';
import { TIER_RANK, TemplatePicker } from '@/components/design/template-picker';
import { apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useApprovedPhotos, useDesign, useEvent, useInvalidateEvent, useTemplateDefinition, useTemplateList } from '@/lib/queries';
import { cardPreview } from '@/lib/template-previews';
import type { MediaItem, TemplateSummaryLite } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Badge, Spinner } from '@/components/ui/primitives';

const TABS: ReadonlyArray<{ id: 'style' | 'photos' | 'words' | 'motion' | 'sections'; icon: LucideIcon }> = [
  { id: 'style', icon: Palette },
  { id: 'photos', icon: Images },
  { id: 'words', icon: Type },
  { id: 'motion', icon: Sparkles },
  { id: 'sections', icon: LayoutList },
];
type Tab = (typeof TABS)[number]['id'];

export default function DesignPage() {
  return (
    <Suspense>
      <DesignEditor />
    </Suspense>
  );
}

/**
 * The invitation's design: the chosen template (changed in a full-screen
 * browser), its words, photos, colours, motion and sections, and a live phone
 * preview with the host's own names beside them.
 */
function DesignEditor() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const event = useEvent(eventId);
  const design = useDesign(eventId);
  // The designs as summaries (hundreds of them); the chosen one's definition is fetched on its own.
  const catalog = useTemplateList('WEBSITE', event.data?.typeKey ?? 'WEDDING');
  const approved = useApprovedPhotos(eventId);
  const invalidate = useInvalidateEvent(eventId);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [custom, setCustom] = useState<Customization>({});
  const [tab, setTab] = useState<Tab>('style');
  const [picking, setPicking] = useState(false);
  const [uploaded, setUploaded] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const welcomed = useRef(false);

  const current = design.data?.selections.WEBSITE ?? null;
  useEffect(() => {
    if (current && selectedKey === null) {
      setSelectedKey(current.templateKey);
      setCustom(current.customization ?? {});
    }
  }, [current, selectedKey]);

  // A brand-new event (no design chosen yet) opens on the designs.
  useEffect(() => {
    if (welcomed.current || !event.data || !catalog.data) return;
    welcomed.current = true;
    if (params.get('welcome') === '1' && event.data.design === null) setPicking(true);
  }, [event.data, catalog.data, params]);

  const photos = useMemo(() => mergePhotos(uploaded, approved.data), [uploaded, approved.data]);

  const maxTier = design.data?.entitlements['templates.maxTier']?.limit ?? 0;
  const templates = useMemo(() => catalog.data ?? [], [catalog.data]);
  const selected: TemplateSummaryLite | undefined = templates.find((x) => x.key === selectedKey);
  const chosen = useTemplateDefinition(selectedKey);
  const definition: TemplateDefinition | undefined = chosen.data?.definition ?? (current?.templateKey === selectedKey ? current?.definition : undefined);

  const previewContext: RenderContext | undefined = useMemo(() => (design.data ? withPhotos(design.data.context, photos, custom) : undefined), [design.data, custom, photos]);
  // What carries over to another design: the host's words, photos and music.
  const kept: Customization = useMemo(() => ({ custom: custom.custom, photoSlots: custom.photoSlots, photoIds: custom.photoIds, musicId: custom.musicId }), [custom]);

  if (!event.data || design.isPending || catalog.isPending) return <Spinner label={t('common.loading')} />;

  const choose = (key: string) => {
    if (key === selectedKey) return;
    setSelectedKey(key);
    // Keep the host's words and photos when switching templates; drop what belongs to the old design.
    setCustom(key === current?.templateKey ? (current.customization ?? {}) : kept);
    setMessage(null);
  };

  const dirty = !!current && (selectedKey !== current.templateKey || JSON.stringify(custom) !== JSON.stringify(current.customization ?? {}));
  // The type's starter design stands in until the host saves one.
  const starter = !event.data.design;
  const canSave = !!selectedKey && (dirty || starter);

  const save = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPut(`/events/${eventId}/design/website`, { templateKey: selectedKey, customization: prune(custom, definition) });
      await invalidate();
      setMessage({ tone: 'success', text: t('design.saved') });
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setSaving(false);
    }
  };

  const locked = selected ? TIER_RANK[selected.tier] > maxTier : false;
  const panelProps = definition ? { definition, custom, setCustom } : null;
  const name = selected?.name ?? current?.definition.name ?? '';
  const thumb = selectedKey ? cardPreview(selectedKey) : null;

  return (
    <div className="space-y-6">
      {/* The design in use, and the way to every other one. */}
      <section className="clay overflow-hidden rounded-[1.75rem]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="relative h-24 w-[60px] shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-gold-200 shadow-clay-sm">
              {thumb ? <img src={thumb} alt="" className="absolute inset-0 size-full object-cover object-top" /> : <Shapes aria-hidden className="absolute inset-0 m-auto size-6 text-gold-500" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{starter && !dirty ? t('design.starter') : t('design.yours')}</p>
              <h2 className="mt-1 truncate font-display text-3xl leading-tight">{name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selected ? <Badge tone={selected.tier === 'FREE' ? 'success' : selected.tier === 'PREMIUM' ? 'brand' : 'warning'}>{t(`filter.tier.${selected.tier}`)}</Badge> : null}
                {dirty ? <Badge tone="warning">{t('design.unsaved')}</Badge> : !starter ? <Badge tone="success">{t('design.savedBadge')}</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPicking(true)} className="btn-3d btn-3d-light min-h-11 rounded-2xl px-5 text-sm">
              <Wand2 aria-hidden className="size-4" />
              {t('design.browse', { count: templates.length })}
            </button>
            <button type="button" onClick={() => void save()} disabled={!canSave || saving} className="btn-3d min-h-11 rounded-2xl px-6 text-sm">
              {saving ? t('common.saving') : starter && !dirty ? t('design.useThis') : dirty ? t('design.saveChanges') : t('design.savedBadge')}
            </button>
          </div>
        </div>
        {starter && !dirty ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-gold-200/70 bg-gold-100/40 px-5 py-3 text-sm text-stone-700 sm:px-6">
            <Sparkles aria-hidden className="size-4 shrink-0 text-gold-600" />
            <span className="min-w-0 flex-1">{t('design.starterHint', { count: templates.length })}</span>
            <button type="button" onClick={() => setPicking(true)} className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
              {t('design.browseShort')}
            </button>
          </div>
        ) : null}
      </section>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          {panelProps ? (
            <div className="clay rounded-[1.75rem] p-4 sm:p-6">
              <div className="clay-inset relative mb-6 flex gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]" role="tablist" aria-label={t('design.customize')}>
                {TABS.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`design-panel-${id}`}
                    id={`design-tab-${id}`}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200',
                      tab === id ? 'bg-white text-brand-800 shadow-clay-sm' : 'text-stone-600 hover:text-ink',
                    )}
                  >
                    <Icon aria-hidden className="size-3.5" />
                    {t(`design.tab.${id}`)}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`design-panel-${tab}`} aria-labelledby={`design-tab-${tab}`}>
                {tab === 'style' ? <StylePanel {...panelProps} /> : null}
                {tab === 'photos' ? <PhotosPanel {...panelProps} eventId={eventId} photos={photos} onUploaded={(p) => setUploaded((u) => [p, ...u])} /> : null}
                {tab === 'words' ? <WordsPanel {...panelProps} /> : null}
                {tab === 'motion' ? <MotionPanel {...panelProps} /> : null}
                {tab === 'sections' ? <SectionsPanel {...panelProps} /> : null}
              </div>
            </div>
          ) : (
            <Spinner label={t('common.loading')} />
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="clay space-y-4 rounded-[1.75rem] p-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">{t('design.livePreview')}</h3>
              {event.data.status === 'DRAFT' ? (
                <a href={`/preview/${event.data.previewToken}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" title={t('design.previewSavedHint')}>
                  {t('share.preview.open')}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              ) : event.data.accessMode === 'PUBLIC' || event.data.accessMode === 'PRIVATE_LINK' ? (
                <a href={`/e/${event.data.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  {t('dash.nav.viewSite')}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              ) : null}
            </div>
            {definition && previewContext ? (
              <div className="relative mx-auto overflow-hidden rounded-[2rem] border-[7px] border-ink bg-white shadow-xl" style={{ width: 'min(100%, 360px)' }}>
                {/* Focusable, so the preview scrolls from the keyboard too. */}
                <div className="relative h-[620px] overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={t('design.livePreview')}>
                  <TemplateRenderer definition={definition} context={previewContext} customization={custom} mode="preview" language={event.data.language} slots={{ watermark: design.data?.watermark || locked }} />
                </div>
              </div>
            ) : null}
            {locked ? (
              // Beyond the plan: the design still saves and previews (with a watermark); publishing without it needs the upgrade.
              <div className="space-y-3">
                <Alert tone="info">{t('design.watermarked')}</Alert>
                <Link href={`/dashboard/events/${eventId}/upgrade?template=${encodeURIComponent(selected?.key ?? '')}`} className="btn-3d btn-3d-light min-h-11 w-full rounded-2xl text-sm">
                  <Lock aria-hidden className="size-4" />
                  {t('design.watermarked.cta')}
                </Link>
              </div>
            ) : null}
            <button type="button" onClick={() => void save()} disabled={!canSave || saving} className="btn-3d min-h-12 w-full rounded-2xl text-sm">
              {saving ? t('common.saving') : starter && !dirty ? t('design.useThis') : dirty ? t('design.saveChanges') : t('design.savedBadge')}
            </button>
          </div>
        </aside>
      </div>

      {picking && design.data && previewContext ? (
        <TemplatePicker
          templates={templates}
          currentKey={starter ? null : (current?.templateKey ?? null)}
          selectedKey={selectedKey}
          maxTier={maxTier}
          context={previewContext}
          customization={kept}
          language={event.data.language}
          watermark={!!design.data.watermark}
          onChoose={choose}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
