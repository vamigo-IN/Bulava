import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Order, PricingPlan, Prisma } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import { FEATURE_KEYS, type CreateOrderInput, type OrderQuoteInput, type VerifyPaymentInput } from '@bulava/validation';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertVerifiedAccount } from '../users/account-gate';
import { ConsentService } from '../users/consent.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { PAYMENT_PROVIDER, RazorpayProvider, type PaymentProvider } from './payment-provider';

/** A payment entity from a Razorpay webhook. */
export interface GatewayPayment {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  error_description?: string;
}

/** Settles a webhook for a gateway order that is not a plan purchase; true when it was its own. */
export type OtherPaymentHandler = (event: string | undefined, payment: GatewayPayment & { id: string; order_id: string }, raw: Prisma.InputJsonValue) => Promise<boolean>;

/**
 * Plan purchases. The browser never decides that a payment succeeded:
 * entitlements are granted only after a verified Razorpay signature
 * (checkout callback) or a verified webhook. Granting is idempotent, so the
 * callback and the webhook can race safely.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private built: { fingerprint: string; provider: PaymentProvider } | null = null;
  /** Other purchases over the same gateway and webhook (digital cards register theirs). */
  private readonly otherPayments: OtherPaymentHandler[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
    private readonly consents: ConsentService,
    private readonly entitlements: EntitlementsService,
    /** Set by tests only; production reads Razorpay from the Super Admin's settings. */
    @Optional() @Inject(PAYMENT_PROVIDER) private readonly override: PaymentProvider | null,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
  ) {}

  /**
   * Razorpay with the keys saved in the admin console (or the environment
   * until then). `forCheckout` also requires payments to be switched on;
   * confirming, webhooks and refunds keep working for existing orders.
   */
  private async requireProvider(forCheckout = false): Promise<PaymentProvider> {
    if (this.override) return this.override;
    const s = await this.settings.get('payments');
    const secret = s.secrets.keySecret;
    if ((forCheckout && !s.value.enabled) || !s.value.keyId || !secret) throw new AppError('PAYMENTS_UNAVAILABLE', 'Online payments are not configured yet.');
    const fingerprint = createHash('sha256').update(`${s.value.keyId}\n${secret}\n${s.secrets.webhookSecret ?? ''}`).digest('hex');
    if (this.built?.fingerprint !== fingerprint) this.built = { fingerprint, provider: new RazorpayProvider(s.value.keyId, secret, s.secrets.webhookSecret) };
    return this.built.provider;
  }

  /** The gateway, for other purchases (digital cards): `forCheckout` also requires payments to be switched on. */
  gateway(forCheckout = false): Promise<PaymentProvider> {
    return this.requireProvider(forCheckout);
  }

  /** Whether a checkout can start now (payments on, keys saved). */
  async checkoutReady(): Promise<boolean> {
    return this.requireProvider(true).then(
      () => true,
      () => false,
    );
  }

  /** Webhooks for gateway orders that are not plan purchases go to the handler that owns them. */
  onOtherPayment(handler: OtherPaymentHandler): void {
    this.otherPayments.push(handler);
  }

  private async priceWithCoupon(plan: PricingPlan, couponCode?: string) {
    if (!couponCode) return { amountMinor: plan.priceMinor, couponId: null as string | null };
    const now = new Date();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode } });
    const valid =
      coupon?.active &&
      (!coupon.validFrom || coupon.validFrom <= now) &&
      (!coupon.validUntil || coupon.validUntil > now) &&
      (coupon.maxRedemptions === null || coupon.redemptions < coupon.maxRedemptions);
    if (!coupon || !valid) throw new AppError('COUPON_INVALID', 'This coupon code is not valid.');
    const off = coupon.percentOff ? Math.round((plan.priceMinor * coupon.percentOff) / 100) : (coupon.amountOffMinor ?? 0);
    return { amountMinor: Math.max(0, plan.priceMinor - off), couponId: coupon.id };
  }

  /**
   * Does the account already have what this one-time plan unlocks? Compared by
   * the design tier it gives (templates.maxTier), from any plan on the account
   * (one-time or yearly). A plan without a tier is never "already there".
   */
  private async accountHas(userId: string, plan: PricingPlan & { features: Array<{ featureKey: string; limit: number | null }> }): Promise<boolean> {
    if (plan.interval !== 'ONE_TIME') return false;
    const row = plan.features.find((f) => f.featureKey === FEATURE_KEYS.TEMPLATES_MAX_TIER);
    if (!row) return false;
    const own = (await this.entitlements.forUser(userId)).get(FEATURE_KEYS.TEMPLATES_MAX_TIER);
    if (!own || own.source === 'FREE_PLAN' || !own.enabled) return false;
    return (own.limit ?? 2) >= (row.limit ?? 2);
  }

  /**
   * The checkout page's price breakdown: a plan's price, a coupon's discount
   * and the total, before anything is bought, and whether the account has the
   * plan already (`included`). A code that is not valid answers COUPON_INVALID,
   * so the page can say so beside the field.
   */
  async quote(user: AuthUser, input: OrderQuoteInput) {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key: input.planKey }, include: { features: true } });
    if (!plan || !plan.active || plan.priceMinor <= 0) throw new AppError('NOT_FOUND', 'Plan not found.');
    const [{ amountMinor }, included] = await Promise.all([this.priceWithCoupon(plan, input.couponCode || undefined), this.accountHas(user.id, plan)]);
    return {
      plan: { key: plan.key, name: plan.name, description: plan.description, interval: plan.interval },
      couponCode: input.couponCode || null,
      priceMinor: plan.priceMinor,
      discountMinor: plan.priceMinor - amountMinor,
      totalMinor: amountMinor,
      currency: plan.currency,
      included,
    };
  }

  /**
   * Plans belong to the account (ADR-053): `POST /orders` buys a one-time or a
   * yearly plan, and every event of the buyer's gets it. `POST /events/:id/orders`
   * still buys a one-time plan for that event alone (API clients; older orders).
   */
  async createOrder(user: AuthUser, access: EventAccessContext | null, input: CreateOrderInput, meta: RequestMeta) {
    // Receipts and refunds need a reachable account, not a number alone.
    await assertVerifiedAccount(this.prisma, user.id);
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key: input.planKey }, include: { features: true } });
    if (!plan || !plan.active || plan.priceMinor <= 0) throw new AppError('NOT_FOUND', 'Plan not found.');
    if (access && plan.interval !== 'ONE_TIME') throw new AppError('BAD_REQUEST', 'This plan is not purchased per event.');
    // Never sold twice: a one-time plan the account already has (or a higher one).
    if (!access && (await this.accountHas(user.id, plan))) throw new AppError('PLAN_ALREADY_ACTIVE', 'Your account already has this plan.');

    const { amountMinor, couponId } = await this.priceWithCoupon(plan, input.couponCode);
    const versions = await this.consents.versions(['terms', 'refund']);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { userId: user.id, eventId: access?.eventId ?? null, planId: plan.id, couponId, amountMinor, currency: plan.currency, termsAcceptedAt: new Date() },
      });
      // The buyer's ticked box (an explicit action, as the e-commerce rules require), kept with the order.
      await tx.consent.create({ data: { userId: user.id, kind: 'purchase_terms', granted: true, version: `${versions.terms};${versions.refund}`, source: `order:${created.id}` } });
      return created;
    });
    this.analytics.track('checkout_started', { eventId: access?.eventId, userId: user.id }, { plan: plan.key, amountMinor });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'order.created', targetType: 'Order', targetId: order.id, eventId: access?.eventId ?? null, metadata: { plan: plan.key, amountMinor }, meta });

    if (amountMinor === 0) {
      // Fully discounted: no gateway involved.
      await this.finalize(order.id, { provider: 'COUPON', providerPaymentId: `coupon-${order.id}`, amountMinor: 0, raw: null });
      return { orderId: order.id, status: 'PAID' as const, amountMinor: 0 };
    }

    return this.checkoutSession(user, { ...order, plan });
  }

  /**
   * What the browser needs to open Razorpay Checkout for an order, creating the
   * gateway order the first time. Razorpay accepts several attempts on one
   * order, so a retry reuses it and can never be charged twice.
   */
  private async checkoutSession(user: AuthUser, order: Order & { plan: PricingPlan }) {
    const provider = await this.requireProvider(true);
    try {
      let providerOrderId = order.providerOrderId;
      if (!providerOrderId) {
        const created = await provider.createOrder({
          amountMinor: order.amountMinor,
          currency: order.currency,
          receipt: order.id,
          notes: { orderId: order.id, plan: order.plan.key, ...(order.eventId ? { eventId: order.eventId } : {}) },
        });
        providerOrderId = created.providerOrderId;
        await this.prisma.order.update({ where: { id: order.id }, data: { providerOrderId } });
      }
      const profile = await this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
      return {
        orderId: order.id,
        status: 'CREATED' as const,
        amountMinor: order.amountMinor,
        currency: order.currency,
        planName: order.plan.name,
        keyId: provider.publicKey,
        providerOrderId,
        prefill: { name: profile?.name ?? '', email: profile?.email ?? '', contact: profile?.phone ?? '' },
      };
    } catch (error) {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      this.logger.error({ err: error }, 'Payment order creation failed');
      throw new AppError('PAYMENTS_UNAVAILABLE', 'We could not start the payment. Please try again.');
    }
  }

  /**
   * The payment status page: one of the signed-in user's own orders, with what
   * it bought and the payment that settled it.
   */
  async orderStatus(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: {
        plan: { select: { key: true, name: true, interval: true } },
        coupon: { select: { code: true } },
        payments: { where: { status: { in: ['CAPTURED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true, providerPaymentId: true, verifiedAt: true } },
      },
    });
    if (!order) throw AppError.notFound('Order');
    const [event, entitlement] = await Promise.all([
      order.eventId ? this.prisma.event.findFirst({ where: { id: order.eventId, deletedAt: null }, select: { id: true, title: true } }) : null,
      order.status === 'PAID' ? this.prisma.entitlement.findFirst({ where: { sourceType: 'ORDER', sourceId: order.id }, select: { validUntil: true } }) : null,
    ]);
    const payment = order.payments[0];
    return {
      id: order.id,
      status: order.status,
      kind: order.kind,
      amountMinor: order.amountMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      plan: order.plan,
      couponCode: order.coupon?.code ?? null,
      event,
      payment: payment ? { provider: payment.provider, reference: payment.provider === 'RAZORPAY' ? payment.providerPaymentId : null, paidAt: payment.verifiedAt } : null,
      /** Yearly plans: when the access ends. */
      validUntil: entitlement?.validUntil ?? null,
    };
  }

  /** "Try again" on the status page: reopens checkout for the same order (failed or never completed). */
  async resumeCheckout(user: AuthUser, orderId: string, meta: RequestMeta) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, include: { plan: true } });
    if (!order) throw AppError.notFound('Order');
    if (order.status === 'PAID') return { orderId: order.id, status: 'PAID' as const, amountMinor: order.amountMinor };
    if (order.kind !== 'PURCHASE' || (order.status !== 'CREATED' && order.status !== 'FAILED') || !order.plan.active) {
      throw new AppError('ORDER_NOT_PAYABLE', 'This order can no longer be paid. Choose a plan to start again.');
    }
    if (order.eventId && !(await this.prisma.event.findFirst({ where: { id: order.eventId, deletedAt: null }, select: { id: true } }))) {
      throw new AppError('ORDER_NOT_PAYABLE', 'The event for this order was deleted.');
    }
    if (order.status === 'FAILED') await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CREATED' } });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'order.checkout_resumed', targetType: 'Order', targetId: order.id, eventId: order.eventId, metadata: { from: order.status }, meta });
    return this.checkoutSession(user, order);
  }

  /** Checkout callback. Signature is verified server-side before anything is granted. */
  async verifyCheckout(user: AuthUser, orderId: string, input: VerifyPaymentInput) {
    const provider = await this.requireProvider();
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!order || order.providerOrderId !== input.razorpayOrderId) throw AppError.notFound('Order');
    if (!provider.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
      this.analytics.track('payment_failed', { eventId: order.eventId, userId: user.id }, { reason: 'signature' });
      throw new AppError('PAYMENT_VERIFICATION_FAILED', 'We could not verify this payment.');
    }
    await this.finalize(order.id, { provider: provider.name, providerPaymentId: input.razorpayPaymentId, amountMinor: order.amountMinor, raw: null });
    return { orderId: order.id, status: 'PAID' as const };
  }

  /** Razorpay webhook: payment.captured, order.paid, payment.failed. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ ok: true }> {
    const provider = await this.requireProvider();
    if (!rawBody || !signature || !provider.verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('PAYMENT_VERIFICATION_FAILED', 'Invalid webhook signature.');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { payment?: { entity?: GatewayPayment } };
    };
    const payment = body.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) return { ok: true };
    const order = await this.prisma.order.findUnique({ where: { providerOrderId: payment.order_id } });
    if (!order) {
      const known = { ...payment, id: payment.id, order_id: payment.order_id };
      for (const handler of this.otherPayments) if (await handler(body.event, known, body as Prisma.InputJsonValue)) break;
      return { ok: true };
    }

    if (body.event === 'payment.captured' || body.event === 'order.paid') {
      if (payment.amount !== undefined && payment.amount < order.amountMinor) {
        throw new AppError('PAYMENT_VERIFICATION_FAILED', 'Amount mismatch.');
      }
      await this.finalize(order.id, { provider: provider.name, providerPaymentId: payment.id, amountMinor: payment.amount ?? order.amountMinor, raw: body as Prisma.InputJsonValue });
    } else if (body.event === 'payment.failed' && order.status === 'CREATED') {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      this.analytics.track('payment_failed', { eventId: order.eventId, userId: order.userId }, { reason: 'gateway' });
    }
    return { ok: true };
  }

  /** Idempotent: records the payment, marks the order paid and grants entitlements exactly once. */
  async finalize(orderId: string, payment: { provider: string; providerPaymentId: string; amountMinor: number; raw: Prisma.InputJsonValue | null }) {
    const granted = await this.prisma.$transaction(async (tx) => {
      // Row lock so concurrent callback + webhook serialize here.
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { plan: { include: { features: true } } } });
      if (order.status === 'PAID') return null;
      await tx.payment.upsert({
        where: { providerPaymentId: payment.providerPaymentId },
        create: { orderId, provider: payment.provider, providerPaymentId: payment.providerPaymentId, status: 'CAPTURED', amountMinor: payment.amountMinor, rawWebhook: payment.raw ?? undefined, verifiedAt: new Date() },
        update: { status: 'CAPTURED', verifiedAt: new Date() },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
      if (order.couponId) await tx.coupon.update({ where: { id: order.couponId }, data: { redemptions: { increment: 1 } } });
      await this.grant(tx, order);
      await this.audit.record(
        { actorType: 'SYSTEM', action: 'payment.captured', targetType: 'Order', targetId: orderId, eventId: order.eventId, metadata: { plan: order.plan.key, amountMinor: payment.amountMinor, provider: payment.provider } },
        tx,
      );
      return order;
    });
    if (granted) {
      this.analytics.track('payment_success', { eventId: granted.eventId, userId: granted.userId }, { plan: granted.plan.key, amountMinor: payment.amountMinor });
      await this.notifications.notify({
        type: 'PAYMENT',
        channel: 'IN_APP',
        userId: granted.userId,
        eventId: granted.eventId,
        payload: { orderId, plan: granted.plan.name, amountMinor: payment.amountMinor },
      });
    }
  }

  /** Entitlements from the order's plan, exactly once (purchases and admin grants). */
  async grant(tx: Tx, order: Order & { plan: PricingPlan & { features: Array<{ featureKey: string; enabled: boolean; limit: number | null }> } }) {
    const existing = await tx.entitlement.count({ where: { sourceType: 'ORDER', sourceId: order.id } });
    if (existing) return;
    const validUntil = order.plan.interval === 'YEAR' ? new Date(Date.now() + 365 * 86_400_000) : null;
    await tx.entitlement.createMany({
      data: order.plan.features.map((f) => ({
        userId: order.userId,
        eventId: order.eventId,
        featureKey: f.featureKey,
        enabled: f.enabled,
        limit: f.limit,
        sourceType: 'ORDER',
        sourceId: order.id,
        validUntil,
      })),
    });
  }

  /** Payment history: every order of the signed-in user, newest first (purchases and complimentary upgrades). */
  async listForUser(user: AuthUser) {
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        plan: { select: { key: true, name: true, interval: true } },
        coupon: { select: { code: true } },
        payments: { where: { status: { in: ['CAPTURED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true, providerPaymentId: true, verifiedAt: true } },
      },
    });
    const eventIds = [...new Set(orders.map((o) => o.eventId).filter((id): id is string => !!id))];
    const events = eventIds.length ? await this.prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true, deletedAt: true } }) : [];
    return orders.map((o) => {
      const event = events.find((e) => e.id === o.eventId);
      const payment = o.payments[0];
      return {
        id: o.id,
        status: o.status,
        kind: o.kind,
        amountMinor: o.amountMinor,
        currency: o.currency,
        createdAt: o.createdAt,
        plan: o.plan,
        couponCode: o.coupon?.code ?? null,
        // A deleted event keeps its title in the history; the link only works while it exists.
        event: event ? { id: event.id, title: event.title, available: !event.deletedAt } : null,
        payment: payment ? { provider: payment.provider, reference: payment.provider === 'RAZORPAY' ? payment.providerPaymentId : null, paidAt: payment.verifiedAt } : null,
      };
    });
  }

  async listForEvent(access: EventAccessContext) {
    return this.prisma.order.findMany({
      where: { eventId: access.eventId },
      include: { plan: { select: { key: true, name: true } }, payments: { select: { status: true, amountMinor: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin refund: refunds at the gateway (when configured) and revokes the entitlements. */
  async refund(adminId: string, orderId: string, meta: RequestMeta) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order || order.status !== 'PAID') throw AppError.notFound('Paid order');
    const payment = order.payments.find((p) => p.status === 'CAPTURED');
    if (order.kind === 'ADMIN_GRANT') throw new AppError('BAD_REQUEST', 'This is a complimentary upgrade: revoke it instead of refunding.');
    // Only gateway payments go back through the gateway (coupon and zero-amount orders have nothing to refund).
    if (payment && payment.provider === 'RAZORPAY' && payment.amountMinor > 0) await (await this.requireProvider()).refund(payment.providerPaymentId, payment.amountMinor);
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      if (payment) await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      await tx.entitlement.updateMany({ where: { sourceType: 'ORDER', sourceId: orderId }, data: { validUntil: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'payment.refunded', targetType: 'Order', targetId: orderId, eventId: order.eventId, meta }, tx);
    });
    return { refunded: true };
  }
}
