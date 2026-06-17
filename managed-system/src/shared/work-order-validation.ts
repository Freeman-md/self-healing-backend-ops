import { HttpError } from "@/shared/http-error";
import {
  WORK_ORDER_STATUSES,
  type AddWorkOrderUpdateInput,
  type CreateWorkOrderInput,
  type UpdateWorkOrderStatusInput,
  type WorkOrderStatus,
} from "@/types/work-order";

function readNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "assignee must be a string");
  }

  return value.trim();
}

function isWorkOrderStatus(value: unknown): value is WorkOrderStatus {
  return WORK_ORDER_STATUSES.includes(value as WorkOrderStatus);
}

export function validateCreateWorkOrderInput(
  payload: unknown,
): CreateWorkOrderInput {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const body = payload as Record<string, unknown>;

  return {
    title: readNonEmptyString(body.title, "title"),
    description: readNonEmptyString(body.description, "description"),
    assignee: readOptionalString(body.assignee),
  };
}

export function validateUpdateWorkOrderStatusInput(
  payload: unknown,
): UpdateWorkOrderStatusInput {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const body = payload as Record<string, unknown>;

  if (!isWorkOrderStatus(body.status)) {
    throw new HttpError(400, "status is invalid");
  }

  return {
    status: body.status,
  };
}

export function validateAddWorkOrderUpdateInput(
  payload: unknown,
): AddWorkOrderUpdateInput {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "request body must be an object");
  }

  const body = payload as Record<string, unknown>;

  return {
    note: readNonEmptyString(body.note, "note"),
  };
}
