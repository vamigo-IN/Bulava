'use client';

import { ArrowRight, Check, ChevronRight, Crown, Gift, LockKeyhole, PackagePlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { addOnLine, planFeatureLines } from '@/lib/plan-features';
import { useAccountPlan, useAddOns, useEventPlan, usePlans, type PlanLine } from '@/lib/queries';
import { OfferPrice } from '@/components/ui/offer-price';
import { Card, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

/** The limits an event uses, in the order hosts meet them. */
const METERS = ['functions.max', 'guests.max', 'media.photos.max', 'video.renders.max', 'messaging.whatsapp.max'] as const;

/**
 * What the event uses of each of its plan's limits: so many of so many, no
 * limit, or not in the plan. A draft may hold more than its plan (publishing
 * asks for one it fits); the bar says so.
 */
function PlanUsage({ features, usage, draft }: { features: Record<string, { enabled: boolean; limit: number | null }>; usage: Record<string, number>; draft: boolean }) {
  const t = useT();
  const n = (v: number) => v.toLocaleString('en-IN');
  return (
    <Card className="rounded-3xl">
      <h2 className="font-display text-2xl">{t('plan.usage.title')}</h2>
      {draft ? <p className="mt-1 text-sm text-stone-600">{t('plan.usage.body')}</p> : null}
      <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {METERS.map((key) => {
          const f = features[key];
          const used = usage[key] ?? 0;
          const limit = f?.enabled ? f.limit : 0;
          const off = limit === 0 && used === 0;
          const over = limit !== null && limit > 0 ? used > limit : used > 0;
          const share = limit === null ? 0 : limit > 0 ? Math.min(1, used / limit) : 1;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-stone-800">{t(`plan.usage.${key}`)}</span>
                <span className={over ? 'font-semibold text-rose-700' : 'text-stone-600'}>
                  {off ? t('plan.usage.notIncluded') : limit === null ? t('plan.usage.unlimited', { used: n(used) }) : t('plan.usage.of', { used: n(used), limit: n(limit) })}
                </span>
              </div>
              {off || limit === null ? null : (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gold-100" role="progressbar" aria-label={t(`plan.usage.${key}`)} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
                  <div className={over ? 'h-full rounded-full bg-rose-500' : share >= 0.9 ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-gold-500'} style={{ width: `${Math.max(share * 100, used ? 4 : 0)}%` }} />
                </div>
              )}
              {over ? <p className="mt-1 text-xs text-rose-700">{t('plan.usage.over')}</p> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * A plan and its add-ons (ADR-062): what the plan includes (with the add-ons
 * added up), the add-ons it can take, and the bigger plans at the difference.
 * On the account's page it is the account's plan, with the plans bought or
 * given for one event alone listed after it. From an event it is the plan the
 * event runs on: the owner's account plan, or a bigger one of the event's own
 * (an add-on bought from there adds to it); the checkout comes back to the
 * event (`eventId`) and puts a chosen design on it (`template`). Without a
 * plan the add-ons still show, waiting for one; without `canBuy` (a team
 * member who is not the owner) nothing is offered for sale.
 */
export function PlanOverview({ eventId, template, canBuy = true, draft = false }: { eventId?: string; template?: string | null; canBuy?: boolean; draft?: boolean }) {
  const t = useT();
  const account = useAccountPlan(!eventId);
  const event = useEventPlan(eventId ?? '', Boolean(eventId));
  const plans = usePlans();
  const addOns = useAddOns();
  const source = eventId ? event : account;
  if (source.isPending || plans.isPending || addOns.isPending) return <Spinner label={t('common.loading')} />;

  const checkout = (planKey: string) => `/dashboard/checkout?${new URLSearchParams({ plan: planKey, ...(eventId ? { event: eventId } : {}), ...(template ? { template } : {}) }).toString()}`;
  const current: PlanLine | null = (eventId ? event.data?.plan : account.data?.plan) ?? null;
  const scope = eventId ? (event.data?.scope ?? null) : current ? 'ACCOUNT' : null;
  const complimentary = eventId ? Boolean(event.data?.complimentary) : false;
  // What a bigger plan is paid against: the owner's account plan (a plan of one event's own is not).
  const accountPlan = (eventId ? event.data?.accountPlan : account.data?.plan) ?? null;
  const ownedList = (eventId ? event.data?.addOns : account.data?.addOns) ?? [];
  const owned = new Map(ownedList.map((a) => [a.key, a]));
  // What the plan has, add-ons added up, as the plan cards read it.
  const features = Object.entries((eventId ? event.data?.features : account.data?.features) ?? {}).map(([featureKey, v]) => ({ featureKey, enabled: v.enabled, limit: v.limit }));
  const allAddOns = addOns.data ?? [];
  const offered = current ? allAddOns.filter((a) => (!a.offeredTo?.length || a.offeredTo.includes(current.key)) && (a.stackable || !owned.has(a.key))) : [];
  const paidFrom = accountPlan?.interval === 'ONE_TIME' ? accountPlan.priceMinor : 0;
  const floor = Math.max(paidFrom, current?.interval === 'ONE_TIME' ? current.priceMinor : 0);
  const bigger = (plans.data ?? []).filter((p) => p.interval === 'ONE_TIME' && p.priceMinor > floor);
  const eventPlans = eventId ? [] : (account.data?.eventPlans ?? []);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
          <Crown aria-hidden className="size-4" /> {eventId ? t('plan.page.event') : t('plan.page.yours')}
        </p>
        {current ? (
          <>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 font-display text-4xl">
              {current.name}
              {complimentary ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-sans text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <Gift aria-hidden className="size-3.5" /> {t('plan.page.complimentary')}
                </span>
              ) : null}
            </h2>
            {current.tagline ? <p className="mt-1 text-sm font-semibold text-brand-700">{current.tagline}</p> : null}
            <p className="mt-1 text-sm text-stone-500">
              {complimentary ? t('plan.page.given') : current.interval === 'YEAR' ? t('checkout.yearly') : t('plan.page.paidOnce', { price: inr(current.priceMinor) })}
              {eventId && scope ? ` · ${scope === 'EVENT' ? t('plan.page.eventOnly') : t('plan.page.accountWide')}` : ''}
            </p>
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
          </>
        ) : (
          <>
            <h2 className="mt-2 font-display text-3xl">{eventId ? t('plan.page.eventNone') : t('plan.page.none')}</h2>
            <p className="mt-2 max-w-xl text-stone-600">{eventPlans.length ? t('plan.page.noneButEvents') : t('plan.page.noneBody')}</p>
          </>
        )}
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
      </Card>

      {eventId && event.data?.usage ? <PlanUsage features={event.data.features} usage={event.data.usage} draft={draft} /> : null}

      {eventPlans.length ? (
        <section aria-labelledby="plan-events">
          <h2 id="plan-events" className="font-display text-2xl">
            {t('plan.page.eventPlans')}
          </h2>
          <p className="mt-1 text-sm text-stone-600">{t('plan.page.eventPlansBody')}</p>
          <ul className="clay mt-4 divide-y divide-gold-100 overflow-hidden rounded-2xl">
            {eventPlans.map((e) => (
              <li key={e.eventId}>
                <Link href={`/dashboard/events/${e.eventId}/unlock`} className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-gold-100/40">
                  <span className="min-w-0 truncate font-medium">{e.eventTitle}</span>
                  <span className="flex shrink-0 items-center gap-2 text-stone-600">
                    {e.plan.name}
                    {e.complimentary ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-800">{t('plan.page.complimentary')}</span> : null}
                    <ChevronRight aria-hidden className="size-4 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canBuy && offered.length ? (
        <section aria-labelledby="plan-addons">
          <h2 id="plan-addons" className="font-display text-2xl">
            {t('plan.page.more')}
          </h2>
          <p className="mt-1 text-sm text-stone-600">{scope === 'EVENT' ? t('plan.page.addOnsHere') : t('pricing.addons.subtitle')}</p>
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

      {canBuy && bigger.length ? (
        <section aria-labelledby="plan-bigger">
          <h2 id="plan-bigger" className="font-display text-2xl">
            {current ? t('plan.page.bigger') : t('plan.page.choose')}
          </h2>
          {scope === 'EVENT' ? <p className="mt-1 text-sm text-stone-600">{t('plan.page.biggerForAccount')}</p> : null}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {bigger.map((p) => (
              <li key={p.key} className="clay flex flex-col rounded-3xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">{p.name}</h3>
                  {p.badge ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-gold-800">{p.badge}</span> : null}
                </div>
                {p.tagline ? <p className="text-sm font-semibold text-brand-700">{p.tagline}</p> : null}
                <OfferPrice className="mt-2" size="md" priceMinor={p.priceMinor} listPriceMinor={p.listPriceMinor} currency={p.currency} t={t} />
                <p className="mt-1 flex-1 text-sm text-stone-600">{p.description}</p>
                <Link href={checkout(p.key)} className="btn-3d mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm">
                  {paidFrom ? t('plan.page.unlock', { plan: p.name, price: inr(p.priceMinor - paidFrom) }) : t('plan.page.unlockFull', { plan: p.name, price: inr(p.priceMinor) })}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* No plan yet: the add-ons are shown waiting for one (they add to a plan). */}
      {canBuy && !current && allAddOns.length ? (
        <section aria-labelledby="plan-addons-later">
          <h2 id="plan-addons-later" className="font-display text-2xl">
            {t('plan.page.more')}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-stone-600">
            <LockKeyhole aria-hidden className="size-4 shrink-0 text-gold-600" />
            {t('plan.page.addOnsNeedPlan')}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {allAddOns.map((a) => (
              <li key={a.key} className="clay-inset flex flex-col rounded-3xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl text-stone-700">{a.name}</h3>
                  <span className="shrink-0 text-sm font-semibold text-stone-600">{inr(a.priceMinor)}</span>
                </div>
                <p className="mt-1 flex-1 text-sm text-stone-500">{addOnLine(a, t) ?? a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
