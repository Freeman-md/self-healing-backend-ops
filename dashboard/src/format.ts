export function formatTimestamp(value: string | null, detail = false): string {
  if (!value) {
    return "Not recorded";
  }

  // `dateStyle` and `timeStyle` cannot be combined with `timeZoneName`.
  // Use explicit fields so every supported browser can show the dashboard.
  return new Intl.DateTimeFormat("en-GB", {
    ...(detail
      ? {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      : { hour: "2-digit", minute: "2-digit" }),
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatDuration(milliseconds: number | null): string {
  return milliseconds === null ? "Not recorded" : `${(milliseconds / 1000).toFixed(1)} s`;
}

export function readableStatus(value: string): string {
  return value.replaceAll("_", " ");
}

export function statusTone(value: string): "success" | "warning" | "danger" | "primary" | "neutral" {
  if (["healthy", "passed", "verified", "resolved", "resolved_safely", "reviewed"].includes(value)) {
    return "success";
  }
  if (["unhealthy", "failed", "invalid", "unavailable"].includes(value)) {
    return "danger";
  }
  if (["degraded", "unknown", "pending", "requires_attention", "acknowledged", "stale"].includes(value)) {
    return "warning";
  }
  return "primary";
}
