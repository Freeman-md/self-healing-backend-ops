import {
  EvidenceService,
  EvidenceRepository,
  type EvidenceSnapshot,
} from "@/modules/evidence";
import { OpenAIService } from "@/infrastructure/openai";
import { evidenceSnapshotSchema } from "@/modules/evidence";
import { actionOutcomeEvaluationSchema } from "./action.schema";
import { SafetyService } from "@/modules/safety";
import type {
  Action,
  ActionExecutionResult,
} from "./action.types";

import { ActionRepository } from "./action.repository";
import { ActionFactory } from "./action.factory";

type ActionExecutionContext = {
  trialRecordId: string;
  actionAttemptCounts?: Record<string, number>;
  completedActionIds?: string[];
  manualApprovalGranted?: boolean;
};

export class ActionService {
  constructor(
    private readonly actionRepository = new ActionRepository(),
    private readonly safetyService = new SafetyService(actionRepository),
    private readonly evidenceService = new EvidenceService(),
    private readonly evidenceRepository = new EvidenceRepository(),
    private readonly actionFactory = new ActionFactory(),
    private readonly openaiService?: OpenAIService,
  ) {}

  async executeAction(
    action: Action,
    beforeEvidenceSnapshot: EvidenceSnapshot,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const startedAt = new Date().toISOString();
    const safetyDecision = this.safetyService.evaluateActionSafety(action, {
      evidenceSnapshot: beforeEvidenceSnapshot,
      actionAttemptCounts: context.actionAttemptCounts,
      completedActionIds: context.completedActionIds,
      manualApprovalGranted: context.manualApprovalGranted,
    });

    if (safetyDecision.status !== "allowed") {
      return this.actionFactory.createBlockedActionExecutionResult({
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        safetyCheckStatus: "failed",
        failedSafetyRuleIds: safetyDecision.failedRuleIds,
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: safetyDecision.reason,
        continuation: safetyDecision.status === "escalate" ? "escalated" : "blocked",
      });
    }

    const handler = this.actionRepository.findActionHandler(action.handlerKey);

    if (!handler) {
      return this.actionFactory.createFailedActionExecutionResult({
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: `No action handler is registered for ${action.handlerKey}.`,
      });
    }

    try {
      const handlerResult = await handler({ action, trialRecordId: context.trialRecordId });
      const freshEvidenceSnapshot = await this.evidenceService.collectAndNormalize();
      const savedSnapshot = this.evidenceRepository.saveEvidenceSnapshot(freshEvidenceSnapshot);
      const outcome = await this.evaluateActionOutcome({
        expectedOutcome: action.expectedOutcome,
        evidenceSnapshot: savedSnapshot,
      });

      return this.actionFactory.createSuccessfulActionExecutionResult({
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        afterEvidenceSnapshotId: savedSnapshot.id,
        output: handlerResult.output,
        expectedOutcomeMet: outcome.expectedOutcomeMet,
        outcomeSummary: outcome.outcomeSummary,
        continuation: outcome.continuation,
      });
    } catch (error) {
      return this.actionFactory.createFailedActionExecutionResult({
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: error instanceof Error ? error.message : "unknown action execution error",
      });
    }
  }

  async evaluateActionOutcome(input: { expectedOutcome: Action["expectedOutcome"]; evidenceSnapshot: EvidenceSnapshot }) {
    const parsedSnapshot = evidenceSnapshotSchema.parse(input.evidenceSnapshot);
    const openaiService = this.openaiService ?? new OpenAIService();

    return openaiService.parseStructuredOutput({
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
