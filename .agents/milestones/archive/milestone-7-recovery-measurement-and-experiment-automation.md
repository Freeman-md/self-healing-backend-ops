# Milestone 7: Recovery Measurement and Reproducible Experiment Automation

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-09-07  
**Depends On:** Milestone 6 Continuous Monitoring and Automatic Recovery Triggering  
**Target Pull Request:** —  
**Target Branch:** `feat/milestone-7-recovery-measurement`  
**Superseded By:** —

## Goal

Establish a versioned, reproducible measurement layer around the continuously monitoring managing system. Capture the complete observable recovery timeline, independently verify recovery outcomes, automate repeated controlled fault-injection runs, and export defensible experiment evidence before the agent planning architecture changes.

The normal runtime remains evidence-led. Fault-profile labels and expected results belong only to external experiment infrastructure and must never be passed to normalization, diagnosis, planning, safety evaluation or action execution.

## Measurement Semantics

Keep `TrialRecord` as the universal recovery episode. Do not create a second runtime scenario or episode abstraction.

Persist raw timeline facts and a measurement-definition version:

- first unhealthy observation time and snapshot;
- recovery trigger time;
- first action start time;
- deterministic recovery verification time;
- trial completion or escalation time.

Derive universal measures from persisted facts:

- unhealthy-confirmation delay;
- trigger-to-first-action time;
- recovery-loop duration;
- observed healing time from first unhealthy evidence;
- decision and replan count;
- total, executed, blocked and failed action counts;
- automatic resolution or escalation;
- safety outcome;
- model-call count, latency and token usage.

Controlled-run-only measures are:

- fault-to-detection time;
- end-to-end time to heal from injection to verified health;
- diagnosis correctness;
- action-sequence correctness and unnecessary-action count;
- runtime outcome versus deterministic oracle outcome;
- post-recovery stability result.

Unknown, unavailable or inapplicable timestamps and judgments remain null. Never infer an unknown fault-start time from the first observation.

Preserve the existing `timeToRecoveryMs` field and historical values. Document it as the current trial-loop duration; new analysis must prefer the explicitly named Milestone 7 measures.

## Runtime Integrity

- Derive the monitor recovery trigger from deterministic evidence signals and canonical incident codes.
- Apply the same deterministic healthy-state interpretation before baseline decision logic short-circuits.
- Apply deterministic evidence state to evidence-state safety rules so descriptive model output cannot permit or suppress an action.
- Keep LLM-produced `overallState` as descriptive output only.
- Preserve `unknown` evidence without autonomously executing recovery.
- Keep the LLM outcome evaluator in the runtime loop, but do not use it as the primary controlled-experiment oracle.
- Do not change bounded action execution, centralized safety enforcement, action limits or recovery strategy selection.

## Persistence

Add normalized Prisma persistence for:

1. versioned recovery measurement facts linked one-to-one with `TrialRecord`;
2. model invocations linked where possible to a trial, evidence snapshot, recovery decision or action result;
3. `ExperimentBatch` records that freeze source and configuration provenance;
4. `ExperimentRun` records that contain the external fault profile, mode, repetition, validity, linked trial and oracle result.

An experiment batch must freeze at least:

- source revision;
- measurement version;
- recovery mode set;
- model and prompt version;
- baseline-rule and action-catalogue versions;
- monitoring interval, unhealthy threshold and cooldown;
- pre-fault settlement duration used to clear the monitor cooldown between repetitions;
- maximum recovery steps;
- fault-profile list;
- requested repetition count;
- run-order seed.

Historical `scenarioId` remains nullable for compatibility. New monitor-based experiment runs do not set it.

Use explicit fields for measurements that must be queried and compared. Do not add a generic entity-attribute-value metrics table. Persist raw facts and derive durations and aggregates.

## Model Invocation Telemetry

Record:

- operation type: evidence normalization, diagnosis, recovery planning or outcome evaluation;
- configured model;
- start and completion timestamps;
- duration;
- input, output and total tokens when returned by the provider;
- success or failure and concise error metadata;
- available trial and domain-entity correlation IDs.

Do not store prompts, API credentials or full model responses in telemetry.

Infrastructure must not import feature modules. The OpenAI infrastructure service may emit telemetry through an injected interface, while persistence remains owned by the measurement service and repository.

## Deterministic Recovery Oracle

Controlled recovery succeeds only when all required checks pass:

- `GET /health` is reachable and reports healthy application and database checks;
- `GET /metrics` is reachable;
- the managed-system application container is running;
- the managed-system PostgreSQL container is running;
- the same conditions remain true for the configured bounded stability window.

Store the runtime outcome and oracle outcome independently. A disagreement must remain visible in exports and must not be silently reconciled.

## Automated Experiment Runner

Add an external operational runner that uses the normal continuously running monitor. It must not invoke controlled recovery mode.

For each run it will:

1. create an experiment-run record and acquire the one-active-run lock;
2. verify and, if required, restore a healthy starting state;
3. wait through the frozen pre-fault settlement period so the previous cooldown cannot contaminate the next repetition;
4. persist the injection boundary immediately before injecting one allowlisted controlled fault;
5. wait for the managing system to detect and recover from evidence;
6. query for the unique monitor-triggered trial created after injection;
7. link that trial to the run after execution;
8. reject zero or multiple matching trials as invalid;
9. run deterministic recovery and stability verification;
10. restore and verify the healthy environment before the next repetition.

Initial fault profiles:

- `managed_system_application_stopped`;
- `managed_system_postgres_stopped`;
- `managed_system_application_and_postgres_stopped`.

Fault profiles are code-owned allowlisted injectors. Persisted data cannot supply Docker commands, container names or executable logic. Recovery receives observed evidence only, never the profile code, expected incident code or expected action sequence.

Run modes may be grouped into separate batches or batch phases because one monitor process uses one recovery mode. The monitor may be restarted when switching mode, but it must remain running across repetitions within the same mode.

## Outputs and Analysis

Provide explicit commands to run a configurable pilot or batch and export:

- one raw CSV dataset;
- one complete JSON package;
- one Markdown summary.

Summaries must include:

- total, valid, invalid and excluded runs;
- verified recovery-success and automatic-resolution rates;
- runtime/oracle disagreement count;
- mean, median, standard deviation, interquartile range, minimum and maximum for applicable timing measures;
- decision, action, blocked and failed counts;
- controlled diagnosis and action-sequence correctness;
- model-call latency and token totals.

Failed and escalated runs remain in outcome-rate denominators but receive no fabricated recovery duration. Report their time to termination separately.

Pilot repetitions validate instrumentation only. The final experiment repetition count and any inferential analysis remain deferred until the campaign design is frozen.

## Constraints

- Follow the repository's clean-code, SOLID, naming and service-boundary rules.
- Repositories remain private to their owning services.
- `src/index.ts` remains the composition root.
- Preserve PostgreSQL and Prisma as the managing-system persistence layer.
- Preserve current evidence, recovery, action, safety, trial and evaluation relationships.
- Keep normal monitoring independent from experiment labels.
- Do not read, print, modify or commit `.env` or `.env.local` files.
- Do not add speculative abstractions, generic metric stores or duplicate model types.
- Add automated regression coverage only for new arithmetic, correlation and outcome-integrity failure risks.

## Explicitly Out Of Scope

- Agent tool/function calling or OpenAI Agents SDK integration.
- Retrieval-augmented generation, recovery memory or automatic learning.
- Automatic baseline-rule mutation.
- A managed-system workload generator or HTTP response-time comparison.
- Resource-overhead or availability-percentage claims.
- Production distributed experiment coordination.
- New production recovery actions.
- Statistical superiority claims from pilot runs.

## Validation Approach

1. Verify deterministic evidence rather than `overallState` controls monitor triggering and baseline healthy-state handling.
2. Verify universal timeline fields for a monitor-triggered run and null controlled-only fields for an ordinary run.
3. Verify model telemetry records successful and failed calls without storing prompts or responses.
4. Verify an experiment run links exactly one post-injection monitor trial and rejects ambiguous matches.
5. Verify runtime/oracle disagreement remains recorded.
6. Verify failed and escalated runs are excluded from recovery-duration aggregates but retained in outcome rates.
7. Run an automated Docker pilot for both recovery modes and at least two repetitions without restarting the monitor between same-mode repetitions.
8. Run existing relevant type, build, persistence, monitoring, safety and recovery checks.

## Acceptance Criteria

- [ ] `TrialRecord` remains the universal recovery episode.
- [ ] Normal monitor mode requires no scenario or fault-profile label.
- [ ] Deterministic evidence governs monitoring and baseline healthy-state decisions.
- [ ] Descriptive `overallState` cannot independently allow or block an action safety decision.
- [ ] Raw measurement timestamps and a measurement version are persisted.
- [ ] Universal and controlled-only metrics follow the documented null semantics.
- [ ] OpenAI telemetry records operation, latency, usage and status without prompt or response storage.
- [ ] Experiment batches freeze relevant source and configuration provenance.
- [ ] Experiment runs use post-run linkage and reject ambiguous trial matches.
- [ ] Controlled recovery is independently verified through deterministic health and stability checks.
- [ ] Fault injectors are allowlisted and cannot be supplied from persisted data.
- [ ] CSV, JSON and Markdown outputs are generated from persisted facts.
- [ ] Failed and escalated runs remain in rates without fabricated recovery durations.
- [ ] Existing recovery, safety, monitoring and persistence behaviour remains intact.
- [ ] Focused regression checks and repository validation commands pass.
- [ ] Independent review is posted to the pull request.
- [ ] The pull request is not merged by an agent.

## Manual Tasks

1. Supply the existing local OpenAI and managing-system PostgreSQL credentials through the approved environment mechanism.
2. Run the Docker pilot with one recovery mode at a time.
3. Confirm that the generated evidence package agrees with the PostgreSQL records and observed container recovery.

## Manual Acceptance Criteria

- [ ] Repeated same-mode faults are detected and recovered while the same managing-system monitor remains active.
- [ ] Baseline and agent pilot batches produce queryable run, timeline, action, decision, oracle and model-usage evidence.
- [ ] Pilot exports contain enough information to reconstruct each run without relying on terminal output.
