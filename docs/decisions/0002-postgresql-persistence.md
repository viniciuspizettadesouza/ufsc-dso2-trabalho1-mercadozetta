# ADR 0002: PostgreSQL Persistence and UUID Identifiers

- Status: Accepted
- Date: 2026-07-16
- Owners: MercadoZetta maintainers

## Context

MercadoZetta persists users, products, carts, watchlists, orders, order items,
reviews, notifications, and authentication sessions in MongoDB through
Mongoose. Every tenant-owned record carries `tenantId`, and service queries are
expected to include it. Compound indexes enforce some tenant-scoped uniqueness,
including user email, cart ownership, watchlist entries, reviews, and session
families.

The marketplace data is nevertheless relational. Products belong to sellers;
carts, reviews, and watchlists refer to users and products; orders belong to
buyers; order items refer to orders, products, and sellers; status history
refers to actors; and sessions refer to users. Mongoose references express
these relationships to application code but do not create database-enforced
foreign keys. A malformed write or migration can therefore leave a
cross-tenant reference or an orphan even when normal service paths are correct.

Checkout already requires a multi-document transaction to create an order and
its item snapshots, conditionally decrement inventory, clear the cart, and
create notifications atomically. This requires MongoDB to run as a replica set,
including in local and browser-test environments. Session refresh also depends
on a conditional atomic update for rotation and replay handling.

The next product work adds database-side filtering, pagination, seller product
management, and more lifecycle rules. Those requirements favor explicit joins,
constraints, reviewable migrations, and transaction semantics over a flexible
document shape. The decision must preserve existing API behavior, tenant
isolation, authentication rules, and immutable commerce history while allowing
a controlled migration and rollback.

MongoDB remains a capable option: it supports schema validation and
multi-document transactions. Its transaction support requires a replica set or
sharded cluster, however, and its flexible schema and references do not by
themselves enforce this application's cross-collection relationships. See the
MongoDB documentation for [schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/)
and [transaction consistency](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/).

PostgreSQL provides native check, unique, primary-key, and foreign-key
constraints, including composite keys that can carry a tenant identifier. It
also has a native UUID type. See the PostgreSQL documentation for
[constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and
the [UUID type](https://www.postgresql.org/docs/current/datatype-uuid.html).

## Decision drivers

The selected database must support:

- database-enforced relational and tenant integrity rather than relying only on
  service query discipline;
- short ACID transactions for checkout, fulfillment, session rotation, and
  future inventory adjustments;
- conditional writes that prevent overselling and preserve one refresh-rotation
  winner under concurrency;
- tenant-scoped filtering, ordering, joins, and bounded pagination with
  inspectable query plans and indexes;
- versioned, reviewable schema and data migrations with deterministic
  validation reports;
- repeatable local, integration, browser, backup, restore, and rollback
  procedures;
- a production model available from multiple managed hosting providers without
  tying the application contract to one vendor; and
- preservation of public API behavior while removing ObjectId-specific
  validation and token selectors.

## Options considered

| Criterion                    | Keep MongoDB                                                                                                                                                                                         | Migrate to PostgreSQL                                                                                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relational integrity         | Mongoose validation and application checks remain necessary across collections; no foreign keys protect references.                                                                                  | Foreign keys, composite foreign keys, checks, and unique constraints can reject orphaned, cross-tenant, and invalid rows at the database boundary.                                                                                                    |
| Transactions and concurrency | Existing transactions and conditional updates work, but transactions require replica-set or sharded deployment.                                                                                      | Transactions, row locking, and conditional `UPDATE` statements directly fit checkout, inventory, order transitions, and session rotation.                                                                                                             |
| Tenant isolation             | Compound indexes cover selected uniqueness rules, while every reference and query still depends on application discipline.                                                                           | Tenant columns can participate in unique keys and composite foreign keys. Service scoping remains mandatory; row-level security may later add defense in depth after connection-pooling implications are tested.                                      |
| Query evolution              | Current population and multi-query assembly work at demo scale, but joins, seller views, aggregate filtering, and pagination require more application orchestration or aggregation pipelines.        | Joins, relational predicates, full-text primitives, stable ordering, and query-plan inspection align with the planned catalog and seller workflows.                                                                                                   |
| Schema change                | Flexible documents make additive changes easy, but historical shape and cross-collection invariants need custom validation and migration discipline.                                                 | Explicit DDL makes changes less permissive but easier to review, version, validate, and roll back deliberately.                                                                                                                                       |
| Operations                   | The repository already knows MongoDB, but transaction-capable development requires replica-set initialization and production still needs authenticated replication, backup, restore, and monitoring. | Local transactions need only one PostgreSQL instance. Production still needs managed or operated backups, replication, restore tests, pooling, and monitoring.                                                                                        |
| Hosting cost                 | Existing self-managed Compose is inexpensive for a demo; production replica-set and managed-service costs vary by provider.                                                                          | PostgreSQL is widely available as a managed service and can reduce topology complexity for this workload, but no universal cost advantage is assumed. Provider, region, storage, backup, and availability pricing must be compared before deployment. |
| Migration and rollback       | No migration cost, but the current integrity and query limitations remain.                                                                                                                           | A one-time schema/data migration, identifier mapping, test port, rehearsal, maintenance window, and database-aware rollback are required.                                                                                                             |

A polyglot or permanent dual-write design was also considered. It would add
cross-database consistency, reconciliation, failure-ordering, and operational
work without a workload that benefits from two persistence models. Temporary
dual writes are therefore not the default migration mechanism. If a later
rehearsal shows that the maintenance window is unacceptable, that is a new
decision requiring an outbox or change-data-capture design and explicit
reconciliation rules.

## Decision

PostgreSQL will become MercadoZetta's only authoritative application database.
The migration will replace Mongoose and MongoDB after the PostgreSQL path has
passed the required data, integration, browser, deployment, and rollback
verification. MongoDB remains authoritative until the controlled cutover; this
ADR does not authorize an incremental production cutover or removal of the
current database.

All persistent entity identifiers will use PostgreSQL's native `uuid` type and
will be exposed as canonical hyphenated UUID strings. This includes users,
products, carts, orders, order items, reviews, notifications, watchlist entries,
and authentication sessions. The UUID generation version and whether selected
join tables need independent public IDs will be settled in the schema/tooling
work, based on index locality, library support, and API compatibility. The
configured tenant selector (`mercadozetta` or `campus-market`) remains a stable
text identifier; it is not an ObjectId and need not become a UUID in this
migration.

The opaque refresh token will carry a database-neutral UUID session selector
instead of an ObjectId-shaped selector. JWT `sub` and `sid`, route parameters,
OpenAPI examples, validators, tests, and seed data will become UUID-aware without
changing cookie flags, CSRF binding, refresh hashing, concurrency behavior,
replay-family revocation, expiry, or key-ring overlap from ADR 0001.

All tenant-owned relational tables will include a non-null `tenant_id`. The
schema must make cross-tenant references impossible by construction: referenced
tables will expose a tenant-qualified candidate key and child tables will use
composite foreign keys containing both `tenant_id` and the referenced ID where
the relationship is tenant-owned. Tenant-scoped uniqueness will be represented
as named unique constraints or indexes. Repository/service methods must still
receive and filter by the resolved tenant; constraints are a safety boundary,
not a replacement for authorization checks.

The relational schema must also provide:

- non-negative inventory and positive quantity checks;
- explicit allowed product and order states, with lifecycle transition rules
  remaining in services unless a later design can enforce them without hiding
  business behavior in triggers;
- immutable order-item snapshots sufficient to preserve the product facts shown
  at checkout even if the live product changes later;
- tenant-scoped uniqueness for user emails, one cart per buyer, watchlist
  entries, one review per author/product, and session families;
- explicit delete behavior that prevents accidental loss of users, products,
  order history, actors, or session ownership; and
- indexes justified by actual tenant-scoped filters, joins, uniqueness, and sort
  orders rather than speculative indexes.

Checkout will use one short database transaction. It will lock or conditionally
update the relevant active product rows, require sufficient inventory for every
line, create the order and immutable items, clear the cart, and create
notifications before commit. Any failed line rolls back the complete checkout.
Order status changes and their history/notification writes will be atomic.
Refresh rotation will preserve its single-winner compare-and-swap semantics in
one conditional statement or short transaction. External calls and password
hashing must remain outside database transactions.

The data-access and migration library is deliberately not selected here.
Prisma, Drizzle, and a SQL-oriented client will be evaluated in the focused
spike already listed in the improvement plan. The selected tool must preserve
the existing route-controller-service boundaries, expose transaction and
conditional-update behavior clearly, generate reviewable SQL migrations, work
with the production container model, and support database-backed tests without
requiring database calls from controllers.

Row-level security is not required for the first migration. Composite tenant
constraints and mandatory tenant-scoped service queries are the baseline. RLS
may be added as defense in depth only after a spike proves that tenant context
is set and reset safely for every pooled connection and transaction and that
administrative and migration roles cannot accidentally bypass the intended
policy.

## Migration and cutover requirements

The migration will proceed in bounded, independently verifiable stages:

1. Design and review the relational schema, constraints, transaction boundaries,
   and indexes; then select data-access and migration tooling through the
   focused spike.
2. Make public and security contracts database-neutral and UUID-aware while
   preserving their HTTP and authentication semantics.
3. Implement PostgreSQL repositories behind the existing services and port the
   deterministic seed, focused integration tests, browser workflows, readiness,
   and production topology.
4. Build a versioned migration that assigns UUIDs and records deterministic
   ObjectId-to-UUID mappings for every collection and reference. The migration
   must be restartable or fail safely, never log password hashes, refresh hashes,
   secrets, or personal data, and produce aggregate validation reports.
5. Rehearse backup, restore, migration, validation, startup, smoke tests, and
   rollback against production-like data. Measure the maintenance-window
   duration instead of assuming it.
6. During cutover, stop writes, take and verify the final MongoDB backup, run the
   migration once, compare source and destination counts and invariants, revoke
   existing sessions, deploy the PostgreSQL application, and pass readiness plus
   login, checkout, fulfillment, notification, and tenant-isolation smoke tests
   before reopening writes.

Validation must cover record counts by tenant and entity; every mapped
reference; tenant consistency across every relationship; password-hash
preservation without exposing hash values; inventory values; unique business
keys; order items and status history; session revocation/expiry metadata;
timestamps; and deterministic seed behavior. Any mismatch blocks cutover.

Rollback has two distinct cases. Before writes reopen, rollback restores the
verified final MongoDB backup and previous immutable application images. After
PostgreSQL accepts writes, restoring only that backup would lose acknowledged
changes and is forbidden. Before cutover, the team must therefore rehearse and
document either a validated reverse export of post-cutover changes or a policy
that keeps the application in maintenance until PostgreSQL is accepted. An
application image must never be rolled back across an incompatible schema or
database contract. MongoDB images, configuration, backup, identifier mappings,
and validation artifacts remain available for the documented rollback window;
Mongoose and MongoDB are removed only after PostgreSQL is monitored and
explicitly accepted.

## Consequences

PostgreSQL gives the marketplace a database boundary that matches its relational
domain and can enforce ownership relationships, tenant-qualified references,
uniqueness, and inventory constraints. It also makes planned joins, filtering,
pagination, query review, and versioned DDL more direct. UUIDs remove MongoDB
identifier shapes from public and security contracts and allow identifiers to
be generated independently of one database engine.

The cost is a substantial, deliberately staged migration. Models, repositories,
tests, seeds, runtime configuration, health checks, Compose files, deployment
documentation, OpenAPI examples, and operational procedures must change. The
team must learn and operate PostgreSQL, choose and maintain migration tooling,
and validate query plans and connection-pool behavior. Foreign keys and stronger
constraints also make previously tolerated invalid data visible; migration
reports must resolve those cases rather than silently dropping or coercing them.

This decision does not select an ORM, a PostgreSQL major version, a cloud
provider, a high-availability topology, or row-level security. It does not add
pricing, payment, shipping, or analytics fields that are absent from the current
product. Those decisions belong to the schema/tooling spike or later product
requirements.
