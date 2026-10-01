# Authentication

## Hosts (users)

Email and password, or **Continue with Google** (below). Phone sign-in is planned; `User.phone` is reserved for it. Staff use the same accounts with a platform role ([template-studio.md](template-studio.md)).

| Step | Behaviour |
|---|---|
| Signup | Zod-validated. Email is lowercased and stored as `citext`. Password is at least 10 characters and hashed with scrypt (N=2^15, r=8, p=1, 16-byte salt). |
| Login | Constant-time path for unknown emails (a dummy hash is verified). 10 failures per email lock that email for 15 minutes (Redis). 10 requests per minute per IP. Accounts with two-step sign-in get a challenge instead of a session (below). |
| Access token | HS256 JWT, 15 minutes, `iss=bulava-api`, `aud=bulava`, claims `sub` + `pr` (platform role) and `mfa: true` when the session passed two-step sign-in. |
| Refresh token | 256-bit random value. Only its SHA-256 hash is stored in `sessions`. 30 days. |
| Rotation | Each refresh marks the old session `rotatedAt` and issues a new one in the same `familyId`. The conditional update makes concurrent rotations safe. |
| Reuse detection | Presenting an already-rotated token more than 10 seconds after rotation revokes the whole family. The grace window absorbs two-tab races. |
| Logout | Revokes the family and clears the session cookies. |
| Password | `PUT /auth/password` sets a first password (accounts created with Google) or changes it (the current password is required). Every other session is ended and a fresh one issued (`user.password_set` / `user.password_changed`). |

### Two-step sign-in (TOTP)

Any account can add an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others). Staff need it: with `STAFF_MFA_REQUIRED` (the default in production, and it cannot be turned off there) every admin route answers `403 MFA_REQUIRED` until the session has passed a second factor.

| Step | Behaviour |
|---|---|
| Enrol | `POST /auth/mfa/setup` with the password returns a new 160-bit secret, its `otpauth://` URI and a QR code (SVG). The secret waits in Redis for 10 minutes, encrypted; nothing changes on the account yet. |
| Confirm | `POST /auth/mfa/enable` with a live 6-digit code stores the secret AES-GCM encrypted, creates 10 recovery codes (shown once, stored as SHA-256 hashes), **ends every other session** and issues a fresh verified session. |
| Sign in | `POST /auth/login` with a correct password returns `{ mfaRequired, challengeToken }` and no cookies. `POST /auth/login/mfa` with the challenge and a code (or one recovery code) issues the session. Challenges live 5 minutes and die after 5 wrong codes; 10 wrong codes per account lock the second factor for 15 minutes. |
| Codes | RFC 6238, HMAC-SHA1, 30-second steps, one step of drift either way. The last accepted step is stored and a conditional update claims each new one, so a code can never be used twice, even by two requests at once. |
| Recovery | Each recovery code works once (`usedAt`). `POST /auth/mfa/recovery-codes` with a live code replaces them. |
| Turn off | `POST /auth/mfa/disable` needs the password and a code, deletes the secret and codes and ends every session. Staff cannot turn it off from the UI while it is required. |
| Lost device | An operator runs `pnpm admin:reset-mfa <email>` after verifying the person out of band. It is audited and signs the account out everywhere. |
| Sessions | The session row records `mfa`, and refresh keeps it, so a rotated token stays verified. |

Every step is in the audit log (`user.mfa_enabled`, `user.mfa_disabled`, `user.mfa_recovery_used`, `user.mfa_recovery_regenerated`, failed `user.mfa_verify`). The web app offers it under **Account**, and the admin console under **Security**, where staff without a second factor are sent to set one up before the console opens.

### Google sign-in

"Continue with Google" is the OpenID Connect authorization code flow with PKCE, implemented in `GoogleAuthService` with `jose` for ID token verification. The button appears only when `GET /auth/providers` reports `google: true`, which requires both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

| Step | Behaviour |
|---|---|
| Start | `GET /auth/google/start?next=` stores the flow in Redis for 10 minutes: the PKCE verifier, the nonce, a same-site `next` path and the mode. The random `state` goes into Redis (as a hash) and into the httpOnly cookie `bulava_google_state`, scoped to `/api/v1/auth/google`. The browser is sent to Google with `scope=openid email profile`, an S256 code challenge and `prompt=select_account`. |
| Callback | `GET /auth/google/callback` needs the `state` in the query to match the cookie, and consumes the Redis entry (`GETDEL`), so a callback URL cannot be replayed or planted in another browser (login CSRF). The code is exchanged with the verifier. The ID token is verified against Google's published keys (issuer, audience = client id, expiry with 60 s tolerance, nonce), and only `email_verified` addresses are accepted. |
| Accounts | The Google subject (`User.googleSub`, unique) identifies the account. A new email creates an account with a verified email and no password (`user.signup`, method `google`). An existing account with that email is linked automatically **only if its email was verified**. Bulava does not verify emails at sign-up, so a password account instead gets `GOOGLE_LINK_REQUIRED`: someone who registers another person's address first can never capture their Google sign-in, and the owner links Google from **Account** while signed in. |
| Two-step | Accounts with an authenticator still need it. The callback creates the usual two-step challenge and redirects to `/login#mfa=<challenge>`. The fragment is never sent to servers or logged, and the sign-in page continues at the code step. |
| Link / unlink | `POST /auth/google/link` (signed in) starts the same flow in link mode and records the subject on the current user. It refuses a Google account already linked elsewhere (`GOOGLE_ALREADY_LINKED`). `POST /auth/google/unlink` needs the account to have a password (`GOOGLE_UNLINK_BLOCKED`), so nobody locks themselves out. |
| Errors | Failures redirect to `/login?error=<CODE>` (or `/dashboard/account?google=<CODE>` when linking) with a translated message: `GOOGLE_UNAVAILABLE`, `GOOGLE_FAILED`, `GOOGLE_CANCELLED`, `GOOGLE_LINK_REQUIRED`, `GOOGLE_ALREADY_LINKED`. |

Everything is audited (`user.login` / `user.signup` with method `google`, `user.google_linked`, `user.google_unlinked`, and failed `user.google_signin` with a reason). Accounts without a password can add one under **Account → Sign-in methods**. Turning on two-step sign-in asks for the password, so those accounts set one first.

**Setup:**

1. In Google Cloud Console → APIs & Services, configure the OAuth consent screen (external, app name Bulava, scopes `openid`, `email`, `profile`).
2. Create an OAuth client ID of type *Web application*.
3. Add the authorised redirect URI `<WEB_ORIGIN>/api/v1/auth/google/callback`, for example `https://bulava.in/api/v1/auth/google/callback` and, for development, `http://localhost:3000/api/v1/auth/google/callback`.
4. Put the id and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and restart the API. Set both or neither; the API refuses to start with only one.

### Cookies

| Cookie | Path | Flags | Lifetime |
|---|---|---|---|
| `bulava_at` (access JWT) | `/` | httpOnly, SameSite=Lax, Secure in production | 15 min |
| `bulava_rt` (refresh) | `/api/v1/auth` | httpOnly, SameSite=Lax, Secure in production | 30 days |
| `bulava_session` (hint) | `/` | readable by scripts, SameSite=Lax, Secure in production | 30 days |
| `bulava_google_state` | `/api/v1/auth/google` | httpOnly, SameSite=Lax, Secure in production | 10 min |

The refresh cookie is only sent to auth endpoints. `bulava_session=1` carries no secret: it only tells public pages that a session probably exists, so the header can show *My events* and the account instead of *Sign in*, without calling the API for every visitor. The web app confirms it with `/users/me` (refreshing once on a 401) and clears it when the session is gone. On `localhost` all ports share cookies, so the admin console on port 3001 sees a web session in development; in production the two apps live on separate hosts with separate sessions. Non-browser clients may use `Authorization: Bearer <access>` and send `refreshToken` in the body of `/auth/refresh`.

### CSRF

Cookie-authenticated state-changing requests must send `X-Bulava-CSRF: 1`. A cross-site page cannot add a custom header without a CORS preflight, and CORS only allows Bulava origins. If an `Origin` header is present it must be allowed. Bearer-token requests skip the header check. Third-party webhooks will opt out with `@SkipCsrf()`.

### Web client

`apps/web/src/lib/api.ts` sends the CSRF header. On a 401 it calls `/auth/refresh` once (deduplicated across concurrent requests) and retries. If refresh fails it redirects to `/login?next=...`. The `next` parameter only accepts same-site relative paths. `lib/session.ts` (`loadSession`, `useSession`) gives public pages the signed-in state. The sign-in and sign-up pages send an already signed-in visitor on to `next` or the dashboard, and "Get started" links switch to the dashboard.

## Guests

Guests have no account. The invitation token in `/invite/<token>` is the credential; see [authorization.md](authorization.md). Hosts can additionally require a one-time email code (`requireOtp`), and private-link events can require a PIN. A future guest dashboard ("My Invitations") will link invitations to a verified identity.

## Configuration

| Variable | Notes |
|---|---|
| `JWT_ACCESS_SECRET` | At least 32 characters. The dev value is rejected when `NODE_ENV=production`. |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | Defaults 900 and 30. |
| `COOKIE_SECURE` | Must be `true` in production. |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes base64. Encrypts invitation tokens (so hosts can re-copy links), TOTP secrets and live-wall links. Dev value rejected in production. |
| `STAFF_MFA_REQUIRED` | Staff need two-step sign-in for admin routes. Defaults to `true` in production (and `false` is refused there), `false` elsewhere. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enable Google sign-in; both or neither. |
| `GOOGLE_REDIRECT_URI` | Optional; defaults to `<WEB_ORIGIN>/api/v1/auth/google/callback`. |
| `GOOGLE_ISSUER`, `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_JWKS_URL` | Google's endpoints by default; the e2e suite points them at a local mock provider. |
