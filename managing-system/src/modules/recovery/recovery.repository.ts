import type { DatabaseSync } from "node:sqlite";

import { DatabaseService } from "@/infrastructure/database";

import { recoveryDecisionSchema } from "./recovery.schema";
import type { RecoveryDecision } from "./recovery.types";

type RecoveryDecisionRow = {
  recovery_decision_json: string;
};

export class RecoveryRepository {
  private readonly database: DatabaseSync;

  constructor(databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.initialize();
  }

  saveRecoveryDecisionHistory(input: {
    trialRecordId: string;
    sequenceNumber: number;
    recoveryDecision: RecoveryDecision;
  }): RecoveryDecision {
    const { trialRecordId, sequenceNumber, recoveryDecision } = input;

    this.database.exec("BEGIN");
    try {
      this.database
        .prepare(
          `INSERT INTO diagnosis_results (id, trial_record_id, created_at, diagnosis_result_json)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             trial_record_id = excluded.trial_record_id,
             created_at = excluded.created_at,
             diagnosis_result_json = excluded.diagnosis_result_json`,
        )
        .run(
          recoveryDecision.diagnosisResult.id,
          trialRecordId,
          recoveryDecision.diagnosisResult.createdAt,
          JSON.stringify(recoveryDecision.diagnosisResult),
        );
      this.database
        .prepare(
          `INSERT INTO recovery_plans (id, trial_record_id, diagnosis_result_id, created_at, recovery_plan_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             trial_record_id = excluded.trial_record_id,
             diagnosis_result_id = excluded.diagnosis_result_id,
             created_at = excluded.created_at,
             recovery_plan_json = excluded.recovery_plan_json`,
        )
        .run(
          recoveryDecision.recoveryPlan.id,
          trialRecordId,
          recoveryDecision.diagnosisResult.id,
          recoveryDecision.recoveryPlan.createdAt,
          JSON.stringify(recoveryDecision.recoveryPlan),
        );
      this.database
        .prepare(
          `INSERT INTO recovery_decisions (
             id, trial_record_id, sequence_number, recovery_mode, snapshot_id,
             decided_at, status, diagnosis_result_id, recovery_plan_id, recovery_decision_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             trial_record_id = excluded.trial_record_id,
             sequence_number = excluded.sequence_number,
             recovery_mode = excluded.recovery_mode,
             snapshot_id = excluded.snapshot_id,
             decided_at = excluded.decided_at,
             status = excluded.status,
             diagnosis_result_id = excluded.diagnosis_result_id,
             recovery_plan_id = excluded.recovery_plan_id,
             recovery_decision_json = excluded.recovery_decision_json`,
        )
        .run(
          recoveryDecision.id,
          trialRecordId,
          sequenceNumber,
          recoveryDecision.mode,
          recoveryDecision.snapshotId,
          recoveryDecision.decidedAt,
          recoveryDecision.status,
          recoveryDecision.diagnosisResult.id,
          recoveryDecision.recoveryPlan.id,
          JSON.stringify(recoveryDecision),
        );
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return recoveryDecision;
  }

  findRecoveryDecisionsByTrialRecordId(
    trialRecordId: string,
  ): RecoveryDecision[] {
    const rows = this.database
      .prepare(
        `SELECT recovery_decision_json FROM recovery_decisions
         WHERE trial_record_id = ? ORDER BY sequence_number ASC`,
      )
      .all(trialRecordId) as RecoveryDecisionRow[];

    return rows.map((row) =>
      recoveryDecisionSchema.parse(JSON.parse(row.recovery_decision_json)),
    );
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS diagnosis_results (
        id TEXT PRIMARY KEY,
        trial_record_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        diagnosis_result_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recovery_plans (
        id TEXT PRIMARY KEY,
        trial_record_id TEXT NOT NULL,
        diagnosis_result_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        recovery_plan_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recovery_decisions (
        id TEXT PRIMARY KEY,
        trial_record_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        recovery_mode TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        decided_at TEXT NOT NULL,
        status TEXT NOT NULL,
        diagnosis_result_id TEXT NOT NULL,
        recovery_plan_id TEXT NOT NULL,
        recovery_decision_json TEXT NOT NULL,
        UNIQUE(trial_record_id, sequence_number)
      );

      CREATE INDEX IF NOT EXISTS idx_diagnosis_results_trial_record_id
        ON diagnosis_results(trial_record_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_plans_trial_record_id
        ON recovery_plans(trial_record_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_decisions_trial_record_sequence
        ON recovery_decisions(trial_record_id, sequence_number);
    `);
  }
}
