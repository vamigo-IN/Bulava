import { Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GuestTravelSelfSchema, RSVPSubmitSchema, z, type GuestTravelSelfInput, type RSVPSubmitInput } from '@bulava/validation';
import { Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { GuestInvitationService } from './guest-invitation.service';

/** OTP pass from the header (API clients) or the httpOnly cookie set by the web app. */
function otpPass(req: Request): string | undefined {
  return req.get('x-bulava-otp-pass') ?? (req.cookies as Record<string, string> | undefined)?.bulava_otp ?? undefined;
}

const OtpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

/**
 * Guest endpoints authenticated by the invitation token in the path.
 * Responses are private and never cached or indexed.
 */
@ApiTags('public-invitations')
@Public()
@Controller('public/invitations')
export class GuestInvitationController {
  constructor(private readonly guestInvitations: GuestInvitationService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  view(@Param('token') token: string, @Req() req: Request) {
    return this.guestInvitations.view(token, otpPass(req));
  }

  @Post(':token/rsvp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiZodBody(RSVPSubmitSchema)
  rsvp(@Param('token') token: string, @ZodBody(RSVPSubmitSchema) body: RSVPSubmitInput, @ReqMeta() meta: RequestMeta, @Req() req: Request) {
    return this.guestInvitations.submitRsvp(token, body, meta, otpPass(req));
  }

  /** The guest's own arrival and departure (only when the host collects them). */
  @Post(':token/travel')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiZodBody(GuestTravelSelfSchema)
  travel(@Param('token') token: string, @ZodBody(GuestTravelSelfSchema) body: GuestTravelSelfInput, @ReqMeta() meta: RequestMeta, @Req() req: Request) {
    return this.guestInvitations.submitTravel(token, body, meta, otpPass(req));
  }

  @Post(':token/otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendOtp(@Param('token') token: string) {
    return this.guestInvitations.sendOtp(token);
  }

  @Post(':token/otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Param('token') token: string, @ZodBody(OtpVerifySchema) body: z.infer<typeof OtpVerifySchema>) {
    return this.guestInvitations.verifyOtp(token, body.code);
  }
}
