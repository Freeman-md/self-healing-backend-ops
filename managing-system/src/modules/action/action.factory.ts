import { randomUUID } from "node:crypto";
import type { ActionExecutionResult, ActionExecutionContinuation } from "./action.types";

export class ActionFactory {
  createActionExecutionResult(input: Omit<ActionExecutionResult, "id">): ActionExecutionResult {
    return { ...input, id: `action-execution-${randomUUID()}` };
  }
  createBlockedActionExecutionResult(input: Omit<ActionExecutionResult, "id" | "status" | "continuation">): ActionExecutionResult {
    return this.createActionExecutionResult({ ...input, status: "blocked", continuation: "blocked" });
  }
  createFailedActionExecutionResult(input: Omit<ActionExecutionResult, "id" | "status" | "continuation">): ActionExecutionResult {
    return this.createActionExecutionResult({ ...input, status: "failed", continuation: "failed" });
  }
  createSuccessfulActionExecutionResult(input: Omit<ActionExecutionResult, "id" | "status" | "continuation"> & { continuation: Extract<ActionExecutionContinuation, "resolved" | "continue"> }): ActionExecutionResult {
    return this.createActionExecutionResult({ ...input, status: "executed" });
  }
}
