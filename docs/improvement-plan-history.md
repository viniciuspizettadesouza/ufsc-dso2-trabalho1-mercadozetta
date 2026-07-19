# MercadoZetta Improvement Plan History

This append-only document preserves the detailed verified handoff and completed
roadmap evidence through Step 13. Existing historical entries should not be
rewritten. Earlier versions, test counts, and status statements may be
superseded by later entries and must not be treated as the current repository
state.

The active roadmap and current handoff remain in
[PROJECT_IMPROVEMENT_PLAN.md](../PROJECT_IMPROVEMENT_PLAN.md), which is the
source of truth for ongoing work.

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
- Backend has 243 focused tests across 48 files and passes coverage with 91.08%
  branches and 97.72% functions. Frontend has 186 tests across 38 files and
  passes coverage with 91.69% branches and 96.39% functions. Type checks, tests,
  lint, formatting, generated-contract parity, coverage, and the production
  build pass.
- Checkout commits order creation, items, conditional inventory decrements, cart
  clearing, and notifications in one PostgreSQL transaction.
- A separate `npm run test:integration` lane builds ephemeral PostgreSQL 18,
  applies committed migrations, runs 28 database-backed scenarios across three
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
  database-backed integration lane passes all 28 scenarios and cleans up its
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
- The Step 9 product contract audit is recorded in
  `docs/product-api-contract-audit.md`. Reusable Zod schemas now define product,
  seller-profile, create-product, pagination, list, and error responses. OpenAPI
  correctly documents a UUID `seller` plus optional detail `sellerProfile`, a
  nullable description, required database-backed fields and timestamps, and
  complete product examples. No frontend response type changed during the audit.
  The regenerated contract, 115 backend tests, 129 frontend tests, coverage
  thresholds, typecheck, lint, formatting, and the frontend production build
  pass.
- The accepted shared-type boundary uses `openapi-typescript` 7.13.0 to generate
  runtime-free declarations from the checked-in OpenAPI document. Product,
  product-status, product-list, create-product, update-product, and page-info
  types now flow into the frontend without generating an API client or moving
  endpoint paths out of `frontend/src/routes.ts`. Product and shared pagination
  consumers no longer accept undocumented bare-array list responses. Root tests
  and CI enforce generated-file parity, and `npm run generate:contracts`
  refreshes OpenAPI and frontend types together. Tailwind source detection
  excludes the generated declaration so contract strings cannot add unrelated
  production CSS. All 115 backend tests, 129 frontend tests, coverage thresholds
  (87.23% backend branches and 90.95% frontend branches), typecheck, lint,
  formatting, the frontend production build, generated-file parity, and the root
  production dependency audit pass.
- Product endpoint error responses now enumerate only the codes reachable at
  each HTTP status and provide a matching example for every code through shared
  error-schema and product metadata. All successful product mutations return a
  bare `Product`; the undeployed create-only `newProduct` wrapper is removed from
  the controller, OpenAPI, generated types, frontend hook, and tests. The
  PostgreSQL integration lane verifies the composed `201` creation response.
  All 124 backend tests, 129 frontend tests, coverage thresholds, generated-file
  parity, typecheck, lint, formatting, the frontend production build, and all 11
  database scenarios pass with deterministic integration cleanup.
- The Step 9 user/authentication audit is recorded in
  `docs/user-auth-api-contract-audit.md`. Reusable schemas now describe nullable
  persisted user fields, required user/session timestamps, public seller
  profiles, authentication state, and active-session lists. User/authentication
  errors constrain reachable codes per response with matching examples, login
  documents invalid-origin failures, and seller IDs are validated by the live
  route. Registration now returns a bare `User`; login, session restoration,
  registration, and seller-profile Axios boundaries consume generated types.
  Cookie, CSRF, rotation, revocation, and lifetime semantics are unchanged. All
  131 backend tests, 129 frontend tests, coverage thresholds, generated-file
  parity, typecheck, lint, formatting, the frontend production build, all 11
  PostgreSQL scenarios, and both Chromium workflows pass.
- The Step 9 cart audit is recorded in `docs/cart-api-contract-audit.md`. Named
  request, populated-line, and cart schemas now match the implemented public
  response without exposing the internal cart ID or a bare product-ID fallback.
  Reads, updates, and removals share one `Cart` shape; every cart error response
  constrains reachable codes and matching examples, including product-not-found
  and inventory conflicts. Detailed-cart and product-collection HTTP boundaries
  consume generated types while preserving their existing React Query keys,
  optimistic updates, invalidation, and rollback behavior. All 133 backend
  tests, 129 frontend tests, coverage thresholds, generated-file parity,
  typecheck, lint, formatting, the frontend production build, and all 11
  PostgreSQL scenarios pass.
- The Step 9 watchlist audit is recorded in
  `docs/watchlist-api-contract-audit.md`. Named list and entry schemas now
  require populated products and persisted timestamps. Successful adds attach
  the already-authorized product, so list and mutation responses expose one
  shape while duplicate adds remain idempotent. Every watchlist error response
  constrains its reachable codes and matching examples, and the shared frontend
  collection hook consumes generated types without changing its React Query
  optimistic rollback behavior. All 135 backend tests, 129 frontend tests,
  coverage thresholds, generated-file parity, typecheck, lint, formatting, the
  frontend production build, and all 11 PostgreSQL scenarios pass.
- The Step 9 reviews audit is recorded in
  `docs/reviews-api-contract-audit.md`. Named request, complete persisted review,
  and paginated list schemas now match runtime validation and PostgreSQL output.
  Public reads and verified-buyer upserts constrain every reachable validation,
  authentication, CSRF, product, self-review, and purchase error with matching
  examples. Frontend review queries and mutations consume generated types
  without changing cache replacement or invalidation. All 138 backend tests,
  129 frontend tests, coverage thresholds, generated-file parity, typecheck,
  lint, formatting, the frontend production build, and all 11 PostgreSQL
  scenarios pass.
- The Step 9 notifications audit is recorded in
  `docs/notifications-api-contract-audit.md`. Named complete notification,
  paginated list, unread-count, and read-state request schemas now match runtime
  validation and PostgreSQL output. Every list, count, and update response
  constrains its reachable validation, authentication, CSRF, and
  ownership-concealing not-found errors. Frontend notification hooks consume
  generated types without changing cache replacement, unread-count deltas, or
  invalidation. All 140 backend tests, 129 frontend tests, coverage thresholds,
  generated-file parity, typecheck, lint, formatting, the frontend production
  build, and all 11 PostgreSQL scenarios pass.
- The Step 9 orders audit is recorded in `docs/orders-api-contract-audit.md`.
  Named status, immutable line, history, complete order, list, and mutation
  schemas now match PostgreSQL output. Checkout, scoped lists, and lifecycle
  updates return one complete `Order`; seller updates include only owned lines
  and buyer cancellation includes all lines. Every order error response
  constrains reachable codes and examples. Frontend hooks consume generated
  types, no longer duplicate seller filtering, and suppress anonymous seller
  queries while preserving checkout cart clearing and invalidation. All 142
  backend tests, 129 frontend tests, coverage thresholds, generated-file
  parity, typecheck, lint, formatting, the frontend production build, all 11
  PostgreSQL scenarios, and both Chromium workflows pass.
- The domain-by-domain contract pass now covers products, users/authentication,
  cart, watchlist, reviews, notifications, and orders. Successful resources,
  lists, pagination, mutations, and reachable errors are represented by
  Zod/OpenAPI, and frontend HTTP boundaries consume generated contracts without
  a generated client.
- Product HTTP access now lives in `frontend/src/services/products.ts`. The
  service owns generated request/response types, catalog/seller URL query
  serialization, and detail/create/update Axios calls while
  `frontend/src/serverState/products.ts` retains query keys, enabled state,
  cache replacement, and list invalidation. Focused service tests cover both
  list scopes and every mutation route. All 142 backend tests, 133 frontend
  tests, coverage thresholds, generated-file parity, typecheck, lint,
  formatting, and the frontend production build pass.
- Authentication HTTP access now lives in `frontend/src/services/auth.ts`. The
  service owns generated login and authentication-state types plus login,
  session-restoration, and logout Axios calls. Refresh/retry transport mechanics
  remain in `frontend/src/services/api.ts`, identity lifecycle remains in
  `AuthProvider`, and mutation policy remains in
  `frontend/src/serverState/auth.ts`. Focused service tests cover every route.
  All 142 backend tests, 136 frontend tests, coverage thresholds (87.95% backend
  branches and 91.11% frontend branches), generated-file parity, typecheck,
  lint, formatting, and the frontend production build pass.
- User and seller HTTP access now lives in `frontend/src/services/users.ts` and
  `frontend/src/services/sellers.ts`. The services own generated registration
  and seller-profile types plus their Axios calls, while
  `frontend/src/serverState/users.ts` and
  `frontend/src/serverState/sellers.ts` retain mutation/query construction,
  seller query keys, and enabled state. Focused service tests cover both routes.
  All 142 backend tests, 138 frontend tests, coverage thresholds (87.95% backend
  branches and 91.11% frontend branches), generated-file parity, typecheck,
  lint, formatting, and the frontend production build pass.
- Cart and watchlist HTTP access now lives in
  `frontend/src/services/cart.ts` and
  `frontend/src/services/watchlist.ts`. The shared cart service removes
  duplicated reads and mutations across `frontend/src/serverState/cart.ts` and
  `frontend/src/serverState/productCollections.ts`; those server-state modules
  retain query keys, optimistic updates, rollback, and invalidation. Focused
  service tests cover every cart and watchlist route and documented response.
  All 142 backend tests, 144 frontend tests, coverage thresholds (87.95% backend
  branches and 91.11% frontend branches), generated-file parity, typecheck,
  lint, formatting, and the frontend production build pass.
- Review HTTP access now lives in `frontend/src/services/reviews.ts`. The
  service owns generated review types, paginated and unpaginated list URL
  construction, list reads, and review upserts, while
  `frontend/src/serverState/reviews.ts` retains query keys, placeholder data,
  cache replacement, and invalidation. Focused service tests cover both list
  path forms and the mutation route. All 142 backend tests, 147 frontend tests,
  coverage thresholds (87.95% backend branches and 91.11% frontend branches),
  generated-file parity, typecheck, lint, formatting, and the frontend
  production build pass.
- Notification HTTP access now lives in
  `frontend/src/services/notifications.ts`. The service owns generated
  notification types, pagination URL construction, list and unread-count reads,
  and read-state updates, while
  `frontend/src/serverState/notifications.ts` retains user-scoped query keys,
  placeholder data, unread-count deltas, cache replacement, and invalidation.
  Focused service tests cover all three routes and response transformations.
  All 142 backend tests, 150 frontend tests, coverage thresholds (87.95% backend
  branches and 91.11% frontend branches), generated-file parity, typecheck,
  lint, formatting, and the frontend production build pass.
- Order HTTP access now lives in `frontend/src/services/orders.ts`. The service
  owns generated order types, buyer/seller scope and pagination URL
  construction, list reads, checkout, and lifecycle updates, while
  `frontend/src/serverState/orders.ts` retains query keys, placeholder data,
  order cache replacement, cart clearing, and invalidation. Focused service
  tests cover both list path forms and both mutation routes. The source audit
  finds direct Axios calls only in domain services and the shared refresh
  transport; pages, authentication lifecycle, and server-state modules no
  longer own endpoint calls. All 142 backend tests, 154 frontend tests, coverage
  thresholds (87.95% backend branches and 91.11% frontend branches),
  generated-file parity, typecheck, lint, formatting, the frontend production
  build, all 11 PostgreSQL scenarios, and both Chromium workflows pass. Step 9
  is complete.
- Backend request and application logging now uses Pino and `pino-http` with
  newline-delimited JSON on standard output. Request completion records retain
  the existing correlation ID and include only method, matched route pattern,
  status, duration, tenant, and authenticated-user IDs; raw URLs, headers, and
  bodies are omitted. Application redaction covers cookie, authorization,
  password, token, and CSRF fields, and unexpected errors use Pino's standard
  error serialization while the API keeps its generic 500 response. Focused
  schema, redaction, severity, and error tests pass; all 146 backend tests,
  coverage thresholds (87.72% branches), typecheck, lint, formatting, and the
  production dependency audit pass.
- The provider-neutral production observability policy is recorded in
  `docs/observability.md`. Backend records now carry stable service and
  environment fields. Production keeps a fixed info floor; severity and error
  boundaries distinguish expected 4xx summaries from serialized unexpected
  5xx and fatal failures. Ordinary application logs have a 30-day retention and
  deletion baseline, least-privilege protection requirements, and concrete
  starting alerts for availability, 5xx ratio, fatal startup, latency,
  authentication/CSRF and rate-limit spikes, and ingestion gaps. Hosted logging
  and tracing providers remain deliberately unselected.
- Append-only audit events now use a constrained, tenant-scoped PostgreSQL table
  and a database-neutral repository boundary. Reviewed migration
  `0002_easy_jasper_sitwell.sql` adds actor/resource/timeline indexes and rejects
  ordinary updates and deletes through database triggers. Session creation,
  rotation, replay revocation, individual/all-session revocation, explicit and
  checkout inventory changes, order placement, and order progression insert
  sanitized events in the same PostgreSQL transaction as the domain mutation;
  failed audit insertion rolls the mutation back. No privileged administrator
  mutations currently exist. `docs/audit-events.md` records the event contract,
  sensitive-data boundary, atomic replay behavior, separate pending retention,
  and safe application/schema rollback. All 147 backend tests, 154 frontend
  tests, coverage thresholds (86.99% backend and 91.11% frontend branches),
  typecheck, lint, formatting, Drizzle schema checks, and all 11 PostgreSQL
  integration scenarios pass. Step 10 is complete.
- The email-verification and password-recovery contract is accepted in
  `docs/decisions/0004-account-verification-recovery.md`. It defines
  non-enumerating request responses, provider-neutral delivery, purpose- and
  tenant-bound hashed single-use token records, 8-hour verification and
  30-minute reset lifetimes, email-version binding, dedicated public and hidden
  account abuse limits, existing-user verification backfill, and atomic reset
  token consumption, password replacement, token-version increment,
  all-session revocation, and audit insertion. No email provider is selected.
- The first Step 11 persistence slice is implemented. Reviewed migration
  `0003_famous_miek.sql` adds nullable verification time and non-negative email
  version to users, backfills existing users as verified, and creates the
  tenant-qualified account-token table with purpose, email-version, expiry,
  lifecycle, invalidation-reason, one-active-token, issuance, and cleanup
  constraints/indexes. Database-neutral and PostgreSQL repositories support
  lookup, issuance accounting, conditional single-use consumption,
  invalidation, cleanup, verification, and password/token-version updates; the
  mutation coordinator exposes them for future atomic services. A fourth
  versioned secret ring is validated and documented for account-token HMACs.
  The two user-security audit event types are constrained for the subsequent
  domain service.
  All 156 focused backend tests across 32 files, 154 frontend tests, backend
  coverage thresholds (87.55% branches and 87.05% functions), typecheck, lint,
  formatting, Drizzle schema checks, all 12 PostgreSQL integration scenarios,
  generated-contract parity, and the PostgreSQL production-image smoke lane
  pass.
- The provider-independent Step 11 domain slice is implemented. Account tokens
  use a random UUID selector, 256-bit secret, and tenant/purpose-bound
  HMAC-SHA-256 with retained-key verification; only the selector and hash reach
  persistence. Zod validators normalize non-enumerating requests and validate
  confirmation/password policy before mutation. Independently configurable
  public request/confirmation limits and hidden per-account cooldown/hourly
  issuance limits match ADR 0004. The `AccountMessageSender` port keeps raw
  tokens inside the delivery boundary and capturing test senders prove message
  shape and safe delivery failure. Request services lock the tenant/user before
  replacement and always return the generic response for absent, verified, and
  suppressed accounts. Confirmation services conditionally consume one token;
  email verification and audit insertion commit together, while password reset,
  token-version increment, all-session revocation, peer-token invalidation, and
  both audit events share one transaction. PostgreSQL tests prove one concurrent
  verification winner and complete rollback on forced audit failure. No public
  routes, frontend flow, login enforcement, or provider SDK is added yet. All
  174 focused backend tests across 35 files, 154 frontend tests, backend coverage
  thresholds (88.39% branches and 88.46% functions), typecheck, lint, formatting,
  Drizzle schema checks, all 14 PostgreSQL integration scenarios,
  generated-contract parity, and the PostgreSQL production-image smoke lane
  pass.
- The provider-independent Step 11 HTTP boundary is implemented. Four explicit
  email-verification and password-reset request/confirmation routes enforce the
  allowed Origin, dedicated public limits, Zod validation, and documented
  OpenAPI response/error contracts. Request routes return the same accepted
  response after a configurable common timing floor. Composition exposes
  delivery readiness explicitly: without an injected `AccountMessageSender`,
  every route returns `503 ACCOUNT_DELIVERY_UNAVAILABLE`; a PostgreSQL request
  test injects a capturing sender and completes verification and reset through
  the real Express composition. Successful reset clears browser auth cookies in
  addition to the existing atomic session revocation. Production delivery,
  registration/login verification enforcement, frontend flows, and provider
  selection remain disabled. All 177 backend tests across 36 files, 154 frontend
  tests, backend coverage thresholds (87.87% branches and 87.95% functions),
  typecheck, lint, formatting, Drizzle schema checks, generated OpenAPI/frontend
  contract parity, all 15 PostgreSQL integration scenarios, and the production
  image smoke lane pass with deterministic cleanup.
- The authenticated account-management contract is accepted in
  `docs/decisions/0005-authenticated-account-management.md`. It limits profile
  edits to explicit username/telephone fields; requires current-password
  reauthentication for password change, email-change initiation, and
  deactivation; and revokes every session after credential or confirmed
  identity changes. Email changes use a 30-minute, purpose-bound two-stage flow
  that preserves the current verified login until the new mailbox is confirmed.
  Soft deactivation is blocked by active buyer/seller orders, then archives
  listings, removes disposable cart/watchlist/notification state, hides public
  identity, and preserves products, reviews, orders, history, UUID/email
  reservation, and immutable audit evidence. Hard deletion, reactivation,
  provider selection, and frontend activation remain deliberately out of scope.
- The first ADR 0005 persistence slice is implemented. Reviewed migration
  `0004_melted_nekra.sql` adds `users.deactivated_at` and the tenant/user-scoped
  `pending_email_changes` table with case-insensitive tenant email uniqueness,
  email-version and expiry checks, tenant-qualified foreign keys, replacement
  uniqueness, and cleanup indexing. Account tokens now constrain the
  `email_change` purpose plus `password_change` and `account_deactivated`
  invalidation reasons, while audit events constrain all five accepted
  account-management types. Database-neutral and PostgreSQL repositories expose
  pending-change replacement/locking/deletion/cleanup and conditional profile,
  password, email-promotion, and deactivation writes; the transaction
  coordinator exposes the pending-change repository. Focused and PostgreSQL
  tests prove tenant isolation, case-insensitive pending-address conflicts,
  replacement, invalid-expiry rejection, stale-write rejection, lifecycle
  mapping, new token/audit constraints, and migration application. All 183
  backend tests across 37 files, 154 frontend tests, backend coverage thresholds
  (88.11% branches and 88.58% functions), typecheck, lint, formatting, Drizzle
  schema checks, generated-contract parity, all 16 PostgreSQL integration
  scenarios, and the production-image migration/startup smoke lane pass with
  deterministic cleanup.
- The ADR 0005 provider-independent profile/password domain slice is
  implemented. Strict Zod schemas reject unknown or empty profile fields and
  preserve password bytes without trimming. Profile updates allow only
  normalized username/telephone changes and atomically append an audit event
  containing field names but no values. Password change reads a short
  credential/version snapshot, performs current-password comparison, reuse
  comparison, and replacement hashing outside the mutation transaction, then
  conditionally replaces the password, increments token version, revokes every
  session, invalidates active reset tokens, and appends sanitized password and
  session audit events atomically. PostgreSQL tests synchronize two changes to
  prove one conditional winner and force audit failure to prove complete
  profile/password/session/token rollback. No controller, route, OpenAPI,
  email-change/deactivation service, frontend flow, or provider activation is
  added. All 193 backend tests across 39 files, 154 frontend tests, backend
  coverage thresholds (88.42% branches and 88.81% functions), typecheck, lint,
  formatting, Drizzle schema checks, generated-contract parity, frontend
  production build, and all 18 PostgreSQL integration scenarios pass.
- The ADR 0005 provider-independent two-stage email-change domain slice is
  implemented. Strict validation normalizes only the destination email and
  preserves current-password bytes. Initiation reauthenticates outside a short
  mutation transaction, then conditionally replaces the tenant/user pending
  destination and purpose-bound 30-minute token, appends a sanitized audit, and
  dispatches through the provider-neutral sender only after commit. Confirmation
  accepts only a tenant- and purpose-bound token at the current email version,
  promotes and verifies the pending email, increments email and token versions,
  removes pending state, revokes sessions, invalidates verification, reset, and
  peer email-change tokens, and appends actor-free sanitized audits atomically.
  Focused tests cover validation, conflicts, delivery failure, generic token
  denial, and side effects; PostgreSQL tests prove replacement, tenant isolation,
  a uniqueness race, one-winner confirmation, and complete audit-failure
  rollback. No controller, route, OpenAPI, deactivation service, frontend flow,
  or provider activation is added. All 201 backend tests across 40 files, 154
  frontend tests across 32 files, backend coverage thresholds (88.28% branches
  and 89.13% functions), frontend coverage thresholds (91.11% branches and
  96.42% functions), typecheck, lint, formatting, Drizzle schema checks,
  generated-contract parity, frontend production build, and all 21 PostgreSQL
  integration scenarios pass.
- The ADR 0005 provider-independent soft-deactivation persistence/domain slice
  is implemented. A tenant-scoped lifecycle repository detects active buyer or
  seller orders, archives owned non-archived listings, and deletes cart,
  watchlist, and notification state inside the shared mutation transaction.
  Strict confirmation validation and current-password reauthentication precede
  a locked conditional mutation that clears public profile fields, installs a
  discarded random credential hash, increments token version, revokes sessions
  and all account-token purposes, removes pending email state, applies commerce
  cleanup, and appends sanitized user/session audits atomically. Authentication,
  refresh, access-token validation, session restoration, and public seller reads
  now treat deactivated users as unavailable while tenant/email identity remains
  reserved. Focused tests cover validation, active-order denial, stale state,
  cleanup boundaries, audit safety, and repository behavior. PostgreSQL tests
  prove buyer and seller blocking, one concurrent winner, tenant isolation,
  listing/inventory and historical product/review/order/history retention,
  disposable-state removal, login/public/session denial, email reservation, and
  complete audit-failure rollback. No controller, route, OpenAPI, frontend flow,
  or provider activation is added. All 210 backend tests across 42 files, 154
  frontend tests across 32 files, backend coverage thresholds (88.32% branches
  and 89.28% functions), frontend coverage thresholds (91.11% branches and
  96.42% functions), typecheck, lint, formatting, Drizzle schema checks,
  generated-contract parity, frontend production build, and all 24 PostgreSQL
  integration scenarios pass.
- The ADR 0005 HTTP boundary is implemented for all completed account-management
  services. Controllers and routes expose authenticated, Origin/CSRF-protected
  profile update, password change, email-change initiation, and deactivation,
  plus public Origin-checked email-change confirmation. Password change, email
  initiation, and deactivation have independent tenant/user/normalized-client-IP
  limits; email confirmation has its own public limit. Email routes use the
  provider-neutral delivery readiness boundary, and password change, confirmed
  email change, and deactivation clear all auth cookies only after commit. Zod
  request/response schemas, exact reachable error examples, OpenAPI operations,
  and generated frontend types are updated. Focused tests cover controller
  delegation, cookie clearing, readiness, limiter scoping, configuration, and
  route/contract parity. A PostgreSQL HTTP workflow proves authentication and
  CSRF denial, profile response safety, reauthentication, password/session
  invalidation, unavailable delivery, two-stage email login continuity and
  promotion, cookie clearing, and terminal public/login denial. The integration
  lane raises only its isolated login limit to keep the expanded workflow from
  throttling unrelated scenarios. No frontend page, browser workflow, provider
  selection, or delivery-adapter activation is added. All 217 backend tests
  across 44 files, 154 frontend tests across 32 files, backend coverage
  thresholds (87.98% branches and 89.59% functions), frontend coverage
  thresholds (91.11% branches and 96.42% functions), typecheck, lint,
  formatting, Drizzle schema checks, deterministic OpenAPI/generated-type
  parity, frontend production build, and all 25 PostgreSQL integration scenarios
  pass.
- The provider-neutral account-management frontend is implemented. A protected
  `/account` page exposes profile, password, email-change, and deactivation forms
  through centralized routes, generated request types, domain services, and
  React Query mutations. Each operation has independent pending, success, and
  error state; failed requests preserve inputs and identity, delivery-unavailable
  errors are explicit, and password change or deactivation clears in-memory
  identity before returning to login. The public email-change confirmation page
  consumes its token only from the URL fragment, removes the fragment before
  paint, never persists it, and clears the old identity after success. Header
  navigation and all tenant-sensitive account headings/copy use the typed brand
  configuration. Focused tests cover route/API mapping, route protection,
  profile identity refresh, delivery failure, pending controls, credential and
  deactivation session clearing, local destructive confirmation, fragment
  removal, and confirmation success/failure. All 217 backend tests across 44
  files and 171 frontend tests across 35 files pass; backend coverage is 87.98%
  branches and 89.59% functions, frontend coverage is 90.12% branches and
  96.68% functions, and generated-type parity, typecheck, lint, formatting, and
  the frontend production build pass. Provider selection, adapter activation,
  and browser-stack expansion remain deferred. Step 11 is complete.
- The Step 12 application/schema compatibility and rollback policy is accepted
  in `docs/database-evolution.md`. It audits migrations `0000` through `0004`
  and the one-shot migrate-before-start Compose topology, including the fact
  that Compose does not drain an already running old backend. It defines
  expand/migrate/validate/switch/contract phases, supported old/new application
  overlap, backfill and invariant evidence, deployment abort gates, immutable
  migration history, and when recovery uses application rollback, a
  compensating forward migration, or database restore. No schema changed.
- The accepted Step 12 data-lifecycle policy in `docs/data-lifecycle.md`
  classifies all 15 tables and keeps commerce/account history plus append-only
  audit evidence outside automatic cleanup. Sessions and account tokens retain
  seven-day terminal grace, pending email changes retain 24-hour post-expiry
  grace, read/unread notifications retain 30/180 days after their last explicit
  state update, carts and cascading items retain 30 days after activity, and
  watchlists remain until explicit removal or deactivation. Cart set/removal now
  updates parent activity in the same mutation.
- A provider-neutral one-shot cleanup runner uses a safe dry-run default,
  validated batch/run bounds, stable cutoffs, deterministic `SKIP LOCKED`
  selection, atomic eligibility rechecks, idempotent retry behavior, structured
  summaries, and externally owned daily scheduling/alerts. Focused tests and
  three PostgreSQL scenarios cover configuration, cutoffs, batching, dry-run,
  concurrency, cart activity/cascade, retained relational state, and protection of
  watchlist/audit state. The compiled command passes the production-image smoke
  lane in dry-run mode.
- Backup and recovery objectives, roles, encrypted/isolated artifact metadata,
  verification, restore, and failure procedures are accepted in
  `docs/database-backup-restore.md`. The isolated PostgreSQL 18 rehearsal applies
  `0000` through `0003`, loads representative non-personal data, verifies a
  pre-migration backup, applies `0004`, creates/checksums a current custom-format
  backup, restores into a fresh database, reruns migrations, and validates
  journal parity, counts, tenant-qualified commerce relationships, security
  state, and audit immutability. Measured migration, backup, and restore phases
  pass within the documented baseline; deployment must repeat at expected scale.
- All 227 backend tests across 46 files and 171 frontend tests across 35 files
  pass. Backend coverage passes with 88.15% branches and 89.8% functions;
  frontend coverage passes with 90.12% branches and 96.68% functions. Typecheck,
  lint, formatting, generated-contract parity, Drizzle history checks, all 28
  PostgreSQL scenarios, the production-image smoke, and recovery rehearsal pass.
  Step 12 is complete.
- The roadmap after Step 13 now separates the monetary, payment, fulfillment,
  post-sale, asynchronous-delivery, administration, and advanced-production
  concerns into explicit phases. Libraries may be introduced whenever they
  solve a concrete problem more safely or maintainably than project-owned code;
  selection must still account for security, maintenance, compatibility,
  operational impact, testing, and ownership of core domain rules.
- Step 12.5 is complete. Checkout orchestration is isolated in
  `checkoutService.ts`; account services share only their common token, error,
  password-dependency, and best-effort delivery support; configuration modules
  share environment parsing; and password-change/reset validators share narrow
  refinement helpers without merging domain schemas or public contracts.
- Focused session-service tests now cover creation, rotation, replay,
  concurrency, expiry, credential revocation, and session revocation. Production
  V8 exclusions were removed except for one tenant-qualified foreign-key branch
  that is structurally unreachable. The three previously excluded marketplace
  pages are measured again, production backend source rejects explicit `any`, and
  the brand capability flags match the implemented commerce workflows.
- Buyer and seller order history now shares a tested accessible component, and
  forms share mutation feedback and safe Axios error extraction while retaining
  domain-specific behavior. The tenant logos retain their visual identity at
  158.22 KB and 175.23 KB in the production build, down from approximately 719 KB
  and 773 KB.
- Final verification passes generated-contract parity, typecheck, 243 backend
  tests, 186 frontend tests, lint, formatting, both coverage gates, the frontend
  production build, all 28 PostgreSQL scenarios, and both Chromium workflows.
- Step 13 is complete. Checkout, product creation, and review upsert require
  actor/tenant-scoped UUID idempotency keys; migrations `0005` and `0006`
  persist replay boundaries and request fingerprints, exact retries return the
  stored resource, and conflicting payload reuse is rejected without duplicate
  inventory, cart, notification, history, or audit effects. Inventory and
  profile target-state retries suppress duplicate audits. Account-token,
  registration, and login retry semantics are explicitly documented without
  persisting sensitive credential replay input.
- Sellers can view tenant-scoped quantity/order summaries, low-stock warnings,
  and paginated inventory history, and can search their orders by UUID or sold
  product name and filter by lifecycle status. Revenue remains deferred until
  authoritative monetary snapshots exist. The conditional category review
  found no current hierarchy, governance, or cross-channel discovery need, so
  free-text categories remain and the trigger for managed taxonomy is recorded.
- Generated-contract parity, typecheck, 252 backend tests across 51 files, 189
  frontend tests across 40 files, lint, formatting, both coverage gates,
  frontend and production builds, all 29 PostgreSQL scenarios, both Chromium
  workflows, the seven-migration recovery rehearsal, and the production-image
  smoke pass. Backend coverage passes with 86.05% branches and 90.56%
  functions; frontend coverage passes with 91.02% branches and 95.95%
  functions.
- Next action: begin Step 14 by accepting the tenant currency and exact money
  representation decision before adding product prices or order-line price
  snapshots. Start with the Step 14 checklist and the product/order schema in
  `backend/src/database/schema.ts`; do not infer revenue from current quantities.

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

### 9. Improve API consistency and frontend contract safety (completed)

- [x] Define consistent error, list, pagination, and mutation response shapes in
      Zod and OpenAPI before migrating list consumers.
- [x] Share or generate TypeScript contract types from the existing Zod/OpenAPI
      source so frontend pages do not repeatedly declare approximate API types.
- [x] Organize the Axios layer around small domain services while keeping all
      API paths in `frontend/src/routes.ts`.
- Continue deferring a fully generated API client until maintaining handwritten
  endpoints becomes a measured burden.

### 10. Add production observability and auditability (completed)

- [x] Add structured request and application logging with `pino` and
      `pino-http`, reusing the existing request context and correlation ID.
- [x] Include tenant, route, response status, duration, and safe authenticated
      user context while redacting cookies, authorization headers, passwords,
      tokens, CSRF values, and unnecessary personal data.
- [x] Define production log levels, error serialization, retention, and useful
      operational alerts before selecting a hosted monitoring or tracing provider.
- [x] Add append-only audit events for session, inventory, order, and privileged
      mutations without treating ordinary application logs as the audit record.

### 11. Add account verification, recovery, and management (completed)

- [x] Add email verification and password-reset flows using hashed, expiring,
      single-use tokens and non-enumerating responses.
- [x] Invalidate existing sessions after password reset and apply dedicated rate
      limits to recovery and verification endpoints.
- [x] Add authenticated password change, profile update, sensitive-operation
      reauthentication, email change and reverification, and account deactivation.
- [x] Define and test what happens to listings, reviews, orders, audit history,
      and personal data when an account is deactivated or deleted.
- Choose an email provider SDK only when deployment requirements are known;
  use `nodemailer` only when generic SMTP or local email testing is explicitly
  required.

### 12. Manage database evolution and data lifecycle (completed)

- [x] Establish versioned, repeatable migrations for schema changes, data
      backfills, and index creation instead of relying on implicit startup changes.
- [x] Document compatibility and rollback rules for deployments that span old
      and new application versions.
- [x] Define retention and observable cleanup for temporary security records,
      notifications, abandoned carts, watchlists, and other disposable state
      while preserving commerce/account history and append-only audit evidence.
- [x] Document backup and restore procedures and rehearse a migration and
      restore using production-like, non-personal data.

### 12.5. Stabilize code-quality boundaries before Step 13 (completed)

- [x] Extract checkout orchestration from the multi-domain
      `backend/src/services/commerceService.ts` into a focused service while
      preserving the existing controller contract, repository boundaries,
      transaction scope, inventory rules, notifications, audits, and API behavior.
- [x] Extract narrowly scoped account-domain support for the identical
      account-state and invalid-token errors, tenant/purpose/hash token
      verification, best-effort `AccountMessageSender` dispatch, and default
      password comparison/hashing dependencies used across account management,
      deactivation, verification/recovery, and email change. Preserve each
      service's transaction boundaries, public error contract, and test injection
      points.
- [x] Centralize bounded integer, boolean, list, and related environment parsing
      under a small configuration utility. Preserve every existing variable,
      fallback, accepted range, production validation, and user-visible startup
      error while removing the repeated parsers from runtime, security, and data
      cleanup configuration.
- [x] Share password-strength and confirmation refinement building blocks between
      password change and password reset without merging their operation-specific
      Zod schemas, required fields, application error codes, or OpenAPI metadata.
- [x] Add focused unit coverage for `backend/src/services/sessionService.ts`,
      especially access creation, refresh rotation, replay/concurrency outcomes,
      expiry, and revocation. Keep the PostgreSQL scenarios authoritative for
      transactional behavior rather than duplicating database implementation in
      unit tests.
- [x] Audit every production `v8 ignore` directive. Remove exclusions for paths
      already exercised, add focused tests for reachable untested behavior, and
      retain an exclusion only when the path is structurally unreachable or
      cannot be measured reliably, with a narrow explanation beside it.
- [x] Bring `ProductDetail.tsx`, `Checkout.tsx`, and `SellerProfile.tsx` back into
      measured frontend coverage without replacing their existing integration
      behavior tests with coverage-only aggregate tests.
- [x] Enable the explicit-`any` lint rule for backend production source while
      allowing narrowly scoped test-double exceptions where Express or library
      test typing would otherwise add noise. Keep strict TypeScript authoritative.
- [x] Correct or remove stale brand capability flags so configuration does not
      claim that implemented checkout, review, or favorite workflows are disabled.
- [x] Extract a tested `OrderStatusHistory` presentation component shared by
      buyer checkout history and seller orders so actor, timestamp, semantics,
      and accessibility remain consistent.
- [x] Centralize the small mutation-feedback type, accessible alert/status
      presentation, and safe Axios error-message extraction used by frontend
      forms. Keep domain-specific fallback messages, code overrides, pending
      state, navigation, and cache behavior in their owning pages and hooks.
- [x] Optimize the two tenant logo assets to a reasonable production transfer
      size without changing their visual identity, accessibility, or tenant
      fallback behavior.
- [x] Do not split declarative OpenAPI/schema files or large frontend components
      solely to satisfy a line-count target. Extract them only when cohesion,
      reuse, testing, or an active change provides a concrete boundary.
- [x] Do not replace explicit domain Axios services, React Query hooks,
      tenant-qualified repository predicates, audit payloads, Zod/OpenAPI
      operation metadata, or distinct product/inventory errors with generic
      abstractions merely because their structure is similar.
- [x] Re-run generated-contract parity, typecheck, focused tests, lint,
      formatting, coverage, frontend production build, PostgreSQL integration,
      and any browser workflow affected by the refactor before starting Step 13.

### 13. Complete the operational marketplace baseline

- [x] Make checkout and other retry-sensitive mutations idempotent so retries
      cannot create duplicate orders or side effects.
- [x] Add seller inventory history, low-stock warnings, order search and
      filtering, and basic tenant-scoped quantity and order summaries. Defer
      revenue summaries until Step 14 introduces authoritative monetary data.
- [x] Replace uncontrolled free-text categories with managed taxonomy only if
      catalog requirements need consistent discovery.

### 14.1. Establish exact product pricing (completed)

- [x] Accept USD as the backend-authoritative currency for both current tenants,
      with exponent two and bounded integer minor units represented as decimal
      strings at JSON boundaries.
- [x] Add the compatible monetary expand migration for nullable legacy product
      prices, legacy/priced order shapes, immutable monetary snapshots, and
      append-only tenant-scoped product price history without fabricating values.
- [x] Require canonical tenant-currency prices for new product creation and
      descriptive updates, while retaining nullable responses for legacy rows.
- [x] Append initial and changed prices in the same transaction as product and
      idempotency effects; suppress duplicate history for exact retries and
      unchanged price updates.
- [x] Give both tenants' demo products deliberate USD prices and keep repeated
      seeding idempotent for both current price and price history.
- [x] Parse seller-entered decimal prices and format catalog/detail prices
      without binary floating-point arithmetic.
- [x] Verify generated contracts, typecheck, focused backend/frontend suites,
      lint, formatting, coverage thresholds, the frontend production build, all
      PostgreSQL integration scenarios, and both Chromium workflows.

### 14.2. Complete authoritative checkout totals and revenue (completed)

- [x] Lock tenant product rows during checkout, require current USD prices, and
      reject exact line or aggregate amounts above the accepted minor-unit bound.
- [x] Calculate immutable unit price, line subtotal, order subtotal, explicit
      zero discount, explicit zero shipping, and total with backend `bigint`
      arithmetic; never accept client-submitted amounts.
- [x] Persist priced order headers and lines in the existing short transaction
      with inventory, status history, notifications, audits, cart clearing, and
      idempotency effects.
- [x] Preserve historical `legacy_unpriced` orders without treating absent money
      as zero, and expose the pricing state in the order API and UI.
- [x] Prove exact replay and snapshot immutability after a later catalog price
      edit, together with PostgreSQL monetary constraints and concurrent final
      inventory behavior.
- [x] Display exact cart quotes, buyer totals, seller-owned line subtotals, and
      both built-in brands' USD formatting without binary floating point.
- [x] Suppress other sellers' lines and buyer whole-order totals from every
      seller-only order view, including the combined buyer/seller scope.
- [x] Extend seller summaries with non-cancelled priced-line gross revenue and
      separate priced/legacy order counts. Exclude cancelled and legacy orders;
      do not imply payment capture, settlement, tax, or accounting recognition.
- [x] Verify generated contracts, typecheck, 258 backend tests, 193 frontend
      tests, lint, formatting, both coverage gates, frontend and production
      builds, all PostgreSQL scenarios, both Chromium workflows, production
      smoke, and the eight-migration recovery rehearsal.
