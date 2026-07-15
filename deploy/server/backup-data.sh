#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
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

if [ -n "${BACKUP_S3_URI:-}" ]; then
  command -v aws >/dev/null || { echo "BACKUP_S3_URI is configured but the AWS-compatible CLI is missing."; exit 1; }
  test -n "${BACKUP_ENCRYPTION_KEY:-}" || { echo "BACKUP_ENCRYPTION_KEY is required for offsite backups."; exit 1; }
  ENDPOINT_ARGS=()
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then ENDPOINT_ARGS=(--endpoint-url "$BACKUP_S3_ENDPOINT"); fi
  for archive in "$DATABASE_BACKUP" "$UPLOAD_BACKUP"; do
    encrypted="${archive}.enc"
    BACKUP_KEY="$BACKUP_ENCRYPTION_KEY" openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_KEY -in "$archive" -out "$encrypted"
    aws "${ENDPOINT_ARGS[@]}" s3 cp "$encrypted" "${BACKUP_S3_URI%/}/$(basename "$encrypted")" --only-show-errors
    rm -f "$encrypted"
  done
fi

find "$BACKUP_ROOT" -type f -mtime +14 -delete
