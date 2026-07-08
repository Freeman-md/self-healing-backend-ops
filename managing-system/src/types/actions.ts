export type RiskLevel = "low" | "medium" | "high";

export type SafetyCheckType =
  | "file_exists"
  | "file_missing"
  | "previous_action_completed"
  | "previous_action_not_run"
  | "evidence_state_matches"
  | "max_attempts_not_exceeded"
  | "manual_approval_required";

export type SafetyRuleFailureAction = "block" | "escalate";

export type OutcomeCheckType =
  | "health_status_is"
  | "endpoint_returns_status"
  | "metric_below_threshold"
  | "container_running"
  | "file_exists"
  | "action_completed";

export type ActionExecutionStatus = "skipped" | "blocked" | "executed" | "failed";

export type SafetyCheckStatus = "passed" | "failed" | "not_checked";

export type SafetyRule = {
  id: string;
  description: string;
  checkType: SafetyCheckType;
  params: Record<string, unknown>;
  onFail: SafetyRuleFailureAction;
};

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

export type ActionDefinition = {
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
  actionDefinitionId: string;
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
};
