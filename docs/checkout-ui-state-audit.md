# Cart, Checkout, and Buyer Orders UI State Audit

## Scope

This audit covers the completed Step 17 buyer foundation: cart and order state
ownership, saved delivery addresses, authoritative quotes, final review, and
buyer history. Payment remains outside this foundation.

## Contract and ownership findings

- `GET /cart` and both cart-item mutations return the same tenant/user-scoped
  populated `Cart`. The cart stores product and quantity; displayed prices are
  current quotes rather than reservations. The accepted response and error
  contract is recorded in [Cart API Contract Audit](cart-api-contract-audit.md).
- `POST /orders` is the authoritative local checkout command. It locks and
  revalidates the cart, address, quote fingerprint, and products; snapshots
  exact amounts and delivery facts; creates one order, decrements inventory,
  clears the cart, and records notifications atomically.
  The client retains one idempotency key across ambiguous retries.
- `GET /orders?scope=buyer` is the paginated buyer-history source. It is not
  needed to render or submit the current cart. The accepted order shapes and
  visibility rules are recorded in
  [Orders API Contract Audit](orders-api-contract-audit.md).
- React Query owns remote cart and order state. Detailed cart lines use the
  user-scoped `queryKeys.cart.items(userId)` cache. Catalog membership state is
  coordinated with it after every cart mutation; mutation responses replace
  the detailed cache with the server result. The header derives its quantity
  count directly from that detailed cache instead of introducing local cart
  state or another request.
- Buyer order lists retain their existing request-scoped query keys. Successful
  checkout inserts the returned order into the matching cached first page,
  invalidates other order lists, and clears both cart cache projections.

## Implemented route responsibilities

- `/cart` owns persistent quantity editing, removal, unavailable-item recovery,
  the current exact quote, and navigation to final review.
- `/checkout` reads the same cart cache, presents a read-only final line and
  amount review, combines it with the selected saved address and deterministic
  delivery option, loads the authoritative quote, and owns only the idempotent
  place-order action.
- `/account/addresses` owns saved-address creation, editing, default selection,
  and explicit deletion. Address queries and mutations are user-scoped remote
  state; an order stores a copy rather than following later address changes.
- `/orders` owns paginated buyer history, immutable line amounts and currencies,
  legacy-unpriced labeling, and status history.
- The authenticated header links to cart and buyer orders. Its cart badge sums
  quantities from the canonical detailed-cart cache, so optimistic edits,
  authoritative mutation responses, and successful checkout remain visible
  across routes without a second client-side cart store.

The deterministic standard and express fees and estimates are a demo adapter,
not live carrier data. Checkout accepts no promotion input and therefore only
the validated zero discount. A price, stock, address, or delivery change makes
the quote fingerprint stale; the UI refreshes the quote and leaves the cart
intact. Payment readiness remains a separate Step 18 concern.
