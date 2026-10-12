import { Controller, Get, HttpCode, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CreateOrderSchema,
  OrderQuoteSchema,
  PlanOfferSchema,
  VerifyPaymentSchema,
  type CreateOrderInput,
  type OrderQuoteInput,
  type PlanOfferInput,
  type VerifyPaymentInput,
} from '@bulava/validation';
import { CurrentUser, EventAccess, Public, ReqMeta, RequireEventPermission, SkipCsrf, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('events/:eventId/orders')
  @RequireEventPermission('payment.read')
  @ApiZodBody(CreateOrderSchema)
  createForEvent(
    @CurrentUser() user: AuthUser,
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateOrderSchema) body: CreateOrderInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.payments.createOrder(user, access, body, meta);
  }

  @Get('events/:eventId/orders')
  @RequireEventPermission('payment.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.payments.listForEvent(access);
  }

  /** The plan the event runs on and its add-ons (the owner's account plan, or one bought or given for this event). */
  @Get('events/:eventId/plan')
  @RequireEventPermission('event.read')
  eventPlan(@EventAccess() access: EventAccessContext) {
    return this.payments.eventPlan(access);
  }

  /** Payment history for the dashboard: the signed-in user's own orders. */
  @Get('orders')
  myOrders(@CurrentUser() user: AuthUser) {
    return this.payments.listForUser(user);
  }

  /** The account's plan and add-ons, and what they add up to (the dashboard's Plan page, the checkout). */
  @Get('orders/plan')
  account(@CurrentUser() user: AuthUser) {
    return this.payments.account(user);
  }

  /** A hidden plan offered to this account for a day (a host about to leave the checkout; ADR-062). */
  @Post('orders/offers')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PlanOfferSchema)
  offer(@CurrentUser() user: AuthUser, @ZodBody(PlanOfferSchema) body: PlanOfferInput, @ReqMeta() meta: RequestMeta) {
    return this.payments.offer(user, body, meta);
  }

  /** The checkout page's price breakdown: the plan or add-on, the plan already owned, a coupon's discount and the total (nothing is bought). */
  @Post('orders/quote')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(OrderQuoteSchema)
  quote(@CurrentUser() user: AuthUser, @ZodBody(OrderQuoteSchema) body: OrderQuoteInput) {
    return this.payments.quote(user, body);
  }

  /** Plans and add-ons for the account (ADR-053, ADR-062): every event of the buyer's gets them. */
  @Post('orders')
  @ApiZodBody(CreateOrderSchema)
  createForUser(@CurrentUser() user: AuthUser, @ZodBody(CreateOrderSchema) body: CreateOrderInput, @ReqMeta() meta: RequestMeta) {
    return this.payments.createOrder(user, null, body, meta);
  }

  @Post('orders/:orderId/verify')
  @HttpCode(200)
  @ApiZodBody(VerifyPaymentSchema)
  verify(@CurrentUser() user: AuthUser, @Param('orderId', ParseIdPipe) orderId: string, @ZodBody(VerifyPaymentSchema) body: VerifyPaymentInput) {
    return this.payments.verifyCheckout(user, orderId, body);
  }

  /** The payment status page (the buyer's own orders only); polled while a payment is being confirmed. */
  @Get('orders/:orderId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  status(@CurrentUser() user: AuthUser, @Param('orderId', ParseIdPipe) orderId: string) {
    return this.payments.orderStatus(user, orderId);
  }

  /** Reopens checkout for an order that failed or was never completed (same gateway order, no double charge). */
  @Post('orders/:orderId/checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resume(@CurrentUser() user: AuthUser, @Param('orderId', ParseIdPipe) orderId: string, @ReqMeta() meta: RequestMeta) {
    return this.payments.resumeCheckout(user, orderId, meta);
  }

  /** Razorpay calls this server-to-server; authenticity comes from the HMAC signature. */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('payments/razorpay/webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>) {
    return this.payments.handleWebhook(req.rawBody, req.get('x-razorpay-signature') ?? undefined);
  }
}
