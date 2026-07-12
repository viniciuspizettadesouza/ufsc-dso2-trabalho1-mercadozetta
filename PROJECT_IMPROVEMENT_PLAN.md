# MercadoZetta Improvement Plan

## Goal

Keep MercadoZetta reliable, easy to run, and useful as a white-label
marketplace demo while evolving the new persistent commerce workflows safely.

## Current Status

The original improvement plan is complete on
`feat/persistent-commerce-domain`.

- [x] Restore and validate the configured coverage thresholds.
- [x] Document the current API with OpenAPI.
- [x] Generate OpenAPI from shared Zod validation schemas.
- [x] Skip Architecture Decision Records by explicit project decision.
- [x] Persist commerce workflows in MongoDB.

Priority 2 was intentionally skipped because this project does not need ADRs.
Do not add them unless the project scope changes.

Priority 3 is complete:

- Carts, watchlists, orders, order items, reviews, and notifications use
  tenant-scoped MongoDB collections.
- Buyer and seller authorization protects order status and review operations.
- Checkout updates inventory and creates persisted orders and notifications.
- Orders support `placed`, `confirmed`, `shipped`, `delivered`, and `cancelled`
  lifecycle states.
- Reviews require a previous purchase and sellers cannot review their own
  products.
- The frontend uses the commerce API instead of `localStorage` for marketplace
  state. `localStorage` remains only for the existing authentication session.
- The generated OpenAPI 3.1 document covers the commerce endpoints.
- Focused backend and frontend regression tests cover the new workflows.

## Verified Handoff

- Backend: 173 tests across 30 test files.
- Frontend: 50 tests across 10 test files.
- Backend coverage passes the configured 85% thresholds.
- Frontend coverage passes the configured 90% thresholds.
- Backend TypeScript compilation, repository lint, and frontend production
  build pass.
- `docs/openapi.json` is generated from Zod schemas and typed operation metadata;
  do not edit it manually.

## Recommended Next Steps

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
