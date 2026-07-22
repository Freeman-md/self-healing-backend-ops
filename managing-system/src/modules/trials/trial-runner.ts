import { randomUUID } from "node:crypto";

import { ActionExecutor, ActionRegistry } from "@/modules/actions";
import { SelfHealingAgent } from "@/modules/agent";
import { EvidenceRepository } from "@/modules/evidence";
import { BaselineRecoveryEngine } from "@/modules/recovery";
import { ResultsRepository } from "@/modules/results";
import type {
  ActionExecutionResult,
  EvaluationSummary,
  EvidenceSnapshot,
  RecoveryDecision,
  RecoveryMode,
  RecoveryStrategy,
  RecoveryStrategyContext,
  TrialRecord,
} from "@/types";

type RecoveryStrategies = Record<RecoveryMode, RecoveryStrategy>;
type ActionExecutorPort = Pick<ActionExecutor, "execute">;
type EvidenceRepositoryPort = Pick<EvidenceRepository, "findSnapshotById">;
type ResultsRepositoryPort = Pick<ResultsRepository, "saveActionExecutionResult">;

type TrialContext = RecoveryStrategyContext & {
  trialRecordId: string;
  evidenceSnapshotIds: string[];
  selectedActionIds: string[];
  executedActionResultIds: string[];
  blockedActionIds: string[];
};

type TrialState = {
  status: TrialRecord["status"];
  outcome: TrialRecord["outcome"];
  reason: string;
  escalationReason?: string;
};

export class TrialRunner {
  constructor(
    private readonly strategies: RecoveryStrategies = {
      baseline: new BaselineRecoveryEngine(),
      agent: new SelfHealingAgent(),
    },
    private readonly actionRegistry = new ActionRegistry(),
    private readonly actionExecutor: ActionExecutorPort = new ActionExecutor(),
    private readonly evidenceRepository: EvidenceRepositoryPort = new EvidenceRepository(),
    private readonly resultsRepository: ResultsRepositoryPort = new ResultsRepository(),
    private readonly maxRecoverySteps = 3,
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
    let trialState = this.stateFromDecision(recoveryDecision, currentSnapshot);
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
        trialState = this.stateFromExecutionResult(result);

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
      trialState = this.stateFromDecision(recoveryDecision, currentSnapshot);
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.buildTrialRecord({
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
    const evaluationSummary = this.buildEvaluationSummary(
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

  private stateFromDecision(
    decision: RecoveryDecision,
    snapshot: EvidenceSnapshot,
  ): TrialState {
    if (decision.status === "escalate") {
      return {
        status: "escalated",
        outcome: "unresolved_escalated",
        reason: decision.reason,
        escalationReason: decision.escalationReason,
      };
    }

    if (decision.status === "no_action") {
      return {
        status: snapshot.overallState === "healthy" ? "resolved" : "unresolved",
        outcome:
          snapshot.overallState === "healthy"
            ? "resolved_safely"
            : "unresolved_not_escalated",
        reason: decision.reason,
      };
    }

    return {
      status: "started",
      outcome: "unresolved_not_escalated",
      reason: decision.reason,
    };
  }

  private stateFromExecutionResult(result: ActionExecutionResult): TrialState {
    switch (result.continuation) {
      case "resolved":
        return {
          status: "resolved",
          outcome: "resolved_safely",
          reason: result.outcomeSummary ?? "Recovery action resolved the incident.",
        };
      case "blocked":
        return {
          status: "unresolved",
          outcome: "unresolved_not_escalated",
          reason: result.error ?? "Recovery action was blocked.",
        };
      case "escalated":
        return {
          status: "escalated",
          outcome: "unresolved_escalated",
          reason: result.error ?? "Recovery action requires escalation.",
          escalationReason: result.error,
        };
      case "failed":
        return {
          status: "failed",
          outcome: "failed",
          reason: result.error ?? "Recovery action execution failed.",
        };
      case "continue":
        return {
          status: "unresolved",
          outcome: "unresolved_not_escalated",
          reason:
            result.outcomeSummary ??
            "Recovery action did not yet satisfy its expected outcome.",
        };
    }
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
    this.resultsRepository.saveActionExecutionResult(result);

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

  private buildTrialRecord(input: {
    scenarioId: string;
    recoveryMode: RecoveryMode;
    startedAt: string;
    completedAt: string;
    initialSnapshot: EvidenceSnapshot;
    finalSnapshot: EvidenceSnapshot;
    context: TrialContext;
    recoveryDecision: RecoveryDecision;
    trialState: TrialState;
  }): TrialRecord {
    return {
      id: input.context.trialRecordId,
      scenarioId: input.scenarioId,
      recoveryMode: input.recoveryMode,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      initialEvidenceSnapshotId: input.initialSnapshot.id,
      finalEvidenceSnapshotId: input.finalSnapshot.id,
      evidenceSnapshotIds: input.context.evidenceSnapshotIds,
      diagnosisResultId: input.recoveryDecision.diagnosisResult.id,
      recoveryPlanId: input.recoveryDecision.recoveryPlan.id,
      selectedActionIds: input.context.selectedActionIds,
      executedActionResultIds: input.context.executedActionResultIds,
      blockedActionIds: input.context.blockedActionIds,
      status: input.trialState.status,
      outcome: input.trialState.outcome,
      escalationReason: input.trialState.escalationReason,
      metrics: {
        actionCount:
          input.context.executedActionResultIds.length +
          input.context.blockedActionIds.length,
        blockedActionCount: input.context.blockedActionIds.length,
        timeToRecoveryMs:
          input.trialState.status === "resolved"
            ? new Date(input.completedAt).getTime() -
              new Date(input.startedAt).getTime()
            : undefined,
        timeToEscalationMs:
          input.trialState.status === "escalated"
            ? new Date(input.completedAt).getTime() -
              new Date(input.startedAt).getTime()
            : undefined,
      },
      notes: input.trialState.reason,
    };
  }

  private buildEvaluationSummary(
    trialRecord: TrialRecord,
    summaryReason: string,
  ): EvaluationSummary {
    return {
      id: "evaluation-" + randomUUID(),
      trialRecordId: trialRecord.id,
      createdAt: new Date().toISOString(),
      summary: summaryReason,
      recoverySucceeded: trialRecord.status === "resolved",
      safetyMaintained: trialRecord.outcome !== "resolved_unsafely",
      actionEffectiveness:
        trialRecord.status === "resolved" ? "effective" : "unknown",
      lessons: [],
      recommendedChanges: [],
    };
  }
}
