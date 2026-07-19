#!/usr/bin/env bash
set -euo pipefail

postgres_image="${POSTGRES_IMAGE:-postgres:18-alpine}"
container_name="mercadozetta-recovery-rehearsal-$$"
source_database="mercadozetta_recovery"
restore_database="mercadozetta_restore"
database_user="mercadozetta"
database_password="rehearsal-only"
rehearsal_dir="$(mktemp -d)"
prior_migrations="$rehearsal_dir/migrations-0000-0003"
pre_migration_backup="$rehearsal_dir/pre-migration.dump"
current_backup="$rehearsal_dir/current.dump"
metadata_file="$rehearsal_dir/current.metadata"

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  rm -rf "$rehearsal_dir"
}

trap cleanup EXIT

mkdir -p "$prior_migrations/meta"
cp backend/drizzle/0000_initial_postgresql.sql "$prior_migrations/"
cp backend/drizzle/0001_next_expediter.sql "$prior_migrations/"
cp backend/drizzle/0002_easy_jasper_sitwell.sql "$prior_migrations/"
cp backend/drizzle/0003_famous_miek.sql "$prior_migrations/"
node -e '
  const fs = require("node:fs");
  const journal = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  journal.entries = journal.entries.slice(0, 4);
  fs.writeFileSync(process.argv[2], `${JSON.stringify(journal, null, 2)}\n`);
' backend/drizzle/meta/_journal.json "$prior_migrations/meta/_journal.json"

docker run --detach \
  --name "$container_name" \
  --env POSTGRES_DB="$source_database" \
  --env POSTGRES_USER="$database_user" \
  --env POSTGRES_PASSWORD="$database_password" \
  --publish 127.0.0.1::5432 \
  --tmpfs /var/lib/postgresql \
  "$postgres_image" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready \
    --username "$database_user" --dbname "$source_database" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container_name" pg_isready \
  --username "$database_user" --dbname "$source_database" >/dev/null

mapped_port="$(docker port "$container_name" 5432/tcp)"
host_port="${mapped_port##*:}"
source_url="postgresql://$database_user:$database_password@127.0.0.1:$host_port/$source_database"
restore_url="postgresql://$database_user:$database_password@127.0.0.1:$host_port/$restore_database"

run_migrations() {
  local database_url="$1"
  local migrations_folder="$2"
  POSTGRESQL_URL="$database_url" \
    DRIZZLE_MIGRATIONS_DIR="$migrations_folder" \
    NODE_ENV=test \
    npm --prefix backend run db:migrate:source >/dev/null
}

source_psql() {
  docker exec -i "$container_name" psql \
    --username "$database_user" --dbname "$source_database" \
    --set ON_ERROR_STOP=1 "$@"
}

restore_psql() {
  docker exec -i "$container_name" psql \
    --username "$database_user" --dbname "$restore_database" \
    --set ON_ERROR_STOP=1 "$@"
}

core_fingerprint() {
  local database="$1"
  docker exec "$container_name" psql \
    --username "$database_user" --dbname "$database" --tuples-only --no-align \
    --command "select concat_ws(':',
      (select count(*) from users),
      (select count(*) from products),
      (select count(*) from carts),
      (select count(*) from cart_items),
      (select count(*) from watchlist_entries),
      (select count(*) from orders),
      (select count(*) from order_items),
      (select count(*) from order_status_history),
      (select count(*) from reviews),
      (select count(*) from notifications),
      (select count(*) from sessions),
      (select count(*) from account_tokens),
      (select coalesce(sum(inventory), 0) from products));"
}

current_fingerprint() {
  local database="$1"
  docker exec "$container_name" psql \
    --username "$database_user" --dbname "$database" --tuples-only --no-align \
    --command "select concat_ws(':',
      (select count(*) from users),
      (select count(*) from pending_email_changes),
      (select count(*) from products),
      (select count(*) from carts),
      (select count(*) from cart_items),
      (select count(*) from watchlist_entries),
      (select count(*) from orders),
      (select count(*) from order_items),
      (select count(*) from order_status_history),
      (select count(*) from reviews),
      (select count(*) from notifications),
      (select count(*) from sessions),
      (select count(*) from account_tokens),
      (select count(*) from audit_events),
      (select count(*) from users where deactivated_at is not null),
      (select coalesce(sum(inventory), 0) from products));"
}

migration_started_ms="$(date +%s%3N)"
run_migrations "$source_url" "$prior_migrations"
source_psql < backend/test/fixtures/recovery-rehearsal-pre-0004.sql >/dev/null
pre_migration_fingerprint="$(core_fingerprint "$source_database")"

docker exec "$container_name" pg_dump \
  --username "$database_user" --format custom --no-owner --no-privileges \
  "$source_database" > "$pre_migration_backup"
docker exec -i "$container_name" pg_restore --list < "$pre_migration_backup" \
  | grep '__drizzle_migrations' >/dev/null

run_migrations "$source_url" "$(pwd)/backend/drizzle"
test "$(core_fingerprint "$source_database")" = "$pre_migration_fingerprint"
test "$(source_psql --tuples-only --no-align --command \
  "select count(*) from drizzle.__drizzle_migrations;")" = "7"
migration_duration_ms="$(( $(date +%s%3N) - migration_started_ms ))"

source_psql < backend/test/fixtures/recovery-rehearsal-current.sql >/dev/null
expected_fingerprint="$(current_fingerprint "$source_database")"
source_psql --command "
  explain select id from sessions
    where expires_at <= '2026-07-12T00:00:00Z' or revoked_at <= '2026-07-12T00:00:00Z'
    order by least(expires_at, coalesce(revoked_at, 'infinity'::timestamptz)), id limit 100;
  explain select id from account_tokens
    where expires_at <= '2026-07-12T00:00:00Z'
       or consumed_at <= '2026-07-12T00:00:00Z'
       or invalidated_at <= '2026-07-12T00:00:00Z'
    order by least(expires_at, coalesce(consumed_at, 'infinity'::timestamptz),
      coalesce(invalidated_at, 'infinity'::timestamptz)), id limit 100;
  explain select id from pending_email_changes
    where expires_at <= '2026-07-18T00:00:00Z' order by expires_at, id limit 100;
  explain select id from notifications
    where is_read = true and updated_at <= '2026-06-19T00:00:00Z'
    order by updated_at, id limit 100;
  explain select id from carts
    where updated_at <= '2026-06-19T00:00:00Z' order by updated_at, id limit 100;
" > "$rehearsal_dir/cleanup-query-plans.txt"
grep 'sessions' "$rehearsal_dir/cleanup-query-plans.txt" >/dev/null
grep 'notifications' "$rehearsal_dir/cleanup-query-plans.txt" >/dev/null
grep 'carts' "$rehearsal_dir/cleanup-query-plans.txt" >/dev/null

backup_started_ms="$(date +%s%3N)"
docker exec "$container_name" pg_dump \
  --username "$database_user" --format custom --no-owner --no-privileges \
  "$source_database" > "$current_backup"
docker exec -i "$container_name" pg_restore --list < "$current_backup" \
  | grep '__drizzle_migrations' >/dev/null
backup_checksum="$(sha256sum "$current_backup" | cut -d ' ' -f 1)"
backup_size="$(wc -c < "$current_backup")"
backup_duration_ms="$(( $(date +%s%3N) - backup_started_ms ))"
{
  echo "created_at=$(date --utc +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_revision=$(git rev-parse HEAD)"
  echo "postgres_image=$postgres_image"
  echo "backend_image=${BACKEND_IMAGE:-source-$(git rev-parse --short HEAD)}"
  echo "frontend_image=${FRONTEND_IMAGE:-source-$(git rev-parse --short HEAD)}"
  echo "migration_count=7"
  echo "sha256=$backup_checksum"
  echo "bytes=$backup_size"
} > "$metadata_file"

source_psql --command "delete from notifications;" >/dev/null
test "$(current_fingerprint "$source_database")" != "$expected_fingerprint"

restore_started_ms="$(date +%s%3N)"
docker exec "$container_name" createdb \
  --username "$database_user" "$restore_database"
docker exec -i "$container_name" pg_restore \
  --username "$database_user" --dbname "$restore_database" \
  --no-owner --no-privileges --exit-on-error < "$current_backup"
run_migrations "$restore_url" "$(pwd)/backend/drizzle"
restore_duration_ms="$(( $(date +%s%3N) - restore_started_ms ))"

test "$(current_fingerprint "$restore_database")" = "$expected_fingerprint"
test "$(restore_psql --tuples-only --no-align --command \
  "select count(*) from drizzle.__drizzle_migrations;")" = "7"
test "$(restore_psql --tuples-only --no-align --command \
  "select count(*) from order_items oi join orders o
   on o.tenant_id = oi.tenant_id and o.id = oi.order_id
   join products p on p.tenant_id = oi.tenant_id and p.id = oi.product_id;")" = "1"
test "$(restore_psql --tuples-only --no-align --command \
  "select count(*) from audit_events where event_type = 'user.deactivated';")" = "1"

if restore_psql --command \
  "update audit_events set metadata = '{}' where id = 'b0000000-0000-4000-8000-000000000001';" \
  >/dev/null 2>&1; then
  echo 'restored audit immutability trigger did not reject update' >&2
  exit 1
fi

echo "Recovery rehearsal passed"
echo "  migration_ms=$migration_duration_ms"
echo "  backup_ms=$backup_duration_ms"
echo "  restore_ms=$restore_duration_ms"
echo "  backup_bytes=$backup_size"
echo "  backup_sha256=$backup_checksum"
