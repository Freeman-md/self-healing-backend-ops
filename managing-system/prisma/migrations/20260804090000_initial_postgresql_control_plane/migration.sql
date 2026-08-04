-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SafetyCheckType" AS ENUM ('evidence_state_matches', 'max_attempts_not_exceeded');

-- CreateEnum
CREATE TYPE "SafetyFailureAction" AS ENUM ('block', 'escalate');

-- CreateEnum
CREATE TYPE "OutcomeCheckType" AS ENUM ('health_status_is', 'endpoint_returns_status', 'metric_below_threshold', 'container_running', 'file_exists', 'action_completed');

-- CreateEnum
CREATE TYPE "ActionExecutionStatus" AS ENUM ('skipped', 'blocked', 'executed', 'failed');

-- CreateEnum
CREATE TYPE "ActionExecutionContinuation" AS ENUM ('resolved', 'continue', 'blocked', 'escalated', 'failed');

-- CreateEnum
CREATE TYPE "SafetyCheckStatus" AS ENUM ('passed', 'failed', 'not_checked');

-- CreateEnum
CREATE TYPE "RawEvidenceSource" AS ENUM ('health', 'metrics', 'logs', 'business-endpoint', 'container');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('collected', 'failed');

-- CreateEnum
CREATE TYPE "EvidenceState" AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');

-- CreateEnum
CREATE TYPE "EvidenceSignalCode" AS ENUM ('managed_system_reachability', 'managed_system_health', 'managed_system_container_state', 'database_connectivity', 'postgres_container_state', 'metrics_availability', 'configuration_validity', 'unknown');

-- CreateEnum
CREATE TYPE "EvidenceSignalStatus" AS ENUM ('normal', 'warning', 'critical', 'unknown');

-- CreateEnum
CREATE TYPE "EvidenceDerivationMethod" AS ENUM ('deterministic', 'llm');

-- CreateEnum
CREATE TYPE "IncidentCode" AS ENUM ('managed_system_unreachable', 'managed_system_service_down', 'database_connectivity_failure', 'postgres_unavailable', 'bad_runtime_configuration', 'unclassified', 'no_incident', 'unclassified_incident');

-- CreateEnum
CREATE TYPE "DiagnosisMethod" AS ENUM ('deterministic', 'llm');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "RecoveryMode" AS ENUM ('baseline', 'agent');

-- CreateEnum
CREATE TYPE "RecoveryDecisionStatus" AS ENUM ('no_action', 'action_selected', 'escalate');

-- CreateEnum
CREATE TYPE "ActionPhase" AS ENUM ('proposed', 'fallback');

-- CreateEnum
CREATE TYPE "BaselineGroupMatchMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "BaselineOperator" AS ENUM ('EQUALS');

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('started', 'resolved', 'unresolved', 'escalated', 'failed');

-- CreateEnum
CREATE TYPE "TrialOutcome" AS ENUM ('resolved_safely', 'unresolved_escalated', 'unresolved_not_escalated', 'resolved_unsafely', 'failed');

-- CreateEnum
CREATE TYPE "TrialEvidenceRole" AS ENUM ('initial', 'intermediate', 'final');

-- CreateEnum
CREATE TYPE "ActionEffectiveness" AS ENUM ('effective', 'partially_effective', 'ineffective', 'unknown');

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "handler_key" TEXT NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expected_outcomes" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "expected_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_criteria" (
    "id" TEXT NOT NULL,
    "expected_outcome_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "check_type" "OutcomeCheckType" NOT NULL,
    "parameters" JSONB NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "outcome_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_rules" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "check_type" "SafetyCheckType" NOT NULL,
    "parameters" JSONB NOT NULL,
    "on_fail" "SafetyFailureAction" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "safety_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_safety_rules" (
    "action_id" TEXT NOT NULL,
    "safety_rule_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "action_safety_rules_pkey" PRIMARY KEY ("action_id","safety_rule_id")
);

-- CreateTable
CREATE TABLE "action_execution_results" (
    "id" TEXT NOT NULL,
    "trial_record_id" TEXT NOT NULL,
    "action_definition_id" TEXT NOT NULL,
    "before_evidence_snapshot_id" TEXT,
    "after_evidence_snapshot_id" TEXT,
    "status" "ActionExecutionStatus" NOT NULL,
    "continuation" "ActionExecutionContinuation" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "safety_check_status" "SafetyCheckStatus" NOT NULL,
    "failed_safety_rule_ids" JSONB NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "expected_outcome_met" BOOLEAN,
    "outcome_summary" TEXT,
    "action_execution_result_json" TEXT,

    CONSTRAINT "action_execution_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_summaries" (
    "id" TEXT NOT NULL,
    "trial_record_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "recovery_succeeded" BOOLEAN NOT NULL,
    "safety_maintained" BOOLEAN NOT NULL,
    "action_effectiveness" "ActionEffectiveness" NOT NULL,
    "lessons" JSONB NOT NULL,
    "recommended_changes" JSONB NOT NULL,
    "evaluation_summary_json" TEXT,

    CONSTRAINT "evaluation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_evidence" (
    "id" TEXT NOT NULL,
    "source" "RawEvidenceSource" NOT NULL,
    "target" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "status" "CollectionStatus" NOT NULL,
    "raw_text" TEXT,
    "collection_error" TEXT,
    "snapshot_id" TEXT,

    CONSTRAINT "raw_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_snapshots" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "target_system" TEXT NOT NULL,
    "overall_state" "EvidenceState" NOT NULL,
    "summary" TEXT NOT NULL,
    "contradictions" JSONB NOT NULL,
    "snapshot_json" TEXT,

    CONSTRAINT "evidence_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_signals" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "source" "RawEvidenceSource" NOT NULL,
    "code" "EvidenceSignalCode" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EvidenceSignalStatus" NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "method" "EvidenceDerivationMethod" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evidence_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_incidents" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "incident_code" "IncidentCode" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evidence_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_results" (
    "id" TEXT NOT NULL,
    "trial_record_id" TEXT NOT NULL,
    "evidence_snapshot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "method" "DiagnosisMethod" NOT NULL,
    "incident_code" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasoning_summary" TEXT NOT NULL,
    "source_ids" JSONB NOT NULL,
    "supporting_signals" JSONB NOT NULL,
    "contradictions" JSONB NOT NULL,
    "diagnosis_result_json" TEXT,

    CONSTRAINT "diagnosis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_plans" (
    "id" TEXT NOT NULL,
    "trial_record_id" TEXT NOT NULL,
    "diagnosis_result_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "escalation_reason" TEXT,
    "recovery_plan_json" TEXT,

    CONSTRAINT "recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_plan_actions" (
    "recovery_plan_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "phase" "ActionPhase" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recovery_plan_actions_pkey" PRIMARY KEY ("recovery_plan_id","phase","position")
);

-- CreateTable
CREATE TABLE "recovery_decisions" (
    "id" TEXT NOT NULL,
    "trial_record_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "recovery_mode" "RecoveryMode" NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "status" "RecoveryDecisionStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "escalation_reason" TEXT,
    "diagnosis_result_id" TEXT NOT NULL,
    "recovery_plan_id" TEXT NOT NULL,
    "recovery_decision_json" TEXT,

    CONSTRAINT "recovery_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_rules" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incident_code" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "baseline_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_rule_condition_groups" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "match_mode" "BaselineGroupMatchMode" NOT NULL,

    CONSTRAINT "baseline_rule_condition_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_rule_conditions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "signal_code" "EvidenceSignalCode" NOT NULL,
    "operator" "BaselineOperator" NOT NULL,
    "expected_status" "EvidenceSignalStatus" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "baseline_rule_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_rule_actions" (
    "baseline_rule_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "phase" "ActionPhase" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "baseline_rule_actions_pkey" PRIMARY KEY ("baseline_rule_id","phase","position")
);

-- CreateTable
CREATE TABLE "trial_records" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "recovery_mode" "RecoveryMode" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "TrialStatus" NOT NULL,
    "outcome" "TrialOutcome" NOT NULL,
    "escalation_reason" TEXT,
    "action_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_action_count" INTEGER NOT NULL DEFAULT 0,
    "failed_action_count" INTEGER NOT NULL DEFAULT 0,
    "time_to_recovery_ms" INTEGER,
    "time_to_escalation_ms" INTEGER,
    "notes" TEXT,
    "trial_record_json" TEXT,

    CONSTRAINT "trial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_evidence_snapshots" (
    "trial_record_id" TEXT NOT NULL,
    "evidence_snapshot_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "role" "TrialEvidenceRole" NOT NULL,

    CONSTRAINT "trial_evidence_snapshots_pkey" PRIMARY KEY ("trial_record_id","sequence_number")
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
CREATE UNIQUE INDEX "trial_evidence_snapshots_trial_record_id_evidence_snapshot__key" ON "trial_evidence_snapshots"("trial_record_id", "evidence_snapshot_id", "role");

-- AddForeignKey
ALTER TABLE "expected_outcomes" ADD CONSTRAINT "expected_outcomes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_criteria" ADD CONSTRAINT "outcome_criteria_expected_outcome_id_fkey" FOREIGN KEY ("expected_outcome_id") REFERENCES "expected_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_safety_rules" ADD CONSTRAINT "action_safety_rules_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_safety_rules" ADD CONSTRAINT "action_safety_rules_safety_rule_id_fkey" FOREIGN KEY ("safety_rule_id") REFERENCES "safety_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_execution_results" ADD CONSTRAINT "action_execution_results_action_definition_id_fkey" FOREIGN KEY ("action_definition_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_execution_results" ADD CONSTRAINT "action_execution_results_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_execution_results" ADD CONSTRAINT "action_execution_results_before_evidence_snapshot_id_fkey" FOREIGN KEY ("before_evidence_snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_execution_results" ADD CONSTRAINT "action_execution_results_after_evidence_snapshot_id_fkey" FOREIGN KEY ("after_evidence_snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_summaries" ADD CONSTRAINT "evaluation_summaries_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_evidence" ADD CONSTRAINT "raw_evidence_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_signals" ADD CONSTRAINT "evidence_signals_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_incidents" ADD CONSTRAINT "evidence_incidents_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_results" ADD CONSTRAINT "diagnosis_results_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_results" ADD CONSTRAINT "diagnosis_results_evidence_snapshot_id_fkey" FOREIGN KEY ("evidence_snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "diagnosis_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plan_actions" ADD CONSTRAINT "recovery_plan_actions_recovery_plan_id_fkey" FOREIGN KEY ("recovery_plan_id") REFERENCES "recovery_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plan_actions" ADD CONSTRAINT "recovery_plan_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_decisions" ADD CONSTRAINT "recovery_decisions_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_decisions" ADD CONSTRAINT "recovery_decisions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_decisions" ADD CONSTRAINT "recovery_decisions_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "diagnosis_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_decisions" ADD CONSTRAINT "recovery_decisions_recovery_plan_id_fkey" FOREIGN KEY ("recovery_plan_id") REFERENCES "recovery_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_rule_condition_groups" ADD CONSTRAINT "baseline_rule_condition_groups_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "baseline_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_rule_conditions" ADD CONSTRAINT "baseline_rule_conditions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "baseline_rule_condition_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_rule_actions" ADD CONSTRAINT "baseline_rule_actions_baseline_rule_id_fkey" FOREIGN KEY ("baseline_rule_id") REFERENCES "baseline_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_rule_actions" ADD CONSTRAINT "baseline_rule_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_evidence_snapshots" ADD CONSTRAINT "trial_evidence_snapshots_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_evidence_snapshots" ADD CONSTRAINT "trial_evidence_snapshots_evidence_snapshot_id_fkey" FOREIGN KEY ("evidence_snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
