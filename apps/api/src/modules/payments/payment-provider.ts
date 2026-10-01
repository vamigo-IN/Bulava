import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ProviderOrder {
  providerOrderId: string;
}

/** Abstraction so payments are testable and the provider can change. */
export interface PaymentProvider {
  readonly name: string;
  readonly publicKey: string;
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<ProviderOrder>;
  /** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
  verifyPaymentSignature(providerOrderId: string, providerPaymentId: string, signature: string): boolean;
  /** Webhook signature: HMAC_SHA256(raw body, webhook_secret). */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  refund(providerPaymentId: string, amountMinor: number): Promise<{ refundId: string }>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

function safeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Razorpay over its REST API (no SDK needed). */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';

  constructor(
    readonly publicKey: string,
    private readonly secret: string,
    private readonly webhookSecret: string | undefined,
    private readonly baseUrl = 'https://api.razorpay.com/v1',
  ) {}

  private auth(): string {
    return `Basic ${Buffer.from(`${this.publicKey}:${this.secret}`).toString('base64')}`;
  }

  async createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<ProviderOrder> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.auth() },
      body: JSON.stringify({ amount: input.amountMinor, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes }),
    });
    if (!res.ok) throw new Error(`Razorpay order failed with ${res.status}`);
    const body = (await res.json()) as { id?: string };
    if (!body.id) throw new Error('Razorpay order response had no id');
    return { providerOrderId: body.id };
  }

  verifyPaymentSignature(providerOrderId: string, providerPaymentId: string, signature: string): boolean {
    return safeEqualHex(hmacHex(this.secret, `${providerOrderId}|${providerPaymentId}`), signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqualHex(hmacHex(this.webhookSecret, rawBody), signature);
  }

  async refund(providerPaymentId: string, amountMinor: number): Promise<{ refundId: string }> {
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.auth() },
      body: JSON.stringify({ amount: amountMinor }),
    });
    if (!res.ok) throw new Error(`Razorpay refund failed with ${res.status}`);
    const body = (await res.json()) as { id?: string };
    return { refundId: body.id ?? 'unknown' };
  }
}
