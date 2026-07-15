#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_ROOT"

runuser -u postgres -- pg_dump -d cryptosugar | gzip -9 > "${BACKUP_ROOT}/database-${STAMP}.sql.gz"
tar -C /opt/cryptosugarbabes/shared -czf "${BACKUP_ROOT}/uploads-${STAMP}.tar.gz" uploads
find "$BACKUP_ROOT" -type f -mtime +14 -delete
