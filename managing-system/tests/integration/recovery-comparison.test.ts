import assert from "node:assert/strict";
import { test } from "node:test";

import { ActionRegistry, type ActionExecutionResult } from "@/modules/actions";
import type { EvidenceSnapshot } from "@/modules/evidence";
import type {
  RecoveryDecision,
  RecoveryMode,
  RecoveryStrategy,
} from "@/modules/recovery";
import { TrialRunner } from "@/modules/trials";

function createHealthySnapshot(): EvidenceSnapshot {
  return {
    id: "snapshot-comparison",
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState: "healthy",
    summary: "Managed system is healthy.",
    signals: [],
    suspectedIncidentTypes: [],
    contradictions: [],
  };
}

function createStrategy(mode: RecoveryMode): RecoveryStrategy {
  return {
    mode,
    async decide(snapshot): Promise<RecoveryDecision> {
      const diagnosisResultId = `diagnosis-${mode}`;

      return {
        mode,
        snapshotId: snapshot.id,
        decidedAt: new Date().toISOString(),
        status: "no_action",
        reason: "Healthy evidence requires no recovery action.",
        diagnosisResult: {
          id: diagnosisResultId,
          evidenceSnapshotId: snapshot.id,
          createdAt: new Date().toISOString(),
          method: mode === "baseline" ? "deterministic" : "llm",
          sourceIds: [],
          suspectedIncidentType: "none",
          severity: "low",
          confidence: mode === "baseline" ? null : 1,
          reasoningSummary: "No incident detected.",
          supportingSignals: [],
          contradictions: [],
        },
        recoveryPlan: {
          id: `recovery-plan-${mode}`,
          diagnosisResultId,
          createdAt: new Date().toISOString(),
          proposedActionIds: [],
          rationale: "No action required.",
          expectedOutcome: "System remains healthy.",
          fallbackActionIds: [],
          escalationReason: null,
        },
      };
    },
  };
}

test("baseline and agent strategies produce separate comparable trial records", async () => {
  const baseline = createStrategy("baseline");
  const agent = createStrategy("agent");
  const runner = new TrialRunner(
    { baseline, agent },
    new ActionRegistry(),
    {
      async execute(): Promise<ActionExecutionResult> {
        throw new Error("No action should execute for healthy evidence.");
      },
    },
    { findSnapshotById: () => null },
    { save: (result) => result },
  );
  const snapshot = createHealthySnapshot();

  const baselineResult = await runner.runRecoveryTrial({
    mode: "baseline",
    scenarioId: "comparison-scenario",
    snapshot,
  });
  const agentResult = await runner.runRecoveryTrial({
    mode: "agent",
    scenarioId: "comparison-scenario",
    snapshot,
  });

  assert.equal(baselineResult.trialRecord.recoveryMode, "baseline");
  assert.equal(agentResult.trialRecord.recoveryMode, "agent");
  assert.notEqual(baselineResult.trialRecord.id, agentResult.trialRecord.id);
  assert.equal(baselineResult.trialRecord.status, "resolved");
  assert.equal(agentResult.trialRecord.status, "resolved");
});
