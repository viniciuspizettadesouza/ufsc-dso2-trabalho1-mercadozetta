# MercadoZetta Course Polish Plan

## Summary

Improve MercadoZetta as a complete course project by tightening the marketplace
flow, making errors visible to users, cleaning up API routes, and expanding
tests/docs around the main user journeys: register, log in, create product, and
view/search products.

## Key Changes

- Add frontend loading and error states for:
  - product list loading/fetch failure
- Polish product listing:
  - make search work predictably with empty, short, and no-result queries
- Update README with final route list, environment setup, test command, and
  manual smoke-test checklist.

## Next

- Improve product list loading/fetch failure states and search empty-state
  behavior in `Products.tsx`.

## Public Interfaces

- No new required environment variables.
- Canonical API contract:
  - `POST /users` receives `{ username, telephone, email, password }`
  - `POST /auth/login` receives `{ email, password }` and returns
    `{ user, token }`
  - `POST /products` requires `Authorization: Bearer <token>` and receives
    `{ name, description, quant, image }`
  - `GET /products` returns all products
  - `GET /users/:userId/products` returns products for one seller
- Canonical frontend paths:
  - `/register` creates a user account
  - `/login` authenticates a user
  - `/products/new` creates a product
  - `/sellers/:sellerId` shows one seller's products

## Test Plan

- Run `npm test` from the repository root.
- Add/expand backend tests for:
  - invalid user payloads
  - seller-specific product listing
- Add/expand frontend tests for:
  - product list renders products, search results, and empty state
- Run `npm --prefix frontend run build`.
- Run `npm --prefix frontend run lint`.

## Assumptions

- The goal is course/project polish, not a major feature expansion.
- MongoDB remains the persistence layer.
- JWT auth remains localStorage-based for this version.
- The app language can stay mostly Portuguese in the UI.
- Visual redesign should be modest: improve clarity and states without replacing
  the whole UI.
