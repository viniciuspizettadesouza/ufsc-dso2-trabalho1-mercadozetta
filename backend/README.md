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
```

`MONGODB_URI` is required when starting the server. `PORT` defaults to `3333` when omitted. `JWT_SECRET` should always be set outside local development.

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
| `GET` | `/products` | No | List all products |
| `GET` | `/users/:userID/products` | No | List products for one seller |
| `GET` | `/user/:userID/products` | No | Alias for seller product listing |
| `POST` | `/add-user` | No | Create a user |
| `POST` | `/login` | No | Authenticate and return `{ user, token }` |
| `POST` | `/products` | Yes | Create a product for the authenticated seller |
| `POST` | `/add-product` | Yes | Legacy alias for product creation |
| `POST` | `/user/:userID/addproduct` | Yes | Legacy alias for product creation |

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
  "quant": "10",
  "image": "https://example.com/coffee.jpg"
}
```
