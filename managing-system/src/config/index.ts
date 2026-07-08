import "dotenv/config";

import { readNumber, readString } from "./helpers";

export type AppConfig = {
  environment: string;
  managedSystem: {
    baseUrl: string;
    requestTimeoutMs: number;
  };
};

export const config: AppConfig = {
  environment: readString(process.env.NODE_ENV, "development"),
  managedSystem: {
    baseUrl: readString(process.env.MANAGED_SYSTEM_BASE_URL, "http://localhost:3004"),
    requestTimeoutMs: readNumber(process.env.MANAGED_SYSTEM_REQUEST_TIMEOUT_MS, 5000),
  },
};
