import type { FaultProfileCode, IncidentCode } from "@/generated/prisma/client";
import type { ContainerRuntimeTarget } from "@/infrastructure/container-runtime";

export type FaultProfileDefinition = {
  code: FaultProfileCode;
  expectedIncidentCodes: IncidentCode[];
  expectedActionIds: string[];
  stoppedTargets: ContainerRuntimeTarget[];
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

export function isFaultProfileCode(code: string): code is FaultProfileCode {
  return Object.hasOwn(faultProfiles, code);
}
