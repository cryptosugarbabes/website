#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this setup as root."
  exit 1
fi

APP_ROOT="/opt/cryptosugarbabes"
ENV_FILE="${APP_ROOT}/shared/.env"
UPLOAD_ROOT="${APP_ROOT}/shared/uploads"
BACKUP_ROOT="${APP_ROOT}/shared/backups"
EXPORT_ROOT="${APP_ROOT}/shared/offsite-export"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y postgresql postgresql-client awscli
systemctl enable --now postgresql
mkdir -p "$UPLOAD_ROOT" "$BACKUP_ROOT" "$EXPORT_ROOT"
chown -R cryptosugar:cryptosugar "${APP_ROOT}/shared"
chmod 700 "$UPLOAD_ROOT" "$BACKUP_ROOT"
if id -u cryptodeploy >/dev/null 2>&1; then
  chown root:cryptodeploy "$EXPORT_ROOT"
  chmod 0770 "$EXPORT_ROOT"
else
  chmod 0700 "$EXPORT_ROOT"
fi

if ! grep -q '^POSTGRES_PASSWORD=' "$ENV_FILE"; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  cat >> "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://cryptosugar:${DB_PASSWORD}@127.0.0.1:5432/cryptosugar
UPLOAD_ROOT=${UPLOAD_ROOT}
APP_ORIGIN=https://cryptosugarbabes.com
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
fi

if ! grep -q '^BACKUP_ENCRYPTION_KEY=' "$ENV_FILE"; then
  printf 'BACKUP_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
fi
if ! grep -q '^BACKUP_EXPORT_ENABLED=' "$ENV_FILE"; then
  printf 'BACKUP_EXPORT_ENABLED=1\n' >> "$ENV_FILE"
fi

set -a
. "$ENV_FILE"
set +a

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='cryptosugar'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE cryptosugar LOGIN PASSWORD '${POSTGRES_PASSWORD}'"
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE cryptosugar PASSWORD '${POSTGRES_PASSWORD}'"
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='cryptosugar'" | grep -q 1; then
  runuser -u postgres -- createdb --owner=cryptosugar cryptosugar
fi

install -m 0750 /tmp/cryptosugarbabes-bootstrap/backup-data.sh /usr/local/sbin/cryptosugar-backup
install -m 0750 /tmp/cryptosugarbabes-bootstrap/verify-backup.sh /usr/local/sbin/cryptosugar-verify-backup
install -m 0750 /tmp/cryptosugarbabes-bootstrap/monitor-health.sh /usr/local/sbin/cryptosugar-monitor
install -m 0644 /tmp/cryptosugarbabes-bootstrap/cryptosugar-backup.cron /etc/cron.d/cryptosugar-backup

echo "Persistent database, uploads, and local backups are ready."
