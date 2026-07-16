# MercadoZetta Improvement Plan

## Goal

Keep MercadoZetta reliable, easy to run, and useful as a white-label
marketplace demo while evolving the new persistent commerce workflows safely.

## Verified Handoff

- Local development, CI, and Docker target Node.js 24.18.0 LTS. Backend and
  frontend use the lockfile-installed TypeScript 6.0.3 compiler and backend uses
  `@types/node` 24.13.3.
- TypeScript 7 is deferred until `typescript-eslint` publishes a compatible
  release; version 8.63.0 and its current canary support TypeScript only through
  versions earlier than 6.1.0.
- Backend has 242 tests across 35 files and passes the 85% branch threshold with
  87.19%. Frontend has 85 tests across 12 files and passes its 90% branch
  threshold with 90.60%. Type checks, tests, lint, formatting, OpenAPI
  generation, coverage, and the production build pass.
- Checkout commits order creation, items, conditional inventory decrements, cart
  clearing, and notifications in one transaction. Dockerized MongoDB uses a
  single-node replica set so local behavior matches this requirement.
- A separate `npm run test:integration` lane builds an ephemeral MongoDB 7
  replica set, runs 11 database-backed tests across 5 files against the real
  Express app and Mongoose models, and cleans up its isolated Compose project
  and database deterministically.
- Database-backed tests verify atomic checkout and rollback, cart and
  watchlist persistence, order visibility and fulfillment, verified-purchase
  reviews, notifications, tenant and compound-index isolation, token-version
  logout revocation, repeatable non-destructive demo seeding, session login and
  restoration, atomic refresh rotation, bounded concurrency, replay-family
  revocation, tenant isolation, and idle and absolute expiry.
- Shared authenticated route protection now redirects anonymous visitors from
  `/checkout`, `/products/new`, and `/admin` to login with a route-specific
  prompt, then returns them to the requested route after successful sign-in.
  Catalog, product detail, seller, login, and registration routes remain public.
- Buyer and seller workflow UI is complete. Cart, watchlist, review, and
  order actions expose loading, success, and API error states; checkout supports
  quantity editing and item removal and prevents orders with unavailable
  inventory; authenticated sellers have a dedicated order view with scoped line
  items and fulfillment actions.
- Notifications support tenant-scoped read/unread updates and a resilient header
  unread count. Orders enforce seller progression from placed through confirmed,
  shipped, and delivered; buyers can cancel only placed or confirmed orders.
  Status history records the actor and timestamp for buyer and seller views.
- The authentication transport and renewal contract is accepted in
  `docs/decisions/0001-cookie-sessions.md`. It defines host-only cookie scope,
  CSRF and CORS rules, tenant-scoped rotating session families, lifetime and
  concurrent-refresh behavior, revocation semantics, and signing-key overlap.
- The backend cookie/session workflow is the sole authentication transport:
  login issues host-scoped cookies and returns only public user/session data, protected requests accept
  active cookie sessions, refresh uses atomic hashed rotation with a bounded
  concurrency response and replay-family revocation, CSRF and credentialed CORS
  are explicit, and current, individual, and all-session revocation are wired.
- The React frontend now uses credentialed Axios requests, sends the readable
  CSRF proof on mutations, keeps identity only in memory, restores it through
  `GET /auth/session`, shares one bounded refresh across concurrent failures,
  coordinates refresh completion between tabs when available, and retries an
  original request at most once. Frontend source no longer reads or writes
  authentication data in `localStorage` or constructs Bearer headers.
- All authenticated product and commerce mutations apply the Origin and signed
  double-submit CSRF middleware after cookie authentication; there is no
  alternate transport or CSRF bypass.
- Focused unit and contract tests pass for cookie flags, login response safety,
  access validation, Origin/CSRF rejection, expiry, rotation, replay,
  concurrency, tenant scoping, revocation, and failed frontend renewal. The
  expanded database-backed integration lane passes all 11 tests and cleans up
  its containers and isolated network successfully. Commerce updates use the
  current Mongoose `returnDocument: 'after'` option without deprecation warnings.
- The root `npm run test:e2e` lane builds an isolated, deterministically seeded
  MongoDB/backend/frontend stack and runs Chromium through protected-route
  return, login, exact cookie flags, access renewal, no persistent browser auth,
  logout, tenant-scoped registration, buyer checkout with inventory decrement,
  seller fulfillment through delivery, and buyer notification read state. Its
  two tests use isolated browser contexts where required; containers, network,
  and database are cleaned up on exit, and Playwright artifacts are ignored.
- Axe checks run within those deterministic workflows against protected login,
  registration, checkout, seller orders, and buyer notifications. The forms use
  main landmarks, level-one headings, explicit labels, and autocomplete hints,
  and the default action color meets the detected WCAG AA contrast requirement.
  CI installs only Chromium and runs the complete browser lane before the
  production smoke lane.
- The non-root backend and frontend development images own their application
  directories and Vite optimizer caches, allowing Vitest and the browser stack
  to bundle temporary configuration and optimize dependencies without granting
  write access to the full dependency trees.
- JWT access cookies now carry a configured `kid`; signing and verification use
  a bounded local key ring. Refresh hashes persist their secret version and CSRF
  proofs encode theirs, allowing retained old versions during rotation. Startup
  validates all three rings, and focused, database-backed, and browser tests use
  active/previous configurations successfully.
- Transitional token response fields, Bearer parsing, its CSRF bypass, Bearer
  OpenAPI schemes, single-secret deployment variables, and Authorization CORS
  allowance are removed. Mocked and database-backed backend request tests now
  use active cookie sessions; the complete authentication phase is verified.
- Multi-stage production images compile and run the backend output and serve the
  built frontend from Nginx. Production application containers run as non-root,
  base images are version-pinned, startup validates required production
  configuration, and development, integration, and browser stacks retain their
  explicit development targets.
- The separate production Compose topology keeps MongoDB and the backend
  internal, exposes Nginx with `/api` proxying and refresh-cookie path handling,
  and includes liveness and readiness checks. The isolated production smoke lane
  verifies image builds, compiled/static artifacts, non-root users, frontend
  loading, health, readiness, and a proxied catalog request, then cleans up.
- TLS termination, forwarded headers, exact trusted-proxy hops, secure-cookie
  behavior, versioned-image deployment, rollback, and smoke procedures are
  documented in `docs/production-deployment.md`; CI runs the production smoke
  lane.
- Next action: begin phase 4 by writing the database decision record under
  `docs/decisions/`. Compare MongoDB and PostgreSQL against the marketplace's
  integrity, transaction, tenant-isolation, query, operations, migration, and
  rollback requirements before selecting data-access or migration tooling.

## Recommended Order

### 1. Harden production authentication (completed)

- [x] Write an authentication decision record covering access-token transport,
      refresh-token persistence, cookie path and domain, `SameSite` policy, CSRF,
      CORS, session lifetime, concurrent refreshes, and signing-key rotation before
      changing the implementation.
- [x] Replace access-token storage in `localStorage` with short-lived
      `HttpOnly`, `Secure`, and appropriately scoped `SameSite` cookies, or document
      an equivalent design that keeps access tokens out of persistent browser
      storage.
- [x] Add tenant-scoped session records and refresh-token rotation. Store only
      refresh-token hashes, revoke a token family after detected reuse, enforce an
      absolute session lifetime, and clean up expired sessions.
- [x] Support revoking the current session and individual sessions without
      weakening the existing all-session logout behavior.
- [x] Configure Axios credential transport and explicit credential-enabled CORS
      without exposing cookies, authorization values, or CSRF tokens in logs and
      errors.
- [x] Add focused login, refresh, expiration, rotation, replay, concurrent
      refresh, CSRF, CORS, session-revocation, and logout tests. Include tenant
      isolation and failed-renewal behavior.
- [x] Implement the configured JWT signing-key ring and bounded verification-key
      overlap, plus versioned refresh-hash and CSRF-secret overlap, as specified
      by the accepted authentication ADR.
- [x] Remove transitional bearer-token compatibility after the frontend and
      browser tests use the new contract.
- Add `cookie-parser` and `@types/cookie-parser` only when incoming cookie
  handling is implemented. Keep `jsonwebtoken` during this phase so transport
  and session design are not coupled to an unrelated JWT-library migration.

### 2. Establish a production deployment baseline (completed)

- [x] Replace development-server Docker commands with multi-stage production
      images: compile and run the backend output with Node.js and serve the built
      frontend as static assets through a production server or hosting platform.
- [x] Run containers as non-root users, add application health checks, pin base
      image versions, validate required production environment variables at
      startup, and keep development Compose behavior available separately.
- [x] Document TLS termination, reverse-proxy and trusted-proxy behavior,
      forwarded headers, secure-cookie behavior, deployment, rollback, and smoke
      testing.
- [x] Add a CI smoke check proving that production images build and start and
      that health, readiness, frontend loading, and one API request work together.

### 3. Add browser-level workflow coverage (completed)

- [x] Add `@playwright/test` and a root end-to-end test command, initially using
      Chromium in CI to control runtime and browser downloads.
- [x] Cover registration and login with protected-route return, session renewal
      and logout, buyer checkout with inventory changes, and seller fulfillment
      with buyer notifications.
- [x] Keep browser state and generated authentication artifacts out of version
      control, and make test data deterministic, isolated, and tenant-scoped.
- [x] Add automated accessibility checks to important browser workflows and
      expand to Firefox, WebKit, or mobile projects only when compatibility
      requirements justify the additional CI cost.

### 4. Migrate persistence to PostgreSQL

- [ ] Write and accept a database ADR before implementation. Compare the current
      MongoDB design with PostgreSQL using the marketplace's relational integrity,
      transaction, tenant-isolation, query, operational, hosting-cost, migration,
      and rollback requirements. Record PostgreSQL and UUID identifiers as the
      intended direction unless the investigation identifies a concrete blocker.
- [ ] Design the relational schema with explicit foreign keys, tenant-scoped
      unique constraints and indexes, immutable order-item snapshots, inventory
      invariants, and transaction boundaries for checkout and fulfillment.
- [ ] Choose the PostgreSQL data-access and migration tooling through a focused
      spike. Evaluate Prisma, Drizzle, and a SQL-oriented client against the
      existing service boundaries, transaction behavior, generated SQL,
      migration reviewability, testability, and production deployment model.
- [ ] Remove MongoDB-specific identifiers from public and security contracts.
      Replace ObjectId validation and the ObjectId-shaped refresh-token session
      selector with database-neutral UUID or opaque identifiers without changing
      the accepted cookie, CSRF, rotation, replay, revocation, or key-ring rules.
- [ ] Implement PostgreSQL persistence behind the existing service boundaries,
      preserving API contracts and keeping transactions short and explicit.
- [ ] Build versioned schema and data migrations plus deterministic validation
      reports. Preserve password hashes, ownership, tenant isolation, inventory,
      immutable order history, timestamps, and other required data without
      logging secrets or personal data.
- [ ] Port database-backed integration tests and deterministic seed data to an
      ephemeral PostgreSQL service. Require checkout rollback, concurrent
      inventory updates, session rotation/replay, tenant isolation, and critical
      browser workflows to pass before cutover.
- [ ] Rehearse backup, migration, validation, application startup, smoke testing,
      and rollback against production-like data before changing the deployed
      database.
- [ ] Perform one controlled maintenance-window cutover: stop writes, take a
      final MongoDB backup, migrate and validate the data, revoke existing
      sessions so users sign in again, point the application at PostgreSQL, and
      pass readiness and critical workflow smoke tests before reopening writes.
- [ ] Keep the final MongoDB backup and deployment configuration available for a
      documented rollback window. Remove Mongoose, MongoDB containers, and old
      configuration only after PostgreSQL has been monitored and accepted.

### 5. Make catalog queries scalable and complete seller product management

- [ ] Move existing product search, category, availability, status, and sorting
      from in-memory application processing into tenant-scoped PostgreSQL queries.
- [ ] Add bounded pagination to catalog, seller product, order, review, and
      notification lists. Prefer cursor pagination where stable ordering matters;
      otherwise document maximum page sizes and return consistent metadata.
- [ ] Review indexes against the final filters and sort orders and verify query
      behavior with database-backed tests before adding indexes speculatively.
- [ ] Add tenant-scoped product editing, archival/reactivation, and inventory
      adjustment rules with backend ownership enforcement and focused tests.
- [ ] Prevent mass assignment by defining explicit editable fields and preserve
      immutable seller, tenant, and historical commerce data.
- [ ] Add image upload only after choosing an object-storage provider. Validate
      image URL protocols and hosts in the meantime, and do not store image
      binaries in the primary application database.
- Consider `react-hook-form` and `@hookform/resolvers` with the existing Zod
  dependency only when several forms can be migrated consistently.

### 6. Define roles and privileged authorization

- [ ] Decide whether the current `/admin` page is a seller dashboard or a
      privileged administration surface. Rename it if it is not administrative.
- [ ] If privileged administration is required, add explicit tenant-scoped
      roles or permissions, enforce them in backend middleware and services, and
      treat frontend guards and hidden controls only as usability features.
- [ ] Add denial, cross-tenant, privilege-change, and stale-session tests and
      record privileged changes in an audit trail.

### 7. Centralize tenant-specific themes and accessibility

- [ ] Add `prettier-plugin-tailwindcss` as a root development dependency and
      load it last in `prettier.config.mjs`, using
      `tailwindStylesheet: './frontend/src/index.css'` for the Tailwind CSS 4
      entry point. Review the initial class-order rewrite, then verify it with
      the root formatting, lint, test, and frontend build commands.
- [ ] Replace flat brand colors with a typed theme object covering canvas,
      surface, actions, text, muted text, borders, typography, radius, and shadows.
- [ ] Expose the active theme through consistently named CSS custom properties
      and replace reusable hard-coded colors without duplicating components per
      tenant.
- [ ] Keep semantic success, warning, and error colors independent from
      decorative tenant colors and verify readable contrast for both tenants.
- [ ] Audit keyboard navigation, visible focus, form labels and errors, live
      mutation feedback, landmarks, image alternatives, reduced motion, responsive
      layouts, and screen-reader announcements.
- [ ] Add focused theme/fallback tests, automated `axe` checks for important
      pages, and a documented manual keyboard smoke test.
- [ ] Document how to add or modify a tenant theme. Continue using Tailwind and
      CSS variables unless a redesign establishes a need for a component library.

### 8. Centralize frontend server state

- [ ] Introduce `@tanstack/react-query` incrementally after paginated response
      contracts are stable rather than rewriting all pages at once.
- [ ] Migrate notification counts first, then catalog and product details, cart
      and watchlist, and finally orders and reviews.
- [ ] Define query keys, pagination behavior, stale times, retries,
      invalidation, optimistic updates, rollback, and authentication-failure
      handling explicitly.
- [ ] Preserve existing pending, success, API-error, and previous-state behavior
      while removing duplicated request state from pages.

### 9. Improve API consistency and frontend contract safety

- [ ] Define consistent error, list, pagination, and mutation response shapes in
      Zod and OpenAPI before migrating list consumers.
- [ ] Share or generate TypeScript contract types from the existing Zod/OpenAPI
      source so frontend pages do not repeatedly declare approximate API types.
- [ ] Organize the Axios layer around small domain services while keeping all
      API paths in `frontend/src/routes.ts`.
- Continue deferring a fully generated API client until maintaining handwritten
  endpoints becomes a measured burden.

### 10. Add production observability and auditability

- [ ] Add structured request and application logging with `pino` and
      `pino-http`, reusing the existing request context and correlation ID.
- [ ] Include tenant, route, response status, duration, and safe authenticated
      user context while redacting cookies, authorization headers, passwords,
      tokens, CSRF values, and unnecessary personal data.
- [ ] Define production log levels, error serialization, retention, and useful
      operational alerts before selecting a hosted monitoring or tracing provider.
- [ ] Add append-only audit events for session, inventory, order, and privileged
      mutations without treating ordinary application logs as the audit record.

### 11. Add account verification, recovery, and management

- [ ] Add email verification and password-reset flows using hashed, expiring,
      single-use tokens and non-enumerating responses.
- [ ] Invalidate existing sessions after password reset and apply dedicated rate
      limits to recovery and verification endpoints.
- [ ] Add authenticated password change, profile update, sensitive-operation
      reauthentication, email change and reverification, and account deactivation.
- [ ] Define and test what happens to listings, reviews, orders, audit history,
      and personal data when an account is deactivated or deleted.
- Choose an email provider SDK only when deployment requirements are known;
  use `nodemailer` only when generic SMTP or local email testing is explicitly
  required.

### 12. Manage database evolution and data lifecycle

- [ ] Establish versioned, repeatable migrations for schema changes, data
      backfills, and index creation instead of relying on implicit startup changes.
- [ ] Document compatibility and rollback rules for deployments that span old
      and new application versions.
- [ ] Define retention and cleanup for sessions, recovery tokens,
      notifications, abandoned carts, and other temporary records, using
      scheduled, observable cleanup jobs where PostgreSQL does not provide the
      current MongoDB TTL-index behavior.
- [ ] Document backup and restore procedures and rehearse a migration and
      restore using production-like data without exposing secrets or personal data.

### 13. Add later marketplace capabilities only after the baseline is stable

- [ ] Make checkout and other retry-sensitive mutations idempotent so retries
      cannot create duplicate orders or side effects.
- [ ] Add seller inventory history, low-stock warnings, order search and
      filtering, and basic tenant-scoped sales summaries.
- [ ] Replace uncontrolled free-text categories with managed taxonomy only if
      catalog requirements need consistent discovery.
- [ ] Model delivery addresses, returns, refunds, and disputes as distinct
      domain workflows when the marketplace scope includes physical fulfillment;
      do not keep extending the order-status enum to represent unrelated processes.
- [ ] Add notification preferences and asynchronous email delivery before
      introducing Redis or a job queue.

## Dependency and Security Guardrails

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
