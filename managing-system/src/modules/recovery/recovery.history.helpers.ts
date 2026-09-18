import { createHash } from "node:crypto";
import type { EvidenceSnapshot } from "@/modules/evidence";

export const RETRIEVAL_PROTOCOL_VERSION = "structured-exact-v1";
export const RECOVERY_POLICY_VERSION = "running-unreachable-hold-v1";
export const MEASUREMENT_DEFINITION_VERSION = "2.0.0";

export function fingerprintRecoveryConfiguration(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(canonical);
    }

    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    }

    return input;
  };

  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

// Only finite operational states participate. Free-form evidence never enters a case key.
export function recoveryEvidenceSignature(
  snapshot: EvidenceSnapshot,
  incident?: string,
): string | null {
  const signals = snapshot.signals.filter((signal) => signal.method === "deterministic");

  if (new Set(signals.map((signal) => signal.code)).size !== signals.length) {
    return null;
  }

  for (const code of [
    "managed_system_reachability",
    "managed_system_container_state",
    "postgres_container_state",
  ]) {
    const signal = signals.find((entry) => entry.code === code);

    if (!signal || signal.status === "unknown" || signal.value === null) {
      return null;
    }

    if (code === "managed_system_reachability" && typeof signal.value !== "boolean") {
      return null;
    }

    if (
      code !== "managed_system_reachability" &&
      !["running", "stopped", "exited", "restarting"].includes(String(signal.value))
    ) {
      return null;
    }
  }

  const states = signals
    .map((signal) => ({
      code: signal.code,
      status: signal.status,
      value:
        typeof signal.value === "boolean" || signal.value === null
          ? signal.value
          : ["healthy", "unhealthy", "running", "stopped", "exited", "restarting"].includes(
                String(signal.value),
              )
            ? signal.value
            : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return fingerprintRecoveryConfiguration({
    protocol: RETRIEVAL_PROTOCOL_VERSION,
    target: snapshot.targetSystem,
    incident: incident ?? null,
    states,
  });
}
