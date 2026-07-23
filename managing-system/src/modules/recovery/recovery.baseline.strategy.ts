import { randomUUID } from "node:crypto";

import type { EvidenceSnapshot } from "@/modules/evidence";
import type {
  RecoveryDecision,
  RecoveryStrategy,
  RecoveryStrategyContext,
} from "./recovery.types";
import type {
  DiagnosisResult,
  RecoveryPlan,
} from "./recovery.schema";

import {
  findMatchingBaselineRule,
  type BaselineRule,
  type BaselineRuleMatch,
} from "./recovery.baseline.rules";

export class RecoveryBaselineStrategy implements RecoveryStrategy {
  readonly mode = "baseline" as const;
  async decide(
    snapshot: EvidenceSnapshot,
    _context: RecoveryStrategyContext,
  ): Promise<RecoveryDecision> {
    const decidedAt = new Date().toISOString();

    if (snapshot.overallState === "healthy") {
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

      return {
        mode: this.mode,
        snapshotId: snapshot.id,
        decidedAt,
        status: "no_action",
        reason: "Evidence snapshot is healthy, so the baseline path takes no recovery action.",
        diagnosisResult,
        recoveryPlan,
      };
    }

    const matched = findMatchingBaselineRule(snapshot);
    if (matched) return this.buildMatchedDecision(snapshot, matched.rule, matched.match, decidedAt);

    const escalationReason = "No deterministic baseline action is available for the current evidence.";
    const diagnosisResult = this.buildDiagnosis(snapshot, {
      incidentType: snapshot.suspectedIncidentTypes[0] ?? "unclassified_incident",
      severity: snapshot.overallState === "unhealthy" ? "high" : "medium",
      sourceIds: [],
      supportingSignals: snapshot.signals
        .filter((signal) => signal.status !== "normal")
        .map((signal) => signal.name),
      reasoningSummary: "The evidence indicates an incident, but no configured baseline rule matched it.",
    });
    const recoveryPlan = this.buildRecoveryPlan(diagnosisResult, {
      proposedActionIds: [],
      fallbackActionIds: [],
      rationale: "The deterministic baseline has no configured recovery plan for this evidence.",
      expectedOutcome: "No autonomous baseline action is taken.",
      escalationReason,
    });

    return {
      mode: this.mode,
      snapshotId: snapshot.id,
      decidedAt,
      status: "escalate",
      reason: "No fixed baseline recovery rule matched the current evidence snapshot.",
      diagnosisResult,
      recoveryPlan,
      escalationReason,
    };
  }

  private buildMatchedDecision(
    snapshot: EvidenceSnapshot,
    rule: BaselineRule,
    match: BaselineRuleMatch,
    decidedAt: string,
  ): RecoveryDecision {
    const diagnosisResult = this.buildDiagnosis(snapshot, {
      incidentType: rule.incidentType,
      severity: rule.severity,
      sourceIds: [rule.id],
      supportingSignals: match.matchedSignalNames,
      reasoningSummary: match.reason,
    });
    const recoveryPlan = this.buildRecoveryPlan(diagnosisResult, {
      proposedActionIds: rule.proposedActionIds,
      fallbackActionIds: rule.fallbackActionIds,
      rationale: rule.description,
      expectedOutcome: rule.expectedOutcome,
      escalationReason: null,
    });

    return {
      mode: this.mode,
      snapshotId: snapshot.id,
      decidedAt,
      status: "action_selected",
      reason: match.reason,
      diagnosisResult,
      recoveryPlan,
    };
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
    return {
      id: "diagnosis-" + randomUUID(),
      evidenceSnapshotId: snapshot.id,
      createdAt: new Date().toISOString(),
      method: "deterministic",
      sourceIds: input.sourceIds,
      suspectedIncidentType: input.incidentType,
      severity: input.severity,
      confidence: null,
      reasoningSummary: input.reasoningSummary,
      supportingSignals: input.supportingSignals,
      contradictions: snapshot.contradictions,
    };
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
    return {
      id: "recovery-plan-" + randomUUID(),
      diagnosisResultId: diagnosisResult.id,
      createdAt: new Date().toISOString(),
      proposedActionIds: input.proposedActionIds,
      rationale: input.rationale,
      expectedOutcome: input.expectedOutcome,
      fallbackActionIds: input.fallbackActionIds,
      escalationReason: input.escalationReason,
    };
  }
}
