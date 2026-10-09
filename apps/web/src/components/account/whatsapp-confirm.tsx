'use client';

import { PhoneOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { Alert, Button, Field } from '@/components/ui/primitives';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';
import { CodeInput, useCountdown } from '@/components/auth/code-input';
import { useWhatsAppDelivery } from '@/components/auth/use-whatsapp-delivery';
import { DeliveryChip } from '@/components/auth/whatsapp-sign-in';

/**
 * Confirms the account's own WhatsApp number with a code: once confirmed, the
 * number signs in with WhatsApp too (and an account made from it is secured).
 */
export function WhatsAppConfirm({ onConfirmed }: { onConfirmed: () => void | Promise<void> }) {
  const t = useT();
  const [sent, setSent] = useState<{ target: string; sendId: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useCountdown(0);
  const delivery = useWhatsAppDelivery(sent?.sendId ?? null);
  const tried = useRef('');

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ target: string; sendId: string; resendAfter: number }>('/users/me/phone/code');
      setSent({ target: r.target, sendId: r.sendId });
      setResendIn(r.resendAfter);
      setCode('');
      tried.current = '';
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    tried.current = value;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/users/me/phone/confirm', { code: value });
      await onConfirmed();
    } catch (err) {
      setError(errorMessage(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // The sixth digit sends the code.
  useEffect(() => {
    if (sent && code.length === 6 && code !== tried.current && !busy) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!sent) {
    return (
      <div className="space-y-3">
        {error ? <Alert>{error}</Alert> : null}
        <Button variant="whatsapp" className="gap-2 rounded-2xl" disabled={busy} onClick={() => void send()}>
          <WhatsAppMark className="size-4" />
          {busy ? t('common.loading') : t('phoneConfirm.send')}
        </Button>
      </div>
    );
  }

  if (delivery === 'failed') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <PhoneOff aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-2">
          <p>{t('phoneConfirm.failed', { target: sent.target })}</p>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setSent(null)}>
            {t('phoneConfirm.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (code.length === 6 && !busy) void verify(code);
      }}
      className="max-w-sm space-y-3"
      noValidate
    >
      <p className="text-sm text-stone-600">{t('phoneConfirm.sent', { target: sent.target })}</p>
      <DeliveryChip delivery={delivery} />
      {error ? <Alert>{error}</Alert> : null}
      <Field label={t('auth.code.label')}>{(p) => <CodeInput {...p} autoFocus value={code} onChange={setCode} />}</Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="whatsapp" className="rounded-2xl" disabled={busy || code.length !== 6}>
          {busy ? t('common.loading') : t('phoneConfirm.verify')}
        </Button>
        <button
          type="button"
          className="text-sm font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 disabled:cursor-default disabled:text-stone-500 disabled:no-underline"
          disabled={resendIn > 0 || busy}
          onClick={() => void send()}
        >
          {resendIn > 0 ? t('auth.code.resendIn', { seconds: resendIn }) : t('auth.code.resend')}
        </button>
      </div>
    </form>
  );
}
