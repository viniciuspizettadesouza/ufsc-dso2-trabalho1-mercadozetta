# MercadoZetta Next Improvement Plan

## Goal

Focus the next work on improvements that make MercadoZetta easier to run,
easier to evolve, and more polished as a white-label marketplace demo.

## Current Status and Next Session Handoff

The validation and test-organization phase is complete. Do not repeat this
phase in the next session unless a regression causes the configured coverage
threshold to fail.

The next session should start with **Priority 1 - API Contract Documentation**.
Begin by inventorying the routes and their existing request validators in
`backend/src/routes.ts`, then choose how the OpenAPI document will be colocated
with or generated from those contracts. Do not start ADRs or persistent commerce
workflows before completing Priority 1.

Validated handoff state:

- Backend: 149 tests passing.
- Backend branch coverage: 85.20%, above the configured 85% threshold.
- Focused coverage scenarios are stored in the test files associated with their
  source modules.
- The test-file organization rule is documented in `AGENTS.md`.
- Backend TypeScript compilation passes.

## Priority 1 - API Contract Documentation

This should happen before adding generated clients or expanding persistent
commerce workflows.

- Add OpenAPI documentation for the existing API.
- Prefer generating or colocating the docs from route validation schemas where
  practical.
- Document request/response examples for:
  - auth
  - users
  - products
  - seller profile/product lookup
  - health/readiness endpoints
- Add API client generation only after the documented contract is stable.

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
2. [ ] Document the current API with OpenAPI. **Start here in the next session.**
3. [ ] Add ADRs for existing architecture decisions.
4. [ ] Persist commerce workflows only if the product scope grows.

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
