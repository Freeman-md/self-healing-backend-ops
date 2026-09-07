import assert from "node:assert/strict";
import { test } from "node:test";

import { ActionRepository } from "@/modules/action";
import { EvidenceRepository, type EvidenceSnapshot } from "@/modules/evidence";
import { EvaluationRepository } from "@/modules/evaluation";
import {
  ExperimentRepository,
  ExperimentService,
  type ExperimentConfiguration,
} from "@/modules/experiment";
import { MeasurementRepository, MeasurementService } from "@/modules/measurement";
import { TrialRepository, type TrialRecord } from "@/modules/trial";
import { seedCatalogue } from "../../prisma/catalogue";
import { createPrismaTestDatabase } from "../helpers/prisma-test-database";

test("measurement and experiment evidence persist as one queryable recovery record", async () => {
  const testDatabase = await createPrismaTestDatabase({ seed: true });

  try {
    const evidenceRepository = new EvidenceRepository(testDatabase.prisma);

    const trialRepository = new TrialRepository(testDatabase.prisma);

    const actionRepository = new ActionRepository(testDatabase.prisma);

    const evaluationRepository = new EvaluationRepository(testDatabase.prisma);

    const measurementService = new MeasurementService(
      new MeasurementRepository(testDatabase.prisma),
    );

    let now = Date.parse("2026-08-17T09:59:59.000Z");

    const experimentRepository = new ExperimentRepository(testDatabase.prisma);

    const experimentService = new ExperimentService(experimentRepository, {
      now: () => now,
    });

    const initialSnapshot = createSnapshot(
      "snapshot-experiment-unhealthy",
      "2026-08-17T10:00:01.000Z",
      "critical",
    );

    const finalSnapshot = createSnapshot(
      "snapshot-experiment-healthy",
      "2026-08-17T10:00:06.000Z",
      "normal",
    );

    await evidenceRepository.saveEvidenceSnapshot(initialSnapshot);
    await evidenceRepository.saveEvidenceSnapshot(finalSnapshot);

    const trial = createTrial(initialSnapshot.id, finalSnapshot.id);

    await trialRepository.saveTrialRecord({
      ...trial,
      completedAt: undefined,
      finalEvidenceSnapshotId: undefined,
      evidenceSnapshotIds: [initialSnapshot.id],
      status: "started",
      outcome: "unresolved_not_escalated",
      metrics: {
        actionCount: 0,
        blockedActionCount: 0,
        failedActionCount: 0,
      },
    });
    await measurementService.startRecoveryMeasurement({
      trialRecordId: trial.id,
      firstUnhealthyObservedAt: initialSnapshot.createdAt,
      firstUnhealthyEvidenceSnapshotId: initialSnapshot.id,
      recoveryTriggeredAt: "2026-08-17T10:00:02.000Z",
    });
    await measurementService.recordFirstActionStarted(trial.id, "2026-08-17T10:00:03.000Z");
    await actionRepository.saveActionExecutionResult({
      id: "action-result-experiment",
      trialRecordId: trial.id,
      actionId: "restart_postgres_container",
      startedAt: "2026-08-17T10:00:03.000Z",
      completedAt: "2026-08-17T10:00:05.000Z",
      status: "executed",
      safetyCheckStatus: "passed",
      failedSafetyRuleIds: [],
      beforeEvidenceSnapshotId: initialSnapshot.id,
      afterEvidenceSnapshotId: finalSnapshot.id,
      expectedOutcomeMet: true,
      outcomeSummary: "Database and managed system recovered.",
      continuation: "resolved",
    });
    await trialRepository.saveTrialRecord(trial);
    await evaluationRepository.saveEvaluationSummary({
      id: "evaluation-experiment",
      trialRecordId: trial.id,
      createdAt: "2026-08-17T10:00:07.000Z",
      summary: "Recovery was resolved safely.",
      recoverySucceeded: true,
      safetyMaintained: true,
      actionEffectiveness: "effective",
      lessons: [],
      recommendedChanges: [],
    });
    await measurementService.completeRecoveryMeasurement({
      trialRecordId: trial.id,
      completedAt: "2026-08-17T10:00:07.000Z",
      recoveryVerifiedAt: finalSnapshot.createdAt,
      decisionCount: 1,
    });
    await measurementService.recordOpenAIInvocation({
      id: "model-invocation-experiment",
      operation: "outcome_evaluation",
      model: "test-model",
      startedAt: "2026-08-17T10:00:05.000Z",
      completedAt: "2026-08-17T10:00:05.500Z",
      durationMs: 500,
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
      status: "succeeded",
      error: null,
      trialRecordId: trial.id,
      evidenceSnapshotId: finalSnapshot.id,
    });

    const unfrozenConfiguration: Omit<
      ExperimentConfiguration,
      "baselineRuleVersions" | "actionCatalogueFingerprint"
    > = {
      recoveryMode: "baseline",
      model: "test-model",
      promptVersion: "test-prompts-1",
      maxRecoverySteps: 3,
      monitorIntervalMs: 5_000,
      consecutiveUnhealthyThreshold: 2,
      cooldownMs: 15_000,
      faultProfiles: ["managed_system_postgres_stopped"],
      stabilityWindowMs: 10_000,
      preFaultSettleMs: 15_000,
    };

    const configuration = await experimentService.createFrozenConfiguration(unfrozenConfiguration);

    await seedCatalogue(testDatabase.prisma);
    const repeatedConfiguration =
      await experimentService.createFrozenConfiguration(unfrozenConfiguration);

    assert.equal(
      configuration.actionCatalogueFingerprint,
      repeatedConfiguration.actionCatalogueFingerprint,
    );

    const batch = await experimentService.createExperimentBatch({
      name: "persistence-test",
      sourceRevision: "test-revision",
      configuration,
      requestedRepetitions: 1,
      runOrderSeed: "test-seed",
    });

    const preparedRun = await experimentService.prepareExperimentRun({
      batchId: batch.id,
      faultProfile: "managed_system_postgres_stopped",
      recoveryMode: "baseline",
      repetition: 1,
      stabilityWindowMs: 10_000,
    });

    now = Date.parse("2026-08-17T10:00:00.000Z");
    const injectedRun = await experimentService.markFaultInjected(preparedRun.id);

    await experimentRepository.linkExperimentRunToTrial(injectedRun.id, trial.id);
    now = Date.parse("2026-08-17T10:00:09.000Z");
    await experimentService.completeExperimentRun({
      run: injectedRun,
      trial: {
        id: trial.id,
        startedAt: trial.startedAt,
        completedAt: trial.completedAt!,
        status: trial.status,
        recoveryMode: trial.recoveryMode,
        measurement: {
          firstUnhealthyObservedAt: initialSnapshot.createdAt,
          recoveryTriggeredAt: "2026-08-17T10:00:02.000Z",
          recoveryVerifiedAt: finalSnapshot.createdAt,
        },
        diagnosisIncidentCodes: ["database_connectivity_failure"],
        actionIds: ["restart_postgres_container"],
      },
      oracle: {
        succeeded: true,
        firstHealthyObservedAt: "2026-08-17T10:00:07.000Z",
        checkedAt: "2026-08-17T10:00:08.000Z",
        details: { stable: true },
      },
    });
    await experimentService.completeExperimentBatch(batch.id);

    const evidence = await experimentService.getExperimentEvidence(batch.id);

    assert.deepEqual(evidence.batch.configuration, configuration);
    assert.equal(evidence.runs.length, 1);
    assert.equal(evidence.runs[0]?.trialRecordId, trial.id);
    assert.equal(evidence.runs[0]?.faultToDetectionMs, 1_000);
    assert.equal(evidence.runs[0]?.timeToHealMs, 7_000);
    assert.equal(
      evidence.runs[0]?.oracleFirstHealthyObservedAt?.toISOString(),
      "2026-08-17T10:00:07.000Z",
    );
    assert.equal(evidence.runs[0]?.diagnosisCorrect, true);
    assert.equal(evidence.runs[0]?.actionSequenceCorrect, true);
    assert.equal(evidence.runs[0]?.trial?.safetyMaintained, true);
    assert.equal(evidence.runs[0]?.trial?.measurement?.decisionCount, 1);
    assert.equal(evidence.runs[0]?.trial?.modelInvocations.length, 1);
  } finally {
    await testDatabase.close();
  }
});

function createSnapshot(
  id: string,
  createdAt: string,
  status: "critical" | "normal",
): EvidenceSnapshot {
  return {
    id,
    rawEvidenceIds: [],
    createdAt,
    targetSystem: "managed-system",
    overallState: status === "normal" ? "healthy" : "unhealthy",
    summary: "Deterministic experiment fixture.",
    signals: [
      {
        source: "health",
        name: "database_connectivity",
        code: "database_connectivity",
        status,
        value: status === "normal",
        description: "Deterministic database connectivity.",
        method: "deterministic",
      },
    ],
    suspectedIncidentTypes: status === "critical" ? ["database_connectivity_failure"] : [],
    contradictions: [],
  };
}

function createTrial(
  initialEvidenceSnapshotId: string,
  finalEvidenceSnapshotId: string,
): TrialRecord {
  return {
    id: "trial-experiment",
    triggerSource: "monitor",
    recoveryMode: "baseline",
    startedAt: "2026-08-17T10:00:02.000Z",
    completedAt: "2026-08-17T10:00:07.000Z",
    initialEvidenceSnapshotId,
    finalEvidenceSnapshotId,
    evidenceSnapshotIds: [initialEvidenceSnapshotId, finalEvidenceSnapshotId],
    recoveryDecisionIds: [],
    diagnosisResultIds: [],
    recoveryPlanIds: [],
    selectedActionIds: ["restart_postgres_container"],
    actionExecutionResultIds: ["action-result-experiment"],
    executedActionResultIds: ["action-result-experiment"],
    blockedActionIds: [],
    failedActionIds: [],
    status: "resolved",
    outcome: "resolved_safely",
    metrics: {
      actionCount: 1,
      blockedActionCount: 0,
      failedActionCount: 0,
      timeToRecoveryMs: 5_000,
    },
    notes: "Recovered through monitor-triggered execution.",
  };
}
