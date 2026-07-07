# Repository Guidelines

## Project Structure & Module Organization

MercadoZetta is split into a Node/Express API and a React/Vite frontend.

- `backend/src/` contains the Express app, routes, controllers, middleware, and Mongoose models.
- `backend/test/` contains backend Vitest and Supertest integration tests.
- `frontend/src/` contains React pages, shared services, styles, and test setup.
- `frontend/src/pages/*.test.tsx` contains frontend component tests.
- `images/` stores documentation images.
- `.env.example` files in `backend/` and `frontend/` document required local configuration.

## Build, Test, and Development Commands

Install dependencies at the root, then in each app folder when needed:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Common commands:

- `npm test` runs backend and frontend test suites from the repository root.
- `npm --prefix backend run dev` starts the API with Nodemon.
- `npm --prefix frontend run dev` starts the Vite development server.
- `npm --prefix frontend run build` type-checks and builds the frontend.
- `npm --prefix frontend run lint` runs ESLint for TypeScript and React files.

For local development, start MongoDB and set `backend/.env` with `MONGODB_URI`, `JWT_SECRET`, and `PORT`. Set `frontend/.env` with `VITE_API_URL`.

## Coding Style & Naming Conventions

Backend code uses CommonJS modules, Express route/controller separation, and Mongoose models named by domain (`user.js`, `product.js`). Frontend code uses TypeScript, React function components, React Router, Axios services, and Tailwind CSS classes. Prefer clear domain names for files and functions, such as `AddProduct`, `authController`, and `productController`.

Keep formatting consistent with nearby code. Use single quotes in backend JavaScript and the existing frontend import/component style in TypeScript files.

## Testing Guidelines

The project uses Vitest throughout. Backend tests use Supertest for API behavior. Frontend tests use Testing Library and `@testing-library/jest-dom`.

Name tests after the unit or workflow under test, for example `auth-user-product.test.js` or `Login.test.tsx`. Run `npm test` before opening a pull request, and add focused tests for authentication, product creation, routing, and user-visible error states when those areas change.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit style, such as `feat: show auth actions in header`, `docs: add local development setup guide`, and `chore: update frontend routing dependencies`.

Use short, imperative commit messages with a scope only when it adds clarity. Pull requests should include a concise summary, test results, linked issues when applicable, and screenshots or screen recordings for frontend UI changes.

## Security & Configuration Tips

Never commit `.env` files, JWT secrets, MongoDB credentials, or generated tokens. Keep `backend/.env.example` and `frontend/.env.example` updated when configuration changes.
