# MercadoZetta Backend

Express API for MercadoZetta. It handles user registration, login, JWT authentication, product creation, and product listing.

## Stack

- Node.js
- Express
- PostgreSQL and Drizzle
- JSON Web Token
- bcryptjs
- Vitest and Supertest

## Environment

Create a local `.env` file:

```bash
cp .env.example .env
```

Required values:

```env
POSTGRESQL_URL=postgresql://user:password@localhost:5432/mercadozetta
JWT_SIGNING_KEYS={"current":"replace_with_a_long_random_secret"}
JWT_ACTIVE_KID=current
REFRESH_TOKEN_HASH_SECRETS={"current":"replace_with_a_distinct_random_secret"}
REFRESH_TOKEN_HASH_ACTIVE_VERSION=current
CSRF_SECRETS={"current":"replace_with_another_distinct_random_secret"}
CSRF_ACTIVE_VERSION=current
ACCOUNT_TOKEN_HASH_SECRETS={"current":"replace_with_a_fourth_distinct_random_secret"}
ACCOUNT_TOKEN_HASH_ACTIVE_VERSION=current
EMAIL_VERIFICATION_TOKEN_TTL_MS=28800000
PASSWORD_RESET_TOKEN_TTL_MS=1800000
EMAIL_CHANGE_TOKEN_TTL_MS=1800000
ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS=60000
ACCOUNT_TOKEN_ISSUE_WINDOW_MS=3600000
ACCOUNT_TOKEN_ISSUE_MAX=3
ACCOUNT_REQUEST_RESPONSE_FLOOR_MS=500
PORT=3333
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=900000
RATE_LIMIT_REGISTER_MAX=10
RATE_LIMIT_EMAIL_VERIFICATION_REQUEST_WINDOW_MS=900000
RATE_LIMIT_EMAIL_VERIFICATION_REQUEST_MAX=5
RATE_LIMIT_EMAIL_VERIFICATION_CONFIRMATION_WINDOW_MS=900000
RATE_LIMIT_EMAIL_VERIFICATION_CONFIRMATION_MAX=10
RATE_LIMIT_PASSWORD_RESET_REQUEST_WINDOW_MS=900000
RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX=5
RATE_LIMIT_PASSWORD_RESET_CONFIRMATION_WINDOW_MS=900000
RATE_LIMIT_PASSWORD_RESET_CONFIRMATION_MAX=10
RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MS=900000
RATE_LIMIT_PASSWORD_CHANGE_MAX=5
RATE_LIMIT_EMAIL_CHANGE_REQUEST_WINDOW_MS=900000
RATE_LIMIT_EMAIL_CHANGE_REQUEST_MAX=5
RATE_LIMIT_EMAIL_CHANGE_CONFIRMATION_WINDOW_MS=900000
RATE_LIMIT_EMAIL_CHANGE_CONFIRMATION_MAX=10
RATE_LIMIT_ACCOUNT_DEACTIVATION_WINDOW_MS=900000
RATE_LIMIT_ACCOUNT_DEACTIVATION_MAX=5
```

`POSTGRESQL_URL` is required and `/ready` reports PostgreSQL connectivity.
`PORT` defaults to `3333` when omitted. All four
versioned security key rings are required outside development and test.
`CORS_ORIGIN` accepts one or more comma-separated frontend origins. The rate
limit variables control login, account creation, verification, and recovery
attempts. Account-token lifetime and issuance variables enforce the accepted
single-use token and hidden per-account abuse limits.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The API will run on `http://localhost:3333` by default.

Seed PostgreSQL with repeatable demo users and products:

```bash
npm run seed:demo
```

The seed runs in one transaction, refreshes only its deterministic records for
the two built-in tenants, and preserves unrelated data.

## Test And Audit

```bash
npm test
npm audit
```

CI runs formatting and lint checks, backend and frontend tests, the frontend
build, and `npm audit --audit-level=high` for the root, backend, and frontend
dependency trees.

## Routes

| Method | Route                     | Auth | Description                                   |
| ------ | ------------------------- | ---- | --------------------------------------------- |
| `GET`  | `/`                       | No   | API welcome response                          |
| `GET`  | `/health`                 | No   | Liveness check                                |
| `GET`  | `/ready`                  | No   | Active database readiness checks              |
| `GET`  | `/products`               | No   | List all products                             |
| `GET`  | `/users/:userId/products` | No   | List products for one seller                  |
| `POST` | `/users`                  | No   | Create a user                                 |
| `POST` | `/auth/login`             | No   | Authenticate and return `{ user, token }`     |
| `POST` | `/products`               | Yes  | Create a product for the authenticated seller |

Authenticated routes expect:

```http
Authorization: Bearer <token>
```

## Error Responses

API errors use a stable JSON contract:

```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

`error` is a user-readable message kept for frontend compatibility. `code` is a
stable machine-readable value for tests, clients, and logs. Unexpected server
errors return HTTP `500` with `INTERNAL_SERVER_ERROR`.

## Payloads

Create user:

```json
{
  "email": "seller@example.com",
  "password": "secret123",
  "username": "Seller",
  "telephone": "48999999999"
}
```

Login:

```json
{
  "email": "seller@example.com",
  "password": "secret123"
}
```

Create product:

```json
{
  "name": "Coffee",
  "description": "Fresh beans",
  "inventory": 10,
  "image": "https://example.com/coffee.jpg"
}
```
