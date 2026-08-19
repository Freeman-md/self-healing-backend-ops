import type { OpenAIInvocationTelemetry } from "./openai.types";

export interface IOpenAITelemetrySink {
  recordOpenAIInvocation(
    invocation: OpenAIInvocationTelemetry,
  ): Promise<void>;
}
