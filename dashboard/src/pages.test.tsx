// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { api } from "./api";
import { TrialsPage } from "./pages";

test("a selected trial opens its investigation without burying it under history", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/trials?trial=trial-selected");
  vi.spyOn(api, "listTrials").mockResolvedValue({
    records: [],
    total: 0,
    nextCursor: null,
  });
  vi.spyOn(api, "getTrial").mockResolvedValue({
    trial: {
      id: "trial-selected",
      runId: null,
      startedAt: "2026-09-18T12:00:00.000Z",
      completedAt: null,
      trigger: "monitor",
      scenario: null,
      strategy: "Agent V2",
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
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () => root.render(<TrialsPage />));
    expect(element.querySelector("h1")?.textContent).toBe(
      "Trial investigation",
    );
    expect(element.querySelector("#trial-search")).toBeNull();
    expect(element.textContent).toContain("trial-selected");
    expect(element.querySelector('a[href="/trials"]')?.textContent).toBe(
      "Back to trials",
    );
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
