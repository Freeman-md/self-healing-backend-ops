import "dotenv/config";

import {
  readBoolean,
  readAgentStrategyVersion,
  readNumber,
  readOptionalEnum,
  readOptionalString,
  readPostgresDatabaseUrl,
  readString,
} from "./helpers";

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
    url: string;
  };
  actions: {
    dockerEnabled: boolean;
    dockerTimeoutMs: number;
    postActionHealthTimeoutMs: number;
    postActionHealthPollIntervalMs: number;
  };
  trial: {
    runMode: "controlled" | "monitor";
    recoveryMode?: "baseline" | "agent";
    agentStrategyVersion: "v1" | "v2";
    scenarioId?: "S1" | "S2" | "S3";
  };
  monitoring: {
    intervalMs: number;
    consecutiveUnhealthyThreshold: number;
    cooldownMs: number;
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
    model: readString(process.env.OPENAI_MODEL, "gpt-5.6-luna"),
  },
  database: {
    url: readPostgresDatabaseUrl(process.env.DATABASE_URL),
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
  trial: {
    runMode:
      readOptionalEnum(
        process.env.MANAGING_SYSTEM_RUN_MODE,
        ["controlled", "monitor"],
        "MANAGING_SYSTEM_RUN_MODE",
      ) ?? "controlled",
    recoveryMode: readOptionalEnum(
      process.env.RECOVERY_MODE,
      ["baseline", "agent"],
      "RECOVERY_MODE",
    ),
    agentStrategyVersion: readAgentStrategyVersion(
      readOptionalEnum(process.env.RECOVERY_MODE, ["baseline", "agent"], "RECOVERY_MODE"),
      process.env.AGENT_STRATEGY_VERSION,
    ),
    scenarioId: readOptionalEnum(process.env.SCENARIO_ID, ["S1", "S2", "S3"], "SCENARIO_ID"),
  },
  monitoring: {
    intervalMs: readNumber(process.env.MONITOR_INTERVAL_MS, 30000),
    consecutiveUnhealthyThreshold: readNumber(
      process.env.MONITOR_CONSECUTIVE_UNHEALTHY_THRESHOLD,
      2,
    ),
    cooldownMs: readNumber(process.env.MONITOR_RECOVERY_COOLDOWN_MS, 60000),
  },
};
