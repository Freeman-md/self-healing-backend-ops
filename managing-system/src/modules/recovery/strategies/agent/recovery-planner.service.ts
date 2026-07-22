import { OpenAIService } from "@/infrastructure/openai";
import type { ActionDefinition } from "@/modules/actions";
import type { EvidenceSnapshot } from "@/modules/evidence";

import {
  recoveryPlanSchema,
  type DiagnosisResult,
  type RecoveryPlan,
} from "../../recovery.schema";

export class RecoveryPlannerService {
  constructor(private readonly openaiService = new OpenAIService()) {}

  async plan(input: {
    evidenceSnapshot: EvidenceSnapshot;
    diagnosisResult: DiagnosisResult;
    availableActions: ActionDefinition[];
  }): Promise<RecoveryPlan> {
    const createdAt = new Date().toISOString();
    const recoveryPlanId = `recovery-plan-${createdAt}`;

    return this.openaiService.parseStructuredOutput({
      schema: recoveryPlanSchema,
      schemaName: "recovery_plan",
      systemPrompt: [
        "You create a bounded recovery plan for a controlled backend testbed.",
        "Return only a structured RecoveryPlan matching the schema.",
        "Choose only from the provided action IDs.",
        "If no safe bounded action is suitable, leave proposedActionIds empty and provide an escalationReason.",
      ].join(" "),
      userPrompt: JSON.stringify({
        requiredRecoveryPlanValues: {
          id: recoveryPlanId,
          diagnosisResultId: input.diagnosisResult.id,
          createdAt,
        },
        evidenceSnapshot: input.evidenceSnapshot,
        diagnosisResult: input.diagnosisResult,
        availableActions: input.availableActions.map((action) => ({
          id: action.id,
          name: action.name,
          description: action.description,
          riskLevel: action.riskLevel,
          expectedOutcome: action.expectedOutcome,
        })),
      }),
    });
  }
}
