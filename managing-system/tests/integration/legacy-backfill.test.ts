import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import Database from "better-sqlite3";

import { PrismaService } from "@/infrastructure/database";

test("historical fixture backfills without loss and remains idempotent", async () => {
  const fixture = createLegacyFixture();

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    runScript("prisma:baseline-legacy", fixture.databaseUrl);
    runScript("prisma:migrate:deploy", fixture.databaseUrl);
    runScript("prisma:seed", fixture.databaseUrl);

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

test("evidence-only legacy fixture completes the documented migration path", async () => {
  const fixture = createEvidenceOnlyLegacyFixture();

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    runScript("prisma:baseline-legacy", fixture.databaseUrl);
    runScript("prisma:migrate:deploy", fixture.databaseUrl);
    runScript("prisma:seed", fixture.databaseUrl);
    runScript("prisma:backfill", fixture.databaseUrl);
    runScript("prisma:backfill", fixture.databaseUrl);

    const verifier = new PrismaService(fixture.databaseUrl);
    await verifier.open();
    assert.equal(await verifier.evidenceSnapshot.count(), 1);
    assert.equal(await verifier.trialRecord.count(), 0);
    assert.ok(
      await verifier.evidenceSnapshot.findUnique({
        where: { id: "legacy-partial-snapshot" },
      }),
    );
    await verifier.close();
  } finally {
    fixture.close();
  }
});

test("malformed historical payloads produce an actionable failing report", async () => {
  const fixture = createLegacyFixture({ malformedEvidence: true });

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    runScript("prisma:baseline-legacy", fixture.databaseUrl);
    runScript("prisma:migrate:deploy", fixture.databaseUrl);
    runScript("prisma:seed", fixture.databaseUrl);

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

test("legacy relational identity mismatches fail every entity", () => {
  const fixture = createLegacyFixture({ mismatchedIdentity: true });

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    runScript("prisma:baseline-legacy", fixture.databaseUrl);
    runScript("prisma:migrate:deploy", fixture.databaseUrl);
    runScript("prisma:seed", fixture.databaseUrl);

    const result = runScript("prisma:backfill", fixture.databaseUrl, false);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0);
    for (const failurePattern of [
      /evidenceSnapshots:row-legacy-snapshot: Legacy evidence snapshot id mismatch/,
      /trials:row-legacy-trial: Legacy trial id mismatch/,
      /diagnoses:row-legacy-diagnosis: Legacy diagnosis id mismatch/,
      /recoveryPlans:row-legacy-plan: Legacy recovery plan id mismatch/,
      /recoveryDecisions:row-legacy-decision: Legacy recovery decision id mismatch/,
      /actionResults:row-legacy-action-result: Legacy action result id mismatch/,
      /evaluations:row-legacy-evaluation: Legacy evaluation id mismatch/,
    ]) {
      assert.match(output, failurePattern);
    }
  } finally {
    fixture.close();
  }
});

test("legacy relational timestamp mismatches fail every timestamped entity", () => {
  const fixture = createLegacyFixture({ mismatchedTimestamp: true });

  try {
    runScript("prisma:prepare-legacy", fixture.databaseUrl);
    runScript("prisma:baseline-legacy", fixture.databaseUrl);
    runScript("prisma:migrate:deploy", fixture.databaseUrl);
    runScript("prisma:seed", fixture.databaseUrl);

    const result = runScript("prisma:backfill", fixture.databaseUrl, false);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0);
    for (const failurePattern of [
      /evidenceSnapshots:legacy-snapshot: Legacy evidence snapshot created_at mismatch/,
      /trials:legacy-trial: Legacy trial started_at mismatch/,
      /diagnoses:legacy-diagnosis: Legacy diagnosis created_at mismatch/,
      /recoveryPlans:legacy-plan: Legacy recovery plan created_at mismatch/,
      /recoveryDecisions:legacy-decision: Legacy recovery decision decided_at mismatch/,
      /actionResults:legacy-action-result: Legacy action result started_at mismatch/,
      /evaluations:legacy-evaluation: Legacy evaluation created_at mismatch/,
    ]) {
      assert.match(output, failurePattern);
    }
  } finally {
    fixture.close();
  }
});

test("migration deployment creates an absent SQLite file on a fresh volume", () => {
  const directory = mkdtempSync(join(tmpdir(), "managing-system-fresh-"));
  const databasePath = join(directory, "fresh.sqlite");
  const databaseUrl = `file:${databasePath}`;

  try {
    assert.equal(existsSync(databasePath), false);
    runScript("prisma:migrate:deploy", databaseUrl);
    assert.equal(existsSync(databasePath), true);

    const database = new Database(databasePath, { readonly: true });
    const migrationCount = database
      .prepare("SELECT COUNT(*) AS count FROM _prisma_migrations")
      .get() as { count: number };
    database.close();
    assert.equal(migrationCount.count, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createEvidenceOnlyLegacyFixture(): {
  databaseUrl: string;
  close(): void;
} {
  const directory = mkdtempSync(
    join(tmpdir(), "managing-system-partial-legacy-"),
  );
  const databasePath = join(directory, "legacy.sqlite");
  const database = new Database(databasePath);
  const timestamp = "2026-07-20T00:00:00.000Z";
  const snapshot = {
    id: "legacy-partial-snapshot",
    rawEvidenceIds: [],
    createdAt: timestamp,
    targetSystem: "managed-system",
    overallState: "healthy",
    summary: "healthy",
    signals: [],
    suspectedIncidentTypes: ["unclassified"],
    contradictions: [],
  };

  database.exec(`
    CREATE TABLE evidence_snapshots (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      overall_state TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
  `);
  database
    .prepare("INSERT INTO evidence_snapshots VALUES (?, ?, ?, ?)")
    .run(
      snapshot.id,
      timestamp,
      snapshot.overallState,
      JSON.stringify(snapshot),
    );
  database.close();

  return {
    databaseUrl: `file:${databasePath}`,
    close() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function createLegacyFixture(options: {
  malformedEvidence?: boolean;
  mismatchedIdentity?: boolean;
  mismatchedTimestamp?: boolean;
} = {}): {
  databasePath: string;
  databaseUrl: string;
  close(): void;
} {
  const directory = mkdtempSync(join(tmpdir(), "managing-system-legacy-"));
  const databasePath = join(directory, "legacy.sqlite");
  const database = new Database(databasePath);
  const timestamp = "2026-07-20T00:00:00.000Z";
  const relationalTimestamp = options.mismatchedTimestamp
    ? "2026-07-19T00:00:00.000Z"
    : timestamp;
  const relationalId = (payloadId: string) =>
    options.mismatchedIdentity ? `row-${payloadId}` : payloadId;
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
    .run(relationalId(snapshot.id), relationalTimestamp, "healthy", options.malformedEvidence ? "{" : JSON.stringify(snapshot));
  database
    .prepare("INSERT INTO trial_records VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(relationalId(trial.id), "baseline", relationalTimestamp, relationalTimestamp, "resolved", "resolved_safely", JSON.stringify(trial));
  database
    .prepare("INSERT INTO diagnosis_results VALUES (?, ?, ?, ?)")
    .run(relationalId(diagnosis.id), relationalId(trial.id), relationalTimestamp, JSON.stringify(diagnosis));
  database
    .prepare("INSERT INTO recovery_plans VALUES (?, ?, ?, ?, ?)")
    .run(relationalId(plan.id), relationalId(trial.id), relationalId(diagnosis.id), relationalTimestamp, JSON.stringify(plan));
  database
    .prepare("INSERT INTO recovery_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(relationalId(decision.id), relationalId(trial.id), 1, "baseline", relationalId(snapshot.id), relationalTimestamp, "no_action", relationalId(diagnosis.id), relationalId(plan.id), JSON.stringify(decision));
  database
    .prepare("INSERT INTO action_execution_results VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(relationalId(actionResult.id), relationalId(trial.id), options.mismatchedIdentity ? "restart_managed_system_service" : actionResult.actionId, "executed", "resolved", relationalTimestamp, relationalTimestamp, JSON.stringify(actionResult));
  database
    .prepare("INSERT INTO evaluation_summaries VALUES (?, ?, ?, ?, ?)")
    .run(relationalId(evaluation.id), relationalId(trial.id), relationalTimestamp, "effective", JSON.stringify(evaluation));
  database.close();

  return {
    databasePath,
    databaseUrl: `file:${databasePath}`,
    close() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
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
