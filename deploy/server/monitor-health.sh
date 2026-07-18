#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/cryptosugarbabes/shared/.env"
BACKUP_ROOT="/opt/cryptosugarbabes/shared/backups"
EXPORT_ROOT="/opt/cryptosugarbabes/shared/offsite-export"
STATE_FILE="${BACKUP_ROOT}/.monitor-state"
ERRORS=()

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

curl --fail --silent --max-time 15 https://cryptosugarbabes.com/api/health >/dev/null \
  || ERRORS+=("public health check failed")
systemctl is-active --quiet cryptosugarbabes || ERRORS+=("application service is not active")

DISK_PERCENT="$(df -P /opt/cryptosugarbabes | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
if [ -n "$DISK_PERCENT" ] && [ "$DISK_PERCENT" -ge 85 ]; then ERRORS+=("server disk is ${DISK_PERCENT}% full"); fi

LATEST_DATABASE="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'database-*.sql.gz' -type f -mmin -1560 -print -quit 2>/dev/null || true)"
test -n "$LATEST_DATABASE" || ERRORS+=("no database backup newer than 26 hours")
LATEST_UPLOADS="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'uploads-*.tar.gz' -type f -mmin -1560 -print -quit 2>/dev/null || true)"
test -n "$LATEST_UPLOADS" || ERRORS+=("no uploads backup newer than 26 hours")

RECENT_RESTORE="$(find "$BACKUP_ROOT" -maxdepth 1 -name '.last-restore-success' -type f -mmin -11520 -print -quit 2>/dev/null || true)"
test -n "$RECENT_RESTORE" || ERRORS+=("no successful restore verification in the last 8 days")

if [ -n "${BACKUP_S3_URI:-}" ]; then
  RECENT_OFFSITE="$(find "$BACKUP_ROOT" -maxdepth 1 -name '.last-offsite-success' -type f -mmin -1560 -print -quit 2>/dev/null || true)"
  test -n "$RECENT_OFFSITE" || ERRORS+=("no successful encrypted offsite backup newer than 26 hours")
fi
if [ "${BACKUP_EXPORT_ENABLED:-0}" = "1" ]; then
  RECENT_EXPORT="$(find "$EXPORT_ROOT" -maxdepth 1 -name '.last-offsite-success' -type f -mmin -1560 -print -quit 2>/dev/null || true)"
  test -n "$RECENT_EXPORT" || ERRORS+=("no encrypted GitHub offsite backup newer than 26 hours")
fi

send_telegram() {
  local message="$1"
  test -n "${TELEGRAM_BOT_TOKEN:-}" && test -n "${TELEGRAM_CHAT_ID:-}" || return 1
  curl --fail --silent --show-error --max-time 20 \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${message}" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" >/dev/null
}

send_email() {
  local message="$1"
  local recipients="${MONITOR_ALERT_EMAILS:-${ADMIN_MESSAGE_ALERT_EMAILS:-${ADMIN_EMAILS:-}}}"
  local host="${EMAIL_SMTP_HOST:-smtp.hostinger.com}"
  local port="${EMAIL_SMTP_PORT:-465}"
  test -n "$recipients" && test -n "${EMAIL_SMTP_USER:-}" && test -n "${EMAIL_SMTP_PASSWORD:-}" || return 1

  local scheme="smtp"
  if [ "$port" = "465" ]; then scheme="smtps"; fi
  local mail_file
  mail_file="$(mktemp)"
  local subject="Crypto Sugar monitoring alert"
  if [[ "$message" == *"recovered"* ]]; then subject="Crypto Sugar monitoring recovered"; fi
  {
    printf 'From: Crypto Sugar Monitoring <%s>\r\n' "$EMAIL_SMTP_USER"
    printf 'To: %s\r\n' "$recipients"
    printf 'Subject: %s\r\n' "$subject"
    printf 'Content-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n' "$message"
  } > "$mail_file"

  local curl_args=(--fail --silent --show-error --max-time 30 --ssl-reqd --url "${scheme}://${host}:${port}" --user "${EMAIL_SMTP_USER}:${EMAIL_SMTP_PASSWORD}" --mail-from "$EMAIL_SMTP_USER")
  local recipient
  IFS=',' read -ra recipient_list <<< "$recipients"
  for recipient in "${recipient_list[@]}"; do
    recipient="${recipient//[[:space:]]/}"
    if [ -n "$recipient" ]; then curl_args+=(--mail-rcpt "$recipient"); fi
  done
  local result=0
  curl "${curl_args[@]}" --upload-file "$mail_file" || result=$?
  rm -f "$mail_file"
  return "$result"
}

deliver_alert() {
  local message="$1"
  send_telegram "$message" || logger -t cryptosugar-monitor "Telegram alert delivery failed"
  send_email "$message" || logger -t cryptosugar-monitor "Email alert delivery failed"
  if [ -n "${MONITOR_WEBHOOK_URL:-}" ]; then
    curl --fail --silent --max-time 15 -X POST -H 'content-type: application/json' \
      --data "{\"text\":\"$message\"}" "$MONITOR_WEBHOOK_URL" >/dev/null || true
  fi
}

if [ "${1:-}" = "--test-alert" ]; then
  TEST_MESSAGE="Crypto Sugar monitoring test: Telegram and email alert delivery is working."
  TEST_FAILURES=0
  send_telegram "$TEST_MESSAGE" || { echo "Telegram test alert failed."; TEST_FAILURES=$((TEST_FAILURES + 1)); }
  send_email "$TEST_MESSAGE" || { echo "Email test alert failed."; TEST_FAILURES=$((TEST_FAILURES + 1)); }
  if [ "$TEST_FAILURES" -gt 0 ]; then exit 1; fi
  echo "Telegram and email monitoring test alerts were delivered."
  exit 0
fi

PREVIOUS_STATUS="UNKNOWN"
PREVIOUS_ALERT=0
if [ -f "$STATE_FILE" ]; then read -r PREVIOUS_STATUS PREVIOUS_ALERT < "$STATE_FILE" || true; fi
NOW="$(date +%s)"
ALERT_INTERVAL="${MONITOR_ALERT_INTERVAL_SECONDS:-21600}"

if [ "${#ERRORS[@]}" -gt 0 ]; then
  MESSAGE="Crypto Sugar alert: $(IFS='; '; echo "${ERRORS[*]}")"
  logger -t cryptosugar-monitor "$MESSAGE"
  if [ "$PREVIOUS_STATUS" != "FAIL" ] || [ $((NOW - PREVIOUS_ALERT)) -ge "$ALERT_INTERVAL" ]; then
    deliver_alert "$MESSAGE"
    PREVIOUS_ALERT="$NOW"
  fi
  printf 'FAIL %s\n' "$PREVIOUS_ALERT" > "$STATE_FILE"
  echo "$MESSAGE"
  exit 1
fi

if [ "$PREVIOUS_STATUS" = "FAIL" ]; then
  RECOVERY_MESSAGE="Crypto Sugar monitoring recovered: public site, service, backups, restore verification, and disk checks are healthy."
  logger -t cryptosugar-monitor "$RECOVERY_MESSAGE"
  deliver_alert "$RECOVERY_MESSAGE"
fi
printf 'OK %s\n' "$NOW" > "$STATE_FILE"
echo "Crypto Sugar health and backup freshness checks passed."
