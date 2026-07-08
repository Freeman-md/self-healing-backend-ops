export type RecoveryMode = "baseline" | "agent";

export type TrialStatus = "started" | "resolved" | "unresolved" | "escalated" | "failed";

export type TrialOutcome =
  | "resolved_safely"
  | "unresolved_escalated"
  | "unresolved_not_escalated"
  | "resolved_unsafely"
  | "failed";

export type TrialMetrics = {
  actionCount: number;
  blockedActionCount: number;
  timeToRecoveryMs?: number;
  timeToEscalationMs?: number;
};

export type TrialRecord = {
  id: string;
  scenarioId: string;
  recoveryMode: RecoveryMode;
  startedAt: string;
  completedAt?: string;
  initialEvidenceSnapshotId?: string;
  finalEvidenceSnapshotId?: string;
  evidenceSnapshotIds: string[];
  diagnosisResultId?: string;
  recoveryPlanId?: string;
  selectedActionIds: string[];
  executedActionResultIds: string[];
  blockedActionIds: string[];
  status: TrialStatus;
  outcome: TrialOutcome;
  escalationReason?: string;
  metrics: TrialMetrics;
  notes?: string;
  evaluationSummaryId?: string;
};
