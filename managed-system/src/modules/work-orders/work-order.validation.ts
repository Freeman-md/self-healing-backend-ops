import { z } from "zod";
import { WorkOrderStatus } from "@prisma/client";

export const createWorkOrderSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),

    description: z.string().trim().min(1, "description is required"),

    status: z.nativeEnum(WorkOrderStatus).optional(),

    assignee: z
      .string()
      .trim()
      .min(1, "assignee cannot be empty")
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

export const updateWorkOrderSchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),

    description: z.string().trim().min(1, "description cannot be empty").optional(),

    status: z.nativeEnum(WorkOrderStatus).optional(),

    assignee: z.string().trim().min(1, "assignee cannot be empty").nullable().optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "at least one field is required",
  });
