const LOG_LEVELS = new Set(["error", "warn", "info", "debug"]);

export function readString(value, fallback) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return fallback;
}

export function readInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${fieldName}`);
  }

  return parsed;
}

export function readBoolean(value, fallback) {
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

export function readLogLevel(value) {
  const logLevel = readString(value, "info");

  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error("Invalid log level");
  }

  return logLevel;
}
