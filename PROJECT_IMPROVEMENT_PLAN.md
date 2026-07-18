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
- Backend has 113 focused tests across 27 files and passes its coverage
  thresholds with 87.23% branches and 85.46% functions. Frontend has 104 tests
  across 20 files and passes its thresholds with 90.8% branches and 92.72% functions.
  Type checks, tests, lint, formatting, OpenAPI
  generation, coverage, and the production build pass.
- Checkout commits order creation, items, conditional inventory decrements, cart
  clearing, and notifications in one PostgreSQL transaction.
- A separate `npm run test:integration` lane builds ephemeral PostgreSQL 18,
  applies committed migrations, runs 11 database-backed scenarios across two
  files against the real Express composition and Drizzle adapters, and cleans up
  its isolated Compose project and database deterministically.
- Database-backed tests verify atomic checkout and rollback, cart and
  watchlist persistence, order visibility and fulfillment, verified-purchase
  reviews, notifications, tenant and compound-index isolation, token-version
  logout revocation, repeatable non-destructive demo seeding, session login and
  restoration, atomic refresh rotation, bounded concurrency, replay-family
  revocation, tenant isolation, idle and absolute expiry, and tenant-scoped
  catalog filtering and sorting.
- Shared authenticated route protection now redirects anonymous visitors from
  `/checkout`, `/products/new`, and `/notifications` to login with a route-specific
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
  database-backed integration lane passes all 10 scenarios and cleans up its
  containers and isolated network successfully.
- The root `npm run test:e2e` lane builds isolated, deterministically seeded
  PostgreSQL backend/frontend stacks and runs Chromium through protected-route
  return, login, exact cookie flags, access renewal, no persistent browser auth,
  logout, tenant-scoped registration, buyer checkout with inventory decrement,
  seller fulfillment through delivery, and buyer notification read state. The
  two tests use isolated browser contexts where required; containers, networks,
  and databases are cleaned up on exit, and Playwright artifacts are ignored.
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
- The separate production Compose topology keeps PostgreSQL and the backend
  internal, exposes Nginx with `/api` proxying and refresh-cookie path handling,
  and includes liveness and readiness checks. The isolated production smoke lane
  verifies image builds, compiled/static artifacts, non-root users, frontend
  loading, health, readiness, and a proxied catalog request, then cleans up.
- TLS termination, forwarded headers, exact trusted-proxy hops, secure-cookie
  behavior, versioned-image deployment, rollback, and smoke procedures are
  documented in `docs/production-deployment.md`; CI runs the production smoke
  lane.
- The database direction is accepted in
  `docs/decisions/0002-postgresql-persistence.md`: PostgreSQL will become the
  sole authoritative database, persistent entities will use native UUIDs, and
  tenant-qualified constraints and short explicit transactions will preserve
  isolation, inventory, checkout, fulfillment, and session semantics. The ADR
  requires a rehearsed maintenance-window migration, deterministic validation,
  and a database-aware rollback; it deliberately leaves data-access tooling to
  the focused spike.
- The tooling-independent relational design is recorded in
  `docs/postgresql-schema-design.md`. It maps the current models to
  tenant-qualified tables and foreign keys, defines checks, uniqueness, delete
  behavior, immutable order snapshots/history, query-driven baseline indexes,
  migration invariants, and exact checkout, fulfillment, and session transaction
  boundaries without expanding the product contract.
- The executable tooling spike is recorded in
  `docs/postgresql-tooling-spike.md`. Prisma 7.8.0, Drizzle ORM 0.45.2, and
  direct `pg` 8.22.0 all passed equivalent checkout commit/rollback and
  single-winner refresh-rotation scenarios. Drizzle and direct SQL additionally
  generated the accepted checks and partial index; the unmodified Prisma
  migration accepted invalid negative inventory.
- Data-access tooling is accepted in
  `docs/decisions/0003-drizzle-postgresql-tooling.md`: use Drizzle ORM with the
  `pg` pool, generate and review versioned SQL through Drizzle Kit, and reserve
  parameterized SQL fragments/custom migrations for explicit PostgreSQL
  behavior. No candidate dependency was added during the disposable spike.
- All persistent and security identifiers are canonical UUID strings. New IDs
  use `crypto.randomUUID()`, deterministic demo IDs are fixed UUIDs, and shared
  validation covers resource paths, JWT `sub`/`sid`, refresh selectors, CSRF
  binding, and OpenAPI `format: uuid`.
- PostgreSQL is the sole persistence runtime. The backend pins Drizzle ORM
  0.45.2, Drizzle Kit 0.31.10, and `pg` 8.22.0; its reviewed 12-table migration
  encodes UUID keys, tenant-qualified foreign keys, checks, indexes, immutable
  order snapshots/history, session metadata, and deterministic tenant anchors.
  Local, integration, E2E, and production Compose topologies apply migrations
  before startup and expose PostgreSQL readiness.
- Database-neutral repository contracts and Drizzle adapters cover users,
  products, carts, checkout, orders/history/items, notifications, watchlists,
  reviews, and sessions. PostgreSQL transactions use ordered locks and
  conditional updates for checkout and refresh rotation while preserving API,
  tenant, ownership, replay, revocation, and lifecycle contracts.
- No deployed database or production data exists, so the cutover was a direct
  repository switch. MongoDB/Mongoose adapters, models, containers,
  migration-only configuration, duplicated tests, and dependencies are removed;
  no data migration, backup, or restore procedure is applicable to this project.
- Catalog and seller product search, category/subcategory, seller, status, and
  availability filters and creation/name/inventory sorting execute in
  tenant-scoped PostgreSQL queries. Stable tie-breakers preserve deterministic
  results, and literal search wildcard characters do not broaden matches.
- Catalog, seller-product, order, review, and notification lists use a shared
  offset-pagination envelope with a default limit of 20, a maximum of 100,
  deterministic ordering, total/has-more metadata, and database-bounded reads.
  Buyer and seller order scopes are explicit, and seller responses include only
  that seller's line items.
- Seller-owned product management supports explicit detail edits, lifecycle
  archival/reactivation, and inventory setting. Backend tenant and ownership
  checks prevent cross-seller and cross-tenant mutation; immutable ownership and
  commerce history cannot be mass-assigned. Inventory drives sold-out and
  replenishment transitions.
- Reviewed migration `0001_next_expediter.sql` adds only the name and inventory
  catalog sort indexes missing from the accepted baseline indexes. PostgreSQL
  tests verify paginated query behavior and all five catalog indexes.
- Product images remain URL/path references rather than database binaries.
  Absolute URLs require HTTPS and an exact `PRODUCT_IMAGE_HOSTS` match, with
  loopback-only HTTP for local development; upload remains deferred until an
  object-storage provider is selected.
- Typecheck, 113 focused backend tests, 104 frontend tests, coverage
  thresholds, lint, formatting, 11 PostgreSQL integration scenarios, both
  Chromium workflows, the OpenAPI contract, production-only dependency audit,
  and the PostgreSQL production-image smoke lane pass.
- The former `/admin` page was not a privileged administration surface. It is
  now `/notifications`, loads only the current user's tenant-scoped
  notifications, and no longer labels catalog summaries as moderation or an
  audit trail. Privileged roles are intentionally deferred until a concrete
  administration requirement exists.
- Root Prettier formatting now loads `prettier-plugin-tailwindcss` last and uses
  the Tailwind CSS 4 stylesheet entry point. The reviewed initial rewrite only
  canonicalizes utility ordering in three frontend components; formatting,
  lint, focused tests, typecheck, and the frontend production build pass.
- Both tenant configurations now use a typed semantic theme covering canvas,
  surfaces, actions, text, muted text, borders, typography, radii, and shadows.
  `BrandProvider` maps every token to consistently named `--theme-*` custom
  properties, all legacy `--brand-*` consumers are migrated, and focused tests
  verify explicit-tenant application and unknown-tenant fallback.
- Reusable frontend canvas, surface, text, muted-text, border, radius, and shadow
  values now consume Tailwind CSS 4 semantic utilities backed by `@theme inline`
  aliases over the runtime tenant properties. Components no longer repeat
  arbitrary `var(...)` utilities. Success, error, and neutral lifecycle states
  remain tenant-independent. Focused tests enforce WCAG AA contrast for both
  tenant palettes, including action and accent usage.
- The browser workflow's stale `/admin` navigation is corrected to
  `/notifications`; both deterministic Chromium workflows and their Axe checks
  pass against the themed UI and clean up their isolated stack.
- Individually defined and tested Tailwind `Button`, `Input`, `Select`, and
  `Textarea` primitives now own reusable control presentation and disabled
  states; callers select explicit primary or secondary button variants while
  retaining layout utilities near their components. The global stylesheet is
  limited to the Tailwind theme bridge and document-wide typography, link,
  visible-focus, and reduced-motion policies. Product creation uses a main
  landmark, level-one heading, and
  explicit field labels; login errors are announced and associated with invalid
  fields; review controls wrap on narrow layouts; and remaining commerce and
  product-management actions use consistent themed controls.
- `docs/accessibility.md` documents automated Axe coverage and a repeatable
  two-tenant keyboard, responsive, reduced-motion, and screen-reader smoke test.
  The browser lane also asserts visible keyboard focus before running the full
  Axe-enabled workflows.
- `docs/tenant-theming.md` documents the typed configuration, runtime-property
  and Tailwind alias bridge, semantic utility rules, existing-theme and new-brand
  workflows, backend tenant boundary, WCAG contrast test, and required automated
  and manual verification. Step 7 is complete.
- React Query 5.101.2 now has an application-scoped provider, centralized client
  defaults, and hierarchical query keys. Queries are fresh for 30 seconds, do
  not retry or refetch on window focus by default, and continue to delegate
  authentication failures to the Axios renewal workflow. The header unread
  notification count is the first migrated query: it is disabled anonymously,
  keyed by user identity, and keeps badge failures out of shared navigation.
  Direct page-test renders use isolated providers.
- Catalog and seller-product reads now use a hierarchical list key containing
  seller scope, normalized search, category, availability, sort, limit, and
  offset. Editable filters remain separate from the applied request, repeated
  submissions explicitly refetch, route-scope changes reset through a keyed
  catalog boundary, and paginated transitions retain the previous page until
  the next response. Initial loading, load errors, empty results, local search
  preview, and the later-phase cart/watchlist behavior remain intact.
- Product-detail records now use a hierarchical key containing the product ID.
  The query runs independently from a guarded companion loader for initial
  reviews and authenticated cart/watchlist state, while the page still withholds
  product content until both sides succeed and preserves its existing whole-page
  load error. Route product-ID changes reset local companion and mutation state
  through a keyed detail boundary.
- Catalog and product-detail cart/watchlist state now shares one normalized
  product-ID cache per collection and user. Mutations cancel active reads, apply
  an optimistic add/removal, restore the exact prior cache on failure, and
  invalidate authenticated state after success. Anonymous reads remain disabled
  while their existing action controls still work against a separate anonymous
  cache. Initial collection failures preserve the product-detail load error, but
  failed background revalidation does not replace usable cached content.
- Product reviews now use keys containing product ID, limit, and offset, retain
  the prior page during pagination, and preserve the product page's initial
  loading/error boundary. Review creation changes cached data only after API
  success, deduplicates the returned review in the visible page, and invalidates
  inactive pages for that product without clearing form or review state on
  failure.
- Buyer and seller order lists now share normalized query data keyed by user,
  scope, limit, and offset, retaining prior pages during transitions. Checkout
  creation adds the returned order only after success, clears the user's cached
  cart IDs, and invalidates inactive buyer/seller order caches. Seller progression
  updates status/history only after success and likewise invalidates cross-scope
  caches; failures retain the prior lifecycle state. The checkout combined-load
  error and seller line-item scoping remain intact.
- Checkout cart items now use a user-scoped detailed cache coordinated with the
  existing cart product-ID projection. Quantity and removal mutations cancel and
  snapshot both representations, apply optimistic changes, restore both exactly
  on failure, and invalidate inactive copies after success. Catalog/detail cart
  removal also updates detailed cached items, additions invalidate them, and
  successful checkout clears and invalidates both representations. The combined
  cart/order load error, unavailable-item protection, and mutation copy remain
  intact. All 122 frontend tests, coverage thresholds (92.77% branches and
  96.05% functions), formatting, lint, typecheck, and the production build pass.
- The accepted Step 8 frontend boundary is a small domain hook layer under
  `frontend/src/serverState/`, following the existing cart, collection, and order
  modules. Domain modules should expose reusable query-option factories where
  prefetching or imperative cache access is useful, plus thin `use...` query and
  mutation hooks that own request normalization, query keys, cache updates,
  invalidation, optimistic behavior, and rollback. Components should retain only
  UI/form state and rendering decisions. Avoid a generic URL-based query hook;
  keep endpoint paths in `frontend/src/routes.ts`, and defer domain API service
  extraction to Step 9. Extract remaining direct component queries incrementally
  rather than rewriting completed flows at once.
- The notification domain module now exposes reusable list and unread-count
  query options plus list, count, and read-state hooks. Notification pages are
  keyed by user, limit, and offset and retain prior data during transitions;
  successful read changes update the visible page and unread-count cache before
  invalidating inactive copies, while failures preserve both. The page and header
  no longer construct notification queries directly.
- Product and review domain modules now expose reusable query-option factories
  and thin hooks for catalog/seller lists, product details, paginated reviews,
  and review creation. `Products.tsx` and `ProductDetail.tsx` retain request and
  form state but no longer construct React Query queries, mutations, paths,
  normalization, or cache invalidation directly. Existing keys, previous-page
  behavior, review success-only updates, loading/errors, and form state remain
  unchanged. All 124 frontend tests, coverage thresholds (93.02% branches and
  96.01% functions), formatting, lint, typecheck, and the production build pass.
- The order domain module now exposes an order-list query-option factory plus
  checkout-creation and seller-progression hooks. `Checkout.tsx` and
  `SellerOrders.tsx` retain UI request and feedback state but no longer own API
  calls, TanStack Query mutations, cache writes, or invalidation. Checkout still
  clears both cart representations after success, and seller lifecycle updates
  still preserve cached status/history on failure. No page under
  `frontend/src/pages/` constructs TanStack Query hooks or options directly. All
  124 frontend tests, coverage thresholds (92.77% branches and 95.7% functions),
  formatting, lint, typecheck, and the production build pass.
- Product management now uses the shared product-detail query and explicit
  detail, inventory, and lifecycle mutation hooks. Successful mutations replace
  the detail cache with the server-confirmed product and invalidate product
  lists; failures leave the edited form and previous cache intact. A keyed form
  boundary initializes fields from the loaded record without allowing background
  cache activity to overwrite in-progress edits. `EditProduct.tsx` no longer
  owns API paths or Axios calls. All 124 frontend tests, coverage thresholds
  (91.25% branches and 95.85% functions), formatting, lint, typecheck, and the
  production build pass.
- Seller profiles now use a seller-ID query key, reusable option factory, and
  thin domain hook, while their product links reuse the normalized seller-scoped
  product-list query. `SellerProfile.tsx` no longer owns an effect, Axios calls,
  response normalization, or request state; it retains the combined initial
  loading/error boundary and only presents content when both records are usable.
  All 125 frontend tests, coverage thresholds (91.28% branches and 95.93%
  functions), formatting, lint, typecheck, and the production build pass.
- Product creation now uses an explicit product-domain mutation hook. The hook
  owns the endpoint and invalidates product lists after success, while
  `AddProduct.tsx` retains authentication validation, tenant copy, Axios error
  interpretation, form state, and seller-route navigation. The submit control
  exposes an accessible pending state and prevents duplicate requests. All 126
  frontend tests, coverage thresholds (91.28% branches and 95.98% functions),
  formatting, lint, typecheck, and the production build pass.
- Account registration now uses an explicit user-domain mutation hook.
  `AddUser.tsx` retains field state, tenant-specific and API-provided error
  messages, and successful home navigation, while its submit control exposes an
  accessible pending state and prevents duplicate requests. All 127 frontend
  tests, coverage thresholds (91.28% branches and 96.01% functions), formatting,
  lint, typecheck, and the production build pass.
- Login and logout now use focused authentication-domain mutation hooks. Session
  establishment/clearing and route decisions remain in `Login.tsx`, the header,
  and `AuthContext`; logout still completes locally when the API is unavailable.
  Both controls expose accessible pending state and block duplicate requests.
  The page-source audit finds no direct Axios calls, API paths, or TanStack Query
  construction under `frontend/src/pages/`. All 129 frontend tests, coverage
  thresholds (91.28% branches and 96.07% functions), formatting, lint,
  typecheck, and the production build pass. Step 8 is complete.
- Next action: begin Step 9 with a contract audit of the product endpoints.
  Compare their implemented success/error/list responses with the Zod schemas
  and response metadata in `backend/src/validators/` and
  `backend/src/openapi/document.ts`, plus the handwritten product types in
  `frontend/src/serverState/products.ts`. Record concrete schema or example gaps
  before changing frontend types, and regenerate `docs/openapi.json` after any
  backend contract metadata change.

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

### 4. Migrate persistence to PostgreSQL (completed)

- [x] Write and accept a database ADR before implementation. Compare the current
      MongoDB design with PostgreSQL using the marketplace's relational integrity,
      transaction, tenant-isolation, query, operational, hosting-cost, migration,
      and rollback requirements. Record PostgreSQL and UUID identifiers as the
      intended direction unless the investigation identifies a concrete blocker.
- [x] Design the relational schema with explicit foreign keys, tenant-scoped
      unique constraints and indexes, immutable order-item snapshots, inventory
      invariants, and transaction boundaries for checkout and fulfillment.
- [x] Choose the PostgreSQL data-access and migration tooling through a focused
      spike. Evaluate Prisma, Drizzle, and a SQL-oriented client against the
      existing service boundaries, transaction behavior, generated SQL,
      migration reviewability, testability, and production deployment model.
- [x] Remove MongoDB-specific identifiers from public and security contracts.
      Replace ObjectId validation and the ObjectId-shaped refresh-token session
      selector with database-neutral UUID or opaque identifiers without changing
      the accepted cookie, CSRF, rotation, replay, revocation, or key-ring rules.
- [x] Implement PostgreSQL persistence behind the existing service boundaries,
      preserving API contracts and keeping transactions short and explicit.
- [x] Build and verify versioned PostgreSQL schema migrations. A MongoDB data
      migration and validation report are not required because the project has
      no deployed database or retained production data; deterministic PostgreSQL
      seed data replaces the undeployed development dataset.
- [x] Port database-backed integration tests and deterministic seed data to an
      ephemeral PostgreSQL service. Require checkout rollback, concurrent
      inventory updates, session rotation/replay, tenant isolation, and critical
      browser workflows to pass before cutover.
- [x] Verify schema migration, application startup, readiness, integration,
      critical browser workflows, and production-image smoke testing in isolated
      PostgreSQL environments. Backup/data rollback rehearsal is not applicable
      because no deployed database or production data exists.
- [x] Switch the undeployed application directly to PostgreSQL. No maintenance
      window, production backup, session revocation, or data transfer is needed
      because no production environment or production data exists.
- [x] Remove the transitional Mongoose models, MongoDB adapters, containers,
      migration-only configuration, and dependency after the direct switch.

### 5. Make catalog queries scalable and complete seller product management (completed)

- [x] Move existing product search, category, availability, status, and sorting
      from in-memory application processing into tenant-scoped PostgreSQL queries.
- [x] Add bounded pagination to catalog, seller product, order, review, and
      notification lists. Prefer cursor pagination where stable ordering matters;
      otherwise document maximum page sizes and return consistent metadata.
- [x] Review indexes against the final filters and sort orders and verify query
      behavior with database-backed tests before adding indexes speculatively.
- [x] Add tenant-scoped product editing, archival/reactivation, and inventory
      adjustment rules with backend ownership enforcement and focused tests.
- [x] Prevent mass assignment by defining explicit editable fields and preserve
      immutable seller, tenant, and historical commerce data.
- [x] Defer image upload until choosing an object-storage provider. Validate
      image URL protocols and hosts in the meantime, and do not store image
      binaries in the primary application database.
- Consider `react-hook-form` and `@hookform/resolvers` with the existing Zod
  dependency only when several forms can be migrated consistently.

### 6. Define roles and privileged authorization (completed)

- [x] Decide whether the current `/admin` page is a seller dashboard or a
      privileged administration surface. Rename it if it is not administrative.
- [x] Confirm that privileged administration is not required by the current
      product contract. Keep tenant, ownership, and seller-order authorization in
      backend services; introduce roles only with a concrete privileged workflow.
- [x] Defer privilege-change, stale-role-session, and privileged audit-trail
      scenarios until privileged roles exist. Existing tenant, ownership, and
      seller-scope denial tests remain authoritative for current workflows.

### 7. Centralize tenant-specific themes and accessibility (completed)

- [x] Add `prettier-plugin-tailwindcss` as a root development dependency and
      load it last in `prettier.config.mjs`, using
      `tailwindStylesheet: './frontend/src/index.css'` for the Tailwind CSS 4
      entry point. Review the initial class-order rewrite, then verify it with
      the root formatting, lint, test, and frontend build commands.
- [x] Replace flat brand colors with a typed theme object covering canvas,
      surface, actions, text, muted text, borders, typography, radius, and shadows.
- [x] Expose the active theme through consistently named CSS custom properties
      and replace reusable hard-coded colors without duplicating components per
      tenant.
- [x] Keep semantic success, warning, and error colors independent from
      decorative tenant colors and verify readable contrast for both tenants.
- [x] Audit keyboard navigation, visible focus, form labels and errors, live
      mutation feedback, landmarks, image alternatives, reduced motion, responsive
      layouts, and screen-reader announcements.
- [x] Add focused theme/fallback tests, automated `axe` checks for important
      pages, and a documented manual keyboard smoke test.
- [x] Document how to add or modify a tenant theme. Continue using Tailwind and
      CSS variables unless a redesign establishes a need for a component library.

### 8. Centralize frontend server state (completed)

- [x] Introduce `@tanstack/react-query` incrementally after paginated response
      contracts are stable rather than rewriting all pages at once.
- [x] Migrate notification counts first.
- [x] Migrate catalog and seller-product lists.
- [x] Migrate product-detail records.
- [x] Migrate catalog and product-detail cart/watchlist state.
- [x] Migrate product reviews.
- [x] Migrate buyer and seller orders.
- [x] Migrate detailed checkout cart state.
- [x] Standardize server-state access behind small domain query-option factories
      and hooks; migrate remaining direct component calls incrementally without
      introducing a generic URL-based abstraction.
- [x] Migrate notification lists and read state through the notification domain
      hooks.
- [x] Define query keys, pagination behavior, stale times, retries,
      invalidation, optimistic updates, rollback, and authentication-failure
      handling explicitly.
- [x] Preserve existing pending, success, API-error, and previous-state behavior
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
      scheduled, observable cleanup jobs where automatic expiry is unavailable.
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
