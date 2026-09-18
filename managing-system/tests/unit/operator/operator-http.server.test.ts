import test from "node:test";
import assert from "node:assert/strict";
import { get } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OperatorHttpServer, type OperatorService } from "@/modules/operator";

test("HTTP boundary rejects foreign callers and malformed launches before dispatch; static directories cannot crash it", async () => {
  let launches = 0;

  const dashboardDirectory = await mkdtemp(join(tmpdir(), "shbo-http-review-"));

  await mkdir(join(dashboardDirectory, "assets"));
  await writeFile(
    join(dashboardDirectory, "index.html"),
    "<!doctype html><title>Test dashboard</title>",
  );

  const server = new OperatorHttpServer(
    {
      launchControlledTest: async () => {
        launches++;

        return { accepted: true };
      },
    } as unknown as OperatorService,
    { host: "127.0.0.1", port: 55040, dashboardDirectory },
  );

  await server.start();
  const origin = "http://127.0.0.1:55040";

  try {
    const foreign = await fetch(`${origin}/api/controlled-tests`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "X-Operator-Request": "1" },
    });

    assert.equal(foreign.status, 409);
    const badHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(
        `${origin}/api/operator/state`,
        { headers: { Host: "evil.example:55040" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      ).on("error", reject);
    });

    assert.equal(badHostStatus, 403);
    const malformed = await fetch(`${origin}/api/controlled-tests`, {
      method: "POST",
      headers: { Origin: origin, "X-Operator-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ profile: "shell", command: "unsafe" }),
    });

    assert.equal(malformed.status, 400);
    assert.equal(launches, 0);
    const directory = await fetch(`${origin}/assets`);

    assert.equal(directory.status, 200);
    assert.match(directory.headers.get("content-type")!, /text\/html/);
    const valid = await fetch(`${origin}/api/controlled-tests`, {
      method: "POST",
      headers: { Origin: origin, "X-Operator-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "f4498557-1e65-42cd-bcc8-693f0a9819c2",
        profile: "managed_system_application_stopped",
        strategy: "v2",
        workload: "idle",
      }),
    });

    assert.equal(valid.status, 202);
    assert.equal(launches, 1);
  } finally {
    await server.close();
    await rm(dashboardDirectory, { recursive: true });
  }
});
