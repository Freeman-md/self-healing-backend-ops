import type {
  EvidenceSignalCode,
  EvidenceSignalStatus,
  EvidenceSnapshot,
} from "@/modules/evidence";

import type { IncidentSeverity } from "./recovery.schema";

export type BaselineRuleMatch = {
  matchedSignalNames: string[];
  reason: string;
};

export type BaselineRule = {
  id: string;
  description: string;
  incidentType: string;
  severity: IncidentSeverity;
  expectedOutcome: string;
  priority: number;
  version: number;
  proposedActionIds: string[];
  fallbackActionIds: string[];
  conditionGroups: Array<{
    matchMode: "ALL" | "ANY";
    conditions: Array<{
      signalCode: EvidenceSignalCode;
      operator: "EQUALS";
      expectedStatus: EvidenceSignalStatus;
    }>;
  }>;
};

export function findMatchingBaselineRule(
  evidenceSnapshot: EvidenceSnapshot,
  baselineRules: BaselineRule[],
): { rule: BaselineRule; match: BaselineRuleMatch } | null {
  for (const rule of baselineRules) {
    const match = matchBaselineRule(evidenceSnapshot, rule);

    if (match) {
      return { rule, match };
    }
  }

  return null;
}

function matchBaselineRule(
  snapshot: EvidenceSnapshot,
  rule: BaselineRule,
): BaselineRuleMatch | null {
  const matchedSignalNames = new Set<string>();

  for (const group of rule.conditionGroups) {
    const conditionResults = group.conditions.map((condition) => {
      if (condition.operator !== "EQUALS") {
        throw new Error(
          `Unsupported baseline operator ${String(condition.operator)}.`,
        );
      }

      const signal = snapshot.signals.find(
        (candidate) =>
          candidate.method === "deterministic" &&
          candidate.code === condition.signalCode,
      );
      const matched = signal?.status === condition.expectedStatus;

      if (matched && signal) {
        matchedSignalNames.add(signal.name);
      }

      return matched;
    });
    const groupMatched =
      group.matchMode === "ALL"
        ? conditionResults.every(Boolean)
        : conditionResults.some(Boolean);

    if (!groupMatched) {
      return null;
    }
  }

  return {
    matchedSignalNames: [...matchedSignalNames],
    reason:
      rule.id === "database_connectivity_failure"
        ? "Canonical deterministic database evidence matched the database-first baseline rule."
        : "Canonical deterministic application evidence matched while PostgreSQL remained available.",
  };
}
