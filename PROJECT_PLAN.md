# MercadoZetta Project Plan

## Current State

- Active branch: `feature/login-flow`
- Last commit: `a817258 feat: implement login flow`
- Working tree was clean when this plan was created.
- Frontend validation passed:
  - `npm run build`
  - `npm run lint`
- Backend syntax validation passed:
  - `node -c backend/src/controller/authController.js`

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

## Environment Setup

Backend `.env` should be created from `backend/.env.example`:

```env
MONGODB_PASSWORD=your_mongodb_password
JWT_SECRET=replace_with_a_long_random_secret
```

Frontend `.env` should be created from `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:3333
```

## Next Recommended Work

1. Configure signed commits.
   - Generate or locate an SSH key.
   - Add the public key to GitHub as a `Signing Key`.
   - Configure Git:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

   - Re-sign the latest commit if needed:

```bash
git commit --amend --no-edit -S
git push --force-with-lease
```

2. Add endpoint to list products by seller if still required.

3. Improve backend configuration.
   - Replace hardcoded MongoDB connection parts with a full `MONGODB_URI`.
   - Update `backend/.env.example` accordingly.
   - Optionally add `PORT=3333`.

4. Add request validation.
   - Validate login payload.
   - Validate user creation payload.
   - Validate product creation payload.
   - Avoid passing raw `req.body` directly to Mongoose creates.

5. Improve API status codes and error consistency.
   - Use `201` for creation.
   - Use `401` for invalid auth.
   - Use `400` for validation failures.
   - Return consistent `{ error: string }` responses.

6. Add minimal tests.
   - Backend: login success/failure, user creation, product creation auth requirement.
   - Frontend: login form calls API and handles failure.

7. Review dependency vulnerabilities.
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
- The current MongoDB connection still hardcodes user, cluster, database, and app name in `backend/src/server.js`.
