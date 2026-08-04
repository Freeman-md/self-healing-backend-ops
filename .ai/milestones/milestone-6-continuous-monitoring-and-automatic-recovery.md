# Milestone 6: Continuous Monitoring and Automatic Recovery Triggering

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-08-04  
**Depends On:** Milestone 5 Managing-System PostgreSQL Control Plane  
**Target Pull Request:** —  
**Target Branch:** `feat/milestone-6-continuous-monitoring`  
**Superseded By:** —

## Goal

Make the managing system a persistent monitor that collects and normalizes real managed-system evidence on a bounded interval, automatically starts the existing recovery path when sustained unhealthy evidence is observed, and records recovery without requiring a predefined incident scenario.

The managing system continues to use one explicitly configured recovery strategy per running instance: `baseline` or `agent`.

## Runtime Modes

Introduce an explicit managing-system run mode:

```text
controlled
monitor
```

### Controlled mode

Controlled mode preserves the existing experiment workflow:

- requires `RECOVERY_MODE=baseline|agent`;
- requires `SCENARIO_ID=S1|S2|S3`;
- executes one trial and exits;
- remains the only mode that records a predefined scenario ID.

### Monitor mode

Monitor mode is the normal autonomous runtime:

- requires `RECOVERY_MODE=baseline|agent`;
- rejects or ignores `SCENARIO_ID`; an incident must be inferred from collected evidence;
- remains running until explicitly stopped;
- records routine evidence snapshots;
- starts recovery only after the configured sustained-unhealthy threshold is reached;
- creates monitor-triggered trial records with no scenario ID.

Do not run baseline and agent strategies simultaneously in one monitor instance. Comparative evaluation remains a controlled experiment, with one mode per isolated run.

## Required Behaviour

### Monitoring loop

- Add a cohesive monitoring service that owns the sequential evidence-collection loop.
- Reuse the existing `EvidenceService` to collect raw evidence, normalize it and persist the resulting snapshot.
- Run each collection cycle only after the preceding cycle finishes; never overlap evidence collection or recovery execution.
- Use configurable, validated values for monitoring interval, consecutive-unhealthy threshold and post-recovery cooldown.
- Treat `healthy` evidence as observation only.
- Treat `unknown` evidence as observation only; unknown evidence must not autonomously execute a recovery action.
- Trigger recovery only when `unhealthy` evidence reaches the configured consecutive threshold.
- Catch and log collection or recovery errors so one failed cycle does not terminate the monitor process.
- Support graceful shutdown by stopping future cycles and closing infrastructure resources once.

### Automatic recovery trigger

- Invoke the existing `TrialService` when monitoring detects a qualifying unhealthy state.
- Pass the current persisted evidence snapshot and configured recovery mode to the trial service.
- Do not pass or fabricate a scenario ID for monitor-triggered recovery.
- Preserve the existing baseline/agent strategy selection, shared action executor, safety gate, action limits, reassessment and evaluation flow.
- Prevent concurrent recovery trials in the same monitor instance.
- Apply a bounded cooldown after any resolved, failed, blocked or escalated recovery result to prevent repeated action loops against the same ongoing outage.
- Continue collecting evidence during cooldown but do not start another recovery trial until cooldown expires.

### Trial persistence semantics

- Extend trial persistence so controlled scenario trials and monitor-triggered recovery trials are distinguishable.
- Preserve `scenarioId` for controlled records and make it absent for monitor-triggered records.
- Persist an explicit trigger source such as `controlled` or `monitor`; do not infer this solely from a nullable scenario field.
- Preserve current PostgreSQL-backed trial, decision, diagnosis, plan, action-result and evaluation relationships.
- Apply a Prisma migration that preserves existing controlled trial records from Milestone 5.

### Docker composition and configuration

- Configure the normal Compose managing-system service to run in monitor mode.
- Remove the managing system's Compose dependency on a healthy managed-system application. The controller must be able to start and observe the target when the target is unavailable.
- Retain the dependency on healthy `managing-system-postgres`.
- Preserve controlled trial invocation through `docker compose run --rm --no-deps` with explicit controlled mode, recovery mode and scenario ID.
- Do not introduce new Docker action targets, arbitrary command execution, or changes to the managed system.

## Constraints

- Keep monitoring, evidence collection, recovery orchestration and action execution as separate responsibilities.
- Reuse existing module public APIs and service boundaries; do not inject repositories across modules.
- Keep `src/index.ts` as composition root only.
- Do not read, print, commit or modify `.env` or `.env.local` files.
- Preserve centralized safety enforcement at the action-execution boundary.
- Keep monitoring execution bounded: one collection cycle and at most one recovery trial at a time.
- Use clear operational logs for monitor started, snapshot observed, recovery triggered, recovery suppressed during cooldown and monitor stopped.
- Add an automated regression test only when implementation exposes an observed defect, a fragile failure path, or a concrete regression risk. Do not add speculative coverage.

## Explicitly Out of Scope

- Concurrent baseline and agent monitoring in one process.
- Automatic baseline-rule learning, mutation or promotion of agent plans.
- Alert-manager, webhook, message-queue or external scheduler integration.
- New fault scenarios, new recovery actions or new action handlers.
- Planner function/tool calling changes.
- Distributed coordination, leader election or multi-instance recovery locking.
- PostgreSQL high availability, remote deployment or production executor-service hardening.
- Comparative performance claims based on a single autonomous run.

## Validation Approach

1. Verify directly that monitor mode starts against a healthy managed system, stores evidence and does not execute a recovery action.
2. Verify directly that stopping `managed-system-app` causes sustained unhealthy evidence, one recovery trigger and a successful bounded restart when the configured mode supports S1.
3. Verify that the managing system continues running after recovery and resumes monitoring rather than exiting.
4. Verify that a repeated unhealthy observation during an active recovery or cooldown does not start a duplicate trial.
5. Verify controlled mode still requires a scenario ID and preserves the existing one-shot trial behaviour.
6. Run existing relevant persistence, safety, Docker and recovery checks. Add an automated regression test only for a defect or concrete regression risk discovered during implementation.

## Acceptance Criteria

Include only criteria the implementation and review agents can verify from repository evidence, automated tests, CI or accessible runtime behaviour.

- [ ] The managing system supports distinct `controlled` and `monitor` runtime modes.
- [ ] Monitor mode requires a recovery mode but does not require or persist a scenario ID.
- [ ] Controlled mode retains explicit recovery-mode and scenario-ID requirements.
- [ ] Monitor-triggered trial records have a distinct persisted trigger source and preserve all existing recovery relationships.
- [ ] Healthy and unknown evidence do not autonomously execute actions.
- [ ] Sustained unhealthy evidence triggers one bounded recovery trial using the configured strategy.
- [ ] Active recovery and cooldown prevent duplicate recovery execution while monitoring continues.
- [ ] The managing system can start while the managed-system application is unavailable.
- [ ] The managing system continues monitoring after a resolved, failed, blocked or escalated recovery result.
- [ ] Existing safety, action-execution, PostgreSQL persistence and controlled-trial behaviour remains intact.
- [ ] Fresh PostgreSQL migration, applicable direct Docker verification and existing relevant validation checks pass.
- [ ] Any added automated regression test is tied to an observed defect or concrete regression risk.
- [ ] The complete independent review is posted to the pull request.
- [ ] The pull request is not merged by an agent.

## Manual Tasks

1. Configure the normal Compose managing-system service with `monitor` mode and exactly one recovery mode through the existing local environment mechanism.
2. Start the full Docker Compose environment, wait for healthy monitoring observations, then stop `managed-system-app` once.
3. Observe that the managing system detects the disruption, performs one bounded recovery, records the result in `managing-system-postgres`, and remains running after recovery.
4. Repeat the demonstration in the other recovery mode only after resetting the environment and starting a separate monitor instance.

## Manual Acceptance Criteria

These are confirmed by the human after the workflow reaches `ready_for_human`. They do not block the agent workflow from reaching that state.

- [ ] An already-running managing system autonomously detects and recovers the S1 application-stop fault without a manually invoked controlled trial command.
- [ ] The controller remains operational and continues monitoring after recovery, with monitor-triggered records stored independently of controlled experiment records.
