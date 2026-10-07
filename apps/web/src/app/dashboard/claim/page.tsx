'use client';

import { KeyRound, MessageCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { keys, useMe } from '@/lib/queries';
import { useProviders } from '@/components/auth/google-button';
import { Alert, Button, Card, Field, Input } from '@/components/ui/primitives';

/** Only same-site dashboard paths (prevents open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/dashboard') && !next.startsWith('//') ? next : '/dashboard';
}

/**
 * An account made from a WhatsApp number alone secures itself: a code on
 * WhatsApp, or an email and password. Until then it can design and preview,
 * but not publish, invite or pay.
 */
function Claim() {
  const t = useT();
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const providers = useProviders();
  const next = safeNext(params.get('next'));
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'code' | 'verify' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (me.data && !me.data.provisional && !done) router.replace(next);
  }, [me.data, done, next, router]);

  const finish = async () => {
    setDone(true);
    await client.invalidateQueries({ queryKey: keys.me });
    router.replace(next);
    router.refresh();
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(null);
    }
  };

  if (!me.data) return null;
  const phone = me.data.phone;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow text-brand-700">{t('claim.banner.cta')}</p>
        <h1 className="mt-3 font-display text-4xl">{t('claim.title')}</h1>
        <p className="mt-2 text-stone-600">{phone ? t('claim.subtitle', { phone }) : t('claim.subtitle.noPhone')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {providers.phoneOtp && phone ? (
        <Card className="space-y-4 rounded-3xl">
          <h2 className="flex items-center gap-2.5 font-display text-2xl">
            <MessageCircle aria-hidden className="size-6 text-emerald-700" /> {t('claim.whatsapp.title')}
          </h2>
          <p className="text-sm text-stone-600">{t('claim.whatsapp.body')}</p>
          {sent ? (
            <form
              className="space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void run('verify', async () => {
                  await apiPost('/auth/phone/verify', { phone, code });
                  await finish();
                });
              }}
            >
              <Alert tone="success">{t('claim.whatsapp.sent', { target: sent })}</Alert>
              <Field label={t('claim.whatsapp.code')}>
                {(p) => <Input {...p} autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-2xl tracking-[0.4em]" />}
              </Field>
              <Button type="submit" className="rounded-2xl" disabled={busy !== null || code.length !== 6}>
                {busy === 'verify' ? t('common.loading') : t('claim.whatsapp.verify')}
              </Button>
            </form>
          ) : (
            <Button
              className="rounded-2xl"
              disabled={busy !== null}
              onClick={() =>
                void run('code', async () => {
                  const r = await apiPost<{ target: string }>('/auth/phone/otp', { phone });
                  setSent(r.target);
                })
              }
            >
              {busy === 'code' ? t('common.loading') : t('claim.whatsapp.send')}
            </Button>
          )}
        </Card>
      ) : null}

      <Card className="space-y-4 rounded-3xl">
        <h2 className="flex items-center gap-2.5 font-display text-2xl">
          <KeyRound aria-hidden className="size-6 text-gold-700" /> {t('claim.email.title')}
        </h2>
        <p className="text-sm text-stone-600">{t('claim.email.body')}</p>
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run('email', async () => {
              await apiPost('/auth/claim', { email, password });
              await finish();
            });
          }}
        >
          <Field label={t('auth.field.email')}>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label={t('auth.field.password')} hint={t('auth.field.passwordHint')}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" className="rounded-2xl" disabled={busy !== null || !email || password.length < 10}>
            {busy === 'email' ? t('common.loading') : t('claim.email.submit')}
          </Button>
        </form>
      </Card>

      {providers.google ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 rounded-3xl">
          <h2 className="flex items-center gap-2.5 font-display text-2xl">
            <ShieldCheck aria-hidden className="size-6 text-gold-700" /> {t('claim.google.title')}
          </h2>
          {/* Linking Google is a top-level navigation to the API, started from the account page's sign-in methods. */}
          <Link href="/dashboard/account" className="btn-3d btn-3d-light min-h-11 rounded-2xl px-5 text-sm">
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
