import { execFile, type ChildProcess } from "node:child_process";

import { config } from "@/config";

import type { IContainerRuntime } from "./container-runtime.interface";
import type {
  ContainerRestartResult,
  ContainerRuntimeTarget,
  ContainerState,
  ContainerStateResult,
} from "./container-runtime.types";

type DockerActionConfig = Pick<typeof config.actions, "dockerEnabled" | "dockerTimeoutMs">;

type ExecFileCallback = (
  error: Error | null,
  stdout: string | Buffer,
  stderr: string | Buffer,
) => void;

export type ExecFileImplementation = (
  file: string,
  args: readonly string[],
  callback: ExecFileCallback,
) => ChildProcess;

const containerNames: Record<ContainerRuntimeTarget, string> = {
  "managed-system": "managed-system-app",
  postgres: "managed-system-postgres",
};

const executeWithExecFile: ExecFileImplementation = (file, args, callback) =>
  execFile(file, args, callback);

export class DockerContainerRuntimeService implements IContainerRuntime {
  constructor(
    private readonly actionConfig: DockerActionConfig = config.actions,
    private readonly executeFile: ExecFileImplementation = executeWithExecFile,
  ) {}

  async restartTarget(target: ContainerRuntimeTarget): Promise<ContainerRestartResult> {
    if (!this.actionConfig.dockerEnabled) {
      throw new Error("Docker action execution is disabled.");
    }

    const containerName = this.resolveContainerName(target);

    const output = await this.executeDockerRestart(containerName);

    return { target, containerName, output };
  }

  async inspectTarget(target: ContainerRuntimeTarget): Promise<ContainerStateResult> {
    const containerName = this.resolveContainerName(target);

    try {
      const output = await this.executeDockerInspect(containerName);

      return { target, containerName, state: this.toContainerState(output) };
    } catch {
      return { target, containerName, state: "unknown" };
    }
  }

  private resolveContainerName(target: ContainerRuntimeTarget): string {
    if (!Object.hasOwn(containerNames, target)) {
      throw new Error(`Unsupported container runtime target: ${String(target)}.`);
    }

    return containerNames[target];
  }

  private executeDockerRestart(containerName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let completed = false;

      let timeout: NodeJS.Timeout | undefined;

      const child = this.executeFile(
        "docker",
        ["restart", containerName],
        (error, stdout, stderr) => {
          if (completed) {
            return;
          }

          completed = true;
          if (timeout) {
            clearTimeout(timeout);
          }

          if (error) {
            reject(new Error(`Docker restart failed for ${containerName}: ${error.message}`));

            return;
          }

          resolve([stdout.toString(), stderr.toString()].filter(Boolean).join("\n").trim());
        },
      );

      if (completed) {
        return;
      }

      timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;
        child.kill();
        reject(new Error(`Docker restart timed out for ${containerName}.`));
      }, this.actionConfig.dockerTimeoutMs);
    });
  }

  private executeDockerInspect(containerName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let completed = false;

      const child = this.executeFile(
        "docker",
        ["inspect", "--format", "{{.State.Status}}", containerName],
        (error, stdout, stderr) => {
          if (completed) {
            return;
          }

          completed = true;
          if (timeout) {
            clearTimeout(timeout);
          }

          if (error) {
            reject(new Error(`Docker inspection failed for ${containerName}: ${error.message}`));

            return;
          }

          resolve([stdout.toString(), stderr.toString()].filter(Boolean).join("\n").trim());
        },
      );

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;
        child.kill();
        reject(new Error(`Docker inspection timed out for ${containerName}.`));
      }, this.actionConfig.dockerTimeoutMs);
    });
  }

  private toContainerState(output: string): ContainerState {
    const normalized = output.trim().toLowerCase();

    if (normalized === "running" || normalized === "restarting" || normalized === "exited") {
      return normalized;
    }

    if (normalized === "created" || normalized === "paused" || normalized === "dead") {
      return "stopped";
    }

    return "unknown";
  }
}
