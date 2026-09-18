import test from "node:test";
import assert from "node:assert/strict";

import { MonitoringRuntime } from "@/modules/operator/operator-runtime";
import type { MonitoringService } from "@/modules/monitor";

test("strategy replacement stops the previous monitor before starting the next monitor", async () => {
  const events: string[] = [];

  const strategies = [
    {
      id: "baseline" as const,
      label: "Baseline",
      reuseEnabled: false,
      maxActions: 3,
      maxTurns: 3,
      ready: true,
      reason: null,
    },
    {
      id: "v1" as const,
      label: "Agent V1",
      reuseEnabled: false,
      maxActions: 3,
      maxTurns: 3,
      ready: true,
      reason: null,
    },
  ];

  const runtime = new MonitoringRuntime(
    (id) => {
      let release: (() => void) | undefined;

      return {
        getMonitoringStatus: () => ({
          state: "observing",
          heartbeatAt: null,
          recoveryInProgress: false,
        }),
        startMonitoring: () =>
          new Promise<void>((resolve) => {
            release = resolve;
            events.push(`start:${id}`);
          }),
        stopMonitoring: () => {
          events.push(`stop:${id}`);
          release?.();
        },
      } as unknown as MonitoringService;
    },
    () => strategies,
    "baseline",
  );

  await runtime.start();
  await runtime.prepare("v1");

  assert.deepEqual(events, ["start:baseline", "stop:baseline", "start:v1"]);
  await runtime.stop();
});
