#!/usr/bin/env bash
# Restore test (spec §71): prove a backup can actually be restored.
#
#   infrastructure/scripts/restore-test.sh <backup.dump | backup.dump.age> [age-identity-file]
#
# Restores into a throwaway PostgreSQL container (never the live database),
# runs sanity checks, then removes the container. Run it monthly and after any
# change to the backup process.
set -euo pipefail

file="${1:?usage: restore-test.sh <backup.dump[.age]> [age-identity-file]}"
identity="${2:-${BACKUP_AGE_IDENTITY:-}}"
name="bulava-restore-test-$$"
work="$(mktemp -d)"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if [ -f "$file.sha256" ]; then
  log "Checking checksum"
  (cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256")
fi

dump="$work/restore.dump"
case "$file" in
  *.age)
    [ -n "$identity" ] || { echo "an age identity file is required to decrypt $file" >&2; exit 2; }
    age -d -i "$identity" -o "$dump" "$file"
    ;;
  *) cp "$file" "$dump" ;;
esac

log "Starting a throwaway PostgreSQL 16"
docker run -d --name "$name" -e POSTGRES_PASSWORD=restore -e POSTGRES_DB=restore postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" pg_isready -U postgres -d restore >/dev/null 2>&1 && break
  sleep 1
done
# citext is created by the migrations; make sure the extension is available first.
docker exec "$name" psql -q -U postgres -d restore -c 'CREATE EXTENSION IF NOT EXISTS citext;' >/dev/null

log "Restoring"
docker exec -i "$name" pg_restore --no-owner --no-privileges --exit-on-error -U postgres -d restore < "$dump"

log "Sanity checks"
q() { docker exec "$name" psql -tA -U postgres -d restore -c "$1"; }
migrations="$(q 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;')"
users="$(q 'SELECT count(*) FROM users;')"
events="$(q 'SELECT count(*) FROM events;')"
templates="$(q 'SELECT count(*) FROM templates;')"
log "migrations=$migrations users=$users events=$events templates=$templates"
[ "$migrations" -gt 0 ] || { echo "no applied migrations in the restored database" >&2; exit 1; }
[ "$templates" -gt 0 ] || { echo "no templates in the restored database" >&2; exit 1; }

log "Restore test passed"
