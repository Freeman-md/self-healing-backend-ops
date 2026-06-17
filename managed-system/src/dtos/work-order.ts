import { parseWithSchema } from "@/lib/zod/helpers";
import {
  addWorkOrderUpdateSchema,
  createWorkOrderSchema,
  updateWorkOrderStatusSchema,
} from "@/lib/zod/schemas/work-order";
import type {
  AddWorkOrderUpdateInput,
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
} from "@/types/work-order";

export function parseCreateWorkOrderInput(
  payload: unknown,
): CreateWorkOrderInput {
  return parseWithSchema(createWorkOrderSchema, payload);
}

export function parseUpdateWorkOrderStatusInput(
  payload: unknown,
): UpdateWorkOrderStatusInput {
  return parseWithSchema(updateWorkOrderStatusSchema, payload);
}

export function parseAddWorkOrderUpdateInput(
  payload: unknown,
): AddWorkOrderUpdateInput {
  return parseWithSchema(addWorkOrderUpdateSchema, payload);
}
