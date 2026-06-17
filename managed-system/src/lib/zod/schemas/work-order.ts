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

export const updateWorkOrderSchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),
    description: z
      .string()
      .trim()
      .min(1, "description cannot be empty")
      .optional(),
    status: z
      .enum(WORK_ORDER_STATUSES, {
        error: () => ({ message: "status is invalid" }),
      })
      .optional(),
    assignee: z
      .string()
      .trim()
      .min(1, "assignee cannot be empty")
      .nullable()
      .optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "at least one field is required",
  });
