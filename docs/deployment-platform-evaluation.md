# MVP deployment platform evaluation

- Status: Planning baseline; provider selection pending staging spikes
- Date: 2026-07-19
- Scope: Bounded Portugal-first CampusMarket pilot

This document records the launch constraints that precede provider selection
and compares three deployment approaches. It is not a deployment ADR and does
not authorize live traffic, Stripe integration, or a provider commitment. The
two highest-scoring candidates must pass the staging spike below before an ADR
can select either one.

## Launch constraint record

The project is being built by one developer as a first ecommerce product. The
goal is a real, supportable pilot and a credible portfolio demonstration of
architecture that can evolve, not a claim that the first deployment already
needs hyperscale infrastructure. Because there is no measured production
traffic or established operating organization yet, the following values are
explicit planning assumptions. Replace them with measured or contractual
values before expanding the pilot.

| Constraint     | Initial planning value                                                                                                                                                                                                                                              | Revisit trigger                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cash budget    | Soft ceiling of EUR 75/month and hard ceiling of EUR 120/month for persistent production and staging infrastructure, before Stripe transaction fees                                                                                                                 | Two consecutive forecast months above the soft ceiling, or any forecast above the hard ceiling                               |
| One-time cash  | EUR 150 for domains, staging spikes, exports, and setup; promotional credits do not increase the accepted architecture budget                                                                                                                                       | A spike cannot test a launch gate inside its EUR 50 candidate cap                                                            |
| Operator time  | Value time at EUR 20/hour for comparison; allow at most 12 setup hours per candidate spike and target no more than four routine hours/month after launch                                                                                                            | A candidate needs recurring server work above the target                                                                     |
| Pilot scale    | Up to 10 approved Portuguese sellers, 500 registered buyers, 100 orders/month, 20 concurrent browser sessions, and a 10-request/second bounded load test                                                                                                            | Observed p95, database, memory, or connection pressure reaches 70% of the accepted limit, or the seller/order cohort expands |
| Residency      | Customer content, primary PostgreSQL data, application runtime, searchable logs, and routine backups stay in the EEA. Contractual support access or subprocessors outside the EEA require a reviewed DPA, transfer mechanism, least privilege, and an access record | Legal review requires strict EEA-only processing, or a provider/subprocessor changes                                         |
| Availability   | Internal target of 99.5% monthly public readiness for the bounded pilot, excluding announced maintenance approved by the operator. This is not a customer SLA                                                                                                       | Paid commitments or traffic justify an HA topology and a contractual SLO                                                     |
| Recovery       | RTO 4 hours and RPO 24 hours, matching the accepted backup/restore baseline. Prefer PITR where affordable, but do not advertise a smaller RPO until a provider restore is rehearsed                                                                                 | A paid order volume makes up to 24 hours of acknowledged-write loss unacceptable                                             |
| Support        | Best-effort human support from 08:00 to 20:00 Europe/Lisbon during announced pilot days; acknowledge a critical incident within two hours in that window. No 24/7 promise                                                                                           | A contract, payment volume, or user cohort requires staffed coverage                                                         |
| Experience     | One developer with repository-level Node.js, React, Docker Compose, PostgreSQL, migrations, and CI experience, but no prior production ecommerce, marketplace payment, or formal on-call experience                                                                 | A second trained operator joins or an external managed-operations contract is accepted                                       |
| Incident owner | The project maintainer is the deployment incident commander, database operator, and support escalation owner during staging. A named person and one backup must replace this role label before live payments                                                        | Live-mode readiness review                                                                                                   |

The cash ceilings are guardrails, not known business requirements. If a real
pilot cannot meet them without dropping a launch gate, the budget must be
revisited explicitly; reliability, recovery, and security requirements must not
be silently weakened to fit the estimate.

## Architecture and acceptance boundary

Scalability here means preserving replaceable boundaries and an evidence-based
growth path:

- deploy the checked-in non-root backend and frontend images by immutable digest;
- keep PostgreSQL managed, authenticated, encrypted, private from the public
  internet where the provider permits it, and exportable with standard
  `pg_dump`/`pg_restore` tooling;
- run migrations as a separately observable one-shot operation before
  application rollout, never as an uncontrolled replica side effect;
- expose stable HTTPS, custom domains, `/healthz` and `/readyz`, and a URL whose
  proxy behavior is suitable for future Stripe webhooks;
- keep secrets in a managed store, production and staging isolated, and
  persistent state outside application containers;
- collect 30 days of searchable redacted application logs, alert on the
  repository policy, and retain audit records independently from logs;
- run cleanup and future reconciliation as scheduled one-shot jobs using the
  same immutable backend image;
- retain daily portable database exports for 14 days in a different failure
  domain, in addition to provider recovery features;
- preserve the last accepted image digests and rehearse application rollback
  separately from database restore; and
- describe infrastructure in version control and maintain an exit procedure.

A candidate fails regardless of score if it requires sleeping production
services, an ephemeral database, a public unauthenticated database, mutable
release tags, unbounded proxy trust, unobservable migrations/jobs, or a
provider-only database export.

## Cost method

Prices and capabilities were checked against official provider material on
2026-07-19. List prices are in USD unless stated otherwise. The planning
conversion uses the ECB 2026-07-16 reference rate of `EUR 1 = USD 1.1467`
(`USD 1 = approximately EUR 0.8721`). Estimates include a conservative 23%
Portuguese VAT reserve because the future contracting entity and reverse-charge
treatment are not yet known. Recalculate from a saved provider quote before the
spike and ADR.

The estimates assume always-on, isolated production and staging, low pilot
traffic, one domain allowance, 30-day external log retention where the platform
does not include it, and portable off-platform backups. They exclude Stripe
fees and business costs common to all candidates. Promotional credits and free
tiers are excluded. Operator opportunity cost is shown separately from cash so
an inexpensive but labor-intensive host does not appear artificially cheap.

## Candidate A: Render managed application platform

### Proposed spike topology

- Frankfurt backend and frontend Docker web services on Starter compute;
- Frankfurt Render Postgres Standard for production and Starter for isolated
  staging;
- Render cron job for daily cleanup and portable backup execution;
- a registry such as GHCR holding immutable image digests;
- Render-managed domain TLS and health checks; and
- an EEA-capable external log/alert destination plus independent encrypted
  object storage for 14-day logical backups.

Render documents Frankfurt as an application and datastore region, prebuilt
Docker images for web services and cron jobs, pre-deploy commands, managed TLS,
health checks, Blueprint infrastructure definitions, and deploy rollback.
Paid PostgreSQL has PITR, but a Hobby workspace retains only three days of PITR
and seven days of platform logs. Therefore the accepted 14-day backup and
30-day log policies require independent sinks. Image-backed rollback must use a
digest that remains available in the registry.

Render's DPA states that its primary processing operations take place in the
United States and provides transfer mechanisms for ex-EEA processing. A
Frankfurt workload therefore satisfies the initial customer-content location
assumption only conditionally; it does **not** satisfy a future strict
EEA-only-processing requirement without further contractual evidence.

### Twelve-month estimate

| Item                                                                 |                                         Planning amount |
| -------------------------------------------------------------------- | ------------------------------------------------------: |
| Four Starter web services (backend and frontend in two environments) |                                            USD 28/month |
| Production Standard plus staging Starter PostgreSQL                  |                                            USD 42/month |
| Cron execution and small storage/egress allowance                    |                                           USD 4-7/month |
| External 30-day logs, independent backups, and domain allowance      |                                         EUR 17-27/month |
| Estimated cash including tax reserve                                 |             **EUR 100-118/month; EUR 1,200-1,416/year** |
| Operator estimate                                                    | 12 setup hours + 3 hours/month = 48 hours; EUR 960/year |
| Estimated first-year TCO                                             |                                     **EUR 2,160-2,376** |

The estimate fits the hard cash ceiling but can cross the soft ceiling. Render
is operationally attractive for one developer, but its native Hobby retention,
conditional residency, platform limits, and external observability dependency
must be proved in the spike.

## Candidate B: DigitalOcean Droplets plus Managed PostgreSQL

### Proposed spike topology

- one 2 GiB production Droplet and one 1 GiB staging Droplet in Frankfurt;
- Docker Compose with Caddy or an equivalent host ingress for TLS, health
  routing, and immutable backend/frontend images;
- separate 1 GiB Managed PostgreSQL clusters in Frankfurt;
- a locked-down VPC, cloud firewalls, SSH keys, automatic security updates, and
  no public database access;
- systemd units/timers for deploy, cleanup, backup, and restart behavior;
- DigitalOcean Monitoring/Uptime plus an EEA-capable centralized application
  log destination; and
- daily Droplet backups plus encrypted portable database exports to an
  independent failure domain.

DigitalOcean lists Frankfurt availability for Droplets and Managed PostgreSQL.
The current basic Droplet prices are USD 6/month for 1 GiB and USD 12/month for
2 GiB; basic 1 GiB Managed PostgreSQL is USD 15.15/month. Managed PostgreSQL
takes daily backups, retains seven days, and restores to a new cluster at the
latest transaction or a selected point. Droplet monitoring and resource alerts
are free, but the operator remains responsible for the host OS, ingress,
container runtime, patching, firewall, disk pressure, deployment scripts,
application log pipeline, and recovery automation.

The DigitalOcean DPA covers GDPR and international-transfer mechanisms. As with
Render, a Frankfurt resource location must not be represented as proof that no
support or subprocessor access can leave the EEA.

### Twelve-month estimate

| Item                                           |                                           Planning amount |
| ---------------------------------------------- | --------------------------------------------------------: |
| Production and staging Droplets                |                                              USD 18/month |
| Two isolated 1 GiB Managed PostgreSQL clusters |                                           USD 30.30/month |
| Daily Droplet backups                          |                              approximately USD 5.40/month |
| Object storage/export allowance                |                                               USD 5/month |
| External 30-day logs and domain allowance      |                                           EUR 12-22/month |
| Estimated cash including tax reserve           |                   **EUR 78-98/month; EUR 936-1,176/year** |
| Operator estimate                              | 20 setup hours + 6 hours/month = 92 hours; EUR 1,840/year |
| Estimated first-year TCO                       |                                       **EUR 2,776-3,016** |

This approach offers transparent primitives and strong portfolio evidence for
host hardening and automation, but it misses the routine operator-time target
unless the spike demonstrates reliable automation. Its single-node application
and database topology is acceptable only for the initial 99.5% internal target;
it has an explicit later path to multiple app nodes, a load balancer, and
database standby nodes.

## Candidate C: AWS ECS Fargate plus RDS for PostgreSQL

### Proposed comparison topology

- isolated staging and production in `eu-central-1` using ECS Fargate services,
  ECR image digests, Application Load Balancers, and ACM certificates;
- private RDS PostgreSQL instances with 14-day automated-backup retention and
  PITR;
- ECS one-shot tasks triggered by EventBridge Scheduler for cleanup, backups,
  and future reconciliation;
- Secrets Manager or SSM Parameter Store, CloudWatch Logs/metrics/alarms, and
  SNS notification routing; and
- Terraform or CloudFormation for VPC, IAM, security groups, services,
  schedules, alarms, backups, and budget controls.

ECS charges for requested Fargate vCPU/memory rather than orchestration. ECS
supports health-aware rolling deployments and automatic rollback using its
circuit breaker or CloudWatch alarms. RDS supports configurable one-to-35-day
automated backup retention and point-in-time restore into a new instance.
EventBridge Scheduler covers one-shot and recurring tasks and its current free
tier is far above this pilot's daily job volume.

This option provides the clearest granular IAM, scaling, observability, and HA
growth path, but it also introduces the most services, configuration surface,
and billing traps. Application Load Balancers, public IPv4 addresses, log
ingestion, secrets, storage, data transfer, and especially NAT gateways can
cost more than the application tasks. A secure quote must be saved from the AWS
Pricing Calculator; omitting network components to make the estimate look
smaller is not acceptable.

### Twelve-month estimate

| Item                                                             |                                                                Planning amount |
| ---------------------------------------------------------------- | -----------------------------------------------------------------------------: |
| Fargate tasks for two small environments                         |                                                                USD 18-30/month |
| Two RDS Single-AZ pilot instances and storage                    |                                                                USD 30-50/month |
| Load balancers and public IPv4                                   |                                                                USD 45-60/month |
| ECR, logs, alarms, secrets, backups, DNS, and transfer allowance |                                                                USD 15-30/month |
| NAT gateway if the accepted design requires one                  | add at least roughly USD 35/month per always-on gateway before data processing |
| Estimated cash including tax reserve, without NAT                |                                    **EUR 130-180/month; EUR 1,560-2,160/year** |
| Operator estimate                                                |                    30 setup hours + 10 hours/month = 150 hours; EUR 3,000/year |
| Estimated first-year TCO                                         |                                                            **EUR 4,560-5,160** |

AWS exceeds the initial hard cash ceiling and greatly exceeds the operator-time
target. It remains a viable scaling reference and future migration candidate,
but the desktop comparison does not justify spending pilot complexity merely
for brand recognition on a portfolio.

## Weighted comparison

Scores are from zero to the category weight. A score is evidence for spike
ordering, not provider acceptance.

| Category                                                  |  Weight | Render | DigitalOcean |    AWS |
| --------------------------------------------------------- | ------: | -----: | -----------: | -----: |
| Mandatory runtime, HTTPS, job, migration, and release fit |      25 |     21 |           22 |     25 |
| Operability for the current single developer              |      20 |     18 |           12 |      7 |
| PostgreSQL recovery and data protection                   |      15 |     11 |           11 |     15 |
| Twelve-month cash fit                                     |      15 |     12 |           12 |      5 |
| Logs, metrics, alerts, and status visibility              |      10 |      7 |            6 |     10 |
| Portability, automation, and exit                         |      10 |      8 |            9 |      7 |
| Scaling path and portfolio evidence                       |       5 |      3 |            5 |      5 |
| **Total**                                                 | **100** | **80** |       **77** | **74** |

Render and DigitalOcean are the two staging-spike candidates. AWS is not
rejected as an architecture; it loses this pilot round because its cash and
operational burden are disproportionate to unmeasured traffic.

The provider-neutral local preparation and candidate configuration templates
are recorded in the
[zero-cost staging readiness baseline](staging-spike-readiness.md). Passing
those local gates does not change the scores or replace either external spike.

All three providers expose public status information, but incident counts are
not directly comparable because service taxonomies and disclosure thresholds
differ. Before each spike, archive the candidate's prior 12 months of official
region/service incidents, note any repeated database, deploy, DNS, or control
plane failure pattern, and subscribe the incident owner to current status
notifications. A public status page is diagnostic evidence, not an availability
guarantee.

## Security ownership and rejection gates

The provider owns physical facilities and the managed service control plane.
The project owner always retains responsibility for application authorization,
tenant isolation, secrets and key rotation, least-privilege roles, database
grants, migrations, data classification and deletion, dependency/image
patching, log content, restore validation, incident response, and Stripe/legal
readiness. On a Droplet, the project additionally owns the OS, Docker daemon,
ingress, firewall, TLS automation, and host availability.

Reject a candidate during the spike if any of these conditions remains true:

- the DPA, subprocessors, or support-access model cannot meet the recorded EEA
  constraint;
- production requires free-tier sleep, local container persistence, a public
  database, shared staging secrets, or an unrecoverable provider identifier;
- the real images cannot receive stable HTTPS traffic or preserve proxy and
  cookie behavior;
- one-shot migrations and cleanup cannot be locked, observed, retried safely,
  and alerted;
- 30-day searchable logs or the repository's actionable alerts cannot be
  delivered inside the hard budget;
- a fresh-target restore cannot meet RTO/RPO or portable exports cannot be
  retained independently for 14 days;
- immutable rollback cannot preserve the previous image digest and database
  compatibility decision;
- ordinary scale, connection, bandwidth, egress, build, job, or log limits are
  hidden or incompatible with the pilot; or
- monthly cost cannot be capped and alerted before the hard ceiling.

## Provider-neutral exit procedure

1. Keep backend and frontend images in a project-controlled registry by digest;
   never make the runtime platform the only image source.
2. Keep infrastructure definitions, provider variables, migration commands,
   probes, smoke tests, and scheduled commands in version control without
   secrets.
3. Produce a checksum-verified PostgreSQL custom-format export plus migration
   metadata in an independent EEA storage account. Test it on PostgreSQL 18
   outside the candidate platform.
4. Export redacted operational evidence needed for the incident and retention
   window; do not treat provider logs as permanent business records.
5. Provision the replacement in isolation, restore, migrate compatibly, deploy
   the same digests, and pass probes plus critical workflow smoke tests.
6. Lower DNS TTL before cutover, stop or drain writes when required, switch DNS,
   observe, and retain a documented fallback window.
7. Revoke provider credentials, remove secrets and registry access, request
   data deletion, capture invoices and deletion evidence, then destroy only
   after the retention and rollback window closes.

## Time-boxed staging spike

Run Render first, then DigitalOcean. Cap each candidate at 12 operator hours and
EUR 50 cash, and delete temporary resources after capturing evidence. Use
separate staging secrets, synthetic `.invalid` identities, test inventory, and
no live Stripe credentials or personal data.

For each candidate:

1. Save the exact pre-tax quote, tax treatment, region, service limits, DPA and
   subprocessor review, status-history notes, and teardown procedure.
2. Push the checked-in production images by immutable digest and provision an
   isolated PostgreSQL 18 target through version-controlled infrastructure.
3. Run all versioned migrations as a visible one-shot task; prove that a failed
   migration prevents application rollout.
4. Verify `/healthz`, `/readyz`, catalog, login/renewal, CSRF, cart, current
   development checkout, seller fulfilment visibility, and both tenant brands.
5. Verify stable custom-domain HTTPS and proxy headers. For webhook network
   ingress only, send a Stripe test-mode delivery to a disposable no-storage
   echo target in the staging boundary and delete it afterward. Do not install a
   Stripe SDK, add payment tables, or interpret the event as an order/payment.
6. Run cleanup in dry-run and active synthetic-data modes as the scheduled
   backend image; verify single execution, exit logs, retry behavior, and a
   missed/failed-job alert.
7. Deliver redacted JSON logs to the proposed 30-day sink and trigger readiness,
   5xx, latency, log-gap, deployment, and database alerts to the incident owner.
8. Take both provider-native and portable backups, restore into a fresh target,
   run repository recovery validation, and record achieved RPO/RTO evidence.
9. Restart containers/host, simulate an unhealthy release, roll back to the
   prior digest, and verify that database compatibility blocks unsafe rollback.
10. Measure p50/p95 latency from Portugal at idle and during the bounded
    10-request/second test; capture CPU, memory, database connections, errors,
    egress, and recovery after load.
11. Record every manual step, privilege used, limitation, failed assumption,
    measured cost, operator time, and teardown/export result.

The deployment ADR may be written only after both evidence sets exist. It must
choose the region and topology, explain why the loser lost, replace estimates
with measured cost, and name the live incident owner and backup.

## Official research sources

- Render: [pricing](https://render.com/pricing),
  [regions](https://render.com/docs/regions),
  [prebuilt images](https://render.com/docs/deploying-an-image),
  [health checks](https://render.com/docs/health-checks),
  [PostgreSQL recovery](https://render.com/docs/postgresql-backups),
  [logs](https://render.com/docs/logging),
  [rollbacks](https://render.com/docs/rollbacks),
  [Blueprints](https://render.com/docs/infrastructure-as-code),
  [DPA](https://render.com/dpa), and [status](https://status.render.com/).
- DigitalOcean: [Droplet pricing](https://www.digitalocean.com/pricing/droplets),
  [Managed PostgreSQL pricing](https://www.digitalocean.com/pricing/managed-databases),
  [regional availability](https://docs.digitalocean.com/platform/regional-availability/),
  [PostgreSQL restore](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/),
  [Monitoring](https://docs.digitalocean.com/products/monitoring/),
  [DPA](https://www.digitalocean.com/legal/data-processing-agreement), and
  [status](https://status.digitalocean.com/).
- AWS: [ECS/Fargate pricing](https://aws.amazon.com/ecs/pricing/),
  [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/),
  [RDS backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html),
  [load-balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/),
  [VPC pricing](https://aws.amazon.com/vpc/pricing/),
  [ECS failure detection](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-failure-detection.html),
  [EventBridge pricing](https://aws.amazon.com/eventbridge/pricing/), and
  [public health dashboard](https://health.aws.amazon.com/health/status).
- Currency conversion: [ECB euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).
