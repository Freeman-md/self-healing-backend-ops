import { readFileSync } from "node:fs";
import { z } from "zod/v4";

const buildIdentitySchema = z.strictObject({
  sourceRevision: z.union([z.literal("unrecorded"), z.string().regex(/^[a-f0-9]{40}$/)]),
});

export function readBuildRevision(
  path: string | URL = new URL("../../build-identity.json", import.meta.url),
): string {
  try {
    return buildIdentitySchema.parse(JSON.parse(readFileSync(path, "utf8"))).sourceRevision;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "unrecorded";
    }

    throw new Error("The non-secret build identity is invalid.");
  }
}
