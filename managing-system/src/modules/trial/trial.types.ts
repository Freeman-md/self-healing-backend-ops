import type {
  RecoveryMode,
  RecoveryStrategy,
  RecoveryStrategyContext,
} from "@/modules/recovery";

export type RecoveryStrategies = Record<RecoveryMode, RecoveryStrategy>;

export type TrialContext = RecoveryStrategyContext & {
  trialRecordId: string;
  evidenceSnapshotIds: string[];
  recoveryDecisionIds: string[];
  diagnosisResultIds: string[];
  recoveryPlanIds: string[];
  selectedActionIds: string[];
  actionExecutionResultIds: string[];
  executedActionResultIds: string[];
  blockedActionIds: string[];
  failedActionIds: string[];
};

export type TrialStatus = "started" | "resolved" | "unresolved" | "escalated" | "failed";

export type TrialOutcome =
  | "resolved_safely"
  | "unresolved_escalated"
  | "unresolved_not_escalated"
  | "resolved_unsafely"
  | "failed";

export type TrialState = {
  status: TrialStatus;
  outcome: TrialOutcome;
  reason: string;
  escalationReason?: string;
};

export type TrialMetrics = {
  actionCount: number;
  blockedActionCount: number;
  failedActionCount: number;
  timeToRecoveryMs?: number;
  timeToEscalationMs?: number;
};

export type TrialRecord = {
  id: string;
  triggerSource?: "controlled" | "monitor";
  scenarioId?: string;
  recoveryMode: RecoveryMode;
  startedAt: string;
  completedAt?: string;
  initialEvidenceSnapshotId?: string;
  finalEvidenceSnapshotId?: string;
  evidenceSnapshotIds: string[];
  recoveryDecisionIds: string[];
  diagnosisResultIds: string[];
  recoveryPlanIds: string[];
  diagnosisResultId?: string;
  recoveryPlanId?: string;
  selectedActionIds: string[];
  actionExecutionResultIds: string[];
  executedActionResultIds: string[];
  blockedActionIds: string[];
  failedActionIds: string[];
  status: TrialStatus;
  outcome: TrialOutcome;
  escalationReason?: string;
  metrics: TrialMetrics;
  notes?: string;
  evaluationSummaryId?: string;
};
