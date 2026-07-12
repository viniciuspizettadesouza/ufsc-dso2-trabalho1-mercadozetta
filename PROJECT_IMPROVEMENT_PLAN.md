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
- Type checks, lint, formatting, OpenAPI generation, and the frontend production
  build pass.
- The Dockerized buyer-to-seller workflow passes against MongoDB for both
  tenant isolation and persisted cart, order, inventory, notification, and
  review behavior.
- Checkout now commits order creation, order items, conditional inventory
  decrements, cart clearing, and notifications in one MongoDB transaction.
- The Dockerized MongoDB service runs as a single-node replica set so local
  checkout behavior matches the transaction requirement.
- A separate `npm run test:integration` lane builds an ephemeral MongoDB 7
  replica set, runs 7 database-backed tests across 4 files against the real
  Express app and Mongoose models, and cleans up its isolated Compose project
  and database deterministically.
- Database-backed coverage now verifies atomic checkout and rollback, cart and
  watchlist persistence, order visibility and fulfillment, verified-purchase
  reviews, notifications, tenant and compound-index isolation, token-version
  logout revocation, and repeatable non-destructive demo seeding.
- The full backend and frontend tests, lint, formatting, and frontend build pass.
- Backend coverage passes under the required Node.js 24.18.0 runtime, with all
  175 tests passing and 85.18% branch coverage against the 85% threshold.
- Next action: add shared authenticated route protection and sign-in prompts.
  Start in `frontend/src/App.tsx`, add focused route-guard tests alongside it,
  and cover `/checkout`, `/products/new`, and `/admin` while keeping catalog,
  product detail, seller, login, and registration routes public.

## Next Steps

### 1. Polish buyer and seller workflow UI

- Add authenticated route guards and clear sign-in prompts for commerce
  actions.
- Add loading, success, and API error feedback to cart, watchlist, review, and
  order actions.
- Add quantity editing, item removal, and disabled checkout for unavailable
  inventory.
- Give sellers a dedicated order view with permitted fulfillment actions.

### 2. Improve notification and order lifecycle behavior

- Add notification read/unread operations and unread counts in the header.
- Define and enforce allowed order-state transitions instead of accepting any
  lifecycle state change.
- Record status history with actor and timestamp for buyer/seller visibility.

### 3. Harden production authentication

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
