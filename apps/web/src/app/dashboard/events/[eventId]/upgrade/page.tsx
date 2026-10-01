'use client';

import { Check } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useDesign, useInvalidateEvent, useOrders, usePlans } from '@/lib/queries';
import type { Plan } from '@/lib/types';
import { cn } from '@/lib/utils';
import { track } from '@/lib/track';
import { Alert, Badge, Button, Card, Input, Spinner } from '@/components/ui/primitives';

const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

interface CreatedOrder {
  orderId: string;
  status: 'CREATED' | 'PAID';
  amountMinor: number;
  currency?: string;
  planName?: string;
  keyId?: string;
  providerOrderId?: string;
  prefill?: { name: string; email: string; contact: string };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (e: unknown) => void) => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
 * (signature verification here, plus the webhook), never by the browser.
 */
export default function UpgradePage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const plans = usePlans();
  const design = useDesign(eventId);
  const orders = useOrders(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  if (plans.isPending || design.isPending) return <Spinner label={t('common.loading')} />;
  const perEvent = (plans.data ?? []).filter((p) => p.interval === 'ONE_TIME' && p.priceMinor > 0);
  const currentTier = design.data?.entitlements['templates.maxTier']?.limit ?? 0;

  const afterSuccess = async () => {
    setMessage({ tone: 'success', text: t('upgrade.success') });
    await invalidate();
    const template = params.get('template');
    if (template) await apiPut(`/events/${eventId}/design/website`, { templateKey: template }).catch(() => undefined);
  };

  const buy = async (plan: Plan) => {
    setBusy(plan.key);
    setMessage(null);
    track('checkout_started', { plan: plan.key });
    try {
      const order = await apiPost<CreatedOrder>(`/events/${eventId}/orders`, { planKey: plan.key, couponCode: coupon.trim() || undefined });
      if (order.status === 'PAID') {
        await afterSuccess();
        setBusy(null);
        return;
      }
      if (!(await loadCheckout()) || !window.Razorpay) throw new Error(t('upgrade.unavailable'));
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.providerOrderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: 'Bulava',
        description: order.planName,
        prefill: order.prefill,
        theme: { color: '#5b0e1b' },
        modal: { ondismiss: () => setBusy(null) },
        handler: async (res: RazorpayResponse) => {
          try {
            await apiPost(`/orders/${order.orderId}/verify`, {
              razorpayOrderId: res.razorpay_order_id,
              razorpayPaymentId: res.razorpay_payment_id,
              razorpaySignature: res.razorpay_signature,
            });
            await afterSuccess();
          } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(t, err) });
          } finally {
            setBusy(null);
          }
        },
      });
      rzp.on('payment.failed', () => {
        track('payment_failed', { plan: plan.key });
        setBusy(null);
      });
      rzp.open();
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
              <Button size="lg" className="mt-6 rounded-full" disabled={owned || busy !== null} onClick={() => buy(plan)}>
                {owned ? t('upgrade.included') : busy === plan.key ? t('common.loading') : t('upgrade.pay', { amount: inr(plan.priceMinor) })}
              </Button>
            </Card>
          );
        })}
      </div>
      <Card className="max-w-md rounded-3xl">
        <label className="block text-sm font-medium">
          {t('upgrade.coupon')}
          <Input className="mt-1 uppercase" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
        </label>
      </Card>
      {orders.data?.length ? (
        <section>
          <h3 className="mb-2 font-display text-2xl">{t('upgrade.history')}</h3>
          <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
            {orders.data.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {o.plan.name} · {new Date(o.createdAt).toLocaleDateString('en-IN')}
                </span>
                <span className="flex items-center gap-2">
                  {inr(o.amountMinor)}
                  <Badge tone={o.status === 'PAID' ? 'success' : o.status === 'FAILED' ? 'danger' : 'neutral'}>{o.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
