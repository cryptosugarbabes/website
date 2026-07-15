#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/cryptosugarbabes/shared/.env"
BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
ERRORS=()

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

curl --fail --silent --max-time 15 https://cryptosugarbabes.com/api/health >/dev/null \
  || ERRORS+=("public health check failed")

LATEST_DATABASE="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'database-*.sql.gz' -type f -mmin -1560 -print -quit 2>/dev/null || true)"
test -n "$LATEST_DATABASE" || ERRORS+=("no database backup newer than 26 hours")

if [ "${#ERRORS[@]}" -gt 0 ]; then
  MESSAGE="Crypto Sugar alert: $(IFS='; '; echo "${ERRORS[*]}")"
  logger -t cryptosugar-monitor "$MESSAGE"
  if [ -n "${MONITOR_WEBHOOK_URL:-}" ]; then
    curl --fail --silent --max-time 15 -X POST -H 'content-type: application/json' \
      --data "{\"text\":\"$MESSAGE\"}" "$MONITOR_WEBHOOK_URL" >/dev/null || true
  fi
  echo "$MESSAGE"
  exit 1
fi

echo "Crypto Sugar health and backup freshness checks passed."
