# Milestone 2: Service Boundaries and Composition

**Status:** Archived  
**Version:** 1.0.0  
**Last Updated:** 2026-07-24  
**Depends On:** Milestone 1 Module Standardisation and Amendment 1  
**Target Pull Request:** —  
**Target Branch:** `refactor/milestone-2-service-boundaries`  
**Superseded By:** —

## Goal

Make each module service its public runtime boundary so that repositories remain private persistence or catalogue details of their owning module. Cross-module collaboration must occur through services or explicit contracts, while `src/index.ts` remains a composition root rather than a persistence client.

## Boundary Rule

- A repository belongs to exactly one module.
- A repository may be imported by:
  - its owning module;
  - `src/index.ts`, only to construct and inject the owning module's service.
- A repository must not be injected into or called by another module's service, strategy, factory or helper.
- Cross-module runtime dependencies must use the owning module's service.
- Cross-module type-only imports through public module barrels remain allowed.
- `src/index.ts` may construct repositories and services, but must call services rather than repository methods.
- Do not add pass-through methods unless they establish a real module boundary used by another module or the composition root.

## Required Composition

The composition root must explicitly construct dependencies in this direction:

```text
DatabaseService
├── EvidenceRepository -> EvidenceService
├── ActionRepository -> ActionService
├── TrialRepository -> TrialService
└── EvaluationRepository -> EvaluationService

SafetyService -> ActionService
EvidenceService -> ActionService
ActionService -> RecoveryAgentStrategy
ActionService + EvidenceService + EvaluationService -> TrialService
```

Rules:

- Construct `SafetyService` in `src/index.ts` and inject it into `ActionService`.
- Do not let `ActionService` silently construct its production `SafetyService` when the composition root is available.
- Do not inject `ActionRepository` into `SafetyService`.
- `ActionService` must resolve the selected action's safety rules through its own repository and pass the resolved rules to `SafetyService`.
- Inject only `EvidenceService` into `ActionService`; do not inject `EvidenceRepository` separately.
- Inject only `ActionService` and `EvidenceService` into `TrialService`; do not inject action or evidence repositories from those external modules.

## Evidence Module

`EvidenceRepository` remains private to the evidence module at runtime.

`EvidenceService` must own:

```ts
collectRawEvidence()
normalizeEvidence(rawEvidence)
collectAndNormalize()
saveEvidenceSnapshot(snapshot)
findEvidenceSnapshotById(snapshotId)
```

Requirements:

- Inject `EvidenceRepository` into `EvidenceService`.
- Preserve the current OpenAI-backed normalization behaviour.
- `ActionService`, `TrialService`, and `src/index.ts` must use `EvidenceService` for evidence persistence and lookup.
- No external module may import or receive `EvidenceRepository`.

## Action and Safety Modules

`ActionService` is the public runtime boundary for the action catalogue, execution and execution-result persistence.

It must own:

```ts
listActions()
findActionById(actionId)
executeAction(action, beforeEvidenceSnapshot, context)
saveActionExecutionResult(result)
```

Requirements:

- Inject `ActionRepository`, `SafetyService`, and `EvidenceService` into `ActionService`.
- `ActionService` resolves `SafetyRule` records through `ActionRepository`.
- `SafetyService.evaluateActionSafety()` receives the selected `Action`, its resolved safety rules, and the safety context.
- `SafetyService` performs deterministic evaluation only and must not import or construct `ActionRepository`.
- `ActionService` uses `EvidenceService` to collect, normalize, save, and retrieve post-action evidence.
- Preserve the existing allowlisted handler lookup and action-result persistence behaviour.

## Recovery Module

`RecoveryAgentStrategy` must depend on `ActionService`, not `ActionRepository`.

Requirements:

- Obtain available actions through `ActionService.listActions()`.
- Validate planned action IDs through `ActionService.findActionById()`.
- Preserve agent diagnosis, planning, escalation and bounded-action behaviour.
- `RecoveryBaselineStrategy` and baseline rules remain deterministic and repository-free.
- No recovery service or strategy may import an external module repository.

## Evaluation Module

Add `evaluation.service.ts` with `EvaluationService` as the module's public runtime boundary.

It must own:

```ts
createEvaluationSummary(trialRecord, reason)
saveEvaluationSummary(summary)
```

Requirements:

- Inject `EvaluationFactory` and `EvaluationRepository` into `EvaluationService`.
- Keep summary construction in `EvaluationFactory`.
- Keep persistence in `EvaluationRepository`.
- `TrialService` and `src/index.ts` must not import `EvaluationFactory` or call `EvaluationRepository` directly.

## Trial Module

`TrialService` remains the recovery-trial orchestrator and becomes the public boundary for trial persistence.

It must own:

```ts
runRecoveryTrial(input)
saveTrialRecord(trialRecord)
```

Requirements:

- Inject `TrialRepository`, `ActionService`, `EvidenceService`, and `EvaluationService`.
- Remove `ActionRepositoryPort`, `EvidenceRepositoryPort`, and the duplicate action-persistence repository dependency.
- Resolve planned actions through `ActionService.findActionById()`.
- Persist action results through `ActionService.saveActionExecutionResult()`.
- Resolve post-action snapshots through `EvidenceService.findEvidenceSnapshotById()`.
- Create evaluation summaries through `EvaluationService.createEvaluationSummary()`.
- Preserve the current recovery loop, continuation handling, action limits and returned result shape.

## Composition-Root Changes

Update `managing-system/src/index.ts` so that:

- repositories are used only as constructor arguments for their owning services;
- no repository method is called directly;
- `SafetyService` is explicitly constructed and injected;
- `EvidenceService` owns evidence persistence;
- `ActionService` owns action lookup and result persistence;
- `EvaluationService` owns evaluation construction and persistence;
- `TrialService` owns trial persistence;
- baseline and agent trials remain separately executed and recorded.

Preserve the current uncommitted rename from `trialRunner` to `trialService`.

## Public Barrels

- Continue exporting repositories only where `src/index.ts` needs them for dependency construction.
- External feature modules must not import those repository exports.
- Export `EvaluationService` from the evaluation barrel.
- Keep type and schema exports required for cross-module contracts.
- Do not introduce a dependency-injection container or framework.

## Explicitly Out of Scope

- Docker CLI or Docker socket changes.
- Recovery action execution changes.
- New recovery strategies, actions, safety rules or scenarios.
- Database schema or stored JSON changes.
- ORM adoption.
- Continuous monitoring or alert-triggered execution.
- Generic base repositories or generic base services.
- Moving all persistence into `TrialService`.
- Unrelated naming or formatting refactors.

## Required Tests

1. `EvidenceService` persists and retrieves snapshots through its injected repository.
2. `SafetyService` evaluates supplied rules without constructing or importing `ActionRepository`.
3. `ActionService` resolves safety rules before evaluation.
4. `ActionService` uses `EvidenceService` for post-action evidence persistence.
5. `RecoveryAgentStrategy` obtains and validates actions through `ActionService`.
6. `TrialService` resolves actions and persists execution results through `ActionService`.
7. `TrialService` resolves post-action snapshots through `EvidenceService`.
8. `EvaluationService` delegates construction and persistence correctly.
9. Baseline and agent trials remain separately recorded.
10. Existing unit and integration behaviour remains unchanged.
11. Type-check, test and production build pass.

## Acceptance Criteria

- [ ] No module outside `action/` imports `ActionRepository`.
- [ ] No module outside `evidence/` imports `EvidenceRepository`.
- [ ] No module outside `evaluation/` imports `EvaluationRepository`.
- [ ] No module outside `trial/` imports `TrialRepository`.
- [ ] `src/index.ts` does not call repository methods.
- [ ] `SafetyService` has no repository dependency.
- [ ] `ActionService` receives an explicitly constructed `SafetyService`.
- [ ] `ActionService` receives one evidence dependency: `EvidenceService`.
- [ ] `RecoveryAgentStrategy` depends on `ActionService`.
- [ ] `TrialService` has no external repository dependencies.
- [ ] `EvaluationService` is the public evaluation runtime boundary.
- [ ] Separate baseline and agent trial records and evaluation summaries are preserved.
- [ ] Existing SQLite tables and JSON formats remain compatible.
- [ ] Repository validation passes.
- [ ] Docker-related files and runtime behaviour are unchanged.
- [ ] No unrelated user changes are reverted.

## Validation

Run from `managing-system/`:

```text
npm run test:types
npm test
npm run build
```

Also verify repository-boundary imports:

```text
rg "Repository" src/modules
```

Every cross-module repository import found by the audit must be removed.

## Workflow Precondition

The current working tree contains an uncommitted `src/index.ts` rename from `trialRunner` to `trialService`. Preserve this change when creating or switching to the milestone branch. Do not discard, overwrite or revert it.
