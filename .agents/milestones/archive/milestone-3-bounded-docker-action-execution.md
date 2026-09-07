# Milestone 3: Bounded Docker Action Execution

**Status:** Frozen  
**Version:** 1.0.0  
**Last Updated:** 2026-07-24  
**Depends On:** Milestone 2 Service Boundaries and Composition  
**Target Pull Request:** —  
**Target Branch:** `feat/milestone-3-bounded-docker-action-execution`  
**Superseded By:** —

## Goal

Enable the managing system to execute its two approved recovery actions against the local Docker-based managed-system testbed, then perform bounded readiness polling, collect fresh evidence, evaluate the expected outcome and persist the resulting trial evidence.

This milestone proves the controlled end-to-end recovery loop. The direct Docker socket integration is a local dissertation-testbed adapter and must not be represented as the production deployment design.

## Required Flow

```text
Recovery strategy selects Action
-> ActionService evaluates existing SafetyRules
-> ActionService checks the Docker execution switch
-> ActionService resolves an allowlisted handler
-> DockerContainerRuntimeService restarts one fixed target
-> EvidenceService polls managed-system health within a deadline
-> EvidenceService collects health and metrics once
-> EvidenceService normalizes and saves the fresh EvidenceSnapshot
-> ActionService evaluates ExpectedOutcome
-> ActionExecutionResult is returned and persisted
-> TrialService resolves, continues or escalates
```

## Container-Runtime Boundary

Add:

```text
managing-system/src/infrastructure/container-runtime/
├── container-runtime.interface.ts
├── container-runtime.types.ts
├── docker-container-runtime.service.ts
└── index.ts
```

Define in `container-runtime.types.ts`:

```ts
type ContainerRuntimeTarget = "managed-system" | "postgres";

type ContainerRestartResult = {
  target: ContainerRuntimeTarget;
  containerName: string;
  output: string;
};
```

Define in `container-runtime.interface.ts`:

```ts
import type {
  ContainerRestartResult,
  ContainerRuntimeTarget,
} from "./container-runtime.types";

interface IContainerRuntime {
  restartTarget(
    target: ContainerRuntimeTarget,
  ): Promise<ContainerRestartResult>;
}
```

Requirements:

- `DockerContainerRuntimeService` implements `IContainerRuntime`.
- Translate targets through a private fixed map:

  ```text
  managed-system -> managed-system-app
  postgres -> managed-system-postgres
  ```

- Use argument-based `execFile` execution.
- Execute only:

  ```text
  docker restart managed-system-app
  docker restart managed-system-postgres
  ```

- Do not use `exec`, shell interpolation or command strings.
- Do not accept container names, commands or arguments from an `Action`, LLM output, request body or environment variable.
- Reject unsupported targets before starting a process.
- Apply the configured Docker action timeout.
- Terminate a timed-out child process and return a clear execution error.
- Check the Docker execution switch defensively inside the runtime adapter as well as at the action boundary.

## Docker Image and Compose Access

Update `Dockerfile.managing-system`:

```dockerfile
RUN apk add --no-cache docker-cli
```

Update the `managing-system` service in `docker-compose.yml`:

```yaml
environment:
  DOCKER_ACTIONS_ENABLED: "true"
  DOCKER_ACTION_TIMEOUT_MS: "10000"
  POST_ACTION_HEALTH_TIMEOUT_MS: "30000"
  POST_ACTION_HEALTH_POLL_INTERVAL_MS: "1000"

volumes:
  - /var/run/docker.sock:/var/run/docker.sock
  - managing_system_data:/managing-system/data
```

Requirements:

- Retain the existing SQLite data volume.
- Mount the Docker socket only into the managing-system container.
- Do not mount the socket into the managed system or PostgreSQL.
- Do not use privileged container mode.
- Do not expose the Docker socket over TCP.
- Do not modify the current managed-system or PostgreSQL container names.

## Runtime Configuration

Update:

```text
managing-system/.env.example
managing-system/src/config/helpers.ts
managing-system/src/config/index.ts
```

Add:

```ts
actions: {
  dockerEnabled: boolean;
  dockerTimeoutMs: number;
  postActionHealthTimeoutMs: number;
  postActionHealthPollIntervalMs: number;
}
```

Environment variables and defaults:

```text
DOCKER_ACTIONS_ENABLED=false
DOCKER_ACTION_TIMEOUT_MS=10000
POST_ACTION_HEALTH_TIMEOUT_MS=30000
POST_ACTION_HEALTH_POLL_INTERVAL_MS=1000
```

Requirements:

- Add a strict boolean reader that recognizes explicit `true` and `false` values.
- Default Docker action execution to disabled outside the Compose-controlled testbed.
- Require all timeout and interval values to be positive finite numbers.
- Fail configuration validation for explicitly invalid values instead of silently accepting unsafe values.
- Enable Docker actions explicitly in `docker-compose.yml`.

## Action Handler Integration

Update:

```text
managing-system/src/modules/action/action.data.ts
managing-system/src/modules/action/action.repository.ts
managing-system/src/modules/action/action.service.ts
managing-system/src/index.ts
```

Requirements:

- Construct `DockerContainerRuntimeService` in the composition root.
- Inject the `IContainerRuntime` boundary into the action module's handler construction.
- Preserve the existing action IDs and handler keys:

  ```text
  restart_managed_system_service
  restart_postgres_container
  ```

- Map handlers as follows:

  ```text
  restart_managed_system_service
  -> restartTarget("managed-system")

  restart_postgres_container
  -> restartTarget("postgres")
  ```

- Preserve `ActionRepository` as the action catalogue and handler-lookup boundary.
- Preserve `ActionService` as the action execution boundary.
- Do not make `Action` contain executable commands or container names.
- Do not allow an LLM to produce or alter handler definitions.

## Action Execution Guard

`ActionService.executeAction()` must retain this order:

1. Evaluate the action's existing safety rules.
2. Return the existing blocked or escalated result if safety fails.
3. Check whether Docker action execution is enabled.
4. Return a structured blocked result without invoking the handler when disabled.
5. Resolve the allowlisted handler.
6. Execute the handler through `IContainerRuntime`.
7. Wait for bounded managed-system readiness.
8. Collect, normalize and save fresh evidence.
9. Evaluate the action's expected outcome.
10. Return the resulting `ActionExecutionResult`.

When Docker execution is disabled after safety has passed:

- execution status is `blocked`;
- continuation is `blocked`;
- safety status remains `passed`;
- no handler or process is invoked;
- the result clearly states that Docker action execution is disabled.

Preserve:

- one attempt per action per recovery cycle;
- the maximum recovery-action limit;
- existing handler allowlisting;
- existing expected-outcome evaluation;
- existing action-result persistence.

## Bounded Health Stabilization

Add to `EvidenceService`:

```ts
waitForManagedSystemHealth(): Promise<ManagedSystemHealthWaitResult>
```

Define a small result contract containing:

```ts
type ManagedSystemHealthWaitResult = {
  healthy: boolean;
  attempts: number;
  startedAt: string;
  completedAt: string;
  lastStatusCode: number | null;
  lastError: string | null;
};
```

Requirements:

- Poll only `GET /health`.
- Treat the managed system as ready only when:
  - the response is successful; and
  - the parsed body contains `status: "healthy"`.
- Use the configured polling interval and total timeout.
- Do not invoke OpenAI during health polling.
- Do not collect metrics during health polling.
- Do not throw merely because the readiness deadline expires.
- Return `healthy: false` with the final observed status or error when the deadline expires.
- After polling completes or times out, perform exactly one full `collectAndNormalize()` operation.
- Save the resulting evidence snapshot even when the system remains unhealthy.
- Allow expected-outcome evaluation and trial continuation logic to determine the final recovery result.

## Composition Root

Update `managing-system/src/index.ts` to construct and connect:

```text
DockerContainerRuntimeService
-> action handler catalogue
-> ActionRepository
-> ActionService
```

Preserve:

- repository ownership established in Milestone 2;
- service-only cross-module runtime dependencies;
- separate baseline and agent trials;
- existing database lifecycle;
- one-shot managing-system execution for this milestone.

Do not move Docker process execution into `src/index.ts`.

## Automated Tests

Add or update focused tests verifying:

1. Docker execution is disabled by default.
2. Explicit `DOCKER_ACTIONS_ENABLED=true` enables the local adapter.
3. Invalid boolean and timeout configuration fails clearly.
4. `managed-system` maps only to `managed-system-app`.
5. `postgres` maps only to `managed-system-postgres`.
6. Unsupported targets fail before process execution.
7. Docker execution uses `execFile`-style arguments and never a shell command.
8. Docker execution is terminated at the configured timeout.
9. Disabled Docker execution returns a blocked action result without invoking a handler.
10. Existing failed safety checks still stop before the Docker execution switch.
11. Health polling stops immediately when a healthy response is observed.
12. Health polling retries unhealthy and failed responses.
13. Health polling stops at the configured deadline.
14. Health polling does not invoke OpenAI.
15. Action execution performs one final evidence collection after readiness polling.
16. The final evidence snapshot is saved whether readiness succeeds or times out.
17. Existing baseline, agent, safety and trial tests remain green.
18. Type-check and production build pass.

Tests must inject process execution, HTTP behaviour or timing controls. Automated tests must not restart real host containers.

## Controlled Docker Demonstration

The live Docker verification is manual and must not run in GitHub Actions.

### Application-service recovery

```text
1. Build and start the complete Compose environment.
2. Confirm managed-system-app is healthy.
3. Stop managed-system-app.
4. Run the managing-system trial with dependencies bypassed:
   docker compose run --rm --no-deps managing-system
5. Confirm the baseline or agent selects restart_managed_system_service.
6. Confirm the managing system restarts managed-system-app.
7. Confirm bounded health polling observes a healthy state.
8. Confirm fresh evidence is normalized and saved.
9. Confirm ActionExecutionResult and TrialRecord report the final outcome.
```

### PostgreSQL recovery

```text
1. Restore a healthy environment.
2. Stop managed-system-postgres.
3. Run the managing-system trial with dependencies bypassed.
4. Confirm restart_postgres_container is selected and executed.
5. Confirm PostgreSQL and managed-system health recover.
6. Confirm fresh evidence, action result, trial record and evaluation summary are persisted.
```

Record:

- selected recovery mode;
- scenario ID;
- selected action;
- safety decision;
- handler output;
- readiness attempts and elapsed time;
- before and after evidence snapshot IDs;
- expected-outcome result;
- final trial outcome;
- time to recovery or escalation.

## Security Boundary

The implementation must state clearly:

- mounting `/var/run/docker.sock` grants the managing-system container powerful control over the local Docker engine;
- application allowlisting reduces accidental action scope but does not turn direct socket access into a production-safe security boundary;
- this adapter is restricted to the controlled local dissertation testbed;
- production deployment requires replacement with a restricted authenticated executor.

The planned production direction is:

```text
Managing System
-> authenticated restricted executor API
-> allowlisted Docker or Kubernetes operation
-> audited execution result
```

The future executor should provide:

- authentication and authorization;
- least-privilege target access;
- idempotency;
- execution deadlines;
- complete audit records;
- deployment-specific Docker or Kubernetes adapters.

The production executor is explicitly deferred and must not be implemented in this milestone.

## Explicitly Out of Scope

- Continuous monitoring or alert-triggered execution.
- Replacing the one-shot managing-system process.
- Production Docker-socket deployment.
- Restricted executor API implementation.
- Kubernetes integration.
- New actions, handlers, safety rules or incident scenarios.
- Runtime configuration restoration for scenario S3.
- Recovery strategy or LLM prompt changes.
- Database schema or stored JSON changes.
- Managed-system business feature changes.
- Running real Docker recovery actions in CI.

## Acceptance Criteria

- [ ] The managing-system image contains the Docker CLI.
- [ ] The Compose managing-system service receives the Docker socket.
- [ ] Docker actions are disabled by default and explicitly enabled for the local Compose testbed.
- [ ] Only the two fixed recovery targets can be restarted.
- [ ] No arbitrary command, argument or container-name execution is possible through an action or LLM output.
- [ ] Process execution has a bounded timeout.
- [ ] Existing safety evaluation occurs before runtime action execution.
- [ ] Disabled Docker execution produces a structured blocked result.
- [ ] Health polling is deterministic, bounded and LLM-free.
- [ ] Exactly one full evidence collection follows readiness polling.
- [ ] Fresh evidence is persisted for both successful and unsuccessful recovery.
- [ ] Expected-outcome evaluation uses the fresh persisted snapshot.
- [ ] Existing recovery and trial semantics remain intact.
- [ ] Type-check, unit tests, integration tests and production build pass.
- [ ] Application-service recovery succeeds in the controlled Docker demonstration.
- [ ] PostgreSQL recovery succeeds in the controlled Docker demonstration.
- [ ] Trial evidence for both demonstrations is inspected and recorded.
- [ ] The direct Docker socket limitation and production replacement path are documented.
- [ ] GitHub Actions does not execute live Docker recovery trials.
- [ ] Independent review approves the exact pull-request head.
- [ ] Agents do not merge the pull request.

## Validation

Run from `managing-system/`:

```text
npm run test:types
npm test
npm run build
```

Run from the repository root:

```text
docker compose build managing-system
docker compose up -d postgres managed-system
docker compose run --rm --no-deps managing-system
```

Then execute both controlled fault scenarios and inspect the persisted records.

## Workflow Preconditions

- Milestone 2 is frozen and merged.
- The current `main` branch is clean and synchronized with `origin/main`.
- The evidence factory and repository-root CI workflow are already present.
- Create the target branch before implementation.
- Preserve all existing user changes.
- Do not include unrelated refactoring.
