# syntax=docker/dockerfile:1.7
# Bulava admin console (Next.js standalone output). Served on its own domain
# (admin.bulava.in) and proxies /api/v1 to the API, like the web app.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# One package store shared by all image builds (BuildKit cache): the first build downloads,
# the others wait for it and reuse it. Retries and fewer parallel requests ride out flaky DNS.
ENV npm_config_store_dir=/pnpm/store npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_network_concurrency=8
WORKDIR /repo

FROM base AS build
# Rewrites (/api/v1 -> API) and the CSP storage origin are resolved at build time.
ARG API_INTERNAL_URL=http://api:4000
ARG STORAGE_PUBLIC_ORIGIN=https://media.bulava.in
ENV API_INTERNAL_URL=$API_INTERNAL_URL STORAGE_PUBLIC_ORIGIN=$STORAGE_PUBLIC_ORIGIN NEXT_TELEMETRY_DISABLED=1
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store,sharing=locked pnpm fetch
COPY . .
RUN --mount=type=cache,id=bulava-pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile
# Next.js downloads Google Fonts while it builds: a network hiccup is retried once (as in CI's checks).
RUN pnpm --filter "@bulava/admin^..." build \
 && { pnpm --filter @bulava/admin build || { echo "Admin build failed; retrying once"; pnpm --filter @bulava/admin build; }; }

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/admin/server.js"]
