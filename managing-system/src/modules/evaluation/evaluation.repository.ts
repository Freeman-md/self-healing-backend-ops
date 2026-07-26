import { PrismaService } from "@/infrastructure/database";

import {
  evaluationSummarySchema,
  type EvaluationSummary,
} from "./evaluation.schema";

export class EvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveEvaluationSummary(
    summary: EvaluationSummary,
  ): Promise<EvaluationSummary> {
    const parsed = evaluationSummarySchema.parse(summary);
    const data = {
      trialRecordId: parsed.trialRecordId,
      createdAt: new Date(parsed.createdAt),
      summary: parsed.summary,
      recoverySucceeded: parsed.recoverySucceeded,
      safetyMaintained: parsed.safetyMaintained,
      actionEffectiveness: parsed.actionEffectiveness,
      lessons: parsed.lessons,
      recommendedChanges: parsed.recommendedChanges,
    };

    await this.prisma.evaluationSummary.upsert({
      where: { id: parsed.id },
      create: { id: parsed.id, ...data, legacyPayload: null },
      update: data,
    });

    return parsed;
  }

  async findEvaluationSummaryByTrialRecordId(
    trialRecordId: string,
  ): Promise<EvaluationSummary | null> {
    const row = await this.prisma.evaluationSummary.findUnique({
      where: { trialRecordId },
      select: {
        id: true,
        trialRecordId: true,
        createdAt: true,
        summary: true,
        recoverySucceeded: true,
        safetyMaintained: true,
        actionEffectiveness: true,
        lessons: true,
        recommendedChanges: true,
      },
    });

    return row
      ? evaluationSummarySchema.parse({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })
      : null;
  }
}
