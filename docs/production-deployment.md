# Production deployment baseline

MercadoZetta ships a production-oriented container baseline alongside its
development Compose stack. The baseline compiles the Express application,
serves the Vite bundle from Nginx, runs both application containers as non-root
users, and keeps PostgreSQL and the backend off the host network.

This is a deployment foundation, not a complete hosting platform. A real
deployment must add managed secrets, authenticated and backed-up data storage,
monitoring, and infrastructure-specific availability controls.

## Topology and images

`docker-compose.yml` explicitly selects the `development` Dockerfile stages and
continues to run `ts-node-dev` and Vite. `docker-compose.prod.yml` selects the
following production stages:

- The backend build stage emits JavaScript into `dist/` and rewrites TypeScript
  path aliases. Its runtime stage contains production npm dependencies and the
  compiled output only, uses Node.js `24.18.0-alpine3.23`, and runs as `node`.
- The frontend build stage compiles the Vite bundle with `/api` as its API base.
  Nginx `1.28.3-alpine3.23` serves the static files on port 8080 as `nginx` and
  proxies `/api/` to the internal backend.
- PostgreSQL 18 stores all application data. A one-shot migration container
  applies the committed Drizzle migrations before the backend starts.

Nginx rewrites only the refresh cookie path from `/auth` to `/api/auth`. The
root-scoped `__Host-` access and CSRF cookies remain on `/`, preserving their
browser security requirements.

## Required configuration

Set these values in the deployment secret/environment provider before running
Compose:

```bash
export CORS_ORIGIN=https://market.example.com
export POSTGRES_PASSWORD='replace-with-a-long-random-database-password'
export JWT_SIGNING_KEYS='{"2026-07":"replace-with-a-long-random-secret"}'
export JWT_ACTIVE_KID=2026-07
export REFRESH_TOKEN_HASH_SECRETS='{"2026-07":"replace-with-a-different-random-secret"}'
export REFRESH_TOKEN_HASH_ACTIVE_VERSION=2026-07
export CSRF_SECRETS='{"2026-07":"replace-with-another-random-secret"}'
export CSRF_ACTIVE_VERSION=2026-07
```

Do not put real values in repository files or shell history. The sample above
shows the shape only. Retain previous key-ring versions for the overlap periods
defined in the [cookie-session ADR](decisions/0001-cookie-sessions.md).

The production backend refuses to start when its PostgreSQL connection string,
port, trusted-proxy, CORS, or security-ring configuration is missing or invalid.
The current production Compose baseline supplies the internal PostgreSQL URL,
port 3333, and `TRUST_PROXY_HOPS=1`. Set `APP_PORT` to
change the host port and `VITE_TENANT_ID` to build the other built-in brand.
Because Vite values are compiled into the bundle, changing the tenant requires
rebuilding the frontend image.

## Structured logs

The backend writes newline-delimited JSON to standard output. Platform log
collection should preserve each record as one event. Application lifecycle
records use a stable `event` name and serialize errors under `err`. Completed
HTTP requests use `event=http_request_completed` with these fields:

- `requestId`, which is also returned as `X-Request-Id`;
- `method` and the matched `route` pattern, without URL parameters or queries;
- `statusCode` and `durationMs`;
- `tenantId` after tenant resolution; and
- `userId` only after successful authentication.

Successful requests use info level, 4xx responses use warn, and 5xx responses
use error. Request headers and bodies are not included. Logger redaction also
censors cookie, authorization, password, token, and CSRF fields if application
code accidentally attaches one to a structured log object. Keep collecting
standard output through the deployment platform; retention and alert thresholds
are defined in the provider-neutral
[production observability policy](observability.md).

## TLS and trusted proxies

Terminate TLS at a load balancer or ingress in front of Nginx and redirect HTTP
to HTTPS there. Production authentication cookies are always `Secure`; login
and renewal will not work over plain HTTP. The public HTTPS origin, with no
path, must exactly match one of the comma-separated `CORS_ORIGIN` values.

The bundled Nginx proxy sends `X-Forwarded-For`, `X-Forwarded-Host`,
`X-Forwarded-Port`, and `X-Forwarded-Proto` to Express. The backend trusts one
proxy hop. If another trusted ingress is inserted between the client and this
Nginx instance, set `TRUST_PROXY_HOPS` to the exact number of trusted hops in
the platform configuration. Never trust an unbounded proxy chain: client IPs
feed authentication and registration rate limiting.

An external proxy must preserve `Set-Cookie`, the request `Origin`,
`X-Tenant-Id`, `X-CSRF-Token`, and the forwarded headers. It must also preserve
the `/api` prefix contract or implement the same refresh-cookie path rewrite.

## Build, deploy, and verify

Build and start the baseline after exporting the required values:

```bash
export BACKEND_IMAGE=registry.example.com/mercadozetta/backend:2026-07-16
export FRONTEND_IMAGE=registry.example.com/mercadozetta/frontend:2026-07-16

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up --detach --wait --no-build
```

Push the versioned images to the deployment registry when the target host is
different from the build host. Never deploy a mutable `latest` tag.

The probes are:

- `GET /healthz`: Nginx/static-server liveness.
- `GET /readyz`: backend readiness through Nginx; it returns 200 only when
  PostgreSQL is connected.
- `GET /api/health` with `X-Tenant-Id`: proxied backend liveness.

After startup, run:

```bash
curl --fail https://market.example.com/healthz
curl --fail https://market.example.com/readyz
curl --fail https://market.example.com/
curl --fail -H 'X-Tenant-Id: mercadozetta' \
  https://market.example.com/api/products
```

Then perform the login, checkout, seller fulfillment, and notification checks
from the README smoke workflow. `npm run test:production` automates image
building, non-root checks, frontend loading, both probes, and a proxied catalog
request against an isolated temporary Compose project.

## Rollback

Keep the previously accepted backend and frontend image tags and database
backup available. Application-only rollback is:

1. Stop writes or put the public endpoint in maintenance mode if the release
   changed persisted behavior.
2. Set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to the previous immutable tags.
3. Run `docker compose -f docker-compose.prod.yml up --detach --wait --no-build`.
4. Repeat the probe, catalog, login, and critical commerce smoke checks.
5. Reopen traffic only after readiness and workflow verification pass.

Do not roll application images backward across an incompatible database change.
Restore data only from a verified backup and only under that migration's
documented rollback procedure. Capture container logs before replacing a failed
release so the cause remains diagnosable.
