import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ActionRepository,
  type Action,
} from "@/modules/action";
import { createActionHandlers } from "@/modules/action/action.data";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { ActionService } from "@/modules/action/action.service";

const actionHandlerInput = {
  action: {} as Action,
  trialRecordId: "trial-test",
};

test("action repository resolves the predefined action and safety-rule catalogue", () => {
  const repository = new ActionRepository();

  assert.equal(repository.listActions().length, 2);
  assert.equal(repository.listSafetyRules().length, 2);
  assert.equal(
    repository.findActionById("restart_postgres_container")?.handlerKey,
    "restart_postgres_container",
  );
  assert.equal(
    repository.findSafetyRuleById("max_one_attempt_per_cycle")?.id,
    "max_one_attempt_per_cycle",
  );
  assert.equal(
    typeof repository.findActionHandler("restart_postgres_container"),
    "function",
  );
  assert.equal(
    typeof repository.findActionHandler("restart_managed_system_service"),
    "function",
  );
});

test("action handlers restart only their allowlisted Docker targets", async () => {
  const executedProcesses: Array<{ command: string; arguments_: string[] }> = [];
  const handlers = createActionHandlers(async (command, arguments_) => {
    executedProcesses.push({ command, arguments_ });
    return { output: `restarted ${arguments_[1]}` };
  });

  await handlers.restart_postgres_container(actionHandlerInput);
  await handlers.restart_managed_system_service(actionHandlerInput);

  assert.deepEqual(executedProcesses, [
    {
      command: "docker",
      arguments_: ["restart", "managed-system-postgres"],
    },
    {
      command: "docker",
      arguments_: ["restart", "managed-system-app"],
    },
  ]);
});

test("unknown handler keys fail safely without execution", async () => {
  const repository = {
    findActionHandler() {
      return null;
    },
  } as unknown as ActionRepository;
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
