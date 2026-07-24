import assert from "node:assert/strict";
import { test } from "node:test";

import { EvidenceService } from "@/modules/evidence";
import type { EvidenceSnapshot } from "@/modules/evidence";

test("raw evidence collection runs without constructing an OpenAI client", async () => {
  const originalFetch = globalThis.fetch;
  const requestedTargets: string[] = [];

  globalThis.fetch = async (input) => {
    requestedTargets.push(String(input));
    return new Response("ok", { status: 200 });
  };

  try {
    const evidence = await new EvidenceService({
      saveEvidenceSnapshot(snapshot) {
        return snapshot;
      },
      findEvidenceSnapshotById() {
        return null;
      },
    }).collectRawEvidence();

    assert.deepEqual(requestedTargets, [
      "http://localhost:3004/health",
      "http://localhost:3004/metrics",
    ]);
    assert.deepEqual(evidence.map((item) => item.status), ["collected", "collected"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EvidenceService persists and retrieves snapshots through its injected repository", () => {
  const snapshots = new Map<string, EvidenceSnapshot>();
  const snapshot: EvidenceSnapshot = {
    id: "snapshot-persistence-test",
    rawEvidenceIds: [],
    createdAt: "2026-07-24T00:00:00.000Z",
    targetSystem: "managed-system",
    overallState: "healthy",
    summary: "healthy",
    signals: [],
    suspectedIncidentTypes: [],
    contradictions: [],
  };
  const service = new EvidenceService({
    saveEvidenceSnapshot(savedSnapshot) {
      snapshots.set(savedSnapshot.id, savedSnapshot);
      return savedSnapshot;
    },
    findEvidenceSnapshotById(snapshotId) {
      return snapshots.get(snapshotId) ?? null;
    },
  });

  assert.equal(service.saveEvidenceSnapshot(snapshot), snapshot);
  assert.equal(service.findEvidenceSnapshotById(snapshot.id), snapshot);
});

test("health polling stops as soon as the managed system reports healthy", async () => {
  let fetchCount = 0;
  const service = new EvidenceService(
    { saveEvidenceSnapshot: (snapshot) => snapshot, findEvidenceSnapshotById: () => null },
    undefined,
    undefined,
    {
      healthTimeoutMs: 100,
      healthPollIntervalMs: 10,
      fetchImplementation: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify({ status: "healthy" }), { status: 200 });
      },
    },
  );

  const result = await service.waitForManagedSystemHealth();
  assert.equal(result.healthy, true);
  assert.equal(result.attempts, 1);
  assert.equal(fetchCount, 1);
});

test("health polling retries failures and returns the final observation at its deadline", async () => {
  let now = 0;
  let fetchCount = 0;
  const service = new EvidenceService(
    { saveEvidenceSnapshot: (snapshot) => snapshot, findEvidenceSnapshotById: () => null },
    undefined,
    undefined,
    {
      healthTimeoutMs: 20,
      healthPollIntervalMs: 10,
      now: () => now,
      sleep: async (milliseconds) => { now += milliseconds; },
      fetchImplementation: async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          throw new Error("connection refused");
        }
        return new Response(JSON.stringify({ status: "unhealthy" }), { status: 503 });
      },
    },
  );

  const result = await service.waitForManagedSystemHealth();
  assert.equal(result.healthy, false);
  assert.equal(result.attempts, 3);
  assert.equal(result.lastStatusCode, 503);
  assert.match(result.lastError ?? "", /503/);
});
