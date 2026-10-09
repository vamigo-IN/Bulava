#!/usr/bin/env bash
# Updates the live server to a release, the way the deploy workflow does, in one command.
#
#   cd /opt/bulava && bash infrastructure/scripts/deploy-server.sh          # the latest main
#   bash infrastructure/scripts/deploy-server.sh <commit sha | v-tag>       # a given release (also a rollback)
#
# Steps: fetch and check out the release; pull the images CI built for it (CI must
# have finished for that commit); print what the template catalog's migration will
# change; back up the database; start the stack (the migrate job applies migrations
# and syncs the templates before the API starts); wait for every health check; free
# the disk of images older than the previous release.
#
# SKIP_BACKUP=1 skips the backup (only while backups are not set up yet; see
# docs/deployment.md#backups-and-restore-spec-71). Run it from the repository root.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
target="${1:-main}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

[ -f "$ENV_FILE" ] || die "missing $ENV_FILE (run this from the repository root, e.g. /opt/bulava)"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "the checkout has local changes; commit or discard them first (git status)"

# The release now running, whose images stay for a rollback.
previous="$(git rev-parse --verify --quiet HEAD || true)"

log "Fetching $target"
git fetch --quiet --tags origin
if [ "$target" = main ]; then
  git checkout --quiet main
  git merge --quiet --ff-only origin/main
else
  git checkout --quiet --force "$target"
fi
BULAVA_VERSION="$(git rev-parse HEAD)"
export BULAVA_VERSION
log "Release $BULAVA_VERSION ($(git log -1 --format=%s))"

log "Pulling the images CI built for this commit"
compose pull --quiet || die "no images for $BULAVA_VERSION yet: wait for CI to finish on GitHub (Actions), then run this again"

if [ -n "$(compose ps --status running -q postgres)" ]; then
  # Older releases' seed has no dry run (it would ignore the flags and write), so ask only newer ones.
  if grep -q -- '--templates-only' packages/database/src/seed.ts; then
    log "Template catalog: what this release changes"
    summary="$(compose run --rm --no-deps migrate node dist/seed.js --templates-only --dry-run 2>&1)" || { printf '%s\n' "$summary" | tail -n 20; die "the template dry run failed"; }
    printf '%s\n' "$summary" | tail -n 1
  fi
  if [ "${SKIP_BACKUP:-0}" = 1 ]; then
    log "Skipping the database backup (SKIP_BACKUP=1)"
  else
    log "Backing up the database"
    bash infrastructure/scripts/backup-postgres.sh || die "the backup failed; fix it, or run with SKIP_BACKUP=1 if backups are not set up yet"
  fi
fi

log "Starting the stack (migrations and the template sync run first)"
compose up -d --remove-orphans

log "Waiting for the health checks"
for svc in $(compose config --services | grep -vx migrate | grep -vx postgres | grep -vx redis); do
  state=unknown
  for _ in $(seq 1 60); do
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$(compose ps -q "$svc")" 2>/dev/null || echo starting)
    [ "$state" = healthy ] && break
    sleep 5
  done
  if [ "$state" != healthy ]; then
    compose logs --tail 80 "$svc"
    die "$svc is $state; roll back with: bash infrastructure/scripts/deploy-server.sh ${previous:-<previous sha>}"
  fi
  printf '  %-16s healthy\n' "$svc"
done
compose logs migrate | grep -E 'Templates|Reference data' | tail -n 2 || true
compose ps

log "Freeing the disk (keeping this release and the previous one)"
bash infrastructure/scripts/prune-docker.sh "$BULAVA_VERSION" ${previous:+"$previous"}
git gc --auto --quiet || true

log "Done: $BULAVA_VERSION is live"
