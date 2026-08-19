import type { LogLevel } from "@/types/config";

const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug"];

export function readString(value: string | undefined | null, fallback: string): string;
export function readString(value: string | undefined | null, fallback: null): string | null;
export function readString(
  value: string | undefined | null,
  fallback: string | null,
): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return fallback;
}

export function readInteger(
  value: string | undefined | null,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${fieldName}`);
  }

  return parsed;
}

export function readBoolean(value: string | undefined | null, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Invalid boolean value");
}

export function readLogLevel(value: string | undefined | null): LogLevel {
  const logLevel = readString(value, "info");

  if (!LOG_LEVELS.includes(logLevel as LogLevel)) {
    throw new Error("Invalid log level");
  }

  return logLevel as LogLevel;
}
