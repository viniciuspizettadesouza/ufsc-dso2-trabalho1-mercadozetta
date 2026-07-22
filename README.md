# MercadoZetta

MercadoZetta is an educational white-label marketplace built for INE5612 —
Desenvolvimento de Sistemas Orientados a Objetos II. One React application and
one Express API serve the built-in MercadoZetta and CampusMarket tenants while
tenant-owned PostgreSQL records are isolated by `tenantId`.

The implemented application includes a public catalog and seller profiles,
account registration and JWT login, product creation, persistent carts and
watchlists, transactional checkout and inventory updates, buyer and seller
order workflows, verified-purchase reviews, notifications, and repeatable demo
data. It includes a production container baseline, while remaining a
development and teaching system rather than a turnkey hosted service.

For the design and business-rule explanation, read the
[project overview](docs/project-overview.md). Detailed authentication behavior
is in the [authentication flow](docs/authentication-flow.md), the generated HTTP
reference is [OpenAPI 3.1](docs/openapi.json), and current priorities and status
belong only in the [improvement plan](PROJECT_IMPROVEMENT_PLAN.md).

## Prerequisites

- Node.js 24.18.0 or newer (the repository includes `.nvmrc`)
- npm
- Git
- Docker with Compose for PostgreSQL, the complete demo stack, or
  database-backed integration tests

## Quick start

From the repository root:

```bash
nvm use
npm install
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

For the repository PostgreSQL container, set the copied `backend/.env`
connection URL to:

```env
POSTGRESQL_URL=postgresql://mercadozetta:local-development-only@localhost:5432/mercadozetta
```

Then start PostgreSQL, apply the committed migrations, and run both development
servers:

```bash
npm run dev:local
```

`dev:local` starts Dockerized PostgreSQL and then runs both
development servers. The API listens on `http://localhost:3333`; Vite normally
prints `http://localhost:5173` for the frontend. It does not insert demo data.

Seed deterministic data in another terminal:

```bash
npm run seed:demo
```

The seed refreshes its own PostgreSQL records for both built-in tenants in one
transaction and leaves unrelated local records intact.

## Installation

The root, backend, and frontend have separate lockfiles and dependency trees.
Install all three from the repository root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Use `npm ci` in CI or whenever exact lockfile installation is required.

## Configuration

Copy the checked-in examples; never commit the resulting `.env` files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend variables

| Variable                                                                 | Purpose                                                | Local example/default behavior                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `POSTGRESQL_URL`                                                         | PostgreSQL connection string                           | `postgresql://mercadozetta:local-development-only@localhost:5432/mercadozetta` for `npm run db:up` |
| `POSTGRES_POOL_MAX`                                                      | Maximum PostgreSQL pool connections                    | `10`; accepted range is 1 through 50                                                               |
| `POSTGRES_CONNECTION_TIMEOUT_MS` / `POSTGRES_IDLE_TIMEOUT_MS`            | Pool acquisition and idle timeouts                     | `5000` / `30000`                                                                                   |
| `POSTGRES_STATEMENT_TIMEOUT_MS` / `POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS` | Query and idle-transaction limits                      | `10000` / `10000`                                                                                  |
| `JWT_SIGNING_KEYS` / `JWT_ACTIVE_KID`                                    | JSON JWT verification ring and active signer           | Retain old keys only through the bounded access-token overlap                                      |
| `REFRESH_TOKEN_HASH_SECRETS` / `REFRESH_TOKEN_HASH_ACTIVE_VERSION`       | JSON refresh-hash ring and active version              | Keep a version until sessions using it expire or are revoked                                       |
| `CSRF_SECRETS` / `CSRF_ACTIVE_VERSION`                                   | JSON CSRF signing ring and active version              | Keep old versions through their cookie/session overlap                                             |
| `ACCOUNT_TOKEN_HASH_SECRETS` / `ACCOUNT_TOKEN_HASH_ACTIVE_VERSION`       | JSON account-token HMAC ring and active version        | Keep old versions until verification and recovery tokens using them expire                         |
| `EMAIL_VERIFICATION_TOKEN_TTL_MS` / `PASSWORD_RESET_TOKEN_TTL_MS`        | Verification and recovery token lifetimes              | `28800000` (8 hours) / `1800000` (30 minutes)                                                      |
| `EMAIL_CHANGE_TOKEN_TTL_MS`                                              | Pending email-change token lifetime                    | `1800000` (30 minutes)                                                                             |
| `ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS` / `ACCOUNT_TOKEN_ISSUE_WINDOW_MS`      | Hidden per-account issuance cooldown and window        | `60000` / `3600000`                                                                                |
| `ACCOUNT_TOKEN_ISSUE_MAX`                                                | Hidden per-account issues allowed in the window        | `3`                                                                                                |
| `ACCOUNT_REQUEST_RESPONSE_FLOOR_MS`                                      | Minimum account-request response duration              | `500`                                                                                              |
| `SESSION_ACCESS_TOKEN_TTL_MS`                                            | Cookie access-token lifetime                           | `300000` (5 minutes)                                                                               |
| `SESSION_REFRESH_IDLE_TTL_MS`                                            | Rotating refresh idle lifetime                         | `604800000` (7 days)                                                                               |
| `SESSION_ABSOLUTE_TTL_MS`                                                | Maximum session-family lifetime                        | `2592000000` (30 days)                                                                             |
| `SESSION_REFRESH_CONCURRENCY_WINDOW_MS`                                  | Grace window for a parallel refresh loser              | `5000`                                                                                             |
| `TENANT_HEADER_REQUIRED`                                                 | Reject requests without `X-Tenant-Id`                  | `false` locally; defaults to `true` outside development/test                                       |
| `PORT`                                                                   | API listen port                                        | `3333`                                                                                             |
| `TRUST_PROXY_HOPS`                                                       | Exact number of trusted reverse-proxy hops             | `0` locally; production Compose uses `1`                                                           |
| `CORS_ORIGIN`                                                            | Comma-separated allowed browser origins                | `http://localhost:5173` locally                                                                    |
| `PRODUCT_IMAGE_HOSTS`                                                    | Comma-separated hosts allowed for HTTPS product images | `example.com,images.unsplash.com`                                                                  |
| `RATE_LIMIT_AUTH_WINDOW_MS` / `RATE_LIMIT_AUTH_MAX`                      | Login rate-limit window and maximum                    | `900000` / `5`                                                                                     |
| `RATE_LIMIT_REGISTER_WINDOW_MS` / `RATE_LIMIT_REGISTER_MAX`              | Registration rate-limit window and maximum             | `900000` / `10`                                                                                    |
| `RATE_LIMIT_EMAIL_VERIFICATION_REQUEST_*` / `...CONFIRMATION_*`          | Independent verification request/confirmation limits   | `900000` / `5` and `900000` / `10`                                                                 |
| `RATE_LIMIT_PASSWORD_RESET_REQUEST_*` / `...CONFIRMATION_*`              | Independent recovery request/confirmation limits       | `900000` / `5` and `900000` / `10`                                                                 |
| `RATE_LIMIT_PASSWORD_CHANGE_*` / `...EMAIL_CHANGE_REQUEST_*`             | Independent authenticated sensitive-operation limits   | `900000` / `5`                                                                                     |
| `RATE_LIMIT_EMAIL_CHANGE_CONFIRMATION_*` / `...ACCOUNT_DEACTIVATION_*`   | Email confirmation and deactivation limits             | `900000` / `10` and `900000` / `5`                                                                 |

When strict tenant-header mode is enabled, the global tenant middleware also
requires `X-Tenant-Id` on `/`, `/health`, and `/ready`.

### Frontend variables

| Variable         | Purpose                                               | Example                           |
| ---------------- | ----------------------------------------------------- | --------------------------------- |
| `VITE_API_URL`   | Express API base URL                                  | `http://localhost:3333`           |
| `VITE_TENANT_ID` | Selects the frontend brand and outgoing tenant header | `mercadozetta` or `campus-market` |

The tenant header selects a known tenant but is not trusted as authorization.
Backend services scope protected records and ownership checks to the resolved
tenant.

In development, password-reset, email-verification, and email-change requests
write a structured `development_account_message` entry to the backend log. Open
its `deliveryUrl` in the configured `CORS_ORIGIN` frontend. The URL contains a
sensitive single-use token: keep it in local logs only. Production deliberately
has no delivery adapter and rejects these requests until Step 20 supplies a
reviewed provider. The explicit local-only exception and its handling rules are
recorded in
[ADR 0008](docs/decisions/0008-development-account-message-sink.md).

See [Tenant Theming](docs/tenant-theming.md) for the typed theme contract,
Tailwind aliases, adding or modifying a checked-in brand, and required contrast
and accessibility verification.

## Running the project

### Host development servers with Dockerized PostgreSQL

```bash
npm run dev:local
```

Useful variants:

```bash
npm run db:up
npm run db:logs
npm run db:down
npm run dev
npm run dev:backend
npm run dev:frontend
```

`npm run dev` starts both applications but does not start PostgreSQL.

### Complete Docker Compose demo

```bash
npm run compose:up
```

In another terminal:

```bash
npm run compose:seed
```

Stop and remove the application containers with:

```bash
npm run compose:down
```

This Compose stack explicitly selects the Dockerfiles' development stages and
remains intended for development and demonstrations.

### Production container baseline

The separate production topology compiles the backend, serves the frontend
through non-root Nginx, proxies `/api`, and includes health/readiness checks:

```bash
npm run compose:prod:up
npm run compose:prod:down
```

Required secrets and the public `CORS_ORIGIN` must be exported first. See the
[production deployment guide](docs/production-deployment.md) for TLS,
trusted-proxy, deployment, smoke-test, and rollback requirements.

## Demo data and smoke test

Run either `npm run seed:demo` for the host-side backend or
`npm run compose:seed` for the default PostgreSQL Compose stack.
The built-in seller credentials are:

| Tenant       | Email                         | Password          |
| ------------ | ----------------------------- | ----------------- |
| MercadoZetta | `vinicius@mercadozetta.test`  | `mercadozetta123` |
| CampusMarket | `vinicius@campus-market.test` | `campusmarket123` |

For a basic smoke test:

1. Open the Vite URL and confirm that seeded products appear.
2. Log in with the account for the configured `VITE_TENANT_ID`.
3. Add an in-stock product to the watchlist and cart.
4. Open `/cart`, change a quantity, then create a default address at
   `/account/addresses` and continue to `/checkout`.
5. Review the lines, selected address, explicitly demo-only delivery estimate,
   subtotal, zero discount, shipping, and authoritative total. Place the order
   and verify the immutable delivery snapshot in `/orders`.
6. Open `/seller/orders` as a seller and verify only that seller's line items
   and immutable line subtotals are shown with the permitted next fulfillment
   action. The operations summary reports non-cancelled priced-order gross
   revenue and counts legacy unpriced orders separately.
7. Return as the buyer to inspect the immutable order total, history, and
   notifications.

The frontend also exposes `/products/new` for authenticated product creation
and `/products/:productId/edit` for owner-only detail, inventory, and lifecycle
management. Absolute product image URLs must use HTTPS and an exact host from
`PRODUCT_IMAGE_HOSTS`; relative application asset paths are also accepted.

Catalog, seller-product, order, review, and notification API lists use bounded
offset pagination. `limit` defaults to 20 and cannot exceed 100; `offset`
defaults to 0. Responses use
`{ items, page: { limit, offset, total, hasMore } }`.

## Common commands

Run these from the repository root unless noted otherwise.

| Command                                 | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `npm test`                              | Backend type-check, backend focused/contract tests, and frontend tests           |
| `npm run test:integration`              | PostgreSQL database-backed integration tests; requires Docker                    |
| `npm run test:e2e`                      | Chromium workflows against an isolated PostgreSQL stack; requires Docker         |
| `npm run test:production`               | Build and smoke-test the isolated production container topology; requires Docker |
| `npm run test:recovery`                 | Rehearse PostgreSQL forward migration, backup, fresh restore, and validation     |
| `npm run test:coverage`                 | Backend and frontend coverage suites with configured thresholds                  |
| `npm run typecheck`                     | Backend TypeScript check without emitting                                        |
| `npm run lint`                          | Backend and frontend ESLint checks                                               |
| `npm run format:check`                  | Check Prettier formatting without rewriting files                                |
| `npm run format`                        | Format supported repository files                                                |
| `npm --prefix frontend run build`       | Type-check and create the frontend production bundle                             |
| `npm run generate:openapi`              | Regenerate `docs/openapi.json` from validators and route metadata                |
| `npm --prefix backend run db:generate`  | Generate a reviewable Drizzle SQL migration from the PostgreSQL schema           |
| `npm --prefix backend run db:check`     | Check the consistency of the Drizzle migration history                           |
| `npm --prefix backend run db:migrate`   | Apply committed PostgreSQL migrations using `POSTGRESQL_URL`                     |
| `npm --prefix backend run cleanup:data` | Preview or run bounded retention cleanup using the configured dry-run mode       |
| `npm run seed:demo`                     | Refresh repeatable demo data                                                     |

See the [accessibility verification guide](docs/accessibility.md) for automated
checks and the manual keyboard and screen-reader smoke test.

Dependency audits are run separately because there is no root aggregate script:

```bash
npm audit --audit-level=high
npm --prefix backend audit --audit-level=high
npm --prefix frontend audit --audit-level=high
```

CI installs all three dependency trees and runs audits, backend type-checking,
formatting, lint, backend and frontend tests, database integration tests, the
frontend build, and the production image smoke lane. Coverage is enforced by
the coverage command, not by the current CI workflow. Git hooks format
supported staged files before commits and run formatting plus the main test
suite before pushes.

## Repository map

```text
backend/src/       Express API, middleware, validators, services, and models
backend/test/      Focused, contract, workflow, and database integration tests
frontend/src/      React pages, routing, API service, brand configuration, tests
docs/              Architecture, authentication, and generated API reference
images/            Documentation images
scripts/           Repository-level test orchestration
```

See the [project overview](docs/project-overview.md#repository-structure) for
the boundaries between these areas rather than relying on the directory list
alone.

## API contract

[`docs/openapi.json`](docs/openapi.json) is generated from backend Zod schemas
and typed operation/response metadata. Do not edit it manually. After changing
a route, validator, security requirement, request or response schema, or
example, run:

```bash
npm run generate:openapi
```

`backend/test/openapi-contract.test.ts` checks deterministic generated-file
parity, implemented/documented route parity, and required examples.

## Troubleshooting

### PostgreSQL migrations have not been applied

Start the repository database with `npm run db:up`, apply the schema with
`npm --prefix backend run db:migrate`, and set `POSTGRESQL_URL` to
`postgresql://mercadozetta:local-development-only@localhost:5432/mercadozetta`
when using the repository PostgreSQL container. The complete Compose stacks
apply migrations before starting the backend.

### The API exits during startup

Confirm that `backend/.env` contains a reachable `POSTGRESQL_URL`. Outside
development and test, configure each active versioned security key ring. Check
PostgreSQL and call `/ready` with the tenant header if strict tenant mode is
enabled.

### Requests return `TENANT_HEADER_REQUIRED` or `INVALID_TENANT`

Set `VITE_TENANT_ID` to `mercadozetta` or `campus-market`, restart Vite after
changing its environment, and ensure direct API requests include the matching
`X-Tenant-Id`. In strict mode the header is required even for health checks.

### Authenticated requests return 401

The cookie session may be missing, expired, tenant-mismatched, or revoked by a
logout that incremented the user's token version. Reload once to allow automatic
renewal; if renewal fails, log in again. See the [authentication flow](docs/authentication-flow.md)
for the exact lifecycle.

### Browser requests fail while direct API calls work

Make sure the frontend origin, including its port, is present in
`CORS_ORIGIN`. Multiple origins are comma-separated. Restart the backend after
changing the value.

### Ports 3333, 5173, or 5432 are already in use

Stop the conflicting process or existing Compose stack. Use
`docker compose ps` to identify repository containers and
`npm run compose:down` or `npm run db:down` as appropriate.

### Generated OpenAPI parity fails

Regenerate with `npm run generate:openapi`, review the generated diff, and
commit it only when the underlying route, validator, or metadata change is
intentional.

## Safe change checklist

- Keep backend dependencies flowing from routes to controllers to services and
  models. Put ownership, tenant, inventory, and lifecycle rules in services.
- Centralize frontend application and API paths in `frontend/src/routes.ts`.
- Treat frontend guards and hidden controls as usability only; enforce access
  in the backend.
- Keep brand-sensitive reusable copy in both brand configurations.
- Add focused tests beside the source area they verify; reserve broad workflow
  files for genuine integration behavior.
- Regenerate OpenAPI after contract changes; never hand-edit the generated file.
- Consult the [improvement plan](PROJECT_IMPROVEMENT_PLAN.md) before starting a
  planned phase and update its handoff only with verified repository state.
- Do not commit secrets, `.env` files, tokens, or credentials other than the
  intentionally documented local demo accounts.

More detailed contribution boundaries and domain reasoning are in the
[project overview](docs/project-overview.md#contribution-guidance).

<img src="images/mercadozetta.jpg" width="400" alt="MercadoZetta interface">
