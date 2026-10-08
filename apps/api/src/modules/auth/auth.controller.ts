import { Controller, Get, Header, HttpCode, Inject, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ClaimAccountSchema,
  LoginMfaSchema,
  LoginSchema,
  MfaDisableSchema,
  MfaEnableSchema,
  MfaRegenerateSchema,
  MfaSetupSchema,
  RestoreAccountSchema,
  SetPasswordSchema,
  SignupSchema,
  type ClaimAccountInput,
  type LoginInput,
  type LoginMfaInput,
  type MfaDisableInput,
  type MfaEnableInput,
  type MfaRegenerateInput,
  type MfaSetupInput,
  type RestoreAccountInput,
  type SetPasswordInput,
  type SignupInput,
} from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { CurrentUser, Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { PhoneOtpService } from '../onboarding/phone-otp.service';
import { AccountService } from '../users/account.service';
import { AuthService, toPublicUser } from './auth.service';
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_COOKIE_PATH, GoogleAuthService } from './google-auth.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly google: GoogleAuthService,
    private readonly account: AccountService,
    private readonly phoneOtp: PhoneOtpService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Which sign-in methods the apps should offer. */
  @Public()
  @Get('providers')
  async providers() {
    const [google, phoneOtp] = await Promise.all([this.google.enabled(), this.phoneOtp.available()]);
    return { google, phoneOtp };
  }

  /** A provisional (WhatsApp-only) account adds an email and a password. */
  @Post('claim')
  @HttpCode(200)
  @ApiZodBody(ClaimAccountSchema)
  claim(@CurrentUser() user: AuthUser, @ZodBody(ClaimAccountSchema) body: ClaimAccountInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.claim(user.id, body, meta);
  }

  private setGoogleState(res: Response, state: string) {
    res.cookie(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: GOOGLE_STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
  }

  /** "Continue with Google" from the sign-in and sign-up pages (a top-level navigation). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Get('google/start')
  async googleStart(@Query('next') next: string | undefined, @Query('consent') consent: string | undefined, @Res() res: Response) {
    if (!(await this.google.enabled())) return res.redirect(302, `${this.config.WEB_ORIGIN.replace(/\/$/, '')}/login?error=GOOGLE_UNAVAILABLE`);
    // consent=1: the sign-up page's box was ticked, so a new account may be created (and its consent recorded).
    const { url, state } = await this.google.start({ next, mode: 'signin', consented: consent === '1' });
    this.setGoogleState(res, state);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
  }

  /** Connect Google to the signed-in account; the page then navigates to the returned URL. */
  @Throttle(AUTH_THROTTLE)
  @Post('google/link')
  @HttpCode(200)
  async googleLink(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const { url, state } = await this.google.start({ mode: 'link', userId: user.id, next: '/dashboard/account/security' });
    this.setGoogleState(res, state);
    return { url };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Get('google/callback')
  async googleCallback(
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @ReqMeta() meta: RequestMeta,
    @Res() res: Response,
  ) {
    const cookieState = (req.cookies as Record<string, string> | undefined)?.[GOOGLE_STATE_COOKIE];
    const result = await this.google.callback(
      { code: typeof query.code === 'string' ? query.code : undefined, state: typeof query.state === 'string' ? query.state : undefined, error: typeof query.error === 'string' ? query.error : undefined },
      cookieState,
      meta,
    );
    res.clearCookie(GOOGLE_STATE_COOKIE, { httpOnly: true, secure: this.config.COOKIE_SECURE, sameSite: 'lax', path: GOOGLE_STATE_COOKIE_PATH });
    if (result.kind === 'session') setSessionCookies(res, result.session, this.config);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, result.redirect);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('google/unlink')
  @HttpCode(200)
  async googleUnlink(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    await this.google.unlink(user.id, meta);
    return { googleLinked: false };
  }

  /** Set a first password, or change it. Other devices are signed out. */
  @Throttle(AUTH_THROTTLE)
  @Put('password')
  @ApiZodBody(SetPasswordSchema)
  async setPassword(@CurrentUser() user: AuthUser, @ZodBody(SetPasswordSchema) body: SetPasswordInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.setPassword(user.id, body, meta, user.mfa);
    setSessionCookies(res, session, this.config);
    return { hasPassword: true };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup')
  @ApiZodBody(SignupSchema)
  async signup(
    @ZodBody(SignupSchema) body: SignupInput,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.signup(body, meta);
    setSessionCookies(res, session, this.config);
    return { user, accessToken: session.accessToken, accessExpiresAt: session.accessExpiresAt };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiZodBody(LoginSchema)
  async login(
    @ZodBody(LoginSchema) body: LoginInput,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body, meta);
    // Two-step accounts: no session yet, only a challenge for the code step. Accounts waiting
    // to be deleted: no session either, only the offer to restore.
    if ('mfaRequired' in result || 'restoreRequired' in result) return result;
    const { user, session } = result;
    setSessionCookies(res, session, this.config);
    return { user, accessToken: session.accessToken, accessExpiresAt: session.accessExpiresAt };
  }

  /** Restores an account waiting to be deleted, with the token from signing in (password or Google). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('restore')
  @HttpCode(200)
  @ApiZodBody(RestoreAccountSchema)
  async restore(@ZodBody(RestoreAccountSchema) body: RestoreAccountInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const result = await this.account.restore(body.token, meta);
    if ('mfaRequired' in result) return result;
    setSessionCookies(res, result.session, this.config);
    return { user: result.user, accessToken: result.session.accessToken, accessExpiresAt: result.session.accessExpiresAt };
  }

  /** Second step of sign-in: an authenticator code or a recovery code. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login/mfa')
  @HttpCode(200)
  @ApiZodBody(LoginMfaSchema)
  async loginMfa(@ZodBody(LoginMfaSchema) body: LoginMfaInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { user, session, recoveryCodesRemaining } = await this.mfa.completeLogin(body, meta);
    setSessionCookies(res, session, this.config);
    return { user: toPublicUser(user), accessToken: session.accessToken, accessExpiresAt: session.accessExpiresAt, recoveryCodesRemaining };
  }

  @Get('mfa')
  @Header('Cache-Control', 'no-store')
  mfaStatus(@CurrentUser() user: AuthUser) {
    return this.mfa.status(user.id).then((s) => ({ ...s, sessionVerified: user.mfa }));
  }

  @Throttle(AUTH_THROTTLE)
  @Post('mfa/setup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiZodBody(MfaSetupSchema)
  mfaSetup(@CurrentUser() user: AuthUser, @ZodBody(MfaSetupSchema) body: MfaSetupInput, @ReqMeta() meta: RequestMeta) {
    return this.mfa.beginSetup(user.id, body.password, meta);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('mfa/enable')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiZodBody(MfaEnableSchema)
  async mfaEnable(@CurrentUser() user: AuthUser, @ZodBody(MfaEnableSchema) body: MfaEnableInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { recoveryCodes, session } = await this.mfa.enable(user.id, body.code, meta);
    setSessionCookies(res, session, this.config);
    return { enabled: true, recoveryCodes };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('mfa/disable')
  @HttpCode(200)
  @ApiZodBody(MfaDisableSchema)
  async mfaDisable(@CurrentUser() user: AuthUser, @ZodBody(MfaDisableSchema) body: MfaDisableInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const session = await this.mfa.disable(user.id, body, meta);
    setSessionCookies(res, session, this.config);
    return { enabled: false };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('mfa/recovery-codes')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiZodBody(MfaRegenerateSchema)
  async mfaRecoveryCodes(@CurrentUser() user: AuthUser, @ZodBody(MfaRegenerateSchema) body: MfaRegenerateInput, @ReqMeta() meta: RequestMeta) {
    return { recoveryCodes: await this.mfa.regenerateRecoveryCodes(user.id, body.code, meta) };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshToken(req);
    if (!token) throw new AppError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
    try {
      const session = await this.sessions.rotate(token, meta);
      setSessionCookies(res, session, this.config);
      return { accessToken: session.accessToken, accessExpiresAt: session.accessExpiresAt };
    } catch (error) {
      clearSessionCookies(res, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshToken(req);
    if (token) await this.sessions.revoke(token);
    clearSessionCookies(res, this.config);
    return { loggedOut: true };
  }
}

function readRefreshToken(req: Request): string | null {
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (fromCookie) return fromCookie;
  // Non-browser clients may send the refresh token in the body.
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  return typeof fromBody === 'string' && fromBody.length > 0 && fromBody.length < 200 ? fromBody : null;
}
