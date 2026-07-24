import assert from "node:assert/strict";
import { test } from "node:test";

import type { ActionExecutionResult } from "@/modules/action";
import { parseStoredTrialRecord, recordActionResultInTrialContext } from "@/modules/trial";

function createResult(status: ActionExecutionResult["status"]): ActionExecutionResult {
  return {
    id: `result-${status}`,
    actionId: `action-${status}`,
    trialRecordId: "trial-test",
    startedAt: "2026-07-24T00:00:00.000Z",
    status,
    safetyCheckStatus: "passed",
    failedSafetyRuleIds: [],
    continuation: status === "failed" ? "failed" : status === "blocked" ? "blocked" : "continue",
  };
}

test("trial accounting preserves result status semantics", () => {
  const context = {
    trialRecordId: "trial-test",
    actionAttemptCounts: {},
    completedActionIds: [],
    evidenceSnapshotIds: [],
    selectedActionIds: [],
    actionExecutionResultIds: [],
    executedActionResultIds: [],
    blockedActionIds: [],
    failedActionIds: [],
  };

  for (const status of ["executed", "blocked", "failed"] as const) {
    const result = createResult(status);
    recordActionResultInTrialContext(context, result.actionId, result);
  }

  assert.deepEqual(context.actionExecutionResultIds, ["result-executed", "result-blocked", "result-failed"]);
  assert.deepEqual(context.executedActionResultIds, ["result-executed"]);
  assert.deepEqual(context.blockedActionIds, ["action-blocked"]);
  assert.deepEqual(context.failedActionIds, ["action-failed"]);
  assert.deepEqual(context.completedActionIds, ["action-executed"]);
});

test("stored historical trial records receive additive defaults", () => {
  const record = parseStoredTrialRecord({
    id: "trial-legacy",
    scenarioId: "legacy",
    recoveryMode: "baseline",
    startedAt: "2026-07-24T00:00:00.000Z",
    evidenceSnapshotIds: [],
    selectedActionIds: [],
    executedActionResultIds: [],
    blockedActionIds: [],
    status: "resolved",
    outcome: "resolved_safely",
    metrics: { actionCount: 0, blockedActionCount: 0 },
  });
  assert.deepEqual(record.actionExecutionResultIds, []);
  assert.deepEqual(record.failedActionIds, []);
  assert.equal(record.metrics.failedActionCount, 0);
});
