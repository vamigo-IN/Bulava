'use client';

import { CheckCheck, Check, KeyRound, Loader2, PhoneOff, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Button, Checkbox, Field, Input } from '@/components/ui/primitives';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';
import { PhoneInput } from '@/components/ui/phone-input';
import { CodeInput, useCountdown } from './code-input';
import { ConsentBox } from './consent-box';
import { GoogleButton } from './google-button';
import { useWhatsAppDelivery, type WhatsAppDelivery } from './use-whatsapp-delivery';

/** What verifying the code answers: signed in, the next step of an existing account, or a new account to make. */
type VerifyResult = { mfaRequired?: boolean; challengeToken?: string; restoreRequired?: boolean; restoreToken?: string; deleteAt?: string; signupRequired?: boolean; signupToken?: string; target?: string };

/** No delivery report for this long: offer the other ways in, without giving up on the message. */
const WAITING_HINT_MS = 40_000;

export interface WhatsAppSignInProps {
  /** The sign-up page's Terms box was ticked before choosing WhatsApp, so a new account needs no second tick. */
  consented: boolean;
  /** Google sign-in is offered (as the way out for a number without WhatsApp). */
  google: boolean;
  /** Where Google sends people back to. */
  next: string;
  onDone: () => void;
  onChallenge: (token: string) => void;
  onRestore: (token: string, until: string | null) => void;
  /** Back to the other ways in (email and password). */
  onBack: () => void;
}

/**
 * Signing in, or up, with a WhatsApp number: a six-digit code instead of a
 * password. The code signs in to the number's account; for a number without
 * one, it confirms the number and a name (and the ticked Terms box) makes the
 * account. While the code is on its way the page asks whether the message got
 * through: a number that is not on WhatsApp is offered Google or email instead.
 */
export function WhatsAppSignIn({ consented, google, next, onDone, onChallenge, onRestore, onBack }: WhatsAppSignInProps) {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<{ target: string; sendId: string } | null>(null);
  const [signup, setSignup] = useState<{ token: string; target: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useCountdown(0);
  const [waitedLong, setWaitedLong] = useState(false);
  const delivery = useWhatsAppDelivery(sent?.sendId ?? null);
  const tried = useRef('');

  // Nothing heard about the message for a while: point to the other ways in.
  useEffect(() => {
    setWaitedLong(false);
    if (!sent) return;
    const timer = setTimeout(() => setWaitedLong(true), WAITING_HINT_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await apiPost<{ target: string; sendId: string; resendAfter: number }>('/auth/phone/otp', { phone });
      setSent({ target: r.target, sendId: r.sendId });
      setResendIn(r.resendAfter);
      setCode('');
      tried.current = '';
      if (sent) setNotice(t('auth.code.resent'));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    tried.current = value;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiPost<VerifyResult>('/auth/phone/verify', { phone, code: value });
      if (result.signupRequired && result.signupToken) return setSignup({ token: result.signupToken, target: result.target ?? sent?.target ?? '' });
      if (result.restoreRequired && result.restoreToken) return onRestore(result.restoreToken, result.deleteAt ?? null);
      if (result.mfaRequired && result.challengeToken) return onChallenge(result.challengeToken);
      onDone();
    } catch (err) {
      setError(errorMessage(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // The sixth digit sends the code.
  useEffect(() => {
    if (sent && code.length === 6 && code !== tried.current && !busy) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const changeNumber = () => {
    setSent(null);
    setCode('');
    setError(null);
    setNotice(null);
  };

  if (signup) {
    return <NewAccount token={signup.token} target={signup.target} consented={consented} onDone={onDone} onExpired={(message) => {
      setSignup(null);
      changeNumber();
      setError(message);
    }} />;
  }

  // ───── The number ─────
  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-5" noValidate>
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-[#22a08f] to-[#0a6158] text-white shadow-[inset_0_2px_2px_rgba(255,255,255,0.3),0_8px_18px_-6px_rgba(4,50,44,0.45)]">
          <WhatsAppMark className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.whatsapp')}</h1>
          <p className="mt-2 leading-relaxed text-stone-600">{t('auth.phone.body')}</p>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <Field label={t('auth.phone.number')} hint={t('auth.phone.numberHint')}>
          {(p) => <PhoneInput {...p} autoFocus required value={phone} onChange={setPhone} placeholder="98765 43210" />}
        </Field>
        <Button type="submit" variant="whatsapp" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || phone.replace(/\D/g, '').length < 8}>
          {busy ? t('common.loading') : t('auth.phone.send')}
        </Button>
        <button type="button" className="w-full text-center text-sm text-stone-600 underline underline-offset-4" onClick={onBack}>
          {t('auth.phone.otherWays')}
        </button>
      </form>
    );
  }

  // ───── The message did not get through ─────
  if (delivery === 'failed') {
    return (
      <div className="space-y-5">
        <span className="icon-3d size-12 rounded-2xl">
          <PhoneOff aria-hidden className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.phone.failed.title')}</h1>
          <p className="mt-2 leading-relaxed text-stone-600">{t('auth.phone.failed.body', { target: sent.target })}</p>
        </div>
        <div className="space-y-3">
          {google ? <GoogleButton next={next} label={t('auth.google')} consent={consented ? true : undefined} /> : null}
          <button type="button" className="btn-3d btn-3d-light min-h-12 w-full gap-3 rounded-2xl px-5 font-medium" onClick={onBack}>
            <KeyRound aria-hidden className="size-5 text-gold-700" />
            {t('auth.phone.useEmail')}
          </button>
        </div>
        <button type="button" className="w-full text-center text-sm font-medium text-brand-700 underline decoration-gold-300 underline-offset-4" onClick={changeNumber}>
          {t('auth.phone.tryAnother')}
        </button>
      </div>
    );
  }

  // ───── The code ─────
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6 && !busy) void verify(code);
      }}
      className="space-y-5"
      noValidate
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-[#22a08f] to-[#0a6158] text-white shadow-[inset_0_2px_2px_rgba(255,255,255,0.3),0_8px_18px_-6px_rgba(4,50,44,0.45)]">
        <WhatsAppMark className="size-7" />
      </span>
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.phone.codeTitle')}</h1>
        <p className="mt-2 leading-relaxed text-stone-600">{t('auth.phone.codeBody', { target: sent.target })}</p>
        <DeliveryChip delivery={delivery} />
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Field label={t('auth.code.label')}>{(p) => <CodeInput {...p} autoFocus value={code} onChange={setCode} />}</Field>
      <Button type="submit" variant="whatsapp" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || code.length !== 6}>
        {busy ? t('common.loading') : t('auth.phone.verify')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          className="font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700 disabled:cursor-default disabled:text-stone-500 disabled:no-underline"
          disabled={resendIn > 0 || busy}
          onClick={() => void send()}
        >
          {resendIn > 0 ? t('auth.code.resendIn', { seconds: resendIn }) : t('auth.code.resend')}
        </button>
        <button type="button" className="text-stone-600 underline underline-offset-4" onClick={changeNumber}>
          {t('auth.phone.change')}
        </button>
      </div>
      {waitedLong && delivery !== 'delivered' && delivery !== 'read' ? (
        <div role="status" className="space-y-2 rounded-2xl border border-gold-200 bg-white/70 p-4 text-sm leading-relaxed text-stone-700">
          <p>{t('auth.phone.waiting')}</p>
          <button type="button" className="font-medium text-brand-700 underline decoration-gold-300 underline-offset-4" onClick={onBack}>
            {t('auth.phone.otherWays')}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** "Sending…", "Sent", "Delivered", "Seen": what WhatsApp has said about the message so far. */
export function DeliveryChip({ delivery }: { delivery: WhatsAppDelivery }) {
  const t = useT();
  if (delivery === 'unknown' || delivery === 'failed') return null;
  const Icon = delivery === 'sending' ? Loader2 : delivery === 'sent' ? Check : CheckCheck;
  return (
    <p role="status" className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', delivery === 'read' || delivery === 'delivered' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700')}>
      <Icon aria-hidden className={cn('size-3.5', delivery === 'sending' && 'animate-spin motion-reduce:animate-none')} />
      {t(`auth.phone.status.${delivery}`)}
    </p>
  );
}

/** A number without an account, just proved with a code: a name and the Terms box make the account. */
function NewAccount({ token, target, consented, onDone, onExpired }: { token: string; target: string; consented: boolean; onDone: () => void; onExpired: (message: string) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | undefined>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consented && !accepted) {
      setConsentError(t('auth.consent.required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The sign-up page's box was ticked before WhatsApp was chosen, or this one is ticked now.
      await apiPost('/auth/phone/signup', { signupToken: token, name: name.trim(), acceptTerms: true, whatsappUpdates: updates });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_EXPIRED') onExpired(errorMessage(t, err));
      else setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <span className="icon-3d size-12 rounded-2xl">
        <Sparkles aria-hidden className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.phone.new.title')}</h1>
        <p className="mt-2 leading-relaxed text-stone-600">{t('auth.phone.new.body', { target })}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <Field label={t('auth.field.name')}>
        {(p) => <Input {...p} autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {/* A separate, optional consent: never bundled with the Terms. */}
      <Checkbox label={t('auth.field.whatsappUpdates')} checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
      {consented ? null : (
        <ConsentBox
          via="whatsapp"
          checked={accepted}
          error={consentError}
          onChange={(e) => {
            setAccepted(e.target.checked);
            if (e.target.checked) setConsentError(undefined);
          }}
        />
      )}
      <Button type="submit" variant="whatsapp" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || !name.trim()}>
        {busy ? t('common.loading') : t('auth.phone.new.submit')}
      </Button>
    </form>
  );
}
