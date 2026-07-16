#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.e2e.yml"
project_name="mercadozetta-e2e-postgresql"

cleanup() {
  docker compose -p "$project_name" -f "$compose_file" down --volumes
}

trap cleanup EXIT

docker compose -p "$project_name" -f "$compose_file" \
  up --build --detach --wait
docker compose -p "$project_name" -f "$compose_file" \
  exec --no-TTY backend-e2e npm run seed:demo
env -u NO_COLOR npm run test:e2e:browser
