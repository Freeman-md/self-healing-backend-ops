import assert from "node:assert/strict";
import { test } from "node:test";

import { DatabaseService } from "@/infrastructure/database";
import {
  RecoveryFactory,
  RecoveryRepository,
  type RecoveryDecision,
} from "@/modules/recovery";
import type { EvidenceSnapshot } from "@/modules/evidence";

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

test("RecoveryRepository persists and retrieves ordered decision history in one isolated database", () => {
  const databaseService = new DatabaseService(":memory:");
  const repository = new RecoveryRepository(databaseService);
  const trialRecordId = "trial-history-test";
  const first = createDecision(createSnapshot("snapshot-first"), "action_selected");
  const second = createDecision(createSnapshot("snapshot-second"), "escalate");

  repository.saveRecoveryDecisionHistory({
    trialRecordId,
    sequenceNumber: 1,
    recoveryDecision: first,
  });
  repository.saveRecoveryDecisionHistory({
    trialRecordId,
    sequenceNumber: 2,
    recoveryDecision: second,
  });

  const history = repository.findRecoveryDecisionsByTrialRecordId(trialRecordId);

  assert.deepEqual(history.map((decision) => decision.id), [first.id, second.id]);
  assert.deepEqual(history.map((decision) => decision.snapshotId), ["snapshot-first", "snapshot-second"]);
  assert.equal(history[0]?.diagnosisResult.id, first.diagnosisResult.id);
  assert.equal(history[1]?.recoveryPlan.id, second.recoveryPlan.id);
  databaseService.close();
});
