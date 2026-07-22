import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";

import { config } from "@/config";

export class OpenAIService {
  private readonly client: OpenAI;

  constructor(apiKey = config.openai.apiKey) {
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
  }): Promise<z.infer<TSchema>> {
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

    return response.output_parsed;
  }
}

export function canUseOpenAI(): boolean {
  return Boolean(config.openai.apiKey);
}
