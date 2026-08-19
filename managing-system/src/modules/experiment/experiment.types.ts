import type {
  ExperimentBatch,
  ExperimentRun,
  FaultProfileCode,
} from "@/generated/prisma/client";
import type { RecoveryMode } from "@/modules/recovery";

export type { ExperimentBatch, ExperimentRun, FaultProfileCode } from "@/generated/prisma/client";

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
