#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: release.sh <git-sha>"
  exit 1
fi

APP_ROOT="/opt/cryptosugarbabes"
RELEASE_SHA="$1"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_SHA}"
ARCHIVE="/tmp/cryptosugarbabes-deploy/cryptosugarbabes-release.tgz"
SERVICE_SOURCE="/tmp/cryptosugarbabes-deploy/cryptosugarbabes.service"
BACKUP_SOURCE="/tmp/cryptosugarbabes-deploy/backup-data.sh"
VERIFY_BACKUP_SOURCE="/tmp/cryptosugarbabes-deploy/verify-backup.sh"
PREVIOUS_TARGET=""

test -x /usr/bin/node || { echo "Node.js is missing. Run deploy/bootstrap-vps.sh first."; exit 1; }
test -f "$ARCHIVE" || { echo "Release archive is missing."; exit 1; }
test -f "${APP_ROOT}/shared/.env" || { echo "Production environment file is missing."; exit 1; }
test -f "$BACKUP_SOURCE" || { echo "Backup script is missing."; exit 1; }
test -f "$VERIFY_BACKUP_SOURCE" || { echo "Backup verification script is missing."; exit 1; }

if [ -L "${APP_ROOT}/current" ]; then
  PREVIOUS_TARGET="$(readlink "${APP_ROOT}/current")"
fi

mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R cryptosugar:cryptosugar "$RELEASE_DIR"

set -a
. "${APP_ROOT}/shared/.env"
set +a

if [ -d "${RELEASE_DIR}/db/migrations" ]; then
  for migration in "${RELEASE_DIR}"/db/migrations/*.sql; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  done
fi

install -m 0644 "$SERVICE_SOURCE" /etc/systemd/system/cryptosugarbabes.service
install -m 0750 "$BACKUP_SOURCE" /usr/local/sbin/cryptosugar-backup
install -m 0750 "$VERIFY_BACKUP_SOURCE" /usr/local/sbin/cryptosugar-verify-backup
systemctl daemon-reload

ln -sfn "$RELEASE_DIR" "${APP_ROOT}/current.next"
mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"

systemctl enable cryptosugarbabes >/dev/null
systemctl restart cryptosugarbabes

healthy=false
for _ in $(seq 1 20); do
  if curl --fail --silent http://127.0.0.1:3001/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [ "$healthy" != "true" ]; then
  journalctl -u cryptosugarbabes --no-pager -n 80
  if [ -n "$PREVIOUS_TARGET" ] && [ -d "$PREVIOUS_TARGET" ]; then
    ln -sfn "$PREVIOUS_TARGET" "${APP_ROOT}/current.next"
    mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"
    systemctl restart cryptosugarbabes
  fi
  echo "New release failed its health check and was rolled back."
  exit 1
fi

find "${APP_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +6 \
  | cut -d' ' -f2- \
  | xargs -r rm -rf

rm -f "$ARCHIVE"
echo "Release ${RELEASE_SHA} is healthy."
