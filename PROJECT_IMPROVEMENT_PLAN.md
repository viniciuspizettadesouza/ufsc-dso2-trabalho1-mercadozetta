# MercadoZetta Improvement Plan

## Goal

Keep MercadoZetta reliable, easy to run, and useful as a white-label
marketplace demo while evolving persistent commerce workflows safely.

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

Start Step 15 by accepting a provider-neutral payment ADR before adding any SDK
or schema. Define payment attempts, authorization, capture, failure,
cancellation, refund linkage, reconciliation, idempotency, authenticated
callbacks, audit evidence, and the boundary between payment state and existing
order/fulfillment state. Base the proposal on the now-immutable exact order
totals in [ADR 0006](docs/decisions/0006-authoritative-money.md), and keep
provider selection and implementation outside the decision slice.

## Completed Roadmap History

The detailed chronological handoff and completed Steps 1–14 are archived in
[docs/improvement-plan-history.md](docs/improvement-plan-history.md).
`PROJECT_IMPROVEMENT_PLAN.md` remains the source of truth for the current state,
next action, and active roadmap.

## Remaining Roadmap

### 15. Model payments as a separate domain

- [ ] Accept a provider-neutral payment contract before selecting or activating
      a payment provider SDK. Define attempts, authorization, capture, failure,
      cancellation, refund linkage, reconciliation, and audit behavior.
- [ ] Keep payment state separate from order and fulfillment state; do not extend
      the order-status enum to represent payment processing.
- [ ] Authenticate provider callbacks, make webhook processing idempotent, and
      handle duplicate, delayed, and out-of-order events safely.
- [ ] Add reconciliation, operational visibility, tenant isolation, and tests for
      failed, concurrent, retried, and partially completed payment workflows.

### 16. Add physical fulfillment when product scope requires it

- [ ] Model delivery addresses with an immutable order-time snapshot and an
      explicit personal-data retention policy.
- [ ] Model shipments separately from orders, including carrier, tracking,
      fulfillment state, timestamps, and optional partial shipment only when a
      concrete requirement justifies it.
- [ ] Define cancellation and inventory-replenishment rules for every relevant
      order, payment, and fulfillment boundary.
- [ ] Keep authorization tenant-scoped and cover buyer, seller, cross-tenant,
      concurrency, audit, and notification behavior.

### 17. Add post-sale workflows

- [ ] Model returns, refunds, and disputes as distinct domain workflows with
      reasons, evidence, deadlines, actors, and explicit state transitions.
- [ ] Coordinate refund records with the payment domain without rewriting
      immutable order, payment, inventory, or audit history.
- [ ] Define seller, buyer, and future support permissions in backend services
      and cover denial, retry, concurrency, and partial-failure behavior.

### 18. Add asynchronous communication and delivery

- [ ] Add tenant-aware user notification preferences and explicit transactional,
      security, and optional-message categories.
- [ ] Add a transactional outbox so committed domain mutations cannot lose their
      corresponding asynchronous messages.
- [ ] Activate provider adapters for account and marketplace email only after
      delivery configuration, secret management, retry, suppression, and
      observability requirements are defined.
- [ ] Introduce a queue, Redis, or a managed equivalent when retryable background
      work exists; define idempotency, retry bounds, dead-letter handling, cleanup,
      and operational ownership before production activation.

### 19. Add administration and support only for concrete workflows

- [ ] Define support and privileged administration use cases before introducing
      roles or a privileged surface.
- [ ] Enforce tenant-scoped permissions and ownership in backend services and
      invalidate stale sessions when privilege changes require it.
- [ ] Audit all privileged mutations and add negative authorization,
      cross-tenant, stale-session, and browser-level workflow tests.

### 20. Complete advanced production operations

- [ ] Add service metrics, distributed tracing where it answers a measured need,
      service-level objectives, dashboards, and actionable alerts.
- [ ] Replace process-local rate limiting when horizontal deployment requires a
      shared abuse-control boundary.
- [ ] Provision and verify production scheduling for cleanup and backups,
      encrypted backup storage, database authentication, secret management, and
      provider-specific recovery automation.
- [ ] Add an explicit frontend Content Security Policy, explicit request-size
      limits, dependency and secret scanning, container-image scanning, and a
      documented vulnerability-response process.
- [ ] Add representative load, capacity, failure, deployment, and recovery tests
      before increasing production scale.

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
