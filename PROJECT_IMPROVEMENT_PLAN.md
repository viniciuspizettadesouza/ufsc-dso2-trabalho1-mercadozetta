# MercadoZetta Improvement Plan

## Vision

Transform MercadoZetta from a course marketplace demo into a maintainable,
tested, white-label marketplace foundation. The target architecture should let
one codebase serve multiple brands, themes, copy sets, catalog rules, and
deployment environments without duplicating frontend or backend logic.

## Current Goals

- Expand MercadoZetta from a catalog demo into a fuller marketplace experience.
- Keep tenant and brand support intact as product features grow.
- Improve security, reliability, architecture, DX, and UI incrementally.
- Keep changes incremental: each phase should leave the app usable and
  deployable.

## Phase 5 - Product and Domain Improvements

Status: in progress.

Modern marketplace features to consider:

- [ ] Categories and subcategories.
- [ ] Product detail page with seller information.
- [x] Product availability and numeric inventory instead of string `quant`.
  - Implemented `inventory` as a numeric product field.
  - Kept `quant` as a legacy create-payload alias for compatibility.
  - Updated product creation, catalog display, tests, and backend docs.
- [x] Product status: draft, active, paused, sold out, archived.
  - Added a persisted product `status` enum with `active` as the default.
  - Added create-payload validation, frontend status selection, catalog status
    badges, and regression tests.
- [ ] Image upload flow instead of raw image URL.
- [ ] Search with query params and backend filtering.
- [ ] Sort and filter by category, seller, availability, and creation date.
- [ ] Seller profile page with contact options and public store branding.
- [ ] Favorites/watchlist for buyers.
- [ ] Cart and checkout simulation for course/demo scope.
- [ ] Orders and order history.
- [ ] Product reviews and seller ratings.
- [ ] Admin dashboard for products, users, tenants, and moderation.
- [ ] Audit log for important actions.
- [ ] Notifications for product creation, sale, and account events.
- [ ] Internationalization with `pt-BR` and `en-US` as first locales.
- [ ] Accessibility pass for keyboard navigation, contrast, labels, and focus.

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
- `npm run test:coverage` passes when behavior or coverage-sensitive code
  changes.
- New product, security, architecture, or UI behavior has focused regression
  tests.
- Tenant-scoped behavior remains isolated.
- Default MercadoZetta and sample tenant branding continue to work.
- README or relevant docs are updated when commands, configuration, or API
  contracts change.

## Near-Term Next Steps

1. Add product status: draft, active, paused, sold out, archived.
2. Add search with query params and backend filtering.
3. Add sort and filters by category, seller, availability, and creation date.
4. Add product detail pages with seller information.
5. Add categories and subcategories.
