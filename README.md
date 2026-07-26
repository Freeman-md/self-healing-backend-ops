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
