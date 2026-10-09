'use client';

import { Check, LoaderCircle, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PhoneInput } from '@/components/ui/phone-input';
import { api } from '@/lib/api';
import { storedOrders, type StoredOrder } from '@/lib/card-store';
import { errorMessage, useOptionalT } from '@/lib/i18n';

/**
 * "Find my card": the email and number used at checkout. The links go to that
 * email; the answer is the same whether anything was found, so the form tells
 * nobody who bought what. Purchases made on this device are listed right away.
 */
export function RecoverForm() {
  const t = useOptionalT();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<StoredOrder[]>([]);
  useEffect(() => setLocal(storedOrders()), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      await api('/public/cards/recover', { method: 'POST', body: { email: email.trim(), phone } });
      setState('sent');
    } catch (err) {
      setError(errorMessage(t, err));
      setState('idle');
    }
  };

  return (
    <div className="space-y-6">
      {local.length ? (
        <div>
          <p className="text-sm font-semibold text-ink">{t('cards.recover.onDevice')}</p>
          <ul className="mt-2 space-y-1">
            {local.map((o) => (
              <li key={o.orderToken}>
                <a href={`/cards/order#${o.orderToken}`} className="flex justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm text-brand-700 hover:bg-white">
                  <span className="truncate">{o.templateName}</span>
                  <span className="shrink-0 text-xs text-stone-500">{o.reference}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state === 'sent' ? (
        <div role="status" className="space-y-2 text-center">
          <span className="icon-3d mx-auto grid size-12 place-items-center rounded-2xl">
            <Check aria-hidden className="size-6" />
          </span>
          <p className="font-semibold text-ink">{t('cards.recover.sentTitle')}</p>
          <p className="text-sm text-stone-600">{t('cards.recover.sentBody')}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="recover-email" className="mb-1 block text-sm font-medium text-stone-700">
              {t('cards.download.email')}
            </label>
            <input
              id="recover-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-[#e2d2c0] bg-[#f8f2ea] px-3.5 text-base shadow-clay-inset focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="recover-phone" className="mb-1 block text-sm font-medium text-stone-700">
              {t('cards.download.phone')}
            </label>
            <PhoneInput id="recover-phone" value={phone} onChange={setPhone} />
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={state === 'sending'} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-xl disabled:opacity-60">
            {state === 'sending' ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Mail aria-hidden className="size-4" />}
            {t('cards.recover.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
