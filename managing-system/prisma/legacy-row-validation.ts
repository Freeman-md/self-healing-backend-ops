export type LegacyRow = Record<string, unknown>;

export function requireLegacyMatch(
  entityName: string,
  row: LegacyRow,
  columnName: string,
  payloadValue: string | null | undefined,
): void {
  const relationalValue = row[columnName] ?? null;
  const normalizedPayloadValue = payloadValue ?? null;

  if (relationalValue !== normalizedPayloadValue) {
    throw new Error(
      `Legacy ${entityName} ${columnName} mismatch: relational=${String(relationalValue)}, payload=${String(normalizedPayloadValue)}.`,
    );
  }
}
