# Mutation idempotency

## Keyed replay boundaries

Checkout requires a client-generated UUID in the `Idempotency-Key` header. The
key is scoped by tenant and authenticated buyer and is stored on the resulting
order. The frontend creates one key for a checkout intent, retains it after an
ambiguous or failed request, and replaces it only after checkout succeeds or a
cart edit succeeds.

The checkout transaction locks the buyer's cart before looking up the key. This
ordering makes concurrent requests deterministic:

- the first request for a new key validates the locked cart, creates the order,
  decrements inventory, writes audit events and notifications, and clears the
  cart atomically;
- a concurrent or later request with the same key observes the committed order
  and returns that order and its persisted lines without repeating side effects;
- a request with a different key observes the cleared cart and fails with
  `EMPTY_CART` instead of creating a duplicate order.

Keys remain attached to retained commerce history. They are internal persistence
metadata and are not returned in the public order contract or written to logs or
audit metadata. Migration `0005_special_marauders.sql` expands the order table,
backfills historical rows with unique UUIDs, enforces the new non-null invariant,
and then adds tenant/buyer/key uniqueness. An application rollback may leave the
column and constraint in place because older code ignores both; removing them
requires a later compensating migration after confirming no rollback still needs
the stored replay boundary.

Order lifecycle updates are target-state operations. Once an authorized buyer
or seller has already applied the requested status, retrying that same status
returns the current scoped order without appending history, notifications, or
audit events. Invalid transitions to a different state still return the existing
conflict response.

Product creation and verified-buyer review upsert also require a UUID
`Idempotency-Key`. Their keys are scoped by tenant, actor, and operation in
`mutation_idempotency`; a SHA-256 request fingerprint prevents one key from
being reused for a different payload. The product or review and its replay
record commit in the same transaction. An exact retry returns the persisted
resource without creating another listing or seller notification, while a
different payload returns `IDEMPOTENCY_KEY_REUSED`.

The frontend keeps a key across an ambiguous failure and replaces it when the
form payload changes or the mutation succeeds. Replay records contain only the
key, fingerprint, resource identifier, scope, and creation time. They contain
no request body or secret and are retained with commerce history so an old
retry cannot later recreate a resource. Migration
`0006_yielding_captain_america.sql` introduces this compatible additive table.

## Existing naturally idempotent operations

Cart quantity, watchlist membership, notification read state, product detail,
and product lifecycle updates set or remove a named resource state. Their
database constraints and tenant-qualified predicates prevent duplicate rows,
and repeating the same target state does not create a second commerce resource.
They do not need checkout-style keys unless a future side effect makes a replay
observably non-idempotent.

## Other retry-sensitive operations

Inventory and profile updates compare the requested state with the locked or
current state. An unchanged retry returns that state without another write or
audit event.

Account verification and password-recovery requests intentionally keep their
generic anti-enumeration response. Cooldown and issuance-window suppression
prevent rapid retries from replacing an active token or dispatching another
message. Reusing a pending email-change request for the same normalized address
and account version likewise preserves its token and does not dispatch another
message. A materially new security request remains allowed to supersede old
credentials under the documented rate limits.

Successful login is deliberately not keyed: every accepted authentication is a
new session and response-cookie exchange, concurrent sessions are bounded and
revocable, and persisting credential request fingerprints would add sensitive
replay state. Registration's tenant/email uniqueness prevents duplicate
identities; a retry after an ambiguous success returns the existing public
conflict rather than replaying password-bearing registration input.

## Verification

Focused tests cover header validation, frontend key retention, keyed request
conflicts, no-op state updates, checkout replay, and lifecycle replay.
PostgreSQL integration coverage proves that checkout
replay preserves one order, line set, inventory decrement, notification set, and
audit set, while lifecycle replay preserves one transition history entry,
notification, and audit event. It also proves product and review replay returns
one resource and does not repeat review notification delivery. OpenAPI documents
the required header and exact missing, invalid, and reused-key errors.
