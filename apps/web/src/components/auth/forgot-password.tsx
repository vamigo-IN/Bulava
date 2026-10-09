'use client';

import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { CodeInput, useCountdown } from './code-input';
import type { EmailChallenge } from './email-code-step';

/** What resetting answers: signed in, or the authenticator step, or the restore offer. */
export type ResetResult = { mfaRequired?: boolean; challengeToken?: string; restoreRequired?: boolean; restoreToken?: string; deleteAt?: string };

/**
 * "Forgot password?": a code to the email address, then the code with a new
 * password. The answer is the same whether or not the address has an account.
 */
export function ForgotPassword({ initialEmail, onResult, onBack }: { initialEmail: string; onResult: (result: ResetResult) => void; onBack: () => void }) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useCountdown(0);

  const restart = (message: string | null) => {
    setChallenge(null);
    setCode('');
    setNotice(null);
    setError(message);
  };

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<EmailChallenge>('/auth/password/forgot', { email: email.trim() });
      setChallenge(r);
      setResendIn(r.resendAfter);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      onResult(await apiPost<ResetResult>('/auth/password/reset', { challengeToken: challenge.challengeToken, code, newPassword: password }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') restart(errorMessage(t, err));
      else setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    setError(null);
    try {
      const r = await apiPost<{ resendAfter: number }>('/auth/email-code/resend', { challengeToken: challenge.challengeToken });
      setResendIn(r.resendAfter);
      setNotice(t('auth.code.resent'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') restart(errorMessage(t, err));
      else setError(errorMessage(t, err));
    }
  };

  return (
    <form onSubmit={challenge ? reset : request} className="space-y-5" noValidate>
      <span className="icon-3d size-12 rounded-2xl">
        <KeyRound aria-hidden className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.forgot.title')}</h1>
        <p className="mt-2 leading-relaxed text-stone-600">{challenge ? t('auth.forgot.codeBody', { target: challenge.target }) : t('auth.forgot.body')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {challenge ? (
        <>
          <Field label={t('auth.code.label')}>{(p) => <CodeInput {...p} autoFocus value={code} onChange={setCode} />}</Field>
          <Field label={t('auth.forgot.newPassword')} hint={t('auth.field.passwordHint')}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || code.length !== 6 || password.length < 10}>
            {busy ? t('common.loading') : t('auth.forgot.submit')}
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
            <button type="button" className="text-stone-600 underline underline-offset-4" onClick={() => restart(null)}>
              {t('auth.code.changeEmail')}
            </button>
          </div>
        </>
      ) : (
        <>
          <Field label={t('auth.field.email')}>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || !email.includes('@')}>
            {busy ? t('common.loading') : t('auth.forgot.send')}
          </Button>
        </>
      )}
      <button type="button" className="w-full text-center text-sm text-stone-600 underline underline-offset-4" onClick={onBack}>
        {t('auth.code.back')}
      </button>
    </form>
  );
}
