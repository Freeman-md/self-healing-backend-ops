ALTER TYPE "FaultProfileCode" ADD VALUE 'managed_system_application_network_isolated';
CREATE TABLE "recovery_episodes" (
 "trial_record_id" TEXT PRIMARY KEY REFERENCES "trial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "origin" TEXT NOT NULL, "experiment_run_id" TEXT, "compatibility_fingerprint" TEXT NOT NULL,
 "corpus_source_ids" JSONB NOT NULL, "retrieval_enabled" BOOLEAN NOT NULL, "configuration" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "recovery_steps" (
 "diagnosis_result_id" TEXT PRIMARY KEY REFERENCES "diagnosis_results"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "trial_record_id" TEXT NOT NULL REFERENCES "recovery_episodes"("trial_record_id") ON DELETE CASCADE ON UPDATE CASCADE,
 "signature" TEXT, "diagnosis_ready_at" TIMESTAMP(3) NOT NULL,
 "lookup_started_at" TIMESTAMP(3), "lookup_completed_at" TIMESTAMP(3), "lookup_outcome" TEXT,
 "source_trial_id" TEXT, "source_plan_id" TEXT, "plan_id" TEXT, "decision_id" TEXT,
 "plan_ready_at" TIMESTAMP(3), "plan_origin" TEXT, "execution_result_ids" JSONB NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX "recovery_steps_plan_id_key" ON "recovery_steps"("plan_id");
CREATE UNIQUE INDEX "recovery_steps_decision_id_key" ON "recovery_steps"("decision_id");
CREATE INDEX "recovery_steps_trial_record_id_diagnosis_ready_at_idx" ON "recovery_steps"("trial_record_id", "diagnosis_ready_at");
CREATE TABLE "recovery_cases" (
 "source_plan_id" TEXT PRIMARY KEY, "diagnosis_result_id" TEXT NOT NULL REFERENCES "recovery_steps"("diagnosis_result_id") ON DELETE CASCADE ON UPDATE CASCADE,
 "source_trial_id" TEXT NOT NULL, "published_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "recovery_cases_diagnosis_result_id_key" ON "recovery_cases"("diagnosis_result_id");
CREATE INDEX "recovery_cases_source_trial_id_published_at_idx" ON "recovery_cases"("source_trial_id", "published_at");
CREATE TABLE "recovery_attention" (
 "id" TEXT PRIMARY KEY, "trial_record_id" TEXT NOT NULL REFERENCES "trial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "signature" TEXT NOT NULL, "initial_evidence_snapshot_id" TEXT NOT NULL, "latest_evidence_snapshot_id" TEXT NOT NULL,
 "diagnosis_result_id" TEXT, "decision_id" TEXT, "reason" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'requires_attention',
 "created_at" TIMESTAMP(3) NOT NULL, "acknowledged_at" TIMESTAMP(3), "reviewed_at" TIMESTAMP(3), "notes" TEXT,
 "released_at" TIMESTAMP(3), "healthy_evidence_snapshot_id" TEXT
);
CREATE UNIQUE INDEX "recovery_attention_trial_record_id_key" ON "recovery_attention"("trial_record_id");
CREATE INDEX "recovery_attention_signature_released_at_idx" ON "recovery_attention"("signature", "released_at");
CREATE TABLE "experiment_run_manifests" (
 "run_id" TEXT PRIMARY KEY REFERENCES "experiment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "configuration" JSONB NOT NULL, "workload" JSONB, "restoration" JSONB
);
