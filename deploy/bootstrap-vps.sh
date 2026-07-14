#!/usr/bin/env bash
set -euo pipefail

SSH_USER="${1:-root}"
SSH_HOST="${2:-161.35.17.40}"
SSH_KEY="${3:-$HOME/.ssh/prima_ordia_vps}"
TARGET="${SSH_USER}@${SSH_HOST}"
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o IdentitiesOnly=yes)

ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p /tmp/cryptosugarbabes-bootstrap"
scp "${SSH_OPTS[@]}" \
  deploy/server/bootstrap.sh \
  deploy/server/setup-data.sh \
  deploy/server/backup-data.sh \
  deploy/server/cryptosugarbabes.service \
  deploy/server/cryptosugarbabes.nginx \
  "${TARGET}:/tmp/cryptosugarbabes-bootstrap/"
ssh "${SSH_OPTS[@]}" "$TARGET" "bash /tmp/cryptosugarbabes-bootstrap/bootstrap.sh"
ssh "${SSH_OPTS[@]}" "$TARGET" "bash /tmp/cryptosugarbabes-bootstrap/setup-data.sh"
