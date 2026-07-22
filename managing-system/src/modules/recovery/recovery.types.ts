import type { EvidenceSnapshot } from "@/modules/evidence";

import type { DiagnosisResult, RecoveryPlan } from "./recovery.schema";

export type RecoveryMode = "baseline" | "agent";

export type RecoveryDecisionStatus = "no_action" | "action_selected" | "escalate";

export type RecoveryDecision = {
  mode: RecoveryMode;
  snapshotId: string;
  decidedAt: string;
  status: RecoveryDecisionStatus;
  reason: string;
  diagnosisResult: DiagnosisResult;
  recoveryPlan: RecoveryPlan;
  escalationReason?: string;
};

export type RecoveryStrategyContext = {
  actionAttemptCounts: Record<string, number>;
  completedActionIds: string[];
};

export interface RecoveryStrategy {
  readonly mode: RecoveryMode;

  decide(
    snapshot: EvidenceSnapshot,
    context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision>;
}
