# Docker

## Development

```bash
cp .env.example .env
docker compose up -d --build   # everything in containers: web :3000, admin :3001, api :4000, workers
# or
pnpm infra:up                  # only postgres, redis, storage (SeaweedFS S3) and mailpit; run the apps on the host
```

Use one or the other: both serve ports 3000, 3001 and 4000.

| Service | Image | Port (host) | Health check | Purpose |
|---|---|---|---|---|
| postgres | postgres:16-alpine | 127.0.0.1:5432 | `pg_isready` | `bulava` and `bulava_test` databases |
| redis | redis:7-alpine | 127.0.0.1:6379 | `redis-cli ping` | queues, rate limits |
| storage | chrislusf/seaweedfs | 127.0.0.1:9000 | master status | S3-compatible object storage (R2 stand-in) |
| mailpit | axllent/mailpit | 127.0.0.1:1025 / 8025 | built in | catches all email; web UI on :8025 |

| Service | Port (host) | Notes |
|---|---|---|
| migrate | none | applies migrations and runs the seed (including the platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`), then exits; `api` starts only after it succeeds |
| api | 127.0.0.1:4000 | reads `.env`, but database, Redis, storage and SMTP always point at the containers above |
| web | 127.0.0.1:3000 | built with `WEB_ORIGIN=http://localhost:3000` and the local storage origin in its CSP |
| admin | 127.0.0.1:3001 | staff console |
| worker, media-worker, video-worker | none | health on 4101–4103 inside their containers; the video worker is the largest image |

The app containers **always use the local SeaweedFS storage**, even when `.env` holds real R2 credentials, so local uploads can never reach a production bucket. Emails go to Mailpit (the worker takes `SMTP_HOST=mailpit` from the environment until Email is saved in the console). In the admin console's storage test, the two browser steps show as notes in this stack: browsers use `localhost:9000`, which the API container cannot reach; uploading a photo in the dashboard proves them. The API and workers run with `NODE_ENV=development` because they serve plain HTTP, and production mode refuses insecure cookies and dev secrets. Inside Docker, the video worker's Chrome loads photos from `storage:9000`, while browsers use `localhost:9000`.

Rebuild after code changes with `docker compose up -d --build`. `pnpm infra:up` starts only the four infrastructure services.

All services share `bulava-network`, and host ports bind to `127.0.0.1`, so nothing is reachable from other machines. `postgres/init.sql` creates `bulava_test` the first time the data volume is created.

SeaweedFS binds to all interfaces inside its container (`-ip.bind=0.0.0.0`) so its health check can reach it; CORS origins for browser uploads come from `STORAGE_CORS_ORIGINS`, and the dev credentials live in `infrastructure/docker/storage/s3.json`.

## Images

| Dockerfile | Images | Base | Notes |
|---|---|---|---|
| `api.Dockerfile` | `api` (target `runtime`), `migrate` (target `migrate`) | node:22-alpine | `pnpm deploy --prod` output; Prisma engines for musl and Debian |
| `web.Dockerfile` | `web` | node:22-alpine | Next.js standalone; build args: `API_INTERNAL_URL`, `STORAGE_PUBLIC_ORIGIN`, `WEB_ORIGIN`, `NEXT_PUBLIC_*` |
| `admin.Dockerfile` | `admin` | node:22-alpine | Next.js standalone; build args: `API_INTERNAL_URL`, `STORAGE_PUBLIC_ORIGIN` |
| `worker.Dockerfile` | `worker`, `media-worker` (`--build-arg APP=…`) | node:22-alpine | sharp ships prebuilt libvips for musl |
| `video-worker.Dockerfile` | `video-worker` | node:22-bookworm-slim | Chrome libraries, prebuilt Remotion bundle, browser downloaded at build time |

All builds share the same pattern: `pnpm fetch` on the lockfile into a package store shared by every build (a BuildKit cache mount, so parallel builds download each package once, with retries), an offline install, a filtered build of the app and its workspace dependencies, and a runtime stage that runs as the non-root `node` user under `tini` with a health check. Next.js bakes rewrites, security headers and `NEXT_PUBLIC_*` values in at build time, which is why the web and admin images take build arguments. The API does not exist while an image builds, so `next build` never calls it (`serverApi` returns its fallback during the build): marketing pages are pre-rendered with default branding and no catalogue, and fill in when they first revalidate after the container starts. Waiting on the API's host name during the build used to push pages past Next's 60-second limit.

```bash
docker build -f infrastructure/docker/worker.Dockerfile --build-arg APP=media-worker -t bulava/media-worker .
docker build -f infrastructure/docker/video-worker.Dockerfile -t bulava/video-worker .
```

## Production

`docker-compose.prod.yml` (project `bulava`) runs web, admin, api, migrate, worker, media-worker, postgres, redis and nginx on an internal network, plus video-worker with `COMPOSE_PROFILES=video`. The only published port is Nginx on `127.0.0.1:${BULAVA_HTTP_PORT}`; the server's own Nginx terminates TLS and proxies to it, so the stack can share a server with other sites. CPU and memory limits come from `.env.production`. See [deployment.md](deployment.md) and [nginx.md](nginx.md).
