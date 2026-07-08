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

  if (Number.isNaN(parsedValue)) {
    return fallback;
  }

  return parsedValue;
}
