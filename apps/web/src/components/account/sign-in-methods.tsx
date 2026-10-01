'use client';

import { KeyRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { GoogleMark, useGoogleEnabled } from '@/components/auth/google-button';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui/primitives';
import { apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import type { User } from '@/lib/types';

/** Google connection and password: set, change, connect, disconnect. */
export function SignInMethods({ me }: { me: User }) {
  const t = useT();
  const qc = useQueryClient();
  const params = useSearchParams();
  const googleEnabled = useGoogleEnabled();
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

      {googleEnabled || me.googleLinked ? (
        <section className="flex flex-wrap items-center justify-between gap-3">
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
    </Card>
  );
}
