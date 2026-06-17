#!/usr/bin/env bash
# Bootstrap Oracle Cloud Always Free VM (Ubuntu 22.04/24.04 ARM or x86).
# Run as root on a fresh instance: bash scripts/oracle-bootstrap.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/oracle-bootstrap.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git ufw

# Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# Firewall — Oracle also needs ingress rules in the cloud console (80, 443, 22).
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

APP_DIR="${APP_DIR:-/opt/haff-picklepulse}"
REPO_URL="${REPO_URL:-}"

if [[ -n "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/deploy/env.production.example" "${APP_DIR}/.env"
  echo ""
  echo "Edit ${APP_DIR}/.env (API_DOMAIN, FRONTEND_ORIGIN, COOKIE_DOMAIN, POSTGRES_PASSWORD)"
  echo "Then run: cd ${APP_DIR} && docker compose -f docker-compose.production.yml up -d --build"
  exit 0
fi

cd "${APP_DIR}"
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec -T app npx prisma db push

echo ""
echo "API should be live after DNS points to this VM and Caddy obtains a certificate."
echo "Health: curl -s https://\${API_DOMAIN}/health"
