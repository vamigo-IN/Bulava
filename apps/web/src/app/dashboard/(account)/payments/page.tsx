'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, Gift, IndianRupee, LifeBuoy, ReceiptIndianRupee, Sparkles, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { MessageKey } from '@bulava/localization';
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

const FILTERS: Array<{ key: 'all' | 'paid' | 'open' | 'closed'; label: MessageKey; match: (o: PaymentRow) => boolean }> = [
  { key: 'all', label: 'payments.filter.all', match: () => true },
  { key: 'paid', label: 'payments.filter.paid', match: (o) => o.status === 'PAID' },
  { key: 'open', label: 'payments.filter.open', match: (o) => o.status === 'CREATED' || o.status === 'FAILED' },
  { key: 'closed', label: 'payments.filter.closed', match: (o) => o.status === 'REFUNDED' || o.status === 'CANCELLED' },
];

/** Payment history: every plan bought (and every complimentary upgrade), each opening its receipt and status. */
export default function PaymentsPage() {
  const t = useT();
  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => apiGet<PaymentRow[]>('/orders') });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  if (orders.isPending) return <Spinner label={t('common.loading')} />;
  if (orders.isError) return <Alert>{errorMessage(t, orders.error)}</Alert>;

  const rows = orders.data;
  const paid = rows.filter((o) => o.status === 'PAID' && o.kind === 'PURCHASE');
  const grants = rows.filter((o) => o.kind === 'ADMIN_GRANT' && o.status === 'PAID');
  const total = paid.reduce((sum, o) => sum + o.amountMinor, 0);
  const last = paid.map((o) => o.payment?.paidAt ?? o.createdAt).sort().at(-1);
  const shown = rows.filter(FILTERS.find((f) => f.key === filter)!.match);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl leading-tight">{t('payments.title')}</h2>
        <p className="mt-1 text-stone-600">{t('payments.subtitle')}</p>
      </div>

      {rows.length ? (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={IndianRupee} label={t('payments.totalPaid')} value={inr(total)} />
            <Tile icon={ReceiptIndianRupee} label={t('payments.count')} value={String(paid.length)} />
            <Tile icon={Gift} label={t('payments.grants')} value={String(grants.length)} />
            <Tile icon={CalendarClock} label={t('payments.last')} value={last ? new Date(last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
          </ul>

          <div className="clay-inset flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]" role="group" aria-label={t('payments.filter.label')}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200', filter === f.key ? 'bg-white text-ink shadow-clay-sm' : 'text-stone-600 hover:text-ink')}
              >
                {t(f.label)}
                <span className={cn('rounded-full px-1.5 text-xs', filter === f.key ? 'bg-brand-50 text-brand-700' : 'bg-white/60 text-stone-500')}>{rows.filter(f.match).length}</span>
              </button>
            ))}
          </div>

          {shown.length ? (
            <ul className="clay divide-y divide-gold-100 overflow-hidden rounded-[1.75rem]">
              {shown.map((o) => {
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
            <p className="clay-inset rounded-3xl px-6 py-10 text-center text-stone-600">{t('payments.filter.none')}</p>
          )}
        </>
      ) : (
        <div className="clay rounded-[1.75rem] px-6 py-14 text-center">
          <span className="icon-3d mx-auto size-12 rounded-2xl">
            <ReceiptIndianRupee aria-hidden className="size-6" />
          </span>
          <p className="mt-4 font-display text-2xl text-ink">{t('payments.emptyTitle')}</p>
          <p className="mx-auto mt-2 max-w-md text-stone-600">{t('payments.emptyBody')}</p>
          <Link href="/dashboard/events" className="btn-3d mt-6 min-h-11 rounded-2xl px-6 text-sm">
            <Sparkles aria-hidden className="size-4" />
            {t('payments.emptyCta')}
          </Link>
        </div>
      )}

      <div className="clay-inset flex flex-wrap items-start gap-3 rounded-[1.5rem] p-5 text-sm text-stone-700">
        <LifeBuoy aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-600" />
        <p className="min-w-0 flex-1 leading-relaxed">
          {t('payments.help')}{' '}
          <Link href="/refund" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
            {t('payments.refundPolicy')}
          </Link>
          {' · '}
          <Link href="/contact" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
            {t('payment.contact')}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <li className="clay rounded-3xl p-5">
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{label}</span>
        <Icon aria-hidden className="size-4 shrink-0 text-gold-600" />
      </span>
      <span className="mt-2 block font-display text-2xl leading-tight text-ink sm:text-3xl">{value}</span>
    </li>
  );
}
