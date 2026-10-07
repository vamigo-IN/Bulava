# Security

## Implemented

| Control | Where |
|---|---|
| Tenant isolation: every event route checks membership (non-members get 404) and every query is scoped by `eventId` | `EventPermissionGuard`, services |
| Granular RBAC by permission, not role name; platform roles re-read from the database on every admin request | `packages/auth/src/permissions.ts`, `PlatformPermissionGuard` |
| Staff roles: six platform roles, each limited to its own area; exactly one Super Admin, enforced by a partial unique index; the role is handed over (password and two-step code), never assigned; the Super Admin cannot be suspended or re-roled; only the Super Admin manages staff, settings and complimentary upgrades ([authorization.md](authorization.md#platform-roles)) | `permissions.ts`, `AdminUsersService`, migration `single_super_admin` |
| Integration settings: each group validated before saving; integration keys stored AES-256-GCM encrypted and never sent back to a browser (the console shows only whether one is set and its last four characters); the audit log names the fields that changed, not their values; the public site configuration holds no keys | `@bulava/settings`, `PlatformSettingsService` |
| Trackers and the Super Admin's header/footer code run on public marketing pages only, loaded from a client effect (never inline); private pages never load them, and moving from a marketing page to a private one reloads the page. The marketing CSP gains exactly each tracker's hosts and the listed extra hosts, and only plain `https://host` sources pass validation, so settings cannot add directives | `components/analytics.tsx`, `lib/csp.ts`, `CSP_SOURCE` |
| Logo, favicon and share image: signed uploads limited by type and size, the stored object re-checked before use, served only through a signed redirect; form saves cannot repoint them | `PlatformSettingsService` |
| Server-side validation of every input with shared Zod schemas; ids from the URL, never the body | `ZodValidationPipe`, `ParseIdPipe` |
| scrypt password hashing, constant-time login path, per-email lockout | `AuthService` |
| Two-step sign-in (TOTP + one-time recovery codes), required for staff in production; encrypted secrets, replay-proof codes, per-account lockout, operator reset CLI | `MfaService`, `PlatformPermissionGuard`, `reset-mfa` |
| Google sign-in: OIDC code flow with PKCE, single-use state bound to the browser by an httpOnly cookie, nonce, ID token verified against Google's keys, verified emails only; never merged into an unverified password account; two-step sign-in still applies; unlinking needs a password | `GoogleAuthService` |
| Rotating refresh tokens stored as hashes; reuse detection revokes the family; suspension and role changes sign users out | `SessionService`, admin service, `set-role` |
| httpOnly, SameSite=Lax cookies (Secure in production); separate first-party sessions for the site and the admin console | `cookies.ts`, same-origin proxies |
| CSRF: custom header + Origin allowlist for cookie-authenticated mutations | `CsrfGuard` |
| Rate limits in Redis shared across replicas (global, auth, OTP, PIN, guest views, RSVP, registration, uploads) plus Nginx per-IP limits | `RedisThrottlerStorage`, `nginx.conf` |
| Invitation tokens: 256-bit random, SHA-256 hash + AES-256-GCM ciphertext, expiry, revocation, regeneration, use limits | `packages/auth`, `InvitationTokenService` |
| Guest verification: OTP codes (HMAC at rest, 10-minute expiry, attempt limits) and event PINs (scrypt), passes as signed httpOnly cookies | `OtpService`, `PublicEventsService` |
| Tokens, cookies and authorization headers redacted from logs; Nginx logs omit query strings | pino config, `nginx.conf` |
| Private pages (`/invite`, `/p`, `/checkin`): `no-referrer`, `noindex`, `no-store`, generic link previews; tokens for photo rooms and two-step challenges travel in URL fragments | `next.config.ts`, invite page, sign-in page |
| Security headers: Helmet on the API; CSP, frame, referrer and permissions policies on web and admin; HSTS from Bulava's Nginx | `bootstrap.ts`, `next.config.ts`, Nginx |
| Loopback-only exposure: the stack publishes a single port on `127.0.0.1` (Docker's firewall rules bypass UFW for `0.0.0.0` ports); the server's Nginx is the only way in; client IP headers are trusted only from loopback and Docker ranges, and replaced, never appended | `docker-compose.prod.yml`, `infrastructure/nginx/` |
| Nonce-based CSP: the admin console and every private web page (`/dashboard`, `/login`, `/signup`, `/invite`, `/p`, `/checkin`, `/wall`, `/e`) allow only scripts carrying the request's nonce, or loaded by them (`'strict-dynamic'`); no `'unsafe-inline'`; `object-src 'none'`; `frame-ancestors 'none'`; no third-party analytics on private pages | `middleware.ts` (web, admin), `lib/private-routes.ts` |
| Custom domains: ownership proven by a DNS TXT record before a domain serves anything; unverified claims cannot squat a name; lapsed domains switched off after three failed daily checks; only the event's own pages and guest links are served, everything else redirects to the main site; admin and payment APIs return 404 there; the CSRF allowlist includes only active customer domains | `DomainsService`, `@bulava/domains`, web middleware, Nginx |
| Object storage is private; every read and upload uses a short-lived signed URL issued after an authorization check; upload types and sizes checked, stored objects re-verified | `packages/storage`, media and admin services |
| Live photo walls: opt-in per album, 256-bit secret links (hash + ciphertext), rotatable, only approved shareable photos, closed with the event | `LiveWallService` |
| Guest logistics (rooms, travel, seats) shown only to that guest and only for functions they can see; guests cannot change host pickup notes; removed with the guest | `LogisticsService` |
| Images re-encoded without metadata (EXIF/GPS removed); decompression-bomb limit | media worker |
| Payments: amounts computed server-side, checkout and webhook signatures verified (HMAC, raw body), idempotent finalization under a row lock | `PaymentsService` |
| Public registration: consent recorded, duplicates refused, no link handed out for existing guests, row-locked capacity, per-IP rate limit | `RegistrationsService` |
| Licensed content only: assets and music need licences allowing commercial on-demand use before approval or playback | admin service, render context |
| Audit log for sign-in events, event/function/guest/access changes, invitations, RSVPs, registrations, payments, admin actions, lifecycle and purges | `AuditService` |
| Privacy: consent records, personal data export, account deletion (anonymization), event deletion with retention purge | users controller, worker lifecycle |
| Production config refuses dev secrets, insecure cookies and disabled rate limits | `config/env.ts` |
| Containers run as non-root with dropped capabilities and `no-new-privileges`; API and Alpine workers use read-only filesystems; Postgres and Redis are never published | Dockerfiles, `docker-compose.prod.yml` |
| Supply chain: `pnpm audit`, gitleaks secret scan and Trivy image scan in CI; `pnpm audit --prod` reports no known vulnerabilities at 1.0.0, with patched transitive versions pinned in the root `pnpm.overrides` where a direct dependency lags (for example `js-yaml` 5.x under `@nestjs/swagger`). Images carry runtime code only: Next's file tracing skips rspack (`outputFileTracingExcludes`), the video worker's Remotion bundler is a dev dependency, and the video worker applies Debian's security updates at build time | `.github/workflows/ci.yml`, `package.json`, `infrastructure/docker/` |
| Open-redirect protection on `?next=` in both apps | auth forms, admin login |

## Known gaps (tracked)

- Pre-rendered marketing pages (home, templates, pricing, legal) keep a static CSP with `'unsafe-inline'` scripts, because a per-request nonce would force them to render on every request and give up caching. They hold no session data or personal information, and the CSP still limits where scripts load from. Every page that shows account, guest or event data uses the nonce policy.
- The session hint cookie `bulava_session` is readable by scripts. It carries no secret (only `1`); the session itself stays in httpOnly cookies.
- Remotion renders fetch fonts from Google Fonts at render time; self-hosting the font files would remove that outbound dependency.
- Admin console access is protected by role and session; adding an IP allowlist (commented in the admin server block of `templates/bulava.conf.template`) or Cloudflare Access in front of the admin host is recommended (`nginx.md`).
- Uploaded SVG design assets are only ever displayed with `<img>` (scripts do not run there), but they are not sanitized; keep asset uploads limited to trusted staff. The same holds for an SVG logo or favicon.
- Header and footer code saved in the console runs with full script rights on marketing pages (within the hosts the CSP allows). Only the Super Admin can save it; paste code only from trusted providers.
- Integration keys are encrypted with `TOKEN_ENCRYPTION_KEY`, like invitation links. Rotating that key means entering them again in the console.
- The legal texts (privacy policy, terms) need review by counsel before launch (spec §84).

## Reporting

Do not open public issues for vulnerabilities. Contact the maintainers privately.
