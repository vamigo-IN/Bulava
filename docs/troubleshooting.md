# Troubleshooting

**`Invalid environment configuration` on API start.**
The API validates `.env` with Zod at boot. The message lists each bad variable. In production, dev secrets, `COOKIE_SECURE=false` and `RATE_LIMIT_DISABLED=true` are rejected on purpose.

**`CSRF_REJECTED: Missing CSRF header`.**
Browser mutations must send `X-Bulava-CSRF: 1`. The web client does this automatically. For curl, add `-H 'x-bulava-csrf: 1'` or authenticate with a bearer token.

**Everyone gets `RATE_LIMITED` in production.**
Rate limits key on client IP. Behind proxies, set `TRUST_PROXY`, for example `loopback,uniquelocal` for Docker networks, or the number of proxy hops. Otherwise all traffic appears to come from the proxy.

**Invitation link shows "not available yet".**
The event is still `DRAFT`. Publish it from the dashboard Overview tab (`PATCH /events/:id {"status":"ACTIVE"}`).

**Host cannot re-copy an invitation link (url is null).**
The token ciphertext could not be decrypted, usually because `TOKEN_ENCRYPTION_KEY` changed. Use "Regenerate link".

**`prisma migrate dev` reports drift.**
Something changed the schema outside migrations. Do not reset shared databases. Inspect with `prisma migrate diff`, then create a corrective migration.

**E2E tests fail with `TEST_DATABASE_URL must be set`.**
Copy `.env.example` to `.env`. The `bulava_test` database is created by `infrastructure/docker/postgres/init.sql` on first container start. If your Postgres volume predates that script, run `CREATE DATABASE bulava_test;` once.

**Web build fails fetching Google Fonts.**
`next/font` downloads fonts at build time, so the build machine needs internet access.

**Windows: `pnpm` not found after install.**
Run `npm i -g pnpm@9.15.0`, or enable corepack from an elevated shell.

**Photo uploads fail in the browser (CORS error on PUT).**
The bucket must allow `PUT` and `GET` from the web and admin origins with the `Content-Type` header. Locally, `STORAGE_CORS_ORIGINS` configures SeaweedFS; in production, add a CORS rule to the R2 bucket ([deployment.md](deployment.md)).

**Emails never arrive.**
Check the notification rows (`notifications.status` / `error`). `SKIPPED: Email provider not configured` means `SMTP_HOST` is missing in the worker's environment. Locally, open Mailpit at http://localhost:8025.

**Photos stay "processing".**
The media worker is not running or cannot reach storage. Check `:4102/health` and its logs. Uploads that never complete are cleaned up after 24 hours.

**Video renders fail immediately.**
See [video-rendering.md](video-rendering.md#troubleshooting): usually Chrome libraries, `/dev/shm`, or no outbound access to Google Fonts. Failed renders can be retried from the admin console.

**Music does not play on an invitation.**
Browsers only allow audio after a tap: music starts when the guest opens the invitation or presses the music button. The track must be approved with a current commercial, on-demand licence, and the template must allow music.

**The admin console says "no admin access".**
The account has no platform role. The Super Admin gives roles in Staff & roles. With no Super Admin yet, set `ADMIN_EMAIL` / `ADMIN_PASSWORD` and run the seed (the account becomes the Super Admin), or use `pnpm admin:set-role you@example.com PLATFORM_ADMIN` for an existing account, then sign in again.

**A console page says "Your role does not allow this."**
The page belongs to another role (see [authorization.md](authorization.md#platform-roles)). Site settings, integrations, Staff & roles and complimentary upgrades belong to the Super Admin alone. If the only Super Admin has lost access, move the role on the server: `pnpm admin:set-role <email> SUPER_ADMIN --replace`.

**A setting saved in the console does not seem to apply.**
Every process re-reads settings within about 15 seconds, and public pages cache the site configuration for a minute. A value that stopped passing validation is ignored, and the settings card says which one. Until a group is saved in the console, the server keeps using the matching environment variables.

**`prisma migrate dev` refuses to run in CI or scripts.**
It needs an interactive terminal when a migration drops data. Generate SQL with `prisma migrate diff … --script` and commit it as a new migration ([database.md](database.md)).

**Seeding creates new template versions every time.**
That was a key-order comparison bug, now fixed: `seed:templates` compares definitions ignoring key order and only publishes real changes.

**Next build fails on an ESLint rule.**
Next's built-in lint is disabled during builds (`eslint.ignoreDuringBuilds`) because the monorepo lints once with `pnpm lint`. Run that instead.

**Windows: a stopped dev server keeps its port.**
Stopping a wrapper shell can leave the child `node` process running. Find it with `Get-NetTCPConnection -LocalPort <port>` and stop that process id.


**Staff see "Set up two-step sign-in" and cannot reach the console.**
Production requires a second factor for staff (`STAFF_MFA_REQUIRED`). Follow the on-screen setup with an authenticator app. Someone who lost their phone and recovery codes needs an operator: `pnpm admin:reset-mfa <email>` (audited, signs them out everywhere). Locally the requirement is off unless you set `STAFF_MFA_REQUIRED=true`.

**Reminders do not go out.**
They are sent by the general worker's `reminders` job (every minute), not the API. Check that the worker runs, that the event is **Active**, and that guests have an email address and a live invitation. RSVP reminders skip guests who have replied; function reminders skip guests who declined. Without SMTP settings, email rows are `SKIPPED`.

**The live wall shows "not available".**
The album's wall is switched off, the link was replaced with **New link**, or the event is no longer active or completed. Copy the current link from the Photos tab. Only approved photos that are images appear.

**React hydration error #418 on dynamic pages.**
Seen on slow devices when Next.js streamed metadata into a Suspense boundary at the top of `<body>` and the cached app bundle started hydrating before it resolved. `htmlLimitedBots: /.*/` in `apps/web/next.config.ts` renders metadata in `<head>` instead; keep it unless Next.js fixes the race. Reproduce timing bugs by saturating the CPU while replaying pages (see ADR-025).
