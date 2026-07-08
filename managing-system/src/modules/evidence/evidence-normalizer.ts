import { evidenceSnapshotSchema } from "@/schemas";
import { OpenAIService } from "@/services/openai";
import type { EvidenceSnapshot, RawEvidence } from "@/types";

export class EvidenceNormalizer {
  constructor(private readonly openaiService = new OpenAIService()) {}

  async normalize(rawEvidence: RawEvidence[]): Promise<EvidenceSnapshot> {
    const createdAt = new Date().toISOString();
    const snapshotId = `snapshot-${createdAt}`;

    return this.openaiService.parseStructuredOutput({
      schema: evidenceSnapshotSchema,
      schemaName: "evidence_snapshot",
      systemPrompt: [
        "You normalize raw operational evidence from a managed backend system.",
        "Return only a structured EvidenceSnapshot matching the schema.",
        "Do not recommend recovery actions.",
        "Do not diagnose beyond suspected incident type labels.",
        "Classify overallState as healthy, degraded, unhealthy, or unknown.",
      ].join(" "),
      userPrompt: JSON.stringify({
        requiredSnapshotValues: {
          id: snapshotId,
          rawEvidenceIds: rawEvidence.map((item) => item.id),
          createdAt,
          targetSystem: "managed-system",
        },
        rawEvidence,
      }),
    });
  }
}
