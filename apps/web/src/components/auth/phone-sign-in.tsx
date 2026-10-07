'use client';

import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

type Result = { mfaRequired?: boolean; challengeToken?: string; restoreRequired?: boolean; restoreToken?: string; deleteAt?: string };

/**
 * Signing in with a WhatsApp number: a six-digit code instead of a password.
 * Two-step accounts and accounts waiting to be deleted continue in the parent
 * form's own steps.
 */
export function PhoneSignIn({ onDone, onChallenge, onRestore, onBack }: { onDone: () => void; onChallenge: (token: string) => void; onRestore: (token: string, until: string | null) => void; onBack: () => void }) {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ target: string }>('/auth/phone/otp', { phone });
      setSent(r.target);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<Result>('/auth/phone/verify', { phone, code });
      if (result.restoreRequired && result.restoreToken) return onRestore(result.restoreToken, result.deleteAt ?? null);
      if (result.mfaRequired && result.challengeToken) return onChallenge(result.challengeToken);
      onDone();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={sent ? verify : send} className="space-y-4" noValidate>
      <p className="text-sm text-stone-600">{t('auth.phone.body')}</p>
      {error ? <Alert>{error}</Alert> : null}
      {sent ? <Alert tone="success">{t('auth.phone.sent', { target: sent })}</Alert> : null}
      <Field label={t('auth.phone.number')}>
        {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" required readOnly={!!sent} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />}
      </Field>
      {sent ? (
        <Field label={t('auth.phone.code')}>
          {(p) => <Input {...p} autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-2xl tracking-[0.4em]" />}
        </Field>
      ) : null}
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || !phone.trim() || (!!sent && code.length !== 6)}>
        {busy ? t('common.loading') : sent ? t('auth.phone.verify') : t('auth.phone.send')}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        {sent ? (
          <button
            type="button"
            className="font-medium text-brand-700 underline"
            onClick={() => {
              setSent(null);
              setCode('');
              setError(null);
            }}
          >
            {t('auth.phone.change')}
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="text-stone-600 underline" onClick={onBack}>
          {t('auth.phone.useEmail')}
        </button>
      </div>
    </form>
  );
}
