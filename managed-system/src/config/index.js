import {
  readBoolean,
  readInteger,
  readLogLevel,
  readString,
} from "./helpers.js";

function buildDatabaseConfig(env) {
  return {
    host: readString(env.DB_HOST, "localhost"),
    port: readInteger(env.DB_PORT, 5432, "DB_PORT"),
    name: readString(env.DB_NAME, "managed_system"),
    user: readString(env.DB_USER, "postgres"),
    password: readString(env.DB_PASSWORD, "postgres"),
    connectionUrl: readString(env.DATABASE_URL, null),
  };
}

function buildServerConfig(env) {
  return {
    port: readInteger(env.PORT, 3000, "PORT"),
    environment: readString(env.NODE_ENV, "development"),
  };
}

function buildObservabilityConfig(env) {
  return {
    logLevel: readLogLevel(env.LOG_LEVEL),
    metricsEnabled: readBoolean(env.METRICS_ENABLED, true),
  };
}

export function createConfig(env = process.env) {
  return {
    server: buildServerConfig(env),
    database: buildDatabaseConfig(env),
    observability: buildObservabilityConfig(env),
  };
}

export const config = createConfig();
