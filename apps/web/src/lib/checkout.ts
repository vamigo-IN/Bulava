import { apiPost } from './api';
import { track } from './track';

/** What the API returns to start (or resume) a payment: POST /events/:id/orders, POST /orders/:id/checkout. */
export interface CheckoutSession {
  orderId: string;
  status: 'CREATED' | 'PAID';
  amountMinor: number;
  currency?: string;
  planName?: string;
  keyId?: string;
  providerOrderId?: string;
  prefill?: { name: string; email: string; contact: string };
}

/** How a checkout ended, from the buyer's side. Only the API decides that a payment succeeded. */
export type CheckoutOutcome = 'paid' | 'confirming' | 'failed' | 'dismissed';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
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

const failureKey = (orderId: string) => `bulava_payment_failure_${orderId}`;

/** The bank's reason for the last failed attempt, for the status page (this tab only). */
export function lastPaymentFailure(orderId: string): string | null {
  try {
    return sessionStorage.getItem(failureKey(orderId));
  } catch {
    return null;
  }
}

/**
 * The payment status page. `state` carries what the browser saw: "confirming"
 * when Razorpay reported success but our confirmation didn't finish yet, "failed"
 * when the buyer closed checkout after a failed attempt. `template` is applied
 * to the event once the payment is confirmed (pricing → template → upgrade).
 */
export function paymentStatusPath(orderId: string, state?: 'confirming' | 'failed', template?: string | null): string {
  const query = new URLSearchParams({ ...(state ? { state } : {}), ...(template ? { template } : {}) }).toString();
  return `/dashboard/payments/${orderId}${query ? `?${query}` : ''}`;
}

/**
 * Opens Razorpay Checkout and settles once the buyer is done with it. A
 * successful payment is verified by the API right away; if that call fails, the
 * outcome is "confirming" and the webhook finishes the job. Razorpay lets the
 * buyer retry inside the window after a failure, so "failed" is reported only
 * when they close it without a successful attempt.
 */
export async function runCheckout(session: CheckoutSession, options: { unavailable: string; siteName?: string }): Promise<CheckoutOutcome> {
  if (!(await loadCheckout()) || !window.Razorpay) throw new Error(options.unavailable);
  return new Promise<CheckoutOutcome>((resolve) => {
    let failed = false;
    const rzp = new window.Razorpay!({
      key: session.keyId,
      order_id: session.providerOrderId,
      amount: session.amountMinor,
      currency: session.currency,
      name: options.siteName ?? 'Bulava',
      description: session.planName,
      prefill: session.prefill,
      theme: { color: '#5b0e1b' },
      modal: { ondismiss: () => resolve(failed ? 'failed' : 'dismissed') },
      handler: async (res: RazorpayResponse) => {
        try {
          await apiPost(`/orders/${session.orderId}/verify`, {
            razorpayOrderId: res.razorpay_order_id,
            razorpayPaymentId: res.razorpay_payment_id,
            razorpaySignature: res.razorpay_signature,
          });
          resolve('paid');
        } catch {
          resolve('confirming');
        }
      },
    });
    rzp.on('payment.failed', (e) => {
      failed = true;
      const reason = (e as RazorpayFailure)?.error?.description;
      try {
        if (reason) sessionStorage.setItem(failureKey(session.orderId), reason.slice(0, 300));
      } catch {
        // Private windows may refuse storage; the page then shows a general reason.
      }
      track('payment_failed', { order: session.orderId });
    });
    rzp.open();
  });
}
