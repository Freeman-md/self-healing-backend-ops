// src/observability/request-logger.middleware.ts

import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";
import { requestContext } from "./request-context";

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id") ?? randomUUID();
  const startTime = process.hrtime.bigint();

  res.setHeader("x-request-id", requestId);

  requestContext.run({ requestId }, () => {
    logger.info({
      event: "http_request_started",
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      query: req.query,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

      logger[logLevel]({
        event: "http_request_completed",
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    });

    next();
  });
}