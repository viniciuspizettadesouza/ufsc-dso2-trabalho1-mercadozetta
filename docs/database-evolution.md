# Database evolution and rollback policy

- Status: Accepted
- Date: 2026-07-19
- Scope: PostgreSQL schema and data migrations deployed with MercadoZetta

MercadoZetta applies reviewed, versioned Drizzle migrations before starting a
new backend image. This policy defines when that ordering is safe, which
application versions may overlap, how data changes are validated, and what
"rollback" means after a migration has run. Backup and restore mechanics are a
separate Step 12 deliverable; until those mechanics are documented and
rehearsed, a release that could require database restore is not production-ready.

## Current migration and deployment behavior

The production Compose topology uses a one-shot `migrate` service from the same
immutable backend image as the release. It waits for PostgreSQL health, runs
`db:migrate:runtime`, and the new backend starts only after that service exits
successfully. The checked-in migration journal is authoritative; production
must not use `drizzle-kit push` or infer changes from the TypeScript schema.

The pinned Drizzle PostgreSQL migrator records applied files in
`drizzle.__drizzle_migrations` and applies all pending migration statements in
one transaction. A statement error or the configured statement timeout rolls
back that pending transaction and prevents the new backend from starting. The
operator must still inspect the database and migration record after a failure;
the runner's success message, not container completion alone, is the acceptance
signal.

Compose enforces new-container start order, but it does not drain an already
running old backend and it does not provide a database advisory lock for a
second independently launched migration job. A deployment must therefore use
one migration runner and must either:

- prove that the old and new applications may both write against the expanded
  schema for the complete rollout window; or
- drain writes and use maintenance mode before migration.

The migration tool also does not reject an old image merely because the
database contains newer migrations. Image rollback must use the compatibility
decision for that release; a successful no-op invocation of an old migration
runner is not proof that the old application is safe.

## Audit of migrations 0000 through 0007

| Migration                           | Change and data work                                                                                                                                                                                              | Preceding application on migrated schema                                                                                                           | Supported overlap and rollback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_initial_postgresql.sql`       | Creates the original 12 tables, tenant anchors, constraints, and baseline indexes.                                                                                                                                | Not applicable; this is an empty-database bootstrap.                                                                                               | No rolling overlap. Before any accepted writes, discard and recreate the database if bootstrap fails. After writes, rollback requires the restore rules for the affected data.                                                                                                                                                                                                                                                                                                                                   |
| `0001_next_expediter.sql`           | Adds the product name and inventory indexes; no data rewrite.                                                                                                                                                     | Yes. The preceding application neither requires nor conflicts with the indexes.                                                                    | Old and new versions may overlap. Application rollback leaves the indexes in place. Remove them only through a later reviewed migration if operational evidence requires it.                                                                                                                                                                                                                                                                                                                                     |
| `0002_easy_jasper_sitwell.sql`      | Adds append-only audit events, indexes, and mutation-rejection triggers; no reconstructable audit backfill.                                                                                                       | Structurally yes; the preceding application ignores the new table.                                                                                 | Mixed writes are not semantically supported because the preceding application does not append the required audit events. Drain audited mutations for rollout or rollback. Leave audit rows and triggers in place during application rollback; never erase audit evidence as an ordinary rollback step.                                                                                                                                                                                                           |
| `0003_famous_miek.sql`              | Adds account tokens, user email verification/version fields, constraints and indexes, expands audit event types, and backfills existing users as verified.                                                        | Yes for the historical release: added fields have compatible defaults/nullability, and verification/recovery was not yet exposed by public routes. | A bounded old/new overlap is structurally safe only while login enforcement remains unchanged. Application rollback may leave token rows and added columns in place, but disables the newer verification/recovery behavior. The whole-table user backfill and constraint changes require lock-duration rehearsal before use on a populated production-sized table.                                                                                                                                               |
| `0004_melted_nekra.sql`             | Adds pending email changes and `users.deactivated_at`, expands account-token constraints and audit event types; no row backfill.                                                                                  | Structurally yes; the preceding application ignores the additions.                                                                                 | Mixed application versions are not supported after account deactivation is enabled: a pre-`0004` application does not enforce `deactivated_at` and could restore login or public visibility. Drain old writers before activation. Do not roll back to a pre-deactivation application after any account is deactivated unless traffic is stopped and a separately reviewed compensation preserves the security boundary. Leave the schema and retained account/audit records in place.                            |
| `0005_special_marauders.sql`        | Adds the order checkout-idempotency UUID, backfills existing orders, installs a safe default, and enforces tenant/buyer/key uniqueness.                                                                           | Structurally yes; preceding writers receive a generated key from PostgreSQL, but they do not honor a client key or provide replay semantics.       | Drain checkout requests across the application switch so every accepted request receives one consistent idempotency contract. Application rollback may leave the populated column, default, and constraint in place. At production scale, rehearse and, if necessary, replace the one-shot backfill with bounded batches before deployment.                                                                                                                                                                      |
| `0006_yielding_captain_america.sql` | Adds tenant/actor/operation-scoped product and review idempotency records without rewriting domain rows.                                                                                                          | Structurally yes; the preceding application ignores the new table.                                                                                 | Mixed versions do not share replay guarantees for product/review mutations. Drain those mutations across the switch. Application rollback leaves completed replay records in place so a later compatible release can preserve their results.                                                                                                                                                                                                                                                                     |
| `0007_red_marvex.sql`               | Expands tenant currency, nullable product prices, explicit legacy/priced order shapes, immutable line/header snapshots, and append-only price history. No existing product or order receives a fabricated amount. | Yes during the expand stage: defaults preserve old product writes and classify every preceding checkout as `legacy_unpriced`.                      | Old/new checkout writers may overlap only while the new application does not require priced orders. Drain old checkout writers before priced checkout is activated. Rollback may leave nullable columns and the empty/new history table in place. After priced writes exist, do not roll back to code that can create legacy orders or ignore prices; deploy a compatible release or compensating forward migration. Rehearse the foreign-key replacement and constraint locks on production-sized order tables. |

This table records compatibility of the existing history; it does not authorize
editing an applied migration. Migration SQL, Drizzle snapshots, and journal
entries are immutable after acceptance. Corrections use a new migration.

## Expand, migrate, contract

Every future database change must name the oldest and newest application images
supported during rollout and demonstrate both read and write compatibility. Use
these phases when a change cannot be proven compatible in one additive step:

1. **Expand:** add nullable columns, tables, permissive constraints, or indexes
   without removing or changing meanings used by the old application. New
   required values need a safe database default or dual-write behavior.
2. **Migrate:** deploy code that understands both representations. Backfill in
   restartable, bounded batches when a single transaction would exceed the
   measured lock or deployment window. Record counts and invariant queries
   before and after each batch without logging secrets or personal data.
3. **Validate:** prove every row has the new representation and that old and new
   paths produce equivalent domain results. Add expensive constraints with a
   low-lock PostgreSQL strategy when appropriate, then validate them explicitly.
4. **Switch:** make the new representation authoritative only after validation
   and critical workflow checks pass. Keep compatibility writes for the stated
   rollback window.
5. **Contract:** in a later release, after all old instances and jobs are gone
   and the rollback window has closed, remove obsolete columns, constraints,
   indexes, or compatibility code through a new migration.

Adding a `NOT NULL` column without a safe default, renaming or dropping a live
column, narrowing a check constraint, changing an enum-like text meaning, or
rewriting a large table is not a one-release change. `CREATE INDEX` can block
writes, and `CREATE INDEX CONCURRENTLY` cannot run inside the current migration
transaction; use a rehearsed maintenance window or a separately reviewed,
observable migration procedure rather than silently placing a concurrent index
in the normal runner.

Application/API compatibility and database compatibility are separate gates. A
binary that can execute SQL successfully is still incompatible if it bypasses
an authorization, lifecycle, audit, tenant-isolation, or security rule introduced
by the newer version.

## Preflight, validation, and deployment gates

For each migration release, its change record must contain:

- the exact immutable old and new image tags and migration filenames;
- the old/new read and write compatibility matrix, including workers and
  one-shot jobs, with a stated maintenance-mode decision;
- expected DDL locks, estimated row counts and runtime from a production-like
  rehearsal, free storage, and the configured statement timeout;
- a verified backup identifier and restore rehearsal when the change can lose
  or reinterpret data;
- before/after aggregate and invariant queries, with tenant boundaries and
  sensitive-value redaction; and
- readiness plus critical catalog, login, checkout, fulfillment, session, and
  affected-feature smoke checks.

For the existing history, an empty database must apply `0000` through `0007`
and match the checked-in schema contract. An upgrade rehearsal from each
supported prior release must also pass. The `0003` rehearsal must record the
preexisting-user count and prove those users received non-null
`email_verified_at` with non-negative `email_version`. The `0004` rehearsal must
prove its new table and constraints exist, pending email uniqueness is
tenant-scoped and case-insensitive, and no existing account, commerce, or audit
row changed.

Migration `0005` compatibly adds checkout replay keys. Migration `0006` adds
tenant/actor/operation-scoped product and review replay records without
rewriting existing domain rows. Its key, request fingerprint, and resource
identifier contain no request body or secret and remain retained while the
replayed commerce resource remains available.

Migration `0007` defaults both existing tenant anchors to `USD` exponent `2`,
leaves existing product prices null, and marks existing and old-writer orders
and lines `legacy_unpriced` with null monetary fields. Validation must prove it
did not populate product or commerce amounts. Its manually reviewed trigger SQL
is authoritative for append-only price history and immutable order snapshots;
the schema-contract and PostgreSQL integration tests detect drift from that
custom behavior.

Abort before migration when the expected previous migration is absent, an
unknown migration or schema drift is present, a second runner exists, the
backup/restore gate is unmet, capacity is insufficient, old writers cannot be
drained or supported, or rehearsal exceeds the approved lock/runtime window.
Abort the rollout and keep traffic on the old compatible application when the
migration times out or fails, a validation invariant differs, the new backend
is not ready, critical smoke tests fail, or deployment error/latency signals
cross their accepted thresholds. Do not retry an uncertain migration until its
transaction and journal state have been inspected.

## Choosing the rollback mechanism

Use the least destructive mechanism that restores a correct and secure service:

### Application rollback

Roll back to the previous immutable image while leaving the expanded schema in
place only when the release matrix proves that image remains read-, write-, and
semantics-compatible with all data already committed by the new version. Stop
writes first when persisted behavior or a security boundary is in doubt. Run
the old image's readiness and critical workflows before reopening traffic.

### Compensating forward migration

After a migration has committed or the new application has accepted writes,
prefer a new reviewed migration that repairs the schema/data while preserving
acknowledged writes. Never edit the applied SQL or delete its journal row. The
compensation needs its own backup, compatibility matrix, validation, audit-data
treatment, and deployment gates. Destructive compensation requires explicit
approval and evidence that retained commerce and audit history remains valid.

### Database restore

Restore only for corruption, destructive transformation, or another failure
that cannot be corrected safely in place. Put the service in maintenance mode,
stop every writer and migration runner, preserve the failed database for
investigation, and restore the verified backup together with an application
image compatible with that backup's schema. A restore discards writes accepted
after its recovery point unless a reviewed replay/reconciliation plan preserves
them; that data-loss decision requires explicit authorization. Validate the
migration journal, schema, row counts, tenant and domain invariants, readiness,
and critical workflows before reopening traffic.

Automatic down migrations are not part of MercadoZetta's deployment contract.
They make destructive rollback too easy, cannot generally recover transformed
data, and are unsafe for append-only audit evidence.
