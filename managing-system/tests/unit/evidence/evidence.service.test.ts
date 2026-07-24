import assert from "node:assert/strict";
import { test } from "node:test";

import { EvidenceService } from "@/modules/evidence";

test("raw evidence collection runs without constructing an OpenAI client", async () => {
  const originalFetch = globalThis.fetch;
  const requestedTargets: string[] = [];

  globalThis.fetch = async (input) => {
    requestedTargets.push(String(input));
    return new Response("ok", { status: 200 });
  };

  try {
    const evidence = await new EvidenceService().collectRawEvidence();

    assert.deepEqual(requestedTargets, [
      "http://localhost:3004/health",
      "http://localhost:3004/metrics",
    ]);
    assert.deepEqual(evidence.map((item) => item.status), ["collected", "collected"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
