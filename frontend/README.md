# MercadoZetta Frontend

React + TypeScript + Vite frontend for MercadoZetta.

The frontend lets users browse and search products, create accounts, log in, create authenticated products, and view seller-specific product lists.

## Stack

- React
- TypeScript
- Vite
- React Router
- Axios
- Testing Library
- Vitest

## Environment

Use Node.js 24.18 or newer. From the repository root, run `nvm use` to use the version pinned by `.nvmrc`.

Create a local `.env` file:

```bash
cp .env.example .env
```

Set the backend API URL:

```env
VITE_API_URL=http://localhost:3333
```

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Vite will print the local frontend URL in the terminal, usually `http://localhost:5173`.

## Test, Build, Lint, And Audit

```bash
npm test
npm run build
npm run lint
npm audit
```

## Routes

| Route                | Description                                    |
| -------------------- | ---------------------------------------------- |
| `/`                  | Home page with product search and product list |
| `/sellers/:sellerId` | Seller page with products for that seller      |
| `/login`             | Login form                                     |
| `/register`          | User registration form                         |
| `/products/new`      | Authenticated product creation form            |

## Authentication Flow

On successful login, the app stores the returned `token` and `user` in `localStorage`. The API service attaches the token to outgoing requests as a Bearer token, which allows authenticated product creation.
