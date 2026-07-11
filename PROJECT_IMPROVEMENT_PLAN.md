# MercadoZetta Next Improvement Plan

## Goal

Focus the next work on improvements that make MercadoZetta easier to run,
easier to evolve, and more polished as a white-label marketplace demo.

## Current Status and Next Session Handoff

The validation/test-organization, API contract documentation, and automatic
OpenAPI generation phases are complete. Do not recreate or edit the checked-in
contract manually; update its Zod schemas or typed route contract and run the
generator instead.

The next session should start with **Priority 2 - Architecture Decision
Records**. Begin with the white-label strategy and tenant isolation decisions,
using the existing tenant registry and middleware as the verified source of
truth. Do not start persistent commerce workflows before completing Priority 2.

Validated handoff state:

- Backend: 155 tests passing across 28 test files.
- Frontend: 50 tests passing across 10 test files.
- Backend branch coverage: 85.87%, above the configured 85% threshold.
- Focused coverage scenarios are stored in the test files associated with their
  source modules.
- The test-file organization rule is documented in `AGENTS.md`.
- Backend TypeScript compilation passes.
- The OpenAPI 3.1 contract is stored at `docs/openapi.json` and covers every
  Express route, request constraints, response shapes, and examples.
- `backend/test/openapi-contract.test.ts` checks route/operation parity and
  required examples.
- Zod 4 schemas now drive runtime request validation and OpenAPI request
  definitions; `backend/src/openapi/document.ts` contains the typed operation
  and response contract.
- `npm run generate:openapi` regenerates `docs/openapi.json`, and the contract
  test rejects checked-in drift.

## Priority 2 - Architecture Decision Records

Capture decisions that are already shaping the project so future changes have a
clear reference point.

- Add ADRs for:
  - white-label strategy
  - auth/session model
  - tenant isolation model
  - validation and error response format
- Keep each ADR short:
  - context
  - decision
  - consequences

## Priority 3 - Persistent Commerce Domain

Only start this if the project needs real buyer workflows beyond the current
demo simulation.

- Persist carts, watchlists, orders, order items, reviews, and notifications in
  MongoDB.
- Add buyer/seller authorization rules for order and review operations.
- Replace localStorage checkout and order history with API-backed flows.
- Add lifecycle states for orders and seller fulfillment actions.
- Add focused backend and frontend regression tests for each persisted workflow.

## Recommended Order

1. [x] Restore and validate the configured branch-coverage threshold.
2. [x] Document the current API with OpenAPI.
3. [x] Generate OpenAPI from shared validation schemas.
4. [ ] Add ADRs for existing architecture decisions. **Start here in the next session.**
5. [ ] Persist commerce workflows only if the product scope grows.

## Definition of Done

- `npm test` passes from the repository root.
- `npm run lint` passes from the repository root.
- `npm --prefix frontend run build` passes.
- `npm run test:coverage` passes when behavior or coverage-sensitive code
  changes.
- New product, architecture, or UI behavior has focused regression tests.
- New unit scenarios are added to the test file associated with the source
  module; aggregate test files are used only for genuine integration, contract,
  routing, or workflow behavior.
- Tenant-scoped behavior remains isolated.
- Default MercadoZetta and sample tenant branding continue to work.
- README or relevant docs are updated when commands, configuration, or API
  contracts change.
