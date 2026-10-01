/**
 * Pages that handle accounts, guests' personal links and event data. They get
 * the strict, nonce-based Content-Security-Policy (src/middleware.ts), render
 * per request, and never load third-party analytics.
 */
const PRIVATE_PREFIXES = ['/dashboard', '/login', '/signup', '/invite', '/p', '/checkin', '/wall', '/e', '/team'];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
