# ADR 0003: Drizzle for PostgreSQL Data Access and Migrations

- Status: Accepted
- Date: 2026-07-16
- Owners: MercadoZetta maintainers

## Context

[ADR 0002](0002-postgresql-persistence.md) selected PostgreSQL and UUID
identifiers but deliberately deferred data-access and migration tooling. The
accepted relational design requires tenant-qualified composite foreign keys,
named checks and uniqueness, a partial index, immutable commerce snapshots,
short row-locking transactions, conditional inventory updates, and atomic
refresh-session compare-and-swap behavior.

The [focused tooling spike](../postgresql-tooling-spike.md) represented a
critical ten-table slice and executed equivalent checkout, rollback, and
concurrent refresh-rotation scenarios with Prisma 7.8.0, Drizzle ORM 0.45.2,
and direct `pg` 8.22.0. All three implemented the runtime behavior correctly.
Drizzle and direct SQL also represented the accepted database checks and
partial index directly; the unmodified Prisma-generated migration omitted them
and accepted negative inventory.

## Decision

MercadoZetta will use:

- `drizzle-orm` for typed PostgreSQL schema declarations and repository queries;
- `pg` as the Node.js PostgreSQL driver and connection pool;
- `drizzle-kit` to generate versioned SQL migrations from the checked-in schema;
  and
- reviewed custom SQL migration files for data migrations or PostgreSQL
  behavior that cannot be represented safely in the declarative schema.

Exact package versions will be lockfile-pinned when PostgreSQL implementation
starts. The versions tested in the spike are evidence, not an instruction to
bypass the repository's normal dependency review and audit.

The Drizzle schema will live in a backend persistence area below services. It is
the typed representation of the accepted relational design. Generated SQL
migrations are checked in and reviewed before application. Production and CI
apply committed migrations with the migration command; they never use
`drizzle-kit push` or infer schema changes at application startup. Migration
execution is a separate deployment step with a direct database connection,
bounded credentials, and one runner.

The long-running Express process owns one configured `pg` pool. Pool limits,
connection/acquisition/statement/idle-in-transaction timeouts, TLS, application
name, and shutdown behavior must be validated in runtime configuration. Request
handlers and controllers never own pools or database connections.

Repositories receive a Drizzle database or transaction scope and return plain
domain/API data. Controllers continue calling services; services retain
business rules and transaction orchestration. Drizzle table records, query
builders, SQL fragments, and `pg` clients do not cross the repository/service
boundary.

Ordinary predicates, joins, inserts, updates, deletes, and returning clauses use
Drizzle's typed query builder. The `sql` template is expected for PostgreSQL
operations whose exact shape matters, including lock clauses, arithmetic
updates, carefully reviewed aggregates, and migration validation queries. Raw
SQL must remain parameterized; unsafe string interpolation of request data,
identifiers, sort directions, or tenant values is forbidden.

Checkout and fulfillment use `db.transaction` with short explicit callbacks.
Product rows are locked in deterministic order and inventory changes retain an
affected-row assertion. Refresh rotation remains one conditional
`UPDATE ... RETURNING`; one affected row is the winner and zero rows enters the
accepted previous-token/replay path. Transaction callbacks perform no external
calls or password hashing.

The repository will generate migrations in development, inspect the resulting
SQL, and test applying them from an empty database and from the prior accepted
version. Hand-editing generated DDL is exceptional because it can diverge from
Drizzle's schema snapshot. When custom SQL is necessary, the migration and
schema declaration must document which is authoritative and a database parity
test must detect drift. Data migrations use explicit, restartable or fail-safe
SQL/TypeScript scripts with aggregate validation and secret/PII redaction as
required by ADR 0002.

The initial implementation will not use Drizzle's relational-query convenience
API, automatic runtime migration, serverless PostgreSQL drivers, or RLS. These
can be evaluated later if a concrete query or deployment requirement justifies
them. The baseline uses explicit joins, the `pg` driver, tenant predicates, and
composite database constraints.

## Alternatives

### Prisma

Prisma's generated client, interactive transactions, customizable SQL
migrations, and `pg` adapter can implement MercadoZetta. It was not selected
because checks and the partial index central to this design required recurring
custom migration SQL, checkout row locking already required raw SQL, and the
generated-client/schema-engine workflow added build and dependency surface
without simplifying the critical paths enough. This does not prohibit Prisma
for another application with more conventional CRUD and fewer PostgreSQL-
specific invariants.

### Direct `pg` with `node-pg-migrate`

Direct SQL provided complete control, transparent queries, and very reviewable
migrations. It was not selected because all repository result types, mappings,
schema correspondence, repeated inserts, and transaction ownership would remain
handwritten. Drizzle preserves an explicit SQL escape hatch and the same `pg`
runtime while providing compile-time query/schema assistance. Direct `pg`
remains available below Drizzle only when an operation cannot be expressed
clearly through Drizzle, and that exception must stay inside a repository.

## Consequences

The implementation gains one typed schema that can generate reviewable SQL and
express the composite constraints, checks, indexes, locks, and conditional
updates required by the domain. It uses the established `pg` pooling model and
fits the current controller-service boundary without generated domain models.

The team must learn Drizzle's schema and query APIs, inspect generated SQL, keep
schema snapshots aligned with custom migrations, and still understand
PostgreSQL transaction and query behavior. Drizzle does not replace database-
backed tests, query-plan review, migration rehearsal, or explicit result
mapping. Some complex operations will still contain SQL fragments.

The next implementation step is to make public and security identifiers
database-neutral and UUID-aware before replacing repositories. That change must
preserve the accepted cookie/session behavior and API error contracts.
