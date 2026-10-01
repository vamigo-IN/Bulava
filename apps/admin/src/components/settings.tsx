'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Info, XCircle } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { apiGet, apiPost, apiPut, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { SettingCheckResult, SettingGroup, SettingGroupView, SettingsOverview } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { RequirePermission, useInvalidate } from './shell';
import { Alert, Badge, Button, Card, ErrorNotice, Field, Input, PageHeader, Spinner, Textarea } from './ui';

export function useSettingsOverview() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => apiGet<SettingsOverview>('/admin/settings') });
}

/** Page frame for the Super Admin's settings: permission, header, loading and errors. */
export function SettingsPage({ title, subtitle, children }: { title: string; subtitle: string; children: (overview: SettingsOverview) => ReactNode }) {
  return (
    <RequirePermission permission="settings.manage">
      <PageHeader title={title} subtitle={subtitle} />
      <SettingsBody>{children}</SettingsBody>
    </RequirePermission>
  );
}

function SettingsBody({ children }: { children: (overview: SettingsOverview) => ReactNode }) {
  const overview = useSettingsOverview();
  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorNotice error={overview.error} />;
  return <div className="max-w-4xl space-y-6">{children(overview.data)}</div>;
}

const clone = <V,>(v: V): V => JSON.parse(JSON.stringify(v ?? {})) as V;

/**
 * A local, editable copy of one settings group. Secret changes are kept apart:
 * a string replaces the secret, null removes it, and an untouched secret is
 * not sent at all (the saved one stays).
 */
export function useGroupEditor<V extends object>(group: SettingGroup, view: SettingGroupView, options: { ignoreKeys?: string[] } = {}) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<V>(() => clone(view.value as V));
  const [secrets, setSecrets] = useState<Record<string, string | null>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** Counts successful saves; secret fields remount on it so they close again. */
  const [saves, setSaves] = useState(0);
  // Fields changed elsewhere (such as uploaded logo keys) do not count as unsaved edits.
  const comparable = (v: object) => JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k]) => !options.ignoreKeys?.includes(k))));
  const dirty = comparable(draft) !== comparable(view.value) || Object.keys(secrets).length > 0;
  const save = useMutation({
    mutationFn: () => apiPut<SettingGroupView>(`/admin/settings/${group}`, { value: draft, secrets }),
    onSuccess: async (saved) => {
      // Refresh the saved view first, so secret fields reopen on the new status, not the old one.
      await invalidate(['admin', 'settings']);
      setDraft(clone(saved.value as V));
      setSecrets({});
      setSavedAt(Date.now());
      setSaves((n) => n + 1);
    },
  });
  const set = <K extends keyof V>(key: K, value: V[K]) => {
    setSavedAt(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const setSecret = (name: string, value: string | null | undefined) => {
    setSavedAt(null);
    setSecrets((s) => {
      const next = { ...s };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return next;
    });
  };
  return { draft, setDraft, set, secrets, setSecret, dirty, save, savedAt, saves };
}

export type GroupEditor<V extends object> = ReturnType<typeof useGroupEditor<V>>;

const SOURCE_TONE = { admin: 'success', environment: 'warning', default: 'neutral' } as const;

/** One settings group: heading, status, fields, and a save bar. */
export function SettingsCard<V extends object>({
  title,
  description,
  view,
  editor,
  status,
  children,
  after,
  savedMessage = t('settings.saved'),
}: {
  title: string;
  description?: ReactNode;
  view: SettingGroupView;
  editor: GroupEditor<V>;
  /** Integration status shown beside the title. */
  status?: { tone: 'success' | 'warning' | 'neutral'; label: string };
  children: ReactNode;
  /** Below the save bar and outside the form (connection tests), so Enter there never saves. */
  after?: ReactNode;
  savedMessage?: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description ? <div className="mt-1 max-w-2xl text-sm text-stone-500">{description}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          <Badge tone={SOURCE_TONE[view.source]}>{t(`settings.source.${view.source}`)}</Badge>
        </div>
      </div>
      {view.source === 'environment' ? (
        <Alert tone="info" className="mb-4">
          {t('settings.sourceHint.environment')}
        </Alert>
      ) : null}
      {view.ignored.length ? (
        <Alert tone="warning" className="mb-4">
          {t('settings.ignored', { fields: view.ignored.join(', ') })}
        </Alert>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editor.save.mutate();
        }}
      >
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          {/* Values from server variables can be saved as they are, which copies them into the console. */}
          <Button type="submit" disabled={!(editor.dirty || view.source === 'environment') || editor.save.isPending}>
            {editor.save.isPending ? t('common.saving') : t('settings.save')}
          </Button>
          {editor.dirty ? <span className="text-xs font-medium text-amber-700">{t('settings.unsaved')}</span> : null}
          {editor.savedAt && !editor.dirty ? <span className="text-sm text-green-700">{savedMessage}</span> : null}
          {view.updatedAt ? (
            <span className="ml-auto text-xs text-stone-400">{t('settings.lastSaved', { when: formatDateTime(view.updatedAt), name: view.updatedBy ?? '—' })}</span>
          ) : null}
        </div>
        {editor.save.isError ? <Alert className="mt-3">{errorMessage(editor.save.error, t('common.error'))}</Alert> : null}
      </form>
      {after ? <div className="mt-4">{after}</div> : null}
    </Card>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  className,
  ...props
}: { label: string; hint?: string; value: string | number | undefined | null; onChange: (value: string) => void; className?: string } & Omit<ComponentProps<'input'>, 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(p) => <Input {...p} {...props} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  className,
  mono,
  rows = 4,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  className?: string;
  mono?: boolean;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(p) => <Textarea {...p} rows={rows} maxLength={maxLength} spellCheck={!mono} className={cn(mono && 'font-mono text-xs')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/** A list edited one item per line. */
export function LinesField({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string[] | undefined; onChange: (value: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState((value ?? []).join('\n'));
  return (
    <Field label={label} hint={hint}>
      {(p) => (
        <Textarea
          {...p}
          rows={Math.min(8, Math.max(3, text.split('\n').length + 1))}
          className="font-mono text-xs"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(
              e.target.value
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
            );
          }}
        />
      )}
    </Field>
  );
}

/**
 * Write-only secret: shows whether it is saved (last four characters), and
 * lets the Super Admin replace or remove it. The value never comes back.
 */
export function SecretField({
  label,
  hint,
  status,
  change,
  onChange,
}: {
  label: string;
  hint?: string;
  status: { set: boolean; hint: string | null } | undefined;
  /** undefined = keep, string = replace, null = remove. */
  change: string | null | undefined;
  onChange: (value: string | null | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const saved = Boolean(status?.set);
  return (
    <Field label={label} hint={hint}>
      {(p) =>
        change === null ? (
          <div className="flex min-h-10 flex-wrap items-center gap-3 text-sm">
            <span className="text-red-700">{t('settings.secret.willRemove')}</span>
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : saved && !editing ? (
          <div className="flex min-h-10 flex-wrap items-center gap-3 text-sm">
            <span id={p.id} className="font-mono text-stone-700">
              {t('settings.secret.set', { hint: status?.hint ?? '••••' })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {t('settings.secret.replace')}
            </Button>
            <Button size="sm" variant="ghost" className="text-red-700" onClick={() => onChange(null)}>
              {t('settings.secret.remove')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              className="max-w-md font-mono"
              placeholder={saved ? t('settings.secret.placeholder') : t('settings.secret.notSet')}
              value={change ?? ''}
              onChange={(e) => onChange(e.target.value ? e.target.value : undefined)}
            />
            {saved ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  onChange(undefined);
                }}
              >
                {t('settings.secret.keep')}
              </Button>
            ) : null}
          </div>
        )
      }
    </Field>
  );
}

/** A secret of one settings group. It closes again after every save. */
export function GroupSecret<V extends object>({ editor, view, name, label, hint }: { editor: GroupEditor<V>; view: SettingGroupView; name: string; label: string; hint?: string }) {
  return <SecretField key={editor.saves} label={label} hint={hint} status={view.secrets[name]} change={editor.secrets[name]} onChange={(value) => editor.setSecret(name, value)} />;
}

function StepIcon({ ok }: { ok: boolean | null }) {
  if (ok === true) return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-label="passed" />;
  if (ok === false) return <XCircle className="mt-0.5 size-4 shrink-0 text-red-700" aria-label="failed" />;
  return <Info className="mt-0.5 size-4 shrink-0 text-stone-400" aria-label="note" />;
}

export function CheckResultView({ result }: { result: SettingCheckResult }) {
  return (
    <div className="mt-3" role="status">
      <p className={cn('flex items-center gap-2 text-sm font-semibold', result.ok ? 'text-green-800' : 'text-red-800')}>
        {result.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
        {result.ok ? t('settings.check.passed') : t('settings.check.failed')}
        <span className="text-xs font-normal text-stone-500">· {t('settings.check.lastRun', { when: formatDateTime(result.checkedAt) })}</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {result.steps.map((step, i) => (
          <li key={`${step.label}-${i}`} className="flex gap-2 text-sm">
            <StepIcon ok={step.ok} />
            <span>
              <span className="text-stone-800">{step.label}</span>
              {step.detail ? <span className="block text-xs break-words text-stone-500">{step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Runs a live test against the saved settings (API keys, SMTP, DNS…) and shows each step. */
export function CheckPanel({ target, lastCheck, dirty, body, children }: { target: string; lastCheck: SettingCheckResult | null; dirty?: boolean; body?: object; children?: ReactNode }) {
  const invalidate = useInvalidate();
  const run = useMutation({
    mutationFn: () => apiPost<SettingCheckResult>(`/admin/settings/checks/${target}`, body ?? {}),
    onSettled: () => invalidate(['admin', 'settings']),
  });
  const result = run.data ?? lastCheck;
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <Button variant="secondary" size="sm" disabled={run.isPending || dirty} onClick={() => run.mutate()}>
          {run.isPending ? t('settings.check.running') : t('settings.check.run')}
        </Button>
        {dirty ? <span className="text-xs text-stone-500">{t('settings.check.saveFirst')}</span> : null}
      </div>
      {run.isError ? <Alert className="mt-3">{errorMessage(run.error, t('common.error'))}</Alert> : null}
      {result ? <CheckResultView result={result} /> : null}
    </div>
  );
}
