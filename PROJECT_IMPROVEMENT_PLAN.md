# MercadoZetta Next Improvement Plan

## Goal

Focus the next work on improvements that make MercadoZetta easier to run,
easier to evolve, and more polished as a white-label marketplace demo.

## Priority 1 - UI/UX Modernization

This is the best next focus because it improves the most visible part of the
project without requiring major backend changes.

- Replace the current button-heavy home layout with a marketplace-first page:
  - header with search
  - product grid
  - seller/account actions
  - clear empty, loading, and error states
- Improve product cards:
  - stable image aspect ratio
  - responsive layout
  - clear price, status, category, and seller information
  - accessible links/buttons for product and seller navigation
- Improve forms where needed:
  - labels
  - helper text
  - user-visible validation errors
  - consistent success/error feedback
- Add skeleton loading or lightweight loading states for product lists.
- Add toast or inline feedback for successful actions.
- Keep user-facing copy in Portuguese by default.
- Continue routing new brand-specific copy through the existing brand copy
  structure.

## Priority 2 - Local Development and Demo Setup

This should come after the UI pass so testing and demos become easier and more
repeatable.

- Add Docker Compose for:
  - MongoDB
  - backend API
  - frontend app
- Add seed scripts for demo data:
  - tenants/brands
  - users
  - sellers
  - products
- Document the demo startup flow in the README.
- Add a short manual smoke-test checklist that starts from seeded data.

## Priority 3 - API Contract Documentation

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

## Priority 4 - Architecture Decision Records

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

## Priority 5 - Persistent Commerce Domain

Only start this if the project needs real buyer workflows beyond the current
demo simulation.

- Persist carts, watchlists, orders, order items, reviews, and notifications in
  MongoDB.
- Add buyer/seller authorization rules for order and review operations.
- Replace localStorage checkout and order history with API-backed flows.
- Add lifecycle states for orders and seller fulfillment actions.
- Add focused backend and frontend regression tests for each persisted workflow.

## Recommended Order

1. Modernize the home/catalog experience.
2. Add Docker Compose and seed scripts.
3. Document the current API with OpenAPI.
4. Add ADRs for existing architecture decisions.
5. Persist commerce workflows only if the product scope grows.

## Definition of Done

- `npm test` passes from the repository root.
- `npm run lint` passes from the repository root.
- `npm --prefix frontend run build` passes.
- `npm run test:coverage` passes when behavior or coverage-sensitive code
  changes.
- New product, architecture, or UI behavior has focused regression tests.
- Tenant-scoped behavior remains isolated.
- Default MercadoZetta and sample tenant branding continue to work.
- README or relevant docs are updated when commands, configuration, or API
  contracts change.
