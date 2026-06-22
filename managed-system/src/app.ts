import express from "express";

import { errorHandler } from "@/middlewares/error-handler";
import { healthRoutes } from "@/modules/health/health.routes";
import { notFoundHandler } from "@/middlewares/not-found-handler";
import { workOrderRoutes } from "@/modules/work-orders/work-order.routes";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use("/health", healthRoutes);
  app.use("/work-orders", workOrderRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
