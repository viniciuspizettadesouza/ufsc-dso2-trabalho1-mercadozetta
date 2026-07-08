# MercadoZetta Project Plan

## Current State

- Active branch: `chore-dependency-maintenance`
- Last commit: `951f051 feat: implement authenticated login and product flows (#45)`
- Dependency maintenance updates are completed on this branch and awaiting review/commit.
- Frontend validation passed:
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run lint`
- Dependency audits passed:
  - `npm --prefix backend audit`
  - `npm --prefix frontend audit`
- Tests passed:
  - `npm test`

## Baseline

- Authentication, protected product creation, seller product listing, env examples, and focused backend/frontend tests are already implemented.
- Manual smoke testing previously passed with local `.env` files for user creation, login, authenticated product creation, and seller product listing.

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

1. Plan a future React Router v8 upgrade.
   - Upgrade the runtime baseline to Node `22.22+`.
   - Upgrade `react` and `react-dom` to `19.2.7+`.
   - Replace `react-router-dom` imports with `react-router` or `react-router/dom` imports because the re-export package is removed in v8.
   - Install React Router v8 after the prerequisites are in place and rerun frontend tests/build.
2. Plan larger dependency upgrades as separate work items.
   - Frontend: evaluate React `19.2.7+`, Tailwind CSS `4.x`, ESLint `10.x`, TypeScript `6.x`, `@typescript-eslint` `8.x`, and `eslint-plugin-react-hooks` `7.x`.
   - Backend: evaluate `bcryptjs` `3.x`, Express `5.x`, Dotenv `17.x`, and Mongoose `9.x`.
   - Treat these as migration tasks because they may require code, config, runtime, or CI changes.

## Database Notes

- MongoDB remains a practical choice for the current project scope because the data model is simple:
  - users
  - products
  - one seller reference per product
- PostgreSQL would likely be a stronger option if the app grows into a fuller marketplace with orders, payments, inventory movements, carts, reviews, refunds, and stricter transactional consistency needs.
- Recommended MongoDB schema improvements:
  - Add a unique index for `User.email`.
  - Add an index for `Product.seller`.
  - Consider changing `Product.quant` from `String` to `Number`.
  - Consider adding marketplace fields such as price, category, status, and availability.

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
