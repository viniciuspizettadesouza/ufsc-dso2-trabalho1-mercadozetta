# ADR 0007: Portugal Payments and Marketplace Funds

- Status: Accepted
- Date: 2026-07-19
- Owners: MercadoZetta maintainers

## Context

MercadoZetta has exact immutable order totals but does not accept, refund, or
settle money. Its current checkout creates a `placed` order, decrements
inventory, clears the cart, and notifies sellers in one local transaction. That
is a suitable development order flow, but it cannot safely be wrapped in a
redirect to a payment provider: the buyer can abandon the redirect, a success
URL can be forged, provider events can be delayed or duplicated, and one cart
can contain goods from several sellers.

The first sellable version targets a bounded Portuguese pilot and must preserve
that multi-seller cart. Stripe documents separate charges and transfers for a
single charge whose proceeds go to multiple connected accounts. It also makes
the platform balance responsible for Stripe fees, refunds, and chargebacks in
that charge model. Those facts affect the marketplace's legal, inventory,
support, and liquidity responsibilities; they are not merely SDK choices.

This decision succeeds the single-currency rollout portion of
[ADR 0006](0006-authoritative-money.md) and extends its exact-money rules into
payments. It defines the contract that later schema and Stripe work must
implement. It does not enable a Stripe account, install an SDK, create payment
tables, provide legal or tax advice, or authorize live money movement.

## Decision

### Launch, contracting, and liability assumptions

The first payment launch context is the `campus-market` tenant serving buyers
and an approved seller cohort in Portugal, presenting and settling only `EUR`.
The Stripe platform account and the buyer-facing marketplace must be operated
by the same Portugal-established contracting legal entity. The `mercadozetta`
tenant remains a distinct USD market configuration and is outside the first
Portugal payment launch; enabling payments there requires its own regional,
legal, tax, seller-country, and provider-readiness decision.

For the bounded pilot, the platform is the buyer-facing merchant of record. It
is named on Checkout, the customer receipt, terms, support path, refund policy,
and payment statement wherever the payment method permits. The platform:

- contracts with the buyer for the complete multi-seller order and issues the
  buyer invoice or receipt;
- is responsible for buyer-facing VAT treatment, refunds, cancellations,
  disputes, chargebacks, Stripe processing fees, and platform negative
  balances;
- contracts separately with each seller, calculates the seller's allocation,
  controls transfer timing, and provides settlement evidence; and
- maintains the operational reserve needed to refund the buyer even when a
  seller transfer cannot be reversed immediately.

Each seller remains responsible for the truth and legality of its listings,
fulfilment, returns cooperation, its own registration and tax obligations, and
the invoice or other evidence required for its supply to or settlement with the
platform under the signed seller agreement. Stripe onboarding and KYC do not
replace marketplace admission, product compliance, VAT, invoice, or consumer
law checks.

The initial seller country is Portugal only. An EEA seller-country matrix may
be added after Stripe capability, cross-border transfer, VAT, invoicing,
consumer-law, support, and contract review for each country. A connected
account being technically creatable is not sufficient approval.

The pilot platform fee is exactly zero basis points. Each seller allocation is
therefore its owned line gross, and the platform absorbs Stripe fees and other
pilot operating costs. This is an explicit bounded-pilot commercial assumption,
not a permanent promise. A non-zero fee requires a versioned fee policy, signed
seller terms, exact allocation and rounding rules, immutable order-time fee
snapshots, refund behavior, and a reviewed change to this decision. No fee may
be inferred from the amount left in the Stripe platform balance.

Before live mode, the actual legal entity, Portugal Stripe account country,
merchant-of-record presentation, seller agreement, zero-fee economics, VAT and
invoice flows, refund/dispute liability, reserve funding, and supported seller
countries require written approval from the accountable operator plus qualified
Portuguese legal and accounting advisers. If the intended operator cannot adopt
these assumptions, live payment stays disabled and this ADR must be amended;
the implementation must not silently switch to a seller-as-merchant model.

### EUR transition without relabelling USD history

`EUR` with minor-unit exponent `2` is the authoritative currency for the
`campus-market` tenant in the Portuguese pilot. `mercadozetta` keeps `USD` with
exponent `2`. The existing CampusMarket product prices, price history, and
orders before this transition are verified `USD` development history. They are
not euros and no exchange rate is implied by this decision.

The currency transition is a reviewed expand, migrate, enforce, and contract
change:

1. Expand persistence and APIs to tolerate immutable order and price-history
   snapshots whose currency differs from the tenant's new current currency.
   Existing `USD` order and line fields remain byte-for-byte monetary history.
2. Supply an operator-reviewed mapping of a deliberate `EUR` price for every
   active product. Do not calculate it from the old `USD` amount. Products
   without an approved mapping become non-sellable.
3. In a controlled migration, append a new `EUR` price-history entry, set each
   approved CampusMarket product's current price, and change that tenant
   authority to `EUR`/`2`. Never update or delete an old `USD` history entry.
4. Change the CampusMarket brand configuration to format current catalog money
   as `EUR` using an approved Portugal-first locale. Keep MercadoZetta on
   `USD`/`en-US`. Historical order screens must continue to format each
   snapshot's own `USD` or `EUR` currency rather than the current brand currency.
5. Enforce that all active products and every new checkout attempt use the
   tenant's current `EUR` authority. A cart cannot mix currencies, and Stripe
   never performs adaptive pricing or foreign-exchange conversion for the
   pilot.

The reviewed built-in catalog mapping is deliberately assigned, not converted:

| Product                                | Previous USD minor amount | New EUR minor amount |
| -------------------------------------- | ------------------------: | -------------------: |
| `67000000-0000-4000-8000-000000000003` |                    `1999` |               `1899` |
| `67000000-0000-4000-8000-000000000004` |                    `5999` |               `5490` |

Any other CampusMarket product present at migration time has no reviewed
mapping and becomes unpriced and non-sellable until an operator supplies a
deliberate EUR price. MercadoZetta products are not part of this mapping and
retain their USD prices and sellable state.

The migration must rehearse mixed historical currencies, rollback compatibility,
catalog activation, exact API strings, both brands, and revenue summaries.
Changing a label or tenant currency without the deliberate product mapping is
forbidden. Payment schema and SDK work begins only after this transition has a
reviewed migration and verified contract.

### Stripe product and payment-method boundary

The first payment UI is a Stripe Checkout Session in `payment` mode redirecting
to the Stripe-hosted page. The backend creates its line items and total from a
locked local snapshot. It never accepts a client currency, unit price, total,
seller allocation, provider identifier, payment state, or transfer amount.
Checkout success and cancellation URLs are navigation only and grant no domain
state transition.

The marketplace funds flow is one charge on the Portugal platform account plus
one separate transfer per seller allocation. Local IDs connect the charge and
transfers; Stripe `transfer_group`, metadata, and `source_transaction` are
secondary correlation and availability controls. They are not accounting
truth, and a transfer group by itself does not move or segregate money.

Cards are the only required live-pilot payment method. Apple Pay and Google Pay
may appear through Stripe-hosted Checkout as eligible card wallets only after
the real domain, browser/device behavior, Connect flow, refunds, disputes, and
support copy pass the card test matrix. Their absence does not block launch.

MB WAY is a Portugal/`EUR` candidate but is not in the minimum pilot. Stripe
currently documents immediate payment notification, Checkout and all Connect
charge-type support, no recurring or manual-capture support, single-payment
use, partial refunds, and disputes. It may be enabled only after its amount
limits, phone/app journey, failure handling, seller allocation, refund,
dispute-evidence deadline, statement presentation, webhook, and support flows
pass the same test-mode and readiness gates.

Multibanco, SEPA Direct Debit, PayPal, Link as an independently promoted method,
and every other local or delayed method remain disabled. Each requires a later
method-specific review of Checkout and Connect compatibility, confirmation
timing, expiry, reusable credentials, refunds, disputes, transfer timing,
reconciliation, customer communication, and operational ownership. Dashboard
automatic payment-method settings must not broaden this allowlist unnoticed.

### Provider-neutral local payment model

The local domain uses generated UUID primary keys. Stripe IDs are external
references unique within provider, mode, platform account, object kind, and
external ID. Test and live objects can never satisfy each other's references.
External IDs are not accepted from buyer or seller requests and are not used as
tenant, actor, order, attempt, allocation, refund, dispute, or transfer primary
keys.

The later schema must represent at least:

- a payment attempt with tenant, buyer, immutable checkout snapshot, currency,
  total, provider/mode, lifecycle state, expiry, idempotency lineage, and
  optional resulting order;
- immutable attempt lines and one seller allocation per participating seller,
  with line gross, snapshotted fee rule, fee amount, and intended transfer;
- external Checkout Session, PaymentIntent, charge, connected-account, refund,
  dispute, transfer, reversal, payout, and balance-transaction references as
  applicable;
- inventory reservations with active, consumed, or released terminal state;
- append-only payment, allocation, transfer, refund, dispute, connected-account,
  and reconciliation observations; and
- an authenticated webhook inbox and retryable local work/outbox boundary.

Suggested local states are provider-neutral. Payment attempts distinguish at
least `creating`, `awaiting_customer`, `processing`, `succeeded`, `failed`,
`expired`, and `cancelled`; transfers distinguish `pending`, `submitted`,
`paid`, `failed`, `reversed`, and `partially_reversed`. Provider status and raw
provider JSON must not be overloaded into these enums. State transitions are
monotonic except for explicit compensating refund, reversal, or dispute facts,
and terminal transitions use conditional updates so duplicate workers cannot
repeat effects.

At zero pilot fee, for each seller:

```text
sellerGrossMinor = sum(owned lineSubtotalMinor)
platformFeeMinor = 0
intendedTransferMinor = sellerGrossMinor
sum(sellerGrossMinor) = payment subtotalMinor
```

Current discount and shipping are zero. Before either becomes non-zero, its
seller allocation, refund, VAT, and rounding rule must be accepted. Allocation
uses backend `bigint`, the bound, canonical strings, and immutable currency
snapshots from ADR 0006. Provider amounts must exactly equal the accepted local
minor-unit values.

### Checkout, reservation, order, and fulfilment boundary

Starting a paid checkout does not immediately create a commerce order. In one
short local transaction the backend locks the cart and products, revalidates
tenant, currency, lifecycle, price, and available inventory, snapshots lines
and allocations into one payment attempt, and reserves the quantities. The
cart remains visible but is locked against quantity changes, removal, or a
second materially different checkout while its reservation is active.

The external Checkout Session is created after that transaction with a stable
provider idempotency key. Its expiry is 30 minutes after creation, matching the
local reservation deadline. If session creation fails definitively, local
compensation releases the reservation. If the result is ambiguous, the attempt
remains recoverable and the same provider operation is retried or reconciled;
it is never replaced speculatively.

A payment-authoritative webhook that proves the exact attempt succeeded causes
one local transaction to:

1. lock and transition the attempt once;
2. verify tenant, mode, currency, amount, Checkout Session, PaymentIntent, and
   charge against current provider state and the immutable local snapshot;
3. consume the reservation;
4. create one `placed` order and its immutable line monetary snapshots;
5. link the payment to the order, append audit/history evidence, clear the
   checked-out cart, and create buyer/seller notifications; and
6. enqueue later transfer/reconciliation work.

The order creation idempotency key derives from the local attempt. A duplicate
success event returns the existing order without repeating inventory, history,
audit, notification, or transfer effects. Seller order visibility begins only
after this paid order exists.

An open or processing attempt is not an order and permits no fulfilment. A
payment-enabled order is fulfilment-eligible only when its successful payment
fact is still valid and it is not cancelled or fully refunded. Payment state,
commerce order state (`placed` through `cancelled`), and later seller-specific
fulfilment/shipment state remain separate fields with explicit transition
guards. Existing development and legacy orders are marked as requiring no
provider payment; they must never be mistaken for paid pilot orders.

Inventory release is not based on a browser redirect or local wall clock alone.
After the local deadline, a worker first expires an open Checkout Session using
a stable provider idempotency key, then retrieves its current state. Only a
provider-confirmed expired or definitively failed/cancelled attempt releases
the reservation. Provider-confirmed success consumes it even if the webhook was
late. Expiry, success, and cleanup race through one locked conditional local
transition. A mismatch or indeterminate provider result leaves stock reserved
and raises an operational exception instead of risking paid-but-unfulfillable
overselling.

### Seller onboarding and transfer timing

Sellers use Stripe-hosted Connect onboarding through a single-use Account Link
created only for the authenticated tenant/seller. Links are shown inside the
application, never emailed or logged. Refresh and return URLs are navigation;
returning does not mean onboarding is complete. Local capability state is
updated from authenticated `account.updated` events and provider retrieval.

The pilot collects all `eventually_due` requirements up front and requests only
the capabilities needed for the accepted payment methods and transfers. A
seller is payment-eligible only when marketplace admission is approved, the
country is supported, identity requirements are satisfied, required
capabilities are active, payouts are enabled, and no restriction or deadline
blocks it. Checkout rejects a cart containing any ineligible seller before
reserving inventory.

No seller transfer occurs merely because a charge succeeds. Each seller's
immutable allocation becomes eligible only after that seller's complete
fulfilment is recorded as delivered, 14 calendar days have elapsed, the
connected account remains eligible, and no cancellation, refund, dispute,
return, reconciliation hold, or operator hold affects the allocation. This
requires seller-specific fulfilment before live mode; the current whole-order
status is insufficient.

An idempotent scheduled worker creates at most one transfer per eligible
allocation and links it to the source charge where supported. Failed transfers
are not assumed to retry automatically; they remain visible exceptions and are
retried through the same local operation lineage. Stripe payout scheduling is
distinct from the marketplace transfer. Transfer success does not mean the
seller's bank payout succeeded.

### Webhook authority and event processing

Authenticated Stripe webhooks are authoritative notification inputs for
asynchronous payment, refund, dispute, transfer, payout, and connected-account
facts. For every endpoint and mode, the server:

- uses a route-specific raw request body before any JSON middleware, verifies
  the `Stripe-Signature` timestamp and signature against an active endpoint
  secret, enforces a small request-size bound, and rejects failures without
  domain writes;
- durably records the accepted event ID, account/mode, type, provider creation
  time, object ID, payload hash, receipt time, processing state, and failure
  summary before acknowledging it;
- deduplicates by event ID and also makes each object/type transition
  idempotent because Stripe can create distinct Event objects for the same
  underlying fact;
- assumes duplicates, delay, manual resend, concurrency, and out-of-order
  delivery, and never relies on arrival order or the event payload alone;
- retrieves the current Checkout Session, PaymentIntent/charge, refund,
  dispute, transfer, or account state from Stripe before an authoritative local
  transition, then validates it against local tenant, attempt, currency, and
  exact amounts; and
- acknowledges duplicates and successfully queued work, retries transient
  processing failures, dead-letters bounded permanent failures, and exposes the
  backlog and oldest-event age to operations.

Webhook payloads never authorize tenant or actor scope by metadata alone.
Metadata contains only opaque local IDs and a contract version, no email,
address, product text, secret, or other personal data. An unknown object,
currency/amount mismatch, mode/account mismatch, missing local lineage, or
impossible transition is quarantined for reconciliation and never coerced into
success.

Endpoint secrets are separate for test and live and may overlap during a
documented rotation. Old secrets are removed only after Stripe delivery retry
and manual-replay windows plus the local backlog are clear. API secret and
restricted keys follow the same versioned secret-management, no-log, and
rotation runbook; they are server-only and never stored in the database.

### End-to-end idempotency lineage

The authenticated buyer supplies one UUID `Idempotency-Key` for the paid
checkout command. It is scoped by tenant and buyer and fingerprints the locked
cart identity, quantities, price/version snapshots, currency, total, and
allocation contract. Exact retries return the same attempt and Checkout URL or
the resulting order. Reusing the key for a changed cart or contract is a
conflict.

The local key is retained with payment history beyond Stripe's provider-key
retention. Each outbound provider mutation uses a stable, non-sensitive key
derived from local attempt/allocation/refund plus operation and contract
version, for example separate keys for session creation, expiry, refund,
transfer, and reversal. A retry never changes parameters under the same key and
never creates a new local resource merely because the provider response was
ambiguous.

Workers claim durable local operations with locking and conditional state
updates, call Stripe outside a long database transaction, then persist the
observed result in a second short transaction. Crashes at either boundary are
recoverable by the same lineage and provider retrieval. No database transaction
is held open across network I/O.

### Refunds, reversals, disputes, and negative balances

Refunds are local commands with their own idempotency key and immutable
allocation. The backend derives the refundable amount from order lines and
prior successful/pending refunds; it never accepts an arbitrary client amount
or seller split. Multiple partial refunds may not exceed any line, seller
allocation, or charge total.

Before transfer, a refund reduces or cancels the affected intended seller
transfer. After transfer, the platform records the seller debt and attempts the
corresponding partial or full transfer reversal. Stripe charge refunds do not
automatically reverse separate transfers, so refund, transfer reversal, and
seller balance recovery are tracked independently. A customer refund approved
under platform policy is not silently cancelled because a seller lacks a
reversible balance; the funded platform reserve covers it and the unrecovered
seller amount becomes an operational/legal collection exception.

The platform owns dispute intake, evidence deadlines, response, and financial
exposure. A dispute immediately holds all unsettled allocations related to the
charge and attempts reversals of affected transfers where permitted. Winning a
dispute does not automatically re-transfer seller funds; the allocation is
re-evaluated. Losing it records the chargeback, fee, seller recovery, and order
support outcome without rewriting the original payment or order snapshots.

Refund, dispute, reversal, transfer failure, connected-account negative
balance, and platform balance shortage states are visible to an authorized
operator and generate sanitized append-only audit evidence. Support actions do
not directly edit provider status or erase failed movements.

### Reconciliation, retention, and testing

A daily one-shot reconciliation worker retrieves the current Stripe objects and
balance transactions needed to compare local successful attempts, charges,
refunds, disputes, transfers, reversals, and payouts. It records append-only
observations and explicit differences: missing/duplicate object, state,
currency, amount, allocation, fee, balance, or stale webhook. Reconciliation
can repair a missed local transition through the same idempotent domain command
but never mutates original monetary snapshots to make a difference disappear.

Payment attempts, attempts lines, allocations, successful and failed money
movements, disputes, reconciliation evidence, and payment audit events are
retained with commerce history. No automatic deletion is authorized until the
Portugal legal, tax, accounting, chargeback, and privacy retention periods are
accepted. Raw signed webhook bodies are verified in memory and are not retained
after the minimized inbox record and required provider snapshot are committed.
Checkout/session URLs and onboarding Account Links are short-lived credentials
and must not be persisted in logs, audit metadata, analytics, or notifications.

Normal automated tests use a fake provider adapter and deterministic fixtures;
they do not call Stripe. A separate Stripe sandbox/test-mode workflow verifies
Checkout redirect, 3DS card success/failure, expiry, duplicated/reordered
webhooks, refunds, disputes, Connect onboarding requirements, transfers,
reversals, insufficient balances, and account restrictions. Stripe test clocks
are used only for provider objects they actually support; local reservation and
transfer clocks remain injectable and deterministic. Test and live keys,
webhook endpoints, connected accounts, data, and reconciliation are isolated.

## Live-mode gates

All payment and payout capabilities default off per tenant, and an independent
kill switch prevents new Checkout Sessions and transfers while still accepting
webhooks, reconciliation, refunds, and support work. Live mode remains disabled
until all of the following are verified:

- the legal/accounting approvals and operator identities in this ADR;
- the deliberate `USD`-to-`EUR` transition and mixed-history contract;
- one production Portugal tenant, approved Portugal sellers, signed terms, and
  Stripe-hosted onboarding/capability completion;
- address, delivery, final review, return/cancellation, seller-specific
  fulfilment, support, invoice/receipt, refund, dispute, and reserve procedures;
- test-mode attempts, reservations, webhook inbox/workers, order conversion,
  allocations, transfers, reversals, reconciliation, audit, and operator views;
- a stable HTTPS webhook deployment, managed secrets, scheduled workers,
  monitoring/alerts, backups/restore, rollback, and incident ownership selected
  through the deployment ADR; and
- a card-only bounded-pilot readiness review with explicit limits, metrics, and
  a rehearsed kill-switch/refund response.

Enabling Checkout does not enable transfers automatically. Enabling cards does
not enable MB WAY or another method automatically. No test-mode success is
evidence that the legal or operational live gates passed.

## Alternatives

### One order or charge per seller

This would simplify destination charges, but it changes one buyer action into
several charges, failures, receipts, and refunds and silently removes the
current multi-seller contract. It is rejected for the first marketplace flow.

### Destination or direct charges

Destination charges fit one connected account per transaction; direct charges
put the charge on a seller account. Neither represents the accepted single
multi-seller cart. Separate charges and transfers is selected despite the
platform's larger refund, dispute, balance, and reconciliation burden.

### Create the order and decrement inventory before redirect

This is the current no-payment behavior. With an external redirect it would
show unpaid orders to sellers and strand inventory on abandonment. A distinct
attempt and reservation is selected; the order begins only after authoritative
payment success.

### Create the order only after redirect success

A browser return can be forged, omitted, or precede a delayed webhook. Redirect
pages therefore display progress only. Authenticated provider state drives
order creation.

### Transfer immediately after payment

Immediate transfer increases refund and dispute recovery risk and precedes
proof of seller fulfilment. A delivered-plus-14-day eligibility hold is
selected for the bounded pilot.

### Automatic currency conversion or relabelling

Changing `USD` labels to `EUR` or applying an exchange rate would fabricate
catalog intent and corrupt immutable history. Deliberate `EUR` product mappings
and mixed historical snapshots are required.

### Custom payment and KYC UI

Elements and API-collected identity data provide more UI control but add
security, accessibility, regulatory, and maintenance scope. Stripe-hosted
Checkout and onboarding are selected for the pilot.

## Provider evidence

The provider-specific assumptions were verified against Stripe's current
official documentation on 2026-07-19:

- [Checkout lifecycle](https://docs.stripe.com/payments/checkout/how-checkout-works)
  documents hosted redirects, webhook fulfilment, and 30-minute-to-24-hour
  configurable expiry.
- [Marketplace charge selection](https://docs.stripe.com/connect/marketplace/tasks/accept-payment)
  selects separate charges and transfers for one charge split across multiple
  connected accounts.
- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
  documents platform-account charges, multiple transfers, platform fees and
  negative-balance exposure, transfer availability, and manual refund/reversal
  reconciliation.
- [Webhook behavior](https://docs.stripe.com/webhooks) requires the raw body for
  signature verification and documents duplicate, delayed, retried, and
  unordered delivery.
- [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests) documents
  parameter comparison and provider key pruning after at least 24 hours.
- [Stripe-hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding)
  documents single-use Account Links, requirement collection, and why a return
  URL does not prove capability completion.
- [Payment-method support](https://docs.stripe.com/payments/payment-methods/payment-method-support)
  and [MB WAY](https://docs.stripe.com/payments/mb-way) document current Checkout,
  Connect, currency, confirmation, refund, and dispute characteristics.

These links are evidence for provider behavior, not delegation of MercadoZetta's
legal, tax, allocation, order, fulfilment, or support decisions to Stripe.

## Required verification before implementation status can change

The later implementation must prove exact amount/allocation invariants,
currency mismatch denial, seller eligibility, reservation concurrency and
expiry races, client and provider idempotency, ambiguous network recovery,
duplicate/out-of-order webhooks, order creation exactly once, no fulfilment
before payment, refund and reversal allocation, dispute holds, transfer timing,
reconciliation differences, tenant/mode isolation, secret rotation, sanitized
audit/log behavior, mixed `USD`/`EUR` history, both brands, and kill-switch
behavior through focused, PostgreSQL, contract, frontend, browser, sandbox, and
operational rehearsal coverage.

## Implementation status

The EUR transition portion is implemented by migration `0008`: it preserves
USD order and price-history snapshots, introduces tenant currency-history
anchors, applies the reviewed CampusMarket EUR mappings, makes unmapped
CampusMarket products non-sellable, and configures that brand for Portugal-first
EUR presentation. MercadoZetta remains USD/`en-US`. Seller revenue reports
count only each tenant's current currency authority and identify priced
historical-currency orders separately.

The payment portion remains decision only. MercadoZetta still has no Stripe SDK
or payment schema and retains its current no-payment checkout. Live payment and
payout capabilities are disabled by absence and remain prohibited until the
gates above pass.
