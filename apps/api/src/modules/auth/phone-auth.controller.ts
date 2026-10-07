import { Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PhoneOtpRequestSchema, PhoneOtpVerifySchema, type PhoneOtpRequestInput, type PhoneOtpVerifyInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AuthService } from './auth.service';
import { setSessionCookies } from './cookies';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/** Signing in with a WhatsApp number and a one-time code (no password). */
@ApiTags('auth')
@Public()
@Controller('auth/phone')
export class PhoneAuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Sends a code to the number when it has an account; the answer is the same either way. */
  @Post('otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiZodBody(PhoneOtpRequestSchema)
  request(@ZodBody(PhoneOtpRequestSchema) body: PhoneOtpRequestInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.requestPhoneCode(body.phone, meta);
  }

  /** The code signs the account in (or asks for its second factor, or offers to restore it). */
  @Post('verify')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiZodBody(PhoneOtpVerifySchema)
  async verify(@ZodBody(PhoneOtpVerifySchema) body: PhoneOtpVerifyInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginWithPhone(body.phone, body.code, meta);
    if ('mfaRequired' in result || 'restoreRequired' in result) return result;
    setSessionCookies(res, result.session, this.config);
    return { user: result.user, accessToken: result.session.accessToken, accessExpiresAt: result.session.accessExpiresAt };
  }
}
