import type { SafetyRule } from "@/modules/safety";
import type { DatabaseSync } from "node:sqlite";
import { DatabaseService } from "@/infrastructure/database";

import type { Action, ActionExecutionResult } from "./action.types";

const safetyRules: SafetyRule[] = [
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

const actions: Action[] = [
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

export class ActionRepository {
  private readonly database: DatabaseSync;

  constructor(databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS action_execution_results (
        id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL,
        action_definition_id TEXT NOT NULL, status TEXT NOT NULL,
        continuation TEXT NOT NULL, started_at TEXT NOT NULL,
        completed_at TEXT, action_execution_result_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_action_execution_results_trial_record_id
        ON action_execution_results(trial_record_id);
    `);
  }

  listActions(): Action[] {
    return actions;
  }

  listSafetyRules(): SafetyRule[] {
    return safetyRules;
  }

  findActionById(actionId: string): Action | null {
    return actions.find((action) => action.id === actionId) ?? null;
  }

  findSafetyRuleById(ruleId: string): SafetyRule | null {
    return safetyRules.find((rule) => rule.id === ruleId) ?? null;
  }

  saveActionExecutionResult(result: ActionExecutionResult): ActionExecutionResult {
    this.database.prepare(
      "INSERT INTO action_execution_results (id, trial_record_id, action_definition_id, status, continuation, started_at, completed_at, action_execution_result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET trial_record_id = excluded.trial_record_id, action_definition_id = excluded.action_definition_id, status = excluded.status, continuation = excluded.continuation, started_at = excluded.started_at, completed_at = excluded.completed_at, action_execution_result_json = excluded.action_execution_result_json",
    ).run(result.id, result.trialRecordId, result.actionId, result.status, result.continuation, result.startedAt, result.completedAt ?? null, JSON.stringify(result));
    return result;
  }
}
