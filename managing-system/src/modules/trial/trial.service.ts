import { ActionService, type Action, type ActionExecutionResult } from "@/modules/action";
import { EvaluationService, type EvaluationSummary } from "@/modules/evaluation";
import { EvidenceService, type EvidenceSnapshot } from "@/modules/evidence";
import {
  type RecoveryDecision,
  type RecoveryMode,
  type DecisionRecoveryStrategy,
  type AgentOrchestratedRecoveryStrategy,
  type ControlledRecoveryEnvironment,
} from "@/modules/recovery";
import { getDeterministicEvidenceState } from "@/modules/evidence";
import type { MeasurementService } from "@/modules/measurement";

import { TrialFactory } from "./trial.factory";
import { TrialRepository } from "./trial.repository";
import type { RecoveryStrategies, TrialContext, TrialRecord, TrialState } from "./trial.types";
import {
  getOrderedRecoveryActionIds,
  recordActionResultInTrialContext,
  recordEvidenceSnapshotInTrialContext,
  recordRecoveryDecisionInTrialContext,
} from "./trial.helpers";

type Awaitable<T> = T | Promise<T>;
type TrialActionService = {
  executeAction: ActionService["executeAction"];
  listActions?: ActionService["listActions"];
  findActionAttemptLimit?: ActionService["findActionAttemptLimit"];
  findActionById(actionId: string): Awaitable<Action | null>;
  saveActionExecutionResult(result: ActionExecutionResult): Awaitable<ActionExecutionResult>;
};
type TrialEvidenceService = {
  collectAndNormalize?: EvidenceService["collectAndNormalize"];
  saveEvidenceSnapshot?: EvidenceService["saveEvidenceSnapshot"];
  findEvidenceSnapshotById(snapshotId: string): Awaitable<EvidenceSnapshot | null>;
};
type TrialEvaluationService = {
  createEvaluationSummary: EvaluationService["createEvaluationSummary"];
  saveEvaluationSummary(summary: EvaluationSummary): Awaitable<EvaluationSummary>;
};
type TrialRecoveryService = {
  recordRecoveryDecision(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): Awaitable<RecoveryDecision>;
  findRecoveryDecisionHistory(trialRecordId: string): Awaitable<RecoveryDecision[]>;
};
type TrialMeasurementService = Pick<
  MeasurementService,
  "startRecoveryMeasurement" | "recordFirstActionStarted" | "completeRecoveryMeasurement"
>;

export const DEFAULT_MAX_RECOVERY_STEPS = 3;

export class TrialService {
  constructor(
    private readonly strategies: RecoveryStrategies,
    private readonly trialRepository: TrialRepository,
    private readonly actionService: TrialActionService,
    private readonly evidenceService: TrialEvidenceService,
    private readonly evaluationService: TrialEvaluationService,
    private readonly recoveryService: TrialRecoveryService,
    private readonly maxRecoverySteps = DEFAULT_MAX_RECOVERY_STEPS,
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
    recoveryDecision: RecoveryDecision | undefined;
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
      firstUnhealthyEvidenceSnapshotId: input.firstUnhealthyEvidenceSnapshotId,
      recoveryTriggeredAt: input.recoveryTriggeredAt ?? startedAt,
    });
    const { currentSnapshot, recoveryDecision, trialState } =
      strategy.orchestration === "agent"
        ? await this.runAgentRecovery(strategy, context, input.snapshot)
        : await this.runExternalRecovery(strategy, context, input.snapshot);

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
    const recoveryDecisions = await this.recoveryService.findRecoveryDecisionHistory(
      context.trialRecordId,
    );

    return {
      trialRecord,
      evaluationSummary,
      recoveryDecision,
      recoveryDecisions,
    };
  }

  private async runExternalRecovery(
    strategy: DecisionRecoveryStrategy,
    context: TrialContext,
    initialSnapshot: EvidenceSnapshot,
  ) {
    let currentSnapshot = initialSnapshot;

    let recoveryDecision = await strategy.decide(currentSnapshot, context);

    await this.recordRecoveryDecision(context, recoveryDecision);
    let trialState = this.trialFactory.createTrialStateFromDecision(
      recoveryDecision,
      currentSnapshot,
    );

    let executedSteps = 0;

    while (recoveryDecision.status === "action_selected" && executedSteps < this.maxRecoverySteps) {
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

    return { currentSnapshot, recoveryDecision, trialState };
  }

  private async runAgentRecovery(
    strategy: AgentOrchestratedRecoveryStrategy,
    context: TrialContext,
    initialSnapshot: EvidenceSnapshot,
  ): Promise<{
    currentSnapshot: EvidenceSnapshot;
    recoveryDecision: RecoveryDecision | undefined;
    trialState: TrialState;
  }> {
    let currentSnapshot = initialSnapshot;

    let recoveryDecision: RecoveryDecision | undefined;

    let acceptedDecision: RecoveryDecision | undefined;

    let invocations = 0;

    let phase = "catalogue loading";

    try {
      if (
        !this.actionService.listActions ||
        !this.actionService.findActionAttemptLimit ||
        !this.evidenceService.collectAndNormalize ||
        !this.evidenceService.saveEvidenceSnapshot
      ) {
        throw new Error("Agent recovery requires controlled catalogue and evidence operations.");
      }

      const actions = await this.actionService.listActions();

      const catalogue = await Promise.all(
        actions.map(async (action) => ({
          id: action.id,
          name: action.name,
          description: action.description,
          riskLevel: action.riskLevel,
          expectedOutcome: action.expectedOutcome,
          maxAttempts: Math.min(
            this.maxRecoverySteps,
            await this.actionService.findActionAttemptLimit!(action),
          ),
        })),
      );

      const environment: ControlledRecoveryEnvironment = {
        trialRecordId: context.trialRecordId,
        maxRecoverySteps: this.maxRecoverySteps,
        actions: catalogue,
        recordDecision: async (decision) => {
          if (decision.snapshotId !== currentSnapshot.id || decision.mode !== "agent") {
            throw new Error("Invalid decision association.");
          }

          phase = "decision persistence";
          await this.recordRecoveryDecision(context, decision);
          recoveryDecision = decision;
          acceptedDecision = decision.status === "action_selected" ? decision : undefined;

          return decision;
        },
        executeRegisteredAction: async (actionId) => {
          const action = actions.find((entry) => entry.id === actionId);

          const policy = catalogue.find((entry) => entry.id === actionId);

          if (
            !action ||
            !policy ||
            !acceptedDecision ||
            acceptedDecision.snapshotId !== currentSnapshot.id ||
            !getOrderedRecoveryActionIds(acceptedDecision).includes(actionId) ||
            invocations >= this.maxRecoverySteps ||
            (context.actionAttemptCounts[actionId] ?? 0) >= policy.maxAttempts
          ) {
            throw new Error("Controlled action execution rejected.");
          }

          acceptedDecision = undefined;
          invocations += 1;
          phase = "registered action execution";
          const result = await this.actionService.executeAction(action, currentSnapshot, {
            trialRecordId: context.trialRecordId,
            actionAttemptCounts: context.actionAttemptCounts,
            completedActionIds: context.completedActionIds,
          });

          recordActionResultInTrialContext(context, actionId, result);
          await this.actionService.saveActionExecutionResult(result);
          await this.measurementService?.recordFirstActionStarted(
            context.trialRecordId,
            result.startedAt,
          );
          phase = "action evidence persistence";
          if (result.continuation !== "escalated") {
            if (result.afterEvidenceSnapshotId) {
              const fresh = await this.evidenceService.findEvidenceSnapshotById(
                result.afterEvidenceSnapshotId,
              );

              if (!fresh) {
                throw new Error("Persisted action evidence is unavailable.");
              }

              currentSnapshot = fresh;
            } else {
              currentSnapshot = await this.evidenceService.saveEvidenceSnapshot!(
                await this.evidenceService.collectAndNormalize!({
                  trialRecordId: context.trialRecordId,
                }),
              );
            }

            result.afterEvidenceSnapshotId = currentSnapshot.id;
            await this.actionService.saveActionExecutionResult(result);
            recordEvidenceSnapshotInTrialContext(context, currentSnapshot);
          }

          return {
            actionId,
            status: result.status,
            continuation: result.continuation,
            safetyCheckStatus: result.safetyCheckStatus,
            failedSafetyRuleIds: result.failedSafetyRuleIds,
            expectedOutcomeMet: result.expectedOutcomeMet,
            outcomeSummary: `Registered action ${result.status}; continuation ${result.continuation}.`,
            evidenceSnapshot: sanitizeAgentEvidence(currentSnapshot),
          };
        },
      };

      phase = "agent conversation";
      const outcome = await strategy.recover(sanitizeAgentEvidence(initialSnapshot), environment);

      if (
        outcome.status === "resolved" &&
        getDeterministicEvidenceState(currentSnapshot) !== "healthy"
      ) {
        throw new Error("Agent completion has no deterministic healthy evidence.");
      }

      return {
        currentSnapshot,
        recoveryDecision,
        trialState: {
          status: outcome.status,
          outcome:
            outcome.status === "resolved"
              ? "resolved_safely"
              : outcome.status === "escalated"
                ? "unresolved_escalated"
                : "failed",
          reason: outcome.reason,
          escalationReason: outcome.status === "escalated" ? outcome.reason : undefined,
        },
      };
    } catch {
      return {
        currentSnapshot,
        recoveryDecision,
        trialState: {
          status: "failed",
          outcome: "failed",
          reason: `Agent V2 failed during ${phase}.`,
        },
      };
    }
  }

  private async findAfterSnapshot(
    result: ActionExecutionResult,
    fallback: EvidenceSnapshot,
  ): Promise<EvidenceSnapshot> {
    if (!result.afterEvidenceSnapshotId) {
      return fallback;
    }

    return (
      (await this.evidenceService.findEvidenceSnapshotById(result.afterEvidenceSnapshotId)) ??
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

// Free-form model/terminal-derived text and string values are not part of the agent observation boundary.
function sanitizeAgentEvidence(snapshot: EvidenceSnapshot): EvidenceSnapshot {
  return {
    id: snapshot.id,
    rawEvidenceIds: [],
    createdAt: snapshot.createdAt,
    targetSystem: snapshot.targetSystem,
    overallState: getDeterministicEvidenceState(snapshot),
    summary: "Structured recovery evidence.",
    signals: snapshot.signals.map((signal) => ({
      ...signal,
      name: signal.name === signal.code ? signal.name : "[redacted]",
      value: typeof signal.value === "string" ? null : signal.value,
      description: signal.code,
    })),
    suspectedIncidentTypes: snapshot.suspectedIncidentTypes,
    contradictions: [],
  };
}
