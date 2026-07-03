import type { NextFunction, Request, Response } from "express";

import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "@/observability/metrics/metrics";

function getRouteLabel(request: Request): string {
  const normalizeRouteLabel = (value: string): string => {
    if (value.length > 1 && value.endsWith("/")) {
      return value.slice(0, -1);
    }

    return value;
  };

  if (request.route?.path) {
    return normalizeRouteLabel(`${request.baseUrl}${request.route.path}`);
  }

  return normalizeRouteLabel(request.baseUrl || request.path);
}

export function metricsMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const endTimer = httpRequestDurationSeconds.startTimer();

  response.on("finish", () => {
    const labels = {
      method: request.method,
      route: getRouteLabel(request),
      status_code: String(response.statusCode),
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}
