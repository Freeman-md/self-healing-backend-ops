import { OpenAIService } from "@/infrastructure/openai";
import {
  evidenceSnapshotSchema,
  type EvidenceSnapshot,
} from "@/modules/evidence";

import {
  actionOutcomeEvaluationSchema,
  type ActionOutcomeEvaluation,
} from "./action.schema";
import type { ExpectedOutcome } from "./action.types";

export class ActionOutcomeEvaluator {
  constructor(private readonly openaiService = new OpenAIService()) {}

  async evaluate(input: {
    expectedOutcome: ExpectedOutcome;
    evidenceSnapshot: EvidenceSnapshot;
  }): Promise<ActionOutcomeEvaluation> {
    const parsedSnapshot = evidenceSnapshotSchema.parse(input.evidenceSnapshot);

    return this.openaiService.parseStructuredOutput({
      schema: actionOutcomeEvaluationSchema,
      schemaName: "action_outcome_evaluation",
      systemPrompt: [
        "You evaluate whether a bounded recovery action achieved its expected outcome.",
        "Compare the expected outcome criteria with the fresh evidence snapshot.",
        "Set expectedOutcomeMet to true only when the evidence supports all required criteria.",
        "Return resolved when the expected outcome is met; otherwise return continue.",
        "Do not propose actions and do not invent evidence.",
      ].join(" "),
      userPrompt: JSON.stringify({
        expectedOutcome: input.expectedOutcome,
        freshEvidenceSnapshot: parsedSnapshot,
      }),
    });
  }
}
