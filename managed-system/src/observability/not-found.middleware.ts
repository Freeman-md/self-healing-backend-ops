import type { Request, Response } from "express";

import { appLogger } from "@/observability/logging/app-logger";

export function notFoundMiddleware(request: Request, response: Response) {
  appLogger.warn("route_not_found", {
    method: request.method,
    path: request.originalUrl,
    statusCode: 404,
  });

  return response.status(404).json({
    error: "route not found",
  });
}
