# Append-only audit events

MercadoZetta stores security- and commerce-significant mutation evidence in the
tenant-scoped PostgreSQL `audit_events` table. These records are distinct from
Pino application logs: log retention, severity filtering, or a logging-provider
outage must not erase the authoritative mutation history.

## Event contract

Each event has a generated UUID, tenant, constrained event type, optional actor
UUID, constrained resource type and UUID, optional sanitized JSON metadata, and
an occurrence timestamp supplied by the domain transaction. The baseline event
types are:

| Event                    | Resource                                   | Safe metadata                               |
| ------------------------ | ------------------------------------------ | ------------------------------------------- |
| `session.created`        | session                                    | none                                        |
| `session.rotated`        | session                                    | rotation counter                            |
| `session.revoked`        | session or user for all-session revocation | reason                                      |
| `session.reuse_detected` | session                                    | reason                                      |
| `inventory.set`          | product                                    | previous/next inventory and status          |
| `inventory.decremented`  | product                                    | order ID, quantity, previous/next inventory |
| `order.placed`           | order                                      | item count                                  |
| `order.status_changed`   | order                                      | previous/next status                        |

Actor foreign keys are tenant-qualified. Resource IDs are intentionally not
foreign keys: an audit record must survive later resource lifecycle changes,
and the resource type determines which domain table the UUID referred to.
Indexes support tenant timelines plus resource- and actor-focused investigation.

Metadata must contain only the minimum identifiers and state transition needed
to explain the mutation. It must never contain cookies, authorization values,
passwords or hashes, access or refresh tokens, CSRF values, signing keys,
database connection strings, request/response bodies, email addresses,
telephone numbers, usernames, product descriptions, notification messages, or
review text.

## Atomicity and immutability

The PostgreSQL mutation coordinator supplies transaction-bound product,
session, checkout, order, notification, user, and audit repositories. Audit
insertion occurs inside the same transaction as:

- session creation, successful rotation, replay-family revocation, individual
  revocation, and all-session revocation;
- explicit seller inventory changes;
- order creation and every conditional checkout inventory decrement; and
- order status/history changes and their buyer notification.

If audit insertion fails, the domain mutation rolls back. Refresh replay is a
special committed-denial path: the transaction stores the family revocation and
`session.reuse_detected` event, commits both, and only then returns the 401
error. Failed validation, ownership checks, unavailable checkout attempts, and
failed compare-and-swap refresh attempts produce no audit record because no
domain mutation committed.

The application repository exposes append operations only. Migration
`0002_easy_jasper_sitwell.sql` also installs PostgreSQL triggers that reject
ordinary `UPDATE` and `DELETE` with SQLSTATE `55000`. Database migration and
recovery roles remain operationally privileged and must be separated from the
future least-privilege application role before production deployment.

## Migration and rollback

The migration is additive: it creates the table, tenant and actor constraints,
checks, investigation indexes, and immutability triggers. It requires no
backfill because the project has no deployed database and audit history cannot
be reconstructed reliably from ordinary application data.

An application rollback may leave the table and triggers in place; the previous
application version does not reference them. Do not drop audit history as part
of an ordinary application rollback. A schema rollback is a separately approved
destructive operation: first export and verify the audit rows, roll back all
writers, then remove the triggers, function, and table through a new reviewed
migration. The project intentionally provides no automatic down migration.

Audit retention remains undecided until deployment, legal, and incident-response
requirements exist. It must be documented independently from the 30-day
application-log baseline in [the observability policy](observability.md). Until
then, audit rows are retained and no automatic cleanup job is authorized.

MercadoZetta currently has no privileged administrator role or privileged
mutation surface. When one is accepted, its event types and sanitized metadata
must be added through a reviewed schema migration before the mutation ships.
