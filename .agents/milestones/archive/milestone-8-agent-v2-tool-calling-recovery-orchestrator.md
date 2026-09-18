# Milestone 8: Agent V2 Tool-Calling Recovery Orchestrator

**Status:** Frozen
**Version:** 1.0.0
**Last Updated:** 2026-09-07
**Depends On:** Milestone 7 Recovery Measurement and Reproducible Experiment Automation
**Target Pull Request:** https://github.com/Freeman-md/self-healing-backend-ops/pull/8
**Target Branch:** `feat/milestone-8-agent-v2-orchestrator`
**Merge Mode:** Manual
**Merge Method:** squash
**Superseded By:** —

## Goal

Add a distinct Agent V2 recovery strategy that uses native OpenAI function calling to own the bounded recovery loop: produce structured diagnoses, plans and decisions; persist them through controlled tools; select and invoke registered recovery actions; observe execution and fresh evidence; revise its reasoning; and continue until deterministically verified completion or safe escalation. Preserve Baseline and Agent V1 as independently selectable strategies, while keeping validation, persistence, safety enforcement, infrastructure execution, measurements and hard limits under deterministic application control.

## Required behaviour

### Strategy organization and selection

- Organize strategy-specific recovery code under `recovery/strategies/baseline/`, `recovery/strategies/agent-v1/` and `recovery/strategies/agent-v2/`; keep shared recovery schemas, types, persistence, factories, services and the public barrel at the recovery-module root.
- Move the current baseline and agent implementations into their respective folders without changing their behaviour, and rename the current agent implementation explicitly as Agent V1.
- Preserve `RECOVERY_MODE=baseline|agent` and the existing Prisma `RecoveryMode` values.
- Add `AGENT_STRATEGY_VERSION=v1|v2`; ignore it for baseline mode, default it to `v2` for agent mode, and wire the selected strategy in the composition root.
- Identify the selected agent version in startup logs, frozen experiment configuration and exported experiment summaries without rewriting historical records.
- Keep distinct implementation versions: Agent V1 `1.0.0` and Agent V2 `2.0.0`.

### Strategy contracts and ownership

- Replace the uniform one-step strategy assumption with a discriminated strategy contract: Baseline and Agent V1 remain externally orchestrated decision strategies; Agent V2 is an agent-orchestrated recovery strategy.
- Keep the existing external recovery loop unchanged for Baseline and Agent V1.
- Make Agent V2 own tool selection, tool invocation order, observation handling, replanning and terminal choice inside one native tool-calling conversation.
- Keep `TrialService` responsible only for the common outer trial lifecycle: initialization, strategy selection, the controlled execution environment, durable accounting, measurement, evaluation and finalization.
- Do not make `TrialService` interpret Agent V2's plan or select Agent V2's next action.

### Controlled Agent V2 environment

- Give Agent V2 only the registered action catalogue, a controlled recovery-decision persistence operation, a controlled registered-action execution operation, and deterministic action/turn limits.
- Keep Prisma, repositories, Docker, action handlers, command execution and unrestricted service access hidden from Agent V2.
- Persist decisions through `RecoveryService` and execute selected actions through `ActionService`, which must continue to apply `SafetyService` before resolving an allowlisted `ActionHandlerRegistry` handler.
- Return a sanitized action observation to Agent V2 containing action ID, execution and continuation status, safety status, failed rule IDs, expected-outcome result, concise outcome or error, and the fresh persisted evidence snapshot.
- Never expose credentials, environment values, raw terminal output or executable command strings in tool results.
### Agent-owned domain outputs

- Define an Agent V2 Zod schema, derived from the existing domain schemas, for the semantic contents of a diagnosis, recovery plan and recovery decision.
- Let Agent V2 supply incident type, severity, confidence, reasoning summary, supporting signals, contradictions, proposed and fallback action IDs, rationale, expected outcome, decision status/reason and escalation reason.
- Keep IDs, timestamps, trial ID, current evidence-snapshot ID, decision sequence, recovery mode and diagnosis method application-owned; reject attempts to supply or override them.
- Validate that named supporting signals exist in the current snapshot, every proposed/fallback action exists in the supplied catalogue, lists contain no duplicates, action-selected decisions contain a proposed action, no-action decisions contain no proposed actions, and escalations include a reason.
- Application code may validate, attach trusted metadata and persist Agent V2 outputs, but must not recreate or reinterpret their semantic diagnosis or plan.

### Native function tools and loop

- Use strict OpenAI function tools generated from Zod-compatible schemas, `tool_choice: "required"`, `parallel_tool_calls: false`, one accepted function call per turn, and `function_call_output` continuations in the same Responses API conversation.
- Provide `record_recovery_decision`, one dynamic action tool per registered action, `complete_recovery` and `escalate_recovery`.
- `record_recovery_decision` validates and persists the complete agent-produced diagnosis, plan and decision, then returns trusted persisted identifiers and accepted action IDs without executing an action.
- Before an action tool executes, require an accepted current action-selected decision whose plan contains that action and confirm that its attempt limit is not exhausted.
- Action tools accept no executable input and delegate only to the controlled registered-action operation.
- Return every action result and fresh evidence snapshot to Agent V2 so it may revise its diagnosis and plan, select another action, complete or escalate.
- `complete_recovery` accepts and persists a final no-action diagnosis/plan/decision but succeeds only when the latest deterministic evidence state is healthy; return premature completion as a bounded rejected tool result when another turn remains.
- `escalate_recovery` accepts and persists a final escalation diagnosis/plan/decision and terminates safely.
- Permit Agent V2 to react to blocked or failed action observations when policy and remaining limits allow; mandatory safety escalation terminates immediately and cannot be overridden.

### Limits, failure semantics and telemetry

- Preserve the existing maximum of three executed recovery actions.
- Set the Agent V2 model-turn limit to `(maxRecoverySteps * 2) + 2`, which is eight turns at the current action limit.
- Count invalid model calls against the turn limit but not the action-attempt limit; count an action attempt only when `ActionService` is invoked.
- Reject zero or multiple function calls, unknown tools and malformed arguments; return bounded validation errors to the agent only while turns remain.
- Treat provider failure as a failed trial and exhausted deterministic limits as escalation.
- Extend `OpenAIService` with provider-neutral create/continue tool-calling operations that normalize function calls and record telemetry for every provider request without owning recovery dispatch or orchestration.
- Continue using the existing recovery-planning telemetry operation unless a new value can be added without a persistence migration.

### Literature and design evidence

- Before runtime implementation, create `01-milestone-frame.md` and `02-literature-pass.md` under `/Users/freemancodz/Desktop/Projects/Systems Engineer/dissertation/experiments/work-done/week-13/milestone-8-agent-v2-tool-calling-recovery-orchestrator/`.
- Use ReAct, Toolformer, the LLM-agent planning survey and the existing safety/governance sources to justify the reasoning-action-observation loop, conditional tool use, agent-owned planning and deterministic execution boundary.
- Use official OpenAI function-calling documentation for implementation mechanics, not as academic evidence.
- Record the architectural progression from Agent V1's distributed orchestration to Agent V2's tool-calling orchestration, while deferring retrieval, memory, HITL and broader incident-lifecycle ownership.
- Do not write the milestone report draft until the implementation and later comparative benchmark evidence exist.

## Constraints

- Follow the repository's module ownership, strict TypeScript, Zod, naming, persistence and public-barrel rules.
- Keep shared recovery contracts at the recovery root and strategy-specific code inside its strategy folder.
- Preserve Baseline and Agent V1 runtime behaviour and existing historical data.
- Preserve `TrialRecord` as the universal recovery episode and retain all decision, plan, diagnosis, evidence, action, evaluation and measurement relationships.
- Preserve centralized safety enforcement and the allowlisted, argument-based Docker execution boundary.
- Treat deterministic healthy evidence as the only authority for successful recovery completion.
- Keep `OpenAIService` provider-focused; Agent V2 owns the conversation loop and domain tool dispatch.
- Do not read, print, modify or commit `.env` or `.env.local`.
- Keep changes bounded to the smallest complete Agent V2 architecture; do not add abstractions without a current second use.

## Explicitly out of scope

- Retrieval-augmented generation, recovery memory or automatic learning.
- Human-in-the-loop workflow changes.
- Multi-agent orchestration or OpenAI Agents SDK adoption.
- New recovery actions, handlers or fault profiles.
- Direct Docker or repository access from Agent V2.
- Model-generated or mutable tool implementations.
- Generic plugin, tool-registry or workflow-framework infrastructure.
- Changes to the Prisma `RecoveryMode` enum or rewriting historical trial records.
- The final Agent V1 versus Agent V2 benchmark campaign and dissertation-results rewrite.
- Broader ownership of evidence collection, normalization or the complete incident lifecycle.

## Required tests

1. Verify Baseline, Agent V1 and Agent V2 are independently selectable and that Baseline and Agent V1 retain existing behaviour.
2. Verify Agent V2 produces schema-valid semantic diagnosis, plan and decision objects while application-owned fields cannot be supplied or overridden.
3. Verify tool declarations are derived only from registered actions and an action cannot execute before an accepted decision selects it.
4. Verify every action executes through `ActionService` and `SafetyService`, and no Agent V2 path directly reaches Docker or an action handler.
5. Verify action outcomes and fresh evidence return to the same agent conversation and allow a revised decision or different action after an unresolved, permitted blocked or failed result.
6. Verify mandatory safety escalation stops the loop, premature completion is rejected, deterministic healthy evidence permits completion, and explicit escalation terminates safely.
7. Verify unknown tools, malformed arguments, missing calls, multiple calls, provider failures and exhausted limits fail or escalate according to the contract without unbounded execution.
8. Verify decision/action/evidence history remains reconstructable, every provider turn records telemetry, and experiment configuration and exports distinguish Agent V1 from Agent V2.
9. Run from `managing-system/`: `npm run test:types`, `npm test`, and `npm run build`.

## Acceptance criteria

- [x] The focused Milestone 8 frame and literature pass are complete before runtime implementation.
- [x] Baseline, Agent V1 and Agent V2 exist as distinct strategy implementations and are selectable according to the contract.
- [x] Agent V2 owns the native function-calling recovery loop and produces the semantic diagnosis, plan and decision at each step.
- [x] Agent V2 persists decisions and invokes actions only through the controlled environment.
- [x] Every selected action remains registered, validated, safety-checked and executed through the existing deterministic boundary.
- [x] Tool results and fresh evidence are returned to Agent V2 for iterative replanning.
- [x] Completion, escalation and execution limits follow the deterministic contract.
- [x] Existing Baseline, Agent V1, persistence, measurement, monitoring and experiment behaviour remains intact.
- [x] Agent version and prompt version are visible in runtime and frozen experiment evidence.
- [x] Explicitly excluded work was not introduced.
- [x] Focused regression tests and all repository validation commands pass.
- [ ] One credential-dependent Agent V2 recovery smoke run is recorded accurately as manual verification.
- [x] The complete independent review is posted to the pull request for the exact reviewed head.
- [x] The pull request is not merged by an agent.


## Manual tasks

1. Supply the existing OpenAI, PostgreSQL and Docker-enabled runtime configuration through the approved local environment mechanism.
2. Run one supported monitor-triggered Agent V2 recovery smoke test and confirm that the agent records a decision, invokes only a registered action through the safety boundary, observes fresh evidence and terminates correctly.

## Manual acceptance criteria

- [ ] A real Agent V2 run completes or escalates through the bounded tool-calling loop without bypassing the existing safety and action services.

## Completion Record

**Implementation Outcome:** Implemented, committed and pushed on `feat/milestone-8-agent-v2-orchestrator` at `4edf1c9d9ec5e9837742afe0a99afbe81d6ef076`. PR #8 is open. Lifecycle state: `ready_for_human`. User explicitly authorized publication on 2026-09-07 after the initial automatic approval block. No merge occurred.
**Important Decisions:** Baseline and V1 retain the external loop. V2 owns a native tool conversation with strict semantic outputs and application-owned metadata. Controlled trial operations preserve ActionService/SafetyService execution and durable accounting. Observations omit free-form text/string values while preserving deterministic signal statuses. Blocked/failed actions without post-action evidence collect and link a fresh persisted snapshot. Provider failure finalizes a failed trial without fabricating a model decision. No last-turn action executes when no observation turn remains.
**Contract Deviations:** No implementation scope expansion or persistence migration. Initial publication approval block was resolved by explicit user authorization. Independent exact-head review is APPROVE and all five GitHub checks PASS.
**Verification Summary:** `npm run test:types` PASS; `npm test` PASS (85 unit, 4 integration); `npm run build` PASS; changed TypeScript ESLint/Prettier checks PASS; `git diff --check` PASS. Tests used a disposable PostgreSQL 14 database on a dedicated loopback port with migrations applied, and DOTENV_CONFIG_PATH=/dev/null. Initial database-dependent tests failed before disposable PostgreSQL setup; the complete rerun passed. All five GitHub checks PASS at the reviewed head, including PostgreSQL 16 migration/seed/idempotence verification, types, tests, builds, formatting and security. No live OpenAI/Docker smoke run performed. Required frame/literature pass completed before runtime changes in `/Users/freemancodz/Desktop/Projects/Systems Engineer/dissertation/experiments/work-done/week-13/milestone-8-agent-v2-tool-calling-recovery-orchestrator/`.
**Review Outcome:** Independent provisional local review PASS after fixing M8-R1 (medium): suite-level exports dropped frozen agent version identity. Fixed JSON manifest and Markdown summary; three V1/V2/historical regression tests passed independently. No remaining actionable local findings. Final independent review APPROVE at `4edf1c9d9ec5e9837742afe0a99afbe81d6ef076`, zero findings. Independently reran 23 focused tests, all passed. Complete review published and verified: https://github.com/Freeman-md/self-healing-backend-ops/pull/8#issuecomment-5567661753. All five current-head checks SUCCESS and no unresolved review threads.
**Reviewed Head:** `4edf1c9d9ec5e9837742afe0a99afbe81d6ef076` (APPROVE).
**Pull Request:** https://github.com/Freeman-md/self-healing-backend-ops/pull/8
**Merge Commit:** —
**Follow-up Notes:** All agent-verifiable handoff gates passed. PR remains OPEN; manual merge mode; no auto-merge enabled. Manual task: supply existing runtime configuration and record one supported monitor-triggered V2 smoke run using the README procedure. Human-only acceptance remains PENDING. Do not merge. Comparative benchmark and report draft remain deferred.

## Post-merge archival clarification — 2026-09-18

The completion record above is preserved as the original pre-merge handoff, not rewritten as if later evidence existed on 2026-09-07. The user explicitly authorized archival on 2026-09-18.

- GitHub PR #8 is MERGED, merged at 2026-09-15T09:29:25Z. Verified merge commit: `253af286c64ce608e72cea99d2b84c5b07bde78c`; verified reviewed/source head: `4edf1c9d9ec5e9837742afe0a99afbe81d6ef076`.
- Local `main` and freshly fetched `origin/main` both resolve to that merge commit. The implementation tree of the former feature branch is incorporated in main; the only additional tree change is the documented `.env.example` setting. No PR was merged during this archival operation.
- Subsequent live comparative benchmark evidence and report drafting are recorded in `dissertation/experiments/work-done/week-13/milestone-8-agent-v2-tool-calling-recovery-orchestrator/04-benchmark-evaluation.md` in the Systems Engineer workspace. The earlier statements that benchmark/report work was deferred are historical handoff statements, not current status. This archival check did not rerun runtime tests or retrospectively certify every original smoke checklist item.
- Contract archived locally under its canonical filename. Its original Frozen status and checklist remain historical evidence. Milestone 9 may now become the local active contract. Archive publication/commit is not performed by contract authoring.
