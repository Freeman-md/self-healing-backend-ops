import type { OpenAIInvocationTelemetry } from "@/infrastructure/openai";

export const RECOVERY_MEASUREMENT_VERSION = "1.0.0";

export type RecoveryMeasurement = {
  trialRecordId: string;
  measurementVersion: string;
  firstUnhealthyObservedAt: string | null;
  firstUnhealthyEvidenceSnapshotId: string | null;
  recoveryTriggeredAt: string;
  firstActionStartedAt: string | null;
  recoveryVerifiedAt: string | null;
  completedAt: string | null;
  unhealthyConfirmationDelayMs: number | null;
  timeToFirstActionMs: number | null;
  recoveryLoopDurationMs: number | null;
  observedTimeToHealMs: number | null;
  decisionCount: number;
};

export type RecoveryMeasurementStart = {
  trialRecordId: string;
  firstUnhealthyObservedAt?: string;
  firstUnhealthyEvidenceSnapshotId?: string;
  recoveryTriggeredAt: string;
};

export type RecoveryMeasurementCompletion = {
  trialRecordId: string;
  completedAt: string;
  recoveryVerifiedAt?: string;
  decisionCount: number;
};

export type ModelInvocationRecord = OpenAIInvocationTelemetry;
