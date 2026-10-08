# Authentication

## Hosts (users)

Email and password, **Continue with Google**, or a **WhatsApp number with a one-time code** (below). Most accounts now begin on a template page: the quick start makes a *provisional* account from a WhatsApp number alone, which designs and previews but must be secured before it publishes, pays or invites. Staff use the same accounts with a platform role ([template-studio.md](template-studio.md)).

| Step | Behaviour |
|---|---|
| Signup | Zod-validated. Email is lowercased and stored as `citext`. Password is at least 10 characters and hashed with scrypt (N=2^15, r=8, p=1, 16-byte salt). `acceptTerms: true` is required: the sign-up form's Terms and Privacy box is never pre-ticked, and the API records two `consents` rows (`terms_of_service`, `privacy_policy`) with the version of each policy (`terms@<page updatedAt>`) and the source (`signup`, or `signup_google`). |
| Deletion | `DELETE /users/me` `{ password }` (or `{ confirm: "DELETE" }` for accounts without a password) takes the owner's events offline (`deletedAt` = the request time), ends every session and sets the account to `PENDING_DELETION` for `ACCOUNT_RESTORE_DAYS` (30). The right password, or Google, then returns `{ restoreRequired, restoreToken, deleteAt }` instead of a session; `POST /auth/restore` `{ token }` (one use, 15 minutes) brings back the account and exactly the events that went offline with it, then signs in (or asks for the two-step code). After the window the worker (`purgeDeletedAccounts`, daily) sends a last email and erases the personal fields, sessions, codes, notifications and team places; the events are purged with their photos in the same run. Orders, payments, consents and the audit log keep the bare account id. The Super Admin must hand the role over first, and staff can't reactivate an account that is waiting to be deleted. |
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

"Continue with Google" is the OpenID Connect authorization code flow with PKCE, implemented in `GoogleAuthService` with `jose` for ID token verification. The button appears only when `GET /auth/providers` reports `google: true`: the Super Admin has set up an OAuth client in the console (Integrations → Google sign-in) and left it switched on. Until that group is first saved, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are used instead ([ADR-043](decisions.md)).

| Step | Behaviour |
|---|---|
| Start | `GET /auth/google/start?next=` stores the flow in Redis for 10 minutes: the PKCE verifier, the nonce, a same-site `next` path and the mode. The random `state` goes into Redis (as a hash) and into the httpOnly cookie `bulava_google_state`, scoped to `/api/v1/auth/google`. The browser is sent to Google with `scope=openid email profile`, an S256 code challenge and `prompt=select_account`. |
| Callback | `GET /auth/google/callback` needs the `state` in the query to match the cookie, and consumes the Redis entry (`GETDEL`), so a callback URL cannot be replayed or planted in another browser (login CSRF). The code is exchanged with the verifier. The ID token is verified against Google's published keys (issuer, audience = client id, expiry with 60 s tolerance, nonce), and only `email_verified` addresses are accepted. |
| Accounts | The Google subject (`User.googleSub`, unique) identifies the account. A new email creates an account with a verified email and no password (`user.signup`, method `google`), but only when the flow started from the sign-up page with the Terms and Privacy box ticked (`/auth/google/start?consent=1`; the consents are recorded with source `signup_google`); from the sign-in page a new Google account is sent to `/signup?error=CONSENT_REQUIRED`. An account waiting to be deleted is offered a restore (`/login#restore=<token>&until=<date>`). An existing account with that email is linked automatically **only if its email was verified**. Bulava does not verify emails at sign-up, so a password account instead gets `GOOGLE_LINK_REQUIRED`: someone who registers another person's address first can never capture their Google sign-in, and the owner links Google from **Account** while signed in. |
| Two-step | Accounts with an authenticator still need it. The callback creates the usual two-step challenge and redirects to `/login#mfa=<challenge>`. The fragment is never sent to servers or logged, and the sign-in page continues at the code step. |
| Link / unlink | `POST /auth/google/link` (signed in) starts the same flow in link mode and records the subject on the current user. It refuses a Google account already linked elsewhere (`GOOGLE_ALREADY_LINKED`). `POST /auth/google/unlink` needs the account to have a password (`GOOGLE_UNLINK_BLOCKED`), so nobody locks themselves out. |
| Errors | Failures redirect to `/login?error=<CODE>` (or `/dashboard/account/security?google=<CODE>` when linking) with a translated message: `GOOGLE_UNAVAILABLE`, `GOOGLE_FAILED`, `GOOGLE_CANCELLED`, `GOOGLE_LINK_REQUIRED`, `GOOGLE_ALREADY_LINKED`. |

Everything is audited (`user.login` / `user.signup` with method `google`, `user.google_linked`, `user.google_unlinked`, and failed `user.google_signin` with a reason). Accounts without a password can add one under **Account → Sign-in & security**. Turning on two-step sign-in asks for the password, so those accounts set one first.

**Setup:**

1. In Google Cloud Console → APIs & Services, configure the OAuth consent screen: external, the site's name and logo, a support email, the privacy policy and terms links, and the scopes `openid`, `email`, `profile`. Publish the app ("In production"), or only test users can sign in.
2. Create an OAuth client ID of type *Web application*.
3. Add the authorised redirect URI the console shows, `<WEB_ORIGIN>/api/v1/auth/google/callback`: for example `https://bulava.in/api/v1/auth/google/callback` and, for development, `http://localhost:3000/api/v1/auth/google/callback`.
4. In the admin console → Integrations → **Google sign-in**, paste the client ID and secret, save, and run the check. It sends Google a made-up code: Google answers `invalid_grant` when the client ID and secret are right and `invalid_client` when they are not. Changes apply within 15 seconds, without a restart; the switch on the card hides the button without forgetting the client.

The environment variables still work as a fallback until the console saves the group (the first save copies them). Set both or neither; the API refuses to start with only one.

### Quick start, WhatsApp codes and provisional accounts

The template page's **Use this template** opens the quick start for visitors who are not signed in: the host's names (or the honoree, or an event name), a date, a WhatsApp number and the Terms box. `POST /public/quick-start` does, in one request: creates the account (`provisional: true`, `phone`, consents `terms_of_service` + `privacy_policy` with source `quick_start`, and `whatsapp_updates` only when that second, optional box is ticked), creates the draft event with the type's default functions (the chosen day goes on the main function), applies the chosen design whatever its tier, queues the preview link to WhatsApp (when the integration has a `preview` template) and signs the browser in with the usual cookies. The response carries the event id and the preview URL. Six requests per minute per IP.

| Step | Behaviour |
|---|---|
| A number that already has an account | The owner must prove it: the API answers `{ requiresOtp: true, target }` and sends a code; `POST /public/quick-start/verify` with the same form plus the code finishes the quick start under that account and marks the number verified. Numbers of suspended or deleted accounts get `PHONE_TAKEN`. |
| Codes | Six digits, HMAC'd at rest in `otp_challenges` (`purpose` `phone:login` or `phone:quick-start`), 10 minutes, 5 attempts, 3 sends per number per 10 minutes. They travel only in the `whatsapp` queue (the worker sends the integration's **authentication** template with the code in the body and on its copy-code button). Without the integration or that template, production answers `PHONE_OTP_UNAVAILABLE` and the UI offers email instead; development logs the code. |
| Sign in with a number | `POST /auth/phone/otp` `{ phone }` answers `{ sent: true, target }` whether or not the number has an account (no lookups); a code is sent only when it does. `POST /auth/phone/verify` `{ phone, code }` issues the session (or the two-step challenge, or the restore offer for an account waiting to be deleted), sets `phoneVerifiedAt` and clears `provisional`. |
| Provisional accounts | `User.provisional` is true for an account made from a number alone. It may design, preview and edit functions, but `PATCH /events/:id { status: "ACTIVE" }`, `POST /events/:id/orders`, sending invitations and adding team members answer `403 ACCOUNT_UNVERIFIED` (`assertVerifiedAccount`). The dashboard shows a banner and **Secure my account** (`/dashboard/claim`). |
| Securing | Any one of: a verified code on the number (`/auth/phone/verify` or the quick start's code step), `POST /auth/claim` `{ email, password }` (unique email, `user.claimed`), or linking Google. Each clears `provisional`. `GET /users/me` carries `phone`, `provisional` and `whatsappUpdates`; `PATCH /users/me` changes the name, the number (which then needs verifying again) and the updates consent (every change is a `consents` row). |
| Sign-up form | `POST /auth/signup` also takes an optional `phone` (unique, `PHONE_TAKEN`) and `whatsappUpdates`, recorded as its own consent. |

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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in until it is saved in the console (Integrations → Google sign-in); both or neither. |
| `GOOGLE_REDIRECT_URI` | Optional; defaults to `<WEB_ORIGIN>/api/v1/auth/google/callback`. |
| `GOOGLE_ISSUER`, `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_JWKS_URL` | Google's endpoints by default; the e2e suite points them at a local mock provider. |
