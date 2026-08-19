import { createHash, randomUUID } from "node:crypto";
import type { RecoveryMode } from "@/modules/recovery";
import { RECOVERY_MEASUREMENT_VERSION } from "@/modules/measurement";
import { findFaultProfile } from "./experiment.profiles";
import { ExperimentRepository } from "./experiment.repository";
import type {
  ExperimentBatch,
  ExperimentConfiguration,
  ExperimentRun,
  ExperimentRunRecord,
  ExperimentTrialCandidate,
  FaultProfileCode,
  RecoveryOracleResult,
} from "./experiment.types";

type ExperimentServiceOptions = {
  trialWaitTimeoutMs?: number;
  correlationSettleMs?: number;
  pollIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

export class ExperimentService {
  constructor(
    private readonly repository: ExperimentRepository,
    private readonly options: ExperimentServiceOptions = {},
  ) {}

  createExperimentBatch(input: {
    name: string;
    sourceRevision: string;
    configuration: ExperimentConfiguration;
    requestedRepetitions: number;
    runOrderSeed: string;
  }): Promise<ExperimentBatch> {
    return this.repository.createExperimentBatch({
      id: `experiment-batch-${randomUUID()}`,
      ...input,
      measurementVersion: RECOVERY_MEASUREMENT_VERSION,
      createdAt: new Date(this.now()).toISOString(),
    });
  }

  async createFrozenConfiguration(
    input: Omit<ExperimentConfiguration, "baselineRuleVersions" | "actionCatalogueFingerprint">,
  ): Promise<ExperimentConfiguration> {
    const provenance = await this.repository.readExperimentProvenance();

    return {
      ...input,
      baselineRuleVersions: Object.fromEntries(
        provenance.baselineRules.map((rule) => [rule.id, rule.version]),
      ),
      actionCatalogueFingerprint: createHash("sha256")
        .update(JSON.stringify(provenance.actionCatalogue))
        .digest("hex"),
    };
  }

  prepareExperimentRun(input: {
    batchId: string;
    faultProfile: FaultProfileCode;
    recoveryMode: RecoveryMode;
    repetition: number;
    stabilityWindowMs: number;
  }): Promise<ExperimentRun> {
    return this.repository.createExperimentRun({
      id: `experiment-run-${randomUUID()}`,
      ...input,
      startedAt: new Date(this.now()).toISOString(),
    });
  }

  markFaultInjected(runId: string): Promise<ExperimentRun> {
    return this.repository.markFaultInjected(runId, new Date(this.now()).toISOString());
  }

  async waitForAndLinkMonitorTrial(run: ExperimentRun): Promise<ExperimentTrialCandidate> {
    if (!run.faultInjectedAt) {
      throw new Error(`Experiment run ${run.id} has no fault injection time.`);
    }

    const deadline = this.now() + (this.options.trialWaitTimeoutMs ?? 180_000);

    let candidates: ExperimentTrialCandidate[] = [];

    while (this.now() < deadline) {
      candidates = await this.repository.findCompletedMonitorTrials({
        recoveryMode: run.recoveryMode,
        startedAfter: run.faultInjectedAt,
      });
      if (candidates.length > 0) {
        await this.sleep(this.options.correlationSettleMs ?? 1_000);
        candidates = await this.repository.findCompletedMonitorTrials({
          recoveryMode: run.recoveryMode,
          startedAfter: run.faultInjectedAt,
        });
        break;
      }

      await this.sleep(this.options.pollIntervalMs ?? 1_000);
    }

    if (candidates.length !== 1) {
      const reason =
        candidates.length === 0
          ? "No completed monitor-triggered trial was found after fault injection."
          : `Expected one monitor-triggered trial but found ${candidates.length}.`;

      await this.repository.invalidateExperimentRun(
        run.id,
        reason,
        new Date(this.now()).toISOString(),
      );
      throw new Error(reason);
    }

    await this.repository.linkExperimentRunToTrial(run.id, candidates[0].id);

    return candidates[0];
  }

  async completeExperimentRun(input: {
    run: ExperimentRun;
    trial: ExperimentTrialCandidate;
    oracle: RecoveryOracleResult;
  }): Promise<ExperimentRun> {
    if (!input.run.faultInjectedAt) {
      throw new Error(`Experiment run ${input.run.id} has no fault injection time.`);
    }

    const profile = findFaultProfile(input.run.faultProfile);

    const diagnosisCorrect = input.trial.diagnosisIncidentCodes.some((code) =>
      profile.expectedIncidentCodes.includes(code),
    );

    const actionSequenceCorrect = arraysEqual(input.trial.actionIds, profile.expectedActionIds);

    const unnecessaryActionCount = input.trial.actionIds.filter(
      (actionId) => !profile.expectedActionIds.includes(actionId),
    ).length;

    const faultInjectedMs = new Date(input.run.faultInjectedAt).getTime();

    const firstUnhealthyMs = input.trial.measurement?.firstUnhealthyObservedAt
      ? new Date(input.trial.measurement.firstUnhealthyObservedAt).getTime()
      : null;

    const oracleCheckedMs = new Date(input.oracle.checkedAt).getTime();

    const completedMs = new Date(input.trial.completedAt).getTime();

    return this.repository.completeExperimentRun({
      runId: input.run.id,
      completedAt: new Date(this.now()).toISOString(),
      runtimeResolved: input.trial.status === "resolved",
      oracle: input.oracle,
      diagnosisCorrect,
      actionSequenceCorrect,
      unnecessaryActionCount,
      faultToDetectionMs:
        firstUnhealthyMs === null ? null : nonNegativeDifference(firstUnhealthyMs, faultInjectedMs),
      timeToHealMs: input.oracle.succeeded
        ? nonNegativeDifference(oracleCheckedMs, faultInjectedMs)
        : null,
      timeToTerminationMs: nonNegativeDifference(completedMs, faultInjectedMs),
    });
  }

  completeExperimentBatch(
    batchId: string,
    status: "completed" | "failed" = "completed",
  ): Promise<ExperimentBatch> {
    return this.repository.completeExperimentBatch(
      batchId,
      status,
      new Date(this.now()).toISOString(),
    );
  }

  invalidateExperimentRun(runId: string, reason: string): Promise<ExperimentRun> {
    return this.repository.invalidateExperimentRun(
      runId,
      reason,
      new Date(this.now()).toISOString(),
    );
  }

  async getExperimentEvidence(batchId: string): Promise<{
    batch: ExperimentBatch;
    runs: ExperimentRunRecord[];
  }> {
    const batch = await this.repository.findExperimentBatch(batchId);

    if (!batch) {
      throw new Error(`Experiment batch ${batchId} was not found.`);
    }

    return {
      batch,
      runs: await this.repository.listExperimentRunRecords(batchId),
    };
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private sleep(milliseconds: number): Promise<void> {
    return (
      this.options.sleep?.(milliseconds) ??
      new Promise((resolve) => setTimeout(resolve, milliseconds))
    );
  }
}

function nonNegativeDifference(end: number, start: number): number {
  return Math.max(0, end - start);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
