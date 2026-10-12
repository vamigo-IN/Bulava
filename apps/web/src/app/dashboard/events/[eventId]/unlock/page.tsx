'use client';

import { ChevronRight, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { PlanOverview } from '@/components/account/plan-overview';
import { paymentStatusPath } from '@/lib/checkout';
import { useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useEvent, useOrders } from '@/lib/queries';
import { Badge, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

const ORDER_TONE = { PAID: 'success', FAILED: 'danger', REFUNDED: 'warning', CANCELLED: 'neutral', CREATED: 'neutral' } as const;

/**
 * Unlocking more from an event (ADR-053, ADR-062): the owner's plan and its
 * add-ons, the add-ons it can take and the bigger plans at the difference.
 * Plans belong to the owner's account, so only the owner buys them
 * (billing.manage); the rest of the team sees who to ask instead.
 */
export default function UnlockPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const event = useEvent(eventId);
  const orders = useOrders(eventId);

  if (event.isPending) return <Spinner label={t('common.loading')} />;
  const owner = can(event.data, 'billing.manage');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('upgrade.title')}</h2>
        <p className="mt-1 text-stone-600">{t('upgrade.subtitle')}</p>
      </div>
      {owner ? (
        <PlanOverview eventId={eventId} template={params.get('template')} />
      ) : (
        <div role="note" className="clay flex items-start gap-3 rounded-3xl p-5">
          <span aria-hidden className="icon-3d grid size-10 shrink-0 place-items-center rounded-xl">
            <KeyRound className="size-4.5" />
          </span>
          <div>
            <h3 className="font-display text-xl">{t('upgrade.ownerOnly.title')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('upgrade.ownerOnly.body')}</p>
          </div>
        </div>
      )}
      {orders.data?.length ? (
        <section>
          <h3 className="mb-2 font-display text-2xl">{t('upgrade.history')}</h3>
          <ul className="clay divide-y divide-gold-100 overflow-hidden rounded-2xl">
            {orders.data.map((o) => (
              <li key={o.id}>
                <Link href={paymentStatusPath(o.id)} className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-gold-100/40">
                  <span>
                    {o.plan.name} · {new Date(o.createdAt).toLocaleDateString('en-IN')}
                  </span>
                  <span className="flex items-center gap-2">
                    {inr(o.amountMinor)}
                    <Badge tone={ORDER_TONE[o.status]}>{t(`payment.status.${o.status}`)}</Badge>
                    <ChevronRight aria-hidden className="size-4 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
