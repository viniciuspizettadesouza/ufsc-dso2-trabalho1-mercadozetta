# ADR 0001: Cookie-Based Authentication and Rotating Sessions

- Status: Accepted
- Date: 2026-07-15
- Owners: MercadoZetta maintainers

## Context

MercadoZetta currently returns a 15-minute JWT from `POST /auth/login`, stores
it in `localStorage`, and sends it in an `Authorization` header. The JWT is
tenant-bound and includes the user's `tokenVersion`; protected requests also
check that version in the database. `POST /auth/logout` increments `tokenVersion`,
which intentionally revokes every token for that tenant/user.

This is a useful demo baseline, but browser script can read and exfiltrate the
token, expiration requires a new login, and the application cannot identify or
revoke one browser session. Moving authentication into cookies also makes an
explicit CSRF and credentialed-CORS contract necessary.

The design follows the OWASP guidance for
[session cookies](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[signed double-submit CSRF tokens](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
the refresh-token replay guidance in
[RFC 9700](https://datatracker.ietf.org/doc/rfc9700/), and the JWT validation
guidance in [RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725).

## Decision

### Browser and deployment boundary

Production will expose the frontend and API as same-origin HTTPS resources,
normally by routing `/api` to Express through the frontend reverse proxy. This
lets frontend JavaScript read the host-only CSRF proof without making any
authentication cookie script-readable. Separate frontend and API hosts and
cross-site deployments are not supported by this contract: the former cannot
read the host-only double-submit proof, and the latter would also require
`SameSite=None` and a larger CSRF and tracking surface. Local development may
use different ports on the same `localhost` host with explicit credentialed
CORS.

The browser will hold authentication only in cookies. Access and refresh tokens
must never appear in response JSON, JavaScript-readable storage, URLs, logs, or
error details. The frontend may keep the returned public user profile in memory;
after a reload it restores auth state through `GET /auth/session`. It will no
longer use `localStorage` as evidence that a user is authenticated.

### Cookies

Production cookies have the following exact contract:

| Purpose       | Name             | Attributes                                                                  | Lifetime and scope                                                                       |
| ------------- | ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Access JWT    | `__Host-mz_at`   | `HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`                    | `Max-Age=300` (5 minutes)                                                                |
| Refresh token | `__Secure-mz_rt` | `HttpOnly; Secure; SameSite=Lax; Path=/auth` and no `Domain`                | `Max-Age` is the smaller of the 7-day idle window and remaining 30-day absolute lifetime |
| CSRF proof    | `__Host-mz_csrf` | `Secure; SameSite=Lax; Path=/` and no `Domain`; deliberately not `HttpOnly` | Session-bound proof, replaced at login and refresh and cleared at logout                 |

Host-only cookies prevent one tenant or sibling host from choosing a cookie for
another host. `Path` limits incidental refresh-token exposure, but is not an
authorization boundary. The access cookie uses `Path=/` because protected API
routes are not under one prefix. `SameSite=Lax` preserves normal navigation
while providing defense in depth; CSRF validation remains mandatory.

Local development uses the same logical names without the `__Host-` or
`__Secure-` prefixes and may disable `Secure` only when `NODE_ENV=development`
or `test`. Production startup fails if secure cookies or HTTPS-aware proxy
configuration are not enabled. Cookie options are centralized and tested, not
selected ad hoc by controllers.

### Access tokens

Access tokens remain JWTs during this migration, signed with an explicitly
allowed algorithm. They contain only `sub` (user ID), `tenantId`, `sid`
(session ID), `tokenVersion`, `iat`, `exp`, `iss`, and `aud`. A distinct token
type is required so another JWT kind cannot be accepted as an access token.

Authentication requires all of the following:

1. a valid signature, allowed algorithm, issuer, audience, type, and expiry;
2. a resolved request tenant matching `tenantId`;
3. an active, unexpired session matching `sid`, `sub`, and `tenantId`; and
4. the user's current `tokenVersion` matching the claim.

The session lookup preserves immediate individual-session revocation. The
existing `tokenVersion` check preserves all-session and password-change
revocation. Browser endpoints accept only the access cookie. Bearer compatibility
existed only during migration and was deleted after frontend and browser tests
used the cookie contract.

### Refresh tokens and session records

A successful login creates one PostgreSQL session record and returns a refresh
token shaped as an opaque session selector plus at least 256 bits of random
secret. Only a keyed hash of the complete refresh token is stored. Logs and
database records never contain the raw token.

Each session record is tenant-scoped and contains:

- `_id`, `tenantId`, `userId`, and a stable random `familyId`;
- `refreshTokenHash`, optional `previousRefreshTokenHash`, `rotationCounter`,
  and `rotatedAt`;
- `createdAt`, `lastUsedAt`, `absoluteExpiresAt`, and `expiresAt`;
- `revokedAt`, `revokeReason`, and optional safe display metadata such as a
  coarse user-agent label (never a credential or full fingerprint).

Indexes include tenant/user/session lookup and expiry cleanup support.
Authorization checks compare application timestamps independently of scheduled
cleanup. Every query and mutation includes `tenantId`.

Refresh uses a PostgreSQL conditional update on the current hash. A successful
refresh rotates both tokens, moves the current hash to the previous slot, and
updates idle expiry without extending `absoluteExpiresAt`. The access lifetime
is 5 minutes, idle refresh lifetime is 7 days, and absolute session lifetime is
30 days. These defaults are configurable only within validated production
bounds.

If an already-rotated token is presented after the concurrency window, the
whole family is revoked as `refresh_reuse`, all its cookies are cleared, and the
request returns `401 REFRESH_TOKEN_REUSED`. An unknown, malformed, expired,
revoked, wrong-tenant, or older family token returns a generic authentication
failure without revealing which check failed.

### Concurrent refreshes

The Axios auth layer uses one in-flight refresh promise per browser tab and
retries an original request at most once. Tabs coordinate refresh intent and
completion through `BroadcastChannel` when available; correctness must not rely
on that browser feature.

The server allows a 5-second concurrency window. When compare-and-swap loses
and the supplied hash equals the immediately previous hash inside that window,
it returns `409 REFRESH_ALREADY_ROTATED` without issuing tokens, revoking the
family, or changing cookies. The client waits briefly and retries once, using
the successor cookie installed by the winning response. A previous-token use
outside the window is replay and revokes the family. This prevents ordinary
parallel requests from causing logout while never issuing a second successor
for one rotation.

### CSRF and Origin checks

All cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests, including
refresh and logout, require both:

- an `Origin` header exactly matching a configured frontend origin (with a
  narrowly tested `Referer` fallback for clients that omit `Origin`); and
- `X-CSRF-Token` matching the JavaScript-readable CSRF cookie and carrying a
  server signature bound to the session ID and a random nonce.

The signature uses a dedicated CSRF key, not a JWT or refresh-hash key. The
server compares proofs in constant time and verifies that the proof's session
matches the access or refresh session. `SameSite` is defense in depth, not the
only CSRF control. Login and registration do not yet have an authenticated
session, so they require an allowed `Origin`, JSON content type, and the existing
dedicated rate limits. Safe methods never change state.

The frontend reads only the CSRF proof and sends it in the custom header. This
cookie is not an authentication credential: stealing it alone cannot create an
authenticated request. XSS can still act as the user, so the existing Helmet
baseline and the planned Content Security Policy remain necessary.

### CORS and frontend transport

Axios sets `withCredentials: true` on the shared instance and never constructs
an `Authorization` header. The tenant selector remains `X-Tenant-Id`; it is not
proof of identity and must match the session tenant.

The backend uses an exact, non-empty production origin allowlist, sets CORS
`credentials: true`, permits `Content-Type`, `X-Tenant-Id`, `X-CSRF-Token`, and
`Idempotency-Key`,
and emits `Vary: Origin`. Wildcard origins, reflected unvalidated origins, and
credentialed requests from unlisted origins are forbidden. Credentialed CORS
cannot use `Access-Control-Allow-Origin: *`, as summarized by the
[Fetch/CORS guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#credentialed_requests_and_wildcards).

Cookies, authorization values, refresh hashes, passwords, and CSRF proofs are
redacted from request/application logs and are omitted from serialized errors.

### Login, renewal, and revocation API

- `POST /auth/login` creates a session, sets all three cookies, and returns only
  `{ user, session }` with safe session metadata.
- `GET /auth/session` validates the access cookie and returns `{ user, session }`.
  It does not rotate refresh tokens.
- `POST /auth/refresh` validates refresh cookie, tenant, Origin, and CSRF proof;
  rotates the refresh token; sets a new access token and CSRF proof; and returns
  `204`.
- `GET /auth/sessions` lists safe metadata for the current tenant/user.
- `DELETE /auth/sessions/:sessionId` revokes one owned session. Deleting the
  current session also clears its cookies.
- `POST /auth/logout/current` revokes the current session and clears cookies.
- `POST /auth/logout` retains its existing meaning: increment `tokenVersion`,
  revoke every active session for the tenant/user, and clear current cookies.

Logout responses clear cookies even when a referenced server session has
already expired. Failed automatic renewal clears in-memory identity and sends
the user to login while preserving the requested destination. The client does
not retry login, refresh, logout, or a request already marked as retried.

### Signing and secret rotation

JWT verification uses a configured key ring. New tokens carry a server-selected
`kid` and use the active signing key; verification selects only locally
configured keys and never follows a token-supplied URL. Rotation adds a new
active key, retains the previous verification key for at least the maximum
access-token lifetime plus clock skew, then removes it. Algorithms, issuer, and
audience are fixed in configuration rather than inferred from the token.

Refresh-token hashing and CSRF signing use separate versioned secrets. Their
versions are stored or encoded so an old and new secret can overlap during a
bounded rollout. Secret material comes from the deployment secret store, is
validated at startup, and is never committed. Development and test use distinct
local-only fallbacks when versioned rings are not configured.

## Migration sequence

1. Add cookie/session configuration and tests, the session model and indexes,
   refresh hashing, CSRF helpers, and cleanup behavior.
2. Add login/session/refresh/revocation endpoints behind cookie support while
   retaining Bearer access temporarily; add focused unit and database-backed
   login, expiry, rotation, replay, concurrency, CSRF, CORS, tenant-isolation,
   and revocation tests.
3. Configure credentialed Axios requests, memory-based auth bootstrap, refresh
   single-flight behavior, and protected routes; migrate frontend tests away
   from token/user `localStorage` fixtures.
4. Exercise the complete browser contract, then remove token JSON responses,
   Bearer parsing, `localStorage` auth compatibility, and transitional config.
5. Update OpenAPI, environment examples, authentication diagrams, deployment
   documentation, and secret-rotation runbooks at the step where each behavior
   becomes real.

As of 2026-07-16, steps 1 through 4 are verified. JWT access cookies use a configured
active `kid` and retained local verification keys; refresh-token hashes persist
their secret version; CSRF proofs encode theirs; and startup validates all three
key rings. Login returns only public user/session data, protected endpoints
accept only access cookies, and authenticated mutations have no CSRF bypass.
The rest of the marketplace browser workflows remain tracked separately in the
improvement plan.

The PostgreSQL implementation uses canonical UUID strings for user, resource,
and session identifiers. Refresh tokens still contain an opaque session selector plus
the same 256-bit random secret; JWT, CSRF, rotation, replay, expiry, revocation,
tenant, and key-ring rules in this ADR are unchanged.

Each step must be deployable with a bounded compatibility window. It must not
weaken tenant matching, backend ownership enforcement, or existing all-session
logout semantics.

## Required verification

Focused tests must prove secure cookie attributes and clearing; no token in JSON
or browser storage; credentialed allowlisted CORS; rejected disallowed origins;
CSRF rejection for missing, mismatched, forged, and wrong-session proofs; login
and session bootstrap; access and idle/absolute expiration; atomic rotation;
one concurrent winner; the 5-second loser response; replay family revocation;
failed-renewal cleanup; current, individual, and all-session revocation; signing
key overlap; safe redaction; and tenant isolation for every session operation.

## Consequences

Authentication credentials are no longer persistently readable by frontend
JavaScript, sessions become individually visible and revocable, and short
access-token expiry no longer forces a login. The cost is a persistent session
collection, an extra database check on protected requests, CSRF enforcement,
credential-aware CORS, rotation races that require explicit handling, and more
deployment secret lifecycle work.

This decision does not introduce OAuth, an external identity provider, device
fingerprinting, or cross-site cookie support. Those require separate product and
threat-model decisions.
