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

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y postgresql postgresql-client
systemctl enable --now postgresql
mkdir -p "$UPLOAD_ROOT" "$BACKUP_ROOT"
chown -R cryptosugar:cryptosugar "${APP_ROOT}/shared"
chmod 700 "$UPLOAD_ROOT" "$BACKUP_ROOT"

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
cat > /etc/cron.d/cryptosugar-backup <<'EOF'
17 3 * * * root /usr/local/sbin/cryptosugar-backup >/var/log/cryptosugar-backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/cryptosugar-backup

echo "Persistent database, uploads, and local backups are ready."
