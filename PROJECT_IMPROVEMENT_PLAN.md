# MercadoZetta Course Polish Plan

## Summary

Improve MercadoZetta as a complete course project by tightening the marketplace
flow, making errors visible to users, cleaning up API routes, and expanding
tests/docs around the main user journeys: register, log in, create product, and
view/search products.

## Key Changes

- Standardize backend API routes around:
  - `POST /add-user`
  - `POST /login`
  - `GET /products`
  - `GET /users/:userID/products`
  - `POST /products`
- Keep old duplicate product routes only if needed temporarily, but document the
  canonical routes.
- Improve backend validation responses for user creation, login, and product
  creation.
- Make protected product creation fail clearly when the user is not logged in.
- Add frontend loading and error states for:
  - login failure
  - account creation failure
  - product creation failure
  - product list loading/fetch failure
- Improve logged-in flow:
  - after login, show seller info in header
  - product creation uses stored JWT automatically
  - after creating a product, redirect to the logged-in seller page
- Polish product listing:
  - preserve global product list on `/`
  - show seller-specific products on `/user/:id`
  - make search work predictably with empty, short, and no-result queries
- Rename misleading component function names like `Login` inside `Index.tsx`,
  `AddUser.tsx`, and `AddProduct.tsx` to match their files.
- Update README with final route list, environment setup, test command, and
  manual smoke-test checklist.

## Public Interfaces

- No new required environment variables.
- Canonical API contract:
  - `POST /add-user` receives `{ username, telephone, email, password }`
  - `POST /login` receives `{ email, password }` and returns `{ user, token }`
  - `POST /products` requires `Authorization: Bearer <token>` and receives
    `{ name, description, quant, image }`
  - `GET /products` returns all products
  - `GET /users/:userID/products` returns products for one seller

## Test Plan

- Run `npm test` from the repository root.
- Add/expand backend tests for:
  - invalid user payloads
  - duplicate email
  - invalid login
  - unauthenticated product creation
  - authenticated product creation linked to seller
  - seller-specific product listing
- Add/expand frontend tests for:
  - successful login stores token and redirects
  - login error appears on failure
  - product form shows auth/API errors
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
