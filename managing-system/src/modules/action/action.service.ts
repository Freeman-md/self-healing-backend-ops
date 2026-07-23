import { randomUUID } from "node:crypto";

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
      return {
        id: `action-execution-${randomUUID()}`,
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "blocked",
        safetyCheckStatus: "failed",
        failedSafetyRuleIds: safetyDecision.failedRuleIds,
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: safetyDecision.reason,
        continuation: safetyDecision.status === "escalate" ? "escalated" : "blocked",
      };
    }

    const handler = this.actionRepository.findActionHandler(action.handlerKey);

    if (!handler) {
      return {
        id: `action-execution-${randomUUID()}`,
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "failed",
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: `No action handler is registered for ${action.handlerKey}.`,
        continuation: "failed",
      };
    }

    try {
      const handlerResult = await handler({ action, trialRecordId: context.trialRecordId });
      const freshEvidenceSnapshot = await this.evidenceService.collectAndNormalize();
      const savedSnapshot = this.evidenceRepository.saveEvidenceSnapshot(freshEvidenceSnapshot);
      const outcome = await this.evaluateActionOutcome({
        expectedOutcome: action.expectedOutcome,
        evidenceSnapshot: savedSnapshot,
      });

      return {
        id: `action-execution-${randomUUID()}`,
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "executed",
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        afterEvidenceSnapshotId: savedSnapshot.id,
        output: handlerResult.output,
        expectedOutcomeMet: outcome.expectedOutcomeMet,
        outcomeSummary: outcome.outcomeSummary,
        continuation: outcome.continuation,
      };
    } catch (error) {
      return {
        id: `action-execution-${randomUUID()}`,
        actionId: action.id,
        trialRecordId: context.trialRecordId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "failed",
        safetyCheckStatus: "passed",
        failedSafetyRuleIds: [],
        beforeEvidenceSnapshotId: beforeEvidenceSnapshot.id,
        error: error instanceof Error ? error.message : "unknown action execution error",
        continuation: "failed",
      };
    }
  }

  async evaluateActionOutcome(input: { expectedOutcome: Action["expectedOutcome"]; evidenceSnapshot: EvidenceSnapshot }) {
    const parsedSnapshot = evidenceSnapshotSchema.parse(input.evidenceSnapshot);
    return new OpenAIService().parseStructuredOutput({
      schema: actionOutcomeEvaluationSchema,
      schemaName: "action_outcome_evaluation",
      systemPrompt: "Evaluate the expected outcome against the fresh evidence. Do not invent evidence.",
      userPrompt: JSON.stringify(input),
    });
  }
}
