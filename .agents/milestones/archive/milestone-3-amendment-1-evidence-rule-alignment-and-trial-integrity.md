# Milestone 3 Amendment 1: Evidence-Rule Alignment and Trial Integrity

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-07-24  
**Parent Milestone:** `.ai/milestones/milestone-3-bounded-docker-action-execution.md`  
**Target Pull Request:** Current Milestone 3 pull request  
**Target Branch:** `feat/milestone-3-bounded-docker-action-execution`  
**Cycle Scope:** `milestone-3-amendment-1`  
**Maximum Amendment Cycles:** `3`

## Reason

The first two controlled recovery iterations verified diagnosis, bounded action execution, evidence reassessment, safety enforcement and persistence, but exposed three integrity problems:

1. failed action executions were recorded as blocked actions;
2. free-form LLM-generated signal names did not align reliably with deterministic baseline rules;
3. baseline and agent trials ran sequentially against one mutable environment, so the second trial did not receive an independently reset fault.

The persisted post-action baseline snapshot `snapshot-2026-07-24T07:15:33.819Z` contained critical signals named `health check` and `metrics collection`, with incident types `system-unreachable` and `service-down`. It contained no canonical database-connectivity evidence, so the database rule could not match. The generic managed-system rule selected `restart_managed_system_service` again, and the one-attempt safety rule correctly blocked the duplicate action.

The agent trial `trial-51bdafb7-526d-4ccc-9dee-c318ee0284bc` executed `restart_managed_system_service` followed by `restart_postgres_container` and resolved safely. This was a successful formative recovery demonstration, not a valid comparative result or evidence of historical learning.

## Goal

Make trial accounting semantically correct, provide deterministic canonical evidence for baseline matching, prevent repeated baseline action selection, and isolate baseline and agent runs so the next controlled recovery iteration can produce valid comparative evidence.

## Trial Result Accounting

Update `TrialContext`, `TrialRecord`, `TrialMetrics`, `TrialFactory` and trial helpers.

Add:

```ts
actionExecutionResultIds: string[];
failedActionIds: string[];
```

Retain:

```ts
selectedActionIds: string[];
executedActionResultIds: string[];
blockedActionIds: string[];
```

Required semantics:

- append every persisted `ActionExecutionResult.id` to `actionExecutionResultIds`;
- append the result ID to `executedActionResultIds` only when the result status is `executed`;
- append an action ID to `blockedActionIds` only when the result status is `blocked`;
- append an action ID to `failedActionIds` only when the result status is `failed`;
- append an action to `completedActionIds` only after its handler executed;
- preserve `selectedActionIds` as the ordered record of attempted selections;
- calculate `actionCount` from `actionExecutionResultIds.length`;
- retain `blockedActionCount`;
- add `failedActionCount`;
- preserve action-result persistence for every status.

The existing `executedActionResultIds` field stores result IDs, despite its name. Preserve that established meaning for compatibility. The new `failedActionIds` and `blockedActionIds` store action IDs.

Historical trial JSON must remain readable. Missing additive fields must default to empty arrays and zero counts when older records are parsed.

Do not change SQLite table names or columns.

## Canonical Evidence Contracts

Add controlled codes while preserving human-readable descriptions.

Define canonical signal codes:

```ts
type EvidenceSignalCode =
  | "managed_system_reachability"
  | "managed_system_health"
  | "managed_system_container_state"
  | "database_connectivity"
  | "postgres_container_state"
  | "metrics_availability"
  | "configuration_validity"
  | "unknown";
```

Define canonical incident codes:

```ts
type IncidentTypeCode =
  | "managed_system_unreachable"
  | "managed_system_service_down"
  | "database_connectivity_failure"
  | "postgres_unavailable"
  | "bad_runtime_configuration"
  | "unclassified";
```

Update `EvidenceSignal` so it contains:

```ts
code: EvidenceSignalCode;
source: RawEvidenceSource;
status: EvidenceSignalStatus;
value: string | number | boolean | null;
description: string;
method: "deterministic" | "llm";
```

Requirements:

- baseline rules match `code`, `status` and observed value, not free-form descriptions;
- descriptions remain available to the agent and report;
- unknown signals use `code: "unknown"` and retain their original description;
- unrecognized incidents use `unclassified` and retain an explanatory description;
- historical snapshots without canonical fields remain readable through explicit legacy mapping or schema-compatible defaults;
- do not destroy or rewrite historical snapshot JSON.

## Deterministic Core Evidence

The baseline strategy must not rely on an LLM to invent the signal vocabulary used by its rules.

Requirements:

- deterministically derive core reachability, health, database-connectivity and container-state signals from raw observations;
- allow OpenAI to produce summaries, contradictions and supplementary interpretation;
- do not allow OpenAI output to overwrite deterministic core signal codes or observed values;
- persist deterministic and LLM-derived evidence with their `method` provenance;
- pass the complete evidence snapshot to the agent strategy;
- restrict baseline matching to canonical deterministic evidence.

The same evidence snapshot may still be shared as strategy input, but the deterministic baseline must use only its deterministic fields.

## Read-Only Container-State Evidence

Endpoint evidence is insufficient when the managed-system application cannot start. Add read-only container inspection for:

```text
managed-system-app
managed-system-postgres
```

Add an interface-segregated read boundary:

```text
managing-system/src/infrastructure/container-runtime/
├── container-state-reader.interface.ts
├── container-runtime.interface.ts
├── container-runtime.types.ts
├── docker-container-runtime.service.ts
└── index.ts
```

Define:

```ts
interface IContainerStateReader {
  inspectTarget(
    target: ContainerRuntimeTarget,
  ): Promise<ContainerStateResult>;
}
```

`DockerContainerRuntimeService` may implement both `IContainerRuntime` and `IContainerStateReader`.

Requirements:

- use fixed target-to-container mapping already established by Milestone 3;
- perform read-only Docker inspection with argument-based process execution;
- return canonical running, stopped, exited, restarting or unknown state;
- apply a bounded inspection timeout;
- do not accept container names or Docker arguments from LLM output or actions;
- inject only `IContainerStateReader` into `EvidenceService`;
- collect one container observation for the managed system and one for PostgreSQL;
- represent unavailable inspection as unknown evidence rather than crashing evidence collection;
- do not add unrestricted Docker inspection or log access.

Container log collection is deferred unless container state proves insufficient in a later iteration.

## Baseline Recovery Refinement

Update deterministic baseline rules to use canonical evidence and recovery context.

Required rule priority:

1. PostgreSQL unavailable or database connectivity failed.
2. Managed-system application unavailable while PostgreSQL is available.
3. Bad runtime configuration.
4. Unclassified or contradictory evidence.

Required plans:

```text
PostgreSQL unavailable
-> restart_postgres_container
-> restart_managed_system_service only if health remains unresolved

Managed-system application unavailable and PostgreSQL available
-> restart_managed_system_service

Bad runtime configuration
-> use only an existing approved configuration-recovery action;
   otherwise escalate

Unclassified or contradictory evidence
-> escalate
```

Requirements:

- keep specific rules ahead of generic rules;
- remove or narrow the generic rule that restarts the application for every degraded or unhealthy snapshot;
- return ordered proposed and fallback action IDs;
- use `RecoveryStrategyContext.actionAttemptCounts` and `completedActionIds`;
- do not propose an action already attempted in the current trial;
- select a different configured action only when current canonical evidence supports it;
- escalate when no unattempted deterministic action remains;
- retain rule IDs in deterministic diagnosis provenance;
- keep baseline rules fixed during an experiment batch.

Successful agent plans may inform manually reviewed baseline-rule changes between experiment iterations. Do not automatically rewrite baseline rules during a trial.

## Controlled Comparative Execution

Do not run baseline and agent trials sequentially against one mutable runtime state.

Add explicit runtime selection:

```text
RECOVERY_MODE=baseline|agent
SCENARIO_ID=S1|S2|S3
```

Requirements:

- add validated recovery-mode and scenario configuration;
- forward `RECOVERY_MODE` and `SCENARIO_ID` through the Compose managing-system service;
- one managing-system process executes one recovery mode;
- reject missing or invalid recovery mode and scenario values for controlled trials;
- persist the explicit scenario ID in the trial record;
- restore a healthy environment before each run;
- inject one defined fault;
- run one strategy;
- preserve its records;
- restore the environment;
- inject the same fault again;
- run the other strategy;
- verify the initial conditions are equivalent before comparison;
- do not treat sequential runs without reset as comparative evidence.

Fault injection and environment reset may remain manual in this amendment. Automated scenario orchestration is deferred.

## Historical Recovery Knowledge

Current persistence already retains:

- evidence snapshots and signals;
- diagnosis and recovery-plan references;
- selected actions;
- action execution results;
- trial outcomes;
- evaluation summaries.

Do not introduce an automated recovery-memory subsystem in this amendment.

Record as a future milestone:

```text
verified historical recovery cases
-> retrieval for agent context
-> human-reviewed promotion into versioned baseline rules
```

Automatic baseline mutation would invalidate a fixed comparative condition and is out of scope.

## Formative Iteration Record

Update the Week 9 artifact and report draft with:

- Iteration 1 execution-boundary failure;
- bounded Docker-runtime response;
- Iteration 2 baseline escalation and agent recovery;
- exact trial, action-result and evidence-snapshot IDs;
- observed evidence-vocabulary mismatch;
- trial-accounting defect;
- sequential-run limitation;
- decisions carried into this amendment.

Preserve the exported CSV evidence beside the milestone work-done record.

After Amendment 1 verification, append Iteration 3 rather than rewriting Iterations 1 and 2.

## Required Tests

1. Failed action results enter `failedActionIds`, not `blockedActionIds`.
2. Blocked action results enter only `blockedActionIds`.
3. Executed action results enter only `executedActionResultIds`.
4. Every result ID enters `actionExecutionResultIds`.
5. Action count includes executed, blocked and failed results.
6. Historical trial JSON without new fields remains readable.
7. Canonical core signals are derived deterministically.
8. Unknown evidence remains representable.
9. LLM output cannot overwrite deterministic core signals.
10. Container inspection accepts only the two fixed targets.
11. Container inspection is read-only and bounded.
12. Unavailable container inspection produces unknown evidence without aborting collection.
13. PostgreSQL-unavailable evidence selects PostgreSQL restart before application restart.
14. Application-down evidence with healthy PostgreSQL selects only application restart.
15. An attempted action is not proposed again.
16. No remaining deterministic action produces escalation.
17. One controlled process runs only the selected recovery mode.
18. Invalid mode or scenario ID fails before a trial starts.
19. Existing safety, execution, reassessment and persistence tests remain green.
20. Type-check and production build pass.

Automated tests must inject container inspection and process execution. They must not mutate real host containers.

## Controlled Verification

Run separate controlled trials for at least:

```text
S1: managed-system application stopped; PostgreSQL running
S2: PostgreSQL stopped; managed-system health unavailable or unhealthy
```

For each scenario:

1. establish and record a healthy starting state;
2. inject only the defined fault;
3. run the baseline strategy;
4. restore the healthy state;
5. inject the same fault again;
6. run the agent strategy;
7. compare initial evidence, selected actions, action count, outcome and recovery time;
8. preserve all evidence and trial records.

Do not accept a run as comparative when initial fault states differ.

## Explicitly Out of Scope

- Automated historical recovery retrieval.
- Automatic baseline-rule learning or mutation.
- Automated fault injection and environment reset.
- Container log collection.
- Production restricted executor service.
- Kubernetes integration.
- New unrestricted Docker capabilities.
- Final comparative experiment batch.
- Dissertation-wide statistical analysis.

## Acceptance Criteria

- [ ] Trial records distinguish all result IDs, executed results, blocked actions and failed actions.
- [ ] Metrics count every action result correctly.
- [ ] Historical trial and evidence JSON remains readable.
- [ ] Baseline rules use deterministic canonical evidence.
- [ ] Free-form descriptions remain available without controlling baseline matching.
- [ ] Managed-system and PostgreSQL container states are collected read-only.
- [ ] PostgreSQL failure produces an ordered database-first recovery plan.
- [ ] Application-only failure produces an application-only recovery plan.
- [ ] Baseline does not select an already attempted action.
- [ ] Unclassified evidence escalates.
- [ ] Baseline and agent execute in separate reset runs.
- [ ] Explicit scenario IDs are persisted.
- [ ] Iteration 3 evidence is appended to the Week 9 record.
- [ ] Type-check, unit tests, integration tests and build pass.
- [ ] Controlled S1 and S2 demonstrations pass or produce correctly recorded bounded escalation.
- [ ] Independent review covers the frozen Milestone 3 contract and this amendment.
- [ ] Agents do not merge the pull request.

## Validation

Run from `managing-system/`:

```text
npm run test:types
npm test
npm run build
```

Run each controlled mode separately after resetting the scenario:

```text
RECOVERY_MODE=baseline SCENARIO_ID=S1 docker compose run --rm --no-deps managing-system
RECOVERY_MODE=agent SCENARIO_ID=S1 docker compose run --rm --no-deps managing-system
```

Repeat for S2 after restoring and reinjecting the defined fault.

## Workflow Preconditions

- Milestone 3 is frozen and its pull request remains open.
- The current Milestone 3 branch is clean.
- Iterations 1 and 2 are preserved as formative evidence.
- The Docker image has been rebuilt and Docker CLI/socket access verified.
- Do not rewrite or delete historical SQLite records.
- Do not merge the pull request during amendment implementation or review.
