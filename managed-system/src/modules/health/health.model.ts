export type HealthStatus = "healthy" | "unhealthy";

export type HealthCheckResult = {
  status: HealthStatus;
  message: string;
};

export type HealthResponse = {
  status: HealthStatus;
  checks: {
    app: HealthCheckResult;
    database: HealthCheckResult;
  };
};
