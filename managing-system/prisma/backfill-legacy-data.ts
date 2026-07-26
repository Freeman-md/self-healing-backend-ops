import { existsSync } from "node:fs";

import Database from "better-sqlite3";

import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { ActionRepository } from "../src/modules/action/action.repository";
import { actionExecutionResultSchema } from "../src/modules/action/action.schema";
import {
  evidenceSnapshotSchema,
  rawEvidenceSchema,
  type RawEvidenceSource,
} from "../src/modules/evidence/evidence.schema";
import { EvidenceRepository } from "../src/modules/evidence/evidence.repository";
import { evaluationSummarySchema } from "../src/modules/evaluation/evaluation.schema";
import { EvaluationRepository } from "../src/modules/evaluation/evaluation.repository";
import {
  diagnosisResultSchema,
  recoveryDecisionSchema,
  recoveryPlanSchema,
} from "../src/modules/recovery/recovery.schema";
import { RecoveryRepository } from "../src/modules/recovery/recovery.repository";
import { parseStoredTrialRecord } from "../src/modules/trial/trial.helpers";
import { TrialRepository } from "../src/modules/trial/trial.repository";
import type { TrialRecord } from "../src/modules/trial/trial.types";
import { config } from "../src/config";
import { resolveDatabasePath } from "./database-path";
import {
  requireLegacyMatch,
  type LegacyRow,
} from "./legacy-row-validation";

type EntityName =
  | "evidenceSnapshots"
  | "rawEvidence"
  | "trials"
  | "diagnoses"
  | "recoveryPlans"
  | "recoveryDecisions"
  | "actionResults"
  | "evaluations";

type EntitySummary = {
  read: number;
  migrated: number;
  skipped: number;
  failed: number;
};

type BackfillSummary = Record<EntityName, EntitySummary>;

type LegacyPayloadRow = LegacyRow;

const databasePath = resolveDatabasePath(config.database.url);

if (!existsSync(databasePath)) {
  throw new Error(`Configured SQLite database does not exist: ${databasePath}`);
}

const summary = createSummary();
const failures: string[] = [];
const legacy = new Database(databasePath, { readonly: true });
const legacyRows = {
  evidence: readLegacyRows(legacy, "evidence_snapshots"),
  trials: readLegacyRows(legacy, "trial_records"),
  diagnoses: readLegacyRows(legacy, "diagnosis_results"),
  plans: readLegacyRows(legacy, "recovery_plans"),
  decisions: readLegacyRows(legacy, "recovery_decisions"),
  actionResults: readLegacyRows(legacy, "action_execution_results"),
  evaluations: readLegacyRows(legacy, "evaluation_summaries"),
};
legacy.close();

const prisma = new PrismaService();
const evidenceRepository = new EvidenceRepository(prisma);
const trialRepository = new TrialRepository(prisma);
const recoveryRepository = new RecoveryRepository(prisma);
const actionRepository = new ActionRepository(prisma);
const evaluationRepository = new EvaluationRepository(prisma);

try {
  await prisma.open();

  for (const row of legacyRows.evidence) {
    summary.evidenceSnapshots.read += 1;

    try {
      const snapshot = evidenceSnapshotSchema.parse(
        parseJsonColumn(row, "snapshot_json"),
      );
      requireLegacyMatch("evidence snapshot", row, "id", snapshot.id);
      requireLegacyMatch(
        "evidence snapshot",
        row,
        "created_at",
        snapshot.createdAt,
      );

      for (const rawEvidenceId of snapshot.rawEvidenceIds) {
        summary.rawEvidence.read += 1;
        const existingRawEvidence = await prisma.rawEvidence.findUnique({
          where: { id: rawEvidenceId },
          select: { id: true },
        });

        if (existingRawEvidence) {
          summary.rawEvidence.skipped += 1;
          continue;
        }

        const placeholder = rawEvidenceSchema.parse({
          id: rawEvidenceId,
          source: inferRawEvidenceSource(rawEvidenceId),
          target: "legacy-unavailable",
          collectedAt: inferTimestamp(rawEvidenceId, snapshot.createdAt),
          status: "collected",
          rawText: null,
          error: null,
        });
        await evidenceRepository.saveRawEvidence(placeholder);
        summary.rawEvidence.migrated += 1;
      }

      const existingSnapshot = await prisma.evidenceSnapshot.findUnique({
        where: { id: snapshot.id },
        select: { id: true },
      });
      await evidenceRepository.saveEvidenceSnapshot(snapshot);
      await prisma.evidenceSnapshot.update({
        where: { id: snapshot.id },
        data: {
          legacyPayload: readStringColumn(row, "snapshot_json"),
        },
      });
      summary.evidenceSnapshots[
        existingSnapshot ? "skipped" : "migrated"
      ] += 1;
    } catch (error) {
      recordFailure("evidenceSnapshots", row, error);
    }
  }

  for (const row of legacyRows.trials) {
    summary.trials.read += 1;

    try {
      const trial = parseStoredTrialRecord(
        parseJsonColumn(row, "trial_record_json"),
      );
      requireLegacyMatch("trial", row, "id", trial.id);
      requireLegacyMatch("trial", row, "started_at", trial.startedAt);
      requireLegacyMatch(
        "trial",
        row,
        "completed_at",
        trial.completedAt,
      );
      const existingTrial = await prisma.trialRecord.findUnique({
        where: { id: trial.id },
        select: { id: true },
      });
      await trialRepository.saveTrialRecord(trial);
      await prisma.trialRecord.update({
        where: { id: trial.id },
        data: {
          legacyPayload: readStringColumn(row, "trial_record_json"),
        },
      });
      summary.trials[existingTrial ? "skipped" : "migrated"] += 1;
    } catch (error) {
      recordFailure("trials", row, error);
    }
  }

  const decisionsByDiagnosis = new Set<string>();
  const decisionsByPlan = new Set<string>();

  for (const row of legacyRows.decisions) {
    summary.recoveryDecisions.read += 1;

    try {
      const decision = recoveryDecisionSchema.parse(
        parseJsonColumn(row, "recovery_decision_json"),
      );
      requireLegacyMatch("recovery decision", row, "id", decision.id);
      requireLegacyMatch(
        "recovery decision",
        row,
        "snapshot_id",
        decision.snapshotId,
      );
      requireLegacyMatch(
        "recovery decision",
        row,
        "decided_at",
        decision.decidedAt,
      );
      requireLegacyMatch(
        "recovery decision",
        row,
        "diagnosis_result_id",
        decision.diagnosisResult.id,
      );
      requireLegacyMatch(
        "recovery decision",
        row,
        "recovery_plan_id",
        decision.recoveryPlan.id,
      );
      const trialRecordId = readStringColumn(row, "trial_record_id");
      const sequenceNumber = readNumberColumn(row, "sequence_number");
      const existingDecision = await prisma.recoveryDecision.findUnique({
        where: { id: decision.id },
        select: { id: true },
      });
      await recoveryRepository.saveRecoveryDecisionHistory({
        trialRecordId,
        sequenceNumber,
        recoveryDecision: decision,
      });
      await prisma.recoveryDecision.update({
        where: { id: decision.id },
        data: {
          legacyPayload: readStringColumn(row, "recovery_decision_json"),
        },
      });
      decisionsByDiagnosis.add(decision.diagnosisResult.id);
      decisionsByPlan.add(decision.recoveryPlan.id);
      summary.recoveryDecisions[
        existingDecision ? "skipped" : "migrated"
      ] += 1;
    } catch (error) {
      recordFailure("recoveryDecisions", row, error);
    }
  }

  await validateLegacyChildPayloads(
    legacyRows.diagnoses,
    "diagnoses",
    "diagnosis_result_json",
    diagnosisResultSchema.parse,
    decisionsByDiagnosis,
    (row, diagnosis) => {
      requireLegacyMatch("diagnosis", row, "id", diagnosis.id);
      requireLegacyMatch(
        "diagnosis",
        row,
        "created_at",
        diagnosis.createdAt,
      );
    },
  );
  await validateLegacyChildPayloads(
    legacyRows.plans,
    "recoveryPlans",
    "recovery_plan_json",
    recoveryPlanSchema.parse,
    decisionsByPlan,
    (row, plan) => {
      requireLegacyMatch("recovery plan", row, "id", plan.id);
      requireLegacyMatch(
        "recovery plan",
        row,
        "diagnosis_result_id",
        plan.diagnosisResultId,
      );
      requireLegacyMatch(
        "recovery plan",
        row,
        "created_at",
        plan.createdAt,
      );
    },
  );

  for (const row of legacyRows.actionResults) {
    summary.actionResults.read += 1;

    try {
      const actionResult = actionExecutionResultSchema.parse(
        parseJsonColumn(row, "action_execution_result_json"),
      );
      requireLegacyMatch("action result", row, "id", actionResult.id);
      requireLegacyMatch(
        "action result",
        row,
        "trial_record_id",
        actionResult.trialRecordId,
      );
      requireLegacyMatch(
        "action result",
        row,
        "action_definition_id",
        actionResult.actionId,
      );
      requireLegacyMatch(
        "action result",
        row,
        "started_at",
        actionResult.startedAt,
      );
      requireLegacyMatch(
        "action result",
        row,
        "completed_at",
        actionResult.completedAt,
      );
      const existingResult = await prisma.actionExecutionResult.findUnique({
        where: { id: actionResult.id },
        select: { id: true },
      });
      await actionRepository.saveActionExecutionResult(actionResult);
      await prisma.actionExecutionResult.update({
        where: { id: actionResult.id },
        data: {
          legacyPayload: readStringColumn(
            row,
            "action_execution_result_json",
          ),
        },
      });
      summary.actionResults[existingResult ? "skipped" : "migrated"] += 1;
    } catch (error) {
      recordFailure("actionResults", row, error);
    }
  }

  for (const row of legacyRows.evaluations) {
    summary.evaluations.read += 1;

    try {
      const evaluation = evaluationSummarySchema.parse(
        parseJsonColumn(row, "evaluation_summary_json"),
      );
      requireLegacyMatch("evaluation", row, "id", evaluation.id);
      requireLegacyMatch(
        "evaluation",
        row,
        "trial_record_id",
        evaluation.trialRecordId,
      );
      requireLegacyMatch(
        "evaluation",
        row,
        "created_at",
        evaluation.createdAt,
      );
      const existingEvaluation = await prisma.evaluationSummary.findUnique({
        where: { id: evaluation.id },
        select: { id: true },
      });
      await evaluationRepository.saveEvaluationSummary(evaluation);
      await prisma.evaluationSummary.update({
        where: { id: evaluation.id },
        data: {
          legacyPayload: readStringColumn(row, "evaluation_summary_json"),
        },
      });
      summary.evaluations[
        existingEvaluation ? "skipped" : "migrated"
      ] += 1;
    } catch (error) {
      recordFailure("evaluations", row, error);
    }
  }
} finally {
  await prisma.close();
}

console.log({
  event: "legacy_backfill_completed",
  databasePath,
  summary,
  failures,
});

if (failures.length > 0) {
  process.exitCode = 1;
}

async function validateLegacyChildPayloads<T extends { id: string }>(
  rows: LegacyPayloadRow[],
  entityName: "diagnoses" | "recoveryPlans",
  columnName: string,
  parse: (value: unknown) => T,
  migratedIds: Set<string>,
  validateIdentity: (row: LegacyPayloadRow, value: T) => void,
): Promise<void> {
  for (const row of rows) {
    summary[entityName].read += 1;

    try {
      const value = parse(parseJsonColumn(row, columnName));
      validateIdentity(row, value);

      if (!migratedIds.has(value.id)) {
        throw new Error(
          `Legacy ${entityName} record ${value.id} has no recovery decision.`,
        );
      }

      const legacyPayload = readStringColumn(row, columnName);
      const existing =
        entityName === "diagnoses"
          ? await prisma.diagnosisResult.findUnique({
              where: { id: value.id },
              select: { legacyPayload: true },
            })
          : await prisma.recoveryPlan.findUnique({
              where: { id: value.id },
              select: { legacyPayload: true },
            });

      if (entityName === "diagnoses") {
        await prisma.diagnosisResult.update({
          where: { id: value.id },
          data: { legacyPayload },
        });
      } else {
        await prisma.recoveryPlan.update({
          where: { id: value.id },
          data: { legacyPayload },
        });
      }

      summary[entityName][existing?.legacyPayload ? "skipped" : "migrated"] +=
        1;
    } catch (error) {
      recordFailure(entityName, row, error);
    }
  }
}

function readLegacyRows(
  database: Database.Database,
  tableName: string,
): LegacyPayloadRow[] {
  const legacyName = `legacy_${tableName}`;
  const exists = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(legacyName);

  if (!exists) {
    return [];
  }

  return database.prepare(`SELECT * FROM "${legacyName}"`).all() as LegacyPayloadRow[];
}

function parseJsonColumn(row: LegacyPayloadRow, columnName: string): unknown {
  const value = row[columnName];

  if (typeof value !== "string") {
    throw new Error(`Legacy column ${columnName} is not a JSON string.`);
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(
      `Legacy column ${columnName} contains malformed JSON: ${
        error instanceof Error ? error.message : "unknown parse error"
      }`,
    );
  }
}

function readStringColumn(row: LegacyPayloadRow, columnName: string): string {
  const value = row[columnName];

  if (typeof value !== "string" || !value) {
    throw new Error(`Legacy column ${columnName} must be a non-empty string.`);
  }

  return value;
}

function readNumberColumn(row: LegacyPayloadRow, columnName: string): number {
  const value = row[columnName];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Legacy column ${columnName} must be an integer.`);
  }

  return value;
}

function inferRawEvidenceSource(rawEvidenceId: string): RawEvidenceSource {
  const source = rawEvidenceId.slice("raw-".length).split("-")[0];

  if (
    source === "health" ||
    source === "metrics" ||
    source === "logs" ||
    source === "container"
  ) {
    return source;
  }

  return "business-endpoint";
}

function inferTimestamp(rawEvidenceId: string, fallback: string): string {
  const match = rawEvidenceId.match(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
  );
  return match?.[0] ?? fallback;
}

function recordFailure(
  entityName: EntityName,
  row: LegacyPayloadRow,
  error: unknown,
): void {
  summary[entityName].failed += 1;
  const rowId = typeof row.id === "string" ? row.id : "unknown";
  failures.push(
    `${entityName}:${rowId}: ${
      error instanceof Error ? error.message : "unknown migration error"
    }`,
  );
}

function createSummary(): BackfillSummary {
  const empty = (): EntitySummary => ({
    read: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
  });

  return {
    evidenceSnapshots: empty(),
    rawEvidence: empty(),
    trials: empty(),
    diagnoses: empty(),
    recoveryPlans: empty(),
    recoveryDecisions: empty(),
    actionResults: empty(),
    evaluations: empty(),
  };
}
