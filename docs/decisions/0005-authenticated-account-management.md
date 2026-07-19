# ADR 0005: Authenticated account management and deactivation

- Status: Accepted
- Date: 2026-07-19
- Owners: MercadoZetta maintainers

## Context

MercadoZetta now has tenant-scoped cookie sessions, password recovery, email
verification, and append-only audit events. An authenticated user still cannot
change their password, edit their profile, move the account to another email
address, or deactivate the account. These operations have different security
and commerce consequences and must not be treated as one generic user update.

The relational model also prevents casual user deletion. Products, orders,
order items, status history, reviews, notifications, sessions, account tokens,
and audit actors can refer to a tenant-qualified user. Orders and audit events
are historical records, while active orders may still require action from a
buyer or seller. Hard deletion or an unqualified cascade would destroy or
orphan marketplace evidence.

This decision extends the cookie-session contract in
[ADR 0001](0001-cookie-sessions.md), the persistence constraints in
[ADR 0002](0002-postgresql-persistence.md), and the verification/recovery
contract in [ADR 0004](0004-account-verification-recovery.md). It defines the
HTTP, reauthentication, session, persistence, audit, and lifecycle rules before
implementation. It does not select an email provider or activate frontend
account-management flows.

## Decision

### Endpoint and authorization boundary

Account-management routes operate only on `req.userId` inside the resolved
tenant. They never accept a user ID, tenant ID, token version, verification
state, deactivation state, or other ownership field from the request body.

| Endpoint                         | Request body                                          | Success                                                |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `PATCH /account/profile`         | one or both of `{ username, telephone }`              | `200` with the updated public user                     |
| `POST /account/password-changes` | `{ currentPassword, password, passwordConfirmation }` | `204`; revokes all sessions and clears cookies         |
| `POST /account/email-changes`    | `{ email, currentPassword }`                          | `202`; sends a confirmation to the proposed address    |
| `POST /account/deactivation`     | `{ currentPassword, confirmation: "DEACTIVATE" }`     | `204`; soft-deactivates the account and clears cookies |

Every route requires the existing cookie authentication middleware, an allowed
Origin, and the signed double-submit CSRF proof. Profile edits use the current
authenticated session. Password change, email-change initiation, and
deactivation additionally require the current password in the same request.
There is no reusable reauthentication cookie or bearer token. A future MFA
factor may strengthen this boundary through a separate decision.

The three password-confirming operations have independent tenant/user/client-IP
limits, defaulting to five attempts per 15 minutes.
`403 REAUTHENTICATION_FAILED` covers an absent or incorrect current password;
the response does not disclose password-comparison details. Rate limiting never
locks or deactivates an account. Password values, hashes, email values, and
request bodies are excluded from logs and audit metadata.

Services lock the tenant/user row for sensitive mutations and re-check that the
account is active. A request authenticated immediately before a concurrent
deactivation or token-version change cannot commit against stale account state.

### Profile changes

Only `username` and `telephone` are profile-editable. Validation trims both
values, requires at least one field, bounds username to 1–80 characters, and
allows telephone to be either `null` or a trimmed 1–32 character value. The
service constructs the update explicitly; omitted fields remain unchanged.
Empty strings, unknown fields, and attempts to assign identity, tenant,
credential, verification, lifecycle, or role fields are rejected with the
shared invalid-request response. The service still constructs the persistence
update from the explicit allowlist as a second mass-assignment boundary.

Profile changes do not increment `tokenVersion`, revoke sessions, or change
email verification. The profile update and `user.profile_updated` audit event
commit in one transaction. Audit metadata contains only
`changedFields: "username,telephone"` or the applicable subset, never the old or
new values. The response uses the existing public user shape.

### Password changes and reauthentication

Authenticated password change uses the registration/reset password policy and
bcrypt cost. The replacement must match its confirmation and differ from the
current password. Password-policy and confirmation errors occur before any
write. A failed current-password comparison returns
`REAUTHENTICATION_FAILED`; a reused current password returns
`400 PASSWORD_REUSE_NOT_ALLOWED`.

After hashing outside the transaction, these operations commit atomically:

1. lock and re-check the active tenant/user plus the password-hash and
   token-version values used by the pre-transaction reauthentication;
2. replace `passwordHash` and increment `tokenVersion`;
3. revoke every active tenant/user session with reason `password_change`;
4. invalidate every active password-reset token with reason
   `password_change`; and
5. append `user.password_changed` plus the all-session `session.revoked` audit
   event.

No current session survives. The response clears access, refresh, and CSRF
cookies and does not create replacement credentials. This is intentionally the
same fail-closed session posture as password reset; the user signs in again
with the new password. If any domain or audit write fails, the password,
token-version, sessions, tokens, and audit rows all roll back.

### Two-stage email changes

Changing the login email is not a direct profile patch. It is a two-stage
operation so a delivery outage or abandoned message does not replace the
working verified address or lock the user out.

Initiation normalizes the proposed address, requires it to differ from the
current address, verifies the current password, and rejects an address already
owned by another user in the tenant with `409 EMAIL_UNAVAILABLE`. It replaces
any prior pending change for that user and creates a purpose-bound
`email_change` token using the hashing, lifetime, key-overlap, one-active-token,
and delivery protections from ADR 0004. Email-change tokens expire after 30
minutes. The pending destination is protected account data: it may be stored in
a dedicated tenant/user pending-change record
but never in the account-token table, audit metadata, application logs, or API
responses.

The current `users.email`, `emailVersion`, and `emailVerifiedAt` remain
unchanged during initiation. Existing sessions and login through the current
address continue to work. The `202` response is fixed and does not echo either
address. Delivery uses the existing `AccountMessageSender` boundary and the
endpoint remains unavailable under the same provider-independent readiness
rule when no sender is configured.

The confirmation route is public and token-authorized, following the Origin,
rate-limit, generic-token-error, fragment-removal, and no-storage rules in ADR
0004:

| Endpoint                                | Request body | Success                                                                                |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `POST /auth/email-change/confirmations` | `{ token }`  | `204`; promotes and verifies the pending address, revokes sessions, and clears cookies |

Confirmation locks the account and pending change, verifies the tenant,
purpose, hash, expiry, and captured current `emailVersion`, and re-checks tenant
email uniqueness. If another account acquired the address after initiation,
confirmation returns `409 EMAIL_UNAVAILABLE` without consuming the token or
changing the current address.

Successful confirmation atomically:

1. conditionally consumes the `email_change` token;
2. promotes the normalized pending address to `users.email`;
3. increments `emailVersion` and sets `emailVerifiedAt` to the confirmation
   time, because possession of the new-mailbox token proves control;
4. removes the pending change and invalidates every other verification, reset,
   and email-change token with reason `email_changed`;
5. increments `tokenVersion` and revokes all active sessions with reason
   `email_changed`; and
6. appends `user.email_changed` and the all-session `session.revoked` audit
   event.

The response clears auth cookies and requires login through the new address.
Audit records contain no old, pending, or new email. `user.email_change_requested`
may be recorded at initiation with only the user as resource and actor; it also
contains no address. This two-stage promotion refines ADR 0004's future-email
rule: outstanding tokens are invalidated when the change is confirmed, and the
version increment plus verified timestamp occur together rather than exposing
an unverified replacement address before mailbox proof.

Pending email changes expire with their token and are temporary security data.
They do not reserve an address indefinitely. Their cleanup and final retention
window belong to Step 12.

### Soft deactivation and commerce state

Self-service deactivation is a soft, terminal account state, not deletion.
The user row gains nullable `deactivatedAt`. Authentication lookup and protected
session validation treat a deactivated user as unavailable; login retains the
generic `401 INVALID_CREDENTIALS` response. Public seller-profile lookup returns
the ordinary not-found response for a deactivated seller.

Deactivation is rejected with
`409 ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS` while the user is the buyer or
seller on any `placed`, `confirmed`, or `shipped` order. The user must complete
or cancel eligible work first. This avoids silently abandoning fulfillment and
keeps the existing order state machine authoritative.

Once no active order blocks the mutation, one transaction:

1. sets `deactivatedAt`, increments `tokenVersion`, replaces the password with
   an unusable random hash prepared before the transaction, and clears
   `username` and `telephone`;
2. revokes all sessions with reason `account_deactivated` and invalidates every
   active account token or pending email change with the same reason;
3. archives every seller listing without deleting its inventory or historical
   order references;
4. deletes the user's cart and cart items, watchlist entries, and notifications;
5. retains reviews, orders, order items, status history, products, and audit
   history; and
6. appends `user.deactivated` with the archived-listing count and the
   all-session `session.revoked` audit event.

The response clears all auth cookies. The deactivated UUID and tenant/email
identity remain reserved so historical foreign keys stay valid and the same
identity cannot be recreated as a new account. Retained reviews continue to
show their content but render the author as a generic deactivated user; they do
not link to a seller profile. Historical order views use immutable order-item
facts and a generic deactivated-party label rather than exposing cleared or
private profile fields. Audit rows remain immutable under the existing
retention decision.

Deactivation has no self-service reactivation path. Hard deletion,
anonymization of the retained email or authored content, and data-subject export
or erasure requests require separate legal, identity-verification, retention,
and referential-integrity requirements. They are not approximated by cascading
deletes or by modifying append-only audit evidence.

### Audit event contract

The schema and repository add these constrained event types before their
mutations ship:

| Event                         | Actor                                  | Resource | Safe metadata            |
| ----------------------------- | -------------------------------------- | -------- | ------------------------ |
| `user.profile_updated`        | authenticated user                     | user     | changed field names only |
| `user.password_changed`       | authenticated user                     | user     | none                     |
| `user.email_change_requested` | authenticated user                     | user     | none                     |
| `user.email_changed`          | none; token-authorized confirmation    | user     | none                     |
| `user.deactivated`            | authenticated user before deactivation | user     | archived listing count   |

All committed account mutations write audit evidence in the same PostgreSQL
transaction. Reauthentication failures, validation failures, unavailable email
addresses, blocked deactivation, and expired tokens do not create audit rows;
they may produce sanitized operational counters without personal data.

## Persistence and implementation sequence

Implementation remains behind repository and transaction-coordinator
boundaries. Controllers translate validated HTTP requests, clear cookies when
required, and never perform password comparison, account-state checks,
ownership checks, or persistence directly.

The bounded sequence is:

1. Add a reviewed migration for `users.deactivated_at`, the pending-email-change
   record, `email_change` token/invalidation purposes, and account audit event
   types. Add database-neutral repository operations and focused schema/adapter
   tests.
2. Add strict Zod schemas and service transactions for profile update and
   password change, including sensitive-operation rate limits, cookie clearing,
   audit rollback, stale-session concurrency, and tenant isolation tests.
3. Add the two-stage email-change and soft-deactivation services, including
   uniqueness races, active-order blocking, commerce cleanup/archive behavior,
   audit rollback, and public/authentication visibility tests.
4. Add controllers, routes, OpenAPI/generated types, and provider-neutral
   frontend states. Enable email delivery and browser coverage only after a
   deployment adapter satisfies ADR 0004.

## Required verification

Focused and PostgreSQL-backed tests must prove explicit editable fields;
normalization and validation; current-password reauthentication; dedicated
limits; password reuse rejection; all-session and access-token invalidation;
cookie clearing; atomic audit rollback; tenant isolation; concurrent sensitive
mutations; two-stage email behavior; pending-change replacement and expiry;
email uniqueness races; old-email validity before confirmation and new-email
validity afterward; token-purpose/version binding; deactivated login/session
denial; active-order blocking; listing archival; ephemeral-state cleanup;
retention of reviews, orders, order items, history, products, and audit rows;
and generic public rendering for deactivated users.

OpenAPI examples must enumerate every reachable error code without containing
real passwords, emails, or tokens. Logs and test failure output must not expose
credentials, pending destinations, personal profile values, or raw delivery
links.

## Consequences

Users gain explicit account controls without opening a generic mass-assignment
surface. Sensitive changes require fresh password knowledge, revoke all
sessions when identity or credentials change, and retain atomic audit evidence.
Two-stage email promotion keeps a working login until mailbox ownership is
proved. Soft deactivation preserves marketplace and audit history while
removing access, public profile data, active listings, and disposable personal
state.

The design adds a pending-email lifecycle, more constrained audit and
invalidation reasons, commerce-aware deactivation checks, and temporary
security-data cleanup work. It deliberately does not add hard deletion,
reactivation, MFA, a provider SDK, a general job queue, or frontend activation.
