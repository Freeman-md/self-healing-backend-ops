import { z } from "zod";

export const createWorkOrderUpdateSchema = z.object({
  note: z.string().trim().min(1, "note is required"),
});

export const updateWorkOrderUpdateSchema = z.object({
  note: z.string().trim().min(1, "note is required"),
});
