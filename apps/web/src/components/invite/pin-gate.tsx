'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
import { Alert, Button, Input } from '@/components/ui/primitives';

function Gate({ slug }: { slug: string }) {
  const t = useT();
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { pass } = await apiPost<{ pass: string }>(`/public/events/${slug}/pin`, { pin });
      await fetch(`/e/${slug}/pin`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bulava-csrf': '1' }, body: JSON.stringify({ pass }) });
      router.refresh();
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <main className="paper flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-gold-200 bg-white p-7 text-center shadow-sm">
        <p aria-hidden className="text-4xl">
          🔒
        </p>
        <h1 className="mt-3 font-display text-3xl">{t('pin.title')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('pin.body')}</p>
        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Input
          aria-label={t('pin.label')}
          className="mt-5 text-center text-2xl tracking-[0.4em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.trim())}
          maxLength={12}
          autoComplete="off"
        />
        <Button type="submit" className="mt-3 w-full rounded-full" disabled={busy || pin.length < 4}>
          {t('pin.submit')}
        </Button>
      </form>
    </main>
  );
}

export function PinGate({ slug }: { slug: string }) {
  return (
    <I18nProvider language="en">
      <Gate slug={slug} />
    </I18nProvider>
  );
}
