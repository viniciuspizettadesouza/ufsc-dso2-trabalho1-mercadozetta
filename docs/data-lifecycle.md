# Persistent data-lifecycle inventory

- Status: Inventory complete; security and notification retention accepted
- Date: 2026-07-19
- Scope: The 15 PostgreSQL tables currently declared by MercadoZetta

This inventory is the first data-lifecycle slice in Step 12. It records current
schema and repository behavior without selecting retention windows, scheduling
cleanup, or authorizing new deletion. The authoritative implementation sources
are the [Drizzle schema](../backend/src/database/schema.ts), database-neutral
repository contracts under `backend/src/repositories/`, and PostgreSQL adapters
under `backend/src/repositories/postgres/`.

## Retention classes

- **Disposable:** Current product behavior permits explicit deletion, or the
  record is temporary security or user state. Automatic deletion still requires
  an accepted eligibility rule and, where applicable, a retention window.
- **Retained domain state/history:** Current account and commerce contracts
  preserve the record. It is outside automatic cleanup unless a later legal,
  product, privacy, and referential-integrity decision changes that boundary.
- **Immutable audit evidence:** Ordinary updates and deletes are prohibited.
  No cleanup is authorized under the current audit policy.

## Table inventory

| Record type             | Domain owner                                                       | Lifecycle and expiry fields                                                                                                                         | Current cleanup behavior                                                                                                                                                                                                     | Foreign-key or trigger boundary                                                                                                                                                                            | Retention class               |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `tenants`               | Platform tenant and authoritative currency configuration           | `created_at`; no expiry or inactive state                                                                                                           | No delete or currency-change operation                                                                                                                                                                                       | Parent integrity anchor for tenant-scoped records and currency snapshots; dependent foreign keys use `ON DELETE RESTRICT`                                                                                  | Retained domain state/history |
| `tenant_currencies`     | Retained current and historical tenant currency authorities        | `created_at`; no expiry field                                                                                                                       | No delete operation; rows remain while any immutable snapshot may reference them                                                                                                                                             | Tenant deletion is restricted; priced orders and product price history use tenant-qualified `ON DELETE RESTRICT` keys                                                                                      | Retained domain state/history |
| `users`                 | User identity and account security                                 | `created_at`, `updated_at`, `email_verified_at`, `email_version`, `deactivated_at`, and `token_version`; deactivation is terminal but is not expiry | No hard-delete operation. Soft deactivation clears public profile fields, replaces the credential, and retains tenant/email identity                                                                                         | Referenced with tenant-qualified `ON DELETE RESTRICT` keys by security, catalog, commerce, notification, session, and audit records                                                                        | Retained domain state/history |
| `pending_email_changes` | User account security                                              | `created_at` and `expires_at`                                                                                                                       | `deleteByUser` removes the row after confirmation or deactivation. `deleteExpired(before)` deletes rows with `expires_at < before`; no scheduled caller exists                                                               | Tenant and user references use `ON DELETE RESTRICT`; tenant/user and tenant/lower-email uniqueness constrain replacement                                                                                   | Disposable                    |
| `account_tokens`        | User verification, recovery, and email-change security             | `created_at`, `expires_at`, `consumed_at`, `invalidated_at`, and `invalidation_reason`                                                              | Active tokens are invalidated during replacement and account-security changes. `deleteRetired(before)` deletes a row when expiry, consumption, or invalidation is older than the supplied cutoff; no scheduled caller exists | Tenant and user references use `ON DELETE RESTRICT`; one-active-token uniqueness and lifecycle checks prevent conflicting terminal states                                                                  | Disposable                    |
| `products`              | Seller catalog, current price, and inventory                       | `created_at`, `updated_at`, `status`, inventory, and nullable expand-stage `unit_price_minor`; `archived` represents retirement                     | No hard-delete operation. Sellers change lifecycle state, and account deactivation archives owned listings                                                                                                                   | Seller and tenant references use `ON DELETE RESTRICT`; price history, cart items, watchlists, order items, and reviews also restrict product deletion                                                      | Retained domain state/history |
| `carts`                 | Buyer checkout state                                               | `created_at` and `updated_at`; no expiry field                                                                                                      | Checkout deletes items but retains and updates the cart. Account deactivation deletes the cart. No abandoned-cart cleanup exists                                                                                             | Buyer and tenant references use `ON DELETE RESTRICT`; deleting a cart is the schema's only `ON DELETE CASCADE` and removes its `cart_items`                                                                | Disposable                    |
| `cart_items`            | Buyer checkout state through its cart                              | No lifecycle or expiry timestamp                                                                                                                    | Explicit item removal, checkout clearing, and cart deletion remove rows. No independent age-based cleanup is possible from this table                                                                                        | Cart deletion cascades; product deletion is restricted; the composite primary key prevents duplicate products in a cart                                                                                    | Disposable                    |
| `watchlist_entries`     | User marketplace preference                                        | `created_at` and `updated_at`; no expiry field                                                                                                      | User removal and account deactivation delete rows. No age-based cleanup exists                                                                                                                                               | Tenant, user, and product references use `ON DELETE RESTRICT`                                                                                                                                              | Disposable                    |
| `orders`                | Buyer commerce and monetary-summary history                        | `created_at`, `updated_at`, lifecycle `status`, and explicit `legacy_unpriced`/`priced` shape; no expiry field                                      | No delete operation. Monetary fields cannot change after insertion                                                                                                                                                           | Buyer and tenant deletion are restricted; currency, component, and total checks constrain priced snapshots; a trigger rejects monetary-snapshot updates; order items and status history restrict deletion  | Retained domain state/history |
| `order_items`           | Order history, with product, seller, quantity, and price snapshots | `created_at`, `updated_at`, and explicit pricing shape; no expiry field                                                                             | No update or delete repository operation; PostgreSQL triggers reject ordinary updates and deletes                                                                                                                            | Order pricing state, product, and seller references use tenant-qualified `ON DELETE RESTRICT` keys; checks bind unit price, quantity, and line subtotal                                                    | Retained domain state/history |
| `product_price_history` | Seller catalog price history                                       | Monotonic per-product `sequence` and `changed_at`; no expiry field                                                                                  | Append only. PostgreSQL triggers reject ordinary updates and deletes                                                                                                                                                         | Product, actor, and retained tenant currency use tenant-qualified `ON DELETE RESTRICT` keys; amount and sequence checks bound entries                                                                      | Retained domain state/history |
| `order_status_history`  | Order lifecycle history                                            | `changed_at` and monotonic `sequence`; no expiry field                                                                                              | Append during order transitions; no update or delete repository operation                                                                                                                                                    | Order and actor references use tenant-qualified `ON DELETE RESTRICT` keys; the composite primary key preserves sequence uniqueness                                                                         | Retained domain state/history |
| `mutation_idempotency`  | Product/review replay boundary                                     | `created_at`; no expiry field                                                                                                                       | Completed records are not updated or deleted; retention preserves replay guarantees while the referenced commerce resource remains available                                                                                 | Actor and tenant references use `ON DELETE RESTRICT`; the composite key scopes tenant, actor, operation, and client key; request hashes contain no request body                                            | Retained domain state/history |
| `reviews`               | User-authored product history                                      | `created_at` and `updated_at`; no expiry field                                                                                                      | Verified buyers may upsert their review. No delete operation; deactivation explicitly retains reviews                                                                                                                        | Product, author, and tenant references use `ON DELETE RESTRICT`                                                                                                                                            | Retained domain state/history |
| `notifications`         | User inbox state                                                   | `created_at`, `updated_at`, and `is_read`; no expiry field                                                                                          | Read state can be updated. Account deactivation deletes all user notifications; no time-based cleanup exists                                                                                                                 | User and tenant references use `ON DELETE RESTRICT`                                                                                                                                                        | Disposable                    |
| `sessions`              | User authentication security                                       | `created_at`, `updated_at`, `last_used_at`, idle `expires_at`, absolute expiry, rotation, and revocation fields                                     | Security operations revoke rows without deleting them. `deleteExpired(now)` deletes rows with `expires_at <= now`; it is exposed by the session service but has no scheduled production caller                               | User and tenant references use `ON DELETE RESTRICT`; expiry and paired revocation/hash checks constrain lifecycle state                                                                                    | Disposable                    |
| `audit_events`          | Security and commerce audit evidence                               | `occurred_at`; no expiry field                                                                                                                      | Append only. The repository exposes no update or delete, and the accepted audit policy authorizes no automatic cleanup                                                                                                       | Tenant and optional actor references use `ON DELETE RESTRICT`. PostgreSQL triggers reject ordinary `UPDATE` and `DELETE` with SQLSTATE `55000`; `resource_id` is a logical reference without a foreign key | Immutable audit evidence      |

## Confirmed cleanup boundary

The repository already has unbounded time-cutoff delete methods for sessions,
account tokens, and pending email changes. They are exercised directly by
focused or PostgreSQL tests, but there is no one-shot cleanup runner, scheduler,
batch limit, deterministic page boundary, concurrency control, dry-run mode, or
production observability around them. Repository capability must not be treated
as an accepted retention policy or an active cleanup job.

Other deletion is event-driven:

- checkout clears `cart_items` and intentionally leaves the `carts` row;
- users remove individual cart items and watchlist entries;
- email confirmation and account deactivation remove pending email changes;
  and
- account deactivation deletes the user's cart (cascading its items), watchlist
  entries, and notifications inside the account mutation transaction.

No repository hard-deletes tenants, users, products, orders, order items, order
status history, mutation replay records, reviews, or audit events. Product retirement and user removal
are represented by archival and soft deactivation so commerce, authorship,
identity reservation, and audit relationships remain intact.

## Accepted temporary-security retention

The following windows govern physical deletion only. Authentication and token
confirmation continue to reject expired, revoked, consumed, or invalidated
records from their timestamps even when cleanup has not run. A cleanup job must
capture one stable `now` at the start of a run and derive its cutoffs from that
value; the later job contract will define batching, concurrency, and execution.

| Record type             | Accepted grace and eligibility                                                                                                                                                                                                                          | Reason and implementation impact                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`              | Retain for seven days after the first terminal boundary. A row is eligible when `expires_at` is at least seven days old or, for an explicitly revoked row, `revoked_at` is at least seven days old.                                                     | Seven days preserves a short investigation window for expiry, revocation, and refresh-reuse incidents while limiting retention of refresh hashes and user-agent labels. The existing `deleteExpired(now)` has no grace and ignores early revocation, so it must not be used unchanged by the future runner.                                                 |
| `account_tokens`        | Retain for seven days after expiry, consumption, or invalidation. A row is eligible when any corresponding terminal timestamp is at least seven days old.                                                                                               | The window preserves bounded issuance and delivery investigation evidence, exceeds the configurable issuance window's 24-hour maximum, and retains no raw token or destination email. The existing `deleteRetired(before)` already represents the terminal-time alternatives, but the future runner must supply the seven-day cutoff and bound each delete. |
| `pending_email_changes` | Delete immediately after successful confirmation or account deactivation, as today. An unconfirmed row is eligible 24 hours after `expires_at`. Replacement continues to overwrite the prior tenant/user row rather than retaining destination history. | The row contains the proposed login address, while the paired token and sanitized audit event provide the necessary operational evidence. A 24-hour grace permits delayed cleanup without reserving the address indefinitely. The existing `deleteExpired(before)` can express the cutoff but must be bounded before scheduled use.                         |

These are fixed policy baselines, not extensions of credential lifetime. Changing
them requires a reviewed policy update; environment configuration must not
silently shorten the investigation grace or lengthen personal/security-data
retention.

Secret-key overlap is based on possible credential validity, not physical-row
retention. A refresh-hash key remains configured while any unexpired current or
previous session hash can reference it. An account-token hash key remains until
every token issued with it has expired. Expired records retained for the grace
window do not require their old HMAC key because they can no longer authenticate
or confirm an operation.

## Accepted notification retention

Notifications are a user inbox convenience, not the authoritative order,
review, inventory, or audit record. Their message contains an order identifier
or product name, while the referenced domain state remains available through
its retained record after notification cleanup.

- A read notification is eligible for deletion 30 days after `updated_at`.
- An unread notification is eligible for deletion 180 days after `updated_at`.
- Creation initializes `created_at` and `updated_at` together. Every successful
  explicit read-state update refreshes `updated_at`, including an idempotent
  request that submits the current state, so the user action restarts the
  retention window for the resulting state. `created_at` remains the immutable
  presentation-order timestamp.
- Account deactivation continues to delete every notification for that account
  immediately inside the deactivation transaction, regardless of read state or
  age. This terminal account cleanup overrides the scheduled windows.

The future bounded delete must recheck both `is_read` and the applicable
`updated_at` cutoff in its deletion predicate so a stale candidate selection
cannot delete a notification whose user changed its state. The current indexes
support user lists and unread counts, not global age cleanup; implementation
must review the cleanup query plan and add a reviewed migration only if the
production-like plan justifies an index.

## Accepted cart and watchlist retention

A cart is disposable working state rather than commerce history. The retained
order and order-item records become authoritative after checkout.

- Adding an item, changing quantity, removing an item, and successful checkout
  clearing all count as cart activity and must refresh the parent cart's
  `updated_at` in the same mutation as its item changes.
- A cart and its cascading `cart_items` become eligible after 30 days without
  activity, whether the cart is populated or empty. Retaining an empty cart has
  no product value; it is tolerated until the same inactivity boundary so
  checkout does not need a separate parent-delete path.
- Account deactivation continues to delete the user's cart and cascading items
  immediately, overriding the scheduled window.
- The current repository already refreshes the parent after checkout clearing,
  but item set and removal must be corrected before scheduled cart cleanup can
  use `updated_at` safely.

Watchlist entries represent an explicit durable user preference. They do not
expire by age. They remain until the user removes the product or account
deactivation deletes the user's disposable state. A product lifecycle change
does not delete the entry; the product foreign key and existing UI continue to
represent the saved relationship.

## Records excluded from automatic cleanup

Tenants, users (including deactivated identity reservations), products,
orders, order items, order status history, and reviews remain retained domain
state/history. No automatic cleanup job may delete them. A later hard-deletion,
anonymization, or legal-erasure design must reconcile identity, authorship,
commerce snapshots, tenant isolation, and referential integrity explicitly.

Audit events remain immutable audit evidence. Their retention still depends on
deployment, legal, and incident-response requirements; until a separate policy
is accepted, the database triggers and repository boundary continue to prohibit
automatic update or deletion.

## Eligibility inputs and gaps for later decisions

All current record classes now have an accepted retention boundary. The
separate cleanup-job contract must define bounded operations and execution
behavior before any scheduled runner is activated. Application logs retain
their separate 30-day policy and do not determine database-record retention.

## Cleanup-job contract

Cleanup runs as a provider-neutral one-shot process from the same immutable
backend image and committed schema version as the application. Deployment owns
the scheduler; the Express process contains no timer or cron loop. The initial
cadence is once per UTC day. A scheduler should prevent overlap, while database
operations must remain safe if two runners still meet.

The runner uses one captured UTC time for the complete run and processes these
targets independently: sessions, account tokens, pending email changes, read
notifications, unread notifications, and carts. Each delete:

- orders eligible rows by the relevant terminal/activity timestamp and UUID;
- selects at most the configured batch size with row locking and
  `SKIP LOCKED`;
- rechecks lifecycle state and cutoff in the atomic delete statement;
- commits one batch at a time; and
- stops on a short batch or after the configured per-target batch limit.

Committed batches are not rolled back when a later target fails. Retrying is
safe because eligibility deletes are idempotent and the next run resumes from
the oldest remaining row. The process exits nonzero on any error and performs
no internal retry; the scheduler may retry the whole one-shot command.

Validated runner configuration is intentionally small:

| Variable                              | Default | Accepted range and meaning                                                                    |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `DATA_CLEANUP_BATCH_SIZE`             | `100`   | Integer `1..1000`; maximum rows selected by one target batch                                  |
| `DATA_CLEANUP_MAX_BATCHES_PER_TARGET` | `10`    | Integer `1..100`; bounds one target to at most 100,000 deletions per run                      |
| `DATA_CLEANUP_DRY_RUN`                | `true`  | Exact `true` or `false`; dry-run previews at most one batch per target and never mutates data |

Retention windows are fixed policy values, not environment variables. A real
scheduled deployment must explicitly set `DATA_CLEANUP_DRY_RUN=false`; the safe
default prevents an ad hoc command from deleting data.

The runner emits structured start, completion, and failure events without row
contents or identifiers. Completion includes the stable cutoff time, dry-run
state, duration, per-target row counts, batches, and targets that reached their
limit. Platform monitoring must alert on any failed run, no successful run for
26 hours after activation, or three consecutive runs that reach a target limit.
Dry-run output reports only bounded candidate counts and whether the preview
limit was reached.

The database role needs only connection plus the scoped select/delete access
required for disposable tables; it must not bypass audit triggers or receive
delete access to retained tables. Query plans are reviewed against the rehearsal
dataset before adding cleanup-specific indexes.

The current representative rehearsal dataset produces small sequential plans;
it does not justify adding cleanup indexes. A deployment with materially larger
tables must capture `EXPLAIN (ANALYZE, BUFFERS)` in a production-like isolated
environment before activation and add indexes only through a reviewed migration.
