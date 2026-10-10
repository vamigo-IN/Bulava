'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { CodeInput, useCountdown } from '@/components/auth/code-input';
import type { EmailChallenge } from '@/components/auth/email-code-step';

/** What resetting answers: signed in again, or (two-step sign-in on) the authenticator step. */
type ResetResult = { mfaRequired?: boolean; challengeToken?: string };

/**
 * Account → Password, "Forgot it?": a code to the account's email, then a new
 * password (POST /auth/password/forgot, /auth/password/reset). Every other
 * session ends; this browser is signed in again, through the authenticator
 * step on the sign-in page when two-step sign-in is on.
 */
export function PasswordReset({ email, onDone, onCancel }: { email: string; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useCountdown(0);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<EmailChallenge>('/auth/password/forgot', { email });
      setChallenge(r);
      setResendIn(r.resendAfter);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const expired = (err: unknown) => {
    if (!(err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED')) return false;
    setChallenge(null);
    setCode('');
    setError(errorMessage(t, err));
    return true;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiPost<ResetResult>('/auth/password/reset', { challengeToken: challenge.challengeToken, code, newPassword: password });
      if (result.mfaRequired && result.challengeToken) {
        window.location.assign(`/login?next=${encodeURIComponent('/dashboard/account/security')}#mfa=${result.challengeToken}`);
        return;
      }
      onDone();
    } catch (err) {
      if (!expired(err)) setError(errorMessage(t, err));
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
      if (!expired(err)) setError(errorMessage(t, err));
    }
  };

  return (
    <form onSubmit={save} className="space-y-3" noValidate>
      <p className="text-sm leading-relaxed text-stone-600">{challenge ? t('methods.password.codeSent', { target: challenge.target }) : t('methods.password.resetBody', { email })}</p>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {challenge ? (
        <>
          <Field label={t('auth.code.label')}>{(p) => <CodeInput {...p} autoFocus value={code} onChange={setCode} className="max-w-sm" />}</Field>
          <Field label={t('methods.password.new')} hint={t('methods.password.hint')}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || code.length !== 6 || password.length < 10}>
              {busy ? t('common.loading') : t('methods.password.resetSubmit')}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <button
              type="button"
              className="ml-auto text-sm font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700 disabled:cursor-default disabled:text-stone-500 disabled:no-underline"
              disabled={resendIn > 0}
              onClick={() => void resend()}
            >
              {resendIn > 0 ? t('auth.code.resendIn', { seconds: resendIn }) : t('auth.code.resend')}
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void send()}>
            {busy ? t('common.loading') : t('methods.password.sendCode')}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
    </form>
  );
}
