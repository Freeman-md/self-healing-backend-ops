import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";

import { config } from "@/config";
import type { IOpenAITelemetrySink } from "./openai-telemetry.interface";
import type { OpenAITelemetryContext } from "./openai.types";

export class OpenAIService {
  private readonly client: OpenAI;

  constructor(
    apiKey = config.openai.apiKey,
    private readonly telemetrySink?: IOpenAITelemetrySink,
    private readonly now: () => number = Date.now,
  ) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI structured output calls");
    }

    this.client = new OpenAI({
      apiKey,
    });
  }

  async parseStructuredOutput<TSchema extends z.ZodType>(input: {
    schema: TSchema;
    schemaName: string;
    systemPrompt: string;
    userPrompt: string;
    telemetryContext?: OpenAITelemetryContext;
  }): Promise<z.infer<TSchema>> {
    const startedAtMs = this.now();

    const startedAt = new Date(startedAtMs).toISOString();

    try {
      const response = await this.client.responses.parse({
        model: config.openai.model,
        input: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
        text: {
          format: zodTextFormat(input.schema, input.schemaName),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI structured output response did not include parsed output");
      }

      await this.emitTelemetry({
        context: input.telemetryContext,
        startedAt,
        startedAtMs,
        status: "succeeded",
        usage: response.usage,
      });

      return response.output_parsed;
    } catch (error) {
      await this.emitTelemetry({
        context: input.telemetryContext,
        startedAt,
        startedAtMs,
        status: "failed",
        error: error instanceof Error ? error.message : "unknown OpenAI error",
      });
      throw error;
    }
  }

  private async emitTelemetry(input: {
    context?: OpenAITelemetryContext;
    startedAt: string;
    startedAtMs: number;
    status: "succeeded" | "failed";
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    } | null;
    error?: string;
  }): Promise<void> {
    if (!this.telemetrySink || !input.context) {
      return;
    }

    const completedAtMs = this.now();

    try {
      await this.telemetrySink.recordOpenAIInvocation({
        id: `model-invocation-${randomUUID()}`,
        ...input.context,
        model: config.openai.model,
        startedAt: input.startedAt,
        completedAt: new Date(completedAtMs).toISOString(),
        durationMs: Math.max(0, completedAtMs - input.startedAtMs),
        inputTokens: input.usage?.input_tokens ?? null,
        outputTokens: input.usage?.output_tokens ?? null,
        totalTokens: input.usage?.total_tokens ?? null,
        status: input.status,
        error: input.error ?? null,
      });
    } catch (error) {
      console.error({
        event: "openai_telemetry_recording_failed",
        error: error instanceof Error ? error.message : "unknown telemetry error",
      });
    }
  }
}

export function canUseOpenAI(): boolean {
  return Boolean(config.openai.apiKey);
}
