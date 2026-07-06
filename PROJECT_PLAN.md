# MercadoZetta Project Plan

## Current State

- Active branch: `feature/login-flow`
- Last commit: `2a8a96a feat: protect product creation`
- Working tree has minimal backend/frontend test coverage in progress.
- Frontend validation passed:
  - `npm run build`
  - `npm run lint`
- Dependency audits passed:
  - `cd backend && npm audit`
  - `cd frontend && npm audit`
- Frontend tests passed:
  - `npm test`
- Backend tests passed:
  - `npm test`
- Backend syntax validation passed:
  - `node -c backend/src/app.js`
  - `node -c backend/src/controller/authController.js`
  - `node -c backend/src/controller/productController.js`
  - `node -c backend/src/controller/userController.js`
  - `node -c backend/src/routes.js`
  - `node -c backend/src/server.js`

## Completed In This Branch

- Created `backend/.env.example`.
- Created `frontend/.env.example`.
- Added `jsonwebtoken` to the backend.
- Updated backend login to validate credentials and return `{ user, token }`.
- Updated frontend login to call `POST /login`, store `token` and `user` in `localStorage`, and navigate to `/user/:id`.
- Converted `frontend/src/services/api.js` to `frontend/src/services/api.ts`.
- Updated frontend API base URL to use `VITE_API_URL` with a localhost fallback.
- Removed the `string-similarity` dependency.
- Replaced fuzzy product filtering with a simple case-insensitive `includes()` search.
- Fixed basic TypeScript errors that were blocking the frontend build.
- Fixed product list loading so it does not request `/products` on every render.
- Added backend authentication middleware for `Authorization: Bearer <token>`.
- Protected product creation routes with authentication.
- Added `POST /products` as the preferred product creation route.
- Updated frontend product creation to call `POST /products`.
- Updated the frontend API service to attach the stored token to requests.
- Related created products to the authenticated seller.
- Replaced hardcoded MongoDB connection parts with `MONGODB_URI`.
- Added optional backend `PORT` configuration.
- Updated `backend/.env.example` for `MONGODB_URI`, `JWT_SECRET`, and `PORT`.
- Added request validation for login, user creation, and product creation payloads.
- Avoided passing raw `req.body` directly to Mongoose creates in user/product creation.
- Improved creation status codes to return `201`.
- Standardized validation/auth failures around `{ error: string }` responses.
- Added seller product listing endpoints:
  - `GET /users/:userID/products`
  - `GET /user/:userID/products`
- Updated `/user/:id` frontend view to load only that seller's products.
- Split the Express app setup into `backend/src/app.js` so the server startup remains isolated.
- Added backend Vitest + Supertest tests for login success/failure, user creation, product auth requirement, and authenticated product creation.
- Added Vitest and Testing Library to the frontend.
- Added frontend login tests for API success/navigation/storage and API failure messaging.
- Resolved backend dependency vulnerabilities by updating Express, Mongoose, and Nodemon.
- Resolved frontend dependency vulnerabilities by updating Axios, React Router, Vite, and the Vite React plugin.

## Environment Setup

Backend `.env` should be created from `backend/.env.example`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/mercadozetta?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
PORT=3333
```

Frontend `.env` should be created from `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:3333
```

## Next Recommended Work

1. Run a manual smoke test with real local `.env` files.
   - Start the backend and frontend dev servers.
   - Create a user, log in, create a product, and confirm the seller product list only shows that seller's products.

## Useful Commands

```bash
cd backend
npm run dev
npm test
```

```bash
cd frontend
npm run dev
npm test
npm run build
npm run lint
```

```bash
git status
git log --oneline --decorate -5
```

## Notes For Next Session

- The login flow is implemented.
- Product creation is protected and uses the authenticated user as `seller`.
- The token is stored in `localStorage`, and the API service attaches it to requests.
- The backend uses a development fallback for `JWT_SECRET`; production should always define it.
- The backend now requires `MONGODB_URI`; local `.env` files must be updated from `backend/.env.example`.
