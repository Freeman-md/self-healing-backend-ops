import { z } from "zod/v4";
import { faultProfiles } from "../../src/modules/experiment/index";
import { workloadSettingsSchema } from "./workload";

export const m9ConditionSchema = z.enum([
  "baseline",
  "v1",
  "v2-off",
  "v2-empty",
  "reuse",
  "unsupported",
  "idle",
  "non-idle",
]);
export const m9ProtocolSchema = z.strictObject({
  version: z.literal("m9-panels-1.0.0"),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  condition: m9ConditionSchema,
  seed: z.string().min(1),
  repetitions: z.union([z.literal(1), z.literal(5)]),
  smoke: z.boolean(),
  measurementVersion: z.literal("2.0.0"),
  retrievalProtocol: z.literal("structured-exact-v1"),
  policyVersion: z.literal("running-unreachable-hold-v1"),
  fixturePath: z.string().min(1),
  workload: workloadSettingsSchema.nullable(),
  calibrationPath: z.string().nullable(),
  isolationPreflightPath: z.string().nullable(),
  stabilityWindowMs: z.literal(10000),
  preFaultSettleMs: z.number().int().min(1000),
  suppressionWindowMs: z.number().int().min(1000),
  runOrder: z
    .array(
      z.object({
        profile: z.enum([
          "managed_system_application_stopped",
          "managed_system_postgres_stopped",
          "managed_system_application_and_postgres_stopped",
          "managed_system_application_network_isolated",
        ]),
        repetition: z.number().int().min(1).max(10),
        phase: z.enum(["cold", "warm", "single"]),
      }),
    )
    .min(1)
    .max(15),
});
export type M9Protocol = z.infer<typeof m9ProtocolSchema>;
export function prepareM9Protocol(
  input: Omit<
    M9Protocol,
    | "version"
    | "repetitions"
    | "measurementVersion"
    | "retrievalProtocol"
    | "policyVersion"
    | "stabilityWindowMs"
    | "runOrder"
    | "smoke"
  > & { smoke?: boolean },
): M9Protocol {
  const canonical = ["baseline", "v1", "v2-off", "v2-empty"].includes(input.condition);

  const profiles = canonical
    ? (Object.keys(faultProfiles) as Array<keyof typeof faultProfiles>)
    : ["managed_system_application_stopped" as const];

  const order: M9Protocol["runOrder"] =
    input.condition === "reuse"
      ? Array.from({ length: 5 }, (_, index) => [
          {
            profile: "managed_system_application_stopped" as const,
            repetition: index * 2 + 1,
            phase: "cold" as const,
          },
          {
            profile: "managed_system_application_stopped" as const,
            repetition: index * 2 + 2,
            phase: "warm" as const,
          },
        ]).flat()
      : profiles.flatMap((profile) =>
          Array.from({ length: 5 }, (_, index) => ({
            profile:
              input.condition === "unsupported"
                ? ("managed_system_application_network_isolated" as const)
                : profile,
            repetition: index + 1,
            phase: "single" as const,
          })),
        );

  if (input.condition !== "reuse") {
    let state = [...input.seed].reduce(
      (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
      2166136261,
    );

    for (let index = order.length - 1; index > 0; index -= 1) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      const swap = state % (index + 1);

      [order[index], order[swap]] = [order[swap], order[index]];
    }
  }

  if (input.smoke) {
    order.splice(input.condition === "reuse" ? 2 : 1);
  }

  return m9ProtocolSchema.parse({
    ...input,
    version: "m9-panels-1.0.0",
    repetitions: input.smoke ? 1 : 5,
    smoke: input.smoke ?? false,
    measurementVersion: "2.0.0",
    retrievalProtocol: "structured-exact-v1",
    policyVersion: "running-unreachable-hold-v1",
    stabilityWindowMs: 10000,
    runOrder: order,
  });
}
