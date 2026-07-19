# ADR 0004: Email verification and password recovery

- Status: Accepted
- Date: 2026-07-18
- Owners: MercadoZetta maintainers

## Context

MercadoZetta authenticates a tenant-scoped email and password against a short
access-cookie session and a rotating persistent refresh session. Users do not
currently prove control of their email address and have no recovery path when
they lose their password. Adding either flow creates an account-enumeration,
token-leakage, and session-takeover surface.

This decision defines the public contract, persistence boundary, lifetimes,
abuse controls, and session effects before choosing an email provider. It is
consistent with the existing cookie-session contract in
[ADR 0001](0001-cookie-sessions.md) and OWASP guidance for
[forgotten passwords](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[email verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html),
and [authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
Authenticated password changes, email changes, profile management, and account
deactivation remain later work in Step 11.

## Decision

### Account state and compatibility

The private `User` representation gains nullable `emailVerifiedAt`. Existing
users, including deterministic demo users, are backfilled with `createdAt` so a
deployment does not unexpectedly lock out established accounts. New users start
with `emailVerifiedAt = null` and registration requests a verification message.
The public seller profile does not gain verification state.

An unverified user with otherwise correct credentials receives
`403 EMAIL_VERIFICATION_REQUIRED`; wrong credentials retain the existing generic
`401 INVALID_CREDENTIALS`. This does not disclose an account to a caller who
does not already know its password. Verification never creates a session: after
success the user signs in through the ordinary login endpoint.

Password reset does not implicitly verify an email. A reset may be completed
for an unverified account, but that account remains unable to sign in until its
separate verification succeeds.

### Public HTTP contract

All four endpoints require a resolved tenant, JSON content type, and an allowed
`Origin`, like login and registration. They do not require an access cookie or
CSRF proof because a user who has lost a password may have no session; possession
of the purpose-bound one-time token authorizes only its named confirmation.

| Endpoint                                      | Request body                                | Success                                                       |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `POST /auth/email-verification/requests`      | `{ email }`                                 | `202` with the generic request response                       |
| `POST /auth/email-verification/confirmations` | `{ token }`                                 | `204`; marks the current email verified                       |
| `POST /auth/password-reset/requests`          | `{ email }`                                 | `202` with the generic request response                       |
| `POST /auth/password-reset/confirmations`     | `{ token, password, passwordConfirmation }` | `204`; changes the password, revokes sessions, clears cookies |

Both request endpoints return the same public body for a syntactically valid
email whether the tenant/email pair is absent, already verified, suppressed by
the per-account issuance limit, awaiting delivery, or accepted by the delivery
adapter:

```json
{
  "message": "If an eligible account exists, instructions will be sent."
}
```

Schema and tenant failures may return their normal `400` responses because they
do not depend on account existence. A public IP/tenant rate limit may return
`429`, also independently of whether the email exists. Request processing uses
the same normalized email lookup, performs equivalent dummy token work for a
miss, does not wait for provider delivery, and observes a common minimum response
floor. Tests compare the hit, miss, verified, and suppressed response status and
body; timing is monitored with a tolerant bound rather than a flaky exact-time
assertion.

Confirmation endpoints return one generic
`400 INVALID_OR_EXPIRED_ACCOUNT_TOKEN` for a malformed, unknown, wrong-tenant,
wrong-purpose, superseded, consumed, or expired token. Password-policy and
password-confirmation failures are reported before consumption. A failed
confirmation never changes a user, token, or session. Successful confirmation
does not return a user, token, credential, or session.

### Token format and storage

Verification and reset tokens use the ASCII form `<selector>.<secret>`, where
the selector is a random UUID and the secret is 32 cryptographically random
bytes encoded with unpadded base64url. The token is tenant- and purpose-bound.
Only its delivery adapter and the receiving browser see the raw value.

The new tenant-scoped account-token record contains:

- UUID `id` (the selector), `tenantId`, `userId`, and purpose
  `email_verification` or `password_reset`;
- an HMAC-SHA-256 hash of the complete token and the version of the account-token
  hashing secret used to produce it;
- the user's `emailVersion` captured when an email-verification token is issued;
- `createdAt`, `expiresAt`, nullable `consumedAt`, and nullable `invalidatedAt`
  plus a constrained invalidation reason.

The raw token, secret, destination email, message body, and full delivery URL
are never stored in this table, application logs, audit metadata, API responses,
or analytics. The versioned account-token HMAC ring is separate from JWT,
refresh-token, and CSRF secrets. Production startup validates an active version
and a bounded retained set; an old version remains until all tokens created with
it have expired.

At most one unconsumed, non-invalidated token exists for one
tenant/user/purpose. Issuance invalidates the previous active record before
creating its replacement in one transaction. Verification tokens expire after
8 hours. Password-reset tokens expire after 30 minutes. Application checks
expiry even if scheduled cleanup has not run.

Confirmation first resolves the random selector inside the request tenant, then
recomputes the hash using the record's locally configured secret version. A
conditional mutation requires matching tenant, purpose, hash, current email
version where applicable, no consumption/invalidation timestamp, and
`expiresAt > now`. This makes one concurrent confirmation the only winner.

### Email binding and future email changes

Users gain a non-negative `emailVersion`, initially zero. Verification records
capture that version, and confirmation updates `emailVerifiedAt` only when the
current version still matches. A later email-change flow must increment
`emailVersion`, clear `emailVerifiedAt`, invalidate outstanding verification and
reset records, and verify the new destination. This prevents an old mailbox
link from verifying a replacement address without storing another copy of the
email in the token table.

### Password reset and session revocation

Password reset applies the same password policy and bcrypt cost as registration.
The following operations commit in one PostgreSQL transaction:

1. conditionally consume the reset token;
2. replace `passwordHash` and increment the user's `tokenVersion`;
3. revoke every active tenant/user session with reason `password_reset`;
4. invalidate the user's other outstanding password-reset records; and
5. append sanitized `user.password_reset` and all-session revocation audit
   events.

If any write or audit insertion fails, the token remains usable and every domain
change rolls back. The response clears the current browser's access, refresh,
and CSRF cookies, does not automatically log the user in, and instructs the UI
to return to ordinary login. Incrementing `tokenVersion` also invalidates access
cookies that race with or predate the stored session revocation.

Email verification similarly consumes its token, sets `emailVerifiedAt`, and
appends `user.email_verified` atomically. These unauthenticated, token-authorized
events have no `actorId`; the resource is the tenant-scoped user. Audit metadata
contains neither an email nor a token. Token issuance and rejected attempts use
sanitized operational counters rather than append-only audit rows.

### Dedicated abuse controls

Recovery and verification never share the login or registration limiter.
Defaults are independently configurable within validated positive bounds:

| Scope                                     | Default                                      | Public behavior                                     |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Each request route, tenant plus client IP | 5 requests per 15 minutes                    | Dedicated `429` code and `Retry-After`              |
| Each confirmation route, tenant plus IP   | 10 attempts per 15 minutes                   | Dedicated `429` code and `Retry-After`              |
| Each tenant/user/purpose                  | 60 seconds between issues, 3 issues per hour | Silently suppress and retain the generic `202` body |

The client IP comes from Express only under the exact trusted-proxy contract in
the production deployment guide. Per-account counters are evaluated only after
lookup and never change the public response. Request flooding does not lock,
deactivate, or otherwise change an account. Repeated invalid confirmations and
delivery failures are emitted only as sanitized structured metrics/logs: tenant,
route, outcome category, and correlation ID are allowed; email, token selector,
token hash, and full URL are not.

### Delivery-provider boundary

Core services depend on a small `AccountMessageSender` port for verification,
reset, and reset-notice messages. Tests use a capturing fake. No production
route is enabled without a configured implementation that accepts work without
making the HTTP response depend on mailbox or account existence, keeps the raw
token only in its protected delivery boundary, and reports retryable delivery
failure without logging message contents.

Provider selection is deliberately deferred until deployment requirements
define region, data processing, sender-domain authentication, bounce handling,
delivery guarantees, and retention. A generic SMTP dependency is not added by
default. Provider credentials use the deployment secret store and never the
account-token hash ring.

Messages point to an allowlisted frontend origin. The raw token is placed in a
URL fragment, not a query string; the frontend reads it into memory, immediately
removes the fragment with history replacement, and submits it in the JSON
confirmation body. It never places the token in browser storage, telemetry, or
an error report. Referrer policy remains `no-referrer` on these pages.

## Persistence and repository boundary

The implementation adds an `AccountTokenRepository` and exposes it from the
existing PostgreSQL mutation coordinator beside users, sessions, and audits.
The user repository gains tenant-qualified operations to find an account for
recovery, conditionally mark the current email version verified, and replace a
password while incrementing `tokenVersion`. The session repository's existing
tenant/user all-session revocation is reused inside the same outer transaction;
the session service must not open a nested transaction for reset.

The migration adds tenant-qualified foreign keys, token-purpose and lifecycle
checks, one-active-token uniqueness, lookup and expiry-cleanup indexes, the two
user state columns, and the new constrained audit event types. Expired and
invalidated account tokens are temporary security data; their cleanup and final
retention window are completed with Step 12. Until then they are retained for a
short operational investigation window and are never treated as authentication
evidence after expiry.

## Implementation sequence

1. Add the reviewed user/account-token/audit schema migration, repository
   contracts, PostgreSQL adapters, versioned hash configuration, and focused
   schema/repository tests.
2. Add Zod validators, request/confirmation services, atomic verification and
   reset transactions, fake delivery adapter, dedicated limiters, controller
   routes, and focused unit/integration tests.
3. Update OpenAPI and generated frontend declarations; add provider-neutral
   frontend request, confirmation, login-blocked, and cookie-clearing states.
4. Select and configure a production delivery adapter only from concrete
   deployment requirements, then add deterministic browser coverage using a
   test inbox or capturing adapter.

## Required verification

Focused and PostgreSQL-backed tests must prove tenant isolation; identical
request success responses for existing, absent, verified, and suppressed
accounts; normalization; dedicated limits; 256-bit token generation; no raw
token persistence or logging; hash-secret overlap; replacement, expiry,
wrong-purpose rejection, and a single concurrent confirmation winner; email
version binding; existing-user backfill; unverified-login behavior; successful
verification; password-policy rejection without consumption; atomic password,
token-version, session-revocation, and audit writes; rollback on audit failure;
cookie clearing; no automatic login; and safe delivery failure.

OpenAPI examples must enumerate every reachable code without placing a real
token in examples. Browser tests must prove fragment removal and the absence of
recovery material in `localStorage`, `sessionStorage`, URLs after replacement,
and request/application logs.

## Consequences

Users can prove mailbox control and regain access without making account lookup
observable through normal request responses. A stolen reset token remains a
powerful short-lived credential, so it is narrowly scoped, single-use, hashed at
rest, kept out of URLs visible to servers, and followed by complete session
revocation. The design adds persistent temporary security data, another
versioned secret ring, delivery reliability requirements, and dedicated abuse
monitoring. It does not add MFA, security questions, automatic login after
recovery, email-change behavior, a provider SDK, or a general-purpose job queue.
