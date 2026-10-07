'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Gift, ReceiptIndianRupee } from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { paymentStatusPath } from '@/lib/checkout';
import { errorMessage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Badge, Spinner } from '@/components/ui/primitives';

interface PaymentRow {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  kind: 'PURCHASE' | 'ADMIN_GRANT';
  amountMinor: number;
  currency: string;
  createdAt: string;
  plan: { key: string; name: string; interval: 'ONE_TIME' | 'YEAR' };
  couponCode: string | null;
  event: { id: string; title: string; available: boolean } | null;
  payment: { provider: string; reference: string | null; paidAt: string | null } | null;
}

const TONE = { PAID: 'success', FAILED: 'danger', REFUNDED: 'warning', CANCELLED: 'neutral', CREATED: 'neutral' } as const;
const inr = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

/** Payment history: every plan bought (and every complimentary upgrade), each opening its receipt and status. */
export default function PaymentsPage() {
  const t = useT();
  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => apiGet<PaymentRow[]>('/orders') });

  if (orders.isPending) return <Spinner label={t('common.loading')} />;
  if (orders.isError) return <Alert>{errorMessage(t, orders.error)}</Alert>;

  const rows = orders.data;
  const paid = rows.filter((o) => o.status === 'PAID' && o.kind === 'PURCHASE');
  const total = paid.reduce((sum, o) => sum + o.amountMinor, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl">{t('payments.title')}</h1>
        <p className="mt-1 text-stone-600">{t('payments.subtitle')}</p>
      </div>

      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="clay rounded-3xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{t('payments.totalPaid')}</p>
            <p className="mt-1 font-display text-3xl text-ink">{inr(total)}</p>
          </div>
          <div className="clay rounded-3xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{t('payments.count')}</p>
            <p className="mt-1 font-display text-3xl text-ink">{paid.length}</p>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <ul className="clay divide-y divide-gold-100 overflow-hidden rounded-3xl">
          {rows.map((o) => {
            const grant = o.kind === 'ADMIN_GRANT';
            return (
              <li key={o.id}>
                <Link href={paymentStatusPath(o.id)} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gold-100/40">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', grant ? 'bg-gold-100 text-gold-700' : 'icon-3d')}>
                    {grant ? <Gift aria-hidden className="size-5" /> : <ReceiptIndianRupee aria-hidden className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {o.plan.name}
                      <span className="text-stone-500"> · {o.event ? o.event.title : t('payment.yourAccount')}</span>
                    </span>
                    <span className="block text-sm text-stone-500">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      {o.payment?.reference ? <span className="font-mono text-xs"> · {o.payment.reference}</span> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-display text-lg text-ink">{grant ? t('payments.complimentary') : inr(o.amountMinor, o.currency)}</span>
                    <Badge tone={TONE[o.status]}>{t(`payment.status.${o.status}`)}</Badge>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="clay-inset rounded-3xl px-6 py-14 text-center">
          <span className="icon-3d mx-auto size-12 rounded-2xl">
            <ReceiptIndianRupee aria-hidden className="size-6" />
          </span>
          <p className="mt-4 font-display text-2xl text-ink">{t('payments.emptyTitle')}</p>
          <p className="mx-auto mt-2 max-w-md text-stone-600">{t('payments.emptyBody')}</p>
          <Link href="/dashboard" className="btn-3d mt-6 min-h-11 rounded-2xl px-6 text-sm">
            {t('payments.emptyCta')}
          </Link>
        </div>
      )}

      <p className="px-1 text-sm text-stone-600">
        {t('payments.help')}{' '}
        <Link href="/refund" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
          {t('payments.refundPolicy')}
        </Link>
      </p>
    </div>
  );
}
