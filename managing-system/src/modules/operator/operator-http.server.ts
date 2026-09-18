import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve } from "node:path";
import { z } from "zod/v4";

import {
  controlledTestRequestSchema,
  OperatorService,
  OperatorUnavailableError,
  operatorIdentifierSchema,
  operatorListTrialsQuerySchema,
} from "@/modules/operator";

import { hasLocalMutationGuard, hasLocalOperatorHost } from "./operator-http.guard";

const dashboardDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../dashboard/dist",
);

const maxBodyBytes = 16 * 1024;

const staticContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export class OperatorHttpServer {
  private server: Server | null = null;

  constructor(
    private readonly service: OperatorService,
    private readonly options: {
      host: "127.0.0.1" | "0.0.0.0";
      port: number;
      dashboardDirectory?: string;
    },
  ) {}

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolveStart, rejectStart) => {
      this.server?.once("error", rejectStart);
      this.server?.listen(this.options.port, this.options.host, () => {
        this.server?.removeListener("error", rejectStart);
        resolveStart();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;

    this.server = null;
    await new Promise<void>((resolveClose, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolveClose())),
    );
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const correlationId = randomUUID();

    try {
      if (!hasLocalOperatorHost(request.headers, this.options.port)) {
        sendError(response, 403, "The operator interface accepts local hosts only.", correlationId);

        return;
      }

      const url = new URL(request.url ?? "/", `http://${this.options.host}:${this.options.port}`);

      if (url.pathname.startsWith("/api/")) {
        await this.handleApi(request, response, url);

        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendError(
          response,
          405,
          "Only GET and HEAD are available for dashboard files.",
          correlationId,
        );

        return;
      }

      await this.serveDashboard(response, url.pathname, request.method === "HEAD");
    } catch (error) {
      const status =
        error instanceof OperatorUnavailableError ? 409 : error instanceof z.ZodError ? 400 : 500;

      sendError(response, status, publicMessage(error), correlationId);
    }
  }

  private async handleApi(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<void> {
    const method = request.method ?? "GET";

    const parts = url.pathname.split("/").filter(Boolean);

    if (method !== "GET") {
      assertLocalMutation(request, this.options.port);
    }

    if (method === "GET" && url.pathname === "/api/operator/state") {
      return sendJson(response, 200, await this.service.readState());
    }

    if (method === "GET" && url.pathname === "/api/trials") {
      return sendJson(
        response,
        200,
        await this.service.listTrials(
          operatorListTrialsQuerySchema.parse(Object.fromEntries(url.searchParams)),
        ),
      );
    }

    if (method === "GET" && parts.length === 3 && parts[1] === "trials") {
      return sendJson(
        response,
        200,
        await this.service.readTrial(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    if (method === "GET" && url.pathname === "/api/attention") {
      return sendJson(response, 200, await this.service.listAttention());
    }

    if (method === "GET" && parts.length === 3 && parts[1] === "attention") {
      return sendJson(
        response,
        200,
        await this.service.readAttention(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[1] === "attention" &&
      parts[3] === "acknowledge"
    ) {
      return sendJson(
        response,
        200,
        await this.service.acknowledgeAttention(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[1] === "attention" &&
      parts[3] === "review"
    ) {
      const body = z
        .strictObject({ notes: z.string().trim().min(1).max(4_000) })
        .parse(await readJson(request));

      return sendJson(
        response,
        200,
        await this.service.reviewAttention(operatorIdentifierSchema.parse(parts[2]), body.notes),
      );
    }

    if (method === "GET" && url.pathname === "/api/recovery-cases") {
      return sendJson(response, 200, await this.service.listRecoveryCases());
    }

    if (method === "GET" && parts.length === 3 && parts[1] === "recovery-cases") {
      return sendJson(
        response,
        200,
        await this.service.readRecoveryCase(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    if (method === "GET" && url.pathname === "/api/experiments") {
      return sendJson(response, 200, await this.service.listExperiments());
    }

    if (method === "GET" && parts.length === 3 && parts[1] === "experiments") {
      return sendJson(
        response,
        200,
        await this.service.readExperiment(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    if (method === "POST" && url.pathname === "/api/controlled-tests") {
      return sendJson(
        response,
        202,
        await this.service.launchControlledTest(
          controlledTestRequestSchema.parse(await readJson(request)),
        ),
      );
    }

    if (method === "GET" && parts.length === 3 && parts[1] === "controlled-tests") {
      return sendJson(
        response,
        200,
        await this.service.readControlledTest(operatorIdentifierSchema.parse(parts[2])),
      );
    }

    throw new OperatorUnavailableError("The requested operator endpoint was not found.");
  }

  private async serveDashboard(
    response: ServerResponse,
    requestedPath: string,
    headOnly: boolean,
  ): Promise<void> {
    const root = this.options.dashboardDirectory ?? dashboardDirectory;

    const normalized = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");

    const candidate = resolve(root, normalized);

    const insideDashboard = candidate === root || candidate.startsWith(`${root}/`);

    const file =
      insideDashboard && (await fileExists(candidate)) ? candidate : resolve(root, "index.html");

    if (!(await fileExists(file))) {
      throw new OperatorUnavailableError(
        "The built dashboard is unavailable. Build the dashboard package before starting operator mode.",
      );
    }

    response.writeHead(200, {
      "Content-Type": staticContentTypes[extname(file)] ?? "application/octet-stream",
      "Cache-Control": file.endsWith("index.html") ? "no-store" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    if (headOnly) {
      response.end();

      return;
    }

    createReadStream(file)
      .on("error", () => response.destroy())
      .pipe(response);
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  let total = 0;

  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    total += bytes.length;
    if (total > maxBodyBytes) {
      throw new OperatorUnavailableError("The request body is too large.");
    }

    chunks.push(bytes);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new OperatorUnavailableError("The request body must be valid JSON.");
  }
}

function assertLocalMutation(request: IncomingMessage, port: number): void {
  if (!hasLocalMutationGuard(request.headers, port)) {
    throw new OperatorUnavailableError(
      "This local mutation request was rejected by the operator caller guard.",
    );
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function sendError(
  response: ServerResponse,
  status: number,
  message: string,
  correlationId: string,
): void {
  sendJson(response, status, { error: { message, correlationId } });
}

function publicMessage(error: unknown): string {
  if (error instanceof OperatorUnavailableError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return "The request did not match the accepted operator input.";
  }

  return "The operator request could not be completed. Check the local service log with the correlation ID.";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
