import { randomUUID } from "node:crypto";
import type { EvidenceSnapshot } from "@/modules/evidence";
import { type DiagnosisResult, type RecoveryPlan } from "./recovery.schema";
import type { RecoveryDecision, RecoveryMode, RecoveryDecisionStatus } from "./recovery.types";

export class RecoveryFactory {
  createDiagnosisResult(input: Omit<DiagnosisResult, "id" | "createdAt">): DiagnosisResult {
    return { ...input, id: `diagnosis-${randomUUID()}`, createdAt: new Date().toISOString() };
  }

  createRecoveryPlan(input: Omit<RecoveryPlan, "id" | "createdAt">): RecoveryPlan {
    return { ...input, id: `recovery-plan-${randomUUID()}`, createdAt: new Date().toISOString() };
  }

  createRecoveryDecision(input: {
    mode: RecoveryMode;
    snapshot: EvidenceSnapshot;
    status: RecoveryDecisionStatus;
    reason: string;
    diagnosisResult: DiagnosisResult;
    recoveryPlan: RecoveryPlan;
    escalationReason?: string;
  }): RecoveryDecision {
    return {
      id: `recovery-decision-${randomUUID()}`,
      mode: input.mode,
      snapshotId: input.snapshot.id,
      decidedAt: new Date().toISOString(),
      status: input.status,
      reason: input.reason,
      diagnosisResult: input.diagnosisResult,
      recoveryPlan: input.recoveryPlan,
      escalationReason: input.escalationReason,
    };
  }
}
