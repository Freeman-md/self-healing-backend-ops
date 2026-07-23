import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ActionRepository,
  type ActionExecutionResult,
} from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import {
  RecoveryBaselineStrategy,
  type RecoveryDecision,
  type RecoveryStrategy,
} from "@/modules/recovery";
import { TrialService } from "@/modules/trial";

function createSnapshot(
  id: string,
  overallState: EvidenceSnapshot["overallState"],
  incidentTypes: string[] = [],
): EvidenceSnapshot {
  return {
    id,
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState,
    summary: overallState,
    signals:
      overallState === "degraded" || overallState === "unhealthy"
        ? [
            {
              source: "health",
              name: "database_connectivity",
              status: "critical",
              value: false,
              description: "Database connectivity failed.",
            },
          ]
        : [],
    suspectedIncidentTypes: incidentTypes,
    contradictions: [],
  };
}

function createDecision(input: {
  snapshot: EvidenceSnapshot;
  actionIds: string[];
  fallbackActionIds?: string[];
}): RecoveryDecision {
  return {
    mode: "baseline",
    snapshotId: input.snapshot.id,
    decidedAt: new Date().toISOString(),
    status: input.actionIds.length > 0 ? "action_selected" : "no_action",
    reason: "test decision",
    diagnosisResult: {
      id: "diagnosis-test",
      evidenceSnapshotId: input.snapshot.id,
      createdAt: new Date().toISOString(),
      method: "deterministic",
      sourceIds: ["test-rule"],
      suspectedIncidentType: "test_incident",
      severity: "high",
      confidence: null,
      reasoningSummary: "test",
      supportingSignals: [],
      contradictions: [],
    },
    recoveryPlan: {
      id: "recovery-plan-test",
      diagnosisResultId: "diagnosis-test",
      createdAt: new Date().toISOString(),
      proposedActionIds: input.actionIds,
      rationale: "test",
      expectedOutcome: "healthy",
      fallbackActionIds: input.fallbackActionIds ?? [],
      escalationReason: null,
    },
  };
}

function createResult(input: {
  id: string;
  trialRecordId: string;
  actionId: string;
  afterSnapshotId: string;
  continuation: ActionExecutionResult["continuation"];
}): ActionExecutionResult {
  return {
    id: input.id,
    actionId: input.actionId,
    trialRecordId: input.trialRecordId,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "executed",
    safetyCheckStatus: "passed",
    failedSafetyRuleIds: [],
    beforeEvidenceSnapshotId: "snapshot-unhealthy",
    afterEvidenceSnapshotId: input.afterSnapshotId,
    expectedOutcomeMet: input.continuation === "resolved",
    outcomeSummary: input.continuation,
    continuation: input.continuation,
  };
}

test("baseline produces deterministic diagnosis and ordered recovery plan", async () => {
  const engine = new RecoveryBaselineStrategy();
  const snapshot = createSnapshot(
    "snapshot-database-failure",
    "unhealthy",
    ["database_connectivity_failure"],
  );

  const decision = await engine.decide(snapshot, {
    actionAttemptCounts: {},
    completedActionIds: [],
  });

  assert.equal(decision.status, "action_selected");
  assert.equal(decision.diagnosisResult.method, "deterministic");
  assert.deepEqual(decision.diagnosisResult.sourceIds, [
    "database_connectivity_failure",
  ]);
  assert.equal(decision.diagnosisResult.confidence, null);
  assert.deepEqual(decision.recoveryPlan.proposedActionIds, [
    "restart_postgres_container",
  ]);
});

test("baseline returns no action for healthy evidence", async () => {
  const engine = new RecoveryBaselineStrategy();
  const decision = await engine.decide(createSnapshot("snapshot-healthy", "healthy"), {
    actionAttemptCounts: {},
    completedActionIds: [],
  });

  assert.equal(decision.status, "no_action");
  assert.deepEqual(decision.recoveryPlan.proposedActionIds, []);
});

test("baseline escalates when no deterministic rule matches", async () => {
  const engine = new RecoveryBaselineStrategy();
  const decision = await engine.decide(
    createSnapshot("snapshot-unknown", "unknown", ["unusual_incident"]),
    {
      actionAttemptCounts: {},
      completedActionIds: [],
    },
  );

  assert.equal(decision.status, "escalate");
  assert.deepEqual(decision.recoveryPlan.proposedActionIds, []);
  assert.equal(decision.diagnosisResult.method, "deterministic");
});

test("trial runner executes proposed then fallback action with reassessment", async () => {
  const initialSnapshot = createSnapshot(
    "snapshot-unhealthy",
    "unhealthy",
    ["database_connectivity_failure"],
  );
  const intermediateSnapshot = createSnapshot("snapshot-degraded", "degraded");
  const healthySnapshot = createSnapshot("snapshot-recovered", "healthy");
  const strategy: RecoveryStrategy = {
    mode: "baseline",
    async decide(snapshot) {
      return createDecision({
        snapshot,
        actionIds: ["restart_postgres_container"],
        fallbackActionIds: ["restart_managed_system_service"],
      });
    },
  };
  const executedActionIds: string[] = [];
  const savedResults: ActionExecutionResult[] = [];
  const snapshots = new Map([
    [intermediateSnapshot.id, intermediateSnapshot],
    [healthySnapshot.id, healthySnapshot],
  ]);
  let executionCount = 0;

  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    new ActionRepository(),
    {
      async executeAction(action, _snapshot, context) {
        executedActionIds.push(action.id);
        executionCount += 1;

        return createResult({
          id: "result-" + executionCount,
          trialRecordId: context.trialRecordId,
          actionId: action.id,
          afterSnapshotId:
            executionCount === 1
              ? intermediateSnapshot.id
              : healthySnapshot.id,
          continuation: executionCount === 1 ? "continue" : "resolved",
        });
      },
    },
    {
      findEvidenceSnapshotById(id) {
        return snapshots.get(id) ?? null;
      },
    },
    {
      saveActionExecutionResult(result) {
        savedResults.push(result);
        return result;
      },
    },
    3,
  );

  const result = await runner.runRecoveryTrial({
    mode: "baseline",
    scenarioId: "test-scenario",
    snapshot: initialSnapshot,
  });

  assert.deepEqual(executedActionIds, [
    "restart_postgres_container",
    "restart_managed_system_service",
  ]);
  assert.equal(savedResults.length, 2);
  assert.equal(result.trialRecord.status, "resolved");
  assert.equal(result.trialRecord.finalEvidenceSnapshotId, healthySnapshot.id);
  assert.deepEqual(result.trialRecord.evidenceSnapshotIds, [
    initialSnapshot.id,
    intermediateSnapshot.id,
    healthySnapshot.id,
  ]);
});

test("trial runner escalates when the action limit is reached", async () => {
  const initialSnapshot = createSnapshot("snapshot-unhealthy", "unhealthy");
  const nextSnapshot = createSnapshot("snapshot-still-unhealthy", "unhealthy");
  const strategy: RecoveryStrategy = {
    mode: "baseline",
    async decide(snapshot) {
      return createDecision({
        snapshot,
        actionIds: ["restart_managed_system_service"],
      });
    },
  };

  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    new ActionRepository(),
    {
      async executeAction(action, _snapshot, context) {
        return createResult({
          id: "result-limit",
          trialRecordId: context.trialRecordId,
          actionId: action.id,
          afterSnapshotId: nextSnapshot.id,
          continuation: "continue",
        });
      },
    },
    {
      findEvidenceSnapshotById() {
        return nextSnapshot;
      },
    },
    {
      saveActionExecutionResult(result) {
        return result;
      },
    },
    1,
  );

  const result = await runner.runRecoveryTrial({
    mode: "baseline",
    scenarioId: "limit-scenario",
    snapshot: initialSnapshot,
  });

  assert.equal(result.trialRecord.status, "escalated");
  assert.equal(
    result.trialRecord.escalationReason,
    "Maximum recovery action limit reached.",
  );
});

test("trial runner fails before execution for an unregistered action", async () => {
  const initialSnapshot = createSnapshot("snapshot-unhealthy", "unhealthy");
  const strategy: RecoveryStrategy = {
    mode: "baseline",
    async decide(snapshot) {
      return createDecision({
        snapshot,
        actionIds: ["unregistered_action"],
      });
    },
  };
  let executionCalled = false;

  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    new ActionRepository(),
    {
      async executeAction() {
        executionCalled = true;
        throw new Error("executor should not be called");
      },
    },
    {
      findEvidenceSnapshotById() {
        return null;
      },
    },
    {
      saveActionExecutionResult(result) {
        return result;
      },
    },
  );

  const result = await runner.runRecoveryTrial({
    mode: "baseline",
    scenarioId: "invalid-action-scenario",
    snapshot: initialSnapshot,
  });

  assert.equal(executionCalled, false);
  assert.equal(result.trialRecord.status, "failed");
  assert.match(result.trialRecord.notes ?? "", /unregistered action/);
});
