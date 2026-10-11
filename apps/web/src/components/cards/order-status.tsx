'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, CircleAlert, Copy, Download, LoaderCircle, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { errorMessage, useOptionalT } from '@/lib/i18n';
import { cardApi, formatRupees, startDownload, type CardOrderView } from '@/lib/cards';
import { runCheckout } from '@/lib/checkout';
import { cn } from '@/lib/utils';

const busy = (o: CardOrderView | undefined) =>
  !o || (o.status === 'PENDING' && o.checkout !== 'closed') || (o.status === 'PAID' && (!o.card || o.card.status === 'QUEUED' || o.card.status === 'RENDERING')) || o.emailStatus === 'QUEUED';

/**
 * A paid card's status (the download dialog after payment, and the order
 * page): confirming the payment, making the image, then the download, the
 * email and the receipt. Everything here works again later from the order
 * link, so a closed tab never costs a second payment.
 */
export function OrderStatus({ orderToken, siteName, compact }: { orderToken: string; siteName?: string; compact?: boolean }) {
  const t = useOptionalT();
  const queries = useQueryClient();
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const order = useQuery({
    queryKey: ['card-order', orderToken],
    queryFn: () => cardApi.order(orderToken),
    refetchInterval: (q) => (busy(q.state.data) ? 2000 : false),
    retry: 2,
  });
  const o = order.data;
  const refresh = () => queries.invalidateQueries({ queryKey: ['card-order', orderToken] });

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setWorking(name);
    setNotice(null);
    try {
      await fn();
      await refresh();
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(t, error) });
    } finally {
      setWorking(null);
    }
  };

  const download = () =>
    act('download', async () => {
      const { url } = await cardApi.orderDownload(orderToken);
      startDownload(url);
    });

  const retryPayment = () =>
    act('pay', async () => {
      const checkout = await cardApi.resumeOrder(orderToken);
      if (checkout.status === 'PAID') return;
      const outcome = await runCheckout(
        { orderId: checkout.reference, status: 'CREATED', amountMinor: checkout.amountMinor, currency: checkout.currency, planName: t('cards.order.description'), keyId: checkout.keyId, providerOrderId: checkout.providerOrderId, prefill: checkout.prefill },
        {
          unavailable: t('error.PAYMENTS_UNAVAILABLE'),
          siteName,
          verify: (proof) => cardApi.verifyOrder(orderToken, proof),
          onFailedAttempt: (reason) => void cardApi.orderEvent(orderToken, { type: 'PAYMENT_FAILED', reason }),
        },
      );
      if (outcome === 'dismissed') void cardApi.orderEvent(orderToken, { type: 'PAYMENT_CANCELLED' });
      if (outcome === 'failed') setNotice({ tone: 'error', text: t('cards.order.payFailed') });
    });

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/cards/order#${orderToken}`;

  if (order.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 py-8 text-sm text-stone-600">
        <LoaderCircle aria-hidden className="size-5 animate-spin text-brand-700" /> {t('cards.order.loading')}
      </p>
    );
  }
  if (!o) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {t('cards.order.notFound')}
      </div>
    );
  }

  const ready = o.status === 'PAID' && o.card?.status === 'READY';
  const making = o.status === 'PAID' && (!o.card || o.card.status === 'QUEUED' || o.card.status === 'RENDERING');
  const failed = o.status === 'PAID' && (o.card?.status === 'FAILED' || o.card?.status === 'EXPIRED');

  return (
    <div className={cn('space-y-5', compact ? '' : 'sm:space-y-6')}>
      {o.status === 'PENDING' ? (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          {o.checkout === 'closed' ? <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" /> : <LoaderCircle aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin" />}
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{o.checkout === 'closed' ? t('cards.order.notPaid') : t('cards.order.confirming')}</p>
            <p>{o.checkout === 'closed' ? (o.failureReason ? t('cards.order.notPaidBody', { reason: o.failureReason }) : t('cards.order.closedBody')) : t('cards.order.confirmingBody')}</p>
            {/* Right after paying, the bank may still be confirming: offer to pay only once the checkout was closed, or after a while. */}
            {o.checkout === 'closed' || Date.now() - new Date(o.createdAt).getTime() > 120_000 ? (
              <button type="button" disabled={working !== null} onClick={retryPayment} className="btn-3d min-h-10 rounded-xl px-4 text-sm disabled:opacity-60">
                {t('cards.order.payAgain', { amount: formatRupees(o.amountMinor) })}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {o.status === 'PAID' ? (
        <div className="text-center">
          <span className="icon-3d mx-auto grid size-14 place-items-center rounded-2xl">
            {ready ? <BadgeCheck aria-hidden className="size-7" /> : <LoaderCircle aria-hidden className="size-7 animate-spin" />}
          </span>
          <h2 className="mt-4 font-display text-2xl text-ink sm:text-3xl">{ready ? t('cards.order.readyTitle') : failed ? t('cards.order.failedTitle') : t('cards.order.makingTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
            {ready ? t('cards.order.readyBody') : failed ? t('cards.order.failedBody') : t('cards.order.makingBody')}
          </p>
        </div>
      ) : null}

      {o.status === 'REFUNDED' ? <p className="rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">{t('cards.order.refunded')}</p> : null}
      {o.status === 'EXPIRED' || o.status === 'FAILED' ? <p className="rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">{t('cards.order.expired')}</p> : null}

      {ready && o.card?.previewUrl ? (
        <div className="mx-auto max-w-[16rem] overflow-hidden rounded-2xl shadow-clay">
          <img src={o.card.previewUrl} alt={t('cards.order.previewAlt')} className="block w-full" />
        </div>
      ) : null}

      {making ? <div className="skeleton mx-auto aspect-[9/16] max-w-[12rem] rounded-2xl" aria-hidden /> : null}

      {ready ? (
        <button type="button" disabled={working !== null} onClick={download} className="btn-3d min-h-13 w-full justify-center gap-2 rounded-2xl text-base disabled:opacity-60">
          {working === 'download' ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Download aria-hidden className="size-5" />}
          {t('cards.order.download')}
        </button>
      ) : null}
      {failed ? (
        <button type="button" disabled={working !== null} onClick={() => act('regenerate', () => cardApi.orderRegenerate(orderToken))} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-2xl disabled:opacity-60">
          <RefreshCw aria-hidden className="size-4" /> {t('cards.order.regenerate')}
        </button>
      ) : null}

      {o.status === 'PAID' ? (
        <div className="clay-inset space-y-2 rounded-2xl p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Mail aria-hidden className="size-4 text-brand-700" /> {t('cards.order.emailTitle')}
          </p>
          <p className="text-stone-600" aria-live="polite">
            {o.emailStatus === 'SENT'
              ? t('cards.order.emailSent', { email: o.email })
              : o.emailStatus === 'FAILED'
                ? t('cards.order.emailFailed', { email: o.email })
                : o.emailStatus === 'QUEUED'
                  ? t('cards.order.emailQueued', { email: o.email })
                  : t('cards.order.emailWaiting', { email: o.email })}
          </p>
          {ready && (o.emailStatus === 'FAILED' || o.emailStatus === 'SENT') ? (
            <button type="button" disabled={working !== null} onClick={() => act('email', () => cardApi.orderEmail(orderToken))} className="btn-3d btn-3d-light min-h-10 rounded-xl px-4 text-sm disabled:opacity-60">
              {o.emailStatus === 'FAILED' ? t('cards.order.emailRetry') : t('cards.order.emailAgain')}
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl px-4 py-3 text-sm', notice.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-stone-100 text-stone-700')}>
          {notice.text}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-[var(--ed-field-line,#e2d2c0)] p-4 text-sm">
        <dt className="text-stone-500">{t('cards.order.reference')}</dt>
        <dd className="text-right font-semibold text-ink">{o.reference}</dd>
        <dt className="text-stone-500">{t('cards.order.amount')}</dt>
        <dd className="text-right font-semibold text-ink">{formatRupees(o.amountMinor)}</dd>
        {o.paidAt ? (
          <>
            <dt className="text-stone-500">{t('cards.order.paidOn')}</dt>
            <dd className="text-right text-ink">{new Date(o.paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
          </>
        ) : null}
        {o.paymentReference ? (
          <>
            <dt className="text-stone-500">{t('cards.order.payment')}</dt>
            <dd className="truncate text-right font-mono text-xs text-ink">{o.paymentReference}</dd>
          </>
        ) : null}
        <dt className="text-stone-500">{t('cards.order.size')}</dt>
        <dd className="text-right text-ink">
          {o.width} × {o.height} px
        </dd>
      </dl>

      {o.status === 'PAID' && link ? (
        <div className="space-y-2 text-sm">
          <p className="text-stone-600">{t('cards.order.keepLink')}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="btn-3d btn-3d-light min-h-10 gap-2 rounded-xl px-4 text-sm"
          >
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? t('common.copied') : t('cards.order.copyLink')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
