'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgePercent, Check, Gift, LockKeyhole, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { paymentStatusPath, runCheckout, type CheckoutSession } from '@/lib/checkout';
import { errorMessage, useT } from '@/lib/i18n';
import { addOnLine, planFeatureLines } from '@/lib/plan-features';
import { moreKeys, useAccountPlan, useMe } from '@/lib/queries';
import { track } from '@/lib/track';
import { Alert, Button, Input, Spinner } from '@/components/ui/primitives';

const inr = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

interface PlanCard {
  key: string;
  name: string;
  description: string | null;
  interval: 'ONE_TIME' | 'YEAR';
  kind: 'PLAN' | 'ADDON';
  tagline: string | null;
  stackable: boolean;
  priceMinor: number;
  currency: string;
  features: Array<{ featureKey: string; enabled: boolean; limit: number | null }>;
}

/** POST /orders/quote (ADR-062): the plan or add-on, how many, the plan already owned (off a bigger one), a coupon and the total. */
interface Quote {
  plan: PlanCard;
  couponCode: string | null;
  priceMinor: number;
  quantity: number;
  upgradeFrom: { key: string; name: string; priceMinor: number } | null;
  creditMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  included: boolean;
}

/** POST /orders/offers: the first-plan offer made for this account (the ₹159 plan, never on the plans page). */
interface Offer {
  token: string;
  expiresAt: string;
  plan: PlanCard;
}

const UUID = /^[0-9a-f-]{36}$/;
const LINK = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';
const OFFER_SEEN = 'bulava.checkout.offer';
const MAX_QUANTITY = 20;

/**
 * Checkout (ADR-053, ADR-062): a plan or an add-on, its price less the plan
 * the account has (unlocking pays the difference), how many of a stackable
 * add-on, a coupon before paying, and the purchase terms, ticked here and never
 * pre-ticked. A host about to leave without a plan is offered the first-plan
 * offer once. The browser only opens Razorpay; the API decides that a payment
 * succeeded, and every checkout that gets as far as paying ends on
 * /dashboard/payments/:orderId.
 */
export default function CheckoutPage() {
  const t = useT();
  return (
    <Suspense fallback={<Spinner label={t('common.loading')} />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const planKey = params.get('plan');
  const offerToken = params.get('offer') ?? undefined;
  const template = params.get('template');
  // From an event's plans page: the event a chosen template goes on once paid (and the way back).
  const eventParam = params.get('event');
  const eventId = eventParam && UUID.test(eventParam) ? eventParam : null;
  const me = useMe();
  const account = useAccountPlan(Boolean(me.data));

  const [quantity, setQuantity] = useState(() => Math.min(MAX_QUANTITY, Math.max(1, Number(params.get('quantity')) || 1)));
  /** The price without a coupon; `quote` replaces it while a coupon is applied. */
  const [base, setBase] = useState<Quote | null>(null);
  const [baseError, setBaseError] = useState<ApiError | Error | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState('');
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  /** The purchase terms box: an explicit tick each visit, never remembered or pre-ticked. */
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** An order opened and left unpaid: paying again for the same thing reopens it instead of placing another. */
  const [open, setOpen] = useState<{ orderId: string; key: string } | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const leaving = useRef<string | null>(null);

  useEffect(() => {
    if (!planKey || !me.data) return;
    setQuote(null);
    apiPost<Quote>('/orders/quote', { planKey, quantity, offerToken })
      .then((q) => {
        setBase(q);
        setBaseError(null);
      })
      .catch((err: unknown) => setBaseError(err instanceof Error ? err : new Error(String(err))));
  }, [planKey, quantity, offerToken, me.data]);

  const plan = base?.plan ?? null;
  const shown = quote ?? base;
  const firstPlan = Boolean(plan && plan.kind === 'PLAN' && !offerToken && account.data && !account.data.plan);

  /** The first-plan offer, once a session, for a host about to leave this checkout without a plan. */
  const tryOffer = useCallback(
    async (then?: string) => {
      if (!firstPlan || offer || me.data?.provisional) return false;
      try {
        if (sessionStorage.getItem(OFFER_SEEN)) return false;
        sessionStorage.setItem(OFFER_SEEN, '1');
      } catch {
        // Storage blocked: offer at most once in this page.
      }
      try {
        const made = await apiPost<Offer>('/orders/offers', {});
        if (made.plan.priceMinor >= (base?.subtotalMinor ?? 0)) return false;
        leaving.current = then ?? null;
        setOffer(made);
        track('offer_shown', { plan: made.plan.key });
        return true;
      } catch {
        return false;
      }
    },
    [firstPlan, offer, me.data?.provisional, base?.subtotalMinor],
  );

  useEffect(() => {
    if (!firstPlan) return;
    // Desktop: the pointer heads for the tabs or the address bar.
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) void tryOffer();
    };
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, [firstPlan, tryOffer]);

  if (me.isPending || (planKey && !base && !baseError)) return <Spinner label={t('common.loading')} />;

  const back = eventId ? `/dashboard/events/${eventId}/unlock${template ? `?template=${encodeURIComponent(template)}` : ''}` : plan?.kind === 'ADDON' ? '/dashboard/plan' : '/pricing';

  if (!planKey || !plan || !shown) {
    const unavailable = baseError instanceof ApiError && (baseError.code === 'ADDON_NOT_OFFERED' || baseError.code === 'ADDON_NEEDS_PLAN');
    return (
      <div className="clay mx-auto max-w-xl rounded-3xl p-6 text-center sm:p-8">
        <h1 className="font-display text-3xl">{unavailable ? t('checkout.unavailable.title') : t('checkout.noPlan.title')}</h1>
        <p className="mt-2 text-stone-600">{unavailable ? errorMessage(t, baseError) : t('checkout.noPlan.body')}</p>
        <Link href="/pricing" className="btn-3d mt-6 inline-flex min-h-11 items-center rounded-full px-6 text-sm">
          {t('checkout.seePlans')}
        </Link>
      </div>
    );
  }

  const applied = quote?.couponCode ?? null;
  const currency = shown.currency;
  const addOn = plan.kind === 'ADDON';
  const included = shown.included;
  const here = `/dashboard/checkout?${params.toString()}`;
  const lines = addOn ? [addOnLine(plan, t) ?? plan.description ?? ''].filter(Boolean) : planFeatureLines(plan, t);

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    const code = coupon.trim().toUpperCase();
    if (!code) {
      setCouponError(t('checkout.couponEmpty'));
      return;
    }
    setApplying(true);
    setCouponError(null);
    try {
      setQuote(await apiPost<Quote>('/orders/quote', { planKey: plan.key, quantity, offerToken, couponCode: code }));
      track('coupon_applied', { plan: plan.key });
    } catch (err) {
      setCouponError(errorMessage(t, err));
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    setQuote(null);
    setCoupon('');
    setCouponError(null);
  };

  const pay = async () => {
    if (!agreed) {
      setTermsError(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    track('checkout_started', { plan: plan.key });
    const orderKey = `${plan.key}|${quantity}|${applied ?? ''}`;
    try {
      const order =
        open?.key === orderKey
          ? await apiPost<CheckoutSession>(`/orders/${open.orderId}/checkout`)
          : await apiPost<CheckoutSession>('/orders', { planKey: plan.key, quantity, offerToken, couponCode: applied ?? undefined, acceptTerms: true });
      // A 100% coupon is paid already; everything else goes through Razorpay first.
      const outcome = order.status === 'PAID' ? 'paid' : await runCheckout(order, { unavailable: t('upgrade.unavailable') });
      if (outcome === 'dismissed') {
        setOpen({ orderId: order.orderId, key: orderKey });
        setBusy(false);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: moreKeys.accountPlan });
      router.push(paymentStatusPath(order.orderId, outcome === 'paid' ? undefined : outcome, template, eventId));
    } catch (err) {
      // A coupon that ran out while paying: show the plain price again.
      if (err instanceof ApiError && err.code === 'COUPON_INVALID') removeCoupon();
      setMessage(err instanceof Error && !(err instanceof ApiError) ? err.message : errorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={back}
        onClick={(e) => {
          // Phones have no pointer leaving the page: the way back is where a host leaves.
          if (!firstPlan || offer) return;
          e.preventDefault();
          void tryOffer(back).then((shownOffer) => {
            if (!shownOffer) router.push(back);
          });
        }}
        className="group flex w-fit items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        {t('checkout.changePlan')}
      </Link>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{t('checkout.title')}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* What is bought. */}
        <section aria-labelledby="checkout-plan" className="clay rounded-3xl p-5 sm:p-6">
          {addOn ? <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">{t('checkout.addOn')}</p> : null}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="checkout-plan" className="font-display text-3xl">
              {plan.name}
            </h2>
            <p className="font-display text-3xl">{inr(plan.priceMinor, plan.currency)}</p>
          </div>
          {plan.tagline ? <p className="mt-0.5 text-sm font-semibold text-brand-700">{plan.tagline}</p> : null}
          <p className="mt-0.5 text-sm text-stone-500">{plan.interval === 'YEAR' ? t('checkout.yearly') : t('checkout.oneTime')}</p>
          {plan.description && !addOn ? <p className="mt-3 text-sm leading-relaxed text-stone-600">{plan.description}</p> : null}
          <ul className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {lines.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
          {plan.stackable && !included ? (
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm font-medium text-stone-800">{t('checkout.quantity')}</span>
              <div className="clay-inset flex items-center gap-1 rounded-full p-1">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || busy} aria-label={t('checkout.fewer')} className="btn-3d btn-3d-light size-9 rounded-full disabled:opacity-50">
                  <Minus aria-hidden className="size-4" />
                </button>
                <output aria-live="polite" className="min-w-8 text-center font-display text-xl tabular-nums">
                  {quantity}
                </output>
                <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY || busy} aria-label={t('checkout.more')} className="btn-3d btn-3d-light size-9 rounded-full disabled:opacity-50">
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
          {shown.upgradeFrom ? <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">{t('checkout.upgradeNote', { plan: shown.upgradeFrom.name })}</p> : null}
          {addOn && account.data?.plan ? <p className="mt-5 text-sm text-stone-600">{t('checkout.addOnNote', { plan: account.data.plan.name })}</p> : null}
        </section>

        {/* The price, a coupon, the terms and the payment. */}
        <aside aria-label={t('checkout.summary')} className="clay rounded-3xl p-5 sm:p-6 lg:sticky lg:top-24">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">{shown.quantity > 1 ? t('checkout.priceTimes', { name: plan.name, n: shown.quantity }) : addOn ? plan.name : t('checkout.price', { plan: plan.name })}</dt>
              <dd className="tabular-nums">{inr(shown.priceMinor * shown.quantity, currency)}</dd>
            </div>
            {shown.upgradeFrom ? (
              <div className="flex justify-between gap-4 text-emerald-700">
                <dt>{t('checkout.credit', { plan: shown.upgradeFrom.name })}</dt>
                <dd className="tabular-nums">−{inr(shown.creditMinor, currency)}</dd>
              </div>
            ) : null}
            {applied ? (
              <div className="flex justify-between gap-4 text-emerald-700">
                <dt>{t('checkout.discount', { code: applied })}</dt>
                <dd className="tabular-nums">−{inr(shown.discountMinor, currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-gold-200 pt-3">
              <dt className="font-semibold text-ink">
                {t('checkout.total')} <span className="text-xs font-normal text-stone-500">{t('checkout.inclGst')}</span>
              </dt>
              <dd className="font-display text-3xl tabular-nums">{inr(shown.totalMinor, currency)}</dd>
            </div>
          </dl>

          {included ? null : (
            <div className="mt-5 border-t border-gold-100 pt-4">
              {applied ? (
                <div role="status" className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  <BadgePercent aria-hidden className="size-4.5 shrink-0" />
                  <span className="min-w-0 flex-1">{t('checkout.applied', { code: applied, amount: inr(shown.discountMinor, currency) })}</span>
                  <button type="button" onClick={removeCoupon} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold underline-offset-4 hover:underline">
                    <X aria-hidden className="size-3.5" />
                    {t('checkout.remove')}
                  </button>
                </div>
              ) : (
                <form onSubmit={apply} noValidate>
                  <label htmlFor="checkout-coupon" className="text-sm font-medium text-stone-800">
                    {t('checkout.coupon')}
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="checkout-coupon"
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value);
                        setCouponError(null);
                      }}
                      maxLength={40}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={couponError ? true : undefined}
                      aria-describedby={couponError ? 'checkout-coupon-error' : undefined}
                      className="min-w-0 flex-1 uppercase"
                    />
                    <Button type="submit" variant="secondary" disabled={applying} className="shrink-0">
                      {applying ? t('checkout.applying') : t('checkout.apply')}
                    </Button>
                  </div>
                  {couponError ? (
                    <p id="checkout-coupon-error" role="alert" className="mt-1.5 text-sm text-red-700">
                      {couponError}
                    </p>
                  ) : null}
                </form>
              )}
            </div>
          )}

          {included ? (
            // The account has this plan (or a bigger one) or this add-on already: nothing to pay for.
            <div className="mt-5 border-t border-gold-100 pt-4">
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <Check aria-hidden className="size-4" strokeWidth={3} />
                {addOn ? t('checkout.includedAddOn') : t('checkout.includedPlan')}
              </p>
              <Link href="/dashboard/plan" className="btn-3d btn-3d-light mt-4 flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base">
                {t('account.nav.plan')}
              </Link>
            </div>
          ) : me.data?.provisional ? (
            // A WhatsApp-only quick-start account secures itself first: receipts and refunds need a reachable account.
            <Link href={`/dashboard/claim?next=${encodeURIComponent(here)}`} className="btn-3d mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base">
              <ShieldCheck aria-hidden className="size-4.5" />
              {t('claim.banner.cta')}
            </Link>
          ) : (
            <>
              {/* The purchase terms: unticked until the buyer ticks them. */}
              <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-gold-100 pt-4 text-sm leading-relaxed text-stone-800">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-brand-700"
                  checked={agreed}
                  aria-invalid={termsError ? true : undefined}
                  aria-describedby={termsError ? 'checkout-terms-error' : undefined}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked) setTermsError(false);
                  }}
                />
                <span>
                  {t('upgrade.consent.before')}{' '}
                  <Link href="/terms" target="_blank" className={LINK}>
                    {t('auth.consent.terms')}
                  </Link>{' '}
                  {t('auth.consent.and')}{' '}
                  <Link href="/refund" target="_blank" className={LINK}>
                    {t('upgrade.consent.refund')}
                  </Link>
                  .
                </span>
              </label>
              {termsError ? (
                <p id="checkout-terms-error" role="alert" className="mt-1.5 pl-8 text-sm text-red-700">
                  {t('upgrade.consent.required')}
                </p>
              ) : null}
              {message ? (
                <div className="mt-4">
                  <Alert>{message}</Alert>
                </div>
              ) : null}
              <Button size="lg" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full" disabled={busy} onClick={() => void pay()}>
                <LockKeyhole aria-hidden className="size-4.5" />
                {busy ? t('common.loading') : shown.totalMinor === 0 ? t('checkout.payFree') : t('checkout.pay', { amount: inr(shown.totalMinor, currency) })}
              </Button>
            </>
          )}
        </aside>
      </div>

      {offer ? (
        <OfferDialog
          offer={offer}
          onAccept={() => {
            track('offer_accepted', { plan: offer.plan.key });
            router.push(`/dashboard/checkout?${new URLSearchParams({ plan: offer.plan.key, offer: offer.token, ...(eventId ? { event: eventId } : {}), ...(template ? { template } : {}) }).toString()}`);
            setOffer(null);
          }}
          onDecline={() => {
            const then = leaving.current;
            setOffer(null);
            if (then) router.push(then);
          }}
        />
      ) : null}
    </div>
  );
}

/** The first-plan offer: what it is, its price, and a way out that is as easy as the way in. */
function OfferDialog({ offer, onAccept, onDecline }: { offer: Offer; onAccept: () => void; onDecline: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDecline();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDecline]);
  const price = inr(offer.plan.priceMinor, offer.plan.currency);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-night-900/60 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onDecline()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="offer-title" className="clay w-full max-w-md rounded-[2rem] p-6 outline-none sm:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
          <Gift aria-hidden className="size-3.5" /> {t('checkout.offer.badge')}
        </p>
        <h2 id="offer-title" className="mt-3 font-display text-3xl">
          {t('checkout.offer.title')}
        </h2>
        <p className="mt-2 leading-relaxed text-stone-700">{t('checkout.offer.body', { plan: offer.plan.name, price })}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {planFeatureLines(offer.plan, t).map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-stone-500">{t('checkout.offer.until')}</p>
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={onAccept} className="btn-3d min-h-12 rounded-full px-6 text-base">
            {t('checkout.offer.accept', { plan: offer.plan.name, price })}
          </button>
          <button type="button" onClick={onDecline} className="min-h-11 rounded-full text-sm font-semibold text-stone-600 hover:text-ink">
            {t('checkout.offer.decline')}
          </button>
        </div>
      </div>
    </div>
  );
}
