# Milestone 4: Prisma ORM and Relational Persistence

**Status:** Frozen
**Version:** 1.0.0
**Last Updated:** 2026-07-26
**Depends On:** Milestone 3 Bounded Docker Action Execution and its approved amendments
**Target Pull Request:** -
**Target Branch:** `feat/milestone-4-prisma-relational-persistence`
**Superseded By:** —

## Goal

Replace the managing system's direct `node:sqlite` access, hand-written SQL and hardcoded recovery catalogues with Prisma ORM 7 and a normalized SQLite data model.

The completed milestone must provide:

- one Prisma-managed persistence source of truth;
- queryable relationships across evidence, recovery decisions, actions, trials and evaluations;
- database-seeded action, safety and deterministic baseline policy data;
- preservation and controlled migration of existing experiment records;
- clean repository implementations without embedded SQL or table initialization;
- unchanged recovery, safety, Docker execution and evaluation behaviour.

This milestone improves maintainability and persistence reliability. It does not migrate the managing system to PostgreSQL.

## Required Persistence Flow

```text
Application starts
-> PrismaService opens the configured SQLite database
-> Prisma migrations are already applied
-> idempotent catalogue seed has populated required policy data
-> repositories query Prisma models
-> services operate through repository boundaries
-> related evidence and recovery records are persisted transactionally
-> application disconnects Prisma cleanly
```

For a controlled trial:

```text
RawEvidence
-> EvidenceSnapshot with signals and incidents
-> TrialRecord
-> RecoveryDecision
   -> DiagnosisResult
   -> RecoveryPlan
      -> ordered Actions
-> ActionExecutionResult
-> reassessed EvidenceSnapshot
-> EvaluationSummary
```

## Prisma Architecture

Add:

```text
managing-system/
├── prisma/
│   ├── schema.prisma
│   ├── models/
│   │   ├── action.prisma
│   │   ├── evidence.prisma
│   │   ├── recovery.prisma
│   │   ├── trial.prisma
│   │   └── evaluation.prisma
│   ├── migrations/
│   ├── seed.ts
│   └── backfill-legacy-data.ts
└── src/
    ├── generated/prisma/
    └── infrastructure/database/
        ├── prisma.service.ts
        └── index.ts
```

Requirements:

- Use Prisma ORM 7.
- Use the Prisma SQLite datasource.
- Use the supported SQLite driver adapter required by Prisma 7.
- Use a multi-file Prisma schema grouped by bounded context.
- Generate Prisma Client into `src/generated/prisma/`.
- Construct one `PrismaService` in `src/index.ts`.
- Inject the shared service into repositories.
- Do not expose Prisma Client to controllers, strategies, factories or unrelated services.
- Disconnect Prisma once at application shutdown.
- Keep database configuration under `src/config/`.
- Keep Prisma connection setup under `src/infrastructure/database/`.
- Do not introduce a generic repository abstraction.
- Do not create pass-through database wrappers that add no lifecycle or configuration responsibility.

Required package scripts:

```text
prisma:generate
prisma:validate
prisma:migrate:dev
prisma:migrate:deploy
prisma:seed
prisma:studio
prisma:backfill
```

The normal test and build scripts must generate Prisma Client before compiling code that imports generated types.

## Source-of-Truth Rules

Use these boundaries consistently:

### Prisma models

Prisma models are the source of truth for:

- persisted table shapes;
- persisted enum values;
- keys, indexes and uniqueness constraints;
- database relationships;
- generated row and relation-payload types.

Do not create handwritten TypeScript model copies of generated Prisma row types.

### Zod schemas

Zod remains the source of truth for:

- OpenAI structured outputs;
- evidence normalization;
- persisted JSON values when they re-enter the domain;
- external or otherwise untrusted data;
- runtime contracts whose shape is different from a database row.

Infer TypeScript types from those schemas. Do not maintain a separate handwritten type for the same validated shape.

Remove the existing handwritten `RecoveryDecision` duplication and infer it from `recoveryDecisionSchema`.

### Compile-time contracts

Keep module-owned TypeScript types for runtime-only concepts, including:

- recovery strategy interfaces and contexts;
- trial orchestration state;
- safety decisions and evaluations;
- action handler inputs and outputs;
- service options;
- infrastructure interfaces.

These types are not Prisma models and must not become database tables merely because they exist in TypeScript.

### Mappers

Add a mapper only where there is a material representation difference, including:

- Prisma `Date` values and ISO-string structured-output contracts;
- relation-loaded Prisma payloads and nested domain aggregates;
- typed JSON fields and validated domain values.

Do not add identity mappers or duplicate complete object shapes merely to hide Prisma.

## Action and Safety Models

Define in `action.prisma`:

```text
Action
ExpectedOutcome
OutcomeCriterion
SafetyRule
ActionSafetyRule
ActionExecutionResult
```

### Action

Store:

- slug ID;
- name;
- description;
- handler key;
- risk level;
- active state;
- created and updated timestamps.

Requirements:

- Preserve the existing action IDs:

  ```text
  restart_postgres_container
  restart_managed_system_service
  ```

- `handlerKey` selects an allowlisted implementation in code.
- Do not store commands, process arguments, container names or executable code.
- Do not allow persisted data or an LLM to define an executable handler.

### Expected outcome and criteria

Use one expected outcome per action.

Store:

- expected-outcome description;
- ordered outcome criteria;
- controlled criterion check type;
- criterion parameters as Prisma `Json`.

Preserve the existing outcome criterion IDs and semantics.

### Safety rules

Store:

- slug ID;
- description;
- controlled check type;
- parameters as Prisma `Json`;
- failure action;
- active state.

Use an explicit `ActionSafetyRule` relation containing a position so safety-rule evaluation order is deterministic.

Preserve:

```text
allow_only_when_system_not_healthy
max_one_attempt_per_cycle
```

### Action execution results

Relate each result to:

- its `Action`;
- its `TrialRecord`;
- its optional before-evidence snapshot;
- its optional after-evidence snapshot.

Store the current execution status, continuation, timestamps, safety status, output, error and expected-outcome result as queryable fields.

Retain failed safety-rule IDs as a validated JSON array for this milestone. Persisting complete safety-evaluation records is deferred.

## Action Catalogue and Handler Separation

Replace the current responsibilities of `action.data.ts`.

The database seed owns:

- actions;
- safety rules;
- action-to-rule ordering;
- expected outcomes;
- outcome criteria.

An allowlisted code registry owns:

- action handler contracts;
- the mapping from a fixed handler key to a concrete handler;
- calls to `IContainerRuntime`.

`ActionRepository` owns persisted action catalogue queries and action-result persistence. It must not own executable process behaviour.

Delete `action.data.ts` only after:

- the seed contains the complete existing catalogue;
- handler lookup has moved to the allowlisted code boundary;
- tests prove existing action behaviour is unchanged.

## Evidence Models

Define in `evidence.prisma`:

```text
RawEvidence
EvidenceSnapshot
EvidenceSignal
EvidenceIncident
```

### Raw evidence

Persist:

- ID;
- source;
- target;
- collection timestamp;
- collection status;
- raw text;
- collection error;
- related snapshot ID.

Collection failures must be stored and must not be discarded because an endpoint or container is unavailable.

### Evidence snapshot

Persist:

- ID;
- creation timestamp;
- target system;
- overall state;
- summary;
- contradictions as validated JSON;
- related raw evidence;
- related signals;
- related incident classifications.

### Evidence signals

Persist each signal separately with:

- durable ID;
- owning snapshot;
- source;
- canonical signal code;
- display name;
- status;
- typed value stored through a validated JSON field;
- description;
- derivation method;
- stable position.

Deterministic and LLM-derived signals must remain distinguishable.

### Evidence incidents

Persist:

- durable ID;
- owning snapshot;
- controlled incident code;
- stable position.

Preserve:

- canonical incident codes;
- `unknown` signal values;
- `unclassified` incidents;
- human-readable snapshot summaries.

LLM output must not replace deterministic core evidence.

## Recovery Models

Define in `recovery.prisma`:

```text
DiagnosisResult
RecoveryPlan
RecoveryPlanAction
RecoveryDecision
BaselineRule
BaselineRuleConditionGroup
BaselineRuleCondition
BaselineRuleAction
```

### Diagnosis results

Relate each diagnosis to:

- its trial;
- its evidence snapshot.

Store:

- method;
- incident code;
- severity;
- nullable confidence;
- reasoning summary;
- source IDs;
- supporting signals;
- contradictions;
- creation timestamp.

Flexible reference arrays remain validated JSON for this milestone.

### Recovery plans

Relate each plan to:

- its trial;
- its diagnosis result;
- ordered proposed and fallback actions.

Replace persisted proposed and fallback action-ID arrays with `RecoveryPlanAction` rows containing:

```text
recoveryPlanId
actionId
phase: proposed | fallback
position
```

Store rationale, expected outcome and nullable escalation reason on the plan.

The plan-action relation is the persisted source of truth for action order.

### Recovery decisions

Relate each decision to:

- its trial;
- its evidence snapshot;
- its diagnosis result;
- its recovery plan.

Store:

- sequence number;
- recovery mode;
- decision time;
- status;
- reason;
- nullable escalation reason.

Enforce one sequence number per trial and return history in sequence order.

Preserve the distinction between:

- one agent decision containing several ordered actions;
- several decisions produced through reassessment and replanning.

## Baseline Policy Models

Persist deterministic baseline policy data instead of executable matching functions.

### Baseline rule

Store:

- slug ID;
- description;
- controlled incident code;
- severity;
- expected outcome;
- priority;
- version;
- active state;
- condition groups;
- ordered proposed and fallback actions.

Specific rules must retain higher priority than generic rules.

Baseline rule versions must be frozen during a comparative experiment batch.

### Condition groups

Use:

```text
BaselineRuleConditionGroup
- rule ID
- position
- match mode: ALL | ANY
```

Each group contains ordered `BaselineRuleCondition` records.

For this milestone, a condition supports only controlled equality matching:

```text
signal code
operator: EQUALS
expected signal status
position
```

All condition groups belonging to a rule must pass. The group's match mode determines whether all or any conditions inside that group must pass.

This must represent the existing rules:

```text
database rule
-> postgres_container_state is critical
   OR database_connectivity is critical

application rule
-> managed_system_reachability is critical
   OR managed_system_health is critical
   OR managed_system_container_state is critical
-> AND database_connectivity is normal
   OR postgres_container_state is normal
```

### Baseline rule actions

Use ordered `BaselineRuleAction` records containing:

```text
baselineRuleId
actionId
phase: proposed | fallback
position
```

The deterministic baseline evaluator remains in code. It may interpret only the controlled operators and values defined by the schema.

Reject:

- arbitrary expressions;
- scripts;
- SQL fragments;
- model-generated conditions outside the supported enums;
- database-provided executable logic.

## Trial Models

Define in `trial.prisma`:

```text
TrialRecord
TrialEvidenceSnapshot
```

### Trial records

Persist as queryable fields:

- ID;
- scenario ID;
- recovery mode;
- start and completion timestamps;
- status;
- outcome;
- nullable escalation reason;
- action count;
- blocked-action count;
- failed-action count;
- nullable time to recovery;
- nullable time to escalation;
- notes.

Relate each trial to:

- ordered evidence snapshots;
- ordered recovery decisions;
- action execution results;
- one optional evaluation summary.

### Trial evidence history

Use `TrialEvidenceSnapshot` containing:

```text
trialRecordId
evidenceSnapshotId
sequenceNumber
role: initial | intermediate | final
```

Enforce one sequence number per trial.

The relation history replaces persisted evidence-snapshot ID arrays as the new source of truth.

Derive selected, executed, blocked and failed action histories from related recovery-plan actions and action-execution results. Do not store duplicate ID arrays for new records.

Keep legacy compatibility fields readable only through the migration and mapping boundary.

## Evaluation Model

Define in `evaluation.prisma`:

```text
EvaluationSummary
```

Relate one evaluation summary to one trial record.

Persist:

- ID;
- trial ID;
- creation timestamp;
- summary;
- recovery success;
- safety maintained;
- action effectiveness;
- lessons as validated JSON;
- recommended changes as validated JSON.

Do not create separate lesson and recommendation tables in this milestone.

## Repository Migration

Convert:

```text
ActionRepository
EvidenceRepository
RecoveryRepository
TrialRepository
EvaluationRepository
```

Requirements:

- Use Prisma model delegates only.
- Remove all repository `CREATE TABLE`, `INSERT`, `UPDATE` and `SELECT` SQL.
- Remove repository-owned table initialization.
- Use Prisma transactions for multi-record aggregate writes.
- Make repository methods asynchronous.
- Propagate asynchronous persistence through the owning services and orchestration.
- Keep repositories private to their owning services.
- Preserve service-only cross-module dependencies established in Milestone 2.
- Use explicit repository method names.
- Validate JSON fields before returning domain contracts.
- Load only the relations required by the operation.
- Do not use `include` indiscriminately.
- Do not add a generic base repository.
- Do not return raw unvalidated `JsonValue` fields to domain callers.

Required completion state:

```text
no node:sqlite imports
no DatabaseSync usage
no DatabaseService
no repository table-creation statements
no repository SQL strings
no hardcoded action catalogue
no hardcoded safety-rule catalogue
no function-valued baseline rules
```

## Existing Data Migration

Migrate the existing SQLite database in place.

### Pre-migration backup

Before applying Milestone 4 migrations:

1. Resolve the configured database path.
2. Verify that the source database exists.
3. Create a timestamped byte-for-byte backup.
4. Refuse to overwrite an existing backup.
5. Report the source path, backup path and file size.

The backup operation must be documented and must not be hidden inside normal application startup.

### Migration sequence

Use staged migrations:

1. Map Prisma models to existing table names where applicable.
2. Preserve existing IDs and current queryable columns.
3. Add new tables and nullable relation columns.
4. Preserve existing JSON columns as nullable legacy payload fields.
5. Seed actions, safety rules, outcomes, criteria and baseline policy records.
6. Run the idempotent backfill.
7. Verify row counts and relationships.
8. Tighten constraints only after successful backfill verification.

### Backfill

`backfill-legacy-data.ts` must:

- parse every existing legacy JSON payload;
- validate it through the owning Zod schema or an explicit historical compatibility parser;
- preserve existing entity IDs and timestamps;
- populate normalized evidence, recovery, action, trial and evaluation records;
- preserve recovery-decision order;
- preserve singular final diagnosis and plan references;
- default fields that were legitimately absent in older formats;
- avoid duplicating data when run repeatedly;
- use bounded transactions;
- produce a summary containing read, migrated, skipped and failed counts per entity;
- exit unsuccessfully when malformed records remain unresolved;
- never silently discard a record.

Historical records may retain nullable legacy payload values. New writes must use normalized columns and relationships and must not write complete duplicated entity payloads.

Removing the legacy payload columns is deferred until the migrated historical evidence has been independently verified.

### Compatibility verification

Verify:

- every existing trial remains identifiable;
- every existing action result remains linked to its trial;
- all existing evidence snapshots remain readable;
- recovery decisions retain sequence order;
- diagnosis and plan references remain valid;
- evaluation summaries retain their trial relationship;
- baseline and agent records remain distinguishable.

## Runtime Configuration

Update:

```text
managing-system/.env.example
managing-system/src/config/index.ts
managing-system/src/config/helpers.ts
managing-system/prisma.config.ts
```

Add:

```text
DATABASE_URL=file:./data/managing-system.sqlite
```

Requirements:

- Use the existing managed data volume in Docker.
- Use a separate isolated database URL for tests.
- Resolve a valid Prisma `file:` URL.
- Do not read or commit `.env` or `.env.local`.
- Do not duplicate unrelated runtime configuration inside Prisma configuration.
- Fail clearly when the database URL is missing or invalid.
- Do not introduce PostgreSQL configuration in this milestone.

## Docker Integration

Update `Dockerfile.managing-system` to:

1. install dependencies;
2. copy Prisma configuration, schema and migrations;
3. generate Prisma Client;
4. copy and build TypeScript;
5. preserve Docker CLI installation;
6. preserve the existing data volume location.

The controlled container startup must:

```text
apply prisma migrate deploy
-> run the idempotent seed
-> start the managing system
```

Requirements:

- Do not use `prisma db push`.
- Do not run development migrations in the container.
- Do not delete or recreate the SQLite volume.
- Do not modify the managed-system PostgreSQL service.
- Preserve the existing Docker socket safety boundary.

## Continuous Integration

Update the root GitHub Actions workflow for the managing system.

The managing-system CI job must:

1. install dependencies;
2. validate the Prisma schema;
3. generate Prisma Client;
4. create an isolated SQLite database;
5. apply all migrations from zero;
6. run the idempotent seed twice;
7. verify that the second seed creates no duplicates;
8. run type checking;
9. run unit tests;
10. run integration tests;
11. run the production build.

CI must not:

- read local environment files;
- invoke OpenAI;
- restart host containers;
- mount a Docker socket;
- use the dissertation experiment database.

## Automated Tests

Add or update focused tests verifying:

1. Prisma schema validation and client generation succeed.
2. A fresh SQLite database can apply every migration.
3. `PrismaService` opens the configured database and disconnects cleanly.
4. The seed creates the complete action, safety, expected-outcome and baseline-rule catalogue.
5. Running the seed repeatedly is idempotent.
6. Action and safety relationships preserve their configured order.
7. Baseline condition groups reproduce the existing database-first match.
8. Baseline condition groups reproduce the existing application-only match.
9. Unsupported baseline operators fail safely.
10. An unknown handler key fails before Docker execution.
11. Persisted data cannot define arbitrary commands or handlers.
12. Raw evidence collection failures are persisted.
13. Evidence snapshots retain deterministic and LLM-derived signal provenance.
14. Evidence incident classifications retain their order and unknown state.
15. Recovery decisions persist their diagnosis, plan and ordered actions transactionally.
16. Recovery decision history is returned in sequence order.
17. A transaction failure does not leave partial recovery history.
18. Action execution results preserve trial, action and before/after evidence relationships.
19. Trial evidence history preserves initial, intermediate and final roles.
20. Trial action counts and classifications remain correct.
21. Baseline and agent trials remain separately persisted.
22. Evaluation summaries preserve typed lessons and recommendations.
23. Repository methods use Prisma and no module initializes tables.
24. The historical fixture database backfills without losing records.
25. Re-running the historical backfill creates no duplicates.
26. Malformed historical payloads produce an actionable failure report.
27. Existing OpenAI, evidence, recovery, safety, Docker and trial behaviour remains covered.
28. Type checking, all tests and the production build pass.

Tests must use isolated temporary databases. Tests must not read or modify the dissertation experiment database.

## Incremental Implementation Order

The implementation agent must work in this order:

1. Add Prisma dependencies, configuration, schema layout and `PrismaService`.
2. Define and validate the complete relational schema.
3. Create the initial staged migrations.
4. Add idempotent action, safety and baseline-policy seeding.
5. Add the legacy backup and backfill utilities with fixture tests.
6. Migrate `ActionRepository` and separate handler lookup from persistence.
7. Migrate `EvidenceRepository`.
8. Migrate `RecoveryRepository` and the baseline rule evaluator.
9. Migrate `TrialRepository`.
10. Migrate `EvaluationRepository`.
11. Propagate asynchronous persistence through services and orchestration.
12. Remove obsolete SQL, `node:sqlite`, hardcoded catalogues and duplicate types.
13. Update Docker and CI.
14. Run complete automated validation.
15. Perform the manual migration and controlled-trial verification.
16. Review the final diff for duplication, stale types, dead exports and oversized methods.

After each repository migration:

- run focused tests for that module;
- run type checking;
- do not proceed while the codebase is broken.

Milestone 4 is complete only when every repository and all runtime wiring use Prisma.

## Manual Verification

Before using the current Docker-volume database:

1. Stop the managing-system process.
2. Create and verify the timestamped backup.
3. Apply Prisma migrations.
4. Run the catalogue seed.
5. Run the historical backfill.
6. Review the migration summary.
7. Inspect the migrated records in Prisma Studio.

Then run isolated controlled trials:

```text
S1 baseline
S1 agent
```

Reset and reinject the same fault before each mode.

Verify:

- both trials recover successfully;
- evidence collection and reassessment remain intact;
- action handlers remain allowlisted;
- safety rules still block or escalate correctly;
- every evidence snapshot is related to its trial;
- every recovery decision has its diagnosis, plan and ordered actions;
- action results retain before/after evidence relationships;
- evaluation summaries are related to the correct trials;
- existing historical records remain queryable;
- no hand-written repository SQL remains.

## Documentation and Evidence

Record:

- the pre-migration schema;
- the approved Prisma entity model;
- the migration and backfill procedure;
- pre- and post-migration row counts;
- seed verification;
- automated test output;
- controlled baseline and agent trial results;
- limitations of SQLite and the deferred PostgreSQL direction;
- any malformed historical records and their explicit resolution.

Update the active weekly artifact and milestone work-done records only after implementation evidence is available. Do not describe anticipated implementation as completed work.

## Explicitly Out of Scope

- Migrating the managing system to PostgreSQL.
- Changing the managed system's existing PostgreSQL database.
- Automatic recovery learning.
- Automatic baseline-rule mutation.
- New recovery actions or Docker targets.
- New fault scenarios.
- Persisting executable handler code.
- Persisting arbitrary baseline expressions.
- Complete safety-rule evaluation history tables.
- Separate tables for evaluation lessons and recommendations.
- Removing legacy JSON columns before migration verification.
- Changing the one-shot managing-system execution model.
- Merging the pull request.

## Acceptance Criteria

- [ ] Prisma 7 is configured for SQLite with a generated client.
- [ ] Domain-grouped Prisma model files define the complete persistence model.
- [ ] Prisma migrations build a fresh database from zero.
- [ ] Existing SQLite experiment records are backed up and migrated in place.
- [ ] The historical backfill is idempotent and reports failures explicitly.
- [ ] Actions, safety rules, outcomes, criteria and baseline policies are seeded.
- [ ] The seed is idempotent.
- [ ] Baseline rules are data-backed but interpreted through bounded code.
- [ ] All repositories use Prisma model delegates.
- [ ] Multi-record recovery persistence uses Prisma transactions.
- [ ] Repository and dependent service methods are asynchronous.
- [ ] Prisma models are the persisted-shape source of truth.
- [ ] Zod remains the runtime-validation and structured-output source of truth.
- [ ] Duplicate handwritten persisted-row types are removed.
- [ ] Runtime-only contracts remain module-owned.
- [ ] Action handlers remain allowlisted code implementations.
- [ ] No persisted value can introduce arbitrary command execution.
- [ ] No `node:sqlite`, `DatabaseSync`, `DatabaseService` or repository SQL remains.
- [ ] No hardcoded action or safety-rule catalogue remains.
- [ ] No function-valued baseline-rule data remains.
- [ ] Existing baseline and agent recovery behaviour remains intact.
- [ ] Existing safety and Docker boundaries remain intact.
- [ ] Docker startup applies deployment migrations and the idempotent seed.
- [ ] CI validates schema, migrations, seeding, types, tests and build.
- [ ] S1 baseline and agent controlled trials pass after migration.
- [ ] Historical and new records are queryable through Prisma relations.
- [ ] The final diff satisfies `AGENTS.md` readability and SOLID requirements.
- [ ] Independent review covers the exact pull-request head.
- [ ] Agents do not merge the pull request.

## Validation

Run from `managing-system/`:

```text
npm run prisma:validate
npm run prisma:generate
npm run test:types
npm test
npm run build
```

Run migration validation against isolated databases:

```text
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:seed
npm run prisma:backfill
```

Run the repository's root CI workflow and complete the manual Docker verification before requesting independent review.

## Constraints

- Follow `AGENTS.md` clean-code, SOLID, naming, security and dependency rules.
- Prefer cohesive, readable methods over compressed or oversized implementations.
- Do not split cohesive logic only to reduce line counts.
- Do not introduce empty abstractions or duplicated model, schema or type definitions.
- Preserve existing recovery, safety, Docker and evaluation behaviour.
- Preserve historical experiment evidence.
- Keep SQLite for Milestone 4.
- Keep PostgreSQL migration deferred.
- Complete the migration incrementally, but do not declare the milestone complete until the entire persistence path uses Prisma.
- Do not modify milestone checklist boxes.
- Do not begin Milestone 5.
- Do not merge the pull request.
