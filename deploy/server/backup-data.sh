#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
EXPORT_ROOT="/opt/cryptosugarbabes/shared/offsite-export"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ENV_FILE="/opt/cryptosugarbabes/shared/.env"
mkdir -p "$BACKUP_ROOT"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

DATABASE_BACKUP="${BACKUP_ROOT}/database-${STAMP}.sql.gz"
UPLOAD_BACKUP="${BACKUP_ROOT}/uploads-${STAMP}.tar.gz"
runuser -u postgres -- pg_dump -d cryptosugar | gzip -9 > "$DATABASE_BACKUP"
tar -C /opt/cryptosugarbabes/shared -czf "$UPLOAD_BACKUP" uploads

if [ -n "${BACKUP_S3_URI:-}" ] || [ "${BACKUP_EXPORT_ENABLED:-0}" = "1" ]; then
  test -n "${BACKUP_ENCRYPTION_KEY:-}" || { echo "BACKUP_ENCRYPTION_KEY is required for offsite backups."; exit 1; }
  if [ -n "${BACKUP_S3_URI:-}" ]; then command -v aws >/dev/null || { echo "BACKUP_S3_URI is configured but the AWS-compatible CLI is missing."; exit 1; }; fi
  if [ "${BACKUP_EXPORT_ENABLED:-0}" = "1" ]; then mkdir -p "$EXPORT_ROOT"; fi
  ENDPOINT_ARGS=()
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then ENDPOINT_ARGS=(--endpoint-url "$BACKUP_S3_ENDPOINT"); fi
  for archive in "$DATABASE_BACKUP" "$UPLOAD_BACKUP"; do
    encrypted="${archive}.enc"
    BACKUP_KEY="$BACKUP_ENCRYPTION_KEY" openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_KEY -in "$archive" -out "$encrypted"
    if [ -n "${BACKUP_S3_URI:-}" ]; then
      aws "${ENDPOINT_ARGS[@]}" s3 cp "$encrypted" "${BACKUP_S3_URI%/}/$(basename "$encrypted")" --only-show-errors
    fi
    if [ "${BACKUP_EXPORT_ENABLED:-0}" = "1" ]; then
      install -m 0640 "$encrypted" "$EXPORT_ROOT/$(basename "$encrypted")"
    fi
    rm -f "$encrypted"
  done
  if [ -n "${BACKUP_S3_URI:-}" ]; then touch "$BACKUP_ROOT/.last-offsite-success"; fi
  if [ "${BACKUP_EXPORT_ENABLED:-0}" = "1" ]; then
    find "$EXPORT_ROOT" -maxdepth 1 -name '*.enc' -type f -mtime +2 -delete
    (cd "$EXPORT_ROOT" && sha256sum ./*.enc > SHA256SUMS)
    if id -u cryptodeploy >/dev/null 2>&1; then chown -R root:cryptodeploy "$EXPORT_ROOT"; fi
  fi
fi

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d cryptosugar -c \
  "DELETE FROM product_events WHERE created_at < now() - interval '90 days'; DELETE FROM application_errors WHERE last_seen_at < now() - interval '90 days';" >/dev/null 2>&1 || true
find "$BACKUP_ROOT" -type f -mtime +14 -delete
