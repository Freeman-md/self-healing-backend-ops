import { PrismaService } from "@/infrastructure/database";

import { recoveryDecisionSchema, type RecoveryDecision } from "./recovery.schema";
import type { BaselineRule } from "./recovery.baseline.rules";

export class RecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveRecoveryDecisionHistory(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): Promise<RecoveryDecision> {
    const { trialRecordId, sequenceNumber } = input;

    const recoveryDecision = recoveryDecisionSchema.parse(input.recoveryDecision);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.diagnosisResult.upsert({
        where: { id: recoveryDecision.diagnosisResult.id },
        create: {
          id: recoveryDecision.diagnosisResult.id,
          trialRecordId,
          evidenceSnapshotId: recoveryDecision.diagnosisResult.evidenceSnapshotId,
          createdAt: new Date(recoveryDecision.diagnosisResult.createdAt),
          method: recoveryDecision.diagnosisResult.method,
          incidentCode: recoveryDecision.diagnosisResult.suspectedIncidentType,
          severity: recoveryDecision.diagnosisResult.severity,
          confidence: recoveryDecision.diagnosisResult.confidence,
          reasoningSummary: recoveryDecision.diagnosisResult.reasoningSummary,
          sourceIds: recoveryDecision.diagnosisResult.sourceIds,
          supportingSignals: recoveryDecision.diagnosisResult.supportingSignals,
          contradictions: recoveryDecision.diagnosisResult.contradictions,
          legacyPayload: null,
        },
        update: {
          trialRecordId,
          evidenceSnapshotId: recoveryDecision.diagnosisResult.evidenceSnapshotId,
          createdAt: new Date(recoveryDecision.diagnosisResult.createdAt),
          method: recoveryDecision.diagnosisResult.method,
          incidentCode: recoveryDecision.diagnosisResult.suspectedIncidentType,
          severity: recoveryDecision.diagnosisResult.severity,
          confidence: recoveryDecision.diagnosisResult.confidence,
          reasoningSummary: recoveryDecision.diagnosisResult.reasoningSummary,
          sourceIds: recoveryDecision.diagnosisResult.sourceIds,
          supportingSignals: recoveryDecision.diagnosisResult.supportingSignals,
          contradictions: recoveryDecision.diagnosisResult.contradictions,
        },
      });

      await transaction.recoveryPlan.upsert({
        where: { id: recoveryDecision.recoveryPlan.id },
        create: {
          id: recoveryDecision.recoveryPlan.id,
          trialRecordId,
          diagnosisResultId: recoveryDecision.diagnosisResult.id,
          createdAt: new Date(recoveryDecision.recoveryPlan.createdAt),
          rationale: recoveryDecision.recoveryPlan.rationale,
          expectedOutcome: recoveryDecision.recoveryPlan.expectedOutcome,
          escalationReason: recoveryDecision.recoveryPlan.escalationReason,
          legacyPayload: null,
        },
        update: {
          trialRecordId,
          diagnosisResultId: recoveryDecision.diagnosisResult.id,
          createdAt: new Date(recoveryDecision.recoveryPlan.createdAt),
          rationale: recoveryDecision.recoveryPlan.rationale,
          expectedOutcome: recoveryDecision.recoveryPlan.expectedOutcome,
          escalationReason: recoveryDecision.recoveryPlan.escalationReason,
        },
      });

      await transaction.recoveryPlanAction.deleteMany({
        where: { recoveryPlanId: recoveryDecision.recoveryPlan.id },
      });

      const planActions = [
        ...recoveryDecision.recoveryPlan.proposedActionIds.map((actionId, position) => ({
          recoveryPlanId: recoveryDecision.recoveryPlan.id,
          actionId,
          phase: "proposed" as const,
          position,
        })),
        ...recoveryDecision.recoveryPlan.fallbackActionIds.map((actionId, position) => ({
          recoveryPlanId: recoveryDecision.recoveryPlan.id,
          actionId,
          phase: "fallback" as const,
          position,
        })),
      ];

      if (planActions.length > 0) {
        await transaction.recoveryPlanAction.createMany({ data: planActions });
      }

      await transaction.recoveryDecision.upsert({
        where: { id: recoveryDecision.id },
        create: {
          id: recoveryDecision.id,
          trialRecordId,
          sequenceNumber,
          recoveryMode: recoveryDecision.mode,
          snapshotId: recoveryDecision.snapshotId,
          decidedAt: new Date(recoveryDecision.decidedAt),
          status: recoveryDecision.status,
          reason: recoveryDecision.reason,
          escalationReason: recoveryDecision.escalationReason ?? null,
          diagnosisResultId: recoveryDecision.diagnosisResult.id,
          recoveryPlanId: recoveryDecision.recoveryPlan.id,
          legacyPayload: null,
        },
        update: {
          trialRecordId,
          sequenceNumber,
          recoveryMode: recoveryDecision.mode,
          snapshotId: recoveryDecision.snapshotId,
          decidedAt: new Date(recoveryDecision.decidedAt),
          status: recoveryDecision.status,
          reason: recoveryDecision.reason,
          escalationReason: recoveryDecision.escalationReason ?? null,
          diagnosisResultId: recoveryDecision.diagnosisResult.id,
          recoveryPlanId: recoveryDecision.recoveryPlan.id,
        },
      });
    });

    return recoveryDecision;
  }

  async findRecoveryDecisionsByTrialRecordId(trialRecordId: string): Promise<RecoveryDecision[]> {
    const rows = await this.prisma.recoveryDecision.findMany({
      where: { trialRecordId },
      select: {
        id: true,
        recoveryMode: true,
        snapshotId: true,
        decidedAt: true,
        status: true,
        reason: true,
        escalationReason: true,
        diagnosisResult: {
          select: {
            id: true,
            evidenceSnapshotId: true,
            createdAt: true,
            method: true,
            sourceIds: true,
            incidentCode: true,
            severity: true,
            confidence: true,
            reasoningSummary: true,
            supportingSignals: true,
            contradictions: true,
          },
        },
        recoveryPlan: {
          select: {
            id: true,
            diagnosisResultId: true,
            createdAt: true,
            rationale: true,
            expectedOutcome: true,
            escalationReason: true,
            actions: {
              select: {
                actionId: true,
                phase: true,
                position: true,
              },
              orderBy: [{ phase: "asc" }, { position: "asc" }],
            },
          },
        },
      },
      orderBy: { sequenceNumber: "asc" },
    });

    return rows.map((row) =>
      recoveryDecisionSchema.parse({
        id: row.id,
        mode: row.recoveryMode,
        snapshotId: row.snapshotId,
        decidedAt: row.decidedAt.toISOString(),
        status: row.status,
        reason: row.reason,
        escalationReason: row.escalationReason ?? undefined,
        diagnosisResult: {
          id: row.diagnosisResult.id,
          evidenceSnapshotId: row.diagnosisResult.evidenceSnapshotId,
          createdAt: row.diagnosisResult.createdAt.toISOString(),
          method: row.diagnosisResult.method,
          sourceIds: row.diagnosisResult.sourceIds,
          suspectedIncidentType: row.diagnosisResult.incidentCode,
          severity: row.diagnosisResult.severity,
          confidence: row.diagnosisResult.confidence,
          reasoningSummary: row.diagnosisResult.reasoningSummary,
          supportingSignals: row.diagnosisResult.supportingSignals,
          contradictions: row.diagnosisResult.contradictions,
        },
        recoveryPlan: {
          id: row.recoveryPlan.id,
          diagnosisResultId: row.recoveryPlan.diagnosisResultId,
          createdAt: row.recoveryPlan.createdAt.toISOString(),
          proposedActionIds: row.recoveryPlan.actions
            .filter((action) => action.phase === "proposed")
            .map((action) => action.actionId),
          fallbackActionIds: row.recoveryPlan.actions
            .filter((action) => action.phase === "fallback")
            .map((action) => action.actionId),
          rationale: row.recoveryPlan.rationale,
          expectedOutcome: row.recoveryPlan.expectedOutcome,
          escalationReason: row.recoveryPlan.escalationReason,
        },
      }),
    );
  }

  async listActiveBaselineRules(): Promise<BaselineRule[]> {
    const rows = await this.prisma.baselineRule.findMany({
      where: { active: true },
      select: {
        id: true,
        description: true,
        incidentCode: true,
        severity: true,
        expectedOutcome: true,
        priority: true,
        version: true,
        conditionGroups: {
          select: {
            matchMode: true,
            position: true,
            conditions: {
              select: {
                signalCode: true,
                operator: true,
                expectedStatus: true,
                position: true,
              },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
        actions: {
          select: { actionId: true, phase: true, position: true },
          orderBy: [{ phase: "asc" }, { position: "asc" }],
        },
      },
      orderBy: { priority: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      description: row.description,
      incidentType: row.incidentCode,
      severity: row.severity,
      expectedOutcome: row.expectedOutcome,
      priority: row.priority,
      version: row.version,
      proposedActionIds: row.actions
        .filter((action) => action.phase === "proposed")
        .map((action) => action.actionId),
      fallbackActionIds: row.actions
        .filter((action) => action.phase === "fallback")
        .map((action) => action.actionId),
      conditionGroups: row.conditionGroups.map((group) => ({
        matchMode: group.matchMode,
        conditions: group.conditions.map((condition) => ({
          signalCode: condition.signalCode,
          operator: condition.operator,
          expectedStatus: condition.expectedStatus,
        })),
      })),
    }));
  }
}
