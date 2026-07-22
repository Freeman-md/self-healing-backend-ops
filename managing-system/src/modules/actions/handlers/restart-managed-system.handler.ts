import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ActionHandler } from "./action-handler.types";

const execFileAsync = promisify(execFile);

export const restartManagedSystemHandler: ActionHandler = async () => {
  const { stdout, stderr } = await execFileAsync("docker", [
    "restart",
    "managed-system-app",
  ]);

  return {
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
};
