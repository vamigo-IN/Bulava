# Architecture

Bulava is an event platform with a template engine, invitation engine, media platform, video engine and guest/RSVP platform. A wedding is the first major use case, not the shape of the system. Event categories, languages, plans and templates are data, so a new category or design needs rows, not code.

## Status

| Area | Status |
|---|---|
| Monorepo, PostgreSQL, Prisma schema and migrations, Redis | Done |
| Authentication (email + password, Google sign-in, rotating refresh sessions, two-step sign-in required for staff), account export and deletion | Done |
| Events, functions, guest groups, guests, assignments, access policies; event team roles with invitations by email and code, and a dashboard that shows each role only its sections | Done |
| Invitations with secure tokens, one shareable link for public, private-link and expiring secret-link events, RSVP with custom questions, OTP and PIN verification | Done |
| Templates as data, website renderer, 53 website + 20 video/card templates (including illustrated 3D scenes, films and the Signature collection) | Done |
| Template Studio and admin console (`apps/admin`) | Done |
| Media: one album per event with a QR code and a folder per function, signed uploads (team uploads skip moderation), processing worker, moderation, galleries by folder, live photo wall | Done |
| Guest logistics: VIP and dietary flags, stays, arrivals and departures, seating plans, guest-entered travel | Done |
| Video and card rendering (Remotion worker), background music | Done |
| Payments (Razorpay), plans, coupons, entitlements, refunds | Done |
| Notifications (in-app + email), announcements, scheduled RSVP and function reminders, analytics events | Done |
| Event-day QR check-in | Done |
| Public event registration (open by default for link-shared events) with capacity, waiting list and approval | Done |
| Event lifecycle (completed, archived) and retention purge | Done |
| Custom event domains (DNS ownership check, Cloudflare for SaaS certificates) | Done |
| Nonce-based CSP on private pages and the admin console; WCAG 2.1 AA audit of public, dashboard, guest and template pages | Done |
| Production compose, Nginx, CI/CD, backups, health checks, metrics, Sentry | Done |
| Super Admin console: branding, SEO and AI crawlers, trackers and custom code, integrations (Razorpay, SMTP, WhatsApp, Google Maps, custom domains, storage test), staff roles, user profiles, payment states, complimentary upgrades | Done |
| WhatsApp Business delivery (Meta Cloud API) with per-plan allowances; Google Maps on invitations | Done |
| Site pages edited in the console (About, Contact, policies, new pages), contact form with a staff inbox, payment status page | Done |
| SMS delivery, AI assistant | Not started (see Roadmap) |

## Core domain

```text
User ─┬─ EventMember(role) ── Event ─┬─ AccessPolicy          (how access is verified)
      │                               ├─ EventFunction ─┬─ AccessPolicy? (override; null = inherit)
      │                               │                 ├─ FunctionAudienceGroup ── GuestGroup
      │                               │                 └─ FunctionGuest (direct assignment / explicit deny)
      │                               ├─ GuestGroup ── GuestGroupMember ── Guest ─┬─ Registration?
      │                               │                                            ├─ GuestStay?, GuestTravel (arrival, departure)
      │                               │                                            └─ SeatAssignment (per function; never grants access)
      │                               ├─ Invitation (event-wide or function-specific) ── InvitationToken
      │                               ├─ RSVP (event-level or per function) ── RSVPAnswer ── RSVPQuestion
      │                               ├─ EventTemplateSelection (website / video / card) ── TemplateVersion
      │                               ├─ MediaRoom ── MediaItem          ├─ VideoJob ── GeneratedVideo
      │                               ├─ Announcement ── Notification    ├─ QRCode ── CheckIn
      │                               ├─ EventRegistrationSettings
      │                               └─ EventReminderSettings
      └─ Order ── Payment → Entitlement (per event, or per user for subscriptions)
```

EVENT, FUNCTION, AUDIENCE and ACCESS POLICY are separate models. A guest exists once per event, however many groups and functions they belong to.

### How a guest's visible functions are decided

The pure function `evaluateFunctionAccess` in `packages/auth` is the single decision point. The API loads facts (policy, audience groups, assignments, invitation scope) and asks it. The host dashboard's access matrix, the guest page, announcements and galleries all use the same code, so they cannot disagree. See [authorization.md](authorization.md).

## Repository layout

```text
bulava/
├── apps/
│   ├── api/            NestJS REST API (/api/v1), guards, domain modules, e2e tests
│   ├── web/            Next.js: marketing site, host dashboard, guest invitation, public event pages (design system: docs/web-design.md)
│   ├── admin/          Next.js staff console: Template Studio, catalog, pricing, users, moderation, operations
│   ├── worker/         BullMQ: notifications, email, analytics, cleanup and event lifecycle
│   ├── media-worker/   BullMQ: image validation, EXIF strip, WebP renditions, moderation routing
│   └── video-worker/   BullMQ: Remotion video and card rendering with Chrome Headless Shell
├── packages/
│   ├── config/         Shared strict tsconfig bases
│   ├── database/       Prisma schema, migrations, generated client, seed (reference data, catalog, admin)
│   ├── auth/           Pure access evaluation, RBAC matrices, token and crypto helpers (no I/O)
│   ├── validation/     Shared Zod schemas (API authoritative, web for UX)
│   ├── localization/   Language registry, message catalogs, IST-aware formatting
│   ├── template-schema/ TemplateDefinition schema, bindings, render context, checks, sample data
│   ├── template-engine/ React renderer for website templates (sections, looks, illustrated scenes, intros, ornaments, music)
│   ├── video-engine/   Remotion composition for video and card templates
│   ├── settings/       Super Admin settings: per-group values, encrypted secrets, environment fallback
│   ├── storage/        S3-compatible object storage client (R2 in production, SeaweedFS locally)
│   ├── domains/        Custom domains: hostname rules, DNS checks, certificate providers (Cloudflare for SaaS)
│   └── queue/          BullMQ queue names, payload types and defaults
├── templates/          @bulava/template-catalog: the seeded template definitions
├── infrastructure/     Dockerfiles, Nginx, scripts (env loader, smoke tests, backups, demo music)
├── .github/workflows/  CI and deployment
└── docs/
```

## API modules

All routes live under `/api/v1`, except health (`/health`, `/health/db`, `/health/redis`) and metrics (`/metrics`, token-protected). Tenant resources are nested under `/events/:eventId/...`, and `EventPermissionGuard` checks membership and the route's permission before any handler runs. Staff routes live under `/admin` and are guarded by `PlatformPermissionGuard`, which re-reads the platform role from the database on every request.

| Module | Main routes | Access |
|---|---|---|
| auth, users | `/auth/*` (including `/auth/login/mfa`, `/auth/mfa/*`, `/auth/google/*`, `/auth/password`), `/users/me`, `/users/me/export`, `DELETE /users/me` | public (rate limited) / signed in |
| members | `/events/:id/members` | `event.read` / `member.manage` |
| events, functions, groups, guests | `/events`, `/events/:id/{functions,groups,guests}` | event permissions |
| invitations, rsvp | `/events/:id/invitations`, `/rsvps`, `/rsvp-questions` | event permissions |
| guest access | `/public/invitations/:token` (+ `/rsvp`, `/otp`) | invitation token |
| design, templates | `/events/:id/design`, `/public/templates`, `/public/events/:slug` (+ `/pin`, `/register`) | event permissions / public |
| registrations | `/events/:id/registration`, `/events/:id/registrations` | event permissions |
| logistics | `/events/:id/logistics`, `/events/:id/guests/:guestId/logistics`, `/events/:id/functions/:fid/seating`, `/public/invitations/:token/travel` | `guest.read` / `guest.write` / invitation token |
| reminders | `/events/:id/reminders` (+ `/rsvp/send-now`) | `rsvp.read` / `invitation.send` |
| media | `/events/:id/media-rooms` (+ `/wall/rotate`), `/public/media-rooms/:code/*`, `/public/walls/:token` | event permissions / room code (+ invitation) / wall link |
| videos | `/events/:id/videos`, `/music` | event permissions |
| check-in | `/events/:id/check-ins/*`, `/public/check-in/:code/qr.svg` | event permissions |
| domains | `/events/:id/domain` (+ `/check`), `/public/domains/resolve` | `event.read` / `event.update` / public (used by the web middleware) |
| announcements, notifications | `/events/:id/announcements`, `/notifications` | event permissions / signed in |
| payments | `/events/:id/orders`, `/orders/:id` (+ `/verify`, `/checkout`), `/payments/razorpay/webhook` | signed in (the buyer's own orders) / HMAC |
| site pages | `/public/pages` (+ `/:slug`), `/admin/pages` | public / `page.manage` |
| contact | `/public/contact`, `/admin/contact-messages` | public (rate limited) / `contact.manage` |
| admin | `/admin/*` (templates, assets, music, licences, plans, coupons, users and profiles, staff, orders, complimentary upgrades, moderation, renders, audit) | platform permissions ([authorization.md](authorization.md#platform-roles)) |
| settings | `/admin/settings` (+ `/:group`, `/checks/:target`, `/site-assets`), `/public/site-config`, `/public/site-assets/:kind` | `settings.manage` (Super Admin) / public |

Full reference: [api.md](api.md) and Swagger at `/api/docs` outside production.

## Runtime architecture

```text
server's Nginx (TLS) ──> bulava-nginx ─┬─ bulava.in, www ──> web (Next.js :3000) ──┐
   127.0.0.1:18090                      ├─ admin.bulava.in ──> admin (Next.js :3001)─┤ /api/v1 same-origin
                                        ├─ /api/v1 (all sites) ─────────────────────┴─> api (NestJS :4000) ──> PostgreSQL
                                        └─ api.bulava.in ──> api                              │          └──> Redis (queues, rate limits)
                                                                                              └──> R2 (signed URLs only)
Redis queues ──> worker (:4101 health) · media-worker (:4102) · video-worker (:4103)
Browsers upload photos and download media directly from R2 with short-lived signed URLs.
```

- **Shares a server.** The server's own Nginx terminates TLS and proxies Bulava's hostnames to `bulava-nginx` on a loopback port, so Bulava can run next to other sites ([nginx.md](nginx.md), [deployment.md](deployment.md#sharing-a-server-with-other-sites)).
- **Same-origin API.** The web and admin apps proxy `/api/v1`, and in production Nginx routes it straight to the API. Session cookies are therefore first-party and httpOnly on each site, and customer and staff sessions are separate.
- **No heavy work in the API.** Image processing, rendering and delivery run in workers. Jobs carry ids only, never personal data, and handlers are idempotent.
- **Object storage is private.** Nothing is public-read. Every photo, video and track is served through a signed URL, issued only after an authorization check.

### Queues

| Queue | Producer | Consumer | Notes |
|---|---|---|---|
| media-processing | upload completion | media-worker | `MEDIA_WORKER_CONCURRENCY` (CPU bound) |
| video-render | VideoJob creation, admin retry | video-worker | `VIDEO_WORKER_CONCURRENCY` jobs × `VIDEO_RENDER_THREADS` tabs |
| notifications | announcements, invitations, RSVPs, registrations | worker | one job per Notification row |
| email | OTP codes and other direct mail | worker | not stored as notifications |
| analytics | API events | worker | stored, optionally forwarded to PostHog |
| cleanup | repeatable schedules | worker | expired sessions, stale uploads, event lifecycle, retention purge, reminders (every minute) |
| exports | reserved | — | exports are currently synchronous CSV responses |

Failures retry with exponential backoff (`DEFAULT_JOB_OPTIONS`). Failed renders are visible and retryable in the admin console.

## Roadmap

1. **SMS provider.** An SMS adapter behind the existing provider interface (SMS notifications are currently recorded as `SKIPPED`). WhatsApp Business is done ([notifications.md](notifications.md#whatsapp-business)).
2. **AI-assisted moderation** (`ModerationMode.AI_ASSISTED` is reserved and currently behaves like manual approval).
3. **Planner workspace** features on top of `Organization` (the `planner.workspace` feature key exists).
4. **Event assistant** (spec §85–86), after the core product settles.
5. **Phone sign-in** (`User.phone` is reserved), once an SMS provider exists.

Done from the earlier roadmap: Google sign-in ([authentication.md](authentication.md#google-sign-in)), custom domains ([custom-domains.md](custom-domains.md)) and the nonce-based CSP ([security.md](security.md)).

Architectural decisions are recorded in [decisions.md](decisions.md).
