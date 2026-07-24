import type { EvidenceSnapshot } from "@/modules/evidence";

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
  proposedActionIds: string[];
  fallbackActionIds: string[];
  expectedOutcome: string;
  matches(snapshot: EvidenceSnapshot): BaselineRuleMatch | null;
};

function hasSuspectedIncident(snapshot: EvidenceSnapshot, incidentType: string): boolean {
  return snapshot.suspectedIncidentTypes.some((item) => item === incidentType);
}

function findCriticalSignal(snapshot: EvidenceSnapshot, name: string) {
  return snapshot.signals.find((signal) => signal.name === name && signal.status === "critical");
}

const databaseConnectivityRule: BaselineRule = {
  id: "database_connectivity_failure",
  description: "Select a fixed recovery action when database connectivity is identified as the main incident.",
  incidentType: "database_connectivity_failure",
  severity: "high",
  proposedActionIds: ["restart_postgres_container"],
  fallbackActionIds: ["restart_managed_system_service"],
  expectedOutcome: "Database readiness and managed-system health return to a healthy state.",
  matches(snapshot) {
    const matchedSignal = findCriticalSignal(snapshot, "database_connectivity");

    if (!matchedSignal && !hasSuspectedIncident(snapshot, "database_connectivity_failure")) {
      return null;
    }

    return {
      matchedSignalNames: matchedSignal ? [matchedSignal.name] : [],
      reason: "Database connectivity evidence matched the fixed baseline recovery rule.",
    };
  },
};

const managedSystemRestartRule: BaselineRule = {
  id: "managed_system_unhealthy",
  description: "Select a fixed recovery action when the managed system is degraded or unhealthy without a more specific match.",
  incidentType: "managed_system_unhealthy",
  severity: "high",
  proposedActionIds: ["restart_managed_system_service"],
  fallbackActionIds: [],
  expectedOutcome: "The managed system returns to a healthy state.",
  matches(snapshot) {
    if (snapshot.overallState === "healthy" || snapshot.overallState === "unknown") {
      return null;
    }

    return {
      matchedSignalNames: snapshot.signals
        .filter((signal) => signal.status === "critical" || signal.status === "warning")
        .map((signal) => signal.name),
      reason: "Managed system evidence requires a fixed restart action in the baseline path.",
    };
  },
};

export const baselineRules: BaselineRule[] = [
  databaseConnectivityRule,
  managedSystemRestartRule,
];

export function findMatchingBaselineRule(
  evidenceSnapshot: EvidenceSnapshot,
): { rule: BaselineRule; match: BaselineRuleMatch } | null {
  for (const rule of baselineRules) {
    const match = rule.matches(evidenceSnapshot);

    if (match) {
      return { rule, match };
    }
  }

  return null;
}
