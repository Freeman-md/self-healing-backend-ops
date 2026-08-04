import type { EvidenceSnapshot } from "@/modules/evidence";

import type { RecoveryDecision } from "./recovery.schema";

export type RecoveryMode = "baseline" | "agent";

export type RecoveryDecisionStatus = RecoveryDecision["status"];

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

export type { RecoveryDecision };
