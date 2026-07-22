import { randomUUID } from "node:crypto";

import { ActionExecutor, ActionRegistry } from "@/modules/actions";
import { SelfHealingAgent } from "@/modules/agent";
import { EvidenceRepository } from "@/modules/evidence";
import { BaselineRecoveryEngine } from "@/modules/recovery";
import { ResultsRepository } from "@/modules/results";
import type {
  BaselineRecoveryDecision,
  ActionExecutionResult,
  EvaluationSummary,
  EvidenceSnapshot,
  RecoveryMode,
  SelfHealingAgentDecision,
  TrialRecord,
} from "@/types";

type TrialContext = {
  trialRecordId: string;
  actionAttemptCounts: Record<string, number>;
  completedActionIds: string[];
  evidenceSnapshotIds: string[];
  selectedActionIds: string[];
  executedActionResultIds: string[];
  blockedActionIds: string[];
};

export class TrialRunner {
  constructor(
    private readonly baselineRecoveryEngine = new BaselineRecoveryEngine(),
    private readonly selfHealingAgent = new SelfHealingAgent(),
    private readonly actionRegistry = new ActionRegistry(),
    private readonly actionExecutor = new ActionExecutor(),
    private readonly evidenceRepository = new EvidenceRepository(),
    private readonly resultsRepository = new ResultsRepository(),
    private readonly maxRecoverySteps = 3,
  ) {}

  async runBaselineTrial(input: {
    scenarioId: string;
    snapshot: EvidenceSnapshot;
  }): Promise<{
    trialRecord: TrialRecord;
    evaluationSummary: EvaluationSummary;
    baselineDecision: BaselineRecoveryDecision;
  }> {
    const startedAt = new Date().toISOString();
    const context = this.createTrialContext(input.snapshot);
    let currentSnapshot = input.snapshot;
    let decision = this.baselineRecoveryEngine.decide(currentSnapshot);
    let finalReason = decision.reason;
    let escalationReason = decision.escalationReason;
    let status: TrialRecord["status"] = "unresolved";
    let outcome: TrialRecord["outcome"] = "unresolved_not_escalated";

    for (let step = 0; step < this.maxRecoverySteps; step += 1) {
      if (!decision.selectedActionId) {
        status = decision.status === "escalate" ? "escalated" : "unresolved";
        outcome =
          decision.status === "escalate"
            ? "unresolved_escalated"
            : "unresolved_not_escalated";
        break;
      }

      const action = this.actionRegistry.findActionById(decision.selectedActionId);

      if (!action) {
        status = "failed";
        outcome = "failed";
        finalReason = "Baseline selected unregistered action " + decision.selectedActionId + ".";
        break;
      }

      const result = await this.actionExecutor.execute(action, currentSnapshot, {
        trialRecordId: context.trialRecordId,
        actionAttemptCounts: context.actionAttemptCounts,
        completedActionIds: context.completedActionIds,
      });

      this.recordActionResult(context, action.id, result);
      finalReason = result.outcomeSummary ?? result.error ?? finalReason;

      if (result.continuation === "resolved") {
        status = "resolved";
        outcome = "resolved_safely";
        currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
        if (currentSnapshot.id !== context.evidenceSnapshotIds.at(-1)) {
          context.evidenceSnapshotIds.push(currentSnapshot.id);
        }
        break;
      }

      if (result.continuation === "blocked" || result.continuation === "escalated") {
        status = result.continuation === "escalated" ? "escalated" : "unresolved";
        outcome = "unresolved_escalated";
        escalationReason = result.error;
        break;
      }

      if (result.continuation === "failed") {
        status = "failed";
        outcome = "failed";
        break;
      }

      currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
      context.evidenceSnapshotIds.push(currentSnapshot.id);
      decision = this.baselineRecoveryEngine.decide(currentSnapshot);
      finalReason = decision.reason;
    }

    if (status === "unresolved" && context.executedActionResultIds.length >= this.maxRecoverySteps) {
      status = "escalated";
      outcome = "unresolved_escalated";
      escalationReason = "Maximum baseline recovery steps reached.";
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.buildTrialRecord({
      scenarioId: input.scenarioId,
      recoveryMode: "baseline",
      startedAt,
      completedAt,
      initialSnapshot: input.snapshot,
      finalSnapshot: currentSnapshot,
      context,
      status,
      outcome,
      notes: finalReason,
      escalationReason,
    });
    const evaluationSummary = this.buildEvaluationSummary(trialRecord, finalReason);

    return {
      trialRecord,
      evaluationSummary,
      baselineDecision: decision,
    };
  }

  async runAgentTrial(input: {
    scenarioId: string;
    snapshot: EvidenceSnapshot;
  }): Promise<{
    trialRecord: TrialRecord;
    evaluationSummary: EvaluationSummary;
    agentDecision: SelfHealingAgentDecision;
  }> {
    const startedAt = new Date().toISOString();
    const context = this.createTrialContext(input.snapshot);
    let currentSnapshot = input.snapshot;
    let decision = await this.selfHealingAgent.run(currentSnapshot, {
      actionAttemptCounts: context.actionAttemptCounts,
      completedActionIds: context.completedActionIds,
      manualApprovalGranted: false,
    });
    let finalReason = decision.reason;
    let escalationReason = decision.escalationReason;
    let status: TrialRecord["status"] = "unresolved";
    let outcome: TrialRecord["outcome"] = "unresolved_not_escalated";

    for (let step = 0; step < this.maxRecoverySteps; step += 1) {
      if (!decision.selectedActionId) {
        status = decision.status === "escalate" ? "escalated" : "unresolved";
        outcome =
          decision.status === "escalate"
            ? "unresolved_escalated"
            : "unresolved_not_escalated";
        break;
      }

      const action = this.actionRegistry.findActionById(decision.selectedActionId);

      if (!action) {
        status = "failed";
        outcome = "failed";
        finalReason = "Agent selected unregistered action " + decision.selectedActionId + ".";
        break;
      }

      const result = await this.actionExecutor.execute(action, currentSnapshot, {
        trialRecordId: context.trialRecordId,
        actionAttemptCounts: context.actionAttemptCounts,
        completedActionIds: context.completedActionIds,
      });

      this.recordActionResult(context, action.id, result);
      finalReason = result.outcomeSummary ?? result.error ?? finalReason;

      if (result.continuation === "resolved") {
        status = "resolved";
        outcome = "resolved_safely";
        currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
        if (currentSnapshot.id !== context.evidenceSnapshotIds.at(-1)) {
          context.evidenceSnapshotIds.push(currentSnapshot.id);
        }
        break;
      }

      if (result.continuation === "blocked" || result.continuation === "escalated") {
        status = result.continuation === "escalated" ? "escalated" : "unresolved";
        outcome = "unresolved_escalated";
        escalationReason = result.error;
        break;
      }

      if (result.continuation === "failed") {
        status = "failed";
        outcome = "failed";
        break;
      }

      currentSnapshot = this.findAfterSnapshot(result, currentSnapshot);
      context.evidenceSnapshotIds.push(currentSnapshot.id);
      decision = await this.selfHealingAgent.run(currentSnapshot, {
        actionAttemptCounts: context.actionAttemptCounts,
        completedActionIds: context.completedActionIds,
        manualApprovalGranted: false,
      });
      finalReason = decision.reason;
    }

    if (status === "unresolved" && context.executedActionResultIds.length >= this.maxRecoverySteps) {
      status = "escalated";
      outcome = "unresolved_escalated";
      escalationReason = "Maximum self-healing recovery steps reached.";
    }

    const completedAt = new Date().toISOString();
    const trialRecord = this.buildTrialRecord({
      scenarioId: input.scenarioId,
      recoveryMode: "agent",
      startedAt,
      completedAt,
      initialSnapshot: input.snapshot,
      finalSnapshot: currentSnapshot,
      context,
      status,
      outcome,
      notes: finalReason,
      escalationReason,
      diagnosisResultId: decision.diagnosisResult.id,
      recoveryPlanId: decision.recoveryPlan.id,
    });
    const evaluationSummary = this.buildEvaluationSummary(trialRecord, finalReason);

    return {
      trialRecord,
      evaluationSummary,
      agentDecision: decision,
    };
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
    result: { afterEvidenceSnapshotId?: string },
    fallback: EvidenceSnapshot,
  ): EvidenceSnapshot {
    if (!result.afterEvidenceSnapshotId) {
      return fallback;
    }

    return this.evidenceRepository.findSnapshotById(result.afterEvidenceSnapshotId) ?? fallback;
  }

  private buildTrialRecord(input: {
    scenarioId: string;
    recoveryMode: RecoveryMode;
    startedAt: string;
    completedAt: string;
    initialSnapshot: EvidenceSnapshot;
    finalSnapshot: EvidenceSnapshot;
    context: TrialContext;
    status: TrialRecord["status"];
    outcome: TrialRecord["outcome"];
    notes: string;
    escalationReason?: string;
    diagnosisResultId?: string;
    recoveryPlanId?: string;
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
      diagnosisResultId: input.diagnosisResultId,
      recoveryPlanId: input.recoveryPlanId,
      selectedActionIds: input.context.selectedActionIds,
      executedActionResultIds: input.context.executedActionResultIds,
      blockedActionIds: input.context.blockedActionIds,
      status: input.status,
      outcome: input.outcome,
      escalationReason: input.escalationReason,
      metrics: {
        actionCount:
          input.context.executedActionResultIds.length +
          input.context.blockedActionIds.length,
        blockedActionCount: input.context.blockedActionIds.length,
        timeToRecoveryMs:
          input.status === "resolved"
            ? new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()
            : undefined,
      },
      notes: input.notes,
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
