# Reviews API Contract Audit

## Scope

This audit compares review routes, validation, controller/service behavior,
PostgreSQL persistence, OpenAPI, and the frontend review query and mutation
hooks. It does not change verified-purchase authorization, self-review denial,
upsert identity, pagination, notifications, or React Query invalidation.

## Concrete gaps found

1. PostgreSQL review records always return `tenantId`, `createdAt`, and
   `updatedAt`, but the anonymous OpenAPI response and handwritten frontend type
   omitted them.
2. The review request schema was anonymous in OpenAPI and did not reuse the
   actual trimming, rating bounds, non-empty comment, and maximum-length
   validator.
3. The paginated list response had no reusable review-specific schema even
   though runtime already uses the shared `{ items, page }` envelope.
4. Public review reads omitted invalid-tenant, invalid-product-ID, and invalid
   pagination errors.
5. Review upserts omitted validation, authentication, CSRF, product-not-found,
   self-review, and verified-purchase errors from the documented contract.

## Accepted direction

- Define named `CreateReviewRequest`, `Review`, and `ReviewList` schemas beside
  the commerce validator and use them for both reads and upserts.
- Make persisted review fields required in the repository and public contract.
- Document exact reachable codes and matching examples for each review status.
- Consume generated review request and response types at frontend HTTP
  boundaries while preserving cache replacement and invalidation behavior.

## Implemented and verified

- Named `CreateReviewRequest`, `Review`, and `ReviewList` schemas now use the
  implemented validator and shared pagination envelope and require persisted
  tenant and timestamp fields.
- The repository contract reflects its non-null PostgreSQL review columns.
- Public reads and authenticated upserts constrain every reachable validation,
  authentication, CSRF, product, self-review, and verified-purchase error code
  with matching examples.
- Frontend review queries and mutations consume generated request and response
  types without changing cache replacement or list invalidation behavior.
- Full backend/frontend tests, coverage, typecheck, lint, formatting, generated
  contract parity, the frontend production build, and PostgreSQL integration
  scenarios pass.
