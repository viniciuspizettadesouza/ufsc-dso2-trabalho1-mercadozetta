# MercadoZetta Backend

Express API for MercadoZetta. It handles user registration, login, JWT authentication, product creation, and product listing.

## Stack

- Node.js
- Express
- MongoDB
- Mongoose
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
MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/mercadozetta?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
PORT=3333
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=900000
RATE_LIMIT_REGISTER_MAX=10
```

`MONGODB_URI` is required when starting the server. `PORT` defaults to `3333`
when omitted. `JWT_SECRET` is required outside development and test.
`CORS_ORIGIN` accepts one or more comma-separated frontend origins. The rate
limit variables control login and account creation attempts.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The API will run on `http://localhost:3333` by default.

## Test And Audit

```bash
npm test
npm audit
```

## Routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | API welcome response |
| `GET` | `/health` | No | Liveness check |
| `GET` | `/ready` | No | MongoDB readiness check |
| `GET` | `/products` | No | List all products |
| `GET` | `/users/:userId/products` | No | List products for one seller |
| `POST` | `/users` | No | Create a user |
| `POST` | `/auth/login` | No | Authenticate and return `{ user, token }` |
| `POST` | `/products` | Yes | Create a product for the authenticated seller |

Authenticated routes expect:

```http
Authorization: Bearer <token>
```

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
