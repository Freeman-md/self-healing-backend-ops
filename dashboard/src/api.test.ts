import { describe, expect, it } from "vitest";

import { operatorStateSchema, trialDetailSchema } from "./api";

describe("operator API contracts", () => {
  it("accepts unknown current health when persisted evidence is stale or unavailable", () => {
    const result = operatorStateSchema.safeParse({
      serverTime: "2026-09-18T10:00:00.000Z",
      controlPlane: { status: "unavailable", message: "Persisted state could not be read." },
      evidence: null,
      monitor: {
        state: "unavailable",
        heartbeatAt: null,
        activeRunId: null,
        strategy: null,
        readiness: { canLaunch: false, reasons: ["The persisted control plane is unavailable."] },
      },
      strategies: [],
      workloads: [{ id: "idle", label: "Idle local workload", ready: false, reason: "Unavailable" }],
    });
    expect(result.success).toBe(true);
  });

  it("keeps partial experiment metrics as null rather than converting them to zero", () => {
    const result = trialDetailSchema.safeParse({
      trial: {
        id: "trial-1",
        runId: "operator-run-1",
        startedAt: "2026-09-18T10:00:00.000Z",
        completedAt: null,
        trigger: "monitor",
        scenario: null,
        strategy: "baseline",
        status: "started",
        outcome: "unresolved_not_escalated",
        oracle: "pending",
        reason: null,
        restoration: "pending",
      },
      trail: [],
      measurement: {
        observedTimeToHealMs: null,
        timeToHealMs: null,
        timeToTerminationMs: null,
        faultToDetectionMs: null,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.measurement.timeToHealMs).toBeNull();
  });
});
