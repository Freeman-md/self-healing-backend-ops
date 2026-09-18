import type { ControlledTestRequest } from "./operator.schema";

export type OperatorStrategyId = "baseline" | "v1" | "v2" | "v2-reuse";

export type OperatorStrategy = {
  id: OperatorStrategyId;
  label: string;
  reuseEnabled: boolean;
  maxActions: number;
  maxTurns: number;
  ready: boolean;
  reason: string | null;
};

export type OperatorMonitorState = "observing" | "recovering" | "cooldown" | "held" | "stopped";

export type OperatorRuntimeStatus = {
  state: OperatorMonitorState;
  heartbeatAt: string | null;
  strategy: OperatorStrategy | null;
};

export interface OperatorRuntime {
  status(): OperatorRuntimeStatus;
  prepare(strategy: OperatorStrategyId): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type ControlledTestLaunch = ControlledTestRequest;

export interface ControlledTestRunner {
  launch(
    input: ControlledTestLaunch,
  ): Promise<{ requestId: string; runId: string; accepted: boolean }>;
}
