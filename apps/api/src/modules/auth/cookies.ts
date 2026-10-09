import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../config/env';
import type { LoginResult } from './auth.service';
import type { IssuedSession } from './session.service';

export const ACCESS_COOKIE = 'bulava_at';
export const REFRESH_COOKIE = 'bulava_rt';
/** Refresh cookie is only sent to auth endpoints, limiting its exposure. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
/**
 * Readable by page scripts and carrying no secret: it only tells public pages
 * (which are cached and never see the httpOnly cookies) that someone is signed
 * in, so the header can show "My events". Access is always decided by the API.
 */
export const SESSION_HINT_COOKIE = 'bulava_session';

function base(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax' };
}

export function setSessionCookies(res: Response, session: IssuedSession, config: AppConfig): void {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...base(config),
    path: '/',
    expires: session.accessExpiresAt,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...base(config),
    path: REFRESH_COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
  res.cookie(SESSION_HINT_COOKIE, '1', { ...base(config), httpOnly: false, path: '/', expires: session.refreshExpiresAt });
}

export function clearSessionCookies(res: Response, config: AppConfig): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(config), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(config), path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...base(config), httpOnly: false, path: '/' });
}

/**
 * The end of a sign-in step: the session goes into cookies, or the next step
 * (the authenticator app, a restore offer) goes back to the page.
 */
export function finishSignIn(res: Response, result: LoginResult, config: AppConfig) {
  if ('mfaRequired' in result || 'restoreRequired' in result) return result;
  setSessionCookies(res, result.session, config);
  return { user: result.user, accessToken: result.session.accessToken, accessExpiresAt: result.session.accessExpiresAt };
}
