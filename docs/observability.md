# Production observability policy

MercadoZetta uses provider-neutral newline-delimited JSON logs on standard
output. The container platform is responsible for collecting, protecting,
querying, retaining, and deleting those records. Application logs diagnose the
running service; they are not the append-only business and security audit record
defined in the [audit-event contract](audit-events.md) for session, inventory,
order, and future privileged mutations.

## Stable fields and severity

Every backend record includes `service=mercadozetta-api`, `environment`, a
numeric Pino `level`, `time`, and an event name or message. Pino's standard
levels map to trace 10, debug 20, info 30, warn 40, error 50, and fatal 60.

Production has a fixed `info` minimum:

- `fatal`: startup configuration or dependency failures that prevent service;
- `error`: unexpected application errors and completed HTTP responses at 5xx;
- `warn`: completed HTTP responses at 4xx, including validation,
  authentication, authorization, CSRF, rate-limit, and not-found responses;
- `info`: service lifecycle events and completed HTTP responses below 400; and
- `debug` and `trace`: disabled in production. Add them only for bounded,
  reviewed diagnostics that cannot contain secrets or personal data.

Do not configure production as `silent`, `fatal`, `error`, or `warn`: request
completion and lifecycle records are part of the minimum operational signal.
Any future runtime log-level control must validate this rule and use the normal
deployment change process.

Completed request records use `event=http_request_completed` with `requestId`,
`method`, matched `route`, `statusCode`, `durationMs`, and the resolved
`tenantId` and authenticated `userId` when available. The matched route is a
template, so URL parameters and queries are not stored.

## Error and sensitive-data boundary

Expected `AppError` and malformed-JSON responses are represented by their 4xx
request-completion record. Do not attach their response body, validation
details, request body, or stack trace to the log. Unexpected errors retain the
generic public 500 response while Pino serializes the internal error under
`err` with its type, message, and stack. Fatal lifecycle failures use the same
serializer.

Never place passwords, password hashes, cookies, authorization values, access
or refresh tokens, CSRF values, signing keys, database connection strings,
request or response bodies, email addresses, telephone numbers, or usernames in
log objects or error messages. The logger redacts known security-field paths as
defence in depth, but redaction is not authorization to log an entire domain,
request, response, configuration, or environment object. User and tenant UUIDs
or stable IDs are sufficient for correlation. Access to centralized logs must
be least-privilege, reviewed, encrypted in transit and at rest, and itself
monitored.

## Retention and disposal

Until a legal, contractual, or deployed-product requirement says otherwise,
retain production application logs for 30 days in searchable storage and then
delete them. Copies, exports, and backups must follow the same deletion deadline.
Development and test logs are ephemeral and must not be shipped to the
production log store.

Before changing the period, document the reason, data classes, access model,
cost, deletion behavior, and any legal review. The append-only audit record has
its own pending retention decision; it must not inherit this 30-day
application-log policy accidentally.

## Provider-neutral alerts

Evaluate thresholds separately per production environment and include the
affected tenant only as diagnostic context. Page only for symptoms requiring
immediate human action; send lower-urgency security and capacity signals to the
operational review channel.

| Signal                              | Initial threshold                                                                                        | Response                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Public availability or readiness    | Probe fails continuously for 5 minutes                                                                   | Page; check deployment health and PostgreSQL readiness                                 |
| HTTP 5xx ratio                      | At least 20 requests and 5% 5xx over 5 minutes                                                           | Page; group by route and correlate request IDs                                         |
| Fatal lifecycle event               | Any `startup_configuration_invalid` or `application_start_failed`                                        | Page during deployment; stop rollout or roll back                                      |
| Request latency                     | p95 `durationMs` above 2 seconds with at least 100 requests over 10 minutes                              | Notify; inspect slow routes and database health                                        |
| Authentication/CSRF rejection spike | At least 50 relevant 401/403 responses over 5 minutes and 3 times the preceding hourly baseline          | Notify security review; group by route and tenant without adding client secrets or PII |
| Rate-limit spike                    | At least 20 HTTP 429 responses over 5 minutes                                                            | Notify security review; verify abuse versus legitimate client failure                  |
| Log pipeline gap                    | No backend records for 5 minutes while the public service remains healthy, or any malformed JSON records | Page the logging pipeline owner                                                        |

These are starting thresholds, not service-level objectives. Review them after
the first production traffic baseline and after incidents. Test alert routing
before launch and at least quarterly; every page must identify an owner and a
specific first diagnostic action.

This policy follows the sensitive-data, protection, monitoring, and bounded
retention guidance in the
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html),
the actionable symptom-oriented monitoring guidance in the
[Google SRE Workbook](https://sre.google/workbook/monitoring/), and Pino's
[level and redaction contract](https://github.com/pinojs/pino/blob/main/docs/api.md).
