import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ActionDefinition } from "@/types";

const execFileAsync = promisify(execFile);

export type ActionHandlerInput = {
  action: ActionDefinition;
  trialRecordId: string;
};

export type ActionHandlerResult = {
  output: string;
};

export type ActionHandler = (
  input: ActionHandlerInput,
) => Promise<ActionHandlerResult>;

async function restartContainer(containerName: string): Promise<ActionHandlerResult> {
  const { stdout, stderr } = await execFileAsync("docker", ["restart", containerName]);

  return {
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
}

const handlers: Record<string, ActionHandler> = {
  restart_postgres_container: async () =>
    restartContainer("managed-system-postgres"),
  restart_managed_system_service: async () =>
    restartContainer("managed-system-app"),
};

export function findActionHandler(handlerKey: string): ActionHandler | null {
  return handlers[handlerKey] ?? null;
}
