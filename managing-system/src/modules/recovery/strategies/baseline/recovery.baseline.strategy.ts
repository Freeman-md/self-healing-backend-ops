import { getDeterministicEvidenceState, type EvidenceSnapshot } from "@/modules/evidence";
import type {
  RecoveryDecision,
  DecisionRecoveryStrategy,
  RecoveryStrategyContext,
} from "../../recovery.types";
import type { DiagnosisResult, RecoveryPlan } from "../../recovery.schema";
import { RecoveryFactory } from "../../recovery.factory";

import type { BaselineRule, BaselineRuleMatch } from "./recovery.baseline.rules";

type BaselineRuleSource = {
  findMatchingBaselineRule(
    snapshot: EvidenceSnapshot,
  ): Promise<{ rule: BaselineRule; match: BaselineRuleMatch } | null>;
};

export class RecoveryBaselineStrategy implements DecisionRecoveryStrategy {
  readonly orchestration = "external" as const;

  readonly mode = "baseline" as const;

  constructor(
    private readonly baselineRuleSource: BaselineRuleSource,
    private readonly recoveryFactory = new RecoveryFactory(),
  ) {}

  async decide(
    snapshot: EvidenceSnapshot,
    context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision> {
    const deterministicState = getDeterministicEvidenceState(snapshot);

    if (deterministicState === "healthy") {
      const diagnosisResult = this.buildDiagnosis(snapshot, {
        incidentType: "no_incident",
        severity: "low",
        sourceIds: [],
        supportingSignals: snapshot.signals
          .filter((signal) => signal.status === "normal")
          .map((signal) => signal.name),
        reasoningSummary: "The evidence snapshot reports a healthy managed system.",
      });

      const recoveryPlan = this.buildRecoveryPlan(diagnosisResult, {
        proposedActionIds: [],
        fallbackActionIds: [],
        rationale: "No recovery action is required for a healthy system.",
        expectedOutcome: "The managed system remains healthy.",
        escalationReason: null,
      });

      return this.recoveryFactory.createRecoveryDecision({
        mode: this.mode,
        snapshot,
        status: "no_action",
        reason: "Evidence snapshot is healthy, so the baseline path takes no recovery action.",
        diagnosisResult,
        recoveryPlan,
      });
    }

    const matched = await this.baselineRuleSource.findMatchingBaselineRule(snapshot);

    if (matched) {
      const proposedActionIds = matched.rule.proposedActionIds.filter(
        (actionId) => !this.wasAttempted(actionId, context),
      );

      const fallbackActionIds = matched.rule.fallbackActionIds.filter(
        (actionId) => !this.wasAttempted(actionId, context),
      );

      if (proposedActionIds.length > 0 || fallbackActionIds.length > 0) {
        return this.buildMatchedDecision(
          snapshot,
          matched.rule,
          matched.match,
          proposedActionIds,
          fallbackActionIds,
        );
      }
    }

    const escalationReason =
      "No deterministic baseline action is available for the current evidence.";

    const diagnosisResult = this.buildDiagnosis(snapshot, {
      incidentType: snapshot.suspectedIncidentTypes[0] ?? "unclassified_incident",
      severity: deterministicState === "unhealthy" ? "high" : "medium",
      sourceIds: [],
      supportingSignals: snapshot.signals
        .filter((signal) => signal.status !== "normal")
        .map((signal) => signal.name),
      reasoningSummary:
        "The evidence indicates an incident, but no configured baseline rule matched it.",
    });

    const recoveryPlan = this.buildRecoveryPlan(diagnosisResult, {
      proposedActionIds: [],
      fallbackActionIds: [],
      rationale: "The deterministic baseline has no configured recovery plan for this evidence.",
      expectedOutcome: "No autonomous baseline action is taken.",
      escalationReason,
    });

    return this.recoveryFactory.createRecoveryDecision({
      mode: this.mode,
      snapshot,
      status: "escalate",
      reason: "No fixed baseline recovery rule matched the current evidence snapshot.",
      diagnosisResult,
      recoveryPlan,
      escalationReason,
    });
  }

  private buildMatchedDecision(
    snapshot: EvidenceSnapshot,
    rule: BaselineRule,
    match: BaselineRuleMatch,
    proposedActionIds = rule.proposedActionIds,
    fallbackActionIds = rule.fallbackActionIds,
  ): RecoveryDecision {
    const diagnosisResult = this.buildDiagnosis(snapshot, {
      incidentType: rule.incidentType,
      severity: rule.severity,
      sourceIds: [rule.id],
      supportingSignals: match.matchedSignalNames,
      reasoningSummary: match.reason,
    });

    const recoveryPlan = this.buildRecoveryPlan(diagnosisResult, {
      proposedActionIds,
      fallbackActionIds,
      rationale: rule.description,
      expectedOutcome: rule.expectedOutcome,
      escalationReason: null,
    });

    return this.recoveryFactory.createRecoveryDecision({
      mode: this.mode,
      snapshot,
      status: "action_selected",
      reason: match.reason,
      diagnosisResult,
      recoveryPlan,
    });
  }

  private wasAttempted(actionId: string, context: RecoveryStrategyContext): boolean {
    return (
      (context.actionAttemptCounts[actionId] ?? 0) > 0 ||
      context.completedActionIds.includes(actionId)
    );
  }

  private buildDiagnosis(
    snapshot: EvidenceSnapshot,
    input: {
      incidentType: string;
      severity: DiagnosisResult["severity"];
      sourceIds: string[];
      supportingSignals: string[];
      reasoningSummary: string;
    },
  ): DiagnosisResult {
    return this.recoveryFactory.createDiagnosisResult({
      evidenceSnapshotId: snapshot.id,
      method: "deterministic",
      sourceIds: input.sourceIds,
      suspectedIncidentType: input.incidentType,
      severity: input.severity,
      confidence: null,
      reasoningSummary: input.reasoningSummary,
      supportingSignals: input.supportingSignals,
      contradictions: snapshot.contradictions,
    });
  }

  private buildRecoveryPlan(
    diagnosisResult: DiagnosisResult,
    input: {
      proposedActionIds: string[];
      fallbackActionIds: string[];
      rationale: string;
      expectedOutcome: string;
      escalationReason: string | null;
    },
  ): RecoveryPlan {
    return this.recoveryFactory.createRecoveryPlan({
      diagnosisResultId: diagnosisResult.id,
      proposedActionIds: input.proposedActionIds,
      rationale: input.rationale,
      expectedOutcome: input.expectedOutcome,
      fallbackActionIds: input.fallbackActionIds,
      escalationReason: input.escalationReason,
    });
  }
}
