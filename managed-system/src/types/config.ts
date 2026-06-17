export type LogLevel = "error" | "warn" | "info" | "debug";

export interface ServerConfig {
  port: number;
  environment: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  connectionUrl: string | null;
}

export interface ObservabilityConfig {
  logLevel: LogLevel;
  metricsEnabled: boolean;
}

export interface RuntimeConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  observability: ObservabilityConfig;
}
