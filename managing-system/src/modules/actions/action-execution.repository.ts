import type { DatabaseSync } from "node:sqlite";

import { DatabaseService } from "@/infrastructure/database";

import type { ActionExecutionResult } from "./action.types";

export class ActionExecutionRepository {
  private readonly database: DatabaseSync;

  constructor(databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.initialize();
  }

  save(result: ActionExecutionResult): ActionExecutionResult {
    this.database
      .prepare(
        "INSERT INTO action_execution_results (id, trial_record_id, action_definition_id, status, continuation, started_at, completed_at, action_execution_result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET trial_record_id = excluded.trial_record_id, action_definition_id = excluded.action_definition_id, status = excluded.status, continuation = excluded.continuation, started_at = excluded.started_at, completed_at = excluded.completed_at, action_execution_result_json = excluded.action_execution_result_json",
      )
      .run(
        result.id,
        result.trialRecordId,
        result.actionDefinitionId,
        result.status,
        result.continuation,
        result.startedAt,
        result.completedAt ?? null,
        JSON.stringify(result),
      );

    return result;
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS action_execution_results (
        id TEXT PRIMARY KEY,
        trial_record_id TEXT NOT NULL,
        action_definition_id TEXT NOT NULL,
        status TEXT NOT NULL,
        continuation TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        action_execution_result_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_action_execution_results_trial_record_id
        ON action_execution_results(trial_record_id);
    `);
  }
}
