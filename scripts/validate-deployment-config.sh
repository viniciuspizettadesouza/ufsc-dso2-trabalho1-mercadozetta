#!/usr/bin/env bash
set -euo pipefail

export BACKEND_IMAGE='ghcr.io/example/mercadozetta-backend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
export FRONTEND_IMAGE='ghcr.io/example/mercadozetta-frontend@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
export POSTGRESQL_URL='postgresql://staging:local-validation@private-db:5432/mercadozetta?sslmode=require'
export CORS_ORIGIN='https://staging.example.invalid'
export JWT_SIGNING_KEYS='{"validation":"local-only"}'
export JWT_ACTIVE_KID='validation'
export REFRESH_TOKEN_HASH_SECRETS='{"validation":"local-only"}'
export REFRESH_TOKEN_HASH_ACTIVE_VERSION='validation'
export CSRF_SECRETS='{"validation":"local-only"}'
export CSRF_ACTIVE_VERSION='validation'
export ACCOUNT_TOKEN_HASH_SECRETS='{"validation":"local-only"}'
export ACCOUNT_TOKEN_HASH_ACTIVE_VERSION='validation'

docker compose -f deploy/digitalocean/docker-compose.staging.yml config --quiet

if grep -En 'latest|Set real|replace-before' \
  deploy/render/render.staging.yaml \
  deploy/digitalocean/docker-compose.staging.yml; then
  echo 'Deployment templates contain a mutable tag or unresolved safety marker' >&2
  exit 1
fi

grep -nF 'sha256:IMAGE_DIGEST' deploy/render/render.staging.yaml >/dev/null
grep -nF 'sync: false' deploy/render/render.staging.yaml >/dev/null
grep -nF 'ipAllowList: []' deploy/render/render.staging.yaml >/dev/null

echo 'Deployment configuration templates passed local validation'
