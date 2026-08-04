import assert from "node:assert/strict";
import { test } from "node:test";

import { ZodError } from "zod/v4";

import type { IContainerRuntime } from "@/infrastructure/container-runtime";
import {
  ActionHandlerRegistry,
  ActionRepository,
  ActionService,
  type Action,
  type OutcomeCheckType,
} from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { createPrismaTestDatabase } from "../../helpers/prisma-test-database";

const actionHandlerInput = {
  action: {} as Action,
  trialRecordId: "trial-test",
};

const outcomeCriterionParameterCases = [
  {
    checkType: "health_status_is",
    validParameters: { expectedState: "healthy" },
    malformedParameters: { expectedState: 42 },
  },
  {
    checkType: "endpoint_returns_status",
    validParameters: { endpoint: "/health", expectedStatus: 200 },
    malformedParameters: { endpoint: "/health", expectedStatus: "200" },
  },
  {
    checkType: "metric_below_threshold",
    validParameters: { metric: "latency_ms", threshold: 500 },
    malformedParameters: { metric: "latency_ms", threshold: "500" },
  },
  {
    checkType: "container_running",
    validParameters: { container: "managed-system" },
    malformedParameters: { container: 42 },
  },
  {
    checkType: "file_exists",
    validParameters: { path: "/tmp/readiness" },
    malformedParameters: { path: 42 },
  },
  {
    checkType: "action_completed",
    validParameters: { actionId: "restart_postgres_container" },
    malformedParameters: { actionId: 42 },
  },
] satisfies Array<{
  checkType: OutcomeCheckType;
  validParameters: Record<string, unknown>;
  malformedParameters: Record<string, unknown>;
}>;

test("action repository resolves the seeded action and ordered safety catalogue", async () => {
  const testDatabase = await createPrismaTestDatabase({ seed: true });

  try {
    const repository = new ActionRepository(testDatabase.prisma);
    const actions = await repository.listActions();
    const safetyRules = await repository.listSafetyRules();

    assert.equal(actions.length, 2);
    assert.equal(safetyRules.length, 2);
    assert.equal(
      (await repository.findActionById("restart_postgres_container"))
        ?.handlerKey,
      "restart_postgres_container",
    );
    assert.equal(
      (await repository.findSafetyRuleById("max_one_attempt_per_cycle"))?.id,
      "max_one_attempt_per_cycle",
    );
    assert.deepEqual(actions[0]?.safetyRuleIds, [
      "allow_only_when_system_not_healthy",
      "max_one_attempt_per_cycle",
    ]);
  } finally {
    await testDatabase.close();
  }
});

for (const parameterCase of outcomeCriterionParameterCases) {
  test(`action repository validates ${parameterCase.checkType} outcome parameters`, async () => {
    const testDatabase = await createPrismaTestDatabase({ seed: true });
    const repository = new ActionRepository(testDatabase.prisma);

    try {
      await testDatabase.prisma.outcomeCriterion.update({
        where: { id: "health_ready_after_postgres_restart" },
        data: {
          checkType: parameterCase.checkType,
          parameters: parameterCase.validParameters,
        },
      });

      const action = await repository.findActionById(
        "restart_postgres_container",
      );
      assert.deepEqual(
        action?.expectedOutcome.successCriteria[0]?.params,
        parameterCase.validParameters,
      );

      await testDatabase.prisma.outcomeCriterion.update({
        where: { id: "health_ready_after_postgres_restart" },
        data: { parameters: parameterCase.malformedParameters },
      });

      await assert.rejects(
        repository.findActionById("restart_postgres_container"),
        (error: unknown) => error instanceof ZodError,
      );
    } finally {
      await testDatabase.close();
    }
  });
}

test("action handlers use only their allowlisted runtime targets", async () => {
  const runtimeTargets: string[] = [];
  const registry = new ActionHandlerRegistry({
    async restartTarget(target) {
      runtimeTargets.push(target);
      return {
        target,
        containerName: target,
        output: `restarted ${target}`,
      };
    },
  } satisfies IContainerRuntime);

  await registry
    .findActionHandler("restart_postgres_container")
    ?.(actionHandlerInput);
  await registry
    .findActionHandler("restart_managed_system_service")
    ?.(actionHandlerInput);

  assert.deepEqual(runtimeTargets, ["postgres", "managed-system"]);
});

test("unknown handler keys fail safely without execution", async () => {
  const repository = {} as ActionRepository;
  const safetyService = {
    evaluateActionSafety() {
      return {
        status: "allowed" as const,
        failedRuleIds: [],
      };
    },
  };
  const service = new ActionService(
    repository,
    safetyService as never,
    {} as never,
    undefined,
    undefined,
    true,
  );
  const snapshot = {
    id: "snapshot-test",
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState: "unhealthy",
    summary: "unhealthy",
    signals: [],
    suspectedIncidentTypes: [],
    contradictions: [],
  } satisfies EvidenceSnapshot;

  const result = await service.executeAction(
    {
      id: "unknown-action",
      name: "Unknown action",
      description: "test action",
      handlerKey: "unknown_handler",
      riskLevel: "medium",
      safetyRuleIds: [],
      expectedOutcome: { description: "none", successCriteria: [] },
    },
    snapshot,
    { trialRecordId: "trial-test" },
  );

  assert.equal(result.status, "failed");
  assert.equal(result.continuation, "failed");
  assert.match(result.error ?? "", /No action handler is registered/);
});
