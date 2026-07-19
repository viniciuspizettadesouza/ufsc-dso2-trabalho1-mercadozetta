# MercadoZetta Improvement Plan

## Goal

Deploy MercadoZetta as a reliable Portugal-first, EUR, multi-tenant and
multi-seller ecommerce MVP that can accept live payments safely for a bounded
pilot. Preserve the white-label demo value while prioritizing only the buyer,
seller, payment, fulfillment, support, legal, and operational capabilities
required for the first real transaction. Defer conversion, personalization,
promotion, and advanced-platform work until pilot evidence justifies it.

## Current Verified State

- Steps 1 through 14 are complete.
- Local development, CI, and Docker target Node.js 24.18.0 LTS. PostgreSQL is
  the sole persistence runtime, with reviewed Drizzle migrations and
  tenant-qualified repository boundaries.
- Cookie sessions are the sole authentication transport. Rotation, replay
  protection, CSRF, credentialed CORS, revocation, signing-key overlap, tenant
  isolation, and browser renewal behavior are implemented and tested.
- Checkout and refresh rotation use short PostgreSQL transactions with locking
  and conditional updates. Commerce ownership, inventory, fulfillment, session,
  and audit invariants are enforced by backend services and database constraints.
- The API uses Zod-backed validation and OpenAPI metadata, shared contract types,
  bounded pagination, domain Axios services, and React Query domain hooks.
- Buyer, seller, notification, account-management, recovery, catalog,
  product-management, and checkout workflows expose tested pending, success,
  error, accessibility, and tenant-brand behavior.
- Structured redacted logging, append-only audit events, health/readiness checks,
  non-root production images, production Compose smoke coverage, and documented
  deployment procedures form the current operational baseline.
- Versioned migrations, compatibility rules, lifecycle cleanup, backup/restore
  documentation, and a PostgreSQL recovery rehearsal cover the current database
  evolution baseline.
- Retry-sensitive checkout, product creation, and review mutations use persisted
  actor/tenant-scoped idempotency keys and request fingerprints. Exact retries
  replay stored results and conflicting reuse is rejected.
- Seller operations include tenant-scoped quantity and order summaries,
  low-stock warnings, inventory history, order search/filtering, and exact gross
  revenue from non-cancelled priced line snapshots. Priced and legacy-unpriced
  order counts make the excluded historical population explicit.
- Free-text categories remain intentionally: the Step 13 review found no current
  hierarchy, governance, or cross-channel discovery requirement for managed
  taxonomy.
- Step 14's monetary contract is accepted in
  [ADR 0006](docs/decisions/0006-authoritative-money.md): each tenant has one
  backend-authoritative currency; exact amounts use bounded integer minor
  units, backend `bigint`, and decimal strings on JSON boundaries. Existing
  orders are explicitly legacy-unpriced rather than assigned fabricated
  revenue.
- The Step 14 expand migration adds authoritative tenant currency, bounded
  nullable product prices, constrained legacy/priced order and line shapes,
  immutable monetary snapshots, and append-only tenant-scoped product price
  history. A clean eight-migration PostgreSQL run, all 31 integration scenarios,
  and the updated backup/restore rehearsal verify the expansion without
  backfilling fabricated amounts.
- Product create/update APIs now require canonical exact USD prices, expose
  decimal-string minor units, and append initial or changed prices atomically.
  Exact retries do not duplicate products or price-history entries; unchanged
  price updates do not create false history. Both tenant demo catalogs have
  deliberate USD prices, and catalog/detail/product-management UI parses and
  formats those amounts without binary floating-point arithmetic.
- Checkout locks tenant product rows, rejects absent or overflowing prices,
  computes line subtotals and order subtotal/zero discount/zero shipping/total
  with `bigint`, and persists immutable priced snapshots atomically with
  inventory and idempotency effects. Exact replay returns the original snapshot
  after later product price changes. Legacy orders remain visibly unpriced.
- Buyer cart/order UI displays exact quotes and stored totals. Seller order
  responses suppress other sellers' lines and buyer whole-order totals, while
  seller operations aggregate only owned immutable lines and exclude cancelled
  and legacy-unpriced orders from gross revenue.
- Final Step 14 verification passes generated-contract parity, typecheck, 258
  backend tests across 51 files, 193 frontend tests across 41 files, lint,
  formatting, both coverage gates, the frontend and production builds, all 31
  PostgreSQL scenarios, both Chromium workflows, the production-image smoke,
  and the eight-migration recovery rehearsal.
- Latest Step 13 verification passes generated-contract parity, typecheck, 252
  backend tests across 51 files, 189 frontend tests across 40 files, lint,
  formatting, both coverage gates, frontend and production builds, all 29
  PostgreSQL scenarios, both Chromium workflows, the seven-migration recovery
  rehearsal, and the production-image smoke.

## Next Action

Start Step 15 by accepting a payment and marketplace-funds ADR before adding a
Stripe SDK or payment schema. Use Stripe Checkout Sessions with the
Stripe-hosted checkout as the first payment UI and Stripe Connect as the target
marketplace boundary. Treat Portugal and the EEA as the first launch context,
with EUR as the target live currency and the United States as a possible later
expansion. Preserve the current multi-seller cart: model one platform charge
with seller allocations and, before accepting live money, Stripe Connect
separate charges and transfers rather than silently constraining checkout to
one seller or treating sellers as ordinary platform users.

The ADR must settle the merchant-of-record and platform-fee assumptions, target
country and authoritative tenant currency, order/inventory behavior while a
redirected payment is pending, payment attempts, webhook authority,
idempotency, reconciliation, refunds, disputes, seller onboarding, transfer
timing, and the boundary between payment, order, and fulfillment state. Base
amounts on the immutable exact totals accepted in
[ADR 0006](docs/decisions/0006-authoritative-money.md). Keep all live payment
and payout capabilities disabled until the later Stripe Connect and launch
readiness gates are complete. The current USD catalog and immutable USD order
history remain the verified baseline until a reviewed expand/migrate/contract
change deliberately prices active products in EUR; never relabel historical
amounts or reinterpret their currency.

## Completed Roadmap History

The detailed chronological handoff and completed Steps 1–14 are archived in
[docs/improvement-plan-history.md](docs/improvement-plan-history.md).
`PROJECT_IMPROVEMENT_PLAN.md` remains the source of truth for the current state,
next action, and active roadmap.

## Remaining Roadmap

Steps 15 through 20 are the launch-critical path for the first sellable MVP.
Steps 21 onward are post-MVP work and must not delay the bounded pilot unless
verification exposes a launch risk. The complete inventory of implemented,
partial, missing, deferred, and exploratory user-facing ideas is maintained in
[Product Feature Ideas](docs/product-feature-ideas.md). Agents must consult that
catalog when starting a product feature phase, but an entry there does not
authorize implementation or override the `Next Action` above.

### Roadmap decisions for the first sellable version

- Stripe is the selected payment provider for a Portugal/EEA-first marketplace.
  Stripe is available in Portugal, Stripe Checkout is the lowest-maintenance
  first payment UI, and Stripe Connect supports routing one customer charge to
  multiple connected sellers through separate charges and transfers. Keep a
  provider-neutral local payment model so provider state does not become the
  order model.
- EUR is the target live currency. The current authoritative USD catalog is
  development history, not the intended Portuguese launch contract. Migrate
  deliberately: preserve immutable USD orders and price active catalog items in
  EUR through reviewed product/tenant changes rather than applying a fabricated
  conversion or changing currency labels.
- Start with cards as the minimum Portuguese EUR payment method. Treat
  dynamically eligible wallets and MB WAY as pilot candidates, and evaluate
  Multibanco, SEPA Direct Debit, PayPal, and other EEA methods separately against
  Checkout, Connect, refund, dispute, settlement, delayed-confirmation, and
  multi-seller requirements before enabling them.
- The United States remains a possible later market with its own USD tenant or
  explicit regionalization phase. Do not mix US tax, address, payment, shipping,
  or legal assumptions into the first Portuguese release.
- The first Stripe milestone uses test mode and a Stripe-hosted page. Live
  payments remain disabled until seller onboarding, payout allocation, refunds,
  disputes, legal ownership, support, observability, and operational runbooks
  pass their gates.
- Address, delivery choice, a clear cart, and a final order review precede live
  payment activation. Payment infrastructure alone does not make the checkout
  useful to a buyer.
- The first live release is a bounded Portuguese pilot: one production tenant,
  an explicitly approved seller cohort, Portugal delivery addresses, EUR-only
  sellable inventory, a documented support owner, and live payments behind a
  tenant feature flag and kill switch. Expand tenants, sellers, countries, or
  payment methods only after the pilot is reconciled and supportable.
- Cards are the minimum launch payment method. Enable dynamically eligible
  wallets and MB WAY only after their Checkout, Connect, refund, dispute, and
  webhook behavior passes the same gate; their absence does not block a small
  card-only pilot when the available methods are communicated accurately.
- Measure the pilot by completed and failed payment attempts, checkout
  conversion, fulfilled orders, cancellations/refunds, unreconciled money
  movements, support incidents, and time to resolve operational exceptions.
  Do not add growth features before these signals are observable.
- AI search, image search, AI chat, PWA, voice search, 360-degree media,
  loyalty, subscriptions, social proof counters, and gift lists stay outside
  the first sellable version until measured demand justifies them. Scarcity and
  activity indicators must never be fabricated.

Research basis: [Stripe Checkout](https://docs.stripe.com/payments/checkout),
[Stripe marketplace charge selection](https://docs.stripe.com/connect/marketplace/tasks/accept-payment),
[Stripe separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers),
[Stripe webhook behavior](https://docs.stripe.com/webhooks),
[Stripe global availability](https://stripe.com/global),
[Stripe payment-method support](https://docs.stripe.com/payments/payment-methods/payment-method-support),
[Stripe MB WAY](https://docs.stripe.com/payments/mb-way), and
[Stripe Connect cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts).

### 15. Accept the Stripe payment and marketplace-funds contract

- [ ] Record Portugal/EEA and EUR as the first launch context, then settle the
      legal entity and account country, merchant of record, platform fee, VAT
      and invoice responsibility, seller payout responsibility, refund and
      dispute liability, supported seller countries, and whether live
      multi-seller commerce is legally and operationally in scope. Do not infer
      these decisions from the provider API.
- [ ] Accept an amendment or successor to ADR 0006 for the USD-to-EUR product
      transition. Preserve every immutable USD order snapshot, assign deliberate
      EUR prices to active products, update both demo tenants and brand locales,
      and cover mixed historical currencies without pretending to perform
      foreign-exchange conversion.
- [ ] Select Stripe Checkout Sessions with Stripe-hosted Checkout for the first
      payment UI and Stripe Connect separate charges and transfers for the
      existing multi-seller cart. Use Stripe-hosted seller onboarding to reduce
      KYC maintenance; do not build custom collection of identity documents.
- [ ] Select cards as the minimum Portuguese payment-method scope. Record the
      eligibility and behavioral differences for dynamically eligible wallets
      and MB WAY before deciding whether each joins the pilot, especially
      asynchronous confirmation, refunds, disputes, Connect support, and
      inability to reuse a method. Apply the same review before adding
      Multibanco, SEPA Direct Debit, PayPal, or other EEA-local methods.
- [ ] Define provider-neutral payment attempts, seller allocations, transfers,
      refunds, disputes, reconciliation observations, and append-only audit
      evidence. Store Stripe identifiers as external references, not as domain
      primary keys.
- [ ] Keep payment state separate from order and fulfillment state. Define
      precisely when an order is created, when inventory is reserved or
      decremented, how abandoned or expired Checkout Sessions release stock,
      and which payment facts permit fulfillment.
- [ ] Treat authenticated Stripe webhooks as authoritative for asynchronous
      completion. Define signature verification over the raw request body,
      event deduplication, object-level idempotency, retrieval of current
      provider state, and safe handling of duplicate, delayed, and out-of-order
      events.
- [ ] Define one idempotency lineage from the buyer checkout command to the local
      payment attempt and Stripe Checkout Session. Never trust client-submitted
      currency, totals, seller allocation, success redirects, or payment state.
- [ ] Define refund allocation, transfer reversal, negative-balance, dispute,
      reconciliation, retention, secret rotation, and test-clock/test-mode
      expectations before schema or SDK work begins.

### 16. Complete the buyer checkout foundation

- [ ] Separate the current combined checkout screen into a persistent cart,
      final checkout review, and buyer order history. Add a visible cart count
      without duplicating server state. Keep the dedicated favorites page and
      favorites count outside the launch-critical path.
- [ ] Add tenant/user-scoped delivery addresses, a default address, validation,
      explicit deletion behavior, and an immutable order-time address snapshot.
      Record the personal-data purpose, retention, export, redaction, and account
      deactivation rules.
- [ ] Add delivery options and authoritative shipping quotes with delivery
      estimates. Start with a deterministic adapter suitable for the demo; keep
      carrier-specific APIs behind a contract and do not claim live estimates
      until an actual carrier supplies them.
- [ ] Extend the authoritative total with selected shipping and only validated
      discounts. Re-price on the backend immediately before payment and surface
      stock or price changes without discarding the buyer's cart.
- [ ] Provide a final review of lines, quantities, address, delivery estimate,
      subtotal, discount, shipping, and total. Make every pending, recovery,
      validation, and API-error state keyboard and screen-reader usable.
- [ ] Finish the user-visible password-reset and email-verification flows with a
      development delivery sink. Step 19 must activate reliable production
      delivery before live payment makes account recovery operationally
      required.

### 17. Implement the Stripe test-mode payment MVP

- [ ] Add the official server-side Stripe SDK only after the ADR is accepted.
      Pin its version and API version, keep the secret key server-only, expose
      only a publishable key when needed, document webhook secrets separately,
      and add validated environment examples.
- [ ] Add the local payment-attempt schema and migrations with tenant, buyer,
      order/checkout, authoritative amount, provider, external references,
      bounded states, timestamps, failure category, and idempotency lineage.
      Do not store card numbers, CVC, Checkout client secrets, or webhook
      payloads containing unnecessary personal data.
- [ ] Create or reuse one Stripe Checkout Session from backend-authoritative
      order facts and an idempotency key. Use hosted Checkout return/cancel URLs,
      but never mark a payment successful from a browser redirect.
- [ ] Mount the Stripe webhook route with raw-body signature verification before
      JSON parsing. Persist event claims transactionally, acknowledge duplicates,
      retrieve provider objects when ordering is insufficient, and make local
      transitions monotonic and replay-safe.
- [ ] Coordinate payment completion, failure, expiration, order visibility, and
      inventory reservation/release without using the order-status enum as a
      payment state. Add bounded cleanup for abandoned attempts and reservations.
- [ ] Add buyer payment-status and retry UI that reuses eligible attempts,
      prevents conflicting checkout actions, and never exposes secrets or
      provider-only error details.
- [ ] Cover exact retry, changed cart, changed price, insufficient stock,
      concurrent checkout, declined payment, authentication-required payment,
      expired session, duplicate/out-of-order webhook, forged signature,
      cross-tenant access, redirect spoofing, and recovery after partial failure.
- [ ] Keep this milestone in Stripe test mode. Add deterministic local tests and
      a separately gated Stripe CLI sandbox workflow; the normal test suite must
      not depend on the public Stripe service.

### 18. Add Stripe Connect seller onboarding and multi-seller settlement

- [ ] Add a tenant/seller-scoped connected-account record and Stripe-hosted
      onboarding links. Expose requirements, charges capability, transfers
      capability, and payouts readiness without copying sensitive KYC data into
      MercadoZetta.
- [ ] Prevent live sale of a seller's products when the agreed payment/payout
      capability policy is not satisfied. Define behavior for mixed carts when
      a seller becomes restricted between cart creation and payment.
- [ ] Persist immutable per-seller allocation snapshots for every priced order,
      including gross line amount, discounts, shipping allocation, platform fee,
      refundable amount, transferred amount, and currency invariants.
- [ ] Implement separate charges and transfers using a stable transfer group.
      Transfer only after the accepted fulfillment boundary, make transfer
      creation idempotent, and support partial transfer reversal for refunds.
- [ ] Reconcile local attempts, charges, balances, transfers, refunds, disputes,
      and connected-account restrictions. Surface actionable exceptions to
      operators without allowing a provider webhook to cross tenant boundaries.
- [ ] Cover one-seller and multi-seller carts, rounding allocation, partial
      seller fulfillment, restricted accounts, duplicate transfers, failed
      transfers, refunds before/after transfer, disputes, negative balances,
      delayed events, and manual reconciliation.
- [ ] Add test-mode browser workflows for buyer payment and seller onboarding.
      Live mode remains blocked until Step 20 launch readiness is complete.

### 19. Complete the minimum post-sale, communication, and support workflows

- [ ] Model shipments separately from orders, including seller ownership,
      address snapshot, carrier, service, tracking identifier, fulfillment state,
      timestamps, and partial shipment because a multi-seller order naturally
      has independently fulfilled seller groups.
- [ ] Give buyers a dedicated order-detail page with payment state, shipment
      state, status history, delivery estimate, tracking link when verified, and
      explicit help/cancellation actions.
- [ ] Define cancellation and inventory replenishment at every unpaid, paid,
      allocated, transferred, shipped, and delivered boundary. Coordinate
      cancellation with Stripe refund and transfer reversal records without
      rewriting immutable history.
- [ ] Support a bounded buyer return request and operator-controlled full-order
      or full-line refund with auditable reasons, Stripe refund records, seller
      allocation updates, and transfer reversal where required. Document the
      manual dispute procedure. Defer exchanges and partial-quantity refunds
      until their accounting behavior is proven after the pilot.
- [ ] Add a transactional outbox and production email adapter for account
      verification/recovery, payment, order confirmation, cancellation, refund,
      and shipment events. Define idempotency, bounded retry, failed-delivery
      visibility, suppression, and a development sink without requiring Redis
      or a general-purpose queue prematurely.
- [ ] Add the minimum privileged, tenant-scoped operator workflows needed to
      inspect reconciliation exceptions, issue refunds, reverse transfers,
      respond to disputes, and handle connected-account restrictions. Require
      appropriate reauthentication, audit every sensitive mutation, and cover
      denial and cross-tenant cases.
- [ ] Publish reviewed tenant-aware delivery, return/refund, privacy, terms,
      contact/support, legal-identity, seller-fee, payment-method, and
      accessibility information. Record VAT and invoice responsibility from the
      accepted operating model; do not publish placeholder legal claims.
- [ ] Tighten verified-review eligibility to delivered, non-refunded purchases
      and show the verified status to buyers.
- [ ] Cover buyer, seller, support, cross-tenant, concurrency, retry, audit,
      notification, partial fulfillment, and partial-failure behavior.

### 20. Pass the Stripe live-payment readiness gate

- [ ] Complete Stripe platform and connected-account test-mode verification,
      business/KYC requirements, terms, privacy, refund/cancellation, delivery,
      prohibited-products, VAT/invoice responsibility, dispute, support,
      accessibility, and merchant-of-record review for Portugal and intended EEA
      seller/customer countries. Obtain qualified legal/accounting advice where
      the platform business model requires it.
- [ ] Verify that the EUR migration is complete for every sellable product and
      both checked-in brands while historical USD orders remain readable and
      correctly labelled. Do not permit a cart, order, Stripe Session, seller
      allocation, transfer, or refund to mix currencies.
- [ ] Verify cards, eligible wallets, and MB WAY in Stripe test mode for the
      Portuguese buyer journey and Connect funds flow where each method is in
      pilot scope. Cards are the minimum. Enable wallets, MB WAY, and each
      additional European payment method independently only after its
      eligibility, settlement, cancellation, refund, dispute, and webhook
      behavior passes.
- [ ] Verify production secrets, restricted keys where supported, API-version
      pinning, webhook endpoint registration, signature-secret rotation,
      least-privilege access, log redaction, retention, backups, and recovery.
- [ ] Add payment metrics and alerts for attempts, conversion, failures,
      webhook age/backlog, reconciliation differences, refunds, disputes,
      transfer failures, connected-account restrictions, and inventory
      reservations approaching expiry.
- [ ] Provision the real production domain, HTTPS termination, managed secrets,
      authenticated and encrypted PostgreSQL storage, immutable application
      images, scheduled cleanup/outbox/reconciliation/reservation-expiry jobs,
      centralized logs, retention, and automated backups whose restore path has
      been rehearsed in the target environment.
- [ ] Add a Stripe-compatible frontend Content Security Policy, explicit request
      size limits including the webhook route, dependency and secret scanning,
      container-image scanning, payment-aware abuse controls, and a documented
      vulnerability-response owner.
- [ ] Write and rehearse runbooks for webhook outage, provider outage, uncertain
      payment, reconciliation mismatch, refund/transfer failure, dispute,
      credential compromise, connected-account restriction, and rollback.
- [ ] Run sandbox end-to-end, concurrency, failure, recovery, accessibility,
      production-image, backup/restore, and load checks. Enable live mode behind
      a tenant feature flag with a bounded rollout and an immediate kill switch.
      Start with the accepted tenant, seller cohort, address region, and payment
      methods; record pilot metrics and reconcile the first live transactions
      before expanding scope.

## Post-MVP Roadmap

The following phases begin only after Step 20 passes and the bounded pilot is
deployed. They may be promoted earlier only when pilot evidence or a verified
launch risk makes them necessary.

### 21. Improve product discovery and catalog conversion

- [ ] Add managed category navigation only when a deliberate category hierarchy
      is accepted; until then, expose consistent category/subcategory facets from
      current data without pretending free text is a governed taxonomy.
- [ ] Add backend-backed minimum/maximum price filters and price sorting, then
      rating filters and sorting after review aggregates exist. Keep pagination
      stable and indexed.
- [ ] Improve search with normalized terms, typo tolerance, synonyms,
      autocomplete, useful empty states, and measured relevance. Add SKU only if
      the product model gains a real seller/customer SKU requirement.
- [ ] Add review aggregates to catalog cards and product detail, including
      average, count, distribution, verified marker, and filter by rating.
- [ ] Add related products using explainable category/subcategory signals before
      considering personalized or AI recommendations.

### 22. Complete product detail, trust, and convenience

- [ ] Add a product gallery, zoom, quantity selector, explicit buy-now path,
      stock messaging, share/copy-link action, delivery estimate, return summary,
      seller identity, and support contact without inventing guarantees or trust
      seals.
- [ ] Add structured specifications, brand, dimensions, weight, warranty, and
      variants only through accepted product-model requirements. Do not add
      empty decorative fields merely to match a generic ecommerce checklist.
- [ ] Add product questions and answers only with moderation, notification,
      authorization, abuse-control, and seller-response workflows.
- [ ] Add recently viewed and buy-again convenience with explicit retention and
      privacy behavior. Measure use before adding personalized recommendations.

### 23. Add promotions only after checkout and refunds are stable

- [ ] Accept a promotion contract covering coupon ownership, eligibility,
      stacking, allocation across sellers, expiry, usage limits, concurrency,
      cancellation, refund, tax, and immutable order snapshots.
- [ ] Start with one bounded capability such as fixed/percentage coupons or a
      free-shipping threshold. Recalculate on the backend and display the exact
      reason when a promotion becomes invalid.
- [ ] Add scheduled prices, progressive discounts, bundles, cashback, points,
      flash sales, and loyalty only in response to a concrete product need and
      after their multi-seller accounting and refund behavior is defined.

### 24. Expand asynchronous communication and account delivery

- [ ] Add tenant-aware notification preferences and explicit transactional,
      security, marketplace, and optional-message categories. Users may not
      disable legally or operationally required messages.
- [ ] Extend the MVP outbox and email delivery with richer localization,
      templates, bounce/complaint automation, replay tooling, and delivery
      analytics where pilot operations demonstrate a need.
- [ ] Introduce a queue, Redis, or managed equivalent only when measured volume
      or additional retryable work exceeds the bounded database-backed delivery
      design. Define retry bounds, dead letters, replay, cleanup, scaling, and
      operational ownership first.
- [ ] Add abandoned-cart reminders only with consent, frequency limits,
      unsubscribe behavior, and measured value. Defer SMS, WhatsApp, and push
      until a supported user communication requirement exists.

### 25. Expand administration and support for active commerce workflows

- [ ] Expand the minimum launch operator workflows only for demonstrated payment
      reconciliation, refund, dispute, seller restriction, fulfillment, return,
      moderation, or user-support needs. Do not build a general-purpose admin
      panel without defined privileged use cases.
- [ ] Enforce tenant-scoped permissions in backend services, require recent
      authentication for sensitive actions, and invalidate stale sessions when
      privilege changes require it.
- [ ] Audit all privileged reads and mutations where appropriate and add
      negative authorization, cross-tenant, stale-session, dual-action,
      concurrency, and browser-level tests.

### 26. Improve mobile, accessibility, performance, and transparency

- [ ] Establish Web Vitals and representative low-end mobile budgets before
      claiming fast loading. Add route splitting, image dimensions/responsive
      formats, lazy loading, cache headers, and CDN/object storage only where
      measurement identifies value.
- [ ] Run the existing keyboard, 320-pixel, zoom, reduced-motion, screen-reader,
      contrast, and Axe checks across the new cart, checkout, hosted-payment
      handoff, order, return, seller-onboarding, and support workflows.
- [ ] Maintain and localize the launch transparency pages as the supported
      brands, sellers, countries, delivery options, and policies expand.
- [ ] Evaluate PWA installability and offline behavior only after analytics show
      repeat mobile use that a PWA would materially improve.

### 27. Scale production operations and security

- [ ] Add service metrics, distributed tracing where it answers a measured need,
      service-level objectives, dashboards, and actionable alerts across
      checkout, payments, webhooks, fulfillment, messaging, and recovery.
- [ ] Replace process-local rate limiting when horizontal deployment requires a
      shared abuse-control boundary. Add payment-aware abuse and fraud signals
      without treating provider risk decisions as the only authorization layer.
- [ ] Scale the Step 20 scheduling, encrypted storage, database authentication,
      secret management, backups, scanning, and recovery controls as traffic,
      worker concurrency, provider count, and operational ownership grow.
- [ ] Add representative load, capacity, provider degradation, failure,
      deployment, rollback, and recovery tests before increasing production
      scale.

## Dependency and Security Guardrails

- Libraries are allowed whenever they address a concrete requirement more
  safely, clearly, or maintainably than project-owned code. Before adding one,
  evaluate maintenance activity, security history, transitive dependencies,
  runtime and bundle impact, license, compatibility, deployment requirements,
  and whether the project can test and operate the resulting boundary.
- Prefer established libraries and provider SDKs for generic infrastructure such
  as exact monetary arithmetic, payment protocols, queues, telemetry, metrics,
  email delivery, and security primitives. Keep tenant isolation, authorization,
  order, inventory, idempotency, and lifecycle rules explicit in project-owned
  domain services and database constraints.
- Pin accepted versions through the lockfile, place packages in the correct
  runtime or development dependency set, audit them, and add focused tests for
  the integration boundary. Record an ADR when a dependency materially affects
  persistence, security, deployment, or operational ownership.
- Do not add Redux Toolkit or Zustand unless substantial client-only shared
  state appears; remote marketplace state belongs in TanStack Query.
- Do not migrate to Next.js, NestJS, or Fastify without a measured product or
  operational requirement. Treat the planned PostgreSQL migration as a gated
  phase: accept its database ADR and tooling spike before adding Prisma, Drizzle,
  or another data-access dependency or changing production persistence.
- Do not add Redis or BullMQ until the project has retryable asynchronous work
  such as production email delivery, image processing, or webhooks.
- Keep Tailwind as the UI foundation unless a planned redesign justifies a
  component library. Avoid dependencies for operations supported clearly by
  the platform or native JavaScript.
- Add explicit request-size limits, production Content Security Policy, safe
  image handling, abuse controls for sensitive mutations, dependency scanning,
  and container-image scanning as their related production phases are
  implemented.
- Never treat client-side route guards, hidden controls, or tenant headers as
  authorization. Enforce tenant ownership and permissions in backend services.

## Definition of Done

- `npm test` passes from the repository root.
- `npm run lint` passes from the repository root.
- `npm run format:check` passes from the repository root.
- `npm --prefix frontend run build` passes.
- Production images build and pass their documented smoke checks for deployment
  or container changes.
- `npm run test:coverage` passes for behavior or coverage-sensitive changes.
- New scenarios are added to the focused test file associated with their source
  module; aggregate files remain limited to integration, contract, routing, or
  genuine workflow tests.
- Tenant-owned reads and writes remain tenant-scoped.
- Privileged and ownership-sensitive operations are authorized by the backend,
  with denial and cross-tenant cases covered by tests.
- List endpoints have documented, bounded result sizes and database-backed
  filtering and sorting.
- Default MercadoZetta and CampusMarket branding continue to work.
- Important workflows remain keyboard-usable and pass the project's automated
  accessibility checks.
- Request or response changes update Zod schemas, typed OpenAPI metadata, and
  the generated contract.
- Retry-sensitive mutations are idempotent when their phase introduces that
  guarantee.
- Database and index changes include a repeatable upgrade and rollback plan.
- Logs, errors, audit events, and test artifacts do not expose credentials,
  tokens, cookies, secrets, or unnecessary personal data.
- Configuration, behavior, and operational changes update the relevant docs.
