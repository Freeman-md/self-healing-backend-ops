import { parseWithSchema } from "@/lib/zod/helpers";
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
} from "@/lib/zod/schemas/work-order";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from "@/types/work-order";

export function parseCreateWorkOrderInput(
  payload: unknown,
): CreateWorkOrderInput {
  return parseWithSchema(createWorkOrderSchema, payload);
}

export function parseUpdateWorkOrderInput(
  payload: unknown,
): UpdateWorkOrderInput {
  return parseWithSchema(updateWorkOrderSchema, payload);
}
