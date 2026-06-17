export type LogLevel = "error" | "warn" | "info" | "debug";

export type ServerConfig = {
  port: number;
  environment: string;
};

export type DatabaseConfig = {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  connectionUrl: string | null;
};

export type ObservabilityConfig = {
  logLevel: LogLevel;
  metricsEnabled: boolean;
};

export type RuntimeConfig = {
  server: ServerConfig;
  database: DatabaseConfig;
  observability: ObservabilityConfig;
};
