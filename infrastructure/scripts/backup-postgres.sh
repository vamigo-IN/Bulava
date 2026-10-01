#!/usr/bin/env bash
# PostgreSQL backup for the production stack (spec §71).
#
#   infrastructure/scripts/backup-postgres.sh            # dump, verify, encrypt, upload, prune local copies
#
# Run from the repository root on the server, e.g. nightly from cron:
#   15 2 * * * cd /opt/bulava && infrastructure/scripts/backup-postgres.sh >> /var/log/bulava-backup.log 2>&1
#
# Needs: docker compose, age (https://age-encryption.org). Uploads use the
# official aws-cli image against any S3-compatible endpoint (a separate R2 bucket).
# Remote retention is enforced by a lifecycle rule on the backup bucket, not by this
# script, so a compromised server cannot delete old backups (see docs/deployment.md).
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bulava}"
# Set BACKUP_UPLOAD=0 to keep the backup local (testing only).
BACKUP_UPLOAD="${BACKUP_UPLOAD:-1}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$ENV_FILE" ] || die "missing $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/bulava-$stamp.dump"

log "Dumping $POSTGRES_DB"
# Custom format: compressed, and pg_restore can list/verify it without restoring.
compose exec -T postgres pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB" > "$dump"
[ -s "$dump" ] || die "empty dump"

log "Verifying archive"
tables="$(compose exec -T postgres pg_restore --list < "$dump" | grep -c ' TABLE ' || true)"
[ "$tables" -gt 0 ] || die "dump contains no tables"
log "Archive OK ($tables table entries, $(du -h "$dump" | cut -f1))"

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null || die "age is not installed"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$dump.age" "$dump"
  rm -f "$dump"
  artifact="$dump.age"
elif [ "${BACKUP_ALLOW_UNENCRYPTED:-0}" = "1" ]; then
  log "WARNING: backup is not encrypted (BACKUP_ALLOW_UNENCRYPTED=1)"
  artifact="$dump"
else
  rm -f "$dump"
  die "set BACKUP_AGE_RECIPIENT so backups are encrypted before leaving the server"
fi
sha256sum "$artifact" > "$artifact.sha256"

if [ "$BACKUP_UPLOAD" = "1" ]; then
  : "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}"
  key="postgres/$(date -u +%Y/%m)/$(basename "$artifact")"
  log "Uploading to s3://$BACKUP_S3_BUCKET/$key"
  for f in "$artifact" "$artifact.sha256"; do
    docker run --rm \
      -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" -e AWS_DEFAULT_REGION=auto \
      -v "$BACKUP_DIR:/backup:ro" amazon/aws-cli:2.17.0 \
      s3 cp "/backup/$(basename "$f")" "s3://$BACKUP_S3_BUCKET/${key%/*}/$(basename "$f")" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
  done
fi

log "Pruning local backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'bulava-*' -mtime +"$RETENTION_DAYS" -delete

log "Backup complete: $(basename "$artifact")"
