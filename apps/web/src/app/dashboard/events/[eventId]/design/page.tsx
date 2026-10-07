'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TemplateRenderer, TemplateThumbnail } from '@bulava/template-engine';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { mergePhotos, previewContext as withPhotos, prune } from '@/components/design/customization';
import { MotionPanel, PhotosPanel, SectionsPanel, StylePanel, WordsPanel } from '@/components/design/design-panels';
import { apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useApprovedPhotos, useCatalog, useDesign, useEvent, useInvalidateEvent } from '@/lib/queries';
import type { MediaItem, TemplateSummaryLite } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Badge, Button, Spinner } from '@/components/ui/primitives';

const TIER_RANK = { FREE: 0, STANDARD: 1, PREMIUM: 2 } as const;
const TABS = ['style', 'photos', 'words', 'motion', 'sections'] as const;
type Tab = (typeof TABS)[number];

export default function DesignPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const design = useDesign(eventId);
  const catalog = useCatalog('WEBSITE', event.data?.typeKey ?? 'WEDDING');
  const approved = useApprovedPhotos(eventId);
  const invalidate = useInvalidateEvent(eventId);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [custom, setCustom] = useState<Customization>({});
  const [tab, setTab] = useState<Tab>('style');
  const [picking, setPicking] = useState(false);
  const [uploaded, setUploaded] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const current = design.data?.selections.WEBSITE ?? null;
  useEffect(() => {
    if (current && selectedKey === null) {
      setSelectedKey(current.templateKey);
      setCustom(current.customization ?? {});
    }
  }, [current, selectedKey]);

  const photos = useMemo(() => mergePhotos(uploaded, approved.data), [uploaded, approved.data]);

  const maxTier = design.data?.entitlements['templates.maxTier']?.limit ?? 0;
  const templates = catalog.data ?? [];
  const selected: TemplateSummaryLite | undefined = templates.find((x) => x.key === selectedKey);
  const definition: TemplateDefinition | undefined = selected?.definition ?? (current?.templateKey === selectedKey ? current?.definition : undefined);

  const previewContext: RenderContext | undefined = useMemo(
    () => (design.data ? withPhotos(design.data.context, photos, custom) : undefined),
    [design.data, custom, photos],
  );

  if (!event.data || design.isPending || catalog.isPending) return <Spinner label={t('common.loading')} />;

  const choose = (tpl: TemplateSummaryLite) => {
    setSelectedKey(tpl.key);
    // Keep the host's words and photos when switching templates; drop what belongs to the old design.
    const keep: Customization = tpl.key === current?.templateKey ? (current.customization ?? {}) : { custom: custom.custom, photoSlots: custom.photoSlots, photoIds: custom.photoIds, musicId: custom.musicId };
    setCustom(keep);
    setMessage(null);
  };

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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl">{t('design.title')}</h2>
            <p className="mt-1 text-stone-600">{t('design.subtitle')}</p>
          </div>
          <Button variant="secondary" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            {picking ? t('design.template.hide') : t('design.template.change')}
          </Button>
        </div>

        {picking || !definition ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
            {templates.map((tpl) => {
              const isLocked = TIER_RANK[tpl.tier] > maxTier;
              const inUse = current?.templateKey === tpl.key && !current.isDefault;
              return (
                <li key={tpl.key}>
                  <button
                    type="button"
                    onClick={() => choose(tpl)}
                    aria-pressed={selectedKey === tpl.key}
                    className={cn(
                      'group relative block w-full rounded-2xl border-2 bg-white p-2 text-left transition-all',
                      selectedKey === tpl.key ? 'border-brand-700 shadow-lg' : 'border-transparent hover:border-gold-300',
                    )}
                  >
                    <div className="overflow-hidden rounded-xl">
                      {tpl.definition && design.data ? <TemplateThumbnail definition={tpl.definition} context={design.data.context} width={180} height={300} sections={2} /> : <div className="skeleton h-[300px] w-[180px]" />}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1 px-1">
                      <span className="truncate font-display text-lg">{tpl.name}</span>
                      {isLocked ? (
                        <span title={t('design.locked')}>
                          <Lock aria-hidden className="size-4 text-gold-600" />
                          <span className="sr-only">{t('design.locked')}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1 px-1 pb-1">
                      <Badge tone={tpl.tier === 'FREE' ? 'success' : tpl.tier === 'PREMIUM' ? 'brand' : 'warning'}>{t(`filter.tier.${tpl.tier}`)}</Badge>
                      {inUse ? <Badge tone="success">{t('design.chosen')}</Badge> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {panelProps ? (
          <div className="rounded-3xl border border-gold-200 bg-white/70 p-4 sm:p-6">
            <div className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-sand p-1" role="tablist" aria-label={t('design.title')}>
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`design-panel-${id}`}
                  id={`design-tab-${id}`}
                  onClick={() => setTab(id)}
                  className={cn('min-h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap', tab === id ? 'bg-white text-brand-800 shadow' : 'text-stone-600 hover:text-stone-900')}
                >
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
        ) : null}
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="space-y-4 rounded-3xl border border-gold-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-2xl">{selected?.name ?? current?.definition.name}</h3>
            {selected ? <Badge>{t(`filter.tier.${selected.tier}`)}</Badge> : null}
          </div>
          {definition && previewContext ? (
            <div className="relative mx-auto overflow-hidden rounded-[2rem] border-[7px] border-ink shadow-xl" style={{ width: 'min(100%, 360px)' }}>
              <div className="relative h-[600px] overflow-y-auto overscroll-contain">
                <TemplateRenderer definition={definition} context={previewContext} customization={custom} mode="preview" language={event.data.language} slots={{ watermark: design.data?.watermark }} />
              </div>
            </div>
          ) : null}
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          {locked ? (
            // Beyond the plan: the design still saves and previews (with a watermark); publishing without it needs the upgrade.
            <div className="space-y-3">
              <Alert tone="info">{t('design.watermarked')}</Alert>
              <Link href={`/dashboard/events/${eventId}/upgrade?template=${encodeURIComponent(selected?.key ?? '')}`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold-300 text-sm font-semibold text-brand-700 hover:bg-gold-100/60">
                <Lock aria-hidden className="size-4" />
                {t('design.watermarked.cta')}
              </Link>
            </div>
          ) : null}
          <Button size="lg" className="w-full rounded-full" disabled={saving || !selectedKey} onClick={save}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
