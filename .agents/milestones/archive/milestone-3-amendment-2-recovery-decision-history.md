# Milestone 3 Amendment 2: Recovery Decision History

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-07-24  
**Parent Milestone:** `.ai/milestones/milestone-3-bounded-docker-action-execution.md`  
**Previous Amendment:** `.ai/milestones/milestone-3-amendment-1-evidence-rule-alignment-and-trial-integrity.md`  
**Target Pull Request:** Current Milestone 3 pull request  
**Target Branch:** `feat/milestone-3-bounded-docker-action-execution`  
**Cycle Scope:** `milestone-3-amendment-2`  
**Maximum Amendment Cycles:** `3`

## Reason

Iteration 3 confirmed that one recovery trial may produce multiple recovery decisions.

The agent trial `trial-adc2a0d5-cb7e-4e92-879f-8484b59bf7a5` produced one recovery decision containing two ordered actions. The baseline trial `trial-c2b4651f-b4c1-4756-b48b-1b3c34c90489` produced two decisions:

1. restart PostgreSQL from the initial evidence;
2. reassess the resulting evidence and restart the managed-system application.

`TrialService` currently replaces its local `recoveryDecision` value whenever a strategy replans. The action and evidence histories remain complete, but the completed `TrialRecord` references only the final diagnosis and recovery plan. Earlier decisions, diagnoses and plans are therefore not durably traceable.

## Goal

Persist every `RecoveryDecision`, `DiagnosisResult` and `RecoveryPlan` produced during a trial, in decision order, without changing recovery selection, execution, safety or reassessment behaviour.

The managing system remains evidence-led and scenario-agnostic. It must not require a predefined incident label or scenario-conformance check before beginning recovery.

## Recovery Contracts

Add a durable identifier to `RecoveryDecision`:

```ts
type RecoveryDecision = {
  id: string;
  mode: RecoveryMode;
  snapshotId: string;
  decidedAt: string;
  status: RecoveryDecisionStatus;
  reason: string;
  diagnosisResult: DiagnosisResult;
  recoveryPlan: RecoveryPlan;
  escalationReason?: string;
};
```

`RecoveryFactory.createRecoveryDecision()` must generate a unique ID using the established recovery entity naming convention:

```text
recovery-decision-<uuid>
```

Do not duplicate `DiagnosisResult` or `RecoveryPlan` types. Their existing Zod-backed contracts remain the source of truth.

## Trial History Contracts

Add ordered history references to `TrialContext` and `TrialRecord`:

```ts
recoveryDecisionIds: string[];
diagnosisResultIds: string[];
recoveryPlanIds: string[];
```

Required semantics:

- append one entry to each array whenever a strategy returns a decision;
- preserve decision order across initial planning and every replan;
- allow one decision to contain multiple ordered actions;
- do not create additional decisions merely because multiple actions execute;
- retain `diagnosisResultId` and `recoveryPlanId` as final-decision references for historical compatibility;
- derive the singular compatibility fields from the final persisted decision;
- default missing history arrays to empty arrays when historical trial JSON is parsed;
- do not rewrite historical trial records.

The trial result must expose:

```ts
recoveryDecision: RecoveryDecision;
recoveryDecisions: RecoveryDecision[];
```

`recoveryDecision` remains the final decision for compatibility. `recoveryDecisions` contains the complete ordered history.

## Recovery Persistence

Add:

```text
managing-system/src/modules/recovery/recovery.repository.ts
managing-system/src/modules/recovery/recovery.service.ts
```

`RecoveryRepository` owns persistence for recovery decisions, diagnosis results and recovery plans.

Required repository operations:

```ts
saveRecoveryDecisionHistory(input: {
  trialRecordId: string;
  sequenceNumber: number;
  recoveryDecision: RecoveryDecision;
}): RecoveryDecision;

findRecoveryDecisionsByTrialRecordId(
  trialRecordId: string,
): RecoveryDecision[];
```

`saveRecoveryDecisionHistory()` must persist the decision, its diagnosis and its recovery plan in one SQLite transaction.

Add tables without changing or deleting existing tables:

```text
diagnosis_results
recovery_plans
recovery_decisions
```

Required stored fields:

```text
diagnosis_results
- id
- trial_record_id
- created_at
- diagnosis_result_json

recovery_plans
- id
- trial_record_id
- diagnosis_result_id
- created_at
- recovery_plan_json

recovery_decisions
- id
- trial_record_id
- sequence_number
- recovery_mode
- snapshot_id
- decided_at
- status
- diagnosis_result_id
- recovery_plan_id
- recovery_decision_json
```

Requirements:

- preserve complete JSON representations alongside queryable identity and relationship fields;
- enforce unique recovery-decision IDs;
- enforce one sequence number per trial;
- return decision history ordered by `sequence_number`;
- use idempotent upsert behaviour for repeated persistence of the same entity IDs;
- validate stored JSON when it re-enters the recovery domain;
- add indexes for trial-record lookup and decision ordering;
- do not modify existing SQLite table names or stored JSON formats.

`RecoveryService` is the public cross-module boundary.

Required service operations:

```ts
recordRecoveryDecision(input: {
  trialRecordId: string;
  sequenceNumber: number;
  recoveryDecision: RecoveryDecision;
}): RecoveryDecision;

findRecoveryDecisionHistory(
  trialRecordId: string,
): RecoveryDecision[];
```

`TrialService` must depend on `RecoveryService`, not `RecoveryRepository`.

## Trial Orchestration

Update `TrialService` so every call to `RecoveryStrategy.decide()` follows this order:

```text
strategy decides
-> persist decision, diagnosis and recovery plan
-> append ordered history references
-> execute or conclude from the decision
```

Requirements:

- persist the initial decision before executing any selected action;
- persist every later decision immediately after reassessment and replanning;
- use one-based sequence numbers within a trial;
- append the full decision to an in-memory ordered history for the returned result;
- fail before action execution if the corresponding decision history cannot be persisted;
- preserve all previously persisted history if a later decision or action fails;
- continue using the final decision to populate singular compatibility fields;
- log the complete ordered decision history in `controlled_trial_recorded`;
- preserve current action, evidence, safety, continuation and evaluation behaviour.

The agent may produce one decision containing several actions. The baseline may produce separate decisions as evidence changes. Both forms are valid and must remain distinguishable in the stored history.

## Composition

Construct one `RecoveryRepository` from the shared `DatabaseService`, then inject it into `RecoveryService`.

Inject `RecoveryService` into `TrialService` from `src/index.ts`.

Export `RecoveryRepository` and `RecoveryService` through the recovery module barrel. No external module may import `RecoveryRepository` directly.

## Required Tests

1. `RecoveryFactory` assigns a unique decision ID.
2. One agent decision with multiple actions persists one decision, diagnosis and plan.
3. A baseline replan persists two ordered decisions with distinct snapshots, diagnoses and plans.
4. `no_action` decisions are persisted.
5. escalation decisions are persisted.
6. A decision is persisted before its selected action executes.
7. Persistence failure prevents action execution.
8. Earlier decision history remains stored when a later action or decision fails.
9. Decision history retrieval is ordered by sequence number.
10. Trial history arrays contain every persisted decision, diagnosis and plan ID.
11. Singular diagnosis and recovery-plan fields reference the final decision.
12. Historical trial JSON without history arrays remains readable.
13. Existing action, evidence, safety, trial and evaluation tests remain green.
14. Type-check and production build pass.

Automated tests must use isolated temporary databases and mocked external dependencies.

## Manual Verification

Run a recovery case that requires reassessment and replanning.

Verify:

- the console output contains the complete ordered `recoveryDecisions` array;
- the trial record contains every decision, diagnosis and recovery-plan ID;
- `recovery_decisions` contains one row per decision in sequence order;
- `diagnosis_results` and `recovery_plans` contain the corresponding records;
- action and evidence histories remain unchanged;
- the completed trial still references the final diagnosis and recovery plan through its compatibility fields.

## Explicitly Out of Scope

- Scenario-conformance validation.
- Requiring a predefined incident or fault label before recovery.
- Automated scenario detection.
- Fault-injection or environment-reset orchestration.
- Changes to baseline matching or agent reasoning.
- Changes to action selection, safety checks or action execution.
- Changes to evidence collection or normalization.
- Historical recovery retrieval for agent context.
- Automatic learning or baseline-rule mutation.
- Managed-system changes.
- Dissertation documentation changes.

## Acceptance Criteria

- [ ] Every strategy decision has a durable unique ID.
- [ ] Every decision, diagnosis and recovery plan is persisted before related action execution.
- [ ] Decision order is preserved per trial.
- [ ] Agent multi-action plans remain one decision when no replanning occurs.
- [ ] Baseline and agent replanning retain every generated decision.
- [ ] Trial records contain ordered history IDs.
- [ ] Singular compatibility fields reference the final decision.
- [ ] Stored history can be retrieved in decision order.
- [ ] Historical SQLite records remain readable.
- [ ] Recovery behaviour remains unchanged.
- [ ] Scenario validation is not introduced.
- [ ] Type-check, unit tests, integration tests and build pass.
- [ ] Independent review covers Amendment 2.
- [ ] Agents do not merge the pull request.

## Validation

Run from `managing-system/`:

```text
npm run test:types
npm test
npm run build
```

Then perform one Docker-based recovery run that produces at least two recovery decisions and inspect the persisted SQLite records.

## Workflow Preconditions

- Milestone 3 remains frozen.
- Amendment 1 is frozen and its Iteration 3 records remain unchanged.
- The current Milestone 3 pull request remains open.
- The target branch is `feat/milestone-3-bounded-docker-action-execution`.
- The working tree is clean before amendment implementation begins.
- Do not rewrite or delete historical SQLite records.
- Do not modify Amendment 1 to absorb this scope.
- Do not merge the pull request during implementation or review.
