import type { FaultProfileCode } from "./experiment.types";

export type FaultProfileDefinition = {
  code: FaultProfileCode;
  expectedIncidentCodes: string[];
  expectedActionIds: string[];
  stoppedTargets: Array<"managed-system" | "postgres">;
};

export const faultProfiles: Record<FaultProfileCode, FaultProfileDefinition> = {
  managed_system_application_stopped: {
    code: "managed_system_application_stopped",
    expectedIncidentCodes: ["managed_system_service_down", "managed_system_unreachable"],
    expectedActionIds: ["restart_managed_system_service"],
    stoppedTargets: ["managed-system"],
  },
  managed_system_postgres_stopped: {
    code: "managed_system_postgres_stopped",
    expectedIncidentCodes: ["postgres_unavailable", "database_connectivity_failure"],
    expectedActionIds: ["restart_postgres_container"],
    stoppedTargets: ["postgres"],
  },
  managed_system_application_and_postgres_stopped: {
    code: "managed_system_application_and_postgres_stopped",
    expectedIncidentCodes: ["postgres_unavailable", "database_connectivity_failure"],
    expectedActionIds: ["restart_postgres_container", "restart_managed_system_service"],
    stoppedTargets: ["managed-system", "postgres"],
  },
};

export function findFaultProfile(code: FaultProfileCode): FaultProfileDefinition {
  return faultProfiles[code];
}
