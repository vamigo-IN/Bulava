'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarHeart, CheckCircle2, Eye } from 'lucide-react';
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

const LoginFormSchema = LoginSchema.extend({ name: z.string().optional() });

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
  const form = useForm<FormInput>({
    resolver: zodResolver((mode === 'signup' ? SignupSchema : LoginFormSchema) as typeof SignupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const google = useGoogleEnabled();

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
      const result = await apiPost<{ mfaRequired?: boolean; challengeToken?: string }>(
        `/auth/${mode}`,
        mode === 'signup' ? values : { email: values.email, password: values.password },
      );
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
    <main className="grid min-h-dvh bg-ivory lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative isolate flex flex-col px-4 py-8 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_70%_80%_at_20%_0%,rgba(227,197,133,0.3),transparent_70%)]" />
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
          ) : (
            <>
              <h1 className="font-display text-5xl leading-[1.05] tracking-tight">{t(mode === 'signup' ? 'auth.signup.title' : 'auth.login.title')}</h1>
              <div className="mt-8 rounded-[2rem] border border-gold-200/80 bg-white p-6 shadow-lift sm:p-8">
                {google ? (
                  <div className="mb-6 space-y-5">
                    <GoogleButton next={target} label={t('auth.google')} />
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
                  <Button type="submit" size="lg" className="mt-2 w-full rounded-full" disabled={isSubmitting}>
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
      <aside className="grain relative isolate hidden overflow-hidden bg-night-950 text-ivory lg:flex lg:items-center lg:justify-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-[760px] w-[760px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.65),transparent)]" />
          <div className="absolute -bottom-52 -left-32 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.18),transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[820px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-300 opacity-[0.08]" />
        <div className="relative max-w-md px-10">
          <p className="font-script text-6xl text-gold-200">Bulava</p>
          <p className="mt-6 font-display text-4xl leading-[1.1] text-balance">{t('home.hero.title')}</p>
          <ul aria-hidden="true" className="mt-12 space-y-3">
            {([
              ['home.hero.chip.opened', Eye],
              ['home.hero.chip.rsvp', CheckCircle2],
              ['home.hero.chip.event', CalendarHeart],
            ] as const).map(([key, Icon], i) => (
              <li key={key} className="animate-pop-in" style={{ animationDelay: `${0.3 + i * 0.15}s`, marginLeft: `${i * 28}px` }}>
                <span className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pr-5 pl-2.5 text-sm font-medium backdrop-blur-md">
                  <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-b from-gold-200 to-gold-300 text-night-900">
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
    <form onSubmit={submit} className="space-y-4 rounded-[2rem] border border-gold-200/80 bg-white p-6 shadow-lift sm:p-8" noValidate>
      <h1 className="font-display text-4xl tracking-tight">{t('auth.mfa.title')}</h1>
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
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy || !value.trim()}>
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

export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <I18nProvider language="en">
      <AuthFormInner mode={mode} />
    </I18nProvider>
  );
}
