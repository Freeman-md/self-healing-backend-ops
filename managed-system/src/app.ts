import express from "express";

import { errorMiddleware } from "@/observability/error.middleware";
import { requestLoggerMiddleware } from "@/observability/logging/request-logger.middleware";
import { metricsMiddleware } from "@/observability/metrics/metrics.middleware";
import { notFoundMiddleware } from "@/observability/not-found.middleware";
import { healthRoutes } from "@/modules/health/health.routes";
import { metricsRoutes } from "@/modules/metrics/metrics.routes";
import { workOrderRoutes } from "@/modules/work-orders/work-order.routes";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestLoggerMiddleware);
  app.use(metricsMiddleware);

  app.use("/health", healthRoutes);
  app.use("/work-orders", workOrderRoutes);
  app.use("/metrics", metricsRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
