# Milestone 5: Managing-System PostgreSQL Control Plane

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-08-04  
**Depends On:** Milestone 4 Prisma ORM and Relational Persistence  
**Target Pull Request:** —  
**Target Branch:** `feat/milestone-5-managing-system-postgresql`  
**Superseded By:** —

## Goal

Replace the managing system's active SQLite persistence with a fresh, dedicated PostgreSQL control-plane database. The managing system must record all future evidence, decisions, plans, action results, trials and evaluations in this separate database while preserving the current recovery behaviour and safety boundaries.

Historical SQLite records are archived dissertation evidence. They are not operational data and must not be imported into PostgreSQL.

## Required behaviour

### Dedicated control-plane database

- Add a `managing-system-postgres` Compose service with its own database name, credentials, health check and named volume.
- Configure the managing system to use only this PostgreSQL service.
- Keep `managed-system-postgres` unchanged as the managed target's database.
- Do not add `managing-system-postgres` to the container-runtime allowlist or any recovery action catalogue.
- Preserve the managed system's existing PostgreSQL configuration and data volume.

### Prisma PostgreSQL migration

- Change the active Prisma datasource, configuration and dependencies from SQLite to PostgreSQL.
- Replace the active SQLite migration history with a clean PostgreSQL-compatible initial migration for the current relational model.
- Preserve the current relational model, slug IDs, relationships, indexes, seeded policy catalogue and generated Prisma Client location unless PostgreSQL requires an equivalent representation change.
- Remove active SQLite adapter, `better-sqlite3` dependency, SQLite URL defaults and SQLite-only runtime configuration after PostgreSQL validation succeeds.
- Do not create a SQLite-to-PostgreSQL data importer.

### Seed and transaction boundary

- Preserve idempotent seeding of actions, safety rules, expected outcomes, outcome criteria and baseline rules in the new database.
- Replace the invalid `PrismaService.$transaction` call used by `catalogue.ts` with a clearly named transaction operation owned by `PrismaService`.
- Keep the raw Prisma client private to infrastructure and repositories. The catalogue seed must not reach through the service wrapper to an undeclared client API.
- Keep seed data declarative. Executable handlers, Docker commands and target container names remain code-owned and allowlisted.

### Runtime, Docker and CI

- Update the managing-system Dockerfile, Compose configuration, package scripts and GitHub Actions for PostgreSQL client generation, migration deployment and idempotent seeding.
- Preserve the current one-shot controlled-trial runtime mode and bounded Docker action execution.
- Keep the managing system's PostgreSQL volume persistent across container recreation.
- Ensure a fresh PostgreSQL database can migrate and seed without manual table creation.

## Constraints

- Maintain strict module, service, repository and infrastructure boundaries defined in `AGENTS.md`.
- Keep `src/index.ts` as the composition root.
- Do not expose Prisma directly outside infrastructure and repositories.
- Do not read, print, commit or modify `.env` or `.env.local` files.
- Preserve action allowlisting, centralized safety checks, action-attempt limits and escalation behaviour.
- Use focused regression tests. Add a new test only where this migration introduces a regression-sensitive failure mode or fixes an observed failure.
- Keep code and configuration changes narrowly limited to PostgreSQL persistence.

## Explicitly out of scope

- Importing or repairing archived SQLite trial data.
- Continuous monitoring, scheduling, alert ingestion or automatic recovery triggering.
- Planner function/tool calling changes.
- New actions, handlers, baseline rules, incident scenarios or recovery algorithms.
- Changes to the managed system or `managed-system-postgres`.
- PostgreSQL performance tuning, high availability, remote deployment or credential-management infrastructure.
- Unrelated structural refactoring or broad test-suite expansion.

## Validation approach

1. Verify directly that a fresh PostgreSQL database accepts the Prisma migration and idempotent catalogue seed.
2. Verify the managing-system Docker path end to end where the local environment and credentials permit it.
3. Run the existing relevant persistence, safety, Docker and controlled-trial checks after the PostgreSQL change.
4. Add an automated regression test only when implementation reveals a real defect, a fragile failure path, or a regression risk introduced by this change. Do not add speculative or duplicate tests merely to increase coverage.
5. Ensure CI validates Prisma generation, migration deployment, seed idempotency, type checking, the applicable existing checks and the production build against an isolated PostgreSQL service.

## Acceptance criteria

Include only criteria the implementation and review agents can verify from repository evidence, automated tests, CI or accessible runtime behaviour.

- [ ] The managing system has a dedicated PostgreSQL Compose service and no longer uses SQLite for active persistence.
- [ ] The managed system and managing system use different PostgreSQL services, databases and named volumes.
- [ ] The active Prisma schema, migration path, dependencies and configuration are PostgreSQL-compatible.
- [ ] A fresh PostgreSQL database migrates and receives the complete idempotent policy catalogue.
- [ ] `catalogue.ts` uses a declared `PrismaService` transaction operation and the `$transaction` type error is resolved.
- [ ] No SQLite adapter, `better-sqlite3`, SQLite-specific runtime script or historical backfill path remains active.
- [ ] Existing recovery, safety, Docker execution and controlled-trial behaviour remains intact.
- [ ] Fresh-database, applicable end-to-end Docker and existing relevant validation checks pass.
- [ ] Any added automated regression test is tied to an observed defect or a concrete regression risk from this migration.
- [ ] The complete independent review is posted to the pull request.
- [ ] The pull request is not merged by an agent.

## Manual tasks

1. Provide the managing-system PostgreSQL connection values through the existing local environment mechanism without committing or exposing credentials.
2. Run the Docker Compose environment after implementation and execute one isolated baseline trial and one isolated agent trial using the existing controlled S1 process.

## Manual acceptance criteria

These are confirmed by the human after the workflow reaches `ready_for_human`. They do not block the agent workflow from reaching that state.

- [ ] The managing system records both controlled trials in `managing-system-postgres`, while the managed system's PostgreSQL database remains independent and unchanged.
- [ ] The archived SQLite databases remain available only as dissertation supporting evidence and are not required for the managing system to run.
