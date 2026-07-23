import { OpenAIService } from "@/infrastructure/openai";
import type { EvidenceSnapshot } from "@/modules/evidence";

import {
  diagnosisResultSchema,
  recoveryPlanSchema,
  type DiagnosisResult,
} from "./recovery.schema";

export class RecoveryAgentService {
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

  async diagnoseEvidence(evidenceSnapshot: EvidenceSnapshot): Promise<DiagnosisResult> { return this.diagnose(evidenceSnapshot); }

  async createRecoveryPlan(input: { evidenceSnapshot: EvidenceSnapshot; diagnosisResult: DiagnosisResult; availableActions: Array<{ id: string; name: string; description: string; riskLevel: string; expectedOutcome: unknown }> }) {
    const createdAt = new Date().toISOString();
    return this.openaiService.parseStructuredOutput({
      schema: recoveryPlanSchema,
      schemaName: "recovery_plan",
      systemPrompt: "Create a bounded recovery plan using only the provided action IDs.",
      userPrompt: JSON.stringify({ requiredRecoveryPlanValues: { id: `recovery-plan-${createdAt}`, diagnosisResultId: input.diagnosisResult.id, createdAt }, ...input }),
    });
  }
}
