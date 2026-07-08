export function readString(value: string | undefined, fallback: string): string {
  const resolvedValue = value?.trim();

  if (resolvedValue) {
    return resolvedValue;
  }

  return fallback;
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
