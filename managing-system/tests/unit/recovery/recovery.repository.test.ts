import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RecoveryFactory,
  RecoveryRepository,
  type RecoveryDecision,
} from "@/modules/recovery";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { EvidenceRepository } from "@/modules/evidence";
import { TrialRepository } from "@/modules/trial";
import { createPrismaTestDatabase } from "../../helpers/prisma-test-database";

function createSnapshot(id: string): EvidenceSnapshot {
  return {
    id,
    rawEvidenceIds: [],
    createdAt: "2026-07-24T00:00:00.000Z",
    targetSystem: "managed-system",
    overallState: "unhealthy",
    summary: "test",
    signals: [],
    suspectedIncidentTypes: [],
    contradictions: [],
  };
}

function createDecision(snapshot: EvidenceSnapshot, status: RecoveryDecision["status"]): RecoveryDecision {
  const factory = new RecoveryFactory();
  const diagnosisResult = factory.createDiagnosisResult({
    evidenceSnapshotId: snapshot.id,
    method: "deterministic",
    sourceIds: [],
    suspectedIncidentType: "test",
    severity: "high",
    confidence: null,
    reasoningSummary: "test",
    supportingSignals: [],
    contradictions: [],
  });
  const recoveryPlan = factory.createRecoveryPlan({
    diagnosisResultId: diagnosisResult.id,
    proposedActionIds: status === "action_selected" ? ["restart_postgres_container"] : [],
    rationale: "test",
    expectedOutcome: "healthy",
    fallbackActionIds: [],
    escalationReason: status === "escalate" ? "test escalation" : null,
  });

  return factory.createRecoveryDecision({
    mode: "baseline",
    snapshot,
    status,
    reason: "test decision",
    diagnosisResult,
    recoveryPlan,
    escalationReason: status === "escalate" ? "test escalation" : undefined,
  });
}

test("RecoveryFactory assigns a unique durable ID to each decision", () => {
  const snapshot = createSnapshot("snapshot-id-test");
  const first = createDecision(snapshot, "no_action");
  const second = createDecision(snapshot, "no_action");

  assert.match(first.id, /^recovery-decision-/);
  assert.notEqual(first.id, second.id);
});

test("RecoveryRepository persists and retrieves ordered decision history in one isolated database", async () => {
  const testDatabase = await createPrismaTestDatabase({ seed: true });
  const repository = new RecoveryRepository(testDatabase.prisma);
  const evidenceRepository = new EvidenceRepository(testDatabase.prisma);
  const trialRepository = new TrialRepository(testDatabase.prisma);
  const trialRecordId = "trial-history-test";
  const first = createDecision(createSnapshot("snapshot-first"), "action_selected");
  const second = createDecision(createSnapshot("snapshot-second"), "escalate");

  try {
    await evidenceRepository.saveEvidenceSnapshot(createSnapshot("snapshot-first"));
    await evidenceRepository.saveEvidenceSnapshot(createSnapshot("snapshot-second"));
    await trialRepository.saveTrialRecord({
      id: trialRecordId,
      scenarioId: "S1",
      recoveryMode: "baseline",
      startedAt: "2026-07-24T00:00:00.000Z",
      evidenceSnapshotIds: ["snapshot-first", "snapshot-second"],
      recoveryDecisionIds: [],
      diagnosisResultIds: [],
      recoveryPlanIds: [],
      selectedActionIds: [],
      actionExecutionResultIds: [],
      executedActionResultIds: [],
      blockedActionIds: [],
      failedActionIds: [],
      status: "started",
      outcome: "unresolved_not_escalated",
      metrics: {
        actionCount: 0,
        blockedActionCount: 0,
        failedActionCount: 0,
      },
    });
    await repository.saveRecoveryDecisionHistory({
      trialRecordId,
      sequenceNumber: 1,
      recoveryDecision: first,
    });
    await repository.saveRecoveryDecisionHistory({
      trialRecordId,
      sequenceNumber: 2,
      recoveryDecision: second,
    });

    const history =
      await repository.findRecoveryDecisionsByTrialRecordId(trialRecordId);

    assert.deepEqual(history.map((decision) => decision.id), [first.id, second.id]);
    assert.deepEqual(history.map((decision) => decision.snapshotId), ["snapshot-first", "snapshot-second"]);
    assert.equal(history[0]?.diagnosisResult.id, first.diagnosisResult.id);
    assert.equal(history[1]?.recoveryPlan.id, second.recoveryPlan.id);
  } finally {
    await testDatabase.close();
  }
});
