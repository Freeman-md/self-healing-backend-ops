import assert from "node:assert/strict";
import { test } from "node:test";

import { MonitoringService } from "@/modules/monitor";
import type { EvidenceSnapshot } from "@/modules/evidence";

function snapshot(id: string, overallState: EvidenceSnapshot["overallState"]): EvidenceSnapshot {
  const status =
    overallState === "healthy"
      ? "normal"
      : overallState === "unhealthy"
        ? "critical"
        : overallState === "degraded"
          ? "warning"
          : "unknown";

  return {
    id,
    rawEvidenceIds: [],
    createdAt: new Date().toISOString(),
    targetSystem: "managed-system",
    overallState,
    summary: overallState,
    signals: [
      {
        source: "health",
        name: "Managed-system health",
        code: "managed_system_health",
        status,
        value: overallState,
        description: "Deterministic test signal.",
        method: "deterministic",
      },
    ],
    suspectedIncidentTypes: [],
    contradictions: [],
  };
}

test("monitor only triggers one recovery after sustained unhealthy evidence and suppresses cooldown duplicates", async () => {
  const observations = [
    snapshot("healthy", "healthy"),
    snapshot("unknown", "unknown"),
    snapshot("unhealthy-1", "unhealthy"),
    snapshot("unhealthy-2", "unhealthy"),
    snapshot("unhealthy-3", "unhealthy"),
  ];

  const recoveryInputs: Array<{ triggerSource?: string; scenarioId?: string }> = [];

  let now = 0;

  let monitoringService: MonitoringService;

  let cycles = 0;

  monitoringService = new MonitoringService(
    {
      collectAndNormalize: () => observations[cycles],
      saveEvidenceSnapshot: (savedSnapshot) => savedSnapshot,
    },
    {
      async runRecoveryTrial(input) {
        recoveryInputs.push(input);

        return {} as never;
      },
    },
    "baseline",
    {
      intervalMs: 1,
      consecutiveUnhealthyThreshold: 2,
      cooldownMs: 100,
      now: () => now,
      sleep: async () => {
        cycles += 1;
        now += 1;
        if (cycles >= observations.length) {
          monitoringService.stopMonitoring();
        }
      },
      log: () => undefined,
    },
  );

  await monitoringService.startMonitoring();

  assert.equal(recoveryInputs.length, 1);
  assert.equal(recoveryInputs[0]?.triggerSource, "monitor");
  assert.equal(recoveryInputs[0]?.scenarioId, undefined);
});

test("monitor ignores descriptive overall state when deterministic evidence is healthy", async () => {
  const descriptiveMismatch = snapshot("mismatch", "healthy");

  descriptiveMismatch.overallState = "unhealthy";
  let recoveryCount = 0;

  let monitoringService: MonitoringService;

  monitoringService = new MonitoringService(
    {
      collectAndNormalize: () => descriptiveMismatch,
      saveEvidenceSnapshot: (savedSnapshot) => savedSnapshot,
    },
    {
      async runRecoveryTrial() {
        recoveryCount += 1;

        return {} as never;
      },
    },
    "baseline",
    {
      intervalMs: 1,
      consecutiveUnhealthyThreshold: 1,
      cooldownMs: 1,
      sleep: async () => monitoringService.stopMonitoring(),
      log: () => undefined,
    },
  );

  await monitoringService.startMonitoring();
  assert.equal(recoveryCount, 0);
});

test("stopping the monitor interrupts a pending interval wait", async () => {
  let resolveCollectionStarted: (() => void) | undefined;

  const collectionStarted = new Promise<void>((resolve) => {
    resolveCollectionStarted = resolve;
  });

  const monitoringService = new MonitoringService(
    {
      async collectAndNormalize() {
        resolveCollectionStarted?.();

        return snapshot("healthy", "healthy");
      },
      saveEvidenceSnapshot: (savedSnapshot) => savedSnapshot,
    },
    { runRecoveryTrial: async () => ({}) as never },
    "baseline",
    {
      intervalMs: 60000,
      consecutiveUnhealthyThreshold: 2,
      cooldownMs: 100,
      sleep: () => new Promise<void>(() => undefined),
      log: () => undefined,
    },
  );

  const monitoring = monitoringService.startMonitoring();

  await collectionStarted;
  monitoringService.stopMonitoring();
  await monitoring;
});
