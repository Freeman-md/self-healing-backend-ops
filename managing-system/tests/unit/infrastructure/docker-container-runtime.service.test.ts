import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DockerContainerRuntimeService,
  type ExecFileImplementation,
} from "@/infrastructure/container-runtime";

test("Docker runtime maps fixed targets through argument-based execution", async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];

  const executeFile: ExecFileImplementation = (file, args, callback) => {
    calls.push({ file, args });
    queueMicrotask(() => callback(null, "restarted", ""));

    return {
      kill() {
        return true;
      },
    } as never;
  };

  const runtime = new DockerContainerRuntimeService(
    { dockerEnabled: true, dockerTimeoutMs: 50 },
    executeFile,
  );

  const managed = await runtime.restartTarget("managed-system");

  const postgres = await runtime.restartTarget("postgres");

  assert.equal(managed.containerName, "managed-system-app");
  assert.equal(postgres.containerName, "managed-system-postgres");
  assert.deepEqual(calls, [
    { file: "docker", args: ["restart", "managed-system-app"] },
    { file: "docker", args: ["restart", "managed-system-postgres"] },
  ]);
});

test("Docker runtime rejects disabled, unknown and inherited targets before process execution", async () => {
  let invoked = false;

  const executeFile: ExecFileImplementation = () => {
    invoked = true;

    return {
      kill() {
        return true;
      },
    } as never;
  };

  const disabled = new DockerContainerRuntimeService(
    { dockerEnabled: false, dockerTimeoutMs: 10 },
    executeFile,
  );

  await assert.rejects(disabled.restartTarget("managed-system"), /disabled/);
  const enabled = new DockerContainerRuntimeService(
    { dockerEnabled: true, dockerTimeoutMs: 10 },
    executeFile,
  );

  await assert.rejects(enabled.restartTarget("unknown" as never), /Unsupported/);
  await assert.rejects(enabled.restartTarget("toString" as never), /Unsupported/);
  assert.equal(invoked, false);
});

test("Docker runtime terminates a timed-out process", async () => {
  let killed = false;

  const runtime = new DockerContainerRuntimeService(
    { dockerEnabled: true, dockerTimeoutMs: 1 },
    () =>
      ({
        kill() {
          killed = true;

          return true;
        },
      }) as never,
  );

  await assert.rejects(runtime.restartTarget("managed-system"), /timed out/);
  assert.equal(killed, true);
});

test("Docker runtime performs bounded fixed-target read-only inspection", async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];

  const runtime = new DockerContainerRuntimeService(
    { dockerEnabled: false, dockerTimeoutMs: 50 },
    (file, args, callback) => {
      calls.push({ file, args });
      queueMicrotask(() => callback(null, "running\n", ""));

      return {
        kill() {
          return true;
        },
      } as never;
    },
  );

  const state = await runtime.inspectTarget("managed-system");

  assert.deepEqual(state, {
    target: "managed-system",
    containerName: "managed-system-app",
    state: "running",
  });
  assert.deepEqual(calls, [
    { file: "docker", args: ["inspect", "--format", "{{.State.Status}}", "managed-system-app"] },
  ]);
  await assert.rejects(runtime.inspectTarget("unknown" as never), /Unsupported/);
});
