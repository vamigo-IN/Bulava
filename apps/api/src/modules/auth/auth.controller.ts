import { Controller, Get, Header, HttpCode, Inject, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ClaimAccountSchema,
  EmailCodeResendSchema,
  EmailCodeSchema,
  EmailSignupSchema,
  EmailStartSchema,
  ForgotPasswordSchema,
  GoogleSignupSchema,
  LoginMfaSchema,
  LoginSchema,
  MfaDisableSchema,
  MfaEnableSchema,
  MfaRegenerateSchema,
  MfaSetupSchema,
  ResetPasswordSchema,
  RestoreAccountSchema,
  SetPasswordSchema,
  SignupSchema,
  type ClaimAccountInput,
  type EmailCodeInput,
  type EmailCodeResendInput,
  type EmailSignupInput,
  type EmailStartInput,
  type ForgotPasswordInput,
  type GoogleSignupInput,
  type LoginInput,
  type LoginMfaInput,
  type MfaDisableInput,
  type MfaEnableInput,
  type MfaRegenerateInput,
  type MfaSetupInput,
  type ResetPasswordInput,
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
import { EmailCodeService } from './email-code.service';
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_COOKIE_PATH, GoogleAuthService } from './google-auth.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { clearSessionCookies, finishSignIn, REFRESH_COOKIE, setSessionCookies } from './cookies';

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
    private readonly emailCodes: EmailCodeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Which sign-in methods the apps should offer. `emailCodes`: email codes can
   * be sent, which signing up with an email and resetting a password need.
   */
  @Public()
  @Get('providers')
  async providers() {
    const [google, phoneOtp, emailCodes] = await Promise.all([this.google.enabled(), this.phoneOtp.available(), this.emailCodes.available()]);
    return { google, phoneOtp, emailCodes };
  }

  /** An account without an email (made from a WhatsApp number) adds one with a password; a code to it comes first. */
  @Throttle(AUTH_THROTTLE)
  @Post('claim')
  @HttpCode(200)
  @ApiZodBody(ClaimAccountSchema)
  claim(@CurrentUser() user: AuthUser, @ZodBody(ClaimAccountSchema) body: ClaimAccountInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.claim(user.id, body, meta);
  }

  /** The code sent to the new address: it is added to the account. */
  @Throttle(AUTH_THROTTLE)
  @Post('claim/verify')
  @HttpCode(200)
  @ApiZodBody(EmailCodeSchema)
  claimVerify(@CurrentUser() user: AuthUser, @ZodBody(EmailCodeSchema) body: EmailCodeInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.completeClaim(user.id, body.challengeToken, body.code, meta);
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

  /** "Continue with Google" from the sign-in page (a top-level navigation). A new account is made on the page's last step (`google/signup`). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Get('google/start')
  async googleStart(@Query('next') next: string | undefined, @Res() res: Response) {
    if (!(await this.google.enabled())) return res.redirect(302, `${this.config.WEB_ORIGIN.replace(/\/$/, '')}/login?error=GOOGLE_UNAVAILABLE`);
    const { url, state } = await this.google.start({ next, mode: 'signin' });
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

  // ───── The one sign-in form (ADR-052): an email address ─────

  /**
   * The address typed in: an account with a password asks for it
   * (`method: 'password'`); any other address gets a code (`method: 'code'`).
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email/start')
  @HttpCode(200)
  @ApiZodBody(EmailStartSchema)
  emailStart(@ZodBody(EmailStartSchema) body: EmailStartInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.startEmail(body.email, meta);
  }

  /** "Email me a code": a sign-in code to the address, also for accounts with a password. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email/code')
  @HttpCode(200)
  @ApiZodBody(EmailStartSchema)
  emailCode(@ZodBody(EmailStartSchema) body: EmailStartInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.sendEmailCode(body.email, meta);
  }

  /** The emailed code: signed in (or the authenticator step, or the restore offer), or `signupRequired` with the token that makes the account. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email/verify')
  @HttpCode(200)
  @ApiZodBody(EmailCodeSchema)
  async emailVerify(@ZodBody(EmailCodeSchema) body: EmailCodeInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyEmailCode(body.challengeToken, body.code, meta);
    if ('signupRequired' in result) return result;
    return finishSignIn(res, result, this.config);
  }

  /** A new account for the address just proved: a name, the ticked Terms box and, if wanted, a password. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email/signup')
  @ApiZodBody(EmailSignupSchema)
  async emailSignup(@ZodBody(EmailSignupSchema) body: EmailSignupInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.signupWithEmail(body, meta), this.config);
  }

  /** The account's password: signed in (or the authenticator step, or the restore offer). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email/password')
  @HttpCode(200)
  @ApiZodBody(LoginSchema)
  async emailPassword(@ZodBody(LoginSchema) body: LoginInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.loginWithPassword(body, meta), this.config);
  }

  /** A new account from Google: the sign-in page's last step (a name and the ticked Terms box). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('google/signup')
  @ApiZodBody(GoogleSignupSchema)
  async googleSignup(@ZodBody(GoogleSignupSchema) body: GoogleSignupInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.google.completeSignup(body, meta), this.config);
  }

  /** Signing up with an email: nothing is saved yet; a code goes to the address (`signup/verify` makes the account). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup')
  @HttpCode(200)
  @ApiZodBody(SignupSchema)
  signup(@ZodBody(SignupSchema) body: SignupInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.signup(body, meta);
  }

  /** The code from the sign-up email: the account is made, its address confirmed, and the browser signed in. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup/verify')
  @ApiZodBody(EmailCodeSchema)
  async signupVerify(@ZodBody(EmailCodeSchema) body: EmailCodeInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.completeSignup(body.challengeToken, body.code, meta), this.config);
  }

  /**
   * Email and password. A right password is never a session by itself: the
   * answer asks for the authenticator code (`mfaRequired`) or for the code just
   * emailed (`emailCodeRequired`), or offers to restore an account waiting to be deleted.
   */
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
    if ('emailCodeRequired' in result) return result;
    return finishSignIn(res, result, this.config);
  }

  /** Second step of a password sign-in: the code emailed to the account's address. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login/email')
  @HttpCode(200)
  @ApiZodBody(EmailCodeSchema)
  async loginEmail(@ZodBody(EmailCodeSchema) body: EmailCodeInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.completeLogin(body.challengeToken, body.code, meta), this.config);
  }

  /** Another code for a step that is waiting for one, 30 seconds after the last. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('email-code/resend')
  @HttpCode(200)
  @ApiZodBody(EmailCodeResendSchema)
  resendEmailCode(@ZodBody(EmailCodeResendSchema) body: EmailCodeResendInput) {
    return this.auth.resendEmailCode(body.challengeToken);
  }

  /** "Forgot password?": a code to the address (the same answer whether or not it has an account). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password/forgot')
  @HttpCode(200)
  @ApiZodBody(ForgotPasswordSchema)
  forgotPassword(@ZodBody(ForgotPasswordSchema) body: ForgotPasswordInput, @ReqMeta() meta: RequestMeta) {
    return this.auth.forgotPassword(body.email, meta);
  }

  /** The reset code and a new password: other sessions end and this browser is signed in. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password/reset')
  @HttpCode(200)
  @ApiZodBody(ResetPasswordSchema)
  async resetPassword(@ZodBody(ResetPasswordSchema) body: ResetPasswordInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    return finishSignIn(res, await this.auth.resetPassword(body.challengeToken, body.code, body.newPassword, meta), this.config);
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
