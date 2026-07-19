# ADR 0006: Tenant Currency and Authoritative Money

- Status: Accepted
- Date: 2026-07-19
- Owners: MercadoZetta maintainers

## Context

MercadoZetta currently records product inventory and order quantities but no
prices. The frontend brand configuration happens to identify both built-in
tenants as US-dollar (`USD`) marketplaces, but frontend configuration is
presentation data and cannot be the authority for checkout, persistence, or
revenue. Existing orders snapshot a product name and quantity only, so no
historical price or revenue can be reconstructed from them.

Step 14 adds prices, order totals, price history, and eventually revenue. That
work needs one accepted monetary contract before schema or API changes. In
particular, JavaScript binary floating-point arithmetic is not suitable for
authoritative decimal amounts, JSON cannot carry arbitrary 64-bit integers
exactly as numbers, and a later product-price edit must not alter an order that
has already been placed.

This decision extends the tenant and immutable-commerce boundaries in
[ADR 0002](0002-postgresql-persistence.md) and the PostgreSQL/Drizzle boundary
in [ADR 0003](0003-drizzle-postgresql-tooling.md). It does not model payment,
tax, settlement, exchange, refund, or accounting-ledger behavior.

## Decision

### One authoritative currency per tenant

Each tenant has exactly one backend-authoritative ISO 4217 alphabetic currency
code and one minor-unit exponent. Both built-in tenants use `USD` with exponent
`2`; one dollar is therefore 100 minor units. The code is stored and compared as
three uppercase ASCII characters. The exponent is stored explicitly rather
than inferred at display time, so persisted historical values do not change if
an external currency-data source changes.

The PostgreSQL `tenants` row is the persistence anchor for this setting. The
backend tenant registry must declare the same code and exponent so startup,
seed, and migration validation can fail on drift. Frontend brand `currency`
and `locale` remain formatting choices. API money objects always carry their
authoritative currency, and the frontend must reject or visibly fail an
unexpected currency instead of silently formatting it as the configured brand.

Tenant currency cannot be changed through a marketplace API. Once a tenant has
any priced product, price-history entry, or priced order, changing its currency
requires a separate reviewed data-migration decision. A new currency is not a
price conversion, and MercadoZetta will not perform implicit foreign-exchange
conversion. A tenant that needs simultaneous currencies requires a new ADR and
schema rather than overloading this field.

### Integer minor units at every authoritative boundary

Authoritative amounts use non-negative integer minor units:

- PostgreSQL stores amounts as `bigint`, never `real`, `double precision`, or
  an unconstrained floating-point value.
- Backend domain and calculation code uses JavaScript `bigint`. It does not
  convert monetary values to `number` for arithmetic.
- JSON request and response amounts are canonical base-10 strings matching
  `0|[1-9][0-9]*`. They are not JSON numbers and contain no sign, decimal point,
  grouping separator, whitespace, exponent, or leading zero.
- Human decimal input is normalized at the request boundary with the tenant's
  accepted exponent. For `USD`, `12.34` becomes `"1234"`; more than two
  fractional digits is invalid and is never silently rounded.

The shared wire representation is:

```json
{
  "currency": "USD",
  "amountMinor": "1234"
}
```

The accepted maximum for any stored product, component, line, or order amount
is `9000000000000000` minor units. This stays below JavaScript's maximum safe
integer as defense in depth even though application arithmetic still uses
`bigint`, and it leaves headroom below PostgreSQL's signed 64-bit limit.
Validators, services, and database checks enforce the bound. Quantity
multiplication and accumulation must be checked against the same bound before
write; overflow is a validation/domain failure and never wraps or truncates.

No arbitrary-precision decimal dependency is needed for the first monetary
model because all accepted inputs and stored results are integers and the
required operations are integer addition, subtraction, multiplication, and
comparison. A later tax, percentage-discount, exchange, or allocation feature
must re-evaluate whether a maintained decimal library makes those rules safer.

### Product price and append-only history

A sellable product has one current `unitPriceMinor` in its tenant currency.
Draft products may temporarily have no price during the compatibility rollout,
but an active product and any product added to a cart or checkout must have a
valid price. Zero is a valid explicit price; absence is not zero.

Creating the initial price and changing it appends a tenant-qualified product
price-history record in the same transaction as the current product update.
Each history entry records product, currency code, minor-unit exponent, exact
unit amount, seller actor, monotonic sequence, and change time. History is
append-only. Retrying an idempotent product mutation must not append another
entry after its result has already committed.

A cart continues to store only product and quantity. Cart display is a quote
from the current product price, not a reservation. Checkout locks the same
tenant product rows used for inventory checks and snapshots the price observed
inside that transaction. A changed price may therefore change a cart quote,
but cannot change an order after commit.

### Immutable order monetary snapshots

Every newly priced order snapshots the tenant currency code and minor-unit
exponent. Each order line snapshots its exact unit price and line subtotal in
addition to the existing product name, product, seller, and quantity. The line
invariant is:

```text
lineSubtotalMinor = unitPriceMinor * quantity
```

The order stores `subtotalMinor`, `discountMinor`, `shippingMinor`, and
`totalMinor`. Initially discounts and shipping are explicitly zero because no
discount or physical-shipping domain exists; they are stored now so the total
contract is unambiguous. The invariant is:

```text
subtotalMinor = sum(lineSubtotalMinor)
0 <= discountMinor <= subtotalMinor
totalMinor = subtotalMinor - discountMinor + shippingMinor
```

The backend computes all values from locked product prices and accepted backend
rules. Client-submitted line prices, component amounts, or totals are rejected
as unknown fields and are never used for checkout. The order header, order
line monetary snapshots, and initial status history commit in the existing
short checkout transaction. Persisted order monetary fields and order lines
are immutable after insertion; product edits affect only later carts and
orders.

There is no fractional rounding in the initial checkout because inputs are
already exact minor units and quantities are integers. A future backend rule
that produces a fraction of a minor unit must define its allocation boundary
and use round-half-up for non-negative values: divide the integer numerator by
the positive denominator and increment the quotient when twice the remainder
is greater than or equal to the denominator. Rounding occurs once at that
rule's documented output boundary, never through binary floating point. Sum of
allocated parts must equal the persisted component total.

### Legacy data is explicitly unpriced

Existing products and orders have no recoverable authoritative amounts. The
migration must not invent zero prices or infer revenue from quantities. The
compatibility rollout therefore distinguishes:

- `priced` orders, for which every currency, line amount, component, and total
  is present and constrained; and
- `legacy_unpriced` orders created before the monetary model, for which all
  monetary fields are absent and which are permanently excluded from revenue.

Existing products begin without a price unless an operator supplies a reviewed
authoritative mapping. They cannot remain active or be checked out after the
new enforcement release until their seller assigns a valid price. Demo data is
reseeded with deliberate prices rather than treated as evidence for historical
orders.

The order API must make the distinction explicit and must not render a legacy
order as free. Revenue summaries may be introduced only for priced snapshots,
must state or structurally expose the excluded legacy population, and must
aggregate stored line/order amounts rather than current catalog prices.

## Alternatives

### Binary floating-point numbers

Using JavaScript `number` and PostgreSQL floating-point columns would be simple
but cannot represent many decimal fractions exactly. Repeated arithmetic and
equality checks would make persisted totals dependent on evaluation details.
This is rejected for authoritative money.

### PostgreSQL `numeric` and decimal strings

Fixed-scale `numeric` can represent money exactly and remains a valid choice
for a domain that accepts fractional major-unit arithmetic. MercadoZetta's
current requirements use one known minor-unit scale per tenant and whole minor
units at every boundary, so `bigint` makes invalid fractions unrepresentable
and keeps calculations simple. PostgreSQL's locale-sensitive `money` type is
also rejected because its scale and formatting depend on database locale.

### JSON numeric amounts

JSON numbers would be more compact, but consumers do not all preserve arbitrary
64-bit integers. A decimal string gives the OpenAPI contract one portable exact
representation and maps directly to backend `bigint`.

### Currency only in frontend brand configuration

This would make a build-time presentation choice authoritative for persisted
commerce and would provide no database invariant or historical snapshot. The
backend and database are therefore authoritative; frontend configuration is
validated presentation metadata only.

## Persistence and rollout sequence

The monetary rollout uses expand, backfill, enforce, and expose stages under
the existing database-evolution policy:

1. Add tenant currency/exponent, nullable product price, explicit legacy/priced
   order state, nullable order components, nullable order-line snapshots, and
   append-only product price history. Add checks that enforce all-or-none
   monetary shapes without inventing legacy values.
2. Seed and startup validation prove that configured tenants match PostgreSQL.
   Demo products receive deliberate prices and initial history. Any non-demo
   product backfill requires an operator-supplied reviewed mapping; otherwise
   the product becomes non-sellable until its seller prices it.
3. Add validators, repositories, product mutations, price history, and API money
   objects. Product price and history changes commit atomically and preserve the
   current idempotency contract.
4. Update checkout to lock and snapshot prices and compute all line/header
   amounts. Only this release may create `priced` orders. Database-backed tests
   prove atomicity, boundaries, tenant isolation, price-change races, and exact
   retry replay.
5. Expose money in catalog, cart, order, checkout, and seller UI with
   tenant-aware `Intl.NumberFormat` display fed from exact strings. Add contract,
   focused frontend, and both-brand browser coverage.
6. Add revenue summaries only after verification proves every included order is
   priced and immutable. Legacy orders remain counted separately and excluded.

The initial migration is additive so the preceding application can continue to
read and write during a bounded rollout. Before enforcement, the deployment
must either prevent old checkout writers or prove that every old-created order
is marked `legacy_unpriced`. Application rollback may leave additive nullable
columns and history tables in place. Once the new application has accepted
priced writes, rollback to code that ignores or overwrites price state is not
allowed; use a compatible application release or a reviewed compensating
forward migration. Applied migrations are never edited or removed.

## Required verification

Focused unit, schema-contract, PostgreSQL integration, OpenAPI parity, and
frontend tests must cover canonical amount parsing, zero and maximum amounts,
over-precision rejection, overflow, multiplication and aggregate boundaries,
currency mismatch, tenant isolation, initial/change history, append-only
enforcement, idempotent replay, concurrent price change versus checkout,
immutable order snapshots, legacy-unpriced behavior, and the invariant between
lines, components, and total. Both built-in brands must format `USD` correctly
without becoming the source of the amount or currency.

## Implementation status

The monetary model is fully implemented as of 2026-07-19. New checkout writes
are `priced`, with locked product prices, immutable line snapshots, and
backend-calculated subtotal, zero discount, zero shipping, and total committed
with the existing inventory and idempotency effects. Product edits after
checkout do not change stored orders, and exact checkout retries replay the
original snapshots.

Seller operations expose gross revenue as the sum of that seller's immutable
line subtotals for priced, non-cancelled orders. This is a marketplace sales
summary, not payment capture, settlement, tax, or accounting revenue. Priced
and legacy-unpriced order counts are exposed separately, and legacy lines are
never treated as zero-value sales. Seller-scoped order responses expose only
the seller's line snapshots and suppress buyer whole-order component totals.
