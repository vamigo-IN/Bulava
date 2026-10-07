'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarHeart, CheckCircle2, Eye, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { LoginSchema, SignupSchema, z } from '@bulava/validation';
import { ApiError, apiPost } from '@/lib/api';
import { loadSession } from '@/lib/session';
import type { MessageKey } from '@bulava/localization';
import { GoogleButton, useGoogleEnabled } from './google-button';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
// The single module: the package entry would bring the whole template engine (and Zod) to sign-in.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/marketing/brand-logo';

type Mode = 'login' | 'signup';
type FormInput = z.input<typeof SignupSchema>;

const LoginFormSchema = LoginSchema.extend({ name: z.string().optional(), acceptTerms: z.boolean().optional() });

const longDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard';
}

function AuthFormInner({ mode }: { mode: Mode }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  /** Set when the password was right and the account asks for a second factor. */
  const [challenge, setChallenge] = useState<string | null>(null);
  /** Set when the sign-in reached an account waiting to be deleted: the one-use restore token. */
  const [restore, setRestore] = useState<{ token: string; until: string | null } | null>(null);
  const form = useForm<FormInput>({
    resolver: zodResolver((mode === 'signup' ? SignupSchema : LoginFormSchema) as typeof SignupSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false },
  });
  const { errors, isSubmitting } = form.formState;
  const google = useGoogleEnabled();
  const accepted = form.watch('acceptTerms') === true;
  const deletedOn = mode === 'login' && params.get('deleted') ? longDate(params.get('deleted')!) : null;

  const template = params.get('template');
  const fallback = template && /^[a-z0-9-]{1,80}$/.test(template) ? `/dashboard/events/new?template=${template}` : undefined;
  const target = params.get('next') ? safeNext(params.get('next')) : (fallback ?? '/dashboard');
  const finish = () => {
    router.replace(target);
    router.refresh();
  };

  // Coming back from Google: an error to show, or a two-step challenge in the fragment.
  useEffect(() => {
    const code = params.get('error');
    if (code && /^[A-Z_]{3,40}$/.test(code)) setServerError(t(`error.${code}` as MessageKey));
    const mfa = /^#mfa=([A-Za-z0-9_-]{20,200})$/.exec(window.location.hash)?.[1];
    if (mfa) {
      setChallenge(mfa);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // Back from Google to an account waiting to be deleted: the offer to restore it.
    const restoreHash = /^#restore=([A-Za-z0-9_-]{20,128})(?:&until=([^&]+))?$/.exec(window.location.hash);
    if (restoreHash) {
      setRestore({ token: restoreHash[1]!, until: restoreHash[2] ? decodeURIComponent(restoreHash[2]) : null });
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already signed in (for example "Use this template" from a public page): skip the form.
  useEffect(() => {
    void loadSession().then((s) => {
      if (s.status === 'signed-in') finish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiPost<{ mfaRequired?: boolean; challengeToken?: string; restoreRequired?: boolean; restoreToken?: string; deleteAt?: string }>(
        `/auth/${mode}`,
        mode === 'signup' ? values : { email: values.email, password: values.password },
      );
      if (result.restoreRequired && result.restoreToken) {
        setRestore({ token: result.restoreToken, until: result.deleteAt ?? null });
        return;
      }
      if (result.mfaRequired && result.challengeToken) {
        setChallenge(result.challengeToken);
        return;
      }
      finish();
    } catch (error) {
      setServerError(errorMessage(t, error));
    }
  });

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative isolate flex flex-col px-4 py-8 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_70%_80%_at_20%_0%,rgba(233,200,127,0.38),transparent_70%)]" />
        <BrandLogo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {challenge ? (
            <SecondFactorStep
              challengeToken={challenge}
              onDone={finish}
              onRestart={(message) => {
                setChallenge(null);
                setServerError(message);
              }}
            />
          ) : restore ? (
            <RestoreStep
              token={restore.token}
              until={restore.until}
              onRestored={(mfaChallenge) => {
                setRestore(null);
                if (mfaChallenge) setChallenge(mfaChallenge);
                else finish();
              }}
              onCancel={(message) => {
                setRestore(null);
                setServerError(message);
              }}
            />
          ) : (
            <>
              <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.02em]">{t(mode === 'signup' ? 'auth.signup.title' : 'auth.login.title')}</h1>
              {deletedOn ? (
                <div className="mt-6">
                  <Alert tone="info">{t('auth.deleted.notice', { date: deletedOn })}</Alert>
                </div>
              ) : null}
              <div className="clay mt-8 rounded-[2rem] p-6 sm:p-8">
                {google ? (
                  <div className="mb-6 space-y-5">
                    {mode === 'signup' ? (
                      // A new account needs the ticked box below, whichever way it is created.
                      <GoogleButton
                        next={target}
                        label={t('auth.google')}
                        consent={accepted}
                        onBlocked={() => {
                          setServerError(t('auth.consent.google'));
                          void form.trigger('acceptTerms');
                          form.setFocus('acceptTerms');
                        }}
                      />
                    ) : (
                      <GoogleButton next={target} label={t('auth.google')} />
                    )}
                    <div className="flex items-center gap-3 text-xs tracking-widest text-stone-500 uppercase">
                      <span className="h-px flex-1 bg-gold-200" />
                      {t('auth.or')}
                      <span className="h-px flex-1 bg-gold-200" />
                    </div>
                  </div>
                ) : null}
                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  {serverError ? <Alert>{serverError}</Alert> : null}
                  {mode === 'signup' ? (
                    <Field label={t('auth.field.name')} error={errors.name?.message}>
                      {(p) => <Input {...p} autoComplete="name" {...form.register('name')} />}
                    </Field>
                  ) : null}
                  <Field label={t('auth.field.email')} error={errors.email?.message}>
                    {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...form.register('email')} />}
                  </Field>
                  <Field label={t('auth.field.password')} hint={mode === 'signup' ? t('auth.field.passwordHint') : undefined} error={errors.password?.message}>
                    {(p) => <Input {...p} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} {...form.register('password')} />}
                  </Field>
                  {mode === 'signup' ? (
                    <div className="rounded-2xl bg-[#f8f2ea] p-4 shadow-clay-inset">
                      {/* Never pre-ticked: consent has to be an explicit action (DPDP Act, e-commerce rules). */}
                      <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed text-stone-800">
                        <input
                          type="checkbox"
                          className="mt-1 size-5 shrink-0 rounded border-stone-300 accent-brand-700"
                          aria-invalid={errors.acceptTerms ? true : undefined}
                          aria-describedby="consent-notice"
                          {...form.register('acceptTerms')}
                        />
                        <span>
                          {t('auth.consent.before')}{' '}
                          <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                            {t('auth.consent.terms')}
                          </Link>{' '}
                          {t('auth.consent.and')}{' '}
                          <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                            {t('auth.consent.privacy')}
                          </Link>
                          .
                        </span>
                      </label>
                      {errors.acceptTerms?.message ? (
                        <p role="alert" className="mt-2 pl-8 text-sm text-red-700">
                          {errors.acceptTerms.message}
                        </p>
                      ) : null}
                      <p id="consent-notice" className="mt-2.5 pl-8 text-xs leading-relaxed text-stone-600">
                        {t('auth.consent.notice')}
                      </p>
                    </div>
                  ) : null}
                  <Button type="submit" size="lg" className="mt-2 min-h-13 w-full rounded-2xl" disabled={isSubmitting}>
                    {isSubmitting ? t('common.loading') : t(mode === 'signup' ? 'auth.signup.submit' : 'auth.login.submit')}
                  </Button>
                </form>
              </div>
              <p className="mt-6 text-center text-sm text-stone-600">
                {mode === 'signup' ? t('auth.signup.haveAccount') : t('auth.login.noAccount')}{' '}
                <Link className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700" href={`${mode === 'signup' ? '/login' : '/signup'}${params.toString() ? `?${params.toString()}` : ''}`}>
                  {t(mode === 'signup' ? 'auth.login.submit' : 'auth.signup.submit')}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
      {/* A maroon clay slab beside the form, lit from the top left like the buttons. */}
      <aside className="relative isolate m-4 hidden overflow-hidden rounded-[2.5rem] bg-[linear-gradient(160deg,#a33441,#7a1d27_48%,#4a0b16)] text-ivory shadow-[inset_0_3px_2px_rgba(255,255,255,0.2),inset_5px_0_4px_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(30,2,8,0.45),inset_-6px_0_10px_rgba(30,2,8,0.3),8px_30px_60px_-22px_rgba(74,11,22,0.55)] lg:flex lg:items-center lg:justify-center">
        <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[820px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-200 opacity-[0.1]" />
        <div className="relative max-w-md px-10">
          <p className="font-script text-6xl text-gold-200">Bulava</p>
          <p className="mt-6 font-display text-4xl leading-[1.12] text-balance">{t('home.hero.title')}</p>
          <ul aria-hidden="true" className="mt-12 space-y-3">
            {([
              ['home.hero.chip.opened', Eye],
              ['home.hero.chip.rsvp', CheckCircle2],
              ['home.hero.chip.event', CalendarHeart],
            ] as const).map(([key, Icon], i) => (
              <li key={key} className="animate-pop-in" style={{ animationDelay: `${0.3 + i * 0.15}s`, marginLeft: `${i * 28}px` }}>
                <span className="clay inline-flex items-center gap-3 rounded-2xl py-2.5 pr-5 pl-2.5 text-sm font-medium text-ink">
                  <span className="icon-3d size-8 rounded-xl">
                    <Icon className="size-4" />
                  </span>
                  {t(key)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

/** Second step of sign-in: an authenticator code, or one recovery code. */
function SecondFactorStep({ challengeToken, onDone, onRestart }: { challengeToken: string; onDone: () => void; onRestart: (message: string | null) => void }) {
  const t = useT();
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/auth/login/mfa', useRecovery ? { challengeToken, recoveryCode: value } : { challengeToken, code: value });
      onDone();
    } catch (err) {
      // An expired or exhausted challenge means starting again from the password.
      if (err instanceof ApiError && err.code === 'MFA_CHALLENGE_EXPIRED') onRestart(errorMessage(t, err));
      else setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="clay space-y-4 rounded-[2rem] p-6 sm:p-8" noValidate>
      <h1 className="font-display text-4xl tracking-[-0.015em]">{t('auth.mfa.title')}</h1>
      <p className="text-stone-600">{t(useRecovery ? 'auth.mfa.recoveryBody' : 'auth.mfa.body')}</p>
      {error ? <Alert>{error}</Alert> : null}
      <Field label={t(useRecovery ? 'auth.mfa.recovery' : 'auth.mfa.code')}>
        {(p) => (
          <Input
            {...p}
            key={useRecovery ? 'recovery' : 'code'}
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete={useRecovery ? 'off' : 'one-time-code'}
            inputMode={useRecovery ? 'text' : 'numeric'}
            maxLength={useRecovery ? 40 : 7}
            className={useRecovery ? undefined : 'text-center font-mono text-2xl tracking-[0.4em]'}
          />
        )}
      </Field>
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || !value.trim()}>
        {busy ? t('common.loading') : t('auth.mfa.verify')}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          className="font-medium text-brand-700 underline"
          onClick={() => {
            setUseRecovery((v) => !v);
            setValue('');
            setError(null);
          }}
        >
          {t(useRecovery ? 'auth.mfa.useCode' : 'auth.mfa.useRecovery')}
        </button>
        <button type="button" className="text-stone-600 underline" onClick={() => onRestart(null)}>
          {t('auth.mfa.back')}
        </button>
      </div>
    </form>
  );
}

/**
 * Signing in to an account waiting to be deleted: restore it (the events, guests and
 * photos come back) or leave it to be erased. The token is good once, for 15 minutes.
 */
function RestoreStep({ token, until, onRestored, onCancel }: { token: string; until: string | null; onRestored: (mfaChallenge: string | null) => void; onCancel: (message: string | null) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = until ? longDate(until) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ mfaRequired?: boolean; challengeToken?: string }>('/auth/restore', { token });
      onRestored(result.mfaRequired && result.challengeToken ? result.challengeToken : null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESTORE_EXPIRED') onCancel(errorMessage(t, err));
      else setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="clay space-y-4 rounded-[2rem] p-6 sm:p-8">
      <span className="icon-3d size-12 rounded-2xl">
        <RotateCcw aria-hidden className="size-6" />
      </span>
      <h1 className="font-display text-4xl tracking-[-0.015em]">{t('auth.restore.title')}</h1>
      <p className="leading-relaxed text-stone-600">{date ? t('auth.restore.body', { date }) : t('auth.restore.bodyNoDate')}</p>
      {error ? <Alert>{error}</Alert> : null}
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy}>
        {busy ? t('common.loading') : t('auth.restore.submit')}
      </Button>
      <button type="button" className="w-full text-center text-sm text-stone-600 underline" onClick={() => onCancel(null)}>
        {t('auth.restore.cancel')}
      </button>
    </form>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <I18nProvider language="en">
      <AuthFormInner mode={mode} />
    </I18nProvider>
  );
}
