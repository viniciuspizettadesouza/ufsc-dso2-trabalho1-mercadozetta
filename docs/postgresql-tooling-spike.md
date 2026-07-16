# PostgreSQL data-access tooling spike

## Scope

This disposable spike compared Prisma, Drizzle, and direct SQL against the
critical persistence requirements accepted in
[ADR 0002](decisions/0002-postgresql-persistence.md) and the
[relational schema design](postgresql-schema-design.md). It was run on
2026-07-16 with Node.js 24, TypeScript 6.0.3, and an isolated PostgreSQL 18
container. The PostgreSQL major version was convenient for the spike and is not
a production-version decision.

The evaluated package versions were:

| Candidate  | Runtime                                                          | Migration/development tooling               |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Prisma     | `@prisma/client` and `@prisma/adapter-pg` 7.8.0 with `pg` 8.22.0 | `prisma` 7.8.0                              |
| Drizzle    | `drizzle-orm` 0.45.2 with `pg` 8.22.0                            | `drizzle-kit` 0.31.10                       |
| Direct SQL | `pg` 8.22.0                                                      | `node-pg-migrate` 8.0.4 with SQL migrations |

Versions were fixed in an isolated `/tmp` project. No candidate dependency was
added to MercadoZetta during the spike.

## Prototype

Each candidate represented the same ten-table critical slice: tenants, users,
products, carts, cart items, orders, immutable order items, order status
history, notifications, and sessions. The slice included tenant-qualified
foreign keys and uniqueness, inventory/quantity/status/expiry checks, sorted
indexes, and the unread-notification partial index where the schema language
could express it.

Each runtime then executed the same scenarios against its own empty database:

1. Seed one seller, two buyers, one two-unit product, two carts, and one active
   refresh session.
2. Checkout the first buyer's two units inside one transaction, including row
   locks, an order and initial history event, immutable item snapshot,
   conditional inventory decrement, cart clearing, and notifications.
3. Attempt checkout from the second cart after inventory reached zero. The
   transaction had to create no second order and preserve the cart line.
4. Submit two concurrent session compare-and-swap updates using the same
   current refresh hash. Exactly one update had to return a row and increment
   the rotation counter.
5. Attempt to insert a product with negative inventory to verify that the
   generated database schema, not only application code, enforced the
   invariant.

The prototypes were strict-TypeScript checked before execution. Prisma's
schema was validated and its client generated. Prisma and Drizzle migrations
were generated from their declarative schemas; the direct-SQL candidate used a
reviewed SQL migration through `node-pg-migrate`. All migrations were applied
to separate databases in the same isolated container.

## Verified results

All three runtime paths passed the transaction and concurrency scenarios:

| Result                                          | Prisma | Drizzle | Direct SQL |
| ----------------------------------------------- | -----: | ------: | ---------: |
| Committed orders after success and failed retry |      1 |       1 |          1 |
| Inventory after successful checkout             |      0 |       0 |          0 |
| Failed checkout preserved second cart           |    Yes |     Yes |        Yes |
| Concurrent refresh winners                      |      1 |       1 |          1 |
| Final rotation counter                          |      1 |       1 |          1 |

Schema generation exposed a material difference:

| Generated artifact                          | Prisma                                                                 | Drizzle                          | Direct SQL                       |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| Tenant-qualified composite foreign keys     | Generated                                                              | Generated                        | Explicit                         |
| Named unique constraints and sorted indexes | Generated                                                              | Generated                        | Explicit                         |
| Named `CHECK` constraints                   | Not represented by the Prisma schema; absent until custom SQL is added | Generated                        | Explicit                         |
| Partial unread-notification index           | Requires custom migration SQL                                          | Generated                        | Explicit                         |
| Negative inventory test                     | Incorrectly accepted by the unmodified generated migration             | Rejected with PostgreSQL `23514` | Rejected with PostgreSQL `23514` |

Prisma's generated migration was 239 lines for the slice and required manual
additions for the accepted checks and partial index. Drizzle generated a
147-line reviewable SQL migration containing those constructs. The direct SQL
migration was 163 lines including explicit down operations. Line counts are
descriptive only; correctness and maintainability mattered more than brevity.

The latest Prisma 7 runtime uses the `pg` driver adapter, but the observed
schema validation/generation command still downloaded Prisma's schema engine.
It also generated a project-specific client. This is operationally manageable,
but it adds a generation and dependency surface that did not buy stronger
typing for the critical lock queries: checkout still needed raw SQL for
`SELECT ... FOR UPDATE`. Prisma's documented raw-query and customizable
migration escape hatches can implement the design, so this is a fit judgment,
not a claim that Prisma lacks PostgreSQL support. See Prisma's documentation for
[version 7 driver adapters](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7),
[customizable SQL migrations](https://docs.prisma.io/docs/orm/prisma-migrate),
and [raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries).

Drizzle represented checks, expression/partial indexes, composite foreign keys,
row-lock queries, arithmetic updates, and `RETURNING` close to their SQL shape.
Its transaction callback kept one checked-out `pg` connection without exposing
that connection above the repository boundary. Generated SQL remained the
deployment artifact and could be reviewed before application. These behaviors
match Drizzle's documented [migration](https://orm.drizzle.team/docs/migrations)
and [transaction](https://orm.drizzle.team/docs/transactions) models.

Direct `pg` offered the clearest control and the smallest conceptual runtime.
Parameterized queries and explicit same-client transactions behaved exactly as
documented by
[node-postgres queries](https://node-postgres.com/features/queries) and
[transactions](https://node-postgres.com/features/transactions). However, every
row result, insert shape, mapping, and transaction helper needed handwritten
types and repeated SQL. That cost would grow across all services and pagination
queries. `node-pg-migrate` produced reviewable, transactional migrations with an
advisory lock, but choosing it with raw `pg` would leave both schema typing and
repository mapping entirely manual. Its migration behavior is documented in
[node-pg-migrate](https://salsita.github.io/node-pg-migrate/migrations/).

An isolated npm audit of the combined spike install reported no high or
critical findings and three moderate findings on the current Prisma CLI path.
This transient result was not the decision driver; dependency audits must run
again when packages are added to the repository.

## Evaluation

| Criterion                   | Prisma                                                                                                                         | Drizzle                                                                                             | Direct `pg`                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Existing service boundaries | Good generated model API, but generated types can encourage model objects to leak unless repositories map them deliberately.   | Good: schema/query types stay in repositories and plain result mappers fit the current services.    | Good boundary control, with the most manual mapping.                                                                      |
| Checkout transaction        | Interactive transaction works; row locking uses raw SQL and conditional updates use ORM operations or raw SQL.                 | Transaction callback, lock clauses, arithmetic update, and returning rows are explicit and typed.   | Complete control, but begin/commit/rollback and client ownership must be implemented correctly every time or centralized. |
| Refresh compare-and-swap    | `updateManyAndReturn` passed the one-winner test.                                                                              | One typed conditional update with `returning` passed the one-winner test.                           | One parameterized `UPDATE ... RETURNING` passed the one-winner test.                                                      |
| Accepted schema coverage    | Composite relations work; checks and partial indexes require manually customized migration SQL outside the declarative schema. | The critical accepted constraints and indexes were represented and generated.                       | Complete PostgreSQL coverage because SQL is the source.                                                                   |
| Migration reviewability     | Generated SQL is reviewable, but important recurring invariants require manual additions and schema/migration awareness.       | Generated SQL is concise and reviewable; custom SQL data migrations remain available.               | Maximally explicit, but every DDL change is handwritten and schema typing is separate.                                    |
| Testability                 | Good generated client, but generate/engine setup adds a test preparation step.                                                 | Plain PostgreSQL plus generated SQL and an injectable `pg` pool fit ephemeral integration tests.    | Easy database isolation, with more handwritten test fixtures and result types.                                            |
| Production model            | Uses the same `pg` driver but adds generated client/runtime packages and a required generation step.                           | Uses `drizzle-orm` plus the established `pg` pool; `drizzle-kit` stays development/deployment-only. | Smallest runtime, but requires maintaining a local repository/mapping framework.                                          |

## Conclusion

Drizzle provides the best fit for MercadoZetta. It retains the SQL visibility
and PostgreSQL feature coverage that motivated the migration while removing
most repetitive result typing and statement assembly from direct `pg`. Prisma
is productive for ordinary CRUD, but this schema's checks, partial indexes, row
locks, and conditional commerce operations would make custom SQL a routine part
of both its migrations and repositories.

The spike was disposable. Its result is captured here and accepted formally in
[ADR 0003](decisions/0003-drizzle-postgresql-tooling.md); temporary databases,
generated clients, and candidate packages are not production artifacts.
