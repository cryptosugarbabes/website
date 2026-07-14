#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this bootstrap as root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx rsync openssl

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

id -u cryptosugar >/dev/null 2>&1 || \
  useradd --system --home /opt/cryptosugarbabes --shell /usr/sbin/nologin cryptosugar

mkdir -p /opt/cryptosugarbabes/releases /opt/cryptosugarbabes/shared
chown -R cryptosugar:cryptosugar /opt/cryptosugarbabes

if [ ! -f /opt/cryptosugarbabes/shared/.env ]; then
  AUTH_SECRET="$(openssl rand -hex 32)"
  cat > /opt/cryptosugarbabes/shared/.env <<EOF
AUTH_SECRET=${AUTH_SECRET}
DEPLOY_SHA=production
EOF
  chmod 600 /opt/cryptosugarbabes/shared/.env
  chown cryptosugar:cryptosugar /opt/cryptosugarbabes/shared/.env
fi

install -m 0644 /tmp/cryptosugarbabes-bootstrap/cryptosugarbabes.service \
  /etc/systemd/system/cryptosugarbabes.service

if [ ! -f /etc/nginx/sites-available/cryptosugarbabes.com ]; then
  install -m 0644 /tmp/cryptosugarbabes-bootstrap/cryptosugarbabes.nginx \
    /etc/nginx/sites-available/cryptosugarbabes.com
  ln -s /etc/nginx/sites-available/cryptosugarbabes.com \
    /etc/nginx/sites-enabled/cryptosugarbabes.com
fi

systemctl daemon-reload
nginx -t
systemctl reload nginx

echo "VPS bootstrap complete. Node $(node --version) is installed."
