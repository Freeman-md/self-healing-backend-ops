import assert from "node:assert/strict";
import { test } from "node:test";
import { ApplicationNetworkIsolation } from "../../../scripts/experiment/network-isolation";
import { prepareM9Protocol } from "../../../scripts/experiment/m9-protocol";
import {
  startBoundedWorkload,
  summarizeWorkload,
  cleanupWorkloadFixture,
} from "../../../scripts/experiment/workload";

const networkId = "a".repeat(64);

test("isolation captures and restores exact network aliases, including after injection failure", async () => {
  const commands: string[][] = [];

  let detached = false;

  const isolation = new ApplicationNetworkIsolation(async (args) => {
    commands.push(args);
    if (args[0] === "inspect") {
      const app = args.at(-1) === "managed-system-app";

      return JSON.stringify({
        containerId: "b".repeat(64),
        running: true,
        project: "testbed",
        service: app ? "managed-system" : "postgres",
        networks:
          app && detached
            ? {}
            : { local: { NetworkID: networkId, Aliases: ["managed-system", "alias"] } },
      });
    }

    if (args[1] === "inspect") {
      return JSON.stringify({ driver: "bridge", scope: "local", project: "testbed" });
    }

    if (args[1] === "disconnect") {
      detached = true;
    }

    if (args[1] === "connect") {
      detached = false;
    }

    return "";
  });

  const attachment = await isolation.captureAttachment();

  try {
    await isolation.disconnectApplication(attachment);
    throw new Error("simulated runner failure");
  } catch {
    await isolation.restoreAttachment(attachment);
  }

  assert.equal(detached, false);
  assert.deepEqual(
    commands.find((args) => args[1] === "connect"),
    [
      "network",
      "connect",
      "--alias",
      "managed-system",
      "--alias",
      "alias",
      networkId,
      "managed-system-app",
    ],
  );
  assert.ok(
    commands
      .filter((args) => args[0] === "inspect")
      .every((args) => args.includes("--format") && !args.join(" ").includes(".Config.Env")),
  );
});
test("prepared panels have fixed counts and isolated cold-before-warm order", () => {
  const base = {
    sourceRevision: "a".repeat(40),
    seed: "fixed",
    fixturePath: "fixture.json",
    workload: null,
    calibrationPath: null,
    isolationPreflightPath: null,
    preFaultSettleMs: 1000,
    suppressionWindowMs: 1000,
  };

  assert.equal(prepareM9Protocol({ ...base, condition: "baseline" }).runOrder.length, 15);
  const pairs = prepareM9Protocol({ ...base, condition: "reuse" }).runOrder;

  assert.equal(pairs.length, 10);
  assert.deepEqual(
    pairs.slice(0, 2).map((slot) => slot.phase),
    ["cold", "warm"],
  );
  assert.equal(prepareM9Protocol({ ...base, condition: "unsupported" }).runOrder.length, 5);
});
test("workload enforces concurrency, counts skipped offers, and checks business responses", async () => {
  let active = 0;

  let maximum = 0;

  const fixture = {
    version: "1.0.0" as const,
    marker: "m9-fixture-aaaa",
    baseUrl: "http://localhost:3004",
    ids: ["one"],
  };

  const request: typeof fetch = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 40));
    active -= 1;

    return new Response(
      JSON.stringify({ data: { id: "one", title: fixture.marker, description: fixture.marker } }),
    );
  };

  const workload = startBoundedWorkload({
    fixture,
    settings: {
      offeredRate: 100,
      concurrency: 1,
      timeoutMs: 100,
      warmupMs: 1000,
      postRecoveryMs: 1000,
      maximumDurationMs: 1000,
    },
    request,
  });

  await new Promise((resolve) => setTimeout(resolve, 130));
  const end = Date.now();

  const samples = await workload.stop();

  const summary = summarizeWorkload(samples, workload.startedAt, end);

  assert.equal(maximum, 1);
  assert.ok(summary.capacitySkipped > 0);
  assert.ok(summary.success > 0);
  let deleted = false;

  await assert.rejects(
    cleanupWorkloadFixture(fixture, async (_url, init) => {
      if (init?.method === "DELETE") {
        deleted = true;
      }

      return new Response(
        JSON.stringify({ data: { id: "one", title: "unrelated", description: "user data" } }),
      );
    }),
  );
  assert.equal(deleted, false);
});
