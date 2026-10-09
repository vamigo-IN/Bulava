'use client';

import { KeyRound, Mail } from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { GoogleMark, useProviders } from '@/components/auth/google-button';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui/primitives';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';
import { WhatsAppConfirm } from './whatsapp-confirm';
import { apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import type { User } from '@/lib/types';

/** The ways into the account: WhatsApp (confirm the number), Google (connect, disconnect), the password (set, change), or an email to add. */
export function SignInMethods({ me }: { me: User }) {
  const t = useT();
  const qc = useQueryClient();
  const params = useSearchParams();
  const providers = useProviders();
  const googleEnabled = providers.google;
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  // Back from Google's consent screen.
  useEffect(() => {
    const result = params.get('google');
    if (result === 'linked') setMessage({ tone: 'success', text: t('methods.google.linked') });
    else if (result && /^[A-Z_]{3,40}$/.test(result)) setMessage({ tone: 'danger', text: t(`error.${result}` as MessageKey) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ tone: 'success', text: success });
      await qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  const connect = () =>
    run(async () => {
      const { url } = await apiPost<{ url: string }>('/auth/google/link');
      window.location.assign(url);
    });

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiPut('/auth/password', me.hasPassword ? { currentPassword: current, newPassword: next } : { newPassword: next });
      setEditing(false);
      setCurrent('');
      setNext('');
    }, t('methods.password.saved'));
  };

  return (
    <Card className="space-y-5 rounded-3xl">
      <h2 className="font-display text-2xl">{t('methods.title')}</h2>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {providers.phoneOtp || me.phoneVerified ? (
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 grid size-6 place-items-center rounded-md bg-[#075E54] text-white">
              <WhatsAppMark className="size-4" />
            </span>
            <div>
              <p className="font-medium">
                {t('methods.whatsapp')}{' '}
                <Badge tone={me.phoneVerified ? 'success' : 'neutral'}>{t(me.phoneVerified ? 'methods.whatsapp.on' : me.phone ? 'methods.whatsapp.unconfirmed' : 'methods.whatsapp.off')}</Badge>
              </p>
              <p className="text-sm text-stone-600">
                {me.phoneVerified && me.phone ? t('methods.whatsapp.hintOn', { phone: me.phone }) : me.phone ? t('methods.whatsapp.hintConfirm') : t('methods.whatsapp.hintAdd')}
              </p>
            </div>
          </div>
          {me.phone && !me.phoneVerified && providers.phoneOtp ? (
            <WhatsAppConfirm
              onConfirmed={async () => {
                setMessage({ tone: 'success', text: t('account.phone.confirmedNow') });
                await qc.invalidateQueries({ queryKey: ['me'] });
              }}
            />
          ) : null}
          {me.phone ? null : (
            <Link href="/dashboard/account" className="btn-3d btn-3d-light inline-flex min-h-9 rounded-xl px-3.5 text-sm">
              {t('methods.whatsapp.add')}
            </Link>
          )}
        </section>
      ) : null}

      {googleEnabled || me.googleLinked ? (
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-100 pt-4">
          <div className="flex items-start gap-3">
            <GoogleMark className="mt-0.5 size-6" />
            <div>
              <p className="font-medium">
                {t('methods.google')}{' '}
                <Badge tone={me.googleLinked ? 'success' : 'neutral'}>{t(me.googleLinked ? 'methods.google.connected' : 'methods.google.notConnected')}</Badge>
              </p>
              <p className="text-sm text-stone-600">{t('methods.google.hint')}</p>
            </div>
          </div>
          {me.googleLinked ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => apiPost('/auth/google/unlink'), t('methods.google.unlinked'))}>
              {t('methods.google.disconnect')}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void connect()}>
              {t('methods.google.connect')}
            </Button>
          )}
        </section>
      ) : null}

      {me.email ? null : (
        // A password signs in with an email: an account made from a WhatsApp number adds both.
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-100 pt-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Mail aria-hidden className="size-4 text-gold-600" />
              {t('methods.email')}
            </p>
            <p className="text-sm text-stone-600">{t('methods.email.none')}</p>
          </div>
          <Link href="/dashboard/claim?next=%2Fdashboard%2Faccount%2Fsecurity" className="btn-3d btn-3d-light inline-flex min-h-9 rounded-xl px-3.5 text-sm">
            {t('methods.email.add')}
          </Link>
        </section>
      )}

      {me.email ? (
        <section className="space-y-3 border-t border-gold-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <KeyRound aria-hidden className="size-4 text-gold-600" />
                {t('methods.password')}
              </p>
              {me.hasPassword ? null : <p className="text-sm text-stone-600">{t('methods.password.none')}</p>}
            </div>
            {editing ? null : (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                {t(me.hasPassword ? 'methods.password.change' : 'methods.password.set')}
              </Button>
            )}
          </div>
          {editing ? (
            <form onSubmit={savePassword} className="space-y-3">
              {me.hasPassword ? (
                <Field label={t('methods.password.current')}>
                  {(p) => <Input {...p} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="max-w-sm" />}
                </Field>
              ) : null}
              <Field label={t('methods.password.new')} hint={t('methods.password.hint')}>
                {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} className="max-w-sm" />}
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {t('common.save')}
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}
