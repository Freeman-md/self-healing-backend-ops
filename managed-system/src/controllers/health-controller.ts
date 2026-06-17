import type { Request, Response } from "express";

import { healthService } from "@/services/health-service";

export class HealthController {
  async getHealth(_request: Request, response: Response) {
    const health = await healthService.getHealth();
    const statusCode = health.status === "healthy" ? 200 : 503;

    return response.status(statusCode).json(health);
  }
}

export const healthController = new HealthController();
