CREATE TYPE "ModelInvocationOperation" AS ENUM ('evidence_normalization', 'diagnosis', 'recovery_planning', 'outcome_evaluation');
CREATE TYPE "ModelInvocationStatus" AS ENUM ('succeeded', 'failed');
CREATE TYPE "ExperimentBatchStatus" AS ENUM ('active', 'completed', 'failed');
CREATE TYPE "ExperimentRunStatus" AS ENUM ('prepared', 'fault_injected', 'trial_linked', 'completed', 'invalid', 'failed');
CREATE TYPE "FaultProfileCode" AS ENUM ('managed_system_application_stopped', 'managed_system_postgres_stopped', 'managed_system_application_and_postgres_stopped');

CREATE TABLE "recovery_measurements" (
    "trial_record_id" TEXT NOT NULL,
    "measurement_version" TEXT NOT NULL,
    "first_unhealthy_observed_at" TIMESTAMP(3),
    "first_unhealthy_evidence_snapshot_id" TEXT,
    "recovery_triggered_at" TIMESTAMP(3) NOT NULL,
    "first_action_started_at" TIMESTAMP(3),
    "recovery_verified_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "unhealthy_confirmation_delay_ms" INTEGER,
    "time_to_first_action_ms" INTEGER,
    "recovery_loop_duration_ms" INTEGER,
    "observed_time_to_heal_ms" INTEGER,
    "decision_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recovery_measurements_pkey" PRIMARY KEY ("trial_record_id")
);

CREATE TABLE "model_invocations" (
    "id" TEXT NOT NULL,
    "operation" "ModelInvocationOperation" NOT NULL,
    "model" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "status" "ModelInvocationStatus" NOT NULL,
    "error" TEXT,
    "trial_record_id" TEXT,
    "evidence_snapshot_id" TEXT,
    "recovery_decision_id" TEXT,
    "action_execution_result_id" TEXT,
    CONSTRAINT "model_invocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExperimentBatchStatus" NOT NULL,
    "source_revision" TEXT NOT NULL,
    "measurement_version" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "requested_repetitions" INTEGER NOT NULL,
    "run_order_seed" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "experiment_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experiment_runs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "fault_profile" "FaultProfileCode" NOT NULL,
    "recovery_mode" "RecoveryMode" NOT NULL,
    "repetition" INTEGER NOT NULL,
    "status" "ExperimentRunStatus" NOT NULL,
    "active_lock_key" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "fault_injected_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "trial_record_id" TEXT,
    "valid" BOOLEAN,
    "exclusion_reason" TEXT,
    "runtime_resolved" BOOLEAN,
    "oracle_succeeded" BOOLEAN,
    "oracle_checked_at" TIMESTAMP(3),
    "oracle_details" JSONB,
    "stability_window_ms" INTEGER NOT NULL,
    "diagnosis_correct" BOOLEAN,
    "action_sequence_correct" BOOLEAN,
    "unnecessary_action_count" INTEGER,
    "fault_to_detection_ms" INTEGER,
    "time_to_heal_ms" INTEGER,
    "time_to_termination_ms" INTEGER,
    CONSTRAINT "experiment_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recovery_measurements_recovery_triggered_at_idx" ON "recovery_measurements"("recovery_triggered_at");
CREATE INDEX "model_invocations_trial_record_id_idx" ON "model_invocations"("trial_record_id");
CREATE INDEX "model_invocations_operation_idx" ON "model_invocations"("operation");
CREATE INDEX "experiment_batches_status_idx" ON "experiment_batches"("status");
CREATE UNIQUE INDEX "experiment_runs_active_lock_key_key" ON "experiment_runs"("active_lock_key");
CREATE UNIQUE INDEX "experiment_runs_trial_record_id_key" ON "experiment_runs"("trial_record_id");
CREATE UNIQUE INDEX "experiment_runs_batch_id_fault_profile_recovery_mode_repetition_key" ON "experiment_runs"("batch_id", "fault_profile", "recovery_mode", "repetition");
CREATE INDEX "experiment_runs_batch_id_status_idx" ON "experiment_runs"("batch_id", "status");

ALTER TABLE "recovery_measurements" ADD CONSTRAINT "recovery_measurements_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_measurements" ADD CONSTRAINT "recovery_measurements_first_unhealthy_evidence_snapshot_id_fkey" FOREIGN KEY ("first_unhealthy_evidence_snapshot_id") REFERENCES "evidence_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "model_invocations" ADD CONSTRAINT "model_invocations_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "experiment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_trial_record_id_fkey" FOREIGN KEY ("trial_record_id") REFERENCES "trial_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
