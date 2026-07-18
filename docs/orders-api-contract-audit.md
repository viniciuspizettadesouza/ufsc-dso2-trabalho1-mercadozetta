# Orders API Contract Audit

## Scope

This audit compares order list, checkout, and lifecycle routes with validation,
controller/service authorization, PostgreSQL repositories, OpenAPI, and frontend
buyer/seller order hooks. It does not change checkout transaction boundaries,
inventory authority, seller visibility, buyer cancellation rules, status
transitions, notifications, or cache clearing/invalidation.

## Concrete gaps found

1. Persisted orders always return `createdAt` and `updatedAt`, but the anonymous
   OpenAPI and handwritten frontend types omitted them.
2. Runtime order lines include immutable tenant, order, product, seller, product
   name, and quantity fields. OpenAPI omitted tenant and order identifiers, while
   the frontend made seller optional.
3. Checkout and lists returned orders with items, but lifecycle updates returned
   an order without items while OpenAPI claimed the same full shape.
4. Paginated list, checkout, and lifecycle responses had no reusable named order
   schemas; the status request also duplicated the actual validator.
5. Frontend seller lists repeated line-item filtering already enforced by the
   backend, which could hide a backend scoping regression instead of exposing it.
6. Order operations omitted invalid tenant/query/path/body, empty-cart,
   authentication, CSRF, inventory, ownership, not-found, and transition errors.

## Accepted direction

- Define named order status, item, history, order, list, and status-request
  schemas beside commerce validation.
- Return a complete, requester-scoped `Order` after lifecycle updates: all items
  for buyer cancellation and only owned items for seller transitions.
- Document exact reachable error codes and matching examples for every order
  response status.
- Consume generated order types at frontend boundaries, remove redundant seller
  filtering, and preserve checkout cart clearing and query invalidation.

## Implemented and verified

- Named status, status-request, immutable item, history, complete order, and
  paginated order-list schemas now require persisted timestamps and ownership
  fields.
- Checkout, buyer/seller lists, and lifecycle updates return one complete
  `Order` shape. Lifecycle updates return all items for buyer cancellation and
  only the acting seller's items for seller transitions.
- Each order response status constrains its reachable tenant, query/path/body,
  empty-cart, authentication, CSRF, inventory, ownership, not-found, and
  transition codes with matching examples.
- Frontend order hooks consume generated types and trust backend seller scoping;
  anonymous seller queries are disabled. Checkout cart clearing, cache updates,
  and invalidation remain intact.
- Full backend/frontend tests, coverage, typecheck, lint, formatting, generated
  contract parity, the frontend production build, PostgreSQL integration, and
  both browser workflows pass.
