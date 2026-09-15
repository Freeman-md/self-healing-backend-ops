# Self-Healing Backend Operations

## Local Docker testbed boundary

The managing system can mount `/var/run/docker.sock` only in the controlled local dissertation testbed. That socket grants powerful control over the local Docker engine; application allowlisting reduces accidental action scope but is not a production-safe security boundary.

Production deployment must replace this adapter with an authenticated restricted executor API that applies least-privilege target authorization, idempotency, execution deadlines and complete audit records before invoking an allowlisted Docker or Kubernetes operation.

## Managing-system relational persistence

The managing system uses Prisma ORM 7 with a normalized SQLite schema. Policy
catalogues are seeded data; executable Docker handlers remain in an allowlisted
code registry.

For an existing pre-Prisma database, stop the managing system and run these
commands from `managing-system/` with the intended `DATABASE_URL`:

```text
npm run prisma:backup
npm run prisma:prepare-legacy
npm run prisma:baseline-legacy
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:backfill
npm run prisma:backfill
npm run prisma:verify-seed
npm run prisma:studio
```

The backup command creates a timestamped byte-for-byte copy and refuses to
overwrite an existing file. The preparation step preserves the seven legacy
tables under `legacy_*` names. The baseline step transactionally creates the
normalized schema and records the initial migration in Prisma's migration
history; the following deployment command verifies that no migration remains
unapplied. Backfill validates every stored JSON payload,
preserves identifiers and timestamps, reports per-entity read/migrated/skipped/
failed counts, and exits unsuccessfully when any record remains unresolved.
Running it twice verifies idempotency.

SQLite remains appropriate for the isolated dissertation prototype but provides
limited concurrency and operational tooling. A PostgreSQL move is intentionally
deferred and does not affect the managed system's existing PostgreSQL database.


## Agent recovery strategies (Milestone 8)

`RECOVERY_MODE=baseline|agent` is unchanged. In agent mode,
`AGENT_STRATEGY_VERSION=v1|v2` selects V1 (implementation 1.0.0) or V2
(implementation and agent prompt 2.0.0); omitted versions select V2. Baseline
ignores this setting. Existing historical experiment records are not rewritten;
exports label absent version metadata as not recorded. New batches freeze the
agent strategy, implementation and prompt versions alongside the existing
shared model prompt version.

Baseline and V1 use the external recovery loop. V2 records its own semantic
full diagnosis/plan/decision before choosing a registered action, observes fresh
structured evidence, and chooses completion or escalation. Application code owns
record identifiers and associations. Execution still passes through ActionService,
SafetyService and the allowlisted handler registry. Three action invocations and
eight model turns bound the loop; invalid calls consume turns. Completion requires
deterministic healthy evidence. Provider failures finalize a failed trial without
fabricating a model decision. Mandatory safety escalation stops immediately.

Tool observations omit raw terminal output, free-form evidence text and string
signal values. The complete persisted evidence remains available for audit;
the agent receives a sanitized projection preserving deterministic statuses.
After a blocked/failed action without post-action evidence, the controlled trial
operation collects and persists a fresh snapshot and links it to the action result.

### Manual Agent V2 smoke verification

With the existing approved local runtime configuration supplied, use the repository
Docker testbed from its root:

```sh
RECOVERY_MODE=agent AGENT_STRATEGY_VERSION=v2 docker compose up -d --build
```

Wait for a healthy managed system and confirm the managing-system startup event
reports V2 and prompt 2.0.0. In this isolated testbed, stop the supported managed
application target using `docker stop managed-system-app` to trigger the monitor.
Check the persisted monitor trial: ordered diagnosis/plan/decision history,
registered action results with safety checks and before/after evidence links,
provider telemetry, and resolved or escalated termination within the limits.
Resolved termination requires deterministic healthy final evidence. Record the
trial ID, source revision, outcome and observed limits in the milestone Completion
Record. This credential-dependent smoke is pending; mocked tests do not verify
live OpenAI or Docker behaviour. The comparative benchmark and report draft remain
outside this implementation milestone.
