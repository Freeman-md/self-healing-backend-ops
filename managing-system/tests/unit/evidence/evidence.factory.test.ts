import assert from "node:assert/strict";
import { test } from "node:test";

import { EvidenceFactory } from "@/modules/evidence";

const collectedAt = "2026-07-24T12:00:00.000Z";

test("EvidenceFactory creates collected raw evidence", () => {
  const evidence = new EvidenceFactory().createCollectedRawEvidence({
    source: "health",
    target: "http://managed-system:3000/health",
    collectedAt,
    rawText: '{"status":"healthy"}',
  });

  assert.deepEqual(evidence, {
    id: `raw-health-${collectedAt}`,
    source: "health",
    target: "http://managed-system:3000/health",
    collectedAt,
    status: "collected",
    rawText: '{"status":"healthy"}',
    error: null,
  });
});

test("EvidenceFactory creates failed raw evidence", () => {
  const evidence = new EvidenceFactory().createFailedRawEvidence({
    source: "metrics",
    target: "http://managed-system:3000/metrics",
    collectedAt,
    rawText: null,
    error: "request timed out",
  });

  assert.deepEqual(evidence, {
    id: `raw-metrics-${collectedAt}`,
    source: "metrics",
    target: "http://managed-system:3000/metrics",
    collectedAt,
    status: "failed",
    rawText: null,
    error: "request timed out",
  });
});
