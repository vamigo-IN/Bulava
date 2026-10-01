'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Me } from '@/lib/types';

/** Only same-origin paths: never redirect to an attacker-supplied URL. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set when the password was right and the account asks for a second factor. */
  const [challenge, setChallenge] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');

  async function enter() {
    const me = await apiGet<Me>('/users/me');
    if (!me.platformPermissions.length) {
      await apiPost('/auth/logout').catch(() => undefined);
      setNoAccess(true);
      return;
    }
    qc.setQueryData(['me'], me);
    router.replace(safeNext(params.get('next')));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNoAccess(false);
    try {
      const result = await apiPost<{ mfaRequired?: boolean; challengeToken?: string }>('/auth/login', { email, password });
      if (result.mfaRequired && result.challengeToken) {
        setChallenge(result.challengeToken);
        setPassword('');
        return;
      }
      await enter();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' ? t('login.invalid') : err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
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
          <button
            type="button"
            className="text-stone-500 underline"
            onClick={() => {
              setChallenge(null);
              setCode('');
              setError(null);
            }}
          >
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
