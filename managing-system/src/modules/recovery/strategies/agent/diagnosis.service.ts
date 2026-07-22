import { OpenAIService } from "@/infrastructure/openai";
import type { EvidenceSnapshot } from "@/modules/evidence";

import {
  diagnosisResultSchema,
  type DiagnosisResult,
} from "../../recovery.schema";

export class DiagnosisService {
  constructor(private readonly openaiService = new OpenAIService()) {}

  async diagnose(evidenceSnapshot: EvidenceSnapshot): Promise<DiagnosisResult> {
    const createdAt = new Date().toISOString();
    const diagnosisId = `diagnosis-${createdAt}`;

    const diagnosisResult = await this.openaiService.parseStructuredOutput({
      schema: diagnosisResultSchema,
      schemaName: "diagnosis_result",
      systemPrompt: [
        "You diagnose operational incidents in a controlled backend testbed.",
        "Return only a structured DiagnosisResult matching the schema.",
        "Use the provided evidence snapshot only.",
        "Be conservative and avoid inventing unavailable evidence.",
      ].join(" "),
      userPrompt: JSON.stringify({
        requiredDiagnosisValues: {
          id: diagnosisId,
          evidenceSnapshotId: evidenceSnapshot.id,
          createdAt,
          method: "llm",
          sourceIds: [],
        },
        evidenceSnapshot,
      }),
    });

    return {
      ...diagnosisResult,
      id: diagnosisId,
      evidenceSnapshotId: evidenceSnapshot.id,
      createdAt,
      method: "llm",
      sourceIds: [],
    };
  }
}
