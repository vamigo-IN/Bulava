'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileJson, ImageOff, LayoutList, Paintbrush, TriangleAlert, Type, Upload, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Field, Input, Textarea } from '@/components/ui';
import { apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';

/** What the API reports about design JSON (POST /admin/templates/import): a card's layers, or a website's sections. */
interface ImportReport {
  kind: 'card' | 'website';
  key: string;
  name: string;
  category: string;
  eventTypes: string[];
  layers?: number;
  sections?: Array<{ from: string; type: string; id: string | null; section: string | null; variant: string | null; skipped: 'hidden' | 'unknown' | 'duplicate' | 'limit' | null }>;
  fonts?: Array<{ role: 'heading' | 'body' | 'script'; requested: string | null; family: string; substituted: boolean }>;
  repairs?: Array<{ at: string; from: string; to: string }>;
  photos?: Array<{ asset: string; binding: string; slot: string; shown: boolean }>;
  unknownBindings?: Array<{ at: string; binding: string }>;
  standIns: Array<{ element: string; source: string; drawnAs: string | null }>;
  warnings: string[];
  issues: Array<{ path: string; message: string }>;
  keyTaken: boolean;
  template?: { id: string };
}

function Part({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

/**
 * Design JSON from a design tool or generator becomes a template: a card (a
 * canvas, a theme, data and a list of elements) a canvas template, a website
 * (design, assets and a list of sections) a website of Bulava's sections.
 * Check it first, see what it became and what could not come across, then
 * make the draft and finish it in the Studio.
 */
export function ImportDesignForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);

  const design = (): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
      setParseError(null);
      return value as Record<string, unknown>;
    } catch {
      setParseError(t('templates.import.notJson'));
      return null;
    }
  };

  const run = useMutation({
    mutationFn: (create: boolean) => {
      const body = design();
      if (!body) return Promise.reject(new Error(t('templates.import.notJson')));
      return apiPost<ImportReport>('/admin/templates/import', { design: body, create, ...(key ? { key } : {}), ...(name ? { name } : {}) });
    },
    onSuccess: async (res) => {
      setReport(res);
      if (!key) setKey(res.key);
      if (!name) setName(res.name);
      if (res.template) {
        await invalidate(['admin', 'templates']);
        onDone();
        router.push(`/templates/${res.template.id}`);
      }
    },
  });

  const load = async (picked: File | undefined) => {
    if (!picked) return;
    setText(await picked.text());
    setReport(null);
  };

  const website = report?.kind === 'website';
  const kept = report?.sections?.filter((s) => !s.skipped).length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{t('templates.import.intro')}</p>
      {parseError ? <Alert>{parseError}</Alert> : null}
      {run.isError && !parseError ? <Alert>{errorMessage(run.error, t('common.error'))}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label={t('templates.import.file')} onChange={(e) => void load(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
          <Upload className="size-3.5" /> {t('templates.import.file')}
        </Button>
        <span className="text-xs text-stone-500">{t('templates.import.orPaste')}</span>
      </div>
      <Field label={t('templates.import.json')}>
        {(p) => (
          <Textarea
            {...p}
            rows={10}
            spellCheck={false}
            className="font-mono text-xs"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setReport(null);
            }}
          />
        )}
      </Field>

      {report ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm" data-testid="import-report">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <FileJson className="size-4 text-brand-700" />
            <Badge tone="brand">{t(website ? 'templates.import.kind.website' : 'templates.import.kind.card')}</Badge>
            {website ? t('templates.import.summaryWebsite', { sections: kept, category: report.category }) : t('templates.import.summary', { layers: report.layers ?? 0, category: report.category })}
            {report.eventTypes.map((e) => (
              <Badge key={e}>{e}</Badge>
            ))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.name')}>{(p) => <Input {...p} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label={t('templates.key')} hint={report.keyTaken ? t('templates.import.keyTaken') : t('templates.keyHint')}>
              {(p) => <Input {...p} className="font-mono" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={key} onChange={(e) => setKey(e.target.value)} aria-invalid={report.keyTaken || undefined} />}
            </Field>
          </div>

          {report.sections?.length ? (
            <Part icon={<LayoutList className="size-4 text-brand-700" />} title={t('templates.import.sections')}>
              <ol className="gap-x-6 space-y-0.5 text-xs text-stone-700 sm:columns-2">
                {report.sections.map((s, i) => (
                  <li key={`${s.from}-${s.id ?? i}`} className="min-w-0 truncate break-inside-avoid">
                    <span className="font-mono">{s.from}</span>
                    {s.type !== s.from ? <span className="text-stone-500"> ({s.type})</span> : null} →{' '}
                    {s.section ? (
                      <strong>
                        {s.section}
                        {s.variant && s.variant !== 'default' ? ` · ${s.variant}` : ''}
                      </strong>
                    ) : (
                      <span className="text-amber-800">{t(`templates.import.skipped.${s.skipped ?? 'unknown'}`)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Part>
          ) : null}

          {report.fonts?.length ? (
            <Part icon={<Type className="size-4 text-brand-700" />} title={t('templates.import.fonts')}>
              <ul className="space-y-0.5 text-xs text-stone-700">
                {report.fonts.map((f) => (
                  <li key={f.role}>
                    {t(`templates.import.font.${f.role}`)}:{' '}
                    {f.substituted ? (
                      <>
                        <s className="text-stone-500">{f.requested}</s> → <strong>{f.family}</strong> <span className="text-stone-500">({t('templates.import.font.nearest')})</span>
                      </>
                    ) : (
                      <strong>{f.family}</strong>
                    )}
                  </li>
                ))}
              </ul>
            </Part>
          ) : null}

          {report.repairs?.length ? (
            <Part icon={<Wrench className="size-4 text-gold-700" />} title={t('templates.import.repairs', { count: report.repairs.length })}>
              <ul className="space-y-0.5 text-xs text-stone-700">
                {report.repairs.map((r, i) => (
                  <li key={`${r.at}:${r.from}:${i}`}>
                    <span className="font-mono">{r.from}</span> → <span className="font-mono font-semibold">{r.to}</span> <span className="text-stone-500">· {r.at}</span>
                  </li>
                ))}
              </ul>
            </Part>
          ) : null}

          {report.photos?.length ? (
            <Part icon={<Paintbrush className="size-4 text-brand-700" />} title={t('templates.import.photos')}>
              <ul className="gap-x-6 space-y-0.5 text-xs text-stone-700 sm:columns-2">
                {report.photos.map((p, i) => (
                  <li key={`${p.asset}:${p.binding}:${i}`}>
                    <span className="font-mono">{p.asset}</span> → <span className="font-mono">{`{{${p.binding}}}`}</span>
                    {p.shown ? null : <span className="text-amber-800"> · {t('templates.import.photo.notShown')}</span>}
                  </li>
                ))}
              </ul>
            </Part>
          ) : null}

          {report.unknownBindings?.length ? (
            <Part icon={<TriangleAlert className="size-4 text-amber-700" />} title={t('templates.import.unknownBindings')}>
              <ul className="space-y-0.5 text-xs text-stone-700">
                {report.unknownBindings.map((u, i) => (
                  <li key={`${u.at}:${u.binding}:${i}`}>
                    <span className="font-mono">{`{{${u.binding}}}`}</span> <span className="text-stone-500">· {u.at}</span>
                  </li>
                ))}
              </ul>
            </Part>
          ) : null}

          {report.standIns.length ? (
            <Part icon={website ? <ImageOff className="size-4 text-gold-700" /> : <Paintbrush className="size-4 text-gold-700" />} title={t(website ? 'templates.import.needsPhoto' : 'templates.import.standIns')}>
              <ul className="space-y-1 text-xs text-stone-700">
                {report.standIns.map((s, i) => (
                  <li key={`${s.element}:${i}`}>
                    <span className="font-mono">{s.element}</span> · {s.source || '—'} → {s.drawnAs ? <strong>{s.drawnAs}</strong> : <span className="text-red-700">{t('templates.import.leftOut')}</span>}
                  </li>
                ))}
              </ul>
            </Part>
          ) : null}

          {report.warnings.length ? (
            <details>
              <summary className="cursor-pointer font-medium">{t('templates.import.warnings', { count: report.warnings.length })}</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-stone-700">
                {report.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {report.issues.length ? (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-800">
                <TriangleAlert className="size-4" /> {t('templates.import.issues')}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
                {report.issues.map((i, n) => (
                  <li key={`${i.path}:${i.message}:${n}`}>
                    <span className="font-mono">{i.path}</span> {i.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-emerald-800">
              <CheckCircle2 className="size-4" /> {t('templates.import.valid')}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button variant="secondary" disabled={!text.trim() || run.isPending} onClick={() => run.mutate(false)}>
          {t('templates.import.check')}
        </Button>
        <Button disabled={!report || (report.keyTaken && key === report.key) || run.isPending} onClick={() => run.mutate(true)}>
          {run.isPending ? t('common.saving') : t('templates.import.create')}
        </Button>
      </div>
    </div>
  );
}
