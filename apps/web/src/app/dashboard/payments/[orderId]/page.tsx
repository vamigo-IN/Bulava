'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, CheckCircle2, Clock3, Copy, CreditCard, Loader2, Palette, RotateCcw, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MessageKey } from '@bulava/localization';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { lastPaymentFailure, paymentStatusPath, runCheckout, type CheckoutSession } from '@/lib/checkout';
import { errorMessage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Spinner } from '@/components/ui/primitives';

interface OrderStatusView {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  kind: 'PURCHASE' | 'ADMIN_GRANT';
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  plan: { key: string; name: string; interval: 'ONE_TIME' | 'YEAR' };
  couponCode: string | null;
  event: { id: string; title: string } | null;
  payment: { provider: string; reference: string | null; paidAt: string | null } | null;
  validUntil: string | null;
}

/** What the page shows. "confirming" turns into "waiting" when confirmation takes longer than usual. */
type View = 'paid' | 'confirming' | 'waiting' | 'failed' | 'unpaid' | 'refunded' | 'cancelled';

const CONFIRMING_MS = 45_000;

function viewOf(order: OrderStatusView, state: string | null, waitedMs: number): View {
  if (order.status === 'PAID') return 'paid';
  if (order.status === 'REFUNDED') return 'refunded';
  if (order.status === 'CANCELLED') return 'cancelled';
  if (order.status === 'FAILED' || state === 'failed') return 'failed';
  if (state === 'confirming') return waitedMs < CONFIRMING_MS ? 'confirming' : 'waiting';
  return 'unpaid';
}

const LOOK: Record<View, { icon: LucideIcon; tile: string; glow: string; spin?: boolean }> = {
  paid: { icon: CheckCircle2, tile: 'from-emerald-500 via-emerald-600 to-emerald-800', glow: 'rgba(16,185,129,0.22)' },
  confirming: { icon: Loader2, tile: 'from-[#a83a47] via-[#7a1d27] to-[#5b0e1b]', glow: 'rgba(233,200,127,0.35)', spin: true },
  waiting: { icon: Clock3, tile: 'from-amber-400 via-amber-500 to-amber-700', glow: 'rgba(245,158,11,0.22)' },
  failed: { icon: XCircle, tile: 'from-red-500 via-red-600 to-red-800', glow: 'rgba(239,68,68,0.18)' },
  unpaid: { icon: CreditCard, tile: 'from-[#a83a47] via-[#7a1d27] to-[#5b0e1b]', glow: 'rgba(233,200,127,0.3)' },
  refunded: { icon: RotateCcw, tile: 'from-stone-500 via-stone-600 to-stone-800', glow: 'rgba(120,113,108,0.18)' },
  cancelled: { icon: Ban, tile: 'from-stone-500 via-stone-600 to-stone-800', glow: 'rgba(120,113,108,0.18)' },
};

type StepState = 'done' | 'current' | 'error' | 'todo';

/** Order placed → payment → confirmation → plan active. */
function steps(view: View): StepState[] {
  switch (view) {
    case 'paid':
    case 'refunded':
      return ['done', 'done', 'done', 'done'];
    case 'confirming':
    case 'waiting':
      return ['done', 'done', 'current', 'todo'];
    case 'failed':
      return ['done', 'error', 'todo', 'todo'];
    case 'cancelled':
      return ['done', 'error', 'todo', 'todo'];
    default:
      return ['done', 'current', 'todo', 'todo'];
  }
}

const inr = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Where every checkout ends: a thank-you once the payment is confirmed, a live
 * "confirming" state that keeps checking while the bank and Razorpay settle
 * (the webhook can arrive after the browser), and a retry that reopens the same
 * order after a failure, so nobody pays twice.
 */
export default function PaymentStatusPage() {
  const t = useT();
  const router = useRouter();
  const client = useQueryClient();
  const { orderId } = useParams<{ orderId: string }>();
  const params = useSearchParams();
  const state = params.get('state');
  const rawTemplate = params.get('template');
  const template = rawTemplate && /^[a-z0-9-]{1,80}$/.test(rawTemplate) ? rawTemplate : null;

  // When the current "confirming" wait began (a retry starts a new one).
  const since = useRef(Date.now());
  useEffect(() => {
    since.current = Date.now();
  }, [state]);
  const [, tick] = useState(0);

  const order = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => apiGet<OrderStatusView>(`/orders/${orderId}`),
    // Keep checking while the payment is open: every 3 s at first, then every 10 s.
    refetchInterval: (q) => (q.state.data?.status === 'CREATED' ? (Date.now() - since.current < CONFIRMING_MS ? 3_000 : 10_000) : false),
  });

  // Re-render once when a long confirmation should turn into "still waiting".
  useEffect(() => {
    if (state !== 'confirming') return;
    const timer = window.setTimeout(() => tick((n) => n + 1), CONFIRMING_MS + 500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateApplied, setTemplateApplied] = useState(false);
  const settled = useRef(false);
  const data = order.data;

  // Once paid: refresh the event's data everywhere, and apply the template chosen before upgrading.
  useEffect(() => {
    if (data?.status !== 'PAID' || settled.current) return;
    settled.current = true;
    if (data.event) {
      void client.invalidateQueries({ queryKey: ['events', data.event.id] });
      if (template) {
        void apiPut(`/events/${data.event.id}/design/website`, { templateKey: template })
          .then(() => setTemplateApplied(true))
          .catch(() => undefined);
      }
    }
  }, [data, client, template]);

  if (order.isPending) return <Spinner label={t('common.loading')} />;
  if (order.isError || !data) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Alert>{errorMessage(t, order.error)}</Alert>
      </div>
    );
  }

  const view = viewOf(data, state, Date.now() - since.current);
  const look = LOOK[view];
  const Icon = look.icon;
  const failure = view === 'failed' ? lastPaymentFailure(data.id) : null;

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await apiPost<CheckoutSession>(`/orders/${data.id}/checkout`);
      const outcome = session.status === 'PAID' ? 'paid' : await runCheckout(session, { unavailable: t('upgrade.unavailable') });
      if (outcome !== 'dismissed') router.replace(paymentStatusPath(data.id, outcome === 'paid' ? undefined : outcome, template));
      await order.refetch();
    } catch (err) {
      setError(err instanceof Error && !('code' in err) ? err.message : errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const plansHref = data.event ? `/dashboard/events/${data.event.id}/upgrade` : '/pricing';
  const stepLabels: MessageKey[] = ['payment.step.placed', 'payment.step.payment', 'payment.step.confirmation', 'payment.step.active'];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2 sm:py-6">
      {/* What happened, in one glance. */}
      <section className="clay relative overflow-hidden rounded-[2rem] px-6 py-10 text-center sm:px-12 sm:py-12" aria-live="polite">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 h-72" style={{ background: `radial-gradient(closest-side, ${look.glow}, transparent)` }} />
        <div className="relative mx-auto grid w-fit place-items-center">
          {view === 'confirming' ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-[1.6rem] bg-gold-300/40" /> : null}
          <span
            className={cn(
              'relative grid size-20 place-items-center rounded-[1.6rem] bg-gradient-to-br text-white shadow-[inset_0_2px_2px_rgba(255,255,255,0.35),inset_0_-8px_12px_-4px_rgba(0,0,0,0.3),4px_12px_24px_-8px_rgba(60,10,20,0.45)]',
              look.tile,
              view === 'paid' && 'animate-pop-in',
            )}
          >
            <Icon aria-hidden className={cn('size-10', look.spin && 'animate-spin')} strokeWidth={2.2} />
          </span>
        </div>
        <p className="eyebrow mt-7 justify-center text-brand-700">{t(`payment.eyebrow.${view}`)}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-[-0.015em] text-balance sm:text-5xl">{t(`payment.title.${view}`)}</h1>
        <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-pretty text-stone-600">
          {t(`payment.body.${view}`, { plan: data.plan.name, event: data.event?.title ?? t('payment.yourAccount'), amount: inr(data.amountMinor, data.currency) })}
        </p>
        {failure ? <p className="mx-auto mt-3 max-w-xl rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset">{t('payment.bankSaid', { reason: failure })}</p> : null}
        {templateApplied ? (
          <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-emerald-800 shadow-clay-sm">
            <Palette aria-hidden className="size-4" /> {t('payment.templateApplied')}
          </p>
        ) : null}

        {error ? (
          <div className="mx-auto mt-5 max-w-xl text-left">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {view === 'paid' && data.event ? (
            <>
              <Link href={`/dashboard/events/${data.event.id}`} className="btn-3d min-h-12 rounded-2xl px-6">
                {t('payment.action.openEvent')}
              </Link>
              <Link href={`/dashboard/events/${data.event.id}/design`} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6">
                {t('payment.action.design')}
              </Link>
            </>
          ) : null}
          {view === 'paid' && !data.event ? (
            <Link href="/dashboard" className="btn-3d min-h-12 rounded-2xl px-6">
              {t('payment.action.dashboard')}
            </Link>
          ) : null}
          {view === 'failed' || view === 'unpaid' ? (
            <>
              <button type="button" onClick={() => void retry()} disabled={busy} className="btn-3d min-h-12 rounded-2xl px-6">
                {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                {view === 'failed' ? t('payment.action.retry') : t('payment.action.complete', { amount: inr(data.amountMinor, data.currency) })}
              </button>
              <Link href={plansHref} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6">
                {t('payment.action.plans')}
              </Link>
            </>
          ) : null}
          {view === 'confirming' || view === 'waiting' ? (
            <button type="button" onClick={() => void order.refetch()} disabled={order.isFetching} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6">
              {order.isFetching ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
              {t('payment.action.check')}
            </button>
          ) : null}
          {view === 'refunded' || view === 'cancelled' ? (
            <Link href={plansHref} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6">
              {t('payment.action.plans')}
            </Link>
          ) : null}
        </div>
        {view === 'confirming' || view === 'waiting' ? <p className="mt-5 text-sm text-stone-500">{t('payment.dontPayTwice')}</p> : null}
      </section>

      {/* Where the order is, step by step. */}
      <section aria-label={t('payment.progress')} className="clay rounded-[1.75rem] px-5 py-6 sm:px-8">
        <ol className="grid grid-cols-4 gap-2">
          {steps(view).map((s, i) => (
            <li key={stepLabels[i]} className="relative flex flex-col items-center text-center">
              {i > 0 ? (
                <span aria-hidden="true" className={cn('absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 rounded-full', s === 'done' || s === 'current' ? 'bg-gradient-to-r from-gold-300 to-gold-500' : 'bg-stone-200')} />
              ) : null}
              <span
                className={cn(
                  'relative grid size-8 place-items-center rounded-full text-sm font-bold',
                  s === 'done' && 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_3px_8px_-2px_rgba(4,120,87,0.5)]',
                  s === 'current' && 'bg-surface text-brand-700 shadow-clay-sm ring-2 ring-gold-300',
                  s === 'error' && 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_3px_8px_-2px_rgba(185,28,28,0.5)]',
                  s === 'todo' && 'bg-stone-100 text-stone-500 ring-1 ring-stone-200 ring-inset',
                )}
              >
                {s === 'done' ? <Check aria-hidden className="size-4" strokeWidth={3} /> : s === 'error' ? <XCircle aria-hidden className="size-4" /> : s === 'current' && (view === 'confirming' || view === 'waiting') ? <Loader2 aria-hidden className="size-4 animate-spin" /> : i + 1}
              </span>
              <span className={cn('mt-2 text-xs font-medium sm:text-sm', s === 'todo' ? 'text-stone-500' : 'text-ink')}>{t(stepLabels[i]!)}</span>
              <span className="sr-only">{t(`payment.stepState.${s}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* The receipt. */}
      <section className="clay rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="font-display text-2xl">{t('payment.summary')}</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Row label={t('payment.field.plan')}>
            {data.plan.name} <span className="text-stone-500">· {t(data.plan.interval === 'YEAR' ? 'payment.yearly' : 'payment.oneEvent')}</span>
          </Row>
          <Row label={t('payment.field.for')}>
            {data.event ? (
              <Link href={`/dashboard/events/${data.event.id}`} className="font-medium text-brand-700 hover:underline">
                {data.event.title}
              </Link>
            ) : (
              t('payment.yourAccount')
            )}
          </Row>
          <Row label={t('payment.field.amount')}>
            <span className="font-display text-xl text-ink">{inr(data.amountMinor, data.currency)}</span> <span className="text-stone-500">{t('payment.inclGst')}</span>
            {data.couponCode ? <span className="block text-xs text-emerald-700">{t('payment.coupon', { code: data.couponCode })}</span> : null}
          </Row>
          <Row label={t('payment.field.placed')}>{when(data.createdAt)}</Row>
          {data.payment?.paidAt ? <Row label={t('payment.field.paid')}>{when(data.payment.paidAt)}</Row> : null}
          {data.validUntil && data.plan.interval === 'YEAR' ? <Row label={t('payment.field.validUntil')}>{new Date(data.validUntil).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</Row> : null}
          <Row label={t('payment.field.orderId')}>
            <CopyText value={data.id} />
          </Row>
          {data.payment?.reference ? (
            <Row label={t('payment.field.paymentId')}>
              <CopyText value={data.payment.reference} />
            </Row>
          ) : null}
        </dl>
      </section>

      <p className="flex items-start gap-2.5 px-2 text-sm leading-relaxed text-stone-600">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-600" />
        <span>
          {t('payment.help')}{' '}
          <Link href="/contact" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
            {t('payment.contact')}
          </Link>
        </span>
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

function CopyText({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <code className="truncate rounded-lg bg-sand/70 px-2 py-1 font-mono text-xs text-stone-700">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-sand hover:text-brand-700"
        aria-label={copied ? t('common.copied') : t('common.copy')}
      >
        {copied ? <Check aria-hidden className="size-4 text-emerald-700" /> : <Copy aria-hidden className="size-4" />}
      </button>
    </span>
  );
}
