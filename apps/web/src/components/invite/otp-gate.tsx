'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
import { Alert, Button, Input } from '@/components/ui/primitives';

function Gate({ token, target }: { token: string; target: string }) {
  const t = useT();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/public/invitations/${token}/otp`);
      setSent(true);
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
      const { pass } = await apiPost<{ pass: string; expiresAt: string }>(`/public/invitations/${token}/otp/verify`, { code });
      // Store the pass as an httpOnly cookie (set by our own route handler).
      await fetch('/invite/otp-pass', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bulava-csrf': '1' }, body: JSON.stringify({ pass }) });
      router.refresh();
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <main className="paper flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl border border-gold-200 bg-white p-7 text-center shadow-sm">
        <p aria-hidden className="text-4xl">
          🔐
        </p>
        <h1 className="mt-3 font-display text-3xl">{t('otp.title')}</h1>
        <p className="mt-2 text-sm text-stone-600">{sent ? t('otp.sent', { target }) : t('otp.body', { target })}</p>
        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {sent ? (
          <form onSubmit={verify} className="mt-5 space-y-3">
            <Input
              aria-label={t('otp.code')}
              placeholder={t('otp.code')}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em]"
            />
            <Button type="submit" className="w-full rounded-full" disabled={busy || code.length !== 6}>
              {t('otp.verify')}
            </Button>
            <button type="button" onClick={send} disabled={busy} className="text-sm text-brand-700 underline">
              {t('otp.resend')}
            </button>
          </form>
        ) : (
          <Button className="mt-5 w-full rounded-full" onClick={send} disabled={busy}>
            {t('otp.send')}
          </Button>
        )}
      </div>
    </main>
  );
}

export function OtpGate({ token, target }: { token: string; target: string }) {
  return (
    <I18nProvider language="en">
      <Gate token={token} target={target} />
    </I18nProvider>
  );
}
