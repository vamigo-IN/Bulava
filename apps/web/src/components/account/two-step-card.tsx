'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { formatEventDate } from '@bulava/localization';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui/primitives';
import { apiGet, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';

interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  requiredForStaff: boolean;
  sessionVerified: boolean;
}

interface SetupData {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
}

type Mode = 'idle' | 'password' | 'scan' | 'codes' | 'regenerate' | 'disable';

const MFA_KEY = ['auth', 'mfa'];

/** Account settings: turn two-step sign-in (authenticator app + recovery codes) on or off. */
export function TwoStepCard({ hasPassword = true }: { hasPassword?: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: MFA_KEY, queryFn: () => apiGet<MfaStatus>('/auth/mfa') });
  const [mode, setMode] = useState<Mode>('idle');
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
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

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
      await qc.invalidateQueries({ queryKey: MFA_KEY });
    });
  };

  const regenerate = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const result = await apiPost<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { code });
      setCodes(result.recoveryCodes);
      setCode('');
      setMode('codes');
      await qc.invalidateQueries({ queryKey: MFA_KEY });
    });
  };

  const disable = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiPost('/auth/mfa/disable', /^\d[\d\s]{5,6}$/.test(code.trim()) ? { password, code } : { password, recoveryCode: code });
      reset();
      setMessage({ tone: 'success', text: t('mfa.disabled') });
      await qc.invalidateQueries({ queryKey: MFA_KEY });
    });
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const blob = new Blob([`${t('mfa.codesFile')}\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'bulava-recovery-codes.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = status.data;
  const codeInput = (label = t('mfa.code')) => (
    <Field label={label}>
      {(p) => (
        <Input
          {...p}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={mode === 'disable' ? 40 : 7}
          className="max-w-xs font-mono text-lg tracking-widest"
        />
      )}
    </Field>
  );

  return (
    <Card className="space-y-4 rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{t('mfa.title')}</h2>
          <p className="max-w-prose text-sm text-stone-600">{t('mfa.subtitle')}</p>
        </div>
        {s ? <Badge tone={s.enabled ? 'success' : 'neutral'}>{t(s.enabled ? 'mfa.on' : 'mfa.off')}</Badge> : null}
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {mode === 'codes' ? (
        <div className="space-y-3 rounded-2xl border border-gold-300 bg-gold-100 p-4">
          <p className="font-medium">{t('mfa.codesTitle')}</p>
          <p className="text-sm text-stone-600">{t('mfa.codesBody')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label={t('mfa.codesTitle')}>
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
            <Button
              size="sm"
              onClick={() => {
                setCodes([]);
                reset();
                setMessage({ tone: 'success', text: t('mfa.enabled') });
              }}
            >
              {t('mfa.done')}
            </Button>
          </div>
        </div>
      ) : null}

      {s && !s.enabled && mode === 'idle' ? (
        hasPassword ? (
          <Button onClick={() => reset('password')}>{t('mfa.turnOn')}</Button>
        ) : (
          <Alert tone="info">{t('mfa.needsPassword')}</Alert>
        )
      ) : null}

      {mode === 'password' ? (
        <form onSubmit={begin} className="space-y-3">
          <Field label={t('mfa.password')}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t('mfa.continue')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => reset()}>
              {t('mfa.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'scan' && setup ? (
        <form onSubmit={confirm} className="grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* An image, not inline markup: the SVG comes from the API and is never executed. */}
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} alt={t('mfa.qrAlt')} className="size-44 rounded-xl border border-gold-200 bg-white p-2" />
          <div className="space-y-3">
            <p className="text-sm">{t('mfa.scan')}</p>
            <p className="text-xs text-stone-600">{t('mfa.manual')}</p>
            <code data-testid="totp-secret" className="block break-all rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm select-all">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            <p className="text-sm">{t('mfa.enterCode')}</p>
            {codeInput()}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {t('mfa.confirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => reset()}>
                {t('mfa.cancel')}
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {s?.enabled && mode === 'idle' ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {s.enabledAt ? t('mfa.enabledSince', { date: formatEventDate(s.enabledAt, { language: 'en', timeZone: 'Asia/Kolkata' }) }) : null}
            {' · '}
            {t('mfa.remaining', { count: s.recoveryCodesRemaining })}
          </p>
          {s.recoveryCodesRemaining <= 3 ? <Alert tone="warning">{t('mfa.remainingLow', { count: s.recoveryCodesRemaining })}</Alert> : null}
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
          {codeInput()}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t('mfa.regenerate')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => reset()}>
              {t('mfa.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'disable' ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-stone-600">{t('mfa.turnOffBody')}</p>
          <Field label={t('mfa.password')}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />}
          </Field>
          {codeInput()}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy}>
              {t('mfa.turnOff')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => reset()}>
              {t('mfa.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
