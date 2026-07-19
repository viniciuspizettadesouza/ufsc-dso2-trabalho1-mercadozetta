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

| Event                         | Resource                                   | Safe metadata                               |
| ----------------------------- | ------------------------------------------ | ------------------------------------------- |
| `session.created`             | session                                    | none                                        |
| `session.rotated`             | session                                    | rotation counter                            |
| `session.revoked`             | session or user for all-session revocation | reason                                      |
| `session.reuse_detected`      | session                                    | reason                                      |
| `inventory.set`               | product                                    | previous/next inventory and status          |
| `inventory.decremented`       | product                                    | order ID, quantity, previous/next inventory |
| `order.placed`                | order                                      | item count                                  |
| `order.status_changed`        | order                                      | previous/next status                        |
| `user.email_verified`         | user                                       | none                                        |
| `user.password_reset`         | user                                       | none                                        |
| `user.profile_updated`        | user                                       | changed field names only                    |
| `user.password_changed`       | user                                       | none                                        |
| `user.email_change_requested` | user                                       | none                                        |
| `user.email_changed`          | user                                       | none                                        |
| `user.deactivated`            | user                                       | archived listing count                      |

Migration `0003_famous_miek.sql` reserves the two user-security event types for
the accepted verification and recovery contract. The provider-independent
account-security service emits them in the same transaction as token
consumption, verification or password replacement, and session revocation.
Because those mutations are authorized by a one-time token rather than an
authenticated session, their audit records have no actor ID.

Migration `0004_melted_nekra.sql` reserves the five authenticated
account-management types accepted in ADR 0005. The provider-independent profile
and password services emit `user.profile_updated` and `user.password_changed`
atomically. The provider-independent email-change service emits
`user.email_change_requested` with the authenticated user as actor and emits
`user.email_changed` without an actor because confirmation is authorized by a
one-time token. The provider-independent deactivation service emits
`user.deactivated` with only the archived-listing count and the authenticated
user as actor. No HTTP route exposes these account-management services yet.

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
- order status/history changes and their buyer notification;
- profile and password changes, including password-triggered session and token
  revocation; and
- email-change initiation and confirmation, including pending state, token
  consumption/invalidation, email promotion, and session revocation; and
- account deactivation, including profile clearing, credential invalidation,
  listing archival, and disposable-state cleanup.

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
