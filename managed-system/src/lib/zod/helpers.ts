import { z, ZodError } from "zod";

import { HttpError } from "@/shared/http-error";

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "request validation failed";
  }

  const path = issue.path.length > 0 ? `${issue.path.join(".")} ` : "";

  return `${path}${issue.message}`.trim();
}

export function parseWithSchema<T>(schema: z.ZodType<T>, payload: unknown): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, formatZodError(error));
    }

    throw error;
  }
}
