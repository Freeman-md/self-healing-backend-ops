export type SafetyCheckType =
  | "file_exists"
  | "file_missing"
  | "previous_action_completed"
  | "previous_action_not_run"
  | "evidence_state_matches"
  | "max_attempts_not_exceeded"
  | "manual_approval_required";

export type SafetyRuleFailureAction = "block" | "escalate";
export type SafetyCheckStatus = "passed" | "failed" | "not_checked";
export type SafetyDecisionStatus = "allowed" | "blocked" | "escalate";

export type SafetyRule = {
  id: string;
  description: string;
  checkType: SafetyCheckType;
  params: Record<string, unknown>;
  onFail: SafetyRuleFailureAction;
};

export type SafetyRuleEvaluation = {
  ruleId: string;
  status: SafetyCheckStatus;
  reason: string;
  onFail: SafetyRuleFailureAction;
};

export type SafetyDecision = {
  actionId: string;
  checkedAt: string;
  status: SafetyDecisionStatus;
  passedRuleIds: string[];
  failedRuleIds: string[];
  reason: string;
  evaluations: SafetyRuleEvaluation[];
  escalationReason?: string;
};
