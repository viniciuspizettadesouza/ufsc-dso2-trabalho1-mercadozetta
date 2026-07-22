# ADR 0008: Development account-message delivery sink

- Status: Accepted
- Date: 2026-07-22
- Owners: MercadoZetta maintainers

## Context

[ADR 0004](0004-account-verification-recovery.md) defines the production
verification and recovery boundary. It prohibits tokens and complete delivery
URLs in operational logs and requires a reviewed asynchronous provider before
production delivery is enabled. That decision remains correct.

Step 17 adds the user-visible password-reset and email-verification journeys,
but local development has no email provider, sender domain, mailbox, or external
delivery credentials. A developer still needs a deterministic way to obtain the
single-use link and exercise request, confirmation, expiry, error, and session
invalidation behavior. A fake that captures messages only inside tests does not
make the running local application usable.

This creates a deliberate tension: printing the link is the smallest useful
local sink, but its URL contains the raw token that ADR 0004 excludes from
ordinary logs. Silently changing ADR 0004 would rewrite the historical decision
and silently weakening production redaction would be unsafe. This ADR therefore
records a narrow development-only exception.

## Decision

When `NODE_ENV` is not `production`, the application composes a
`DevelopmentAccountMessageSender`. It writes one structured
`development_account_message` event to the backend's local standard output for
email verification, password reset, password-reset notice, and email change.
Token-bearing messages contain a `deliveryUrl`; notices without a token do not.

The exception has these mandatory boundaries:

- Production never composes this sender. Without a reviewed production sender,
  delivery-dependent routes retain the existing
  `ACCOUNT_DELIVERY_UNAVAILABLE` behavior.
- The URL origin is the first configured `CORS_ORIGIN`, with the local frontend
  origin as the development fallback. It is not accepted from the request.
- Raw tokens are placed in the URL fragment. Confirmation pages read the token
  into memory, remove the fragment with replacement navigation, and submit it
  only in the JSON confirmation body.
- The event contains the message kind, tenant ID, user ID, and local delivery
  URL. It excludes the destination email, password values, token hashes, and
  message body.
- Local output containing a delivery URL is sensitive. It must not be shipped
  to shared log aggregation, attached to bug reports, committed, retained as
  test evidence, or used with real customer accounts.
- Existing expiry, one-active-token, single-use, purpose, email-version,
  token-version, rate-limit, and generic-response controls still apply. The sink
  does not bypass confirmation validation.

This ADR supplements ADR 0004 only for the local non-production delivery
mechanism. It does not amend or supersede ADR 0004's production provider,
redaction, enumeration-resistance, token, or session requirements. Step 20 must
replace this exception with reliable production delivery before live payments
or real users make recovery operationally required.

## Consequences

Developers can complete all account confirmation flows without external
infrastructure or secrets, and automated tests can verify that email addresses
are absent from the emitted event. The implementation remains behind the
existing `AccountMessageSender` contract, so a future provider does not enter
account services directly.

The tradeoff is that anyone who can read the local backend output can use an
unconsumed token before it expires. Local logs must therefore be treated as a
temporary credential-bearing development channel, not as ordinary sanitized
observability. A configuration error cannot activate this sink in production
because composition checks `NODE_ENV` before constructing it.

## Alternatives considered

### Rewrite ADR 0004

Rejected. ADR 0004 is an accepted historical record. A later decision may
narrow it explicitly, but the original decision must remain unchanged.

### Add a development inbox HTTP endpoint

Rejected for this slice. It would add another token-bearing API, authorization
and tenant-isolation rules, OpenAPI surface, browser UI, and retention boundary
solely for development.

### Persist messages to a file or database table

Rejected. Persistence would increase secret lifetime, require cleanup and file
permission rules, and create another source that could accidentally enter
backups or commits.

### Require a real email provider for development

Rejected. It would add credentials, network dependence, cost, and provider
coupling before the production delivery requirements in Step 20 are accepted.

## Verification

Focused tests verify the fragment URL, omission of the destination email, and
message-kind routing. Frontend workflow tests cover successful, missing-token,
pending, and API-error states. Production composition continues passing no
sender, so delivery-dependent controllers fail closed rather than falling back
to the development sink.
