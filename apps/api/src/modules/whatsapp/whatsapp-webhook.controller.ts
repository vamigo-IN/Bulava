import { Controller, Get, HttpCode, Post, Req, Res, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public, SkipCsrf } from '../../common/decorators/auth.decorators';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/**
 * WhatsApp Business Cloud API webhook controller.
 * Implements endpoints according to Meta's specifications:
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
 *
 * Two endpoints on `/api/v1/whatsapp/webhook`:
 *   GET  – Meta's one-time verification handshake (responds with hub.challenge as text/plain)
 *   POST – Meta's real-time event updates (HMAC-SHA256 verified over raw request body)
 *
 * Both are public (server-to-server from Meta); authenticity is verified by
 * the webhook verify token (GET) or App Secret HMAC signature (POST),
 * exactly like the Razorpay webhook.
 */
@ApiTags('whatsapp')
@Controller()
export class WhatsAppWebhookController {
  constructor(private readonly service: WhatsAppWebhookService) {}

  /**
   * Meta verification handshake.
   * Responds with HTTP 200 and the hub.challenge value as plain text.
   */
  @Public()
  @SkipCsrf()
  @Get('whatsapp/webhook')
  async verify(@Req() req: Request, @Res() res: Response) {
    const q = req.query as Record<string, unknown>;
    const hub = typeof q.hub === 'object' && q.hub !== null ? (q.hub as Record<string, unknown>) : null;
    const mode = q['hub.mode'] != null ? String(q['hub.mode']) : hub?.mode != null ? String(hub.mode) : undefined;
    const token = q['hub.verify_token'] != null ? String(q['hub.verify_token']) : hub?.verify_token != null ? String(hub.verify_token) : undefined;
    const challenge = q['hub.challenge'] != null ? String(q['hub.challenge']) : hub?.challenge != null ? String(hub.challenge) : undefined;

    const result = await this.service.verifyChallenge(mode, token, challenge);
    res.status(200).type('text/plain').send(result);
  }

  /**
   * Meta event delivery.
   * Real-time message status updates (sent, delivered, read, failed).
   * Verified using X-Hub-Signature-256 HMAC-SHA256 signature with the Meta App Secret.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('whatsapp/webhook')
  @HttpCode(200)
  handleWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.service.handleWebhook(req.rawBody, req.get('x-hub-signature-256') ?? undefined);
  }
}
