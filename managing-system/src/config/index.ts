import "dotenv/config";

import { readBoolean, readNumber, readOptionalString, readString } from "./helpers";

export type AppConfig = {
  environment: string;
  managedSystem: {
    baseUrl: string;
    requestTimeoutMs: number;
  };
  openai: {
    apiKey?: string;
    model: string;
  };
  database: {
    path: string;
  };
  actions: {
    dockerEnabled: boolean;
    dockerTimeoutMs: number;
    postActionHealthTimeoutMs: number;
    postActionHealthPollIntervalMs: number;
  };
};

export const config: AppConfig = {
  environment: readString(process.env.NODE_ENV, "development"),
  managedSystem: {
    baseUrl: readString(process.env.MANAGED_SYSTEM_BASE_URL, "http://localhost:3004"),
    requestTimeoutMs: readNumber(process.env.MANAGED_SYSTEM_REQUEST_TIMEOUT_MS, 5000),
  },
  openai: {
    apiKey: readOptionalString(process.env.OPENAI_API_KEY),
    model: readString(process.env.OPENAI_MODEL, "gpt-4.1-mini"),
  },
  database: {
    path: readString(
      process.env.MANAGING_SYSTEM_DATABASE_PATH,
      "data/managing-system.sqlite",
    ),
  },
  actions: {
    dockerEnabled: readBoolean(process.env.DOCKER_ACTIONS_ENABLED, false),
    dockerTimeoutMs: readNumber(process.env.DOCKER_ACTION_TIMEOUT_MS, 10000),
    postActionHealthTimeoutMs: readNumber(process.env.POST_ACTION_HEALTH_TIMEOUT_MS, 30000),
    postActionHealthPollIntervalMs: readNumber(
      process.env.POST_ACTION_HEALTH_POLL_INTERVAL_MS,
      1000,
    ),
  },
};
