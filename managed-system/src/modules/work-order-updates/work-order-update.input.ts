import { parseWithSchema } from "@/lib/zod/helpers";

import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "./work-order-update.model";
import {
  createWorkOrderUpdateSchema,
  updateWorkOrderUpdateSchema,
} from "./work-order-update.validation";

export function parseCreateWorkOrderUpdateInput(payload: unknown): CreateWorkOrderUpdateInput {
  return parseWithSchema(createWorkOrderUpdateSchema, payload);
}

export function parseUpdateWorkOrderUpdateInput(payload: unknown): UpdateWorkOrderUpdateInput {
  return parseWithSchema(updateWorkOrderUpdateSchema, payload);
}
