import type { NextFunction, Request, Response } from "express";

import { HttpError } from "@/shared/http-error";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({
      error: error.message,
    });
  }

  console.error(error);

  return response.status(500).json({
    error: "internal server error",
  });
}
