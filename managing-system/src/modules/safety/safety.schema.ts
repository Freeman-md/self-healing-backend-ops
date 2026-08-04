import { z } from "zod/v4";

const safetyRuleBase = {
  id: z.string(),
  description: z.string(),
  onFail: z.enum(["block", "escalate"]),
};

export const persistedSafetyRuleSchema = z.discriminatedUnion("checkType", [
  z.object({
    ...safetyRuleBase,
    checkType: z.literal("evidence_state_matches"),
    params: z.strictObject({
      allowedStates: z
        .array(z.enum(["healthy", "degraded", "unhealthy", "unknown"]))
        .min(1),
    }),
  }),
  z.object({
    ...safetyRuleBase,
    checkType: z.literal("max_attempts_not_exceeded"),
    params: z.strictObject({
      maxAttempts: z.number().int().positive(),
    }),
  }),
]);
