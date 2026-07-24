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

export function readOptionalEnum<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  name: string,
): T | undefined {
  const resolvedValue = readOptionalString(value);
  if (!resolvedValue) return undefined;
  if ((allowedValues as readonly string[]).includes(resolvedValue)) return resolvedValue as T;
  throw new Error(`${name} must be one of: ${allowedValues.join(", ")}.`);
}
