'use client';

import { ArrowRight, Check, Crown, PackagePlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { addOnLine, planFeatureLines } from '@/lib/plan-features';
import { useAccountPlan, useAddOns, usePlans } from '@/lib/queries';
import { Card, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

/**
 * The account's plan and add-ons (ADR-062): what the plan includes (with the
 * add-ons added up), the add-ons it can take, and the bigger plans at the
 * difference. From an event, the checkout comes back to it (`eventId`) and
 * puts a chosen design on it (`template`).
 */
export function PlanOverview({ eventId, template }: { eventId?: string; template?: string | null }) {
  const t = useT();
  const account = useAccountPlan();
  const plans = usePlans();
  const addOns = useAddOns();
  if (account.isPending || plans.isPending || addOns.isPending) return <Spinner label={t('common.loading')} />;

  const checkout = (planKey: string) => `/dashboard/checkout?${new URLSearchParams({ plan: planKey, ...(eventId ? { event: eventId } : {}), ...(template ? { template } : {}) }).toString()}`;
  const current = account.data?.plan ?? null;
  const owned = new Map((account.data?.addOns ?? []).map((a) => [a.key, a]));
  // What the account has, add-ons added up, as the plan cards read it.
  const features = Object.entries(account.data?.features ?? {}).map(([featureKey, v]) => ({ featureKey, enabled: v.enabled, limit: v.limit }));
  const offered = current ? (addOns.data ?? []).filter((a) => (!a.offeredTo?.length || a.offeredTo.includes(current.key)) && (a.stackable || !owned.has(a.key))) : [];
  const paidFrom = current?.interval === 'ONE_TIME' ? current.priceMinor : 0;
  const bigger = (plans.data ?? []).filter((p) => p.interval === 'ONE_TIME' && p.priceMinor > paidFrom);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
          <Crown aria-hidden className="size-4" /> {t('plan.page.yours')}
        </p>
        {current ? (
          <>
            <h2 className="mt-2 font-display text-4xl">{current.name}</h2>
            {current.tagline ? <p className="mt-1 text-sm font-semibold text-brand-700">{current.tagline}</p> : null}
            <p className="mt-1 text-sm text-stone-500">{current.interval === 'YEAR' ? t('checkout.yearly') : t('plan.page.paidOnce', { price: inr(current.priceMinor) })}</p>
            <ul className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {planFeatureLines({ features }, t).map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            {owned.size ? (
              <div className="mt-5 border-t border-gold-100 pt-4">
                <h3 className="text-sm font-semibold text-stone-800">{t('plan.page.addOns')}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {[...owned.values()].map((a) => (
                    <li key={a.key} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                      <PackagePlus aria-hidden className="size-3.5" />
                      {a.quantity > 1 ? t('checkout.priceTimes', { name: a.name, n: a.quantity }) : a.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="mt-2 font-display text-3xl">{t('plan.page.none')}</h2>
            <p className="mt-2 max-w-xl text-stone-600">{t('plan.page.noneBody')}</p>
          </>
        )}
      </Card>

      {offered.length ? (
        <section aria-labelledby="plan-addons">
          <h2 id="plan-addons" className="font-display text-2xl">
            {t('plan.page.more')}
          </h2>
          <p className="mt-1 text-sm text-stone-600">{t('pricing.addons.subtitle')}</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {offered.map((a) => (
              <li key={a.key} className="clay flex flex-col rounded-3xl p-5">
                <h3 className="font-display text-xl">{a.name}</h3>
                <p className="mt-1 flex-1 text-sm text-stone-600">{addOnLine(a, t) ?? a.description}</p>
                {owned.has(a.key) ? <p className="mt-2 text-xs text-emerald-700">{t('plan.page.haveSome', { n: owned.get(a.key)!.quantity })}</p> : null}
                <Link href={checkout(a.key)} className="btn-3d btn-3d-light mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm">
                  <Plus aria-hidden className="size-4" />
                  {t('plan.page.add', { price: inr(a.priceMinor) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bigger.length ? (
        <section aria-labelledby="plan-bigger">
          <h2 id="plan-bigger" className="font-display text-2xl">
            {current ? t('plan.page.bigger') : t('plan.page.choose')}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {bigger.map((p) => (
              <li key={p.key} className="clay flex flex-col rounded-3xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">{p.name}</h3>
                  {p.badge ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-gold-800">{p.badge}</span> : null}
                </div>
                {p.tagline ? <p className="text-sm font-semibold text-brand-700">{p.tagline}</p> : null}
                <p className="mt-1 flex-1 text-sm text-stone-600">{p.description}</p>
                <Link href={checkout(p.key)} className="btn-3d mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm">
                  {current ? t('plan.page.unlock', { plan: p.name, price: inr(p.priceMinor - paidFrom) }) : t('plan.page.unlockFull', { plan: p.name, price: inr(p.priceMinor) })}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
