import type { ActionHandler } from "./action-handler.types";
import { restartManagedSystemHandler } from "./restart-managed-system.handler";
import { restartPostgresHandler } from "./restart-postgres.handler";

const handlers: Record<string, ActionHandler> = {
  restart_managed_system_service: restartManagedSystemHandler,
  restart_postgres_container: restartPostgresHandler,
};

export function findActionHandler(handlerKey: string): ActionHandler | null {
  return handlers[handlerKey] ?? null;
}
