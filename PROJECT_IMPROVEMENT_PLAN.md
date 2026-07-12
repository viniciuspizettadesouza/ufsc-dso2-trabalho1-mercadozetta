# MercadoZetta Improvement Plan

## Goal

Keep MercadoZetta reliable, easy to run, and useful as a white-label
marketplace demo while evolving the new persistent commerce workflows safely.

## Current Status

The original improvement plan is complete on
`feat/persistent-commerce-domain`.

- [x] Restore and validate the configured coverage thresholds.
- [x] Document the current API with OpenAPI.
- [x] Generate OpenAPI from shared Zod validation schemas.
- [x] Skip Architecture Decision Records by explicit project decision.
- [x] Persist commerce workflows in MongoDB.

Priority 2 was intentionally skipped because this project does not need ADRs.
Do not add them unless the project scope changes.

Priority 3 is complete:

- Carts, watchlists, orders, order items, reviews, and notifications use
  tenant-scoped MongoDB collections.
- Buyer and seller authorization protects order status and review operations.
- Checkout updates inventory and creates persisted orders and notifications.
- Orders support `placed`, `confirmed`, `shipped`, `delivered`, and `cancelled`
  lifecycle states.
- Reviews require a previous purchase and sellers cannot review their own
  products.
- The frontend uses the commerce API instead of `localStorage` for marketplace
  state. `localStorage` remains only for the existing authentication session.
- The generated OpenAPI 3.1 document covers the commerce endpoints.
- Focused backend and frontend regression tests cover the new workflows.

Toolchain Priority 1 is complete on `chore/eslint-prettier-tooling`:

- ESLint 10 flat configurations remain in place for backend and frontend, with
  `eslint-config-prettier` disabling conflicting formatting rules.
- Prettier 3 formats supported repository files from the root while generated
  OpenAPI, lockfiles, build output, coverage output, and assets are ignored.
- Root `format` and `format:check` scripts and contributor documentation cover
  the formatting workflow.
- The pre-commit hook formats supported staged files with `lint-staged`, while
  pre-push and CI enforce the non-mutating repository-wide formatting check.

## Verified Handoff

- Backend: 173 tests across 30 test files.
- Frontend: 50 tests across 10 test files.
- Backend coverage passes the configured 85% thresholds.
- Frontend coverage passes the configured 90% thresholds.
- Backend TypeScript compilation, repository lint, and frontend production
  build pass.
- The repository-wide Prettier check passes.
- `docs/openapi.json` is generated from Zod schemas and typed operation metadata;
  do not edit it manually.
- Next action: create `chore/typescript-6` after this branch is merged, align the
  backend with the frontend's TypeScript 6 release, and verify runtime TypeScript
  tooling compatibility.

## Recommended Next Steps

Complete the toolchain work one branch at a time. Merge and verify each branch
before creating the next one so formatting changes and compiler migrations stay
easy to review and troubleshoot.

### 1. Standardize ESLint and add Prettier (complete)

Suggested branch: `chore/eslint-prettier-tooling`

- Audit the existing ESLint 10 flat configurations in `backend/` and
  `frontend/`; preserve their current backend, React, and TypeScript rules while
  removing unnecessary duplication where practical.
- Add Prettier for backend and frontend source, tests, configuration, Markdown,
  JSON, and other appropriate repository files, with explicit ignore rules for
  generated files such as `docs/openapi.json`.
- Keep responsibilities separate: ESLint checks code quality and Prettier checks
  formatting. Add root scripts for formatting files and checking formatting in
  CI without rewriting files.
- Integrate Prettier with ESLint only as needed to disable conflicting formatting
  rules; do not run Prettier as an ESLint rule.
- Apply the agreed formatting in this branch and verify lint, type checks, tests,
  coverage, and the frontend production build.
- Document the contributor commands and update the verified handoff before
  merging the branch.

### 2. Complete the TypeScript 6 migration

Suggested branch: `chore/typescript-6`

- Treat the frontend's existing TypeScript 6 dependency as the starting point
  and upgrade the backend from TypeScript 5.5 to the same compatible TypeScript
  6 release.
- Confirm that ESLint, `typescript-eslint`, Vite, Vitest, `ts-node`,
  `ts-node-dev`, declaration packages, and OpenAPI generation support the chosen
  compiler version; upgrade or replace incompatible development tooling when
  necessary.
- Review both applications' `tsconfig` files for TypeScript 6 changes and avoid
  weakening strictness merely to make the migration pass.
- Resolve compiler and test failures in focused commits, regenerate OpenAPI only
  if its checked-in output legitimately changes, and verify the full definition
  of done before merging.
- Update the verified handoff so both applications' exact TypeScript version is
  recorded from the lockfile-installed toolchain.

### 3. Evaluate and, when viable, migrate to TypeScript 7

Suggested branch: `chore/typescript-7`

- Start only after the TypeScript 6 branch is merged and a suitable TypeScript 7
  release is available for this project; do not make this branch depend on an
  unstable compiler in the default development workflow.
- First run a feasibility spike against the real repository: check Node.js,
  editor, ESLint/`typescript-eslint`, Vite, Vitest, runtime TypeScript tooling,
  declaration-package, and source-map compatibility.
- Record blockers in this plan and defer the migration if required tooling does
  not support TypeScript 7. A documented no-go decision is an acceptable outcome
  of the spike.
- If the toolchain is compatible, upgrade backend and frontend together, adopt
  required configuration changes, resolve diagnostics without reducing type
  safety, and run the full definition of done before merging.
- Keep experimental compiler testing separate from the TypeScript 6 baseline so
  the project always has a supported branch to return to.

### 4. Validate the commerce workflows against MongoDB

- Run the Dockerized demo and seed both tenants.
- Exercise a complete buyer-to-seller flow with two users: add to cart, place an
  order, update fulfillment status, deliver it, and submit a review.
- Verify inventory changes, tenant isolation, notifications, and error states
  against the real database rather than mocked models.
- Add a database-backed workflow test for any defect found.

### 5. Make checkout inventory updates atomic

- Use a MongoDB transaction for order creation, order-item insertion, inventory
  decrement, cart clearing, and notification creation.
- Make inventory decrements conditional so concurrent checkouts cannot sell
  more units than are available.
- Add concurrency and rollback regression tests.

### 6. Polish buyer and seller workflow UI

- Add authenticated route guards and clear sign-in prompts for commerce
  actions.
- Add loading, success, and API error feedback to cart, watchlist, review, and
  order actions.
- Add quantity editing, item removal, and disabled checkout for unavailable
  inventory.
- Give sellers a dedicated order view with permitted fulfillment actions.

### 7. Improve notification and order lifecycle behavior

- Add notification read/unread operations and unread counts in the header.
- Define and enforce allowed order-state transitions instead of accepting any
  lifecycle state change.
- Record status history with actor and timestamp for buyer/seller visibility.

### 8. Harden production authentication

- Replace access-token storage in `localStorage` with `HttpOnly`, `Secure`, and
  `SameSite` cookies when preparing a production deployment.
- Add refresh-token rotation or an equivalent short-session renewal strategy.
- Recheck CSRF, CORS, and logout behavior after changing token transport.

## Definition of Done for Future Phases

- `npm test` passes from the repository root.
- `npm run lint` passes from the repository root.
- The Prettier check passes from the repository root after formatting tooling is
  introduced.
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
