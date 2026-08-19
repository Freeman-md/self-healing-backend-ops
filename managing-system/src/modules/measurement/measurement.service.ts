import type {
  IOpenAITelemetrySink,
  OpenAIInvocationTelemetry,
} from "@/infrastructure/openai";
import { MeasurementRepository } from "./measurement.repository";
import {
  RECOVERY_MEASUREMENT_VERSION,
  type RecoveryMeasurement,
  type RecoveryMeasurementCompletion,
  type RecoveryMeasurementStart,
} from "./measurement.types";

export class MeasurementService implements IOpenAITelemetrySink {
  constructor(private readonly repository: MeasurementRepository) {}

  startRecoveryMeasurement(
    input: RecoveryMeasurementStart,
  ): Promise<RecoveryMeasurement> {
    return this.repository.startRecoveryMeasurement({
      ...input,
      measurementVersion: RECOVERY_MEASUREMENT_VERSION,
    });
  }

  async recordFirstActionStarted(
    trialRecordId: string,
    firstActionStartedAt: string,
  ): Promise<RecoveryMeasurement> {
    const measurement = await this.requireMeasurement(trialRecordId);
    if (measurement.firstActionStartedAt) {
      return measurement;
    }

    return this.repository.updateRecoveryMeasurement(
      deriveDurations({ ...measurement, firstActionStartedAt }),
    );
  }

  async completeRecoveryMeasurement(
    input: RecoveryMeasurementCompletion,
  ): Promise<RecoveryMeasurement> {
    const measurement = await this.requireMeasurement(input.trialRecordId);
    return this.repository.updateRecoveryMeasurement(
      deriveDurations({
        ...measurement,
        completedAt: input.completedAt,
        recoveryVerifiedAt: input.recoveryVerifiedAt ?? null,
        decisionCount: input.decisionCount,
      }),
    );
  }

  recordOpenAIInvocation(
    invocation: OpenAIInvocationTelemetry,
  ): Promise<void> {
    return this.repository.saveModelInvocation(invocation).then(() => undefined);
  }

  private async requireMeasurement(
    trialRecordId: string,
  ): Promise<RecoveryMeasurement> {
    const measurement =
      await this.repository.findRecoveryMeasurement(trialRecordId);
    if (!measurement) {
      throw new Error(`Recovery measurement ${trialRecordId} was not started.`);
    }
    return measurement;
  }
}

export function deriveDurations(
  measurement: RecoveryMeasurement,
): RecoveryMeasurement {
  const triggerMs = timestamp(measurement.recoveryTriggeredAt);
  const firstUnhealthyMs = timestamp(measurement.firstUnhealthyObservedAt);
  const firstActionMs = timestamp(measurement.firstActionStartedAt);
  const verifiedMs = timestamp(measurement.recoveryVerifiedAt);

  return {
    ...measurement,
    unhealthyConfirmationDelayMs: difference(triggerMs, firstUnhealthyMs),
    timeToFirstActionMs: difference(firstActionMs, triggerMs),
    recoveryLoopDurationMs: difference(verifiedMs, triggerMs),
    observedTimeToHealMs: difference(verifiedMs, firstUnhealthyMs),
  };
}

function timestamp(value: string | null): number | null {
  return value ? new Date(value).getTime() : null;
}

function difference(end: number | null, start: number | null): number | null {
  if (end === null || start === null) {
    return null;
  }
  return Math.max(0, end - start);
}
