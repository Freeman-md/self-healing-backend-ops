import type { DatabaseSync } from "node:sqlite";

import { DatabaseService } from "@/infrastructure/database";

import type { EvaluationSummary } from "./evaluation.types";

export class EvaluationRepository {
  private readonly database: DatabaseSync;

  constructor(databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.initialize();
  }

  saveEvaluationSummary(summary: EvaluationSummary): EvaluationSummary {
    this.database
      .prepare(
        `
          INSERT INTO evaluation_summaries (
            id,
            trial_record_id,
            created_at,
            action_effectiveness,
            evaluation_summary_json
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trial_record_id = excluded.trial_record_id,
            created_at = excluded.created_at,
            action_effectiveness = excluded.action_effectiveness,
            evaluation_summary_json = excluded.evaluation_summary_json
        `,
      )
      .run(
        summary.id,
        summary.trialRecordId,
        summary.createdAt,
        summary.actionEffectiveness,
        JSON.stringify(summary),
      );

    return summary;
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS evaluation_summaries (
        id TEXT PRIMARY KEY,
        trial_record_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        action_effectiveness TEXT NOT NULL,
        evaluation_summary_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evaluation_summaries_trial_record_id
        ON evaluation_summaries(trial_record_id);
    `);
  }
}
