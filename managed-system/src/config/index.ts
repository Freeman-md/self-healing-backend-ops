import {
  readBoolean,
  readInteger,
  readLogLevel,
  readString,
} from "@/config/helpers";
import type {
  DatabaseConfig,
  ObservabilityConfig,
  RuntimeConfig,
  ServerConfig,
} from "@/types/config";

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
