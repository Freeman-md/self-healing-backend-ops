import type { ActionDefinition } from "../action.types";

export type ActionHandlerInput = {
  action: ActionDefinition;
  trialRecordId: string;
};

export type ActionHandlerResult = {
  output: string;
};

export type ActionHandler = (
  input: ActionHandlerInput,
) => Promise<ActionHandlerResult>;
