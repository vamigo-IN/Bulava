import { Controller, Get, Headers, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  CardCheckoutEventSchema,
  CardDesignBodySchema,
  CardEventSchema,
  CardFreeDownloadSchema,
  CardLeadsQuerySchema,
  CardOrderSchema,
  CardOrdersQuerySchema,
  CardRecoverSchema,
  CardStatsQuerySchema,
  CardTokenSchema,
  CardUploadSchema,
  VerifyPaymentSchema,
  z,
  type CardCheckoutEventInput,
  type CardDesignBody,
  type CardEventInput,
  type CardFreeDownloadInput,
  type CardOrderInput,
  type CardRecoverInput,
  type CardUploadInput,
  type VerifyPaymentInput,
} from '@bulava/validation';
import { CurrentUser, OptionalUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { CardAdminService } from './card-admin.service';
import { CardDownloadsService } from './card-downloads.service';
import { CardOrdersService } from './card-orders.service';
import { CardsService } from './cards.service';

/** Headers that carry the tokens, so they never appear in a URL (Nginx and the API log paths). */
export const CARD_SESSION_HEADER = 'x-card-session';
export const CARD_ORDER_HEADER = 'x-card-order';

/** A card session token (32 random bytes); anything else is simply not found. */
function sessionToken(token: string | undefined): string {
  if (!token || !CardTokenSchema.safeParse(token).success) throw new AppError('CARD_SESSION_EXPIRED', 'This card is no longer saved here. Start again from the template.');
  return token;
}

function orderToken(token: string | undefined): string {
  if (!token || !CardTokenSchema.safeParse(token).success) throw AppError.notFound('Order');
  return token;
}

/**
 * The public card editor's API (docs/cards.md): no account needed. A card is
 * addressed by its session token (header x-card-session), a paid card by its
 * order token (x-card-order); both live in the visitor's browser and in links
 * after a #, never in a path or a query string.
 */
@ApiTags('cards')
@Public()
@Controller('public/cards')
export class PublicCardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly downloads: CardDownloadsService,
    private readonly orders: CardOrdersService,
  ) {}

  /** Price, payments, the watermark text, and for a signed-in visitor what their account covers. */
  @Get('config')
  config(@OptionalUser() user: AuthUser | null) {
    return this.cards.publicConfig(user);
  }

  @Post('events')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiZodBody(CardEventSchema)
  event(@ZodBody(CardEventSchema) body: CardEventInput, @OptionalUser() user: AuthUser | null) {
    return this.cards.clientEvent(body, user);
  }

  @Post('sessions')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(CardDesignBodySchema)
  createSession(@ZodBody(CardDesignBodySchema) body: CardDesignBody, @OptionalUser() user: AuthUser | null) {
    return this.cards.createSession(body, user);
  }

  @Get('session')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  openSession(@Headers(CARD_SESSION_HEADER) token: string | undefined) {
    return this.cards.openSession(sessionToken(token));
  }

  /** Autosave. */
  @Put('session/design')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiZodBody(CardDesignBodySchema)
  saveDesign(@Headers(CARD_SESSION_HEADER) token: string | undefined, @ZodBody(CardDesignBodySchema) body: CardDesignBody, @OptionalUser() user: AuthUser | null) {
    return this.cards.saveDesign(sessionToken(token), body, user);
  }

  @Post('session/uploads')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(CardUploadSchema)
  createUpload(@Headers(CARD_SESSION_HEADER) token: string | undefined, @ZodBody(CardUploadSchema) body: CardUploadInput) {
    return this.cards.createUpload(sessionToken(token), body);
  }

  @Post('session/uploads/:uploadId/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  completeUpload(@Headers(CARD_SESSION_HEADER) token: string | undefined, @Param('uploadId', ParseIdPipe) uploadId: string) {
    return this.cards.completeUpload(sessionToken(token), uploadId);
  }

  @Get('session/uploads/:uploadId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  uploadStatus(@Headers(CARD_SESSION_HEADER) token: string | undefined, @Param('uploadId', ParseIdPipe) uploadId: string) {
    return this.cards.uploadStatus(sessionToken(token), uploadId);
  }

  /** The free card: a mobile number, then the watermarked image is made (once per design). */
  @Post('session/free-download')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(CardFreeDownloadSchema)
  freeDownload(@Headers(CARD_SESSION_HEADER) token: string | undefined, @ZodBody(CardFreeDownloadSchema) body: CardFreeDownloadInput) {
    return this.downloads.free(sessionToken(token), body);
  }

  @Get('session/exports/:exportId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  exportStatus(@Headers(CARD_SESSION_HEADER) token: string | undefined, @Param('exportId', ParseIdPipe) exportId: string) {
    return this.downloads.status(sessionToken(token), exportId);
  }

  /** A signed link to the image; the first download of each image is the completed download. */
  @Post('session/exports/:exportId/download')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  download(@Headers(CARD_SESSION_HEADER) token: string | undefined, @Param('exportId', ParseIdPipe) exportId: string) {
    return this.downloads.download(sessionToken(token), exportId);
  }

  /** The watermark-free card: a pending order for this exact design, then Razorpay Checkout. */
  @Post('session/orders')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(CardOrderSchema)
  createOrder(@Headers(CARD_SESSION_HEADER) token: string | undefined, @ZodBody(CardOrderSchema) body: CardOrderInput, @OptionalUser() user: AuthUser | null, @ReqMeta() meta: RequestMeta) {
    return this.orders.create(sessionToken(token), body, user, meta);
  }

  /** The order page (polled while a payment or the image is on its way). */
  @Get('order')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  order(@Headers(CARD_ORDER_HEADER) token: string | undefined) {
    return this.orders.view(orderToken(token));
  }

  /** "Try again": the same order and gateway order, so a payment can never be taken twice. */
  @Post('order/checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resume(@Headers(CARD_ORDER_HEADER) token: string | undefined) {
    return this.orders.resume(orderToken(token));
  }

  @Post('order/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(VerifyPaymentSchema)
  verify(@Headers(CARD_ORDER_HEADER) token: string | undefined, @ZodBody(VerifyPaymentSchema) body: VerifyPaymentInput) {
    return this.orders.verify(orderToken(token), body);
  }

  @Post('order/events')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(CardCheckoutEventSchema)
  checkoutEvent(@Headers(CARD_ORDER_HEADER) token: string | undefined, @ZodBody(CardCheckoutEventSchema) body: CardCheckoutEventInput) {
    return this.orders.checkoutEvent(orderToken(token), body);
  }

  @Post('order/download')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  orderDownload(@Headers(CARD_ORDER_HEADER) token: string | undefined) {
    return this.orders.download(orderToken(token));
  }

  @Post('order/email')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendEmail(@Headers(CARD_ORDER_HEADER) token: string | undefined) {
    return this.orders.resendEmail(orderToken(token));
  }

  /** A paid card whose image failed or expired is made again (never charged again). */
  @Post('order/regenerate')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  regenerate(@Headers(CARD_ORDER_HEADER) token: string | undefined) {
    return this.orders.regenerate(orderToken(token));
  }

  /** "Find my card": the links go to the email used at checkout; the answer is the same either way. */
  @Post('recover')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiZodBody(CardRecoverSchema)
  recover(@ZodBody(CardRecoverSchema) body: CardRecoverInput) {
    return this.orders.recover(body);
  }

  /** For the export renderer only (a short-lived HMAC token; Nginx refuses this path from outside). */
  @Get('render/:token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  renderData(@Param('token') token: string) {
    return this.cards.renderData(token.slice(0, 200));
  }
}

/** A watermark-free card for a signed-in customer whose plan covers it. */
@ApiTags('cards')
@Controller('cards')
export class CardsController {
  constructor(private readonly downloads: CardDownloadsService) {}

  @Post('session/plan-download')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  planDownload(@Headers(CARD_SESSION_HEADER) token: string | undefined, @CurrentUser() user: AuthUser) {
    return this.downloads.plan(sessionToken(token), user);
  }
}

/** Digital cards in the console: the funnel, contacts and orders. */
@ApiTags('admin')
@Controller('admin/cards')
export class AdminCardsController {
  constructor(
    private readonly admin: CardAdminService,
    private readonly orders: CardOrdersService,
  ) {}

  @Get('stats')
  @RequirePlatformPermission('cards.view')
  stats(@ZodQuery(CardStatsQuerySchema) query: z.infer<typeof CardStatsQuerySchema>) {
    return this.admin.stats(query.days);
  }

  @Get('leads')
  @RequirePlatformPermission('cards.view')
  leads(@ZodQuery(CardLeadsQuerySchema) query: z.infer<typeof CardLeadsQuerySchema>) {
    return this.admin.leads(query);
  }

  /** The contacts who agreed to offers on WhatsApp (and never withdrew), for a campaign. */
  @Get('leads.csv')
  @RequirePlatformPermission('cards.manage')
  async leadsCsv(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta, @Res() res: Response) {
    const csv = await this.admin.consentedCsv(user.id, meta);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="card-contacts-with-consent-${new Date().toISOString().slice(0, 10)}.csv"`)
      .setHeader('Cache-Control', 'no-store')
      .send(`\uFEFF${csv}`);
  }

  @Get('leads/:id')
  @RequirePlatformPermission('cards.view')
  lead(@Param('id', ParseIdPipe) id: string) {
    return this.admin.lead(id);
  }

  @Post('leads/:id/withdraw-offers')
  @HttpCode(200)
  @RequirePlatformPermission('cards.manage')
  withdraw(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.admin.withdrawConsent(id, user.id, meta);
  }

  @Get('orders')
  @RequirePlatformPermission('cards.view')
  orderList(@ZodQuery(CardOrdersQuerySchema) query: z.infer<typeof CardOrdersQuerySchema>) {
    return this.admin.orderList(query);
  }

  @Get('orders/:id')
  @RequirePlatformPermission('cards.view')
  order(@Param('id', ParseIdPipe) id: string) {
    return this.admin.order(id);
  }

  @Post('orders/:id/resend-email')
  @HttpCode(200)
  @RequirePlatformPermission('cards.manage')
  resendEmail(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.admin.resendEmail(id, user.id, meta);
  }

  @Post('orders/:id/regenerate')
  @HttpCode(200)
  @RequirePlatformPermission('cards.manage')
  regenerate(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.admin.regenerate(id, user.id, meta);
  }

  @Post('orders/:id/refund')
  @HttpCode(200)
  @RequirePlatformPermission('payment.refund')
  refund(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.orders.refund(id, user.id, meta);
  }
}
