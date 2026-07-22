import { randomUUID } from "node:crypto";

import {
  ActionExecutionRepository,
  ActionExecutor,
  ActionRegistry,
  type ActionExecutionResult,
} from "@/modules/actions";
import {
  EvaluationSummaryFactory,
  type EvaluationSummary,
} from "@/modules/evaluation";
import {
  EvidenceRepository,
  type EvidenceSnapshot,
} from "@/modules/evidence";
import {
  AgentRecoveryStrategy,
  BaselineRecoveryStrategy,
  type RecoveryDecision,
  type RecoveryMode,
} from "@/modules/recovery";

import { TrialRecordFactory } from "./trial-record.factory";
import { TrialStateFactory } from "./trial-state.factory";
import type {
  RecoveryStrategies,
  TrialContext,
  TrialRecord,
} from "./trial.types";

type ActionExecutorPort = Pick<ActionExecutor, "execute">;
type EvidenceRepositoryPort = Pick<EvidenceRepository, "findSnapshotById">;
type ActionExecutionRepositoryPort = Pick<ActionExecutionRepository, "save">;

export class TrialRunner {
  constructor(
    private readonly strategies: RecoveryStrategies = {
      baseline: new BaselineRecoveryStrategy(),
      agent: new AgentRecoveryStrategy(),
    },
    private readonly actionRegistry = new ActionRegistry(),
    private readonly actionExecutor: ActionExecutorPort = new ActionExecutor(),
    private readonly evidenceRepository: EvidenceRepositoryPort = new EvidenceRepository(),
    private readonly actionExecutionRepository: ActionExecutionRepositoryPort =
      new ActionExecutionRepository(),
    private readonly maxRecoverySteps = 3,
    private readonly trialRecordFactory = new TrialRecordFactory(),
    private readonly evaluationSummaryFactory = new EvaluationSummaryFactory(),
    private readonly trialStateFactory = new TrialStateFactory(),
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
    const context = this.createTrialContext(input.snapshot);
    const strategy = this.strategies[input.mode];
    let currentSnapshot = input.snapshot;
    let recoveryDecision = await strategy.decide(currentSnapshot, context);
    let trialState = this.trialStateFactory.fromDecision(
      recoveryDecision,
      currentSnapshot,
    );
    let executedSteps = 0;

    while (
      recoveryDecision.status === "action_selected" &&
      executedSteps < this.maxRecoverySteps
    ) {
      const plannedActionIds = this.getOrderedActionIds(recoveryDecision);

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

        const action = this.actionRegistry.findActionById(actionId);

        if (!action) {
          trialState = {
            status: "failed",
            outcome: "failed",
            reason: "Recovery plan contains unregistered action " + actionId + ".",
          };
          shouldReplan = false;
          break;
        }

        const result = await this.actionExecutor.execute(action, currentSnapshot, {
          trialRecordId: context.trialRecordId,
          actionAttemptCounts: context.actionAttemptCounts,
          completedActionIds: context.completedActionIds,
        });

        executedSteps += 1;
        this.recordActionResult(context, action.id, result);
        currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
        this.recordEvidenceSnapshot(context, currentSnapshot);
        trialState = this.trialStateFactory.fromExecutionResult(result);

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
      trialState = this.trialStateFactory.fromDecision(
        recoveryDecision,
        currentSnapshot,
      );
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.trialRecordFactory.create({
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
    const evaluationSummary = this.evaluationSummaryFactory.create(
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
    this.actionExecutionRepository.save(result);

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
      this.evidenceRepository.findSnapshotById(result.afterEvidenceSnapshotId) ??
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
