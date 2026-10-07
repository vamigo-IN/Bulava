/**
 * Pages that handle accounts, guests' personal links and event data. They get
 * the strict, nonce-based Content-Security-Policy (src/middleware.ts), render
 * per request, and never load third-party analytics.
 */
const PRIVATE_PREFIXES = ['/dashboard', '/login', '/signup', '/invite', '/p', '/checkin', '/wall', '/e', '/preview', '/team'];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Public pages where people type personal details (the contact form). They stay
 * pre-rendered with the marketing CSP, but third-party trackers never load
 * there: some read form fields (Meta Pixel's automatic matching, session replays).
 */
const FORM_PATHS = ['/contact'];

/** Private pages and public forms: no trackers or custom code. */
export function isTrackerFreePath(pathname: string): boolean {
  return isPrivatePath(pathname) || FORM_PATHS.includes(pathname);
}
