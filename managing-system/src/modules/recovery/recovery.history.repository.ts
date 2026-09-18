import { z } from "zod/v4";
import { PrismaService } from "@/infrastructure/database";
import { getDeterministicEvidenceState, type EvidenceService } from "@/modules/evidence";
import type { RecoveryService } from "./recovery.service";
import type { RecoveryDecision } from "./recovery.schema";
import { recoveryEvidenceSignature } from "./recovery.history.helpers";

export class RecoveryHistoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: Pick<RecoveryService, "findRecoveryDecisionHistory">,
    private readonly evidence: Pick<EvidenceService, "findEvidenceSnapshotById">,
  ) {}

  async findActiveExperiment() {
    return this.prisma.experimentRun.findUnique({
      where: { activeLockKey: "global" },
      select: { id: true, manifest: { select: { configuration: true } } },
    });
  }

  async createEpisode(input: {
    trialRecordId: string;
    origin: "normal" | "experiment" | "unknown";
    experimentRunId: string | null;
    compatibilityFingerprint: string;
    corpusSourceIds: string[];
    retrievalEnabled: boolean;
    runtimeIdentity?: Record<string, string | number>;
  }): Promise<void> {
    const { runtimeIdentity, ...episode } = input;

    await this.prisma.recoveryEpisode.create({
      data: {
        ...episode,
        configuration: {
          measurementVersion: "2.0.0",
          protocol: "structured-exact-v1",
          runtimeIdentity: runtimeIdentity ?? null,
        },
        createdAt: new Date(),
      },
    });
  }

  async recordDiagnosis(input: {
    trialRecordId: string;
    diagnosisResultId: string;
    signature: string | null;
    diagnosisReadyAt: Date;
  }): Promise<void> {
    await this.prisma.recoveryStep.create({ data: input });
  }

  async recordLookup(
    diagnosisResultId: string,
    input: { lookupStartedAt: Date; lookupCompletedAt: Date; lookupOutcome: string },
  ): Promise<void> {
    await this.prisma.recoveryStep.update({ where: { diagnosisResultId }, data: input });
  }

  async recordPlan(
    trialRecordId: string,
    decision: RecoveryDecision,
    signature: string | null,
    source?: { sourceTrialId: string; sourcePlanId: string },
    persistedAt = new Date(),
  ): Promise<void> {
    const existing = await this.prisma.recoveryStep.findUnique({
      where: { diagnosisResultId: decision.diagnosisResult.id },
    });

    const readyAt = existing?.planReadyAt ?? persistedAt;

    const data = {
      planId: decision.recoveryPlan.id,
      decisionId: decision.id,
      planReadyAt: readyAt,
      planOrigin: source ? "retrieved" : "generated",
      sourceTrialId: source?.sourceTrialId,
      sourcePlanId: source?.sourcePlanId,
    };

    await this.prisma.recoveryStep.upsert({
      where: { diagnosisResultId: decision.diagnosisResult.id },
      create: {
        trialRecordId,
        diagnosisResultId: decision.diagnosisResult.id,
        signature,
        diagnosisReadyAt: readyAt,
        ...data,
      },
      update: data,
    });
  }

  async recordExecution(decision: RecoveryDecision, executionResultId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const step = await transaction.recoveryStep.findUniqueOrThrow({
        where: { diagnosisResultId: decision.diagnosisResult.id },
      });

      const ids = z.array(z.string()).parse(step.executionResultIds);

      if (!ids.includes(executionResultId)) {
        ids.push(executionResultId);
      }

      await transaction.recoveryStep.update({
        where: { diagnosisResultId: step.diagnosisResultId },
        data: { executionResultIds: ids },
      });
    });
  }

  async findCandidate(input: {
    currentTrialId: string;
    sourceIds: string[];
    signature: string;
    fingerprint: string;
  }): Promise<{ sourceTrialId: string; sourcePlanId: string; decision: RecoveryDecision } | null> {
    if (input.sourceIds.length === 0) {
      return null;
    }

    const candidates = await this.prisma.recoveryCase.findMany({
      where: {
        sourceTrialId: { in: input.sourceIds.filter((id) => id !== input.currentTrialId) },
        step: {
          signature: input.signature,
          episode: { compatibilityFingerprint: input.fingerprint },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { sourcePlanId: "asc" }],
      take: 1,
    });

    for (const candidate of candidates) {
      const decision = await this.validateEligiblePlan(
        candidate.sourceTrialId,
        candidate.sourcePlanId,
        input.signature,
        input.fingerprint,
      );

      if (decision) {
        return {
          sourceTrialId: candidate.sourceTrialId,
          sourcePlanId: candidate.sourcePlanId,
          decision,
        };
      }
    }

    return null;
  }

  async validateEligiblePlan(
    trialRecordId: string,
    planId: string,
    signature?: string,
    fingerprint?: string,
  ): Promise<RecoveryDecision | null> {
    const trial = await this.prisma.trialRecord.findUnique({
      where: { id: trialRecordId },
      include: {
        historyEpisode: true,
        experimentRun: true,
        evidenceHistory: { where: { role: "final" } },
        actionExecutionResults: { orderBy: { startedAt: "asc" } },
      },
    });

    if (
      !trial ||
      !trial.completedAt ||
      trial.status !== "resolved" ||
      trial.outcome !== "resolved_safely" ||
      !trial.historyEpisode
    ) {
      return null;
    }

    const episode = trial.historyEpisode;

    if (episode.origin !== "normal" && episode.origin !== "experiment") {
      return null;
    }

    if (fingerprint && episode.compatibilityFingerprint !== fingerprint) {
      return null;
    }

    if (
      episode.origin === "experiment" &&
      (!trial.experimentRun ||
        trial.experimentRun.id !== episode.experimentRunId ||
        !trial.experimentRun.valid ||
        !trial.experimentRun.oracleSucceeded ||
        trial.experimentRun.status !== "completed")
    ) {
      return null;
    }

    const finalId = trial.evidenceHistory[0]?.evidenceSnapshotId;

    const final = finalId ? await this.evidence.findEvidenceSnapshotById(finalId) : null;

    if (!final || getDeterministicEvidenceState(final) !== "healthy") {
      return null;
    }

    if (
      trial.actionExecutionResults.some(
        (result) =>
          result.status !== "executed" ||
          result.safetyCheckStatus !== "passed" ||
          result.expectedOutcomeMet !== true ||
          !Array.isArray(result.failedSafetyRuleIds) ||
          result.failedSafetyRuleIds.length !== 0,
      )
    ) {
      return null;
    }

    const step = await this.prisma.recoveryStep.findUnique({ where: { planId } });

    if (
      !step ||
      step.trialRecordId !== trialRecordId ||
      !step.signature ||
      (signature && step.signature !== signature)
    ) {
      return null;
    }

    const decision = (await this.recovery.findRecoveryDecisionHistory(trialRecordId)).find(
      (entry) => entry.recoveryPlan.id === planId,
    );

    if (
      !decision ||
      decision.status !== "action_selected" ||
      decision.id !== step.decisionId ||
      decision.diagnosisResult.id !== step.diagnosisResultId
    ) {
      return null;
    }

    const before = await this.evidence.findEvidenceSnapshotById(decision.snapshotId);

    if (
      !before ||
      recoveryEvidenceSignature(before, decision.diagnosisResult.suspectedIncidentType) !==
        step.signature
    ) {
      return null;
    }

    if (
      decision.recoveryPlan.rationale.length > 2000 ||
      decision.recoveryPlan.expectedOutcome.length > 2000 ||
      decision.recoveryPlan.escalationReason !== null
    ) {
      return null;
    }

    const executionIds = z.array(z.string()).max(3).parse(step.executionResultIds);

    if (new Set(executionIds).size !== executionIds.length) {
      return null;
    }

    const results = executionIds.map((id) =>
      trial.actionExecutionResults.find((entry) => entry.id === id),
    );

    if (
      results.some(
        (result, index) =>
          !result ||
          !result.afterEvidenceSnapshotId ||
          result.beforeEvidenceSnapshotId !==
            (index === 0 ? decision.snapshotId : results[index - 1]?.afterEvidenceSnapshotId) ||
          result.startedAt.getTime() < new Date(decision.recoveryPlan.createdAt).getTime(),
      )
    ) {
      return null;
    }

    const planned = [
      ...decision.recoveryPlan.proposedActionIds,
      ...decision.recoveryPlan.fallbackActionIds,
    ];

    if (
      planned.length === 0 ||
      planned.length !== results.length ||
      results.some((result, index) => !result || result.actionId !== planned[index])
    ) {
      return null;
    }

    return decision;
  }

  async publishEligibleTrial(trialRecordId: string): Promise<void> {
    const steps = await this.prisma.recoveryStep.findMany({
      where: { trialRecordId, planId: { not: null } },
    });

    for (const step of steps) {
      if (!step.planId || !(await this.validateEligiblePlan(trialRecordId, step.planId))) {
        continue;
      }

      await this.prisma.recoveryCase.upsert({
        where: { sourcePlanId: step.planId },
        create: {
          sourcePlanId: step.planId,
          sourceTrialId: trialRecordId,
          diagnosisResultId: step.diagnosisResultId,
          publishedAt: new Date(),
        },
        update: {},
      });
    }
  }
}
