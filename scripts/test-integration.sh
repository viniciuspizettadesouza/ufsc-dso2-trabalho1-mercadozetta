#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.integration.yml"
project_name="mercadozetta-integration"

cleanup() {
  docker compose -p "$project_name" -f "$compose_file" down --volumes
}

trap cleanup EXIT
docker compose -p "$project_name" -f "$compose_file" up \
  --build \
  --abort-on-container-exit \
  --attach integration-tests \
  --exit-code-from integration-tests
