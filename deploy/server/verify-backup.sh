#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
DATABASE_BACKUP="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'database-*.sql.gz' -type f -print | sort | tail -n 1)"
UPLOAD_BACKUP="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'uploads-*.tar.gz' -type f -print | sort | tail -n 1)"
TEST_DATABASE="cryptosugar_restore_test_$(date -u +%s)"

test -n "$DATABASE_BACKUP" && test -s "$DATABASE_BACKUP" || { echo "No usable database backup found."; exit 1; }
gzip -t "$DATABASE_BACKUP"
if [ -n "$UPLOAD_BACKUP" ]; then tar -tzf "$UPLOAD_BACKUP" >/dev/null; fi

cleanup() {
  runuser -u postgres -- dropdb --if-exists "$TEST_DATABASE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

runuser -u postgres -- createdb "$TEST_DATABASE"
gzip -dc "$DATABASE_BACKUP" | runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$TEST_DATABASE" >/dev/null
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$TEST_DATABASE" -Atqc \
  "SELECT 'users=' || count(*) FROM users; SELECT 'profiles=' || count(*) FROM profiles; SELECT 'messages=' || count(*) FROM messages;"
echo "Backup restore verification passed: $(basename "$DATABASE_BACKUP")"

