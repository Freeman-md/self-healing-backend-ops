import { randomUUID } from "node:crypto";

import {
  ActionRepository,
  ActionService,
  type ActionExecutionResult,
} from "@/modules/action";
import {
  EvaluationFactory,
  type EvaluationSummary,
} from "@/modules/evaluation";
import {
  EvidenceRepository,
  type EvidenceSnapshot,
} from "@/modules/evidence";
import {
  RecoveryAgentStrategy,
  RecoveryBaselineStrategy,
  type RecoveryDecision,
  type RecoveryMode,
} from "@/modules/recovery";

import { TrialFactory } from "./trial.factory";
import type {
  RecoveryStrategies,
  TrialContext,
  TrialRecord,
} from "./trial.types";
import { getOrderedRecoveryActionIds, recordActionResultInTrialContext, recordEvidenceSnapshotInTrialContext } from "./trial.helpers";

type ActionServicePort = Pick<ActionService, "executeAction">;
type EvidenceRepositoryPort = Pick<EvidenceRepository, "findEvidenceSnapshotById">;
type ActionRepositoryPort = Pick<ActionRepository, "saveActionExecutionResult" | "findActionById">;

export class TrialService {
  constructor(
    private readonly strategies: RecoveryStrategies = {
      baseline: new RecoveryBaselineStrategy(),
      agent: new RecoveryAgentStrategy(),
    },
    private readonly actionRepository: ActionRepositoryPort = new ActionRepository(),
    private readonly actionService: ActionServicePort = new ActionService(),
    private readonly evidenceRepository: EvidenceRepositoryPort = new EvidenceRepository(),
    private readonly actionPersistenceRepository: Pick<ActionRepository, "saveActionExecutionResult"> = new ActionRepository(),
    private readonly maxRecoverySteps = 3,
    private readonly trialFactory = new TrialFactory(),
    private readonly evaluationFactory = new EvaluationFactory(),
  ) {}

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

        const action = this.actionRepository.findActionById(actionId);

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
        this.actionPersistenceRepository.saveActionExecutionResult(result);
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
    const evaluationSummary = this.evaluationFactory.createEvaluationSummary(
      trialRecord,
      trialState.reason,
    );

    return {
      trialRecord,
      evaluationSummary,
      recoveryDecision,
    };
  }

  private getOrderedActionIds(decision: RecoveryDecision): string[] {
    return [
      ...new Set([
        ...decision.recoveryPlan.proposedActionIds,
        ...decision.recoveryPlan.fallbackActionIds,
      ]),
    ];
  }

  private createTrialContext(snapshot: EvidenceSnapshot): TrialContext {
    return {
      trialRecordId: "trial-" + randomUUID(),
      actionAttemptCounts: {},
      completedActionIds: [],
      evidenceSnapshotIds: [snapshot.id],
      selectedActionIds: [],
      executedActionResultIds: [],
      blockedActionIds: [],
    };
  }

  private recordActionResult(
    context: TrialContext,
    actionId: string,
    result: ActionExecutionResult,
  ): void {
    context.selectedActionIds.push(actionId);
    context.actionAttemptCounts[actionId] =
      (context.actionAttemptCounts[actionId] ?? 0) + 1;
    this.actionPersistenceRepository.saveActionExecutionResult(result);

    if (result.status === "executed") {
      context.executedActionResultIds.push(result.id);
      context.completedActionIds.push(actionId);
    } else {
      context.blockedActionIds.push(actionId);
    }
  }

  private findAfterSnapshot(
    result: ActionExecutionResult,
    fallback: EvidenceSnapshot,
  ): EvidenceSnapshot {
    if (!result.afterEvidenceSnapshotId) {
      return fallback;
    }

    return (
      this.evidenceRepository.findEvidenceSnapshotById(result.afterEvidenceSnapshotId) ??
      fallback
    );
  }

  private recordEvidenceSnapshot(
    context: TrialContext,
    snapshot: EvidenceSnapshot,
  ): void {
    if (snapshot.id !== context.evidenceSnapshotIds.at(-1)) {
      context.evidenceSnapshotIds.push(snapshot.id);
    }
  }

}
