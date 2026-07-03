import express from "express";

import { healthRoutes } from "@/modules/health/health.routes";
import { workOrderRoutes } from "@/modules/work-orders/work-order.routes";
import { notFoundMiddleware } from "./observability/not-found.middleware";
import { errorMiddleware } from "./observability/error.middleware";
import { requestLoggerMiddleware } from "./observability/logging/request-logger.middleware";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestLoggerMiddleware)

  app.use("/health", healthRoutes);
  app.use("/work-orders", workOrderRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
