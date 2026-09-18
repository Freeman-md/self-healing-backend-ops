import { describe, expect, it } from "vitest";

import { formatTimestamp } from "./format";

describe("formatTimestamp", () => {
  it("formats compact and detailed timestamps without invalid Intl options", () => {
    expect(() => formatTimestamp("2026-09-18T10:00:00.000Z")).not.toThrow();
    expect(() =>
      formatTimestamp("2026-09-18T10:00:00.000Z", true),
    ).not.toThrow();
  });
});
