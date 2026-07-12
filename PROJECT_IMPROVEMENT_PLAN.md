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

## Next Steps

### 1. Harden production authentication

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
