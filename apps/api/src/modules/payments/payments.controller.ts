import { Controller, Get, HttpCode, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateOrderSchema, VerifyPaymentSchema, type CreateOrderInput, type VerifyPaymentInput } from '@bulava/validation';
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

  /** Payment history for the dashboard: the signed-in user's own orders. */
  @Get('orders')
  myOrders(@CurrentUser() user: AuthUser) {
    return this.payments.listForUser(user);
  }

  /** Yearly plans (Studio) belong to the user, not an event. */
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
