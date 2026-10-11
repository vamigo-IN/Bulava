'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeRelativePath } from '@bulava/validation';
import { apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { keys, useMe } from '@/lib/queries';
import { useProviders } from '@/components/auth/google-button';
import { EmailCodeStep, type EmailChallenge } from '@/components/auth/email-code-step';
import { WhatsAppConfirm } from '@/components/account/whatsapp-confirm';
import { Alert, Button, Card, Field, Input } from '@/components/ui/primitives';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';

/** Only same-site dashboard paths (no open redirects, see safeRelativePath). */
function safeNext(next: string | null): string {
  return safeRelativePath(next, '/dashboard', '/dashboard');
}

/**
 * An account made from a WhatsApp number secures itself (a code on WhatsApp,
 * or an email confirmed with a code, or Google) and, without an email, adds
 * one. Until it is secured it can design and preview, but not publish, invite
 * or pay.
 */
function Claim() {
  const t = useT();
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const providers = useProviders();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Nothing to do here for an account that is secured and has an email.
  useEffect(() => {
    if (me.data && !me.data.provisional && me.data.email && !done) router.replace(next);
  }, [me.data, done, next, router]);

  const finish = async () => {
    setDone(true);
    await client.invalidateQueries({ queryKey: keys.me });
    router.replace(next);
    router.refresh();
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The password is optional: a code by email always signs in.
      setChallenge(await apiPost<EmailChallenge>('/auth/claim', { email: email.trim(), password }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (!me.data) return null;
  const { phone, provisional } = me.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        {provisional ? <p className="eyebrow text-brand-700">{t('claim.banner.cta')}</p> : null}
        <h1 className="mt-3 font-display text-4xl">{t(provisional ? 'claim.title' : 'claim.addEmail.title')}</h1>
        <p className="mt-2 text-stone-600">{provisional ? (phone ? t('claim.subtitle', { phone }) : t('claim.subtitle.noPhone')) : t('claim.addEmail.subtitle')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {provisional && providers.phoneOtp && phone ? (
        <Card className="space-y-4 rounded-3xl">
          <h2 className="flex items-center gap-2.5 font-display text-2xl">
            <WhatsAppMark className="size-6 text-emerald-700" /> {t('claim.whatsapp.title')}
          </h2>
          <p className="text-sm text-stone-600">{t('claim.whatsapp.body')}</p>
          <WhatsAppConfirm onConfirmed={finish} />
        </Card>
      ) : null}

      <Card className="space-y-4 rounded-3xl">
        {challenge ? (
          <EmailCodeStep
            purpose="claim"
            heading="h2"
            challenge={challenge}
            onVerified={finish}
            onRestart={(message) => {
              setChallenge(null);
              setError(message);
            }}
          />
        ) : (
          <>
            <h2 className="flex items-center gap-2.5 font-display text-2xl">
              <KeyRound aria-hidden className="size-6 text-gold-700" /> {t('claim.email.title')}
            </h2>
            <p className="text-sm text-stone-600">{t('claim.email.body')}</p>
            <form className="space-y-3" onSubmit={submitEmail}>
              <Field label={t('auth.field.email')}>
                {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Field label={t('auth.new.password')} error={password.length > 0 && password.length < 10 ? t('auth.field.passwordHint') : undefined}>
                {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />}
              </Field>
              <Button type="submit" className="rounded-2xl" disabled={busy || !email.includes('@') || (password.length > 0 && password.length < 10)}>
                {busy ? t('common.loading') : t('claim.email.submit')}
              </Button>
            </form>
          </>
        )}
      </Card>

      {provisional && providers.google ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 rounded-3xl">
          <h2 className="flex items-center gap-2.5 font-display text-2xl">
            <ShieldCheck aria-hidden className="size-6 text-gold-700" /> {t('claim.google.title')}
          </h2>
          {/* Linking Google is a top-level navigation to the API, started from the security page's sign-in methods. */}
          <Link href="/dashboard/account/security" className="btn-3d btn-3d-light min-h-11 rounded-2xl px-5 text-sm">
            {t('dash.nav.account')}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense>
      <Claim />
    </Suspense>
  );
}
