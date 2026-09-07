import { IContainerRuntime } from "./../../src/infrastructure/container-runtime/container-runtime.interface";
import type { RecoveryOracleResult } from "../../src/modules/experiment/experiment.types";

export class RecoveryOracle {
  constructor(
    private readonly baseUrl: string,
    private readonly containerRuntime: IContainerRuntime,
    private readonly requestTimeoutMs = 5_000,
    private readonly pollIntervalMs = 1_000,
  ) {}

  async verifyStableRecovery(stabilityWindowMs: number): Promise<RecoveryOracleResult> {
    const startedAt = Date.now();

    let lastDetails: Record<string, unknown> = {};

    let firstHealthyObservedAt: string | null = null;

    while (Date.now() - startedAt <= stabilityWindowMs) {
      const observation = await this.observe();

      lastDetails = observation.details;
      if (!observation.healthy) {
        return {
          succeeded: false,
          firstHealthyObservedAt,
          checkedAt: new Date().toISOString(),
          details: {
            ...lastDetails,
            stabilityWindowMs,
            stableForMs: Date.now() - startedAt,
          },
        };
      }

      firstHealthyObservedAt ??= new Date().toISOString();

      await sleep(this.pollIntervalMs);
    }

    return {
      succeeded: true,
      firstHealthyObservedAt,
      checkedAt: new Date().toISOString(),
      details: {
        ...lastDetails,
        stabilityWindowMs,
        stableForMs: Date.now() - startedAt,
      },
    };
  }

  async waitForHealthy(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if ((await this.observe()).healthy) {
        return true;
      }

      await sleep(this.pollIntervalMs);
    }

    return false;
  }

  private async observe(): Promise<{
    healthy: boolean;
    details: Record<string, unknown>;
  }> {
    const [health, metrics, applicationContainer, postgresContainer] = await Promise.all([
      this.fetchHealth(),
      this.fetchMetrics(),
      this.containerRuntime.inspectTarget("managed-system"),
      this.containerRuntime.inspectTarget("postgres"),
    ]);

    const healthy =
      health.reachable &&
      health.status === "healthy" &&
      health.appStatus === "healthy" &&
      health.databaseStatus === "healthy" &&
      metrics.reachable &&
      applicationContainer.state === "running" &&
      postgresContainer.state === "running";

    return {
      healthy,
      details: {
        health,
        metrics,
        applicationContainerState: applicationContainer.state,
        postgresContainerState: postgresContainer.state,
      },
    };
  }

  private async fetchHealth(): Promise<{
    reachable: boolean;
    status: string | null;
    appStatus: string | null;
    databaseStatus: string | null;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      const body: unknown = await response.json();

      return {
        reachable: response.ok,
        status: nestedString(body, "status"),
        appStatus: nestedString(body, "checks", "app", "status"),
        databaseStatus: nestedString(body, "checks", "database", "status"),
      };
    } catch {
      return {
        reachable: false,
        status: null,
        appStatus: null,
        databaseStatus: null,
      };
    }
  }

  private async fetchMetrics(): Promise<{ reachable: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`, {
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      return { reachable: response.ok };
    } catch {
      return { reachable: false };
    }
  }
}

function nestedString(value: unknown, ...path: string[]): string | null {
  let current: unknown = value;

  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
