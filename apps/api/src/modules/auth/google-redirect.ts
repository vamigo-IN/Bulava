import type { AppConfig } from '../../config/env';

/**
 * Where Google sends people back after "Continue with Google": the site's own
 * address, unless GOOGLE_REDIRECT_URI overrides it. The console shows it so the
 * Super Admin can list it on the OAuth client in Google Cloud.
 */
export function googleRedirectUri(config: Pick<AppConfig, 'WEB_ORIGIN' | 'GOOGLE_REDIRECT_URI'>): string {
  return config.GOOGLE_REDIRECT_URI ?? `${config.WEB_ORIGIN.replace(/\/$/, '')}/api/v1/auth/google/callback`;
}
