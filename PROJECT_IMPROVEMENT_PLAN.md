# MercadoZetta Improvement Plan

## Vision

Transform MercadoZetta from a course marketplace demo into a maintainable,
tested, white-label marketplace foundation. The target architecture should let
one codebase serve multiple brands, themes, copy sets, catalog rules, and
deployment environments without duplicating frontend or backend logic.

## Primary Goals

- Add meaningful automated tests for the main backend and frontend files, with
  measurable code coverage and focused regression protection.
- Refactor the application into a configurable white-label product while
  preserving the current MercadoZetta brand as the default tenant.
- Modernize architecture, security, DX, observability, and product features
  using pragmatic 2026 software architecture standards.
- Keep changes incremental: each phase should leave the app usable and
  deployable.

## Current Baseline

- Backend: Node.js, Express, CommonJS, Mongoose, JWT, Vitest, Supertest.
- Frontend: React, Vite, TypeScript, React Router, Axios, Tailwind CSS,
  Testing Library, Vitest.
- Current tested areas:
  - backend auth, user creation, product creation, and model indexes
  - frontend register, login, and add product flows
- Main gaps:
  - no enforced coverage threshold
  - limited direct tests for route composition, auth middleware branches,
    product listing/search, header state, API interceptor, app routing, and
    failure states
  - brand values are hard-coded in logo, colors, text, routes, metadata, and
    marketplace assumptions
  - backend controllers mix request parsing, validation, persistence, and
    response mapping

## Phase 1 - Coverage Foundation

- Add coverage scripts:
  - root: `npm run test:coverage`
  - backend: `vitest run --coverage`
  - frontend: `vitest run --coverage`
- Add Vitest coverage thresholds:
  - first target: 75% statements, branches, functions, and lines
  - second target: 85%
  - final target: 90%+ for core domain modules
- Exclude only legitimate entry/bootstrap files from coverage:
  - `backend/src/server.js`
  - `frontend/src/main.tsx`
  - generated files and type-only declarations
- Generate `coverage/` outputs locally and keep them ignored by git.
- Add CI-friendly command documentation to README.

## Phase 2 - Backend Unit and Integration Tests

Add or expand tests for each important backend file:

- `backend/src/app.js`
  - mounts JSON middleware and routes
  - returns expected response for `GET /`
- `backend/src/routes.js`
  - exposes canonical public and authenticated routes
  - protects `POST /products` with auth middleware
- `backend/src/middleware/auth.js`
  - missing authorization header
  - invalid `Bearer` format
  - invalid/expired token
  - valid token sets `req.userId` and calls `next`
- `backend/src/controller/authController.js`
  - trims and normalizes email
  - rejects missing credentials
  - rejects unknown user
  - rejects wrong password
  - returns user without password and a signed token
- `backend/src/controller/userController.js`
  - rejects missing required fields
  - rejects invalid email
  - normalizes email
  - rejects duplicate email before create
  - handles Mongo duplicate-key errors
  - never exposes password
- `backend/src/controller/productController.js`
  - lists all products
  - handles list failures
  - rejects invalid product payloads
  - creates product for authenticated seller
  - validates seller id for seller listings
  - lists seller-specific products
- `backend/src/model/user.js`
  - hashes password on create/save
  - does not rehash unchanged password
  - keeps password excluded by default
  - enforces email uniqueness expectation through index test
- `backend/src/model/product.js`
  - requires name, quantity, image, and seller
  - keeps seller index
  - supports timestamps

Recommended backend refactor before expanding too many tests:

- Introduce `services/` for use cases:
  - `authService`
  - `userService`
  - `productService`
- Introduce `validators/` or schema validation with Zod/Joi:
  - `createUserSchema`
  - `loginSchema`
  - `createProductSchema`
- Introduce a shared error mapper:
  - consistent `{ error: { code, message, details } }`
  - predictable HTTP status mapping
- Keep controllers thin: parse request, call service, return response.

## Phase 3 - Frontend Unit and Component Tests

Add or expand tests for each important frontend file:

- `frontend/src/App.tsx`
  - renders correct page for `/`, `/login`, `/register`, `/products/new`, and
    `/sellers/:sellerId`
- `frontend/src/routes.ts`
  - route builders produce stable URLs
  - API route builders match backend contract
- `frontend/src/services/api.ts`
  - uses `VITE_API_URL` or default API URL
  - attaches `Authorization: Bearer <token>` when a token exists
  - does not attach auth header when token is absent
- `frontend/src/pages/header/index.tsx`
  - shows brand logo
  - shows login action for anonymous users
  - hides login action when requested
  - shows authenticated user data
  - clears localStorage and redirects on logout
- `frontend/src/pages/Index.tsx`
  - renders main product experience
  - navigates to account creation
  - navigates to product creation
- `frontend/src/pages/Products.tsx`
  - loads all products on home page
  - loads seller products on seller page
  - shows loading state
  - shows API failure state
  - filters products case-insensitively
  - handles empty search and no-result states
  - renders image alt text from product name, not generic text
- `frontend/src/pages/AddUser.tsx`
  - validates required fields through user-visible errors
  - sends normalized payload
  - handles API validation errors
  - redirects after success
- `frontend/src/pages/Login.tsx`
  - submits credentials
  - stores token and user
  - redirects to seller page
  - shows accessible auth failure message
- `frontend/src/pages/AddProduct.tsx`
  - keeps current tests
  - add invalid localStorage user test
  - add generic API/network error test

Recommended frontend refactor before broadening tests:

- Move repeated localStorage auth logic into `frontend/src/auth/`.
- Move product API calls into `frontend/src/features/products/productApi.ts`.
- Move form state and validation helpers into feature folders.
- Create reusable UI primitives:
  - `Button`
  - `Input`
  - `Alert`
  - `PageShell`
  - `ProductCard`
  - `EmptyState`
  - `LoadingState`
- Prefer accessible roles, labels, and live regions so tests mirror user
  behavior.

## Phase 4 - White-Label Architecture

Refactor around a tenant/brand configuration model. MercadoZetta should become
one default tenant, not the only hard-coded identity.

### White-Label Configuration

Create a shared brand configuration shape:

- `tenantId`
- `brandName`
- `marketplaceName`
- `logo`
- `favicon`
- `primaryColor`
- `secondaryColor`
- `accentColor`
- `surfaceColor`
- `textColor`
- `currency`
- `locale`
- `supportEmail`
- `legalName`
- `copy`
  - header actions
  - empty states
  - form labels
  - validation messages
- `features`
  - sellerPages
  - productCreation
  - publicCatalog
  - checkout
  - reviews
  - favorites
  - inventory

### Frontend White Label

- Add `frontend/src/brands/default.ts` for MercadoZetta defaults.
- Add `frontend/src/brands/schema.ts` for brand config typing.
- Add `BrandProvider` and `useBrand`.
- Replace hard-coded colors with CSS variables generated from the active brand.
- Replace hard-coded logo import with brand logo resolution.
- Replace hard-coded text strings with brand copy tokens where useful.
- Add document title and favicon updates per brand.
- Add tests that render the app with at least two brand configs.
- Keep a fallback brand so local development works without extra env vars.

### Backend White Label

- Add tenant awareness:
  - start simple with `X-Tenant-Id` header or subdomain mapping
  - later support custom domains
- Add tenant fields to tenant-owned records:
  - products
  - users, if accounts are tenant-scoped
  - future orders, carts, reviews, and categories
- Add indexes that include `tenantId`:
  - `{ tenantId: 1, email: 1 }` for users
  - `{ tenantId: 1, seller: 1 }` for products
  - `{ tenantId: 1, name: 'text', description: 'text' }` for search
- Add tenant middleware:
  - resolves tenant
  - validates active tenant
  - attaches `req.tenant`
- Prevent cross-tenant data leaks in every query.
- Add backend tests for tenant isolation.

### White-Label Delivery

- Support build-time config first:
  - `VITE_TENANT_ID`
  - `VITE_BRAND_CONFIG_URL` only when remote config is needed
- Support runtime config later:
  - `/tenant-config.json`
  - backend `/tenants/current`
  - cache headers and fallback strategy
- Add a sample second tenant for tests and demos, for example
  `CampusMarket`, without changing the default MercadoZetta experience.

## Phase 5 - Product and Domain Improvements

Modern marketplace features to consider:

- Categories and subcategories.
- Product detail page with seller information.
- Product availability and numeric inventory instead of string `quant`.
- Product status: draft, active, paused, sold out, archived.
- Image upload flow instead of raw image URL.
- Search with query params and backend filtering.
- Sort and filter by category, seller, availability, and creation date.
- Seller profile page with contact options and public store branding.
- Favorites/watchlist for buyers.
- Cart and checkout simulation for course/demo scope.
- Orders and order history.
- Product reviews and seller ratings.
- Admin dashboard for products, users, tenants, and moderation.
- Audit log for important actions.
- Notifications for product creation, sale, and account events.
- Internationalization with `pt-BR` and `en-US` as first locales.
- Accessibility pass for keyboard navigation, contrast, labels, and focus.

## Phase 6 - Security and Reliability

- Require `JWT_SECRET` outside test/development; avoid silent production
  fallback secrets.
- Add password policy and password length validation.
- Add rate limiting for login and account creation.
- Add helmet/security headers.
- Configure CORS by environment instead of allowing every origin.
- Add centralized request validation.
- Add centralized error handling middleware.
- Add structured logging with request id/correlation id.
- Add health checks:
  - `GET /health`
  - `GET /ready`
- Add graceful shutdown for MongoDB/server.
- Add API response contracts and status-code consistency.
- Add dependency vulnerability checks in CI.
- Add `.env.example` updates whenever config changes.

## Phase 7 - Architecture and DX Modernization

- Introduce feature-based folder structure.
- Keep domain logic independent from Express and React where practical.
- Add path aliases only if they reduce import noise.
- Consider TypeScript migration for the backend after tests are stable.
- Add OpenAPI documentation generated from route schemas.
- Add API client generation only after the API contract stabilizes.
- Add Docker Compose for API, frontend, and MongoDB.
- Add seed scripts for demo tenants, users, and products.
- Add pre-commit checks:
  - lint
  - test related files
  - formatting, if a formatter is introduced
- Add GitHub Actions or equivalent CI:
  - install
  - lint frontend
  - test backend
  - test frontend
  - coverage
  - build frontend
- Add ADRs for major decisions:
  - white-label strategy
  - auth/session model
  - tenant isolation model
  - validation/error format

## Phase 8 - UI/UX Modernization

- Replace the current button-heavy home layout with a marketplace-first page:
  - header with search
  - product grid
  - seller/account actions
  - clear empty/loading/error states
- Add responsive product cards with stable image aspect ratio.
- Add accessible forms with labels, helper text, and error messages.
- Add consistent spacing, typography, and color tokens from the active brand.
- Add skeleton loading for product grids.
- Add toast or inline feedback for successful actions.
- Add a design-token layer for white-label theming.
- Keep UI copy in Portuguese by default, but prepare copy keys for i18n.

## Suggested Target Structure

Backend:

```text
backend/src/
  app.js
  server.js
  config/
  controller/
  errors/
  middleware/
  model/
  routes/
  services/
  tenants/
  validators/
```

Frontend:

```text
frontend/src/
  app/
  auth/
  brands/
  components/
  features/
    products/
    users/
    sellers/
  routes/
  services/
  test/
```

## Definition of Done

- `npm test` passes from the repository root.
- `npm --prefix frontend run lint` passes.
- `npm --prefix frontend run build` passes.
- Coverage thresholds are enforced in CI.
- Main backend controllers, middleware, models, and routes have tests.
- Main frontend pages, routing, API service, and header have tests.
- Default MercadoZetta tenant works with no extra local configuration.
- A second sample tenant can change brand name, logo, colors, and copy through
  configuration.
- Tenant-scoped backend data cannot leak across tenants.
- README documents local setup, test commands, coverage, white-label config, and
  manual smoke tests.

## Near-Term Next Steps

1. Add coverage tooling and thresholds for backend and frontend.
2. Add missing tests for `auth.js`, `Products.tsx`, `header/index.tsx`, and
   `services/api.ts`.
3. Extract shared auth/localStorage helpers in the frontend.
4. Add `BrandProvider` with MercadoZetta as the default brand.
5. Replace hard-coded header logo, colors, and display copy with brand config.
6. Introduce tenant id resolution in backend queries behind a default tenant.
7. Add tenant isolation tests before adding more marketplace features.
