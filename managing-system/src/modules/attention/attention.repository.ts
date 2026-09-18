import { PrismaService } from "@/infrastructure/database";
import { z } from "zod/v4";

export const attentionSchema = z.object({
  id: z.string(),
  trialRecordId: z.string(),
  signature: z.string(),
  initialEvidenceSnapshotId: z.string(),
  latestEvidenceSnapshotId: z.string(),
  diagnosisResultId: z.string().nullable(),
  decisionId: z.string().nullable(),
  reason: z.string(),
  state: z.enum(["requires_attention", "acknowledged", "reviewed"]),
  createdAt: z.date(),
  acknowledgedAt: z.date().nullable(),
  reviewedAt: z.date().nullable(),
  notes: z.string().nullable(),
  releasedAt: z.date().nullable(),
  healthyEvidenceSnapshotId: z.string().nullable(),
});
export type RecoveryAttention = z.infer<typeof attentionSchema>;

export class AttentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAttention(
    input: Pick<
      RecoveryAttention,
      | "id"
      | "trialRecordId"
      | "signature"
      | "initialEvidenceSnapshotId"
      | "latestEvidenceSnapshotId"
      | "diagnosisResultId"
      | "decisionId"
      | "reason"
      | "createdAt"
    >,
  ): Promise<RecoveryAttention> {
    const diagnosis =
      input.diagnosisResultId ??
      (
        await this.prisma.diagnosisResult.findFirst({
          where: { trialRecordId: input.trialRecordId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      )?.id ??
      null;

    return attentionSchema.parse(
      await this.prisma.recoveryAttention.create({
        data: { ...input, diagnosisResultId: diagnosis },
      }),
    );
  }

  async listAttention(limit = 50): Promise<RecoveryAttention[]> {
    return z.array(attentionSchema).parse(
      await this.prisma.recoveryAttention.findMany({
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
  }

  async readAttention(id: string): Promise<RecoveryAttention> {
    return attentionSchema.parse(
      await this.prisma.recoveryAttention.findUniqueOrThrow({ where: { id } }),
    );
  }

  async transitionAttention(
    id: string,
    expected: "requires_attention" | "acknowledged",
    next: "acknowledged" | "reviewed",
    notes?: string,
  ): Promise<RecoveryAttention> {
    const result = await this.prisma.recoveryAttention.updateMany({
      where: { id, state: expected },
      data: {
        state: next,
        ...(next === "acknowledged"
          ? { acknowledgedAt: new Date() }
          : { reviewedAt: new Date(), notes }),
      },
    });

    if (result.count !== 1) {
      throw new Error("Attention state transition rejected.");
    }

    return this.readAttention(id);
  }

  async observeIncident(signature: string, evidenceId: string, healthy: boolean): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      // An interrupted durable write must remain fail-closed across a process restart.
      const missingAttention = await transaction.trialRecord.count({
        where: { status: "escalated", historyEpisode: { isNot: null }, attention: { is: null } },
      });

      if (missingAttention > 0) {
        throw new Error("Escalated trial is missing durable attention; operator repair required.");
      }

      if (healthy) {
        await transaction.recoveryAttention.updateMany({
          where: { releasedAt: null },
          data: {
            releasedAt: new Date(),
            healthyEvidenceSnapshotId: evidenceId,
            latestEvidenceSnapshotId: evidenceId,
          },
        });

        return false;
      }

      const updated = await transaction.recoveryAttention.updateMany({
        where: { signature, releasedAt: null },
        data: { latestEvidenceSnapshotId: evidenceId },
      });

      return updated.count > 0;
    });
  }
}
