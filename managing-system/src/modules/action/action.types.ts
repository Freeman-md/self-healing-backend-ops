import type { SafetyCheckStatus } from "@/modules/safety";
import type { OutcomeCriterion } from "./action.schema";

export type RiskLevel = "low" | "medium" | "high";

export type ActionExecutionStatus = "skipped" | "blocked" | "executed" | "failed";

export type ActionExecutionContinuation =
  "resolved" | "continue" | "blocked" | "escalated" | "failed";

export type ExpectedOutcome = {
  description: string;
  successCriteria: OutcomeCriterion[];
};

export type Action = {
  id: string;
  name: string;
  description: string;
  handlerKey: string;
  riskLevel: RiskLevel;
  safetyRuleIds: string[];
  expectedOutcome: ExpectedOutcome;
};

export type ActionExecutionResult = {
  id: string;
  actionId: string;
  trialRecordId: string;
  startedAt: string;
  completedAt?: string;
  status: ActionExecutionStatus;
  safetyCheckStatus: SafetyCheckStatus;
  failedSafetyRuleIds: string[];
  beforeEvidenceSnapshotId?: string;
  afterEvidenceSnapshotId?: string;
  output?: string;
  error?: string;
  expectedOutcomeMet?: boolean;
  outcomeSummary?: string;
  continuation: ActionExecutionContinuation;
};
