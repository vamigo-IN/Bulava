'use client';

import { ArrowLeft, CalendarHeart, CheckCircle2, Eye, KeyRound, RotateCcw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { readIdentifier } from '@/lib/identifier';
import { loadSession } from '@/lib/session';
import type { MessageKey } from '@bulava/localization';
import { EmailCodeStep, type EmailChallenge } from './email-code-step';
import { GoogleButton, useProviders } from './google-button';
import { IdentifierInput } from './identifier-input';
import { NewAccountStep } from './new-account-step';
import { WhatsAppSignIn } from './whatsapp-sign-in';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
// The single module: the package entry would bring the whole template engine (and Zod) to sign-in.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/marketing/brand-logo';

/** What a sign-in step answers: a next step, or nothing more to do (signed in). */
type StepResult = {
  mfaRequired?: boolean;
  challengeToken?: string;
  restoreRequired?: boolean;
  restoreToken?: string;
  deleteAt?: string;
  signupRequired?: boolean;
  signupToken?: string;
  target?: string;
};

/** Which panel the card shows: the field, a password, an emailed code, the WhatsApp code, or the last step for someone new. */
type View =
  | { kind: 'identify' }
  | { kind: 'password'; email: string }
  | { kind: 'email-code'; email: string; challenge: EmailChallenge }
  | { kind: 'whatsapp'; phone: string }
  | { kind: 'new'; via: 'email' | 'google'; token: string; name?: string; email?: string };

const longDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

/**
 * Signing in, for everyone (ADR-052): one field for an email or a WhatsApp
 * number, told apart as it is typed, and Google. A number gets a WhatsApp code;
 * an email gets a code, or its password when the account has one (a code stays
 * one click away). Someone new finishes with a name and the Terms box (and,
 * with an email, an optional password). Every way ends where the person was
 * going (`next`), checkout included.
 */
function AuthFormInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const providers = useProviders();
  const [view, setView] = useState<View>({ kind: 'identify' });
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the account asks for its authenticator code. */
  const [challenge, setChallenge] = useState<string | null>(null);
  /** Set when the sign-in reached an account waiting to be deleted: the one-use restore token. */
  const [restore, setRestore] = useState<{ token: string; until: string | null } | null>(null);
  const deletedOn = params.get('deleted') ? longDate(params.get('deleted')!) : null;

  // Where to go afterwards: `next`, a plan from the pricing page (its checkout), a template to start with, or the dashboard.
  const template = params.get('template');
  const plan = params.get('plan');
  const target =
    safeNext(params.get('next')) ??
    (plan && /^[A-Z0-9_]{1,40}$/.test(plan) ? `/dashboard/checkout?plan=${plan}` : template && /^[a-z0-9-]{1,80}$/.test(template) ? `/dashboard/events/new?template=${template}` : '/dashboard');
  const finish = () => {
    router.replace(target);
    router.refresh();
  };

  /** After any step: the restore offer, the authenticator step, someone new, or in. */
  const next = (result: StepResult, email?: string) => {
    if (result.restoreRequired && result.restoreToken) return setRestore({ token: result.restoreToken, until: result.deleteAt ?? null });
    if (result.mfaRequired && result.challengeToken) return setChallenge(result.challengeToken);
    if (result.signupRequired && result.signupToken) return setView({ kind: 'new', via: 'email', token: result.signupToken, email });
    finish();
  };

  /** Back to the field, with a message (a step that expired) or without. */
  const backToStart = (message: string | null) => {
    setView({ kind: 'identify' });
    setChallenge(null);
    setRestore(null);
    setError(message);
  };

  // Coming back from Google: an error to show, a two-step challenge, a restore offer, or a new account to finish.
  useEffect(() => {
    const code = params.get('error');
    if (code && /^[A-Z_]{3,40}$/.test(code)) setError(t(`error.${code}` as MessageKey));
    const hash = window.location.hash;
    const clear = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const mfa = /^#mfa=([A-Za-z0-9_-]{20,200})$/.exec(hash)?.[1];
    if (mfa) {
      setChallenge(mfa);
      clear();
    }
    const restoreHash = /^#restore=([A-Za-z0-9_-]{20,128})(?:&until=([^&]+))?$/.exec(hash);
    if (restoreHash) {
      setRestore({ token: restoreHash[1]!, until: restoreHash[2] ? decodeURIComponent(restoreHash[2]) : null });
      clear();
    }
    const google = /^#google-signup=([A-Za-z0-9_-]{20,200})(?:&name=([^&]*))?$/.exec(hash);
    if (google) {
      const name = google[2] ? decodeURIComponent(google[2]).slice(0, 120) : '';
      setView({ kind: 'new', via: 'google', token: google[1]!, name });
      clear();
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

  const read = readIdentifier(identifier);
  const ready = (read.kind === 'email' && read.valid) || (read.kind === 'phone' && read.phone !== null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    if (read.kind === 'phone' && read.phone) {
      if (!providers.phoneOtp) return setError(t('auth.unified.whatsappOff'));
      return setView({ kind: 'whatsapp', phone: read.phone });
    }
    if (read.kind !== 'email') return;
    setBusy(true);
    try {
      const result = await apiPost<{ method: 'password' } | ({ method: 'code' } & EmailChallenge)>('/auth/email/start', { email: read.email });
      if (result.method === 'password') setView({ kind: 'password', email: read.email });
      else setView({ kind: 'email-code', email: read.email, challenge: result });
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  let panel: ReactNode;
  if (challenge) {
    panel = <SecondFactorStep challengeToken={challenge} onDone={finish} onRestart={backToStart} />;
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
        onCancel={backToStart}
      />
    );
  } else if (view.kind === 'new') {
    panel = (
      <Card>
        <NewAccountStep via={view.via} token={view.token} email={view.email} initialName={view.name} onDone={finish} onExpired={backToStart} />
      </Card>
    );
  } else if (view.kind === 'email-code') {
    panel = (
      <Card>
        <EmailCodeStep<StepResult> purpose="access" challenge={view.challenge} onVerified={(result) => next(result, view.email)} onRestart={backToStart} />
      </Card>
    );
  } else if (view.kind === 'password') {
    panel = (
      <Card>
        <PasswordStep
          email={view.email}
          onResult={(result) => next(result)}
          onCode={(challenge) => setView({ kind: 'email-code', email: view.email, challenge })}
          onBack={() => backToStart(null)}
        />
      </Card>
    );
  } else if (view.kind === 'whatsapp') {
    panel = (
      <Card>
        <WhatsAppSignIn
          phone={view.phone}
          google={providers.google}
          next={target}
          onDone={finish}
          onChallenge={(token) => setChallenge(token)}
          onRestore={(token, until) => setRestore({ token, until })}
          onBack={backToStart}
        />
      </Card>
    );
  } else {
    panel = (
      <>
        <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.02em]">{t('auth.unified.title')}</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">{t('auth.unified.lead')}</p>
        {deletedOn ? (
          <div className="mt-6">
            <Alert tone="info">{t('auth.deleted.notice', { date: deletedOn })}</Alert>
          </div>
        ) : null}
        <div className="clay mt-8 rounded-[2rem] p-6 sm:p-8">
          {error ? (
            <div className="mb-5">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label={t('auth.unified.field')} hint={t('auth.unified.hint')}>
              {(p) => <IdentifierInput {...p} autoFocus value={identifier} onChange={setIdentifier} placeholder={t('auth.unified.placeholder')} />}
            </Field>
            <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={!ready || busy}>
              {busy ? t('common.loading') : t('auth.unified.continue')}
            </Button>
          </form>
          {providers.google ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs tracking-widest text-stone-500 uppercase">
                <span className="h-px flex-1 bg-gold-200" />
                {t('auth.or')}
                <span className="h-px flex-1 bg-gold-200" />
              </div>
              <GoogleButton next={target} label={t('auth.google')} />
            </>
          ) : null}
        </div>
        <p className="mt-6 text-center text-sm leading-relaxed text-stone-600">{t('auth.unified.newHere')}</p>
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

function Card({ children }: { children: ReactNode }) {
  return <div className="clay rounded-[2rem] p-6 sm:p-8">{children}</div>;
}

/** An account with a password: the password signs in, and a code by email is one click away (forgotten or not). */
function PasswordStep({ email, onResult, onCode, onBack }: { email: string; onResult: (result: StepResult) => void; onCode: (challenge: EmailChallenge) => void; onBack: () => void }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'code' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy('password');
    setError(null);
    try {
      onResult(await apiPost<StepResult>('/auth/email/password', { email, password }));
    } catch (err) {
      // The address is known here: say what went wrong with the password, and that a code works.
      const code = err instanceof ApiError ? err.code : null;
      setError(code === 'INVALID_CREDENTIALS' ? t('auth.password.wrong') : code === 'RATE_LIMITED' ? t('auth.password.paused') : errorMessage(t, err));
      setBusy(null);
    }
  }

  async function sendCode() {
    setBusy('code');
    setError(null);
    try {
      onCode(await apiPost<EmailChallenge>('/auth/email/code', { email }));
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <button type="button" onClick={onBack} className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 py-1.5 pr-3.5 pl-2 text-sm text-stone-700 shadow-clay-sm hover:text-ink">
        <ArrowLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{email}</span>
      </button>
      <span className="icon-3d size-12 rounded-2xl">
        <KeyRound aria-hidden className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.password.title')}</h1>
        <p className="mt-2 leading-relaxed text-stone-600">{t('auth.password.body')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {/* For password managers: which account this password belongs to. */}
      <input type="email" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
      <Field label={t('auth.field.password')}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" autoFocus required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy !== null || !password}>
        {busy === 'password' ? t('common.loading') : t('auth.login.submit')}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700 disabled:text-stone-500"
        disabled={busy !== null}
        onClick={() => void sendCode()}
      >
        {busy === 'code' ? t('common.loading') : t('auth.password.useCode')}
      </button>
    </form>
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
      // An expired or exhausted challenge means starting again from the start.
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

export function AuthForm() {
  return (
    <I18nProvider language="en">
      <AuthFormInner />
    </I18nProvider>
  );
}
