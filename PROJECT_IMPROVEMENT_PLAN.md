# MercadoZetta Next Improvement Plan

## Goal

Focus the next work on improvements that make MercadoZetta easier to run,
easier to evolve, and more polished as a white-label marketplace demo.

## Current Status and Next Session Handoff

The validation/test-organization, API contract documentation, automatic OpenAPI
generation, and persistent commerce phases are complete. Priority 2 -
Architecture Decision Records was intentionally skipped because this project
does not need ADRs. Do not recreate or edit the checked-in API contract
manually; update its Zod schemas or typed route contract and run the generator.

The next session should start by evaluating deployment readiness for the new
commerce workflows. A concrete first step is to run the Dockerized demo with
MongoDB, exercise buyer checkout and seller fulfillment with two demo users,
and record any operational gaps before adding another product phase.

Validated handoff state:

- Backend: 173 tests passing across 30 test files.
- Frontend: 50 tests passing across 10 test files.
- Backend coverage passes all configured 85% thresholds.
- Frontend coverage passes all configured 90% thresholds.
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
- Carts, watchlists, orders, order items, reviews, and notifications persist in
  tenant-scoped MongoDB collections.
- Buyer checkout, seller fulfillment states, purchase-gated reviews, inventory
  updates, and user notifications are API-backed and covered by focused tests.
- The frontend no longer stores commerce state in `localStorage`; only the
  existing authentication session remains there.

## Priority 2 - Architecture Decision Records

Skipped by product decision: ADRs are not needed for this project.

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

Completed: the project now supports real buyer and seller workflows beyond the
previous browser-only demo simulation.

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
4. [x] Skip ADRs by explicit project decision.
5. [x] Persist commerce workflows.

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
