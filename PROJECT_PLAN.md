# MercadoZetta Project Plan

## Current State

- Active branch: `feature/login-flow`
- Last commit: `2a8a96a feat: protect product creation`
- Working tree has backend configuration/validation changes in progress.
- Frontend validation passed:
  - `npm run build`
  - `npm run lint`
- Backend syntax validation passed:
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

1. Add minimal tests.
   - Backend: login success/failure, user creation, product creation auth requirement.
   - Frontend: login form calls API and handles failure.

2. Review dependency vulnerabilities.
   - `npm audit` currently reports vulnerabilities in both backend and frontend dependency trees.
   - Handle separately from feature work to avoid mixing risky upgrades with auth changes.

## Useful Commands

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
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
