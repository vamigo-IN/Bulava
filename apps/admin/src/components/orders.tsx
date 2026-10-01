'use client';

import { useMutation } from '@tanstack/react-query';
import { RotateCcw, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Order, PaymentState } from '@/lib/types';
import { formatInr } from '@/lib/utils';
import { useCan, useInvalidate } from './shell';
import { Alert, Badge, Button, type BadgeTone } from './ui';

const STATE_TONE: Record<PaymentState, BadgeTone> = {
  PAID: 'success',
  PAID_WITH_COUPON: 'success',
  COMPLIMENTARY: 'gold',
  AWAITING_PAYMENT: 'warning',
  CREATED: 'warning',
  ABANDONED: 'neutral',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  REVOKED: 'neutral',
  CANCELLED: 'neutral',
};

/** What a payment means (paid, complimentary, abandoned checkout…), spelled out. */
export function PaymentStateBadge({ state }: { state: PaymentState }) {
  return <Badge tone={STATE_TONE[state] ?? 'neutral'}>{t(`state.${state}`)}</Badge>;
}

type ActionableOrder = Pick<Order, 'id' | 'kind' | 'state' | 'amountMinor'>;

/** Refunds (payment.refund) and revoking complimentary upgrades (plan.grant), with their outcome message. */
export function useOrderActions() {
  const invalidate = useInvalidate();
  const canRefund = useCan('payment.refund');
  const canRevoke = useCan('plan.grant');
  const [notice, setNotice] = useState<string | null>(null);
  const done = async (message: string) => {
    setNotice(message);
    await invalidate(['admin', 'orders'], ['admin', 'user'], ['admin', 'stats']);
  };
  const refund = useMutation({ mutationFn: (id: string) => apiPost(`/admin/orders/${id}/refund`), onSuccess: () => done(t('orders.refunded')) });
  const revoke = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => apiPost(`/admin/orders/${id}/revoke`, { note }),
    onSuccess: () => done(t('profile.revoked')),
  });
  const error = refund.error ?? revoke.error;
  return {
    canRefund,
    canRevoke,
    busy: refund.isPending || revoke.isPending,
    refund: (order: ActionableOrder, customer: string) => {
      setNotice(null);
      if (window.confirm(t('orders.confirmRefund', { amount: formatInr(order.amountMinor), email: customer }))) refund.mutate(order.id);
    },
    revoke: (order: ActionableOrder) => {
      setNotice(null);
      const note = window.prompt(t('profile.revokePrompt'))?.trim();
      if (note) revoke.mutate({ id: order.id, note });
    },
    /** Success or error line for the page. */
    status: error ? (
      <Alert className="mb-4">{errorMessage(error, t('common.error'))}</Alert>
    ) : notice ? (
      <Alert tone="success" className="mb-4">
        {notice}
      </Alert>
    ) : null,
  };
}

export type OrderActions = ReturnType<typeof useOrderActions>;

/** Refund for paid purchases; Revoke for complimentary upgrades that are still active. */
export function OrderActionButtons({ order, customer, actions }: { order: ActionableOrder; customer: string; actions: OrderActions }) {
  if (order.kind === 'ADMIN_GRANT') {
    if (!actions.canRevoke || order.state !== 'COMPLIMENTARY') return null;
    return (
      <Button size="sm" variant="danger" disabled={actions.busy} onClick={() => actions.revoke(order)}>
        <Undo2 className="size-3.5" aria-hidden /> {t('orders.revoke')}
      </Button>
    );
  }
  if (!actions.canRefund || order.state !== 'PAID' || order.amountMinor <= 0) return null;
  return (
    <Button size="sm" variant="danger" disabled={actions.busy} onClick={() => actions.refund(order, customer)}>
      <RotateCcw className="size-3.5" aria-hidden /> {t('orders.refund')}
    </Button>
  );
}
