'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileJson, Paintbrush, TriangleAlert, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Field, Input, Textarea } from '@/components/ui';
import { apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';

/** What the API reports about card JSON (POST /admin/templates/import-card). */
interface ImportReport {
  key: string;
  name: string;
  category: string;
  eventTypes: string[];
  layers: number;
  standIns: Array<{ element: string; source: string; drawnAs: string | null }>;
  warnings: string[];
  issues: Array<{ path: string; message: string }>;
  keyTaken: boolean;
  template?: { id: string };
}

/**
 * Card JSON from a design tool or generator (a canvas, a theme, data and a list
 * of elements) becomes a canvas template: check it first, see what could not be
 * carried over, then make the draft and finish it in the Studio's Canvas editor.
 */
export function ImportCardForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);

  const card = (): Record<string, unknown> | null => {
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
      const body = card();
      if (!body) return Promise.reject(new Error(t('templates.import.notJson')));
      return apiPost<ImportReport>('/admin/templates/import-card', { card: body, create, ...(key ? { key } : {}), ...(name ? { name } : {}) });
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{t('templates.import.intro')}</p>
      {parseError ? <Alert>{parseError}</Alert> : null}
      {run.isError && !parseError ? <Alert>{errorMessage(run.error, t('common.error'))}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void load(e.target.files?.[0])} />
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
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <FileJson className="size-4 text-brand-700" />
            {t('templates.import.summary', { layers: report.layers, category: report.category })}
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
          {report.standIns.length ? (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <Paintbrush className="size-4 text-gold-700" /> {t('templates.import.standIns')}
              </p>
              <ul className="space-y-1 text-xs text-stone-700">
                {report.standIns.map((s) => (
                  <li key={s.element}>
                    <span className="font-mono">{s.element}</span> · {s.source || '—'} → {s.drawnAs ? <strong>{s.drawnAs}</strong> : <span className="text-red-700">{t('templates.import.leftOut')}</span>}
                  </li>
                ))}
              </ul>
            </div>
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
                {report.issues.map((i) => (
                  <li key={`${i.path}:${i.message}`}>
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
