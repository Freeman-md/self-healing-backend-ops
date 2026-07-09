import type { EvidenceSnapshot } from "@/types";

type BaselineRule = {
  id: string;
  description: string;
  actionId: string;
  matches(snapshot: EvidenceSnapshot): { matchedSignalNames: string[]; reason: string } | null;
};

function hasSuspectedIncident(snapshot: EvidenceSnapshot, incidentType: string) {
  return snapshot.suspectedIncidentTypes.some((item) => item === incidentType);
}

function findCriticalSignal(snapshot: EvidenceSnapshot, name: string) {
  return snapshot.signals.find((signal) => signal.name === name && signal.status === "critical");
}

const databaseConnectivityRule: BaselineRule = {
  id: "database_connectivity_failure",
  description: "Select a fixed recovery action when database connectivity is identified as the main incident.",
  actionId: "restart_postgres_container",
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
  actionId: "restart_managed_system_service",
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

export const baselineRules = [databaseConnectivityRule, managedSystemRestartRule];
