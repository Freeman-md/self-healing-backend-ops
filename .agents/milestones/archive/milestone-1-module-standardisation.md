# Milestone 1: Module Standardisation

**Status:** Archived  
**Version:** 1.0.0  
**Last Updated:** 2026-07-23  
**Depends On:** None  
**Target Pull Request:** —  
**Target Branch:** `refactor/milestone-1-module-standardisation`  
**Superseded By:** —

## Goal

Standardise the managing-system modules around singular bounded contexts, descriptive service and persistence operations, and clear ownership of construction, orchestration, and storage, without changing recovery behaviour, database formats, action handlers, or trial semantics.

## Required behaviour

### Module structure

- Use singular bounded-context directories:

  ```text
  modules/
  ├── action/
  ├── evaluation/
  ├── evidence/
  ├── recovery/
  ├── safety/
  └── trial/
  ```

- Update all imports, constructor dependencies, barrel exports, tests, and composition-root usage to match the standardised structure.
- All classes representing services must use the `Service` suffix.
- Use descriptive domain method names instead of generic `save()`, `create()`, or `evaluate()` names where the operation can be stated explicitly.

### Evidence

- Consolidate evidence collection and normalization into `evidence.service.ts`.
- `EvidenceService` must expose:

  ```ts
  collectRawEvidence()
  normalizeEvidence(rawEvidence)
  ```

- Retain `evidence.repository.ts` and `evidence.schema.ts`.
- `EvidenceRepository` must expose:

  ```ts
  saveEvidenceSnapshot()
  findEvidenceSnapshotById()
  ```

- Keep the small evidence-construction and URL/ID logic as private, descriptively named `EvidenceService` methods.
- Do not add evidence factories, mappers, or helpers.

### Evaluation

- Preserve the existing `EvaluationFactory` work.
- `EvaluationFactory` must expose:

  ```ts
  createEvaluationSummary()
  ```

- `EvaluationRepository` must expose:

  ```ts
  saveEvaluationSummary()
  ```

### Recovery

- Flatten recovery implementation files into:

  ```text
  recovery.agent.service.ts
  recovery.baseline.service.ts
  recovery.agent.strategy.ts
  recovery.baseline.strategy.ts
  recovery.factory.ts
  recovery.schema.ts
  recovery.types.ts
  ```

- `RecoveryAgentService` must consolidate agent diagnosis and planning through:

  ```ts
  diagnoseEvidence()
  createRecoveryPlan()
  ```

- `RecoveryBaselineService` must own:
  - baseline rule definitions;
  - suspected-incident matching;
  - critical-signal lookup;
  - matching-rule selection.

- `RecoveryFactory` must own deterministic construction through:

  ```ts
  createDiagnosisResult()
  createRecoveryPlan()
  createRecoveryDecision()
  ```

- Recovery strategies remain responsible for path orchestration:

  ```ts
  RecoveryAgentStrategy.decide()
  RecoveryBaselineStrategy.decide()
  ```

### Action

- Rename `ActionDefinition` to `Action`.
- Consolidate the action module root into:

  ```text
  action.repository.ts
  action.service.ts
  action.factory.ts
  action.schema.ts
  action.types.ts
  handlers/
  index.ts
  ```

- `ActionRepository` must replace the current action registry and action-execution repository through:

  ```ts
  listActions()
  listSafetyRules()
  findActionById()
  findSafetyRuleById()
  saveActionExecutionResult()
  ```

- `ActionService` must consolidate action execution and outcome evaluation through:

  ```ts
  executeAction()
  evaluateActionOutcome()
  ```

- `ActionFactory` must construct blocked, failed, and successful `ActionExecutionResult` values so the service does not repeat result object structures.
- Retain the current action catalogue and SQLite action-execution-result persistence.

### Safety

- Rename `safety-gate.service.ts` to `safety.service.ts`.
- Rename `SafetyGate` to `SafetyService`.
- Replace the generic safety method with:

  ```ts
  evaluateActionSafety()
  ```

- Preserve centralized safety enforcement before handler execution.

### Trial

- Rename `trial-runner.service.ts` to `trial.service.ts`.
- Rename `TrialRunner` to `TrialService`.
- Consolidate trial construction into `trial.factory.ts`.
- `TrialFactory` must expose:

  ```ts
  createTrialContext()
  createTrialStateFromDecision()
  createTrialStateFromActionResult()
  createTrialRecord()
  ```

- Use `trial.helpers.ts` only for pure trial-context operations:

  ```ts
  getOrderedRecoveryActionIds()
  recordActionResultInTrialContext()
  recordEvidenceSnapshotInTrialContext()
  ```

- Trial-context mutation must not move into `TrialRepository` because it is not persistence.
- `TrialRepository` must expose:

  ```ts
  saveTrialRecord()
  ```

- Action-result persistence must use:

  ```ts
  ActionRepository.saveActionExecutionResult()
  ```

- Evidence lookup after action execution remains trial orchestration and must use:

  ```ts
  EvidenceRepository.findEvidenceSnapshotById()
  ```

## Constraints

- Preserve existing runtime and recovery behaviour.
- Preserve SQLite table names and stored JSON formats.
- Preserve separate baseline and agent trials.
- Preserve centralized safety enforcement.
- Preserve allowlisted action handlers.
- Preserve and complete the current uncommitted `EvaluationFactory` work; do not revert it.
- Implement the smallest complete structural change.
- Do not add empty repositories, factories, helpers, or mappers.
- Do not place non-persistence state mutation in repositories.

## Explicitly out of scope

- Persistent `Action` CRUD and action seeding.
- New recovery rules, actions, handlers, or incident scenarios.
- ORM adoption or database migration.
- Recovery algorithm or policy changes.
- Managed-system changes.
- Dissertation documentation.
- Additional mapper files without an actual representation conversion.
- Unrelated refactoring or future product work.

## Required tests

1. Evidence collection handles successful and failed health and metrics requests.
2. Evidence normalization produces schema-valid snapshots.
3. Baseline healthy, matched-rule, and escalation paths remain unchanged.
4. Agent diagnosis and planning continue to use structured OpenAI outputs.
5. Action safety blocking, unknown handlers, successful execution, reassessment, and result persistence remain intact.
6. Baseline and agent trials remain separately recorded through `TrialService`.
7. Repository methods persist to the existing SQLite tables.
8. Existing tests remain green.
9. Type-check, unit tests, integration tests, and the production build pass.

## Acceptance criteria

- [ ] Only singular module-directory names remain.
- [ ] No `ActionDefinition`, `ActionRegistry`, `ActionExecutor`, `TrialRunner`, or `SafetyGate` symbols remain.
- [ ] No generic repository `save()` methods remain.
- [ ] Evidence collection and normalization use one `EvidenceService`.
- [ ] Agent diagnosis and planning use one `RecoveryAgentService`.
- [ ] Baseline rule matching uses one `RecoveryBaselineService`.
- [ ] Trial construction uses one `TrialFactory`.
- [ ] All service classes use the `Service` suffix.
- [ ] Existing recovery behaviour remains intact.
- [ ] Existing SQLite tables and stored JSON formats remain compatible.
- [ ] Focused tests pass.
- [ ] Repository validation commands pass.
- [ ] Explicitly excluded work was not introduced.
- [ ] The complete independent review is posted to the pull request.
- [ ] The pull request is not merged by an agent.

## Manual tasks

1. Provide the required OpenAI credential in the local runtime environment before Docker verification.
2. Run:

   ```text
   docker compose up --build managing-system
   ```

## Manual acceptance criteria

- [ ] Evidence collection and normalization complete successfully in Docker.
- [ ] Separate baseline and agent trials complete successfully.
- [ ] Evidence snapshots, action execution results, trial records, and evaluation summaries remain correctly recorded in SQLite.

## Workflow precondition

The working tree contains related uncommitted `EvaluationFactory` changes. Preserve them and safely include them in the milestone branch, or commit them as an explicit baseline before invoking `Run the active milestone`. The workflow must not discard or overwrite them.
