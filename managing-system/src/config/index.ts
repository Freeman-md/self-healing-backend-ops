import "dotenv/config";

import { readNumber, readOptionalString, readString } from "./helpers";

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
};
