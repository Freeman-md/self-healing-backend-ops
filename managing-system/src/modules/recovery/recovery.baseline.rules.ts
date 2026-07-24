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

function findDeterministicSignal(
  snapshot: EvidenceSnapshot,
  code: string,
) {
  return snapshot.signals.find(
    (signal) => signal.method === "deterministic" && signal.code === code,
  );
}

function isCritical(snapshot: EvidenceSnapshot, code: string): boolean {
  return findDeterministicSignal(snapshot, code)?.status === "critical";
}

const databaseConnectivityRule: BaselineRule = {
  id: "database_connectivity_failure",
  description: "Recover the database before considering the managed-system application.",
  incidentType: "database_connectivity_failure",
  severity: "high",
  proposedActionIds: ["restart_postgres_container"],
  // A database restart must be assessed before any application recovery is
  // considered. A later decision may select the application restart only from
  // fresh evidence that matches its own rule.
  fallbackActionIds: [],
  expectedOutcome: "Database readiness and managed-system health return to a healthy state.",
  matches(snapshot) {
    if (!isCritical(snapshot, "postgres_container_state") && !isCritical(snapshot, "database_connectivity")) return null;
    return {
      matchedSignalNames: snapshot.signals.filter((signal) => signal.method === "deterministic" && (signal.code === "postgres_container_state" || signal.code === "database_connectivity") && signal.status === "critical").map((signal) => signal.name),
      reason: "Canonical deterministic database evidence matched the database-first baseline rule.",
    };
  },
};

const managedSystemRestartRule: BaselineRule = {
  id: "managed_system_service_down",
  description: "Restart the managed-system application only when PostgreSQL remains available.",
  incidentType: "managed_system_service_down",
  severity: "high",
  proposedActionIds: ["restart_managed_system_service"],
  fallbackActionIds: [],
  expectedOutcome: "The managed system returns to a healthy state.",
  matches(snapshot) {
    const applicationUnavailable = isCritical(snapshot, "managed_system_reachability") || isCritical(snapshot, "managed_system_health") || isCritical(snapshot, "managed_system_container_state");
    const databaseAvailable = findDeterministicSignal(snapshot, "database_connectivity")?.status === "normal" || findDeterministicSignal(snapshot, "postgres_container_state")?.status === "normal";
    if (!applicationUnavailable || !databaseAvailable) return null;
    return {
      matchedSignalNames: snapshot.signals.filter((signal) => signal.method === "deterministic" && (signal.code === "managed_system_reachability" || signal.code === "managed_system_health" || signal.code === "managed_system_container_state") && signal.status === "critical").map((signal) => signal.name),
      reason: "Canonical deterministic application evidence matched while PostgreSQL remained available.",
    };
  },
};

export const baselineRules: BaselineRule[] = [databaseConnectivityRule, managedSystemRestartRule];

export function findMatchingBaselineRule(evidenceSnapshot: EvidenceSnapshot): { rule: BaselineRule; match: BaselineRuleMatch } | null {
  for (const rule of baselineRules) {
    const match = rule.matches(evidenceSnapshot);
    if (match) return { rule, match };
  }
  return null;
}
