import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

export const workloadSettingsSchema = z.strictObject({
  offeredRate: z.number().positive().max(100),
  concurrency: z.number().int().min(1).max(20),
  timeoutMs: z.number().int().min(50).max(10000),
  warmupMs: z.number().int().min(1000).max(60000),
  postRecoveryMs: z.number().int().min(1000).max(60000),
  maximumDurationMs: z.number().int().min(1000).max(600000),
});
export type WorkloadSettings = z.infer<typeof workloadSettingsSchema>;
export const workloadFixtureSchema = z.strictObject({
  version: z.literal("1.0.0"),
  marker: z.string().regex(/^m9-fixture-[a-f0-9-]+$/),
  baseUrl: z.string().url(),
  ids: z.array(z.string().min(1)).min(1).max(10),
});
export type WorkloadFixture = z.infer<typeof workloadFixtureSchema>;
export type WorkloadSample = {
  startedAt: number;
  durationMs: number;
  outcome: "success" | "error" | "timeout" | "capacity_skipped";
};
const workOrderBody = z.object({
  data: z.object({ id: z.string(), title: z.string(), description: z.string() }),
});

export function validateLocalTestbed(baseUrl: string): void {
  const url = new URL(baseUrl);

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "managed-system"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Only the named local HTTP testbed is permitted.");
  }
}

export async function createWorkloadFixture(
  baseUrl: string,
  persist: (fixture: WorkloadFixture) => Promise<void>,
  request = fetch,
): Promise<WorkloadFixture> {
  validateLocalTestbed(baseUrl);
  const fixture: WorkloadFixture = {
    version: "1.0.0",
    marker: `m9-fixture-${randomUUID()}`,
    baseUrl,
    ids: [],
  };

  for (let index = 0; index < 10; index += 1) {
    const response = await request(new URL("/work-orders", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: fixture.marker, description: fixture.marker }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status !== 201) {
      throw new Error("Fixture creation failed; retain partial fixture ledger for cleanup.");
    }

    const body = workOrderBody.parse(await response.json());

    if (body.data.title !== fixture.marker || body.data.description !== fixture.marker) {
      throw new Error("Fixture ownership verification failed.");
    }

    fixture.ids.push(body.data.id);
    await persist(fixture);
  }

  return fixture;
}

export async function probeWorkloadFixture(
  fixture: WorkloadFixture,
  id = fixture.ids[0],
  request = fetch,
  signal = AbortSignal.timeout(5000),
): Promise<void> {
  if (!fixture.ids.includes(id)) {
    throw new Error("Record is outside fixture scope.");
  }

  const response = await request(
    new URL(`/work-orders/${encodeURIComponent(id)}`, fixture.baseUrl),
    { signal },
  );

  if (!response.ok) {
    throw new Error("Business read failed.");
  }

  const body = workOrderBody.parse(await response.json());

  if (
    body.data.id !== id ||
    body.data.title !== fixture.marker ||
    body.data.description !== fixture.marker
  ) {
    throw new Error("Business response does not match the scoped fixture.");
  }
}

export async function cleanupWorkloadFixture(
  input: WorkloadFixture,
  request = fetch,
): Promise<void> {
  const fixture = workloadFixtureSchema.parse(input);

  validateLocalTestbed(fixture.baseUrl);
  for (const id of fixture.ids) {
    await probeWorkloadFixture(fixture, id, request);
    const response = await request(
      new URL(`/work-orders/${encodeURIComponent(id)}`, fixture.baseUrl),
      { method: "DELETE", signal: AbortSignal.timeout(5000) },
    );

    if (response.status !== 204) {
      throw new Error("Scoped fixture deletion failed.");
    }
  }
}

export function startBoundedWorkload(input: {
  settings: WorkloadSettings;
  fixture: WorkloadFixture;
  request?: typeof fetch;
}): { stop: () => Promise<WorkloadSample[]>; startedAt: number; samples: WorkloadSample[] } {
  const settings = workloadSettingsSchema.parse(input.settings);

  const fixture = workloadFixtureSchema.parse(input.fixture);

  validateLocalTestbed(fixture.baseUrl);
  const samples: WorkloadSample[] = [];

  const inFlight = new Set<Promise<void>>();

  const startedAt = Date.now();

  let stopped = false;

  let issued = 0;

  let timer: ReturnType<typeof setTimeout>;

  const issue = (): void => {
    if (stopped || Date.now() - startedAt >= settings.maximumDurationMs) {
      return;
    }

    const scheduledAt = startedAt + (issued * 1000) / settings.offeredRate;

    if (Date.now() < scheduledAt) {
      timer = setTimeout(issue, scheduledAt - Date.now());

      return;
    }

    issued += 1;
    if (inFlight.size >= settings.concurrency) {
      samples.push({ startedAt: Date.now(), durationMs: 0, outcome: "capacity_skipped" });
    } else {
      const requestStarted = Date.now();

      const signal = AbortSignal.timeout(settings.timeoutMs);

      const pending = probeWorkloadFixture(
        fixture,
        fixture.ids[(issued - 1) % fixture.ids.length],
        input.request,
        signal,
      )
        .then(
          () => {
            samples.push({
              startedAt: requestStarted,
              durationMs: Date.now() - requestStarted,
              outcome: "success",
            });
          },
          () => {
            samples.push({
              startedAt: requestStarted,
              durationMs: Date.now() - requestStarted,
              outcome: signal.aborted ? "timeout" : "error",
            });
          },
        )
        .finally(() => {
          inFlight.delete(pending);
        });

      inFlight.add(pending);
    }

    timer = setTimeout(
      issue,
      Math.max(0, startedAt + (issued * 1000) / settings.offeredRate - Date.now()),
    );
  };

  issue();

  return {
    samples,
    startedAt,
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await Promise.all(inFlight);

      return samples;
    },
  };
}

export function summarizeWorkload(samples: WorkloadSample[], start: number, end: number) {
  const window = samples.filter((sample) => sample.startedAt >= start && sample.startedAt < end);

  const completed = window.filter((sample) => sample.outcome !== "capacity_skipped");

  const latencies = completed.map((sample) => sample.durationMs).sort((a, b) => a - b);

  const percentile = (fraction: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * fraction) - 1)]
      : null;

  const count = (outcome: WorkloadSample["outcome"]) =>
    window.filter((sample) => sample.outcome === outcome).length;

  return {
    start,
    end,
    definition:
      "Requests started in [start,end); latency includes errors/timeouts; capacity skips have no latency.",
    offeredCount: window.length,
    achievedCount: completed.length,
    offeredRate: (window.length * 1000) / (end - start),
    achievedRate: (completed.length * 1000) / (end - start),
    success: count("success"),
    error: count("error"),
    timeout: count("timeout"),
    capacitySkipped: count("capacity_skipped"),
    latencyMs: {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: latencies.at(-1) ?? null,
    },
  };
}

// Anchor after independent verification. Later persistence/cleanup cannot extend this interval.
export async function waitForFixedObservationWindow(
  durationMs: number,
  clock: { now: () => number; sleep: (milliseconds: number) => Promise<void> } = {
    now: Date.now,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  },
): Promise<{ start: number; end: number }> {
  z.number().int().positive().max(60000).parse(durationMs);
  const start = clock.now();

  const end = start + durationMs;

  while (clock.now() < end) {
    await clock.sleep(end - clock.now());
  }

  return { start, end };
}
