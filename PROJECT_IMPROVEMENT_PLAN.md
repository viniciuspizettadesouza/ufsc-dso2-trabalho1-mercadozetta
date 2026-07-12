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
- Backend: 173 tests across 30 test files.
- Frontend: 50 tests across 10 test files.
- Type checks, lint, formatting, coverage, OpenAPI generation, and the frontend
  production build pass.
- Next action: run the Dockerized demo and seed both tenants to begin validating
  the commerce workflows against MongoDB.

## Next Steps

### 1. Validate the commerce workflows against MongoDB

- Run the Dockerized demo and seed both tenants.
- Exercise a complete buyer-to-seller flow with two users: add to cart, place an
  order, update fulfillment status, deliver it, and submit a review.
- Verify inventory changes, tenant isolation, notifications, and error states
  against the real database rather than mocked models.
- Add a database-backed workflow test for any defect found.

### 2. Make checkout inventory updates atomic

- Use a MongoDB transaction for order creation, order-item insertion, inventory
  decrement, cart clearing, and notification creation.
- Make inventory decrements conditional so concurrent checkouts cannot sell
  more units than are available.
- Add concurrency and rollback regression tests.

### 3. Polish buyer and seller workflow UI

- Add authenticated route guards and clear sign-in prompts for commerce
  actions.
- Add loading, success, and API error feedback to cart, watchlist, review, and
  order actions.
- Add quantity editing, item removal, and disabled checkout for unavailable
  inventory.
- Give sellers a dedicated order view with permitted fulfillment actions.

### 4. Improve notification and order lifecycle behavior

- Add notification read/unread operations and unread counts in the header.
- Define and enforce allowed order-state transitions instead of accepting any
  lifecycle state change.
- Record status history with actor and timestamp for buyer/seller visibility.

### 5. Harden production authentication

- Replace access-token storage in `localStorage` with `HttpOnly`, `Secure`, and
  `SameSite` cookies when preparing a production deployment.
- Add refresh-token rotation or an equivalent short-session renewal strategy.
- Recheck CSRF, CORS, and logout behavior after changing token transport.

## Definition of Done for Future Phases

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
