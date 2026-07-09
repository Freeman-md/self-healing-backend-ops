import { randomUUID } from "node:crypto";

import { SelfHealingAgent } from "@/modules/agent";
import { BaselineRecoveryEngine } from "@/modules/recovery";
import type {
  BaselineRecoveryDecision,
  EvaluationSummary,
  EvidenceSnapshot,
  RecoveryMode,
  SelfHealingAgentDecision,
  TrialRecord,
} from "@/types";

export class TrialRunner {
  constructor(
    private readonly baselineRecoveryEngine = new BaselineRecoveryEngine(),
    private readonly selfHealingAgent = new SelfHealingAgent(),
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
    const baselineDecision = this.baselineRecoveryEngine.decide(input.snapshot);
    const completedAt = new Date().toISOString();
    const trialRecord = this.buildBaselineTrialRecord({
      scenarioId: input.scenarioId,
      snapshot: input.snapshot,
      startedAt,
      completedAt,
      baselineDecision,
    });
    const evaluationSummary = this.buildEvaluationSummary(trialRecord, baselineDecision.reason);

    return {
      trialRecord,
      evaluationSummary,
      baselineDecision,
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
    const agentDecision = await this.selfHealingAgent.run(input.snapshot, {
      actionAttemptCounts: {},
      completedActionIds: [],
      manualApprovalGranted: false,
    });
    const completedAt = new Date().toISOString();
    const trialRecord = this.buildAgentTrialRecord({
      scenarioId: input.scenarioId,
      snapshot: input.snapshot,
      startedAt,
      completedAt,
      agentDecision,
    });
    const evaluationSummary = this.buildEvaluationSummary(trialRecord, agentDecision.reason);

    return {
      trialRecord,
      evaluationSummary,
      agentDecision,
    };
  }

  private buildBaselineTrialRecord(input: {
    scenarioId: string;
    snapshot: EvidenceSnapshot;
    startedAt: string;
    completedAt: string;
    baselineDecision: BaselineRecoveryDecision;
  }): TrialRecord {
    const selectedActionIds = input.baselineDecision.selectedActionId
      ? [input.baselineDecision.selectedActionId]
      : [];
    const blockedActionIds = input.baselineDecision.status === "escalate" ? selectedActionIds : [];
    const status = input.baselineDecision.status === "escalate" ? "escalated" : "unresolved";
    const outcome =
      input.baselineDecision.status === "escalate"
        ? "unresolved_escalated"
        : "unresolved_not_escalated";

    return this.buildTrialRecordBase({
      scenarioId: input.scenarioId,
      recoveryMode: "baseline",
      snapshot: input.snapshot,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      selectedActionIds,
      blockedActionIds,
      status,
      outcome,
      notes: input.baselineDecision.reason,
      escalationReason: input.baselineDecision.escalationReason,
    });
  }

  private buildAgentTrialRecord(input: {
    scenarioId: string;
    snapshot: EvidenceSnapshot;
    startedAt: string;
    completedAt: string;
    agentDecision: SelfHealingAgentDecision;
  }): TrialRecord {
    const selectedActionIds = input.agentDecision.selectedActionId
      ? [input.agentDecision.selectedActionId]
      : [];
    const blockedActionIds = input.agentDecision.status === "blocked" ? selectedActionIds : [];
    const status =
      input.agentDecision.status === "escalate"
        ? "escalated"
        : input.agentDecision.status === "blocked"
          ? "unresolved"
          : "unresolved";
    const outcome =
      input.agentDecision.status === "escalate"
        ? "unresolved_escalated"
        : "unresolved_not_escalated";

    return {
      ...this.buildTrialRecordBase({
        scenarioId: input.scenarioId,
        recoveryMode: "agent",
        snapshot: input.snapshot,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        selectedActionIds,
        blockedActionIds,
        status,
        outcome,
        notes: input.agentDecision.reason,
        escalationReason: input.agentDecision.escalationReason,
      }),
      diagnosisResultId: input.agentDecision.diagnosisResult.id,
      recoveryPlanId: input.agentDecision.recoveryPlan.id,
    };
  }

  private buildTrialRecordBase(input: {
    scenarioId: string;
    recoveryMode: RecoveryMode;
    snapshot: EvidenceSnapshot;
    startedAt: string;
    completedAt: string;
    selectedActionIds: string[];
    blockedActionIds: string[];
    status: TrialRecord["status"];
    outcome: TrialRecord["outcome"];
    notes: string;
    escalationReason?: string;
  }): TrialRecord {
    return {
      id: `trial-${randomUUID()}`,
      scenarioId: input.scenarioId,
      recoveryMode: input.recoveryMode,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      initialEvidenceSnapshotId: input.snapshot.id,
      finalEvidenceSnapshotId: input.snapshot.id,
      evidenceSnapshotIds: [input.snapshot.id],
      selectedActionIds: input.selectedActionIds,
      executedActionResultIds: [],
      blockedActionIds: input.blockedActionIds,
      status: input.status,
      outcome: input.outcome,
      escalationReason: input.escalationReason,
      metrics: {
        actionCount: input.selectedActionIds.length,
        blockedActionCount: input.blockedActionIds.length,
      },
      notes: input.notes,
    };
  }

  private buildEvaluationSummary(
    trialRecord: TrialRecord,
    summaryReason: string,
  ): EvaluationSummary {
    return {
      id: `evaluation-${randomUUID()}`,
      trialRecordId: trialRecord.id,
      createdAt: new Date().toISOString(),
      summary: summaryReason,
      recoverySucceeded: false,
      safetyMaintained: true,
      actionEffectiveness: "unknown",
      lessons: [
        "This first trial skeleton records planning and gating output before action execution is implemented.",
      ],
      recommendedChanges: [
        "Implement action execution and reassessment before judging recovery effectiveness.",
      ],
    };
  }
}
