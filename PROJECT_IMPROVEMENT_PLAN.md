# MercadoZetta Improvement Plan

## Goal

Keep MercadoZetta reliable, easy to run, and useful as a white-label
marketplace demo while evolving the new persistent commerce workflows safely.

## Verified Handoff

- Local development, CI, and Docker target Node.js 24.18.0 LTS, with backend
  declarations provided by the lockfile-installed `@types/node` 24.13.3.
- Backend and frontend use the lockfile-installed TypeScript 6.0.3 compiler.
- TypeScript 7 is deferred until `typescript-eslint` publishes a compatible
  release; version 8.63.0 and its current canary support TypeScript only through
  versions earlier than 6.1.0.
- Backend: 175 tests across 30 test files.
- Frontend: 50 tests across 10 test files.
- Type checks, lint, formatting, coverage, OpenAPI generation, and the frontend
  production build pass.
- The Dockerized buyer-to-seller workflow passes against MongoDB for both
  tenant isolation and persisted cart, order, inventory, notification, and
  review behavior.
- Checkout now commits order creation, order items, conditional inventory
  decrements, cart clearing, and notifications in one MongoDB transaction.
- The Dockerized MongoDB service runs as a single-node replica set so local
  checkout behavior matches the transaction requirement.
- A separate `npm run test:integration` lane now builds an ephemeral MongoDB 7
  replica set, runs the real Express checkout route and Mongoose models, and
  cleans up its isolated Compose project and database deterministically.
- Database-backed checkout coverage verifies that two buyers racing for the
  final unit produce one order and one inventory conflict, with no negative
  inventory and no losing order, order item, notification, or cart mutation.
- Next action: extend the database-backed suite with cart and watchlist
  persistence, tenant isolation, and compound-index behavior.

## Next Steps

### 1. Add database-backed integration coverage

Foundation complete: the isolated replica-set runner and atomic checkout
concurrency/rollback scenario run locally and in CI. Continue this phase with
cart/watchlist persistence and tenant/index isolation coverage.

- Add an isolated integration-test database backed by a MongoDB replica set,
  with deterministic setup, cleanup, and a command suitable for local and CI
  execution.
- Run the real Express routes, Mongoose models, middleware, indexes, and
  transactions without replacing persistence modules with mocks.
- Verify two buyers concurrently checking out the final unit produce exactly
  one successful order and one inventory conflict, without negative inventory.
- Verify a failed checkout rolls back the order, order items, inventory,
  notifications, and cart clearing while preserving the losing buyer's cart.
- Cover cart and watchlist persistence, order visibility and fulfillment,
  verified-purchase reviews, notification creation, and their important error
  states across real database reads and writes.
- Cover tenant isolation for users, products, carts, watchlists, orders, order
  items, reviews, and notifications, including duplicate-email and compound
  index behavior that mocked models cannot enforce.
- Verify authentication token-version persistence and logout revocation through
  real user records, while keeping detailed validation and controller mapping
  scenarios in focused unit tests.
- Verify demo seeding is repeatable for both tenants and does not overwrite or
  remove unrelated records.
- Keep browser end-to-end tests out of this phase; add them with the upcoming UI
  workflow work where they can validate navigation and user-visible feedback.

### 2. Polish buyer and seller workflow UI

- Add authenticated route guards and clear sign-in prompts for commerce
  actions.
- Add loading, success, and API error feedback to cart, watchlist, review, and
  order actions.
- Add quantity editing, item removal, and disabled checkout for unavailable
  inventory.
- Give sellers a dedicated order view with permitted fulfillment actions.

### 3. Improve notification and order lifecycle behavior

- Add notification read/unread operations and unread counts in the header.
- Define and enforce allowed order-state transitions instead of accepting any
  lifecycle state change.
- Record status history with actor and timestamp for buyer/seller visibility.

### 4. Harden production authentication

- Replace access-token storage in `localStorage` with `HttpOnly`, `Secure`, and
  `SameSite` cookies when preparing a production deployment.
- Add refresh-token rotation or an equivalent short-session renewal strategy.
- Recheck CSRF, CORS, and logout behavior after changing token transport.

## Definition of Done

- `npm test` passes from the repository root.
- `npm run lint` passes from the repository root.
- `npm run format:check` passes from the repository root.
- `npm --prefix frontend run build` passes.
- `npm run test:coverage` passes for behavior or coverage-sensitive changes.
- New scenarios are added to the focused test file associated with their source
  module; aggregate files remain limited to integration, contract, routing, or
  genuine workflow tests.
- Tenant-owned reads and writes remain tenant-scoped.
- Default MercadoZetta and CampusMarket branding continue to work.
- Request or response changes update Zod schemas, typed OpenAPI metadata, and
  the generated contract.
- Configuration, behavior, and operational changes update the relevant docs.
