#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.prod.yml"
base_port="${STAGING_READINESS_PORT:-8088}"
current_project=""

cleanup_project() {
  local project_name="$1"
  docker compose -p "$project_name" -f "$compose_file" down --volumes
}

cleanup() {
  if [[ -n "$current_project" ]]; then
    cleanup_project "$current_project"
  fi
}

trap cleanup EXIT

run_tenant() {
  local tenant_id="$1"
  local port="$2"
  local project_name="mercadozetta-staging-${tenant_id}"
  local base_url="http://localhost:${port}"

  cleanup_project "$project_name" >/dev/null 2>&1 || true
  current_project="$project_name"

  export APP_PORT="$port"
  export CORS_ORIGIN="$base_url"
  export VITE_TENANT_ID="$tenant_id"
  export POSTGRES_PASSWORD="staging-readiness-database-secret"
  export JWT_SIGNING_KEYS='{"readiness":"staging-readiness-jwt-secret"}'
  export JWT_ACTIVE_KID='readiness'
  export REFRESH_TOKEN_HASH_SECRETS='{"readiness":"staging-readiness-refresh-secret"}'
  export REFRESH_TOKEN_HASH_ACTIVE_VERSION='readiness'
  export CSRF_SECRETS='{"readiness":"staging-readiness-csrf-secret"}'
  export CSRF_ACTIVE_VERSION='readiness'
  export ACCOUNT_TOKEN_HASH_SECRETS='{"readiness":"staging-readiness-account-token-secret"}'
  export ACCOUNT_TOKEN_HASH_ACTIVE_VERSION='readiness'
  export RATE_LIMIT_AUTH_MAX=100
  export RATE_LIMIT_REGISTER_MAX=100

  docker compose -p "$project_name" -f "$compose_file" config --quiet
  docker compose -p "$project_name" -f "$compose_file" up \
    --build \
    --detach \
    --wait

  docker compose -p "$project_name" -f "$compose_file" exec --no-TTY backend \
    sh -c 'test "$(id -u)" -ne 0 && test -f dist/server.js && test -f dist/scripts/cleanupPostgresData.js'
  docker compose -p "$project_name" -f "$compose_file" exec --no-TTY frontend \
    sh -c 'test "$(id -u)" -ne 0 && test -f /usr/share/nginx/html/index.html'
  docker compose -p "$project_name" -f "$compose_file" exec --no-TTY backend \
    npm run seed:demo:runtime
  docker compose -p "$project_name" -f "$compose_file" exec --no-TTY backend \
    npm run cleanup:data:runtime

  curl --fail --silent --show-error "$base_url/healthz"
  curl --fail --silent --show-error "$base_url/readyz"
  curl --fail --silent --show-error \
    --header "X-Tenant-Id: $tenant_id" \
    "$base_url/api/products" >/dev/null

  E2E_BASE_URL="$base_url" \
    E2E_API_URL="$base_url/api" \
    E2E_TENANT_ID="$tenant_id" \
    E2E_PRODUCTION_COOKIES=true \
    env -u NO_COLOR npm run test:e2e:browser

  LOAD_BASE_URL="$base_url" \
    LOAD_TENANT_ID="$tenant_id" \
    npm run test:load:smoke

  cleanup_project "$project_name"
  current_project=""
}

run_tenant mercadozetta "$base_port"
run_tenant campus-market "$((base_port + 1))"

echo 'Local staging readiness passed for MercadoZetta and CampusMarket'
