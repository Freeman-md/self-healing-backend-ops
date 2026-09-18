import { MonitoringService } from "@/modules/monitor";

import type {
  OperatorRuntime,
  OperatorRuntimeStatus,
  OperatorStrategy,
  OperatorStrategyId,
} from "./operator.types";

type MonitorFactory = (strategy: OperatorStrategyId) => MonitoringService;

export class MonitoringRuntime implements OperatorRuntime {
  private monitor: MonitoringService | null = null;

  private monitorTask: Promise<void> | null = null;

  private activeStrategy: OperatorStrategy | null = null;

  constructor(
    private readonly createMonitor: MonitorFactory,
    private readonly strategies: () => OperatorStrategy[],
    private readonly initialStrategy: OperatorStrategyId,
    private readonly log: (entry: Record<string, unknown>) => void = console.log,
  ) {}

  status(): OperatorRuntimeStatus {
    const status = this.monitor?.getMonitoringStatus();

    return {
      state: status?.state ?? "stopped",
      heartbeatAt: status?.heartbeatAt ?? null,
      strategy: this.activeStrategy,
    };
  }

  async start(): Promise<void> {
    if (this.monitorTask) {
      return;
    }

    await this.prepare(this.activeStrategy?.id ?? this.initialStrategy);
  }

  async prepare(strategyId: OperatorStrategyId): Promise<void> {
    const strategy = this.strategies().find((entry) => entry.id === strategyId);

    if (!strategy?.ready) {
      throw new Error(strategy?.reason ?? "The selected strategy is not ready.");
    }

    if (this.activeStrategy?.id === strategyId && this.monitorTask) {
      return;
    }

    if (this.monitor?.getMonitoringStatus().recoveryInProgress) {
      throw new Error("The current monitor is still recovering and cannot be replaced.");
    }

    await this.stop();
    this.monitor = this.createMonitor(strategyId);
    this.activeStrategy = strategy;
    this.monitorTask = this.monitor
      .startMonitoring()
      .catch((error: unknown) => {
        this.log({ event: "operator_monitor_failed", error: safeError(error) });
      })
      .finally(() => {
        this.monitorTask = null;
      });
  }

  async stop(): Promise<void> {
    if (!this.monitorTask || !this.monitor) {
      return;
    }

    this.monitor.stopMonitoring();
    await this.monitorTask;
    this.monitor = null;
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown monitor error";
}
