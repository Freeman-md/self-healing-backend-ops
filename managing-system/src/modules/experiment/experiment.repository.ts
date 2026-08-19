import {
  Prisma,
  type ExperimentBatch,
  type ExperimentBatchStatus,
  type ExperimentRun,
  type FaultProfileCode,
} from "@/generated/prisma/client";
import { PrismaService } from "@/infrastructure/database";
import type {
  ExperimentConfiguration,
  ExperimentRunReportData,
  ExperimentTrialCandidate,
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
    createdAt: Date;
  }): Promise<ExperimentBatch> {
    return this.prisma.experimentBatch.create({
      data: {
        id: input.id,
        name: input.name,
        status: "active",
        sourceRevision: input.sourceRevision,
        measurementVersion: input.measurementVersion,
        configuration: input.configuration as Prisma.InputJsonValue,
        requestedRepetitions: input.requestedRepetitions,
        runOrderSeed: input.runOrderSeed,
        createdAt: input.createdAt,
      },
    });
  }

  async getActiveExperimentConfigurationInputs() {
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
    status: ExperimentBatchStatus,
    completedAt: Date,
  ): Promise<ExperimentBatch> {
    return this.prisma.experimentBatch.update({
      where: { id: batchId },
      data: { status, completedAt },
    });
  }

  async findExperimentBatch(batchId: string): Promise<ExperimentBatch | null> {
    return this.prisma.experimentBatch.findUnique({
      where: { id: batchId },
    });
  }

  async createExperimentRun(input: {
    id: string;
    batchId: string;
    faultProfile: FaultProfileCode;
    recoveryMode: RecoveryMode;
    repetition: number;
    startedAt: Date;
    stabilityWindowMs: number;
  }): Promise<ExperimentRun> {
    try {
      return await this.prisma.experimentRun.create({
        data: {
          id: input.id,
          batchId: input.batchId,
          faultProfile: input.faultProfile,
          recoveryMode: input.recoveryMode,
          repetition: input.repetition,
          status: "prepared",
          activeLockKey: "global",
          startedAt: input.startedAt,
          stabilityWindowMs: input.stabilityWindowMs,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Another controlled experiment run is already active.");
      }

      throw error;
    }
  }

  async markFaultInjected(runId: string, faultInjectedAt: Date): Promise<ExperimentRun> {
    return this.prisma.experimentRun.update({
      where: { id: runId },
      data: {
        status: "fault_injected",
        faultInjectedAt,
      },
    });
  }

  async findCompletedMonitorTrials(input: {
    recoveryMode: RecoveryMode;
    startedAfter: Date;
  }): Promise<ExperimentTrialCandidate[]> {
    const rows = await this.prisma.trialRecord.findMany({
      where: {
        triggerSource: "monitor",
        recoveryMode: input.recoveryMode,
        startedAt: { gte: input.startedAfter },
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
              row.recoveryMeasurement.firstUnhealthyObservedAt?.toISOString() ?? null,
            recoveryTriggeredAt: row.recoveryMeasurement.recoveryTriggeredAt.toISOString(),
            recoveryVerifiedAt: row.recoveryMeasurement.recoveryVerifiedAt?.toISOString() ?? null,
          }
        : null,
      diagnosisIncidentCodes: row.diagnosisResults.map((diagnosis) => diagnosis.incidentCode),
      actionIds: row.actionExecutionResults.map((result) => result.actionId),
    }));
  }

  async linkExperimentRunToTrial(runId: string, trialRecordId: string): Promise<ExperimentRun> {
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

    return row;
  }

  async completeExperimentRun(input: {
    runId: string;
    completedAt: Date;
    runtimeResolved: boolean;
    oracle: RecoveryOracleResult;
    diagnosisCorrect: boolean;
    actionSequenceCorrect: boolean;
    unnecessaryActionCount: number;
    faultToDetectionMs: number | null;
    timeToHealMs: number | null;
    timeToTerminationMs: number;
  }): Promise<ExperimentRun> {
    return this.prisma.experimentRun.update({
      where: { id: input.runId },
      data: {
        status: "completed",
        activeLockKey: null,
        completedAt: input.completedAt,
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
    });
  }

  async invalidateExperimentRun(
    runId: string,
    reason: string,
    completedAt: Date,
  ): Promise<ExperimentRun> {
    return this.prisma.experimentRun.update({
      where: { id: runId },
      data: {
        status: "invalid",
        activeLockKey: null,
        valid: false,
        exclusionReason: reason,
        completedAt,
      },
    });
  }

  async listExperimentRunReportData(batchId: string): Promise<ExperimentRunReportData[]> {
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
      ...row,
      trial: row.trial
        ? {
            status: row.trial.status,
            outcome: row.trial.outcome,
            actionCount: row.trial.actionCount,
            blockedActionCount: row.trial.blockedActionCount,
            failedActionCount: row.trial.failedActionCount,
            safetyMaintained: row.trial.evaluationSummary?.safetyMaintained ?? null,
            timeToRecoveryMs: row.trial.timeToRecoveryMs,
            timeToEscalationMs: row.trial.timeToEscalationMs,
            measurement: row.trial.recoveryMeasurement
              ? {
                  unhealthyConfirmationDelayMs:
                    row.trial.recoveryMeasurement.unhealthyConfirmationDelayMs,
                  timeToFirstActionMs: row.trial.recoveryMeasurement.timeToFirstActionMs,
                  recoveryLoopDurationMs: row.trial.recoveryMeasurement.recoveryLoopDurationMs,
                  observedTimeToHealMs: row.trial.recoveryMeasurement.observedTimeToHealMs,
                  decisionCount: row.trial.recoveryMeasurement.decisionCount,
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
