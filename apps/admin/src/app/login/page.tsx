'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { safeRelativePath } from '@bulava/validation';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Me } from '@/lib/types';

/** Only paths on the console (no open redirects, see safeRelativePath). */
function safeNext(value: string | null): string {
  return safeRelativePath(value, '/');
}

/** What a sign-in step answers: the next step, or nothing more to do (signed in). */
type Step = { mfaRequired?: boolean; emailCodeRequired?: boolean; challengeToken?: string; target?: string; resendAfter?: number; restoreRequired?: boolean };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set when the password was right and the account asks for its authenticator code. */
  const [challenge, setChallenge] = useState<string | null>(null);
  /** Set when the password was right and a code went to the account's email. */
  const [emailStep, setEmailStep] = useState<{ token: string; target: string } | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function enter() {
    const me = await apiGet<Me>('/users/me');
    if (!me.platformPermissions.length) {
      await apiPost('/auth/logout').catch(() => undefined);
      // Back to the first form, which says why.
      setEmailStep(null);
      setChallenge(null);
      setCode('');
      setNoAccess(true);
      return;
    }
    qc.setQueryData(['me'], me);
    router.replace(safeNext(params.get('next')));
  }

  function restart(message: string | null) {
    setChallenge(null);
    setEmailStep(null);
    setCode('');
    setNotice(null);
    setError(message);
  }

  /** After the password or the emailed code: the authenticator step, or in. */
  async function next(result: Step) {
    if (result.emailCodeRequired && result.challengeToken) {
      setEmailStep({ token: result.challengeToken, target: result.target ?? '' });
      setResendIn(result.resendAfter ?? 30);
      setPassword('');
      return;
    }
    if (result.mfaRequired && result.challengeToken) {
      setEmailStep(null);
      setCode('');
      setChallenge(result.challengeToken);
      setPassword('');
      return;
    }
    // An account waiting to be deleted is restored from the main site, not the console.
    if (result.restoreRequired) {
      restart(t('login.restoreElsewhere'));
      return;
    }
    await enter();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNoAccess(false);
    try {
      await next(await apiPost<Step>('/auth/login', { email, password }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' ? t('login.invalid') : err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailCode(e: FormEvent) {
    e.preventDefault();
    if (!emailStep) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await next(await apiPost<Step>('/auth/login/email', { challengeToken: emailStep.token, code }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') restart(err.message);
      else setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!emailStep) return;
    setError(null);
    try {
      const r = await apiPost<{ resendAfter: number }>('/auth/email-code/resend', { challengeToken: emailStep.token });
      setResendIn(r.resendAfter);
      setNotice(t('login.codeSent'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') restart(err.message);
      else setError(err instanceof ApiError ? err.message : t('common.error'));
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/auth/login/mfa', useRecovery ? { challengeToken: challenge, recoveryCode: code } : { challengeToken: challenge, code });
      await enter();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MFA_CHALLENGE_EXPIRED') {
        setChallenge(null);
        setCode('');
      }
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  if (emailStep) {
    return (
      <form onSubmit={submitEmailCode} className="space-y-4">
        <div className="text-center">
          <p className="font-medium">{t('login.codeTitle')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('login.codeBody', { target: emailStep.target })}</p>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Field label={t('login.code')}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="text-center font-mono text-xl tracking-[0.4em]"
            />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? t('common.loading') : t('login.codeVerify')}
        </Button>
        <div className="flex justify-between text-xs">
          <button type="button" className="text-brand-700 underline disabled:text-stone-400 disabled:no-underline" disabled={resendIn > 0} onClick={() => void resend()}>
            {resendIn > 0 ? t('login.codeResendIn', { seconds: resendIn }) : t('login.codeResend')}
          </button>
          <button type="button" className="text-stone-500 underline" onClick={() => restart(null)}>
            {t('login.mfaBack')}
          </button>
        </div>
      </form>
    );
  }

  if (challenge) {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div className="text-center">
          <p className="font-medium">{t('login.mfaTitle')}</p>
          <p className="mt-1 text-sm text-stone-500">{t(useRecovery ? 'login.mfaRecoveryBody' : 'login.mfaBody')}</p>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <Field label={t(useRecovery ? 'login.mfaRecovery' : 'login.mfaCode')}>
          {(p) => (
            <Input
              {...p}
              key={useRecovery ? 'recovery' : 'code'}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete={useRecovery ? 'off' : 'one-time-code'}
              inputMode={useRecovery ? 'text' : 'numeric'}
              maxLength={useRecovery ? 40 : 7}
              className={useRecovery ? undefined : 'text-center font-mono text-xl tracking-[0.4em]'}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
          {busy ? t('common.loading') : t('login.mfaVerify')}
        </Button>
        <div className="flex justify-between text-xs">
          <button
            type="button"
            className="text-brand-700 underline"
            onClick={() => {
              setUseRecovery((v) => !v);
              setCode('');
              setError(null);
            }}
          >
            {t(useRecovery ? 'login.mfaUseCode' : 'login.mfaUseRecovery')}
          </button>
          <button type="button" className="text-stone-500 underline" onClick={() => restart(null)}>
            {t('login.mfaBack')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {noAccess ? <Alert tone="warning">{t('login.noAccess')}</Alert> : null}
      <Field label={t('common.email')}>
        {(p) => <Input {...p} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label={t('common.password')}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t('common.loading') : t('login.submit')}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 font-display text-2xl font-bold text-brand-900">ब</span>
          <h1 className="mt-3 font-display text-2xl font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-stone-500">{t('login.subtitle')}</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
