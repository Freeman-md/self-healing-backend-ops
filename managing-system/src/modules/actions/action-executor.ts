import { randomUUID } from "node:crypto";

import { EvidenceNormalizer, EvidenceRepository, RawEvidenceCollector } from "@/modules/evidence";
import { SafetyGate } from "@/modules/safety";
import type {
  ActionDefinition,
  ActionExecutionResult,
  EvidenceSnapshot,
} from "@/types";

import { findActionHandler } from "./action-handlers";
import { ActionOutcomeEvaluator } from "./action-outcome-evaluator";
import { ActionRegistry } from "./action-registry";

type ActionExecutionContext = {
  trialRecordId: string;
  actionAttemptCounts?: Record<string, number>;
  completedActionIds?: string[];
  manualApprovalGranted?: boolean;
};

export class ActionExecutor {
  constructor(
    private readonly actionRegistry = new ActionRegistry(),
    private readonly safetyGate = new SafetyGate(actionRegistry),
    private readonly rawEvidenceCollector = new RawEvidenceCollector(),
    private readonly evidenceNormalizer = new EvidenceNormalizer(),
    private readonly evidenceRepository = new EvidenceRepository(),
    private readonly outcomeEvaluator = new ActionOutcomeEvaluator(),
  ) {}

  async execute(
    action: ActionDefinition,
    beforeEvidenceSnapshot: EvidenceSnapshot,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const startedAt = new Date().toISOString();
    const safetyDecision = this.safetyGate.evaluate(action, {
      evidenceSnapshot: beforeEvidenceSnapshot,
      actionAttemptCounts: context.actionAttemptCounts,
      completedActionIds: context.completedActionIds,
      manualApprovalGranted: context.manualApprovalGranted,
    });

    if (safetyDecision.status !== "allowed") {
      return {
        id: `action-execution-${randomUUID()}`,
        actionDefinitionId: action.id,
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

    const handler = findActionHandler(action.handlerKey);

    if (!handler) {
      return {
        id: `action-execution-${randomUUID()}`,
        actionDefinitionId: action.id,
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
      const freshRawEvidence = await this.rawEvidenceCollector.collect();
      const freshEvidenceSnapshot = await this.evidenceNormalizer.normalize(freshRawEvidence);
      const savedSnapshot = this.evidenceRepository.saveSnapshot(freshEvidenceSnapshot);
      const outcome = await this.outcomeEvaluator.evaluate({
        expectedOutcome: action.expectedOutcome,
        evidenceSnapshot: savedSnapshot,
      });

      return {
        id: `action-execution-${randomUUID()}`,
        actionDefinitionId: action.id,
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
        actionDefinitionId: action.id,
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
}
