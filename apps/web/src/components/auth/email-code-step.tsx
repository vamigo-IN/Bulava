'use client';

import { MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Button, Field } from '@/components/ui/primitives';
import { CodeInput, useCountdown } from './code-input';

/** A code on its way to an email address: the API's answer when signing in (or up) or adding an email. */
export interface EmailChallenge {
  challengeToken: string;
  /** The address, masked. */
  target: string;
  /** Seconds before another code may be sent. */
  resendAfter: number;
}

/** Where each step's code is checked. */
const VERIFY_PATH = { access: '/auth/email/verify', signup: '/auth/signup/verify', login: '/auth/login/email', claim: '/auth/claim/verify' } as const;
export type EmailCodePurpose = keyof typeof VERIFY_PATH;

/**
 * Entering the code just emailed. The sixth digit sends it; a step that has
 * expired (or run out of tries) goes back to the start through `onRestart`.
 */
export function EmailCodeStep<R>({
  purpose,
  challenge,
  onVerified,
  onRestart,
  heading: Heading = 'h1',
}: {
  purpose: EmailCodePurpose;
  challenge: EmailChallenge;
  onVerified: (result: R) => void | Promise<void>;
  onRestart: (message: string | null) => void;
  heading?: 'h1' | 'h2';
}) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useCountdown(challenge.resendAfter);
  const tried = useRef('');

  const verify = async (value: string) => {
    tried.current = value;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onVerified(await apiPost<R>(VERIFY_PATH[purpose], { challengeToken: challenge.challengeToken, code: value }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') {
        onRestart(errorMessage(t, err));
        return;
      }
      setError(errorMessage(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // The sixth digit sends the code, whether typed, pasted or suggested by the phone.
  useEffect(() => {
    if (code.length === 6 && code !== tried.current && !busy) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const r = await apiPost<{ resendAfter: number }>('/auth/email-code/resend', { challengeToken: challenge.challengeToken });
      setResendIn(r.resendAfter);
      setNotice(t('auth.code.resent'));
      tried.current = '';
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') onRestart(errorMessage(t, err));
      else setError(errorMessage(t, err));
    }
  };

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (code.length === 6 && !busy) void verify(code);
      }}
      className="space-y-5"
      noValidate
    >
      <span className="icon-3d size-12 rounded-2xl">
        <MailCheck aria-hidden className="size-6" />
      </span>
      <div>
        <Heading className={cn('font-display leading-tight tracking-[-0.015em]', Heading === 'h1' ? 'text-4xl' : 'text-2xl')}>{t(`auth.code.${purpose}.title`)}</Heading>
        <p className="mt-2 leading-relaxed text-stone-600">{t('auth.code.body', { target: challenge.target })}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Field label={t('auth.code.label')}>{(p) => <CodeInput {...p} autoFocus value={code} onChange={setCode} />}</Field>
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || code.length !== 6}>
        {busy ? t('common.loading') : t(`auth.code.${purpose}.submit`)}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          className="font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700 disabled:cursor-default disabled:text-stone-500 disabled:no-underline"
          disabled={resendIn > 0}
          onClick={() => void resend()}
        >
          {resendIn > 0 ? t('auth.code.resendIn', { seconds: resendIn }) : t('auth.code.resend')}
        </button>
        <button type="button" className="text-stone-600 underline underline-offset-4" onClick={() => onRestart(null)}>
          {t(purpose === 'login' ? 'auth.code.back' : 'auth.code.changeEmail')}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-stone-500">{t('auth.code.spam')}</p>
    </form>
  );
}
