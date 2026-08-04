-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "handler_key" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "expected_outcomes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "expected_outcomes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outcome_criteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expected_outcome_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "outcome_criteria_expected_outcome_id_fkey" FOREIGN KEY ("expected_outcome_id") REFERENCES "expected_outcomes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "safety_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "on_fail" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "action_safety_rules" (
    "action_id" TEXT NOT NULL,
    "safety_rule_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("action_id", "safety_rule_id"),
    CONSTRAINT "action_safety_rules_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "action_safety_rules_safety_rule_id_fkey" FOREIGN KEY ("safety_rule_id") REFERENCES "safety_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "action_execution_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trial_record_id" TEXT NOT NULL,
    "action_definition_id" TEXT NOT NULL,
    "before_evidence_snapshot_id" TEXT,
    "after_evidence_snapshot_id" TEXT,
    "status" TEXT NOT NULL,
    "continuation" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "safety_check_status" TEXT NOT NULL,
    "failed_safety_rule_ids" JSONB NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "expected_outcome_met" BOOLEAN,
    "outcome_summary" TEXT,
    "action_execution_result_json" TEXT,
    CONSTRAINT "action_execution_results_action_definition_id_fkey" FOREIGN KEY ("action_definition_id") REFERENCES "actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "action_execution_results_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "action_execution_results_before_evidence_snapshot_id_fkey" FOREIGN KEY ("before_evidence_snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_execution_results_after_evidence_snapshot_id_fkey" FOREIGN KEY ("after_evidence_snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evaluation_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trial_record_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "recovery_succeeded" BOOLEAN NOT NULL,
    "safety_maintained" BOOLEAN NOT NULL,
    "action_effectiveness" TEXT NOT NULL,
    "lessons" JSONB NOT NULL,
    "recommended_changes" JSONB NOT NULL,
    "evaluation_summary_json" TEXT,
    CONSTRAINT "evaluation_summaries_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "raw_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "collected_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "raw_text" TEXT,
    "collection_error" TEXT,
    "snapshot_id" TEXT,
    CONSTRAINT "raw_evidence_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evidence_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL,
    "target_system" TEXT NOT NULL,
    "overall_state" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contradictions" JSONB NOT NULL,
    "snapshot_json" TEXT
);

-- CreateTable
CREATE TABLE "evidence_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshot_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "evidence_signals_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evidence_incidents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshot_id" TEXT NOT NULL,
    "incident_code" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "evidence_incidents_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diagnosis_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trial_record_id" TEXT NOT NULL,
    "evidence_snapshot_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "incident_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" REAL,
    "reasoning_summary" TEXT NOT NULL,
    "source_ids" JSONB NOT NULL,
    "supporting_signals" JSONB NOT NULL,
    "contradictions" JSONB NOT NULL,
    "diagnosis_result_json" TEXT,
    CONSTRAINT "diagnosis_results_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "diagnosis_results_evidence_snapshot_id_fkey" FOREIGN KEY ("evidence_snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recovery_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trial_record_id" TEXT NOT NULL,
    "diagnosis_result_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "rationale" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "escalation_reason" TEXT,
    "recovery_plan_json" TEXT,
    CONSTRAINT "recovery_plans_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recovery_plans_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "diagnosis_results" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recovery_plan_actions" (
    "recovery_plan_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("recovery_plan_id", "phase", "position"),
    CONSTRAINT "recovery_plan_actions_recovery_plan_id_fkey" FOREIGN KEY ("recovery_plan_id") REFERENCES "recovery_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recovery_plan_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recovery_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trial_record_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "recovery_mode" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "decided_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "escalation_reason" TEXT,
    "diagnosis_result_id" TEXT NOT NULL,
    "recovery_plan_id" TEXT NOT NULL,
    "recovery_decision_json" TEXT,
    CONSTRAINT "recovery_decisions_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recovery_decisions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recovery_decisions_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "diagnosis_results" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recovery_decisions_recovery_plan_id_fkey" FOREIGN KEY ("recovery_plan_id") REFERENCES "recovery_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "baseline_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "incident_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "baseline_rule_condition_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rule_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "match_mode" TEXT NOT NULL,
    CONSTRAINT "baseline_rule_condition_groups_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "baseline_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "baseline_rule_conditions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "signal_code" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "expected_status" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "baseline_rule_conditions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "baseline_rule_condition_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "baseline_rule_actions" (
    "baseline_rule_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("baseline_rule_id", "phase", "position"),
    CONSTRAINT "baseline_rule_actions_baseline_rule_id_fkey" FOREIGN KEY ("baseline_rule_id") REFERENCES "baseline_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "baseline_rule_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trial_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "recovery_mode" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "status" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "escalation_reason" TEXT,
    "action_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_action_count" INTEGER NOT NULL DEFAULT 0,
    "failed_action_count" INTEGER NOT NULL DEFAULT 0,
    "time_to_recovery_ms" INTEGER,
    "time_to_escalation_ms" INTEGER,
    "notes" TEXT,
    "trial_record_json" TEXT
);

-- CreateTable
CREATE TABLE "trial_evidence_snapshots" (
    "trial_record_id" TEXT NOT NULL,
    "evidence_snapshot_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "role" TEXT NOT NULL,

    PRIMARY KEY ("trial_record_id", "sequence_number"),
    CONSTRAINT "trial_evidence_snapshots_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trial_evidence_snapshots_evidence_snapshot_id_fkey" FOREIGN KEY ("evidence_snapshot_id") REFERENCES "evidence_snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "expected_outcomes_action_id_key" ON "expected_outcomes"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "outcome_criteria_expected_outcome_id_position_key" ON "outcome_criteria"("expected_outcome_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "action_safety_rules_action_id_position_key" ON "action_safety_rules"("action_id", "position");

-- CreateIndex
CREATE INDEX "action_execution_results_trial_record_id_idx" ON "action_execution_results"("trial_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_summaries_trial_record_id_key" ON "evaluation_summaries"("trial_record_id");

-- CreateIndex
CREATE INDEX "raw_evidence_snapshot_id_idx" ON "raw_evidence"("snapshot_id");

-- CreateIndex
CREATE INDEX "evidence_snapshots_created_at_idx" ON "evidence_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "evidence_snapshots_overall_state_idx" ON "evidence_snapshots"("overall_state");

-- CreateIndex
CREATE INDEX "evidence_signals_snapshot_id_code_idx" ON "evidence_signals"("snapshot_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_signals_snapshot_id_position_key" ON "evidence_signals"("snapshot_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_incidents_snapshot_id_position_key" ON "evidence_incidents"("snapshot_id", "position");

-- CreateIndex
CREATE INDEX "diagnosis_results_trial_record_id_idx" ON "diagnosis_results"("trial_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_plans_diagnosis_result_id_key" ON "recovery_plans"("diagnosis_result_id");

-- CreateIndex
CREATE INDEX "recovery_plans_trial_record_id_idx" ON "recovery_plans"("trial_record_id");

-- CreateIndex
CREATE INDEX "recovery_plan_actions_action_id_idx" ON "recovery_plan_actions"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_decisions_diagnosis_result_id_key" ON "recovery_decisions"("diagnosis_result_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_decisions_recovery_plan_id_key" ON "recovery_decisions"("recovery_plan_id");

-- CreateIndex
CREATE INDEX "recovery_decisions_trial_record_id_sequence_number_idx" ON "recovery_decisions"("trial_record_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_decisions_trial_record_id_sequence_number_key" ON "recovery_decisions"("trial_record_id", "sequence_number");

-- CreateIndex
CREATE INDEX "baseline_rules_active_priority_idx" ON "baseline_rules"("active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_rule_condition_groups_rule_id_position_key" ON "baseline_rule_condition_groups"("rule_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_rule_conditions_group_id_position_key" ON "baseline_rule_conditions"("group_id", "position");

-- CreateIndex
CREATE INDEX "baseline_rule_actions_action_id_idx" ON "baseline_rule_actions"("action_id");

-- CreateIndex
CREATE INDEX "trial_records_recovery_mode_idx" ON "trial_records"("recovery_mode");

-- CreateIndex
CREATE INDEX "trial_records_status_idx" ON "trial_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "trial_evidence_snapshots_trial_record_id_evidence_snapshot_id_role_key" ON "trial_evidence_snapshots"("trial_record_id", "evidence_snapshot_id", "role");
