# Watchlist API Contract Audit

## Scope

This audit compares the watchlist routes, controller, service, PostgreSQL
repository, Zod/OpenAPI definitions, and the shared frontend product-collection
hook. It does not change watchlist ownership, duplicate-add idempotence, query
keys, or React Query optimistic-update and rollback behavior.

## Concrete gaps found

1. Watchlist reads returned populated products, while successful adds returned
   the same entry with only a product UUID. The anonymous OpenAPI schema exposed
   this implementation inconsistency as a union.
2. Persisted `createdAt` and `updatedAt` values are non-null and returned by both
   repository paths, but the documented response omitted them.
3. The list and entry response schemas were anonymous, leaving generated
   consumers without reusable watchlist types.
4. Watchlist operations used generic authentication and CSRF errors and omitted
   invalid-tenant and invalid-product-ID responses. Adding a missing product can
   also return `404 PRODUCT_NOT_FOUND`.
5. The frontend collection hook used a handwritten product union and untyped
   Axios responses to tolerate the inconsistent read/add shapes.

## Accepted direction

- Define one populated `WatchlistEntry` response and a named `Watchlist` list.
- Have successful adds attach the already-loaded product to the persisted entry
  so reads and mutations expose the same public shape.
- Document exact reachable error codes and examples for every watchlist status.
- Consume generated watchlist types at frontend HTTP boundaries while
  preserving existing optimistic updates and rollback behavior.

## Implemented and verified

- Named `WatchlistEntry` and `Watchlist` schemas now require populated products
  and persisted timestamps.
- Successful adds attach the product already authorized by the service, so add
  and list responses expose the same public entry shape while duplicate adds
  remain idempotent.
- Each watchlist response status constrains its reachable tenant,
  authentication, resource-ID, CSRF, and product-not-found codes with matching
  examples.
- The shared frontend product-collection hook consumes generated watchlist
  response types without changing its query keys, optimistic updates, cache
  invalidation, or rollback behavior.
- Full backend/frontend tests, coverage, typecheck, lint, formatting, generated
  contract parity, the frontend production build, and PostgreSQL integration
  scenarios pass.
