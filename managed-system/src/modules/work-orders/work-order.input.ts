import { parseWithSchema } from "@/lib/zod/helpers";
import { CreateWorkOrderInput, UpdateWorkOrderInput } from "./work-order.model";
import { createWorkOrderSchema, updateWorkOrderSchema } from "./work-order.validation";

export function parseCreateWorkOrderInput(payload: unknown): CreateWorkOrderInput {
  return parseWithSchema(createWorkOrderSchema, payload);
}

export function parseUpdateWorkOrderInput(payload: unknown): UpdateWorkOrderInput {
  return parseWithSchema(updateWorkOrderSchema, payload);
}
