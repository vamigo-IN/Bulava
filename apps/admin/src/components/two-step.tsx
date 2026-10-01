'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { MfaStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Alert, Badge, Button, Card, Field, Input } from './ui';

interface SetupData {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
}

type Mode = 'idle' | 'password' | 'scan' | 'codes' | 'regenerate' | 'disable';

export const MFA_STATUS_KEY = ['auth', 'mfa'];

/**
 * Two-step sign-in management for the signed-in staff member: enrol with an
 * authenticator app, save recovery codes, create new ones, or turn it off
 * (only when the role does not require it).
 */
export function TwoStepPanel({ onEnabled, startOpen = false }: { onEnabled?: () => void; startOpen?: boolean }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: MFA_STATUS_KEY, queryFn: () => apiGet<MfaStatus>('/auth/mfa') });
  const [mode, setMode] = useState<Mode>(startOpen ? 'password' : 'idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reset = (next: Mode = 'idle') => {
    setMode(next);
    setPassword('');
    setCode('');
    setMessage(null);
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err, t('common.error')) });
    } finally {
      setBusy(false);
    }
  }

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: MFA_STATUS_KEY }), qc.invalidateQueries({ queryKey: ['me'] })]);

  const begin = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setSetup(await apiPost<SetupData>('/auth/mfa/setup', { password }));
      setPassword('');
      setMode('scan');
    });
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const result = await apiPost<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code });
      setCodes(result.recoveryCodes);
      setSetup(null);
      setCode('');
      setMode('codes');
      await qc.invalidateQueries({ queryKey: MFA_STATUS_KEY });
    });
  };

  const regenerate = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const result = await apiPost<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { code });
      setCodes(result.recoveryCodes);
      setCode('');
      setMode('codes');
      await qc.invalidateQueries({ queryKey: MFA_STATUS_KEY });
    });
  };

  const disable = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiPost('/auth/mfa/disable', /^\d[\d\s]{5,6}$/.test(code.trim()) ? { password, code } : { password, recoveryCode: code });
      reset();
      setMessage({ tone: 'success', text: t('mfa.disabled') });
      await refresh();
    });
  };

  const finishCodes = async () => {
    setCodes([]);
    reset();
    setMessage({ tone: 'success', text: t('mfa.enabled') });
    await refresh();
    onEnabled?.();
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const blob = new Blob([`${t('mfa.codesFile')}\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'bulava-admin-recovery-codes.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = status.data;
  const actions = (submit: string, danger = false): ReactNode => (
    <div className="flex gap-2">
      <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy}>
        {submit}
      </Button>
      <Button type="button" variant="ghost" onClick={() => reset()}>
        {t('common.cancel')}
      </Button>
    </div>
  );
  const codeField = (allowRecovery = false) => (
    <Field label={t('mfa.code')}>
      {(p) => (
        <Input
          {...p}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode={allowRecovery ? 'text' : 'numeric'}
          maxLength={allowRecovery ? 40 : 7}
          className="max-w-xs font-mono text-lg tracking-widest"
        />
      )}
    </Field>
  );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-brand-700" aria-hidden />
          <div>
            <h2 className="font-display text-xl font-semibold">{t('mfa.title')}</h2>
            <p className="max-w-prose text-sm text-stone-600">{t('mfa.subtitle')}</p>
          </div>
        </div>
        {s ? <Badge tone={s.enabled ? 'success' : 'neutral'}>{t(s.enabled ? 'mfa.on' : 'mfa.off')}</Badge> : null}
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {mode === 'codes' ? (
        <div className="space-y-3 rounded-xl border border-gold-300 bg-gold-100 p-4">
          <p className="font-medium">{t('mfa.codesTitle')}</p>
          <p className="text-sm text-stone-600">{t('mfa.codesBody')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label={t('mfa.codesTitle')} data-testid="recovery-codes">
            {codes.map((c) => (
              <li key={c} className="rounded-lg bg-white px-3 py-2 text-center">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void copyCodes()}>
              {copied ? t('mfa.copied') : t('mfa.copy')}
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadCodes}>
              {t('mfa.download')}
            </Button>
            <Button size="sm" onClick={() => void finishCodes()}>
              {t('mfa.done')}
            </Button>
          </div>
        </div>
      ) : null}

      {s && !s.enabled && mode === 'idle' ? <Button onClick={() => reset('password')}>{t('mfa.turnOn')}</Button> : null}

      {mode === 'password' ? (
        <form onSubmit={begin} className="space-y-3">
          <Field label={t('mfa.password')}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />}
          </Field>
          {actions(t('mfa.continue'))}
        </form>
      ) : null}

      {mode === 'scan' && setup ? (
        <form onSubmit={confirm} className="grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* An image, not inline markup: the SVG comes from the API and is never executed. */}
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} alt={t('mfa.qrAlt')} className="size-44 rounded-xl border border-stone-200 bg-white p-2" />
          <div className="space-y-3">
            <p className="text-sm">{t('mfa.scan')}</p>
            <p className="text-xs text-stone-600">{t('mfa.manual')}</p>
            <code data-testid="totp-secret" className="block break-all rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm select-all">
              {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
            </code>
            <p className="text-sm">{t('mfa.enterCode')}</p>
            {codeField()}
            {actions(t('mfa.confirm'))}
          </div>
        </form>
      ) : null}

      {s?.enabled && mode === 'idle' ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {t('mfa.enabledSince', { date: formatDate(s.enabledAt) })} · {t('mfa.remaining', { count: s.recoveryCodesRemaining })}
          </p>
          {s.recoveryCodesRemaining <= 3 ? <Alert tone="warning">{t('mfa.remainingLow', { count: s.recoveryCodesRemaining })}</Alert> : null}
          {s.requiredForStaff ? <p className="text-xs text-stone-500">{t('mfa.requiredNote')}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => reset('regenerate')}>
              {t('mfa.regenerate')}
            </Button>
            {s.requiredForStaff ? null : (
              <Button variant="danger" onClick={() => reset('disable')}>
                {t('mfa.turnOff')}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {mode === 'regenerate' ? (
        <form onSubmit={regenerate} className="space-y-3">
          <p className="text-sm text-stone-600">{t('mfa.regenerateBody')}</p>
          {codeField()}
          {actions(t('mfa.regenerate'))}
        </form>
      ) : null}

      {mode === 'disable' ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-stone-600">{t('mfa.turnOffBody')}</p>
          <Field label={t('mfa.password')}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />}
          </Field>
          {codeField(true)}
          {actions(t('mfa.turnOff'), true)}
        </form>
      ) : null}
    </Card>
  );
}
