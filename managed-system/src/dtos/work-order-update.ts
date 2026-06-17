import { parseWithSchema } from "@/lib/zod/helpers";
import {
  createWorkOrderUpdateSchema,
  updateWorkOrderUpdateSchema,
} from "@/lib/zod/schemas/work-order-update";
import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "@/types/work-order";

export function parseCreateWorkOrderUpdateInput(
  payload: unknown,
): CreateWorkOrderUpdateInput {
  return parseWithSchema(createWorkOrderUpdateSchema, payload);
}

export function parseUpdateWorkOrderUpdateInput(
  payload: unknown,
): UpdateWorkOrderUpdateInput {
  return parseWithSchema(updateWorkOrderUpdateSchema, payload);
}
