import type { DatabaseSync } from "node:sqlite";

import { DatabaseService } from "@/infrastructure/database";

import type { TrialRecord } from "./trial.types";

export class TrialRepository {
  private readonly database: DatabaseSync;

  constructor(databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.initialize();
  }

  saveTrialRecord(trialRecord: TrialRecord): TrialRecord {
    this.database
      .prepare(
        `
          INSERT INTO trial_records (
            id,
            recovery_mode,
            started_at,
            completed_at,
            status,
            outcome,
            trial_record_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            recovery_mode = excluded.recovery_mode,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            status = excluded.status,
            outcome = excluded.outcome,
            trial_record_json = excluded.trial_record_json
        `,
      )
      .run(
        trialRecord.id,
        trialRecord.recoveryMode,
        trialRecord.startedAt,
        trialRecord.completedAt ?? null,
        trialRecord.status,
        trialRecord.outcome,
        JSON.stringify(trialRecord),
      );

    return trialRecord;
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS trial_records (
        id TEXT PRIMARY KEY,
        recovery_mode TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        outcome TEXT NOT NULL,
        trial_record_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trial_records_recovery_mode
        ON trial_records(recovery_mode);

      CREATE INDEX IF NOT EXISTS idx_trial_records_status
        ON trial_records(status);
    `);
  }
}
