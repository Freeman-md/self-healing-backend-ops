import { OpenAIService } from "@/infrastructure/openai";
import type { OpenAITelemetryContext } from "@/infrastructure/openai";
import type { EvidenceSnapshot } from "@/modules/evidence";

import {
  diagnosisResultSchema,
  recoveryPlanSchema,
  type DiagnosisResult,
} from "../../recovery.schema";

export class RecoveryAgentV1Service {
  constructor(private readonly openaiService = new OpenAIService()) {}

  async diagnose(
    evidenceSnapshot: EvidenceSnapshot,
    telemetryContext?: Pick<OpenAITelemetryContext, "trialRecordId">,
  ): Promise<DiagnosisResult> {
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
      telemetryContext: {
        operation: "diagnosis",
        trialRecordId: telemetryContext?.trialRecordId,
        evidenceSnapshotId: evidenceSnapshot.id,
      },
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

  async diagnoseEvidence(
    evidenceSnapshot: EvidenceSnapshot,
    telemetryContext?: Pick<OpenAITelemetryContext, "trialRecordId">,
  ): Promise<DiagnosisResult> {
    return this.diagnose(evidenceSnapshot, telemetryContext);
  }

  async createRecoveryPlan(input: {
    evidenceSnapshot: EvidenceSnapshot;
    diagnosisResult: DiagnosisResult;
    availableActions: Array<{
      id: string;
      name: string;
      description: string;
      riskLevel: string;
      expectedOutcome: unknown;
    }>;
    trialRecordId?: string;
  }) {
    const createdAt = new Date().toISOString();

    return this.openaiService.parseStructuredOutput({
      schema: recoveryPlanSchema,
      schemaName: "recovery_plan",
      systemPrompt: "Create a bounded recovery plan using only the provided action IDs.",
      userPrompt: JSON.stringify({
        requiredRecoveryPlanValues: {
          id: `recovery-plan-${createdAt}`,
          diagnosisResultId: input.diagnosisResult.id,
          createdAt,
        },
        ...input,
      }),
      telemetryContext: {
        operation: "recovery_planning",
        trialRecordId: input.trialRecordId,
        evidenceSnapshotId: input.evidenceSnapshot.id,
      },
    });
  }
}
