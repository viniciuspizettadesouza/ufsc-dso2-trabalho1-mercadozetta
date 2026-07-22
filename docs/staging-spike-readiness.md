# Local production-like rehearsal baseline

- Status: Local rehearsal baseline; external staging deferred
- Date: 2026-07-19
- Decision update: 2026-07-22
- Scope: Local verification without cloud accounts or paid resources

This baseline is retained as a local production-like regression and portability
check. The project owner deferred all external deployment work on 2026-07-22,
so it is not preparation for an active provider spike. It does not select a
provider and cannot prove public DNS/TLS, provider networking, managed secrets,
cloud logs/alerts, provider-native backup, Portugal latency, billing, or
contractual residency.

Candidate adapters live under `deploy/render/` and `deploy/digitalocean/`.
`npm run check:deployment` validates the no-secret DigitalOcean Compose model
and safety markers shared by both templates. The frontend production image
accepts `BACKEND_HOST` and `BACKEND_PORT` at runtime, defaulting to the existing
Compose service name and port, so the same built image can use provider private
service discovery without rebuilding application assets.

## What the local rehearsal proves

Run from the repository root:

```bash
npx playwright install chromium
npm run test:staging:local
```

The command uses only the local Docker engine and checked-in dependencies. It:

1. builds and starts the real production backend and frontend image stages;
2. runs all versioned migrations as a one-shot Compose service before backend
   readiness;
3. verifies that both application containers run as non-root users;
4. loads deterministic demonstration identities and inventory into the isolated
   temporary database;
5. verifies liveness, readiness, proxying, catalog access, login, cookie renewal,
   CSRF-protected mutations, checkout, seller fulfilment, notifications, and
   accessibility through the production Nginx boundary;
6. repeats the workflow for MercadoZetta/USD and CampusMarket/EUR;
7. sends 100 catalog requests with concurrency 10 for each tenant, fails on any
   response error or local p95 above two seconds, and prints p50/p95/p99 evidence;
8. runs data cleanup through the compiled backend runtime; and
9. runs the existing fresh-target PostgreSQL migration, backup, checksum,
   restore, and invariant rehearsal.

Every Compose project uses a dedicated temporary database volume and is removed
on completion. The embedded credentials and demonstration accounts are local
test values and must never be reused in staging or production.

### Verified local rehearsal

On 2026-07-19, the complete command passed for both production tenant builds.
Each tenant passed both Chromium workflows through the production Nginx proxy,
including production-prefixed secure cookies. The bounded load smoke completed
with zero failures: MercadoZetta measured 29 ms local p95 and CampusMarket
measured 21 ms local p95. The subsequent fresh-target recovery rehearsal
completed migration in 7,811 ms, backup in 272 ms, and restore/current-migration
validation in 2,255 ms. Its 75,131-byte archive passed SHA-256 and restored
invariant checks.

These timings describe one local run only. They are not cloud capacity,
availability, Portugal latency, or recovery-objective evidence.

To run only the bounded load smoke against an already running compatible
environment:

```bash
LOAD_BASE_URL=http://127.0.0.1:8088 \
LOAD_TENANT_ID=mercadozetta \
npm run test:load:smoke
```

`LOAD_REQUESTS`, `LOAD_CONCURRENCY`, and `LOAD_MAX_P95_MS` may tune a recorded
experiment. Keep the accepted pilot baseline at 100 requests, concurrency 10,
and 2,000 ms until a reviewed plan changes it. This is a smoke test, not a
capacity claim or a substitute for Portugal-origin measurements.

## Evidence required only if deployment is reopened

No provider evidence is currently pending. If the project owner explicitly
reopens external deployment, a paid or credit-backed spike remains responsible
for:

- an exact quote, tax treatment, budget alert, service limits, and measured
  operator time;
- Frankfurt resource placement plus DPA, subprocessors, support access, and the
  prior twelve months of relevant official incidents;
- image publication and deployment by registry digest;
- public custom-domain DNS, managed HTTPS, stable webhook ingress, and exact
  proxy-header behavior;
- managed secrets, least-privilege application/migration/cleanup/backup roles,
  and private encrypted PostgreSQL connectivity;
- centralized 30-day logs, metrics, repository-defined alerts, and delivery to
  the named incident owner;
- scheduled one-shot execution, failure notification, concurrency protection,
  and retry evidence;
- provider-native backup plus a portable export in another failure domain,
  followed by a timed fresh-target restore;
- restart, unhealthy-release rollback, migration compatibility, and retained
  previous image digest;
- representative latency measured from Portugal; and
- complete export, credential revocation, resource deletion, and billing
  teardown evidence.

Passing locally means a candidate may begin this provider evidence list. It is
not permission to accept a provider or enable live payment.

## No-cost stopping point

This command remains useful even with no deployment planned because it checks
the production image boundary, migrations, browser workflows, bounded load,
cleanup, and recovery locally. Step 16's external acceptance remains incomplete
and inactive. Do not create provider accounts or resources, run external
spikes, or write a provider ADR unless the project owner explicitly restores
deployment to the roadmap.
