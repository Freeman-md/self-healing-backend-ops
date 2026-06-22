import { prisma } from "@/shared/db/prisma";

import type { HealthCheckResult, HealthResponse } from "./health.model";

function createHealthyCheck(message: string): HealthCheckResult {
  return {
    status: "healthy",
    message,
  };
}

function createUnhealthyCheck(message: string): HealthCheckResult {
  return {
    status: "unhealthy",
    message,
  };
}

export class HealthService {
  getHealth = async (): Promise<HealthResponse> => {
    const appCheck = createHealthyCheck("app is running");

    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "healthy",
        checks: {
          app: appCheck,
          database: createHealthyCheck("database connectivity check passed"),
        },
      };
    } catch {
      return {
        status: "unhealthy",
        checks: {
          app: appCheck,
          database: createUnhealthyCheck("database connectivity check failed"),
        },
      };
    }
  };
}
