# PostgreSQL backup, restore, and rehearsal runbook

- Status: Accepted baseline
- Date: 2026-07-19
- Scope: MercadoZetta PostgreSQL data and versioned Drizzle schema

This provider-neutral baseline complements the
[database evolution policy](database-evolution.md). A deployment platform may
replace the commands with managed PostgreSQL facilities only when it preserves
or improves the objectives, isolation, metadata, validation, and rehearsal
requirements below.

## Recovery objectives and ownership

- **Recovery point objective (RPO): 24 hours.** Take at least one verified full
  backup per UTC day and an additional backup immediately before any migration
  that can reinterpret or remove data. A provider with continuous WAL archiving
  may offer a smaller RPO, but point-in-time recovery is not assumed by this
  baseline.
- **Recovery time objective (RTO): 4 hours.** The operator must be able to
  provision a fresh target, restore, apply any compatible forward migration,
  validate, deploy matching immutable images, and reopen traffic within four
  hours of the restore decision.
- **Retention:** keep daily backups for 14 days. Keep a verified pre-migration
  backup for at least seven days and until that release's rollback window is
  explicitly closed, whichever is later. A future legal or hosting requirement
  may extend this through a reviewed policy change.
- **Ownership:** the deployment/database operator schedules and verifies
  backups and controls restore credentials. Application operators may request a
  restore but do not receive unrestricted backup-storage or database-owner
  access. Security/incident ownership approves any restore that discards
  acknowledged writes.

The database backup role needs consistent read access and access to Drizzle's
migration journal, not application secrets or permission to mutate production.
The restore role writes only to a fresh isolated target until validation is
complete. The ordinary application and cleanup roles must not be database
owners and cannot disable audit triggers.

## Backup storage and artifact contract

Use PostgreSQL custom format (`pg_dump --format=custom`) with owner and privilege
restoration disabled. Custom format is portable across the rehearsal topology,
supports `pg_restore --list`, and permits controlled restore into a fresh
database. For a dataset too large to meet the RPO/RTO with logical dumps, move
to provider snapshots plus continuous WAL only after rehearsing the replacement
procedure.

Every backup has a sidecar metadata record containing:

- UTC start/completion timestamps and source database identifier;
- PostgreSQL major version;
- immutable backend and frontend image tags or source revision;
- ordered `drizzle.__drizzle_migrations` identifiers/count;
- dump size and SHA-256 checksum;
- backup command/tool version and encrypted-storage object identifier; and
- verification result and operator/run identity, without credentials or row
  contents.

Encrypt backups in transit and at rest with deployment-managed keys distinct
from application JWT/HMAC rings. Store them in a different failure domain from
the primary database, deny public access, grant least privilege, log access and
deletion, and apply the same retention deadline to copies and exports. Never
write database URLs, passwords, account-token hashes, session hashes, personal
fields, or dump contents into metadata or logs.

## Backup procedure

1. Confirm the immutable release tags, PostgreSQL version, migration journal,
   available storage, expected dump duration, and absence of an unreviewed
   migration runner.
2. For a migration backup, stop or drain writers when that migration's
   compatibility policy requires it. Ordinary daily `pg_dump` uses its
   consistent snapshot without stopping writes.
3. Run `pg_dump --format=custom --no-owner --no-privileges` with the dedicated
   backup role and write directly to encrypted isolated storage or an encrypted
   staging volume that is removed after upload.
4. Compute and record SHA-256 plus byte size, run `pg_restore --list`, and verify
   the archive contains both the application schema and
   `drizzle.__drizzle_migrations`.
5. Mark the artifact verified only after metadata and archive checks pass.
   Backup-command success alone is insufficient.
6. Alert on a failed backup or when no verified daily backup exists within 26
   hours.

## Restore procedure

1. Declare maintenance mode, stop every application/cleanup/migration writer,
   record the incident time and approved recovery point, and preserve the failed
   database read-only for investigation.
2. Select a checksum-verified backup and immutable application images compatible
   with its migration journal. Record any acknowledged writes after the recovery
   point and obtain explicit authorization for loss or a reviewed replay plan.
3. Provision a **fresh**, isolated PostgreSQL target at the same major version.
   Never restore over the failed primary.
4. Verify the archive checksum again, inspect `pg_restore --list`, then restore
   with owner/privilege restoration disabled. Apply grants separately through
   deployment-managed role configuration.
5. Query the restored migration journal and schema. Apply only reviewed forward
   migrations required by the selected application image; never edit migration
   history or use `drizzle-kit push`.
6. Run aggregate counts and tenant, foreign-key, inventory, session, account,
   order/history, notification, and append-only audit invariants. Compare them
   with backup metadata or the pre-migration validation record.
7. Start the compatible backend/frontend images against the isolated target and
   run readiness plus catalog, login, checkout, fulfillment, notification, and
   affected-feature smoke checks.
8. Repoint traffic only after validation passes. Keep the failed database and
   restore evidence isolated for the incident window; remove temporary decrypted
   artifacts deterministically.

If any checksum, journal, invariant, readiness, or workflow check fails, do not
reopen traffic. Preserve logs and the target, correct the procedure or select a
different verified backup, and repeat into another fresh database.

## Rehearsal

Run `npm run test:recovery` from the repository root. The isolated rehearsal:

1. starts a temporary PostgreSQL 18 container;
2. applies migrations `0000` through `0003` with the application migration
   runner and loads deterministic non-personal tenant, account, session,
   catalog, cart, watchlist, order/history, review, notification, token, and
   audit data;
3. takes and validates a pre-migration backup, then applies `0004` and verifies
   row preservation;
4. adds representative `0004` account-management state and takes a current
   custom-format backup with checksum and migration metadata;
5. restores into a fresh database, reruns the current migration runner, and
   verifies journal parity, counts, tenant relationships, commerce state,
   security state, and audit evidence; and
6. reports measured backup, migration, and restore durations before deleting
   its temporary container and artifacts.

The fixture uses reserved `.invalid` addresses, deterministic UUIDs, synthetic
hashes, and no production secrets or personal data. The rehearsal proves the
repository baseline, not a hosting provider's snapshot/WAL implementation; a
selected provider must run its own equivalent rehearsal before deployment.

### Verified repository rehearsal

On 2026-07-19, the isolated PostgreSQL 18 rehearsal passed with all five
migration journal entries, unchanged pre-`0004` domain counts, restored current
state, tenant-qualified commerce relationships, and append-only audit triggers.
The representative archive was 57,748 bytes; the measured forward-migration,
backup, and fresh-restore/current-migration phases took 4.427 seconds, 0.244
seconds, and 2.232 seconds respectively. The script verified its run-specific
SHA-256 checksum before discarding the isolated artifact and container.

These timings establish that the repository fixture is within the four-hour
RTO; they are not a capacity claim for a future deployed dataset. Deployment
must repeat the rehearsal with its expected row counts, storage, network,
encryption, and provider controls before accepting production RPO/RTO evidence.
