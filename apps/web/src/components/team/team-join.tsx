'use client';

import { CheckCircle2, KeyRound, LogIn, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { BrandLogo } from '@/components/marketing/brand-logo';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui/primitives';
import { ConsentBox } from '@/components/auth/consent-box';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

interface InviteInfo {
  eventTitle: string;
  role: string;
  invitedBy: string | null;
  email: string;
  accountExists: boolean;
}

type Step = 'code' | 'create' | 'signin' | 'done';

/** The code survives the trip through the sign-in page, for this tab only. */
const codeKey = (token: string) => `bulava_team_code_${token.slice(0, 12)}`;

function Join({ token }: { token: string }) {
  const t = useT();
  const router = useRouter();
  const session = useSession();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  /** The Terms box: never pre-ticked. */
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const passwordShort = password.length > 0 && password.length < 10;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<InviteInfo>(`/team-invites/${token}`)
      .then(setInfo)
      .catch((err: unknown) => setLoadError(errorMessage(t, err)));
    try {
      const saved = sessionStorage.getItem(codeKey(token));
      if (saved) {
        setCode(saved);
        setStep('signin');
      }
    } catch {
      // Storage may be unavailable; the code is simply typed again.
    }
  }, [token, t]);

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'TEAM_INVITE_CODE_INVALID') {
      const left = (err.details as { attemptsLeft?: number } | undefined)?.attemptsLeft;
      setError(left !== undefined ? t('join.attemptsLeft', { count: left }) : errorMessage(t, err));
      setStep('code');
    } else if (err instanceof ApiError && err.code === 'TEAM_INVITE_SIGN_IN') {
      setStep('signin');
    } else {
      setError(errorMessage(t, err));
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ ok: true; accountExists: boolean }>(`/team-invites/${token}/verify`, { code });
      setStep(result.accountExists ? 'signin' : 'create');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const finish = (id: string) => {
    try {
      sessionStorage.removeItem(codeKey(token));
    } catch {
      // Nothing stored.
    }
    setEventId(id);
    setStep('done');
    setTimeout(() => router.replace(`/dashboard/events/${id}`), 1200);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setConsentError(t('auth.consent.required'));
      return;
    }
    if (passwordShort) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ eventId: string }>(`/team-invites/${token}/accept`, { code, name, acceptTerms: true, password });
      finish(result.eventId);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const joinSignedIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ eventId: string }>(`/team-invites/${token}/join`, { code });
      finish(result.eventId);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const goSignIn = () => {
    try {
      sessionStorage.setItem(codeKey(token), code);
    } catch {
      // They type the code again after signing in.
    }
  };

  const role = info ? t(`team.role.${info.role}` as MessageKey) : '';
  const signedInAs = session.status === 'signed-in' ? session.user.email : null;

  return (
    <main className="relative isolate flex min-h-dvh flex-col bg-ivory px-4 py-8 sm:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_70%_80%_at_20%_0%,rgba(227,197,133,0.3),transparent_70%)]" />
      <BrandLogo />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        {loadError ? (
          <Alert>{loadError}</Alert>
        ) : !info ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <>
            <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200 shadow-[0_12px_24px_-12px_rgba(91,14,27,0.8)]">
              <Users className="size-6" />
            </span>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-tight">{t('join.title', { event: info.eventTitle })}</h1>
            <p className="mt-2 text-stone-600">{info.invitedBy ? t('join.subtitle', { name: info.invitedBy, role }) : t('join.subtitleNoName', { role })}</p>

            <div className="mt-8 rounded-[2rem] border border-gold-200/80 bg-white p-6 shadow-lift sm:p-8">
              {error ? (
                <div className="mb-4">
                  <Alert>{error}</Alert>
                </div>
              ) : null}

              {step === 'code' ? (
                <form onSubmit={verify} className="space-y-4" noValidate>
                  <p className="flex items-center gap-2 text-sm text-stone-600">
                    <KeyRound aria-hidden className="size-4 text-gold-600" />
                    {t('join.codeHint', { email: info.email })}
                  </p>
                  <Field label={t('join.codeLabel')}>
                    {(p) => (
                      <Input
                        {...p}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={7}
                        autoFocus
                        className="text-center font-mono text-2xl tracking-[0.4em]"
                      />
                    )}
                  </Field>
                  <Button type="submit" size="lg" className="w-full" disabled={busy || code.replace(/\D/g, '').length !== 6}>
                    {busy ? t('common.loading') : t('join.verify')}
                  </Button>
                </form>
              ) : null}

              {step === 'create' ? (
                <form onSubmit={create} className="space-y-4" noValidate>
                  <h2 className="font-display text-2xl">{t('join.create.title')}</h2>
                  <Field label={t('auth.field.name')}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />}</Field>
                  {/* For password managers: which account a password belongs to. */}
                  <input type="email" autoComplete="username" value={info.email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
                  <Field label={t('auth.new.password')} error={passwordShort ? t('auth.field.passwordHint') : undefined}>
                    {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={128} />}
                  </Field>
                  <ConsentBox
                    checked={accepted}
                    error={consentError}
                    onChange={(e) => {
                      setAccepted(e.target.checked);
                      if (e.target.checked) setConsentError(undefined);
                    }}
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim() || passwordShort}>
                    {busy ? t('common.loading') : t('join.create.submit')}
                  </Button>
                </form>
              ) : null}

              {step === 'signin' ? (
                signedInAs ? (
                  <div className="space-y-4">
                    <p className="text-sm text-stone-600">{t('join.signedIn.body', { email: signedInAs })}</p>
                    <Button size="lg" className="w-full" disabled={busy || code.replace(/\D/g, '').length !== 6} onClick={joinSignedIn}>
                      {busy ? t('common.loading') : t('join.signedIn.submit')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="font-display text-2xl">{t('join.signIn.title')}</h2>
                    <p className="text-sm text-stone-600">{t('join.signIn.body', { email: info.email })}</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/team/join/${token}`)}`}
                      onClick={goSignIn}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 font-semibold text-ivory transition-colors hover:bg-brand-800"
                    >
                      <LogIn aria-hidden className="size-4" />
                      {t('join.signIn.cta')}
                    </Link>
                  </div>
                )
              ) : null}

              {step === 'done' ? (
                <div className="space-y-4 text-center">
                  <CheckCircle2 aria-hidden className="mx-auto size-10 text-emerald-700" />
                  <p className="font-display text-2xl">{t('join.done')}</p>
                  {eventId ? (
                    <Link href={`/dashboard/events/${eventId}`} className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-ivory hover:bg-brand-800">
                      {t('join.open')}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export function TeamJoin({ token }: { token: string }) {
  return (
    <I18nProvider language="en">
      <Join token={token} />
    </I18nProvider>
  );
}
