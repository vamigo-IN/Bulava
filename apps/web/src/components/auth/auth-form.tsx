'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarHeart, CheckCircle2, Eye, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { LoginSchema, SignupSchema, z } from '@bulava/validation';
import { ApiError, apiPost } from '@/lib/api';
import { loadSession } from '@/lib/session';
import type { MessageKey } from '@bulava/localization';
import { ConsentBox } from './consent-box';
import { EmailCodeStep, type EmailChallenge } from './email-code-step';
import { ForgotPassword } from './forgot-password';
import { GoogleButton, useProviders } from './google-button';
import { WhatsAppSignIn } from './whatsapp-sign-in';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
// The single module: the package entry would bring the whole template engine (and Zod) to sign-in.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { Alert, Button, Checkbox, Field, Input } from '@/components/ui/primitives';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';
import { PhoneInput } from '@/components/ui/phone-input';
import { BrandLogo } from '@/components/marketing/brand-logo';

type Mode = 'login' | 'signup';
type FormInput = z.input<typeof SignupSchema>;

/** What a sign-in or sign-up step answers: a next step, or nothing more to do (signed in). */
type StepResult = {
  mfaRequired?: boolean;
  challengeToken?: string;
  restoreRequired?: boolean;
  restoreToken?: string;
  deleteAt?: string;
  emailCodeRequired?: boolean;
  verificationRequired?: boolean;
  target?: string;
  resendAfter?: number;
};

/** Which panel the card shows: the ways in, the WhatsApp flow, an emailed code, or a password reset. */
type View = { kind: 'main' } | { kind: 'whatsapp' } | { kind: 'forgot' } | { kind: 'code'; purpose: Mode; challenge: EmailChallenge };

const LoginFormSchema = LoginSchema.extend({ name: z.string().optional(), acceptTerms: z.boolean().optional(), phone: z.string().optional(), whatsappUpdates: z.boolean().optional() });

const longDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard';
}

const linkClass = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';

function AuthFormInner({ mode }: { mode: Mode }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'main' });
  /** Set when the account asks for its authenticator code. */
  const [challenge, setChallenge] = useState<string | null>(null);
  /** Set when the sign-in reached an account waiting to be deleted: the one-use restore token. */
  const [restore, setRestore] = useState<{ token: string; until: string | null } | null>(null);
  const form = useForm<FormInput>({
    resolver: zodResolver((mode === 'signup' ? SignupSchema : LoginFormSchema) as typeof SignupSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false, phone: '', whatsappUpdates: false },
  });
  const { errors, isSubmitting } = form.formState;
  const providers = useProviders();
  const accepted = form.watch('acceptTerms') === true;
  const deletedOn = mode === 'login' && params.get('deleted') ? longDate(params.get('deleted')!) : null;
  /** Signing up with an email needs codes that can reach it (email set up on the server). */
  const emailForm = mode === 'login' || providers.emailCodes;

  const template = params.get('template');
  const fallback = template && /^[a-z0-9-]{1,80}$/.test(template) ? `/dashboard/events/new?template=${template}` : undefined;
  const target = params.get('next') ? safeNext(params.get('next')) : (fallback ?? '/dashboard');
  const finish = () => {
    router.replace(target);
    router.refresh();
  };

  /** After any step: the restore offer, the authenticator step, or in. */
  const next = (result: StepResult) => {
    if (result.restoreRequired && result.restoreToken) return setRestore({ token: result.restoreToken, until: result.deleteAt ?? null });
    if (result.mfaRequired && result.challengeToken) return setChallenge(result.challengeToken);
    finish();
  };

  /** Back to the ways in, with a message (a step that expired) or without. */
  const backToMain = (message: string | null) => {
    setView({ kind: 'main' });
    setServerError(message);
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
      const result = await apiPost<StepResult>(`/auth/${mode}`, mode === 'signup' ? values : { email: values.email, password: values.password });
      // A code went to the address: signing up waits for it to make the account, signing in to finish.
      if ((result.verificationRequired || result.emailCodeRequired) && result.challengeToken) {
        setView({ kind: 'code', purpose: mode, challenge: { challengeToken: result.challengeToken, target: result.target ?? '', resendAfter: result.resendAfter ?? 30 } });
        return;
      }
      next(result);
    } catch (error) {
      setServerError(errorMessage(t, error));
    }
  });

  /** On the sign-up page, WhatsApp and Google make an account: the Terms box comes first. */
  const blocked = (message: MessageKey) => {
    setServerError(t(message));
    void form.trigger('acceptTerms');
    form.setFocus('acceptTerms');
  };

  const openWhatsApp = () => {
    if (mode === 'signup' && !accepted) return blocked('auth.consent.whatsapp');
    setServerError(null);
    setView({ kind: 'whatsapp' });
  };

  let panel: ReactNode;
  if (challenge) {
    panel = (
      <SecondFactorStep
        challengeToken={challenge}
        onDone={finish}
        onRestart={(message) => {
          setChallenge(null);
          backToMain(message);
        }}
      />
    );
  } else if (restore) {
    panel = (
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
          backToMain(message);
        }}
      />
    );
  } else if (view.kind === 'code') {
    panel = (
      <div className="clay rounded-[2rem] p-6 sm:p-8">
        <EmailCodeStep<StepResult> purpose={view.purpose} challenge={view.challenge} onVerified={next} onRestart={backToMain} />
      </div>
    );
  } else if (view.kind === 'forgot') {
    panel = (
      <div className="clay rounded-[2rem] p-6 sm:p-8">
        <ForgotPassword initialEmail={form.getValues('email')} onResult={next} onBack={() => backToMain(null)} />
      </div>
    );
  } else if (view.kind === 'whatsapp') {
    panel = (
      <div className="clay rounded-[2rem] p-6 sm:p-8">
        <WhatsAppSignIn
          consented={mode === 'signup' && accepted}
          google={providers.google}
          next={target}
          onDone={finish}
          onChallenge={(token) => setChallenge(token)}
          onRestore={(token, until) => setRestore({ token, until })}
          onBack={() => backToMain(null)}
        />
      </div>
    );
  } else {
    const otherWays = providers.phoneOtp || providers.google;
    panel = (
      <>
        <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.02em]">{t(mode === 'signup' ? 'auth.signup.title' : 'auth.login.title')}</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">{t(mode === 'signup' ? 'auth.signup.lead' : 'auth.login.lead')}</p>
        {deletedOn ? (
          <div className="mt-6">
            <Alert tone="info">{t('auth.deleted.notice', { date: deletedOn })}</Alert>
          </div>
        ) : null}
        <div className="clay mt-8 rounded-[2rem] p-6 sm:p-8">
          {serverError ? (
            <div className="mb-5">
              <Alert>{serverError}</Alert>
            </div>
          ) : null}
          {otherWays ? (
            <div className="mb-6 space-y-3">
              {providers.phoneOtp ? (
                <button type="button" className="btn-3d btn-3d-green min-h-12 w-full gap-3 rounded-2xl px-5 font-medium" onClick={openWhatsApp}>
                  <WhatsAppMark className="size-5" />
                  {t('auth.whatsapp')}
                </button>
              ) : null}
              {providers.google ? (
                mode === 'signup' ? (
                  // A new account needs the ticked box below, whichever way it is made.
                  <GoogleButton next={target} label={t('auth.google')} consent={accepted} onBlocked={() => blocked('auth.consent.google')} />
                ) : (
                  <GoogleButton next={target} label={t('auth.google')} />
                )
              ) : null}
              {emailForm ? (
                <div className="flex items-center gap-3 pt-3 text-xs tracking-widest text-stone-500 uppercase">
                  <span className="h-px flex-1 bg-gold-200" />
                  {t('auth.orEmail')}
                  <span className="h-px flex-1 bg-gold-200" />
                </div>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {emailForm ? (
              <>
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
                {mode === 'login' && providers.emailCodes ? (
                  <div className="-mt-1 flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700"
                      onClick={() => {
                        setServerError(null);
                        setView({ kind: 'forgot' });
                      }}
                    >
                      {t('auth.forgot')}
                    </button>
                  </div>
                ) : null}
                {mode === 'signup' ? (
                  <>
                    <Field label={t('auth.field.phone')} hint={t('auth.field.phoneHint')} error={errors.phone?.message}>
                      {(p) => (
                        <Controller
                          control={form.control}
                          name="phone"
                          render={({ field }) => <PhoneInput {...p} name={field.name} placeholder="98765 43210" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />}
                        />
                      )}
                    </Field>
                    {/* A separate, optional consent: never bundled with the Terms below. */}
                    <Checkbox label={t('auth.field.whatsappUpdates')} {...form.register('whatsappUpdates')} />
                  </>
                ) : null}
              </>
            ) : (
              <Alert tone="info">{t('auth.signup.emailOff')}</Alert>
            )}
            {/* Never pre-ticked: consent has to be an explicit action (DPDP Act, e-commerce rules). */}
            {mode === 'signup' ? <ConsentBox error={errors.acceptTerms?.message} {...form.register('acceptTerms')} /> : null}
            {emailForm ? (
              <Button type="submit" size="lg" className="mt-2 min-h-13 w-full rounded-2xl" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t(mode === 'signup' ? 'auth.signup.submit' : 'auth.login.submit')}
              </Button>
            ) : null}
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-stone-600">
          {mode === 'signup' ? t('auth.signup.haveAccount') : t('auth.login.noAccount')}{' '}
          <Link className={linkClass} href={`${mode === 'signup' ? '/login' : '/signup'}${params.toString() ? `?${params.toString()}` : ''}`}>
            {t(mode === 'signup' ? 'auth.login.submit' : 'auth.signup.submit')}
          </Link>
        </p>
      </>
    );
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative isolate flex flex-col px-4 py-8 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_70%_80%_at_20%_0%,rgba(233,200,127,0.38),transparent_70%)]" />
        <BrandLogo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">{panel}</div>
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
