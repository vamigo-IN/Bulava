# syntax=docker/dockerfile:1.7
# Bulava background workers (general worker and media worker).
#
#   docker build -f infrastructure/docker/worker.Dockerfile --build-arg APP=worker .
#   docker build -f infrastructure/docker/worker.Dockerfile --build-arg APP=media-worker .
#
# The video worker needs Chrome and glibc and has its own Dockerfile.

ARG APP=worker

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# One package store shared by all image builds (BuildKit cache): the first build downloads,
# the others wait for it and reuse it. Retries and fewer parallel requests ride out flaky DNS.
ENV npm_config_store_dir=/pnpm/store npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_network_concurrency=8
WORKDIR /repo

FROM base AS build
ARG APP
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store,sharing=locked pnpm fetch
COPY . .
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm --filter "@bulava/${APP}..." build
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm --filter "@bulava/${APP}" deploy --prod /out

FROM node:22-alpine AS runtime
ARG APP
# sharp ships prebuilt libvips for musl; openssl is needed by the Prisma engine. The media
# worker also draws digital cards in Chromium (the card's fonts come from the web page; the
# emoji font covers emoji typed into a card).
RUN apk add --no-cache openssl tini   && if [ "$APP" = "media-worker" ]; then apk add --no-cache chromium font-noto-emoji; fi
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
# Health port: 4101 (worker) or 4102 (media-worker), set via WORKER_HEALTH_PORT.
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.WORKER_HEALTH_PORT||4101)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
