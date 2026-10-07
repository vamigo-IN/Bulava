'use client';

import { useMutation } from '@tanstack/react-query';
import { Archive, ArrowLeft, EyeOff, Rocket, Save, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TemplateDefinitionSchema, validateTemplateDefinition, type TemplateDefinition } from '@bulava/template-schema';
import { ApiError, apiPost, apiPut, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { CheckReport, TemplateDetail } from '@/lib/types';
import { CanvasEditor } from '../canvas-editor/editor';
import { useInvalidate } from '../shell';
import { Alert, Badge, Button, statusTone, Tabs } from '../ui';
import { ArtworkTab } from './artwork-tab';
import { CapabilitiesTab } from './capabilities-tab';
import { ChecksTab } from './checks-tab';
import { firstIssue } from './common';
import { DetailsTab } from './details-tab';
import { JsonTab } from './json-tab';
import { StudioPreview } from './preview';
import { ScenesTab } from './scenes-tab';
import { SectionsTab } from './sections-tab';
import { ThemeTab } from './theme-tab';
import { VersionsTab } from './versions-tab';

type TabKey = 'details' | 'theme' | 'layout' | 'artwork' | 'capabilities' | 'json' | 'checks' | 'versions';

function parseStored(definition: unknown): TemplateDefinition | null {
  const parsed = TemplateDefinitionSchema.safeParse(definition);
  return parsed.success ? parsed.data : null;
}

export function Studio({ detail }: { detail: TemplateDetail }) {
  const { template, working, usage } = detail;
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<TemplateDefinition | null>(() => parseStored(working.definition));
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabKey>('theme');
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string; items?: string[] } | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  /** The canvas section open in the full-screen editor. */
  const [canvasId, setCanvasId] = useState<string | null>(null);
  /** Bumped on every local change so the preview retries after a render error. */
  const [revision, setRevision] = useState(0);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Pick up the server copy after a save or publish, unless there are local edits.
  useEffect(() => {
    if (!dirtyRef.current) setDraft(parseStored(working.definition));
  }, [working.id, working.definition]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const edit = useCallback(
    (mutate: (d: TemplateDefinition) => void): string | null => {
      if (!draft) return t('common.error');
      const next = structuredClone(draft);
      mutate(next);
      const parsed = TemplateDefinitionSchema.safeParse(next);
      if (!parsed.success) return firstIssue(parsed.error);
      setDraft(parsed.data);
      setDirty(true);
      setReport(null);
      setRevision((r) => r + 1);
      return null;
    },
    [draft],
  );

  const semantic = useMemo(() => (draft ? validateTemplateDefinition(draft) : null), [draft]);
  const semanticIssues = semantic && !semantic.ok ? semantic.issues : [];

  const save = useMutation({
    mutationFn: () => apiPut<{ versionId: string; version: number; warnings: Array<{ path: string; message: string }> }>(`/admin/templates/${template.id}/draft`, { definition: draft }),
    onSuccess: async (res) => {
      setDirty(false);
      setNotice(
        res.warnings.length
          ? { tone: 'warning', text: t('studio.savedWarnings', { version: res.version, count: res.warnings.length }), items: res.warnings.map((w) => `${w.path}: ${w.message}`) }
          : { tone: 'success', text: t('studio.savedDraft', { version: res.version }) },
      );
      await invalidate(['admin', 'template', template.id], ['admin', 'templates']);
    },
    onError: (error) => setNotice({ tone: 'danger', text: errorMessage(error, t('common.error')) }),
  });

  const check = useMutation({
    mutationFn: () => apiPost<CheckReport>(`/admin/templates/${template.id}/check`),
    onSuccess: (res) => setReport(res),
  });

  const publish = useMutation({
    mutationFn: () => apiPost<{ version: number }>(`/admin/templates/${template.id}/publish`),
    onSuccess: async (res) => {
      setNotice({ tone: 'success', text: t('studio.published', { version: res.version }) });
      await invalidate(['admin', 'template', template.id], ['admin', 'templates']);
    },
    onError: (error) => {
      const details = error instanceof ApiError ? (error.details as { issues?: Array<{ path: string; message: string }>; licenseIssues?: Array<{ assetId: string; message: string }> } | undefined) : undefined;
      const items = [...(details?.issues ?? []).map((i) => `${i.path}: ${i.message}`), ...(details?.licenseIssues ?? []).map((i) => `${i.assetId}: ${i.message}`)];
      setNotice({ tone: 'danger', text: errorMessage(error, t('common.error')), items });
    },
  });

  const setStatus = useMutation({
    mutationFn: (action: 'unpublish' | 'archive') => apiPost(`/admin/templates/${template.id}/${action}`),
    onSuccess: () => invalidate(['admin', 'template', template.id], ['admin', 'templates']),
    onError: (error) => setNotice({ tone: 'danger', text: errorMessage(error, t('common.error')) }),
  });

  const isWebsite = (draft?.type ?? working.type) === 'WEBSITE';
  const workingIsLive = working.id === template.currentVersionId && template.status === 'PUBLISHED';
  const busy = save.isPending || publish.isPending || setStatus.isPending;

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
      {/* Header */}
      <div className="sticky top-14 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:top-0 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/templates" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800">
              <ArrowLeft className="size-3" /> {t('studio.back')}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{template.name}</h1>
              <Badge tone={statusTone(template.status)}>{t(`status.${template.status}`)}</Badge>
              <Badge>{t(`tier.${template.tier}`)}</Badge>
              {dirty ? <Badge tone="warning">{t('studio.unsaved')}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              <span className="font-mono">{template.key}</span> · {t('studio.workingVersion', { version: working.version, status: t(`status.${working.status}`) })} · {t('studio.usage', { count: usage })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => save.mutate()} disabled={!dirty || !draft || busy}>
              <Save className="size-4" /> {save.isPending ? t('common.saving') : t('studio.saveDraft')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTab('checks');
                check.mutate();
              }}
              disabled={dirty || check.isPending}
            >
              <ShieldCheck className="size-4" /> {t('studio.runChecks')}
            </Button>
            <Button
              onClick={() => window.confirm(t('studio.confirmPublish')) && publish.mutate()}
              disabled={dirty || busy || workingIsLive || semanticIssues.length > 0}
            >
              <Rocket className="size-4" /> {t('studio.publish')}
            </Button>
            {template.status === 'PUBLISHED' ? (
              <Button variant="ghost" onClick={() => window.confirm(t('studio.confirmUnpublish')) && setStatus.mutate('unpublish')} disabled={busy}>
                <EyeOff className="size-4" /> {t('studio.unpublish')}
              </Button>
            ) : null}
            {template.status !== 'ARCHIVED' ? (
              <Button variant="ghost" className="text-red-700" onClick={() => window.confirm(t('studio.confirmArchive')) && setStatus.mutate('archive')} disabled={busy}>
                <Archive className="size-4" /> {t('studio.archive')}
              </Button>
            ) : null}
          </div>
        </div>
        {notice ? (
          <Alert tone={notice.tone} className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p>{notice.text}</p>
                {notice.items?.length ? (
                  <ul className="mt-1 list-disc pl-4 font-mono text-xs">
                    {notice.items.slice(0, 10).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
                {t('common.close')}
              </button>
            </div>
          </Alert>
        ) : null}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(420px,46%)]">
        {/* Editor */}
        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <Tabs<TabKey>
            className="mb-5"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'details', label: t('studio.tab.details') },
              { key: 'theme', label: t('studio.tab.theme') },
              { key: 'layout', label: isWebsite ? t('studio.tab.sections') : t('studio.tab.scenes') },
              { key: 'artwork', label: t('studio.tab.artwork') },
              { key: 'capabilities', label: t('studio.tab.capabilities') },
              { key: 'json', label: t('studio.tab.json') },
              { key: 'checks', label: t('studio.tab.checks') },
              { key: 'versions', label: t('studio.tab.versions') },
            ]}
          />
          {semanticIssues.length ? (
            <Alert tone="warning" className="mb-4">
              <p>{t('studio.invalid', { count: semanticIssues.length })}</p>
              <ul className="mt-1 list-disc pl-4 font-mono text-xs">
                {semanticIssues.slice(0, 8).map((i) => (
                  <li key={`${i.path}${i.message}`}>
                    {i.path}: {i.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {!draft && tab !== 'json' && tab !== 'versions' ? <Alert>{t('studio.invalid', { count: 1 })}</Alert> : null}
          {draft && tab === 'details' ? <DetailsTab template={template} definition={draft} edit={edit} /> : null}
          {draft && tab === 'theme' ? <ThemeTab definition={draft} edit={edit} /> : null}
          {draft && tab === 'layout' ? isWebsite ? <SectionsTab definition={draft} edit={edit} onOpenCanvas={setCanvasId} /> : <ScenesTab definition={draft} edit={edit} /> : null}
          {draft && tab === 'artwork' ? <ArtworkTab definition={draft} edit={edit} /> : null}
          {draft && tab === 'capabilities' ? <CapabilitiesTab definition={draft} edit={edit} /> : null}
          {tab === 'json' ? (
            <JsonTab
              value={draft ?? working.definition}
              onApply={(d) => {
                setDraft(d);
                setDirty(true);
                setReport(null);
                setRevision((r) => r + 1);
              }}
            />
          ) : null}
          {tab === 'checks' ? <ChecksTab report={report} running={check.isPending} dirty={dirty} onRun={() => check.mutate()} error={check.isError ? errorMessage(check.error, t('common.error')) : null} /> : null}
          {tab === 'versions' ? <VersionsTab template={template} /> : null}
        </div>

        {/* Preview */}
        <aside aria-label={t('studio.preview')} className="border-t border-stone-200 xl:sticky xl:top-[92px] xl:h-[calc(100dvh-92px)] xl:border-t-0 xl:border-l">
          <div className="h-[80vh] xl:h-full">{draft ? <StudioPreview definition={draft} version={`${working.id}:${revision}`} /> : null}</div>
        </aside>
      </div>

      {draft && canvasId ? <CanvasEditor definition={draft} sectionId={canvasId} edit={edit} onClose={() => setCanvasId(null)} onSave={() => save.mutate()} saving={save.isPending} dirty={dirty} /> : null}
    </div>
  );
}
