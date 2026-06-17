import { HttpError } from "@/shared/http-error";

export function readRequiredPathParam(
  value: string | string[] | undefined,
  fieldName: string,
): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  throw new HttpError(400, `${fieldName} path parameter is required`);
}
