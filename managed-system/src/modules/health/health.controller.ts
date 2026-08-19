import type { Request, Response } from "express";

import { HealthService } from "./health.service";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = async (_request: Request, response: Response) => {
    const health = await this.healthService.getHealth();

    const statusCode = health.status === "healthy" ? 200 : 503;

    return response.status(statusCode).json(health);
  };
}
