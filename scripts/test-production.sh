#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.prod.yml"
project_name="mercadozetta-production-smoke"
app_port="${PRODUCTION_SMOKE_PORT:-8088}"
base_url="http://127.0.0.1:${app_port}"

cleanup() {
  docker compose -p "$project_name" -f "$compose_file" down --volumes
}

trap cleanup EXIT

export APP_PORT="$app_port"
export CORS_ORIGIN="$base_url"
export POSTGRES_PASSWORD='production-smoke-database-secret'
export JWT_SIGNING_KEYS='{"smoke":"production-smoke-jwt-secret"}'
export JWT_ACTIVE_KID='smoke'
export REFRESH_TOKEN_HASH_SECRETS='{"smoke":"production-smoke-refresh-secret"}'
export REFRESH_TOKEN_HASH_ACTIVE_VERSION='smoke'
export CSRF_SECRETS='{"smoke":"production-smoke-csrf-secret"}'
export CSRF_ACTIVE_VERSION='smoke'

docker compose -p "$project_name" -f "$compose_file" config --quiet
docker compose -p "$project_name" -f "$compose_file" up \
  --build \
  --detach \
  --wait

docker compose -p "$project_name" -f "$compose_file" exec --no-TTY backend \
  sh -c 'test "$(id -u)" -ne 0 && test -f dist/server.js'
docker compose -p "$project_name" -f "$compose_file" exec --no-TTY frontend \
  sh -c 'test "$(id -u)" -ne 0 && test -f /usr/share/nginx/html/index.html'

curl --fail --silent --show-error "$base_url/healthz"
curl --fail --silent --show-error "$base_url/readyz"
curl --fail --silent --show-error "$base_url/" | grep --quiet '<div id="root"></div>'
curl --fail --silent --show-error \
  --header 'X-Tenant-Id: mercadozetta' \
  "$base_url/api/health"
curl --fail --silent --show-error \
  --header 'X-Tenant-Id: mercadozetta' \
  "$base_url/api/products"
