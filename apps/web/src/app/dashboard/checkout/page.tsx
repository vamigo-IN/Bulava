'use client';

import { ArrowLeft, BadgePercent, Check, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { paymentStatusPath, runCheckout, type CheckoutSession } from '@/lib/checkout';
import { errorMessage, useT } from '@/lib/i18n';
import { planFeatureLines } from '@/lib/plan-features';
import { useMe, usePlans } from '@/lib/queries';
import { track } from '@/lib/track';
import { Alert, Button, Input, Spinner } from '@/components/ui/primitives';

const inr = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

/** POST /orders/quote: the price, a coupon's discount and the total (nothing is bought), and whether the account has the plan already. */
interface Quote {
  couponCode: string | null;
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  included: boolean;
}

const UUID = /^[0-9a-f-]{36}$/;
const LINK = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';

/**
 * Checkout: the plan, its price with a coupon applied before paying, and the
 * purchase terms, ticked here and never pre-ticked. Plans belong to the account
 * (ADR-053). The browser only opens Razorpay; the API decides that a payment
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
  const params = useSearchParams();
  const planKey = params.get('plan');
  const template = params.get('template');
  // From an event's plans page: the event a chosen template goes on once paid (and the way back).
  const eventParam = params.get('event');
  const eventId = eventParam && UUID.test(eventParam) ? eventParam : null;
  const me = useMe();
  const plans = usePlans();
  const plan = plans.data?.find((p) => p.key === planKey && p.priceMinor > 0);

  /** The plain price; `quote` replaces it while a coupon is applied. */
  const [base, setBase] = useState<Quote | null>(null);
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

  const key = plan?.key;
  useEffect(() => {
    if (!key) return;
    apiPost<Quote>('/orders/quote', { planKey: key })
      .then(setBase)
      .catch(() => undefined);
  }, [key]);

  if (me.isPending || plans.isPending) return <Spinner label={t('common.loading')} />;

  if (!plan) {
    return (
      <div className="clay mx-auto max-w-xl rounded-3xl p-6 text-center sm:p-8">
        <h1 className="font-display text-3xl">{t('checkout.noPlan.title')}</h1>
        <p className="mt-2 text-stone-600">{t('checkout.noPlan.body')}</p>
        <Link href="/pricing" className="btn-3d mt-6 inline-flex min-h-11 items-center rounded-full px-6 text-sm">
          {t('checkout.seePlans')}
        </Link>
      </div>
    );
  }

  const shown = quote ?? base;
  const applied = quote?.couponCode ?? null;
  const price = shown?.priceMinor ?? plan.priceMinor;
  const discount = quote?.discountMinor ?? 0;
  const total = shown?.totalMinor ?? plan.priceMinor;
  const currency = shown?.currency ?? plan.currency;
  const included = shown?.included ?? false;
  const back = eventId ? `/dashboard/events/${eventId}/unlock${template ? `?template=${encodeURIComponent(template)}` : ''}` : '/pricing';
  const here = `/dashboard/checkout?${params.toString()}`;

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
      setQuote(await apiPost<Quote>('/orders/quote', { planKey: plan.key, couponCode: code }));
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
    const orderKey = `${plan.key}|${applied ?? ''}`;
    try {
      const order =
        open?.key === orderKey
          ? await apiPost<CheckoutSession>(`/orders/${open.orderId}/checkout`)
          : await apiPost<CheckoutSession>('/orders', { planKey: plan.key, couponCode: applied ?? undefined, acceptTerms: true });
      // A 100% coupon is paid already; everything else goes through Razorpay first.
      const outcome = order.status === 'PAID' ? 'paid' : await runCheckout(order, { unavailable: t('upgrade.unavailable') });
      if (outcome === 'dismissed') {
        setOpen({ orderId: order.orderId, key: orderKey });
        setBusy(false);
        return;
      }
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
      <Link href={back} className="group flex w-fit items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        {t('checkout.changePlan')}
      </Link>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{t('checkout.title')}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* The plan, as chosen on the plans page. */}
        <section aria-labelledby="checkout-plan" className="clay rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="checkout-plan" className="font-display text-3xl">
              {plan.name}
            </h2>
            <p className="font-display text-3xl">{inr(plan.priceMinor, plan.currency)}</p>
          </div>
          <p className="mt-0.5 text-sm text-stone-500">{plan.interval === 'YEAR' ? t('checkout.yearly') : t('checkout.oneTime')}</p>
          <ul className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {planFeatureLines(plan, t).map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </section>

        {/* The price, a coupon, the terms and the payment. */}
        <aside aria-label={t('checkout.summary')} className="clay rounded-3xl p-5 sm:p-6 lg:sticky lg:top-24">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">{t('checkout.price', { plan: plan.name })}</dt>
              <dd className="tabular-nums">{inr(price, currency)}</dd>
            </div>
            {applied ? (
              <div className="flex justify-between gap-4 text-emerald-700">
                <dt>{t('checkout.discount', { code: applied })}</dt>
                <dd className="tabular-nums">−{inr(discount, currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-gold-200 pt-3">
              <dt className="font-semibold text-ink">
                {t('checkout.total')} <span className="text-xs font-normal text-stone-500">{t('checkout.inclGst')}</span>
              </dt>
              <dd className="font-display text-3xl tabular-nums">{inr(total, currency)}</dd>
            </div>
          </dl>

          {included ? null : (
            <div className="mt-5 border-t border-gold-100 pt-4">
              {applied ? (
                <div role="status" className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  <BadgePercent aria-hidden className="size-4.5 shrink-0" />
                  <span className="min-w-0 flex-1">{t('checkout.applied', { code: applied, amount: inr(discount, currency) })}</span>
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
            // The account has this plan (or a higher one) already: nothing to pay for.
            <div className="mt-5 border-t border-gold-100 pt-4">
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <Check aria-hidden className="size-4" strokeWidth={3} />
                {t('checkout.included')}
              </p>
              <Link href="/dashboard" className="btn-3d btn-3d-light mt-4 flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base">
                {t('payment.action.dashboard')}
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
                {busy ? t('common.loading') : total === 0 ? t('checkout.payFree') : t('checkout.pay', { amount: inr(total, currency) })}
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
