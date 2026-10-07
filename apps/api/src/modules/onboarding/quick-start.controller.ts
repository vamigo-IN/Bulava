import { Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { QuickStartSchema, QuickStartVerifySchema, type QuickStartInput, type QuickStartVerifyInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { setSessionCookies } from '../auth/cookies';
import { QuickStartService, type QuickStartResult } from './quick-start.service';

/** New accounts and events from one form: a tighter limit than ordinary sign-in. */
const QUICK_START_THROTTLE = { default: { limit: 6, ttl: 60_000 } };

function finish(res: Response, result: QuickStartResult, config: AppConfig) {
  setSessionCookies(res, result.session, config);
  return { user: result.user, event: result.event, whatsappSent: result.whatsappSent, accessToken: result.session.accessToken, accessExpiresAt: result.session.accessExpiresAt };
}

@ApiTags('quick-start')
@Public()
@Controller('public/quick-start')
export class QuickStartController {
  constructor(
    private readonly quickStart: QuickStartService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Names, date and WhatsApp number → a draft event with the chosen design, a
   * preview link and a signed-in provisional account. A number that already
   * has an account gets `{ requiresOtp: true }` and a code on WhatsApp instead.
   */
  @Post()
  @HttpCode(200)
  @Throttle(QUICK_START_THROTTLE)
  @ApiZodBody(QuickStartSchema)
  async start(@ZodBody(QuickStartSchema) body: QuickStartInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const result = await this.quickStart.start(body, meta);
    if ('requiresOtp' in result) return result;
    return finish(res, result, this.config);
  }

  /** The code step: the same form plus the six digits from WhatsApp. */
  @Post('verify')
  @HttpCode(200)
  @Throttle(QUICK_START_THROTTLE)
  @ApiZodBody(QuickStartVerifySchema)
  async verify(@ZodBody(QuickStartVerifySchema) body: QuickStartVerifyInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finish(res, await this.quickStart.verify(body, meta), this.config);
  }
}
