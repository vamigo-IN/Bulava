# Bulava

India-first platform for events, digital invitations, RSVPs and event media. Weddings are the first use case, but the core is a multi-tenant event platform: any event category (birthday, mundan, griha pravesh, puja, corporate, community…) works without changes to the core.

**What works today:** hosts create events with functions, guest groups and access rules; design a website invitation from 53 templates (including the illustrated 3D and cinematic *Signature* collections with opening animations and music) or render 17 video invitations and 3 cards; share one event link or personal invitations by WhatsApp or email; collect RSVPs with automatic reminders; take registrations from the event link; manage guests' stays, travel, pickups and seating; run one photo album per event (a QR code, a folder per function, photographers uploading straight in), a live photo wall and event-day check-in; invite their team by email with a one-use code; serve the event from their own domain; and pay for upgrades with Razorpay. Hosts sign in with email and password or Google, with optional two-step sign-in. Staff manage templates, licensed assets and music, pricing, users, moderation and operations in the admin console. See [docs/architecture.md](docs/architecture.md) for status and roadmap, and [CHANGELOG.md](CHANGELOG.md) for releases (current: 1.0.0).

## Stack

| Layer | Technology |
|---|---|
| Web and admin | Next.js 15 (App Router), React 19, Tailwind CSS 4, TanStack Query, Zod |
| API | NestJS 11, Prisma 6, PostgreSQL 16, Redis 7, pino, OpenAPI, Prometheus metrics, Sentry |
| Workers | BullMQ; sharp (photos); Remotion 4 + Chrome Headless Shell + FFmpeg (videos); nodemailer (email) |
| Storage | Cloudflare R2 in production, SeaweedFS locally (S3 API, signed URLs only) |
| Payments | Razorpay (orders, checkout signatures, webhooks) |
| Infra | pnpm monorepo, Docker Compose (can share a server behind its existing Nginx), GitHub Actions |

## Quick start

Prerequisites: Node 22+, pnpm 9, Docker.

```bash
cp .env.example .env            # set ADMIN_EMAIL / ADMIN_PASSWORD to get a staff account
pnpm install
pnpm infra:up                   # postgres, redis, S3 storage and Mailpit on 127.0.0.1
pnpm build:packages             # shared packages (generates the Prisma client)
pnpm db:deploy                  # apply migrations
pnpm db:seed                    # event types, languages, plans, templates, platform admin
pnpm dev:api                    # http://localhost:4000   (Swagger: /api/docs)
pnpm dev:web                    # http://localhost:3000
pnpm dev:admin                  # http://localhost:3001   (staff console)
pnpm dev:workers                # notifications, photos, videos
```

Open http://localhost:3000, create an account and an event, pick a design, and share invitation links from the Invitations tab. Mail sent in development appears in Mailpit at http://localhost:8025. `node infrastructure/scripts/demo-music.mjs` adds an original demo track to the music library.

To run everything in containers instead (web, admin, API and workers, with local storage and Mailpit): `docker compose up -d --build`, without `pnpm infra:up` and the `dev:*` commands, which use the same ports.

## Commands

| Command | Purpose |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ESLint and strict TypeScript across the workspace |
| `pnpm test` | unit tests for all packages and apps* |
| `pnpm test:e2e` | API end-to-end suites (needs `pnpm infra:up`)* |
| `pnpm smoke:ui` / `pnpm smoke:admin` | browser smoke tests against a running stack* |
| `pnpm a11y` | accessibility audit (axe, WCAG 2.1 AA) of public, dashboard, guest and template pages* |
| `pnpm db:migrate` | create and apply a migration in development |
| `pnpm admin:set-role <email> <ROLE>` | grant or revoke a platform role |
| `pnpm admin:reset-mfa <email>` | reset two-step sign-in for someone who lost their device |
| `pnpm build` | build everything |

\* The test suites and browser checks are kept out of the repository ([docs/testing.md](docs/testing.md)); these commands work in a working copy that has them.

## Documentation

- [Architecture, status and roadmap](docs/architecture.md) · [Architecture decisions](docs/decisions.md)
- [Database](docs/database.md) · [API](docs/api.md) · [Authentication](docs/authentication.md) · [Authorization](docs/authorization.md)
- [Templates](docs/templates.md) · [Template Studio and admin](docs/template-studio.md) · [Video rendering](docs/video-rendering.md) · [Localization](docs/localization.md)
- [Media and live wall](docs/media.md) · [QR system](docs/qr-system.md) · [Registration](docs/registration.md) · [Stay, travel and seating](docs/logistics.md) · [Payments](docs/payments.md) · [Notifications and reminders](docs/notifications.md) · [Custom domains](docs/custom-domains.md)
- [Web design system](docs/web-design.md) · [Deployment and go-live checklist](docs/deployment.md) · [Docker](docs/docker.md) · [Nginx](docs/nginx.md) · [Security](docs/security.md) · [Testing](docs/testing.md) · [Troubleshooting](docs/troubleshooting.md)

## Before launch

- Remotion needs a paid company licence for companies with more than three employees ([video-rendering.md](docs/video-rendering.md)).
- Hindi and Hinglish translations and the legal pages need review by native speakers and counsel.
- Only publish real, consented testimonials; the homepage hides the section until one exists.
- Every staff account must set up two-step sign-in on first use of the admin console in production; keep recovery codes in a password manager.
- Google sign-in needs an OAuth client and a published consent screen; custom domains need Cloudflare for SaaS and an origin reachable only from Cloudflare ([deployment.md](docs/deployment.md)).
- Size the server before launch: Bulava uses about 0.8 GB of memory without video, and video rendering needs 2+ spare CPUs and 3 GB ([deployment.md](docs/deployment.md#server-size)).
