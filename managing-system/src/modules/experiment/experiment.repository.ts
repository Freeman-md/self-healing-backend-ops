import { Prisma } from "@/generated/prisma/client";
import { PrismaService } from "@/infrastructure/database";
import type {
  ExperimentBatch,
  ExperimentConfiguration,
  ExperimentRun,
  ExperimentRunRecord,
  ExperimentTrialCandidate,
  ExperimentProvenance,
  FaultProfileCode,
  RecoveryOracleResult,
} from "./experiment.types";
import type { RecoveryMode } from "@/modules/recovery";

export class ExperimentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExperimentBatch(input: {
    id: string;
    name: string;
    sourceRevision: string;
    measurementVersion: string;
    configuration: ExperimentConfiguration;
    requestedRepetitions: number;
    runOrderSeed: string;
    createdAt: string;
  }): Promise<ExperimentBatch> {
    const row = await this.prisma.experimentBatch.create({
      data: {
        id: input.id,
        name: input.name,
        status: "active",
        sourceRevision: input.sourceRevision,
        measurementVersion: input.measurementVersion,
        configuration: input.configuration as Prisma.InputJsonValue,
        requestedRepetitions: input.requestedRepetitions,
        runOrderSeed: input.runOrderSeed,
        createdAt: new Date(input.createdAt),
      },
    });
    return toBatch(row);
  }

  async readExperimentProvenance(): Promise<ExperimentProvenance> {
    const [actionCatalogue, baselineRules] = await Promise.all([
      this.prisma.action.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          description: true,
          handlerKey: true,
          riskLevel: true,
          expectedOutcome: {
            select: {
              description: true,
              criteria: {
                select: {
                  id: true,
                  description: true,
                  checkType: true,
                  parameters: true,
                  position: true,
                },
                orderBy: { position: "asc" },
              },
            },
          },
          safetyRules: {
            select: {
              position: true,
              safetyRule: {
                select: {
                  id: true,
                  description: true,
                  checkType: true,
                  parameters: true,
                  onFail: true,
                  active: true,
                },
              },
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { id: "asc" },
      }),
      this.prisma.baselineRule.findMany({
        where: { active: true },
        select: { id: true, version: true },
        orderBy: { id: "asc" },
      }),
    ]);
    return {
      actionCatalogue,
      baselineRules,
    };
  }

  async completeExperimentBatch(
    batchId: string,
    status: "completed" | "failed",
    completedAt: string,
  ): Promise<ExperimentBatch> {
    return toBatch(
      await this.prisma.experimentBatch.update({
        where: { id: batchId },
        data: { status, completedAt: new Date(completedAt) },
      }),
    );
  }

  async findExperimentBatch(batchId: string): Promise<ExperimentBatch | null> {
    const row = await this.prisma.experimentBatch.findUnique({
      where: { id: batchId },
    });
    return row ? toBatch(row) : null;
  }

  async createExperimentRun(input: {
    id: string;
    batchId: string;
    faultProfile: FaultProfileCode;
    recoveryMode: RecoveryMode;
    repetition: number;
    startedAt: string;
    stabilityWindowMs: number;
  }): Promise<ExperimentRun> {
    try {
      const row = await this.prisma.experimentRun.create({
        data: {
          id: input.id,
          batchId: input.batchId,
          faultProfile: input.faultProfile,
          recoveryMode: input.recoveryMode,
          repetition: input.repetition,
          status: "prepared",
          activeLockKey: "global",
          startedAt: new Date(input.startedAt),
          stabilityWindowMs: input.stabilityWindowMs,
        },
      });
      return toRun(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Another controlled experiment run is already active.");
      }
      throw error;
    }
  }

  async markFaultInjected(
    runId: string,
    faultInjectedAt: string,
  ): Promise<ExperimentRun> {
    return toRun(
      await this.prisma.experimentRun.update({
        where: { id: runId },
        data: {
          status: "fault_injected",
          faultInjectedAt: new Date(faultInjectedAt),
        },
      }),
    );
  }

  async findCompletedMonitorTrials(input: {
    recoveryMode: RecoveryMode;
    startedAfter: string;
  }): Promise<ExperimentTrialCandidate[]> {
    const rows = await this.prisma.trialRecord.findMany({
      where: {
        triggerSource: "monitor",
        recoveryMode: input.recoveryMode,
        startedAt: { gte: new Date(input.startedAfter) },
        completedAt: { not: null },
        experimentRun: null,
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        status: true,
        recoveryMode: true,
        recoveryMeasurement: {
          select: {
            firstUnhealthyObservedAt: true,
            recoveryTriggeredAt: true,
            recoveryVerifiedAt: true,
          },
        },
        diagnosisResults: {
          select: { incidentCode: true },
          orderBy: { createdAt: "asc" },
        },
        actionExecutionResults: {
          select: { actionId: true },
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: { startedAt: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt!.toISOString(),
      status: row.status,
      recoveryMode: row.recoveryMode,
      measurement: row.recoveryMeasurement
        ? {
            firstUnhealthyObservedAt:
              row.recoveryMeasurement.firstUnhealthyObservedAt?.toISOString() ??
              null,
            recoveryTriggeredAt:
              row.recoveryMeasurement.recoveryTriggeredAt.toISOString(),
            recoveryVerifiedAt:
              row.recoveryMeasurement.recoveryVerifiedAt?.toISOString() ?? null,
          }
        : null,
      diagnosisIncidentCodes: row.diagnosisResults.map(
        (diagnosis) => diagnosis.incidentCode,
      ),
      actionIds: row.actionExecutionResults.map((result) => result.actionId),
    }));
  }

  async linkExperimentRunToTrial(
    runId: string,
    trialRecordId: string,
  ): Promise<ExperimentRun> {
    const row = await this.prisma.$transaction(async (transaction) => {
      const linkedRun = await transaction.experimentRun.update({
        where: { id: runId },
        data: { status: "trial_linked", trialRecordId },
      });
      const evidenceLinks = await transaction.trialEvidenceSnapshot.findMany({
        where: { trialRecordId },
        select: { evidenceSnapshotId: true },
      });
      await transaction.modelInvocation.updateMany({
        where: {
          trialRecordId: null,
          evidenceSnapshotId: {
            in: evidenceLinks.map((link) => link.evidenceSnapshotId),
          },
        },
        data: { trialRecordId },
      });
      return linkedRun;
    });
    return toRun(row);
  }

  async completeExperimentRun(input: {
    runId: string;
    completedAt: string;
    runtimeResolved: boolean;
    oracle: RecoveryOracleResult;
    diagnosisCorrect: boolean;
    actionSequenceCorrect: boolean;
    unnecessaryActionCount: number;
    faultToDetectionMs: number | null;
    timeToHealMs: number | null;
    timeToTerminationMs: number;
  }): Promise<ExperimentRun> {
    return toRun(
      await this.prisma.experimentRun.update({
        where: { id: input.runId },
        data: {
          status: "completed",
          activeLockKey: null,
          completedAt: new Date(input.completedAt),
          valid: true,
          runtimeResolved: input.runtimeResolved,
          oracleSucceeded: input.oracle.succeeded,
          oracleCheckedAt: new Date(input.oracle.checkedAt),
          oracleDetails: input.oracle.details as Prisma.InputJsonValue,
          diagnosisCorrect: input.diagnosisCorrect,
          actionSequenceCorrect: input.actionSequenceCorrect,
          unnecessaryActionCount: input.unnecessaryActionCount,
          faultToDetectionMs: input.faultToDetectionMs,
          timeToHealMs: input.timeToHealMs,
          timeToTerminationMs: input.timeToTerminationMs,
        },
      }),
    );
  }

  async invalidateExperimentRun(
    runId: string,
    reason: string,
    completedAt: string,
  ): Promise<ExperimentRun> {
    return toRun(
      await this.prisma.experimentRun.update({
        where: { id: runId },
        data: {
          status: "invalid",
          activeLockKey: null,
          valid: false,
          exclusionReason: reason,
          completedAt: new Date(completedAt),
        },
      }),
    );
  }

  async listExperimentRunRecords(
    batchId: string,
  ): Promise<ExperimentRunRecord[]> {
    const rows = await this.prisma.experimentRun.findMany({
      where: { batchId },
      include: {
        trial: {
          include: {
            recoveryMeasurement: true,
            evaluationSummary: {
              select: { safetyMaintained: true },
            },
            modelInvocations: {
              orderBy: { startedAt: "asc" },
            },
          },
        },
      },
      orderBy: [{ recoveryMode: "asc" }, { faultProfile: "asc" }, { repetition: "asc" }],
    });

    return rows.map((row) => ({
      ...toRun(row),
      trial: row.trial
        ? {
            status: row.trial.status,
            outcome: row.trial.outcome,
            actionCount: row.trial.actionCount,
            blockedActionCount: row.trial.blockedActionCount,
            failedActionCount: row.trial.failedActionCount,
            safetyMaintained:
              row.trial.evaluationSummary?.safetyMaintained ?? null,
            timeToRecoveryMs: row.trial.timeToRecoveryMs,
            timeToEscalationMs: row.trial.timeToEscalationMs,
            measurement: row.trial.recoveryMeasurement
              ? {
                  unhealthyConfirmationDelayMs:
                    row.trial.recoveryMeasurement
                      .unhealthyConfirmationDelayMs,
                  timeToFirstActionMs:
                    row.trial.recoveryMeasurement.timeToFirstActionMs,
                  recoveryLoopDurationMs:
                    row.trial.recoveryMeasurement.recoveryLoopDurationMs,
                  observedTimeToHealMs:
                    row.trial.recoveryMeasurement.observedTimeToHealMs,
                  decisionCount:
                    row.trial.recoveryMeasurement.decisionCount,
                }
              : null,
            modelInvocations: row.trial.modelInvocations.map((invocation) => ({
              operation: invocation.operation,
              durationMs: invocation.durationMs,
              inputTokens: invocation.inputTokens,
              outputTokens: invocation.outputTokens,
              totalTokens: invocation.totalTokens,
              status: invocation.status,
            })),
          }
        : null,
    }));
  }
}

type StoredBatch = {
  id: string;
  name: string;
  status: ExperimentBatch["status"];
  sourceRevision: string;
  measurementVersion: string;
  configuration: unknown;
  requestedRepetitions: number;
  runOrderSeed: string;
  createdAt: Date;
  completedAt: Date | null;
};

type StoredRun = {
  id: string;
  batchId: string;
  faultProfile: ExperimentRun["faultProfile"];
  recoveryMode: ExperimentRun["recoveryMode"];
  repetition: number;
  status: ExperimentRun["status"];
  startedAt: Date;
  faultInjectedAt: Date | null;
  completedAt: Date | null;
  trialRecordId: string | null;
  valid: boolean | null;
  exclusionReason: string | null;
  runtimeResolved: boolean | null;
  oracleSucceeded: boolean | null;
  oracleCheckedAt: Date | null;
  oracleDetails: unknown;
  stabilityWindowMs: number;
  diagnosisCorrect: boolean | null;
  actionSequenceCorrect: boolean | null;
  unnecessaryActionCount: number | null;
  faultToDetectionMs: number | null;
  timeToHealMs: number | null;
  timeToTerminationMs: number | null;
};

function toBatch(row: StoredBatch): ExperimentBatch {
  return {
    ...row,
    configuration: row.configuration as ExperimentConfiguration,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toRun(row: StoredRun): ExperimentRun {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    faultInjectedAt: row.faultInjectedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    oracleCheckedAt: row.oracleCheckedAt?.toISOString() ?? null,
    oracleDetails: row.oracleDetails as Record<string, unknown> | null,
  };
}
