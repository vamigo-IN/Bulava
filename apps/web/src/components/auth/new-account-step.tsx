'use client';

import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { Alert, Button, Checkbox, Field, Input } from '@/components/ui/primitives';
import { ConsentBox } from './consent-box';

/** How the address or number was just proved: it decides where the account is made and what else is offered. */
export type NewAccountVia = 'email' | 'whatsapp' | 'google';

const SIGNUP_PATH: Record<NewAccountVia, string> = {
  email: '/auth/email/signup',
  whatsapp: '/auth/phone/signup',
  google: '/auth/google/signup',
};

/**
 * The last step for someone new: the email, number or Google account is proved
 * already, so a name and the Terms box (never pre-ticked) make the account. An
 * email may add a password to sign in with next time (a code always works);
 * a number may opt in to updates on WhatsApp (a separate, optional consent).
 */
export function NewAccountStep({
  via,
  token,
  email,
  initialName = '',
  onDone,
  onExpired,
}: {
  via: NewAccountVia;
  token: string;
  /** The address itself (email), so a password manager saves the new password under it. */
  email?: string;
  initialName?: string;
  onDone: () => void;
  /** The step expired: start again from the sign-in field, with this message. */
  onExpired: (message: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | undefined>();
  const passwordShort = password.length > 0 && password.length < 10;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setConsentError(t('auth.consent.required'));
      return;
    }
    if (passwordShort) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        via === 'email'
          ? { signupToken: token, name: name.trim(), acceptTerms: true, password }
          : via === 'whatsapp'
            ? { signupToken: token, name: name.trim(), acceptTerms: true, whatsappUpdates: updates }
            : { signupToken: token, name: name.trim(), acceptTerms: true };
      await apiPost(SIGNUP_PATH[via], body);
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
      <h1 className="font-display text-4xl leading-tight tracking-[-0.015em]">{t('auth.new.title')}</h1>
      {error ? <Alert>{error}</Alert> : null}
      <Field label={t('auth.field.name')}>
        {(p) => <Input {...p} autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {via === 'email' && email ? <input type="email" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" /> : null}
      {via === 'email' ? (
        <Field label={t('auth.new.password')} error={passwordShort ? t('auth.field.passwordHint') : undefined}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
      ) : null}
      {/* A separate, optional consent: never bundled with the Terms. */}
      {via === 'whatsapp' ? <Checkbox label={t('auth.field.whatsappUpdates')} checked={updates} onChange={(e) => setUpdates(e.target.checked)} /> : null}
      <ConsentBox
        via={via === 'whatsapp' ? 'whatsapp' : 'email'}
        checked={accepted}
        error={consentError}
        onChange={(e) => {
          setAccepted(e.target.checked);
          if (e.target.checked) setConsentError(undefined);
        }}
      />
      <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || !name.trim() || passwordShort}>
        {busy ? t('common.loading') : t('auth.new.submit')}
      </Button>
    </form>
  );
}
