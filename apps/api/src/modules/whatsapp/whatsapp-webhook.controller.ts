import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public, SkipCsrf } from '../../common/decorators/auth.decorators';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/**
 * Webhooks of the WhatsApp providers. All are public (server to server) and
 * authenticated by a secret each provider proves differently:
 *
 *   GET  /whatsapp/webhook          Meta's verification handshake (verify token; answers hub.challenge as text)
 *   POST /whatsapp/webhook          Meta's message statuses (X-Hub-Signature-256 over the raw body, app secret)
 *   POST /whatsapp/getgabs?token=…  GetGabs' incoming chats (a secret token in the URL, as GetGabs does not sign;
 *                                   in the query string, which Nginx and the API keep out of their logs)
 */
@ApiTags('whatsapp')
@Controller()
export class WhatsAppWebhookController {
  constructor(private readonly service: WhatsAppWebhookService) {}

  /** Meta verification handshake: HTTP 200 with the hub.challenge value as plain text. */
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

  /** Meta event delivery: message statuses (sent, delivered, read, failed). */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('whatsapp/webhook')
  @HttpCode(200)
  handleWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.service.handleWebhook(req.rawBody, req.get('x-hub-signature-256') ?? undefined);
  }

  /**
   * GetGabs "Webhook URL for All Chats" (GetGabs → Settings → Developer Tools).
   * GetGabs counts anything but HTTP 200 as a failure, so a payload we do not
   * use is still acknowledged; only a wrong token is refused.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('whatsapp/getgabs')
  @HttpCode(200)
  handleGetGabs(@Query('token') token: unknown, @Body() body: unknown) {
    return this.service.handleGetGabs(typeof token === 'string' ? token : '', body);
  }
}
