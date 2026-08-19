import { getDeterministicEvidenceState, type EvidenceSnapshot } from "@/modules/evidence";
import type { RecoveryMode } from "@/modules/recovery";
import type { TrialService } from "@/modules/trial";

type Awaitable<T> = T | Promise<T>;

type MonitoringEvidenceService = {
  collectAndNormalize(): Awaitable<EvidenceSnapshot>;
  saveEvidenceSnapshot(snapshot: EvidenceSnapshot): Awaitable<EvidenceSnapshot>;
};

type MonitoringTrialService = Pick<TrialService, "runRecoveryTrial">;

type MonitoringServiceOptions = {
  intervalMs: number;
  consecutiveUnhealthyThreshold: number;
  cooldownMs: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

export class MonitoringService {
  private stopRequested = false;

  private recoveryInProgress = false;

  private consecutiveUnhealthyCount = 0;

  private cooldownUntilMs = 0;

  private firstUnhealthyObservedAt?: string;

  private firstUnhealthyEvidenceSnapshotId?: string;

  private pendingWait?: () => void;

  private pendingTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly evidenceService: MonitoringEvidenceService,
    private readonly trialService: MonitoringTrialService,
    private readonly recoveryMode: RecoveryMode,
    private readonly options: MonitoringServiceOptions,
  ) {}

  async startMonitoring(): Promise<void> {
    this.log({
      event: "monitor_started",
      recoveryMode: this.recoveryMode,
      intervalMs: this.options.intervalMs,
      consecutiveUnhealthyThreshold: this.options.consecutiveUnhealthyThreshold,
      cooldownMs: this.options.cooldownMs,
    });

    while (!this.stopRequested) {
      await this.executeCollectionCycle();

      if (!this.stopRequested) {
        await this.waitForNextCycle(this.options.intervalMs);
      }
    }

    this.log({ event: "monitor_stopped" });
  }

  stopMonitoring(): void {
    this.stopRequested = true;
    this.pendingWait?.();
  }

  private async executeCollectionCycle(): Promise<void> {
    try {
      const snapshot = await this.evidenceService.collectAndNormalize();

      const savedSnapshot = await this.evidenceService.saveEvidenceSnapshot(snapshot);

      this.log({
        event: "monitor_snapshot_observed",
        snapshotId: savedSnapshot.id,
        overallState: savedSnapshot.overallState,
        deterministicState: getDeterministicEvidenceState(savedSnapshot),
      });
      await this.considerRecovery(savedSnapshot);
    } catch (error) {
      this.log({
        event: "monitor_collection_failed",
        error: this.errorMessage(error),
      });
    }
  }

  private async considerRecovery(snapshot: EvidenceSnapshot): Promise<void> {
    if (getDeterministicEvidenceState(snapshot) !== "unhealthy") {
      this.consecutiveUnhealthyCount = 0;
      this.firstUnhealthyObservedAt = undefined;
      this.firstUnhealthyEvidenceSnapshotId = undefined;

      return;
    }

    if (this.consecutiveUnhealthyCount === 0) {
      this.firstUnhealthyObservedAt = new Date(this.now()).toISOString();
      this.firstUnhealthyEvidenceSnapshotId = snapshot.id;
    }

    this.consecutiveUnhealthyCount += 1;
    if (this.consecutiveUnhealthyCount < this.options.consecutiveUnhealthyThreshold) {
      return;
    }

    if (this.recoveryInProgress || this.now() < this.cooldownUntilMs) {
      this.log({
        event: "monitor_recovery_suppressed",
        reason: this.recoveryInProgress ? "recovery_in_progress" : "cooldown",
        snapshotId: snapshot.id,
      });

      return;
    }

    this.recoveryInProgress = true;
    const recoveryTriggeredAt = new Date(this.now()).toISOString();

    this.log({
      event: "monitor_recovery_triggered",
      recoveryMode: this.recoveryMode,
      snapshotId: snapshot.id,
      consecutiveUnhealthyCount: this.consecutiveUnhealthyCount,
    });

    try {
      await this.trialService.runRecoveryTrial({
        mode: this.recoveryMode,
        triggerSource: "monitor",
        snapshot,
        firstUnhealthyObservedAt: this.firstUnhealthyObservedAt,
        firstUnhealthyEvidenceSnapshotId: this.firstUnhealthyEvidenceSnapshotId,
        recoveryTriggeredAt,
      });
    } catch (error) {
      this.log({
        event: "monitor_recovery_failed",
        error: this.errorMessage(error),
      });
    } finally {
      this.recoveryInProgress = false;
      this.consecutiveUnhealthyCount = 0;
      this.firstUnhealthyObservedAt = undefined;
      this.firstUnhealthyEvidenceSnapshotId = undefined;
      this.cooldownUntilMs = this.now() + this.options.cooldownMs;
    }
  }

  private waitForNextCycle(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const finishWait = (): void => {
        if (this.pendingTimer) {
          clearTimeout(this.pendingTimer);
          this.pendingTimer = undefined;
        }

        this.pendingWait = undefined;
        resolve();
      };

      this.pendingWait = finishWait;

      if (this.options.sleep) {
        void this.options.sleep(milliseconds).then(finishWait, finishWait);

        return;
      }

      this.pendingTimer = setTimeout(finishWait, milliseconds);
    });
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private log(entry: Record<string, unknown>): void {
    (this.options.log ?? console.log)(entry);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown monitoring error";
  }
}
