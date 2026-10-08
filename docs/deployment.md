# Deployment

Production runs with Docker Compose on a Linux server, which may also host other sites. Everything Bulava runs is in `docker-compose.prod.yml`. The server's own Nginx terminates TLS (certbot) and proxies Bulava's hostnames to one container port on `127.0.0.1`, so Bulava never takes ports 80 or 443 from anything else.

```text
Visitors ─ (optional Cloudflare) ─ server's Nginx :443   TLS by certbot; shared with other sites
                                      │ http://127.0.0.1:18090 (BULAVA_HTTP_PORT)
                                   bulava-nginx ── web · admin · api     (bulava-network, internal)
                                   api ── postgres · redis
                                   worker · media-worker · video-worker* ── redis · postgres
All services ── Cloudflare R2 (object storage, signed URLs)           * opt-in (COMPOSE_PROFILES=video)
```

| Service | Image | Health check | Notes |
|---|---|---|---|
| nginx | nginx:1.27-alpine | `/nginx-health` (inside the container) | routing by host name, limits, headers ([nginx.md](nginx.md)); the only published port, on `127.0.0.1` |
| web | `bulava/web` | `/healthz` | Next.js standalone |
| admin | `bulava/admin` | `/healthz` | staff console |
| api | `bulava/api` | `/health` | read-only filesystem |
| migrate | `bulava/migrate` | exits 0 | `prisma migrate deploy` + seed (reference data, template catalog, platform admin, original music), runs before the API; gets only the database, admin and R2 variables |
| worker | `bulava/worker` | `:4101/health` | read-only filesystem |
| media-worker | `bulava/media-worker` | `:4102/health` | read-only filesystem |
| video-worker | `bulava/video-worker` | `:4103/health` | Debian + Chrome, 1 GB `/dev/shm`; profile `video` |
| postgres | postgres:16-alpine | `pg_isready` | volume `bulava_postgres-data` |
| redis | redis:7-alpine | `redis-cli ping` | password, AOF, `noeviction` for BullMQ |

All app containers run as a non-root user with `no-new-privileges` and all Linux capabilities dropped (the one-off migrate job too). Nginx, PostgreSQL and Redis keep the capabilities their stock entrypoints need to drop to their own users, with `no-new-privileges` so nothing can gain them back. The web and admin containers receive no server secrets.

## Server size

Measured with light traffic: web about 200 MB, api 135 MB, admin 125 MB, worker 115 MB, media-worker 110 MB, Postgres 60 MB, Redis 10 MB and Nginx under 10 MB. That comes to **about 0.8 GB without video, and 1.2 GB or more while photos are processed**. Rendering a video adds 1–3 GB and keeps a CPU busy for minutes, so the video worker is off unless `COMPOSE_PROFILES=video`.

| Server | Suitable for |
|---|---|
| 1 vCPU, less than 1.5 GB free | not enough; add memory first |
| 1–2 vCPU, 2 GB free, plus swap | a private trial without video |
| 2 vCPU / 4 GB free | launch without video |
| 4 vCPU / 8 GB (Bulava alone) | launch with video and cards |

Container limits come from `.env.production` (`API_CPUS`, `API_MEMORY` and so on). A CPU limit above the server's CPU count stops the container from starting, so the defaults are at most 1. Building images needs about 2 GB of free memory; on a small server, pull the images CI builds instead of building there.

## Sharing a server with other sites

Bulava is designed not to collide with anything already running:

| Resource | What Bulava uses |
|---|---|
| Ports 80 / 443 | none; the server's Nginx keeps them |
| Published ports | one: `127.0.0.1:${BULAVA_HTTP_PORT}` (default 18090); check it is free with `sudo ss -tlpn` |
| Host Nginx | one site file (`/etc/nginx/sites-available/bulava`) with a single `server` block for Bulava's names: no `upstream`, `map`, zone, `log_format` or `default_server`, so it cannot clash with other sites' settings |
| Docker names | project `bulava`: containers `bulava-*`, network `bulava-network`, volumes `bulava_*` |
| Databases | Bulava's own Postgres and Redis on the internal network, never published, so they do not conflict with other projects' 5432 / 6379 |
| TLS | a certbot certificate for Bulava's names, renewed by the existing certbot timer |

Docker writes its own firewall rules, so ports published on `0.0.0.0` are reachable from the internet even when UFW denies them. That is why Bulava publishes only on `127.0.0.1`. Check other projects on the same server for the same problem (`docker ps` shows `0.0.0.0:` ports).

## First deployment

1. **Server.** Ubuntu 24.04 LTS or similar with Docker Engine, the Compose plugin, Nginx and certbot (`python3-certbot-nginx`). The firewall needs only 22, 80 and 443. If memory is tight, add swap first, for example 4 GB:

   ```bash
   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **DNS.** At your registrar's DNS (Cloudflare is not required; Bulava uses Cloudflare only for R2 storage): `A` records, plus `AAAA` if the server has IPv6, for the domain, `www`, `admin` and `api`, all pointing at the server. To put Cloudflare in front later, see [nginx.md](nginx.md#cloudflare-in-front).
3. **Object storage (R2).** Create a private bucket (for example `bulava-prod`) and an API token scoped to it. Add a CORS rule allowing `PUT` and `GET` from the site and admin origins with the `Content-Type` header, so browsers can upload with signed URLs. Create a second bucket for backups with object versioning and a lifecycle rule (below).
4. **Configuration.** Clone the repository to `/opt/bulava`, then:

   ```bash
   cp .env.production.example .env.production && chmod 600 .env.production
   # fill in every CHANGE_ME: database and Redis passwords, JWT secret, token key,
   # R2, SMTP, Razorpay, METRICS_TOKEN, ADMIN_EMAIL / ADMIN_PASSWORD, backup settings
   # and the domain block: BULAVA_DOMAIN, BULAVA_ADMIN_DOMAIN, BULAVA_API_DOMAIN,
   # WEB_ORIGIN, CORS_ORIGINS; check BULAVA_HTTP_PORT is free; size the resource limits
   ```

   The API refuses to start in production with development secrets, `COOKIE_SECURE=false` or disabled rate limits.
5. **Images.** CI publishes images to GHCR (`IMAGE_PREFIX=ghcr.io/<owner in lowercase>/bulava`, `BULAVA_VERSION=<git sha>`), built with the repository variable `WEB_ORIGIN`. Pull them (`docker login ghcr.io` first if the packages are private):

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production pull
   ```

   To build on the server instead (needs about 2 GB free memory): `... build`.
6. **Start.**

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   docker compose -f docker-compose.prod.yml --env-file .env.production ps
   curl -s -o /dev/null -w '%{http_code}\n' -H "Host: bulava.in" http://127.0.0.1:18090/healthz   # 200
   ```

   The `migrate` job applies migrations, seeds reference data and the template catalog (the same templates as a local seed), creates the platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and uploads Bulava's original music track to R2 and approves it in the music library (`SEED_ORIGINAL_MUSIC`, from `packages/database/seed-assets`). Every step is idempotent, so the job runs on every deploy.
7. **Host Nginx site.** Render Bulava's site from `.env.production`, review it, install it and test the whole Nginx configuration before reloading:

   ```bash
   bash infrastructure/scripts/render-host-nginx.sh > /tmp/bulava.site
   sudo cp /tmp/bulava.site /etc/nginx/sites-available/bulava
   sudo ln -s /etc/nginx/sites-available/bulava /etc/nginx/sites-enabled/bulava
   sudo nginx -t && sudo systemctl reload nginx
   ```

   If `nginx -t` reports an error, remove the link again (`sudo rm /etc/nginx/sites-enabled/bulava`); the running sites are untouched until a reload succeeds.
8. **Certificate.** Once DNS resolves to the server, run the certbot command the render script printed, for example `sudo certbot --nginx --redirect -d bulava.in -d www.bulava.in -d admin.bulava.in -d api.bulava.in`. Certbot adds HTTPS and the HTTP → HTTPS redirect to Bulava's site, as it did for the other sites, and its timer renews the certificate.
9. **Admin.** Sign in at `https://admin.<domain>`, set up two-step sign-in and change the seeded password.
10. **Razorpay webhook.** Point it at `https://api.<domain>/api/v1/payments/razorpay/webhook` ([payments.md](payments.md)).
11. **Backups.** Install `age`, generate a key pair on a separate machine, put the public key in `BACKUP_AGE_RECIPIENT`, and schedule the backup (below).
12. **Google sign-in (optional).** Create a Google OAuth web client with the redirect URI `https://<domain>/api/v1/auth/google/callback`, then paste its ID and secret in the admin console (Integrations → Google sign-in) and run its check ([authentication.md](authentication.md#google-sign-in)). Without them the button is hidden.
13. **Video (optional).** On a server with CPU and memory to spare, set `COMPOSE_PROFILES=video` (and raise `VIDEO_WORKER_CPUS`, `VIDEO_RENDER_THREADS`), then `up -d` again.
14. **Custom domains (optional, later).** Off until a certificate source is configured. Cloudflare for SaaS can use a separate zone, so the main domain can stay off Cloudflare. It also needs a listener of its own on the server's Nginx ([custom-domains.md](custom-domains.md#availability)).

**Trying it before buying the domain.** Any domain you already control works: for example `BULAVA_DOMAIN=bulava.example.com`, `BULAVA_ADMIN_DOMAIN=admin-bulava.example.com`, `BULAVA_API_DOMAIN=api-bulava.example.com`, `BULAVA_WWW=false`, with `WEB_ORIGIN` and `CORS_ORIGINS` to match. Moving to the real domain later means changing those values, rebuilding the web image (it bakes `WEB_ORIGIN` in), re-rendering the host site and running certbot for the new names.

## Go-live checklist

Work through this before pushing a release tag (for the first release, `v1.0.0`; see [CHANGELOG.md](../CHANGELOG.md)).

1. **The commit is green.** CI passed on it (lint, typecheck, app and image builds, Trivy, `pnpm audit`, gitleaks), and the test suites, which are kept out of the repository ([testing.md](testing.md)), pass against it: `pnpm test` and `pnpm test:e2e`, then `pnpm smoke:ui`, `pnpm smoke:admin` and `pnpm a11y` against a stack built from the same commit.
2. **`.env.production` is complete.** No `CHANGE_ME` left; long, unique secrets; `COOKIE_SECURE=true` and `STAFF_MFA_REQUIRED=true`; the domain block and `WEB_ORIGIN` / `CORS_ORIGINS` agree; `BULAVA_HTTP_PORT` is free; no CPU limit above the host's CPU count; the file is `chmod 600` and never committed.
3. **Storage.** The R2 bucket is private, with the CORS rule for the site and admin origins; the backup bucket has versioning and a lifecycle rule.
4. **Edge.** DNS resolves, the host Nginx site passes `nginx -t`, and the certificate is issued (steps 7 and 8 above).
5. **First sign-in.** At `https://admin.<domain>`: set up two-step sign-in, save the recovery codes, change the seeded password, and check **Staff** shows exactly one Super Admin. Remove `ADMIN_PASSWORD` from `.env.production` afterwards if you like; seeds never revert a changed password.
6. **Settings (Super Admin).** Branding and SEO; SMTP, Razorpay (live keys) and, if used, WhatsApp (GetGabs: API key, sender number, approved templates), Google sign-in and Maps, each with its check passing; the Razorpay webhook (step 10).
7. **Catalog.** `/templates` lists 73 templates, the same as a local seed, and the admin **Music library** shows *Shubh Aarambh (Tanpura & Bansuri)* approved (both come from the migrate job).
8. **Safety nets.** A scheduled backup ran and one restore was tested ([below](#backups-and-restore-spec-71)); `/health` is monitored; `METRICS_TOKEN` is set; `SENTRY_DSN` if you use Sentry.
9. **Licences and content.** The Remotion company licence before rendering videos commercially; legal pages and Hindi/Hinglish strings reviewed.
10. **Release.** `git tag v1.0.0 && git push origin v1.0.0`. The production environment's required reviewers approve the deploy, which backs up the database, starts the stack, waits for every health check and checks the public site from outside.

## Continuous deployment

`.github/workflows/ci.yml` runs on every push and pull request: lint, typecheck, app builds, Docker builds for all seven images with a Trivy scan for critical vulnerabilities, `pnpm audit`, and a gitleaks secret scan over the whole history. Pushes to `main` and version tags publish images to GHCR. The unit and end-to-end tests are not part of the repository; run them locally before tagging a release ([testing.md](testing.md)).

`.github/workflows/deploy.yml` runs after CI succeeds:

- `main` deploys to the **staging** environment; tags `v*` deploy to **production**. Protect the production environment with required reviewers.
- It connects over SSH, checks out the commit, pulls images for that commit, takes a database backup (after the first deploy), starts the stack, waits for every service's health check, removes images older than the previous release ([Disk space](#disk-space)), and finally checks the public site and `/health` from outside.

Per-environment secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, optional `DEPLOY_PATH`. Repository variables for web builds: `WEB_ORIGIN`, `STORAGE_PUBLIC_ORIGIN`, optional `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA4_ID`. Application secrets stay in `.env.production` on the server and never pass through CI.

## Disk space

Every release brings a new copy of each Bulava image (about 930 MB to download and roughly 2 to 3 GB on disk for the six images), tagged with its commit, and Docker keeps every tagged image until it is removed. Releasing often on a small server therefore fills the disk with old releases. Building on the server is worse: each build leaves the previous image behind untagged and adds to Docker's build cache.

`infrastructure/scripts/prune-docker.sh` frees that space without touching the other sites on the server. It removes Bulava's images (`IMAGE_PREFIX/*`) that no container uses, except the release tags it is given; untagged images no container uses; and build cache unused for three days (`KEEP_BUILD_CACHE=1` keeps it). It never removes containers or volumes, and the database lives in a volume. The deploy workflow runs it after every release, keeping that release and the previous one for a rollback. Container logs are capped at 30 MB per container (`docker-compose.prod.yml`).

When updating by hand, prune after the new release is up:

```bash
cd /opt/bulava && git pull
export BULAVA_VERSION=$(git rev-parse HEAD)          # the images CI built for this commit
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --remove-orphans
bash infrastructure/scripts/prune-docker.sh "$BULAVA_VERSION"
```

To see where the space goes: `df -h /`, `docker system df` and `sudo du -sh /var/lib/docker /var/backups/bulava`. A weekly cron entry keeps a hand-updated server tidy (see the script's header).

## Rollback

Every image is tagged with its commit. The server keeps the previous release's images; older ones are pulled again from GHCR when needed. To roll back, run the deploy workflow for an earlier successful commit, or on the server:

```bash
BULAVA_VERSION=<previous sha> docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Migrations only move forward. A release that changes the schema must stay compatible with the previous release's code (expand, then contract in a later release), so rolling back the application never requires rolling back the database. If data must be restored, use the backups below.

## Backups and restore (spec §71)

```bash
# /etc/cron.d/bulava-backup
15 2 * * * root cd /opt/bulava && infrastructure/scripts/backup-postgres.sh >> /var/log/bulava-backup.log 2>&1
```

`backup-postgres.sh` dumps the database in custom format, verifies the archive with `pg_restore --list`, encrypts it with `age`, writes a SHA-256 checksum, uploads both to the backup bucket, and prunes local copies older than `BACKUP_RETENTION_DAYS`. It refuses to upload an unencrypted dump.

Remote retention belongs to the bucket, not the script, so a compromised server cannot erase history: enable **object versioning** and a **lifecycle rule** that expires old versions (for example after 35 days for daily dumps). Consider a second copy in another provider or region; never depend on the VPS disk as the only copy.

**Restore test (monthly):**

```bash
infrastructure/scripts/restore-test.sh /path/to/bulava-<stamp>.dump.age ~/.config/age/bulava.key
```

It verifies the checksum, decrypts, restores into a throwaway PostgreSQL container, checks migrations, users, events and templates, and removes the container. It never touches the live database.

Object storage: keep R2 versioning on for the media bucket too, and add a lifecycle rule for noncurrent versions. Deleted events are purged from storage by the worker after `EVENT_RETENTION_DAYS`.

## Monitoring

- **Health:** `/health`, `/health/db`, `/health/redis` on the API; `/healthz` on web and admin; `:4101–4103/health` on workers. Docker restarts unhealthy services; point an external uptime monitor at `https://api.<domain>/health` and `https://<domain>/healthz`.
- **Metrics:** Prometheus text at `/metrics` on the API (HTTP latency and counts, queue depths), protected by `Authorization: Bearer $METRICS_TOKEN`. Nginx returns 404 for it publicly; scrape it on the internal network.
- **Errors:** set `SENTRY_DSN` for the API and workers (no personal data is sent).
- **Logs:** JSON on stdout, rotated by Docker (`max-size 20m`, 5 files). Tokens, cookies and authorization headers are redacted. Bulava's Nginx logs omit query strings (the host site turns its own access log off).
- **Queues:** the admin console shows per-queue counts and failed renders.
- **Database:** watch connection count, disk usage and slow queries (`pg_stat_statements` if enabled).

## Scaling

Workers are stateless: add replicas of `worker`, `media-worker` or `video-worker` (on the same host or another host on the same private network) and raise their concurrency. BullMQ distributes jobs. The API and web apps are stateless too and can be replicated behind Bulava's Nginx. Moving Bulava to a dedicated server later is the same runbook on a new machine plus a database restore (below). Move PostgreSQL to a managed service when a single host is no longer enough.
