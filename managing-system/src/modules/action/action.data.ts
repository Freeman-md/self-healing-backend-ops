import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SafetyRule } from "@/modules/safety";

import type { Action } from "./action.types";

export type ActionHandlerInput = {
  action: Action;
  trialRecordId: string;
};

export type ActionHandlerResult = {
  output: string;
};

export type ActionHandler = (
  input: ActionHandlerInput,
) => Promise<ActionHandlerResult>;

const execFileAsync = promisify(execFile);

export type ProcessExecutor = (
  command: string,
  arguments_: string[],
) => Promise<ActionHandlerResult>;

const executeDockerProcess: ProcessExecutor = async (command, arguments_) => {
  const { stdout, stderr } = await execFileAsync(command, arguments_);

  return {
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
}

export function createActionHandlers(
  executeProcess: ProcessExecutor = executeDockerProcess,
): Record<string, ActionHandler> {
  return {
    restart_managed_system_service: async () =>
      executeProcess("docker", ["restart", "managed-system-app"]),
    restart_postgres_container: async () =>
      executeProcess("docker", ["restart", "managed-system-postgres"]),
  };
}

export const predefinedSafetyRules: SafetyRule[] = [
  {
    id: "allow_only_when_system_not_healthy",
    description: "Only allow this recovery action when the managed system is degraded or unhealthy.",
    checkType: "evidence_state_matches",
    params: {
      allowedStates: ["degraded", "unhealthy"],
    },
    onFail: "block",
  },
  {
    id: "max_one_attempt_per_cycle",
    description: "Only allow one execution attempt for the same action within the current recovery cycle.",
    checkType: "max_attempts_not_exceeded",
    params: {
      maxAttempts: 1,
    },
    onFail: "escalate",
  },
];

export const predefinedActions: Action[] = [
  {
    id: "restart_postgres_container",
    name: "Restart PostgreSQL container",
    description: "Restart the PostgreSQL container used by the managed system testbed.",
    handlerKey: "restart_postgres_container",
    riskLevel: "medium",
    safetyRuleIds: ["allow_only_when_system_not_healthy", "max_one_attempt_per_cycle"],
    expectedOutcome: {
      description: "Database readiness should recover after the PostgreSQL container restart.",
      successCriteria: [
        {
          id: "health_ready_after_postgres_restart",
          description: "Health endpoint should report a healthy state after the restart.",
          checkType: "health_status_is",
          params: {
            expectedState: "healthy",
          },
        },
      ],
    },
  },
  {
    id: "restart_managed_system_service",
    name: "Restart managed-system service",
    description: "Restart the managed-system application service when the system is degraded or unhealthy.",
    handlerKey: "restart_managed_system_service",
    riskLevel: "medium",
    safetyRuleIds: ["allow_only_when_system_not_healthy", "max_one_attempt_per_cycle"],
    expectedOutcome: {
      description: "The managed system should return to a healthy state after the service restart.",
      successCriteria: [
        {
          id: "health_ready_after_service_restart",
          description: "Health endpoint should report a healthy state after the restart.",
          checkType: "health_status_is",
          params: {
            expectedState: "healthy",
          },
        },
      ],
    },
  },
];

export const actionHandlers = createActionHandlers();
