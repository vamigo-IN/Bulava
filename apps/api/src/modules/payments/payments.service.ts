import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { planOfferToken, verifyPlanOfferToken } from '@bulava/auth';
import { ADDON_SOURCE, whatsappMessagesUsed, type Order, type PricingPlan, type Prisma } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import { ADDON_MAX_QUANTITY, FEATURE_KEYS, type CreateOrderInput, type OrderQuoteInput, type PlanOfferInput, type VerifyPaymentInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { ContactService } from '../contact/contact.service';
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

type PlanWithFeatures = PricingPlan & { features: Array<{ featureKey: string; enabled: boolean; limit: number | null }> };

/** What buying a plan or an add-on means for an account, before a coupon (ADR-062). */
interface Purchase {
  plan: PlanWithFeatures;
  /** How many of a stackable add-on (one of anything else). */
  quantity: number;
  /** The account's plan, when a bigger one is unlocked: its price comes off. */
  upgradeFrom: PricingPlan | null;
  creditMinor: number;
  subtotalMinor: number;
  /** The account has it already (the plan or a bigger one; an add-on bought once). */
  included: boolean;
  /** An add-on for one event's own plan (null: the account's). */
  eventId: string | null;
}

/** A plan order in force, with what kind of order it was (bought, or given by the team). */
interface PlanInForce {
  orderId: string;
  /** PURCHASE or ADMIN_GRANT. */
  kind: string;
  eventId: string | null;
  plan: PricingPlan;
}

/** Entitlements from orders: plans (ORDER) and add-ons (ADDON). */
const ORDER_SOURCES = ['ORDER', ADDON_SOURCE];

/** Services the team carries out after a purchase: the inbox hears about them. */
const SERVICES = new Set<string>([FEATURE_KEYS.DONE_FOR_YOU, FEATURE_KEYS.RUSH]);

const planLine = (plan: PricingPlan) => ({ key: plan.key, name: plan.name, priceMinor: plan.priceMinor, interval: plan.interval, tagline: plan.tagline });

const planCard = (plan: PlanWithFeatures) => ({
  key: plan.key,
  name: plan.name,
  description: plan.description,
  interval: plan.interval,
  kind: plan.kind,
  tagline: plan.tagline,
  stackable: plan.stackable,
  priceMinor: plan.priceMinor,
  currency: plan.currency,
  features: plan.features.map((f) => ({ featureKey: f.featureKey, enabled: f.enabled, limit: f.limit })),
});

/**
 * Plans and add-ons, paid once (ADR-053, ADR-062). The browser never decides
 * that a payment succeeded: entitlements are granted only after a verified
 * Razorpay signature (checkout callback) or a verified webhook. Granting is
 * idempotent, so the callback and the webhook can race safely. Nothing here
 * renews: Razorpay Orders only, never subscriptions.
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
    private readonly contact: ContactService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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

  private async withCoupon(amountMinor: number, couponCode?: string) {
    if (!couponCode) return { amountMinor, couponId: null as string | null };
    const now = new Date();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode } });
    const valid =
      coupon?.active &&
      (!coupon.validFrom || coupon.validFrom <= now) &&
      (!coupon.validUntil || coupon.validUntil > now) &&
      (coupon.maxRedemptions === null || coupon.redemptions < coupon.maxRedemptions);
    if (!coupon || !valid) throw new AppError('COUPON_INVALID', 'This coupon code is not valid.');
    const off = coupon.percentOff ? Math.round((amountMinor * coupon.percentOff) / 100) : (coupon.amountOffMinor ?? 0);
    return { amountMinor: Math.max(0, amountMinor - off), couponId: coupon.id };
  }

  private async planForSale(key: string): Promise<PlanWithFeatures> {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key }, include: { features: true } });
    if (!plan || !plan.active || plan.priceMinor <= 0) throw new AppError('NOT_FOUND', 'Plan not found.');
    return plan;
  }

  /** Plan orders in force (one-time ones always, yearly ones for their year), bought or given. */
  private async plansInForce(where: Prisma.OrderWhereInput): Promise<PlanInForce[]> {
    const orders = await this.prisma.order.findMany({ where: { ...where, status: 'PAID', plan: { kind: 'PLAN' } }, select: { id: true, kind: true, eventId: true, plan: true } });
    if (!orders.length) return [];
    const now = new Date();
    const live = await this.prisma.entitlement.findMany({
      where: { sourceType: 'ORDER', sourceId: { in: orders.map((o) => o.id) }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      select: { sourceId: true },
      distinct: ['sourceId'],
    });
    const inForce = new Set(live.map((e) => e.sourceId));
    return orders.filter((o) => inForce.has(o.id)).map((o) => ({ orderId: o.id, kind: o.kind, eventId: o.eventId, plan: o.plan }));
  }

  /** The plans the account bought or was given, in force: one-time ones always, yearly ones for their year. */
  async accountPlans(userId: string): Promise<PricingPlan[]> {
    return (await this.plansInForce({ userId, eventId: null })).map((o) => o.plan);
  }

  /** The biggest of some plan orders (by price), preferring the first given on a tie. */
  private static biggest(orders: PlanInForce[]): PlanInForce | null {
    return orders.reduce<PlanInForce | null>((best, o) => (!best || o.plan.priceMinor > best.plan.priceMinor ? o : best), null);
  }

  /** The plan a bigger one is paid against: the account's biggest one-time plan. */
  private currentPlan(plans: PricingPlan[]): PricingPlan | null {
    return [...plans].filter((p) => p.interval === 'ONE_TIME').sort((a, b) => b.priceMinor - a.priceMinor)[0] ?? null;
  }

  /**
   * What buying `plan` means for this account (ADR-062). A plan: included when
   * the account has it or a bigger one, else the price less the plan it has
   * (unlocking pays the difference); a hidden plan only through an offer made
   * for this account. An add-on: only with a plan it is offered to, once (or
   * as many as wanted when stackable).
   */
  private async purchase(userId: string, plan: PlanWithFeatures, input: { quantity?: number; offerToken?: string; eventId?: string }): Promise<Purchase> {
    const plans = await this.accountPlans(userId);
    const current = this.currentPlan(plans);
    if (plan.kind === 'ADDON') {
      // An add-on adds to a plan: the account's, or (bought from one of the buyer's events) a bigger
      // plan bought or given for that event alone, which it then adds to there only.
      let base = current ?? plans[0] ?? null;
      let eventId: string | null = null;
      if (input.eventId) {
        const event = await this.prisma.event.findFirst({ where: { id: input.eventId, ownerId: userId, deletedAt: null }, select: { id: true } });
        if (!event) throw AppError.notFound('Event');
        const own = PaymentsService.biggest(await this.plansInForce({ eventId: input.eventId }));
        if (own && own.plan.priceMinor > (base?.priceMinor ?? -1)) {
          base = own.plan;
          eventId = input.eventId;
        }
      }
      if (!base) throw new AppError('ADDON_NEEDS_PLAN', 'Add-ons go with a plan: choose your plan first.');
      if (plan.offeredTo.length && !plan.offeredTo.includes(base.key)) {
        throw new AppError('ADDON_NOT_OFFERED', 'This add-on is not offered with your plan.', { plan: base.key });
      }
      // One of a kind: bought for the account (it covers every event), or for this event already.
      const owned = !plan.stackable && (await this.prisma.order.count({ where: { userId, planId: plan.id, status: 'PAID', OR: [{ eventId: null }, ...(eventId ? [{ eventId }] : [])] } })) > 0;
      const quantity = plan.stackable ? Math.min(ADDON_MAX_QUANTITY, Math.max(1, input.quantity ?? 1)) : 1;
      return { plan, quantity, upgradeFrom: null, creditMinor: 0, subtotalMinor: plan.priceMinor * quantity, included: owned, eventId };
    }
    if (plan.visibility === 'HIDDEN' && !(input.offerToken && verifyPlanOfferToken(input.offerToken, userId, plan.key, this.config.TOKEN_ENCRYPTION_KEY))) {
      throw new AppError('NOT_FOUND', 'Plan not found.');
    }
    // A yearly plan (Studio) is sold whole, never against a one-time plan.
    if (plan.interval !== 'ONE_TIME') return { plan, quantity: 1, upgradeFrom: null, creditMinor: 0, subtotalMinor: plan.priceMinor, included: false, eventId: null };
    const included = Boolean(current && current.priceMinor >= plan.priceMinor);
    const upgradeFrom = current && !included ? current : null;
    const creditMinor = upgradeFrom?.priceMinor ?? 0;
    return { plan, quantity: 1, upgradeFrom, creditMinor, subtotalMinor: plan.priceMinor - creditMinor, included, eventId: null };
  }

  /**
   * The checkout page's price breakdown before anything is bought: the plan or
   * add-on, how many, the plan already owned (taken off a bigger one), a
   * coupon's discount and the total, and whether the account has it already.
   * A code that is not valid answers COUPON_INVALID, so the page can say so.
   */
  async quote(user: AuthUser, input: OrderQuoteInput) {
    const plan = await this.planForSale(input.planKey);
    const p = await this.purchase(user.id, plan, input);
    const { amountMinor } = await this.withCoupon(p.subtotalMinor, input.couponCode || undefined);
    return {
      plan: planCard(plan),
      couponCode: input.couponCode || null,
      priceMinor: plan.priceMinor,
      quantity: p.quantity,
      upgradeFrom: p.upgradeFrom ? { key: p.upgradeFrom.key, name: p.upgradeFrom.name, priceMinor: p.upgradeFrom.priceMinor } : null,
      creditMinor: p.creditMinor,
      subtotalMinor: p.subtotalMinor,
      discountMinor: p.subtotalMinor - amountMinor,
      totalMinor: amountMinor,
      currency: plan.currency,
      included: p.included,
      /** An add-on for this event's own plan (null: for the account). */
      eventId: p.eventId,
    };
  }

  /**
   * Plans and add-ons belong to the account (ADR-053, ADR-062): `POST /orders`
   * buys one for the buyer's account, and every event of theirs gets it.
   * `POST /events/:id/orders` still buys a one-time plan for that event alone
   * (API clients; older orders).
   */
  async createOrder(user: AuthUser, access: EventAccessContext | null, input: CreateOrderInput, meta: RequestMeta) {
    // Receipts and refunds need a reachable account, not a number alone.
    await assertVerifiedAccount(this.prisma, user.id);
    const plan = await this.planForSale(input.planKey);
    let p: Purchase;
    if (access) {
      if (plan.kind !== 'PLAN' || plan.interval !== 'ONE_TIME' || plan.visibility === 'HIDDEN') throw new AppError('BAD_REQUEST', 'This is not bought for one event.');
      p = { plan, quantity: 1, upgradeFrom: null, creditMinor: 0, subtotalMinor: plan.priceMinor, included: false, eventId: access.eventId };
    } else {
      p = await this.purchase(user.id, plan, input);
    }
    // Never sold twice: a plan the account already has (or a bigger one), an add-on bought once.
    if (p.included) {
      throw plan.kind === 'ADDON' ? new AppError('ADDON_ALREADY_OWNED', 'Your account already has this add-on.') : new AppError('PLAN_ALREADY_ACTIVE', 'Your account already has this plan.');
    }

    const { amountMinor, couponId } = await this.withCoupon(p.subtotalMinor, input.couponCode);
    const versions = await this.consents.versions(['terms', 'refund']);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: user.id,
          eventId: p.eventId,
          planId: plan.id,
          couponId,
          amountMinor,
          currency: plan.currency,
          quantity: p.quantity,
          creditMinor: p.creditMinor,
          termsAcceptedAt: new Date(),
        },
      });
      // The buyer's ticked box (an explicit action, as the e-commerce rules require), kept with the order.
      await tx.consent.create({ data: { userId: user.id, kind: 'purchase_terms', granted: true, version: `${versions.terms};${versions.refund}`, source: `order:${created.id}` } });
      return created;
    });
    this.analytics.track('checkout_started', { eventId: p.eventId ?? undefined, userId: user.id }, { plan: plan.key, amountMinor });
    await this.audit.record({
      actorType: 'USER',
      actorId: user.id,
      action: 'order.created',
      targetType: 'Order',
      targetId: order.id,
      eventId: p.eventId,
      metadata: { plan: plan.key, kind: plan.kind, amountMinor, quantity: p.quantity, creditMinor: p.creditMinor, ...(p.upgradeFrom ? { from: p.upgradeFrom.key } : {}) },
      meta,
    });

    if (amountMinor === 0) {
      // Fully discounted: no gateway involved.
      await this.finalize(order.id, { provider: 'COUPON', providerPaymentId: `coupon-${order.id}`, amountMinor: 0, raw: null });
      return { orderId: order.id, status: 'PAID' as const, amountMinor: 0 };
    }

    return this.checkoutSession(user, { ...order, plan });
  }

  /**
   * A hidden plan offered to this account for a day (ADR-062): the ₹159 plan,
   * offered to a host about to leave the checkout or arriving from an ad. Only
   * for a first plan: an account with one unlocks more from it instead.
   */
  async offer(user: AuthUser, input: PlanOfferInput, meta: RequestMeta) {
    // Without a key: the first-plan offer, the cheapest hidden one-time plan.
    const offerable = { active: true, kind: 'PLAN', visibility: 'HIDDEN', interval: 'ONE_TIME', priceMinor: { gt: 0 } } as const;
    const plan = input.planKey
      ? await this.prisma.pricingPlan.findFirst({ where: { key: input.planKey, ...offerable }, include: { features: true } })
      : await this.prisma.pricingPlan.findFirst({ where: offerable, include: { features: true }, orderBy: { priceMinor: 'asc' } });
    if (!plan) throw new AppError('NOT_FOUND', 'Offer not found.');
    if ((await this.accountPlans(user.id)).length) throw new AppError('OFFER_NOT_AVAILABLE', 'This offer is for your first plan.');
    const ttl = 86_400;
    const token = planOfferToken(user.id, plan.key, this.config.TOKEN_ENCRYPTION_KEY, ttl);
    this.analytics.track('offer_made', { userId: user.id }, { plan: plan.key });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'plan.offer_made', targetType: 'PricingPlan', targetId: plan.id, metadata: { plan: plan.key }, meta });
    return { token, expiresAt: new Date(Date.now() + ttl * 1000), plan: planCard(plan) };
  }

  /**
   * The signed-in account's plan and add-ons, and what they add up to: the
   * dashboard's Plan page and the checkout's "your plan" line.
   */
  async account(user: AuthUser) {
    const [plans, addOns, features, single] = await Promise.all([
      this.accountPlans(user.id),
      this.addOnsOf({ userId: user.id, eventId: null }),
      this.entitlements.forUser(user.id),
      this.plansInForce({ userId: user.id, eventId: { not: null } }),
    ]);
    const plan = this.currentPlan(plans) ?? plans[0] ?? null;
    // Plans bought or given for one event alone (older purchases, the team's complimentary ones).
    const eventIds = [...new Set(single.map((o) => o.eventId!))];
    const events = eventIds.length ? await this.prisma.event.findMany({ where: { id: { in: eventIds }, deletedAt: null }, select: { id: true, title: true } }) : [];
    const titles = new Map(events.map((e) => [e.id, e.title]));
    return {
      plan: plan ? planLine(plan) : null,
      addOns,
      features: EntitlementsService.summary(features),
      eventPlans: single.filter((o) => titles.has(o.eventId!)).map((o) => ({ eventId: o.eventId!, eventTitle: titles.get(o.eventId!)!, plan: planLine(o.plan), complimentary: o.kind === 'ADMIN_GRANT' })),
    };
  }

  /** Add-ons bought or given, added up by kind. */
  private async addOnsOf(where: Prisma.OrderWhereInput): Promise<Array<{ key: string; name: string; quantity: number }>> {
    const orders = await this.prisma.order.findMany({ where: { ...where, status: 'PAID', plan: { kind: 'ADDON' } }, select: { quantity: true, plan: { select: { key: true, name: true } } }, orderBy: { createdAt: 'asc' } });
    const owned = new Map<string, { key: string; name: string; quantity: number }>();
    for (const a of orders) {
      const row = owned.get(a.plan.key) ?? { key: a.plan.key, name: a.plan.name, quantity: 0 };
      row.quantity += a.quantity;
      owned.set(a.plan.key, row);
    }
    return [...owned.values()];
  }

  /**
   * The plan an event runs on (ADR-062): the bigger of the owner's account plan
   * and a plan bought or given for this event alone, the add-ons that add to it
   * (the account's and the event's own), and what the event has with them. The
   * owner's account plan comes too: a bigger plan is paid against it.
   */
  async eventPlan(access: EventAccessContext) {
    const event = await this.prisma.event.findFirst({ where: { id: access.eventId, deletedAt: null }, select: { ownerId: true } });
    if (!event) throw AppError.notFound('Event');
    const eventId = access.eventId;
    const [account, own, addOns, features, functions, guests, photos, videos, whatsapp] = await Promise.all([
      this.plansInForce({ userId: event.ownerId, eventId: null }),
      this.plansInForce({ eventId }),
      this.addOnsOf({ userId: event.ownerId, OR: [{ eventId: null }, { eventId }] }),
      this.entitlements.forEvent(eventId),
      // Counted as the limits count them: functions guests see (with a date), photos kept, films made or on the way.
      this.prisma.eventFunction.count({ where: { eventId, deletedAt: null, startsAt: { not: null } } }),
      this.prisma.guest.count({ where: { eventId, deletedAt: null } }),
      this.prisma.mediaItem.count({ where: { eventId, status: { notIn: ['DELETED', 'REJECTED'] } } }),
      this.prisma.videoJob.count({ where: { eventId, status: { in: ['QUEUED', 'PROCESSING', 'COMPLETED'] } } }),
      whatsappMessagesUsed(this.prisma, eventId),
    ]);
    const fromAccount = PaymentsService.biggest(account);
    const fromEvent = PaymentsService.biggest(own);
    const best = fromEvent && fromEvent.plan.priceMinor > (fromAccount?.plan.priceMinor ?? -1) ? fromEvent : fromAccount;
    return {
      plan: best ? planLine(best.plan) : null,
      /** ACCOUNT: the owner's plan, for every event; EVENT: bought or given for this event alone. */
      scope: best ? (best === fromEvent ? ('EVENT' as const) : ('ACCOUNT' as const)) : null,
      complimentary: best?.kind === 'ADMIN_GRANT',
      accountPlan: fromAccount ? planLine(fromAccount.plan) : null,
      addOns,
      features: EntitlementsService.summary(features),
      /** What the event uses of the limits (its plan page's meters). */
      usage: {
        [FEATURE_KEYS.FUNCTIONS_MAX]: functions,
        [FEATURE_KEYS.GUESTS_MAX]: guests,
        [FEATURE_KEYS.PHOTOS_MAX]: photos,
        [FEATURE_KEYS.VIDEO_RENDERS_MAX]: videos,
        [FEATURE_KEYS.WHATSAPP_MESSAGES]: whatsapp,
      },
    };
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
          notes: { orderId: order.id, plan: order.plan.key, ...(order.quantity > 1 ? { quantity: String(order.quantity) } : {}), ...(order.eventId ? { eventId: order.eventId } : {}) },
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
        planName: order.quantity > 1 ? `${order.plan.name} × ${order.quantity}` : order.plan.name,
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
        plan: { select: { key: true, name: true, interval: true, kind: true } },
        coupon: { select: { code: true } },
        payments: { where: { status: { in: ['CAPTURED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true, providerPaymentId: true, verifiedAt: true } },
      },
    });
    if (!order) throw AppError.notFound('Order');
    const [event, entitlement] = await Promise.all([
      order.eventId ? this.prisma.event.findFirst({ where: { id: order.eventId, deletedAt: null }, select: { id: true, title: true } }) : null,
      order.status === 'PAID' ? this.prisma.entitlement.findFirst({ where: { sourceType: { in: ORDER_SOURCES }, sourceId: order.id }, select: { validUntil: true } }) : null,
    ]);
    const payment = order.payments[0];
    return {
      id: order.id,
      status: order.status,
      kind: order.kind,
      amountMinor: order.amountMinor,
      currency: order.currency,
      quantity: order.quantity,
      creditMinor: order.creditMinor,
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
    // A plan paid against another (pay the difference) is only payable while the account still has that one and not more.
    if (!order.eventId && order.plan.kind === 'PLAN' && order.plan.interval === 'ONE_TIME') {
      const current = this.currentPlan(await this.accountPlans(user.id));
      if ((current?.priceMinor ?? 0) !== order.creditMinor) throw new AppError('ORDER_NOT_PAYABLE', 'Your plan changed since this order. Choose a plan to start again.');
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
        { actorType: 'SYSTEM', action: 'payment.captured', targetType: 'Order', targetId: orderId, eventId: order.eventId, metadata: { plan: order.plan.key, amountMinor: payment.amountMinor, provider: payment.provider, quantity: order.quantity } },
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
      await this.tellTheTeam(granted);
    }
  }

  /** A purchase the team carries out (done-for-you setup, same-day delivery): a note in the console's inbox, which also emails support. */
  private async tellTheTeam(order: Order & { plan: PlanWithFeatures }) {
    const services = order.plan.features.filter((f) => f.enabled && SERVICES.has(f.featureKey)).map((f) => f.featureKey);
    if (!services.length) return;
    try {
      const buyer = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true, phone: true } });
      const site = (await this.settings.get('site')).value;
      await this.contact.submit({
        name: buyer?.name?.slice(0, 80) || 'Bulava customer',
        email: buyer?.email ?? site.supportEmail,
        phone: buyer?.phone ?? undefined,
        topic: 'BILLING',
        message: `Paid for ${order.plan.name} (order ${order.id}). Please contact this customer to start: ${services.join(', ')}.${buyer?.email ? '' : ' They have no email address; use their WhatsApp number.'}`,
      });
    } catch (error) {
      // The payment stands; the order is in the console's order list either way.
      this.logger.error({ err: error, orderId: order.id }, 'Could not tell the team about a service purchase');
    }
  }

  /** Entitlements from the order's plan or add-on, exactly once (purchases and admin grants). An add-on's limits count once per add-on bought. */
  async grant(tx: Tx, order: Order & { plan: PricingPlan & { features: Array<{ featureKey: string; enabled: boolean; limit: number | null }> } }) {
    const addOn = order.plan.kind === 'ADDON';
    const sourceType = addOn ? ADDON_SOURCE : 'ORDER';
    const existing = await tx.entitlement.count({ where: { sourceType, sourceId: order.id } });
    if (existing) return;
    const validUntil = order.plan.interval === 'YEAR' ? new Date(Date.now() + 365 * 86_400_000) : null;
    await tx.entitlement.createMany({
      data: order.plan.features.map((f) => ({
        userId: order.userId,
        eventId: order.eventId,
        featureKey: f.featureKey,
        enabled: f.enabled,
        limit: addOn && f.limit !== null ? f.limit * order.quantity : f.limit,
        sourceType,
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
        plan: { select: { key: true, name: true, interval: true, kind: true } },
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
        quantity: o.quantity,
        creditMinor: o.creditMinor,
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
      await tx.entitlement.updateMany({ where: { sourceType: { in: ORDER_SOURCES }, sourceId: orderId }, data: { validUntil: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'payment.refunded', targetType: 'Order', targetId: orderId, eventId: order.eventId, meta }, tx);
    });
    return { refunded: true };
  }
}
