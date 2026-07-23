import type { Action } from "../action.types";

export type ActionHandlerInput = {
  action: Action;
  trialRecordId: string;
};

export type ActionHandlerResult = {
  output: string;
};

export type ActionHandler = (
  input: ActionHandlerInput,
) => Promise<ActionHandlerResult>;
