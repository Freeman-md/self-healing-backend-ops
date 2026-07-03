import type { Request, Response } from "express";

import { metricsRegistry } from "@/observability/metrics/metrics";

export class MetricsController {
  getMetrics = async (_request: Request, response: Response) => {
    response.setHeader("Content-Type", metricsRegistry.contentType);
    response.end(await metricsRegistry.metrics());
  };
}