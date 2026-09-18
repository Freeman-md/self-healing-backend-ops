# Milestone 9: Historical Recovery Reuse, Human Escalation and Workload Evaluation

**Status:** Archived
**Version:** 1.0.0
**Last Updated:** 2026-09-18
**Depends On:** Milestone 8 Agent V2 Tool-Calling Recovery Orchestrator
**Target Pull Request:** https://github.com/Freeman-md/self-healing-backend-ops/pull/9
**Target Branch:** `feat/milestone-9-recovery-reuse-and-evaluation`
**Merge Mode:** Manual
**Merge Method:** squash
**Superseded By:** —

## Goal

Extend Agent V2 with diagnosis-first reuse of compatible verified historical recovery plans and durable human escalation/review, while preserving deterministic execution authority and the original comparison strategies. Prepare reproducible runners for canonical recovery, cold/warm reuse, one unsupported fault and one calibrated workload comparison. Deliver backend capabilities and evidence tooling, not dashboard code, final benchmark results or speculative infrastructure.

## Approved scope and execution entry

- Research scope authority: `/Users/freemancodz/Desktop/Projects/Systems Engineer/dissertation/methodology/2026-09-18-final-scope-freeze.md`, followed by the user-approved backend milestone plan. Follow the existing dissertation criteria and record standards; do not invent academic requirements.
- Engineering milestone numbering follows this repository's archived contracts: this contract is engineering Milestone 9. The separate dissertation experiment frame already named Milestone 9 is an experimental record, not a contract to overwrite or renumber.
- The contract is authored ignored and local on `main`, as explicitly requested. On `Run Active Milestone`, create or check out the target feature branch in this checkout; do not use a worktree or begin implementation on main. Resume an existing branch/PR instead of duplicating it. Preserve the untracked historical experiment directories.
- The Milestone 8 archive contains its original handoff plus a verified post-merge clarification. Include that historical archive in the implementation PR without rewriting its original completion evidence. Never commit this active contract.
- Before runtime implementation, complete the focused design/literature records specified below. Inspect current code and use actual public contracts, including `ControlledRecoveryEnvironment`, `RecoveryAgentV2Strategy` and the existing create/continue tool-conversation operations; illustrative earlier names are not requirements to rename working code.

## Required behaviour

### 1. Preserve comparison paths and identify the extension

- Baseline and Agent V1 remain independently selectable with their existing decision/execution behaviour. Preserve `RECOVERY_MODE`, `AGENT_STRATEGY_VERSION` and the Prisma RecoveryMode enum.
- Add a documented, validated historical-retrieval setting, default off. Retrieval-off Agent V2 retains the original prompt, tool declarations, conversation path and eight-turn limit. Do not silently add lookup turns to the original path.
- Retrieval-enabled Agent V2 has distinct implementation/prompt identity and a twelve-turn budget at three recovery steps. Freeze the setting, versions, retrieval protocol, corpus membership and compatibility fingerprints in experiment configuration and exports. Identify these settings in non-secret startup logs.
- Necessary deterministic applicability and escalation-hold changes apply through the shared boundaries; preserve supported recovery behaviour and disclose policy changes in comparisons rather than claiming historical binaries are identical.

### 2. Diagnose before structured historical lookup

- Expose one strict controlled diagnosis-and-lookup tool to retrieval-enabled V2. The model supplies only semantic diagnosis fields derived from existing domain schemas. Validate signal references against the current snapshot and reject model-controlled IDs, timestamps, trial/evidence correlations and provenance.
- Persist the accepted diagnosis with trusted metadata before lookup. Reuse existing diagnosis persistence; a standalone diagnosis must not require application code to invent a plan or decision.
- Retrieve from existing PostgreSQL recovery records using bounded structured matching. Combine diagnosed incident information with deterministic signal codes/statuses and required target-state values; incident prose or a principal incident code alone is insufficient, particularly for multi-component faults.
- Define the matching algorithm, required state fields, compatibility fingerprints, deterministic tie-breaking, maximum candidate count and source eligibility explicitly in the milestone design record. Return a bounded sanitized candidate or an explicit miss with bounded reason/latency metadata.
- Do not expose repositories, raw configuration, credentials, terminal output, arbitrary query capability or sensitive evidence values to the model. Historical text is untrusted data, never system instructions.

### 3. Eligible cases, adoption and generation

- Eligible sources are completed, deterministically healthy trials with safe successful relevant action history and a source plan consistent with the relevant actions actually executed. Controlled-experiment sources also require the independent oracle's successful outcome before publication.
- Exclude failed, incomplete, escalated, current, incompatible or unknown-provenance sources. Do not promote an abandoned proposal simply because a later plan healed the same trial. Retain the exact source trial/plan/action/evidence relationships.
- Require compatible managed targets/configuration, action catalogue and safety policy, as well as matching current deterministic evidence. Define non-secret fingerprints; historical success never authorizes a present action or completion.
- The agent chooses either adoption or generation. Adoption uses an application-issued candidate reference scoped to the current lookup, trial, diagnosis and evidence. Revalidate eligibility, compatibility and currentness at adoption, rejecting stale/foreign references without execution.
- Adoption copies the validated source plan's semantic contents into fresh current records without regenerating, embellishing or silently rewriting that plan. The model supplies the current decision status/reason; trusted metadata links the already accepted current diagnosis and new plan/decision. Invalid or inapplicable candidates produce a bounded rejection/miss, not an application-invented repair plan.
- Generation accepts the model's new semantic plan and decision linked to the accepted current diagnosis, validates existing invariants and persists through recovery services. Keep action-selected/no-action/escalation status consistency, registered-action membership and duplicate checks.
- Persist generated/retrieved provenance, lookup outcome/matching method and source trial/plan identifiers. Publish eligible normal-runtime cases only after completion verification; experiment case publication waits for the independent oracle where required.
- Support a scoped corpus or explicit source allowlist. Empty means no eligible source in that scope, not database deletion. Never silently import historical trials into controlled runs. Freeze membership before each run; newly verified sources can enter a later warm run only through the explicit protocol.

### 4. Agent-owned recovery loop and deterministic authority

The enabled loop is: diagnose and lookup → adopt or generate and record → choose a registered action → observe execution and fresh evidence → diagnose/replan as needed → complete or escalate.

- Agent V2 owns semantic reasoning, tool order, adoption/generation, action selection and replanning. TrialService supplies controlled operations and owns only the outer lifecycle/accounting/finalization; it must not infer the next agent action or recreate semantic diagnosis/plan contents.
- Reuse native Responses API conversation infrastructure: strict Zod-derived function schemas, required tool choice, parallel calls disabled, one accepted function call per turn, and function outputs returned to the same conversation. Preserve sanitized action observations and fresh persisted evidence.
- Require an accepted current action-selected decision selecting the invoked action. Consume that authorization with one action; fresh evidence requires renewed reasoning/authorization. Dynamic action tools come only from the registered catalogue and accept no executable arguments.
- Every operational attempt passes through ActionService, SafetyService, allowlisted handlers and the existing argument-based runtime boundary. Neither retrieval nor human review grants alternative execution authority.
- Preserve at most three ActionService invocations. Retrieval-enabled `maxAgentTurns = (maxRecoverySteps * 3) + 3`, twelve at the current limit: three diagnosis/plan/action cycles, a terminal call and two correction turns. Retrieval-off retains `(maxRecoverySteps * 2) + 2`.
- Invalid calls consume a model turn, not an action attempt. Count action attempts only on ActionService invocation, including blocked/failed invocations. Retain per-action attempt/repetition rules. Do not execute a last-turn action without capacity to observe and terminate safely.
- Return permitted blocked/failed outcomes for replanning; mandatory safety escalation stops immediately. Unknown tools, missing/multiple calls and malformed arguments are bounded errors while turns remain. Provider failure fails the trial; exhausted limits deterministically escalate.
- Final completion requires latest deterministic healthy evidence. Explicit escalation and deterministic safety/limit escalation terminate unresolved, with durable attention as below. Final diagnosis/plan/decision use model semantics where supplied; do not fabricate a final model decision for a deterministic termination. Finalize trial/evaluation/measurement exactly once.

### 5. Durable human escalation and review

- Persist human-attention records for explicit agent escalation and deterministic safety/limit escalation, linked to trial, triggering/latest evidence, available diagnosis and reason. Represent absent model diagnosis/decision honestly.
- Provide public module service operations to list/read attention, acknowledge it and record reviewed notes. State progression is requires-attention → acknowledged → reviewed with trusted timestamps and validated bounded notes. Do not fabricate operator identity; store a supplied identity only under an explicit trusted interface contract.
- Keep attention/review state separate from trial outcome and current health. Acknowledgement or review neither heals the system, approves an action, resumes an agent nor rewrites an unresolved trial as recovered.
- Continue collecting evidence while suppressing autonomous retrials for the unchanged escalated incident. Persist the hold across process restart. Define an evidence-based incident signature, deterministic healthy-state release and handling of genuinely new incident signatures so unrelated incidents are not indefinitely held.
- Fail visibly and safely if durable escalation/suppression storage fails; never silently proceed as if attention was recorded. Preserve healthy observations and historical attention after release.
- This milestone exposes domain service contracts only. HTTP routes, dashboard operations and resumable human approval remain later milestones.

### 6. One reversible unsupported fault

- Add only application-network-isolation as an external controlled-experiment profile, using the smallest additive profile/persistence change needed. Keep the three canonical stopped-container profiles unchanged.
- Preflight the real testbed: application container remains running but the application is unreachable, registered restart actions cannot repair the missing attachment, and only the intended validated network is targeted. Capture the exact attachment and required aliases before mutation; refuse ambiguous/unsafe targets.
- Implement guaranteed bounded restoration, including failure paths, restoring the captured attachment/aliases and verifying the managed environment. Fault injection must not live in recovery tools or expose Docker authority to the agent.
- Add the smallest evidence-based deterministic applicability guard needed to prevent unsuitable restart effects for the demonstrated unsupported condition. Do not use fault labels, expected action sequences or prompting as execution authorization. Preserve all three supported action paths.
- Verify escalation, no unsuitable operational effects, durable attention, unchanged-incident retry suppression and restoration. Use an escalation oracle, not a healing-success oracle; unresolved healing time remains null.
- Use the existing exclusive controlled-run lock and preflight/cleanup conventions. No concurrent controlled runs against the same shared testbed.

### 7. Calibrated bounded workload tooling

- Exercise actual managed-system work-order read routes against a reproducible synthetic fixture; avoid unbounded growth, production/user data, or deleting unrelated records. Record fixture identity/size and a scoped setup/cleanup policy.
- Provide a healthy-system calibration procedure for one fixed non-idle workload. Freeze offered request rate, concurrency cap, timeout, warm-up and observation windows before injecting faults. Record achieved rate so an overloaded generator cannot masquerade as the requested workload.
- Keep bounded traffic running through injection, recovery and the fixed post-recovery window. Export offered/achieved throughput, success/error/timeout counts and latency distributions with explicit window/sample definitions.
- Verify business-route success after recovery in addition to the existing health/container oracle. Database SELECT 1 alone is insufficient application recovery evidence. Do not claim saturation, realistic production traffic or load-generalized resilience from this single workload.

### 8. Measurements, manifests and prepared experiment panels

- Persist raw application-owned accepted-diagnosis and persisted-plan-ready timestamps, including per-step facts. Define first diagnosis-ready as completion of the first accepted diagnosis persistence; first plan-ready as completion of the first accepted plan persistence, whether generated or adopted. Keep separate lookup start/end/latency. Publish a measurement-definition version; do not substitute model request start/end or fabricate older timestamps.
- Export stage timings and retrieval/adoption provenance alongside existing fault-to-detection, first-action, healing/termination, decision/action/safety and oracle metrics. Historical unavailable facts remain null.
- Record every provider request through existing telemetry infrastructure. Separate total provider calls/tokens from recovery-planning calls/tokens and lookup/application overhead; preserve missing usage as null rather than zero.
- Prepare versioned protocols under the established `recovery-experiment-reports/` hierarchy. Do not redefine/overwrite the existing canonical suite or prior campaign outputs. Reuse existing runner/manifest/export patterns instead of creating a generic experiment framework.
- Prepare these panels, without running the full credential-dependent campaign:
  1. Canonical: Baseline, V1, original retrieval-off V2, and improved retrieval-enabled V2 with an empty scoped corpus; three canonical profiles, five repetitions per cell.
  2. Historical reuse: five application-stopped cold/warm pairs, each starting with an isolated empty corpus; warm exposes only its independently verified cold source. Canonical cold observations may be reused only when prospectively scheduled under the identical protocol.
  3. Unsupported boundary: five isolation repetitions evaluating escalation, attention, suppression and restoration, not healed recovery.
  4. Workload: application-stopped idle versus one calibrated non-idle workload, five repetitions per condition, retrieval off in both. Idle reuse requires prospectively identical fixtures, probes and controls.
- Freeze exact revision, implementation/prompt/measurement/protocol versions, model settings, monitoring interval/threshold/cooldown, action/turn limits, settling/stability windows, catalogue/policy fingerprints, corpus/source IDs, fixture/load settings, requested repetitions, seed and run order. Persist run-level frozen membership and provenance, not just a mutable corpus name.
- Keep invalid runs, failures, restoration errors and runtime/oracle disagreements visible. Do not silently retry away failures or replace excluded observations. Label cold-before-warm order/caching and environmental drift as limitations; prepare descriptive paired comparisons, not superiority/significance claims.
- Document exact local commands for setup, unit/integration validation, live smoke, calibration and each prepared panel. The human executes the real campaigns after implementation approval/merge; do not report planned results as observations.

### 9. Focused research and handoff records

- Before runtime changes, create `01-milestone-frame.md` and `02-literature-pass.md` under `/Users/freemancodz/Desktop/Projects/Systems Engineer/dissertation/experiments/work-done/week-15/milestone-9-historical-recovery-reuse-human-escalation-and-workload-evaluation/` using existing standards. Record questions, tool/schema boundaries, matching/eligibility, hold/release policy, timing definitions and experiment protocol decisions.
- Use the scope-freeze literature table as the starting shortlist: Aamodt/Plaza case-based reasoning; Lewis et al. RAG for terminology; existing Cadet incident-retrieval, Huang planning, de Lemos human-awareness, Parasuraman automation, Ashmore assurance and Hsueh fault-injection notes. Read only what resolves this milestone's design/evaluation questions; distinguish existing extraction from new full-paper reading.
- Use the required literature table columns ID, Paper, Role, Relevant To, Key Takeaway, Design Implication, Priority and controlled role values. Official OpenAI guidance supports mechanics, not academic performance/safety claims. Describe structured case reuse honestly rather than claiming dense-document RAG or comprehensive HITL repair.
- Do not write `03-report-draft.md` or dissertation results until implementation and real experiment evidence exist. Preserve the completed V1/V2 evaluation and report.

## Constraints

- Follow repository AGENTS.md, public module barrels, cohesive ownership, strict TypeScript/Zod and established service/repository/factory patterns. Extend real boundaries rather than inventing pass-through frameworks.
- Use additive, migration-tested persistence changes with historical JSON/table compatibility. Preserve existing trials and outputs; no database reset or historical backfill of invented facts.
- Keep OpenAI infrastructure domain-neutral, the composition root declarative and deterministic healthy evidence authoritative. No unrestricted commands, secret values or executable model arguments.
- Never inspect `.env`, `.env.local` or other secret-bearing files. Use documented variable names and non-secret examples; private runtime configuration is a human task.
- No live production systems, unsafe network targets, automatic retries across attention holds or removal of existing safety guarantees.
- Protect submission time. If implementation/live verification is unfinished, state that limitation and retain the verified report version; the submission deadline does not justify false results or weakened checks.

## Explicitly out of scope

- Dashboard/Paper design, UI implementation, HTTP/API exposure and dashboard-triggered commands.
- Packaging/deployment overhaul, cloud deployment or production-grade executor/authentication architecture.
- Embeddings, vector databases, document-ingestion RAG, model training, automatic policy/rule learning.
- New recovery actions, arbitrary manual repair/resume, human approval bypasses, multi-agent orchestration, Agents SDK adoption, generic plugin/workflow infrastructure.
- Additional fault variants or load levels, production traffic/data, human-subject studies.
- Executing the full final benchmark, dissertation-results rewriting or claims of improved performance before observed evidence.
- Unrelated cleanup, renaming established working contracts or rewriting historical milestones.

## Required tests

1. Independent strategy selection, retrieval default off and regression behaviour for Baseline, V1 and original V2, including its unchanged prompt/tool path and eight-turn budget.
2. Diagnosis-before-lookup persistence, current-signal validation and rejection of model-supplied identities/correlations/provenance. Storage failure cannot yield an accepted diagnostic lookup.
3. Deterministic matching and eligible-case publication: combined fault discrimination, target/catalogue/policy incompatibility, incomplete/failed/escalated/unknown/current sources, abandoned plans and controlled-source oracle failure. Empty scoped corpus is a miss without database deletion/history leakage.
4. Adopt-versus-generate paths: stale/foreign candidate rejection, eligibility recheck, exact plan-semantic copying without regeneration, fresh trusted relationships, provenance and no operational execution on rejection.
5. One accepted function call per turn, same-conversation tool outputs and fresh evidence, renewed decisions after unresolved actions, registered tools only, and all operational attempts through ActionService/SafetyService. Historical candidates never authorize actions themselves.
6. Premature completion, explicit/mandatory escalation, provider failure, malformed/unknown/missing/multiple calls, action/attempt/turn exhaustion, last-turn execution protection and exactly-once finalization. Enabled budget twelve; original budget eight.
7. Durable attention for agent and deterministic escalation with/without final model records, valid state transitions/notes/timestamps, no fake healing/approval/resumption, safe persistence failures, restart-surviving unchanged-incident suppression, healthy release and genuine new incidents.
8. Unsupported-profile preflight/refusal, exact attachment/alias restoration on success/failure, bounded cleanup, exclusive-run locking, no fault-label leakage, unsuitable-action rejection and supported-profile regression. Mock tests do not prove real Docker restoration.
9. Bounded workload generation, timeout/concurrency enforcement, scoped reproducible fixture, offered/achieved metrics and distributions, continuous windows and business-route recovery verification; no unrelated data cleanup.
10. Additive migrations, historical record loading, reconstructable diagnosis/plan/decision/action/evidence/provenance, raw timestamp definitions/null compatibility, every-request telemetry and frozen identities/corpus/protocol exports. Exercise database-dependent tests in a disposable configured test database without reading private configuration.
11. Targeted checks first; from `managing-system/`, run `npm run test:types`, `npm test`, `npm run build`, applicable changed-file formatting/lint checks and `git diff --check`. Review the complete diff for unintended scope and sensitive output. State exactly which live checks were not performed.

## Acceptance criteria

- [ ] Focused design/literature records precede runtime implementation and resolve matching, eligibility, hold/release and measurement definitions. (Content PASS; independent chronology NOT VERIFIED. See review.)
- [x] Original strategies remain selectable; original retrieval-off V2 is preserved and enabled V2 has distinct frozen metadata and limits.
- [x] Enabled V2 diagnoses before lookup, chooses adoption/generation, persists fresh correlated records and owns iterative orchestration.
- [x] Only verified compatible source plans enter the scoped corpus; provenance and exact adoption semantics are reconstructable.
- [x] Actions and completion retain deterministic safety, applicability, limits and healthy-state authority; invalid/provider/storage paths fail visibly and safely.
- [x] Human attention/review and evidence-based suppression/release are durable without claiming review heals or authorizes execution.
- [x] One reversible unsupported profile and bounded calibrated workload tooling exist with preflight, restoration, business probes and focused tests.
- [x] Versioned panels/manifests/exports and exact human-run procedures are prepared without altering historical campaign evidence or claiming unexecuted results.
- [x] Additive persistence, relevant regressions, focused checks, complete types/tests/build and diff checks pass.
- [x] No excluded dashboard, deployment, new recovery actions or full benchmark execution is introduced.
- [x] One implementation PR includes the Milestone 8 archival clarification; independent complete exact-head review is posted and required current-head checks pass.
- [x] Stop at `ready_for_human`; no agent merge or auto-merge is performed. Active contract remains ignored and uncommitted.


## Manual tasks

1. Supply existing private local runtime configuration through the approved mechanism. The implementation agent documents exact commands using non-secret examples, never inspects configuration secrets.
2. After implementation handoff, execute supported retrieval-off and isolated cold/warm smoke runs; inspect plan source/provenance, accepted tools, deterministic outcome and telemetry.
3. Execute the unsupported-profile preflight/smoke/restoration and acknowledgement/review check, confirming continued observation and durable suppression/release.
4. Calibrate the single fixed workload and execute a bounded workload smoke. Record real request/business-route evidence and cleanup.
5. Human reviews/merges the one PR. Execute full frozen panels only as a subsequent explicitly approved evidence-collection step; send output paths for analysis. Dashboard design/implementation and local packaging have separate later contracts.

## Manual acceptance criteria

- [ ] Real Docker/OpenAI smoke evidence confirms generated cold and adopted warm plans remain within deterministic execution boundaries; failed verification is reported honestly.
- [ ] Real unsupported isolation safely escalates, creates reviewable attention and restores the validated network/testbed; acknowledgement does not heal or rerun recovery.
- [ ] Healthy workload calibration and a bounded fault smoke produce meaningful achieved-rate/request metrics and verified business-route recovery.

## Completion Record

**Implementation Outcome:** Implemented Milestone 9 in this checkout on `feat/milestone-9-recovery-reuse-and-evaluation`, based on local main including `08ace90`. One PR opened. Lifecycle state: `ready_for_human` after cycle 3. No merge or auto-merge.
**Important Decisions:** Strict structured-exact-v1 retrieval, immutable explicit source membership, conservative source eligibility and lookup-local candidate references. Deterministic 25-row queries skip stale publications within that scope and return at most one eligible case. Shared running-unreachable-hold-v1 applicability; durable attention review grants no execution/release authority. Actual runtime build/model/cadence/limits/versions must match each frozen manifest. Fixed post-verification observation windows exclude persistence delay. Initialization failure uses the common failed finalization. Escalation outcomes are reported separately from healing.
**Contract Deviations:** No scope expansion. Live Docker/OpenAI acceptance, calibration and full campaigns remain unexecuted. A pre-existing experiment-run index naming discrepancy remains unchanged; new additive tables have no schema drift. Research content passes; its pre-implementation chronology was not independently verifiable by the reviewer and remains explicitly NOT VERIFIED.
**Verification Summary:** Cycle 1: 91 unit + 6 integration tests; cycle 2: 94 + 7; cycle 3 final source: 95 + 7. Types/build pass. Final changed-file ESLint, Prettier and diff checks pass, independently confirmed after blank-line formatting corrections. Independent final reviewer reran 18 focused tests, all passed. Disposable PostgreSQL m9verify on loopback port 55439 only, with DOTENV_CONFIG_PATH=/dev/null; no private configuration inspected. Five migrations applied to fresh disposable databases. All five GitHub checks SUCCESS at 47765c88d5465910f2f92b4f2684c55300e3de49: both formatting jobs, managed system, managing system and GitGuardian. CI: https://github.com/Freeman-md/self-healing-backend-ops/actions/runs/35324396725. Working tree clean; active contract ignored/untracked; requested ancestor retained.
**Review Outcome:** Cycle 1 REQUEST_CHANGES at 735899900303c337c6b9b7bda4e40efba986ecfa: three medium findings M9-R1/R2/R3; complete review https://github.com/Freeman-md/self-healing-backend-ops/pull/9#issuecomment-5727151119. Cycle 2 APPROVE at e3da93d3fc06dbd1d50d2cc125e516284801b4d0: https://github.com/Freeman-md/self-healing-backend-ops/pull/9#issuecomment-5727296592. Subsequent automated P2 findings discussion_r4044955659, discussion_r4044955667 and discussion_r4044955673 were fixed with regressions and replied/resolved. Final cycle 3 APPROVE at the current exact head, zero open findings of any severity; complete review posted https://github.com/Freeman-md/self-healing-backend-ops/pull/9#issuecomment-5727364656. The review's publication-pending field describes file creation; full publication and current-head CI gates are now verified by the coordinator.
**Reviewed Head:** 47765c88d5465910f2f92b4f2684c55300e3de49 (APPROVE)
**Pull Request:** https://github.com/Freeman-md/self-healing-backend-ops/pull/9
**Merge Commit:** 9f1b7f684dd3b23493cdaad749ebbe3a15476c5c
**Follow-up Notes:** All manual tasks/acceptance remain PENDING: private runtime configuration and stamped build; retrieval-off and cold/warm Docker/OpenAI smokes; unsupported preflight/restoration and attention acknowledgement/review/suppression/release; healthy workload calibration and bounded fault/business-route smoke. Human review/merge and separately authorized full campaigns remain later actions. Exact procedures: recovery-experiment-reports/m9-panels-v1/README.md. Research frame/literature records reside in the private Systems Engineer week-15 work-done folder; no dissertation report draft/results written. No further implementation cycle or merge is authorized by this handoff.
