# Milestone 1 Amendment 1: Action Data and Baseline Rules

**Status:** Archived  
**Version:** 1.0.0  
**Last Updated:** 2026-07-23  
**Parent Milestone:** `.ai/milestones/milestone-1-module-standardisation.md`  
**Target Pull Request:** `#1`  
**Target Branch:** `refactor/milestone-1-module-standardisation`  
**Cycle Scope:** `milestone-1-amendment-1`  
**Maximum Amendment Cycles:** `3`

## Reason

Milestone 1 standardised the module boundaries, but the action module still separates a small static handler catalogue across `handlers/**`, and the baseline recovery rule catalogue is represented as a service even though it contains stateless policy definitions and matching logic. This amendment defines a smaller temporary action-data boundary and names baseline rules according to their actual responsibility.

## Changed requirements

### Action catalogue and handlers

- Remove the `action/handlers/` directory.
- Add `action.data.ts` as the temporary source of the predefined:
  - actions;
  - safety rules;
  - allowlisted action-handler definitions and handler-key mapping.
- Preserve the existing handler behaviour:
  - `restart_postgres_container` restarts `managed-system-postgres`;
  - `restart_managed_system_service` restarts `managed-system-app`;
  - handlers continue to use argument-based process execution rather than arbitrary shell commands.
- `action.repository.ts` must import the static catalogue from `action.data.ts` and remain the lookup and persistence boundary.
- `ActionRepository` must expose:

  ```ts
  listActions()
  listSafetyRules()
  findActionById()
  findSafetyRuleById()
  findActionHandler()
  saveActionExecutionResult()
  ```

- `ActionService.executeAction()` must resolve handlers through `ActionRepository.findActionHandler()`.
- Delete obsolete handler files and exports after all usages have moved.
- Treat `action.data.ts` as a temporary static catalogue, not as the permanent persistence design.

### Baseline recovery rules

- Remove `recovery.baseline.service.ts` and the `RecoveryBaselineService` class.
- Add `recovery.baseline.rules.ts`.
- Keep `BaselineRule`, the predefined baseline rules, and their matching logic in the rules module.
- Expose a descriptive pure lookup function:

  ```ts
  findMatchingBaselineRule(evidenceSnapshot)
  ```

- `RecoveryBaselineStrategy` must use the rules module directly.
- Rule matching must remain deterministic and side-effect free.

### Repository engineering instructions

- Replace the placeholder project-specific section in `AGENTS.md` with enforceable repository rules covering:
  - cohesive module ownership;
  - SOLID design used pragmatically;
  - descriptive naming;
  - readable formatting and spacing;
  - dependency direction and injection;
  - schema and validation ownership;
  - focused tests;
  - documented validation commands;
  - preservation of user changes and milestone scope.

## Behaviour that must not change

- Existing action IDs, safety-rule IDs, handler keys, container targets, and expected outcomes.
- Allowlisted handler resolution and the rejection of unknown handlers.
- Centralized safety evaluation before handler execution.
- Action-execution-result persistence and its SQLite format.
- Baseline healthy, matched-rule, and escalation decisions.
- Agent recovery behaviour.
- Trial orchestration, continuation limits, evidence reassessment, and evaluation recording.
- Every unchanged requirement in the frozen parent milestone.

## Explicitly out of scope

- Persistent action or safety-rule CRUD.
- Database seeding for actions, safety rules, or handlers.
- Dynamic handler registration or loading.
- Arbitrary commands stored in action records.
- New handlers, actions, safety rules, or baseline recovery rules.
- Recovery-policy or trial-behaviour changes.
- Renaming unrelated modules or introducing new architectural layers.

## Required tests

1. Both existing handler keys resolve through `ActionRepository`.
2. Unknown handler keys still fail safely without execution.
3. The two handlers retain their exact Docker target and argument behaviour.
4. Action and safety-rule catalogue lookups retain their existing results.
5. Baseline healthy evidence still produces `no_action`.
6. Database-connectivity evidence still selects the PostgreSQL restart action and existing fallback.
7. Unmatched baseline evidence still escalates.
8. Existing unit and integration tests remain green.
9. Type-check and production build pass.

## Acceptance criteria

- [ ] `action/handlers/` no longer exists.
- [ ] `action.data.ts` contains the temporary predefined action, safety-rule, and allowlisted handler catalogue.
- [ ] `ActionRepository` is the only action-catalogue and handler-lookup boundary.
- [ ] `ActionService` does not import handler implementations directly.
- [ ] No arbitrary command execution is introduced.
- [ ] `RecoveryBaselineService` and `recovery.baseline.service.ts` no longer exist.
- [ ] Baseline rules and matching are exposed through `recovery.baseline.rules.ts`.
- [ ] Parent milestone behaviour remains intact.
- [ ] Updated `AGENTS.md` contains concrete, enforceable engineering rules rather than placeholder guidance.
- [ ] No unrelated work was introduced.
- [ ] Repository validation passes.
- [ ] The independent review covers the frozen parent milestone and this amendment.
- [ ] The pull request is not merged by an agent.
