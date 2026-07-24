export function readString(value: string | undefined, fallback: string): string {
  const resolvedValue = value?.trim();

  if (resolvedValue) {
    return resolvedValue;
  }

  return fallback;
}

export function readOptionalString(value: string | undefined): string | undefined {
  const resolvedValue = value?.trim();

  if (resolvedValue) {
    return resolvedValue;
  }

  return undefined;
}

export function readNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error("Configuration value must be a positive finite number.");
  }

  return parsedValue;
}

export function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("Configuration boolean value must be explicitly true or false.");
}
