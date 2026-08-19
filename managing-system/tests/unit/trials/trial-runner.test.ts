import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type Action,
  type ActionExecutionResult,
} from "@/modules/action";
import type { EvidenceSnapshot } from "@/modules/evidence";
import {
  RecoveryBaselineStrategy,
  findMatchingBaselineRule,
  type BaselineRule,
  type RecoveryDecision,
  type RecoveryStrategy,
} from "@/modules/recovery";
import { TrialService, type TrialRecord } from "@/modules/trial";

const baselineRules: BaselineRule[] = [{
  id: "database_connectivity_failure",
  description: "database first",
  incidentType: "database_connectivity_failure",
  severity: "high",
  expectedOutcome: "healthy",
  priority: 100,
  version: 1,
  proposedActionIds: ["restart_postgres_container"],
  fallbackActionIds: [],
  conditionGroups: [{
    matchMode: "ANY",
    conditions: [{
      signalCode: "database_connectivity",
      operator: "EQUALS",
      expectedStatus: "critical",
    }],
  }],
}];

const baselineRuleSource = {
  async findMatchingBaselineRule(snapshot: EvidenceSnapshot) {
    return findMatchingBaselineRule(snapshot, baselineRules);
  },
};

function createSnapshot(
  id: string,
  overallState: EvidenceSnapshot["overallState"],
  incidentTypes: EvidenceSnapshot["suspectedIncidentTypes"] = [],
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
              code: "database_connectivity",
              status: "critical",
              value: false,
              description: "Database connectivity failed.",
              method: "deterministic",
            },
          ]
        : overallState === "healthy"
          ? [
              {
                source: "health",
                name: "managed_system_health",
                code: "managed_system_health",
                status: "normal",
                value: true,
                description: "Managed system health check passed.",
                method: "deterministic",
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
    id: `recovery-decision-${input.snapshot.id}`,
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

function createAction(id: string): Action {
  return {
    id,
    name: id,
    description: "Test action.",
    handlerKey: id,
    riskLevel: "low",
    safetyRuleIds: [],
    expectedOutcome: {
      description: "Test outcome.",
      successCriteria: [],
    },
  };
}

function createRecoveryService() {
  const history = new Map<string, RecoveryDecision[]>();
  return {
    recordRecoveryDecision(input: { trialRecordId: string; recoveryDecision: RecoveryDecision }) {
      const decisions = history.get(input.trialRecordId) ?? [];
      decisions.push(input.recoveryDecision);
      history.set(input.trialRecordId, decisions);
      return input.recoveryDecision;
    },
    findRecoveryDecisionHistory(trialRecordId: string) {
      return history.get(trialRecordId) ?? [];
    },
  };
}

test("baseline produces deterministic diagnosis and ordered recovery plan", async () => {
  const engine = new RecoveryBaselineStrategy(baselineRuleSource);
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
  const engine = new RecoveryBaselineStrategy(baselineRuleSource);
  const decision = await engine.decide(createSnapshot("snapshot-healthy", "healthy"), {
    actionAttemptCounts: {},
    completedActionIds: [],
  });

  assert.equal(decision.status, "no_action");
  assert.deepEqual(decision.recoveryPlan.proposedActionIds, []);
});

test("baseline escalates when no deterministic rule matches", async () => {
  const engine = new RecoveryBaselineStrategy(baselineRuleSource);
  const decision = await engine.decide(
    createSnapshot("snapshot-unknown", "unknown", ["unclassified"]),
    {
      actionAttemptCounts: {},
      completedActionIds: [],
    },
  );

  assert.equal(decision.status, "escalate");
  assert.deepEqual(decision.recoveryPlan.proposedActionIds, []);
  assert.equal(decision.diagnosisResult.method, "deterministic");
});

test("trial runner requires fresh evidence and a re-decision before a subsequent action", async () => {
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
      decisionSnapshotIds.push(snapshot.id);
      if (snapshot.id === initialSnapshot.id) {
        return createDecision({
          snapshot,
          actionIds: ["restart_postgres_container"],
        });
      }
      return createDecision({
        snapshot,
        actionIds: ["restart_managed_system_service"],
      });
    },
  };
  const executedActionIds: string[] = [];
  const decisionSnapshotIds: string[] = [];
  const savedResults: ActionExecutionResult[] = [];
  const snapshots = new Map([
    [intermediateSnapshot.id, intermediateSnapshot],
    [healthySnapshot.id, healthySnapshot],
  ]);
  let executionCount = 0;

  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    { saveTrialRecord: (trialRecord: TrialRecord) => trialRecord } as never,
    {
      findActionById: (actionId: string) => createAction(actionId),
      async executeAction(action: Action, _snapshot: EvidenceSnapshot, context: { trialRecordId: string }) {
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
      saveActionExecutionResult(result: ActionExecutionResult) {
        savedResults.push(result);
        return result;
      },
    } as never,
    {
      findEvidenceSnapshotById(id) {
        return snapshots.get(id) ?? null;
      },
    },
    {
      createEvaluationSummary: () => ({}),
      saveEvaluationSummary: (summary: unknown) => summary,
    } as never,
    createRecoveryService() as never,
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
  assert.deepEqual(decisionSnapshotIds, [
    initialSnapshot.id,
    intermediateSnapshot.id,
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

test("trial runner persists each decision before actions and retains final compatibility references", async () => {
  const initialSnapshot = createSnapshot("snapshot-history-initial", "unhealthy");
  const nextSnapshot = createSnapshot("snapshot-history-next", "healthy");
  const persistedDecisionIds: string[] = [];
  const persistedDecisions: RecoveryDecision[] = [];
  const strategy: RecoveryStrategy = {
    mode: "baseline",
    async decide(snapshot) {
      return createDecision({
        snapshot,
        actionIds: snapshot.id === initialSnapshot.id ? ["restart_postgres_container"] : [],
      });
    },
  };
  const recoveryService = {
    recordRecoveryDecision(input: { recoveryDecision: RecoveryDecision }) {
      persistedDecisionIds.push(input.recoveryDecision.id);
      persistedDecisions.push(input.recoveryDecision);
      return input.recoveryDecision;
    },
    findRecoveryDecisionHistory() {
      return persistedDecisions;
    },
  };
  let actionExecutedAfterPersistence = false;

  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    { saveTrialRecord: (trialRecord: TrialRecord) => trialRecord } as never,
    {
      findActionById: (actionId: string) => createAction(actionId),
      async executeAction(action: Action, _snapshot: EvidenceSnapshot, context: { trialRecordId: string }) {
        actionExecutedAfterPersistence = persistedDecisionIds.length === 1;
        return createResult({
          id: "result-history",
          trialRecordId: context.trialRecordId,
          actionId: action.id,
          afterSnapshotId: nextSnapshot.id,
          continuation: "resolved",
        });
      },
      saveActionExecutionResult(result: ActionExecutionResult) { return result; },
    } as never,
    { findEvidenceSnapshotById: () => nextSnapshot },
    { createEvaluationSummary: () => ({}), saveEvaluationSummary: (summary: unknown) => summary } as never,
    recoveryService as never,
    3,
  );

  const result = await runner.runRecoveryTrial({
    mode: "baseline",
    scenarioId: "history-scenario",
    snapshot: initialSnapshot,
  });

  assert.equal(actionExecutedAfterPersistence, true);
  assert.equal(persistedDecisionIds.length, 1);
  assert.deepEqual(result.trialRecord.recoveryDecisionIds, persistedDecisionIds);
  assert.deepEqual(result.trialRecord.diagnosisResultIds, ["diagnosis-test"]);
  assert.deepEqual(result.trialRecord.recoveryPlanIds, ["recovery-plan-test"]);
  assert.equal(result.trialRecord.diagnosisResultId, "diagnosis-test");
  assert.equal(result.trialRecord.recoveryPlanId, "recovery-plan-test");
  assert.deepEqual(result.recoveryDecisions, persistedDecisions);
});

test("trial runner prevents action execution when decision persistence fails", async () => {
  const snapshot = createSnapshot("snapshot-persistence-failure", "unhealthy");
  const strategy: RecoveryStrategy = {
    mode: "baseline",
    async decide() { return createDecision({ snapshot, actionIds: ["restart_postgres_container"] }); },
  };
  let actionExecuted = false;
  const runner = new TrialService(
    { baseline: strategy, agent: strategy },
    { saveTrialRecord: (trialRecord: TrialRecord) => trialRecord } as never,
    {
      findActionById: (actionId: string) => createAction(actionId),
      async executeAction() { actionExecuted = true; throw new Error("must not execute"); },
      saveActionExecutionResult: (result: ActionExecutionResult) => result,
    } as never,
    { findEvidenceSnapshotById: () => null },
    { createEvaluationSummary: () => ({}), saveEvaluationSummary: (summary: unknown) => summary } as never,
    { recordRecoveryDecision() { throw new Error("persistence unavailable"); }, findRecoveryDecisionHistory() { return []; } } as never,
    3,
  );

  await assert.rejects(
    runner.runRecoveryTrial({ mode: "baseline", scenarioId: "persistence-failure", snapshot }),
    /persistence unavailable/,
  );
  assert.equal(actionExecuted, false);
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
    { saveTrialRecord: (trialRecord: TrialRecord) => trialRecord } as never,
    {
      findActionById: (actionId: string) => createAction(actionId),
      async executeAction(action: Action, _snapshot: EvidenceSnapshot, context: { trialRecordId: string }) {
        return createResult({
          id: "result-limit",
          trialRecordId: context.trialRecordId,
          actionId: action.id,
          afterSnapshotId: nextSnapshot.id,
          continuation: "continue",
        });
      },
      saveActionExecutionResult(result: ActionExecutionResult) {
        return result;
      },
    } as never,
    {
      findEvidenceSnapshotById() {
        return nextSnapshot;
      },
    },
    {
      createEvaluationSummary: () => ({}),
      saveEvaluationSummary: (summary: unknown) => summary,
    } as never,
    createRecoveryService() as never,
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
    { saveTrialRecord: (trialRecord: TrialRecord) => trialRecord } as never,
    {
      findActionById: () => null,
      async executeAction() {
        executionCalled = true;
        throw new Error("executor should not be called");
      },
      saveActionExecutionResult(result: ActionExecutionResult) {
        return result;
      },
    } as never,
    {
      findEvidenceSnapshotById() {
        return null;
      },
    },
    {
      createEvaluationSummary: () => ({}),
      saveEvaluationSummary: (summary: unknown) => summary,
    } as never,
    createRecoveryService() as never,
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
