import type { RecoveryMode } from "@/modules/recovery";

export type FaultProfileCode =
  | "managed_system_application_stopped"
  | "managed_system_postgres_stopped"
  | "managed_system_application_and_postgres_stopped";

export type ExperimentBatchStatus = "active" | "completed" | "failed";
export type ExperimentRunStatus =
  | "prepared"
  | "fault_injected"
  | "trial_linked"
  | "completed"
  | "invalid"
  | "failed";

export type ExperimentConfiguration = {
  recoveryMode: RecoveryMode;
  model: string;
  promptVersion: string;
  baselineRuleVersions: Record<string, number>;
  actionCatalogueFingerprint: string;
  monitorIntervalMs: number;
  consecutiveUnhealthyThreshold: number;
  cooldownMs: number;
  maxRecoverySteps: number;
  faultProfiles: FaultProfileCode[];
  stabilityWindowMs: number;
  preFaultSettleMs: number;
};

export type ExperimentProvenance = {
  actionCatalogue: Array<{
    id: string;
    name: string;
    description: string;
    handlerKey: string;
    riskLevel: string;
    expectedOutcome: {
      description: string;
      criteria: Array<{
        id: string;
        description: string;
        checkType: string;
        parameters: unknown;
        position: number;
      }>;
    } | null;
    safetyRules: Array<{
      position: number;
      safetyRule: {
        id: string;
        description: string;
        checkType: string;
        parameters: unknown;
        onFail: string;
        active: boolean;
      };
    }>;
  }>;
  baselineRules: Array<{ id: string; version: number }>;
};

export type ExperimentBatch = {
  id: string;
  name: string;
  status: ExperimentBatchStatus;
  sourceRevision: string;
  measurementVersion: string;
  configuration: ExperimentConfiguration;
  requestedRepetitions: number;
  runOrderSeed: string;
  createdAt: string;
  completedAt: string | null;
};

export type ExperimentRun = {
  id: string;
  batchId: string;
  faultProfile: FaultProfileCode;
  recoveryMode: RecoveryMode;
  repetition: number;
  status: ExperimentRunStatus;
  startedAt: string;
  faultInjectedAt: string | null;
  completedAt: string | null;
  trialRecordId: string | null;
  valid: boolean | null;
  exclusionReason: string | null;
  runtimeResolved: boolean | null;
  oracleSucceeded: boolean | null;
  oracleCheckedAt: string | null;
  oracleDetails: Record<string, unknown> | null;
  stabilityWindowMs: number;
  diagnosisCorrect: boolean | null;
  actionSequenceCorrect: boolean | null;
  unnecessaryActionCount: number | null;
  faultToDetectionMs: number | null;
  timeToHealMs: number | null;
  timeToTerminationMs: number | null;
};

export type ExperimentTrialCandidate = {
  id: string;
  startedAt: string;
  completedAt: string;
  status: string;
  recoveryMode: RecoveryMode;
  measurement: {
    firstUnhealthyObservedAt: string | null;
    recoveryTriggeredAt: string;
    recoveryVerifiedAt: string | null;
  } | null;
  diagnosisIncidentCodes: string[];
  actionIds: string[];
};

export type RecoveryOracleResult = {
  succeeded: boolean;
  checkedAt: string;
  details: Record<string, unknown>;
};

export type ExperimentRunRecord = ExperimentRun & {
  trial: null | {
    status: string;
    outcome: string;
    actionCount: number;
    blockedActionCount: number;
    failedActionCount: number;
    safetyMaintained: boolean | null;
    timeToRecoveryMs: number | null;
    timeToEscalationMs: number | null;
    measurement: {
      unhealthyConfirmationDelayMs: number | null;
      timeToFirstActionMs: number | null;
      recoveryLoopDurationMs: number | null;
      observedTimeToHealMs: number | null;
      decisionCount: number;
    } | null;
    modelInvocations: Array<{
      operation: string;
      durationMs: number;
      inputTokens: number | null;
      outputTokens: number | null;
      totalTokens: number | null;
      status: string;
    }>;
  };
};
