# PostgreSQL relational schema design

## Purpose and scope

This document turns the accepted direction in
[ADR 0002](decisions/0002-postgresql-persistence.md) into a tooling-independent
relational design for the behavior that MercadoZetta implements today. It is
the contract that the Prisma, Drizzle, and SQL-client spike must represent; it
does not select one of those tools or change the running MongoDB application.

The design intentionally excludes prices, payments, addresses, refunds,
shipping details, roles, and other fields that are not in the current product.
The migration must preserve existing records and API behavior rather than use a
database change to introduce unrelated product semantics.

## Conventions

- SQL names use `snake_case`; service and API mappers retain the current JSON
  field names.
- Public entity IDs use native `uuid`. `cart_items` and
  `order_status_history` are structural child rows with composite keys and no
  separately exposed ID.
- Tenant IDs remain configured text slugs. A small `tenants` reference table
  contains the same accepted IDs as `backend/src/tenants.ts` so foreign keys can
  enforce that every persisted tenant is known.
- Every tenant-owned table has a non-null `tenant_id`. Every reference between
  tenant-owned tables includes the tenant in a composite foreign key.
- Referenced tables expose `UNIQUE (tenant_id, id)` even though UUID `id` is the
  primary key. This candidate key is what tenant-qualified foreign keys target.
- Time values use `timestamp with time zone` and are handled as UTC instants.
  Repository code updates `updated_at` explicitly; hidden timestamp triggers are
  not required.
- Enumerated lifecycle values use named `CHECK` constraints over text for the
  first migration. This keeps additions visible in ordinary DDL without a
  PostgreSQL-enum migration coupling.
- Application-normalized fields preserve current behavior: emails, product
  names, categories, and subcategories are stored lowercase. The database
  enforces case-insensitive email uniqueness with `lower(email)` even if a
  migration or future caller misses normalization.
- Named constraints are required so persistence code can translate expected
  uniqueness and check failures into the existing `AppError` contracts without
  parsing provider-generated names.

UUID generation must use one version consistently for runtime records and
deterministic fixed UUIDs for seed records. The tooling spike will choose UUIDv4
or UUIDv7 after checking Node, selected-client, PostgreSQL-version, and index
locality support. UUID generation must not require a database round trip before
an insert.

## Tables and constraints

### `tenants`

| Column       | Type          | Rules                                                             |
| ------------ | ------------- | ----------------------------------------------------------------- |
| `id`         | `text`        | Primary key; current rows are `mercadozetta` and `campus-market`. |
| `created_at` | `timestamptz` | Non-null; defaults to the current time.                           |

Tenant branding remains application configuration. This table is only the
persistence integrity anchor and is seeded transactionally by migrations. The
application must reject a request tenant through the existing resolver before
querying the database.

### `users`

| Column                     | Type          | Rules                                                |
| -------------------------- | ------------- | ---------------------------------------------------- |
| `id`                       | `uuid`        | Primary key.                                         |
| `tenant_id`                | `text`        | Non-null; foreign key to `tenants(id)`.              |
| `email`                    | `text`        | Non-null and stored normalized.                      |
| `password_hash`            | `text`        | Non-null; preserves existing bcrypt hashes verbatim. |
| `token_version`            | `integer`     | Non-null, default `0`, check `>= 0`.                 |
| `username`                 | `text`        | Nullable.                                            |
| `telephone`                | `text`        | Nullable.                                            |
| `created_at`, `updated_at` | `timestamptz` | Non-null.                                            |

Constraints are `UNIQUE (tenant_id, id)` and a unique expression index on
`(tenant_id, lower(email))`. Registration and login continue normalizing email
in the application so returned data stays compatible.

### `products`

| Column                     | Type          | Rules                                                                                                   |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid`        | Primary key.                                                                                            |
| `tenant_id`                | `text`        | Non-null.                                                                                               |
| `seller_id`                | `uuid`        | Non-null.                                                                                               |
| `name`                     | `text`        | Non-null; stored lowercase to preserve current behavior.                                                |
| `description`              | `text`        | Nullable.                                                                                               |
| `category`                 | `text`        | Non-null, default `general`, stored lowercase.                                                          |
| `subcategory`              | `text`        | Non-null, default empty string, stored lowercase.                                                       |
| `inventory`                | `integer`     | Non-null; named check `inventory >= 0`.                                                                 |
| `image_url`                | `text`        | Non-null. URL policy remains application validation.                                                    |
| `status`                   | `text`        | Non-null, default `active`; allowed values are `draft`, `active`, `paused`, `sold_out`, and `archived`. |
| `created_at`, `updated_at` | `timestamptz` | Non-null.                                                                                               |

Constraints are `UNIQUE (tenant_id, id)` and composite foreign key
`(tenant_id, seller_id) -> users(tenant_id, id)` with restricted deletion.
Product retirement uses `archived`; products are not hard-deleted because
orders, reviews, watchlists, and carts may refer to them.

### `carts` and `cart_items`

`carts` contains `id uuid` primary key, non-null `tenant_id`, non-null
`buyer_id`, and non-null `created_at`/`updated_at`. It has
`UNIQUE (tenant_id, id)`, `UNIQUE (tenant_id, buyer_id)`, and composite foreign
key `(tenant_id, buyer_id) -> users(tenant_id, id)`.

`cart_items` contains `tenant_id`, `cart_id`, `product_id`, and positive integer
`quantity`. Its primary key is `(tenant_id, cart_id, product_id)`. Composite
foreign keys target both `carts(tenant_id, id)` and
`products(tenant_id, id)`. Deleting an explicitly discarded cart cascades only
to its cart items. Product deletion remains restricted.

This replaces the embedded MongoDB array and makes duplicate product lines
impossible. Cart item creation and quantity replacement use an upsert on the
composite primary key after tenant-scoped product availability validation.

### `watchlist_entries`

| Column                     | Type          | Rules        |
| -------------------------- | ------------- | ------------ |
| `id`                       | `uuid`        | Primary key. |
| `tenant_id`                | `text`        | Non-null.    |
| `user_id`, `product_id`    | `uuid`        | Non-null.    |
| `created_at`, `updated_at` | `timestamptz` | Non-null.    |

Constraints are `UNIQUE (tenant_id, id)`,
`UNIQUE (tenant_id, user_id, product_id)`, and tenant-qualified foreign keys to
`users` and `products`. Add remains an idempotent insert-on-conflict lookup;
remove is tenant/user/product scoped.

### `orders`

| Column                     | Type          | Rules                                                                                                          |
| -------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid`        | Primary key.                                                                                                   |
| `tenant_id`                | `text`        | Non-null.                                                                                                      |
| `buyer_id`                 | `uuid`        | Non-null.                                                                                                      |
| `status`                   | `text`        | Non-null, default `placed`; allowed values are `placed`, `confirmed`, `shipped`, `delivered`, and `cancelled`. |
| `created_at`, `updated_at` | `timestamptz` | Non-null.                                                                                                      |

Constraints are `UNIQUE (tenant_id, id)` and composite foreign key
`(tenant_id, buyer_id) -> users(tenant_id, id)`. Orders are historical records
and cannot be hard-deleted by the application role.

### `order_items`

| Column                                | Type          | Rules                                    |
| ------------------------------------- | ------------- | ---------------------------------------- |
| `id`                                  | `uuid`        | Primary key.                             |
| `tenant_id`                           | `text`        | Non-null.                                |
| `order_id`, `product_id`, `seller_id` | `uuid`        | Non-null.                                |
| `product_name`                        | `text`        | Non-null immutable snapshot.             |
| `quantity`                            | `integer`     | Non-null; named check `quantity > 0`.    |
| `created_at`, `updated_at`            | `timestamptz` | Non-null; migrated values are preserved. |

Constraints are `UNIQUE (tenant_id, id)`,
`UNIQUE (tenant_id, order_id, product_id)`, and tenant-qualified foreign keys to
the order, live product, and seller. All use restricted deletion. The unique
order/product rule preserves the current one-cart-line-per-product behavior.

`product_name`, `quantity`, and `seller_id` are checkout-time facts and never
follow later product changes. The application database role receives
`SELECT`/`INSERT`, but not `UPDATE`/`DELETE`, on this table. Migration ownership
uses a separate role. If a future product adds price, currency, tax, or other
checkout facts, they must be added as immutable snapshots rather than inferred
from the live product.

### `order_status_history`

| Column                  | Type           | Rules                                             |
| ----------------------- | -------------- | ------------------------------------------------- |
| `tenant_id`, `order_id` | `text`, `uuid` | Non-null composite order reference.               |
| `sequence`              | `integer`      | Non-null and positive.                            |
| `status`                | `text`         | Non-null; same allowed values as `orders.status`. |
| `actor_id`              | `uuid`         | Non-null tenant-qualified user reference.         |
| `changed_at`            | `timestamptz`  | Non-null.                                         |

The primary key is `(tenant_id, order_id, sequence)`. The application role can
select and insert but cannot update or delete history rows. Sequence `1` is the
initial `placed` event. Status changes lock the order and append
`max(sequence) + 1` in the same transaction that changes `orders.status`, so
concurrent transitions cannot produce duplicate or reordered events.

The service remains responsible for the transition graph: sellers may advance
`placed -> confirmed -> shipped -> delivered`; buyers may change `placed` or
`confirmed` to `cancelled`. A database check can validate status vocabulary but
must not hide actor/transition authorization in a trigger.

### `reviews`

| Column                     | Type          | Rules                                                                 |
| -------------------------- | ------------- | --------------------------------------------------------------------- |
| `id`                       | `uuid`        | Primary key.                                                          |
| `tenant_id`                | `text`        | Non-null.                                                             |
| `product_id`, `author_id`  | `uuid`        | Non-null tenant-qualified references.                                 |
| `rating`                   | `smallint`    | Non-null; named check between `1` and `5`.                            |
| `comment`                  | `text`        | Non-null; application validation retains the 1,000-character maximum. |
| `created_at`, `updated_at` | `timestamptz` | Non-null.                                                             |

Constraints are `UNIQUE (tenant_id, id)` and
`UNIQUE (tenant_id, product_id, author_id)`. The service still proves purchase
through orders/order items and forbids seller self-review before the upsert.
Current behavior does not require delivery and does not exclude cancelled
orders; the database migration must not silently change that rule.

### `notifications`

`notifications` contains `id uuid` primary key, non-null `tenant_id`, non-null
`user_id`, non-null `message`, non-null `is_read` defaulting to `false`, and
non-null `created_at`/`updated_at`. It has `UNIQUE (tenant_id, id)` and composite
foreign key `(tenant_id, user_id) -> users(tenant_id, id)`. Read updates include
all three of notification ID, tenant ID, and user ID.

### `sessions`

| Column                                                                 | Type                  | Rules                                                                                         |
| ---------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `id`                                                                   | `uuid`                | Primary key and opaque refresh-token selector.                                                |
| `tenant_id`                                                            | `text`                | Non-null.                                                                                     |
| `user_id`                                                              | `uuid`                | Non-null.                                                                                     |
| `family_id`                                                            | `uuid`                | Non-null stable refresh family identifier.                                                    |
| `token_version`                                                        | `integer`             | Non-null; check `>= 0`.                                                                       |
| `refresh_token_hash`                                                   | `text`                | Non-null; never selected into public summaries.                                               |
| `refresh_token_secret_version`                                         | `text`                | Nullable only for imported legacy data; maximum 32 characters and current key-version format. |
| `previous_refresh_token_hash`, `previous_refresh_token_secret_version` | `text`                | Nullable as a pair.                                                                           |
| `rotation_counter`                                                     | `integer`             | Non-null, default `0`, check `>= 0`.                                                          |
| `rotated_at`                                                           | `timestamptz`         | Nullable.                                                                                     |
| `last_used_at`, `absolute_expires_at`, `expires_at`                    | `timestamptz`         | Non-null.                                                                                     |
| `revoked_at`, `revoke_reason`                                          | `timestamptz`, `text` | Nullable as a pair.                                                                           |
| `user_agent_label`                                                     | `varchar(120)`        | Nullable safe display metadata.                                                               |
| `created_at`, `updated_at`                                             | `timestamptz`         | Non-null.                                                                                     |

Constraints are `UNIQUE (tenant_id, id)`,
`UNIQUE (tenant_id, family_id)`, composite foreign key
`(tenant_id, user_id) -> users(tenant_id, id)`, paired-null checks for previous
hash metadata and revocation metadata, and expiry checks requiring
`expires_at <= absolute_expires_at` and both expiries after creation.

Authentication checks always compare expiry timestamps; cleanup is not an
authorization mechanism. PostgreSQL has no MongoDB-style TTL index, so a
scheduled bounded delete removes expired session rows using the expiry index.
The job, cadence, batch size, monitoring, and retention grace period must be
selected before production cutover.

## Referential deletion policy

Foreign keys default to `ON DELETE RESTRICT` and `ON UPDATE RESTRICT`. In
particular, tenants, users, products, orders, order items, and history are never
silently cascaded. Product removal is represented by lifecycle status, and no
user hard-delete workflow exists today. A future privacy deletion design must
explicitly reconcile account data with order/audit retention.

The only initial cascade is `carts -> cart_items` when an ephemeral cart is
explicitly deleted. Normal checkout deletes its cart-item rows while retaining
the cart record. Watchlists, notifications, reviews, and expired sessions can be
deleted by explicit tenant-scoped retention or user actions, not by cascading a
user or product deletion.

## Baseline indexes

Primary, unique, and foreign-key target indexes are included above. PostgreSQL
does not automatically index referencing columns, so the first migration also
defines these query-driven indexes:

| Table                  | Index keys or predicate                                        | Existing consumer                                    |
| ---------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `products`             | `(tenant_id, created_at DESC, id DESC)`                        | Tenant catalog default ordering.                     |
| `products`             | `(tenant_id, seller_id, created_at DESC, id DESC)`             | Seller catalog and ownership lookup.                 |
| `products`             | `(tenant_id, category, subcategory, created_at DESC, id DESC)` | Category/subcategory filters.                        |
| `orders`               | `(tenant_id, buyer_id, created_at DESC, id DESC)`              | Buyer order history.                                 |
| `order_items`          | `(tenant_id, seller_id, created_at DESC, id DESC)`             | Seller order visibility.                             |
| `order_items`          | `(tenant_id, order_id)`                                        | Order assembly and review eligibility joins.         |
| `order_status_history` | `(tenant_id, order_id, sequence)`                              | Ordered history; already covered by its primary key. |
| `reviews`              | `(tenant_id, product_id, created_at DESC, id DESC)`            | Product review list.                                 |
| `notifications`        | `(tenant_id, user_id, created_at DESC, id DESC)`               | Notification list.                                   |
| `notifications`        | `(tenant_id, user_id) WHERE is_read = false`                   | Unread count.                                        |
| `watchlist_entries`    | `(tenant_id, user_id, created_at DESC, id DESC)`               | User watchlist.                                      |
| `sessions`             | `(tenant_id, user_id, created_at DESC, id DESC)`               | Active session list and revocation.                  |
| `sessions`             | `(expires_at, id)`                                             | Bounded expiry cleanup.                              |

The planned phase 5 work will validate these against real SQL and `EXPLAIN`
plans when filters and pagination move into the database. Full-text, status,
availability, and standalone foreign-key indexes are not added speculatively;
the spike must add one only when its generated query cannot use an existing
prefix or measured plan.

## Transaction boundaries

### Checkout

Checkout runs at PostgreSQL's `READ COMMITTED` isolation with explicit row
locks and no external work inside the transaction:

1. Select the tenant/buyer cart `FOR UPDATE` and load its item rows; reject an
   absent or empty cart.
2. Lock referenced tenant products in deterministic UUID order to avoid
   deadlocks between overlapping carts.
3. Reject any missing, inactive, or understocked product.
4. Insert the `placed` order, sequence-1 status event, and immutable item
   snapshots.
5. For every item, conditionally update the product with
   `inventory = inventory - quantity` where tenant, ID, active status, and
   sufficient inventory still match. Require exactly one updated row per item.
6. Delete the cart-item rows and insert buyer plus distinct-seller
   notifications.
7. Commit. Any error or row-count mismatch rolls back every write.

UUIDs and notification text can be prepared before the transaction. The
transaction does not call remote services, hash passwords, or perform unrelated
catalog queries. Checkout remains non-idempotent until a separate API contract
introduces an idempotency key.

### Fulfillment and cancellation

An order status mutation locks the tenant/order row, verifies buyer or seller
authorization from tenant-qualified rows, checks the expected transition,
updates the current status with an expected-old-status predicate, appends the
next history sequence, and creates the buyer notification in one transaction.
The existing behavior that cancellation does not restore inventory is
preserved.

### Session rotation and revocation

Refresh verification computes and compares keyed hashes in application code as
defined by ADR 0001. Rotation then performs one conditional `UPDATE ...
RETURNING` scoped by session UUID, tenant, current hash, non-revoked state, idle
expiry, and absolute expiry. Exactly one concurrent request can replace the
hash. A loser reloads the session and follows the existing five-second previous
token or replay-family-revocation rules.

User `token_version` validation and session rotation/revocation execute in a
short transaction when more than one row changes. All-session logout increments
the user's token version and revokes that tenant/user's active sessions in one
transaction. Access checks continue matching tenant, user, session, expiry, and
token version even before expired rows are physically cleaned up.

### Other multi-row mutations

Review eligibility, review upsert, and seller notification should share a short
transaction so a successful review response cannot omit its notification.
Single cart, watchlist, notification-read, and product-create mutations remain
single-statement operations where possible.

## Query and mapping rules

Repositories sit below the existing services. Controllers do not receive a
database client, transaction object, or ORM model. Every repository operation
that touches tenant-owned data requires `tenantId` as a non-optional argument,
including lookups by globally unique UUID. Public mappers preserve current
response keys such as `_id`, `seller`, `buyer`, and `read` during the initial
migration unless a separately versioned API change is accepted.

Order lists should replace application-side assembly with tenant-scoped joins:
buyers see their orders; sellers see orders with at least one item sold by them;
returned seller item data remains scoped to that seller. A seller's presence in
one order must not expose another tenant or another seller's private line data.

RLS remains deferred under ADR 0002. If later enabled, it supplements rather
than replaces mandatory tenant predicates and composite constraints.

## Migration invariants

The data migration must prove all of the following before cutover:

- every legacy MongoDB ObjectId has exactly one UUID mapping, every transitional
  UUID is preserved, and every source reference resolves to the mapped
  tenant-qualified destination;
- per-tenant counts match for users, products, carts and cart lines,
  watchlists, orders and items, status events, reviews, notifications, and
  sessions;
- embedded cart lines and order history preserve their order, quantities,
  actors, and timestamps when expanded into relational rows;
- password hashes and versioned refresh hashes are byte-for-byte preserved but
  are never emitted in reports or logs;
- all unique, check, paired-null, expiry, and foreign-key constraints validate;
- order-item snapshot values, inventory, status, token versions, revocation,
  and timestamps match their sources; and
- deterministic seed IDs and tenant relationships are stable across repeated
  non-destructive runs.

Reports contain aggregate counts, mapping checksums, and pass/fail invariant
names only. Any personal value, credential, token, or secret is excluded.

## Acceptance checks for implementation

The PostgreSQL implementation is not ready for cutover until database-backed
tests prove:

- constraints reject cross-tenant and orphan references, duplicate business
  keys, invalid inventory/quantity/rating values, and unsupported statuses;
- checkout commits all effects once, rolls back all effects after any failure,
  and never oversells under concurrent buyers;
- seller and buyer order visibility, transitions, history, snapshots, and
  notifications preserve current behavior;
- refresh rotation has one winner, preserves the bounded concurrency response,
  revokes replayed families, and remains tenant-scoped;
- expiry cleanup cannot authorize or revoke a session incorrectly;
- seed and migration validation are repeatable;
- the existing API contract, focused tests, critical browser workflows,
  readiness, production smoke test, backup/restore, and rehearsed rollback pass.
