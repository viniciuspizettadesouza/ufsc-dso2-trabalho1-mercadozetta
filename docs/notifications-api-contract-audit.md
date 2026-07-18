# Notifications API Contract Audit

## Scope

This audit compares notification routes, validation, controller/service
behavior, PostgreSQL persistence, OpenAPI, and frontend list, unread-count, and
read-state hooks. It does not change tenant/user ownership, pagination,
notification creation side effects, unread-count cache math, or query
invalidation.

## Concrete gaps found

1. PostgreSQL notification reads and updates always return `tenantId`,
   `createdAt`, and `updatedAt`, but the anonymous OpenAPI and handwritten
   frontend types omitted them.
2. Paginated notification lists, unread counts, and read-state request/response
   shapes had no reusable domain schemas.
3. The frontend list hook normalized an already-required `{ items, page }`
   envelope and used assertions for unread counts and mutation responses.
4. List and count operations omitted invalid-tenant and authentication errors;
   lists also omitted invalid-pagination errors.
5. Read-state updates omitted invalid tenant, resource ID, or request body
   responses and documented notification absence generically rather than the
   ownership-concealing `NOTIFICATION_NOT_FOUND` code.

## Accepted direction

- Define named `Notification`, `NotificationList`, `UnreadNotificationCount`,
  and `NotificationReadRequest` schemas beside the commerce validators.
- Make non-null persisted fields required in the repository and public contract.
- Document exact reachable codes and matching examples for every notification
  response status.
- Consume generated notification types at frontend HTTP boundaries without
  changing cache updates, unread-count deltas, or invalidation behavior.

## Implemented and verified

- Named `Notification`, `NotificationList`, `UnreadNotificationCount`, and
  `NotificationReadRequest` schemas now require the persisted tenant and
  timestamp fields and reuse the shared pagination envelope.
- The repository contract reflects its non-null PostgreSQL notification fields.
- Lists, unread counts, and read-state updates constrain all reachable tenant,
  pagination, authentication, resource-ID, body, CSRF, and ownership-concealing
  not-found errors with matching examples.
- Frontend notification queries and mutations consume generated response and
  request types without changing cache replacement, unread-count deltas, or
  invalidation behavior.
- Full backend/frontend tests, coverage, typecheck, lint, formatting, generated
  contract parity, the frontend production build, and PostgreSQL integration
  scenarios pass.
