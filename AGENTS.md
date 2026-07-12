# Repository Guidelines

## Project Structure & Module Organization

MercadoZetta is split into a Node/Express API and a React/Vite frontend.

- `backend/src/` contains the Express app, routes, controllers, middleware, and Mongoose models.
- `backend/test/` contains backend Vitest and Supertest tests. Existing focused
  tests live both directly under `backend/test/` and in the mirrored
  `backend/test/unit/` areas; integration, contract, and workflow tests live
  directly under `backend/test/`.
- `frontend/src/` contains React pages, shared services, styles, and test setup.
- Frontend focused tests are colocated with the page, component, route, or
  service they exercise under `frontend/src/`.
- `docs/` contains architecture and behavior documentation; consult the
  relevant document before changing a documented flow.
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
- `npm run typecheck` runs the backend TypeScript compiler without emitting.
- `npm run lint` runs both backend and frontend lint checks.
- `npm run format` formats supported files with Prettier.
- `npm run format:check` checks Prettier formatting without rewriting files.
- Commits format supported staged files through `lint-staged`; pushes check
  repository formatting and run the test suite.
- `npm run generate:openapi` regenerates the checked-in OpenAPI contract from
  backend schemas and route metadata.
- `npm run test:coverage` runs both coverage suites and enforces their configured
  thresholds.
- `npm --prefix backend run dev` starts the API with Nodemon.
- `npm --prefix frontend run dev` starts the Vite development server.
- `npm --prefix frontend run build` type-checks and builds the frontend.
- `npm --prefix frontend run lint` runs ESLint for TypeScript and React files.

For local development, start MongoDB and set `backend/.env` with `MONGODB_URI`, `JWT_SECRET`, and `PORT`. Set `frontend/.env` with `VITE_API_URL`.

## Coding Style & Naming Conventions

Backend code uses TypeScript, Express route/controller separation, and Mongoose
models named by domain (`user.ts`, `product.ts`). Frontend code uses TypeScript,
React function components, React Router, Axios services, and Tailwind CSS
classes. Prefer clear domain names for files and functions, such as
`AddProduct`, `authController`, and `productController`.

Keep formatting consistent with nearby code. Use single quotes in backend
TypeScript and the existing frontend import/component style in TypeScript files.

## API Contract and Validation

The backend uses Zod 4 schemas as the source of truth for request validation and
OpenAPI request definitions.

- Keep request normalization, validation constraints, defaults, and OpenAPI
  metadata together in `backend/src/validators/`.
- Keep operation and response metadata in `backend/src/openapi/document.ts`.
- Do not edit `docs/openapi.json` manually.
- After changing routes, validators, response schemas, security requirements,
  or examples, run `npm run generate:openapi` from the repository root.
- Keep `backend/test/openapi-contract.test.ts` verifying deterministic
  generated-file parity, parity between documented and implemented routes, and
  required request and response examples.
- Preserve existing `AppError` status codes, error codes, and user-visible
  messages when changing or migrating schemas.
- Do not add generated API clients until the improvement plan explicitly
  prioritizes them.

## Testing Guidelines

The project uses Vitest throughout. Backend tests use Supertest for API behavior. Frontend tests use Testing Library and `@testing-library/jest-dom`.

Name tests after the unit or workflow under test, for example
`auth-user-product.test.ts` or `Login.test.tsx`. Run `npm test` before opening a
pull request, and add focused tests for authentication, product creation,
routing, and user-visible error states when those areas change.

### Test File Organization

Keep focused tests associated with the source module they exercise.

- Add new unit scenarios to the existing correspondingly named test file. For
  example, product-service behavior belongs in `productService.test.ts`, user
  validation belongs in `userValidator.test.ts`, and the `Login` component
  belongs in `Login.test.tsx`.
- For new backend unit-test files, mirror the existing source area under
  `backend/test/unit/`, such as `src/services/` to `test/unit/services/` and
  `src/middleware/` to `test/unit/middleware/`.
- Keep frontend tests colocated with the component, page, route, or service when
  the test targets that individual module, following the existing `*.test.tsx`
  and `*.test.ts` convention in `frontend/src/`.
- Do not create generic aggregate or coverage-only test files such as
  `branch-coverage-debt.test.ts`, `additional-tests.test.ts`, or
  `coverage.test.ts`. Improving coverage is not a reason to detach tests from
  the source module they verify.
- Multi-module test files are reserved for genuine integration, contract,
  routing, or user-workflow behavior, as in the existing backend integration
  tests and frontend marketplace workflow tests. Their names must describe the
  behavior being verified rather than a coverage target.

## Improvement Plan and Session Handoff

When work is guided by `PROJECT_IMPROVEMENT_PLAN.md`, treat its current-status
and handoff section as the source of truth between Codex sessions.

- At the beginning of a new session, read the plan before changing code and
  start from the priority explicitly identified as the next action.
- Do not repeat a completed phase unless verification shows a regression or the
  user explicitly asks to revisit it.
- Complete the current priority before starting a later priority unless the
  user changes the order.
- Before ending a completed phase, update the plan with the verified state and
  one concrete starting point for the next session, including relevant files or
  commands when they help the next agent begin immediately.
- Keep completed work summarized in the current-status/handoff section and in
  the checklist under `Recommended Order`. Do not add a separate completed-phase
  section that duplicates the same information.
- Keep the handoff concise and based only on verified repository state. Do not
  record test counts, coverage values, commands, files, or architecture that
  were not confirmed in the current project.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit style, such as `feat: show auth actions in header`, `docs: add local development setup guide`, and `chore: update frontend routing dependencies`.

Use short, imperative commit messages with a scope only when it adds clarity. Prefer Conventional Commit types such as `feat`, `fix`, `docs`, `test`, `refactor`, and `chore`.

Name branches with a clear type prefix and kebab-case description, for example `feat/authenticated-product-flow`, `fix/login-error-state`, `docs/local-development-guide`, or `chore/dependency-toolchain-upgrades`.

Use pull request titles that follow the same Conventional Commit style as commit messages.

## Security & Configuration Tips

Never commit `.env` files, JWT secrets, MongoDB credentials, or generated tokens. Keep `backend/.env.example` and `frontend/.env.example` updated when configuration changes.
