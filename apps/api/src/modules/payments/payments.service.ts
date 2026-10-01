import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Order, PricingPlan, Prisma } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import type { CreateOrderInput, VerifyPaymentInput } from '@bulava/validation';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { PAYMENT_PROVIDER, RazorpayProvider, type PaymentProvider } from './payment-provider';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
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

  /** Per-event plans (ONE_TIME) attach to an event; yearly plans attach to the user. */
  async createOrder(user: AuthUser, access: EventAccessContext | null, input: CreateOrderInput, meta: RequestMeta) {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key: input.planKey } });
    if (!plan || !plan.active || plan.priceMinor <= 0) throw new AppError('NOT_FOUND', 'Plan not found.');
    if (access && plan.interval !== 'ONE_TIME') throw new AppError('BAD_REQUEST', 'This plan is not purchased per event.');
    if (!access && plan.interval === 'ONE_TIME') throw new AppError('BAD_REQUEST', 'Choose the event to upgrade.');

    const { amountMinor, couponId } = await this.priceWithCoupon(plan, input.couponCode);
    const order = await this.prisma.order.create({
      data: { userId: user.id, eventId: access?.eventId ?? null, planId: plan.id, couponId, amountMinor, currency: plan.currency },
    });
    this.analytics.track('checkout_started', { eventId: access?.eventId, userId: user.id }, { plan: plan.key, amountMinor });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'order.created', targetType: 'Order', targetId: order.id, eventId: access?.eventId ?? null, metadata: { plan: plan.key, amountMinor }, meta });

    if (amountMinor === 0) {
      // Fully discounted: no gateway involved.
      await this.finalize(order.id, { provider: 'COUPON', providerPaymentId: `coupon-${order.id}`, amountMinor: 0, raw: null });
      return { orderId: order.id, status: 'PAID' as const, amountMinor: 0 };
    }

    const provider = await this.requireProvider(true);
    try {
      const providerOrder = await provider.createOrder({
        amountMinor,
        currency: plan.currency,
        receipt: order.id,
        notes: { orderId: order.id, plan: plan.key, ...(access ? { eventId: access.eventId } : {}) },
      });
      await this.prisma.order.update({ where: { id: order.id }, data: { providerOrderId: providerOrder.providerOrderId } });
      const profile = await this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
      return {
        orderId: order.id,
        status: 'CREATED' as const,
        amountMinor,
        currency: plan.currency,
        planName: plan.name,
        keyId: provider.publicKey,
        providerOrderId: providerOrder.providerOrderId,
        prefill: { name: profile?.name ?? '', email: profile?.email ?? '', contact: profile?.phone ?? '' },
      };
    } catch (error) {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      this.logger.error({ err: error }, 'Payment order creation failed');
      throw new AppError('PAYMENTS_UNAVAILABLE', 'We could not start the payment. Please try again.');
    }
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
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } } };
    };
    const payment = body.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) return { ok: true };
    const order = await this.prisma.order.findUnique({ where: { providerOrderId: payment.order_id } });
    if (!order) return { ok: true };

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
