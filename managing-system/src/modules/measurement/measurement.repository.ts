import { PrismaService } from "@/infrastructure/database";
import type {
  ModelInvocationRecord,
  RecoveryMeasurement,
  RecoveryMeasurementStart,
} from "./measurement.types";

export class MeasurementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startRecoveryMeasurement(
    input: RecoveryMeasurementStart & { measurementVersion: string },
  ): Promise<RecoveryMeasurement> {
    const row = await this.prisma.recoveryMeasurement.upsert({
      where: { trialRecordId: input.trialRecordId },
      create: {
        trialRecordId: input.trialRecordId,
        measurementVersion: input.measurementVersion,
        firstUnhealthyObservedAt: toDate(input.firstUnhealthyObservedAt),
        firstUnhealthyEvidenceSnapshotId:
          input.firstUnhealthyEvidenceSnapshotId ?? null,
        recoveryTriggeredAt: new Date(input.recoveryTriggeredAt),
      },
      update: {
        measurementVersion: input.measurementVersion,
        firstUnhealthyObservedAt: toDate(input.firstUnhealthyObservedAt),
        firstUnhealthyEvidenceSnapshotId:
          input.firstUnhealthyEvidenceSnapshotId ?? null,
        recoveryTriggeredAt: new Date(input.recoveryTriggeredAt),
      },
    });
    return toRecoveryMeasurement(row);
  }

  async findRecoveryMeasurement(
    trialRecordId: string,
  ): Promise<RecoveryMeasurement | null> {
    const row = await this.prisma.recoveryMeasurement.findUnique({
      where: { trialRecordId },
    });
    return row ? toRecoveryMeasurement(row) : null;
  }

  async updateRecoveryMeasurement(
    measurement: RecoveryMeasurement,
  ): Promise<RecoveryMeasurement> {
    const row = await this.prisma.recoveryMeasurement.update({
      where: { trialRecordId: measurement.trialRecordId },
      data: {
        firstActionStartedAt: toDate(measurement.firstActionStartedAt),
        recoveryVerifiedAt: toDate(measurement.recoveryVerifiedAt),
        completedAt: toDate(measurement.completedAt),
        unhealthyConfirmationDelayMs:
          measurement.unhealthyConfirmationDelayMs,
        timeToFirstActionMs: measurement.timeToFirstActionMs,
        recoveryLoopDurationMs: measurement.recoveryLoopDurationMs,
        observedTimeToHealMs: measurement.observedTimeToHealMs,
        decisionCount: measurement.decisionCount,
      },
    });
    return toRecoveryMeasurement(row);
  }

  async saveModelInvocation(
    invocation: ModelInvocationRecord,
  ): Promise<ModelInvocationRecord> {
    await this.prisma.modelInvocation.create({
      data: {
        id: invocation.id,
        operation: invocation.operation,
        model: invocation.model,
        startedAt: new Date(invocation.startedAt),
        completedAt: new Date(invocation.completedAt),
        durationMs: invocation.durationMs,
        inputTokens: invocation.inputTokens,
        outputTokens: invocation.outputTokens,
        totalTokens: invocation.totalTokens,
        status: invocation.status,
        error: invocation.error,
        trialRecordId: invocation.trialRecordId ?? null,
        evidenceSnapshotId: invocation.evidenceSnapshotId ?? null,
        recoveryDecisionId: invocation.recoveryDecisionId ?? null,
        actionExecutionResultId: invocation.actionExecutionResultId ?? null,
      },
    });
    return invocation;
  }
}

type StoredRecoveryMeasurement = {
  trialRecordId: string;
  measurementVersion: string;
  firstUnhealthyObservedAt: Date | null;
  firstUnhealthyEvidenceSnapshotId: string | null;
  recoveryTriggeredAt: Date;
  firstActionStartedAt: Date | null;
  recoveryVerifiedAt: Date | null;
  completedAt: Date | null;
  unhealthyConfirmationDelayMs: number | null;
  timeToFirstActionMs: number | null;
  recoveryLoopDurationMs: number | null;
  observedTimeToHealMs: number | null;
  decisionCount: number;
};

function toDate(value?: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toRecoveryMeasurement(
  row: StoredRecoveryMeasurement,
): RecoveryMeasurement {
  return {
    trialRecordId: row.trialRecordId,
    measurementVersion: row.measurementVersion,
    firstUnhealthyObservedAt: row.firstUnhealthyObservedAt?.toISOString() ?? null,
    firstUnhealthyEvidenceSnapshotId: row.firstUnhealthyEvidenceSnapshotId,
    recoveryTriggeredAt: row.recoveryTriggeredAt.toISOString(),
    firstActionStartedAt: row.firstActionStartedAt?.toISOString() ?? null,
    recoveryVerifiedAt: row.recoveryVerifiedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    unhealthyConfirmationDelayMs: row.unhealthyConfirmationDelayMs,
    timeToFirstActionMs: row.timeToFirstActionMs,
    recoveryLoopDurationMs: row.recoveryLoopDurationMs,
    observedTimeToHealMs: row.observedTimeToHealMs,
    decisionCount: row.decisionCount,
  };
}
