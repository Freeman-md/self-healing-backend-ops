import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod/v4";

const executeFile = promisify(execFile);

const networkSchema = z.object({
  NetworkID: z.string().regex(/^[a-f0-9]{64}$/),
  Aliases: z.array(z.string().regex(/^[a-zA-Z0-9_.-]{1,128}$/)).nullable(),
});

const containerSchema = z.object({
  containerId: z.string().regex(/^[a-f0-9]{64}$/),
  running: z.boolean(),
  project: z.string().min(1),
  service: z.string().min(1),
  networks: z.record(z.string(), networkSchema),
});

const attachmentSchema = z.object({
  containerId: z.string().regex(/^[a-f0-9]{64}$/),
  networkId: z.string().regex(/^[a-f0-9]{64}$/),
  aliases: z.array(z.string().regex(/^[a-zA-Z0-9_.-]{1,128}$/)),
  project: z.string().min(1),
});

export type NetworkAttachment = z.infer<typeof attachmentSchema>;
export type DockerCommand = (args: string[]) => Promise<string>;
const docker: DockerCommand = async (args) =>
  (await executeFile("docker", args, { timeout: 10_000, maxBuffer: 128 * 1024 })).stdout;

export class ApplicationNetworkIsolation {
  constructor(private readonly command: DockerCommand = docker) {}

  private async inspect(name: string) {
    // Project only these fields: full Docker inspection also contains secret environment values.
    const format =
      '{"containerId":{{json .Id}},"running":{{json .State.Running}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"networks":{{json .NetworkSettings.Networks}}}';

    return containerSchema.parse(
      JSON.parse(await this.command(["inspect", "--format", format, name])),
    );
  }

  async captureAttachment(): Promise<NetworkAttachment> {
    const app = await this.inspect("managed-system-app");

    const database = await this.inspect("managed-system-postgres");

    const entries = Object.values(app.networks);

    if (
      !app.running ||
      !database.running ||
      app.project !== database.project ||
      app.service !== "managed-system" ||
      database.service !== "postgres" ||
      entries.length !== 1 ||
      !Object.values(database.networks).some(
        (network) => network.NetworkID === entries[0].NetworkID,
      )
    ) {
      throw new Error("Refusing ambiguous or non-Compose isolation target.");
    }

    const networkId = entries[0].NetworkID;

    const network = z
      .object({ driver: z.literal("bridge"), scope: z.literal("local"), project: z.string() })
      .parse(
        JSON.parse(
          await this.command([
            "network",
            "inspect",
            "--format",
            '{"driver":{{json .Driver}},"scope":{{json .Scope}},"project":{{json (index .Labels "com.docker.compose.project")}}}',
            networkId,
          ]),
        ),
      );

    if (network.project !== app.project) {
      throw new Error("Network project differs from target project.");
    }

    return attachmentSchema.parse({
      containerId: app.containerId,
      networkId,
      aliases: entries[0].Aliases ?? [],
      project: app.project,
    });
  }

  async disconnectApplication(attachment: NetworkAttachment): Promise<void> {
    const current = await this.captureAttachment();

    if (JSON.stringify(current) !== JSON.stringify(attachmentSchema.parse(attachment))) {
      throw new Error("Attachment changed after capture.");
    }

    await this.command(["network", "disconnect", attachment.networkId, "managed-system-app"]);
    await this.verifyIsolated();
  }

  async verifyIsolated(): Promise<void> {
    const app = await this.inspect("managed-system-app");

    if (!app.running || Object.keys(app.networks).length !== 0) {
      throw new Error("Isolation did not preserve a running, detached application.");
    }
  }

  async restoreAttachment(input: NetworkAttachment): Promise<void> {
    const attachment = attachmentSchema.parse(input);

    const app = await this.inspect("managed-system-app");

    if (app.project !== attachment.project || app.containerId !== attachment.containerId) {
      throw new Error("Refusing restoration to a replaced Compose project.");
    }

    const existing = Object.values(app.networks);

    if (existing.some((network) => network.NetworkID !== attachment.networkId)) {
      throw new Error("Unexpected attachment during restoration.");
    }

    if (existing.length === 0) {
      await this.command([
        "network",
        "connect",
        ...attachment.aliases.flatMap((alias) => ["--alias", alias]),
        attachment.networkId,
        "managed-system-app",
      ]);
    }

    const restored = await this.inspect("managed-system-app");

    const network = Object.values(restored.networks).find(
      (entry) => entry.NetworkID === attachment.networkId,
    );

    if (
      !restored.running ||
      !network ||
      attachment.aliases.some((alias) => !network.Aliases?.includes(alias))
    ) {
      throw new Error("Exact network restoration verification failed.");
    }
  }
}

export async function assertUnreachable(baseUrl: string): Promise<void> {
  let reachable = false;

  try {
    await fetch(new URL("/health", baseUrl), { signal: AbortSignal.timeout(5000) });
    reachable = true;
  } catch {
    /* Transport failure is the unsupported condition, not an HTTP error status. */
  }

  if (reachable) {
    throw new Error(
      "Detached application is still reachable; this testbed does not support the isolation profile.",
    );
  }
}
