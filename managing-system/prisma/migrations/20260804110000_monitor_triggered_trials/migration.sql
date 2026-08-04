-- Distinguish controlled experiment trials from autonomous monitor-triggered trials.
CREATE TYPE "TrialTriggerSource" AS ENUM ('controlled', 'monitor');

ALTER TABLE "trial_records"
  ADD COLUMN "trigger_source" "TrialTriggerSource" NOT NULL DEFAULT 'controlled',
  ALTER COLUMN "scenario_id" DROP NOT NULL;

CREATE INDEX "trial_records_trigger_source_idx" ON "trial_records"("trigger_source");
