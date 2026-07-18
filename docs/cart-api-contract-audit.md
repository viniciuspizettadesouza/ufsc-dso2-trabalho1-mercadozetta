# Cart API Contract Audit

## Scope

This audit compares the cart routes, controller, service, PostgreSQL repository,
Zod/OpenAPI definitions, and frontend detailed-cart and product-collection
hooks. It does not change cart persistence, inventory authority, checkout, or
React Query optimistic-update and rollback behavior.

## Concrete gaps found

1. The anonymous OpenAPI cart schema allowed an optional `_id`, but neither an
   existing nor an empty cart response exposes the internal cart identifier.
2. Cart lines allowed either a product UUID or a populated `Product`. The
   PostgreSQL tenant-qualified foreign key and repository population make the
   public HTTP response a populated product; callers should not handle an
   undocumented degraded shape.
3. Cart item quantities were documented only as integers in responses instead
   of positive integers, and the validated mutation request had no reusable
   named schema.
4. Cart responses used generic authentication, request, and CSRF errors. The
   set-item operation can also return `404 PRODUCT_NOT_FOUND` and
   `409 INSUFFICIENT_INVENTORY`, while all cart routes can reject an invalid
   tenant and item routes can reject invalid resource identifiers.
5. Detailed-cart and catalog/product-detail collection reads used handwritten
   item types or untyped Axios responses rather than the generated contract.

## Accepted direction

- Define named `CartItemRequest`, `CartItem`, and `Cart` schemas beside the
  commerce validators and use the same `Cart` response for reads, updates, and
  removals.
- Document exact reachable error codes and matching examples for each cart
  response status.
- Generate and consume cart request/response types at frontend HTTP boundaries.
- Preserve the existing React Query keys, optimistic updates, invalidation, and
  rollback behavior.

## Implemented and verified

- Named schemas now define the validated cart-item request, populated cart
  line, and public cart response. All cart operations return the same `Cart`.
- The repository contract no longer exposes its unreachable bare-product-ID
  fallback; the tenant-qualified foreign key remains the data invariant.
- Each cart response status constrains its reachable tenant, authentication,
  validation, CSRF, not-found, and inventory-conflict codes with matching
  examples.
- Detailed-cart and product-collection HTTP boundaries consume generated cart
  types. Existing query keys, optimistic updates, invalidation, and rollback
  behavior are unchanged and their focused tests pass.
- Full backend/frontend tests, coverage, typecheck, lint, formatting, generated
  contract parity, the frontend production build, and PostgreSQL integration
  scenarios pass.
