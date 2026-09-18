import { describe, expect, it, vi } from "vitest";

import { api, ApiError, operatorStateSchema, trialDetailSchema } from "./api";

describe("operator API contracts", () => {
  it("bounds reads below the polling interval and sanitizes network and schema failures", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("internal transport detail"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(api.getState()).rejects.toThrow(
        "local control plane could not be reached",
      );
      expect(timeout).toHaveBeenCalledWith(5_000);
      await expect(api.reviewAttention("attention", "draft")).rejects.toThrow(
        "acceptance could not be confirmed",
      );
      expect(timeout).toHaveBeenCalledWith(15_000);
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ internal: "provider detail" }), {
          status: 200,
        }),
      );
      await expect(api.reviewAttention("attention", "draft")).rejects.toThrow(
        ApiError,
      );
      await expect(api.getState()).rejects.toThrow("unusable information");
    } finally {
      timeout.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it("accepts unknown current health when persisted evidence is stale or unavailable", () => {
    const result = operatorStateSchema.safeParse({
      serverTime: "2026-09-18T10:00:00.000Z",
      controlPlane: {
        status: "unavailable",
        message: "Persisted state could not be read.",
      },
      evidence: null,
      monitor: {
        state: "unavailable",
        heartbeatAt: null,
        activeRunId: null,
        strategy: null,
        readiness: {
          canLaunch: false,
          reasons: ["The persisted control plane is unavailable."],
        },
      },
      strategies: [],
      workloads: [
        {
          id: "idle",
          label: "Idle local workload",
          ready: false,
          reason: "Unavailable",
        },
      ],
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
