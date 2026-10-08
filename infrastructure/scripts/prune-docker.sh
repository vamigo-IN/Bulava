#!/usr/bin/env bash
# Frees the disk space Bulava's releases leave behind, without touching the other
# projects on a shared server.
#
#   infrastructure/scripts/prune-docker.sh                # keep what containers use
#   infrastructure/scripts/prune-docker.sh <sha> [<sha>]  # also keep these release tags
#
# Run it from the repository root (it reads IMAGE_PREFIX from .env.production).
# The deploy workflow runs it after every release, keeping that release and the
# previous one for a rollback; run it by hand after deploying manually, or weekly
# from cron:
#   30 4 * * 0 cd /opt/bulava && bash infrastructure/scripts/prune-docker.sh >> /var/log/bulava-prune.log 2>&1
#
# Why the disk fills: every release adds a new tag of each Bulava image (pulled
# per commit, or rebuilt as :latest on the server, which leaves the old image
# untagged), and Docker keeps every tagged image. This removes:
#   - Bulava images (IMAGE_PREFIX/*) that no container uses and whose tag is not kept,
#   - untagged ("dangling") images no container uses,
#   - build cache unused for three days (left by building on the server;
#     KEEP_BUILD_CACHE=1 skips this).
# It never removes containers, volumes (the database lives in one) or other
# projects' tagged images.
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
prefix="bulava"
if [ -f "$ENV_FILE" ]; then
  # Only IMAGE_PREFIX is needed: read that line instead of sourcing the whole file.
  value="$(grep -E '^IMAGE_PREFIX=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d "\"'" || true)"
  if [ -n "$value" ]; then prefix="$value"; fi
fi
keep=" $* ${BULAVA_VERSION:-} "

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
free() { df -h / | awk 'NR==2 { print $4 " free of " $2 }'; }

log "Before: $(free)"

# Images that any container, running or stopped, still uses.
used="$(docker ps -aq | xargs -r docker inspect -f '{{.Image}}' | sort -u)"
pattern="^$(printf '%s' "$prefix" | sed 's/[.]/\\./g')/[^ ]+:"

removed=0
while read -r ref id; do
  [ -n "${ref:-}" ] || continue
  tag="${ref##*:}"
  [ "$tag" = "<none>" ] && continue
  case "$keep" in *" $tag "*) continue ;; esac
  full="$(docker image inspect -f '{{.Id}}' "$id" 2>/dev/null || true)"
  if [ -n "$full" ] && printf '%s\n' "$used" | grep -qx "$full"; then continue; fi
  if docker image rm "$ref" >/dev/null 2>&1; then removed=$((removed + 1)); fi
done < <(docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E "$pattern" || true)
log "Removed $removed old Bulava image tag(s) under $prefix"

docker image prune -f >/dev/null
if [ "${KEEP_BUILD_CACHE:-0}" != "1" ]; then
  docker builder prune -f --filter "until=72h" >/dev/null 2>&1 || true
fi

log "After: $(free)"
docker system df
