import { z } from "zod/v4";

import { evidenceSnapshotSchema } from "@/schemas";
import { OpenAIService } from "@/services/openai";
import type { EvidenceSnapshot, ExpectedOutcome } from "@/types";

const actionOutcomeEvaluationSchema = z.object({
  expectedOutcomeMet: z.boolean(),
  outcomeSummary: z.string(),
  matchedCriterionIds: z.array(z.string()),
  unmetCriterionIds: z.array(z.string()),
  continuation: z.enum(["resolved", "continue"]),
});

export type ActionOutcomeEvaluation = z.infer<typeof actionOutcomeEvaluationSchema>;

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
