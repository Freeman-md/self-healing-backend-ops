import assert from "node:assert/strict";
import { test } from "node:test";

import { ActionRepository, ActionService, type ActionExecutionResult } from "@/modules/action";
import { EvidenceRepository, type EvidenceSnapshot } from "@/modules/evidence";
import { EvaluationRepository } from "@/modules/evaluation";
import { RecoveryFactory, RecoveryRepository, RecoveryService } from "@/modules/recovery";
import { SafetyService } from "@/modules/safety";
import { TrialRepository, type TrialRecord } from "@/modules/trial";
import { seedCatalogue } from "../../prisma/catalogue";
import { createPrismaTestDatabase } from "../helpers/prisma-test-database";

test("Prisma persistence keeps seeded policy order and normalized trial relationships", async () => {
  const testDatabase = await createPrismaTestDatabase();

  try {
    await seedCatalogue(testDatabase.prisma);
    await seedCatalogue(testDatabase.prisma);

    assert.equal(await testDatabase.prisma.action.count(), 2);
    assert.equal(await testDatabase.prisma.actionSafetyRule.count(), 4);
    assert.equal(await testDatabase.prisma.baselineRule.count(), 2);

    const actionRepository = new ActionRepository(testDatabase.prisma);

    const evidenceRepository = new EvidenceRepository(testDatabase.prisma);

    const trialRepository = new TrialRepository(testDatabase.prisma);

    const recoveryRepository = new RecoveryRepository(testDatabase.prisma);

    const recoveryService = new RecoveryService(recoveryRepository);

    const evaluationRepository = new EvaluationRepository(testDatabase.prisma);

    const action = await actionRepository.findActionById("restart_postgres_container");

    assert.deepEqual(action?.safetyRuleIds, [
      "allow_only_when_system_not_healthy",
      "max_one_attempt_per_cycle",
    ]);
    assert.deepEqual(
      action?.expectedOutcome.successCriteria.map((criterion) => criterion.id),
      ["health_ready_after_postgres_restart"],
    );

    const initialSnapshot = createSnapshot("snapshot-initial", "unhealthy", "critical");

    const finalSnapshot = createSnapshot("snapshot-final", "healthy", "normal");

    await evidenceRepository.saveRawEvidence({
      id: "raw-health-failed",
      source: "health",
      target: "http://managed-system/health",
      collectedAt: "2026-07-26T00:00:00.000Z",
      status: "failed",
      rawText: null,
      error: "connection refused",
    });
    await evidenceRepository.saveRawEvidence({
      id: "raw-log-failed",
      source: "logs",
      target: "managed-system",
      collectedAt: "2026-07-26T00:00:01.000Z",
      status: "collected",
      rawText: "database unavailable",
      error: null,
    });
    initialSnapshot.rawEvidenceIds = ["raw-health-failed", "raw-log-failed"];
    await evidenceRepository.saveEvidenceSnapshot(initialSnapshot);
    await evidenceRepository.saveEvidenceSnapshot(finalSnapshot);

    let reloadedSnapshot = await evidenceRepository.findEvidenceSnapshotById(initialSnapshot.id);

    assert.deepEqual(reloadedSnapshot?.rawEvidenceIds, ["raw-health-failed", "raw-log-failed"]);

    initialSnapshot.rawEvidenceIds = ["raw-health-failed"];
    await evidenceRepository.saveEvidenceSnapshot(initialSnapshot);
    reloadedSnapshot = await evidenceRepository.findEvidenceSnapshotById(initialSnapshot.id);
    assert.deepEqual(reloadedSnapshot?.rawEvidenceIds, ["raw-health-failed"]);
    assert.equal(
      (
        await testDatabase.prisma.rawEvidence.findUniqueOrThrow({
          where: { id: "raw-log-failed" },
          select: { snapshotId: true },
        })
      ).snapshotId,
      null,
    );
    assert.equal(reloadedSnapshot?.signals[0]?.method, "deterministic");
    assert.equal(reloadedSnapshot?.signals[1]?.method, "llm");
    assert.deepEqual(reloadedSnapshot?.suspectedIncidentTypes, [
      "database_connectivity_failure",
      "unclassified",
    ]);

    const baselineMatch = await recoveryService.findMatchingBaselineRule(initialSnapshot);

    assert.equal(baselineMatch?.rule.id, "database_connectivity_failure");

    const trial = createTrialRecord(initialSnapshot.id, finalSnapshot.id);

    await trialRepository.saveTrialRecord({
      ...trial,
      completedAt: undefined,
      finalEvidenceSnapshotId: undefined,
      evidenceSnapshotIds: [initialSnapshot.id],
      status: "started",
      outcome: "unresolved_not_escalated",
    });

    const factory = new RecoveryFactory();

    const diagnosis = factory.createDiagnosisResult({
      evidenceSnapshotId: initialSnapshot.id,
      method: "deterministic",
      sourceIds: ["database_connectivity_failure"],
      suspectedIncidentType: "database_connectivity_failure",
      severity: "high",
      confidence: null,
      reasoningSummary: "database unavailable",
      supportingSignals: ["database_connectivity"],
      contradictions: [],
    });

    const plan = factory.createRecoveryPlan({
      diagnosisResultId: diagnosis.id,
      proposedActionIds: ["restart_postgres_container", "restart_managed_system_service"],
      fallbackActionIds: [],
      rationale: "database first",
      expectedOutcome: "healthy",
      escalationReason: null,
    });

    const decision = factory.createRecoveryDecision({
      mode: "baseline",
      snapshot: initialSnapshot,
      status: "action_selected",
      reason: "database first",
      diagnosisResult: diagnosis,
      recoveryPlan: plan,
    });

    await recoveryRepository.saveRecoveryDecisionHistory({
      trialRecordId: trial.id,
      sequenceNumber: 1,
      recoveryDecision: decision,
    });
    assert.deepEqual(
      (
        await testDatabase.prisma.recoveryPlanAction.findMany({
          where: { recoveryPlanId: plan.id },
          select: { actionId: true },
          orderBy: { position: "asc" },
        })
      ).map((entry) => entry.actionId),
      ["restart_postgres_container", "restart_managed_system_service"],
    );

    const actionResult: ActionExecutionResult = {
      id: "action-result-test",
      actionId: "restart_postgres_container",
      trialRecordId: trial.id,
      startedAt: "2026-07-26T00:00:01.000Z",
      completedAt: "2026-07-26T00:00:02.000Z",
      status: "executed",
      safetyCheckStatus: "passed",
      failedSafetyRuleIds: [],
      beforeEvidenceSnapshotId: initialSnapshot.id,
      afterEvidenceSnapshotId: finalSnapshot.id,
      expectedOutcomeMet: true,
      outcomeSummary: "healthy",
      continuation: "resolved",
    };

    await actionRepository.saveActionExecutionResult(actionResult);
    await trialRepository.saveTrialRecord(trial);
    await evaluationRepository.saveEvaluationSummary({
      id: "evaluation-test",
      trialRecordId: trial.id,
      createdAt: "2026-07-26T00:00:03.000Z",
      summary: "resolved",
      recoverySucceeded: true,
      safetyMaintained: true,
      actionEffectiveness: "effective",
      lessons: ["Database-first ordering worked."],
      recommendedChanges: ["Keep the rule version frozen."],
    });

    const persistedTrial = await trialRepository.findTrialRecordById(trial.id);

    assert.equal(persistedTrial?.initialEvidenceSnapshotId, initialSnapshot.id);
    assert.equal(persistedTrial?.finalEvidenceSnapshotId, finalSnapshot.id);
    assert.deepEqual(persistedTrial?.selectedActionIds, ["restart_postgres_container"]);
    assert.deepEqual(persistedTrial?.executedActionResultIds, [actionResult.id]);
    const evidenceRoles = await testDatabase.prisma.trialEvidenceSnapshot.findMany({
      where: { trialRecordId: trial.id },
      select: { role: true },
      orderBy: { sequenceNumber: "asc" },
    });

    assert.deepEqual(
      evidenceRoles.map((entry) => entry.role),
      ["initial", "final"],
    );

    const executionRelation = await testDatabase.prisma.actionExecutionResult.findUnique({
      where: { id: actionResult.id },
      select: {
        trial: { select: { id: true } },
        action: { select: { id: true } },
        beforeEvidenceSnapshot: { select: { id: true } },
        afterEvidenceSnapshot: { select: { id: true } },
      },
    });

    assert.deepEqual(executionRelation, {
      trial: { id: trial.id },
      action: { id: "restart_postgres_container" },
      beforeEvidenceSnapshot: { id: initialSnapshot.id },
      afterEvidenceSnapshot: { id: finalSnapshot.id },
    });

    const evaluation = await evaluationRepository.findEvaluationSummaryByTrialRecordId(trial.id);

    assert.deepEqual(evaluation?.lessons, ["Database-first ordering worked."]);

    await trialRepository.saveTrialRecord({
      ...trial,
      id: "trial-prisma-agent",
      recoveryMode: "agent",
      selectedActionIds: [],
      actionExecutionResultIds: [],
      executedActionResultIds: [],
      metrics: {
        actionCount: 0,
        blockedActionCount: 0,
        failedActionCount: 0,
      },
      evaluationSummaryId: undefined,
    });
    const modes = await testDatabase.prisma.trialRecord.findMany({
      select: { recoveryMode: true },
    });

    assert.deepEqual(modes.map((entry) => entry.recoveryMode).sort(), ["agent", "baseline"]);

    const countsBeforeFailure = {
      diagnoses: await testDatabase.prisma.diagnosisResult.count(),
      plans: await testDatabase.prisma.recoveryPlan.count(),
      decisions: await testDatabase.prisma.recoveryDecision.count(),
    };

    const invalidDiagnosis = factory.createDiagnosisResult({
      evidenceSnapshotId: initialSnapshot.id,
      method: "deterministic",
      sourceIds: [],
      suspectedIncidentType: "database_connectivity_failure",
      severity: "high",
      confidence: null,
      reasoningSummary: "invalid transactional fixture",
      supportingSignals: [],
      contradictions: [],
    });

    const invalidPlan = factory.createRecoveryPlan({
      diagnosisResultId: invalidDiagnosis.id,
      proposedActionIds: ["not_allowlisted"],
      fallbackActionIds: [],
      rationale: "invalid",
      expectedOutcome: "none",
      escalationReason: null,
    });

    const invalidDecision = factory.createRecoveryDecision({
      mode: "baseline",
      snapshot: initialSnapshot,
      status: "action_selected",
      reason: "invalid",
      diagnosisResult: invalidDiagnosis,
      recoveryPlan: invalidPlan,
    });

    await assert.rejects(
      recoveryRepository.saveRecoveryDecisionHistory({
        trialRecordId: trial.id,
        sequenceNumber: 2,
        recoveryDecision: invalidDecision,
      }),
    );
    assert.deepEqual(
      {
        diagnoses: await testDatabase.prisma.diagnosisResult.count(),
        plans: await testDatabase.prisma.recoveryPlan.count(),
        decisions: await testDatabase.prisma.recoveryDecision.count(),
      },
      countsBeforeFailure,
    );
  } finally {
    await testDatabase.close();
  }
});

test("malformed persisted safety parameters fail closed before handler execution", async () => {
  const testDatabase = await createPrismaTestDatabase({ seed: true });

  try {
    const actionRepository = new ActionRepository(testDatabase.prisma);

    const action = await actionRepository.findActionById("restart_postgres_container");

    assert.ok(action);

    await testDatabase.prisma.safetyRule.update({
      where: { id: "max_one_attempt_per_cycle" },
      data: { parameters: { maxAttempts: "invalid" } },
    });

    let handlerInvoked = false;

    const actionService = new ActionService(
      actionRepository,
      new SafetyService(),
      {} as never,
      undefined,
      undefined,
      true,
      {
        findActionHandler: () => async () => {
          handlerInvoked = true;

          return { output: "unexpected" };
        },
      } as never,
    );

    const malformedRuleResult = await actionService.executeAction(
      action,
      createSnapshot("snapshot-malformed-rule", "unhealthy", "critical"),
      { trialRecordId: "trial-malformed-rule" },
    );

    assert.equal(malformedRuleResult.status, "blocked");
    assert.equal(malformedRuleResult.safetyCheckStatus, "failed");
    assert.equal(malformedRuleResult.continuation, "escalated");
    assert.match(malformedRuleResult.error ?? "", /Persisted safety rule validation failed/);
    assert.equal(handlerInvoked, false);
  } finally {
    await testDatabase.close();
  }
});

function createSnapshot(
  id: string,
  overallState: EvidenceSnapshot["overallState"],
  databaseStatus: "critical" | "normal",
): EvidenceSnapshot {
  return {
    id,
    rawEvidenceIds: [],
    createdAt: "2026-07-26T00:00:00.000Z",
    targetSystem: "managed-system",
    overallState,
    summary: overallState,
    signals: [
      {
        source: "health",
        name: "database_connectivity",
        code: "database_connectivity",
        status: databaseStatus,
        value: databaseStatus === "normal",
        description: "deterministic database status",
        method: "deterministic",
      },
      {
        source: "logs",
        name: "supplementary",
        code: "unknown",
        status: "unknown",
        value: null,
        description: "supplementary LLM signal",
        method: "llm",
      },
    ],
    suspectedIncidentTypes:
      databaseStatus === "critical"
        ? ["database_connectivity_failure", "unclassified"]
        : ["unclassified"],
    contradictions: [],
  };
}

function createTrialRecord(
  initialEvidenceSnapshotId: string,
  finalEvidenceSnapshotId: string,
): TrialRecord {
  return {
    id: "trial-prisma-integration",
    scenarioId: "S1",
    recoveryMode: "baseline",
    startedAt: "2026-07-26T00:00:00.000Z",
    completedAt: "2026-07-26T00:00:03.000Z",
    initialEvidenceSnapshotId,
    finalEvidenceSnapshotId,
    evidenceSnapshotIds: [initialEvidenceSnapshotId, finalEvidenceSnapshotId],
    recoveryDecisionIds: [],
    diagnosisResultIds: [],
    recoveryPlanIds: [],
    selectedActionIds: ["restart_postgres_container"],
    actionExecutionResultIds: ["action-result-test"],
    executedActionResultIds: ["action-result-test"],
    blockedActionIds: [],
    failedActionIds: [],
    status: "resolved",
    outcome: "resolved_safely",
    metrics: {
      actionCount: 1,
      blockedActionCount: 0,
      failedActionCount: 0,
      timeToRecoveryMs: 3000,
    },
    notes: "resolved",
    evaluationSummaryId: "evaluation-test",
  };
}
