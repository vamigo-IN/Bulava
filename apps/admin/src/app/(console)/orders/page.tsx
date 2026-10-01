'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OrderActionButtons, PaymentStateBadge, useOrderActions } from '@/components/orders';
import { RequirePermission } from '@/components/shell';
import { Badge, EmptyState, ErrorNotice, Input, PageHeader, Select, Spinner, StatCard, Table, Td, Th } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { OrdersResponse } from '@/lib/types';
import { formatDateTime, formatInr, formatNumber } from '@/lib/utils';

/** Server-side filters. CREATED means a checkout still within its first hour; older ones are ABANDONED. */
const STATUS_FILTERS: Array<{ value: string; label: AdminMessageKey }> = [
  { value: 'PAID', label: 'state.PAID' },
  { value: 'CREATED', label: 'state.AWAITING_PAYMENT' },
  { value: 'ABANDONED', label: 'state.ABANDONED' },
  { value: 'FAILED', label: 'state.FAILED' },
  { value: 'REFUNDED', label: 'state.REFUNDED' },
  { value: 'CANCELLED', label: 'orders.filter.cancelled' },
];
const KINDS = ['PURCHASE', 'ADMIN_GRANT'] as const;

export default function OrdersPage() {
  return (
    <RequirePermission permission="billing.read">
      <Orders />
    </RequirePermission>
  );
}

function Orders() {
  const actions = useOrderActions();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const query = new URLSearchParams(Object.entries({ q: debounced, status, kind }).filter(([, v]) => v)).toString();
  const orders = useQuery({
    queryKey: ['admin', 'orders', debounced, status, kind],
    queryFn: () => apiGet<OrdersResponse>(`/admin/orders${query ? `?${query}` : ''}`),
    placeholderData: (previous) => previous,
  });
  const totals = orders.data?.totals;

  return (
    <>
      <PageHeader title={t('orders.title')} subtitle={t('orders.subtitle')} />
      {totals ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('orders.revenue')} value={formatInr(totals.PAID?.amountMinor ?? 0)} hint={t('orders.paidCount', { count: formatNumber(totals.PAID?.count ?? 0) })} />
          <StatCard label={t('orders.refundedTotal')} value={formatInr(totals.REFUNDED?.amountMinor ?? 0)} hint={t('orders.countHint', { count: formatNumber(totals.REFUNDED?.count ?? 0) })} />
          <StatCard label={t('orders.failed')} value={formatNumber(totals.FAILED?.count ?? 0)} />
          <StatCard label={t('orders.open')} value={formatNumber(totals.CREATED?.count ?? 0)} hint={t('orders.openHint')} />
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" placeholder={t('users.search')} aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label={t('orders.payment')} value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{`${t('orders.payment')}: ${t('common.all')}`}</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </Select>
        <Select aria-label={t('orders.kind')} value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
          <option value="">{`${t('orders.kind')}: ${t('common.all')}`}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`orders.kind.${k}`)}
            </option>
          ))}
        </Select>
      </div>
      {actions.status}
      {orders.isPending ? <Spinner /> : null}
      {orders.isError ? <ErrorNotice error={orders.error} /> : null}
      {orders.data && !orders.data.orders.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {orders.data?.orders.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('common.created')}</Th>
              <Th>{t('orders.customer')}</Th>
              <Th>{t('orders.plan')}</Th>
              <Th className="text-right">{t('orders.amount')}</Th>
              <Th>{t('orders.payment')}</Th>
              <Th>{t('profile.reference')}</Th>
              <Th>
                <span className="sr-only">{t('common.actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {orders.data.orders.map((o) => {
              const payment = o.payments.find((p) => p.verifiedAt) ?? o.payments[0];
              return (
                <tr key={o.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
                  <Td>
                    <Link href={`/users/${o.user.id}`} className="font-medium text-stone-900 underline-offset-2 hover:underline">
                      {o.user.name}
                    </Link>
                    <p className="text-xs break-all text-stone-500">{o.user.email}</p>
                  </Td>
                  <Td>
                    <p className="font-medium text-stone-900">
                      {o.plan.name} {o.kind === 'ADMIN_GRANT' ? <Badge tone="gold">{t('orders.kind.ADMIN_GRANT')}</Badge> : null}
                    </p>
                    <p className="text-xs text-stone-500">{o.eventTitle ?? (o.eventId ? t('common.none') : t('profile.accountWide'))}</p>
                    {o.kind === 'ADMIN_GRANT' && o.note ? (
                      <p className="mt-1 text-xs whitespace-pre-line text-stone-500">
                        {o.grantedBy ? `${t('profile.grantedBy', { name: o.grantedBy })} · ` : ''}
                        {o.note}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{formatInr(o.amountMinor)}</Td>
                  <Td>
                    <PaymentStateBadge state={o.state} />
                    {o.coupon ? <p className="mt-1 text-xs text-stone-500">{t('orders.couponUsed', { code: o.coupon.code })}</p> : null}
                  </Td>
                  <Td className="font-mono text-xs break-all">{payment ? `${payment.provider} ${payment.providerPaymentId}` : (o.providerOrderId ?? t('common.none'))}</Td>
                  <Td className="text-right">
                    <OrderActionButtons order={o} customer={o.user.email ?? o.user.name} actions={actions} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
