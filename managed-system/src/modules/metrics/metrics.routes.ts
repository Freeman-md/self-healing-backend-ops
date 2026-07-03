import { Router } from "express";
import { MetricsController } from "./metrics.controller";

export const metricsRoutes = Router();

const metricsController = new MetricsController();

metricsRoutes.get("/", (request, response) =>
  metricsController.getMetrics(request, response),
);