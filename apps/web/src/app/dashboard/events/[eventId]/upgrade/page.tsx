'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { apiPost } from '@/lib/api';
import { paymentStatusPath, runCheckout, type CheckoutSession } from '@/lib/checkout';
import { errorMessage, useT } from '@/lib/i18n';
import { useDesign, useOrders, usePlans } from '@/lib/queries';
import type { Plan } from '@/lib/types';
import { cn } from '@/lib/utils';
import { track } from '@/lib/track';
import { Alert, Badge, Button, Card, Input, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

const ORDER_TONE = { PAID: 'success', FAILED: 'danger', REFUNDED: 'warning', CANCELLED: 'neutral', CREATED: 'neutral' } as const;

function features(plan: Plan): string[] {
  const t = createTranslator('en');
  const f = new Map(plan.features.map((x) => [x.featureKey, x]));
  const out: string[] = [];
  const tier = f.get('templates.maxTier');
  if (tier) out.push(t(`plan.feature.templates.${Math.min(2, tier.limit ?? 2) as 0 | 1 | 2}`));
  const fn = f.get('functions.max');
  if (fn) out.push(fn.limit === null ? t('plan.feature.functions.unlimited') : t('plan.feature.functions.max', { limit: fn.limit }));
  const g = f.get('guests.max');
  if (g) out.push(g.limit === null ? t('plan.feature.guests.unlimited') : t('plan.feature.guests.max', { limit: g.limit }));
  const p = f.get('media.photos.max');
  if (p?.limit) out.push(t('plan.feature.photos', { limit: p.limit.toLocaleString('en-IN') }));
  const v = f.get('video.renders.max');
  if (v?.limit) out.push(t('plan.feature.video', { limit: v.limit }));
  const wa = f.get('messaging.whatsapp.max');
  if (wa?.enabled) out.push(wa.limit === null ? t('plan.feature.whatsappMessages.unlimited') : t('plan.feature.whatsappMessages', { limit: wa.limit.toLocaleString('en-IN') }));
  if (f.get('branding.watermark')?.enabled === false) out.push(t('plan.feature.noWatermark'));
  return out;
}

/**
 * Checkout. The browser only opens Razorpay; success is decided server-side
 * (signature verification, plus the webhook), never by the browser. Every
 * checkout that gets as far as paying ends on the payment status page.
 */
export default function UpgradePage() {
  const t = useT();
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const plans = usePlans();
  const design = useDesign(eventId);
  const orders = useOrders(eventId);
  const [coupon, setCoupon] = useState('');
  /** The purchase terms box: an explicit tick each visit, never remembered or pre-ticked. */
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  if (plans.isPending || design.isPending) return <Spinner label={t('common.loading')} />;
  const perEvent = (plans.data ?? []).filter((p) => p.interval === 'ONE_TIME' && p.priceMinor > 0);
  const currentTier = design.data?.entitlements['templates.maxTier']?.limit ?? 0;
  const template = params.get('template');

  const buy = async (plan: Plan) => {
    setBusy(plan.key);
    setMessage(null);
    track('checkout_started', { plan: plan.key });
    try {
      const order = await apiPost<CheckoutSession>(`/events/${eventId}/orders`, { planKey: plan.key, couponCode: coupon.trim() || undefined, acceptTerms: agreed });
      // A 100% coupon is paid already; everything else goes through Razorpay first.
      const outcome = order.status === 'PAID' ? 'paid' : await runCheckout(order, { unavailable: t('upgrade.unavailable') });
      if (outcome === 'dismissed') {
        setBusy(null);
        return;
      }
      router.push(paymentStatusPath(order.orderId, outcome === 'paid' ? undefined : outcome, template));
    } catch (err) {
      setMessage({ tone: 'danger', text: err instanceof Error && !('code' in err) ? err.message : errorMessage(t, err) });
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('upgrade.title')}</h2>
        <p className="mt-1 text-stone-600">{t('upgrade.subtitle')}</p>
      </div>
      {message ? <Alert tone={message.tone === 'info' ? 'info' : message.tone}>{message.text}</Alert> : null}
      {/* Before paying: an optional coupon, and the terms of the purchase (never pre-ticked). */}
      <section className="clay-inset grid gap-5 rounded-3xl p-5 sm:p-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-start">
        <label className="block text-sm font-medium text-stone-800">
          {t('upgrade.coupon')}
          <Input className="mt-1 uppercase" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
        </label>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed text-stone-800">
            <input type="checkbox" className="mt-1 size-5 shrink-0 rounded border-stone-300 accent-brand-700" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} aria-describedby="purchase-terms-note" />
            <span>
              {t('upgrade.consent.before')}{' '}
              <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4">
                {t('auth.consent.terms')}
              </Link>{' '}
              {t('auth.consent.and')}{' '}
              <Link href="/refund" target="_blank" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4">
                {t('upgrade.consent.refund')}
              </Link>
              {t('upgrade.consent.after')}
            </span>
          </label>
          <p id="purchase-terms-note" className="mt-2 pl-8 text-xs leading-relaxed text-stone-600">
            {agreed ? t('upgrade.consent.secure') : t('upgrade.consent.required')}
          </p>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {perEvent.map((plan) => {
          const tier = plan.features.find((f) => f.featureKey === 'templates.maxTier')?.limit ?? 0;
          const owned = currentTier >= tier;
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
                {features(plan).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-6 rounded-full" disabled={owned || busy !== null || !agreed} onClick={() => buy(plan)}>
                {owned ? t('upgrade.included') : busy === plan.key ? t('common.loading') : t('upgrade.pay', { amount: inr(plan.priceMinor) })}
              </Button>
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
