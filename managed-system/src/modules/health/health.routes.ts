import { Router } from "express";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

export const healthRoutes = Router();

const healthService = new HealthService();

const healthController = new HealthController(healthService);

healthRoutes.get("/", (request, response) => healthController.getHealth(request, response));
