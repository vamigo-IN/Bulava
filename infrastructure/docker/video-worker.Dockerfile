# syntax=docker/dockerfile:1.7
# Bulava video worker: Remotion + Chrome Headless Shell + FFmpeg (bundled by Remotion).
# Debian (glibc) because Chrome Headless Shell does not run on musl/Alpine.

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# One package store shared by all image builds (BuildKit cache): the first build downloads,
# the others wait for it and reuse it. Retries and fewer parallel requests ride out flaky DNS.
ENV npm_config_store_dir=/pnpm/store npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_network_concurrency=8
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store,sharing=locked pnpm fetch
COPY . .
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm --filter "@bulava/video-worker..." build
# Bundle the Remotion project now so the worker starts without webpack. @remotion/bundler
# (webpack, rspack) is a dev dependency, so the `deploy --prod` below leaves it out.
RUN pnpm --filter @bulava/video-worker bundle
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm --filter @bulava/video-worker deploy --prod /out

FROM node:22-bookworm-slim AS runtime
# Shared libraries Chrome Headless Shell needs (see remotion.dev/docs/docker),
# plus openssl for the Prisma engine and tini as PID 1. `upgrade` applies the security
# fixes Debian has published since the base image was built (CI's Trivy scan fails on
# fixable critical vulnerabilities).
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
 && apt-get install -y --no-install-recommends \
    ca-certificates openssl tini \
    libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
    libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    REMOTION_BUNDLE_DIR=/app/remotion-bundle \
    WORKER_HEALTH_PORT=4103
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
# Download Chrome Headless Shell into the image (not at container start).
RUN node -e "require('@remotion/renderer').ensureBrowser().then(()=>console.log('browser ready'))"
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:4103/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
