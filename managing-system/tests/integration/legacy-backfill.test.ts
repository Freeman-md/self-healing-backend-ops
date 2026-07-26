import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import Database from "better-sqlite3";

import { PrismaService } from "@/infrastructure/database";
import { seedCatalogue } from "../../prisma/catalogue";

test("historical fixture backfills without loss and remains idempotent", async () => {
  const fixture = createLegacyFixture(false);

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    applyMigration(fixture.databasePath);
    const prisma = new PrismaService(fixture.databaseUrl);
    await prisma.open();
    await seedCatalogue(prisma);
    await prisma.close();

    runScript("prisma:backfill", fixture.databaseUrl);
    runScript("prisma:backfill", fixture.databaseUrl);

    const verifier = new PrismaService(fixture.databaseUrl);
    await verifier.open();
    assert.equal(await verifier.evidenceSnapshot.count(), 1);
    assert.equal(await verifier.trialRecord.count(), 1);
    assert.equal(await verifier.recoveryDecision.count(), 1);
    assert.equal(await verifier.diagnosisResult.count(), 1);
    assert.equal(await verifier.recoveryPlan.count(), 1);
    assert.equal(await verifier.actionExecutionResult.count(), 1);
    assert.equal(await verifier.evaluationSummary.count(), 1);
    assert.ok(
      (
        await verifier.evidenceSnapshot.findUniqueOrThrow({
          where: { id: "legacy-snapshot" },
          select: { legacyPayload: true },
        })
      ).legacyPayload,
    );
    assert.ok(
      (
        await verifier.recoveryDecision.findUniqueOrThrow({
          where: { id: "legacy-decision" },
          select: { legacyPayload: true },
        })
      ).legacyPayload,
    );
    await verifier.close();
  } finally {
    fixture.close();
  }
});

test("malformed historical payloads produce an actionable failing report", async () => {
  const fixture = createLegacyFixture(true);

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    applyMigration(fixture.databasePath);
    const prisma = new PrismaService(fixture.databaseUrl);
    await prisma.open();
    await seedCatalogue(prisma);
    await prisma.close();

    const result = runScript("prisma:backfill", fixture.databaseUrl, false);

    assert.notEqual(result.status, 0);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /malformed JSON|legacy_backfill_completed/,
    );
  } finally {
    fixture.close();
  }
});

function createLegacyFixture(malformedEvidence: boolean): {
  databasePath: string;
  databaseUrl: string;
  close(): void;
} {
  const directory = mkdtempSync(join(tmpdir(), "managing-system-legacy-"));
  const databasePath = join(directory, "legacy.sqlite");
  const database = new Database(databasePath);
  const timestamp = "2026-07-20T00:00:00.000Z";
  const snapshot = {
    id: "legacy-snapshot",
    rawEvidenceIds: [],
    createdAt: timestamp,
    targetSystem: "managed-system",
    overallState: "healthy",
    summary: "healthy",
    signals: [],
    suspectedIncidentTypes: ["unclassified"],
    contradictions: [],
  };
  const trial = {
    id: "legacy-trial",
    scenarioId: "S1",
    recoveryMode: "baseline",
    startedAt: timestamp,
    completedAt: timestamp,
    initialEvidenceSnapshotId: snapshot.id,
    finalEvidenceSnapshotId: snapshot.id,
    evidenceSnapshotIds: [snapshot.id],
    recoveryDecisionIds: ["legacy-decision"],
    diagnosisResultIds: ["legacy-diagnosis"],
    recoveryPlanIds: ["legacy-plan"],
    diagnosisResultId: "legacy-diagnosis",
    recoveryPlanId: "legacy-plan",
    selectedActionIds: [],
    actionExecutionResultIds: ["legacy-action-result"],
    executedActionResultIds: ["legacy-action-result"],
    blockedActionIds: [],
    failedActionIds: [],
    status: "resolved",
    outcome: "resolved_safely",
    metrics: {
      actionCount: 1,
      blockedActionCount: 0,
      failedActionCount: 0,
      timeToRecoveryMs: 0,
    },
    notes: "healthy",
    evaluationSummaryId: "legacy-evaluation",
  };
  const diagnosis = {
    id: "legacy-diagnosis",
    evidenceSnapshotId: snapshot.id,
    createdAt: timestamp,
    method: "deterministic",
    sourceIds: [],
    suspectedIncidentType: "no_incident",
    severity: "low",
    confidence: null,
    reasoningSummary: "healthy",
    supportingSignals: [],
    contradictions: [],
  };
  const plan = {
    id: "legacy-plan",
    diagnosisResultId: diagnosis.id,
    createdAt: timestamp,
    proposedActionIds: [],
    rationale: "no action",
    expectedOutcome: "healthy",
    fallbackActionIds: [],
    escalationReason: null,
  };
  const decision = {
    id: "legacy-decision",
    mode: "baseline",
    snapshotId: snapshot.id,
    decidedAt: timestamp,
    status: "no_action",
    reason: "healthy",
    diagnosisResult: diagnosis,
    recoveryPlan: plan,
  };
  const actionResult = {
    id: "legacy-action-result",
    actionId: "restart_postgres_container",
    trialRecordId: trial.id,
    startedAt: timestamp,
    completedAt: timestamp,
    status: "executed",
    safetyCheckStatus: "passed",
    failedSafetyRuleIds: [],
    beforeEvidenceSnapshotId: snapshot.id,
    afterEvidenceSnapshotId: snapshot.id,
    expectedOutcomeMet: true,
    outcomeSummary: "healthy",
    continuation: "resolved",
  };
  const evaluation = {
    id: "legacy-evaluation",
    trialRecordId: trial.id,
    createdAt: timestamp,
    summary: "healthy",
    recoverySucceeded: true,
    safetyMaintained: true,
    actionEffectiveness: "effective",
    lessons: [],
    recommendedChanges: [],
  };

  database.exec(`
    CREATE TABLE evidence_snapshots (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, overall_state TEXT NOT NULL, snapshot_json TEXT NOT NULL);
    CREATE TABLE trial_records (id TEXT PRIMARY KEY, recovery_mode TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, outcome TEXT NOT NULL, trial_record_json TEXT NOT NULL);
    CREATE TABLE diagnosis_results (id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL, created_at TEXT NOT NULL, diagnosis_result_json TEXT NOT NULL);
    CREATE TABLE recovery_plans (id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL, diagnosis_result_id TEXT NOT NULL, created_at TEXT NOT NULL, recovery_plan_json TEXT NOT NULL);
    CREATE TABLE recovery_decisions (id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL, sequence_number INTEGER NOT NULL, recovery_mode TEXT NOT NULL, snapshot_id TEXT NOT NULL, decided_at TEXT NOT NULL, status TEXT NOT NULL, diagnosis_result_id TEXT NOT NULL, recovery_plan_id TEXT NOT NULL, recovery_decision_json TEXT NOT NULL);
    CREATE TABLE action_execution_results (id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL, action_definition_id TEXT NOT NULL, status TEXT NOT NULL, continuation TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, action_execution_result_json TEXT NOT NULL);
    CREATE TABLE evaluation_summaries (id TEXT PRIMARY KEY, trial_record_id TEXT NOT NULL, created_at TEXT NOT NULL, action_effectiveness TEXT NOT NULL, evaluation_summary_json TEXT NOT NULL);
  `);
  database
    .prepare("INSERT INTO evidence_snapshots VALUES (?, ?, ?, ?)")
    .run(snapshot.id, timestamp, "healthy", malformedEvidence ? "{" : JSON.stringify(snapshot));
  database
    .prepare("INSERT INTO trial_records VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(trial.id, "baseline", timestamp, timestamp, "resolved", "resolved_safely", JSON.stringify(trial));
  database
    .prepare("INSERT INTO diagnosis_results VALUES (?, ?, ?, ?)")
    .run(diagnosis.id, trial.id, timestamp, JSON.stringify(diagnosis));
  database
    .prepare("INSERT INTO recovery_plans VALUES (?, ?, ?, ?, ?)")
    .run(plan.id, trial.id, diagnosis.id, timestamp, JSON.stringify(plan));
  database
    .prepare("INSERT INTO recovery_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(decision.id, trial.id, 1, "baseline", snapshot.id, timestamp, "no_action", diagnosis.id, plan.id, JSON.stringify(decision));
  database
    .prepare("INSERT INTO action_execution_results VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(actionResult.id, trial.id, actionResult.actionId, "executed", "resolved", timestamp, timestamp, JSON.stringify(actionResult));
  database
    .prepare("INSERT INTO evaluation_summaries VALUES (?, ?, ?, ?, ?)")
    .run(evaluation.id, trial.id, timestamp, "effective", JSON.stringify(evaluation));
  database.close();

  return {
    databasePath,
    databaseUrl: `file:${databasePath}`,
    close() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function applyMigration(databasePath: string): void {
  const database = new Database(databasePath);

  try {
    database.exec(
      readFileSync(
        resolve(
          "prisma/migrations/20260726120000_relational_persistence/migration.sql",
        ),
        "utf8",
      ),
    );
  } finally {
    database.close();
  }
}

function runScript(
  script: string,
  databaseUrl: string,
  requireSuccess = true,
): ReturnType<typeof spawnSync> {
  const result = spawnSync("npm", ["run", script], {
    cwd: resolve("."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
  });

  if (requireSuccess && result.status !== 0) {
    throw new Error(
      `${script} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }

  return result;
}
