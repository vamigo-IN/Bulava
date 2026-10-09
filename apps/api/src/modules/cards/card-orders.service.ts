import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { cardOrderToken, generateSecureToken, hashToken } from '@bulava/auth';
import { Prisma, type CardOrder } from '@bulava/database';
import { ObjectStorage } from '@bulava/storage';
import { cardPixelSize, type CardFormat } from '@bulava/template-schema';
import type { CardCheckoutEventInput, CardOrderInput, CardRecoverInput, VerifyPaymentInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { maskTarget } from '../guest-access/otp.service';
import { PaymentsService, type GatewayPayment } from '../payments/payments.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { ConsentService } from '../users/consent.service';
import { CARD_EXPORT_DAYS, cardOrderReference } from './card-designs';
import { CardDownloadsService } from './card-downloads.service';
import { cardRecoveryEmail } from './card-emails';
import { CardsService } from './cards.service';

const DAY = 86_400_000;
/** Emails a customer may ask for again per order and hour. */
const RESENDS_PER_HOUR = 3;

/**
 * Watermark-free cards (docs/cards.md#paid-cards). An order freezes the design
 * it buys, and nothing is unlocked until Razorpay's signature (checkout) or
 * webhook proves the payment. Both can arrive, in any order and more than
 * once: settling is idempotent under a row lock. A design already bought is
 * never charged again, and a paid card can always be downloaded, emailed or
 * rendered again from its order page, whatever happened to the browser.
 */
@Injectable()
export class CardOrdersService implements OnModuleInit {
  private readonly logger = new Logger(CardOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly downloads: CardDownloadsService,
    private readonly payments: PaymentsService,
    private readonly consents: ConsentService,
    private readonly audit: AuditService,
    private readonly settings: PlatformSettingsService,
    private readonly queues: QueueService,
    private readonly redis: RedisService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.payments.onOtherPayment((event, payment) => this.webhook(event, payment));
  }

  /** The order page's link token (an HMAC of the id; only its hash is stored). */
  token(orderId: string): string {
    return cardOrderToken(orderId, this.config.TOKEN_ENCRYPTION_KEY);
  }

  /** The order page; the token follows a #, so browsers never send it to a server (or a log). */
  orderUrl(orderId: string): string {
    return `${this.config.WEB_ORIGIN.replace(/\/$/, '')}/cards/order#${this.token(orderId)}`;
  }

  async byToken(orderToken: string): Promise<CardOrder> {
    const order = /^[A-Za-z0-9_-]{43}$/.test(orderToken) ? await this.prisma.cardOrder.findUnique({ where: { tokenHash: hashToken(orderToken) } }) : null;
    if (!order) throw AppError.notFound('Order');
    return order;
  }

  // ─────────────────────────── Placing an order ───────────────────────────

  /**
   * The paid option: the contact (name and email for the receipt and any
   * dispute), the ticked Terms, then a pending order for exactly this design.
   * An open order for the same design is reused (same gateway order, so it can
   * never be paid twice); a design already bought is returned as paid.
   */
  async create(token: string, input: CardOrderInput, user: AuthUser | null, meta: RequestMeta) {
    const options = await this.cards.requireEnabled();
    const session = await this.cards.session(token);
    const existing = await this.prisma.cardOrder.findFirst({
      where: { sessionId: session.id, designHash: session.designHash, status: { in: ['PAID', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.status === 'PAID') return this.paidResult(existing);
    // Payments must work before anything is recorded as a checkout.
    await this.payments.gateway(true);
    if (existing && existing.amountMinor === options.priceMinor) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.cards.upsertLead(tx, input.phone, { choice: 'PAID', marketingConsent: input.marketingConsent, name: input.name, email: input.email, source: `card-order:${existing.id}` });
        return tx.cardOrder.update({ where: { id: existing.id }, data: { name: input.name, email: input.email, phoneE164: input.phone.e164 } });
      });
      await this.cards.event('CUSTOMER_DETAILS_SUBMITTED', this.refs(updated));
      return this.checkout(updated);
    }
    // The price changed since that checkout was opened: it is closed and a new one opened at today's price.
    if (existing) await this.prisma.cardOrder.update({ where: { id: existing.id }, data: { status: 'EXPIRED' } });

    const versions = await this.consents.versions(['terms', 'refund', 'privacy']);
    let order: CardOrder;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const lead = await this.cards.upsertLead(tx, input.phone, { choice: 'PAID', marketingConsent: input.marketingConsent, name: input.name, email: input.email, source: `card-order:${session.id}` });
        const created = await tx.cardOrder.create({
          data: {
            // The real hash needs the id; a placeholder holds the unique slot for a moment.
            tokenHash: `pending:${generateSecureToken(16)}`,
            reference: cardOrderReference(),
            sessionId: session.id,
            leadId: lead.id,
            userId: user?.id ?? session.userId,
            amountMinor: options.priceMinor,
            design: session.design as Prisma.InputJsonValue,
            designHash: session.designHash,
            templateKey: session.templateKey,
            format: session.format,
            name: input.name,
            email: input.email,
            phoneE164: input.phone.e164,
            termsAcceptedAt: new Date(),
          },
        });
        const placed = await tx.cardOrder.update({ where: { id: created.id }, data: { tokenHash: hashToken(this.token(created.id)) } });
        await tx.cardSession.update({ where: { id: session.id }, data: { leadId: lead.id, lastSeenAt: new Date() } });
        // The buyer's ticked box, with the versions of the policies they agreed to.
        await tx.consent.create({ data: { cardLeadId: lead.id, kind: 'purchase_terms', granted: true, version: `${versions.terms};${versions.refund};${versions.privacy}`, source: `card-order:${placed.id}` } });
        await this.cards.event('PHONE_SUBMITTED', { ...this.refs(placed), meta: { option: 'PAID', offers: input.marketingConsent } }, tx);
        await this.cards.event('CUSTOMER_DETAILS_SUBMITTED', this.refs(placed), tx);
        await this.audit.record(
          { actorType: user ? 'USER' : 'ANONYMOUS', actorId: user?.id ?? null, action: 'card_order.created', targetType: 'CardOrder', targetId: placed.id, metadata: { reference: placed.reference, amountMinor: placed.amountMinor }, meta },
          tx,
        );
        return placed;
      });
    } catch (error) {
      // A second click while the first was placing the order (card_orders_open_per_design).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const other = await this.prisma.cardOrder.findFirst({ where: { sessionId: session.id, designHash: session.designHash, status: 'PENDING' } });
        if (other) return this.checkout(other);
      }
      throw error;
    }
    return this.checkout(order);
  }

  private refs(order: CardOrder) {
    return { sessionId: order.sessionId, leadId: order.leadId, orderId: order.id, userId: order.userId, templateKey: order.templateKey };
  }

  private paidResult(order: CardOrder) {
    return { orderToken: this.token(order.id), reference: order.reference, status: 'PAID' as const, amountMinor: order.amountMinor, currency: order.currency };
  }

  /** What the browser needs to open Razorpay Checkout, creating the gateway order the first time. */
  private async checkout(order: CardOrder) {
    const provider = await this.payments.gateway(true);
    let providerOrderId = order.providerOrderId;
    if (!providerOrderId) {
      try {
        ({ providerOrderId } = await provider.createOrder({
          amountMinor: order.amountMinor,
          currency: order.currency,
          receipt: order.reference,
          notes: { kind: 'card', cardOrderId: order.id, reference: order.reference },
        }));
        await this.prisma.cardOrder.update({ where: { id: order.id }, data: { providerOrderId, provider: provider.name, failureReason: null } });
      } catch (error) {
        this.logger.error({ err: error, orderId: order.id }, 'Card payment order creation failed');
        await this.prisma.cardOrder.update({ where: { id: order.id }, data: { failureReason: 'The payment could not be started.' } });
        throw new AppError('PAYMENTS_UNAVAILABLE', 'We could not start the payment. Please try again.');
      }
    }
    await this.cards.event('PAYMENT_INITIATED', { ...this.refs(order), meta: { amountMinor: order.amountMinor } });
    return {
      orderToken: this.token(order.id),
      reference: order.reference,
      status: 'PENDING' as const,
      amountMinor: order.amountMinor,
      currency: order.currency,
      keyId: provider.publicKey,
      providerOrderId,
      prefill: { name: order.name, email: order.email, contact: order.phoneE164 },
    };
  }

  /** "Try again" after a failed or closed checkout: the same order and gateway order. */
  async resume(orderToken: string) {
    const order = await this.byToken(orderToken);
    if (order.status === 'PAID') return this.paidResult(order);
    if (order.status !== 'PENDING') throw new AppError('ORDER_NOT_PAYABLE', 'This order can no longer be paid. Open your card and choose the watermark-free download again.');
    return this.checkout(order);
  }

  // ─────────────────────────── Confirming payment ───────────────────────────

  /** Checkout's callback: the signature is checked here before anything is unlocked. */
  async verify(orderToken: string, input: VerifyPaymentInput) {
    const order = await this.byToken(orderToken);
    if (order.status === 'PAID') return { status: 'PAID' as const };
    if (!order.providerOrderId || order.providerOrderId !== input.razorpayOrderId) throw AppError.notFound('Order');
    const provider = await this.payments.gateway();
    if (!provider.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
      await this.cards.event('PAYMENT_FAILED', { ...this.refs(order), meta: { reason: 'signature' } });
      throw new AppError('PAYMENT_VERIFICATION_FAILED', 'We could not verify this payment.');
    }
    await this.finalize(order.id, { paymentId: input.razorpayPaymentId, amountMinor: order.amountMinor, via: 'checkout' });
    return { status: 'PAID' as const };
  }

  /** Razorpay's webhook for a card's gateway order (the plan webhook hands these over). */
  private async webhook(event: string | undefined, payment: GatewayPayment & { id: string; order_id: string }): Promise<boolean> {
    const order = await this.prisma.cardOrder.findUnique({ where: { providerOrderId: payment.order_id } });
    if (!order) return false;
    if (event === 'payment.captured' || event === 'order.paid') {
      if (payment.amount !== undefined && payment.amount < order.amountMinor) throw new AppError('PAYMENT_VERIFICATION_FAILED', 'Amount mismatch.');
      await this.finalize(order.id, { paymentId: payment.id, amountMinor: payment.amount ?? order.amountMinor, via: 'webhook' });
    } else if (event === 'payment.failed' && order.status === 'PENDING') {
      const reason = payment.error_description?.slice(0, 300);
      await this.prisma.cardOrder.update({ where: { id: order.id }, data: { failureReason: reason ?? 'The payment did not go through.' } });
      await this.cards.event('PAYMENT_FAILED', { ...this.refs(order), meta: { via: 'webhook', ...(reason ? { reason } : {}) } });
    }
    return true;
  }

  /**
   * Marks an order paid and queues its watermark-free image, exactly once:
   * the checkout callback and the webhook serialise on the order's row. A late
   * payment for an expired checkout is honoured (the money was taken).
   */
  async finalize(orderId: string, payment: { paymentId: string; amountMinor: number; via: 'checkout' | 'webhook' }): Promise<void> {
    const queued = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM card_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.cardOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID' || order.status === 'REFUNDED') return null;
      const paidAt = new Date();
      await tx.cardOrder.update({ where: { id: orderId }, data: { status: 'PAID', providerPaymentId: payment.paymentId, paidAt, failureReason: null } });
      const card = await tx.cardExport.create({
        data: {
          kind: 'PAID',
          orderId,
          sessionId: order.sessionId,
          leadId: order.leadId,
          userId: order.userId,
          templateKey: order.templateKey,
          format: order.format,
          design: order.design as Prisma.InputJsonValue,
          designHash: order.designHash,
          expiresAt: new Date(paidAt.getTime() + CARD_EXPORT_DAYS.PAID * DAY),
        },
      });
      await tx.cardLead.update({ where: { id: order.leadId }, data: { lastChoice: 'PAID', lastSeenAt: paidAt } });
      await this.cards.event('PAYMENT_SUCCEEDED', { ...this.refs(order), meta: { amountMinor: payment.amountMinor, via: payment.via } }, tx);
      await this.audit.record({ actorType: 'SYSTEM', action: 'card_order.paid', targetType: 'CardOrder', targetId: orderId, metadata: { reference: order.reference, amountMinor: payment.amountMinor, via: payment.via } }, tx);
      return card;
    });
    // If the queue is briefly down, the order page queues the image again when it is opened.
    if (queued) await this.downloads.queue(queued.id).catch((err: unknown) => this.logger.warn({ err, orderId }, 'Could not queue a paid card'));
  }

  /** How a checkout ended without a payment, as the browser saw it (the order stays open for another try). */
  async checkoutEvent(orderToken: string, input: CardCheckoutEventInput) {
    const order = await this.byToken(orderToken);
    if (order.status !== 'PENDING') return { ok: true };
    if (input.type === 'PAYMENT_FAILED') await this.prisma.cardOrder.update({ where: { id: order.id }, data: { failureReason: input.reason ?? 'The payment did not go through.' } });
    await this.cards.event(input.type, { ...this.refs(order), meta: { via: 'checkout', ...(input.reason ? { reason: input.reason } : {}) } });
    return { ok: true };
  }

  // ─────────────────────────── After payment ───────────────────────────

  private latestCard(orderId: string) {
    return this.prisma.cardExport.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  /** The order page: status, the card (a preview once ready) and its email. Contact details are masked. */
  async view(orderToken: string) {
    const order = await this.byToken(orderToken);
    // An open order whose last checkout was closed or failed is waiting for the buyer, not for the bank.
    const lastCheckout =
      order.status === 'PENDING'
        ? await this.prisma.cardEvent.findFirst({ where: { orderId: order.id, type: { in: ['PAYMENT_INITIATED', 'PAYMENT_CANCELLED', 'PAYMENT_FAILED'] } }, orderBy: { createdAt: 'desc' }, select: { type: true } })
        : null;
    let card = order.status === 'PAID' ? await this.latestCard(order.id) : null;
    if (order.status === 'PAID' && !card) card = await this.newCard(order);
    if (card?.status === 'QUEUED' && card.updatedAt.getTime() < Date.now() - 90_000) {
      await this.prisma.cardExport.update({ where: { id: card.id }, data: { updatedAt: new Date() } });
      await this.downloads.queue(card.id).catch((err: unknown) => this.logger.warn({ err, orderId: order.id }, 'Could not queue a paid card again'));
    }
    const pixels = cardPixelSize(order.format as CardFormat);
    return {
      reference: order.reference,
      status: order.status,
      amountMinor: order.amountMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      refundedAt: order.refundedAt,
      templateKey: order.templateKey,
      format: order.format,
      width: pixels.width,
      height: pixels.height,
      email: maskTarget(order.email),
      emailStatus: order.emailStatus,
      emailedAt: order.emailedAt,
      paymentReference: order.status === 'PAID' ? order.providerPaymentId : null,
      failureReason: order.status === 'PENDING' ? order.failureReason : null,
      /** open: a checkout may still be paying; closed: the buyer closed it or it failed (pay again). */
      checkout: order.status === 'PENDING' ? (lastCheckout && lastCheckout.type !== 'PAYMENT_INITIATED' ? 'closed' : 'open') : null,
      card: card
        ? {
            status: card.status,
            readyAt: card.readyAt,
            previewUrl: card.status === 'READY' && card.storageKey ? await this.storage.presignDownload(card.storageKey, { expiresInSeconds: 900 }) : null,
          }
        : null,
    };
  }

  async download(orderToken: string) {
    const order = await this.byToken(orderToken);
    if (order.status !== 'PAID') throw new AppError('CARD_NOT_READY', order.status === 'REFUNDED' ? 'This order was refunded.' : 'This card is not paid for yet.');
    const card = await this.latestCard(order.id);
    if (!card) throw new AppError('CARD_NOT_READY', 'Your card is not ready yet.');
    return this.downloads.signedDownload(card, this.refs(order));
  }

  /** "Email it to me again": queued for the worker, a few times an hour at most. */
  async resendEmail(orderToken: string) {
    const order = await this.byToken(orderToken);
    if (!this.config.RATE_LIMIT_DISABLED) {
      const key = `card-email-resends:${order.id}`;
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, 3600);
      if (count > RESENDS_PER_HOUR) throw new AppError('RATE_LIMITED', 'The card was emailed a few times already. Please try again in an hour.');
    }
    return this.sendEmail(order);
  }

  /** Queues the paid card's email (the worker attaches the image and records how it went). */
  async sendEmail(order: CardOrder) {
    if (order.status !== 'PAID') throw new AppError('CARD_NOT_READY', 'This card is not paid for.');
    const card = await this.latestCard(order.id);
    if (card?.status !== 'READY') throw new AppError('CARD_NOT_READY', 'Your card is still being made. It is emailed as soon as it is ready.');
    await this.prisma.cardOrder.update({ where: { id: order.id }, data: { emailStatus: 'QUEUED', emailError: null } });
    await this.queues.add('email', { cardOrderId: order.id }, { jobId: `card-email-${order.id}-${Date.now()}` });
    return { emailStatus: 'QUEUED' as const };
  }

  /** "Make it again": a paid card whose image failed or expired is rendered again, free. */
  async regenerate(orderToken: string) {
    return this.regenerateOrder(await this.byToken(orderToken));
  }

  async regenerateOrder(order: CardOrder) {
    if (order.status !== 'PAID') throw new AppError('CARD_NOT_READY', 'This card is not paid for.');
    const card = await this.latestCard(order.id);
    if (card && (card.status === 'QUEUED' || card.status === 'RENDERING' || card.status === 'READY')) return { status: card.status };
    const fresh = await this.newCard(order);
    return { status: fresh.status };
  }

  private async newCard(order: CardOrder) {
    try {
      const card = await this.prisma.cardExport.create({
        data: {
          kind: 'PAID',
          orderId: order.id,
          sessionId: order.sessionId,
          leadId: order.leadId,
          userId: order.userId,
          templateKey: order.templateKey,
          format: order.format,
          design: order.design as Prisma.InputJsonValue,
          designHash: order.designHash,
          expiresAt: new Date((order.paidAt ?? new Date()).getTime() + CARD_EXPORT_DAYS.PAID * DAY),
        },
      });
      await this.downloads.queue(card.id);
      return card;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const live = await this.latestCard(order.id);
        if (live) return live;
      }
      throw error;
    }
  }

  /**
   * "Find my card": the links to paid cards bought with this email and number
   * go to that email. The answer never says whether anything was found.
   */
  async recover(input: CardRecoverInput) {
    const orders = await this.prisma.cardOrder.findMany({ where: { email: input.email, phoneE164: input.phone.e164, status: 'PAID' }, orderBy: { paidAt: 'desc' }, take: 10 });
    if (orders.length) {
      const site = (await this.settings.get('site')).value.name;
      const mail = cardRecoveryEmail({ site, orders: orders.map((o) => ({ reference: o.reference, paidAt: o.paidAt ?? o.createdAt, url: this.orderUrl(o.id) })) });
      // The links open the cards: the job is removed as soon as the worker is done with it.
      await this.queues.add('email', { to: input.email, ...mail }, { removeOnComplete: true, removeOnFail: true });
    }
    return { ok: true };
  }

  /** Staff refund: at the gateway, then the order is closed (downloads stop). */
  async refund(orderId: string, staffId: string, meta: RequestMeta) {
    const order = await this.prisma.cardOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PAID') throw AppError.notFound('Paid order');
    if (order.providerPaymentId && order.provider === 'RAZORPAY') await (await this.payments.gateway()).refund(order.providerPaymentId, order.amountMinor);
    await this.prisma.$transaction(async (tx) => {
      await tx.cardOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED', refundedAt: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: staffId, action: 'card_order.refunded', targetType: 'CardOrder', targetId: order.id, metadata: { reference: order.reference, amountMinor: order.amountMinor }, meta }, tx);
    });
    return { refunded: true };
  }
}
