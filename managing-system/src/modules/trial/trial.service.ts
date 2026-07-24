import {
  ActionService,
  type ActionExecutionResult,
} from "@/modules/action";
import {
  EvaluationService,
  type EvaluationSummary,
} from "@/modules/evaluation";
import {
  EvidenceService,
  type EvidenceSnapshot,
} from "@/modules/evidence";
import type { RecoveryDecision, RecoveryMode } from "@/modules/recovery";

import { TrialFactory } from "./trial.factory";
import { TrialRepository } from "./trial.repository";
import type {
  RecoveryStrategies,
  TrialRecord,
} from "./trial.types";
import { getOrderedRecoveryActionIds, recordActionResultInTrialContext, recordEvidenceSnapshotInTrialContext } from "./trial.helpers";

type TrialActionService = Pick<
  ActionService,
  "executeAction" | "findActionById" | "saveActionExecutionResult"
>;
type TrialEvidenceService = Pick<EvidenceService, "findEvidenceSnapshotById">;
type TrialEvaluationService = Pick<
  EvaluationService,
  "createEvaluationSummary" | "saveEvaluationSummary"
>;

export class TrialService {
  constructor(
    private readonly strategies: RecoveryStrategies,
    private readonly trialRepository: TrialRepository,
    private readonly actionService: TrialActionService,
    private readonly evidenceService: TrialEvidenceService,
    private readonly evaluationService: TrialEvaluationService,
    private readonly maxRecoverySteps = 3,
    private readonly trialFactory = new TrialFactory(),
  ) {}

  saveTrialRecord(trialRecord: TrialRecord): TrialRecord {
    return this.trialRepository.saveTrialRecord(trialRecord);
  }

  async runRecoveryTrial(input: {
    mode: RecoveryMode;
    scenarioId: string;
    snapshot: EvidenceSnapshot;
  }): Promise<{
    trialRecord: TrialRecord;
    evaluationSummary: EvaluationSummary;
    recoveryDecision: RecoveryDecision;
  }> {
    const startedAt = new Date().toISOString();
    const context = this.trialFactory.createTrialContext(input.snapshot);
    const strategy = this.strategies[input.mode];
    let currentSnapshot = input.snapshot;
    let recoveryDecision = await strategy.decide(currentSnapshot, context);
    let trialState = this.trialFactory.createTrialStateFromDecision(
      recoveryDecision,
      currentSnapshot,
    );
    let executedSteps = 0;

    while (
      recoveryDecision.status === "action_selected" &&
      executedSteps < this.maxRecoverySteps
    ) {
      const plannedActionIds = getOrderedRecoveryActionIds(recoveryDecision);

      if (plannedActionIds.length === 0) {
        trialState = {
          status: "failed",
          outcome: "failed",
          reason: "Recovery decision selected an action but its recovery plan is empty.",
        };
        break;
      }

      let shouldReplan = false;

      for (const actionId of plannedActionIds) {
        if (executedSteps >= this.maxRecoverySteps) {
          break;
        }

        const action = this.actionService.findActionById(actionId);

        if (!action) {
          trialState = {
            status: "failed",
            outcome: "failed",
            reason: "Recovery plan contains unregistered action " + actionId + ".",
          };
          shouldReplan = false;
          break;
        }

        const result = await this.actionService.executeAction(action, currentSnapshot, {
          trialRecordId: context.trialRecordId,
          actionAttemptCounts: context.actionAttemptCounts,
          completedActionIds: context.completedActionIds,
        });

        executedSteps += 1;
        recordActionResultInTrialContext(context, action.id, result);
        this.actionService.saveActionExecutionResult(result);
        currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
        recordEvidenceSnapshotInTrialContext(context, currentSnapshot);
        trialState = this.trialFactory.createTrialStateFromActionResult(result);

        if (result.continuation !== "continue") {
          shouldReplan = false;
          break;
        }

        shouldReplan = true;
      }

      if (
        trialState.status === "resolved" ||
        trialState.status === "failed" ||
        trialState.status === "escalated" ||
        !shouldReplan
      ) {
        break;
      }

      if (executedSteps >= this.maxRecoverySteps) {
        trialState = {
          status: "escalated",
          outcome: "unresolved_escalated",
          reason: "Maximum recovery action limit reached.",
          escalationReason: "Maximum recovery action limit reached.",
        };
        break;
      }

      recoveryDecision = await strategy.decide(currentSnapshot, context);
      trialState = this.trialFactory.createTrialStateFromDecision(
        recoveryDecision,
        currentSnapshot,
      );
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.trialFactory.createTrialRecord({
      scenarioId: input.scenarioId,
      recoveryMode: input.mode,
      startedAt,
      completedAt,
      initialSnapshot: input.snapshot,
      finalSnapshot: currentSnapshot,
      context,
      recoveryDecision,
      trialState,
    });
    const evaluationSummary = this.evaluationService.createEvaluationSummary(
      trialRecord,
      trialState.reason,
    );
    this.saveTrialRecord(trialRecord);
    this.evaluationService.saveEvaluationSummary(evaluationSummary);

    return {
      trialRecord,
      evaluationSummary,
      recoveryDecision,
    };
  }

  private findAfterSnapshot(
    result: ActionExecutionResult,
    fallback: EvidenceSnapshot,
  ): EvidenceSnapshot {
    if (!result.afterEvidenceSnapshotId) {
      return fallback;
    }

    return (
      this.evidenceService.findEvidenceSnapshotById(result.afterEvidenceSnapshotId) ??
      fallback
    );
  }

}
