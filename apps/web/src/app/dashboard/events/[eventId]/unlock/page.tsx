'use client';

import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { paymentStatusPath } from '@/lib/checkout';
import { useT } from '@/lib/i18n';
import { planFeatureLines, planTier } from '@/lib/plan-features';
import { useDesign, useOrders, usePlans } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Badge, Card, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

const ORDER_TONE = { PAID: 'success', FAILED: 'danger', REFUNDED: 'warning', CANCELLED: 'neutral', CREATED: 'neutral' } as const;

/**
 * The plans, from an event. Choosing one leads to the checkout
 * (/dashboard/checkout), which shows the price, takes a coupon and the purchase
 * terms, and pays. Plans belong to the account (ADR-053); the event only comes
 * along for the way back and for a template chosen before unlocking.
 */
export default function UnlockPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const plans = usePlans();
  const design = useDesign(eventId);
  const orders = useOrders(eventId);

  if (plans.isPending || design.isPending) return <Spinner label={t('common.loading')} />;
  const perEvent = (plans.data ?? []).filter((p) => p.interval === 'ONE_TIME' && p.priceMinor > 0);
  const currentTier = design.data?.entitlements['templates.maxTier']?.limit ?? 0;
  const template = params.get('template');
  const checkout = (planKey: string) => `/dashboard/checkout?${new URLSearchParams({ plan: planKey, event: eventId, ...(template ? { template } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('upgrade.title')}</h2>
        <p className="mt-1 text-stone-600">{t('upgrade.subtitle')}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {perEvent.map((plan) => {
          const owned = currentTier >= planTier(plan);
          return (
            <Card key={plan.key} className={cn('flex flex-col rounded-3xl', plan.key === 'PREMIUM' && 'border-gold-500 shadow-lg')}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-3xl">{plan.name}</h3>
                {plan.key === 'PREMIUM' ? <Badge tone="warning">{t('home.pricing.popular')}</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-stone-600">{plan.description}</p>
              <p className="mt-4 font-display text-5xl">{inr(plan.priceMinor)}</p>
              <p className="text-sm text-stone-500">{t('home.pricing.oneTime')}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {planFeatureLines(plan, t).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              {owned ? (
                <p className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-50 px-6 text-base font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <Check aria-hidden className="size-4.5" />
                  {t('upgrade.included')}
                </p>
              ) : (
                <Link href={checkout(plan.key)} className="btn-3d mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base">
                  {t('upgrade.choose', { plan: plan.name })}
                  <ArrowRight aria-hidden className="size-4.5" />
                </Link>
              )}
            </Card>
          );
        })}
      </div>
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
