import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FaultProfileCode } from "../../src/modules/experiment/experiment.types";
import { findFaultProfile } from "../../src/modules/experiment/experiment.profiles";

const executeFile = promisify(execFile);
const containerNames = {
  "managed-system": "managed-system-app",
  postgres: "managed-system-postgres",
} as const;

export async function injectFaultProfile(
  profileCode: FaultProfileCode,
): Promise<void> {
  const profile = findFaultProfile(profileCode);
  for (const target of profile.stoppedTargets) {
    await executeFile("docker", ["stop", containerNames[target]], {
      timeout: 10_000,
    });
  }
}

export async function restoreExperimentTargets(): Promise<void> {
  await executeFile("docker", ["restart", containerNames.postgres], {
    timeout: 10_000,
  });
  await executeFile("docker", ["restart", containerNames["managed-system"]], {
    timeout: 10_000,
  });
}
