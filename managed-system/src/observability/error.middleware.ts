import type { NextFunction, Request, Response } from "express";

import { appLogger } from "@/observability/logging/app-logger";
import { HttpError } from "@/shared/http-error";

export function errorMiddleware(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpError) {
    appLogger.warn("handled_request_error", {
      method: request.method,
      path: request.originalUrl,
      statusCode: error.statusCode,
      message: error.message,
    });

    return response.status(error.statusCode).json({
      error: error.message,
    });
  }

  appLogger.error("unhandled_request_error", error, {
    method: request.method,
    path: request.originalUrl,
    statusCode: 500,
  });

  return response.status(500).json({
    error: "internal server error",
  });
}
