import { z } from "zod/v4";

const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_.:-]+$/);

export const operatorListTrialsQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().min(1).max(100).optional(),
  run: identifier.optional(),
});

export const operatorIdentifierSchema = identifier;

export const controlledTestRequestSchema = z.strictObject({
  requestId: z.string().uuid(),
  profile: z.enum([
    "managed_system_application_stopped",
    "managed_system_postgres_stopped",
    "managed_system_application_and_postgres_stopped",
    "managed_system_application_network_isolated",
  ]),
  strategy: z.enum(["baseline", "v1", "v2", "v2-reuse"]),
  workload: z.literal("idle"),
});

export type ControlledTestRequest = z.infer<typeof controlledTestRequestSchema>;
export type OperatorListTrialsQuery = z.infer<typeof operatorListTrialsQuerySchema>;
