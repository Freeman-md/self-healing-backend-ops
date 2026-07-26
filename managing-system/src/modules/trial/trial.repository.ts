import { PrismaService } from "@/infrastructure/database";

import type { TrialRecord } from "./trial.types";
import { parseStoredTrialRecord } from "./trial.helpers";

export class TrialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveTrialRecord(trialRecord: TrialRecord): Promise<TrialRecord> {
    const parsed = parseStoredTrialRecord(trialRecord);
    const evidenceHistory = createEvidenceHistory(parsed);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.trialRecord.upsert({
        where: { id: parsed.id },
        create: {
          id: parsed.id,
          ...toTrialData(parsed),
          legacyPayload: null,
        },
        update: toTrialData(parsed),
      });

      await transaction.trialEvidenceSnapshot.deleteMany({
        where: { trialRecordId: parsed.id },
      });

      if (evidenceHistory.length > 0) {
        await transaction.trialEvidenceSnapshot.createMany({
          data: evidenceHistory.map((entry, sequenceNumber) => ({
            trialRecordId: parsed.id,
            evidenceSnapshotId: entry.evidenceSnapshotId,
            sequenceNumber,
            role: entry.role,
          })),
        });
      }
    });

    return parsed;
  }

  async findTrialRecordById(
    trialRecordId: string,
  ): Promise<TrialRecord | null> {
    const row = await this.prisma.trialRecord.findUnique({
      where: { id: trialRecordId },
      select: {
        id: true,
        scenarioId: true,
        recoveryMode: true,
        startedAt: true,
        completedAt: true,
        status: true,
        outcome: true,
        escalationReason: true,
        actionCount: true,
        blockedActionCount: true,
        failedActionCount: true,
        timeToRecoveryMs: true,
        timeToEscalationMs: true,
        notes: true,
        evidenceHistory: {
          select: {
            evidenceSnapshotId: true,
            role: true,
            sequenceNumber: true,
          },
          orderBy: { sequenceNumber: "asc" },
        },
        recoveryDecisions: {
          select: {
            id: true,
            diagnosisResultId: true,
            recoveryPlanId: true,
          },
          orderBy: { sequenceNumber: "asc" },
        },
        actionExecutionResults: {
          select: { id: true, actionId: true, status: true },
          orderBy: { startedAt: "asc" },
        },
        evaluationSummary: { select: { id: true } },
      },
    });

    if (!row) {
      return null;
    }

    const initialEvidence = row.evidenceHistory.find(
      (entry) => entry.role === "initial",
    );
    const finalEvidence = [...row.evidenceHistory]
      .reverse()
      .find((entry) => entry.role === "final");
    const actionResults = row.actionExecutionResults;

    return parseStoredTrialRecord({
      id: row.id,
      scenarioId: row.scenarioId,
      recoveryMode: row.recoveryMode,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      initialEvidenceSnapshotId: initialEvidence?.evidenceSnapshotId,
      finalEvidenceSnapshotId: finalEvidence?.evidenceSnapshotId,
      evidenceSnapshotIds: unique(
        row.evidenceHistory.map((entry) => entry.evidenceSnapshotId),
      ),
      recoveryDecisionIds: row.recoveryDecisions.map(
        (decision) => decision.id,
      ),
      diagnosisResultIds: row.recoveryDecisions.map(
        (decision) => decision.diagnosisResultId,
      ),
      recoveryPlanIds: row.recoveryDecisions.map(
        (decision) => decision.recoveryPlanId,
      ),
      diagnosisResultId: row.recoveryDecisions.at(-1)?.diagnosisResultId,
      recoveryPlanId: row.recoveryDecisions.at(-1)?.recoveryPlanId,
      selectedActionIds: actionResults.map((result) => result.actionId),
      actionExecutionResultIds: actionResults.map((result) => result.id),
      executedActionResultIds: actionResults
        .filter((result) => result.status === "executed")
        .map((result) => result.id),
      blockedActionIds: actionResults
        .filter((result) => result.status === "blocked")
        .map((result) => result.actionId),
      failedActionIds: actionResults
        .filter((result) => result.status === "failed")
        .map((result) => result.actionId),
      status: row.status,
      outcome: row.outcome,
      escalationReason: row.escalationReason ?? undefined,
      metrics: {
        actionCount: row.actionCount,
        blockedActionCount: row.blockedActionCount,
        failedActionCount: row.failedActionCount,
        timeToRecoveryMs: row.timeToRecoveryMs ?? undefined,
        timeToEscalationMs: row.timeToEscalationMs ?? undefined,
      },
      notes: row.notes ?? undefined,
      evaluationSummaryId: row.evaluationSummary?.id,
    });
  }
}

function toTrialData(trialRecord: TrialRecord) {
  return {
    scenarioId: trialRecord.scenarioId,
    recoveryMode: trialRecord.recoveryMode,
    startedAt: new Date(trialRecord.startedAt),
    completedAt: trialRecord.completedAt
      ? new Date(trialRecord.completedAt)
      : null,
    status: trialRecord.status,
    outcome: trialRecord.outcome,
    escalationReason: trialRecord.escalationReason ?? null,
    actionCount: trialRecord.metrics.actionCount,
    blockedActionCount: trialRecord.metrics.blockedActionCount,
    failedActionCount: trialRecord.metrics.failedActionCount,
    timeToRecoveryMs: trialRecord.metrics.timeToRecoveryMs ?? null,
    timeToEscalationMs: trialRecord.metrics.timeToEscalationMs ?? null,
    notes: trialRecord.notes ?? null,
  };
}

function createEvidenceHistory(
  trialRecord: TrialRecord,
): Array<{
  evidenceSnapshotId: string;
  role: "initial" | "intermediate" | "final";
}> {
  const initialId =
    trialRecord.initialEvidenceSnapshotId ??
    trialRecord.evidenceSnapshotIds.at(0);
  const finalId =
    trialRecord.finalEvidenceSnapshotId ??
    trialRecord.evidenceSnapshotIds.at(-1);
  const history: Array<{
    evidenceSnapshotId: string;
    role: "initial" | "intermediate" | "final";
  }> = [];

  if (initialId) {
    history.push({ evidenceSnapshotId: initialId, role: "initial" });
  }

  for (const evidenceSnapshotId of trialRecord.evidenceSnapshotIds) {
    if (
      evidenceSnapshotId !== initialId &&
      evidenceSnapshotId !== finalId
    ) {
      history.push({ evidenceSnapshotId, role: "intermediate" });
    }
  }

  if (finalId && trialRecord.completedAt) {
    history.push({ evidenceSnapshotId: finalId, role: "final" });
  }

  return history;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
