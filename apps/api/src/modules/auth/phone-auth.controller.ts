import { Controller, Header, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  PhoneOtpRequestSchema,
  PhoneOtpStatusSchema,
  PhoneOtpVerifySchema,
  PhoneSignupSchema,
  type PhoneOtpRequestInput,
  type PhoneOtpStatusInput,
  type PhoneOtpVerifyInput,
  type PhoneSignupInput,
} from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { PhoneOtpService } from '../onboarding/phone-otp.service';
import { AuthService } from './auth.service';
import { finishSignIn } from './cookies';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/** Signing in (or up) with a WhatsApp number and a one-time code (no password). */
@ApiTags('auth')
@Public()
@Controller('auth/phone')
export class PhoneAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly phoneOtp: PhoneOtpService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Sends a code to any WhatsApp number; `sendId` is for asking whether it got through. */
  @Post('otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiZodBody(PhoneOtpRequestSchema)
  request(@ZodBody(PhoneOtpRequestSchema) body: PhoneOtpRequestInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.requestPhoneCode(body.phone, meta);
  }

  /**
   * Whether the code's message got through: `failed` most often means the
   * number is not on WhatsApp, and the page offers Google or email instead.
   * Polled every few seconds while the page waits for the code.
   */
  @Post('status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiZodBody(PhoneOtpStatusSchema)
  async status(@ZodBody(PhoneOtpStatusSchema) body: PhoneOtpStatusInput) {
    return { delivery: await this.phoneOtp.delivery(body.sendId) };
  }

  /**
   * The code signs the number's account in (or asks for its second factor, or
   * offers to restore it); a number without an account gets `signupRequired`
   * and a token for `signup`.
   */
  @Post('verify')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiZodBody(PhoneOtpVerifySchema)
  async verify(@ZodBody(PhoneOtpVerifySchema) body: PhoneOtpVerifyInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginWithPhone(body.phone, body.code, meta);
    if ('signupRequired' in result) return result;
    return finishSignIn(res, result, this.config);
  }

  /** A new account for the number just proved: a name and the ticked Terms box. */
  @Post('signup')
  @Throttle(AUTH_THROTTLE)
  @ApiZodBody(PhoneSignupSchema)
  async signup(@ZodBody(PhoneSignupSchema) body: PhoneSignupInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.signupWithPhone(body, meta), this.config);
  }
}
