# MercadoZetta Project Plan

## Current State

- Active branch: `plan-dependency-upgrades`
- Last commit on `master`: `c0c349f feat: upgrade frontend to React Router v8 (#48)`
- Dependency maintenance updates are merged on `master`.
- MongoDB schema index work is prepared separately on `improve-mongodb-schema-indexes`.
- Frontend validation passed:
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run lint`
- Dependency audits passed:
  - `npm --prefix backend audit`
  - `npm --prefix frontend audit`
- Tests passed:
  - `npm test`
- React Router v8 upgrade completed and merged on `master`:
  - Declared Node `>=22.22.0` as the project/frontend runtime baseline.
  - Added `.nvmrc` pinned to Node `22.23.1`.
  - Upgraded React and React DOM to `19.2.7`.
  - Upgraded React Router to `8.1.0`.
  - Replaced frontend `react-router-dom` imports with direct `react-router` imports.
  - Replaced the direct frontend dependency from `react-router-dom` to `react-router`.
  - Verified under Node `22.23.1` and npm `10.9.8` with `npm --prefix frontend run build`, `npm --prefix frontend run lint`, `npm test`, and `npm --prefix frontend audit`.

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

1. Run larger dependency upgrades as separate migration branches.
   - Verified package targets on 2026-07-08:
     - React `19.2.7` and React Router `8.1.0` are already current.
     - Tailwind CSS `4.3.2`
     - ESLint `10.6.0`
     - TypeScript `6.0.3`
     - `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` `8.63.0`
     - `eslint-plugin-react-hooks` `7.1.1`
     - `bcryptjs` `3.0.3`
     - Express `5.2.1`
     - Dotenv `17.4.2`
     - Mongoose `9.7.4`
   - Recommended order:
     1. Frontend lint toolchain migration completed on `plan-dependency-upgrades`:
        - Upgraded ESLint to `10.6.0`, `@typescript-eslint/*` to `8.63.0`, and `eslint-plugin-react-hooks` to `7.1.1`.
        - Added `@eslint/js` `10.0.1` and `globals` `16.5.0` for ESLint flat config.
        - Replaced `frontend/.eslintrc.cjs` with `frontend/eslint.config.js`.
        - Updated the frontend lint script to use `eslint . --max-warnings 0`.
        - Verified with `npm --prefix frontend run lint`, `npm --prefix frontend run build`, and `npm --prefix frontend test`.
        - Note: npm emitted the expected engine warning under local Node `22.14.0`; the project baseline remains Node `>=22.22.0`.
     2. Tailwind CSS 4 migration completed on `plan-dependency-upgrades`:
        - Upgraded Tailwind CSS to `4.3.2`.
        - Added `@tailwindcss/vite` `4.3.2` and configured it in `frontend/vite.config.ts`.
        - Replaced the v3 `@tailwind` directives in `frontend/src/index.css` with `@import "tailwindcss";`.
        - Removed the old no-op `frontend/tailwind.config.js` and `frontend/postcss.config.js` files.
        - Verified with `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend test`, and `npm --prefix frontend audit`.
     3. TypeScript 6 migration completed on `plan-dependency-upgrades`:
        - Upgraded TypeScript to `6.0.3`.
        - Verified with `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend test`, and `npm --prefix frontend audit`.
     4. Backend low-risk dependency migration completed on `plan-dependency-upgrades`:
        - Upgraded Dotenv to `17.4.2` and `bcryptjs` to `3.0.3`.
        - Verified with `npm --prefix backend test` and `npm --prefix backend audit`.
     5. Express 5 migration completed on `plan-dependency-upgrades`:
        - Upgraded Express to `5.2.1`.
        - Verified with `npm --prefix backend test` and `npm --prefix backend audit`.
     6. Mongoose 9 migration completed on `plan-dependency-upgrades`:
        - Upgraded Mongoose to `9.7.4`.
        - Simplified `backend/src/server.js` to call `mongoose.connect(mongoUri)` without legacy connection options.
        - Verified with `npm --prefix backend test` and `npm --prefix backend audit`.
        - Manual smoke test against MongoDB is still recommended before merging.

## Database Notes

- MongoDB remains a practical choice for the current project scope because the data model is simple:
  - users
  - products
  - one seller reference per product
- PostgreSQL would likely be a stronger option if the app grows into a fuller marketplace with orders, payments, inventory movements, carts, reviews, refunds, and stricter transactional consistency needs.
- Remaining MongoDB schema improvements to evaluate:
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
