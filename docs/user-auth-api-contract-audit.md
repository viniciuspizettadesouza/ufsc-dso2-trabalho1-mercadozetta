# User and Authentication API Contract Audit

## Scope

This audit compares the user and authentication routes, controllers, services,
PostgreSQL mappings, Zod/OpenAPI definitions, and frontend authentication, user,
and seller hooks. Cookie names, flags, CSRF behavior, rotation semantics, and
session lifetime remain governed by `docs/decisions/0001-cookie-sessions.md` and
are not changed by Step 9.

## Concrete gaps found

1. OpenAPI required string `username` and `telephone` values even though both
   PostgreSQL columns and public-user results are nullable. It marked user
   timestamps optional even though persisted users always have both timestamps.
2. Login and session restoration returned the same `{ user, session }` shape,
   but each operation constructed an anonymous inline schema. Active-session
   listing likewise used an unnamed `{ sessions: Session[] }` response.
3. Session `createdAt` was documented as optional even though every persisted
   session is created with it and the PostgreSQL column is non-null.
4. User and authentication errors used generic error schemas and examples rather
   than constraining codes per HTTP status. Login can return `403 INVALID_ORIGIN`
   when an Origin or Referer is present but disallowed, and that response was
   missing entirely from OpenAPI.
5. `GET /users/{userId}` documented UUID validation through `sellerIdSchema`,
   but the Express route passed the raw parameter to PostgreSQL without running
   that validator.
6. Registration returned `{ newUser: User }` while other corrected creation and
   update mutations return the created resource directly. No deployed API client
   requires the wrapper.
7. Frontend login, session restoration, registration, and seller-profile code
   used untyped Axios responses or handwritten approximations instead of the
   generated OpenAPI response types.

## Accepted direction

- Define reusable `User`, `Session`, authentication-state, and session-list
  response schemas beside the request validators and use them throughout
  OpenAPI.
- Enumerate actual user/authentication error codes and provide a matching example
  for every documented code, without changing cookie-session behavior.
- Validate seller profile IDs in the implemented route.
- Return a bare `User` from registration with status `201`, then regenerate and
  consume the accepted response types in the frontend hooks.
- Keep `AuthContext` focused on the in-memory identity fields the UI consumes;
  enforce the complete generated response type at the HTTP boundary.

## Implemented and verified

- Reusable `User`, `SellerProfile`, `Session`, `AuthStateResponse`, and
  `SessionListResponse` schemas now describe the implemented persisted shapes.
- Every user and authentication error response constrains its reachable codes
  and provides a matching example. Login documents invalid-origin failures.
- Registration returns a bare `User`, and seller-profile requests validate the
  route ID before controller and repository access.
- Authentication restoration, login, registration, and seller-profile Axios
  boundaries consume generated contract types. Cookie, CSRF, refresh,
  revocation, and session-lifetime behavior was not changed.
- Focused contract and validator tests, the full backend/frontend suites,
  coverage, PostgreSQL integration scenarios, and both browser workflows pass.
