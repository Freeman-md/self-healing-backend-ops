export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type BaselineRecoveryDecisionStatus = "no_action" | "action_selected" | "escalate";

export type BaselineRuleMatch = {
  ruleId: string;
  matchedSignalNames: string[];
  description: string;
};

export type BaselineRecoveryDecision = {
  mode: "baseline";
  snapshotId: string;
  decidedAt: string;
  status: BaselineRecoveryDecisionStatus;
  reason: string;
  selectedActionId?: string;
  escalationReason?: string;
  matchedRule?: BaselineRuleMatch;
};

export type DiagnosisResult = {
  id: string;
  evidenceSnapshotId: string;
  createdAt: string;
  suspectedIncidentType: string;
  severity: IncidentSeverity;
  confidence: number;
  reasoningSummary: string;
  supportingSignals: string[];
  contradictions: string[];
};

export type RecoveryPlan = {
  id: string;
  diagnosisResultId: string;
  createdAt: string;
  proposedActionIds: string[];
  rationale: string;
  expectedOutcome: string;
  fallbackActionIds: string[];
  escalationReason?: string;
};
