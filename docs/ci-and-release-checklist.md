# CI and pre-merge checklist

This document defines the verification required before MercadoZetta changes are
merged. Local hooks provide fast feedback, but they are not the merge gate.

## Merge policy

- Work on a typed branch such as `feat/*`, `fix/*`, `test/*`, or `ci/*` and open
  a pull request. Do not use a push to `main` as the first complete verification.
- Protect `main` in GitHub. Require a pull request and the `audit`, `validate`,
  `deployment-validation`, `database-integration`, `browser-e2e`, and
  `production-smoke` checks. Block force pushes and require the branch to be up
  to date before merge.
- Treat an unavailable check as **not verified**, not as passed. When Docker is
  unavailable locally, keep the change on its branch and wait for every required
  pull-request check.
- Re-run affected checks after resolving conflicts or changing a lockfile,
  migration, generated contract, container definition, or workflow assertion.

The GitHub repository settings are external to this codebase and must be
configured by an administrator after CI job names change.

## Local verification

Install the exact dependency trees before the final verification:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

`npm run verify:ci` reproduces the checked-in CI gates in their logical order:
dependency audits, static validation, database integration, browser E2E, and
the production-image smoke test. It requires Docker and a locally installed
Playwright Chromium browser.

The faster commands are available for focused iteration:

| Command                    | Scope                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run audit:ci`         | Root, backend, and frontend high-severity dependency audits           |
| `npm run validate:ci`      | Format, deployment config, contracts, lint, types, build, unit tests  |
| `npm run test:integration` | Fresh PostgreSQL migrations and database-backed integration behavior  |
| `npm run test:e2e`         | Seeded PostgreSQL stack and Chromium user workflows                   |
| `npm run test:production`  | Production images, one-shot migrations, readiness, and smoke behavior |

The pre-push hook runs `npm run verify:push`, the fast formatting and main-test
gate. When a push is the next action, run that gate through the hook rather than
executing it manually and then repeating it during `git push`. Passing it does
not replace `verify:ci` or the required pull-request checks.
`validate:ci` also requires Docker Compose to parse the deployment topology,
although it does not start application containers.

Verbose Docker lanes should retain enough diagnostics for failure analysis but
return only a concise success summary to automated agents. Do not rerun a lane
that already passed on the same tree unless a relevant file changed.

## Change-specific additions

Run `npm run verify:ci` before marking a pull request ready. Also apply these
additional gates when the change touches the corresponding boundary:

| Change area                          | Additional verification                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| Drizzle schema or migration          | `npm --prefix backend run db:check` and `npm run test:recovery` |
| Deployment or runtime configuration  | `npm run test:staging:local`                                    |
| OpenAPI routes, schemas, or examples | `npm run generate:openapi`, then ensure the diff is intended    |
| Coverage-sensitive business logic    | `npm run test:coverage`                                         |

## CI design

The workflow keeps independent concerns in separate jobs so one early failure
does not hide later failures. Audit, static validation, deployment validation,
database integration, browser E2E, and production smoke run independently.
The workflow also runs weekly to catch newly published dependency advisories,
runner-image changes, and container drift before an unrelated merge discovers
them.

Repository scripts must use checked-in dependencies, tools explicitly installed
by the workflow, or baseline POSIX/Ubuntu utilities. Do not assume convenience
tools such as `rg` are installed on a GitHub runner. If a non-baseline tool is
required, install and version it explicitly in the workflow.

## PostgreSQL integration isolation

All integration suites use
`backend/test/integration/postgresqlTestDatabase.ts` to reset mutable data. Its
manifest deliberately excludes retained tenant and currency seed tables and
truncates every mutable table without `CASCADE`.

When a migration adds, removes, or renames a table, update the shared manifest
in the same change. The reset checks `pg_catalog.pg_tables` first and reports
unexpected or missing tables explicitly. Do not add private cleanup lists to
individual integration test files and do not use `CASCADE` to bypass an
incomplete manifest.

## Browser workflow assertions

Playwright tests must validate user-observable outcomes through semantic scope:

- locate the relevant page region or domain entity first, such as the list item
  for a specific order;
- assert status, values, and follow-up actions within that scope;
- prefer roles, labels, and accessible names;
- do not locate a formatting child such as `<strong>` and expect it to contain
  sibling text; and
- use a test ID only when the UI has no stable semantic locator.

API response assertions and UI assertions should both remain when they prove
different boundaries. A successful mutation alone does not prove that the
result is presented correctly to the user.

## Lessons encoded by this process

- A dynamic advisory can break an unchanged lockfile, so audits run before
  merge and on a schedule.
- A script's undeclared runner dependency is a portability defect, even when it
  works on one developer machine.
- A schema addition must update test isolation in the same pull request.
- A passing API operation does not make a DOM locator correct; E2E assertions
  must target the semantic container that owns the complete result.
- Independent CI lanes should report their failures in the same run rather than
  revealing them one push at a time.
