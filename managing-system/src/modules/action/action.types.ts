export type RiskLevel = "low" | "medium" | "high";

import type { SafetyCheckStatus } from "@/modules/safety";

export type OutcomeCheckType =
  | "health_status_is"
  | "endpoint_returns_status"
  | "metric_below_threshold"
  | "container_running"
  | "file_exists"
  | "action_completed";

export type ActionExecutionStatus = "skipped" | "blocked" | "executed" | "failed";

export type ActionExecutionContinuation =
  | "resolved"
  | "continue"
  | "blocked"
  | "escalated"
  | "failed";

export type OutcomeCriterion = {
  id: string;
  description: string;
  checkType: OutcomeCheckType;
  params: Record<string, unknown>;
};

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
