import {
  readBoolean,
  readInteger,
  readLogLevel,
  readString,
  type LogLevel,
} from "./helpers.js";

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

function buildDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  return {
    host: readString(env.DB_HOST, "localhost"),
    port: readInteger(env.DB_PORT, 5432, "DB_PORT"),
    name: readString(env.DB_NAME, "managed_system"),
    user: readString(env.DB_USER, "postgres"),
    password: readString(env.DB_PASSWORD, "postgres"),
    connectionUrl: readString(env.DATABASE_URL, null),
  };
}

function buildServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    port: readInteger(env.PORT, 3000, "PORT"),
    environment: readString(env.NODE_ENV, "development"),
  };
}

function buildObservabilityConfig(env: NodeJS.ProcessEnv): ObservabilityConfig {
  return {
    logLevel: readLogLevel(env.LOG_LEVEL),
    metricsEnabled: readBoolean(env.METRICS_ENABLED, true),
  };
}

export function createConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    server: buildServerConfig(env),
    database: buildDatabaseConfig(env),
    observability: buildObservabilityConfig(env),
  };
}

export const config = createConfig();
