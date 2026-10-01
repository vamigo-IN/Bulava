# syntax=docker/dockerfile:1.7
# Bulava API: multi-stage build producing a minimal production image.

FROM node:22-alpine AS base
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
# Build the API and every workspace package it depends on.
RUN pnpm --filter "@bulava/api..." build
# Produce a self-contained folder with only production dependencies.
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm --filter @bulava/api deploy --prod /out \
 && cp -r packages/database/prisma /out/prisma

# One-off migration runner (has the Prisma CLI). Used by the compose "migrate" service.
FROM build AS migrate
RUN apk add --no-cache openssl
WORKDIR /repo/packages/database
# The local Prisma CLI directly (npx would reach out to the npm registry).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/seed.js"]

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
