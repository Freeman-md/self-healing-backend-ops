import type { IContainerRuntime } from "@/infrastructure/container-runtime";

import type { Action } from "./action.types";

export type ActionHandlerInput = {
  action: Action;
  trialRecordId: string;
};

export type ActionHandlerResult = {
  output: string;
};

export type ActionHandler = (input: ActionHandlerInput) => Promise<ActionHandlerResult>;

type ContainerRestarter = Pick<IContainerRuntime, "restartTarget">;

export class ActionHandlerRegistry {
  private readonly handlers: Readonly<Record<string, ActionHandler>>;

  constructor(containerRuntime?: ContainerRestarter) {
    this.handlers = containerRuntime
      ? {
          restart_managed_system_service: async () => {
            const result = await containerRuntime.restartTarget("managed-system");

            return { output: result.output };
          },
          restart_postgres_container: async () => {
            const result = await containerRuntime.restartTarget("postgres");

            return { output: result.output };
          },
        }
      : {};
  }

  findActionHandler(handlerKey: string): ActionHandler | null {
    return this.handlers[handlerKey] ?? null;
  }
}
