import { z } from "zod";

import { WORK_ORDER_STATUSES } from "@/types/work-order";

export const createWorkOrderSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().trim().min(1, "description is required"),
  assignee: z
    .string()
    .trim()
    .min(1, "assignee cannot be empty")
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const updateWorkOrderStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES, {
    error: () => ({ message: "status is invalid" }),
  }),
});

export const addWorkOrderUpdateSchema = z.object({
  note: z.string().trim().min(1, "note is required"),
});
