import type {
  EvidenceSnapshot,
  EvidenceSnapshotState,
} from "./evidence.schema";

export function getDeterministicEvidenceState(
  snapshot: EvidenceSnapshot,
): EvidenceSnapshotState {
  const signals = snapshot.signals.filter(
    (signal) => signal.method === "deterministic",
  );

  if (signals.some((signal) => signal.status === "critical")) {
    return "unhealthy";
  }
  if (signals.some((signal) => signal.status === "warning")) {
    return "degraded";
  }
  if (
    signals.length === 0 ||
    signals.some((signal) => signal.status === "unknown")
  ) {
    return "unknown";
  }
  return "healthy";
}

export function isDeterministicallyUnhealthy(
  snapshot: EvidenceSnapshot,
): boolean {
  return getDeterministicEvidenceState(snapshot) === "unhealthy";
}
