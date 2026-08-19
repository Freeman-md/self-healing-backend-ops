import {
  ActionService,
  type Action,
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
import {
  type RecoveryDecision,
  type RecoveryMode,
  RecoveryService,
} from "@/modules/recovery";
import { getDeterministicEvidenceState } from "@/modules/evidence";
import type { MeasurementService } from "@/modules/measurement";

import { TrialFactory } from "./trial.factory";
import { TrialRepository } from "./trial.repository";
import type {
  RecoveryStrategies,
  TrialContext,
  TrialRecord,
} from "./trial.types";
import {
  getOrderedRecoveryActionIds,
  recordActionResultInTrialContext,
  recordEvidenceSnapshotInTrialContext,
  recordRecoveryDecisionInTrialContext,
} from "./trial.helpers";

type Awaitable<T> = T | Promise<T>;
type TrialActionService = {
  executeAction: ActionService["executeAction"];
  findActionById(actionId: string): Awaitable<Action | null>;
  saveActionExecutionResult(
    result: ActionExecutionResult,
  ): Awaitable<ActionExecutionResult>;
};
type TrialEvidenceService = {
  findEvidenceSnapshotById(
    snapshotId: string,
  ): Awaitable<EvidenceSnapshot | null>;
};
type TrialEvaluationService = {
  createEvaluationSummary: EvaluationService["createEvaluationSummary"];
  saveEvaluationSummary(
    summary: EvaluationSummary,
  ): Awaitable<EvaluationSummary>;
};
type TrialRecoveryService = {
  recordRecoveryDecision(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): Awaitable<RecoveryDecision>;
  findRecoveryDecisionHistory(
    trialRecordId: string,
  ): Awaitable<RecoveryDecision[]>;
};
type TrialMeasurementService = Pick<
  MeasurementService,
  | "startRecoveryMeasurement"
  | "recordFirstActionStarted"
  | "completeRecoveryMeasurement"
>;

export class TrialService {
  constructor(
    private readonly strategies: RecoveryStrategies,
    private readonly trialRepository: TrialRepository,
    private readonly actionService: TrialActionService,
    private readonly evidenceService: TrialEvidenceService,
    private readonly evaluationService: TrialEvaluationService,
    private readonly recoveryService: TrialRecoveryService,
    private readonly maxRecoverySteps = 3,
    private readonly trialFactory = new TrialFactory(),
    private readonly measurementService?: TrialMeasurementService,
  ) {}

  async saveTrialRecord(trialRecord: TrialRecord): Promise<TrialRecord> {
    return this.trialRepository.saveTrialRecord(trialRecord);
  }

  async runRecoveryTrial(input: {
    mode: RecoveryMode;
    scenarioId?: string;
    triggerSource?: "controlled" | "monitor";
    snapshot: EvidenceSnapshot;
    firstUnhealthyObservedAt?: string;
    firstUnhealthyEvidenceSnapshotId?: string;
    recoveryTriggeredAt?: string;
  }): Promise<{
    trialRecord: TrialRecord;
    evaluationSummary: EvaluationSummary;
    recoveryDecision: RecoveryDecision;
    recoveryDecisions: RecoveryDecision[];
  }> {
    const startedAt = new Date().toISOString();
    const context = this.trialFactory.createTrialContext(input.snapshot);
    const strategy = this.strategies[input.mode];
    await this.saveTrialRecord({
      id: context.trialRecordId,
      triggerSource: input.triggerSource ?? "controlled",
      scenarioId: input.scenarioId,
      recoveryMode: input.mode,
      startedAt,
      initialEvidenceSnapshotId: input.snapshot.id,
      evidenceSnapshotIds: [input.snapshot.id],
      recoveryDecisionIds: [],
      diagnosisResultIds: [],
      recoveryPlanIds: [],
      selectedActionIds: [],
      actionExecutionResultIds: [],
      executedActionResultIds: [],
      blockedActionIds: [],
      failedActionIds: [],
      status: "started",
      outcome: "unresolved_not_escalated",
      metrics: {
        actionCount: 0,
        blockedActionCount: 0,
        failedActionCount: 0,
      },
    });
    await this.measurementService?.startRecoveryMeasurement({
      trialRecordId: context.trialRecordId,
      firstUnhealthyObservedAt: input.firstUnhealthyObservedAt,
      firstUnhealthyEvidenceSnapshotId:
        input.firstUnhealthyEvidenceSnapshotId,
      recoveryTriggeredAt: input.recoveryTriggeredAt ?? startedAt,
    });
    let currentSnapshot = input.snapshot;
    let recoveryDecision = await strategy.decide(currentSnapshot, context);
    await this.recordRecoveryDecision(context, recoveryDecision);
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

        const action = await this.actionService.findActionById(actionId);

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
        await this.measurementService?.recordFirstActionStarted(
          context.trialRecordId,
          result.startedAt,
        );
        recordActionResultInTrialContext(context, action.id, result);
        await this.actionService.saveActionExecutionResult(result);
        currentSnapshot = await this.findAfterSnapshot(result, currentSnapshot);
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
      await this.recordRecoveryDecision(context, recoveryDecision);
      trialState = this.trialFactory.createTrialStateFromDecision(
        recoveryDecision,
        currentSnapshot,
      );
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.trialFactory.createTrialRecord({
      triggerSource: input.triggerSource ?? "controlled",
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
    await this.saveTrialRecord(trialRecord);
    await this.evaluationService.saveEvaluationSummary(evaluationSummary);
    await this.measurementService?.completeRecoveryMeasurement({
      trialRecordId: context.trialRecordId,
      completedAt,
      recoveryVerifiedAt:
        getDeterministicEvidenceState(currentSnapshot) === "healthy"
          ? currentSnapshot.createdAt
          : undefined,
      decisionCount: context.recoveryDecisionIds.length,
    });
    const recoveryDecisions =
      await this.recoveryService.findRecoveryDecisionHistory(
        context.trialRecordId,
      );

    return {
      trialRecord,
      evaluationSummary,
      recoveryDecision,
      recoveryDecisions,
    };
  }

  private async findAfterSnapshot(
    result: ActionExecutionResult,
    fallback: EvidenceSnapshot,
  ): Promise<EvidenceSnapshot> {
    if (!result.afterEvidenceSnapshotId) {
      return fallback;
    }

    return (
      (await this.evidenceService.findEvidenceSnapshotById(
        result.afterEvidenceSnapshotId,
      )) ??
      fallback
    );
  }

  private async recordRecoveryDecision(
    context: TrialContext,
    recoveryDecision: RecoveryDecision,
  ): Promise<void> {
    await this.recoveryService.recordRecoveryDecision({
      trialRecordId: context.trialRecordId,
      sequenceNumber: context.recoveryDecisionIds.length + 1,
      recoveryDecision,
    });
    recordRecoveryDecisionInTrialContext(context, recoveryDecision);
  }

}
