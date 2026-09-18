import type { IncomingHttpHeaders } from "node:http";

export function hasLocalMutationGuard(headers: IncomingHttpHeaders, port: number): boolean {
  const origin = headers.origin;

  const allowedOrigins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]);

  const host = headers.host;

  return (
    typeof origin === "string" &&
    allowedOrigins.has(origin) &&
    headers["x-operator-request"] === "1" &&
    (host === `127.0.0.1:${port}` || host === `localhost:${port}`)
  );
}
