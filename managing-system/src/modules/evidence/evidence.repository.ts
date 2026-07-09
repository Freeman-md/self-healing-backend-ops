import type { DatabaseSync } from "node:sqlite";

import { evidenceSnapshotSchema } from "@/schemas";
import { DatabaseService } from "@/shared/database/database.service";
import type { EvidenceSnapshot } from "@/types";

type EvidenceSnapshotRow = {
  snapshot_json: string;
};

export class EvidenceRepository {
  private readonly database: DatabaseSync;

  constructor(private readonly databaseService = new DatabaseService()) {
    this.database = databaseService.getConnection();
    this.initialize();
  }

  saveSnapshot(snapshot: EvidenceSnapshot): EvidenceSnapshot {
    this.database
      .prepare(
        `
          INSERT INTO evidence_snapshots (
            id,
            created_at,
            overall_state,
            snapshot_json
          )
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            created_at = excluded.created_at,
            overall_state = excluded.overall_state,
            snapshot_json = excluded.snapshot_json
        `,
      )
      .run(
        snapshot.id,
        snapshot.createdAt,
        snapshot.overallState,
        JSON.stringify(snapshot),
      );

    return snapshot;
  }

  findSnapshotById(id: string): EvidenceSnapshot | null {
    const row = this.database
      .prepare("SELECT snapshot_json FROM evidence_snapshots WHERE id = ?")
      .get(id) as EvidenceSnapshotRow | undefined;

    if (!row) {
      return null;
    }

    return evidenceSnapshotSchema.parse(JSON.parse(row.snapshot_json));
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS evidence_snapshots (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        overall_state TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_created_at
        ON evidence_snapshots(created_at);

      CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_overall_state
        ON evidence_snapshots(overall_state);
    `);
  }
}
