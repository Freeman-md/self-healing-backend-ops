import type { EvidenceSnapshot } from "@/modules/evidence";

import type { RecoveryDecision } from "./recovery.schema";

export type RecoveryMode = "baseline" | "agent";

export type RecoveryDecisionStatus = RecoveryDecision["status"];

export type RecoveryStrategyContext = {
  trialRecordId?: string;
  actionAttemptCounts: Record<string, number>;
  completedActionIds: string[];
};

export interface DecisionRecoveryStrategy {
  readonly orchestration: "external";
  readonly mode: RecoveryMode;

  decide(snapshot: EvidenceSnapshot, context: RecoveryStrategyContext): Promise<RecoveryDecision>;
}

export type { RecoveryDecision };

export type AgentRecoveryOutcome = {
  status: "resolved" | "escalated" | "failed";
  reason: string;
};

export type RecoveryActionCatalogueEntry = Pick<
  import("@/modules/action").Action,
  "id" | "name" | "description" | "riskLevel" | "expectedOutcome"
> & { maxAttempts: number };

export type RecoveryActionObservation = Pick<
  import("@/modules/action").ActionExecutionResult,
  | "actionId"
  | "status"
  | "continuation"
  | "safetyCheckStatus"
  | "failedSafetyRuleIds"
  | "expectedOutcomeMet"
> & {
  outcomeSummary: string;
  evidenceSnapshot: EvidenceSnapshot;
};

export interface ControlledRecoveryEnvironment {
  readonly trialRecordId: string;
  readonly maxRecoverySteps: number;
  readonly actions: readonly RecoveryActionCatalogueEntry[];
  recordDecision(decision: RecoveryDecision): Promise<RecoveryDecision>;
  executeRegisteredAction(actionId: string): Promise<RecoveryActionObservation>;
}

export interface AgentOrchestratedRecoveryStrategy {
  readonly mode: "agent";
  readonly orchestration: "agent";
  recover(
    snapshot: EvidenceSnapshot,
    environment: ControlledRecoveryEnvironment,
  ): Promise<AgentRecoveryOutcome>;
}

export type RecoveryStrategy = DecisionRecoveryStrategy | AgentOrchestratedRecoveryStrategy;
