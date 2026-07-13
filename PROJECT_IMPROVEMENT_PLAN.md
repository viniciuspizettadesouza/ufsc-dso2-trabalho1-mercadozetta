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
- Backend has 180 tests across 30 files and passes the 85% branch threshold with
  86.07%. Frontend has 68 tests across 11 files. Type checks, tests, lint,
  formatting, OpenAPI generation, coverage, and the production build pass.
- Checkout commits order creation, items, conditional inventory decrements, cart
  clearing, and notifications in one transaction. Dockerized MongoDB uses a
  single-node replica set so local behavior matches this requirement.
- A separate `npm run test:integration` lane builds an ephemeral MongoDB 7
  replica set, runs 7 database-backed tests across 4 files against the real
  Express app and Mongoose models, and cleans up its isolated Compose project
  and database deterministically.
- Database-backed tests verify atomic checkout and rollback, cart and
  watchlist persistence, order visibility and fulfillment, verified-purchase
  reviews, notifications, tenant and compound-index isolation, token-version
  logout revocation, and repeatable non-destructive demo seeding.
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
- Next action: begin production authentication hardening by designing the cookie
  and session-renewal contract, then migrate token transport with focused CSRF,
  CORS, login, and logout tests.

## Recommended Order

### 1. Harden production authentication (current priority)

- [ ] Write an authentication decision record covering access-token transport,
      refresh-token persistence, cookie path and domain, `SameSite` policy, CSRF,
      CORS, session lifetime, concurrent refreshes, and signing-key rotation before
      changing the implementation.
- [ ] Replace access-token storage in `localStorage` with short-lived
      `HttpOnly`, `Secure`, and appropriately scoped `SameSite` cookies, or document
      an equivalent design that keeps access tokens out of persistent browser
      storage.
- [ ] Add tenant-scoped session records and refresh-token rotation. Store only
      refresh-token hashes, revoke a token family after detected reuse, enforce an
      absolute session lifetime, and clean up expired sessions.
- [ ] Support revoking the current session and individual sessions without
      weakening the existing all-session logout behavior.
- [ ] Configure Axios credential transport and explicit credential-enabled CORS
      without exposing cookies, authorization values, or CSRF tokens in logs and
      errors.
- [ ] Add focused login, refresh, expiration, rotation, replay, concurrent
      refresh, CSRF, CORS, session-revocation, and logout tests. Include tenant
      isolation and failed-renewal behavior.
- [ ] Remove transitional bearer-token compatibility after the frontend and
      browser tests use the new contract.
- Add `cookie-parser` and `@types/cookie-parser` only when incoming cookie
  handling is implemented. Keep `jsonwebtoken` during this phase so transport
  and session design are not coupled to an unrelated JWT-library migration.

### 2. Establish a production deployment baseline

- [ ] Replace development-server Docker commands with multi-stage production
      images: compile and run the backend output with Node.js and serve the built
      frontend as static assets through a production server or hosting platform.
- [ ] Run containers as non-root users, add application health checks, pin base
      image versions, validate required production environment variables at
      startup, and keep development Compose behavior available separately.
- [ ] Document TLS termination, reverse-proxy and trusted-proxy behavior,
      forwarded headers, secure-cookie behavior, deployment, rollback, and smoke
      testing.
- [ ] Add a CI smoke check proving that production images build and start and
      that health, readiness, frontend loading, and one API request work together.

### 3. Add browser-level workflow coverage

- [ ] Add `@playwright/test` and a root end-to-end test command, initially using
      Chromium in CI to control runtime and browser downloads.
- [ ] Cover registration and login with protected-route return, session renewal
      and logout, buyer checkout with inventory changes, and seller fulfillment
      with buyer notifications.
- [ ] Keep browser state and generated authentication artifacts out of version
      control, and make test data deterministic, isolated, and tenant-scoped.
- [ ] Add automated accessibility checks to important browser workflows and
      expand to Firefox, WebKit, or mobile projects only when compatibility
      requirements justify the additional CI cost.

### 4. Make catalog queries scalable and complete seller product management

- [ ] Move existing product search, category, availability, status, and sorting
      from in-memory application processing into tenant-scoped MongoDB queries.
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
      image URL protocols and hosts in the meantime, and do not store image binaries
      in MongoDB.
- Consider `react-hook-form` and `@hookform/resolvers` with the existing Zod
  dependency only when several forms can be migrated consistently.

### 5. Define roles and privileged authorization

- [ ] Decide whether the current `/admin` page is a seller dashboard or a
      privileged administration surface. Rename it if it is not administrative.
- [ ] If privileged administration is required, add explicit tenant-scoped
      roles or permissions, enforce them in backend middleware and services, and
      treat frontend guards and hidden controls only as usability features.
- [ ] Add denial, cross-tenant, privilege-change, and stale-session tests and
      record privileged changes in an audit trail.

### 6. Centralize tenant-specific themes and accessibility

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

### 7. Centralize frontend server state

- [ ] Introduce `@tanstack/react-query` incrementally after paginated response
      contracts are stable rather than rewriting all pages at once.
- [ ] Migrate notification counts first, then catalog and product details, cart
      and watchlist, and finally orders and reviews.
- [ ] Define query keys, pagination behavior, stale times, retries,
      invalidation, optimistic updates, rollback, and authentication-failure
      handling explicitly.
- [ ] Preserve existing pending, success, API-error, and previous-state behavior
      while removing duplicated request state from pages.

### 8. Improve API consistency and frontend contract safety

- [ ] Define consistent error, list, pagination, and mutation response shapes in
      Zod and OpenAPI before migrating list consumers.
- [ ] Share or generate TypeScript contract types from the existing Zod/OpenAPI
      source so frontend pages do not repeatedly declare approximate API types.
- [ ] Organize the Axios layer around small domain services while keeping all
      API paths in `frontend/src/routes.ts`.
- Continue deferring a fully generated API client until maintaining handwritten
  endpoints becomes a measured burden.

### 9. Add production observability and auditability

- [ ] Add structured request and application logging with `pino` and
      `pino-http`, reusing the existing request context and correlation ID.
- [ ] Include tenant, route, response status, duration, and safe authenticated
      user context while redacting cookies, authorization headers, passwords,
      tokens, CSRF values, and unnecessary personal data.
- [ ] Define production log levels, error serialization, retention, and useful
      operational alerts before selecting a hosted monitoring or tracing provider.
- [ ] Add append-only audit events for session, inventory, order, and privileged
      mutations without treating ordinary application logs as the audit record.

### 10. Add account verification, recovery, and management

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

### 11. Manage database evolution and data lifecycle

- [ ] Establish versioned, repeatable migrations for schema changes, data
      backfills, and index creation instead of relying on implicit startup changes.
- [ ] Document compatibility and rollback rules for deployments that span old
      and new application versions.
- [ ] Define retention and cleanup for sessions, recovery tokens,
      notifications, abandoned carts, and other temporary records, using TTL
      indexes where their semantics are appropriate.
- [ ] Document backup and restore procedures and rehearse a migration and
      restore using production-like data without exposing secrets or personal data.

### 12. Add later marketplace capabilities only after the baseline is stable

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
- Do not migrate to Next.js, NestJS, Fastify, PostgreSQL, Prisma, or Drizzle
  without a measured product or operational requirement.
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
